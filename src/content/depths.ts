// Depth bands. A deeper band changes the loop count, the enemy mix and which items can spawn.
// The generator picks the highest band whose `from` is at or below the current depth.

import type { DepthTheme } from '../core/types.ts';

export const DEPTHS: DepthTheme[] = [
  {
    from: 1,
    name: 'Cellar',
    loops: 1,
    enemyWeights: { moth: 5, shade: 0, hound: 0, lurker: 0 },
    itemWeights: { oil: 6, bandage: 3, resin: 0 },
  },
  {
    from: 2,
    name: 'Cellar',
    loops: 1,
    enemyWeights: { moth: 4, shade: 3, hound: 0, lurker: 0 },
    itemWeights: { oil: 6, bandage: 3, resin: 0 },
  },
  {
    from: 3,
    name: 'Cellar',
    loops: 2,
    enemyWeights: { moth: 3, shade: 3, hound: 2, lurker: 0 },
    itemWeights: { oil: 5, bandage: 3, resin: 0 },
  },
  {
    from: 4,
    name: 'Deep Cellar',
    loops: 2,
    enemyWeights: { moth: 3, shade: 3, hound: 3, lurker: 2 },
    itemWeights: { oil: 4, bandage: 2, resin: 2 },
  },
];
