// Rig builder: assemble a station from real-world equipment and check it like an engineer.
// Power budget (supply amps vs. radio draw), amplifier drive and mains, tuner and meter ratings,
// band and receive coverage, cost and weight. "Use this station" puts it on the air.
import { S, save } from './state.js';
import { h, bus, toast } from './util.js';
import { RIGS, GEAR_DEFAULT } from './rigs.js';
import { GEAR, REAL_RIGS } from './data/gear.js';
import { BANDS } from './data/bandplan.js';

const SLOTS = ['psu', 'tuner', 'meter', 'amp', 'mic', 'key', 'arrestor'];
const GROUPS = [
  ['Base & mobile HF', (r) => !['ht', 'sdr', 'portable'].includes(r.look) && r.tx.length],
  ['Portable', (r) => r.look === 'portable'],
  ['Handhelds', (r) => r.look === 'ht'],
  ['Receivers (listen only)', (r) => !r.tx.length],
];
const PRESETS = [
  ['Budget starter', { rig: 'ft891', psu: 'gen30', tuner: 'gen300', meter: 'gen200', amp: 'none', mic: 'stock', key: 'gen' }],
  ['Classic home station', { rig: 'ic7300', psu: 'rs35m', tuner: 'mfj949', meter: 'cn901', amp: 'none', mic: 'heilpr781', key: 'by1' }],
  ['POTA / portable', { rig: 'ic705', psu: 'lfp20', tuner: 'z100', meter: 'gen200', amp: 'none', mic: 'stock', key: 'by1' }],
  ['Contest super-station', { rig: 'k4', psu: 'rs35m', tuner: 'at2k', meter: 'lp500', amp: 'spe13k', mic: 'heilpro7', key: 'by1', mains240: true }],
  ['Handheld only', { rig: 'uv5r', psu: 'sla12', tuner: 'none', meter: 'gen200', amp: 'none', mic: 'stock', key: 'gen' }],
  ['SDR listening post', { rig: 'rspdx', psu: 'gen30', tuner: 'none', meter: 'gen200', amp: 'none', mic: 'stock', key: 'gen' }],
];

let root;
const draft = () => (S.rbDraft ||= { rig: S.rig || 'allmode', ...GEAR_DEFAULT, ...(S.gear || {}) });

export function initRigBuilder(el) { root = el; render(); }

// ------------------------------------------------------------------ analysis
export function analyze(d) {
  const r = RIGS[d.rig] || RIGS.allmode;
  const it = (c) => GEAR[c].items[d[c]] || Object.values(GEAR[c].items)[0];
  const psu = it('psu'), tuner = it('tuner'), meter = it('meter'), amp = it('amp');
  const checks = [];
  const ok = (t) => checks.push(['ok', t]), warn = (t) => checks.push(['warn', t]), bad = (t) => checks.push(['bad', t]);
  // power budget
  const need = r.drawA || 0;
  let rigW = r.maxW;
  if (!r.tx.length) ok(`Receive-only: draws ${need} A — anything will power it.`);
  else if (psu.amps >= need) ok(`Power supply: ${psu.name} gives ${psu.amps} A; the ${r.name} draws ~${need} A at ${r.maxW} W. ${psu.amps - need >= 3 ? 'Good headroom.' : 'Tight but OK.'}`);
  else { rigW = Math.max(1, Math.floor(r.maxW * Math.max(0, (psu.amps - 2) / (need - 2)) / 5) * 5); bad(`Power supply too small: ${psu.amps} A available, ${need} A needed. Voltage sags on voice peaks — you\'ll only get about ${rigW} W (and the radio may reset).`); }
  if (psu.kind === 'battery' && r.maxW > 20) warn(`A battery at ${psu.volts} V under load: most 100 W radios lose power below 13 V. Expect less output as it drains.`);
  if (psu.kind === 'switching' && psu.noiseDb >= 1) warn('Cheap switching supplies can put "birdies" and hash on 160–40 m. A linear supply is quieter.');
  // amplifier
  let outW = rigW, ampNote = '';
  if (amp.out) {
    if (!r.tx.length || r.look === 'ht') bad(`An HF amplifier can't be driven by the ${r.name}.`);
    else if (amp.mains === 240 && !d.mains240) bad(`${amp.name} needs a 240 V / ${amp.mainsA} A circuit. Tick "240 V outlet" (an electrician job) or pick a 120 V amp.`);
    else if (rigW < amp.drive * 0.8) bad(`${amp.name} needs ~${amp.drive} W of drive; your radio delivers ${rigW} W. It will barely move the needle.`);
    else { outW = amp.out; ok(`${amp.name}: ${amp.drive} W in → ${amp.out} W out (${(10 * Math.log10(amp.out / Math.max(1, rigW))).toFixed(1)} dB more signal). ${amp.tube ? 'Tube amp: tune the plate & load on each band.' : 'Solid state: no tune-up.'}`); ampNote = ` via ${amp.name}`; }
    if (amp.mains === 120) warn(`${amp.name} pulls ~${amp.mainsA} A from a 120 V outlet — put it on its own circuit.`);
    if (outW > 200) warn('Above 200 W: Technicians are limited to 200 W on HF; do an RF-exposure evaluation (FCC §97.13).');
  }
  // tuner & meter ratings
  if (tuner.maxW < outW) bad(`${tuner.name} is rated ${tuner.maxW} W but you\'ll run ${outW} W — it will arc. Pick a higher-power tuner.`);
  else if (tuner.maxW !== Infinity) ok(`Tuner: ${tuner.name} (${tuner.maxW} W rating, ~${tuner.range}:1 match range).`);
  else if (r.atu) ok(`Using the ${r.name}'s internal ATU (matches about 3:1).`);
  else if (r.tx.length && r.look !== 'ht') warn(`No tuner at all and the ${r.name} has no internal ATU: you need resonant antennas (SWR < 2:1 or the radio folds back).`);
  if (meter.maxW < outW) warn(`${meter.name} only reads to ${meter.maxW} W — it will pin at ${outW} W.`);
  if (r.tx.includes('2m') && meter.hi < 148e6) warn(`${meter.name} only covers HF/6 m — it won't read correctly on 2 m.`);
  if (r.tx.length && !r.look?.includes('ht') && !GEAR.key.items[d.key]?.iambic && !GEAR.key.items[d.key]?.bug) ok('Straight key: you\'ll send at your own pace (the keyer is bypassed).');
  // coverage
  const tx = r.tx.length ? r.tx.join(' ') : 'none';
  const rxTxt = r.rxBands ? r.rxBands.map(([a, b]) => `${a / 1e6}–${b / 1e6}`).join(', ') + ' MHz' : `${(r.rx[0] / 1e6).toFixed(r.rx[0] < 1e6 ? 2 : 1)}–${r.rx[1] / 1e6} MHz`;
  if (!r.modes.includes('AM')) warn('No AM receive: you can\'t hear airband or AM broadcast.');
  if (!r.modes.includes('LSB')) warn('FM only: no SSB or CW — HF voice and Morse are out.');
  if (!r.scope) warn('No spectrum scope: you\'ll find stations by tuning and listening.');
  const cost = (r.usd || 0) + SLOTS.reduce((s, c) => s + (it(c).usd || 0), 0);
  const kg = (r.weight || 3) + (psu.kind === 'linear' ? 12 : psu.kind === 'battery' ? (psu.amps > 10 ? 2.5 : 2.7) : 1.5) + (amp.out ? (amp.tube ? 22 : 12) : 0) + (tuner.usd ? 2.5 : 0) + (meter.usd ? 1 : 0);
  return { r, psu, tuner, meter, amp, checks, outW, rigW, ampNote, tx, rxTxt, cost, kg, ok: !checks.some((c) => c[0] === 'bad') };
}

// ------------------------------------------------------------------ desk drawing (SVG)
const NS = 'http://www.w3.org/2000/svg';
const s = (tag, a = {}, ...kids) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(a)) e.setAttribute(k, v); for (const c of kids) if (c != null) e.append(typeof c === 'string' ? document.createTextNode(c) : c); return e; };
const label = (x, y, t, cls = 'rb-lbl') => s('text', { x, y, class: cls, 'text-anchor': 'middle' }, t);
const knob = (x, y, r, fill = 'url(#rbKnob)') => s('g', {}, s('circle', { cx: x, cy: y, r, fill, stroke: '#0a0b0d', 'stroke-width': 1.5 }), s('circle', { cx: x, cy: y - r * 0.6, r: r * 0.12, fill: '#cfd6dd' }));
const keys = (x, y, n, w = 14, hgt = 7, gap = 4) => s('g', {}, ...Array.from({ length: n }, (_, i) => s('rect', { x: x + i * (w + gap), y, width: w, height: hgt, rx: 1.5, fill: '#2b3036', stroke: '#0c0e10' })));

function drawRadio(r, x, y) {
  const g = s('g', { transform: `translate(${x},${y})` });
  if (r.look === 'ht') {
    const c = r.ht || {};
    g.append(s('rect', { x: 40, y: -40, width: 6, height: 50, rx: 3, fill: '#111' }), s('rect', { x: 20, y: 0, width: 70, height: 150, rx: 12, fill: c.body || '#16181b', stroke: '#000' }),
      s('rect', { x: 30, y: 30, width: 50, height: 28, rx: 3, fill: c.lcd === 'amber' ? '#c98a2a' : c.lcd === 'white' ? '#d7dde1' : '#4c8a5a' }),
      s('rect', { x: 30, y: 8, width: 50, height: 16, rx: 3, fill: '#0b0c0d' }), ...[0, 1, 2, 3].map((i) => keys(30, 66 + i * 12, 3, 13, 8, 5)),
      s('rect', { x: 20, y: 40, width: 4, height: 30, fill: c.accent || '#f39a1e' }), label(55, 170, r.name));
    return g;
  }
  const W = r.look === 'contest' ? 330 : r.look === 'portable' ? 190 : r.look === 'mobile' ? 170 : r.look === 'sdr' ? 120 : 270, H = r.look === 'contest' ? 120 : r.look === 'mobile' ? 62 : r.look === 'sdr' ? 34 : 98;
  g.append(s('rect', { x: 0, y: 150 - H, width: W, height: H, rx: 8, fill: 'url(#rbMetal)', stroke: '#0a0b0d', 'stroke-width': 1.5 }));
  const top = 150 - H;
  if (r.look === 'sdr') { g.append(s('rect', { x: 8, y: top + 10, width: W - 16, height: 12, rx: 2, fill: '#0d1013' }), s('circle', { cx: W - 14, cy: top + 16, r: 3, fill: '#3cff8a' })); }
  else if (r.look === 'touch' || r.look === 'contest' || r.look === 'portable') {
    const sw = r.look === 'contest' ? 170 : r.look === 'portable' ? 92 : 128, sx = r.look === 'contest' ? 80 : 62;
    g.append(s('rect', { x: sx, y: top + 10, width: sw, height: H - 30, rx: 3, fill: '#05080b', stroke: '#22282e' }),
      s('rect', { x: sx + 3, y: top + 13, width: sw - 6, height: (H - 36) * 0.45, fill: 'url(#rbScope)' }),
      s('rect', { x: sx + 3, y: top + 13 + (H - 36) * 0.45, width: sw - 6, height: (H - 36) * 0.55, fill: 'url(#rbWf)' }),
      s('text', { x: sx + 6, y: top + 24, class: 'rb-lcdtxt' }, '14.074.00'));
    g.append(knob(sx + sw + (W - sx - sw) / 2, top + H / 2, Math.min(28, (W - sx - sw) / 2 - 8)));
    if (r.look === 'contest') g.append(knob(40, top + 60, 18));
    g.append(keys(8, top + 12, 2, 20, 9), keys(8, top + 28, 2, 20, 9), keys(sx, top + H - 16, Math.floor(sw / 18), 14, 7));
  } else {
    // classic / mobile: segment LCD + rows of keys + big knob
    g.append(s('rect', { x: 14, y: top + 10, width: W * 0.5, height: H * 0.42, rx: 3, fill: '#2a1a05', stroke: '#111' }),
      s('text', { x: 22, y: top + 10 + H * 0.3, class: 'rb-lcdtxt amber' }, '14.250.00'),
      keys(14, top + H * 0.6, 6, 16, 8), keys(14, top + H * 0.78, 6, 16, 8), knob(W * 0.78, top + H / 2, Math.min(30, H / 2 - 6)));
  }
  g.append(s('circle', { cx: 12, cy: 150 - 10, r: 3, fill: '#ff4a3a', class: 'rb-led' }), label(W / 2, 170, r.name));
  g.w = W;
  return g;
}
function box(x, y, w, hh, name, inner) {
  const g = s('g', { transform: `translate(${x},${y})` }, s('rect', { x: 0, y: 150 - hh, width: w, height: hh, rx: 6, fill: 'url(#rbMetal)', stroke: '#0a0b0d', 'stroke-width': 1.5 }));
  inner && inner(g, 150 - hh, w, hh);
  g.append(label(w / 2, 170, name));
  return g;
}
const meterFace = (g, x, y, w, hh, n = 1) => { g.append(s('rect', { x, y, width: w, height: hh, rx: 3, fill: '#efe7cf', stroke: '#222' })); for (let i = 0; i < n; i++) g.append(s('line', { x1: x + w * (n === 2 ? (i ? 0.85 : 0.15) : 0.5), y1: y + hh - 2, x2: x + w * (n === 2 ? 0.5 : 0.65), y2: y + 5, stroke: i ? '#c22' : '#111', 'stroke-width': 1.2 })); };

function drawDesk(A, d) {
  const svg = s('svg', { viewBox: '0 0 1100 260', class: 'rb-desk' },
    s('defs', {},
      s('linearGradient', { id: 'rbMetal', x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, 'stop-color': '#3a4048' }), s('stop', { offset: 1, 'stop-color': '#1b1f24' })),
      s('radialGradient', { id: 'rbKnob', cx: 0.35, cy: 0.3 }, s('stop', { offset: 0, 'stop-color': '#5a616a' }), s('stop', { offset: 1, 'stop-color': '#111418' })),
      s('linearGradient', { id: 'rbScope', x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, 'stop-color': '#0b2340' }), s('stop', { offset: 1, 'stop-color': '#1e7fd0' })),
      s('linearGradient', { id: 'rbWf', x1: 0, y1: 0, x2: 1, y2: 0 }, s('stop', { offset: 0, 'stop-color': '#061a3a' }), s('stop', { offset: 0.4, 'stop-color': '#0a3a6a' }), s('stop', { offset: 0.45, 'stop-color': '#f2d33a' }), s('stop', { offset: 0.5, 'stop-color': '#0a3a6a' }), s('stop', { offset: 1, 'stop-color': '#061a3a' })),
      s('linearGradient', { id: 'rbWood', x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, 'stop-color': '#7a5634' }), s('stop', { offset: 1, 'stop-color': '#4e3520' }))),
    s('rect', { x: 0, y: 150, width: 1100, height: 30, fill: 'url(#rbWood)' }), s('rect', { x: 0, y: 180, width: 1100, height: 80, fill: '#11151a' }));
  let x = 20;
  const place = (g, w) => { svg.append(g); const cx = x; x += w + 26; return cx; };
  const psuX = place(box(x, 0, 120, A.psu.kind === 'battery' ? 50 : 70, A.psu.name.replace(/^Generic /, ''), (g, t, w, hh) => {
    if (A.psu.kind === 'battery') { g.append(s('rect', { x: 20, y: t - 6, width: 16, height: 6, fill: '#c22' }), s('rect', { x: 84, y: t - 6, width: 16, height: 6, fill: '#111' }), s('text', { x: 60, y: t + 30, class: 'rb-lbl', 'text-anchor': 'middle' }, `${A.psu.volts} V`)); return; }
    meterFace(g, 10, t + 10, 44, 26); meterFace(g, 62, t + 10, 44, 26);
    g.append(s('circle', { cx: 20, cy: t + hh - 14, r: 5, fill: '#c22' }), s('circle', { cx: 40, cy: t + hh - 14, r: 5, fill: '#111', stroke: '#555' }), s('rect', { x: 86, y: t + hh - 20, width: 22, height: 12, rx: 2, fill: '#222' }));
  }), 120);
  const rg = drawRadio(A.r, 0, 0); const rw = A.r.look === 'ht' ? 110 : rg.w || 270;
  rg.setAttribute('transform', `translate(${x},0)`); const rigX = place(rg, rw);
  let ampX = null;
  if (A.amp.out) ampX = place(box(x, 0, 190, 110, A.amp.name, (g, t, w) => { meterFace(g, 14, t + 14, 60, 34); meterFace(g, 84, t + 14, 60, 34); g.append(knob(40, t + 80, 14), knob(90, t + 80, 14), knob(150, t + 80, 14), s('circle', { cx: 175, cy: t + 20, r: 4, fill: '#3cff8a' })); }), 190);
  const meterX = place(box(x, 0, 100, 64, A.meter.name.replace(/^Generic /, ''), (g, t) => meterFace(g, 12, t + 8, 76, 40, 2)), 100);
  let tunerX = null;
  if (A.tuner.usd) tunerX = place(box(x, 0, 150, A.tuner.auto ? 40 : 80, A.tuner.name.replace(/^Generic /, ''), (g, t, w, hh) => { if (A.tuner.auto) { g.append(s('circle', { cx: 20, cy: t + 20, r: 4, fill: '#3cff8a' }), s('rect', { x: 90, y: t + 12, width: 40, height: 14, rx: 2, fill: '#222' })); return; } g.append(knob(30, t + hh / 2, 16), knob(75, t + hh / 2, 16), knob(120, t + hh / 2, 16)); }), 150);
  // cables: DC (red/black) PSU→rig, coax rig→(amp)→meter→(tuner)→wall
  // Each cable gets a light casing underneath so dark leads/coax stay visible on the dark bench.
  const cable = (d, col, w) => svg.append(
    s('path', { d, stroke: '#c9d3dd', 'stroke-width': w + 3, fill: 'none', 'stroke-linecap': 'round', opacity: 0.55 }),
    s('path', { d, stroke: col, 'stroke-width': w, fill: 'none', 'stroke-linecap': 'round' }));
  const cab = (x1, x2, col, dy) => cable(`M${x1} ${150 + dy} C ${x1} ${205 + dy}, ${x2} ${205 + dy}, ${x2} ${150 + dy}`, col, 4);
  cab(psuX + 100, rigX + 20, '#e53935', 6); cab(psuX + 110, rigX + 30, '#3a3f45', 10);
  const chain = [rigX + rw - 30, ampX && ampX + 20, ampX && ampX + 170, meterX + 20, meterX + 80, tunerX && tunerX + 20, tunerX && tunerX + 130].filter((v) => v != null);
  for (let i = 0; i + 1 < chain.length; i += 2) cab(chain[i], chain[i + 1], '#33383e', 14);
  const last = chain[chain.length - 1];
  const wallX = Math.max(1000, x + 40);
  svg.setAttribute('viewBox', `0 0 ${wallX + 60} 260`);
  svg.querySelectorAll('rect[width="1100"]').forEach((r) => r.setAttribute('width', wallX + 60));
  svg.append(s('rect', { x: wallX, y: 20, width: 14, height: 160, fill: '#2a2f35' }), s('circle', { cx: wallX + 7, cy: 120, r: 6, fill: '#c9a227' }));
  cable(`M${last} 164 C ${last} 235, ${wallX + 7} 235, ${wallX + 7} 126`, '#33383e', 5);
  svg.append(label(wallX + 7, 12, 'wall feedthrough → antenna'));
  return svg;
}

// ------------------------------------------------------------------ UI
function render() {
  if (!root) return;
  const d = draft(), A = analyze(d);
  root.innerHTML = '';
  const rigSel = h('select', { id: 'rb-rig' }, ...GROUPS.map(([g, f]) => h('optgroup', { label: g }, ...Object.entries(RIGS).filter(([, r]) => f(r)).map(([id, r]) => h('option', { value: id, selected: d.rig === id }, `${r.name}${REAL_RIGS[id] ? ` — $${r.usd}` : ' (generic)'}`)))));
  rigSel.onchange = () => { d.rig = rigSel.value; save(); render(); };
  const slot = (cat) => {
    const G = GEAR[cat];
    const sel = h('select', { 'data-slot': cat }, ...Object.entries(G.items).map(([id, it]) => h('option', { value: id, selected: d[cat] === id }, `${it.name}${it.usd ? ` — $${it.usd}` : ''}`)));
    sel.onchange = () => { d[cat] = sel.value; save(); render(); };
    const it = G.items[d[cat]];
    return h('div', { class: 'rb-slot' }, h('div', { class: 'row spread' }, h('b', {}, G.label), h('button', { class: 'link small', onclick: () => bus.emit('open-manual', d.rig, cat) }, 'Guide')), sel, h('div', { class: 'tiny muted' }, it.desc));
  };
  const r = A.r;
  const m240 = h('input', { type: 'checkbox', checked: !!d.mains240 }); m240.onchange = () => { d.mains240 = m240.checked; save(); render(); };
  const inUse = S.rig === d.rig && SLOTS.every((c) => (S.gear || {})[c] === d[c]);
  root.append(
    h('div', { class: 'card' },
      h('div', { class: 'row spread wrap' }, h('div', {}, h('h2', {}, 'Equipment'), h('p', { class: 'muted small' }, 'Assemble a station from real equipment. Every choice changes the simulation: supply current limits your output, amplifiers need drive (and sometimes 240 V), tuners and meters have power ratings, receivers have gaps, better mics add talk power.')),
        h('div', { class: 'row wrap rb-presets' }, ...PRESETS.map(([n, p]) => h('button', { class: 'btn small', onclick: () => { Object.assign(d, GEAR_DEFAULT, p); save(); render(); } }, n)))),
      drawDesk(A, d)),
    h('div', { class: 'rb-grid' },
      h('div', { class: 'card rb-slots' },
        h('div', { class: 'rb-slot' }, h('div', { class: 'row spread' }, h('b', {}, 'Radio'), h('button', { class: 'link small', onclick: () => bus.emit('open-manual', d.rig) }, 'Operating guide')), rigSel, h('div', { class: 'tiny muted' }, r.blurb)),
        ...SLOTS.map(slot),
        h('label', { class: 'inline small' }, m240, ' My shack has a 240 V outlet (for big amplifiers)')),
      h('div', { class: 'card rb-spec' },
        h('h3', {}, `${r.name}${A.amp.out && A.outW > A.rigW ? ` + ${A.amp.name}` : ''}`),
        h('table', { class: 'tbl small' },
          ...[['Class', r.cls], ['Output', r.tx.length ? `${A.outW} W${A.ampNote}${A.rigW < r.maxW ? ` (radio limited to ${A.rigW} W by the supply)` : ''}${r.maxWvhf ? ` · ${r.maxWvhf} W on 2 m` : ''}` : 'receive only'],
            ['Transmit', A.tx], ['Receive', A.rxTxt], ['Modes', r.modes.join(' / ')],
            ['Receiver', `${r.quietRx > 2 ? 'excellent' : r.quietRx > 0 ? 'very good' : r.quietRx < -2 ? 'basic (noisy, overloads)' : 'good'}${r.narrowCw ? ', narrow CW filters' : ''}${r.dsp ? ', DSP NR' : ''}${r.preamps ? `, ${r.preamps} preamp${r.preamps > 1 ? 's' : ''}` : ''}`],
            ['Features', [r.atu && 'internal ATU', r.scope && 'spectrum scope', r.ifs && 'IF shift', r.notch && 'notch', r.battery && 'internal battery'].filter(Boolean).join(' · ') || '—'],
            ['Current draw', `${r.drawA || '?'} A @ 13.8 V (TX)`], ['Station cost', `≈ $${A.cost.toLocaleString()}`], ['Weight', `≈ ${A.kg.toFixed(1)} kg`]].map(([k, v]) => h('tr', {}, h('th', {}, k), h('td', {}, v)))),
        h('h4', {}, A.ok ? 'Engineering check: good to go' : 'Engineering check: problems to fix'),
        h('ul', { class: 'rb-checks' }, ...A.checks.map(([k, t]) => h('li', { class: k }, `${k === 'ok' ? '✓' : k === 'warn' ? '' : '✗'} ${t}`))),
        h('div', { class: 'row' },
          h('button', { class: 'btn primary big', id: 'rb-apply', disabled: inUse, onclick: () => apply(d) }, inUse ? '✓ This is your station' : 'Use this station')),
        h('p', { class: 'muted tiny' }, 'Specs are approximate published figures; prices are typical US street prices, shown for reference. Product names identify equipment only — no affiliation with any manufacturer.'))));
}

function apply(d) {
  S.rig = d.rig;
  S.gear = Object.fromEntries([...SLOTS, 'mains240'].map((k) => [k, d[k]]));
  save(); bus.emit('rig'); bus.emit('gear');
  const A = analyze(d);
  toast(`Station updated: ${A.r.name}, ${A.r.tx.length ? `${A.outW} W` : 'receive only'}.${A.ok ? '' : ' Check the warnings — the problems are simulated!'}`, A.ok ? 'good' : 'warn', 7000);
  render();
}
