//! On-disk vault file: a single JSON envelope holding the KDF parameters, salt,
//! a verifier, and the AEAD-encrypted vault payload. The plaintext vault contents
//! never touch the disk.

use std::io::Write;
use std::path::{Path, PathBuf};

use base64::{engine::general_purpose::STANDARD as B64, Engine};
use serde::{Deserialize, Serialize};

use crate::crypto::{KdfParams, SealedBox};
use crate::error::{Result, TresorError};

const MAGIC: &str = "TRESOR";
const CURRENT_VERSION: u32 = 1;

/// The complete encrypted file written to disk (and used verbatim as the
/// encrypted `.tresor` export/backup format).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultFile {
    pub magic: String,
    pub version: u32,
    pub kdf: String,
    pub kdf_params: KdfParams,
    /// Base64 salt for Argon2id.
    pub salt: String,
    /// Verifier ciphertext (constant sealed under the derived key).
    pub verifier: SealedBox,
    /// The encrypted vault payload (serialized `VaultData`).
    pub vault: SealedBox,
}

impl VaultFile {
    pub fn new(
        kdf_params: KdfParams,
        salt: &[u8],
        verifier: SealedBox,
        vault: SealedBox,
    ) -> Self {
        VaultFile {
            magic: MAGIC.into(),
            version: CURRENT_VERSION,
            kdf: "argon2id".into(),
            kdf_params,
            salt: B64.encode(salt),
            verifier,
            vault,
        }
    }

    pub fn salt_bytes(&self) -> Result<Vec<u8>> {
        B64.decode(&self.salt).map_err(|_| TresorError::Corrupt)
    }

    pub fn validate(&self) -> Result<()> {
        if self.magic != MAGIC {
            return Err(TresorError::Corrupt);
        }
        if self.version != CURRENT_VERSION {
            return Err(TresorError::UnsupportedVersion(self.version));
        }
        Ok(())
    }
}

/// Read and parse a vault file from disk.
pub fn read_vault_file(path: &Path) -> Result<VaultFile> {
    let bytes = std::fs::read(path)?;
    let file: VaultFile = serde_json::from_slice(&bytes).map_err(|_| TresorError::Corrupt)?;
    file.validate()?;
    Ok(file)
}

/// Write a vault file atomically: write to a sibling temp file, fsync, then rename
/// over the target so a crash never leaves a half-written vault.
pub fn write_vault_file(path: &Path, file: &VaultFile) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let bytes = serde_json::to_vec_pretty(file)?;
    let tmp = temp_sibling(path);
    {
        let mut f = std::fs::File::create(&tmp)?;
        f.write_all(&bytes)?;
        f.sync_all()?;
    }
    std::fs::rename(&tmp, path)?;
    Ok(())
}

fn temp_sibling(path: &Path) -> PathBuf {
    let mut name = path
        .file_name()
        .map(|n| n.to_os_string())
        .unwrap_or_default();
    name.push(".tmp");
    path.with_file_name(name)
}

pub fn vault_exists(path: &Path) -> bool {
    path.is_file()
}
