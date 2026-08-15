//! The vault data model. Everything here is serialized to JSON, encrypted, and
//! written to a single vault file. Nothing here is ever persisted in plaintext.

use serde::{Deserialize, Serialize};

/// Current Unix time in seconds. Public so the vault manager can stamp edits.
pub fn now_ts() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn now() -> i64 {
    now_ts()
}

pub fn new_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

/// A single credential entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub url: String,
    #[serde(default)]
    pub email: String,
    /// A flexible list of usernames (0..N). An entry may have several logins.
    #[serde(default)]
    pub usernames: Vec<String>,
    /// Legacy single-username field. Present only on vaults written before the
    /// multi-username migration; folded into `usernames` on load and never
    /// written back (skipped when empty).
    #[serde(default, rename = "username", skip_serializing_if = "Option::is_none")]
    pub legacy_username: Option<String>,
    #[serde(default)]
    pub password: String,
    #[serde(default)]
    pub notes: String,
    #[serde(default)]
    pub folder_id: Option<String>,
    #[serde(default)]
    pub favorite: bool,
    pub created_at: i64,
    pub updated_at: i64,
    /// When the password itself last changed — powers the "stale" health check.
    pub password_updated_at: i64,
}

impl Entry {
    pub fn new(input: EntryInput) -> Self {
        let ts = now();
        Entry {
            id: new_id(),
            title: input.title,
            url: input.url,
            email: input.email,
            usernames: clean_usernames(input.usernames),
            legacy_username: None,
            password: input.password,
            notes: input.notes,
            folder_id: input.folder_id,
            favorite: input.favorite,
            created_at: ts,
            updated_at: ts,
            password_updated_at: ts,
        }
    }

    /// Apply an edit, bumping timestamps. `password_updated_at` only moves when the
    /// password actually changed.
    pub fn apply(&mut self, input: EntryInput) {
        let password_changed = input.password != self.password;
        self.title = input.title;
        self.url = input.url;
        self.email = input.email;
        self.usernames = clean_usernames(input.usernames);
        self.password = input.password;
        self.notes = input.notes;
        self.folder_id = input.folder_id;
        self.favorite = input.favorite;
        self.updated_at = now();
        if password_changed {
            self.password_updated_at = self.updated_at;
        }
    }

    /// Fold a legacy single `username` into the `usernames` list. Idempotent.
    fn migrate(&mut self) {
        if let Some(u) = self.legacy_username.take() {
            let u = u.trim().to_string();
            if !u.is_empty() && !self.usernames.iter().any(|x| x == &u) {
                self.usernames.insert(0, u);
            }
        }
    }

    /// The primary username, if any (first in the list).
    pub fn primary_username(&self) -> &str {
        self.usernames.first().map(|s| s.as_str()).unwrap_or("")
    }
}

/// Trim usernames and drop empties, preserving order.
fn clean_usernames(list: Vec<String>) -> Vec<String> {
    list.into_iter()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect()
}

/// Fields the UI supplies when creating or editing an entry.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EntryInput {
    pub title: String,
    #[serde(default)]
    pub url: String,
    #[serde(default)]
    pub email: String,
    #[serde(default)]
    pub usernames: Vec<String>,
    #[serde(default)]
    pub password: String,
    #[serde(default)]
    pub notes: String,
    #[serde(default)]
    pub folder_id: Option<String>,
    #[serde(default)]
    pub favorite: bool,
}

/// A folder in the (nested) tree. `parent_id == None` means a root folder.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Folder {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub parent_id: Option<String>,
    #[serde(default)]
    pub order: i32,
    pub created_at: i64,
    pub updated_at: i64,
}

impl Folder {
    pub fn new(name: String, parent_id: Option<String>, order: i32) -> Self {
        let ts = now();
        Folder {
            id: new_id(),
            name,
            parent_id,
            order,
            created_at: ts,
            updated_at: ts,
        }
    }
}

/// User-configurable settings, stored inside the encrypted vault.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    /// Vault timeout, Bitwarden-style. Interpreted by the frontend:
    ///  `-1` = Immediately (lock when the app is hidden/minimized),
    ///   `0` = Never, `-2` = On app restart (no in-session lock),
    ///   any positive value = inactivity seconds (60, 300, 900, 1800, 3600, 14400).
    /// The vault never locks on window blur, navigation, or dialog/menu use.
    #[serde(default = "default_auto_lock")]
    pub auto_lock_secs: i32,
    /// What happens when the timeout elapses: "lock" or "logout".
    #[serde(default = "default_timeout_action")]
    pub vault_timeout_action: String,
    /// Lock the vault when the app window is closed.
    #[serde(default = "default_true")]
    pub lock_on_close: bool,
    /// Clear the clipboard this many seconds after a copy.
    #[serde(default = "default_clipboard")]
    pub clipboard_clear_secs: u32,
    /// "system" | "dark" | "light".
    #[serde(default = "default_theme")]
    pub theme: String,
    /// Preferred browser key ("default", "firefox", "chrome", ...).
    #[serde(default = "default_browser")]
    pub default_browser: String,
    /// Load website favicons for entries (makes a request to the entry's own site).
    #[serde(default = "default_true")]
    pub load_website_icons: bool,
    /// Opt-in HaveIBeenPwned breach checking (the only networked feature).
    #[serde(default)]
    pub hibp_enabled: bool,
}

fn default_auto_lock() -> i32 {
    900
}
fn default_timeout_action() -> String {
    "lock".into()
}
fn default_true() -> bool {
    true
}
fn default_clipboard() -> u32 {
    20
}
fn default_theme() -> String {
    "dark".into()
}
fn default_browser() -> String {
    "default".into()
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            auto_lock_secs: default_auto_lock(),
            vault_timeout_action: default_timeout_action(),
            lock_on_close: true,
            clipboard_clear_secs: default_clipboard(),
            theme: default_theme(),
            default_browser: default_browser(),
            load_website_icons: true,
            hibp_enabled: false,
        }
    }
}

/// The complete decrypted vault contents.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultData {
    #[serde(default)]
    pub entries: Vec<Entry>,
    #[serde(default)]
    pub folders: Vec<Folder>,
    #[serde(default)]
    pub settings: Settings,
}

impl Default for VaultData {
    fn default() -> Self {
        VaultData {
            entries: Vec::new(),
            folders: Vec::new(),
            settings: Settings::default(),
        }
    }
}

impl VaultData {
    /// Bring freshly-loaded data up to the current schema: fold legacy
    /// single-username entries into the `usernames` list. Safe to call repeatedly.
    pub fn migrate(&mut self) {
        for e in self.entries.iter_mut() {
            e.migrate();
        }
    }
}
