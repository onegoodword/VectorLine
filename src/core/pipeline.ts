import { buildGrid, contentRect } from './grid';
import { MODULATORS, type ModulatorContext } from './modulators/index';
import { buildSvg } from './svg-builder';
import { applyTone } from './tone';
import type { GeometryResult, LumaMap, PathSpec, Settings } from './types';

/** Hard ceiling on emitted anchor points; synthesis truncates beyond it. */
export const POINT_LIMIT = 220_000;

/**
 * Synthesize line geometry from a tone-adjusted luminance map.
 * One PathSpec per grid row (runs on a row join as subpaths).
 */
export function synthesize(tonedMap: LumaMap, settings: Settings): GeometryResult {
  const { rows, clamped } = buildGrid(tonedMap, settings);
  const modulator = MODULATORS[settings.line.mode];
  const ctx: ModulatorContext = {
    line: settings.line,
    spacing: Math.max(0.1, settings.grid.spacing),
    sampleStep: Math.max(0.05, settings.grid.sampleStep),
  };
  const kind = modulator.pathKind(settings.line.plotterMode);
  const paths: PathSpec[] = [];
  let pointCount = 0;
  let truncated = false;
  for (const runs of rows) {
    let d = '';
    for (const run of runs) {
      const rp = modulator.renderRun(run, ctx);
      if (!rp) continue;
      d += rp.d;
      pointCount += rp.points;
    }
    if (d !== '') paths.push({ d, kind });
    if (pointCount > POINT_LIMIT) {
      truncated = true;
      break;
    }
  }
  return { paths, pointCount, clamped: clamped || truncated };
}

/** Full core pipeline: tone → geometry → SVG string. */
export function generateSvg(
  lumaMap: LumaMap,
  settings: Settings,
): { svg: string; geometry: GeometryResult } {
  const toned = applyTone(lumaMap, settings.tone);
  const geometry = synthesize(toned, settings);
  return { svg: buildSvg(settings, geometry), geometry };
}

/**
 * Luma-map resolution needed for the current settings: about two samples per
 * smallest sampling interval across the content rect, clamped to sane bounds.
 * Returns the target size of the downsampled raster (long edge in px).
 */
export function requiredMapSize(
  settings: Settings,
  srcW: number,
  srcH: number,
): { width: number; height: number } {
  const rect = contentRect(settings.output);
  const interval = Math.max(
    0.25,
    Math.min(settings.grid.sampleStep, settings.grid.spacing) / 2,
  );
  const scale = Math.max(rect.w / srcW, rect.h / srcH); // cover: units per px
  const needed = scale / interval; // px per (interval/1) — ratio of needed density
  let w = Math.round(srcW * Math.min(1, needed));
  let h = Math.round(srcH * Math.min(1, needed));
  const MAX = 1600;
  const longEdge = Math.max(w, h);
  if (longEdge > MAX) {
    w = Math.round((w * MAX) / longEdge);
    h = Math.round((h * MAX) / longEdge);
  }
  return { width: Math.max(8, w), height: Math.max(8, h) };
}
