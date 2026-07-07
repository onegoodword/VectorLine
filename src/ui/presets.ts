import type { Settings } from '../core/types';
import { coerceSettings } from './store';

/** Encode settings into a URL-hash-safe base64url string. */
export function encodeHash(settings: Settings): string {
  const json = JSON.stringify(settings);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Decode settings from the URL hash; null if absent or invalid. */
export function decodeHash(hash: string): Settings | null {
  const m = /[#&]s=([A-Za-z0-9_-]+)/.exec(hash);
  if (!m || !m[1]) return null;
  try {
    const b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(escape(atob(b64)));
    return coerceSettings(JSON.parse(json));
  } catch {
    return null;
  }
}

/** Serialize settings to a downloadable preset JSON blob. */
export function presetJson(settings: Settings): string {
  return JSON.stringify({ app: 'vectorline', version: 1, settings }, null, 2);
}

/** Parse a preset JSON file's text; throws on malformed input. */
export function parsePresetJson(text: string): Settings {
  const raw = JSON.parse(text) as { settings?: unknown };
  return coerceSettings(raw.settings ?? raw);
}
