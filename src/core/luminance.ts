import type { LumaMap } from './types';

/** sRGB 8-bit channel → linear 0–1. */
export function srgbToLinear(c8: number): number {
  const c = c8 / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Linear-light 0–1 → perceptual sRGB 0–1 (for the normalized map). */
export function linearToSrgb(l: number): number {
  return l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055;
}

/**
 * RGBA pixels → relative-luminance map, 0–1.
 * Luminance is computed in linear light (Rec. 709 weights) and then
 * re-encoded to the sRGB transfer curve so tone controls behave perceptually.
 * Pixels are premultiplied against white where alpha < 255.
 */
export function luminanceMap(rgba: Uint8ClampedArray, width: number, height: number): LumaMap {
  const n = width * height;
  const data = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const a = (rgba[o + 3] ?? 255) / 255;
    const r = srgbToLinear(rgba[o] ?? 255);
    const g = srgbToLinear(rgba[o + 1] ?? 255);
    const b = srgbToLinear(rgba[o + 2] ?? 255);
    // composite over white: linear white = 1
    const y = (0.2126 * r + 0.7152 * g + 0.0722 * b) * a + (1 - a);
    data[i] = linearToSrgb(Math.min(1, Math.max(0, y)));
  }
  return { width, height, data };
}

/**
 * Bilinear sample of a luma map at continuous pixel coordinates
 * (0,0 = center of top-left pixel). Coordinates clamp to edges.
 */
export function sampleBilinear(map: LumaMap, x: number, y: number): number {
  const { width: w, height: h, data } = map;
  const cx = Math.min(w - 1, Math.max(0, x));
  const cy = Math.min(h - 1, Math.max(0, y));
  const x0 = Math.floor(cx);
  const y0 = Math.floor(cy);
  const x1 = Math.min(w - 1, x0 + 1);
  const y1 = Math.min(h - 1, y0 + 1);
  const fx = cx - x0;
  const fy = cy - y0;
  const a = data[y0 * w + x0] ?? 0;
  const b = data[y0 * w + x1] ?? 0;
  const c = data[y1 * w + x0] ?? 0;
  const d = data[y1 * w + x1] ?? 0;
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}
