<div align="center">

# Tresor

**A fully local, cross-platform password vault.**

Your passwords never leave your machine. No cloud, no accounts, no telemetry.

Built with Tauri 2 · Rust · React · TypeScript

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
- **Auto-lock.** Locks on inactivity (configurable) and when the window loses
  focus.
- **Delightful, fast UI.** A three-pane vault, an instant command-palette search
  that always shows the nearest match, and a signature "combination dial".
- **Password generator.** Random, passphrase (EFF wordlist), and pronounceable
  modes with a live entropy readout — all from your OS secure RNG.
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
- **Breach check (opt-in).** HaveIBeenPwned via k-anonymity — the *only* feature
  that ever touches the network, and it's off by default.

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

MIT — see [`LICENSE`](LICENSE).
