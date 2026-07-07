import { fmt } from '../curve';
import type { Run, Vec2 } from '../types';
import type { Modulator } from './index';

/** Interpolate the (possibly jittered) sample chain at distance s.
 * Beyond the chain ends, extrapolate along the grid direction so edge
 * dashes keep their full duty cycle. */
function pointAt(run: Run, s: number): Vec2 {
  const src = run.samples;
  const first = src[0]!;
  const last = src[src.length - 1]!;
  if (s < first.s) {
    return { x: first.x + (s - first.s) * run.dir.x, y: first.y + (s - first.s) * run.dir.y };
  }
  if (s > last.s) {
    return { x: last.x + (s - last.s) * run.dir.x, y: last.y + (s - last.s) * run.dir.y };
  }
  let seg = 0;
  while (seg < src.length - 2 && src[seg + 1]!.s < s) seg++;
  const a = src[seg]!;
  const b = src[Math.min(src.length - 1, seg + 1)]!;
  const f = b.s === a.s ? 0 : Math.min(1, Math.max(0, (s - a.s) / (b.s - a.s)));
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}

/**
 * Dash-density modulation: constant width, the line breaks into dashes whose
 * duty cycle scales with darkness. Emits real subpath segments (not
 * stroke-dasharray) so plotter output is honest geometry. Each sample owns a
 * cell of length sampleStep centered on it; adjacent near-full cells merge
 * into continuous strokes.
 */
export const dashes: Modulator = {
  id: 'dashes',
  label: 'Dash density',
  plotterCapable: true,
  pathKind() {
    return 'stroke';
  },
  renderRun(run, ctx) {
    const { sampleStep } = ctx;
    const minLen = sampleStep * 0.04;
    const mergeEps = sampleStep * 0.02;
    let d = '';
    let points = 0;
    let start = 0;
    let end = 0;
    let open = false;
    const flush = () => {
      if (!open) return;
      const p0 = pointAt(run, start);
      const p1 = pointAt(run, end);
      d += `M${fmt(p0.x)} ${fmt(p0.y)}L${fmt(p1.x)} ${fmt(p1.y)}`;
      points += 2;
      open = false;
    };
    for (const p of run.samples) {
      const len = p.d * sampleStep;
      if (len < minLen) {
        flush();
        continue;
      }
      const s0 = p.s - len / 2;
      const s1 = p.s + len / 2;
      if (open && s0 <= end + mergeEps) {
        end = s1;
      } else {
        flush();
        start = s0;
        end = s1;
        open = true;
      }
    }
    flush();
    return d === '' ? null : { d, points };
  },
};
