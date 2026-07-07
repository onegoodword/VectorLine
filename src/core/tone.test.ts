import { describe, expect, it } from 'vitest';
import { applyTone, toneValue } from './tone';
import { DEFAULT_SETTINGS, type ToneSettings } from './types';

const base: ToneSettings = { ...DEFAULT_SETTINGS.tone };

describe('toneValue', () => {
  it('is identity at defaults', () => {
    for (const v of [0, 0.25, 0.5, 0.75, 1]) {
      expect(toneValue(v, base)).toBeCloseTo(v, 6);
    }
  });
  it('brightness offsets and clamps', () => {
    expect(toneValue(0.5, { ...base, brightness: 0.2 })).toBeCloseTo(0.7, 6);
    expect(toneValue(0.9, { ...base, brightness: 0.5 })).toBe(1);
  });
  it('contrast pivots around 0.5', () => {
    const t = { ...base, contrast: 0.5 };
    expect(toneValue(0.5, t)).toBeCloseTo(0.5, 6);
    expect(toneValue(0.75, t)).toBeGreaterThan(0.75);
    expect(toneValue(0.25, t)).toBeLessThan(0.25);
    const flat = { ...base, contrast: -1 };
    expect(toneValue(0.1, flat)).toBeCloseTo(0.5, 6);
    expect(toneValue(0.9, flat)).toBeCloseTo(0.5, 6);
  });
  it('gamma > 1 lightens midtones', () => {
    expect(toneValue(0.25, { ...base, gamma: 2 })).toBeCloseTo(0.5, 6);
  });
  it('levels clamp remaps black/white points', () => {
    const t = { ...base, blackPoint: 0.2, whitePoint: 0.8 };
    expect(toneValue(0.2, t)).toBeCloseTo(0, 5);
    expect(toneValue(0.8, t)).toBeCloseTo(1, 5);
    expect(toneValue(0.5, t)).toBeCloseTo(0.5, 5);
  });
  it('invert flips last', () => {
    expect(toneValue(0.3, { ...base, invert: true })).toBeCloseTo(0.7, 6);
  });
});

describe('applyTone', () => {
  it('matches per-value tone within LUT tolerance', () => {
    const data = new Float32Array([0, 0.123, 0.5, 0.876, 1]);
    const t: ToneSettings = { ...base, brightness: 0.1, contrast: 0.3, gamma: 1.4 };
    const out = applyTone({ width: 5, height: 1, data }, t);
    for (let i = 0; i < data.length; i++) {
      expect(out.data[i]!).toBeCloseTo(toneValue(data[i]!, t), 3);
    }
  });
});
