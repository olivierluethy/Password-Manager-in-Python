import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-10 w-full rounded-sm border border-ink-600 bg-ink-800 px-3 text-body text-mist-50 placeholder:text-steel-500 transition-colors duration-150 ease-vault",
      "focus-visible:border-brass-500 focus-visible:outline-none",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "min-h-[84px] w-full resize-y rounded-sm border border-ink-600 bg-ink-800 px-3 py-2 text-body text-mist-50 placeholder:text-steel-500 transition-colors duration-150 ease-vault",
      "focus-visible:border-brass-500 focus-visible:outline-none",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-display text-caption uppercase tracking-wider text-steel-400">
        {label}
      </span>
      {children}
      {hint}
    </label>
  );
}
