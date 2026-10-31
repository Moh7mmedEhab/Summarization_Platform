# Testing Skills, Standards & Methodologies: Margins Platform

## 1. Core Testing Philosophy & Rules of Engagement

The Margins platform is a full-stack, mission-critical AI-powered study platform combining high-concurrency document processing, LLM generation pipelines, multi-tenant relational persistence, strict security controls, and design-system fidelity.

All testing within this repository must adhere to the following absolute mandates:

1. **Zero False Confidence (Empirical Verification Only):**
   - Never mark a test as passed or a component as verified without running the exact test command and confirming a clean exit (`code 0`) and valid assertion logs.
   - No assumptions: if a test suite hasn't been executed against the actual environment or mock harness, its status is strictly `UNTESTED` or `PENDING`.

2. **Hermetic & Non-Destructive Execution:**
   - Tests must never mutate, corrupt, or drop active development/production data.
   - Database tests must run in isolated test schemas, inside rollback transactions, or with unique fixture keys (`test_<timestamp>_<uuid>`).
   - Clean up any temporary files created in `storage/` or disk roots during test runs.

3. **External Service Isolation:**
   - External network dependencies (Google Gemini API, SMTP servers) must have deterministic test harnesses (mocked clients, wire-recordings, or synthetic fixtures).
   - Real API calls to paid services like `@google/genai` are executed only in dedicated live-smoke suites with explicit budget caps.

4. **Mandatory Regression Shield:**
   - Every bug uncovered must immediately be paired with an automated failing test before the fix is applied.
   - The test must pass post-fix and remain permanently in the test suite to prevent regressions.

5. **Continuous Traceability:**
   - Update `testing_progress.md` after every testing milestone. Never delete historical execution logs or lose sight of remaining defects.

---

## 2. Technology Stack & Target Architecture

The testing strategy is tailored directly to the verified project stack:

| Subsystem | Technology | Key Verification Areas |
| :--- | :--- | :--- |
| **Framework & Runtime** | Next.js 16.4.3 (App Router), React 19.3.1, Node 22+, TS 7.0.2 | Server vs Client Components, Route Handlers, SSR/RSC hydration, `proxy.ts` locale rewrites |
| **Database & ORM** | PostgreSQL 18, Prisma 7.10.1, `@prisma/adapter-pg` | Migrations, relations, cascading deletes, raw SQL concurrency (`FOR UPDATE SKIP LOCKED`) |
| **Authentication** | Better Auth 1.7.14 | Session tokens, password hashing, verification tokens, password reset flows, cookie handling |
| **AI Summarization** | `@google/genai` 2.32 (Interactions API), Gemini models | Chunking, token limits, Zod schema validation, repair retry pass, timestamped audio grounding |
| **Async Processing** | Background Worker (`workers/document-processing-worker.ts`), Queue | Job claiming race conditions, heartbeat updates, retry counts, stale job recovery |
| **Storage & Ingestion** | Local private storage (`lib/storage/`), Magic-byte sniffing | Content sniffing vs client MIME spoofing, path traversal (`safePath`), size quotas |
| **Localization & I18n** | `next-intl` 4.14.9 | English (`en`), Arabic (`ar`), RTL layout attributes, missing message keys |
| **Design & Themes** | Vanilla CSS tokens, 7 palettes, light/dark | Theme model sanitization, localStorage sync, WCAG 4.5:1 contrast, SVG diagram safety |

---

## 3. Testing Pyramid & Methodology

```
         /\
        /  \       E2E Testing (Playwright)
       / E2E\      - Full user journeys: Auth -> Upload -> Process -> View -> Save
      /------\
     / Integr \    Integration Testing (Vitest / Supertest / Test DB)
    /  -ation  \   - Route handlers, DB queries, Job queue concurrency, Auth state
   /------------\
  /     Unit     \  Unit Testing (Vitest)
 /    Component   \ - Pure functions, magic-byte sniffing, Zod schemas, UI components
/------------------\
```

### 3.1 Unit Testing
- **Target:** Isolated pure functions, parsers, mathematical calculations, schema validators, sanitizers.
- **Key Modules to Test:**
  - `lib/upload/validate.ts`: `sniff()`, file signature matching (PDF, DOCX, PNG, JPEG, WEBP, MP3, WAV, M4A, OGG, WEBM), text encoding checks, rejecting polyglots and executable headers (`MZ`, `ELF`).
  - `lib/ai/schema.ts`: Zod schema validation for `SourceRef`, `Point`, `Definition`, `ExampleItem`, `Emphasis`, `Chart`, `Diagram`, and `SummaryPayload`. Malformed payload handling and default fallbacks.
  - `lib/ai/text.ts` & `lib/ai/prompts.ts`: Text chunking algorithms, overlap boundaries, prompt interpolation.
  - `lib/ai/reltime.ts`: Timestamp formatting and second-to-clock string conversions.
  - `lib/theme.ts`: `sanitizeTheme()`, `readTheme()`, `setAppearance()`, `setAccent()`.
  - `lib/storage/storage.ts`: `safePath()` rejection of path traversals (e.g. `../../etc/passwd`, `..\..\windows`).
  - `lib/env.ts`: Environment variable parsing and missing required variable failure reporting.

### 3.2 Integration Testing
- **Target:** Multi-unit boundaries, database transactions, job queues, HTTP route handlers.
- **Key Subsystems to Test:**
  - **Database Layer (`lib/db/prisma.ts`):**
    - Cascade deletion: Deleting a `User` must cascade-delete `UserPreference`, `Document`, `Summary`, `ProcessingJob`, `Session`, `Account`.
    - Deleting a `Document` must cascade-delete associated `SourceAsset`, `Summary`, `ProcessingJob`.
  - **Queue Engine (`lib/jobs/queue.ts`):**
    - Concurrent worker claims using `claimJob()`: Verify atomic row locks (`SKIP LOCKED`) guarantee no two workers pick up the same job.
    - Stale job reclamation: Verify a job with expired heartbeat (`> 5 min`) is reclaimed if attempts `< maxAttempts`.
    - Max attempts breach: Verify job is marked `failed` when `attempts >= maxAttempts`.
  - **API Route Handlers (`app/api/...`):**
    - `POST /api/documents/upload`: Authenticated vs unauthenticated; valid files vs oversized files vs invalid MIME types.
    - `GET /api/documents/[documentId]`: IDOR verification (User A cannot access User B's documents).
    - `GET /api/jobs/[jobId]`: Status polling, progress tracking, access control.
    - `GET /api/summaries/[summaryId]`: Full payload retrieval, access control.
    - `PATCH /api/profile`: Language and theme preference persistence to DB.
    - `POST /api/profile/password`: Credential updating and verification.
  - **Mailer Subsystem (`lib/email/mailer.ts`):**
    - Dev provider writes correct `.eml` and text logs to `storage/outbox/`.
    - SMTP provider connection and delivery error handling.

### 3.3 Component & Design Testing
- **Target:** React 19 Client Components, UI state, accessibility, SVG generation.
- **Key Components to Test:**
  - `components/summary/viewer.tsx`: Renders summary cards, key points, definitions, exam material warning badges.
  - `components/summary/chart-figure.tsx` & `components/summary/diagram-figure.tsx`: Renders valid SVG without HTML injection vulnerabilities.
  - `components/theme/controls.tsx` & `components/theme/stamp.tsx`: Keyboard navigation, `aria-pressed` states, interactive palette chips.
  - `components/auth/*`: Form validation, error messaging, submission state.
  - Layout & RTL: Testing with `dir="rtl"` and Arabic typography styles.

### 3.4 End-to-End (E2E) Testing
- **Target:** Complete end-to-end user workflows using headless browser automation.
- **Core Critical Paths:**
  1. **Authentication Flow:** User signup -> verification email delivery in `storage/outbox/` -> token verification -> authenticated dashboard redirect -> logout -> password reset flow.
  2. **Ingestion & Summarization Flow:** Login -> upload multi-page PDF or text -> trigger summarization -> job claimed by worker -> AI mock pipeline returns valid structured summary -> UI polls to completion -> summary displays with points, definitions, exam pills, and references.
  3. **Library Management:** View saved summaries -> search/filter -> verify retention percentages and metadata.
  4. **Settings & Themes:** Change theme to dark/mint -> reload page -> verify theme persists without flash of unstyled content (FOUC).
  5. **Internationalization:** Switch language between English and Arabic -> verify URL route changes (`/en/...` <-> `/ar/...`), text translates, and layout flips to RTL.

---

## 4. Edge Cases & Negative Testing Matrix

| Area | Edge Case / Negative Scenario | Expected Behavior |
| :--- | :--- | :--- |
| **File Sniffing** | Renamed binary executable `malware.exe` -> `lecture.pdf` | `UploadError: Invalid file format` (Rejected by magic-bytes) |
| **File Sniffing** | 0-byte empty file uploaded | Rejected with `UploadError: Empty file` |
| **File Sniffing** | Polyglot file (valid GIF header prepended to PHP/HTML code) | Sniffed correctly or rejected if MIME not in allowed whitelist |
| **Path Traversal** | Key containing `../../storage/secret.txt` or null-byte `%00` | Rejected with `Unsafe storage key` error |
| **Job Queue** | 5 workers concurrently polling an empty queue | All return `null`, 0 deadlocks, 0 crashes |
| **Job Queue** | Worker crashes mid-processing without sending heartbeat | Job reclaimed after 5 minutes by next worker; attempt count incremented |
| **AI Contract** | Gemini returns markdown text instead of JSON payload | Schema validation fails; repair prompt triggered; if fails again, job marked `failed` with clear error |
| **AI Contract** | Gemini returns hallucinated negative source page numbers (`page: -5`) | Zod coerce/validation catches and rejects/corrects |
| **Access Control** | Authenticated User A queries `/api/documents/<User_B_docId>` | Returns `404 Not Found` or `403 Forbidden` (Zero data leak) |
| **Auth** | Password reset token used twice or after 3600 seconds | Returns token expired/invalid; rejected |
| **I18n** | Unsupported locale requested (e.g. `/fr/summarize`) | Redirects to default locale (`/en/summarize`) via `proxy.ts` |
| **Database** | Database connection dropped during job status update | Worker handles error gracefully, logs stack trace, doesn't exit uncleanly |

---

## 5. Tooling, Environment & Execution Standards

### 5.1 Test Framework Configuration
- **Test Runner:** **Vitest** (Fast ESM native, TypeScript out of the box, Jest-compatible API, flawless Vite/Node pipeline).
- **Environment:**
  - `node` for pure functions, server-side APIs, database integration, worker scripts.
  - `jsdom` (or `happy-dom`) + `@testing-library/react` for UI components.
- **Path Resolution:** Matches `tsconfig.json` paths (`@/*` -> `./*`).

### 5.2 Environment Variables for Testing
Tests must execute with dedicated test environment variables:
```bash
NODE_ENV=test
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/margins_test
BETTER_AUTH_SECRET=test_secret_32_characters_minimum_string_for_testing_purposes
APP_URL=http://localhost:3000
EMAIL_PROVIDER=dev
STORAGE_DIR=./storage/test_sandbox
GEMINI_API_KEY=test_mock_gemini_key
```

### 5.3 Execution Commands Standard
```bash
npm run test           # Run all unit and integration tests
npm run test:unit      # Run fast isolated unit tests
npm run test:integration # Run integration tests against test DB/mocks
npm run test:coverage  # Generate coverage reports
npm run test:e2e       # Run Playwright end-to-end tests
```

---

## 6. Debugging & Root Cause Analysis (RCA) Playbook

When a test fails or a defect is detected:

1. **Capture Diagnostic Artifacts:**
   - Record exact command run, stdout/stderr, stack trace, and input fixtures.
2. **Isolate the Root Cause:**
   - Dissect the failure into: (a) Input issue, (b) Contract mismatch, (c) Async timing/race, (d) Unhandled edge case, or (e) Environment/DB variance.
3. **Write Minimal Reproduction:**
   - Create a minimal, self-contained failing test case verifying the bug.
4. **Implement Surgical Fix:**
   - Apply the code fix without breaking unrelated behaviors or bloating scope.
5. **Verify & Green-light:**
   - Run the reproduction test to verify it passes.
   - Run the entire test suite to ensure zero regressions (`npm run typecheck` + `npm run test`).
6. **Log in `testing_progress.md`:**
   - Record bug ID, severity, description, reproduction test file, fix applied, and verification status.

---

## 7. Progress Tracking Protocol (`testing_progress.md`)

`testing_progress.md` is the living, single source of truth for all testing activities.
Every testing progress update **MUST** include:
1. Current Testing Stage and Overall Progress Metrics.
2. Complete inventory of tests executed with real results (Pass/Fail count, execution duration).
3. Bug tracker with severity classifications (`P0: Critical/Blocker`, `P1: Major`, `P2: Moderate`, `P3: Minor/Cosmetic`).
4. Fixes applied and their concrete verification status.
5. Pending tests and remaining issues.
6. The exact next objective.
7. **FINAL TESTING GOAL** section at the very end with clear, actionable prompt instructions for the subsequent run.

