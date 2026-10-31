# Testing progress

## Current status

The automated validation available in this repository passes:

- `npm test`: 16 files, 186 tests.
- `npm run typecheck`.
- `npx prisma validate`.
- `npm run build`.
- Design source lint: 0 failures, 0 warnings.

The Vitest command prints a non-blocking config-loader ESM/CommonJS warning.
Detailed scope and limitations are recorded in [`TEST_REPORT.md`](./TEST_REPORT.md).

## Not yet verified

- Browser E2E flows for registration, verification, upload, processing, and
  summary editing.
- Full authenticated workspace visual QA, Arabic RTL layout/accessibility, and
  keyboard/screen-reader acceptance.
- Live Gemini and SMTP integrations.
- Production database migration status, load behavior, and deployment storage.
- Aggregate multipart upload-size policy and audio-duration handling.

Do not treat passing unit/integration/component tests as evidence that these
manual or external checks have been completed.
