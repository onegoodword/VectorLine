import { smoothSegment } from '../curve';
import type { Vec2 } from '../types';
import type { Modulator } from './index';

function mid(a: Vec2, b: Vec2): Vec2 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * Stepped-thickness modulation: a posterized variant of Thickness. Darkness
 * is quantized to N discrete levels (line.steps), and each sample owns a
 * flat-width plateau out to the midpoint with its neighbors — so a level
 * change becomes a right-angle riser, not a diagonal wedge. N=2 uses only
 * minWidth/maxWidth; N=50 approximates the continuous mode. Curve smoothing
 * rounds plateau/riser corners; smoothing=0 gives an exact step histogram.
 * Run boundaries stay flush with the first/last sample — no half-cell
 * overshoot past where the darkness threshold was crossed.
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
    const n = pts.length;
    if (n < 2) return null;
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
    for (let i = 0; i < n; i++) {
      const p = pts[i]!;
      const level = Math.round(p.d * levels) / levels;
      const hw = Math.max(0.005, (lo + level * (hi - lo)) / 2);
      const left = i === 0 ? p : mid(pts[i - 1]!, p);
      const right = i === n - 1 ? p : mid(p, pts[i + 1]!);
      top.push({ x: left.x + run.perp.x * hw, y: left.y + run.perp.y * hw });
      top.push({ x: right.x + run.perp.x * hw, y: right.y + run.perp.y * hw });
      bottom.push({ x: left.x - run.perp.x * hw, y: left.y - run.perp.y * hw });
      bottom.push({ x: right.x - run.perp.x * hw, y: right.y - run.perp.y * hw });
    }
    bottom.reverse();
    const d =
      smoothSegment(top, line.smoothing, true) + smoothSegment(bottom, line.smoothing, false) + 'Z';
    return { d, points: top.length + bottom.length };
  },
};
