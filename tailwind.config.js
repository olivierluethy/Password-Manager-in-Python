/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          900: "var(--ink-900)",
          850: "var(--ink-850)",
          800: "var(--ink-800)",
          700: "var(--ink-700)",
          650: "var(--ink-650)",
          600: "var(--ink-600)",
        },
        steel: {
          500: "var(--steel-500)",
          400: "var(--steel-400)",
        },
        mist: {
          200: "var(--mist-200)",
          50: "var(--mist-50)",
        },
        brass: {
          600: "var(--brass-600)",
          500: "var(--brass-500)",
          400: "var(--brass-400)",
          glow: "var(--brass-glow)",
        },
        ok: "var(--ok)",
        warn: "var(--warn)",
        danger: "var(--danger)",
        info: "var(--info)",
      },
      fontFamily: {
        display: ["Space Grotesk", "system-ui", "sans-serif"],
        sans: ["IBM Plex Sans", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
      },
      fontSize: {
        "display-xl": ["3rem", { lineHeight: "1.05", fontWeight: "700" }],
        "display-l": ["2.25rem", { lineHeight: "1.1", fontWeight: "700" }],
        h1: ["1.75rem", { lineHeight: "1.15", fontWeight: "600" }],
        h2: ["1.375rem", { lineHeight: "1.2", fontWeight: "600" }],
        h3: ["1.125rem", { lineHeight: "1.3", fontWeight: "600" }],
        body: ["0.9375rem", { lineHeight: "1.55" }],
        "body-sm": ["0.8125rem", { lineHeight: "1.5" }],
        caption: ["0.75rem", { lineHeight: "1.4", fontWeight: "500", letterSpacing: "0.08em" }],
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "16px",
      },
      boxShadow: {
        panel:
          "0 8px 24px -12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.02)",
        pop: "0 24px 60px -20px rgba(0,0,0,0.75)",
        brass: "0 0 24px -6px rgba(200,162,76,0.5)",
      },
      transitionTimingFunction: {
        vault: "cubic-bezier(0.2,0,0,1)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.97)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-in": "fade-in 180ms cubic-bezier(0.2,0,0,1)",
        "scale-in": "scale-in 160ms cubic-bezier(0.2,0,0,1)",
      },
    },
  },
  plugins: [],
};
