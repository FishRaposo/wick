// Every tunable number in one place. Rules modules import from here; nothing here touches the DOM.

export const MAP_W = 40;
export const MAP_H = 21;

export const TILE = { WALL: 0, FLOOR: 1, STAIRS: 2 } as const;
export type Tile = (typeof TILE)[keyof typeof TILE];

export const PLAYER = { hp: 6, oil: 100 } as const;

export const OIL = {
  burnEvery: 2, // turns per point of oil burned
  flask: 30, // oil restored by a flask
  max: 100,
} as const;

// Light radius from oil: full lantern 7 tiles, never below 3 while any oil is left, 1 when dry.
// A resin buff adds its bonus only while the lantern is still burning.
export function lightRadius(oil: number, bonus = 0): number {
  return oil <= 0 ? 1 : 2 + Math.ceil(Math.min(oil, OIL.max) / 20) + bonus;
}

// Shades fear the bright core of the light, not its fringe: they wait just outside it.
export const SHADE_FEAR_MARGIN = 2;

export const NOISE = { move: 5, attack: 7 } as const; // how far (in walking steps) a sound carries

export const MOTH_SIGHT_BONUS = 4; // moths notice a lantern this many tiles beyond its radius
export const SHADE_HUNT_RANGE = 12; // path distance at which a shade starts stalking
export const RESIN_TURNS = 30; // turns of +2 light radius from a resin pickup
export const LURKER_SIGHT = 8; // steps at which a lurker notices the player
export const LURKER_CALM = 5; // turns without sight before it loses interest
