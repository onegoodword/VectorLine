import { fmt } from './curve';
import { contentRect } from './grid';
import type { GeometryResult, Settings } from './types';

/** Allow hex colors, rgb()/hsl() notations, simple keywords, 'transparent'. */
export function sanitizeColor(c: string, fallback: string): string {
  const v = c.trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(v)) return v;
  if (/^[a-zA-Z]{3,25}$/.test(v)) return v.toLowerCase();
  if (/^(rgb|rgba|hsl|hsla)\([0-9.,%\s/]+\)$/.test(v)) return v;
  return fallback;
}

/**
 * Serialize geometry to a standalone SVG document string.
 * Valid XML, viewBox + physical units, presentational attributes only —
 * opens cleanly in Illustrator/Inkscape and is byte-deterministic.
 */
export function buildSvg(settings: Settings, geo: GeometryResult): string {
  const { output, color, line } = settings;
  const rect = contentRect(output);
  const W = fmt(output.width);
  const H = fmt(output.height);
  const unit = output.unit;
  const lineColor = sanitizeColor(color.line, '#111111');
  const bg = sanitizeColor(color.background, '#ffffff');
  const strokeWidth = fmt(Math.max(0.02, line.minWidth));

  const parts: string[] = [];
  parts.push('<?xml version="1.0" encoding="UTF-8"?>');
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}${unit}" height="${H}${unit}">`,
  );
  if (bg !== 'transparent') {
    parts.push(`<rect width="${W}" height="${H}" fill="${bg}"/>`);
  }
  parts.push(
    `<defs><clipPath id="cp"><rect x="${fmt(rect.x)}" y="${fmt(rect.y)}" width="${fmt(rect.w)}" height="${fmt(rect.h)}"/></clipPath></defs>`,
  );

  const fills = geo.paths.filter((p) => p.kind === 'fill');
  const strokes = geo.paths.filter((p) => p.kind === 'stroke');
  if (fills.length > 0) {
    parts.push(`<g clip-path="url(#cp)" fill="${lineColor}" stroke="none">`);
    for (const p of fills) parts.push(`<path d="${p.d}"/>`);
    parts.push('</g>');
  }
  if (strokes.length > 0) {
    parts.push(
      `<g clip-path="url(#cp)" fill="none" stroke="${lineColor}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">`,
    );
    for (const p of strokes) parts.push(`<path d="${p.d}"/>`);
    parts.push('</g>');
  }
  parts.push('</svg>');
  return parts.join('\n');
}
