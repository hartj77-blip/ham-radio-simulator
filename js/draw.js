// Shared SVG artwork for the Build pages: radios, power supplies, tuners, meters, amplifiers,
// microphones, keys, connectors and vehicles. Every part is drawn in its own local box
// (0,0)–(w,h) and returned as a <g>; the caller positions it with a transform.
const NS = 'http://www.w3.org/2000/svg';
export const s = (tag, a = {}, ...kids) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(a)) if (v != null) e.setAttribute(k, v);
  for (const c of kids.flat()) if (c != null) e.append(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  return e;
};
export const at = (g, x, y) => { g.setAttribute('transform', `translate(${x},${y})`); return g; };
const txt = (x, y, t, size = 7, fill = '#aeb8c2', extra = {}) => s('text', { x, y, 'font-size': size, fill, 'font-family': 'Inter, system-ui, sans-serif', 'font-weight': 600, 'letter-spacing': 0.4, ...extra }, t);
const mono = (x, y, t, size, fill, extra = {}) => s('text', { x, y, 'font-size': size, fill, 'font-family': '"JetBrains Mono", ui-monospace, monospace', 'font-weight': 600, ...extra }, t);
const grad = (id, stops, attrs = { x1: 0, y1: 0, x2: 0, y2: 1 }) => s('linearGradient', { id, ...attrs }, ...stops.map(([o, c, op]) => s('stop', { offset: o, 'stop-color': c, 'stop-opacity': op })));
const rgrad = (id, stops, attrs = { cx: 0.35, cy: 0.3, r: 0.8 }) => s('radialGradient', { id, ...attrs }, ...stops.map(([o, c, op]) => s('stop', { offset: o, 'stop-color': c, 'stop-opacity': op })));

// Gradients and filters used by the parts. Add once to each <svg>.
export function defs() {
  return s('defs', {},
    grad('arGraphite', [[0, '#4a5059'], [0.06, '#3a4048'], [0.9, '#23272d'], [1, '#16191d']]),
    grad('arBlack', [[0, '#34383e'], [0.06, '#24272c'], [0.9, '#15171a'], [1, '#0c0d0f']]),
    grad('arSilver', [[0, '#d9dde1'], [0.07, '#b9bfc6'], [0.9, '#8d949c'], [1, '#676d75']]),
    grad('arCream', [[0, '#e9e1cc'], [0.07, '#d8cfb6'], [0.9, '#b8ad90'], [1, '#8f8568']]),
    grad('arBlue', [[0, '#3c5a86'], [0.07, '#2d4669'], [0.9, '#1c2c44'], [1, '#111b2b']]),
    grad('arPanel', [[0, '#1b1e23'], [1, '#101215']]),
    grad('arGlass', [[0, '#ffffff', 0.16], [0.45, '#ffffff', 0.03], [1, '#ffffff', 0]], { x1: 0, y1: 0, x2: 0.4, y2: 1 }),
    grad('arLcdAmber', [[0, '#e9a53a'], [1, '#b9741a']]),
    grad('arLcdGreen', [[0, '#9cc58a'], [1, '#6f9a60']]),
    grad('arLcdBlue', [[0, '#bfe4ff'], [1, '#7fb6dd']]),
    grad('arMeter', [[0, '#f6efd9'], [1, '#e2d7b6']]),
    grad('arWood', [[0, '#8a6238'], [0.5, '#70502e'], [1, '#4c3520']]),
    grad('arWall', [[0, '#1c232c'], [1, '#141a21']]),
    grad('arCopper', [[0, '#e0a068'], [0.5, '#b87333'], [1, '#7c4a1c']]),
    grad('arChrome', [[0, '#f4f6f8'], [0.45, '#9aa3ad'], [0.55, '#5d656e'], [1, '#c9d0d7']]),
    grad('arTube', [[0, '#ffd27a', 0.9], [0.6, '#ff7a1a', 0.75], [1, '#5a1c00', 0.5]]),
    grad('arWf', [[0, '#04142e'], [0.2, '#0a3a6a'], [0.26, '#39d0c0'], [0.3, '#0a3a6a'], [0.56, '#0b2f58'], [0.6, '#f2d33a'], [0.64, '#0b2f58'], [0.82, '#1d6fb0'], [1, '#04142e']], { x1: 0, y1: 0, x2: 1, y2: 0 }),
    rgrad('arKnob', [[0, '#7b838d'], [0.5, '#3a4047'], [1, '#101215']]),
    rgrad('arKnobSilver', [[0, '#ffffff'], [0.5, '#b4bbc3'], [1, '#5a6169']]),
    rgrad('arLedG', [[0, '#d8ffe6'], [0.4, '#3cff8a'], [1, '#0b6a34']], { cx: 0.5, cy: 0.5, r: 0.5 }),
    rgrad('arLedR', [[0, '#ffe0dc'], [0.4, '#ff4a3a'], [1, '#6a120b']], { cx: 0.5, cy: 0.5, r: 0.5 }),
    rgrad('arLedOff', [[0, '#4a4f55'], [1, '#1c1f23']], { cx: 0.5, cy: 0.5, r: 0.5 }),
    s('filter', { id: 'arShadow', x: '-10%', y: '-10%', width: '120%', height: '140%' }, s('feDropShadow', { dx: 0, dy: 4, stdDeviation: 4, 'flood-color': '#000', 'flood-opacity': 0.55 })),
    s('filter', { id: 'arGlow', x: '-50%', y: '-50%', width: '200%', height: '200%' }, s('feGaussianBlur', { stdDeviation: 3 })));
}

const TONE = { graphite: 'arGraphite', black: 'arBlack', silver: 'arSilver', cream: 'arCream', blue: 'arBlue' };
const INK = { graphite: '#b9c2cc', black: '#aab3bd', silver: '#23272c', cream: '#3a3222', blue: '#c5d6ee' };

// ---------------------------------------------------------------- primitives
export function cabinet(w, h, { tone = 'graphite', feet = true, vents = 0, screws = true, rx = 5, panel = true } = {}) {
  const g = s('g', { filter: 'url(#arShadow)' });
  if (feet) g.append(s('rect', { x: w * 0.08, y: h - 1, width: 14, height: 5, rx: 1.5, fill: '#0a0b0c' }), s('rect', { x: w * 0.92 - 14, y: h - 1, width: 14, height: 5, rx: 1.5, fill: '#0a0b0c' }));
  g.append(s('rect', { x: 0, y: 0, width: w, height: h, rx, fill: `url(#${TONE[tone]})`, stroke: '#07080a', 'stroke-width': 1.2 }));
  // top bevel highlight and a darker lip along the bottom
  g.append(s('path', { d: `M${rx} 1.2 H${w - rx}`, stroke: '#ffffff', 'stroke-opacity': 0.22, 'stroke-width': 1 }), s('rect', { x: 1, y: h - 5, width: w - 2, height: 4, rx: 2, fill: '#000', opacity: 0.28 }));
  if (panel) g.append(s('rect', { x: 4, y: 4, width: w - 8, height: h - 9, rx: Math.max(2, rx - 2), fill: 'none', stroke: '#000', 'stroke-opacity': 0.35 }));
  for (let i = 0; i < vents; i++) g.append(s('rect', { x: w - 12 - i * 5, y: 8, width: 2.2, height: Math.min(22, h * 0.3), rx: 1, fill: '#07080a', opacity: 0.8 }));
  if (screws) for (const [x, y] of [[7, 7], [w - 7, 7], [7, h - 9], [w - 7, h - 9]]) g.append(s('circle', { cx: x, cy: y, r: 1.8, fill: '#15171a', stroke: '#6b727a', 'stroke-width': 0.5 }), s('path', { d: `M${x - 1.1} ${y - 1.1} L${x + 1.1} ${y + 1.1}`, stroke: '#6b727a', 'stroke-width': 0.5 }));
  g.ink = INK[tone];
  return g;
}

export function knob(x, y, r, { angle = -40, silver = false, ticks = 0, label, ink = '#aeb8c2' } = {}) {
  const g = s('g', {});
  for (let i = 0; i < ticks; i++) { const a = (-225 + (270 / (ticks - 1)) * i) * Math.PI / 180; g.append(s('line', { x1: x + Math.cos(a) * (r + 2.5), y1: y + Math.sin(a) * (r + 2.5), x2: x + Math.cos(a) * (r + 5.5), y2: y + Math.sin(a) * (r + 5.5), stroke: ink, 'stroke-width': 0.7, opacity: 0.7 })); }
  g.append(s('circle', { cx: x, cy: y + 1.2, r: r + 1, fill: '#000', opacity: 0.45 }),
    s('circle', { cx: x, cy: y, r, fill: `url(#${silver ? 'arKnobSilver' : 'arKnob'})`, stroke: '#07080a', 'stroke-width': 1 }),
    s('circle', { cx: x, cy: y, r: r * 0.72, fill: 'none', stroke: silver ? '#6a7078' : '#000', 'stroke-opacity': 0.45, 'stroke-width': 0.8 }));
  const a = (angle - 90) * Math.PI / 180;
  g.append(s('line', { x1: x + Math.cos(a) * r * 0.35, y1: y + Math.sin(a) * r * 0.35, x2: x + Math.cos(a) * r * 0.9, y2: y + Math.sin(a) * r * 0.9, stroke: silver ? '#1b1e22' : '#f1f4f7', 'stroke-width': Math.max(1, r * 0.13), 'stroke-linecap': 'round' }));
  if (label) g.append(txt(x, y + r + 11, label, 5.5, ink, { 'text-anchor': 'middle' }));
  return g;
}

// big tuning knob with a finger dimple
export function vfo(x, y, r) {
  const g = s('g', {});
  g.append(s('circle', { cx: x, cy: y + 2, r: r + 2, fill: '#000', opacity: 0.5 }), s('circle', { cx: x, cy: y, r: r + 2, fill: '#0b0c0e', stroke: '#3c424a' }));
  for (let i = 0; i < 36; i++) { const a = i * 10 * Math.PI / 180; g.append(s('line', { x1: x + Math.cos(a) * (r - 1), y1: y + Math.sin(a) * (r - 1), x2: x + Math.cos(a) * (r + 1.5), y2: y + Math.sin(a) * (r + 1.5), stroke: '#2d3238', 'stroke-width': 1 })); }
  g.append(s('circle', { cx: x, cy: y, r: r - 1.5, fill: 'url(#arKnob)', stroke: '#07080a' }), s('circle', { cx: x + r * 0.42, cy: y - r * 0.42, r: r * 0.2, fill: '#0c0d0f', stroke: '#4a5058', 'stroke-width': 0.6 }),
    s('circle', { cx: x, cy: y, r: r * 0.28, fill: 'none', stroke: '#000', 'stroke-opacity': 0.35 }));
  return g;
}

export function led(x, y, r = 2.4, on = true, colour = 'G') {
  const g = s('g', {});
  if (on) g.append(s('circle', { cx: x, cy: y, r: r * 2.2, fill: colour === 'G' ? '#3cff8a' : '#ff4a3a', opacity: 0.35, filter: 'url(#arGlow)' }));
  g.append(s('circle', { cx: x, cy: y, r, fill: `url(#${on ? `arLed${colour}` : 'arLedOff'})`, stroke: '#07080a', 'stroke-width': 0.5 }));
  return g;
}

export function keysRow(x, y, n, w = 14, h = 7, gap = 3, labels) {
  const g = s('g', {});
  for (let i = 0; i < n; i++) {
    g.append(s('rect', { x: x + i * (w + gap), y: y + 0.8, width: w, height: h, rx: 1.5, fill: '#000', opacity: 0.5 }), s('rect', { x: x + i * (w + gap), y, width: w, height: h, rx: 1.5, fill: '#30353c', stroke: '#090a0c', 'stroke-width': 0.6 }),
      s('path', { d: `M${x + i * (w + gap) + 1.5} ${y + 1} h${w - 3}`, stroke: '#fff', 'stroke-opacity': 0.18, 'stroke-width': 0.7 }));
    if (labels?.[i]) g.append(txt(x + i * (w + gap) + w / 2, y + h * 0.72, labels[i], Math.min(4.6, h * 0.62), '#c8d0d8', { 'text-anchor': 'middle', 'font-weight': 500 }));
  }
  return g;
}

// analogue panel meter; needle 0..1; `cross` draws a second needle (forward / reflected)
export function meter(x, y, w, h, { needle = 0.3, cross = false, label = '', id } = {}) {
  const g = s('g', {});
  g.append(s('rect', { x: x - 1.5, y: y - 1.5, width: w + 3, height: h + 3, rx: 3, fill: '#0b0c0e' }), s('rect', { x, y, width: w, height: h, rx: 2, fill: 'url(#arMeter)' }));
  const cx = x + w / 2, cy = y + h * 1.05, R = h * 0.82;
  g.append(s('path', { d: `M${cx - R * 0.78} ${cy - R * 0.62} A ${R} ${R} 0 0 1 ${cx + R * 0.78} ${cy - R * 0.62}`, fill: 'none', stroke: '#2a2a2a', 'stroke-width': 0.8 }),
    s('path', { d: `M${cx + R * 0.36} ${cy - R * 0.93} A ${R} ${R} 0 0 1 ${cx + R * 0.78} ${cy - R * 0.62}`, fill: 'none', stroke: '#c62828', 'stroke-width': 1.6 }));
  for (let i = 0; i <= 8; i++) { const a = (-129 + i * 9.75) * Math.PI / 180; g.append(s('line', { x1: cx + Math.cos(a) * R, y1: cy + Math.sin(a) * R, x2: cx + Math.cos(a) * (R - (i % 2 ? 2 : 3.5)), y2: cy + Math.sin(a) * (R - (i % 2 ? 2 : 3.5)), stroke: '#2a2a2a', 'stroke-width': 0.6 })); }
  const nd = (f, col, mirror) => { const a = (mirror ? -51 - f * 60 : -129 + f * 60) * Math.PI / 180; const px = mirror ? x + w * 0.88 : cross ? x + w * 0.12 : cx; return s('line', { x1: px, y1: y + h - 1.5, x2: (cross ? px : cx) + Math.cos(a) * R * (cross ? 0.8 : 0.92), y2: y + h - 1.5 + Math.sin(a) * R * (cross ? 0.8 : 0.92) + (cross ? 0 : h * 0.05), stroke: col, 'stroke-width': 0.9, 'stroke-linecap': 'round' }); };
  const n1 = nd(needle, '#111', false);
  if (id) n1.setAttribute('id', id);
  g.append(n1);
  if (cross) g.append(nd(needle * 0.35, '#b71c1c', true));
  if (label) g.append(txt(cx, y + h - 3, label, Math.min(5, h * 0.2), '#3a3426', { 'text-anchor': 'middle' }));
  g.append(s('rect', { x, y, width: w, height: h, rx: 2, fill: 'url(#arGlass)' }));
  return g;
}

function scopeTrace(x, y, w, h, seed = 3) {
  let a = seed * 9301 + 49297; const rnd = () => { a = (a * 9301 + 49297) % 233280; return a / 233280; };
  const peaks = [0.24, 0.6, 0.83];
  let d = '';
  for (let i = 0; i <= 60; i++) {
    const f = i / 60; let v = 0.12 + rnd() * 0.12;
    for (const p of peaks) v += Math.exp(-((f - p) ** 2) / 0.0009) * (0.45 + (p * 7 % 1) * 0.3);
    d += `${i ? 'L' : 'M'}${(x + f * w).toFixed(1)} ${(y + h - Math.min(0.95, v) * h).toFixed(1)}`;
  }
  return d;
}

// colour display with spectrum scope and waterfall
export function scopeScreen(x, y, w, h, { on = true, freq = '14.074.00', mode = 'USB' } = {}) {
  const g = s('g', {});
  g.append(s('rect', { x: x - 2, y: y - 2, width: w + 4, height: h + 4, rx: 3, fill: '#050608', stroke: '#2b3036', 'stroke-width': 0.8 }), s('rect', { x, y, width: w, height: h, rx: 1.5, fill: on ? '#03101f' : '#07090b' }));
  if (on) {
    const top = h * 0.3, sc = h * 0.3;
    g.append(mono(x + 3, y + top * 0.72, freq, Math.min(top * 0.72, w / 8), '#eaf6ff'), mono(x + w - 3, y + top * 0.5, mode, Math.min(5, top * 0.36), '#5ee08a', { 'text-anchor': 'end' }),
      s('rect', { x, y: y + top, width: w, height: sc, fill: '#04182e' }),
      s('path', { d: `${scopeTrace(x, y + top, w, sc)} L${x + w} ${y + top + sc} L${x} ${y + top + sc} Z`, fill: '#1e88e5', opacity: 0.35 }), s('path', { d: scopeTrace(x, y + top, w, sc), fill: 'none', stroke: '#7fd3ff', 'stroke-width': 0.7 }),
      s('rect', { x, y: y + top + sc, width: w, height: h - top - sc, fill: 'url(#arWf)' }),
      s('line', { x1: x + w / 2, y1: y + top, x2: x + w / 2, y2: y + h, stroke: '#ff5252', 'stroke-width': 0.6, opacity: 0.8 }));
  }
  g.append(s('rect', { x, y, width: w, height: h, rx: 1.5, fill: 'url(#arGlass)' }));
  return g;
}

// monochrome LCD with frequency and an S-meter bargraph
export function lcd(x, y, w, h, { on = true, freq = '14.250.00', mode = 'USB', colour = 'Amber' } = {}) {
  const g = s('g', {});
  g.append(s('rect', { x: x - 2, y: y - 2, width: w + 4, height: h + 4, rx: 3, fill: '#050608', stroke: '#2b3036', 'stroke-width': 0.8 }), s('rect', { x, y, width: w, height: h, rx: 1.5, fill: on ? `url(#arLcd${colour})` : '#1a1c18' }));
  if (on) {
    g.append(mono(x + w * 0.06, y + h * 0.62, freq, Math.min(h * 0.5, w / 6.4), '#16130a', { 'font-weight': 700 }), mono(x + w * 0.94, y + h * 0.3, mode, Math.min(6, h * 0.2), '#16130a', { 'text-anchor': 'end' }));
    for (let i = 0; i < 14; i++) g.append(s('rect', { x: x + w * 0.06 + i * (w * 0.88 / 14), y: y + h * 0.76, width: w * 0.88 / 14 - 1, height: h * 0.12, fill: '#16130a', opacity: i < 8 ? 0.85 : 0.15 }));
  }
  g.append(s('rect', { x, y, width: w, height: h, rx: 1.5, fill: 'url(#arGlass)' }));
  return g;
}

const jack = (x, y, r = 3) => s('g', {}, s('circle', { cx: x, cy: y, r, fill: '#0a0b0c', stroke: '#7a828b', 'stroke-width': 0.8 }), s('circle', { cx: x, cy: y, r: r * 0.35, fill: '#000' }));
const grille = (x, y, w, h, gap = 3) => { const g = s('g', {}); for (let yy = y; yy < y + h; yy += gap) g.append(s('line', { x1: x, y1: yy, x2: x + w, y2: yy, stroke: '#07080a', 'stroke-width': 1.1, 'stroke-linecap': 'round' })); return g; };

// ---------------------------------------------------------------- equipment
// `r` is a radio from the catalog. Returns a group with g.hot = positions of live parts.
export function radio(r, w, h, { on = true, freq = '14.250.00', mode = 'USB' } = {}) {
  const look = r.look || 'classic';
  if (look === 'ht') return handheld(r, w, h, { on });
  const tone = look === 'contest' ? 'black' : look === 'sdr' ? 'blue' : /retro|cream/.test(r.face || '') ? 'cream' : 'graphite';
  const g = cabinet(w, h, { tone, vents: look === 'sdr' ? 0 : 3 });
  g.hot = {};
  const code = (r.code || r.name || '').toUpperCase().slice(0, 12);
  if (look === 'sdr') {
    g.append(txt(10, h * 0.42, code, 6, g.ink), txt(10, h * 0.78, 'SDR RECEIVER', 4.2, g.ink, { opacity: 0.7 }), led(w - 16, h / 2, 2.4, on), jack(w - 34, h / 2, 3.2), txt(w - 34, h - 4, 'ANT', 3.6, g.ink, { 'text-anchor': 'middle' }),
      s('rect', { x: w * 0.42, y: h * 0.3, width: 16, height: h * 0.4, rx: 1, fill: '#0a0b0c', stroke: '#6b727a', 'stroke-width': 0.5 }), txt(w * 0.42 + 8, h - 4, 'USB', 3.6, g.ink, { 'text-anchor': 'middle' }));
    g.hot.power = [w - 16, h / 2];
    return g;
  }
  const big = look === 'contest';
  // left column: power, phones, mic
  const lw = Math.min(46, w * 0.15);
  g.append(txt(10, 14, code, 6.2, g.ink), s('circle', { cx: lw / 2 + 6, cy: h * 0.4, r: 6.5, fill: '#0b0c0e', stroke: '#565d66' }), led(lw / 2 + 6, h * 0.4, 2.6, on, on ? 'G' : 'R'), txt(lw / 2 + 6, h * 0.4 + 14, 'POWER', 4.2, g.ink, { 'text-anchor': 'middle' }),
    jack(lw / 2 - 2, h - 16, 3), jack(lw / 2 + 12, h - 16, 4.2), txt(lw / 2 - 2, h - 7, 'PH', 3.6, g.ink, { 'text-anchor': 'middle' }), txt(lw / 2 + 12, h - 7, 'MIC', 3.6, g.ink, { 'text-anchor': 'middle' }));
  g.hot.power = [lw / 2 + 6, h * 0.4];
  g.hot.mic = [lw / 2 + 12, h - 16];
  // right: tuning knob
  const kr = Math.min(h * (look === 'mobile' ? 0.3 : 0.27), w * 0.11);
  const kx = w - kr - 16, ky = h * 0.46;
  g.append(vfo(kx, ky, kr));
  // centre: display
  const sx = lw + 14, sw = kx - kr - 12 - sx - (big ? 46 : 0), sh = h * (look === 'mobile' ? 0.5 : 0.52), sy = 18;
  const colour = r.lcd === 'green' ? 'Green' : r.lcd === 'blue' ? 'Blue' : 'Amber';
  if (look === 'touch' || look === 'contest' || look === 'portable') g.append(scopeScreen(sx, sy, sw, sh, { on, freq, mode }));
  else g.append(lcd(sx, sy, sw, sh, { on, freq, mode, colour }));
  g.hot.lcd = [sx, sy, sw, sh];
  if (big) { g.append(knob(kx - kr - 30, h * 0.3, 9, { label: 'SUB', ink: g.ink }), knob(kx - kr - 30, h * 0.68, 7, { label: 'RIT', ink: g.ink })); }
  // keys under the display, small knobs bottom right
  const ky2 = sy + sh + 9;
  const nk = Math.max(4, Math.floor(sw / 19));
  g.append(keysRow(sx, ky2, nk, (sw - (nk - 1) * 3) / nk, 7.5, 3, ['BAND', 'MODE', 'FIL', 'NB', 'NR', 'ATT', 'PRE', 'RIT', 'SPL', 'A=B', 'V/M', 'MW', 'TUN', 'MTR']));
  if (h - ky2 > 26) g.append(keysRow(sx, ky2 + 12, nk, (sw - (nk - 1) * 3) / nk, 7.5, 3, ['160', '80', '40', '30', '20', '17', '15', '12', '10', '6', '2', 'GEN', 'ENT', 'CLR']));
  const sk = Math.min(6.5, h * 0.07);
  g.append(knob(kx - kr * 0.7, h - sk - 13, sk, { label: 'AF', ink: g.ink, angle: 20 }), knob(kx + kr * 0.7, h - sk - 13, sk, { label: 'RF', ink: g.ink, angle: 110 }));
  return g;
}

function handheld(r, w, h, { on = true } = {}) {
  const c = r.ht || {}, g = s('g', { filter: 'url(#arShadow)' });
  const bw = w * 0.72, bx = (w - bw) / 2, top = h * 0.22;
  g.append(s('rect', { x: bx + bw * 0.14, y: 0, width: 5, height: top + 6, rx: 2.5, fill: '#0c0d0f' }), s('rect', { x: bx + bw * 0.12, y: top - 6, width: 9, height: 8, rx: 1, fill: '#b9bfc6' }),
    s('rect', { x: bx + bw * 0.7, y: top - 9, width: 11, height: 11, rx: 2, fill: 'url(#arKnob)', stroke: '#07080a' }),
    s('rect', { x: bx, y: top, width: bw, height: h - top, rx: 9, fill: c.body || '#17191c', stroke: '#050607', 'stroke-width': 1.2 }), s('path', { d: `M${bx + 8} ${top + 1.2} h${bw - 16}`, stroke: '#fff', 'stroke-opacity': 0.2 }),
    s('rect', { x: bx - 2.5, y: top + 26, width: 3.5, height: 26, rx: 1.5, fill: c.accent || '#f39a1e' }),
    grille(bx + 9, top + 8, bw - 18, 14, 3),
    s('rect', { x: bx + 7, y: top + 28, width: bw - 14, height: (h - top) * 0.2, rx: 2, fill: on ? `url(#arLcd${c.lcd === 'amber' ? 'Amber' : c.lcd === 'white' ? 'Blue' : 'Green'})` : '#1a1c18', stroke: '#050607' }));
  if (on) g.append(mono(bx + 10, top + 28 + (h - top) * 0.14, '146.520', Math.min(9, bw / 5.4), '#14140c', { 'font-weight': 700 }));
  const ky = top + 34 + (h - top) * 0.2;
  for (let i = 0; i < 4; i++) g.append(keysRow(bx + 8, ky + i * ((h - ky - 8) / 4), 3, (bw - 16 - 6) / 3, Math.min(8, (h - ky - 8) / 4 - 2.5), 3, [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['*', '0', '#']][i]));
  g.hot = { power: [bx + bw * 0.7 + 5, top - 4], lcd: [bx + 7, top + 28, bw - 14, (h - top) * 0.2] };
  return g;
}

const post = (x, y, colour) => s('g', {}, s('polygon', { points: Array.from({ length: 6 }, (_, i) => `${x + Math.cos(i * Math.PI / 3) * 5.5},${y + Math.sin(i * Math.PI / 3) * 5.5}`).join(' '), fill: colour, stroke: '#07080a', 'stroke-width': 0.8 }), s('circle', { cx: x, cy: y, r: 2, fill: '#c9cfd6' }));

export function psu(item, w, h, { on = true, posts = true } = {}) {
  const kind = item.kind || 'switching';
  if (kind === 'battery') {
    const g = s('g', { filter: 'url(#arShadow)' });
    g.append(s('path', { d: `M${w * 0.25} 3 Q${w / 2} -9 ${w * 0.75} 3`, fill: 'none', stroke: '#15171a', 'stroke-width': 4, 'stroke-linecap': 'round' }),
      s('rect', { x: 0, y: 6, width: w, height: h - 6, rx: 5, fill: 'url(#arBlue)', stroke: '#07080a', 'stroke-width': 1.2 }), s('rect', { x: 0, y: 6, width: w, height: 9, rx: 4, fill: '#0e1622' }),
      s('rect', { x: w * 0.14, y: 0, width: 13, height: 9, rx: 1.5, fill: '#c62828', stroke: '#07080a' }), s('rect', { x: w * 0.86 - 13, y: 0, width: 13, height: 9, rx: 1.5, fill: '#1b1e22', stroke: '#07080a' }),
      txt(w * 0.14 + 6.5, 7, '+', 7, '#fff', { 'text-anchor': 'middle' }), txt(w * 0.86 - 6.5, 7, '−', 7, '#fff', { 'text-anchor': 'middle' }),
      s('rect', { x: w * 0.1, y: h * 0.36, width: w * 0.8, height: h * 0.44, rx: 2, fill: '#e9edf1' }), txt(w / 2, h * 0.55, /lfp|lifepo/i.test(item.name) ? 'LiFePO4' : 'SLA BATTERY', 6.5, '#17304f', { 'text-anchor': 'middle' }),
      txt(w / 2, h * 0.72, `${item.volts || 12.8} V · ${item.ah || item.amps} ${item.ah ? 'Ah' : 'A'}`, 6, '#17304f', { 'text-anchor': 'middle' }));
    g.hot = { sw: null, pos: [w * 0.14 + 6.5, 4], neg: [w * 0.86 - 6.5, 4] };
    return g;
  }
  const linear = kind === 'linear';
  const g = cabinet(w, h, { tone: linear ? 'black' : 'graphite', vents: 0 });
  g.hot = {};
  if (linear) {
    // heat-sink fins down both sides, two analogue meters, heavy binding posts
    for (let i = 0; i < 5; i++) g.append(s('rect', { x: 9, y: 16 + i * ((h - 34) / 5), width: 9, height: (h - 34) / 5 - 2.5, fill: '#0a0b0c' }), s('rect', { x: w - 18, y: 16 + i * ((h - 34) / 5), width: 9, height: (h - 34) / 5 - 2.5, fill: '#0a0b0c' }));
    const mw = (w - 60) / 2 - 4;
    g.append(meter(26, 14, mw, h * 0.36, { needle: on ? 0.7 : 0, label: 'VOLTS' }), meter(34 + mw, 14, mw, h * 0.36, { needle: on ? 0.18 : 0, label: 'AMPS' }));
  } else {
    // fan grille and a digital volt / amp display
    const fx = w - 30, fy = h * 0.36;
    g.append(s('circle', { cx: fx, cy: fy, r: 15, fill: '#0a0b0c', stroke: '#454b53' }));
    for (const rr of [4, 8, 12]) g.append(s('circle', { cx: fx, cy: fy, r: rr, fill: 'none', stroke: '#454b53', 'stroke-width': 0.9 }));
    g.append(s('path', { d: `M${fx - 15} ${fy} h30 M${fx} ${fy - 15} v30`, stroke: '#454b53', 'stroke-width': 0.9 }),
      s('rect', { x: 14, y: 14, width: w * 0.42, height: h * 0.32, rx: 2, fill: '#050608', stroke: '#2b3036' }), mono(18, 14 + h * 0.24, on ? '13.8' : '', h * 0.24, '#ff4a3a'), txt(14 + w * 0.42 - 3, 14 + h * 0.26, 'V', 6, '#ff4a3a', { 'text-anchor': 'end' }));
  }
  const by = h - 20;
  g.append(s('rect', { x: 24, y: by - 9, width: 22, height: 15, rx: 2, fill: '#0a0b0c', stroke: '#454b53' }), s('rect', { x: 26, y: on ? by - 7 : by - 1, width: 18, height: 7, rx: 1, fill: on ? '#c62828' : '#3a1513' }),
    txt(35, by + 14, on ? 'ON' : 'OFF', 4.6, g.ink, { 'text-anchor': 'middle' }), led(56, by - 2, 2.2, on),
    ...(posts ? [post(w - 62, by - 2, '#c62828'), post(w - 38, by - 2, '#1b1e22')] : []), txt(w - 62, by + 14, '+', 7, g.ink, { 'text-anchor': 'middle' }), txt(w - 38, by + 14, '−', 7, g.ink, { 'text-anchor': 'middle' }),
    txt(w / 2, h - 5, `13.8 V DC · ${item.amps || 30} A`, 4.6, g.ink, { 'text-anchor': 'middle', opacity: 0.8 }));
  g.hot = { sw: [35, by - 2], pos: [w - 62, by - 2], neg: [w - 38, by - 2] };
  return g;
}

export function tuner(item, w, h, { bypass = false } = {}) {
  const g = cabinet(w, h, { tone: 'black' });
  if (item.auto) {
    g.append(txt(10, h / 2 + 2, 'AUTO TUNER', 5.6, g.ink), s('rect', { x: w - 46, y: h / 2 - 7, width: 32, height: 13, rx: 2, fill: '#30353c', stroke: '#090a0c' }), txt(w - 30, h / 2 + 2, 'TUNE', 5, '#e9edf1', { 'text-anchor': 'middle' }));
    ['PWR', '1.5', '2.0', '3.0'].forEach((l, i) => g.append(led(w * 0.42 + i * 13, h / 2 - 3, 2, i < 2, i < 2 ? 'G' : 'R'), txt(w * 0.42 + i * 13, h / 2 + 8, l, 3.6, g.ink, { 'text-anchor': 'middle' })));
    return g;
  }
  const mw = Math.min(54, w * 0.3);
  g.append(meter(10, 12, mw, h * 0.42, { needle: 0.25, cross: true, label: 'SWR' }));
  const kx0 = mw + 26, kw = (w - kx0 - 8) / 3, r = Math.min(kw * 0.34, h * 0.2);
  ['TRANSMITTER', 'INDUCTOR', 'ANTENNA'].forEach((l, i) => g.append(knob(kx0 + kw * (i + 0.5), h * 0.42, r, { ticks: 11, label: l, ink: g.ink, angle: [-70, 30, 80][i] })));
  g.append(keysRow(12, h - 18, 3, (mw - 6) / 3, 8, 3, ['30W', '300W', bypass ? 'BYP' : 'TUNE']), txt(w - 10, h - 6, (item.maxW && item.maxW !== Infinity ? `${item.maxW} W` : ''), 4.6, g.ink, { 'text-anchor': 'end', opacity: 0.8 }));
  return g;
}

export function swrMeter(item, w, h, { needleId } = {}) {
  const g = cabinet(w, h, { tone: 'silver', vents: 0 });
  g.append(meter(10, 10, w - 20, h * 0.56, { needle: 0, cross: true, label: 'FWD   SWR   REF', id: needleId }), knob(w * 0.3, h - 14, 5.5, { silver: false, angle: -50 }), txt(w * 0.3, h - 3, 'RANGE', 3.8, g.ink, { 'text-anchor': 'middle' }),
    keysRow(w * 0.55, h - 18, 2, 12, 7, 3, ['PEP', 'AVG']));
  g.hot = { meter: [10, 10, w - 20, h * 0.56] };
  return g;
}

export function amplifier(item, w, h, { on = true } = {}) {
  const g = cabinet(w, h, { tone: 'black', vents: 4 });
  const mw = w * 0.2;
  if (item.tube) {
    // window with two glowing transmitting tubes
    const wx = 12, wy = 14, ww = w * 0.3, wh = h * 0.5;
    g.append(s('rect', { x: wx, y: wy, width: ww, height: wh, rx: 3, fill: '#090a0c', stroke: '#454b53' }));
    for (const f of [0.3, 0.7]) g.append(s('ellipse', { cx: wx + ww * f, cy: wy + wh * 0.55, rx: ww * 0.15, ry: wh * 0.4, fill: on ? 'url(#arTube)' : '#1b1e22', stroke: '#6b727a', 'stroke-width': 0.6 }), s('rect', { x: wx + ww * f - ww * 0.05, y: wy + wh * 0.3, width: ww * 0.1, height: wh * 0.45, fill: on ? '#ffe7b0' : '#3a3f45', opacity: 0.85 }));
    g.append(grille(wx + 2, wy + 2, ww - 4, wh - 4, 4), meter(wx + ww + 10, wy, mw, h * 0.34, { needle: 0.45, label: 'Ip' }), meter(wx + ww + 16 + mw, wy, mw, h * 0.34, { needle: 0.6, label: 'PWR' }));
    const kxa = wx + ww + 10;
    g.append(knob(kxa + 16, h - 30, 11, { ticks: 11, label: 'PLATE', ink: g.ink }), knob(kxa + 56, h - 30, 11, { ticks: 11, label: 'LOAD', ink: g.ink, angle: 40 }), knob(kxa + 96, h - 30, 9, { ticks: 6, label: 'BAND', ink: g.ink, angle: -90 }));
  } else {
    g.append(s('rect', { x: 14, y: 14, width: w * 0.5, height: h * 0.42, rx: 2, fill: '#050608', stroke: '#2b3036' }));
    for (let i = 0; i < 20; i++) g.append(s('rect', { x: 18 + i * ((w * 0.5 - 8) / 20), y: 20, width: (w * 0.5 - 8) / 20 - 1.2, height: h * 0.12, fill: i < 13 ? '#3cff8a' : i < 17 ? '#ffd54f' : '#ff4a3a', opacity: on && i < 12 ? 1 : 0.18 }));
    g.append(mono(18, 14 + h * 0.36, on ? `${item.out || 500} W` : '', h * 0.13, '#7fd3ff'), keysRow(14, h - 22, 5, 20, 9, 4, ['OPER', 'STBY', 'ANT', 'BAND', 'TUNE']),
      s('circle', { cx: w - 34, cy: h * 0.45, r: 20, fill: '#0a0b0c', stroke: '#454b53' }));
    for (const rr of [6, 11, 16]) g.append(s('circle', { cx: w - 34, cy: h * 0.45, r: rr, fill: 'none', stroke: '#454b53', 'stroke-width': 0.9 }));
  }
  g.append(led(w - 14, 14, 2.4, on), txt(w - 10, h - 6, `${item.out || ''} W PEP`, 4.6, g.ink, { 'text-anchor': 'end', opacity: 0.8 }));
  return g;
}

export function microphone(item, w, h) {
  const g = s('g', { filter: 'url(#arShadow)' });
  const desk = /desk|pr|heil|studio|boom/i.test(item.name || '') && !/hand|stock/i.test(item.name || '');
  if (desk) {
    g.append(s('ellipse', { cx: w / 2, cy: h - 5, rx: w * 0.42, ry: 5, fill: 'url(#arBlack)', stroke: '#07080a' }), s('rect', { x: w * 0.3, y: h - 12, width: w * 0.4, height: 7, rx: 2, fill: '#c62828' }),
      s('path', { d: `M${w / 2} ${h - 10} C ${w / 2} ${h * 0.5}, ${w * 0.3} ${h * 0.5}, ${w * 0.42} ${h * 0.28}`, fill: 'none', stroke: 'url(#arChrome)', 'stroke-width': 3, 'stroke-linecap': 'round' }),
      s('rect', { x: w * 0.3, y: 0, width: w * 0.36, height: h * 0.34, rx: w * 0.16, fill: 'url(#arSilver)', stroke: '#07080a', transform: `rotate(-18 ${w * 0.48} ${h * 0.17})` }), at(grille(w * 0.36, h * 0.06, w * 0.22, h * 0.2, 2.4), 0, 0));
  } else {
    g.append(s('path', { d: `M${w / 2} ${h * 0.62} c 0 8, -10 6, -10 14 s 10 6, 10 14`, fill: 'none', stroke: '#15171a', 'stroke-width': 2.2, 'stroke-linecap': 'round' }),
      s('rect', { x: w * 0.2, y: 0, width: w * 0.6, height: h * 0.62, rx: 7, fill: 'url(#arBlack)', stroke: '#07080a', 'stroke-width': 1.1 }), grille(w * 0.3, 6, w * 0.4, h * 0.2, 2.6),
      s('rect', { x: w * 0.12, y: h * 0.18, width: 4, height: h * 0.22, rx: 2, fill: '#3a3f45' }), keysRow(w * 0.3, h * 0.4, 2, w * 0.17, 6, 3));
  }
  return g;
}

export function morseKey(item, w, h) {
  const g = s('g', { filter: 'url(#arShadow)' });
  g.append(s('rect', { x: 0, y: h * 0.62, width: w, height: h * 0.38, rx: 3, fill: 'url(#arBlack)', stroke: '#07080a' }));
  if (item.iambic) {
    g.append(s('rect', { x: w * 0.36, y: h * 0.4, width: w * 0.28, height: h * 0.24, rx: 2, fill: 'url(#arChrome)', stroke: '#07080a', 'stroke-width': 0.6 }),
      s('rect', { x: w * 0.02, y: h * 0.3, width: w * 0.36, height: h * 0.16, rx: 3, fill: '#c62828', stroke: '#07080a', 'stroke-width': 0.6 }), s('rect', { x: w * 0.62, y: h * 0.3, width: w * 0.36, height: h * 0.16, rx: 3, fill: '#c62828', stroke: '#07080a', 'stroke-width': 0.6 }));
  } else {
    g.append(s('rect', { x: w * 0.12, y: h * 0.46, width: w * 0.76, height: 4, rx: 2, fill: 'url(#arChrome)' }), s('rect', { x: w * 0.6, y: h * 0.5, width: 6, height: h * 0.14, fill: 'url(#arChrome)' }),
      s('ellipse', { cx: w * 0.14, cy: h * 0.38, rx: w * 0.14, ry: h * 0.1, fill: '#15171a', stroke: '#454b53' }), s('rect', { x: w * 0.11, y: h * 0.4, width: 5, height: h * 0.1, fill: '#15171a' }));
    if (item.bug) g.append(s('circle', { cx: w * 0.88, cy: h * 0.48, r: 4, fill: 'url(#arChrome)' }));
  }
  return g;
}

export function dummyLoad(w, h) {
  const g = s('g', { filter: 'url(#arShadow)' });
  g.append(s('rect', { x: 0, y: 0, width: w, height: h, rx: 6, fill: 'url(#arSilver)', stroke: '#07080a', 'stroke-width': 1.2 }));
  for (let x = 10; x < w - 6; x += 7) g.append(s('line', { x1: x, y1: 4, x2: x, y2: h - 4, stroke: '#4d545c', 'stroke-width': 2 }));
  g.append(s('rect', { x: w * 0.2, y: h * 0.3, width: w * 0.6, height: h * 0.4, rx: 2, fill: '#f4e9c4', stroke: '#3a3426', 'stroke-width': 0.6 }), txt(w / 2, h * 0.58, '50 Ω LOAD', 6, '#3a3426', { 'text-anchor': 'middle' }));
  return g;
}

export function arrestor(w, h) {
  const g = s('g', { filter: 'url(#arShadow)' });
  g.append(s('rect', { x: w * 0.1, y: 0, width: w * 0.8, height: h, rx: 4, fill: 'url(#arSilver)', stroke: '#07080a', 'stroke-width': 1.1 }), s('rect', { x: w * 0.1, y: h * 0.4, width: w * 0.8, height: h * 0.2, fill: '#2a2f35' }),
    s('path', { d: `M${w * 0.56} ${h * 0.12} L${w * 0.38} ${h * 0.32} h${w * 0.2} L${w * 0.42} ${h * 0.56}`, fill: 'none', stroke: '#f2c230', 'stroke-width': 1.6, 'stroke-linejoin': 'round' }));
  return g;
}

export function groundBus(w, h) {
  const g = s('g', { filter: 'url(#arShadow)' });
  g.append(s('rect', { x: 0, y: 0, width: w, height: h, rx: 2.5, fill: 'url(#arCopper)', stroke: '#3d2410', 'stroke-width': 0.8 }), s('path', { d: `M3 1.5 H${w - 3}`, stroke: '#fff', 'stroke-opacity': 0.35 }));
  return g;
}

// connectors, drawn at their real shapes so the wiring diagram reads like a rear panel
export function connector(type, x, y, { pol, sel, used } = {}) {
  const g = s('g', {});
  const ring = sel ? '#ffd54f' : used ? '#5ee08a' : '#aeb8c2';
  if (sel) g.append(s('circle', { cx: x, cy: y, r: 15, fill: '#ffd54f', opacity: 0.22 }));
  if (type === 'coax') { // SO-239
    g.append(s('rect', { x: x - 9.5, y: y - 9.5, width: 19, height: 19, rx: 2, fill: '#8d949c', stroke: '#07080a' }), ...[[-6.5, -6.5], [6.5, -6.5], [-6.5, 6.5], [6.5, 6.5]].map(([dx, dy]) => s('circle', { cx: x + dx, cy: y + dy, r: 1.3, fill: '#2a2f35' })),
      s('circle', { cx: x, cy: y, r: 6.8, fill: '#d9dde1', stroke: ring, 'stroke-width': 1.6 }), s('circle', { cx: x, cy: y, r: 4.2, fill: '#f4f1e6' }), s('circle', { cx: x, cy: y, r: 1.5, fill: '#b8860b' }));
  } else if (type === 'post' || type === 'lead') {
    const col = pol === '+' ? '#d32f2f' : '#1b1e22';
    if (type === 'lead') g.append(s('rect', { x: x - 5, y: y - 13, width: 10, height: 14, rx: 2, fill: col, stroke: ring, 'stroke-width': 1.4 }), s('circle', { cx: x, cy: y + 4, r: 5, fill: '#c9a227', stroke: '#07080a', 'stroke-width': 0.8 }), s('circle', { cx: x, cy: y + 4, r: 2, fill: '#07080a' }));
    else g.append(post(x, y, col), s('circle', { cx: x, cy: y, r: 8.5, fill: 'none', stroke: ring, 'stroke-width': 1.4 }));
    g.append(txt(x, type === 'lead' ? y - 3 : y + 2.6, pol === '+' ? '+' : '−', 8, '#fff', { 'text-anchor': 'middle' }));
  } else if (type === 'gnd' || type === 'gbus') {
    const r = type === 'gbus' ? 5.5 : 7;
    g.append(s('circle', { cx: x, cy: y, r, fill: 'url(#arCopper)', stroke: ring, 'stroke-width': 1.5 }), s('path', { d: `M${x - r * 0.5} ${y} h${r} M${x} ${y - r * 0.5} v${r}`, stroke: '#3d2410', 'stroke-width': 1.2 }));
  } else if (type === 'micjack' || type === 'keyjack') {
    g.append(s('circle', { cx: x, cy: y, r: 8, fill: '#0a0b0c', stroke: ring, 'stroke-width': 1.6 }), s('circle', { cx: x, cy: y, r: type === 'micjack' ? 4.6 : 3, fill: '#22262b', stroke: '#6b727a', 'stroke-width': 0.6 }));
    if (type === 'micjack') for (let i = 0; i < 8; i++) g.append(s('circle', { cx: x + Math.cos(i * Math.PI / 4) * 3, cy: y + Math.sin(i * Math.PI / 4) * 3, r: 0.6, fill: '#c9a227' }));
  } else { // plug on the end of a cord
    g.append(s('rect', { x: x - 5, y: y - 11, width: 10, height: 15, rx: 2.5, fill: 'url(#arChrome)', stroke: ring, 'stroke-width': 1.4 }), s('rect', { x: x - 2, y: y - 16, width: 4, height: 6, fill: '#c9cfd6' }));
  }
  return g;
}

// ---------------------------------------------------------------- vehicles (side view)
// Each body is drawn in a box `len` units long with the ground at y = 0 (y is negative upward).
// mounts: named antenna positions [x, y] in the same units, plus what the car body gives as a
// ground plane there.
export const VEHICLES = {
  sedan: { label: 'Sedan', len: 15.5, ht: 4.7, plane: 0.85, mounts: { roof: [7.6, -4.7], trunk: [13.4, -3.4], hood: [2.6, -3.1], bumper: [15.2, -1.8] } },
  suv: { label: 'SUV', len: 16, ht: 5.8, plane: 0.95, mounts: { roof: [8.5, -5.8], hood: [2.4, -3.7], hatch: [15.3, -5.2], hitch: [16, -1.5] } },
  pickup: { label: 'Pickup truck', len: 19, ht: 6.1, plane: 0.9, mounts: { roof: [7.6, -6.1], hood: [2.6, -4], stake: [12.6, -4.2], toolbox: [11.4, -4.6], hitch: [19, -1.6] } },
  van: { label: 'Van / overlander', len: 19.5, ht: 8.4, plane: 1, mounts: { roof: [9.5, -8.4], ladder: [19.2, -7.6], hood: [2, -4.4], hitch: [19.5, -1.6] } },
  rv: { label: 'RV / motorhome', len: 28, ht: 10.8, plane: 0.7, mounts: { ladder: [27.6, -10.2], roof: [13, -10.8], hitch: [28, -1.8] } },
  semi: { label: 'Semi tractor', len: 22, ht: 12.6, plane: 0.8, mounts: { mirror: [8.2, -8.4], roof: [10.5, -12.6], frame: [18, -3.8] } },
  motorcycle: { label: 'Motorcycle', len: 7.4, ht: 4.2, plane: 0.3, mounts: { rack: [6.6, -3.2] } },
  atv: { label: 'Side-by-side / ATV', len: 10, ht: 6, plane: 0.45, mounts: { cage: [6.4, -6], rack: [9.4, -3.6] } },
  bicycle: { label: 'Bicycle', len: 5.8, ht: 3.4, plane: 0.1, mounts: { rack: [5, -2.6] } },
};
export const MOUNT_NAMES = { roof: 'Roof (magnet or NMO)', trunk: 'Trunk lip', hood: 'Hood / fender bracket', bumper: 'Rear bumper', hatch: 'Hatch / liftgate', hitch: 'Trailer hitch', stake: 'Bed stake pocket', toolbox: 'Bed toolbox', ladder: 'Rear ladder', mirror: 'Mirror bracket', frame: 'Frame rail behind the cab', rack: 'Rear rack', cage: 'Roll cage' };
export const PAINTS = { red: '#b3261e', blue: '#1f4e8c', white: '#e7ebef', black: '#1c1f23', silver: '#9aa3ad', green: '#2e6b3f', orange: '#d9691a', tan: '#b59b6d' };

const wheel = (x, r) => s('g', {}, s('circle', { cx: x, cy: -r, r, fill: '#101113', stroke: '#000', 'stroke-width': 0.06 }), s('circle', { cx: x, cy: -r, r: r * 0.58, fill: '#aab2ba', stroke: '#3a3f45', 'stroke-width': 0.05 }), s('circle', { cx: x, cy: -r, r: r * 0.16, fill: '#3a3f45' }),
  ...[0, 1, 2, 3, 4].map((i) => s('line', { x1: x, y1: -r, x2: x + Math.cos(i * 1.2566) * r * 0.55, y2: -r + Math.sin(i * 1.2566) * r * 0.55, stroke: '#5d656e', 'stroke-width': 0.07 })));
const glass = (d) => s('path', { d, fill: '#9cc7e6', opacity: 0.75, stroke: '#0c1218', 'stroke-width': 0.06 });

export function vehicle(type, paint = 'red') {
  const V = VEHICLES[type] || VEHICLES.sedan, c = PAINTS[paint] || paint, g = s('g', {});
  const body = (d) => s('path', { d, fill: c, stroke: '#07080a', 'stroke-width': 0.1, 'stroke-linejoin': 'round' });
  const shade = (d) => s('path', { d, fill: '#000', opacity: 0.22 });
  const lamp = (x, y, col) => s('rect', { x, y, width: 0.35, height: 0.5, rx: 0.1, fill: col });
  g.append(s('ellipse', { cx: V.len / 2, cy: 0.05, rx: V.len * 0.52, ry: 0.22, fill: '#000', opacity: 0.35 }));
  if (type === 'sedan') g.append(body('M0.3 -1.2 L0.4 -2.6 Q0.6 -3 2 -3.1 L4.6 -3.3 L6.3 -4.5 Q6.7 -4.7 7.4 -4.7 L10 -4.7 Q10.8 -4.7 11.4 -4.2 L12.6 -3.4 L14.8 -3.3 Q15.3 -3.2 15.3 -2.6 L15.3 -1.2 Z'), glass('M5 -3.3 L6.5 -4.4 L8.2 -4.4 L8.2 -3.3 Z'), glass('M8.5 -4.4 L10 -4.4 Q10.6 -4.4 11 -4 L11.9 -3.3 L8.5 -3.3 Z'), shade('M0.3 -1.2 H15.3 V-1.7 H0.3 Z'), lamp(0.35, -2.5, '#ffe9a8'), lamp(14.95, -2.7, '#d32f2f'), wheel(3, 1.05), wheel(12.4, 1.05));
  else if (type === 'suv') g.append(body('M0.3 -1.4 L0.4 -3.2 Q0.6 -3.7 2 -3.7 L4.2 -3.8 L5.6 -5.5 Q5.9 -5.8 6.6 -5.8 L14.6 -5.8 Q15.6 -5.8 15.7 -4.8 L15.8 -1.4 Z'), glass('M4.7 -3.9 L5.9 -5.4 L8 -5.4 L8 -3.9 Z'), glass('M8.3 -5.4 L11.2 -5.4 L11.2 -3.9 L8.3 -3.9 Z'), glass('M11.5 -5.4 L14.6 -5.4 L15.1 -3.9 L11.5 -3.9 Z'), s('rect', { x: 6, y: -6.05, width: 8.5, height: 0.14, fill: '#15171a' }), shade('M0.3 -1.4 H15.8 V-2 H0.3 Z'), lamp(0.35, -3.1, '#ffe9a8'), lamp(15.45, -3.6, '#d32f2f'), wheel(3.1, 1.3), wheel(12.8, 1.3));
  else if (type === 'pickup') g.append(body('M0.3 -1.6 L0.4 -3.5 Q0.6 -4 2 -4 L4.4 -4.1 L5.6 -5.8 Q5.9 -6.1 6.6 -6.1 L9.6 -6.1 Q10.4 -6.1 10.4 -5.4 L10.4 -4.2 L18.7 -4.2 L18.8 -1.6 Z'), glass('M4.9 -4.2 L5.9 -5.7 L7.6 -5.7 L7.6 -4.2 Z'), glass('M7.9 -5.7 L9.7 -5.7 L9.7 -4.2 L7.9 -4.2 Z'), s('rect', { x: 10.7, y: -4.75, width: 1.6, height: 0.55, rx: 0.1, fill: '#2a2f35' }), s('path', { d: 'M10.4 -4.2 V-1.8', stroke: '#07080a', 'stroke-width': 0.08 }), shade('M0.3 -1.6 H18.8 V-2.2 H0.3 Z'), lamp(0.35, -3.4, '#ffe9a8'), lamp(18.45, -3.6, '#d32f2f'), wheel(3.3, 1.45), wheel(15.2, 1.45));
  else if (type === 'van') g.append(body('M0.3 -1.6 L0.4 -4 Q0.5 -4.5 1.6 -4.6 L3 -7.6 Q3.4 -8.4 4.4 -8.4 L18.6 -8.4 Q19.3 -8.4 19.3 -7.6 L19.3 -1.6 Z'), glass('M2.3 -4.8 L3.5 -7.5 L5.8 -7.5 L5.8 -4.8 Z'), glass('M7 -7.2 L10 -7.2 L10 -5.4 L7 -5.4 Z'), s('rect', { x: 5, y: -8.85, width: 12, height: 0.18, fill: '#15171a' }), s('rect', { x: 8, y: -9.3, width: 7, height: 0.45, rx: 0.1, fill: '#2a2f35' }), s('path', { d: 'M19.3 -7.6 h0.25 v6 M19.3 -6.2 h0.25 M19.3 -4.8 h0.25 M19.3 -3.4 h0.25', fill: 'none', stroke: '#c9cfd6', 'stroke-width': 0.1 }), shade('M0.3 -1.6 H19.3 V-2.3 H0.3 Z'), lamp(0.35, -3.9, '#ffe9a8'), lamp(18.95, -4.2, '#d32f2f'), wheel(3.5, 1.45), wheel(15, 1.45));
  else if (type === 'rv') g.append(body('M0.3 -1.8 L0.4 -4.4 Q0.5 -5 1.6 -5.2 L3 -9.6 Q3.4 -10.8 4.8 -10.8 L27 -10.8 Q27.7 -10.8 27.7 -10 L27.7 -1.8 Z'), s('path', { d: 'M3 -8.2 H27.7', stroke: '#ffffff', 'stroke-opacity': 0.55, 'stroke-width': 0.5 }), glass('M2.2 -5.4 L3.4 -9.4 L6.4 -9.4 L6.4 -5.4 Z'), glass('M9 -8.6 L13 -8.6 L13 -6.2 L9 -6.2 Z'), glass('M15 -8.6 L19 -8.6 L19 -6.2 L15 -6.2 Z'), s('rect', { x: 21, y: -8.8, width: 2.2, height: 6.4, rx: 0.2, fill: '#000', opacity: 0.18, stroke: '#07080a', 'stroke-width': 0.06 }), s('rect', { x: 12, y: -11.5, width: 3.4, height: 0.7, rx: 0.15, fill: '#e7ebef', stroke: '#07080a', 'stroke-width': 0.06 }), s('path', { d: 'M27.7 -10 h0.3 v8 M27.7 -8.4 h0.3 M27.7 -6.8 h0.3 M27.7 -5.2 h0.3 M27.7 -3.6 h0.3', fill: 'none', stroke: '#c9cfd6', 'stroke-width': 0.12 }), shade('M0.3 -1.8 H27.7 V-2.6 H0.3 Z'), lamp(0.35, -4.2, '#ffe9a8'), lamp(27.35, -4.6, '#d32f2f'), wheel(4.4, 1.6), wheel(20.4, 1.6), wheel(23.6, 1.6));
  else if (type === 'semi') g.append(s('rect', { x: 11.6, y: -3.8, width: 10, height: 0.9, fill: '#2a2f35', stroke: '#07080a', 'stroke-width': 0.08 }), s('rect', { x: 15.5, y: -4.5, width: 4, height: 0.7, rx: 0.2, fill: '#3a3f45' }), body('M0.4 -2 L0.5 -6.4 Q0.6 -7 1.8 -7 L5.2 -7.2 L5.6 -9.6 Q5.8 -10.2 6.6 -10.2 L7.2 -10.2 L8 -12 Q8.3 -12.6 9.2 -12.6 L11.4 -12.6 Q12 -12.6 12 -11.8 L12 -2 Z'), glass('M5.9 -7.4 L6.2 -9.6 L8.2 -9.6 L8.2 -7.4 Z'), glass('M9 -10.4 L11 -10.4 L11 -8.2 L9 -8.2 Z'), s('rect', { x: 0.4, y: -5.6, width: 0.5, height: 2.8, fill: '#c9cfd6' }), s('rect', { x: 12.2, y: -11.6, width: 0.45, height: 8, fill: 'url(#arChrome)' }), s('rect', { x: 8, y: -8.6, width: 0.3, height: 1.4, fill: '#15171a' }), shade('M0.4 -2 H12 V-2.8 H0.4 Z'), lamp(0.45, -3.6, '#ffe9a8'), wheel(3.4, 1.75), wheel(15.6, 1.75), wheel(19.2, 1.75));
  else if (type === 'motorcycle') g.append(wheel(1.4, 1.15), wheel(5.9, 1.15), s('path', { d: 'M1.4 -1.15 L2.6 -3.3 M2.3 -2.8 L4.3 -1.3 L5.9 -1.15 M4.3 -1.3 L3.4 -2.6', fill: 'none', stroke: '#2a2f35', 'stroke-width': 0.22, 'stroke-linecap': 'round' }), body('M2.5 -3 Q3.4 -3.6 4.3 -3 L4.4 -2.5 L2.6 -2.5 Z'), s('path', { d: 'M4.3 -2.9 Q5.4 -3.1 6 -2.7 L6 -2.4 L4.4 -2.5 Z', fill: '#15171a', stroke: '#07080a', 'stroke-width': 0.06 }), s('rect', { x: 5.9, y: -3.3, width: 1.1, height: 0.14, fill: '#c9cfd6' }), s('rect', { x: 3, y: -2.3, width: 1.5, height: 1.1, rx: 0.2, fill: '#5d656e', stroke: '#07080a', 'stroke-width': 0.06 }), s('path', { d: 'M2.6 -3.3 L2.1 -3.9 L2.9 -3.9', fill: 'none', stroke: '#c9cfd6', 'stroke-width': 0.14 }), lamp(1.9, -3.5, '#ffe9a8'));
  else if (type === 'atv') g.append(s('path', { d: 'M3.2 -3.2 L3.8 -6 L8 -6 L8.6 -3.2 M5.8 -6 L5.8 -3.2', fill: 'none', stroke: '#15171a', 'stroke-width': 0.28, 'stroke-linejoin': 'round' }), body('M0.5 -1.8 L0.8 -3 Q1 -3.4 2.4 -3.4 L8.8 -3.4 L9.6 -2.8 L9.6 -1.8 Z'), s('rect', { x: 8.8, y: -3.75, width: 1, height: 0.3, fill: '#2a2f35' }), s('rect', { x: 4.2, y: -4.4, width: 1.1, height: 1, rx: 0.2, fill: '#15171a' }), shade('M0.5 -1.8 H9.6 V-2.2 H0.5 Z'), lamp(0.6, -2.9, '#ffe9a8'), wheel(2.2, 1.4), wheel(8, 1.4));
  else if (type === 'bicycle') { const w2 = (x) => s('g', {}, s('circle', { cx: x, cy: -1.1, r: 1.1, fill: 'none', stroke: '#101113', 'stroke-width': 0.14 }), s('circle', { cx: x, cy: -1.1, r: 0.98, fill: 'none', stroke: '#aab2ba', 'stroke-width': 0.04 })); g.append(w2(1.2), w2(4.5), s('path', { d: 'M1.2 -1.1 L2.2 -2.6 L3.8 -2.5 L2.7 -1.1 Z M2.7 -1.1 L4.5 -1.1 L3.8 -2.5 M2.2 -2.6 L2 -3 M3.8 -2.5 L3.6 -3.1', fill: 'none', stroke: c, 'stroke-width': 0.14, 'stroke-linejoin': 'round' }), s('rect', { x: 3.1, y: -3.25, width: 0.9, height: 0.18, rx: 0.08, fill: '#15171a' }), s('path', { d: 'M1.7 -3 H2.3', stroke: '#15171a', 'stroke-width': 0.14 }), s('path', { d: 'M3.9 -2.6 H5.4 M4.5 -1.1 L5.2 -2.6', fill: 'none', stroke: '#5d656e', 'stroke-width': 0.1 })); }
  return g;
}

// A mobile whip with its mount, base at (0,0), tip at -len (same units as the vehicle).
export function whip(len, { coil = false } = {}) {
  const g = s('g', {});
  g.append(s('rect', { x: -0.22, y: -0.3, width: 0.44, height: 0.3, fill: '#15171a' }), s('line', { x1: 0, y1: -0.3, x2: 0, y2: -len, stroke: '#ffb347', 'stroke-width': 0.12, 'stroke-linecap': 'round' }));
  if (coil) g.append(s('rect', { x: -0.2, y: -len * 0.5, width: 0.4, height: Math.min(1.4, len * 0.25), rx: 0.1, fill: '#e7ebef', stroke: '#07080a', 'stroke-width': 0.05 }));
  g.append(s('circle', { cx: 0, cy: -len, r: 0.12, fill: '#ffb347' }));
  return g;
}
