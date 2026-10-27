# Reference solution

**Root cause.** Hearing was changed from a walking-distance test to a straight-line one, "cheaper than a pathfind every turn". Straight-line distance ignores walls, so any hound within 5 tiles as the crow flies hears footsteps, even with 20 steps of corridor between them. The unit test that pinned the rule ("a hound does not hear through solid rock") was removed in the same change.

**How to find it by playtesting.** The report's last sentence is the diagnosis: "close on the map even though they're far away to actually walk to". Sneak along a corridor that runs beside a hound room on the far side of a wall and watch for the "!".

**Fix** (`reference-solution.patch`): build one distance map from the noise each turn (BFS over walkable tiles, the same function the AI already uses) and test each hound against it. One BFS per turn on a 40×21 grid costs microseconds, so the optimisation saved nothing measurable. The patch also restores the regression test.

**Rejected alternative.** Line-of-sight hearing (the noise reaches tiles the noise source can see) fixes this case but makes hounds deaf around corners, which breaks the other half of the design: sound should carry down a winding corridor.
