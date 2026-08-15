//! Password / passphrase generation. All randomness comes from the OS CSPRNG,
//! and selection uses rejection sampling so every candidate is equally likely
//! (no modulo bias).

use rand::rngs::OsRng;
use rand::RngCore;
use serde::{Deserialize, Serialize};

/// Bundled EFF short wordlist (1296 words, ~10.3 bits each). Offline by design.
static WORDLIST: &str = include_str!("wordlist.txt");

fn words() -> Vec<&'static str> {
    WORDLIST.lines().filter(|l| !l.is_empty()).collect()
}

const LOWER: &str = "abcdefghijklmnopqrstuvwxyz";
const UPPER: &str = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS: &str = "0123456789";
const SYMBOLS: &str = "!@#$%^&*()-_=+[]{};:,.?/~";
/// Characters that look alike in many fonts.
const AMBIGUOUS: &str = "Il1O0o|`'\"{}[]()/\\";

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenOptions {
    /// "chars" | "passphrase" | "pronounceable"
    pub mode: String,
    // character mode
    #[serde(default = "default_length")]
    pub length: usize,
    #[serde(default = "yes")]
    pub lower: bool,
    #[serde(default = "yes")]
    pub upper: bool,
    #[serde(default = "yes")]
    pub digits: bool,
    #[serde(default = "yes")]
    pub symbols: bool,
    #[serde(default)]
    pub avoid_ambiguous: bool,
    /// Minimum count of digits the result must contain (character mode).
    #[serde(default)]
    pub min_numbers: usize,
    /// Minimum count of symbols the result must contain (character mode).
    #[serde(default)]
    pub min_symbols: usize,
    // passphrase mode
    #[serde(default = "default_words")]
    pub word_count: usize,
    #[serde(default = "default_separator")]
    pub separator: String,
    #[serde(default = "yes")]
    pub capitalize: bool,
    #[serde(default = "yes")]
    pub add_number: bool,
}

fn default_length() -> usize {
    20
}
fn default_words() -> usize {
    5
}
fn default_separator() -> String {
    "-".into()
}
fn yes() -> bool {
    true
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GenResult {
    pub password: String,
    /// Estimated entropy in bits from the generation process itself.
    pub entropy_bits: f64,
}

/// Uniformly pick an index in 0..n using rejection sampling on 32-bit draws.
fn pick(n: usize) -> usize {
    assert!(n > 0);
    let n = n as u32;
    let zone = u32::MAX - (u32::MAX % n);
    loop {
        let mut b = [0u8; 4];
        OsRng.fill_bytes(&mut b);
        let v = u32::from_le_bytes(b);
        if v < zone {
            return (v % n) as usize;
        }
    }
}

fn pick_char(pool: &[char]) -> char {
    pool[pick(pool.len())]
}

pub fn generate(opts: &GenOptions) -> GenResult {
    match opts.mode.as_str() {
        "passphrase" => generate_passphrase(opts),
        "pronounceable" => generate_pronounceable(opts),
        _ => generate_chars(opts),
    }
}

fn generate_chars(opts: &GenOptions) -> GenResult {
    let mut pool: Vec<char> = Vec::new();
    // Each enabled class carries its char set and the minimum number of that class
    // the result must contain.
    let mut required: Vec<(Vec<char>, usize)> = Vec::new();

    let filter_set = |src: &str| -> Vec<char> {
        src.chars()
            .filter(|c| !opts.avoid_ambiguous || !AMBIGUOUS.contains(*c))
            .collect()
    };
    let mut add = |src: &str, on: bool, min: usize| {
        if on {
            let set = filter_set(src);
            if !set.is_empty() {
                pool.extend(&set);
                required.push((set, min));
            }
        }
    };
    // Lowercase/uppercase guarantee at least one when enabled; digits/symbols honor
    // the explicit minimums from the generator options.
    add(LOWER, opts.lower, 1);
    add(UPPER, opts.upper, 1);
    add(DIGITS, opts.digits, opts.min_numbers.max(1));
    add(SYMBOLS, opts.symbols, opts.min_symbols.max(1));

    if pool.is_empty() {
        // Fall back to lowercase so we never emit an empty password.
        pool = LOWER.chars().collect();
        required.clear();
    }

    // Grow the length if the minimums demand more room than requested.
    let total_min: usize = required.iter().map(|(_, m)| *m).sum();
    let length = opts.length.clamp(4, 128).max(total_min);
    let mut chars: Vec<char> = Vec::with_capacity(length);

    // Guarantee the minimum count from each selected class (when it fits).
    for (set, min) in required.iter() {
        for _ in 0..*min {
            if chars.len() >= length {
                break;
            }
            chars.push(pick_char(set));
        }
    }
    while chars.len() < length {
        chars.push(pick_char(&pool));
    }
    // Fisher-Yates shuffle so the guaranteed characters aren't front-loaded.
    for i in (1..chars.len()).rev() {
        let j = pick(i + 1);
        chars.swap(i, j);
    }

    let password: String = chars.into_iter().collect();
    let entropy_bits = length as f64 * (pool.len() as f64).log2();
    GenResult {
        password,
        entropy_bits,
    }
}

fn generate_passphrase(opts: &GenOptions) -> GenResult {
    let list = words();
    let count = opts.word_count.clamp(3, 12);
    let mut parts: Vec<String> = Vec::with_capacity(count);
    for _ in 0..count {
        let w = list[pick(list.len())];
        let word = if opts.capitalize {
            let mut c = w.chars();
            match c.next() {
                Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
                None => String::new(),
            }
        } else {
            w.to_string()
        };
        parts.push(word);
    }
    let mut password = parts.join(&opts.separator);
    let mut entropy_bits = count as f64 * (list.len() as f64).log2();
    if opts.add_number {
        let n = pick(1000);
        password.push_str(&opts.separator);
        password.push_str(&n.to_string());
        entropy_bits += (1000f64).log2();
    }
    GenResult {
        password,
        entropy_bits,
    }
}

fn generate_pronounceable(opts: &GenOptions) -> GenResult {
    const CONSONANTS: &str = "bcdfghjklmnprstvwz";
    const VOWELS: &str = "aeiou";
    let cons: Vec<char> = CONSONANTS.chars().collect();
    let vows: Vec<char> = VOWELS.chars().collect();
    let length = opts.length.clamp(6, 64);

    let mut out: Vec<char> = Vec::with_capacity(length);
    let mut entropy = 0f64;
    let mut want_consonant = true;
    while out.len() < length {
        if want_consonant {
            out.push(pick_char(&cons));
            entropy += (cons.len() as f64).log2();
        } else {
            out.push(pick_char(&vows));
            entropy += (vows.len() as f64).log2();
        }
        want_consonant = !want_consonant;
    }
    // Optionally capitalize first letter and append digits for extra entropy.
    if opts.capitalize {
        if let Some(first) = out.first_mut() {
            *first = first.to_ascii_uppercase();
        }
    }
    let mut password: String = out.into_iter().collect();
    if opts.add_number {
        let n = pick(100);
        password.push_str(&format!("{:02}", n));
        entropy += (100f64).log2();
    }
    GenResult {
        password,
        entropy_bits: entropy,
    }
}
