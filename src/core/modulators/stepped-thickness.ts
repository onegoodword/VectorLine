import { smoothSegment } from '../curve';
import type { Vec2 } from '../types';
import type { Modulator } from './index';

/**
 * Stepped-thickness modulation: same filled-ribbon geometry as Thickness,
 * but darkness is quantized to N discrete levels before mapping to width —
 * a posterized halftone instead of a continuous gradient. N=2 uses only
 * minWidth/maxWidth; N=50 approximates the continuous mode. Curve smoothing
 * still rounds ribbon edges, so smoothing=0 gives a literal staircase.
 *
 * Plotter mode falls back to uniform-width centerlines, same as Thickness.
 */
export const steppedThickness: Modulator = {
  id: 'steps',
  label: 'Stepped Thickness',
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
    const levels = Math.max(2, Math.round(line.steps)) - 1;
    const top: Vec2[] = [];
    const bottom: Vec2[] = [];
    for (const p of pts) {
      const level = Math.round(p.d * levels) / levels;
      const hw = Math.max(0.005, (lo + level * (hi - lo)) / 2);
      top.push({ x: p.x + run.perp.x * hw, y: p.y + run.perp.y * hw });
      bottom.push({ x: p.x - run.perp.x * hw, y: p.y - run.perp.y * hw });
    }
    bottom.reverse();
    const d =
      smoothSegment(top, line.smoothing, true) + smoothSegment(bottom, line.smoothing, false) + 'Z';
    return { d, points: top.length + bottom.length };
  },
};
