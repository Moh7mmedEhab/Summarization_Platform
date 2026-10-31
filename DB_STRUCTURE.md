# Database structure

The application uses PostgreSQL through Prisma 7 and
[`@prisma/adapter-pg`](./lib/db/prisma.ts). The authoritative schema is
[`prisma/schema.prisma`](./prisma/schema.prisma); Prisma generates the TypeScript
client into `generated/prisma`.

Application tables use lowercase singular names via `@@map`. Better Auth owns the
authentication records; application records are user-scoped.

## Models

| Model / table | Purpose and important fields |
|---|---|
| `User` / `user` | Better Auth identity: unique email, name, verification flag, image, timestamps. Owns sessions, accounts, preferences, documents, summaries, and jobs. |
| `Session` / `session` | Auth session token, expiry, user, optional IP address and user agent. Indexed by user. |
| `Account` / `account` | Better Auth provider credentials and token metadata. Indexed by user; sensitive token fields are nullable. |
| `Verification` / `verification` | Verification/reset token records with unique value, identifier, expiry, and timestamps. |
| `UserPreference` / `user_preference` | One row per user: language, appearance mode, accent palette, timestamps. Created lazily when profile/preferences are read. |
| `Document` / `document` | User-owned study item: title, description, input type, status, timestamps. Indexed by `(userId, createdAt)` and `(userId, status)`. |
| `SourceAsset` / `source_asset` | Ordered source item for a document: type, filename, MIME type, size, private storage key, optional extracted text and JSON metadata. Indexed by `(documentId, position)`. |
| `Summary` / `summary` | User- and document-owned structured summary JSON, language/style, model and prompt version, coverage metadata, nullable source/summary word counts, current flag, timestamps. Indexed by `(documentId, current)` and `(userId, createdAt)`. |
| `ProcessingJob` / `processing_job` | User/document-owned queue item: type, state, stage, progress, attempts, retry limit, payload/error, unique nullable mutex, claim/start/heartbeat/completion times. Indexed by `(status, createdAt)` and `userId`. |

## Enums

- `DocumentKind`: `text`, `pdf`, `docx`, `image_set`.
- `DocumentStatus`: `draft`, `processing`, `summarized`, `failed`.
- `SourceKind`: `text`, `pdf`, `docx`, `image`, `audio`.
- `SummaryStyle`: `comprehensive`, `key_points`, `paragraph`, `exam_prep`.
- `JobStatus`: `queued`, `running`, `succeeded`, `failed`, `canceled`.

## Ownership and lifecycle

- User deletion cascades through preferences, documents, summaries, and jobs.
- Document deletion cascades through its source assets, summaries, and jobs.
- Foreign keys enforce these relationships; API/service queries additionally scope
  reads and mutations by the authenticated `userId`.
- A unique nullable `ProcessingJob.mutex` supports duplicate-open-job prevention.
  Queue admission and queued cancellation use conditional/transactional updates;
  open-job limits are enforced by the document service.
- Binary source bytes are stored outside PostgreSQL. `SourceAsset.storageKey`
  points into the private storage abstraction; text and structured metadata may
  be stored in PostgreSQL.
- Summary `content` and `coverageMetadata` are JSON. `sourceWordCount` is nullable
  because the current pipeline cannot compute an exact count for all binary
  sources; `summaryWordCount` is recalculated when a summary is edited.

## Schema verification

The recorded validation command is `npx prisma validate`. This validates schema
syntax and configuration; it is not a substitute for checking migration status
against the production database before deployment.
