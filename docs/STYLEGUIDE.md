# Tresor — Styleguide

The single source of truth for Tresor's visual system. Every screen, component,
and new feature must be built from these tokens. If something isn't defined here,
it should be derived from what is — never invented ad hoc.

---

## 1. Design concept — "The Vault Room"

Tresor is a private, offline safe. The interface should feel like the inside of a
fine mechanical vault: hushed, precise, and warm where it matters. The mood is
**calm confidence**, not techno-anxiety — a non-technical person should feel their
secrets are held by something solid and expensive.

- **Cool patinated steel** carries the room (deep, desaturated petrol-green darks).
- **One warm brass accent** is the only metal — used for the lock, primary
  actions, focus, and the signature dial. Nothing else competes with it.
- **Signature:** the **combination dial** — a brass ring on the lock screen that
  rotates and warms as the vault opens, reused as the arc for the password-strength
  and vault-health meters. It is the one bold element; everything else stays quiet
  (flat panels, hairline borders, generous space).

Deliberately **not**: cream + serif + terracotta, near-black + acid green, or
broadsheet hairline columns. Those are defaults; this is a choice.

---

## 2. Color tokens

Dark is the primary theme (a vault is a dark room). Light is a real, supported
alternative ("daylight"). Define every color as a CSS variable on `:root`
(light) and override under the dark selectors, then map into Tailwind.

### Dark theme (primary)

| Token | Hex | Role |
|-------|-----|------|
| `--ink-900` | `#0E1614` | App background (deepest) |
| `--ink-850` | `#111B18` | Sunken areas / sidebar |
| `--ink-800` | `#141F1C` | Panel background |
| `--ink-700` | `#1C2A26` | Raised surface / card / selected row |
| `--ink-650` | `#22332E` | Hover surface |
| `--ink-600` | `#2A3B36` | Hairline border / divider |
| `--steel-500` | `#5E756C` | Disabled text / faint icon |
| `--steel-400` | `#7C9188` | Muted / secondary text |
| `--mist-200` | `#C9D6D0` | Body text |
| `--mist-50`  | `#EDF2EF` | High-contrast text / headings |
| `--brass-600` | `#A6842F` | Accent pressed |
| `--brass-500` | `#C8A24C` | **Primary accent** (brass) |
| `--brass-400` | `#DBB968` | Accent hover / bright edge |
| `--brass-glow` | `rgba(200,162,76,0.14)` | Accent wash / tint fill |

### Semantic (shared, tuned per theme)

| Token | Dark | Light | Role |
|-------|------|-------|------|
| `--ok`     | `#5FB88E` | `#2F7D57` | Strong / success / patina green |
| `--warn`   | `#E39A4B` | `#B26D18` | Weak / caution / amber |
| `--danger` | `#D26A54` | `#B23D28` | Breached / reused / oxidized red |
| `--info`   | `#6BA7C4` | `#2E6E8C` | Neutral info / network feature |

### Light theme ("daylight") overrides

Warm brushed-bone, deliberately cooler/greyer than the AI-cream default.

| Token | Hex |
|-------|-----|
| `--ink-900` | `#E7E4DA` (app bg) |
| `--ink-850` | `#EDEAE1` |
| `--ink-800` | `#F4F1EA` (panel) |
| `--ink-700` | `#FBF9F3` (raised / card) |
| `--ink-650` | `#EFEBE0` (hover) |
| `--ink-600` | `#D6D1C3` (hairline) |
| `--steel-500` | `#9A9384` |
| `--steel-400` | `#6E6759` (muted text) |
| `--mist-200` | `#2C3630` (body text) |
| `--mist-50`  | `#161D19` (headings) |
| `--brass-600` | `#7E621F` |
| `--brass-500` | `#9A7A2E` (accent — darkened for light contrast) |
| `--brass-400` | `#B79642` |
| `--brass-glow` | `rgba(154,122,46,0.16)` |

**Theme mechanics.** Light palette lives on bare `:root`. Dark overrides go in
`@media (prefers-color-scheme: dark)` guarded as `:root:not([data-theme="light"])`
**and** in `:root[data-theme="dark"]`, so the in-app toggle wins both directions.
`body` always paints `--ink-900` explicitly.

---

## 3. Typography

Three roles, each with a job. Self-hosted via `@fontsource` (no network at
runtime — required for a local-only app).

| Role | Family | Usage |
|------|--------|-------|
| **Display** | **Space Grotesk** | Wordmark, screen titles, section headings. Engraved, mechanical-humanist. Tight tracking on the wordmark (`-0.02em`). |
| **Body / UI** | **IBM Plex Sans** | All prose, labels, buttons, inputs. Calm and highly legible. |
| **Data / Mono** | **IBM Plex Mono** | Anything that is *machine data*: passwords, entropy/bit readouts, hashes, URLs in verification panels, timestamps, keyboard hints. This is a semantic rule, not decoration. |

### Type scale (rem, 16px root)

| Name | Size | Line | Weight | Notes |
|------|------|------|--------|-------|
| `display-xl` | 3rem | 1.05 | 700 | Lock screen wordmark / big moments |
| `display-l` | 2.25rem | 1.1 | 700 | Onboarding headlines |
| `h1` | 1.75rem | 1.15 | 600 | Screen title |
| `h2` | 1.375rem | 1.2 | 600 | Section |
| `h3` | 1.125rem | 1.3 | 600 | Card / group title |
| `body` | 0.9375rem | 1.55 | 400 | Default (15px) |
| `body-sm` | 0.8125rem | 1.5 | 400 | Secondary (13px) |
| `caption` | 0.75rem | 1.4 | 500 | Eyebrows / labels — `uppercase`, `letter-spacing: 0.08em`, `--steel-400` |
| `mono` | 0.875rem | 1.5 | 400 | Data role |

Headings use Space Grotesk; captions/eyebrows may use Space Grotesk uppercase for
the "engraved label" feel.

---

## 4. Spacing, radii, borders, shadows

**Spacing** — 4px base rhythm: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80`.
Panels use 24px internal padding; list rows 12–16px; dense controls 8px.

**Radii:**
| Token | Value | Use |
|-------|-------|-----|
| `radius-sm` | 6px | Inputs, chips, small buttons |
| `radius-md` | 10px | Buttons, cards |
| `radius-lg` | 16px | Panels, modals, sheets |
| `radius-full` | 9999px | Dial, avatars, pills, toggles |

**Borders:** hairline `1px solid var(--ink-600)`. Dividers same. No double borders;
prefer a border *or* an elevation change, not both.

**Shadows** (dark UI leans on surface lightening + focus glow, not heavy drops):
| Token | Value |
|-------|-------|
| `shadow-panel` | `0 8px 24px -12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.02)` |
| `shadow-pop` | `0 24px 60px -20px rgba(0,0,0,0.75)` (menus, modals) |
| `shadow-brass` | `0 0 24px -6px rgba(200,162,76,0.5)` (unlocked dial, primary hover) |
| `focus-ring` | `0 0 0 2px var(--ink-900), 0 0 0 4px var(--brass-500)` |

---

## 5. Component patterns

**Buttons**
- *Primary (brass):* bg `--brass-500`, text `#12100A` (near-black on brass for
  contrast), `radius-md`, 600 weight. Hover `--brass-400`. Active `--brass-600`.
  Focus `focus-ring`. Disabled: `--ink-650` bg / `--steel-500` text.
- *Secondary (steel/ghost):* transparent bg, `1px --ink-600` border, text `--mist-200`.
  Hover bg `--ink-650`. Same focus.
- *Danger:* text/border `--danger`; solid only for destructive confirmation.
- *Icon button:* square, `radius-sm`, `--steel-400` icon → `--mist-50` on hover.

**Inputs / fields**
- bg `--ink-800`, `1px --ink-600` border, text `--mist-50`, placeholder `--steel-500`.
- Focus: border `--brass-500` + `focus-ring`. Error: border `--danger`.
- Labels are `caption` above the field. Password fields render value in **mono**
  with a reveal (eye) icon-button and a copy icon-button inline.

**Cards / panels:** bg `--ink-800` (or `--ink-700` for raised), `radius-lg`,
hairline border, `shadow-panel`, 24px padding.

**List rows (entry list):** 56–64px tall, `--steel-400` meta text, mono for the
masked password. Hover: bg `--ink-650`. **Selected: bg `--ink-700` + 2px brass
left-border** (a file-tab on the vault). Leading favicon/initials chip in a
`radius-sm` tile.

**Chips / tags / folder pills:** `radius-full`, `--ink-700` bg, `body-sm`,
`--steel-400` text; strength/health chips take semantic colors as a subtle tint
(`color-mix` with 14% opacity bg + full-color text).

**Modals / sheets:** centered card, `--ink-800`, `radius-lg`, `shadow-pop`, over a
`rgba(6,10,9,0.6)` scrim with slight backdrop blur.

**Command palette (search):** top-anchored floating panel, mono-monospaced
shortcut hints, brass highlight on the active row, always shows nearest match.

**Toasts:** bottom-center, `--ink-700`, hairline border, semantic left-accent bar;
clipboard-clear countdown shown in mono.

---

## 6. The signature dial

- A `radius-full` ring, ~180px on the lock screen. Track in `--ink-600`; the active
  arc (progress / strength / health) drawn in a brass→ok gradient.
- **Locked:** ring cool/steel, whole app slightly desaturated.
- **Unlocking:** ring rotates ~300° and warms to brass with `shadow-brass`
  (~600ms, the one orchestrated motion moment).
- Reused at small size (56–72px) as the **strength meter** on the generator and the
  **vault-health score** on the dashboard — same visual language, different data.

---

## 7. Interactive states & motion

- Every interactive element defines default / hover / active / focus / disabled.
  **Focus is always visible** via `focus-ring` — never removed.
- Transitions: 150–220ms `cubic-bezier(0.2,0,0,1)` (ease-out) for hover/press,
  color, and surface changes. The dial unlock is ~600ms.
- `prefers-reduced-motion: reduce` → disable the dial rotation and all non-essential
  transitions; state changes become instant.
- Selection, drag-over (folders), and keyboard focus all read through the same
  brass language so the product feels like one object.

---

## 8. Voice (UI copy)

Plain, active, calm. Actions say what happens ("Unlock", "Save entry", "Copy
password", "Clear clipboard now"). Errors state what happened and how to fix it, in
the interface's voice, never apologizing. Empty states invite action ("No entries
yet — add your first password"). "Tresor" is the vault; the user's collection is
"your vault"; groups are "folders". Never expose implementation terms (cipher,
blob, KDF) in primary UI — they live in Settings › Security details only.
