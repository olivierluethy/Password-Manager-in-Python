//! Website favicon fetching for entries. The icon is fetched by the backend
//! directly from the entry's own domain — first `/favicon.ico`, then whatever the
//! page's `<link rel="icon">` points at — and cached on disk so each domain is
//! fetched at most once (successes and misses alike). Returned to the frontend as
//! a `data:` URL. This is a network request to the entry's own site; it is gated
//! behind the "Load website icons" setting.

use std::path::PathBuf;
use std::time::Duration;

use base64::{engine::general_purpose::STANDARD as B64, Engine};

use crate::error::Result;

const MAX_BYTES: usize = 512 * 1024;

/// Resolve the host for a user-entered URL (adds a scheme if missing).
fn host_of(raw: &str) -> Option<String> {
    let candidate = if raw.contains("://") {
        raw.to_string()
    } else {
        format!("https://{raw}")
    };
    url::Url::parse(&candidate)
        .ok()
        .and_then(|u| u.host_str().map(|h| h.to_string()))
}

/// A filesystem-safe cache key for a host.
fn cache_key(host: &str) -> String {
    host.chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '.' || c == '-' { c } else { '_' })
        .collect()
}

fn cache_dir(app: &tauri::AppHandle) -> Option<PathBuf> {
    use tauri::Manager;
    let dir = app.path().app_data_dir().ok()?.join("favicons");
    std::fs::create_dir_all(&dir).ok()?;
    Some(dir)
}

/// Fetch (or read from cache) the favicon for a URL. Returns a `data:` URL, or
/// `None` if the site has no usable icon.
pub async fn fetch(app: &tauri::AppHandle, raw_url: &str) -> Result<Option<String>> {
    let host = match host_of(raw_url) {
        Some(h) => h,
        None => return Ok(None),
    };

    let cache_file = cache_dir(app).map(|d| d.join(format!("{}.txt", cache_key(&host))));

    // Cache hit: a file exists. Empty file == known miss.
    if let Some(path) = &cache_file {
        if let Ok(contents) = std::fs::read_to_string(path) {
            return Ok(if contents.trim().is_empty() {
                None
            } else {
                Some(contents)
            });
        }
    }

    let data_url = fetch_remote(&host).await;

    // Persist the result (including a miss, as an empty file) so we never refetch.
    if let Some(path) = &cache_file {
        let _ = std::fs::write(path, data_url.as_deref().unwrap_or(""));
    }

    Ok(data_url)
}

fn client() -> Option<reqwest::Client> {
    reqwest::Client::builder()
        .user_agent("Tresor-Password-Manager")
        .timeout(Duration::from_secs(6))
        .build()
        .ok()
}

/// Try `/favicon.ico`, then the page's declared icon link.
async fn fetch_remote(host: &str) -> Option<String> {
    let client = client()?;

    if let Some(icon) = try_image(&client, &format!("https://{host}/favicon.ico")).await {
        return Some(icon);
    }

    // Parse the homepage for a <link rel="icon"> and follow it.
    if let Ok(resp) = client.get(format!("https://{host}/")).send().await {
        if resp.status().is_success() {
            if let Ok(html) = resp.text().await {
                if let Some(href) = find_icon_href(&html) {
                    if let Some(abs) = absolutize(host, &href) {
                        if let Some(icon) = try_image(&client, &abs).await {
                            return Some(icon);
                        }
                    }
                }
            }
        }
    }

    None
}

/// GET a URL and, if it is a non-empty image, return it as a `data:` URL.
async fn try_image(client: &reqwest::Client, url: &str) -> Option<String> {
    let resp = client.get(url).send().await.ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let content_type = resp
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.split(';').next().unwrap_or(s).trim().to_lowercase());

    let bytes = resp.bytes().await.ok()?;
    if bytes.is_empty() || bytes.len() > MAX_BYTES {
        return None;
    }

    let mime = match content_type {
        Some(ct) if ct.starts_with("image/") => ct,
        // Some servers mislabel .ico; sniff by extension / magic before trusting.
        _ => guess_mime(url, &bytes)?,
    };
    // Reject obvious non-images (e.g. an HTML 404 page served with 200).
    if looks_like_html(&bytes) {
        return None;
    }

    Some(format!("data:{};base64,{}", mime, B64.encode(&bytes)))
}

fn looks_like_html(bytes: &[u8]) -> bool {
    let head = &bytes[..bytes.len().min(64)];
    let text = String::from_utf8_lossy(head).to_lowercase();
    text.contains("<!doctype html") || text.contains("<html")
}

fn guess_mime(url: &str, bytes: &[u8]) -> Option<String> {
    let lower = url.to_lowercase();
    if bytes.starts_with(&[0x89, b'P', b'N', b'G']) {
        Some("image/png".into())
    } else if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        Some("image/jpeg".into())
    } else if bytes.starts_with(b"GIF8") {
        Some("image/gif".into())
    } else if bytes.starts_with(&[0x00, 0x00, 0x01, 0x00]) || lower.ends_with(".ico") {
        Some("image/x-icon".into())
    } else if lower.ends_with(".svg") {
        Some("image/svg+xml".into())
    } else {
        None
    }
}

/// Find the best `href` from `<link rel="...icon...">` tags in an HTML document.
fn find_icon_href(html: &str) -> Option<String> {
    let lower = html.to_lowercase();
    let mut best: Option<String> = None;
    let mut search_from = 0;
    while let Some(rel) = lower[search_from..].find("<link") {
        let start = search_from + rel;
        let end = lower[start..].find('>').map(|e| start + e).unwrap_or(lower.len());
        let tag = &html[start..end];
        let tag_lower = &lower[start..end];
        search_from = end;
        if tag_lower.contains("rel=") && tag_lower.contains("icon") {
            if let Some(href) = attr(tag, "href") {
                // Prefer a standard icon over apple-touch when both appear; but any
                // icon is fine — keep the first, upgrade if a plain "icon" rel found.
                if best.is_none() {
                    best = Some(href.clone());
                }
                if tag_lower.contains("rel=\"icon\"") || tag_lower.contains("rel='icon'") {
                    return Some(href);
                }
            }
        }
    }
    best
}

/// Extract an attribute value from a tag fragment (handles single/double quotes).
fn attr(tag: &str, name: &str) -> Option<String> {
    let lower = tag.to_lowercase();
    let key = format!("{name}=");
    let pos = lower.find(&key)? + key.len();
    let rest = &tag[pos..];
    let bytes = rest.as_bytes();
    let (quote, body) = match bytes.first() {
        Some(b'"') => ('"', &rest[1..]),
        Some(b'\'') => ('\'', &rest[1..]),
        _ => {
            // Unquoted: read until whitespace or end.
            let v: String = rest.chars().take_while(|c| !c.is_whitespace()).collect();
            return if v.is_empty() { None } else { Some(v) };
        }
    };
    let end = body.find(quote)?;
    Some(body[..end].to_string())
}

/// Resolve a possibly-relative icon href against the site origin.
fn absolutize(host: &str, href: &str) -> Option<String> {
    let href = href.trim();
    if href.starts_with("http://") || href.starts_with("https://") {
        Some(href.to_string())
    } else if let Some(rest) = href.strip_prefix("//") {
        Some(format!("https://{rest}"))
    } else if href.starts_with('/') {
        Some(format!("https://{host}{href}"))
    } else if href.starts_with("data:") {
        Some(href.to_string())
    } else {
        Some(format!("https://{host}/{href}"))
    }
}
