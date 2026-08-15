# Security

This document describes Tresor's threat model, cryptographic design, and the
deliberate trade-offs behind them.

## Design goals

1. **Local-only.** No password or vault metadata ever leaves the device. Two
   features make outbound requests, neither of which sends a stored secret: the
   opt-in, off-by-default breach check (see below), and website-favicon fetching
   (backend-only, cached locally, toggleable; it requests the entry's own domain,
   so that domain learns the icon was requested).
2. **Unreadable at rest.** Without the master password, the vault file is
   indistinguishable from random data.
3. **Memory hygiene.** Keys and decrypted secrets are zeroized as soon as they're
   no longer needed (on lock).
4. **No recoverable secret.** The master password is never stored in any form that
   could be used to recover it.

## Cryptography

| Concern | Choice | Notes |
|---------|--------|-------|
| Key derivation | **Argon2id** | 64 MiB memory, 2 iterations, 1 lane, 32-byte output (new vaults). Memory-hard against GPU/ASIC cracking; tuned for a ~250-500ms interactive unlock. Parameters are stored with the vault so they can evolve — existing vaults keep the params they were created with. The key is derived once per session and cached in memory. |
| Salt | 16 random bytes | Generated per vault from the OS CSPRNG; stored in the vault file. |
| Vault encryption | **XChaCha20-Poly1305** | AEAD; 24-byte random nonce per encryption. Authenterated — tampering is detected. |
| Password verification | Verifier blob | A constant sealed under the derived key. Unlock derives the key and checks the verifier, so a wrong password is rejected without decrypting the whole vault, and the password itself is never compared. |
| RNG | OS CSPRNG | `OsRng` for all salts, nonces, and generated passwords. Password generation uses rejection sampling to avoid modulo bias. |
| Memory | `zeroize` | The derived key is zeroized on drop; decrypted passwords/notes are cleared on lock. |

### Vault file format

A single JSON envelope (`vault.tresor`) containing: a magic marker, format
version, KDF algorithm + parameters, the salt, the verifier ciphertext, and the
AEAD-encrypted vault payload. The payload is the serialized entries, folders, and
settings. Writes are atomic (temp file + fsync + rename) so a crash never
corrupts the vault.

The encrypted `.tresor` **backup/export** uses this exact format, so a backup is
just as unreadable as the live vault and opens with the same master password.

## Threat model

**Protected against**

- **Theft of the vault file / disk / backup.** Everything is encrypted; the file
  reveals nothing without the master password.
- **Offline brute force.** Argon2id makes each password guess expensive in time
  *and* memory.
- **Casual local access while locked.** A configurable inactivity timeout (and,
  optionally, locking on app close or when the app is minimized) drops the key
  from memory; a locked vault holds no plaintext. To keep the app usable, the
  vault does **not** lock on window blur, navigation, or opening a dialog — the
  session model follows Bitwarden.
- **Tampering with the vault file.** The AEAD tag fails and the vault refuses to
  open rather than returning corrupted data.

**Explicitly out of scope**

- **A compromised operating system** (kernel malware, a keylogger, cold-boot RAM
  capture while unlocked). No user-space app can defend against these.
- **A weak master password.** The onboarding flow requires a reasonable strength
  score and shows a live meter, but the user chooses the password. There is no
  recovery — a forgotten master password means the vault stays sealed forever.
  This is a deliberate consequence of never storing the key.
- **Screen/clipboard scraping by other local software.** Copied passwords are
  auto-cleared from the clipboard after a configurable delay to reduce the window.

## Secrets in the frontend

Tresor is a Tauri app: the frontend runs in a local, in-process WebView and talks
to the Rust core over IPC — it is not a website and makes no external network
requests itself. The WebView CSP `connect-src` allows only IPC and the HIBP host;
all other outbound HTTP (the favicon fetch) happens in the **Rust backend** via
`reqwest`, not the WebView, and its result is handed back as a `data:` URL that
`img-src data:` renders. Decrypted entries are handed to the WebView so it can
display, copy, and analyze them. This is the standard Tauri desktop trade-off:
the trust boundary is the OS user session, not the WebView. All *cryptography and
key handling* stay in Rust; the WebView never sees the master password, the
derived key, or the vault file.

## The one networked feature: breach checking

Breach checking against **HaveIBeenPwned** is **off by default**. When a user
turns it on and checks a password:

- The password is hashed with SHA-1 locally.
- Only the **first 5 hex characters** of that hash are sent to
  `api.pwnedpasswords.com` (k-anonymity range query), with response padding
  enabled to hide the bucket size.
- The full hash and the password itself **never** leave the device.
- The match is completed locally against the returned suffixes.

The Content-Security-Policy allows exactly one external origin
(`https://api.pwnedpasswords.com`) and nothing else.

## Local phishing / URL verification

Performed entirely offline at save and open time: scheme/https checks,
IP-literal detection, punycode (`xn--`) and mixed-script homograph detection,
high-risk TLD heuristics, and matching against a bundled blocklist (refreshable
from a local `blocklist.txt` in the app-data directory). Tresor **warns**, it does
not silently block — the user stays in control.

## Reporting

This is a personal/educational project. If you find a security issue, please open
a GitHub issue describing it (omit any real secrets).
