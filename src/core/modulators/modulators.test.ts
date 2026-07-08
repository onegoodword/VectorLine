import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type LineSettings, type Run } from '../types';
import { MODULATORS, type ModulatorContext } from './index';

function makeRun(ds: Array<number>, step = 2): Run {
  return {
    samples: ds.map((d, i) => ({ x: i * step, y: 0, s: i * step, d })),
    dir: { x: 1, y: 0 },
    perp: { x: 0, y: 1 },
    row: 0,
  };
}

function ctx(patch: Partial<LineSettings> = {}): ModulatorContext {
  return {
    line: { ...DEFAULT_SETTINGS.line, ...patch },
    spacing: 6,
    sampleStep: 2,
  };
}

describe('thickness', () => {
  it('emits a closed filled ribbon', () => {
    const rp = MODULATORS.thickness.renderRun(makeRun([0.5, 0.8, 1]), ctx());
    expect(rp).not.toBeNull();
    expect(rp!.d.startsWith('M')).toBe(true);
    expect(rp!.d.endsWith('Z')).toBe(true);
    expect(MODULATORS.thickness.pathKind(false)).toBe('fill');
  });
  it('ribbon width tracks darkness', () => {
    // polyline (smoothing 0) so coordinates are exact
    const rp = MODULATORS.thickness.renderRun(
      makeRun([1, 1, 1]),
      ctx({ smoothing: 0, minWidth: 1, maxWidth: 4 }),
    );
    // at d=1 half-width is 2: top edge at y=2, bottom at y=-2
    expect(rp!.d).toContain(' 2');
    expect(rp!.d).toContain('-2');
  });
  it('falls back to centerline strokes in plotter mode', () => {
    const rp = MODULATORS.thickness.renderRun(makeRun([1, 1, 1]), ctx({ plotterMode: true, smoothing: 0 }));
    expect(rp!.d.endsWith('Z')).toBe(false);
    expect(MODULATORS.thickness.pathKind(true)).toBe('stroke');
  });
  it('skips single-sample runs', () => {
    expect(MODULATORS.thickness.renderRun(makeRun([1]), ctx())).toBeNull();
  });
});

describe('steps', () => {
  it('emits a closed filled ribbon', () => {
    const rp = MODULATORS.steps.renderRun(makeRun([0.5, 0.8, 1]), ctx());
    expect(rp).not.toBeNull();
    expect(rp!.d.startsWith('M')).toBe(true);
    expect(rp!.d.endsWith('Z')).toBe(true);
    expect(MODULATORS.steps.pathKind(false)).toBe('fill');
  });
  it('quantizes width to exactly N levels across the darkness range', () => {
    const n = 100;
    const ds = Array.from({ length: n }, (_, i) => i / (n - 1));
    const rp = MODULATORS.steps.renderRun(
      makeRun(ds),
      ctx({ smoothing: 0, minWidth: 0, maxWidth: 10, steps: 3 }),
    );
    const ys = [...rp!.d.matchAll(/-?[\d.]+ (-?[\d.]+)/g)].map((m) => Number(m[1]));
    const distinct = new Set(ys.map((y) => Math.abs(y)));
    expect(distinct.size).toBe(3); // 0, 2.5, 5 (half-widths for 3 levels)
  });
  it('at steps=2 uses only minWidth and maxWidth', () => {
    const rp = MODULATORS.steps.renderRun(
      makeRun([0, 0.2, 0.4, 0.6, 1]),
      ctx({ smoothing: 0, minWidth: 1, maxWidth: 5, steps: 2 }),
    );
    const ys = [...rp!.d.matchAll(/-?[\d.]+ (-?[\d.]+)/g)].map((m) => Math.abs(Number(m[1])));
    const distinct = new Set(ys);
    expect(distinct).toEqual(new Set([0.5, 2.5])); // half-widths of minWidth=1, maxWidth=5
  });
  it('steps between levels as a right-angle riser, not a diagonal taper', () => {
    const rp = MODULATORS.steps.renderRun(
      makeRun([0, 0, 1, 1]),
      ctx({ smoothing: 0, minWidth: 2, maxWidth: 10, steps: 2 }),
    );
    const coords = [...rp!.d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map(
      (m) => [Number(m[1]), Number(m[2])] as const,
    );
    const hasRiser = coords.some(
      (p, i) => i > 0 && p[0] === coords[i - 1]![0] && p[1] !== coords[i - 1]![1],
    );
    const hasPlateau = coords.some(
      (p, i) => i > 0 && p[1] === coords[i - 1]![1] && p[0] !== coords[i - 1]![0],
    );
    expect(hasRiser).toBe(true);
    expect(hasPlateau).toBe(true);
  });
  it('run boundary caps stay flush with the first/last sample, no overshoot', () => {
    const rp = MODULATORS.steps.renderRun(makeRun([1, 1, 1], 2), ctx({ smoothing: 0 }));
    const xs = [...rp!.d.matchAll(/[ML](-?[\d.]+) -?[\d.]+/g)].map((m) => Number(m[1]));
    expect(Math.min(...xs)).toBe(0);
    expect(Math.max(...xs)).toBe(4);
  });
  it('falls back to centerline strokes in plotter mode', () => {
    const rp = MODULATORS.steps.renderRun(makeRun([1, 1, 1]), ctx({ plotterMode: true, smoothing: 0 }));
    expect(rp!.d.endsWith('Z')).toBe(false);
    expect(MODULATORS.steps.pathKind(true)).toBe('stroke');
  });
  it('skips single-sample runs', () => {
    expect(MODULATORS.steps.renderRun(makeRun([1]), ctx())).toBeNull();
  });
});

describe('amplitude', () => {
  it('is straight at zero darkness', () => {
    const rp = MODULATORS.amplitude.renderRun(makeRun([0, 0, 0, 0]), ctx());
    // every y coordinate should be 0
    const ys = [...rp!.d.matchAll(/-?[\d.]+ (-?[\d.]+)/g)].map((m) => Number(m[1]));
    for (const y of ys) expect(Math.abs(y)).toBeLessThan(1e-6);
  });
  it('caps amplitude at spacing/2', () => {
    const rp = MODULATORS.amplitude.renderRun(
      makeRun([1, 1, 1, 1, 1, 1, 1, 1]),
      ctx({ maxAmplitude: 100 }),
    );
    // anchors cap at spacing/2 = 3; Bézier control points may overshoot ≤2%
    const ys = [...rp!.d.matchAll(/-?[\d.]+ (-?[\d.]+)/g)].map((m) => Number(m[1]));
    for (const y of ys) expect(Math.abs(y)).toBeLessThanOrEqual(3 * 1.02);
  });
});

describe('frequency', () => {
  it('accumulates no phase where darkness is 0 (straight line)', () => {
    const rp = MODULATORS.frequency.renderRun(makeRun([0, 0, 0, 0]), ctx());
    const ys = [...rp!.d.matchAll(/-?[\d.]+ (-?[\d.]+)/g)].map((m) => Number(m[1]));
    for (const y of ys) expect(Math.abs(y)).toBeLessThan(1e-6);
  });
  it('emits more points than input samples (adaptive subsampling)', () => {
    const rp = MODULATORS.frequency.renderRun(
      makeRun([1, 1, 1, 1]),
      ctx({ waveFrequency: 4 }),
    );
    expect(rp!.points).toBeGreaterThan(8);
  });
});

describe('dashes', () => {
  it('emits real subpaths, not dasharray', () => {
    const rp = MODULATORS.dashes.renderRun(makeRun([0.5, 0, 0.5]), ctx());
    expect(rp!.d.match(/M/g)!.length).toBe(2);
    expect(rp!.d).not.toContain('dasharray');
  });
  it('merges near-solid neighbors into one subpath', () => {
    const rp = MODULATORS.dashes.renderRun(makeRun([1, 1, 1, 1]), ctx());
    expect(rp!.d.match(/M/g)!.length).toBe(1);
  });
  it('duty cycle scales with darkness', () => {
    const light = MODULATORS.dashes.renderRun(makeRun([0.2, 0, 0.2, 0]), ctx());
    // dash of d=0.2 over cell 2 → length 0.4 centered on sample
    expect(light!.d).toContain('M-0.2 0L0.2 0');
  });
  it('returns null when everything is below minimum length', () => {
    expect(MODULATORS.dashes.renderRun(makeRun([0.01, 0.02]), ctx())).toBeNull();
  });
});
