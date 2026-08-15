# Architecture

Tresor is a **Tauri 2** desktop app: a Rust core that owns all state, crypto, and
storage, and a React/TypeScript frontend that renders the UI and calls into Rust
over Tauri's IPC. There is no server and no database process.

```
┌──────────────────────────────────────────────────────────┐
│  WebView (React + TypeScript + Tailwind)                   │
│                                                            │
│   screens/ LockScreen, Vault                               │
│   components/ vault · generator · settings · migration     │
│   store.tsx  ── app state, auto-lock, lock-on-blur         │
│   lib/api.ts ── typed invoke() wrappers                    │
└───────────────┬────────────────────────────────────────────┘
                │  Tauri IPC (commands)
┌───────────────▼────────────────────────────────────────────┐
│  Rust core (src-tauri/src)                                  │
│                                                            │
│   commands.rs ── one handler per command; locks the vault   │
│   vault.rs    ── VaultManager: the only owner of decrypted   │
│                  state; CRUD, folders, import/export         │
│   crypto.rs   ── Argon2id, XChaCha20-Poly1305, verifier      │
│   storage.rs  ── encrypted vault-file envelope, atomic I/O   │
│   model.rs    ── Entry, Folder, Settings, VaultData          │
│   generator · analysis · phishing · browser · breach ·       │
│   migration                                                 │
└───────────────┬────────────────────────────────────────────┘
                │  std::fs (atomic write)
        vault.tresor  (single encrypted file in app-data dir)
```

## Rust modules

| Module | Responsibility |
|--------|----------------|
| `crypto` | Argon2id KDF, XChaCha20-Poly1305 seal/open, verifier, CSPRNG. The derived key is zeroized on drop. |
| `model` | Serializable data types (camelCase for the frontend). |
| `storage` | The on-disk `VaultFile` envelope and atomic read/write. |
| `vault` | `VaultManager` — holds the decrypted `VaultData` and derived key while unlocked; all mutations go through it and re-persist. Locking drops (zeroizes) the key. |
| `generator` | Password/passphrase/pronounceable generation with entropy estimates. |
| `analysis` | zxcvbn strength scoring and whole-vault health (weak/reused/similar/stale). |
| `phishing` | Offline URL verification and the bundled blocklist. |
| `browser` | Installed-browser detection and opening URLs per-OS. |
| `breach` | Opt-in HIBP k-anonymity check (the only networked code). |
| `migration` | Plaintext CSV import/export per vendor layout. |
| `commands` | Thin Tauri command handlers that lock the state mutex and delegate. |
| `error` | `TresorError`, serialized to a plain string for the frontend. |

## State ownership

The decrypted vault lives in exactly one place: `VaultManager` inside
`AppState.vault` (`Mutex<VaultManager>`), managed by Tauri. The frontend holds a
*copy* of the current snapshot for rendering, refreshed from command return
values. There is no second source of truth. When the vault locks, the Rust state
is cleared and the frontend copy is dropped.

## Lifecycle

1. **Launch** → `vault_status` reports whether a vault file exists.
2. **No vault** → onboarding creates one (`create_vault`), deriving a key and
   writing the encrypted file.
3. **Vault exists** → the lock screen calls `unlock_vault`; the key is derived,
   the verifier checked, and the payload decrypted into memory.
4. **Unlocked** → the UI issues CRUD commands; each mutation re-encrypts and
   re-writes the vault file atomically.
5. **Auto-lock** → a frontend inactivity timer and a window-blur listener call
   `lock_vault`, which zeroizes the key and clears decrypted secrets.

## Frontend structure

- `store.tsx` — a React context holding the snapshot and all actions; owns the
  auto-lock timer, the window-blur listener, activity tracking, and theme
  application.
- `screens/` — top-level routes chosen by vault status (loading → onboarding →
  locked → unlocked).
- `components/` — grouped by feature (`vault`, `generator`, `settings`,
  `migration`) plus shared `ui/` primitives styled from `docs/STYLEGUIDE.md`.
- `lib/` — the typed API layer, fuzzy search, folder-tree helpers, and formatting.

## Why Tauri + Rust

All cryptography and secret handling live in memory-safe, zeroizable Rust with
tiny native binaries and no bundled browser engine. The frontend is disposable
presentation; the security-critical core is small, isolated, and auditable.
