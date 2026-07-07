import { smoothSegment } from '../curve';
import type { Vec2 } from '../types';
import { resampleRun, type Modulator } from './index';

/**
 * Wave-frequency modulation: constant amplitude, local frequency scales with
 * darkness (dense wiggles where dark, straight where light). Implemented by
 * accumulating phase over an adaptively subsampled walk so high-frequency
 * regions stay smooth.
 */
export const frequency: Modulator = {
  id: 'frequency',
  label: 'Wave frequency',
  plotterCapable: true,
  pathKind() {
    return 'stroke';
  },
  renderRun(run, ctx) {
    const pts = run.samples;
    if (pts.length < 2) return null;
    const { line, spacing, sampleStep } = ctx;
    const ampMax = Math.min(line.maxAmplitude, spacing / 2);
    // Base walk fine enough for the highest possible local frequency.
    const fMax = Math.max(0.01, line.waveFrequency) / spacing; // cycles/unit at d=1
    const minWavelength = 1 / fMax;
    const ds = Math.max(sampleStep / 16, Math.min(sampleStep / 2, minWavelength / 10));
    const fine = resampleRun(run, ds);
    const out: Vec2[] = [];
    let phase = 0;
    let prevS = fine[0]!.s;
    for (const p of fine) {
      const f = fMax * p.d;
      phase += 2 * Math.PI * f * (p.s - prevS);
      prevS = p.s;
      const a = ampMax * Math.sin(phase);
      out.push({ x: p.x + run.perp.x * a, y: p.y + run.perp.y * a });
    }
    const smooth = Math.max(line.smoothing, 0.5);
    return { d: smoothSegment(out, smooth, true), points: out.length };
  },
};
