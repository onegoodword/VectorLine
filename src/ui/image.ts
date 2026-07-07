import { luminanceMap } from '../core/luminance';
import type { LumaMap } from '../core/types';

export interface SourceImage {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  name: string;
}

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];

export function isAcceptedFile(file: File): boolean {
  return ACCEPTED.includes(file.type) || /\.(png|jpe?g|webp)$/i.test(file.name);
}

/** Decode an image file into a source-resolution canvas. */
export async function loadImageFromFile(file: File): Promise<SourceImage> {
  const bitmap = await createImageBitmap(file);
  return bitmapToSource(bitmap, file.name);
}

/** Load the bundled demo image. */
export async function loadImageFromUrl(url: string, name: string): Promise<SourceImage> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);
  return bitmapToSource(bitmap, name);
}

function bitmapToSource(bitmap: ImageBitmap, name: string): SourceImage {
  // Cap the retained source at 2048 on the long edge; sampling never needs more.
  const MAX = 2048;
  const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return { canvas, width: w, height: h, name };
}

/**
 * Downsample the source to the requested resolution and produce the
 * luminance map. This is the only raster step in the pipeline.
 */
export function downsampleToLuma(src: SourceImage, w: number, h: number): LumaMap {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src.canvas, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  return luminanceMap(data.data, w, h);
}
