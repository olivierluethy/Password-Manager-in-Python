//! Optional, opt-in HaveIBeenPwned breach check using k-anonymity. Only the
//! first 5 hex characters of the password's SHA-1 hash ever leave the device;
//! the full hash and the password never do. This is the single feature that
//! touches the network, and it is off by default.

use sha1::{Digest, Sha1};

use crate::error::{Result, TresorError};

const RANGE_URL: &str = "https://api.pwnedpasswords.com/range/";

/// Returns how many times the password appears in known breaches (0 = not found).
pub async fn check(password: &str) -> Result<u64> {
    if password.is_empty() {
        return Ok(0);
    }

    // SHA-1 of the password, uppercase hex.
    let mut hasher = Sha1::new();
    hasher.update(password.as_bytes());
    let digest = hasher.finalize();
    let hex = hex_upper(&digest);
    let (prefix, suffix) = hex.split_at(5);

    let client = reqwest::Client::builder()
        .user_agent("Tresor-Password-Manager")
        .build()
        .map_err(|e| TresorError::Message(e.to_string()))?;

    let resp = client
        .get(format!("{RANGE_URL}{prefix}"))
        // Padding hides the real bucket size from the network observer.
        .header("Add-Padding", "true")
        .send()
        .await
        .map_err(|e| TresorError::Message(format!("Breach check failed: {e}")))?;

    if !resp.status().is_success() {
        return Err(TresorError::Message(format!(
            "Breach service returned {}",
            resp.status()
        )));
    }

    let body = resp
        .text()
        .await
        .map_err(|e| TresorError::Message(e.to_string()))?;

    for line in body.lines() {
        let mut parts = line.trim().splitn(2, ':');
        if let (Some(hash_suffix), Some(count)) = (parts.next(), parts.next()) {
            if hash_suffix.eq_ignore_ascii_case(suffix) {
                let n: u64 = count.trim().parse().unwrap_or(0);
                // Padding entries are returned with a count of 0 — skip them.
                if n > 0 {
                    return Ok(n);
                }
            }
        }
    }
    Ok(0)
}

fn hex_upper(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        s.push_str(&format!("{:02X}", b));
    }
    s
}
