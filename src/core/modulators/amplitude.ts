import { smoothSegment } from '../curve';
import type { Vec2 } from '../types';
import { resampleRun, type Modulator } from './index';

/**
 * Wave-amplitude modulation: constant stroke width, sine wave whose
 * amplitude scales with darkness. Phase is a global function of distance
 * along the line so waves stay grid-true across gaps.
 */
export const amplitude: Modulator = {
  id: 'amplitude',
  label: 'Wave amplitude',
  plotterCapable: true,
  pathKind() {
    return 'stroke';
  },
  renderRun(run, ctx) {
    const pts = run.samples;
    if (pts.length < 2) return null;
    const { line, spacing, sampleStep } = ctx;
    const freq = Math.max(0.01, line.waveFrequency) / spacing; // cycles per unit
    const wavelength = 1 / freq;
    const ds = Math.max(sampleStep / 16, Math.min(sampleStep, wavelength / 8));
    const ampMax = Math.min(line.maxAmplitude, spacing / 2);
    const fine = resampleRun(run, ds);
    const out: Vec2[] = fine.map((p) => {
      const a = ampMax * p.d * Math.sin(2 * Math.PI * freq * p.s);
      return { x: p.x + run.perp.x * a, y: p.y + run.perp.y * a };
    });
    // waves are inherently curved; keep at least mild smoothing
    const smooth = Math.max(line.smoothing, 0.5);
    return { d: smoothSegment(out, smooth, true), points: out.length };
  },
};
