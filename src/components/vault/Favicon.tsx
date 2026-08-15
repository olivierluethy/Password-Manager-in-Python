import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { initials, tileHue } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Session-level cache so a domain's icon is only fetched once per run. The
 *  backend also caches to disk; this avoids re-invoking on every re-render. */
const cache = new Map<string, string | null>();

function domainKey(url: string): string | null {
  const s = url.trim();
  if (!s) return null;
  const m = s.replace(/^[a-z]+:\/\//i, "").split(/[/?#]/)[0];
  return m || null;
}

/**
 * An entry's leading icon: the website favicon when "Load website icons" is on
 * and the site has one, otherwise a themed monogram avatar (first letters on a
 * stable brass-adjacent hue).
 */
export function Favicon({
  title,
  url,
  enabled,
  className,
}: {
  title: string;
  url: string;
  enabled: boolean;
  className?: string;
}) {
  const key = domainKey(url);
  const [icon, setIcon] = useState<string | null>(() =>
    enabled && key ? cache.get(key) ?? null : null,
  );

  useEffect(() => {
    let active = true;
    if (!enabled || !key) {
      setIcon(null);
      return;
    }
    if (cache.has(key)) {
      setIcon(cache.get(key) ?? null);
      return;
    }
    api
      .fetchFavicon(url)
      .then((res) => {
        cache.set(key, res ?? null);
        if (active) setIcon(res ?? null);
      })
      .catch(() => {
        if (active) setIcon(null);
      });
    return () => {
      active = false;
    };
  }, [key, enabled, url]);

  const hue = tileHue(title || url);
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden font-display font-semibold",
        className,
      )}
      style={
        icon
          ? { background: "var(--ink-700)" }
          : {
              background: `color-mix(in srgb, hsl(${hue} 45% 45%) 22%, var(--ink-700))`,
              color: `hsl(${hue} 60% 78%)`,
            }
      }
    >
      {icon ? (
        <img src={icon} alt="" className="h-full w-full object-contain p-1" />
      ) : (
        initials(title, url)
      )}
    </span>
  );
}
