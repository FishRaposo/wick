# Acceptance criteria

## Design rule (from `docs/DESIGN.md`)

Sound travels along the dungeon, not through it. A footstep carries 5 steps and an attack 7, counted in walking steps along open floor.

## Input sequence (by hand)

1. Reach floor 3 or deeper, where hounds appear.
2. Find a hound on the other side of a thick wall: close in a straight line, far to walk to.
3. Take one step. Then do the same with nothing between you and the hound, about 4 tiles away.

## Expected visual outcome

- Behind the wall: the hound shows no red "!" and doesn't start moving toward you.
- In the open: the "!" appears and the hound comes to where you stepped.

## Verifiable state (Node, `src/rules.js`)

| Scenario | Setup (`loadMap`) | Input | Expected |
|---|---|---|---|
| Through rock | player (6,10), hound (10,10), wall on column 8 from row 1 to row 18 | `act(move 0,-1)` | `hound.target === null` |
| Open floor | player (6,10), hound (10,10), no wall | `act(move 0,-1)` | `hound.target` set to (6,9) |

Automated: `node tasks/verify.mjs bug-01-hounds-hear-through-walls`

## Must not change

- Noise ranges (move 5, attack 7) and waiting being silent.
- What a hound does once it hears something (walks to the sound, then sniffs around).
