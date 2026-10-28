# Releasing Wick

1. Bump the version in `package.json` and `src/version.ts` to the same value; run `npm install --package-lock-only` so the lockfile matches.
2. Add a dated `## [x.y.z]` entry to `CHANGELOG.md`.
3. Install the browser engines once: `npx playwright-core install chromium firefox webkit` (Linux CI uses `--with-deps`).
4. Run `npm ci`, `npm run verify`, and `npm run release:check` while iterating (`--allow-dirty` only before the final clean run).
5. Commit on `feat/<topic>`, open a PR, and wait for CI (`check`, `test`, `tasks`, `browser` ×3, `a11y`).
6. Merge to `main`; confirm the Pages workflow deploys the built artifact and the live page loads without console errors.
7. Tag `vX.Y.Z` (annotated) and create a GitHub release from the changelog; attach `dist/wick-web.zip`.
8. Copy the zip to `portfolio/games/itch/wick/wick-web.zip` in the hub and upload it on itch (Edit game → Uploads; keep "played in the browser" ticked).
9. Post the measured test counts, browser results and any limitation in the hub handoff. Public page copy and profile claims go through Claude; do not rewrite the itch description.
