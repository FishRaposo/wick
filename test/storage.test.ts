import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, act } from '../src/core/rules.ts';
import { CONTENT } from '../src/content/index.ts';
import { Rng } from '../src/core/rng.ts';
import { loadBest, saveBest, loadSave, saveRun, clearSave, snapshotRun } from '../src/platform/storage.ts';
import { loadSettings, saveSettings, defaultSettings } from '../src/platform/settings.ts';

class MemoryStorage {
  data = new Map<string, string>();
  get length(): number { return this.data.size; }
  clear(): void { this.data.clear(); }
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  key(index: number): string | null { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string): void { this.data.delete(key); }
  setItem(key: string, value: string): void { this.data.set(key, String(value)); }
}

function installStorage(): MemoryStorage {
  const storage = new MemoryStorage();
  (globalThis as { localStorage: Storage }).localStorage = storage as unknown as Storage;
  return storage;
}

test('best score round-trips and rejects malformed data', () => {
  const storage = installStorage();
  saveBest({ score: 120, depth: 4 });
  assert.deepEqual(loadBest(), { score: 120, depth: 4 });
  storage.setItem('wick.best.v1', '{');
  assert.deepEqual(loadBest(), { score: 0, depth: 0 });
});

test('a run snapshot round-trips through storage', () => {
  installStorage();
  const s = createRun(42, { content: CONTENT });
  act(s, { type: 'wait' });
  const save = snapshotRun(s);
  saveRun(save);
  const loaded = loadSave();
  assert.deepEqual(loaded, save);
  clearSave();
  assert.equal(loadSave(), null);
});

test('invalid saves are discarded', () => {
  const storage = installStorage();
  storage.setItem('wick.save.v1', JSON.stringify({ version: 1, seed: 1, rngState: 1, depth: 1, tiles: [99] }));
  assert.equal(loadSave(), null);
  storage.setItem('wick.save.v1', JSON.stringify({ version: 2 }));
  assert.equal(loadSave(), null);
});

test('the RNG state resumes the exact sequence', () => {
  const a = new Rng(7);
  a.next();
  const state = a.state;
  const b = new Rng(7);
  b.state = state;
  assert.equal(a.next(), b.next());
});

test('settings round-trip and fall back safely', () => {
  const storage = installStorage();
  saveSettings({ version: 1, volume: 0.2, muted: true, shake: 0.4, flashes: 0.6, reducedMotion: true });
  assert.deepEqual(loadSettings(), { version: 1, volume: 0.2, muted: true, shake: 0.4, flashes: 0.6, reducedMotion: true });
  storage.setItem('wick.settings.v1', '{');
  const fallback = loadSettings();
  assert.equal(fallback.version, 1);
  assert.equal(fallback.volume, defaultSettings().volume);
});

test('legacy mute preference migrates into settings', () => {
  const storage = installStorage();
  storage.setItem('wick.muted.v1', '1');
  assert.equal(loadSettings().muted, true);
});
