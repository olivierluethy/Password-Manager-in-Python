//! Plaintext CSV import/export for migrating to and from other password
//! managers. These formats require plaintext passwords in each vendor's own
//! column layout, so export here is the explicitly-warned, re-authenticated
//! "Migrate" path — never the default. The default backup stays encrypted.

use serde::Serialize;

use crate::error::{Result, TresorError};
use crate::model::{Entry, EntryInput, Folder, VaultData};

/// Supported vendor CSV layouts.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Format {
    LastPass,
    Dashlane,
    Nordpass,
    Bitwarden,
    OnePassword,
    KeePass,
}

impl Format {
    pub fn parse(s: &str) -> Result<Format> {
        Ok(match s.to_lowercase().as_str() {
            "lastpass" => Format::LastPass,
            "dashlane" => Format::Dashlane,
            "nordpass" => Format::Nordpass,
            "bitwarden" => Format::Bitwarden,
            "1password" | "onepassword" => Format::OnePassword,
            "keepass" => Format::KeePass,
            other => return Err(TresorError::Message(format!("Unknown format: {other}"))),
        })
    }

    /// Canonical export header row for this format.
    fn headers(&self) -> &'static [&'static str] {
        match self {
            Format::LastPass => &["url", "username", "password", "extra", "name", "grouping"],
            Format::Dashlane => &["title", "url", "username", "password", "note", "category"],
            Format::Nordpass => &["name", "url", "username", "password", "note", "folder"],
            Format::Bitwarden => &[
                "folder",
                "favorite",
                "type",
                "name",
                "notes",
                "login_uri",
                "login_username",
                "login_password",
            ],
            Format::OnePassword => &["Title", "Url", "Username", "Password", "Notes"],
            Format::KeePass => &["Group", "Title", "Username", "Password", "URL", "Notes"],
        }
    }

    /// Build one export row for an entry, given its folder path (e.g. "Work/Email").
    fn row(&self, e: &Entry, folder_path: &str) -> Vec<String> {
        match self {
            Format::LastPass => vec![
                e.url.clone(),
                or_email(e),
                e.password.clone(),
                e.notes.clone(),
                e.title.clone(),
                folder_path.to_string(),
            ],
            Format::Dashlane => vec![
                e.title.clone(),
                e.url.clone(),
                or_email(e),
                e.password.clone(),
                e.notes.clone(),
                folder_path.to_string(),
            ],
            Format::Nordpass => vec![
                e.title.clone(),
                e.url.clone(),
                or_email(e),
                e.password.clone(),
                e.notes.clone(),
                folder_path.to_string(),
            ],
            Format::Bitwarden => vec![
                folder_path.to_string(),
                if e.favorite { "1".into() } else { "0".into() },
                "login".into(),
                e.title.clone(),
                e.notes.clone(),
                e.url.clone(),
                or_email(e),
                e.password.clone(),
            ],
            Format::OnePassword => vec![
                e.title.clone(),
                e.url.clone(),
                or_email(e),
                e.password.clone(),
                e.notes.clone(),
            ],
            Format::KeePass => vec![
                folder_path.to_string(),
                e.title.clone(),
                or_email(e),
                e.password.clone(),
                e.url.clone(),
                e.notes.clone(),
            ],
        }
    }

    /// Acceptable header names (lowercased) mapping onto each of our fields, for
    /// import. Order within each slice does not matter.
    fn import_map(&self) -> ImportMap {
        match self {
            Format::LastPass => ImportMap {
                title: &["name"],
                url: &["url"],
                username: &["username"],
                password: &["password"],
                notes: &["extra", "notes"],
                folder: &["grouping", "folder"],
            },
            Format::Dashlane => ImportMap {
                title: &["title"],
                url: &["url"],
                username: &["username", "email", "login"],
                password: &["password"],
                notes: &["note", "notes"],
                folder: &["category", "folder"],
            },
            Format::Nordpass => ImportMap {
                title: &["name", "title"],
                url: &["url"],
                username: &["username"],
                password: &["password"],
                notes: &["note", "notes"],
                folder: &["folder"],
            },
            Format::Bitwarden => ImportMap {
                title: &["name"],
                url: &["login_uri", "url"],
                username: &["login_username"],
                password: &["login_password"],
                notes: &["notes"],
                folder: &["folder"],
            },
            Format::OnePassword => ImportMap {
                title: &["title"],
                url: &["url", "website"],
                username: &["username"],
                password: &["password"],
                notes: &["notes"],
                folder: &["tags", "vault"],
            },
            Format::KeePass => ImportMap {
                title: &["title"],
                url: &["url"],
                username: &["username"],
                password: &["password"],
                notes: &["notes"],
                folder: &["group"],
            },
        }
    }
}

struct ImportMap {
    title: &'static [&'static str],
    url: &'static [&'static str],
    username: &'static [&'static str],
    password: &'static [&'static str],
    notes: &'static [&'static str],
    folder: &'static [&'static str],
}

fn or_email(e: &Entry) -> String {
    let primary = e.primary_username();
    if primary.is_empty() && !e.email.is_empty() {
        e.email.clone()
    } else {
        primary.to_string()
    }
}

/// Serialize the vault to a vendor CSV string.
pub fn export_csv(data: &VaultData, format: Format) -> Result<String> {
    let mut wtr = csv::Writer::from_writer(Vec::new());
    wtr.write_record(format.headers())
        .map_err(|e| TresorError::Message(e.to_string()))?;
    for e in &data.entries {
        let path = folder_path(&data.folders, e.folder_id.as_deref());
        wtr.write_record(format.row(e, &path))
            .map_err(|e| TresorError::Message(e.to_string()))?;
    }
    let bytes = wtr
        .into_inner()
        .map_err(|e| TresorError::Message(e.to_string()))?;
    String::from_utf8(bytes).map_err(|e| TresorError::Message(e.to_string()))
}

/// One parsed row: the entry plus the folder path it belonged to ("Work/Email").
pub struct ImportRow {
    pub entry: EntryInput,
    pub folder_path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportPreview {
    /// Number of importable entries found.
    pub count: usize,
    /// Distinct folder paths discovered.
    pub folders: Vec<String>,
}

/// Full import result: rows to apply plus the preview summary.
pub struct ParsedCsv {
    pub rows: Vec<ImportRow>,
    pub folders: Vec<String>,
}

/// Parse a vendor CSV string into rows + folder names (by path).
pub fn parse_csv(content: &str, format: Format) -> Result<ParsedCsv> {
    let mut rdr = csv::ReaderBuilder::new()
        .flexible(true)
        .from_reader(content.as_bytes());
    let headers = rdr
        .headers()
        .map_err(|e| TresorError::Message(format!("Could not read CSV header: {e}")))?
        .clone();
    let index: std::collections::HashMap<String, usize> = headers
        .iter()
        .enumerate()
        .map(|(i, h)| (h.trim().to_lowercase(), i))
        .collect();

    let map = format.import_map();
    let get = |rec: &csv::StringRecord, names: &[&str]| -> String {
        for n in names {
            if let Some(&i) = index.get(*n) {
                if let Some(v) = rec.get(i) {
                    if !v.is_empty() {
                        return v.to_string();
                    }
                }
            }
        }
        String::new()
    };

    let mut rows = Vec::new();
    let mut folder_set = std::collections::BTreeSet::new();

    for rec in rdr.records() {
        let rec = rec.map_err(|e| TresorError::Message(e.to_string()))?;
        let title = get(&rec, map.title);
        let url = get(&rec, map.url);
        let password = get(&rec, map.password);
        // Skip completely empty rows.
        if title.is_empty() && url.is_empty() && password.is_empty() {
            continue;
        }
        let folder = get(&rec, map.folder);
        if !folder.is_empty() {
            folder_set.insert(folder.clone());
        }
        let username = get(&rec, map.username);
        let looks_like_email = username.contains('@');
        rows.push(ImportRow {
            entry: EntryInput {
                title: if title.is_empty() { url.clone() } else { title },
                url,
                email: if looks_like_email {
                    username.clone()
                } else {
                    String::new()
                },
                usernames: if looks_like_email || username.is_empty() {
                    Vec::new()
                } else {
                    vec![username]
                },
                password,
                notes: get(&rec, map.notes),
                folder_id: None,
                favorite: false,
            },
            folder_path: folder,
        });
    }

    Ok(ParsedCsv {
        rows,
        folders: folder_set.into_iter().collect(),
    })
}

/// Compute a folder's full path like "Work/Email" for export.
fn folder_path(folders: &[Folder], folder_id: Option<&str>) -> String {
    let mut parts = Vec::new();
    let mut cur = folder_id.map(|s| s.to_string());
    let mut guard = 0;
    while let Some(id) = cur {
        if guard > 32 {
            break;
        }
        guard += 1;
        if let Some(f) = folders.iter().find(|f| f.id == id) {
            parts.push(f.name.clone());
            cur = f.parent_id.clone();
        } else {
            break;
        }
    }
    parts.reverse();
    parts.join("/")
}
