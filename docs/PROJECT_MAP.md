# Margins project map

Margins is a Next.js study platform with verified-email authentication, private
document storage, a PostgreSQL-backed processing queue, and Gemini-powered
summaries. The application supports English and Arabic.

## Application

- [`app/[locale]/`](./app/%5Blocale%5D/) — localized login, registration,
  verification, reset, library, summary, preferences, and profile pages.
- [`app/api/`](./app/api/) — Better Auth handler and application JSON/file API;
  see [`api_routes.md`](./api_routes.md).
- [`components/`](./components/) — shared workspace, summary, chart, diagram, and
  account UI.
- [`messages/`](./messages/) — English and Arabic interface strings.

## Server-side features

- [`features/documents/service.ts`](./features/documents/service.ts) — owned
  document operations, upload persistence, queue admission, and cleanup.
- [`lib/auth/`](./lib/auth/) — Better Auth configuration and session access.
- [`lib/db/`](./lib/db/) — Prisma client and PostgreSQL access.
- [`lib/storage/storage.ts`](./lib/storage/storage.ts) — private local filesystem
  storage abstraction. Configure a persistent private volume or replace the
  adapter for production deployments that do not provide persistent local disks.
- [`lib/upload/validate.ts`](./lib/upload/validate.ts) — server-side signature
  checks and supported source classifications.
- [`lib/ai/gemini/client.ts`](./lib/ai/gemini/client.ts) — Gemini Interactions
  and Files API client, including audio upload and timestamped transcription.
- [`lib/ai/pipeline.ts`](./lib/ai/pipeline.ts) — asset analysis, composition,
  source references, word counts, and coverage-audit metadata.
- [`workers/document-processing-worker.ts`](./workers/document-processing-worker.ts)
  — separate worker process; start it with `npm run worker`.

## Data and verification

- [`prisma/schema.prisma`](./prisma/schema.prisma) — PostgreSQL models and
  relations; see [`DB_STRUCTURE.md`](./DB_STRUCTURE.md).
- [`tests/`](./tests/) — unit, integration, and component tests.
- [`TEST_REPORT.md`](./TEST_REPORT.md) — latest recorded validation and scope.
- [`REVISION_REPORT.md`](./REVISION_REPORT.md) — fixes, verified outcomes, and
  remaining production-readiness gaps.

## Common commands

```sh
npm run typecheck
npm test
npx prisma validate
npm run build
npm run worker
```

Email uses the development outbox by default. Configure SMTP for real delivery;
configure `GEMINI_API_KEY` to enable live summarization and transcription. See
`lib/env.ts` for supported environment variables and defaults.
