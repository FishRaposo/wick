# Acceptance criteria

## Input sequence (by hand)

1. With plenty of oil, press X. Walk 8 tiles away.
2. Wait until the pool goes out (25 turns after pouring).
3. Drain the lantern to 15 oil and press X; then pour, and press X again on the same tile.
4. Pour next to a shade.
5. Pour a few tiles from a moth and walk away.

## Expected visual outcome

- Step 1: a small fire on the floor with a warm glow; the floor around it stays lit as you walk away. Oil drops by 15.
- Step 2: the fire shrinks over its last turns and goes out; that area goes back to remembered-dark.
- Step 3: both refusals show their reason above the player; nothing else happens (enemies don't move, oil doesn't change).
- Step 4: the shade backs out of the fire's light and doesn't drift back in.
- Step 5: the moth goes to the fire and circles it.

## Verifiable state (Node)

| # | Setup | Input | Expected |
|---|---|---|---|
| 1 | player (10,10), oil 40 | pour, then 8 steps east | pour returns true; oil 25; (10,10) and (9,11) visible; `isLit(10,10)` |
| 2 | continuing | 20 waits (28 turns since pouring) | (10,10) not visible |
| 3 | oil 15 | pour | returns false; oil 15; turn 0 |
| 3b | oil 60, poured once | pour on the same tile | returns false; oil 45 |
| 4 | shade (5,10); pour at (6,10); then lantern dry and player 30 tiles away | 4 waits | shade not within the pool's core (distance² > 2) |
| 5 | moth (20,10); pour at (17,10); player moves to (33,10) | 6 waits | moth within 3 steps of the pool |

Automated: `node tasks/verify.mjs feat-01-pour-oil`

## Must not change

- Lantern rules: oil burn rate, light radius, flasks.
- All existing unit tests stay green.
