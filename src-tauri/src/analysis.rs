//! Password strength scoring (zxcvbn) and whole-vault health analysis:
//! weak, reused (identical), similar (Levenshtein), and stale passwords.

use serde::Serialize;
use strsim::normalized_levenshtein;
use zxcvbn::zxcvbn;

use crate::model::Entry;

/// Passwords whose zxcvbn score is at or below this are "weak".
const WEAK_SCORE: u8 = 2;
/// Normalized similarity above this (but not identical) counts as "similar".
const SIMILAR_THRESHOLD: f64 = 0.70;
/// Passwords not changed within this many days are "stale".
const STALE_DAYS: i64 = 180;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StrengthReport {
    /// 0 (weakest) .. 4 (strongest).
    pub score: u8,
    pub guesses_log10: f64,
    /// Human-readable estimate (offline fast attack).
    pub crack_time: String,
    pub warning: Option<String>,
    pub suggestions: Vec<String>,
}

pub fn analyze(password: &str) -> StrengthReport {
    if password.is_empty() {
        return StrengthReport {
            score: 0,
            guesses_log10: 0.0,
            crack_time: "instantly".into(),
            warning: Some("Empty password".into()),
            suggestions: vec!["Enter or generate a password".into()],
        };
    }
    let est = zxcvbn(password, &[]);
    let (warning, suggestions) = match est.feedback() {
        Some(fb) => (
            fb.warning().map(|w| w.to_string()),
            fb.suggestions().iter().map(|s| s.to_string()).collect(),
        ),
        None => (None, Vec::new()),
    };
    StrengthReport {
        score: u8::from(est.score()),
        guesses_log10: est.guesses_log10(),
        crack_time: est
            .crack_times()
            .offline_fast_hashing_1e10_per_second()
            .to_string(),
        warning,
        suggestions,
    }
}

// ---- vault health -------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthItem {
    pub id: String,
    pub title: String,
    pub detail: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReuseGroup {
    pub ids: Vec<String>,
    pub titles: Vec<String>,
    pub count: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SimilarPair {
    pub a_id: String,
    pub a_title: String,
    pub b_id: String,
    pub b_title: String,
    /// 0..100 similarity percentage.
    pub similarity: u8,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthReport {
    /// Overall vault score, 0..100.
    pub score: u8,
    pub total: usize,
    pub with_password: usize,
    pub weak: Vec<HealthItem>,
    pub reused: Vec<ReuseGroup>,
    pub similar: Vec<SimilarPair>,
    pub stale: Vec<HealthItem>,
}

pub fn health(entries: &[Entry], now: i64) -> HealthReport {
    let scored: Vec<(&Entry, u8)> = entries
        .iter()
        .filter(|e| !e.password.is_empty())
        .map(|e| (e, u8::from(zxcvbn(&e.password, &[]).score())))
        .collect();

    let with_password = scored.len();

    // Weak
    let weak: Vec<HealthItem> = scored
        .iter()
        .filter(|(_, s)| *s <= WEAK_SCORE)
        .map(|(e, s)| HealthItem {
            id: e.id.clone(),
            title: display_title(e),
            detail: format!("Strength {}/4", s),
        })
        .collect();

    // Reused (identical passwords)
    let mut groups: std::collections::HashMap<&str, Vec<&Entry>> = std::collections::HashMap::new();
    for (e, _) in &scored {
        groups.entry(e.password.as_str()).or_default().push(e);
    }
    let mut reused: Vec<ReuseGroup> = groups
        .values()
        .filter(|g| g.len() > 1)
        .map(|g| ReuseGroup {
            ids: g.iter().map(|e| e.id.clone()).collect(),
            titles: g.iter().map(|e| display_title(e)).collect(),
            count: g.len(),
        })
        .collect();
    reused.sort_by(|a, b| b.count.cmp(&a.count));

    // Similar (Levenshtein) — skip identical pairs (those are "reused").
    let mut similar: Vec<SimilarPair> = Vec::new();
    for i in 0..scored.len() {
        for j in (i + 1)..scored.len() {
            let a = scored[i].0;
            let b = scored[j].0;
            if a.password == b.password {
                continue;
            }
            let sim = normalized_levenshtein(&a.password, &b.password);
            if sim >= SIMILAR_THRESHOLD {
                similar.push(SimilarPair {
                    a_id: a.id.clone(),
                    a_title: display_title(a),
                    b_id: b.id.clone(),
                    b_title: display_title(b),
                    similarity: (sim * 100.0).round() as u8,
                });
            }
        }
    }
    similar.sort_by(|a, b| b.similarity.cmp(&a.similarity));

    // Stale
    let stale_cutoff = now - STALE_DAYS * 86_400;
    let stale: Vec<HealthItem> = scored
        .iter()
        .filter(|(e, _)| e.password_updated_at > 0 && e.password_updated_at < stale_cutoff)
        .map(|(e, _)| {
            let days = (now - e.password_updated_at) / 86_400;
            HealthItem {
                id: e.id.clone(),
                title: display_title(e),
                detail: format!("Unchanged for {} days", days),
            }
        })
        .collect();

    let reused_entry_count: usize = reused.iter().map(|g| g.count).sum();
    let score = compute_score(with_password, weak.len(), reused_entry_count, similar.len(), stale.len());

    HealthReport {
        score,
        total: entries.len(),
        with_password,
        weak,
        reused,
        similar,
        stale,
    }
}

fn display_title(e: &Entry) -> String {
    if !e.title.trim().is_empty() {
        e.title.clone()
    } else if !e.url.trim().is_empty() {
        e.url.clone()
    } else {
        "Untitled".into()
    }
}

/// A simple 0..100 health score: start at 100 and subtract weighted penalties
/// per affected entry, floored at 0.
fn compute_score(total: usize, weak: usize, reused: usize, similar: usize, stale: usize) -> u8 {
    if total == 0 {
        return 100;
    }
    let t = total as f64;
    let weak_pen = (weak as f64 / t) * 45.0;
    let reuse_pen = (reused as f64 / t) * 30.0;
    let similar_pen = (similar as f64 / t).min(1.0) * 15.0;
    let stale_pen = (stale as f64 / t) * 10.0;
    let score = 100.0 - weak_pen - reuse_pen - similar_pen - stale_pen;
    score.clamp(0.0, 100.0).round() as u8
}
