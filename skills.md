# Design and testing notes

The project includes the local design skill at
`.agents/skills/design-taste-frontend/`. It was used for the visual design system
and remains useful for changes to workspace, dashboard, settings, and other
application screens.

## Design workflow

- Run the source lint with
  `node .agents/skills/design-taste-frontend/scripts/lint.mjs --app app`.
- For visual inspection, build and serve the app, then use the skill's browser
  inspector across desktop, tablet, and narrow mobile widths and both themes.
- Review English and Arabic layouts separately; a source lint is not a substitute
  for browser-level RTL or accessibility checks.

## Engineering workflow

- `npm run typecheck` — TypeScript check.
- `npm test` — unit, integration, and component suites.
- `npx prisma validate` — schema/configuration validation.
- `npm run build` — production build.
- `npm run worker` — start the separate document worker in a configured
  environment.

Current results and outstanding QA are tracked in
[`TEST_REPORT.md`](./TEST_REPORT.md) and
[`testing_progress.md`](./testing_progress.md). Do not rely on older notes that
describe authentication, storage, AI processing, audio uploads, or server-side
theme persistence as unimplemented.
