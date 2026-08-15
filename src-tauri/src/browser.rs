//! Detecting installed browsers and opening a URL either in the system default
//! browser or in a specific one. Cross-platform via per-OS candidate paths.

#[cfg(any(target_os = "macos", target_os = "windows"))]
use std::path::Path;
use std::process::Command;

use serde::Serialize;

use crate::error::{Result, TresorError};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserInfo {
    /// Stable key stored in settings / per entry.
    pub key: String,
    pub name: String,
    pub available: bool,
}

struct Candidate {
    key: &'static str,
    name: &'static str,
    #[cfg(target_os = "linux")]
    bins: &'static [&'static str],
    #[cfg(target_os = "macos")]
    app: &'static str,
    #[cfg(target_os = "windows")]
    paths: &'static [&'static str],
}

#[cfg(target_os = "linux")]
const CANDIDATES: &[Candidate] = &[
    Candidate { key: "firefox", name: "Firefox", bins: &["firefox", "firefox-esr"] },
    Candidate { key: "chrome", name: "Google Chrome", bins: &["google-chrome", "google-chrome-stable"] },
    Candidate { key: "chromium", name: "Chromium", bins: &["chromium", "chromium-browser"] },
    Candidate { key: "brave", name: "Brave", bins: &["brave-browser", "brave"] },
    Candidate { key: "edge", name: "Microsoft Edge", bins: &["microsoft-edge", "microsoft-edge-stable"] },
    Candidate { key: "vivaldi", name: "Vivaldi", bins: &["vivaldi", "vivaldi-stable"] },
];

#[cfg(target_os = "macos")]
const CANDIDATES: &[Candidate] = &[
    Candidate { key: "safari", name: "Safari", app: "Safari" },
    Candidate { key: "firefox", name: "Firefox", app: "Firefox" },
    Candidate { key: "chrome", name: "Google Chrome", app: "Google Chrome" },
    Candidate { key: "chromium", name: "Chromium", app: "Chromium" },
    Candidate { key: "brave", name: "Brave", app: "Brave Browser" },
    Candidate { key: "edge", name: "Microsoft Edge", app: "Microsoft Edge" },
];

#[cfg(target_os = "windows")]
const CANDIDATES: &[Candidate] = &[
    Candidate { key: "firefox", name: "Firefox", paths: &["Mozilla Firefox\\firefox.exe"] },
    Candidate { key: "chrome", name: "Google Chrome", paths: &["Google\\Chrome\\Application\\chrome.exe"] },
    Candidate { key: "brave", name: "Brave", paths: &["BraveSoftware\\Brave-Browser\\Application\\brave.exe"] },
    Candidate { key: "edge", name: "Microsoft Edge", paths: &["Microsoft\\Edge\\Application\\msedge.exe"] },
];

#[cfg(target_os = "linux")]
fn which(bin: &str) -> Option<String> {
    let path = std::env::var_os("PATH")?;
    for dir in std::env::split_paths(&path) {
        let full = dir.join(bin);
        if full.is_file() {
            return Some(full.to_string_lossy().into_owned());
        }
    }
    None
}

#[cfg(target_os = "linux")]
fn resolve(c: &Candidate) -> Option<String> {
    c.bins.iter().find_map(|b| which(b))
}

#[cfg(target_os = "macos")]
fn resolve(c: &Candidate) -> Option<String> {
    let p = format!("/Applications/{}.app", c.app);
    if Path::new(&p).exists() {
        Some(p)
    } else {
        None
    }
}

#[cfg(target_os = "windows")]
fn resolve(c: &Candidate) -> Option<String> {
    let roots = [
        std::env::var("ProgramFiles").ok(),
        std::env::var("ProgramFiles(x86)").ok(),
        std::env::var("LocalAppData").ok(),
    ];
    for root in roots.into_iter().flatten() {
        for rel in c.paths {
            let full = Path::new(&root).join(rel);
            if full.is_file() {
                return Some(full.to_string_lossy().into_owned());
            }
        }
    }
    None
}

/// List browsers, always including the "Default" option first.
pub fn detect() -> Vec<BrowserInfo> {
    let mut out = vec![BrowserInfo {
        key: "default".into(),
        name: "System default".into(),
        available: true,
    }];
    for c in CANDIDATES {
        out.push(BrowserInfo {
            key: c.key.into(),
            name: c.name.into(),
            available: resolve(c).is_some(),
        });
    }
    out
}

fn resolved_path(key: &str) -> Option<String> {
    CANDIDATES
        .iter()
        .find(|c| c.key == key)
        .and_then(|c| resolve(c))
}

/// Open a URL. `browser_key` of "default" (or unknown) uses the OS default.
pub fn open(url: &str, browser_key: &str) -> Result<()> {
    if browser_key == "default" || browser_key.is_empty() {
        return open_default(url);
    }
    match resolved_path(browser_key) {
        Some(path) => spawn(&path, url),
        None => open_default(url), // gracefully fall back
    }
}

#[cfg(target_os = "linux")]
fn spawn(path: &str, url: &str) -> Result<()> {
    Command::new(path)
        .arg(url)
        .spawn()
        .map_err(|e| TresorError::Io(e.to_string()))?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn spawn(path: &str, url: &str) -> Result<()> {
    Command::new("open")
        .arg("-a")
        .arg(path)
        .arg(url)
        .spawn()
        .map_err(|e| TresorError::Io(e.to_string()))?;
    Ok(())
}

#[cfg(target_os = "windows")]
fn spawn(path: &str, url: &str) -> Result<()> {
    Command::new(path)
        .arg(url)
        .spawn()
        .map_err(|e| TresorError::Io(e.to_string()))?;
    Ok(())
}

#[cfg(target_os = "linux")]
fn open_default(url: &str) -> Result<()> {
    Command::new("xdg-open")
        .arg(url)
        .spawn()
        .map_err(|e| TresorError::Io(e.to_string()))?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn open_default(url: &str) -> Result<()> {
    Command::new("open")
        .arg(url)
        .spawn()
        .map_err(|e| TresorError::Io(e.to_string()))?;
    Ok(())
}

#[cfg(target_os = "windows")]
fn open_default(url: &str) -> Result<()> {
    Command::new("cmd")
        .args(["/C", "start", "", url])
        .spawn()
        .map_err(|e| TresorError::Io(e.to_string()))?;
    Ok(())
}
