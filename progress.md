# Margins — progress

Last updated: Sat 31 Oct 2026

## Implementation plan (full platform build)

Transforming the Margins *design* into a complete study platform. Reference design
is untouched: same shell, composer, margin-rail result, auth cards, settings rows,
7-palette theme system. All static/demo behavior is replaced by real data.

Stack (verified current, all stable):
- Next.js 16.4.3 (App Router, `proxy.ts`), React 19.3.x, TypeScript 7.0.2
- PostgreSQL 18 (local cluster, running) + Prisma 7.10.1 stable + `@prisma/adapter-pg`
  (Prisma 8 is RC → not used)
- Better Auth 1.7.14 (Prisma adapter; email+password, sessions, verification, reset)
- `@google/genai` 2.x — current **Interactions API** (`ai.interactions.create`,
  `ai.files.upload`), Gemini `gemini-3.8-flash` (configurable), transcription via
  `gemini-3.5-transcribe` with word-level timestamps for lecturer-emphasis analysis
- next-intl 4.x (`en`/`ar`, RTL), Zod 4.x, `mammoth` for DOCX text, local private
  file storage (dev) behind a storage abstraction

Build order (each its own commit):
1. chore: upgrade deps, TS strict, `.env.example`, env validation
2. feat(db): Prisma schema (Better Auth tables + User + UserPreference + Document +
   SourceAsset + Summary + ProcessingJob), migrations, DB_STRUCTURE.md
3. feat(auth): Better Auth wiring, mailer abstraction (dev console/outbox files,
   configurable provider), auth pages → real flows, profile password change
4. feat(i18n): locale routing `[locale]`, proxy.ts, messages/ full en+ar, RTL pass
5. feat(storage+documents): upload endpoints, magic-byte validation, private files
6. feat(ai): summarization pipeline (chunking, section analysis, merge, coverage
   check + gap recovery, Zod contract, source references), lecturer emphasis from
   audio evidence, job queue (`ProcessingJob`, SKIP LOCKED claim) + worker process
7. feat(workspace): real summarize flow (job polling), summary viewer (points,
   emphasis pills, formulas, tables, charts + flowcharts as safe SVG), library UI
   over real records, preferences persisting theme to DB
8. docs: api_routes.md, PROJECT_MAP.md, AGENTS.md, progress verification

Architecture decisions:
- Files live on disk (`storage/<userId>/…`, private), metadata in Postgres.
- Job worker: `npm run worker` (tsx workers/document-processing-worker.ts).
- Diagrams = validated, restricted node/edge JSON rendered to SVG. No AI HTML.
- No provider of email configured → dev mailer logs the message + writes .eml to
  `storage/outbox/`; UI never claims a sent email it cannot guarantee.

## Prior work (theme system phase)

Last updated: Fri 30 Oct 2026

## Completed

### Baseline (commit 9a6eb02)
- The dealt app-screen design run (accent-ladder, seed 836043070): 7 screens
  (`/login`, `/signup`, `/verify`, `/reset`, `/reset/new`, `/summarize`, `/save`),
  passing the design skill's lint (0 FAIL, 0 WARN) and inspect (0 FAIL, 0 WARN)
  at 1440/1280/768/390/360. All "before" screenshots in `.taste-skill/before/`.

### Theme system (commit 7b13500)
- **Palette tokens** — 7 palettes × 2 modes in `app/themes.css` (rose, lavender,
  peach, berry, mint, sky, plum), scoped as `[data-accent="…"]` (light values) and
  `[data-appearance="dark"][data-accent="…"]` (dark values). Base stylesheet
  (`app/globals.css`) keeps light + rose as the fallback so a page without
  attributes still renders whole. Dark mode keeps the true-neutral `#000` ground
  and tints wells/tracks/ink instead.
- **Every palette** sets `--accent`, `--accent-soft`, `--accent-track`,
  `--accent-ink`, `--ground`; `--chart-1` follows `--accent` on data marks
  automatically. Status colours, greys and controls are centralized in globals and
  shared across palettes.
- **No-flash init** — inline script in `app/layout.tsx` restores the saved theme
  (localStorage key `margins-theme`) before first paint; `?appearance=&accent=`
  query params act as QA-only overrides and are never persisted.
- **Client utilities** — `lib/theme.ts` (`sanitizeTheme`, `readTheme`, `applyTheme`,
  `setAppearance`, `setAccent`, `onThemeChange`).
- **Settings screen** (`/settings`, "Appearance") per app-screens.md §8.2:
  label column (title + description + the live "Now: …" stamp) beside panels,
  full-width rules between sections. Mode segmented control; 7 palette chips whose
  swatches scope their own palette via `data-accent` on the swatch; visible
  `aria-pressed` states; keyboard-reachable plain buttons; instant repaint.
  `ThemeStamp` (client) mirrors the current theme via a window event.
- **Shell** — "Appearance" nav item added under the Account group; phone bar name
  map extended; layouts, composition and logo untouched.
- **Shared fragment** — `app/summary-note.tsx` (the margin rail) is used by the auth
  screens' `data-ui` fragment and the settings live preview; the mark SVG's strokes
  are tokenized (`.mark-page` → `--mark-ink`, `.mark-rail/.mark-line` → `--accent`).
- **Restrained improvements** — exam-material pills (`pill warn`) on flagged key
  points; dropzone hover state; "Recently kept" cross-link under Save to library
  (real row from `lib/data.ts`); logical (RTL-safe) properties in newly touched rules.

## Verification
- `lint.mjs --app app`: 0 FAIL, 0 WARN.
- `inspect.mjs --app` at 1440/1280/768/390/360: every page 0 FAIL, 0 WARN (light and
  dark), and all 14 palette×mode combinations on summarize/save/settings.
- Numeric WCAG check (`/tmp/opencode/contrast.mjs` results in this report): all
  ink/soft pairs ≥ 4.5:1 in both modes for every palette (56 pairs pass).
- Before/after screenshots under `.taste-skill/before/` and `.taste-skill/after/`.

## Design decisions worth remembering
- Lavender ships but is purposefully muted (dusty lilac, saturation < the study's
  banned "AI indigo" band); plum is its deeper sibling, berry is the deeper rose.
- Peach's tinted areas lean pink rather than yellow-cream (the inspector bans cream).
- Dark mode grounds stay neutral `#000`; offsets live in soft/track/ink.
- Palette values are intentionally NOT deviated from a generated tint ladder; each
  was checked for the four pairs (ink on soft/ground, accent on soft/ground).

## Remaining (next phases)
- Wire theme persistence to the authenticated user's profile (server-side).
- Wire the app's real functionality (auth, storage, AI summarization).
- Lecture-recording uploads are out of scope of the current design (texts,
  documents and images only) and were not invented.
- Arabic RTL: considered via logical properties in touched rules; a full RTL pass
  (mirroring the shell and rails) is still pending.

## Sample data to replace before launch
- Student identity Lina Haddad / l.haddad@uni.edu (sidebar + verify screen).
- All `lib/data.ts` rows (titles, sizes, points, kept %).
- The pasted excerpt, its 5 key points and both word counts (156/53) — they appear
  in Summarize, the auth fragment and the settings preview on purpose.
- Timestamps and the verify screen's code digits.
