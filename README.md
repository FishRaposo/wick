# Wick

A turn-based roguelike where your lantern's oil is your field of view.

![Wick gameplay: the lantern lights a small circle of a procedurally generated floor as the player walks toward the stairs](media/demo.gif)

Every floor is generated from a seed. You need the stairs, and you only see what your lantern lights. Oil burns as you walk, and the light shrinks with it. Three things live down here, and each one reacts to the light differently: moths fly at it, shades flee its bright core and wait at the edge for it to go out, and hounds ignore it and hunt you by sound. Deeper down, lurkers sit in the dark until the light finds them.

A **Cellar** depth band keeps the early floors simple. From floor 4 the **Deep Cellar** band adds lurkers, more loops and resin, which widens the lantern for thirty turns. Everything is driven by a small content registry, so enemies, items and depth bands can be added without touching the rules.

Designed and built with AI assistance (Claude) to Vinícius Raposo's brief, then tested like production software.

**Project page:** [fishraposo.github.io/projects/wick.html](https://fishraposo.github.io/projects/wick.html)

**Play:** [on itch.io](https://fishraposo.itch.io/wick) or [the GitHub Pages build](https://fishraposo.github.io/wick/), both in the browser, or run it locally:

```bash
git clone https://github.com/FishRaposo/wick.git
cd wick
npm ci               # dev-only tooling: TypeScript, Playwright and axe
npm start            # builds, watches and serves http://localhost:8080
```

Node 24 LTS is required. `npm start` builds `dist/`; opening `index.html` straight from disk won't work, because browsers block ES modules on `file://`.

## Controls

| | Keyboard | Gamepad | Touch / mouse |
|---|---|---|---|
| Move | arrows, WASD or HJKL | d-pad or left stick | tap toward where you want to go |
| Wait a turn | space, `.` or Z | A | tap yourself |
| Attack | walk into it | | |
| Pause | Esc | Start | pause dialog |
| Settings | O | | "settings" button |
| Continue a run | C | B | "continue" button |
| Copy seed | Y | | |
| Fullscreen · mute | F · M | | |

## How it plays

- **Oil is time and sight.** A full lantern lights 7 tiles. It burns one point every two turns, and the radius drops a tile every 20 oil. At zero you see one tile around you. Flasks on the floor restore 30; resin adds 2 radius for thirty turns.
- **Moths** notice a burning lantern from a little beyond its glow and fly at it, erratically. They lose interest when it's dry.
- **Shades** can't stand the bright core of the light (all but its outer two tiles). They flee it along a flee map, stalk just outside it, and can only reach you once the lantern is out.
- **Hounds** hunt by sound. A footstep carries 5 steps along the corridors, an attack 7, and waiting is silent. A hound goes to where it heard you, then sniffs around. Sound travels along the dungeon, not through rock.
- **Lurkers** wait in the dark. Light within eight steps wakes one; it chases for five turns after losing sight, then goes still again.
- Walking into a wall is free: no turn passes, no oil burns.

## Save and settings

- A run is saved after every turn (`wick.save.v1`), including the RNG state. The title offers **Continue** after a reload; a new run or death clears it.
- The seed is shown on the title and death screens; `Y` copies a `?seed=` link and `?seed=N` replays the same floors and enemy decisions for the same inputs.
- Settings (`wick.settings.v1`) keep volume, mute, shake, flashes and reduced motion. Reduced motion is the default when the operating system asks for it.
- All storage reads are guarded: private windows and blocked storage still play, without persistence.

## Under the hood

No engine, no runtime dependencies, no asset files: TypeScript compiled to browser-native ES modules, on a 2D canvas, with synthesized sound. There is no bundler.

- **The rules are a pure module.** `src/core/rules.ts` holds the whole game as a state object and `act(state, action)`, with no DOM, timers or rendering. The browser layer reads the events each turn produces to animate and play sound. That split is why the tests and the task checks run in Node against exactly the code the browser runs.
- **Content is a registry.** `src/content/enemies.ts` implements each enemy's behaviour, `items.ts` each pickup, and `depths.ts` the depth bands. `src/core/rules.ts` only dispatches through the registry; adding an enemy or item does not edit the rules.
- **Floor generation** (`src/core/gen.ts`): rooms by rejection sampling, joined left to right with L-shaped corridors so every room is reachable, plus loops from the depth band. The stairs go on the tile farthest from the start by walking distance.
- **Field of view** (`src/core/fov.ts`): recursive shadowcasting over eight octants. Walls are lit, what's behind them isn't, and the radius test uses r² + r for rounder circles.
- **AI on Dijkstra maps** (`src/core/path.ts`): one BFS distance map to the player per turn drives approach. Shades walk downhill on a flee map, built Brogue-style by scaling the distance map by −1.2 and relaxing it. Hounds hear on a BFS from the noise.
- **Seeded and deterministic.** Every random choice goes through a seeded PRNG whose state is saved with the run, so `?seed=31` replays the same floors and the same enemy decisions for the same inputs.

The design reasoning is in [docs/DESIGN.md](docs/DESIGN.md). Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Adding content: [docs/CONTENT.md](docs/CONTENT.md).

## Task pack

[`tasks/`](tasks/README.md) holds three game-development tasks built on this game:

- **Hounds hear through walls**: a planted AI bug.
- **Enemies follow the player downstairs**: a planted state bug.
- **Pour oil**: a feature that touches actions, lighting, two enemy AIs, rendering, input and audio.

Each has a brief, acceptance criteria, a reference solution with root-cause notes and an automated check. `npm run tasks` proves every check fails on the starting state and passes on the solution, with the whole unit suite green. It also checks that each bug's starting state plus its reference solution reproduces the repo exactly.

## Tests

```bash
npm run check    # typecheck source and tests
npm run build    # emit the browser build to dist/
npm test         # 27 tests: generation, FOV, paths, enemies, items, saves, settings
npm run tasks    # the task pack: every check fails before, passes after
npm run smoke    # real journeys in Chromium, Firefox and WebKit
npm run a11y     # axe scan of the title and the dialogs
npm run verify   # everything above, plus module-graph and boundary checks
```

`scripts/smoke.mjs` plays the real page: title, settings, a run, save/reload/continue, pause/resume and a mobile tap. It runs in Chromium, Firefox and WebKit and fails on any console error, page error or failed request. `scripts/smoke.py` and `scripts/record_media.py` are optional Python tools for media recording; the CI path is Node-only.

## Development

- [`AGENTS.md`](AGENTS.md) — commands, invariants and the task-pack rules for an agent or contributor.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — modules, data flow, determinism and build/deploy.
- [`docs/CONTENT.md`](docs/CONTENT.md) — how to add an enemy, item or depth band.
- [`docs/RELEASING.md`](docs/RELEASING.md) — version, checks, tag, release and itch handoff.
- [`../STANDARD.md`](../STANDARD.md) — the shared contract across the three games.

## Project layout

```
src/core/         rules, generation, FOV, paths, RNG, shared contracts (no DOM)
src/content/      enemies, items and depth bands (registry data and behaviours)
src/platform/     audio, storage, settings
src/presentation/ renderer, HUD, accessible dialogs
src/main.ts       composition root: input, animation, screens, save/continue
test/             node:test suites (rules, content, storage, settings)
scripts/          build, serve, smoke, a11y, package, release
tasks/            the task pack and its verifier
```

## Limitations

- No diagonal movement: four directions keep the controls and the AI readable.
- Smoke-tested in Chromium, Firefox and WebKit. WebKit-on-Linux is a compatibility check, not Safari-on-macOS proof.
- No key rebinding or colour-blind palette yet; reduced motion, shake, flashes and volume are available.
- The save stores the current run, not a history of turns.

## License

[MIT](LICENSE)
