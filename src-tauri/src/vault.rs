//! The vault manager: the single owner of decrypted state while unlocked. It
//! mediates every read and write, re-encrypting and persisting after mutations,
//! and zeroizing the key when locked.

use std::path::{Path, PathBuf};

use crate::crypto::{
    self, check_verifier, derive_key, generate_salt, make_verifier, DerivedKey, KdfParams,
};
use crate::error::{Result, TresorError};
use crate::model::{Entry, EntryInput, Folder, Settings, VaultData};
use crate::storage::{read_vault_file, vault_exists, write_vault_file, VaultFile};

/// Live state that exists only while the vault is unlocked.
struct UnlockedState {
    key: DerivedKey,
    salt: Vec<u8>,
    kdf_params: KdfParams,
    data: VaultData,
}

pub struct VaultManager {
    path: PathBuf,
    state: Option<UnlockedState>,
}

impl VaultManager {
    pub fn new(path: PathBuf) -> Self {
        VaultManager { path, state: None }
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    pub fn exists(&self) -> bool {
        vault_exists(&self.path)
    }

    pub fn is_unlocked(&self) -> bool {
        self.state.is_some()
    }

    // ---- lifecycle -------------------------------------------------------

    /// Create a brand-new vault, derive its key, and leave it unlocked.
    pub fn create(&mut self, master_password: &str) -> Result<()> {
        if self.exists() {
            return Err(TresorError::VaultExists);
        }
        let params = KdfParams::default();
        let salt = generate_salt().to_vec();
        let key = derive_key(master_password, &salt, &params)?;
        let data = VaultData::default();
        self.state = Some(UnlockedState {
            key,
            salt,
            kdf_params: params,
            data,
        });
        self.persist()?;
        Ok(())
    }

    /// Derive the key from the supplied password and, if the verifier matches,
    /// decrypt the vault into memory.
    pub fn unlock(&mut self, master_password: &str) -> Result<()> {
        if !self.exists() {
            return Err(TresorError::NoVault);
        }
        let file = read_vault_file(&self.path)?;
        let salt = file.salt_bytes()?;
        let key = derive_key(master_password, &salt, &file.kdf_params)?;
        check_verifier(&key, &file.verifier)?;
        let plaintext = crypto::open(&key, &file.vault)?;
        let mut data: VaultData = serde_json::from_slice(&plaintext)?;
        data.migrate();
        self.state = Some(UnlockedState {
            key,
            salt,
            kdf_params: file.kdf_params,
            data,
        });
        Ok(())
    }

    /// Lock the vault: drop (and thereby zeroize) the key and decrypted data.
    pub fn lock(&mut self) {
        // Dropping UnlockedState zeroizes the DerivedKey; explicitly clear the
        // decrypted secrets too.
        if let Some(mut st) = self.state.take() {
            for e in st.data.entries.iter_mut() {
                e.password.clear();
                e.notes.clear();
            }
        }
    }

    /// Re-encrypt the in-memory vault and write it to disk.
    fn persist(&self) -> Result<()> {
        let st = self.state.as_ref().ok_or(TresorError::Locked)?;
        let plaintext = serde_json::to_vec(&st.data)?;
        let vault = crypto::seal(&st.key, &plaintext)?;
        let verifier = make_verifier(&st.key)?;
        let file = VaultFile::new(st.kdf_params, &st.salt, verifier, vault);
        write_vault_file(&self.path, &file)
    }

    /// Change the master password: derive a fresh key from a new salt and
    /// re-encrypt the entire vault under it.
    pub fn change_master_password(&mut self, old: &str, new: &str) -> Result<()> {
        // Verify the old password against the current derived key by re-deriving.
        let st = self.state.as_ref().ok_or(TresorError::Locked)?;
        let check = derive_key(old, &st.salt, &st.kdf_params)?;
        // Compare by re-sealing the verifier constant is unnecessary — derive and
        // check against a fresh verifier made from the current key.
        let verifier = make_verifier(&st.key)?;
        check_verifier(&check, &verifier)?;

        let params = KdfParams::default();
        let salt = generate_salt().to_vec();
        let key = derive_key(new, &salt, &params)?;
        let data = st.data.clone();
        self.state = Some(UnlockedState {
            key,
            salt,
            kdf_params: params,
            data,
        });
        self.persist()
    }

    /// Verify a password against the currently-unlocked vault (used to re-auth
    /// before a plaintext migration export). Does not change state.
    pub fn verify_password(&self, password: &str) -> Result<()> {
        let st = self.state.as_ref().ok_or(TresorError::Locked)?;
        let candidate = derive_key(password, &st.salt, &st.kdf_params)?;
        let verifier = make_verifier(&st.key)?;
        check_verifier(&candidate, &verifier)
    }

    // ---- data access -----------------------------------------------------

    fn data(&self) -> Result<&VaultData> {
        self.state
            .as_ref()
            .map(|s| &s.data)
            .ok_or(TresorError::Locked)
    }

    fn data_mut(&mut self) -> Result<&mut VaultData> {
        self.state
            .as_mut()
            .map(|s| &mut s.data)
            .ok_or(TresorError::Locked)
    }

    pub fn snapshot(&self) -> Result<VaultData> {
        Ok(self.data()?.clone())
    }

    pub fn entries(&self) -> Result<Vec<Entry>> {
        Ok(self.data()?.entries.clone())
    }

    pub fn folders(&self) -> Result<Vec<Folder>> {
        Ok(self.data()?.folders.clone())
    }

    pub fn settings(&self) -> Result<Settings> {
        Ok(self.data()?.settings.clone())
    }

    pub fn update_settings(&mut self, settings: Settings) -> Result<Settings> {
        self.data_mut()?.settings = settings;
        self.persist()?;
        self.settings()
    }

    // ---- entry CRUD ------------------------------------------------------

    pub fn create_entry(&mut self, input: EntryInput) -> Result<Entry> {
        let entry = Entry::new(input);
        self.data_mut()?.entries.push(entry.clone());
        self.persist()?;
        Ok(entry)
    }

    pub fn update_entry(&mut self, id: &str, input: EntryInput) -> Result<Entry> {
        let data = self.data_mut()?;
        let entry = data
            .entries
            .iter_mut()
            .find(|e| e.id == id)
            .ok_or(TresorError::EntryNotFound)?;
        entry.apply(input);
        let updated = entry.clone();
        self.persist()?;
        Ok(updated)
    }

    pub fn delete_entry(&mut self, id: &str) -> Result<()> {
        let data = self.data_mut()?;
        let before = data.entries.len();
        data.entries.retain(|e| e.id != id);
        if data.entries.len() == before {
            return Err(TresorError::EntryNotFound);
        }
        self.persist()
    }

    pub fn move_entry(&mut self, id: &str, folder_id: Option<String>) -> Result<Entry> {
        // Validate destination folder exists (or is root).
        if let Some(fid) = &folder_id {
            if !self.data()?.folders.iter().any(|f| &f.id == fid) {
                return Err(TresorError::FolderNotFound);
            }
        }
        let data = self.data_mut()?;
        let entry = data
            .entries
            .iter_mut()
            .find(|e| e.id == id)
            .ok_or(TresorError::EntryNotFound)?;
        entry.folder_id = folder_id;
        let updated = entry.clone();
        self.persist()?;
        Ok(updated)
    }

    pub fn toggle_favorite(&mut self, id: &str) -> Result<Entry> {
        let data = self.data_mut()?;
        let entry = data
            .entries
            .iter_mut()
            .find(|e| e.id == id)
            .ok_or(TresorError::EntryNotFound)?;
        entry.favorite = !entry.favorite;
        let updated = entry.clone();
        self.persist()?;
        Ok(updated)
    }

    // ---- folder CRUD -----------------------------------------------------

    pub fn create_folder(&mut self, name: String, parent_id: Option<String>) -> Result<Folder> {
        if let Some(pid) = &parent_id {
            if !self.data()?.folders.iter().any(|f| &f.id == pid) {
                return Err(TresorError::FolderNotFound);
            }
        }
        let order = self.data()?.folders.len() as i32;
        let folder = Folder::new(name, parent_id, order);
        self.data_mut()?.folders.push(folder.clone());
        self.persist()?;
        Ok(folder)
    }

    pub fn rename_folder(&mut self, id: &str, name: String) -> Result<Folder> {
        let data = self.data_mut()?;
        let folder = data
            .folders
            .iter_mut()
            .find(|f| f.id == id)
            .ok_or(TresorError::FolderNotFound)?;
        folder.name = name;
        folder.updated_at = crate::model::now_ts();
        let updated = folder.clone();
        self.persist()?;
        Ok(updated)
    }

    /// Delete a folder. Its child folders and entries are re-parented to the
    /// deleted folder's parent (nothing is silently lost).
    pub fn delete_folder(&mut self, id: &str) -> Result<()> {
        let data = self.data_mut()?;
        let target = data
            .folders
            .iter()
            .find(|f| f.id == id)
            .ok_or(TresorError::FolderNotFound)?;
        let parent = target.parent_id.clone();

        for f in data.folders.iter_mut() {
            if f.parent_id.as_deref() == Some(id) {
                f.parent_id = parent.clone();
            }
        }
        for e in data.entries.iter_mut() {
            if e.folder_id.as_deref() == Some(id) {
                e.folder_id = parent.clone();
            }
        }
        data.folders.retain(|f| f.id != id);
        self.persist()
    }

    /// Move a folder under a new parent, rejecting cycles.
    pub fn move_folder(&mut self, id: &str, new_parent: Option<String>) -> Result<Folder> {
        if let Some(pid) = &new_parent {
            if pid == id {
                return Err(TresorError::FolderCycle);
            }
            // Walk up from the proposed parent; if we reach `id`, it's a cycle.
            let folders = &self.data()?.folders;
            let mut cursor = Some(pid.clone());
            while let Some(cur) = cursor {
                if cur == id {
                    return Err(TresorError::FolderCycle);
                }
                cursor = folders
                    .iter()
                    .find(|f| f.id == cur)
                    .and_then(|f| f.parent_id.clone());
            }
            if !folders.iter().any(|f| &f.id == pid) {
                return Err(TresorError::FolderNotFound);
            }
        }
        let data = self.data_mut()?;
        let folder = data
            .folders
            .iter_mut()
            .find(|f| f.id == id)
            .ok_or(TresorError::FolderNotFound)?;
        folder.parent_id = new_parent;
        folder.updated_at = crate::model::now_ts();
        let updated = folder.clone();
        self.persist()?;
        Ok(updated)
    }

    // ---- encrypted export / import --------------------------------------

    /// Write an encrypted `.tresor` backup that re-uses the vault file format —
    /// openable only with the same master password. We simply re-persist the
    /// current sealed state to the chosen path.
    pub fn export_encrypted(&self, dest: &Path) -> Result<()> {
        let st = self.state.as_ref().ok_or(TresorError::Locked)?;
        let plaintext = serde_json::to_vec(&st.data)?;
        let vault = crypto::seal(&st.key, &plaintext)?;
        let verifier = make_verifier(&st.key)?;
        let file = VaultFile::new(st.kdf_params, &st.salt, verifier, vault);
        write_vault_file(dest, &file)
    }

    /// Decrypt an encrypted `.tresor` backup with a supplied master password and
    /// return its contents (for merge/replace) without touching current state.
    pub fn read_encrypted_backup(src: &Path, master_password: &str) -> Result<VaultData> {
        let file = read_vault_file(src)?;
        let salt = file.salt_bytes()?;
        let key: DerivedKey = derive_key(master_password, &salt, &file.kdf_params)?;
        check_verifier(&key, &file.verifier)?;
        let plaintext = crypto::open(&key, &file.vault)?;
        let mut data: VaultData = serde_json::from_slice(&plaintext)?;
        data.migrate();
        Ok(data)
    }

    /// Import a batch of entries, each tagged with a folder path like "Work/Email".
    /// Nested folders are created on demand and reused; the vault is persisted once.
    pub fn import_batch(&mut self, rows: Vec<(EntryInput, String)>) -> Result<usize> {
        let data = self.data_mut()?;
        let mut path_cache: std::collections::HashMap<String, String> =
            std::collections::HashMap::new();
        let mut count = 0;

        for (mut input, path) in rows {
            let folder_id = if path.trim().is_empty() {
                None
            } else {
                Some(ensure_folder_path(data, &path, &mut path_cache))
            };
            input.folder_id = folder_id;
            data.entries.push(Entry::new(input));
            count += 1;
        }
        self.persist()?;
        Ok(count)
    }

    // ---- merge helpers ---------------------------------------------------

    /// Merge imported entries/folders into the current vault (new ids to avoid
    /// collisions), keeping existing data.
    pub fn merge_in(&mut self, incoming: VaultData) -> Result<(usize, usize)> {
        let data = self.data_mut()?;
        let mut id_remap = std::collections::HashMap::new();
        let mut folder_count = 0;
        for mut f in incoming.folders {
            let old = f.id.clone();
            f.id = crate::model::new_id();
            id_remap.insert(old, f.id.clone());
            folder_count += 1;
            data.folders.push(f);
        }
        // Fix parent references to remapped ids.
        for f in data.folders.iter_mut() {
            if let Some(pid) = &f.parent_id {
                if let Some(new) = id_remap.get(pid) {
                    f.parent_id = Some(new.clone());
                }
            }
        }
        let mut entry_count = 0;
        for mut e in incoming.entries {
            e.id = crate::model::new_id();
            if let Some(fid) = &e.folder_id {
                e.folder_id = id_remap.get(fid).cloned();
            }
            entry_count += 1;
            data.entries.push(e);
        }
        self.persist()?;
        Ok((entry_count, folder_count))
    }
}

/// Resolve (creating as needed) a nested folder path like "Work/Email" within the
/// vault data, returning the leaf folder id. Segments are matched by name under
/// their parent so existing folders are reused.
fn ensure_folder_path(
    data: &mut VaultData,
    path: &str,
    cache: &mut std::collections::HashMap<String, String>,
) -> String {
    let mut parent: Option<String> = None;
    let mut cumulative = String::new();

    for segment in path.split('/').map(|s| s.trim()).filter(|s| !s.is_empty()) {
        if cumulative.is_empty() {
            cumulative = segment.to_string();
        } else {
            cumulative = format!("{cumulative}/{segment}");
        }
        if let Some(id) = cache.get(&cumulative) {
            parent = Some(id.clone());
            continue;
        }
        // Reuse an existing folder with this name under the same parent.
        let existing = data
            .folders
            .iter()
            .find(|f| f.name == segment && f.parent_id == parent)
            .map(|f| f.id.clone());
        let id = match existing {
            Some(id) => id,
            None => {
                let order = data.folders.len() as i32;
                let folder = Folder::new(segment.to_string(), parent.clone(), order);
                let id = folder.id.clone();
                data.folders.push(folder);
                id
            }
        };
        cache.insert(cumulative.clone(), id.clone());
        parent = Some(id);
    }

    parent.unwrap_or_default()
}
