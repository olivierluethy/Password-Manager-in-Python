//! Fully-local URL verification, run at save time and open time. It never blocks
//! silently — it classifies a URL and returns clear warnings for the UI to show.
//!
//! Checks: well-formedness & https, IP-literal hosts, punycode/homograph
//! detection, mixed-script confusables, high-risk TLDs, and a bundled local
//! blocklist (refreshable from a file; no cloud).

use serde::Serialize;
use url::Url;

static BUNDLED_BLOCKLIST: &str = include_str!("blocklist.txt");

/// High-risk TLDs frequently abused for phishing / malware distribution.
const RISKY_TLDS: &[&str] = &[
    "zip", "mov", "tk", "top", "gq", "ml", "cf", "ga", "work", "click", "country",
    "kim", "loan", "download", "xin", "review", "cam",
];

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Level {
    Ok,
    Caution,
    Danger,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UrlVerdict {
    pub level: Level,
    pub normalized: String,
    pub host: Option<String>,
    pub is_https: bool,
    pub warnings: Vec<String>,
}

fn extra_blocklist(extra: Option<&str>) -> Vec<String> {
    let mut hosts: Vec<String> = BUNDLED_BLOCKLIST
        .lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty() && !l.starts_with('#'))
        .map(|l| l.to_lowercase())
        .collect();
    if let Some(text) = extra {
        for line in text.lines() {
            let l = line.trim();
            if !l.is_empty() && !l.starts_with('#') {
                hosts.push(l.to_lowercase());
            }
        }
    }
    hosts
}

/// Verify a URL string. `extra_blocklist_text` is optional user-supplied blocklist
/// content merged with the bundled one.
pub fn verify(input: &str, extra_blocklist_text: Option<&str>) -> UrlVerdict {
    let trimmed = input.trim();
    let mut warnings = Vec::new();

    if trimmed.is_empty() {
        return UrlVerdict {
            level: Level::Ok,
            normalized: String::new(),
            host: None,
            is_https: false,
            warnings,
        };
    }

    // Add a scheme if the user typed a bare host so parsing succeeds.
    let candidate = if trimmed.contains("://") {
        trimmed.to_string()
    } else {
        format!("https://{trimmed}")
    };

    let parsed = match Url::parse(&candidate) {
        Ok(u) => u,
        Err(_) => {
            return UrlVerdict {
                level: Level::Caution,
                normalized: trimmed.to_string(),
                host: None,
                is_https: false,
                warnings: vec!["This doesn't look like a valid web address".into()],
            };
        }
    };

    let is_https = parsed.scheme() == "https";
    if !is_https && parsed.scheme() == "http" {
        warnings.push("Not secure — uses http instead of https".into());
    } else if parsed.scheme() != "https" {
        warnings.push(format!("Unusual scheme: {}", parsed.scheme()));
    }

    let host = parsed.host_str().map(|h| h.to_string());
    let mut level = if is_https { Level::Ok } else { Level::Caution };

    if let Some(h) = &host {
        let hl = h.to_lowercase();

        // IP-literal host
        if hl.parse::<std::net::IpAddr>().is_ok()
            || (hl.starts_with('[') && hl.ends_with(']'))
        {
            warnings.push("Address points to a raw IP, not a domain name".into());
            level = worst(level, Level::Caution);
        }

        // Punycode / IDN homograph
        if hl.split('.').any(|label| label.starts_with("xn--")) {
            warnings.push(
                "Domain uses punycode (xn--) — it may imitate a real site with lookalike characters"
                    .into(),
            );
            level = worst(level, Level::Danger);
        }

        // Mixed script: ASCII letters + confusable non-ASCII letters in the host
        if has_confusable_mix(&hl) {
            warnings.push("Domain mixes lookalike characters from different alphabets".into());
            level = worst(level, Level::Danger);
        }

        // Risky TLD
        if let Some(tld) = hl.rsplit('.').next() {
            if RISKY_TLDS.contains(&tld) {
                warnings.push(format!("High-risk top-level domain (.{tld})"));
                level = worst(level, Level::Caution);
            }
        }

        // Blocklist (host or any parent domain)
        let block = extra_blocklist(extra_blocklist_text);
        if block.iter().any(|b| hl == *b || hl.ends_with(&format!(".{b}"))) {
            warnings.push("This domain is on the known-phishing blocklist".into());
            level = worst(level, Level::Danger);
        }

        // Excessive subdomain nesting is a mild signal
        if hl.matches('.').count() >= 4 {
            warnings.push("Unusually deep subdomain — double-check the real domain".into());
            level = worst(level, Level::Caution);
        }
    } else {
        warnings.push("No host found in the address".into());
        level = worst(level, Level::Caution);
    }

    UrlVerdict {
        level,
        normalized: parsed.to_string(),
        host,
        is_https,
        warnings,
    }
}

fn worst(a: Level, b: Level) -> Level {
    use Level::*;
    match (&a, &b) {
        (Danger, _) | (_, Danger) => Danger,
        (Caution, _) | (_, Caution) => Caution,
        _ => Ok,
    }
}

/// Detect a host label that mixes ASCII latin letters with non-ASCII letters that
/// are visually confusable with latin ones (a common homograph trick).
fn has_confusable_mix(host: &str) -> bool {
    for label in host.split('.') {
        let has_ascii_alpha = label.chars().any(|c| c.is_ascii_alphabetic());
        let has_confusable = label.chars().any(is_latin_confusable);
        if has_ascii_alpha && has_confusable {
            return true;
        }
    }
    false
}

/// A small set of common non-ASCII characters that imitate latin letters
/// (Cyrillic а/е/о/р/с/х, Greek ο/ν, etc.).
fn is_latin_confusable(c: char) -> bool {
    matches!(
        c,
        '\u{0430}' // а
        | '\u{0435}' // е
        | '\u{043E}' // о
        | '\u{0440}' // р
        | '\u{0441}' // с
        | '\u{0445}' // х
        | '\u{0443}' // у
        | '\u{0456}' // і
        | '\u{03BF}' // ο greek omicron
        | '\u{03B1}' // α
        | '\u{03BD}' // ν
    )
}
