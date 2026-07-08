import { smoothSegment } from '../curve';
import type { Vec2 } from '../types';
import type { Modulator } from './index';

function mid(a: Vec2, b: Vec2): Vec2 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * Stepped-thickness modulation: a posterized variant of Thickness. Darkness
 * is quantized to N discrete levels (line.steps), and consecutive samples
 * sharing a level are merged into one flat-width plateau reaching to the
 * midpoint with the neighbouring level — so a level change is an exact
 * right-angle riser and each run ends in a flat, perpendicular cap flush
 * with its first/last sample. N=2 uses only minWidth/maxWidth; N=50
 * approximates the continuous mode.
 *
 * The ribbon is always emitted as a sharp polygon: curve smoothing is
 * deliberately NOT applied here, because running it through the step corners
 * bulges the curve outside the bar (flared ends). The UI notes this.
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
      // Sharp centerline (no smoothing) to match the mode's stepped character.
      const center: Vec2[] = pts.map((p) => ({ x: p.x, y: p.y }));
      return { d: smoothSegment(center, 0, true), points: center.length };
    }
    const lo = Math.min(line.minWidth, line.maxWidth);
    const hi = Math.max(line.minWidth, line.maxWidth);
    const levels = Math.max(2, Math.round(line.steps)) - 1;
    const halfWidth = (d: number): number => {
      const level = Math.round(d * levels) / levels;
      return Math.max(0.005, (lo + level * (hi - lo)) / 2);
    };
    // Merge runs of equal quantized width into plateaus; each contributes two
    // top and two bottom vertices, so risers between plateaus are exactly
    // vertical and equal-level neighbours don't emit redundant points.
    const top: Vec2[] = [];
    const bottom: Vec2[] = [];
    let i = 0;
    while (i < n) {
      const hw = halfWidth(pts[i]!.d);
      let j = i;
      while (j + 1 < n && halfWidth(pts[j + 1]!.d) === hw) j++;
      const left = i === 0 ? pts[0]! : mid(pts[i - 1]!, pts[i]!);
      const right = j === n - 1 ? pts[n - 1]! : mid(pts[j]!, pts[j + 1]!);
      top.push({ x: left.x + run.perp.x * hw, y: left.y + run.perp.y * hw });
      top.push({ x: right.x + run.perp.x * hw, y: right.y + run.perp.y * hw });
      bottom.push({ x: left.x - run.perp.x * hw, y: left.y - run.perp.y * hw });
      bottom.push({ x: right.x - run.perp.x * hw, y: right.y - run.perp.y * hw });
      i = j + 1;
    }
    bottom.reverse();
    const d = smoothSegment(top, 0, true) + smoothSegment(bottom, 0, false) + 'Z';
    return { d, points: top.length + bottom.length };
  },
};
