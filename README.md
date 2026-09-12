<div align="center">
  <img src="src-tauri/icons/128x128.png" alt="Tresor logo" width="140" />

# Tresor

**A fully local, cross-platform password vault.**

Your passwords never leave your machine. No cloud, no accounts, no telemetry.

Built with Tauri 2 · Rust · React · TypeScript

  <p>
    <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-blue.svg"></a>
    <img alt="Tauri" src="https://img.shields.io/badge/Tauri_2-24C8DB?logo=tauri&logoColor=white">
    <img alt="Rust" src="https://img.shields.io/badge/Rust-000000?logo=rust&logoColor=white">
    <img alt="React" src="https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black">
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white">
  </p>

</div>

---

## What it is

Tresor is a desktop password manager that keeps everything — every password and
all metadata — encrypted on your own computer in a single vault file. It is a
ground-up rewrite of an earlier Python prototype (see
[`docs/LEGACY-ASSESSMENT.md`](docs/LEGACY-ASSESSMENT.md) for the story of what
came before and why it was replaced).

### Highlights

- **Strong local crypto.** Master password → **Argon2id** key derivation; vault
  encrypted at rest with **XChaCha20-Poly1305** (AEAD). The master password and
  derived key are never stored; secrets are zeroized in memory on lock.
- **Bitwarden-style session.** Unlock once and the vault stays open for the whole
  session; it locks only on the configurable inactivity timeout, an explicit
  **Lock now**, or app close — never on window blur, navigation, or opening a
  dialog. The key is derived once at unlock and cached in memory (zeroized on
  lock).
- **Website favicons.** Entries show the site's own icon (fetched by the backend
  and cached locally), with a themed monogram fallback — toggleable.
- **Multiple usernames.** Each entry holds a flexible list of usernames (0..N)
  alongside an optional email; the password stays required.
- **Delightful, fast UI.** A three-pane vault, an instant command-palette search
  that always shows the nearest match, per-entry ⋯ quick actions, and a signature
  "combination dial".
- **Password generator.** Random (with minimum numbers/symbols), passphrase (EFF
  wordlist), and pronounceable modes with a live entropy readout — all from your
  OS secure RNG.
- **Health dashboard.** Detects weak, reused (identical), similar (Levenshtein),
  and stale passwords with concrete fixes.
- **Strength analysis.** zxcvbn scoring with human-readable suggestions as you type.
- **Local phishing checks.** URL verification at save and open time: https,
  IP-literals, punycode/homograph, risky TLDs, and a bundled blocklist — no cloud.
- **Open in any browser.** System default or a specific installed browser
  (Brave, Firefox, Chrome, Edge…), global or per action.
- **Nested folders** with drag-and-drop organization.
- **Encrypted backup** (`.tresor`) as the default export/import — master-password
  locked. Plus a clearly-warned, re-authenticated **CSV migration** to/from
  LastPass, Dashlane, NordPass, Bitwarden, 1Password, and KeePass.
- **Breach check (opt-in).** HaveIBeenPwned via k-anonymity — off by default,
  and only ever sends the first 5 characters of a password's SHA-1 hash.
- **Networking is minimal and controllable.** Only two features reach the
  network: the opt-in breach check above, and website favicons (fetched by the
  backend from each entry's own site, cached locally, toggleable and defaulting
  on). Everything else — crypto, generation, health, phishing checks — is fully
  offline.

## Running from source

You need [Node.js](https://nodejs.org) 18+, [pnpm](https://pnpm.io), and the
[Rust toolchain](https://rustup.rs).

```bash
pnpm install          # install frontend dependencies
pnpm tauri dev        # run the app in development
```

### Building release binaries

```bash
pnpm tauri build
```

Artifacts land in `src-tauri/target/release/bundle/`:

| Platform | Output |
|----------|--------|
| Linux    | `.deb`, `.rpm`, `.AppImage` |
| macOS    | `.app`, `.dmg` |
| Windows  | `.msi`, `.exe` (NSIS) |

### Platform build prerequisites

- **Linux:** `webkit2gtk-4.1`, `libsoup-3.0`, and standard build tools
  (`build-essential`, `libssl-dev`). On Debian/Ubuntu:
  `sudo apt install libwebkit2gtk-4.1-dev libsoup-3.0-dev build-essential`.
- **macOS:** Xcode command-line tools.
- **Windows:** the WebView2 runtime (bundled by the installer) and MSVC build tools.

## Where your data lives

A single encrypted file in the OS app-data directory:

- **Linux:** `~/.local/share/app.tresor.vault/vault.tresor`
- **macOS:** `~/Library/Application Support/app.tresor.vault/vault.tresor`
- **Windows:** `%APPDATA%\app.tresor.vault\vault.tresor`

Nothing in that file is readable without your master password.

## Documentation

- [`docs/LEGACY-ASSESSMENT.md`](docs/LEGACY-ASSESSMENT.md) — the previous
  implementation, what happened, and a critique.
- [`docs/STYLEGUIDE.md`](docs/STYLEGUIDE.md) — the "Vault Room" visual system.
- [`docs/SECURITY.md`](docs/SECURITY.md) — threat model and crypto rationale.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how the pieces fit together.

## License

Released under the [MIT License](LICENSE) © 2026 Olivier Lüthy. You're free to use, modify and distribute this
software, including commercially, as long as the copyright notice and license are included.

## Author

Built by **Olivier Lüthy** — [GitHub](https://github.com/olivierluethy).
