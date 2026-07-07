import { describe, expect, it } from 'vitest';
import { generateSvg } from './pipeline';
import { sanitizeColor } from './svg-builder';
import { cloneSettings, DEFAULT_SETTINGS, type LumaMap, type Settings } from './types';

/** Fixed tiny test image: 4×4 vertical gradient, dark at top. */
function testMap(): LumaMap {
  const w = 4, h = 4;
  const data = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data[y * w + x] = y / (h - 1);
  return { width: w, height: h, data };
}

function testSettings(patch?: (s: Settings) => void): Settings {
  const s = cloneSettings(DEFAULT_SETTINGS);
  s.output = { width: 40, height: 40, unit: 'mm', margin: 5 };
  s.grid = { spacing: 8, sampleStep: 4, angle: 0, rowOffset: 0, colOffset: 0 };
  patch?.(s);
  return s;
}

describe('generateSvg', () => {
  it('produces byte-identical output for identical inputs', () => {
    const a = generateSvg(testMap(), testSettings());
    const b = generateSvg(testMap(), testSettings());
    expect(a.svg).toBe(b.svg);
  });

  it('matches the serialization snapshot for the fixed test image', () => {
    const { svg } = generateSvg(testMap(), testSettings());
    expect(svg).toMatchSnapshot();
  });

  it('is well-formed XML with viewBox and physical units', () => {
    const { svg } = generateSvg(testMap(), testSettings());
    expect(svg).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(svg).toContain('viewBox="0 0 40 40"');
    expect(svg).toContain('width="40mm"');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).not.toContain('class=');
    expect(svg).not.toContain('<style');
  });

  it('plotter mode emits only fill="none" stroked paths', () => {
    for (const mode of ['thickness', 'amplitude', 'frequency', 'dashes'] as const) {
      const { svg } = generateSvg(
        testMap(),
        testSettings((s) => {
          s.line.mode = mode;
          s.line.plotterMode = true;
        }),
      );
      expect(svg).toContain('fill="none"');
      // the only fill other than none/background rect is forbidden
      const fills = [...svg.matchAll(/fill="([^"]+)"/g)].map((m) => m[1]);
      expect(fills.filter((f) => f !== 'none' && f !== '#ffffff')).toEqual([]);
    }
  });

  it('omits the background rect when transparent', () => {
    const { svg } = generateSvg(
      testMap(),
      testSettings((s) => (s.color.background = 'transparent')),
    );
    expect(svg).not.toContain('<rect width="40" height="40"');
  });

  it('clips geometry with a clipPath sized to the content rect', () => {
    const { svg } = generateSvg(testMap(), testSettings());
    // margin 5% of 40 = 2
    expect(svg).toContain('<clipPath id="cp"><rect x="2" y="2" width="36" height="36"/>');
    expect(svg).toContain('clip-path="url(#cp)"');
  });
});

describe('sanitizeColor', () => {
  it('accepts hex, keywords, and functional notation', () => {
    expect(sanitizeColor('#A1B2C3', '#000')).toBe('#A1B2C3');
    expect(sanitizeColor('Transparent', '#000')).toBe('transparent');
    expect(sanitizeColor('rgb(1, 2, 3)', '#000')).toBe('rgb(1, 2, 3)');
  });
  it('rejects markup injection', () => {
    expect(sanitizeColor('"/><script>', '#111111')).toBe('#111111');
  });
});
