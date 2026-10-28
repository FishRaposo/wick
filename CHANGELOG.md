# Changelog

All notable changes to Wick are recorded here. The format follows Keep a Changelog; versions follow SemVer.

## [1.1.0] — 2026-10-28

### Added

- TypeScript build and strict type checking; `dist/` is the deployable artifact.
- `core` / `content` / `platform` / `presentation` module split with a boundary check.
- Content registry for enemies, items and depth bands; adding content no longer edits the rules.
- **Lurker** enemy that wakes in the lantern light and loses interest in the dark.
- **Resin** item: +2 light radius for thirty turns.
- **Cellar** and **Deep Cellar** depth bands with their own enemy mixes and loops.
- Save/resume after every turn, including the RNG state; **Continue** on the title.
- Seed display and `Y` to copy a replay link.
- Settings: volume, mute, shake, flashes, reduced motion, fullscreen; persisted with guarded storage.
- Accessible pause/settings dialogs and `aria-live` announcements.
- Chromium, Firefox and WebKit smoke journeys; axe scan of the DOM overlays.
- Build, serve, module-graph, packaging and release-check scripts.

### Changed

- `index.html` now loads built assets from `dist/`.
- The title shows the seed, settings button and Continue when a run is saved.
- README, architecture, content, release and agent documentation updated.

### Fixed

- The pause dialog no longer closes on the Escape press that opened it.
- Version metadata is aligned with the release.

### Tests

- 27 unit tests cover generation, FOV, paths, all four enemies, items, saves and settings.
- Task verifier builds each state before its check and enforces starting + reference = `main`.
- `npm run verify` runs the three-browser smoke and accessibility gates.

## [1.0.0] — 2026-10-27

- Initial public release: seeded floors, oil as time and sight, moths, shades and hounds, task pack, GitHub Pages and itch builds.
