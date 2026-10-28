# Wick — adding content

Wick's content is a registry: enemies, items and depth bands. The core never names a specific enemy or item.

## Add an enemy

1. Add its id to `EnemyKind` in `src/core/types.ts`.
2. Add a `EnemyDef` in `src/content/enemies.ts`: stats (`hp`, `dmg`, `unlock`, `cost`, `points`) and an `act(ctx)` behaviour.
   - `ctx` gives you the run state, the enemy, the player, BFS maps (`toPlayer`, `toPools` in the pour-oil task), noise, `free`, `step`, `bite`, `wander`, `isLit`, `litByLantern`, `radius` and `getFlee`.
   - Use `downhill(...)` on a map to move; use `ctx.wander(enemy, allowed)` for a random legal step.
3. Add a test in `test/rules.test.ts` that proves the behaviour and its unlock depth.
4. Add the enemy to the depth bands where it should appear.
5. Add a debut line in `render.ts`/`rules.ts` if the player needs to learn it.

## Add an item

1. Add its id to `ItemKind` in `src/core/types.ts`.
2. Add an `ItemDef` in `src/content/items.ts` with `apply(ctx)`.
3. Add it to the item weights in `src/content/depths.ts`.
4. Add a test and a pickup colour/label in `main.ts`/`render.ts`.

## Add a depth band

1. Add a `DepthTheme` to `src/content/depths.ts`: `from`, `name`, `loops`, `enemyWeights`, `itemWeights`.
2. The highest `from` at or below the depth wins; weights of 0 suppress a kind.
3. Add a generation test that proves the band is selected and a debut enemy appears.

## Rules

- Do not add enemy behaviour to `core/rules.ts`; the dispatch belongs in the registry.
- Every generated floor must stay connected and every spawn must respect its distance from the start.
- Keep the same seed deterministic. Any new random choice goes through `state.rng`.
- Do not add a new item that bypasses `pickUp`; the registry call is the single effect path.
