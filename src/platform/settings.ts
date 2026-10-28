// Player settings. Persisted separately from the best score and the run save; every read is guarded.

export interface Settings {
  version: 1;
  volume: number; // 0..1
  muted: boolean;
  shake: number; // 0..1
  flashes: number; // 0..1
  reducedMotion: boolean;
}

const KEY = 'wick.settings.v1';
const LEGACY_MUTE_KEY = 'wick.muted.v1';

export function defaultSettings(): Settings {
  let reduced = false;
  try {
    reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    /* no matchMedia: keep motion */
  }
  return { version: 1, volume: 0.5, muted: false, shake: 1, flashes: 1, reducedMotion: reduced };
}

export function loadSettings(): Settings {
  const fallback = defaultSettings();
  try {
    const raw = localStorage.getItem(KEY);
    const v: unknown = raw ? JSON.parse(raw) : null;
    if (!v || typeof v !== 'object') {
      const legacyMuted = localStorage.getItem(LEGACY_MUTE_KEY) === '1';
      return { ...fallback, muted: legacyMuted };
    }
    const s = v as Partial<Settings>;
    const unit = (n: unknown, d: number): number => (typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : d);
    return {
      version: 1,
      volume: unit(s.volume, fallback.volume),
      muted: typeof s.muted === 'boolean' ? s.muted : fallback.muted,
      shake: unit(s.shake, fallback.shake),
      flashes: unit(s.flashes, fallback.flashes),
      reducedMotion: typeof s.reducedMotion === 'boolean' ? s.reducedMotion : fallback.reducedMotion,
    };
  } catch {
    return fallback;
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* not persisted this session */
  }
}
