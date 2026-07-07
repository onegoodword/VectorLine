import './style.css';
import demoImageUrl from './assets/demo.jpg';
import type { ModeId, Settings, Unit } from './core/types';
import { DEFAULT_SETTINGS, cloneSettings } from './core/types';
import { MODULATORS } from './core/modulators/index';
import { applyPatch, BUILTIN_PRESETS } from './presets/builtins';
import { checkbox, color, note, section, select, slider, type Control } from './ui/controls';
import { copySvg, downloadPng, downloadSvg } from './ui/export';
import { isAcceptedFile, loadImageFromFile, loadImageFromUrl } from './ui/image';
import { decodeHash, encodeHash, parsePresetJson, presetJson } from './ui/presets';
import { Preview } from './ui/preview';
import { Renderer } from './ui/render';
import { SettingsStore } from './ui/store';

const $ = <T extends HTMLElement>(sel: string): T => {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`Missing element: ${sel}`);
  return el;
};

const store = new SettingsStore();
const previewHost = $('#preview') as HTMLElement;
const preview = new Preview(previewHost);
const statsEl = $('#stats') as HTMLOutputElement;
const warningEl = $('#warning') as HTMLParagraphElement;

let lastSvg = '';

const renderer = new Renderer((svg, stats) => {
  lastSvg = svg;
  const s = store.get();
  preview.setSvg(svg, s.output.width, s.output.height);
  statsEl.value = `${stats.paths} paths · ${stats.points.toLocaleString('en-US')} pts · ${stats.ms.toFixed(0)} ms`;
  if (stats.clamped) {
    warningEl.textContent =
      'Point budget reached — sampling was coarsened to keep the preview responsive. Increase spacing or sample step for full detail.';
    warningEl.hidden = false;
  } else {
    warningEl.hidden = true;
  }
});

/* ---------- sidebar controls ---------- */

const g = () => store.get();
const controls: Control[] = [];

function buildSidebar(): void {
  const sidebar = $('#sidebar');

  const gridSection = section('Grid', [
    slider('Spacing', { min: 0.5, max: 50, step: 0.1 }, () => g().grid.spacing, (v) => store.set('grid', 'spacing', v)),
    slider('Sample step', { min: 0.25, max: 20, step: 0.05 }, () => g().grid.sampleStep, (v) => store.set('grid', 'sampleStep', v)),
    slider('Angle °', { min: -90, max: 90, step: 0.5 }, () => g().grid.angle, (v) => store.set('grid', 'angle', v)),
    slider('Row offset', { min: 0, max: 1, step: 0.01 }, () => g().grid.rowOffset, (v) => store.set('grid', 'rowOffset', v)),
    slider('Column offset', { min: 0, max: 1, step: 0.01 }, () => g().grid.colOffset, (v) => store.set('grid', 'colOffset', v)),
  ]);

  const modeOptions = (Object.keys(MODULATORS) as ModeId[]).map((id) => ({
    value: id,
    label: MODULATORS[id].label,
  }));

  const lineSection = section('Line', [
    select('Modulation mode', modeOptions, () => g().line.mode, (v) => store.set('line', 'mode', v as ModeId)),
    checkbox('Plotter mode (centerlines only)', () => g().line.plotterMode, (v) => store.set('line', 'plotterMode', v)),
    note(
      'Thickness is fill-based; in plotter mode it falls back to uniform-width centerline strokes.',
      () => g().line.plotterMode && g().line.mode === 'thickness',
    ),
    slider('Min width / stroke width', { min: 0, max: 12, step: 0.02 }, () => g().line.minWidth, (v) => store.set('line', 'minWidth', v)),
    slider('Max width', { min: 0, max: 12, step: 0.02 }, () => g().line.maxWidth, (v) => store.set('line', 'maxWidth', v)),
    slider('Wave frequency', { min: 0.05, max: 5, step: 0.05 }, () => g().line.waveFrequency, (v) => store.set('line', 'waveFrequency', v)),
    slider('Max amplitude', { min: 0, max: 25, step: 0.1 }, () => g().line.maxAmplitude, (v) => store.set('line', 'maxAmplitude', v)),
    slider('Curve smoothing', { min: 0, max: 1, step: 0.01 }, () => g().line.smoothing, (v) => store.set('line', 'smoothing', v)),
    slider('Threshold floor', { min: 0, max: 1, step: 0.01 }, () => g().line.thresholdFloor, (v) => store.set('line', 'thresholdFloor', v)),
    slider('Threshold ceiling', { min: 0, max: 1, step: 0.01 }, () => g().line.thresholdCeiling, (v) => store.set('line', 'thresholdCeiling', v)),
    slider('Jitter', { min: 0, max: 1, step: 0.01 }, () => g().line.jitter, (v) => store.set('line', 'jitter', v)),
    slider('Jitter seed', { min: 0, max: 9999, step: 1 }, () => g().line.seed, (v) => store.set('line', 'seed', Math.round(v))),
  ]);

  const toneSection = section('Tone', [
    slider('Brightness', { min: -1, max: 1, step: 0.01 }, () => g().tone.brightness, (v) => store.set('tone', 'brightness', v)),
    slider('Contrast', { min: -1, max: 1, step: 0.01 }, () => g().tone.contrast, (v) => store.set('tone', 'contrast', v)),
    slider('Gamma', { min: 0.2, max: 5, step: 0.01 }, () => g().tone.gamma, (v) => store.set('tone', 'gamma', v)),
    slider('Black point', { min: 0, max: 1, step: 0.01 }, () => g().tone.blackPoint, (v) => store.set('tone', 'blackPoint', v)),
    slider('White point', { min: 0, max: 1, step: 0.01 }, () => g().tone.whitePoint, (v) => store.set('tone', 'whitePoint', v)),
    checkbox('Invert', () => g().tone.invert, (v) => store.set('tone', 'invert', v)),
  ]);

  const colorSection = section('Color', [
    color('Line color', () => g().color.line, (v) => store.set('color', 'line', v)),
    color('Background', () => g().color.background, (v) => store.set('color', 'background', v), true),
  ]);

  const sizePresets: Array<{ value: string; label: string; w?: number; h?: number; unit?: Unit }> = [
    { value: 'custom', label: 'Custom' },
    { value: 'a5', label: 'A5 · 148×210 mm', w: 148, h: 210, unit: 'mm' },
    { value: 'a4', label: 'A4 · 210×297 mm', w: 210, h: 297, unit: 'mm' },
    { value: 'a3', label: 'A3 · 297×420 mm', w: 297, h: 420, unit: 'mm' },
    { value: 'a2', label: 'A2 · 420×594 mm', w: 420, h: 594, unit: 'mm' },
    { value: 'square', label: 'Square · 300×300 mm', w: 300, h: 300, unit: 'mm' },
  ];
  const currentSizePreset = (): string => {
    const o = g().output;
    const hit = sizePresets.find((p) => p.w === o.width && p.h === o.height && p.unit === o.unit);
    return hit?.value ?? 'custom';
  };

  const outputSection = section('Output', [
    select('Size preset', sizePresets.map(({ value, label }) => ({ value, label })), currentSizePreset, (v) => {
      const p = sizePresets.find((x) => x.value === v);
      if (!p || p.value === 'custom' || p.w === undefined || p.h === undefined) return;
      const next = cloneSettings(g());
      next.output.width = p.w;
      next.output.height = p.h;
      next.output.unit = p.unit ?? 'mm';
      store.replace(next);
    }),
    slider('Width', { min: 20, max: 1200, step: 1 }, () => g().output.width, (v) => store.set('output', 'width', v)),
    slider('Height', { min: 20, max: 1200, step: 1 }, () => g().output.height, (v) => store.set('output', 'height', v)),
    select('Units', [
      { value: 'mm', label: 'mm' },
      { value: 'px', label: 'px' },
    ], () => g().output.unit, (v) => store.set('output', 'unit', v as Unit)),
    slider('Margin %', { min: 0, max: 25, step: 0.5 }, () => g().output.margin, (v) => store.set('output', 'margin', v)),
  ]);

  for (const s of [gridSection, lineSection, toneSection, colorSection, outputSection]) {
    controls.push(s);
    sidebar.appendChild(s.el);
  }
}

/* ---------- header actions ---------- */

function buildHeader(): void {
  const fileInput = $('#file-input') as HTMLInputElement;
  $('#btn-upload').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) void loadFile(file);
    fileInput.value = '';
  });

  const presetSelect = $('#preset-select') as HTMLSelectElement;
  BUILTIN_PRESETS.forEach((p, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = p.name;
    presetSelect.appendChild(opt);
  });
  presetSelect.addEventListener('change', () => {
    const preset = BUILTIN_PRESETS[Number(presetSelect.value)];
    if (preset) store.replace(applyPatch(store.get(), preset.patch));
    presetSelect.value = '';
  });

  $('#btn-save-preset').addEventListener('click', () => {
    const blob = new Blob([presetJson(store.get())], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'vectorline-preset.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  });

  const presetFileInput = $('#preset-file-input') as HTMLInputElement;
  $('#btn-load-preset').addEventListener('click', () => presetFileInput.click());
  presetFileInput.addEventListener('change', async () => {
    const file = presetFileInput.files?.[0];
    presetFileInput.value = '';
    if (!file) return;
    try {
      store.replace(parsePresetJson(await file.text()));
    } catch {
      flashWarning('Could not read that preset file — expected VectorLine preset JSON.');
    }
  });

  $('#btn-svg').addEventListener('click', () => {
    const svg = renderer.renderNow(store.get());
    if (svg) downloadSvg(svg);
  });

  $('#btn-png').addEventListener('click', () => {
    const svg = renderer.renderNow(store.get());
    const scale = Number(($('#png-scale') as HTMLInputElement).value) || 2;
    if (svg) {
      void downloadPng(svg, store.get(), Math.min(8, Math.max(1, scale))).catch(() =>
        flashWarning('PNG export failed.'),
      );
    }
  });

  $('#btn-copy-svg').addEventListener('click', () => {
    const svg = renderer.renderNow(store.get()) ?? lastSvg;
    if (!svg) return;
    void copySvg(svg)
      .then(() => flashStatus('SVG copied to clipboard'))
      .catch(() => flashWarning('Clipboard access was blocked by the browser.'));
  });

  $('#btn-fit').addEventListener('click', () => preview.fit());
}

let flashTimer = 0;
function flashWarning(msg: string): void {
  warningEl.textContent = msg;
  warningEl.hidden = false;
  window.clearTimeout(flashTimer);
  flashTimer = window.setTimeout(() => (warningEl.hidden = true), 4000);
}
function flashStatus(msg: string): void {
  statsEl.value = msg;
}

/* ---------- image loading ---------- */

async function loadFile(file: File): Promise<void> {
  if (!isAcceptedFile(file)) {
    flashWarning('Unsupported file type — use PNG, JPEG, or WebP.');
    return;
  }
  try {
    renderer.setSource(await loadImageFromFile(file));
    renderer.schedule(store.get());
  } catch {
    flashWarning('Could not decode that image.');
  }
}

function setupDragAndDrop(): void {
  const dropzone = $('#dropzone');
  let depth = 0;
  window.addEventListener('dragenter', (e) => {
    e.preventDefault();
    depth++;
    dropzone.hidden = false;
  });
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('dragleave', () => {
    depth = Math.max(0, depth - 1);
    if (depth === 0) dropzone.hidden = true;
  });
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    depth = 0;
    dropzone.hidden = true;
    const file = e.dataTransfer?.files?.[0];
    if (file) void loadFile(file);
  });
}

/* ---------- URL hash sync ---------- */

let hashTimer = 0;
function scheduleHashUpdate(settings: Settings): void {
  window.clearTimeout(hashTimer);
  hashTimer = window.setTimeout(() => {
    history.replaceState(null, '', `#s=${encodeHash(settings)}`);
  }, 300);
}

/* ---------- boot ---------- */

function boot(): void {
  buildSidebar();
  buildHeader();
  setupDragAndDrop();

  store.subscribe((settings) => {
    controls.forEach((c) => c.refresh());
    renderer.schedule(settings);
    scheduleHashUpdate(settings);
  });

  const fromHash = decodeHash(location.hash);
  if (fromHash) store.replace(fromHash);

  window.addEventListener('resize', () => renderer.schedule(store.get()));

  // Bundled demo image so the tool is never empty on first visit.
  void loadImageFromUrl(demoImageUrl, 'demo')
    .then((src) => {
      if (!renderer.getSource()) {
        renderer.setSource(src);
        renderer.schedule(store.get());
      }
    })
    .catch(() => flashWarning('Demo image failed to load — upload an image to begin.'));
}

boot();

// initial settings didn't change via subscribe; make defaults visible in hash
if (!location.hash) scheduleHashUpdate(DEFAULT_SETTINGS);
