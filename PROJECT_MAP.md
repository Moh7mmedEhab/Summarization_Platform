# PROJECT_MAP.md

Margins — an AI study platform design (Next.js App Router + TypeScript + plain CSS),
statically exportable (`npm run build` → `out/`).

## Structure
```
app/
  layout.tsx            root: DM Sans, theme.css imports, inline theme-init script
  globals.css           design system: base tokens (light + rose), shell, all app sections
  themes.css            7 palettes × light/dark, scoped by [data-accent]/[data-appearance]
  page.tsx              redirects to /summarize
  app-shell.tsx         client shell: sidebar (+ phone bar ≤860px), Account group incl. Appearance
  auth-frag.tsx         data-ui product fragment beside every auth form
  summary-note.tsx      the margin-rail fragment (ratio + pen-marked key points), shared
  theme-controls.tsx    client: mode segmented control + palette chips (scoped swatches)
  theme-stamp.tsx       client: live "Now: light, Rose" stamp
  login|signup|verify|reset|reset/new/page.tsx   auth screens (auth-frag beside each form)
  summarize/page.tsx    composer + result (margin rail, exam pills, save panel + recent)
  save/page.tsx         library rows (kept% bar per row) + "Summarize something new" band
  settings/page.tsx     Appearance: §8.2 section rows (Theme controls | live preview)
lib/
  icons.tsx             outline icon set (1.5px) + the product mark (themed strokes)
  data.ts               sample library rows; counts and ratios are derived, asserted
  theme.ts              theme model: sanitize/read/apply/set + change event
```

## Tokens
- Base: `:root` in `app/globals.css` (light + rose fallback) and `[data-appearance="dark"]`.
- Per palette: `--accent` (pen), `--accent-soft` (area tint), `--accent-track`,
  `--accent-ink`, `--ground`; `--chart-1` follows the accent. Greys, controls,
  status pills and radii are global.
- Theme model on `<html>`: `data-appearance="light|dark"`
  `data-accent="rose|lavender|peach|berry|mint|sky|plum"`.
- Persistence: localStorage `margins-theme` (theme model lives in `lib/theme.ts`).

## QA harness
```
npm run build && python3 -m http.server 9317 -d out
node .agents/skills/design-taste-frontend/scripts/lint.mjs --app app
node .agents/skills/design-taste-frontend/scripts/inspect.mjs --app \
  "http://localhost:9317/summarize.html?accent=mint&appearance=dark" \
  --out .taste-skill/after/x --widths 1440,1280,768,390,360
```
URL params `?accent=&appearance=` are QA-visible overrides, not persisted.

## NOT implemented (by design, this phase)
Auth, storage, actual summarization — all controls are visual only.
Lecture-recording uploads are out of the current scope (texts, documents, images).
Theme persistence to the server profile is the next phase.
