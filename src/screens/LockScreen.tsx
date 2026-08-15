import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, Lock, ShieldCheck } from "lucide-react";
import { Dial } from "@/components/Dial";
import { StrengthBar } from "@/components/StrengthBar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { api, errMsg } from "@/lib/api";
import { useVault } from "@/store";

export function LockScreen({ mode }: { mode: "onboarding" | "locked" }) {
  const { unlock, createVault } = useVault();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [score, setScore] = useState(0);
  const [opening, setOpening] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [mode]);

  // Live strength while creating a master password.
  useEffect(() => {
    if (mode !== "onboarding") return;
    let active = true;
    if (!password) {
      setScore(0);
      return;
    }
    api.analyzePassword(password).then((r) => active && setScore(r.score));
    return () => {
      active = false;
    };
  }, [password, mode]);

  const canSubmit = useMemo(() => {
    if (busy || !password) return false;
    if (mode === "onboarding") return password === confirm && score >= 2;
    return true;
  }, [busy, password, confirm, score, mode]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    try {
      if (mode === "onboarding") {
        if (password !== confirm) {
          toast("Passwords don't match", "warning");
          setBusy(false);
          return;
        }
        // Play the opening animation, then create.
        setOpening(true);
        await new Promise((r) => setTimeout(r, 620));
        await createVault(password);
      } else {
        setOpening(true);
        await unlock(password);
      }
    } catch (err) {
      setOpening(false);
      toast(errMsg(err), "danger");
      setBusy(false);
    }
  }

  const dialValue = mode === "onboarding" ? score / 4 : opening ? 1 : 0.12;

  return (
    <div className="grid h-full place-items-center overflow-hidden bg-ink-900 p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
        className="flex w-full max-w-sm flex-col items-center"
      >
        {/* Signature dial */}
        <Dial value={dialValue} size={168} spinning={opening} glow={opening}>
          <motion.div
            animate={opening ? { scale: [1, 0.9, 1] } : {}}
            transition={{ duration: 0.6 }}
            className="grid h-16 w-16 place-items-center rounded-full"
            style={{
              background: opening ? "var(--brass-500)" : "var(--ink-700)",
              transition: "background 400ms",
            }}
          >
            {opening ? (
              <ShieldCheck size={26} className="text-[#12100a]" />
            ) : (
              <Lock size={24} className="text-brass-500" />
            )}
          </motion.div>
        </Dial>

        <h1 className="mt-7 font-display text-display-l tracking-tight text-mist-50">
          Tresor
        </h1>
        <p className="mt-1.5 text-body-sm text-steel-400">
          {mode === "onboarding"
            ? "Set a master password to seal your vault"
            : "Enter your master password to unlock"}
        </p>

        <form onSubmit={submit} className="mt-7 flex w-full flex-col gap-3">
          <div className="relative">
            <Input
              ref={inputRef}
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Master password"
              autoComplete="off"
              className="pr-10 font-mono"
              disabled={opening}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShow((s) => !s)}
              className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-sm text-steel-400 hover:text-mist-50"
            >
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {mode === "onboarding" && (
            <>
              <Input
                type={show ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirm master password"
                autoComplete="off"
                className="font-mono"
                disabled={opening}
              />
              {password && <StrengthBar score={score} />}
              {password && confirm && password !== confirm && (
                <p className="text-body-sm text-[color:var(--warn)]">
                  Passwords don't match yet
                </p>
              )}
              <p className="rounded-sm border border-ink-600 bg-ink-800 p-3 text-body-sm text-steel-400">
                Your master password is the only key. It's never stored and can't
                be recovered — if you forget it, the vault stays sealed forever.
              </p>
            </>
          )}

          <Button
            type="submit"
            size="lg"
            disabled={!canSubmit}
            className="mt-1"
          >
            {mode === "onboarding" ? "Create vault" : "Unlock"}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
