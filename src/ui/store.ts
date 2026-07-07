import { cloneSettings, DEFAULT_SETTINGS, type Settings } from '../core/types';

export type Listener = (settings: Settings) => void;

/** Minimal observable settings store. */
export class SettingsStore {
  private settings: Settings = cloneSettings(DEFAULT_SETTINGS);
  private listeners = new Set<Listener>();

  get(): Settings {
    return this.settings;
  }

  /** Replace the whole settings object (preset load, hash restore). */
  replace(next: Settings): void {
    this.settings = cloneSettings(next);
    this.emit();
  }

  /** Update one field within a group, e.g. set('grid', 'spacing', 8). */
  set<G extends keyof Settings, K extends keyof Settings[G]>(
    group: G,
    key: K,
    value: Settings[G][K],
  ): void {
    if (this.settings[group][key] === value) return;
    this.settings = cloneSettings(this.settings);
    this.settings[group][key] = value;
    this.emit();
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn(this.settings);
  }
}

/** Validate and coerce an unknown object into Settings (hash/JSON import). */
export function coerceSettings(raw: unknown): Settings {
  const out = cloneSettings(DEFAULT_SETTINGS);
  if (typeof raw !== 'object' || raw === null) return out;
  const src = raw as Record<string, Record<string, unknown>>;
  for (const g of Object.keys(out) as Array<keyof Settings>) {
    const group = src[g];
    if (typeof group !== 'object' || group === null) continue;
    const target = out[g] as unknown as Record<string, unknown>;
    for (const k of Object.keys(target)) {
      const v = group[k];
      if (v === undefined) continue;
      const cur = target[k];
      if (typeof cur === 'number' && typeof v === 'number' && Number.isFinite(v)) target[k] = v;
      else if (typeof cur === 'boolean' && typeof v === 'boolean') target[k] = v;
      else if (typeof cur === 'string' && typeof v === 'string' && v.length < 64) target[k] = v;
    }
  }
  // guard enum fields
  const modes = ['thickness', 'amplitude', 'frequency', 'dashes'];
  if (!modes.includes(out.line.mode)) out.line.mode = 'thickness';
  if (out.output.unit !== 'mm' && out.output.unit !== 'px') out.output.unit = 'mm';
  return out;
}
