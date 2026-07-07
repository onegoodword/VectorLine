/** All settings that define an artwork. Serializable, deterministic. */

export type ModeId = 'thickness' | 'amplitude' | 'frequency' | 'dashes';
export type Unit = 'mm' | 'px';

export interface GridSettings {
  /** Distance between line rows, artwork units. */
  spacing: number;
  /** Distance between samples along a line, artwork units. */
  sampleStep: number;
  /** Rotation of the line grid, degrees. */
  angle: number;
  /** Phase offset of rows, fraction of spacing (0–1). */
  rowOffset: number;
  /** Phase offset of sample columns, fraction of sampleStep (0–1). */
  colOffset: number;
}

export interface LineSettings {
  mode: ModeId;
  /** Ribbon width at d=0 (thickness mode); stroke width in other modes. */
  minWidth: number;
  /** Ribbon width at d=1 (thickness mode). */
  maxWidth: number;
  /** Cycles per spacing unit of distance along the line. */
  waveFrequency: number;
  /** Peak wave amplitude, artwork units. */
  maxAmplitude: number;
  /** 0 = polyline, 1 = full Catmull-Rom smoothing. */
  smoothing: number;
  /** Darkness below this emits nothing (white dropout). */
  thresholdFloor: number;
  /** Darkness at/above this maps to full effect. */
  thresholdCeiling: number;
  /** Perpendicular jitter, fraction of spacing. */
  jitter: number;
  /** PRNG seed for jitter. */
  seed: number;
  /** Single-stroke centerlines only, fill="none". */
  plotterMode: boolean;
}

export interface ToneSettings {
  brightness: number; // −1..1 offset
  contrast: number; // −1..1, pivot 0.5
  gamma: number; // 0.2..5
  blackPoint: number; // levels clamp low, 0..1
  whitePoint: number; // levels clamp high, 0..1
  invert: boolean;
}

export interface ColorSettings {
  line: string;
  /** CSS color or the literal string 'transparent'. */
  background: string;
}

export interface OutputSettings {
  width: number;
  height: number;
  unit: Unit;
  /** Margin on all sides, % of the shorter artwork side (0–25). */
  margin: number;
}

export interface Settings {
  grid: GridSettings;
  line: LineSettings;
  tone: ToneSettings;
  color: ColorSettings;
  output: OutputSettings;
}

export const DEFAULT_SETTINGS: Settings = {
  grid: { spacing: 6, sampleStep: 3, angle: 0, rowOffset: 0, colOffset: 0 },
  line: {
    mode: 'thickness',
    minWidth: 0.2,
    maxWidth: 5,
    waveFrequency: 0.6,
    maxAmplitude: 2.4,
    smoothing: 0.6,
    thresholdFloor: 0.03,
    thresholdCeiling: 1,
    jitter: 0,
    seed: 1,
    plotterMode: false,
  },
  tone: { brightness: 0, contrast: 0, gamma: 1, blackPoint: 0, whitePoint: 1, invert: false },
  color: { line: '#111111', background: '#ffffff' },
  output: { width: 210, height: 297, unit: 'mm', margin: 5 },
};

/** Deep-clone settings (all values are plain data). */
export function cloneSettings(s: Settings): Settings {
  return JSON.parse(JSON.stringify(s)) as Settings;
}

/** A grayscale luminance map, values 0–1, row-major. */
export interface LumaMap {
  width: number;
  height: number;
  data: Float32Array;
}

export interface Vec2 {
  x: number;
  y: number;
}

/** One sampled point along a grid row, in artwork coordinates. */
export interface Sample {
  x: number;
  y: number;
  /** Distance along the line from grid center, artwork units. */
  s: number;
  /** Darkness 0–1 after tone + threshold remap. */
  d: number;
}

/** A run of consecutive above-threshold samples on one row. */
export interface Run {
  samples: Sample[];
  /** Unit direction of the line. */
  dir: Vec2;
  /** Unit perpendicular (dir rotated +90°). */
  perp: Vec2;
  /** Row index, for deterministic per-row seeding. */
  row: number;
}

export type PathKind = 'fill' | 'stroke';

export interface PathSpec {
  d: string;
  kind: PathKind;
}

export interface GeometryResult {
  paths: PathSpec[];
  /** Total emitted anchor points, for guard rails. */
  pointCount: number;
  /** True if the point budget forced coarser sampling. */
  clamped: boolean;
}
