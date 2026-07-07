import { smoothSegment } from '../curve';
import type { Vec2 } from '../types';
import type { Modulator } from './index';

/**
 * Thickness modulation: each run becomes a filled ribbon whose width tracks
 * darkness. SVG stroke width cannot vary along a path, so the ribbon is a
 * closed path: top edge out, bottom edge back.
 *
 * In plotter mode this mode cannot emit honest variable-width geometry, so it
 * falls back to uniform-width centerline strokes (the UI states this).
 */
export const thickness: Modulator = {
  id: 'thickness',
  label: 'Thickness',
  plotterCapable: false,
  pathKind(plotter) {
    return plotter ? 'stroke' : 'fill';
  },
  renderRun(run, ctx) {
    const pts = run.samples;
    if (pts.length < 2) return null;
    const { line } = ctx;
    if (line.plotterMode) {
      const center: Vec2[] = pts.map((p) => ({ x: p.x, y: p.y }));
      return { d: smoothSegment(center, line.smoothing, true), points: center.length };
    }
    const lo = Math.min(line.minWidth, line.maxWidth);
    const hi = Math.max(line.minWidth, line.maxWidth);
    const top: Vec2[] = [];
    const bottom: Vec2[] = [];
    for (const p of pts) {
      const hw = Math.max(0.005, (lo + p.d * (hi - lo)) / 2);
      top.push({ x: p.x + run.perp.x * hw, y: p.y + run.perp.y * hw });
      bottom.push({ x: p.x - run.perp.x * hw, y: p.y - run.perp.y * hw });
    }
    bottom.reverse();
    const d =
      smoothSegment(top, line.smoothing, true) + smoothSegment(bottom, line.smoothing, false) + 'Z';
    return { d, points: top.length + bottom.length };
  },
};
