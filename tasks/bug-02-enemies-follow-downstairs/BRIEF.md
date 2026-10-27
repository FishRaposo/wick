# Enemies follow the player downstairs

*QA ticket · severity: critical · build: main*

**Summary.** After taking the stairs, some enemies from the previous floor are still on the new one. Some appear inside walls; some are standing in rooms where they block corridors.

**Steps to reproduce**
1. Start a run with `?seed=12`.
2. Walk to the stairs without killing everything on floor 1.
3. On floor 2, walk around.

**Expected.** Floor 2 contains only floor 2's enemies.

**Actual.** Floor 1's survivors are on floor 2 at their old coordinates. In my repro (seed 12, straight to the stairs) that was three of them, all inside rock, where they can't be reached but can still bite if you stand next to the wall. Enemy count grows every floor.

**Frequency.** Every descent where an enemy was left alive.
