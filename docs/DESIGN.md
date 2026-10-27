# Wick: design notes

## The constraint

Light is the only resource. Oil decides how far you see, and it runs out. Every rule had to make that tension sharper, not add a second economy beside it.

## Decisions

**One number, two jobs.** Oil is both the clock (it burns as you walk) and your field of view (radius 2 + ⌈oil / 20⌉, or 1 when dry). A low lantern is immediately visible on screen, so the player feels the clock without reading the HUD.

**Three enemies, three relationships to the light.** Each one makes the light mean something different:

| Enemy | Reads | Turns the light into |
|---|---|---|
| Moth | a burning lantern within its radius + 4 | a liability: light attracts |
| Shade | the bright core (radius − 2) | a shield that fails when the oil does |
| Hound | sound, carried along corridors | irrelevant: you need to stop moving instead |

A player who has learned all three is making a different decision on every turn: keep the light up for shades, move less near hounds, and fight moths at a corridor mouth.

**Shades stalk at the edge instead of attacking.** A shade that simply fled would be harmless and boring. Waiting just outside the core turns the edge of the light into a visible threat (their eyes are drawn in the dark) and makes running dry a real event rather than a number reaching zero.

**Sound follows corridors.** Hearing is measured in walking steps from the noise, by BFS. That makes stealth a map-reading skill: a hound in the next room by straight line, behind 20 steps of rock, doesn't hear you. Waiting is silent, so standing still is always an option, and it costs oil.

**Generation guarantees, doesn't hope.** Corridors join every room in left-to-right order, so the floor is connected by construction; one or two extra corridors add loops, because fleeing and flanking need cycles to be interesting. The stairs go on the tile farthest from the start by walking distance, so each floor is a full crossing. Connectivity is tested over 1,800 generated floors rather than assumed.

**Free actions where a turn would feel like a cheat.** Walking into a wall doesn't pass a turn. A misinput shouldn't cost oil or give enemies a move.

**Rules and presentation are separated.** `rules.js` is pure: state plus `act()`, returning events. Rendering tweens positions and reacts to events (hits, kills, pickups, alerts), but can never change the outcome. That's what makes the tests and the task checks honest: they run the real rules, not a model of them.

## What would change with more time

- **Items with choices.** Flasks are picked up automatically. Carried flasks would add a second decision (drink now or save it).
- **Stealth feedback.** A ring showing how far your last action carried would teach the hearing rule faster than dying to it.
- **Run seeds you can share**, shown on the death screen. The seeding already makes them reproducible.
- **Performance at larger sizes.** Several BFS maps a turn on 840 tiles costs microseconds; a much bigger map would want maps shared between enemies with the same target.

## Sixty seconds, out loud

Wick is a turn-based roguelike where your lantern's oil is your field of view, and it burns as you walk. Each enemy reacts to the light differently. Moths are drawn to it. Shades fear its bright core and wait at the edge for it to go out. Hounds ignore it and hunt by sound, which travels along corridors, not through walls. Floors are generated from a seed and connected by construction, and the AI runs on Dijkstra maps; the shades use a Brogue-style flee map so they escape into open space instead of dead ends. The rules are a pure module with no DOM, so the 18 tests and the task-pack checks run in Node against exactly the code the browser runs.
