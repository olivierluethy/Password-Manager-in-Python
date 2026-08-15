import type { Entry } from "./types";

/** Levenshtein distance between two short strings. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + cost);
      diag = tmp;
    }
  }
  return prev[b.length];
}

/**
 * Score a single field against the query. Higher is better (0..1+).
 * Substring matches score highest; otherwise a normalized Levenshtein
 * similarity over the best-matching window keeps close spellings near the top.
 */
function fieldScore(field: string, q: string): number {
  if (!field) return 0;
  const f = field.toLowerCase();
  const idx = f.indexOf(q);
  if (idx >= 0) {
    // Earlier and prefix matches score higher.
    const prefixBonus = idx === 0 ? 0.3 : 0;
    return 1 + prefixBonus - Math.min(0.2, idx * 0.01);
  }
  // Best sliding-window similarity for typo tolerance.
  let best = 0;
  const w = q.length;
  if (f.length <= w) {
    best = 1 - levenshtein(f, q) / Math.max(f.length, w);
  } else {
    for (let i = 0; i + w <= f.length && i < 64; i++) {
      const sim = 1 - levenshtein(f.slice(i, i + w), q) / w;
      if (sim > best) best = sim;
      if (best === 1) break;
    }
  }
  return best;
}

export interface Ranked {
  entry: Entry;
  score: number;
}

/**
 * Fuzzy-rank entries against a query. Always returns results sorted best-first;
 * with a non-empty query it never returns an empty list — the nearest match
 * always survives (command-palette behavior).
 */
export function rankEntries(entries: Entry[], query: string): Ranked[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return entries
      .map((entry) => ({ entry, score: 0 }))
      .sort((a, b) => {
        if (a.entry.favorite !== b.entry.favorite)
          return a.entry.favorite ? -1 : 1;
        return a.entry.title.localeCompare(b.entry.title);
      });
  }

  const ranked = entries.map((entry) => {
    const score = Math.max(
      fieldScore(entry.title, q) * 1.0,
      fieldScore(entry.url, q) * 0.9,
      fieldScore(entry.username, q) * 0.8,
      fieldScore(entry.email, q) * 0.8,
      fieldScore(entry.notes, q) * 0.5,
    );
    return { entry, score };
  });

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.entry.title.localeCompare(b.entry.title);
  });

  // Never empty: if nothing cleared a useful threshold, still return the nearest.
  const meaningful = ranked.filter((r) => r.score > 0.34);
  if (meaningful.length > 0) return meaningful;
  return ranked.slice(0, 1);
}
