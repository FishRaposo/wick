# Reference solution

**Root cause.** `enterFloor()` added the new floor's enemies with `s.enemies.push(...)` instead of replacing the list. On a fresh run the list is empty, so floor 1 and every test that loads a single map looked correct. From floor 2 on, the survivors of the previous floor are carried along with their old coordinates, which mean nothing on the new layout. The test that descended a floor and checked enemy ids was removed in the same change.

**How to find it by playtesting.** It only shows after a descent with enemies left alive. Speed-runners see it first. Enemies "inside walls" is the giveaway: nothing in the rules can move an enemy onto a wall tile, so they must have come from somewhere else.

**Fix** (`reference-solution.patch`): assign, don't append: `s.enemies = floor.spawns.map(...)`. The patch restores the regression test.

**Why not filter instead.** Dropping enemies that stand on walls after the fact hides the symptom and keeps the ones that happened to land on open floor.
