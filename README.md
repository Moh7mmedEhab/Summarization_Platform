# Margins

Margins is a full-stack study platform that turns course material — PDFs, DOCX,
text, images, and lecture recordings — into structured, honest study notes with
Gemini: key points, outlines, flashcards, coverage audits, tables, and diagrams.
Users sign in (email + password, verified), upload sources in any mix, pick a
language (English/Arabic, with full RTL) and a summary style, and follow the job
progress live while a background worker does the heavy lifting.

Key traits:

- **Honest pipeline**: nothing is presented as verified unless it was checked —
  the coverage audit lists what was analyzed, what may be missing, and what was
  unreadable instead of hiding gaps.
- **Private by design**: uploads are stored outside the app tree and served only
  through authorized, user-scoped routes.
- **Locale-aware**: `next-intl` with English and Arabic routes and RTL layout.

## Stack

- Next.js 16 (App Router) + React 19
- Prisma 7 on PostgreSQL (`@prisma/adapter-pg`), client generated to `generated/`
- Better Auth (email/password, sessions, email verification, password reset)
- `@google/genai` for analysis, composition, auditing, and audio transcription
- Vitest 5 for unit/integration/component tests
- Background worker: `tsx workers/document-processing-worker.ts`

## Setup

```sh
npm install          # runs `prisma generate` automatically (postinstall)
cp .env.example .env # then fill in the values
npx prisma migrate deploy   # or: npm run db:migrate in development
npm run dev          # web app on :3000
npm run worker       # background jobs worker (run in a second terminal)
```

### Environment variables (see `lib/env.ts`)

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | ✔ | — | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | ✔ | — | Auth signing secret (≥ 32 chars; `openssl rand -base64 32`) |
| `APP_URL` | | `http://localhost:3000` | Absolute app URL used in emails/auth |
| `GEMINI_API_KEY` | (feature) | `""` | Summarization checks it lazily; missing → clear error |
| `GEMINI_MODEL` | | `gemini-3.8-flash` | Analysis/composition/audit model |
| `GEMINI_TRANSCRIBE_MODEL` | | `gemini-3.5-transcribe` | Audio transcription model |
| `EMAIL_PROVIDER` | | `dev` | `dev` writes `.eml` files to `storage/mail-outbox/` (never claims delivery); `smtp` sends via nodemailer |
| `EMAIL_SMTP_URL` | | — | e.g. `smtps://user:pass@smtp.example.com:465` (required when provider = `smtp`) |
| `EMAIL_FROM` | | `Margins <no-reply@margins.local>` | From header for auth emails |
| `STORAGE_DIR` | | `./storage` | Private file storage root (adapt for object storage in production) |
| `UPLOAD_MAX_SOURCE_BYTES` | | `52428800` (50 MB) | Per-file cap for documents/images/text |
| `UPLOAD_MAX_AUDIO_BYTES` | | `52428800` (50 MB) | Per-file cap for audio |
| `UPLOAD_MAX_TEXT_CHARS` | | `200000` | Cap on pasted text |
| `MAX_UPLOAD_TOTAL_BYTES` | | `104857600` (100 MB) | Cap on one upload's files + text combined |
| `AUDIO_MAX_DURATION_SEC` | | `10800` (3 h) | Cap on lecture recording length |
| `WORKER_POLL_INTERVAL_MS` | | `2000` | Worker claim-loop poll interval |
| `JOB_TIMEOUT_MS` | | `900000` (15 min) | Per-job timeout; provider calls are aborted after it |

### Migrations

Schema lives in `prisma/schema.prisma`; SQL migrations in `prisma/migrations/`.

- Development: `npm run db:migrate` (creates/applies a migration)
- Production/CI: `npm run db:deploy` (`prisma migrate deploy`)
- Fresh clone: `npm install` + `npm run db:deploy` is enough — no manual
  `prisma generate` needed (the `postinstall` script handles it, and
  `generated/` is gitignored).

## Running web + worker in production

- **Web**: `npm run build && npm run start`
- **Worker**: `npm run worker` — the worker runs as a plain tsx process, which
  is why `tsx` and `prisma` ship in `dependencies` (not `devDependencies`): a
  production install (`npm ci --omit=dev`) keeps the worker runnable without a
  compile step. Both processes need the same `DATABASE_URL` and `STORAGE_DIR`
  (`STORAGE_DIR` is resolved to an absolute path in `lib/env.ts`, so web and
  worker always agree on the storage root even if started from different cwd).

## Storage notes

- Files live under `<STORAGE_DIR>/u/<userId>/<key>` — never served statically;
  downloads go through `/api/documents/[documentId]/download` after a session
  and ownership check.
- Keys are validated against path traversal on every access.
- Auth emails in `dev` mode land in `storage/mail-outbox/*.eml`.
- Cleanup: `npm run cleanup:storage` removes unreferenced files (24 h safety
  margin) and aged Gemini Files API copies (48 h); safe to run from cron.

## Testing

```sh
npm test            # everything (vitest)
npm run test:unit   # tests/unit       — env, storage, pipeline, mailer, theme, upload
npm run test:integration   # tests/integration — documents service, queue, database
npm run lint        # eslint (flat config, eslint-config-next)
npm run typecheck   # tsc --noEmit
```

CI (`.github/workflows/ci.yml`) runs prisma validate, lint, typecheck, tests,
and the production build against a PostgreSQL service container.

## Project docs

- `docs/PROJECT_MAP.md` — codebase tour
- `docs/DB_STRUCTURE.md` — database models
- `docs/api_routes.md` — API surface
- `docs/TEST_REPORT.md` — testing overview
- `docs/dev-notes/` — development logs and skill notes (historical)
- `AGENTS.md` — guidance for coding agents working in this repo
