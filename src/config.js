// Every tunable number in one place. Rules modules import from here; nothing here touches the DOM.

export const MAP_W = 40;
export const MAP_H = 21;

export const TILE = { WALL: 0, FLOOR: 1, STAIRS: 2 };

export const PLAYER = { hp: 6, oil: 100 };

export const OIL = {
  burnEvery: 2, // turns per point of oil burned
  flask: 30, // oil restored by a flask
  max: 100,
};

// Light radius from oil: full lantern 7 tiles, never below 3 while any oil is left, 1 when dry.
export function lightRadius(oil) {
  return oil <= 0 ? 1 : 2 + Math.ceil(Math.min(oil, OIL.max) / 20);
}

// Shades fear the bright core of the light, not its fringe: they wait just outside it.
export const SHADE_FEAR_MARGIN = 2;

export const NOISE = { move: 5, attack: 7 }; // how far (in walking steps) a sound carries

export const ENEMY = {
  moth: { hp: 1, dmg: 1, unlock: 1, cost: 2, points: 5 },
  shade: { hp: 2, dmg: 2, unlock: 2, cost: 3, points: 15 },
  hound: { hp: 3, dmg: 1, unlock: 3, cost: 4, points: 20 },
};

export const MOTH_SIGHT_BONUS = 4; // moths notice a lantern this many tiles beyond its radius
export const SHADE_HUNT_RANGE = 12; // path distance at which a shade starts stalking
