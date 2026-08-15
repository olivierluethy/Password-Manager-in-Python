//! Cryptographic core.
//!
//! - Key derivation: Argon2id (memory-hard) from the master password + a random
//!   salt. The derived key never leaves memory and is zeroized on drop.
//! - Vault encryption: XChaCha20-Poly1305 (AEAD) with a fresh 24-byte random
//!   nonce per encryption.
//! - Verifier: a small AEAD ciphertext over a constant, used to check the master
//!   password quickly without needing to decrypt the whole vault and without ever
//!   storing the password or the key.
//!
//! Nothing here persists the master password or the derived key.

use argon2::{Algorithm, Argon2, Params, Version};
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use chacha20poly1305::aead::{Aead, KeyInit};
use chacha20poly1305::{XChaCha20Poly1305, XNonce};
use rand::rngs::OsRng;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use zeroize::{Zeroize, ZeroizeOnDrop};

use crate::error::{Result, TresorError};

const KEY_LEN: usize = 32;
const SALT_LEN: usize = 16;
const NONCE_LEN: usize = 24;
const VERIFIER_PLAINTEXT: &[u8] = b"tresor-verifier-v1";

/// Argon2id cost parameters, persisted alongside the vault so it can always be
/// re-derived. Defaults follow OWASP guidance, tuned up for a desktop machine.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct KdfParams {
    /// Memory cost in KiB.
    pub m_cost: u32,
    /// Iterations (time cost).
    pub t_cost: u32,
    /// Parallelism (lanes).
    pub p_cost: u32,
}

impl Default for KdfParams {
    fn default() -> Self {
        // 64 MiB, 2 passes, 1 lane. Memory hardness (64 MiB, well above the OWASP
        // 19 MiB floor) is the primary defense; 2 passes lands the unlock in the
        // ~250-500ms interactive target on typical desktop hardware. The key is
        // derived once per session and cached, so this cost is paid only at unlock.
        // Existing vaults keep whatever params they were created with.
        KdfParams {
            m_cost: 65_536,
            t_cost: 2,
            p_cost: 1,
        }
    }
}

/// A derived 32-byte key. Zeroized when dropped.
#[derive(ZeroizeOnDrop)]
pub struct DerivedKey([u8; KEY_LEN]);

impl DerivedKey {
    fn cipher(&self) -> XChaCha20Poly1305 {
        XChaCha20Poly1305::new(self.0.as_ref().into())
    }
}

/// Fill a buffer with cryptographically secure random bytes.
fn random_bytes(len: usize) -> Vec<u8> {
    let mut buf = vec![0u8; len];
    OsRng.fill_bytes(&mut buf);
    buf
}

/// Generate a fresh random salt for a new vault.
pub fn generate_salt() -> [u8; SALT_LEN] {
    let mut salt = [0u8; SALT_LEN];
    OsRng.fill_bytes(&mut salt);
    salt
}

/// Derive the encryption key from a master password and salt. The password bytes
/// are zeroized inside this function before returning.
pub fn derive_key(master_password: &str, salt: &[u8], params: &KdfParams) -> Result<DerivedKey> {
    let argon = Argon2::new(
        Algorithm::Argon2id,
        Version::V0x13,
        Params::new(params.m_cost, params.t_cost, params.p_cost, Some(KEY_LEN))
            .map_err(|e| TresorError::Crypto(format!("invalid KDF params: {e}")))?,
    );

    let mut key = [0u8; KEY_LEN];
    // Copy the password into an owned buffer we can zeroize.
    let mut pw = master_password.as_bytes().to_vec();
    let res = argon.hash_password_into(&pw, salt, &mut key);
    pw.zeroize();
    res.map_err(|e| TresorError::Crypto(format!("key derivation failed: {e}")))?;

    Ok(DerivedKey(key))
}

/// A self-describing AEAD ciphertext: base64 nonce + base64 ciphertext.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SealedBox {
    pub nonce: String,
    pub ct: String,
}

/// Encrypt plaintext under the key with a fresh random nonce.
pub fn seal(key: &DerivedKey, plaintext: &[u8]) -> Result<SealedBox> {
    let nonce_bytes = random_bytes(NONCE_LEN);
    let nonce = XNonce::from_slice(&nonce_bytes);
    let ct = key
        .cipher()
        .encrypt(nonce, plaintext)
        .map_err(|_| TresorError::Crypto("encryption failed".into()))?;
    Ok(SealedBox {
        nonce: B64.encode(&nonce_bytes),
        ct: B64.encode(&ct),
    })
}

/// Decrypt a sealed box. A tag mismatch (wrong key / tampering) yields BadPassword
/// so callers can surface "incorrect master password" cleanly.
pub fn open(key: &DerivedKey, sealed: &SealedBox) -> Result<Vec<u8>> {
    let nonce_bytes = B64
        .decode(&sealed.nonce)
        .map_err(|_| TresorError::Corrupt)?;
    let ct = B64.decode(&sealed.ct).map_err(|_| TresorError::Corrupt)?;
    if nonce_bytes.len() != NONCE_LEN {
        return Err(TresorError::Corrupt);
    }
    let nonce = XNonce::from_slice(&nonce_bytes);
    key.cipher()
        .decrypt(nonce, ct.as_ref())
        .map_err(|_| TresorError::BadPassword)
}

/// Build the verifier ciphertext for a freshly derived key.
pub fn make_verifier(key: &DerivedKey) -> Result<SealedBox> {
    seal(key, VERIFIER_PLAINTEXT)
}

/// Check a derived key against a stored verifier. Returns Ok(()) only if the key
/// decrypts the verifier to the expected constant.
pub fn check_verifier(key: &DerivedKey, verifier: &SealedBox) -> Result<()> {
    let pt = open(key, verifier)?;
    if pt == VERIFIER_PLAINTEXT {
        Ok(())
    } else {
        Err(TresorError::BadPassword)
    }
}
