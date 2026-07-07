# VectorLine

**VectorLine studio.** Converts raster images into halftone patterns made of grid-aligned vector lines, with every visual aspect exposed as a parameter and true SVG export — suitable for print, laser cutting, and pen plotting.

Everything runs client-side: no server, no accounts, no image persistence. The on-screen preview *is* the SVG element; what you see is byte-for-byte what you export.

## Setup

```sh
npm i
npm run dev      # dev server
npm test         # unit tests (Vitest)
npm run build    # typecheck + production build → dist/
```

`npm run build` produces a single self-contained `dist/index.html` (via `vite-plugin-singlefile`) — all CSS, JS, and the bundled demo image are inlined, so the file works standalone when opened directly (`file://`) as well as when deployed to a static host. Deploys automatically to GitHub Pages on push to `main` (`.github/workflows/deploy.yml`).

## Architecture

```
src/
  core/       pure functions — no DOM (except the SVG string builder)
    luminance.ts   sRGB-linearized Rec.709 luminance, bilinear sampling
    tone.ts        brightness → contrast → gamma → levels → invert
    grid.ts        rotated grid rows, Liang-Barsky clipping, inverse sampling
    curve.ts       Catmull-Rom → cubic Bézier path emission
    modulators/    one file per modulation mode + shared Modulator interface
    svg-builder.ts deterministic SVG serialization
    pipeline.ts    stage orchestration, point-budget guard rails
    prng.ts        mulberry32 seeded PRNG (deterministic jitter)
  ui/         controls, preview (zoom/pan), presets, export, render cache
  presets/    built-in preset definitions
```

The pipeline is deterministic: the same image and the same settings JSON always produce a byte-identical SVG (covered by tests). All randomness (jitter) flows through a seeded PRNG keyed per grid row.

Pipeline stages cache independently: the luminance map recomputes only when the image or sampling resolution changes, tone only when tone parameters change, geometry on everything else. Recompute is debounced with `requestAnimationFrame` and split across event-loop tasks so slider input stays live.

### Grid model

The grid lives in artwork space (the SVG viewBox), rotated by the grid angle around the artwork center. Sampling inverse-rotates each sample point into image space and bilinearly interpolates the luminance map — lines stay perfectly straight and grid-true at any angle, and the raster is never rotated.

### Adding a modulation mode

1. Create `src/core/modulators/mymode.ts` implementing the `Modulator` interface from `modulators/index.ts`: declare `id`, `label`, `plotterCapable`, `pathKind(plotter)`, and `renderRun(run, ctx)` which turns one run of above-threshold samples into SVG path data.
2. Add the id to the `ModeId` union in `core/types.ts` and register the module in the `MODULATORS` record.
3. That's it — the pipeline, mode selector, presets, and exports pick it up automatically.

### Plotter mode

Modes 2–4 emit single-stroke centerlines with `fill="none"` and round caps — directly usable by AxiDraw-class plotters. Thickness mode is inherently fill-based (variable-width ribbons); in plotter mode it falls back to uniform-width centerlines, and the UI states this.

## Export

- **SVG** — valid XML, `viewBox` + physical units (mm/px), presentational attributes only; opens cleanly in Illustrator/Inkscape.
- **PNG** — rasterized at 1–8× scale.
- **Copy SVG** — clipboard.
- **Presets** — save/load JSON; the full settings state also lives in the URL hash, so a look can be shared by link.

## Demo image

Dorothea Lange, *Migrant Mother* (1936) — a U.S. Farm Security Administration photograph, public domain. Bundled at `src/assets/demo.jpg`.
