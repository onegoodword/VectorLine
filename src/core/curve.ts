import type { Vec2 } from './types';

/** Format a coordinate: ≤3 decimals, no trailing zeros, "-0" normalized. */
export function fmt(n: number): string {
  const r = Math.round(n * 1000) / 1000;
  const v = Object.is(r, -0) ? 0 : r;
  return String(v);
}

/**
 * Emit an open Catmull-Rom-smoothed segment through `pts` as SVG path data.
 * smoothing 0 → straight polyline (L commands); 1 → full Catmull-Rom
 * converted to cubic Béziers. `move` controls whether the segment starts
 * with M (new subpath) or L (continue current subpath into pts[0]).
 */
export function smoothSegment(pts: readonly Vec2[], smoothing: number, move: boolean): string {
  if (pts.length === 0) return '';
  const first = pts[0]!;
  let out = `${move ? 'M' : 'L'}${fmt(first.x)} ${fmt(first.y)}`;
  if (pts.length === 1) return out;
  const k = Math.min(1, Math.max(0, smoothing)) / 6;
  if (k === 0) {
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i]!;
      out += `L${fmt(p.x)} ${fmt(p.y)}`;
    }
    return out;
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) * k;
    const c1y = p1.y + (p2.y - p0.y) * k;
    const c2x = p2.x - (p3.x - p1.x) * k;
    const c2y = p2.y - (p3.y - p1.y) * k;
    out += `C${fmt(c1x)} ${fmt(c1y)} ${fmt(c2x)} ${fmt(c2y)} ${fmt(p2.x)} ${fmt(p2.y)}`;
  }
  return out;
}
