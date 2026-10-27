# Reference solution

`reference-solution.patch` touches five places.

1. **Tuning** (`config.js`): a `POUR` block with the four design numbers.
2. **Light** (`rules.js`): the state gains `pools` and a separate `lanternView`. Each turn the lantern's FOV goes into `lanternView`, each pool computes its own FOV, and `visible` is the union. `isLit()` now asks two questions: is the tile in the lantern's circle *and* the lantern's view, or in a pool's circle *and* that pool's view. Keeping the views separate matters: a tile the lantern can't see but a pool can isn't lit by the lantern.
3. **The action** (`rules.js → act`): refusals return `false` before anything changes, like walking into a wall. Pools tick down at the start of `endTurn`, before vision is recomputed, so a pool's last turn and its going out land on the turns the spec says.
4. **AI** (`rules.js`):
   - **Moths** get a second distance map, to all pools, and prefer it when it's shorter than the way to a burning lantern.
   - **Shades** flee only the lights that are actually burning them, and their idle wandering refuses lit-core tiles.
5. **Feedback** (`render.js`, `main.js`): a per-tile brightness that takes the brighter of lantern and pools, the fire and glow, the HUD hint, the title row, the keys and pad button, and sounds and floaters for pour and refuse.

**What playtesting the first version caught.** The first implementation made shades flee a single map built from *all* light sources. A shade beside a pool, with the player far away, fled toward the point farthest from both lights. That was back past the pool, so it ended up stuck in the fire. Fleeing only the lights that burn it fixed that. Then the shade was found wandering back into the pool on its idle turns, which the lantern never exposed (the lantern is never where an idle shade is). The check's shade scenario exists because of these two.

**Rejected alternatives.**
- **Pools as light-emitting items in `items`.** Items are picked up when stepped on, and a fire shouldn't be.
- **One combined FOV from a "virtual" light source.** It can't answer which light a tile is lit by, which the shade logic needs.
