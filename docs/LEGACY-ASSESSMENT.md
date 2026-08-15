# Legacy Assessment

> This document opens the project documentation. It is a factual record of the
> password manager that existed in this repository before the rewrite, followed
> by a concrete critique. It is **documentation only** — it is explicitly *not*
> a styleguide to preserve. The rewrite ("Tresor") replaces this code entirely.

---

## (a) Previous state — what existed

The repository contained a small **command-line password manager written in
Python**, roughly 190 lines across four files:

| File | Purpose |
|------|---------|
| `passwordmanager.py` | The whole application: a text menu loop with add / search / generate / edit / delete. |
| `words.py` | A flat list of ~100 single characters (misleadingly named `words`) used by the generator. |
| `pswmanager.sql` | Schema for a MySQL database `pswmanager` with one table `password(id, webname, url, password)`. |
| `README.md` | Two install commands (`mysql-connector-python`, `cryptography`) and a link to a GeeksforGeeks tutorial. |

**Architecture.** A single procedural script. On startup it opens a MySQL
connection to `localhost` as `root` with an **empty password**, then runs a
`while` loop printing a 4-item menu and dispatching on `int(input())`:

1. **Search** — `SELECT * FROM password WHERE webname LIKE '{search}'`, prints the
   row, then offers edit / delete / show-password.
2. **Add** — prompts for website, URL, password; encrypts the password with
   `cryptography.fernet.Fernet`; inserts the row.
3. **Generate** — concatenates 8 random characters from `words.py` and pushes the
   result to the Windows clipboard via `os.system('echo … | clip')`.
4. **Exit.**

**Tech used.** Python 3, `mysql-connector-python` (MySQL backend),
`cryptography` (Fernet = AES-128-CBC + HMAC-SHA256), `random`, and `os.system`
shelling out to the Windows-only `clip` utility.

**What actually worked.** Adding a row and searching for it within a *single run*
worked. The menu loop, the MySQL insert/select, and in-session encryption of a
freshly-added password all functioned. The generator produced a string and
copied it on Windows.

---

## (b) What happened — how far it got

The project stalled at a **fatal, self-inflicted crypto bug**, recorded verbatim
in the final commit message: *"Encrypt password but decrypt doesn't work."*

The cause is line 7:

```python
key = Fernet.generate_key()
```

This runs at **module import — every time the program starts** — and the key is
**never written anywhere**. Fernet encryption is symmetric: the exact key used to
encrypt is required to decrypt. Because a brand-new random key is minted on every
launch, any password stored in a previous session is mathematically
unrecoverable the moment the process exits. Decryption "doesn't work" not because
of a coding slip in `showPassword`, but because the key it needs no longer
exists. The author correctly observed the symptom and committed it as broken —
that is where development stopped.

Other work was left half-done around this: `editData` was written to **store the
new password in plaintext** (no `fernet.encrypt`), so even the intended flow was
internally inconsistent. There was no master password, no persistence of crypto
material, and no path to a real, secure, cross-session vault.

---

## (c) Critique — what was wrong, unsafe, or missing

### Security defects (critical)

1. **Ephemeral encryption key (data-loss bug).** `Fernet.generate_key()` at
   import with no persistence means the vault is write-only: stored passwords can
   never be read back. This is the headline failure and, ironically, the *safest*
   of the bugs because it also makes the ciphertext useless to an attacker.
2. **SQL injection everywhere.** Every query interpolates user input directly:
   `WHERE webname LIKE '{search}'`, `WHERE id LIKE '{id}'`, and the entire
   `UPDATE`/`DELETE` statements. A website name of `' OR '1'='1` dumps or destroys
   the table. Only the `INSERT` used a parameterised query; nothing else did.
3. **No authentication / no master password.** Anyone who launches the script has
   full read/write access to every credential. There is no gatekeeper at all — the
   defining feature of a password manager is simply absent.
4. **Database with `root` / empty password.** The passwords live in a MySQL
   instance reachable as root with no password, and the database itself is **not
   encrypted at rest**. Even with working Fernet, the key would have had to live
   next to the data to be usable, defeating the purpose.
5. **Non-cryptographic RNG for password generation.** `random.choice` is a
   Mersenne-Twister PRNG, predictable and unsuitable for secrets. It should be a
   CSPRNG (`secrets` / OS RNG).
6. **Shell/clipboard leakage.** `os.system('echo ' + password + '| clip')` injects
   the secret into a shell command line — visible in the process table, vulnerable
   to command injection if the password contains shell metacharacters, and
   Windows-only. The clipboard is also never cleared.
7. **Plaintext-on-edit.** `editData` overwrites the encrypted password with a raw
   plaintext one, silently downgrading security on any edit.

### Design / correctness defects

8. **Weak generator.** Eight independent characters from a fixed ~100-symbol
   alphabet (~53 bits of entropy at best, and biased by the odd symbol set). No
   configurable length, no passphrase mode, no entropy readout.
9. **Brittle input handling.** `int(input())` crashes the whole program on any
   non-numeric entry; `fetchone()` on a missing search term throws when iterated;
   no error handling anywhere.
10. **`LIKE` used as equality** with no wildcards and no fuzzy matching — a search
    must be exact, yet uses `LIKE` semantics, so it is both strict and subtly
    wrong.
11. **Impoverished data model.** Only `webname`, `url`, `password`. No username,
    email, notes, timestamps, folders, or tags.

### Missing capabilities (relative to a real product)

12. No strength analysis, reuse/similarity detection, or health overview.
13. No breach checking.
14. No phishing / URL verification.
15. No import/export or backup.
16. No auto-lock, no memory zeroization, no key derivation from a human secret.
17. No cross-platform story — MySQL dependency plus a Windows-only clipboard call.
18. No graphical interface; a non-technical user cannot use it.

### What should have been done instead

- Derive the encryption key from a **master password** via a memory-hard KDF and
  **persist only a salt + verifier**, never the key or the password.
- Store the vault as a **single encrypted file**, authenticated with an AEAD
  cipher, with nothing readable without the master password.
- Use **parameterised queries** (or drop SQL entirely for an encrypted blob).
- Use a **CSPRNG** for generation and clear the clipboard automatically.
- Ship a real UI, a richer data model, and the analysis/health features users
  expect from a password manager.

These conclusions are exactly what the Tresor rewrite is built to deliver:
Argon2id key derivation, XChaCha20-Poly1305 vault encryption, a single local
encrypted vault file, memory-safe Rust for all secret handling, and a polished
cross-platform desktop UI.
