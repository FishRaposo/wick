// Shared domain types and content contracts. Core, content, platform and presentation agree on
// these shapes; the content registry implements the behaviours the core calls.

import type { Rng } from './rng.ts';

export type Cell = [number, number];
export type EnemyKind = 'moth' | 'shade' | 'hound' | 'lurker';
export type ItemKind = 'oil' | 'bandage' | 'resin';

export interface Room {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Item {
  kind: ItemKind;
  x: number;
  y: number;
}

export interface Spawn {
  kind: EnemyKind;
  x: number;
  y: number;
}

export interface Floor {
  depth: number;
  theme: string;
  tiles: Uint8Array;
  rooms: Room[];
  start: { x: number; y: number };
  stairs: { x: number; y: number };
  items: Item[];
  spawns: Spawn[];
}

export interface Player {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  oil: number;
  resin: number; // turns of +2 light radius left
}

export interface Enemy {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  target: { x: number; y: number } | null;
  calm?: number; // lurker: turns left before it loses interest
}

export interface LogLine {
  text: string;
  turn: number;
}

export interface Noise {
  x: number;
  y: number;
  r: number;
}

export type RunEvent =
  | { type: 'move'; from: { x: number; y: number }; to: { x: number; y: number } }
  | { type: 'wait' }
  | { type: 'bump'; x: number; y: number }
  | { type: 'hit'; id: number; x: number; y: number }
  | { type: 'kill'; id: number; kind: EnemyKind; x: number; y: number }
  | { type: 'hurt'; id: number; kind: EnemyKind; dmg: number; x: number; y: number }
  | { type: 'pickup'; kind: ItemKind; x: number; y: number }
  | { type: 'alert'; id: number; x: number; y: number }
  | { type: 'dark' }
  | { type: 'floor'; depth: number }
  | { type: 'die' }
  | { type: 'emove'; id: number; from: { x: number; y: number }; to: { x: number; y: number } };

export type Action = { type: 'move'; dx: number; dy: number } | { type: 'wait' };

export interface EnemyContext {
  state: RunState;
  enemy: Enemy;
  player: Player;
  toPlayer: Int16Array;
  heard: Int16Array | null;
  noise: Noise | null;
  free: (x: number, y: number) => boolean;
  step: (enemy: Enemy, to: Cell | null) => void;
  bite: (enemy: Enemy) => void;
  wander: (enemy: Enemy, allowed?: (x: number, y: number) => boolean) => void;
  isLit: (x: number, y: number, margin?: number) => boolean;
  radius: number;
  getFlee: () => Float32Array;
}

export interface EnemyDef {
  hp: number;
  dmg: number;
  unlock: number;
  cost: number;
  points: number;
  act(ctx: EnemyContext): void;
}

export interface ItemContext {
  state: RunState;
  player: Player;
  item: Item;
  say(text: string): void;
}

export interface ItemDef {
  apply(ctx: ItemContext): void;
}

export interface DepthTheme {
  from: number;
  name: string;
  loops: number;
  enemyWeights: Partial<Record<EnemyKind, number>>;
  itemWeights: Partial<Record<ItemKind, number>>;
}

export interface GameContent {
  enemies: Record<EnemyKind, EnemyDef>;
  items: Record<ItemKind, ItemDef>;
  depths: DepthTheme[];
}

export interface RunState {
  seed: number;
  rng: Rng;
  content: GameContent;
  depth: number;
  tiles: Uint8Array;
  stairs: { x: number; y: number };
  player: Player;
  enemies: Enemy[];
  items: Item[];
  seen: Uint8Array;
  visible: Uint8Array;
  turn: number;
  kills: number;
  score: number;
  noise: Noise | null;
  over: boolean;
  log: LogLine[];
  events: RunEvent[];
  nextId: number;
}

export interface Best {
  score: number;
  depth: number;
}
