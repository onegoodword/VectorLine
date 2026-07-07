/** Zoom/pan preview pane. The rendered SVG element is the artwork itself. */
export class Preview {
  private stage: HTMLDivElement;
  private scale = 1;
  private tx = 0;
  private ty = 0;
  private artW = 1;
  private artH = 1;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;

  constructor(private host: HTMLElement) {
    this.stage = document.createElement('div');
    this.stage.className = 'preview-stage';
    host.appendChild(this.stage);

    host.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.0015);
      this.zoomAt(e.clientX, e.clientY, factor);
    }, { passive: false });

    host.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      host.setPointerCapture(e.pointerId);
      host.classList.add('grabbing');
    });
    host.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      this.tx += e.clientX - this.lastX;
      this.ty += e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.apply();
    });
    const end = (e: PointerEvent) => {
      this.dragging = false;
      host.classList.remove('grabbing');
      if (host.hasPointerCapture(e.pointerId)) host.releasePointerCapture(e.pointerId);
    };
    host.addEventListener('pointerup', end);
    host.addEventListener('pointercancel', end);
  }

  /** Replace the displayed SVG (string form, already deterministic). */
  setSvg(svg: string, artW: number, artH: number): void {
    const firstArt = this.artW === 1 && this.artH === 1;
    this.artW = artW;
    this.artH = artH;
    this.stage.innerHTML = svg;
    const el = this.stage.querySelector('svg');
    if (el) {
      el.removeAttribute('width');
      el.removeAttribute('height');
      el.setAttribute('aria-label', 'Halftone artwork preview');
    }
    this.stage.style.aspectRatio = `${artW} / ${artH}`;
    if (firstArt) this.fit();
  }

  /** Fit artwork into the viewport with padding. */
  fit(): void {
    const r = this.host.getBoundingClientRect();
    const pad = 40;
    const scale = Math.min((r.width - pad) / this.artW, (r.height - pad) / this.artH);
    this.scale = Math.max(0.05, scale);
    const w = this.artW * this.scale;
    const h = this.artH * this.scale;
    this.tx = (r.width - w) / 2;
    this.ty = (r.height - h) / 2;
    this.apply();
  }

  private zoomAt(clientX: number, clientY: number, factor: number): void {
    const r = this.host.getBoundingClientRect();
    const px = clientX - r.left;
    const py = clientY - r.top;
    const next = Math.min(40, Math.max(0.05, this.scale * factor));
    const f = next / this.scale;
    this.tx = px - (px - this.tx) * f;
    this.ty = py - (py - this.ty) * f;
    this.scale = next;
    this.apply();
  }

  private apply(): void {
    this.stage.style.width = `${this.artW * this.scale}px`;
    this.stage.style.transform = `translate(${this.tx}px, ${this.ty}px)`;
  }
}
