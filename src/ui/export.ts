import type { Settings } from '../core/types';

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function downloadSvg(svg: string, name = 'vectorline.svg'): void {
  downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), name);
}

export async function copySvg(svg: string): Promise<void> {
  await navigator.clipboard.writeText(svg);
}

const MM_TO_PX = 96 / 25.4;

/** Rasterize the SVG at `scale`× its natural pixel size and download a PNG. */
export async function downloadPng(
  svg: string,
  settings: Settings,
  scale: number,
  name = 'vectorline.png',
): Promise<void> {
  const unitScale = settings.output.unit === 'mm' ? MM_TO_PX : 1;
  let w = Math.round(settings.output.width * unitScale * scale);
  let h = Math.round(settings.output.height * unitScale * scale);
  const MAX_EDGE = 8192;
  const long = Math.max(w, h);
  if (long > MAX_EDGE) {
    w = Math.round((w * MAX_EDGE) / long);
    h = Math.round((h * MAX_EDGE) / long);
  }
  const blobUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.decoding = 'sync';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('SVG rasterization failed'));
      img.src = blobUrl;
    });
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas unavailable');
    ctx.drawImage(img, 0, 0, w, h);
    const png = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encoding failed'))), 'image/png');
    });
    downloadBlob(png, name);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}
