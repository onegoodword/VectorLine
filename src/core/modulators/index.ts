import type { LineSettings, ModeId, PathKind, Run } from '../types';
import { thickness } from './thickness';
import { steppedThickness } from './stepped-thickness';
import { amplitude } from './amplitude';
import { frequency } from './frequency';
import { dashes } from './dashes';

export interface ModulatorContext {
  line: LineSettings;
  spacing: number;
  sampleStep: number;
}

export interface RunPath {
  /** SVG path data for this run (one or more subpaths). */
  d: string;
  /** Anchor points emitted, for guard rails. */
  points: number;
}

/**
 * A modulation mode. Renders one run (contiguous above-threshold samples
 * on a grid row) at a time; the pipeline joins runs into one path per row.
 */
export interface Modulator {
  id: ModeId;
  label: string;
  /** Whether this mode natively emits plotter-safe centerlines. */
  plotterCapable: boolean;
  /** Path kind emitted given the plotter flag. */
  pathKind(plotter: boolean): PathKind;
  renderRun(run: Run, ctx: ModulatorContext): RunPath | null;
}

export const MODULATORS: Record<ModeId, Modulator> = {
  thickness,
  steps: steppedThickness,
  amplitude,
  frequency,
  dashes,
};

/** Linear-interpolated resample of a run at spacing `ds` along the line. */
export function resampleRun(
  run: Run,
  ds: number,
): Array<{ x: number; y: number; s: number; d: number }> {
  const src = run.samples;
  const first = src[0]!;
  const last = src[src.length - 1]!;
  if (src.length === 1) return [{ x: first.x, y: first.y, s: first.s, d: first.d }];
  const span = last.s - first.s;
  const n = Math.max(1, Math.round(span / ds));
  const out: Array<{ x: number; y: number; s: number; d: number }> = [];
  let seg = 0;
  for (let i = 0; i <= n; i++) {
    const s = first.s + (span * i) / n;
    while (seg < src.length - 2 && src[seg + 1]!.s < s) seg++;
    const a = src[seg]!;
    const b = src[seg + 1]!;
    const f = b.s === a.s ? 0 : Math.min(1, Math.max(0, (s - a.s) / (b.s - a.s)));
    out.push({
      x: a.x + (b.x - a.x) * f,
      y: a.y + (b.y - a.y) * f,
      s,
      d: a.d + (b.d - a.d) * f,
    });
  }
  return out;
}
