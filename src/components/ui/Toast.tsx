import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ClipboardCopy, Info, TriangleAlert } from "lucide-react";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";

type ToastKind = "info" | "success" | "warning" | "danger";

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  /** For clipboard toasts: seconds remaining until auto-clear. */
  countdown?: number;
}

interface ToastCtx {
  toast: (message: string, kind?: ToastKind) => void;
  copy: (text: string, label?: string, clearSecs?: number) => Promise<void>;
}

const Ctx = createContext<ToastCtx | null>(null);

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const ACCENT: Record<ToastKind, string> = {
  info: "var(--info)",
  success: "var(--ok)",
  warning: "var(--warn)",
  danger: "var(--danger)",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const clearTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (item: Omit<ToastItem, "id">): number => {
      const id = ++seq.current;
      setItems((prev) => [...prev, { ...item, id }]);
      return id;
    },
    [],
  );

  const toast = useCallback(
    (message: string, kind: ToastKind = "info") => {
      const id = push({ kind, message });
      setTimeout(() => remove(id), 3200);
    },
    [push, remove],
  );

  const copy = useCallback(
    async (text: string, label = "Copied", clearSecs = 20) => {
      try {
        await writeText(text);
      } catch {
        // Fallback to the web clipboard API if the plugin is unavailable.
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          toast("Couldn't access the clipboard", "danger");
          return;
        }
      }

      // Replace any existing clipboard countdown toast.
      setItems((prev) => prev.filter((t) => t.countdown === undefined));
      if (clearTimer.current) clearInterval(clearTimer.current);

      if (clearSecs <= 0) {
        toast(`${label} to clipboard`, "success");
        return;
      }

      const id = push({
        kind: "success",
        message: `${label} — clears in`,
        countdown: clearSecs,
      });

      clearTimer.current = setInterval(() => {
        setItems((prev) => {
          const next = prev.map((t) =>
            t.id === id && t.countdown !== undefined
              ? { ...t, countdown: (t.countdown ?? 0) - 1 }
              : t,
          );
          const me = next.find((t) => t.id === id);
          if (!me || (me.countdown ?? 0) <= 0) {
            if (clearTimer.current) clearInterval(clearTimer.current);
            writeText("").catch(() => {});
            return next.filter((t) => t.id !== id);
          }
          return next;
        });
      }, 1000);
    },
    [push, toast],
  );

  useEffect(
    () => () => {
      if (clearTimer.current) clearInterval(clearTimer.current);
    },
    [],
  );

  return (
    <Ctx.Provider value={{ toast, copy }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[100] flex flex-col items-center gap-2">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
              className="pointer-events-auto flex items-center gap-3 overflow-hidden rounded-md border border-ink-600 bg-ink-700 py-2.5 pl-3 pr-4 shadow-pop"
            >
              <span
                className="h-8 w-1 rounded-full"
                style={{ background: ACCENT[t.kind] }}
              />
              <ToastIcon kind={t.kind} />
              <span className="text-body-sm text-mist-50">
                {t.message}
                {t.countdown !== undefined && (
                  <span className="ml-1.5 font-mono text-steel-400">
                    {t.countdown}s
                  </span>
                )}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

function ToastIcon({ kind }: { kind: ToastKind }) {
  const c = ACCENT[kind];
  if (kind === "success") return <Check size={16} style={{ color: c }} />;
  if (kind === "warning") return <TriangleAlert size={16} style={{ color: c }} />;
  if (kind === "danger") return <TriangleAlert size={16} style={{ color: c }} />;
  return <Info size={16} style={{ color: c }} />;
}

export { ClipboardCopy };
