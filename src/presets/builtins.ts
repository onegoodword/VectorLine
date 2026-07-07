import type { Settings } from '../core/types';

/** Recursive partial of Settings for preset definitions. */
export type PresetPatch = {
  [G in keyof Settings]?: Partial<Settings[G]>;
};

export interface BuiltinPreset {
  name: string;
  patch: PresetPatch;
}

export const BUILTIN_PRESETS: BuiltinPreset[] = [
  {
    name: 'Fine Engraving',
    patch: {
      grid: { spacing: 2.2, sampleStep: 1.1, angle: 0 },
      line: { mode: 'thickness', minWidth: 0.08, maxWidth: 1.9, smoothing: 0.7 },
      tone: { contrast: 0.1 },
    },
  },
  {
    name: 'Bold Poster Waves',
    patch: {
      grid: { spacing: 12, sampleStep: 2, angle: -12 },
      line: {
        mode: 'amplitude',
        minWidth: 1.6,
        maxAmplitude: 5.5,
        waveFrequency: 0.45,
        smoothing: 0.85,
      },
      tone: { contrast: 0.25 },
    },
  },
  {
    name: 'Plotter Sketch',
    patch: {
      grid: { spacing: 5, sampleStep: 2, angle: 3 },
      line: {
        mode: 'frequency',
        plotterMode: true,
        minWidth: 0.4,
        waveFrequency: 1.6,
        maxAmplitude: 2.2,
        jitter: 0.15,
        seed: 7,
      },
    },
  },
  {
    name: 'Newsprint Dashes',
    patch: {
      grid: { spacing: 4, sampleStep: 1.6, angle: 45 },
      line: { mode: 'dashes', minWidth: 0.9, smoothing: 0 },
      tone: { contrast: 0.15 },
    },
  },
  {
    name: 'Silk Diagonal',
    patch: {
      grid: { spacing: 8, sampleStep: 2.5, angle: 45 },
      line: { mode: 'thickness', minWidth: 0.15, maxWidth: 6.8, smoothing: 0.8 },
      tone: { gamma: 1.15 },
    },
  },
  {
    name: 'Seismograph',
    patch: {
      grid: { spacing: 7, sampleStep: 1.2, angle: 0 },
      line: {
        mode: 'frequency',
        minWidth: 0.25,
        waveFrequency: 3.2,
        maxAmplitude: 1.7,
        smoothing: 0.9,
      },
      tone: { contrast: 0.2 },
    },
  },
];

/** Deep-merge a preset patch over base settings, returning a new object. */
export function applyPatch(base: Settings, patch: PresetPatch): Settings {
  const out = JSON.parse(JSON.stringify(base)) as Settings;
  for (const g of Object.keys(patch) as Array<keyof Settings>) {
    Object.assign(out[g] as object, patch[g]);
  }
  return out;
}
