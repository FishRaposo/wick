# Acceptance criteria

## Input sequence (by hand)

1. `?seed=12`. Leave enemies alive on floor 1 and take the stairs.
2. On floor 2, note every enemy you see and whether any stands inside a wall.

## Expected visual outcome

- No enemy drawn inside rock, ever.
- Enemy numbers per floor stay in the range the floor generator produces (see `enemyBudget` in `src/gen.js`).

## Verifiable state (Node)

For seeds 12, 77 and 2024: record the ids of floor 1's enemies, step onto the stairs, then on floor 2:

| Check | Expected |
|---|---|
| living enemies whose id existed on floor 1 | none |
| enemies on wall tiles | none |

Automated: `node tasks/verify.mjs bug-02-enemies-follow-downstairs`

## Must not change

- The new floor's own spawns, items and start position.
- Loading a hand-written map with `loadMap` (tests and the harness use it).
