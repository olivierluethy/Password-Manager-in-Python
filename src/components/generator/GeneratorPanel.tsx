import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { bitsLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { GenOptions } from "@/lib/types";

const DEFAULTS: GenOptions = {
  mode: "chars",
  length: 20,
  lower: true,
  upper: true,
  digits: true,
  symbols: true,
  avoidAmbiguous: false,
  wordCount: 5,
  separator: "-",
  capitalize: true,
  addNumber: true,
};

const MODES: { key: GenOptions["mode"]; label: string }[] = [
  { key: "chars", label: "Random" },
  { key: "passphrase", label: "Passphrase" },
  { key: "pronounceable", label: "Pronounceable" },
];

function entropyColor(bits: number): string {
  if (bits < 50) return "var(--danger)";
  if (bits < 80) return "var(--warn)";
  return "var(--ok)";
}

export function GeneratorPanel({
  onUse,
  compact = false,
}: {
  onUse?: (password: string) => void;
  compact?: boolean;
}) {
  const { copy } = useToast();
  const [opts, setOpts] = useState<GenOptions>(DEFAULTS);
  const [password, setPassword] = useState("");
  const [bits, setBits] = useState(0);
  const [copied, setCopied] = useState(false);

  const regen = useCallback(async (o: GenOptions) => {
    const r = await api.generatePassword(o);
    setPassword(r.password);
    setBits(r.entropyBits);
  }, []);

  useEffect(() => {
    regen(opts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts]);

  const set = <K extends keyof GenOptions>(k: K, v: GenOptions[K]) =>
    setOpts((o) => ({ ...o, [k]: v }));

  return (
    <div className="flex flex-col gap-4">
      {/* Result */}
      <div className="rounded-md border border-ink-600 bg-ink-850 p-3">
        <div className="flex items-start gap-2">
          <p
            data-selectable
            className="min-h-[2.5rem] flex-1 break-all font-mono text-body text-mist-50"
          >
            {password}
          </p>
          <div className="flex shrink-0 gap-1">
            <Button
              variant="ghost"
              size="iconSm"
              onClick={() => regen(opts)}
              title="Regenerate"
            >
              <RefreshCw size={15} />
            </Button>
            <Button
              variant="ghost"
              size="iconSm"
              title="Copy"
              onClick={() => {
                copy(password, "Password");
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              }}
            >
              {copied ? <Check size={15} className="text-ok" /> : <Copy size={15} />}
            </Button>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-600">
            <div
              className="h-full rounded-full transition-all duration-300 ease-vault"
              style={{
                width: `${Math.min(100, (bits / 128) * 100)}%`,
                background: entropyColor(bits),
              }}
            />
          </div>
          <span
            className="font-mono text-body-sm"
            style={{ color: entropyColor(bits) }}
          >
            {bitsLabel(bits)}
          </span>
        </div>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 rounded-md border border-ink-600 bg-ink-850 p-1">
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => set("mode", m.key)}
            className={cn(
              "flex-1 rounded-sm px-2 py-1.5 text-body-sm transition-colors duration-150 ease-vault",
              opts.mode === m.key
                ? "bg-ink-700 text-mist-50"
                : "text-steel-400 hover:text-mist-50",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Options per mode */}
      {opts.mode === "chars" && (
        <div className="flex flex-col gap-3">
          <SliderRow
            label="Length"
            value={opts.length}
            min={8}
            max={64}
            onChange={(v) => set("length", v)}
          />
          <ToggleRow label="Lowercase (a-z)" checked={opts.lower} onChange={(v) => set("lower", v)} />
          <ToggleRow label="Uppercase (A-Z)" checked={opts.upper} onChange={(v) => set("upper", v)} />
          <ToggleRow label="Digits (0-9)" checked={opts.digits} onChange={(v) => set("digits", v)} />
          <ToggleRow label="Symbols (!@#…)" checked={opts.symbols} onChange={(v) => set("symbols", v)} />
          <ToggleRow
            label="Avoid look-alikes (l, 1, O, 0…)"
            checked={opts.avoidAmbiguous}
            onChange={(v) => set("avoidAmbiguous", v)}
          />
        </div>
      )}

      {opts.mode === "passphrase" && (
        <div className="flex flex-col gap-3">
          <SliderRow
            label="Words"
            value={opts.wordCount}
            min={3}
            max={10}
            onChange={(v) => set("wordCount", v)}
          />
          <div className="flex items-center justify-between">
            <span className="text-body-sm text-steel-400">Separator</span>
            <div className="flex gap-1">
              {["-", ".", "_", " "].map((s) => (
                <button
                  key={s}
                  onClick={() => set("separator", s)}
                  className={cn(
                    "h-8 w-8 rounded-sm border font-mono text-body-sm",
                    opts.separator === s
                      ? "border-brass-500 bg-ink-700 text-mist-50"
                      : "border-ink-600 text-steel-400 hover:text-mist-50",
                  )}
                >
                  {s === " " ? "␣" : s}
                </button>
              ))}
            </div>
          </div>
          <ToggleRow label="Capitalize words" checked={opts.capitalize} onChange={(v) => set("capitalize", v)} />
          <ToggleRow label="Add a number" checked={opts.addNumber} onChange={(v) => set("addNumber", v)} />
        </div>
      )}

      {opts.mode === "pronounceable" && (
        <div className="flex flex-col gap-3">
          <SliderRow
            label="Length"
            value={opts.length}
            min={8}
            max={40}
            onChange={(v) => set("length", v)}
          />
          <ToggleRow label="Capitalize first letter" checked={opts.capitalize} onChange={(v) => set("capitalize", v)} />
          <ToggleRow label="Append digits" checked={opts.addNumber} onChange={(v) => set("addNumber", v)} />
        </div>
      )}

      {onUse && !compact && (
        <Button onClick={() => onUse(password)} className="mt-1">
          Use this password
        </Button>
      )}
      {onUse && compact && (
        <Button size="sm" variant="secondary" onClick={() => onUse(password)}>
          Use
        </Button>
      )}
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-body-sm text-steel-400">{label}</span>
        <span className="font-mono text-body-sm text-mist-50">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="tresor-range"
      />
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-body-sm text-mist-200">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
