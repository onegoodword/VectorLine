/** Small factory helpers for sidebar controls. Each returns its root element
 * plus a refresh() that re-reads state (used after preset/hash loads). */

export interface Control {
  el: HTMLElement;
  refresh: () => void;
}

let uid = 0;
const nextId = () => `ctl-${++uid}`;

export function section(title: string, controls: Control[], open = true): Control {
  const details = document.createElement('details');
  details.className = 'section';
  details.open = open;
  const summary = document.createElement('summary');
  summary.textContent = title;
  details.appendChild(summary);
  const body = document.createElement('div');
  body.className = 'section-body';
  for (const c of controls) body.appendChild(c.el);
  details.appendChild(body);
  return { el: details, refresh: () => controls.forEach((c) => c.refresh()) };
}

export interface SliderOpts {
  min: number;
  max: number;
  step: number;
}

export function slider(
  label: string,
  opts: SliderOpts,
  get: () => number,
  set: (v: number) => void,
): Control {
  const id = nextId();
  const row = document.createElement('div');
  row.className = 'ctl';
  const lab = document.createElement('label');
  lab.htmlFor = id;
  lab.textContent = label;
  const range = document.createElement('input');
  range.type = 'range';
  range.id = id;
  range.min = String(opts.min);
  range.max = String(opts.max);
  range.step = String(opts.step);
  const num = document.createElement('input');
  num.type = 'number';
  num.min = String(opts.min);
  num.max = String(opts.max);
  num.step = String(opts.step);
  num.setAttribute('aria-label', label);
  const clamp = (v: number) => Math.min(opts.max, Math.max(opts.min, v));
  const refresh = () => {
    range.value = String(get());
    num.value = String(get());
  };
  range.addEventListener('input', () => {
    const v = clamp(Number(range.value));
    num.value = String(v);
    set(v);
  });
  num.addEventListener('change', () => {
    const v = clamp(Number(num.value));
    if (!Number.isFinite(v)) return refresh();
    range.value = String(v);
    num.value = String(v);
    set(v);
  });
  refresh();
  row.append(lab, range, num);
  return { el: row, refresh };
}

export function select(
  label: string,
  options: Array<{ value: string; label: string }>,
  get: () => string,
  set: (v: string) => void,
): Control {
  const id = nextId();
  const row = document.createElement('div');
  row.className = 'ctl ctl-select';
  const lab = document.createElement('label');
  lab.htmlFor = id;
  lab.textContent = label;
  const sel = document.createElement('select');
  sel.id = id;
  for (const o of options) {
    const opt = document.createElement('option');
    opt.value = o.value;
    opt.textContent = o.label;
    sel.appendChild(opt);
  }
  const refresh = () => {
    sel.value = get();
  };
  sel.addEventListener('change', () => set(sel.value));
  refresh();
  row.append(lab, sel);
  return { el: row, refresh };
}

export function checkbox(label: string, get: () => boolean, set: (v: boolean) => void): Control {
  const id = nextId();
  const row = document.createElement('div');
  row.className = 'ctl ctl-check';
  const lab = document.createElement('label');
  lab.htmlFor = id;
  lab.textContent = label;
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.id = id;
  const refresh = () => {
    box.checked = get();
  };
  box.addEventListener('change', () => set(box.checked));
  refresh();
  row.append(box, lab);
  return { el: row, refresh };
}

export function color(
  label: string,
  get: () => string,
  set: (v: string) => void,
  allowTransparent = false,
): Control {
  const id = nextId();
  const row = document.createElement('div');
  row.className = 'ctl ctl-color';
  const lab = document.createElement('label');
  lab.htmlFor = id;
  lab.textContent = label;
  const picker = document.createElement('input');
  picker.type = 'color';
  picker.id = id;
  let trans: HTMLInputElement | null = null;
  const refresh = () => {
    const v = get();
    if (trans) trans.checked = v === 'transparent';
    picker.value = /^#[0-9a-fA-F]{6}$/.test(v) ? v : '#ffffff';
    picker.disabled = v === 'transparent';
  };
  picker.addEventListener('input', () => set(picker.value));
  row.append(lab, picker);
  if (allowTransparent) {
    const tid = nextId();
    trans = document.createElement('input');
    trans.type = 'checkbox';
    trans.id = tid;
    const tlab = document.createElement('label');
    tlab.htmlFor = tid;
    tlab.textContent = 'transparent';
    tlab.className = 'sub';
    trans.addEventListener('change', () => {
      set(trans!.checked ? 'transparent' : picker.value);
      refresh();
    });
    row.append(trans, tlab);
  }
  refresh();
  return { el: row, refresh };
}

/** An inline informational note that can be shown/hidden. */
export function note(text: string, visible: () => boolean): Control {
  const el = document.createElement('p');
  el.className = 'ctl-note';
  el.textContent = text;
  const refresh = () => {
    el.hidden = !visible();
  };
  refresh();
  return { el, refresh };
}
