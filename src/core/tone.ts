import type { LumaMap, ToneSettings } from './types';

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Apply tone pipeline to a single luminance value, in order:
 * brightness offset → contrast (pivot 0.5) → gamma → levels clamp → invert.
 */
export function toneValue(l: number, t: ToneSettings): number {
  let v = clamp01(l + t.brightness);
  // contrast −1..1: slope 0 (flat) .. 1 (identity) .. steep around pivot 0.5
  const slope = t.contrast >= 0 ? 1 / Math.max(1e-4, 1 - t.contrast) : 1 + t.contrast;
  v = clamp01((v - 0.5) * slope + 0.5);
  v = Math.pow(v, 1 / Math.max(0.2, Math.min(5, t.gamma)));
  const lo = Math.min(t.blackPoint, t.whitePoint - 1e-4);
  const hi = Math.max(t.whitePoint, lo + 1e-4);
  v = clamp01((v - lo) / (hi - lo));
  if (t.invert) v = 1 - v;
  return v;
}

/** Apply tone adjustments to a whole map, returning a new map. */
export function applyTone(map: LumaMap, t: ToneSettings): LumaMap {
  const data = new Float32Array(map.data.length);
  // Precompute a 1024-entry LUT; luminance is already 0–1 and smooth.
  const LUT_N = 1024;
  const lut = new Float32Array(LUT_N + 1);
  for (let i = 0; i <= LUT_N; i++) lut[i] = toneValue(i / LUT_N, t);
  for (let i = 0; i < map.data.length; i++) {
    const v = (map.data[i] ?? 0) * LUT_N;
    const i0 = Math.floor(v);
    const f = v - i0;
    const a = lut[Math.min(LUT_N, i0)] ?? 0;
    const b = lut[Math.min(LUT_N, i0 + 1)] ?? 0;
    data[i] = a + (b - a) * f;
  }
  return { width: map.width, height: map.height, data };
}
