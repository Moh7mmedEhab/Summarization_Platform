# HTTP API routes

Application routes are implemented under [`app/api/`](./app/api/). Except for
`GET /api/health`, routes require a Better Auth session and scope data access to
the signed-in user. Authentication endpoints are provided by the Better Auth
catch-all at `/api/auth/[...all]`; use Better Auth's client/API contract for
registration, sign-in/out, email verification, and password reset.

Successful JSON responses use `{ "ok": true, ... }`. Errors use
`{ "ok": false, "error": { "code": "...", "message": "..." } }`. Validation
errors return 400; ownership misses return 404; unauthenticated requests return
401; unexpected server errors return a generic 500 response.

## Routes

| Method and path | Access | Behavior |
|---|---|---|
| `GET /api/health` | Public | Reports database reachability, whether Gemini is configured, the selected email provider, and whether the caller has a session. |
| `GET /api/documents` | Session | Paginated, user-scoped library. Query parameters: `q` (up to 200 chars), `kind` (`all`, `text`, `pdf`, `docx`, `image_set`), `status` (`all`, `summarized`, `draft`, `processing`, `failed`), `sort` (`recent`, `oldest`, `title`), and positive integer `page`. Page size defaults to 8 in the service. |
| `POST /api/documents` | Session | Creates a text document. JSON: required `title` (1–300 chars), required `text` (1–200,000 chars), optional `description` (up to 2,000 chars). Returns `documentId` with 201. |
| `POST /api/documents/upload` | Session | Multipart upload with optional `title`, `description`, `text`, and up to 12 `files`. Server-sniffs supported text, PDF, DOCX, image, and audio formats. Per-file size defaults to 50 MB (source and audio limits are separately configurable); pasted text is limited to 200,000 chars. Returns `documentId`, accepted count, audio indicator, and rejected-file reasons with 201 when at least one source is accepted. |
| `GET /api/documents/:documentId` | Owner | Returns document metadata, asset metadata, current summary, and related job status. |
| `PATCH /api/documents/:documentId` | Owner | Updates optional `title` (1–300 chars) and/or `description` (up to 2,000 chars). |
| `DELETE /api/documents/:documentId` | Owner | Deletes the document and its related records and attempts to remove private stored assets. |
| `GET /api/documents/:documentId/download?asset=:assetId` | Owner | Downloads one source asset; pasted text is returned as a `.txt` attachment. |
| `POST /api/documents/:documentId/summarize` | Owner | Queues a summary job. JSON fields: `language` (`en` or `ar`, default `en`) and `style` (`comprehensive`, `key_points`, `paragraph`, or `exam_prep`, default `comprehensive`). Returns `jobId` with 202. |
| `GET /api/jobs/:jobId` | Owner | Returns job status, progress, stage, error, and attempt count. |
| `DELETE /api/jobs/:jobId` | Owner | Cancels a queued job only. Returns 404 if it is missing, owned by another user, or no longer queued. |
| `GET /api/summaries/:summaryId` | Owner | Returns the summary and its model, prompt version, counts, and timestamps. |
| `PATCH /api/summaries/:summaryId` | Owner | Replaces `content` after validating it against the summary schema; recalculates and returns `summaryWordCount`. |
| `GET /api/profile` | Session | Returns user identity, preferences, creation date, and document/current-summary counts. Creates default preferences on first read. |
| `PATCH /api/profile` | Session | Strict JSON body accepts optional `name`, `language` (`en`/`ar`), `appearanceMode` (`light`/`dark`), and `accentPalette` (`rose`, `lavender`, `peach`, `berry`, `mint`, `sky`, `plum`). Unknown fields are rejected. |
| `POST /api/profile/password` | Session | Changes password using `currentPassword` and `newPassword` (8–128 chars); revokes other sessions. |

## Operational notes

- Configure `DATABASE_URL`, `BETTER_AUTH_SECRET`, and `APP_URL` for the
  application. `GEMINI_API_KEY` enables AI processing; `EMAIL_PROVIDER=smtp`
  selects SMTP, otherwise the development mailer is used.
- The upload route limits file count and each file, but does not impose an
  aggregate multipart request-size limit. The hosting platform or reverse proxy
  should also enforce a request-body limit.
- Audio is uploaded to Gemini's Files API for transcription. The application
  does not currently reject recordings by duration before the provider call.
- See [`lib/api/respond.ts`](./lib/api/respond.ts) for error mapping and the route
  handlers under [`app/api/`](./app/api/) for authoritative schemas.
