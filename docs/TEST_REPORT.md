# QA and security test report

## Latest recorded validation

| Command | Result |
|---|---|
| `npm test` | **PASS** — 16 test files, 186 tests |
| `npm run typecheck` | **PASS** — `tsc --noEmit` |
| `npx prisma validate` | **PASS** |
| `npm run build` | **PASS** — Next.js 16.4.3 production build |
| `node .agents/skills/design-taste-frontend/scripts/lint.mjs --app app` | **PASS** — 0 failures, 0 warnings |

The Vitest run prints a non-blocking Vite config-loader warning: the TypeScript
config uses ESM syntax while loaded as CommonJS by the native loader. Tests still
complete successfully.

## Test areas

- Unit: auth email templates, environment parsing, Gemini Files API polling,
  summary schema/pipeline, audio citations and coverage metadata, relative time,
  storage, theme, and upload validation.
- Integration: database constraints, processing queue, and document service
  ownership/job-limit behavior.
- Component: theme controls and SVG charts/diagrams.

The full run covered 16 files and 186 tests. See [`tests/`](./tests/) for the
current test inventory. The older per-file counts and claims in prior report
versions were inconsistent with the current suite and are intentionally not
repeated here.

## Security scope and limitations

The security-review task found one medium-severity verification-email HTML
injection issue, which was fixed and regression-tested. This report does not
represent a full security audit or penetration test. Automated tests cover
selected ownership, upload signature, storage-path, email-template, and safe
rendering behavior.

Not executed: browser E2E journeys, live Gemini API calls, live SMTP delivery,
production migration-status checks, load testing, or comprehensive authenticated
workspace/RTL/accessibility inspection. Per-file upload limits are in place, but
there is no aggregate multipart request-size limit; see
[`REVISION_REPORT.md`](./REVISION_REPORT.md).
