# Remediation Report — Build, Uploads, Jobs, Auth

Date: 2026-10-31 · Branch: `main` (14 commits ahead of `origin/main` at report time)

Against the original A–E review checklist, every item is either fixed with tests
or explicitly skipped with a reason. Checks at report time: **typecheck OK,
eslint clean (`--max-warnings 0`), 223 tests passing (20 files), prisma validate
OK, `next build` OK.**

---

## A — Build / deploy hardening

| Item | Status | Notes |
|---|---|---|
| A1 Fresh-clone build | **Fixed** | `postinstall: prisma generate` added; `generated/` verified gitignored. |
| A2 Worker runnable in production | **Fixed** | `prisma` + `tsx` moved to `dependencies`; documented in README (web + worker sections). |
| A3 Vitest config ESM/CJS warning | **Fixed** | `vitest.config.ts` → `vitest.config.mts` (git mv; no `"type": "module"` change). |
| A4 Lint red / unused disables / CI | **Fixed** | ESLint 9 flat config with `eslint-config-next`; lint errors restructured (theme via `useSyncExternalStore` in `lib/theme.ts`, library loading moved to event handlers); `lint` script is `eslint . --max-warnings 0`; GitHub Actions CI (`.github/workflows/ci.yml`) runs prisma validate, lint, typecheck, tests, build on PostgreSQL. |
| A5 README / repo hygiene | **Fixed** | `README.md` (stack, env vars, migrations, web+worker deployment, storage, testing); reference docs → `docs/`, agent scratch files → `docs/dev-notes/`; `AGENTS.md` kept at root. |

## B — Uploads & storage

| Item | Status | Notes |
|---|---|---|
| B6 File I/O inside the create transaction | **Fixed** | `createDocument` uses an explicit `crypto.randomUUID()` id; files are written to storage **before** a short row-only transaction (document + one `createMany` for all assets). Keys are computed once per file (`preparedFiles`) since `userStorageKey` generates a fresh UUID per call. Failures remove already-written files. |
| B7 No aggregate size cap / hardcoded text cap | **Fixed** | `MAX_UPLOAD_TOTAL_BYTES` (default 100 MB): early Content-Length check before `formData()` parsing plus a real-bytes recheck after parse (413 `too_large`). Pasted-text cap is env-driven (`UPLOAD_MAX_TEXT_CHARS`) in the upload route, the JSON create route, and `createDocument` itself (`DomainError too_large`). |
| B8 Storage robustness | **Fixed** | Download route streams via new `Storage.readStream` (`createReadStream`) with `content-length`; `put()` is atomic (temp file in same dir → rename, failure removes the temp); `STORAGE_DIR` resolved to an absolute path once in `lib/env.ts` (web + worker agree on the root; dev mailer uses the resolved path). |
| B9 Audio-only documents misclassified | **Fixed** | `audio` added to the `DocumentKind` enum (migration `20261031181003_document_kind_audio`); `inputTypeOf` made explicit: pdf/docx > images > audio > text; library filter chip, icons, counts, API `kind` filter, en/ar messages updated. |
| B10 Unbounded audio uploads | **Fixed** | `AUDIO_MAX_DURATION_SEC` (default 3 h) enforced **before** any Gemini upload via a header-only probe (`lib/upload/audio.ts`: WAV exact little-endian parsing, M4A `mvhd`, MP3 with ID3v2 skip + CBR/Xing estimate; unprobeable formats → `null`, never a guess) and an exact backstop after transcription (transcript end timing) for formats the probe can't read. |

## C — Jobs & concurrency

| Item | Status | Notes |
|---|---|---|
| C11 Deleting a document mid-run | **Fixed** | `deleteDocument` cancels queued/running jobs first; queue `finish()` uses `updateMany` (no P2025 on vanished documents); `fail()` never throws (vanished-row guard + try/catch). |
| C12 Concurrent summarize race | **Fixed** | Per-row `SELECT … FOR UPDATE` on the physical user table replaced with `pg_advisory_xact_lock(hashtext(userId))`, invoked via `$executeRaw` (Prisma's `$queryRaw` cannot deserialize Postgres `void` columns — P2010). No dependency on the physical table name. |
| C13 Hung jobs / shutdown | **Fixed** | `JOB_TIMEOUT_MS` (default 15 min): per-job `AbortController` threaded through `interactionText` / `transcribeAudio` / `uploadGeminiFile` (`fetchOptions.signal` / `config.abortSignal` / `failOnAbort` wrapper); every `progress()` report awaited and error-swallowed; `fail()` wrapped; second SIGINT/SIGTERM force-exits; graceful (non-throwing) lookups replace `findUniqueOrThrow`; assets over 12 MB go to the Files API instead of being inlined as base64 in every request. |
| C14 Duplicate summaries on retry | **Fixed** | `Summary.jobId` column + index (migration `summary_job_id`); extracted `lib/ai/save-summary.ts` — a retried job re-promotes its own row by `jobId` instead of creating a duplicate current summary (integration-tested). |
| C15 Transcript truncation metadata lost | **Fixed** | `lib/ai/persist-transcripts.ts`: metadata honestly records `truncated: true`, `segmentCount`, `droppedSegments` beyond the 4000-segment cap (`transcriptMetadata()`); `extractedText` keeps the full transcript; persistence merges metadata instead of replacing it. |
| C16 Orphaned files / Gemini copies | **Fixed** | `npm run cleanup:storage` (`scripts/cleanup-storage.mts`; `.mts` because tsx CJS rejects top-level await) removes unreferenced files after a 24 h safety margin (mail-outbox spared) and deletes Gemini Files API copies (recorded in asset metadata as `geminiFile`/`geminiUploadedAt` by the worker) after 48 h. Smoke-tested live: an aged orphan was found and removed. |

## D — Auth audit

| Item | Status | Notes |
|---|---|---|
| D17 Route-level auth checks | **Fixed** | Audit result: every API route handler performs its own session check; `/api/health` is intentionally public (liveness + status). Server pages that previously relied only on the workspace layout now self-check (`requireSession`): composer (`app/[locale]/(workspace)/page.tsx`), library, and profile/security pages — client components moved to `page-client.tsx` siblings with server wrappers. `proxy.ts` comment corrected to state that middleware does **only** locale routing; auth is enforced per page/handler. New `tests/unit/api-401.test.ts` (15 tests) proves every API entry point — documents (list/create/detail/upload/download/summarize), jobs (including DELETE cancel), summaries (GET/PATCH), profile (GET/PATCH/password) — rejects unauthenticated callers with **401**. |

**Skipped / not applicable:**
- Supabase pooler tenant "not found": environment-side issue outside the repo;
  development continues against the local Postgres instance. Not a code change.
- No rate-limit item was in scope (C12 covers the per-user job-limit race only);
  a global rate limiter remains a future hardening item.

## Public API behavior changes

- **Unauthenticated responses changed from 403 to 401** on:
  `GET|PATCH|DELETE /api/documents/:documentId`, `GET /api/documents/:documentId/download`,
  `GET|PATCH /api/summaries/:summaryId`. Authenticated responses are unchanged.
  (Summaries had no DELETE handler — the test list now matches the real surface,
  including `DELETE /api/jobs/:jobId` which cancels a queued job.)
- All other response shapes are unchanged (document list/detail payloads,
  upload responses, download headers including the added `content-length`).

## New environment variables (`lib/env.ts`, `.env.example`, README)

| Variable | Default | Purpose |
|---|---|---|
| `MAX_UPLOAD_TOTAL_BYTES` | `104857600` (100 MB) | Cap on one upload's files + text combined |
| `AUDIO_MAX_DURATION_SEC` | `10800` (3 h) | Cap on lecture-recording length |
| `JOB_TIMEOUT_MS` | `900000` (15 min) | Per-job timeout; provider calls are aborted after it |

## Migrations

- `20261031181003_document_kind_audio` — `DocumentKind` enum gains `audio`.
- `summary_job_id` — `Summary.jobId` column + index for idempotent saves.

Both applied to the local dev database and the test database (`margins_test`).

## Tests added (208 → 223)

- `tests/unit/api-401.test.ts` — 15 handler-level 401 checks (all API entry points).
- `tests/integration/documents-service.test.ts` — storage-before-rows + cleanup on
  failed insert; server-side text-cap enforcement; audio-only classification.
- `tests/integration/queue.test.ts` — save-summary idempotency per job; `finish()`/`fail()`
  on cascade-deleted documents; deleteDocument cancels open jobs.
- `tests/unit/audio-duration.test.ts` — WAV/M4A/MP3 probe + unknown-format null.
- `tests/unit/pipeline-audio.test.ts` — over-limit recording rejected after transcript
  timing (no further Gemini calls); transcribe call-shape updated.
- `tests/unit/persist-transcripts.test.ts` — honest truncation metadata.
- `tests/unit/storage-cleanup.test.ts` — orphan age/reference rules, Gemini aging.
- `tests/unit/storage.test.ts` — atomic put (no temp leftovers), streaming read.
- `tests/unit/env.test.ts` — absolute `STORAGE_DIR` default, `MAX_UPLOAD_TOTAL_BYTES`.
- `tests/unit/gemini-files.test.ts` — updated for the abort-aware `files.get` call shape.

## Files changed (high level)

- Build/config: `package.json`, `package-lock.json`, `eslint.config.mjs`, `vitest.config.mts`, `.github/workflows/ci.yml`, `.env.example`, `next.config.ts` (unchanged, verified).
- Docs: `README.md`, `docs/*` (moved), `docs/dev-notes/*` (moved).
- Uploads/storage: `features/documents/service.ts`, `app/api/documents/upload/route.ts`, `app/api/documents/route.ts`, `lib/storage/storage.ts`, `lib/env.ts`, `lib/email/mailer.ts`, `lib/upload/audio.ts`, `lib/storage/cleanup.ts`, `scripts/cleanup-storage.mts`.
- Jobs/worker/AI: `workers/document-processing-worker.ts`, `lib/jobs/queue.ts`, `lib/ai/pipeline.ts`, `lib/ai/gemini/client.ts`, `lib/ai/save-summary.ts`, `lib/ai/persist-transcripts.ts`.
- Auth/UI: `app/api/documents/[documentId]/route.ts` (+download), `app/api/summaries/[summaryId]/route.ts`, composer/library/security server wrappers + `page-client.tsx` siblings, `components/theme/controls.tsx`, `lib/theme.ts`, `messages/en.json`, `messages/ar.json`, `proxy.ts`.
- Schema: `prisma/schema.prisma` + the two migrations above.
