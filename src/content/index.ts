import type { GameContent } from '../core/types.ts';
import { DEPTHS } from './depths.ts';
import { ENEMIES } from './enemies.ts';
import { ITEMS } from './items.ts';

export const CONTENT: GameContent = {
  enemies: ENEMIES,
  items: ITEMS,
  depths: DEPTHS,
};

export { DEPTHS, ENEMIES, ITEMS };
