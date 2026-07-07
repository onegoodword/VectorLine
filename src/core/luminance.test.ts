import { describe, expect, it } from 'vitest';
import { luminanceMap, sampleBilinear, srgbToLinear } from './luminance';
import type { LumaMap } from './types';

function rgba(pixels: Array<[number, number, number, number]>): Uint8ClampedArray {
  const out = new Uint8ClampedArray(pixels.length * 4);
  pixels.forEach((p, i) => out.set(p, i * 4));
  return out;
}

describe('srgbToLinear', () => {
  it('maps endpoints correctly', () => {
    expect(srgbToLinear(0)).toBe(0);
    expect(srgbToLinear(255)).toBeCloseTo(1, 10);
  });
  it('mid gray 128 is ~0.2158 linear', () => {
    expect(srgbToLinear(128)).toBeCloseTo(0.2158, 3);
  });
});

describe('luminanceMap', () => {
  it('white → 1, black → 0', () => {
    const m = luminanceMap(rgba([[255, 255, 255, 255], [0, 0, 0, 255]]), 2, 1);
    expect(m.data[0]).toBeCloseTo(1, 5);
    expect(m.data[1]).toBeCloseTo(0, 5);
  });
  it('uses Rec.709 weights: pure green is lighter than pure red', () => {
    const m = luminanceMap(rgba([[255, 0, 0, 255], [0, 255, 0, 255], [0, 0, 255, 255]]), 3, 1);
    expect(m.data[1]!).toBeGreaterThan(m.data[0]!);
    expect(m.data[0]!).toBeGreaterThan(m.data[2]!);
  });
  it('composites transparent pixels over white', () => {
    const m = luminanceMap(rgba([[0, 0, 0, 0]]), 1, 1);
    expect(m.data[0]).toBeCloseTo(1, 5);
  });
});

describe('sampleBilinear', () => {
  const map: LumaMap = { width: 2, height: 2, data: new Float32Array([0, 1, 0, 1]) };
  it('returns exact values at pixel centers', () => {
    expect(sampleBilinear(map, 0, 0)).toBe(0);
    expect(sampleBilinear(map, 1, 0)).toBe(1);
  });
  it('interpolates midpoints', () => {
    expect(sampleBilinear(map, 0.5, 0)).toBeCloseTo(0.5, 6);
    expect(sampleBilinear(map, 0.5, 0.5)).toBeCloseTo(0.5, 6);
  });
  it('clamps outside the map', () => {
    expect(sampleBilinear(map, -5, 0)).toBe(0);
    expect(sampleBilinear(map, 5, 0)).toBe(1);
  });
});
