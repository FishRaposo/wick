// Enemy behaviours. Each entry is the complete behaviour plus stats; the core only dispatches
// through the registry, so adding an enemy never edits the rules module.

import { LURKER_CALM, LURKER_SIGHT, MOTH_SIGHT_BONUS, SHADE_FEAR_MARGIN, SHADE_HUNT_RANGE } from '../core/config.ts';
import { idx } from '../core/grid.ts';
import { distanceMap, downhill } from '../core/path.ts';
import type { EnemyContext, EnemyDef, EnemyKind } from '../core/types.ts';

const adjacent = (ctx: EnemyContext): boolean =>
  Math.abs(ctx.enemy.x - ctx.player.x) + Math.abs(ctx.enemy.y - ctx.player.y) === 1;

const MOTH: EnemyDef = {
  hp: 1,
  dmg: 1,
  unlock: 1,
  cost: 2,
  points: 5,
  act(ctx: EnemyContext): void {
    const { state: s, enemy: e, player: p, toPlayer } = ctx;
    const d = toPlayer[idx(e.x, e.y)];
    // Moths fly at a burning lantern they can see from a little beyond its glow, erratically.
    const drawn = p.oil > 0 && d >= 0 && d <= ctx.radius + MOTH_SIGHT_BONUS;
    if (adjacent(ctx)) ctx.bite(e);
    else if (drawn && !s.rng.chance(0.25)) ctx.step(e, downhill(toPlayer, s.tiles, e.x, e.y, ctx.free));
    else if (s.rng.chance(drawn ? 1 : 0.5)) ctx.wander(e);
  },
};

const SHADE: EnemyDef = {
  hp: 2,
  dmg: 2,
  unlock: 2,
  cost: 3,
  points: 15,
  act(ctx: EnemyContext): void {
    const { state: s, enemy: e, toPlayer } = ctx;
    const d = toPlayer[idx(e.x, e.y)];
    // Shades can't stand the bright core of the light. They flee it, stalk just outside it,
    // and only reach you once the lantern is dry.
    if (ctx.isLit(e.x, e.y, SHADE_FEAR_MARGIN)) {
      ctx.step(e, downhill(ctx.getFlee(), s.tiles, e.x, e.y, ctx.free));
    } else if (adjacent(ctx)) {
      ctx.bite(e);
    } else if (d >= 0 && d <= SHADE_HUNT_RANGE) {
      const next = downhill(toPlayer, s.tiles, e.x, e.y, ctx.free);
      if (next && !ctx.isLit(next[0], next[1], SHADE_FEAR_MARGIN)) ctx.step(e, next);
    } else if (s.rng.chance(0.3)) {
      ctx.wander(e);
    }
  },
};

const HOUND: EnemyDef = {
  hp: 3,
  dmg: 1,
  unlock: 3,
  cost: 4,
  points: 20,
  act(ctx: EnemyContext): void {
    const { state: s, enemy: e, noise, heard } = ctx;
    // Hounds hunt by sound. A noise reaches a hound if it's within the noise's range measured
    // along the corridors, not through rock. They go to where they heard it, then sniff around.
    if (heard && noise) {
      const hd = heard[idx(e.x, e.y)];
      if (hd >= 0 && hd <= noise.r) {
        if (!e.target) s.events.push({ type: 'alert', id: e.id, x: e.x, y: e.y });
        e.target = { x: noise.x, y: noise.y };
      }
    }
    if (adjacent(ctx)) ctx.bite(e);
    else if (e.target) {
      if (e.x === e.target.x && e.y === e.target.y) e.target = null;
      else ctx.step(e, downhill(distanceMap(s.tiles, [[e.target.x, e.target.y]]), s.tiles, e.x, e.y, ctx.free));
    } else if (s.rng.chance(0.2)) {
      ctx.wander(e);
    }
  },
};

const LURKER: EnemyDef = {
  hp: 2,
  dmg: 1,
  unlock: 4,
  cost: 4,
  points: 25,
  act(ctx: EnemyContext): void {
    const { state: s, enemy: e, player: p, toPlayer } = ctx;
    const d = toPlayer[idx(e.x, e.y)];
    const seen = s.visible[idx(e.x, e.y)] && d >= 0 && d <= LURKER_SIGHT;
    if (seen) {
      e.target = { x: p.x, y: p.y };
      e.calm = LURKER_CALM;
    } else if (e.target) {
      e.calm = (e.calm ?? LURKER_CALM) - 1;
      if (e.calm <= 0) e.target = null;
    }
    if (adjacent(ctx)) ctx.bite(e);
    else if (e.target) ctx.step(e, downhill(toPlayer, s.tiles, e.x, e.y, ctx.free));
    else if (s.rng.chance(0.08)) ctx.wander(e);
  },
};

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  moth: MOTH,
  shade: SHADE,
  hound: HOUND,
  lurker: LURKER,
};
