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
pub struct Entry {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub url: String,
    #[serde(default)]
    pub email: String,
    #[serde(default)]
    pub username: String,
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
            username: input.username,
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
        self.username = input.username;
        self.password = input.password;
        self.notes = input.notes;
        self.folder_id = input.folder_id;
        self.favorite = input.favorite;
        self.updated_at = now();
        if password_changed {
            self.password_updated_at = self.updated_at;
        }
    }
}

/// Fields the UI supplies when creating or editing an entry.
#[derive(Debug, Clone, Deserialize)]
pub struct EntryInput {
    pub title: String,
    #[serde(default)]
    pub url: String,
    #[serde(default)]
    pub email: String,
    #[serde(default)]
    pub username: String,
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
pub struct Settings {
    /// Auto-lock after this many seconds of inactivity.
    pub auto_lock_secs: u32,
    /// Clear the clipboard this many seconds after a copy.
    pub clipboard_clear_secs: u32,
    /// Lock the vault when the window loses focus.
    pub lock_on_blur: bool,
    /// "system" | "dark" | "light".
    pub theme: String,
    /// Preferred browser key ("default", "firefox", "chrome", ...).
    pub default_browser: String,
    /// Opt-in HaveIBeenPwned breach checking (the only networked feature).
    pub hibp_enabled: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            auto_lock_secs: 300,
            clipboard_clear_secs: 20,
            lock_on_blur: true,
            theme: "dark".into(),
            default_browser: "default".into(),
            hibp_enabled: false,
        }
    }
}

/// The complete decrypted vault contents.
#[derive(Debug, Clone, Serialize, Deserialize)]
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
