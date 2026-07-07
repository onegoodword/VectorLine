import { requiredMapSize, synthesize } from '../core/pipeline';
import { buildSvg } from '../core/svg-builder';
import { applyTone } from '../core/tone';
import type { GeometryResult, LumaMap, Settings } from '../core/types';
import { downsampleToLuma, type SourceImage } from './image';

export interface RenderStats {
  paths: number;
  points: number;
  ms: number;
  clamped: boolean;
}

export type RenderCallback = (svg: string, stats: RenderStats) => void;

/**
 * Owns the staged pipeline caches and the rAF-debounced recompute loop.
 * Stage dependencies:
 *   luma map   ← source image + sampling resolution (grid density, output size)
 *   toned map  ← luma map + tone settings
 *   geometry   ← toned map + grid/line/output settings
 *   svg string ← geometry + color/output settings
 */
export class Renderer {
  private source: SourceImage | null = null;
  private lumaMap: LumaMap | null = null;
  private lumaKey = '';
  private tonedMap: LumaMap | null = null;
  private toneKey = '';
  private geometry: GeometryResult | null = null;
  private geoKey = '';
  private rafId = 0;
  private pending: Settings | null = null;
  private gen = 0;

  constructor(private onRender: RenderCallback) {}

  setSource(src: SourceImage): void {
    this.source = src;
    this.lumaKey = '';
    this.toneKey = '';
    this.geoKey = '';
  }

  getSource(): SourceImage | null {
    return this.source;
  }

  /** Schedule a recompute for the next animation frame (coalesces bursts). */
  schedule(settings: Settings): void {
    this.pending = settings;
    if (this.rafId) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = 0;
      const s = this.pending;
      this.pending = null;
      if (s) void this.renderChunked(s);
    });
  }

  /**
   * Staged render that yields to the event loop between pipeline stages so
   * no single main-thread task grows long on slow devices. If new settings
   * arrive mid-flight the stale render is abandoned.
   */
  private async renderChunked(settings: Settings): Promise<void> {
    if (!this.source) return;
    const token = ++this.gen;
    const stale = () => token !== this.gen || this.pending !== null;
    const yieldTask = () => new Promise<void>((r) => setTimeout(r, 0));
    const t0 = performance.now();

    const size = requiredMapSize(settings, this.source.width, this.source.height);
    const lumaKey = `${this.source.name}|${size.width}x${size.height}`;
    if (lumaKey !== this.lumaKey || !this.lumaMap) {
      this.lumaMap = downsampleToLuma(this.source, size.width, size.height);
      this.lumaKey = lumaKey;
      this.toneKey = '';
      await yieldTask();
      if (stale()) return;
    }

    const toneKey = JSON.stringify(settings.tone);
    if (toneKey !== this.toneKey || !this.tonedMap) {
      this.tonedMap = applyTone(this.lumaMap, settings.tone);
      this.toneKey = toneKey;
      this.geoKey = '';
    }

    const geoKey = JSON.stringify([settings.grid, settings.line, settings.output]);
    if (geoKey !== this.geoKey || !this.geometry) {
      this.geometry = synthesize(this.tonedMap!, settings);
      this.geoKey = geoKey;
      await yieldTask();
      if (stale()) return;
    }

    if (stale()) return;
    const svg = buildSvg(settings, this.geometry!);
    const ms = performance.now() - t0;
    this.onRender(svg, {
      paths: this.geometry!.paths.length,
      points: this.geometry!.pointCount,
      ms,
      clamped: this.geometry!.clamped,
    });
  }

  /** Synchronous recompute (used by export to guarantee freshness). */
  renderNow(settings: Settings): string | null {
    if (!this.source) return null;
    const t0 = performance.now();

    const size = requiredMapSize(settings, this.source.width, this.source.height);
    const lumaKey = `${this.source.name}|${size.width}x${size.height}`;
    if (lumaKey !== this.lumaKey || !this.lumaMap) {
      this.lumaMap = downsampleToLuma(this.source, size.width, size.height);
      this.lumaKey = lumaKey;
      this.toneKey = '';
    }

    const toneKey = JSON.stringify(settings.tone);
    if (toneKey !== this.toneKey || !this.tonedMap) {
      this.tonedMap = applyTone(this.lumaMap, settings.tone);
      this.toneKey = toneKey;
      this.geoKey = '';
    }

    const geoKey = JSON.stringify([settings.grid, settings.line, settings.output]);
    if (geoKey !== this.geoKey || !this.geometry) {
      this.geometry = synthesize(this.tonedMap, settings);
      this.geoKey = geoKey;
    }

    const svg = buildSvg(settings, this.geometry);
    const ms = performance.now() - t0;
    this.onRender(svg, {
      paths: this.geometry.paths.length,
      points: this.geometry.pointCount,
      ms,
      clamped: this.geometry.clamped,
    });
    return svg;
  }
}
