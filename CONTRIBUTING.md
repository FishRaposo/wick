# Contributing to Wick

Thanks for taking a look. This is a small, dependency-free browser game; the bar is a clean clone, a clear change and a check that would fail if the change broke.

## Setup

Node 24 LTS.

```bash
git clone https://github.com/FishRaposo/wick.git
cd wick
npm ci
npm start            # http://localhost:8080
```

`npm start` builds `dist/` and watches the source. The game has zero runtime dependencies; TypeScript, Playwright and axe are dev-only.

## Before you open a PR

```bash
npm run check        # typecheck source and tests
npm test             # unit suite
npm run tasks        # every task check fails before and passes after
npx playwright-core install chromium firefox webkit   # once, for the browser journeys
npm run verify       # everything, including smoke and accessibility
```

If you changed content, add a test and run the content guide. If you changed a task, regenerate both patches and run the task pack; do not hand-edit patch hunks.

## Code

- Keep `core` free of DOM and timers.
- Add enemies and items in `src/content/`, not in `core/rules.ts`.
- Pass time into pure code; never read a clock inside it.
- Put tunables in `core/config.ts`, not in the middle of a rule.
- Rendering reads events and state; it does not decide outcomes.
- Prefer a small deterministic test over a screenshot.

## Commits and releases

Small, scoped commits with an imperative subject. Releases follow [`docs/RELEASING.md`](docs/RELEASING.md); maintainers handle tags and the itch upload.

## Reporting

Use the issue templates. For a security concern, see [SECURITY.md](SECURITY.md).
