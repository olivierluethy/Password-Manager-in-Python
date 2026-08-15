export function timeAgo(unixSecs: number): string {
  if (!unixSecs) return "—";
  const now = Date.now() / 1000;
  const diff = Math.max(0, now - unixSecs);
  const mins = Math.floor(diff / 60);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mo ago`;
  const years = Math.floor(days / 365);
  return `${years} yr${years === 1 ? "" : "s"} ago`;
}

const STRENGTH_LABELS = ["Very weak", "Weak", "Fair", "Strong", "Excellent"];
export function strengthLabel(score: number): string {
  return STRENGTH_LABELS[Math.max(0, Math.min(4, score))];
}

/** Map a 0..4 strength score to a semantic color token. */
export function strengthColor(score: number): string {
  if (score <= 1) return "var(--danger)";
  if (score === 2) return "var(--warn)";
  return "var(--ok)";
}

/** Map a 0..100 health score to a semantic color token. */
export function healthColor(score: number): string {
  if (score < 50) return "var(--danger)";
  if (score < 80) return "var(--warn)";
  return "var(--ok)";
}

/** Derive up-to-two-letter initials for an entry's avatar tile. */
export function initials(title: string, url: string): string {
  const source = (title || url || "?").trim();
  const cleaned = source.replace(/^https?:\/\//, "").replace(/^www\./, "");
  const words = cleaned.split(/[\s.\-_/]+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** A stable brass-adjacent hue for an entry tile, derived from its title. */
export function tileHue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}

export function bitsLabel(bits: number): string {
  return `${Math.round(bits)} bits`;
}
