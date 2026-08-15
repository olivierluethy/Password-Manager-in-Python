import { strengthColor, strengthLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

/** A four-segment strength bar with a label, driven by a 0..4 score. */
export function StrengthBar({
  score,
  className,
  showLabel = true,
}: {
  score: number;
  className?: string;
  showLabel?: boolean;
}) {
  const color = strengthColor(score);
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="h-1.5 flex-1 rounded-full transition-colors duration-200 ease-vault"
            style={{
              background: i < score ? color : "var(--ink-600)",
            }}
          />
        ))}
      </div>
      {showLabel && (
        <span className="text-body-sm" style={{ color }}>
          {strengthLabel(score)}
        </span>
      )}
    </div>
  );
}
