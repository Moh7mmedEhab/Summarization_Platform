# skills.md — the design skill and how it is applied here

## What the skill is
`.agents/skills/design-taste-frontend/` — "taste skill", an anti-slop frontend skill.
It works from measured rules distilled from real product screens, not taste opinions.
Key parts used in this project:

- `references/app-screens.md` — the law for dashboards/settings-like screens. The
  sections that drove this repo: quiet chrome and colour only on data (§2), forms
  and settings layout (§8: label column beside the panel, "one save model per
  view", "show what the setting produces"), status pills (§7.6), dark screens (§9),
  honest states (§11).
- `scripts/draw.mjs` — deals a style (`--app --kind … --style accent-ladder`) with a
  seed; the dealt sheet is the source of the tokens, type and composition.
- `scripts/lint.mjs --app app` — source lint gate (banned patterns, em-dash habit).
- `scripts/inspect.mjs --app <url|file> [--out DIR] [--widths 1440,1280,768,390,360]`
  — real-browser measurement + screenshots + rules. Serve static exports over HTTP
  (`python3 -m http.server 9317 -d out`, inspect via `http://localhost:9317/<page>.html`);
  file-path mode does not resolve `/_next/` assets and its numbers are bogus.
- `--allow rule,rule` exists as an escape hatch for a rule you can defend out loud —
  used sparingly; this project needed it zero times in the final state.

## How the theme system was built under the skill's rules
- Colour budget: palettes exist in the same accent-ladder shape — full hue only on
  small marks (pen, nav icon, primary button is near-black in light / white in
  dark), pale tints doing area work. A palette swap changes five tokens; the app's
  composition never changes.
- The skill bans saturated indigo/violet ("AI purple", hue 244–295 at s ≥ 0.42).
  The user asked for lavender/violet, so it ships as dusty lilac (s below the
  detection band) — the hue reads, the slop doesn't. Peach leans pink rather than
  cream (cream backgrounds are a banned tell).
- Verified contrast numerically (WCAG pairs) for every palette in both modes rather
  than eyeballing.
- The inspector sees colour differences between panel fill and page ground, so a
  real geometry warn ("ragged row") may appear only under stronger-tinted palettes;
  treat palette sweeps as part of QA, not just the default palette.

## Practices followed in this repo
- Centralized tokens; no scattered hex (the only literal colours are in the token
  blocks themselves and the test script).
- Computed sample data (`lib/data.ts`): chip counts and word ratios derive from the
  rows; `console.assert` guards the total.
- Plain CSS (no CSS-in-JS, no new dependencies); Next.js App Router + TypeScript.
- Small focused components: shell, auth fragment, summary-note, theme controls,
  theme stamp, theme utils.
- Commits only finished work; `.gitignore` covers node_modules, .next, out, .env,
  uploads, private storage, .taste-skill.
