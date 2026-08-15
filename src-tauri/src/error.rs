use serde::Serialize;

/// All fallible operations funnel through this error. It serializes to a plain
/// string for the frontend (Tauri command results), never leaking secrets.
#[derive(Debug, thiserror::Error)]
pub enum TresorError {
    #[error("No vault exists yet")]
    NoVault,

    #[error("The vault is locked")]
    Locked,

    #[error("A vault already exists")]
    VaultExists,

    #[error("Incorrect master password")]
    BadPassword,

    #[error("Entry not found")]
    EntryNotFound,

    #[error("Folder not found")]
    FolderNotFound,

    #[error("A folder cannot be moved into itself")]
    FolderCycle,

    #[error("The vault file is corrupt or not a Tresor vault")]
    Corrupt,

    #[error("Unsupported vault version: {0}")]
    UnsupportedVersion(u32),

    #[error("{0}")]
    Crypto(String),

    #[error("{0}")]
    Io(String),

    #[error("{0}")]
    Message(String),
}

impl Serialize for TresorError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

impl From<std::io::Error> for TresorError {
    fn from(e: std::io::Error) -> Self {
        TresorError::Io(e.to_string())
    }
}

impl From<serde_json::Error> for TresorError {
    fn from(_e: serde_json::Error) -> Self {
        TresorError::Corrupt
    }
}

pub type Result<T> = std::result::Result<T, TresorError>;
