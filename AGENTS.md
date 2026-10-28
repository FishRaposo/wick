# Agent instructions — Wick

Read the shared contract first: [`../STANDARD.md`](../STANDARD.md). This file is the Wick-specific working procedure.

## Commands

```bash
npm ci
npm run check          # tsc -p tsconfig.test.json
npm run build          # clean + tsc + check-dist
npm start              # build, watch and serve http://localhost:8080
npm test               # node --test "test/**/*.test.ts"
npm run test:coverage
npm run tasks          # fail-before / pass-after task pack
npm run smoke          # Chromium, Firefox and WebKit journeys
npm run a11y           # axe scan of the DOM overlays
npm run package        # dist/wick-web.zip
npm run verify         # everything above
```

Node 24 LTS is required. Runtime dependencies stay at zero; TypeScript, Playwright and axe are dev-only.

## Layout

```
src/core/         rules, generation, FOV, paths, RNG, shared contracts (no DOM)
src/content/      enemies, items and depth bands (registry data and behaviours)
src/platform/     audio, storage, settings
src/presentation/ renderer, HUD, accessible dialogs
src/main.ts       composition root: input, animation, screens, save/continue
test/             node:test suites
tasks/            task pack and verifier
scripts/          build, serve, smoke, a11y, package, release
```

Dependency rule: `core` imports only core; `content` imports core types and helpers; `platform` imports core types and never presentation; `presentation` imports core/content types and receives platform services from `main.ts`; `main.ts` wires everything. `node scripts/check-boundaries.mjs` enforces it.

## Invariants

- `core/rules.ts` is pure: state plus `act()`, no DOM, no timers. Enemy and item behaviour lives in `src/content/`.
- Every generated floor is connected, and the stairs are the farthest reachable tile; the tests sweep 300 seeds × 6 depths.
- The same seed and the same inputs replay the same floors and enemy decisions. The RNG state is saved with the run.
- Walking into a wall is free: no turn, no oil, no enemy move.
- Rendering only animates events; it never decides an outcome.
- Task checks must fail on the starting state and pass on the reference. Do not weaken a check to make a refactor pass.
- For bug tasks, starting + reference must reproduce `main` exactly. The verifier enforces it.

## Content

Read [`docs/CONTENT.md`](docs/CONTENT.md). An enemy is a stats entry plus an `act(ctx)` behaviour; an item is an `apply(ctx)`; a depth band controls loops and weights. Add the registry entry, a test, and the debut note or HUD hint where the player needs it. Do not add an enemy by editing the rules dispatch.

## Task pack

- Checks stay `.mjs` and import the built `dist/` modules; do not rewrite check bodies during a refactor.
- Regenerate patches from a temp copy; never hand-edit hunks. After any source move:
  1. `git apply --check` the existing patch.
  2. If it fails, rebuild the starting state, run `git diff` to regenerate, and re-run `npm run tasks`.
- Do not add new tasks while the module tree is moving.

## Release

Read [`docs/RELEASING.md`](docs/RELEASING.md). Bump `package.json` and `src/version.ts` together, add a dated `CHANGELOG.md` entry, run `npm run verify`, then follow the merge/tag/release/Pages/itch procedure. Public page copy and profile claims are Claude-owned; prepare measured facts, do not rewrite the descriptions.

## Never

- Commit `dist/`, `node_modules/`, `site/`, `coverage/` or `.tmp/`.
- Add a runtime dependency.
- Leave a generated file or a task patch drifting.
- Claim a browser was verified when only Chromium ran.
- Put enemy behaviour back in the rules module.
