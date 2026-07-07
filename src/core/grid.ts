import { sampleBilinear } from './luminance';
import { mixSeed, mulberry32 } from './prng';
import type { LumaMap, Run, Sample, Settings, Vec2 } from './types';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Artwork rect minus margin (margin is % of the shorter side, all sides). */
export function contentRect(output: Settings['output']): Rect {
  const m = (Math.min(output.width, output.height) * output.margin) / 100;
  return { x: m, y: m, w: Math.max(0.1, output.width - 2 * m), h: Math.max(0.1, output.height - 2 * m) };
}

/**
 * Map an artwork-space point into luma-map pixel coordinates using
 * cover fitting: the image fills the content rect, cropped symmetrically.
 */
export function artworkToMapPx(p: Vec2, rect: Rect, mapW: number, mapH: number): Vec2 {
  const scale = Math.max(rect.w / mapW, rect.h / mapH); // units per map pixel
  return {
    x: (p.x - (rect.x + rect.w / 2)) / scale + mapW / 2 - 0.5,
    y: (p.y - (rect.y + rect.h / 2)) / scale + mapH / 2 - 0.5,
  };
}

/** Liang-Barsky: clip line p(s) = origin + s·dir to rect. Returns [s0, s1] or null. */
export function clipLineToRect(origin: Vec2, dir: Vec2, rect: Rect): [number, number] | null {
  let t0 = -Infinity;
  let t1 = Infinity;
  const checks: Array<[number, number]> = [
    [-dir.x, origin.x - rect.x],
    [dir.x, rect.x + rect.w - origin.x],
    [-dir.y, origin.y - rect.y],
    [dir.y, rect.y + rect.h - origin.y],
  ];
  for (const [p, q] of checks) {
    if (Math.abs(p) < 1e-12) {
      if (q < 0) return null;
    } else {
      const r = q / p;
      if (p < 0) {
        if (r > t1) return null;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return null;
        if (r < t1) t1 = r;
      }
    }
  }
  return t0 <= t1 ? [t0, t1] : null;
}

export interface GridBuild {
  /** Runs grouped per row, row-major; rows with no runs are omitted. */
  rows: Run[][];
  /** True if the point budget forced a coarser sample step. */
  clamped: boolean;
  /** The sample step actually used (≥ settings.grid.sampleStep). */
  effectiveStep: number;
}

/** Soft budget for raw grid samples; keeps synthesis well under ~200k points. */
export const SAMPLE_BUDGET = 200_000;

/**
 * Build sample runs for every grid row crossing the content rect.
 * The grid lives in artwork space, rotated by `angle` around the artwork
 * center; sampling inverse-rotates each point into image space.
 */
export function buildGrid(map: LumaMap, settings: Settings): GridBuild {
  const { grid, line, output } = settings;
  const rect = contentRect(output);
  const theta = (grid.angle * Math.PI) / 180;
  const dir: Vec2 = { x: Math.cos(theta), y: Math.sin(theta) };
  const perp: Vec2 = { x: -dir.y, y: dir.x };
  const center: Vec2 = { x: output.width / 2, y: output.height / 2 };

  // Row coverage: project content-rect corners onto perp axis.
  const corners: Vec2[] = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.w, y: rect.y },
    { x: rect.x, y: rect.y + rect.h },
    { x: rect.x + rect.w, y: rect.y + rect.h },
  ];
  let tMin = Infinity;
  let tMax = -Infinity;
  for (const c of corners) {
    const t = (c.x - center.x) * perp.x + (c.y - center.y) * perp.y;
    tMin = Math.min(tMin, t);
    tMax = Math.max(tMax, t);
  }

  const spacing = Math.max(0.1, grid.spacing);
  let step = Math.max(0.05, grid.sampleStep);

  // Guard rail: estimate total samples and coarsen the step if over budget.
  const diag = Math.hypot(rect.w, rect.h);
  const estRows = (tMax - tMin) / spacing + 1;
  const estimate = estRows * (diag / step + 1);
  let clamped = false;
  if (estimate > SAMPLE_BUDGET) {
    step = step * (estimate / SAMPLE_BUDGET);
    clamped = true;
  }

  const kMin = Math.ceil(tMin / spacing - grid.rowOffset);
  const kMax = Math.floor(tMax / spacing - grid.rowOffset);

  const floor = line.thresholdFloor;
  const ceiling = Math.max(line.thresholdCeiling, floor + 1e-4);
  const jitterAmp = line.jitter * spacing * 0.3;

  const rows: Run[][] = [];
  for (let k = kMin; k <= kMax; k++) {
    const t = (k + grid.rowOffset) * spacing;
    const origin: Vec2 = { x: center.x + t * perp.x, y: center.y + t * perp.y };
    const span = clipLineToRect(origin, dir, rect);
    if (!span) continue;
    const [s0, s1] = span;
    const jMin = Math.ceil(s0 / step - grid.colOffset);
    const jMax = Math.floor(s1 / step - grid.colOffset);
    if (jMax < jMin) continue;

    const rng = line.jitter > 0 ? mulberry32(mixSeed(line.seed | 0, k)) : null;
    const runs: Run[] = [];
    let current: Sample[] | null = null;
    for (let j = jMin; j <= jMax; j++) {
      const s = (j + grid.colOffset) * step;
      let x = origin.x + s * dir.x;
      let y = origin.y + s * dir.y;
      // consume one rng value per column so geometry is stable per row
      const jit = rng ? (rng() * 2 - 1) * jitterAmp : 0;
      x += jit * perp.x;
      y += jit * perp.y;
      const px = artworkToMapPx({ x, y }, rect, map.width, map.height);
      const lum = sampleBilinear(map, px.x, px.y);
      const dRaw = 1 - lum;
      if (dRaw < floor) {
        if (current && current.length > 0) {
          runs.push({ samples: current, dir, perp, row: k });
          current = null;
        }
        continue;
      }
      const d = Math.min(1, (dRaw - floor) / (ceiling - floor));
      if (!current) current = [];
      current.push({ x, y, s, d });
    }
    if (current && current.length > 0) runs.push({ samples: current, dir, perp, row: k });
    if (runs.length > 0) rows.push(runs);
  }
  return { rows, clamped, effectiveStep: step };
}
