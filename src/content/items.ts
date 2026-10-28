// Item effects. The core's pickup step only calls the registry entry.

import { OIL, RESIN_TURNS } from '../core/config.ts';
import type { ItemDef, ItemKind } from '../core/types.ts';

const OIL_FLASK: ItemDef = {
  apply({ player, say }): void {
    const before = player.oil;
    player.oil = Math.min(OIL.max, player.oil + OIL.flask);
    say(before === 0 ? 'Oil. The wick catches again.' : 'You top up the lantern.');
  },
};

const BANDAGE: ItemDef = {
  apply({ player, say }): void {
    player.hp = Math.min(player.maxHp, player.hp + 2);
    say('You bind your wounds.');
  },
};

const RESIN: ItemDef = {
  apply({ player, say }): void {
    player.resin = RESIN_TURNS;
    say('You coat the wick in resin. The light holds wider.');
  },
};

export const ITEMS: Record<ItemKind, ItemDef> = {
  oil: OIL_FLASK,
  bandage: BANDAGE,
  resin: RESIN,
};
