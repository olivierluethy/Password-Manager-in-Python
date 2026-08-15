import { useEffect, useState } from "react";
import { AlertTriangle, Copy, GitCompareArrows, Clock, ShieldCheck } from "lucide-react";
import { Dial } from "@/components/Dial";
import { api } from "@/lib/api";
import { healthColor } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { HealthReport } from "@/lib/types";

export function HealthView({
  refreshKey,
  onSelectEntry,
}: {
  refreshKey: number;
  onSelectEntry: (id: string) => void;
}) {
  const [report, setReport] = useState<HealthReport | null>(null);

  useEffect(() => {
    api.vaultHealth().then(setReport);
  }, [refreshKey]);

  if (!report) {
    return (
      <div className="grid h-full place-items-center text-steel-400">
        Analyzing vault…
      </div>
    );
  }

  const color = healthColor(report.score);
  const allClear =
    report.weak.length === 0 &&
    report.reused.length === 0 &&
    report.similar.length === 0 &&
    report.stale.length === 0;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-3xl flex-col gap-8 p-8">
        {/* Score */}
        <div className="flex items-center gap-8">
          <Dial value={report.score / 100} size={132} thickness={9} color={color} glow>
            <div className="flex flex-col items-center">
              <span className="font-display text-display-l" style={{ color }}>
                {report.score}
              </span>
              <span className="text-caption uppercase tracking-wider text-steel-400">
                Health
              </span>
            </div>
          </Dial>
          <div className="flex flex-col gap-1">
            <h1 className="font-display text-h1 text-mist-50">Vault health</h1>
            <p className="text-body text-steel-400">
              {report.withPassword} of {report.total} entries have a password.
            </p>
            {allClear && (
              <p className="mt-1 flex items-center gap-2 text-body text-ok">
                <ShieldCheck size={16} /> Everything looks healthy. Nice work.
              </p>
            )}
          </div>
        </div>

        {/* Categories */}
        <div className="flex flex-col gap-5">
          <Category
            icon={<AlertTriangle size={16} />}
            title="Weak passwords"
            tone="danger"
            count={report.weak.length}
            empty="No weak passwords."
            hint="These are easy to guess. Replace them with generated passwords."
          >
            {report.weak.map((w) => (
              <ItemRow key={w.id} title={w.title} detail={w.detail} onClick={() => onSelectEntry(w.id)} />
            ))}
          </Category>

          <Category
            icon={<Copy size={16} />}
            title="Reused passwords"
            tone="danger"
            count={report.reused.reduce((n, g) => n + g.count, 0)}
            empty="No password is used twice."
            hint="One breach exposes every account sharing a password. Make each unique."
          >
            {report.reused.map((g, i) => (
              <div key={i} className="rounded-sm border border-ink-600 bg-ink-800 p-3">
                <p className="mb-1.5 text-body-sm text-[color:var(--danger)]">
                  Shared by {g.count} entries
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {g.ids.map((id, j) => (
                    <button
                      key={id}
                      onClick={() => onSelectEntry(id)}
                      className="rounded-full bg-ink-700 px-2.5 py-1 text-body-sm text-mist-200 hover:text-mist-50"
                    >
                      {g.titles[j]}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </Category>

          <Category
            icon={<GitCompareArrows size={16} />}
            title="Similar passwords"
            tone="warn"
            count={report.similar.length}
            empty="No suspiciously similar passwords."
            hint="Small variations of one password are nearly as risky as reuse."
          >
            {report.similar.map((p, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-sm border border-ink-600 bg-ink-800 p-3 text-body-sm"
              >
                <button onClick={() => onSelectEntry(p.aId)} className="text-mist-200 hover:text-mist-50">
                  {p.aTitle}
                </button>
                <span className="text-steel-500">≈</span>
                <button onClick={() => onSelectEntry(p.bId)} className="text-mist-200 hover:text-mist-50">
                  {p.bTitle}
                </button>
                <span className="ml-auto font-mono text-[color:var(--warn)]">{p.similarity}%</span>
              </div>
            ))}
          </Category>

          <Category
            icon={<Clock size={16} />}
            title="Stale passwords"
            tone="warn"
            count={report.stale.length}
            empty="Nothing is overdue for a refresh."
            hint="Passwords unchanged for a long time are worth rotating."
          >
            {report.stale.map((s) => (
              <ItemRow key={s.id} title={s.title} detail={s.detail} onClick={() => onSelectEntry(s.id)} />
            ))}
          </Category>
        </div>
      </div>
    </div>
  );
}

function Category({
  icon,
  title,
  tone,
  count,
  empty,
  hint,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  tone: "danger" | "warn";
  count: number;
  empty: string;
  hint: string;
  children: React.ReactNode;
}) {
  const color = tone === "danger" ? "var(--danger)" : "var(--warn)";
  return (
    <section className="rounded-lg border border-ink-600 bg-ink-800 p-5 shadow-panel">
      <div className="flex items-center gap-2.5">
        <span style={{ color: count > 0 ? color : "var(--steel-400)" }}>{icon}</span>
        <h3 className="font-display text-h3 text-mist-50">{title}</h3>
        {count > 0 && (
          <span
            className="rounded-full px-2 py-0.5 font-mono text-body-sm"
            style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
          >
            {count}
          </span>
        )}
      </div>
      {count === 0 ? (
        <p className="mt-2 flex items-center gap-2 text-body-sm text-ok">
          <ShieldCheck size={14} /> {empty}
        </p>
      ) : (
        <>
          <p className="mt-1.5 text-body-sm text-steel-400">{hint}</p>
          <div className="mt-3 flex flex-col gap-1.5">{children}</div>
        </>
      )}
    </section>
  );
}

function ItemRow({
  title,
  detail,
  onClick,
}: {
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center justify-between rounded-sm border border-ink-600 bg-ink-800 px-3 py-2 text-left transition-colors hover:bg-ink-650",
      )}
    >
      <span className="truncate text-body-sm text-mist-50">{title}</span>
      <span className="shrink-0 pl-3 font-mono text-body-sm text-steel-400">{detail}</span>
    </button>
  );
}
