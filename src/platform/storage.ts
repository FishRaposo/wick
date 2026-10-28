// localStorage can be missing or throw (private windows, sandboxed iframes, blocked site data).
// The game must run identically without it, so every access is guarded.

import { MAP_W, MAP_H } from '../core/config.ts';
import type { Best, Enemy, Item, LogLine, Player, RunState } from '../core/types.ts';

const KEY = 'wick.best.v1';
const SAVE_KEY = 'wick.save.v1';
const EMPTY: Best = { score: 0, depth: 0 };
const N = MAP_W * MAP_H;

export interface RunSave {
  version: 1;
  seed: number;
  rngState: number;
  depth: number;
  tiles: number[];
  stairs: { x: number; y: number };
  player: Player;
  enemies: Enemy[];
  items: Item[];
  seen: number[];
  turn: number;
  kills: number;
  score: number;
  log: LogLine[];
  nextId: number;
  savedAt: number;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isPoint(value: unknown): value is { x: number; y: number } {
  return isObject(value) && typeof value.x === 'number' && typeof value.y === 'number';
}

export function loadBest(): Best {
  try {
    const raw = localStorage.getItem(KEY);
    const v: unknown = raw ? JSON.parse(raw) : null;
    if (v && typeof v === 'object') {
      const best = v as Partial<Best>;
      if (typeof best.score === 'number' && typeof best.depth === 'number') {
        return { score: Math.max(0, best.score), depth: Math.max(0, best.depth) };
      }
    }
    return { ...EMPTY };
  } catch {
    return { ...EMPTY };
  }
}

export function saveBest(best: Best): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(best));
  } catch {
    /* not persisted this session */
  }
}

export function snapshotRun(s: RunState): RunSave {
  return {
    version: 1,
    seed: s.seed,
    rngState: s.rng.state,
    depth: s.depth,
    tiles: Array.from(s.tiles),
    stairs: { ...s.stairs },
    player: { ...s.player },
    enemies: s.enemies.map((e) => ({ ...e, target: e.target ? { ...e.target } : null })),
    items: s.items.map((i) => ({ ...i })),
    seen: Array.from(s.seen),
    turn: s.turn,
    kills: s.kills,
    score: s.score,
    log: s.log.map((l) => ({ ...l })),
    nextId: s.nextId,
    savedAt: Date.now(),
  };
}

export function loadSave(): RunSave | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    const v: unknown = raw ? JSON.parse(raw) : null;
    if (!isObject(v) || v.version !== 1) return null;
    if (typeof v.seed !== 'number' || typeof v.rngState !== 'number') return null;
    if (typeof v.depth !== 'number' || v.depth < 1) return null;
    if (!Array.isArray(v.tiles) || v.tiles.length !== N || !v.tiles.every((t) => Number.isInteger(t) && t >= 0 && t <= 2)) return null;
    if (!isPoint(v.stairs)) return null;
    if (!isObject(v.player)) return null;
    const p = v.player;
    if (typeof p.x !== 'number' || typeof p.y !== 'number') return null;
    if (typeof p.hp !== 'number' || typeof p.maxHp !== 'number' || typeof p.oil !== 'number' || typeof p.resin !== 'number') return null;
    if (!Array.isArray(v.enemies)) return null;
    for (const e of v.enemies) {
      if (!isObject(e) || typeof e.id !== 'number' || typeof e.kind !== 'string' || typeof e.x !== 'number' || typeof e.y !== 'number') return null;
      if (typeof e.hp !== 'number' || typeof e.maxHp !== 'number') return null;
      if (e.target !== null && !isPoint(e.target)) return null;
    }
    if (!Array.isArray(v.items) || !v.items.every((i) => isObject(i) && typeof i.kind === 'string' && typeof i.x === 'number' && typeof i.y === 'number')) return null;
    if (!Array.isArray(v.seen) || v.seen.length !== N || !v.seen.every((s) => s === 0 || s === 1)) return null;
    if (typeof v.turn !== 'number' || typeof v.kills !== 'number' || typeof v.score !== 'number' || typeof v.nextId !== 'number') return null;
    if (!Array.isArray(v.log) || !v.log.every((l) => isObject(l) && typeof l.text === 'string' && typeof l.turn === 'number')) return null;
    return {
      version: 1,
      seed: v.seed,
      rngState: v.rngState,
      depth: v.depth,
      tiles: v.tiles as number[],
      stairs: { x: v.stairs.x, y: v.stairs.y },
      player: { x: p.x, y: p.y, hp: p.hp, maxHp: p.maxHp, oil: p.oil, resin: p.resin },
      enemies: v.enemies as Enemy[],
      items: v.items as Item[],
      seen: v.seen as number[],
      turn: v.turn,
      kills: v.kills,
      score: v.score,
      log: v.log as LogLine[],
      nextId: v.nextId,
      savedAt: typeof v.savedAt === 'number' ? v.savedAt : 0,
    };
  } catch {
    return null;
  }
}

export function saveRun(save: RunSave): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    /* not persisted this session */
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}
