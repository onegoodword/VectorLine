import { describe, expect, it } from 'vitest';
import { buildGrid, clipLineToRect, contentRect } from './grid';
import { cloneSettings, DEFAULT_SETTINGS, type LumaMap, type Settings } from './types';

function flatMap(value: number, w = 8, h = 8): LumaMap {
  return { width: w, height: h, data: new Float32Array(w * h).fill(value) };
}

function settings(patch: (s: Settings) => void): Settings {
  const s = cloneSettings(DEFAULT_SETTINGS);
  s.output = { width: 100, height: 100, unit: 'mm', margin: 0 };
  s.grid = { spacing: 10, sampleStep: 5, angle: 0, rowOffset: 0, colOffset: 0 };
  s.line.thresholdFloor = 0.03;
  patch(s);
  return s;
}

describe('contentRect', () => {
  it('insets by margin % of the shorter side', () => {
    const r = contentRect({ width: 200, height: 100, unit: 'mm', margin: 10 });
    expect(r).toEqual({ x: 10, y: 10, w: 180, h: 80 });
  });
});

describe('clipLineToRect', () => {
  const rect = { x: 0, y: 0, w: 10, h: 10 };
  it('clips a horizontal line through the middle', () => {
    const span = clipLineToRect({ x: 5, y: 5 }, { x: 1, y: 0 }, rect);
    expect(span).toEqual([-5, 5]);
  });
  it('returns null for a line missing the rect', () => {
    expect(clipLineToRect({ x: 5, y: 20 }, { x: 1, y: 0 }, rect)).toBeNull();
  });
});

describe('buildGrid', () => {
  it('produces horizontal rows at angle 0 on a dark image', () => {
    const build = buildGrid(flatMap(0), settings(() => {}));
    expect(build.rows.length).toBeGreaterThanOrEqual(9);
    for (const runs of build.rows) {
      for (const run of runs) {
        const ys = new Set(run.samples.map((p) => p.y.toFixed(6)));
        expect(ys.size).toBe(1); // straight, horizontal
      }
    }
  });

  it('skips everything on a white image (below threshold floor)', () => {
    const build = buildGrid(flatMap(1), settings(() => {}));
    expect(build.rows.length).toBe(0);
  });

  it('keeps lines straight and parallel at 45° and covers the whole rect', () => {
    const build = buildGrid(flatMap(0), settings((s) => (s.grid.angle = 45)));
    const dir = { x: Math.cos(Math.PI / 4), y: Math.sin(Math.PI / 4) };
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const runs of build.rows) {
      for (const run of runs) {
        const p0 = run.samples[0]!;
        for (const p of run.samples) {
          // collinearity with the grid direction
          const cross = (p.x - p0.x) * dir.y - (p.y - p0.y) * dir.x;
          expect(Math.abs(cross)).toBeLessThan(1e-6);
          minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
          minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
        }
      }
    }
    // samples reach into all four corner regions of the 100×100 rect
    expect(minX).toBeLessThan(10);
    expect(maxX).toBeGreaterThan(90);
    expect(minY).toBeLessThan(10);
    expect(maxY).toBeGreaterThan(90);
  });

  it('inverse-samples the image: dark left half yields runs only on the left', () => {
    const w = 10, h = 10;
    const data = new Float32Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) data[y * w + x] = x < w / 2 ? 0 : 1;
    const build = buildGrid({ width: w, height: h, data }, settings(() => {}));
    expect(build.rows.length).toBeGreaterThan(0);
    for (const runs of build.rows) {
      for (const run of runs) {
        for (const p of run.samples) expect(p.x).toBeLessThan(60);
      }
    }
  });

  it('clamps the sample step when the estimate exceeds the budget', () => {
    const build = buildGrid(
      flatMap(0),
      settings((s) => {
        s.grid.spacing = 0.5;
        s.grid.sampleStep = 0.25;
        s.output.width = 1200;
        s.output.height = 1200;
      }),
    );
    expect(build.clamped).toBe(true);
    expect(build.effectiveStep).toBeGreaterThan(0.25);
  });

  it('is deterministic with jitter enabled', () => {
    const s = settings((x) => {
      x.line.jitter = 0.5;
      x.line.seed = 42;
    });
    const a = buildGrid(flatMap(0.3), s);
    const b = buildGrid(flatMap(0.3), s);
    expect(JSON.stringify(a.rows)).toBe(JSON.stringify(b.rows));
  });
});
