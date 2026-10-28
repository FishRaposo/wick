# Wick — architecture

## What the game is

A turn-based roguelike. Every floor is generated from a seed; oil is both the clock and the light radius. Three base enemies each read the light differently, and a fourth lurker waits in the dark. Enemies, items and depth bands come from a content registry.

## Modules

| Module | Responsibility | DOM? |
|---|---|---|
| `src/core/types.ts` | Run, enemy, item, event, depth and content contracts | no |
| `src/core/config.ts` | Tunables: map size, oil, noise, light radius, lurker/resin constants | no |
| `src/core/rng.ts` | Seedable PRNG with a serializable `state` | no |
| `src/core/grid.ts` | Indexing, bounds, walkability and the text-map parser | no |
| `src/core/fov.ts` | Recursive shadowcasting | no |
| `src/core/path.ts` | BFS distance maps, flee maps, downhill steps | no |
| `src/core/gen.ts` | Floor generation, theme selection, item/enemy placement | no |
| `src/core/rules.ts` | Run state, turns, pickups, combat, content dispatch | no |
| `src/content/enemies.ts` | Moth, shade, hound and lurker behaviours | no |
| `src/content/items.ts` | Oil, bandage and resin effects | no |
| `src/content/depths.ts` | Cellar and Deep Cellar bands | no |
| `src/content/index.ts` | Assembles `CONTENT` | no |
| `src/platform/audio.ts` | Synthesized WebAudio and volume/mute | yes |
| `src/platform/storage.ts` | Guarded best score, run save and validation | yes |
| `src/platform/settings.ts` | Guarded settings with reduced-motion default | yes |
| `src/presentation/render.ts` | World, HUD, log, title and death screens | yes |
| `src/presentation/menus.ts` | Accessible pause/settings dialogs and announcements | yes |
| `src/main.ts` | Composition root: input, screens, animation, save/continue | yes |

Dependency rule, enforced by `scripts/check-boundaries.mjs`:

- `core` imports only core.
- `content` imports core types and pure helpers, and implements the registries.
- `platform` imports core types; never presentation.
- `presentation` imports core/content types and receives platform services from `main.ts`.
- `main.ts` is the only wiring point.

## Data flow

Input → `main.ts` → `rules.act(state, action)` → state changes plus `state.events` → `main.ts` groups events into animation and sound → `render.ts` draws the view. At rest, the view is the rules state. `rules.enemiesAct` builds an `EnemyContext` (distance maps, noise, free-tile test, step/bite/wander helpers, light tests) and calls `content.enemies[kind].act(ctx)`. Pickups call `content.items[kind].apply(ctx)`.

## Generation and theme bands

- Rooms are placed by rejection sampling, joined left to right with L-shaped corridors, plus loops from the active depth band.
- The stairs are the reachable tile farthest from the start by walking distance.
- `content/depths.ts` selects the highest band whose `from` is at or below the depth. The band sets loops, enemy weights and item weights.
- A newly unlocked enemy always appears on its debut floor.

## Determinism

- The PRNG has a numeric `state`, saved with the run; resuming continues the exact sequence.
- Same seed + same inputs = same floors and enemy decisions.
- `rules.act` is pure apart from the state it is given; there is no clock or DOM in core.

## Save and settings

- `wick.save.v1` stores the seed, RNG state, depth, tiles, stairs, player, enemies, items, seen map, turn, kills, score, log and next id. It is written after every turn and validated on read; a new run or death clears it.
- `wick.settings.v1` stores volume, mute, shake, flashes and reduced motion. `prefers-reduced-motion` is the default; the old `wick.muted.v1` key is read once when settings do not exist.
- Every storage read is guarded; private windows and blocked storage still play, without persistence.

## Build and deploy

- `tsc` emits browser-native ES modules to `dist/`; there is no bundler.
- `index.html` loads `dist/main.js` and `dist/styles.css` with relative paths.
- GitHub Pages uploads `index.html` + `dist/`; the itch zip has the same layout at its root.
- `scripts/check-dist.mjs` rejects bad imports; `scripts/check-module-graph.mjs` proves the artifact under the Pages prefix.
- `npm run smoke` runs a real journey in Chromium, Firefox and WebKit; `npm run a11y` scans the DOM overlays.
