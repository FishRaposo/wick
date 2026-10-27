# Task pack

Three self-contained tasks built on Wick, in the format used for evaluating AI agents on game development: two bugs planted in working code and one feature request.

| Task | Kind | Brief voice | Systems involved |
|---|---|---|---|
| [bug-01 · Hounds hear through walls](bug-01-hounds-hear-through-walls/BRIEF.md) | bug | player report | enemy AI, noise propagation, pathfinding |
| [bug-02 · Enemies follow the player downstairs](bug-02-enemies-follow-downstairs/BRIEF.md) | bug | QA ticket | floor transitions, run state |
| [feat-01 · Pour oil](feat-01-pour-oil/BRIEF.md) | feature | design spec | actions, field of view and lighting, two enemy AIs, rendering, input, audio |

## What's in each task

| File | Purpose |
|---|---|
| `BRIEF.md` | The request as it would arrive. Describes symptoms or goals, never the cause or the code. |
| `CRITERIA.md` | Acceptance criteria: the design rule involved, an input sequence, the expected visual outcome, the verifiable game state, and what must not change. |
| `starting-state.patch` | Bugs only: applied to `main`, it produces the broken game the task starts from, including the test coverage it shipped with. |
| `reference-solution.patch` | The fix or the feature. Bug fixes restore the regression test that the bad change removed. |
| `REFERENCE.md` | Root cause or design of the change, how to find it by playtesting, and rejected alternatives. |
| `check.mjs` | The criteria as an automated check. |

## Verifying the pack

```bash
npm run tasks
```

For every task, `tasks/verify.mjs` copies the game and its tests to a temp folder and applies the starting state. It then requires three things: the check **fails** there, the check **passes** once the reference solution is applied, and the **whole unit suite is green** on the solved copy. Wick's rules are DOM-free modules, so the checks run in Node against the same code the browser runs, each in a fresh process.

```
ok    bug-01-hounds-hear-through-walls bug      starting state: fail  ·  solution: pass  ·  unit tests after: green
ok    bug-02-enemies-follow-downstairs bug      starting state: fail  ·  solution: pass  ·  unit tests after: green
ok    feat-01-pour-oil               feature  starting state: fail  ·  solution: pass  ·  unit tests after: green
```

## Playing a broken build

```bash
git apply tasks/bug-01-hounds-hear-through-walls/starting-state.patch
npm start            # floor 3+, sneak past a hound behind a wall
git apply -R tasks/bug-01-hounds-hear-through-walls/starting-state.patch
```
