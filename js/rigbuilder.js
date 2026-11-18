// Rig builder: assemble a station from real-world equipment and check it like an engineer.
// Power budget (supply amps vs. radio draw), amplifier drive and mains, tuner and meter ratings,
// band and receive coverage, cost and weight. "Use this station" puts it on the air.
import { S, save } from './state.js';
import { h, bus, toast, info } from './util.js';
import { RIGS, GEAR_DEFAULT } from './rigs.js';
import { GEAR, REAL_RIGS } from './data/gear.js';
import { BANDS } from './data/bandplan.js';
import { s, at, defs, radio, psu, tuner, swrMeter, amplifier, microphone, morseKey, connector } from './draw.js';

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
  return { d, r, psu, tuner, meter, amp, checks, outW, rigW, ampNote, tx, rxTxt, cost, kg, ok: !checks.some((c) => c[0] === 'bad') };
}

// ------------------------------------------------------------------ desk drawing (SVG)
// Device name under the bench, wrapped to two lines when it is wider than the device.
function caption(cx, y, name, w) {
  const fits = (t) => t.length * 6.6 <= w + 24;
  let lines = [name];
  if (!fits(name) && name.includes(' ')) {
    const words = name.split(' ');
    let best = 1, diff = Infinity;
    for (let i = 1; i < words.length; i++) { const d = Math.abs(words.slice(0, i).join(' ').length - words.slice(i).join(' ').length); if (d < diff) { diff = d; best = i; } }
    lines = [words.slice(0, best).join(' '), words.slice(best).join(' ')];
  }
  return s('text', { x: cx, y, class: 'rb-lbl', 'text-anchor': 'middle' }, ...lines.map((l, i) => s('tspan', { x: cx, dy: i ? 14 : 0 }, l)));
}
const RADIO_SIZE = { contest: [380, 140], touch: [310, 118], classic: [310, 118], portable: [220, 108], mobile: [220, 74], sdr: [150, 44], ht: [74, 170] };

function drawDesk(A) {
  const DESK = 210, t = (n) => n.replace(/^Generic /, '');
  const parts = []; // [group, w, h, name, key]
  const [rw, rh] = RADIO_SIZE[A.r.look] || RADIO_SIZE.classic;
  const lin = A.psu.kind === 'linear', bat = A.psu.kind === 'battery';
  parts.push([psu(A.psu, lin ? 170 : bat ? 120 : 150, lin ? 112 : bat ? 76 : 84), lin ? 170 : bat ? 120 : 150, lin ? 112 : bat ? 76 : 84, t(A.psu.name), 'psu']);
  parts.push([radio(A.r, rw, rh, { freq: A.r.look === 'ht' ? '146.520' : '14.250.00' }), rw, rh, A.r.name, 'rig']);
  if (A.amp.out) parts.push([amplifier(A.amp, 250, 136), 250, 136, A.amp.name, 'amp']);
  parts.push([swrMeter(A.meter, 124, 92), 124, 92, t(A.meter.name), 'meter']);
  if (A.tuner.usd) parts.push([tuner(A.tuner, A.tuner.auto ? 170 : 220, A.tuner.auto ? 46 : 104), A.tuner.auto ? 170 : 220, A.tuner.auto ? 46 : 104, t(A.tuner.name), 'tuner']);
  let x = 36; const X = {};
  for (const p of parts) { X[p[4]] = x; x += p[1] + 34; }
  const micX = x, keyX = x + 64;
  const wallX = Math.max(1010, keyX + 110), W = wallX + 70;
  const svg = s('svg', { viewBox: `0 0 ${W} 310`, class: 'rb-desk', role: 'img', 'aria-label': 'Your station on the desk' }, defs(),
    s('rect', { x: 0, y: 0, width: W, height: DESK, fill: 'url(#arWall)' }),
    // shelf with a logbook, a clock and QSL cards on the wall
    s('rect', { x: 40, y: 34, width: 300, height: 7, rx: 2, fill: 'url(#arWood)' }), s('rect', { x: 60, y: 6, width: 12, height: 28, fill: '#7a2e2e' }), s('rect', { x: 73, y: 10, width: 10, height: 24, fill: '#2e4f7a' }), s('rect', { x: 84, y: 4, width: 14, height: 30, fill: '#3d6b46' }), s('rect', { x: 99, y: 12, width: 9, height: 22, fill: '#b08a3a' }),
    s('circle', { cx: 290, cy: 18, r: 14, fill: '#e9edf1', stroke: '#2a2f35', 'stroke-width': 2 }), s('path', { d: 'M290 18 V8 M290 18 H297', stroke: '#15171a', 'stroke-width': 1.4, 'stroke-linecap': 'round' }), s('text', { x: 290, y: 46 + 10, class: 'rb-tiny', 'text-anchor': 'middle' }, 'UTC'),
    ...[[420, 14, '#e8dcc0', -4], [476, 20, '#cfe3f2', 3], [532, 12, '#f2d9cf', -2], [588, 22, '#d8eccb', 5]].map(([cx, cy, c, r]) => s('g', { transform: `rotate(${r} ${cx + 24} ${cy + 15})` }, s('rect', { x: cx, y: cy, width: 48, height: 30, rx: 1.5, fill: c, stroke: '#07080a', 'stroke-width': 0.6 }), s('rect', { x: cx + 4, y: cy + 5, width: 22, height: 5, fill: '#15171a', opacity: 0.7 }), s('rect', { x: cx + 4, y: cy + 14, width: 36, height: 2, fill: '#15171a', opacity: 0.35 }), s('rect', { x: cx + 4, y: cy + 19, width: 28, height: 2, fill: '#15171a', opacity: 0.35 }))),
    // desk
    s('rect', { x: 0, y: DESK, width: W, height: 16, fill: 'url(#arWood)' }), s('path', { d: `M0 ${DESK + 1} H${W}`, stroke: '#fff', 'stroke-opacity': 0.25 }),
    ...Array.from({ length: 9 }, (_, i) => s('path', { d: `M${i * (W / 9) + 20} ${DESK + 5 + (i % 3) * 3} h${60 + (i % 4) * 30}`, stroke: '#3a2714', 'stroke-opacity': 0.5, 'stroke-width': 0.8 })),
    s('rect', { x: 0, y: DESK + 16, width: W, height: 94, fill: '#0e1216' }));
  // cables first, so they tuck behind the equipment
  const cable = (d, col, w) => svg.append(s('path', { d, stroke: '#c9d3dd', 'stroke-width': w + 2.5, fill: 'none', 'stroke-linecap': 'round', opacity: 0.4 }), s('path', { d, stroke: col, 'stroke-width': w, fill: 'none', 'stroke-linecap': 'round' }));
  const sag = (x1, x2, col, w, dy) => cable(`M${x1} ${DESK - 6} C ${x1} ${DESK + 40 + dy}, ${x2} ${DESK + 40 + dy}, ${x2} ${DESK - 6}`, col, w);
  const pw = parts[0][1];
  sag(X.psu + pw - 46, X.rig + 22, '#d32f2f', 3.5, 0); sag(X.psu + pw - 30, X.rig + 34, '#23272c', 3.5, 8);
  const chain = [X.rig + rw - 26];
  for (const k of ['amp', 'meter', 'tuner']) if (X[k] != null) { const w = parts.find((p) => p[4] === k)[1]; chain.push(X[k] + 22, X[k] + w - 22); }
  for (let i = 0; i + 1 < chain.length; i += 2) sag(chain[i], chain[i + 1], '#2b3036', 5, 14);
  const last = chain[chain.length - 1];
  svg.append(s('rect', { x: wallX, y: 0, width: 70, height: DESK, fill: '#232a33' }), s('rect', { x: wallX, y: 0, width: 4, height: DESK, fill: '#000', opacity: 0.35 }),
    s('rect', { x: wallX + 16, y: 96, width: 38, height: 52, rx: 3, fill: 'url(#arSilver)', stroke: '#07080a' }), connector('coax', wallX + 35, 122), s('text', { x: wallX + 35, y: 164, class: 'rb-tiny', 'text-anchor': 'middle' }, 'TO ANTENNA'));
  cable(`M${last} ${DESK - 6} C ${last} ${DESK + 62}, ${wallX + 35} ${DESK + 62}, ${wallX + 35} 130`, '#2b3036', 5);
  for (const [g, w, hh, name, key] of parts) { svg.append(at(g, X[key], DESK - hh - 4), caption(X[key] + w / 2, DESK + 74, name, w)); }
  // microphone and key in front, cords back to the radio
  if (A.r.tx.length && A.r.look !== 'ht') {
    const mic = GEAR.mic.items[A.d.mic] || {}, key = GEAR.key.items[A.d.key] || {};
    svg.append(at(microphone(mic, 44, 86), micX, DESK - 90), caption(micX + 22, DESK + 74, 'Mic', 44), at(morseKey(key, 76, 46), keyX, DESK - 48), caption(keyX + 38, DESK + 74, key.iambic ? 'Paddle' : key.bug ? 'Bug' : 'Key', 76));
  }
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
    return h('div', { class: 'rb-slot' }, h('div', { class: 'row spread' }, h('b', {}, G.label), h('button', { class: 'link small', onclick: () => bus.emit('open-manual', d.rig, cat) }, 'Guide')), sel, h('div', { class: 'tiny muted rb-desc' }, it.desc));
  };
  const r = A.r;
  const m240 = h('input', { type: 'checkbox', checked: !!d.mains240 }); m240.onchange = () => { d.mains240 = m240.checked; save(); render(); };
  const inUse = S.rig === d.rig && SLOTS.every((c) => (S.gear || {})[c] === d[c]);
  root.append(
    h('div', { class: 'card' },
      h('div', { class: 'row spread wrap' }, h('h3', {}, 'Your station', info('Pick real equipment. Every choice changes the simulation: the supply limits your output, amplifiers need drive (and sometimes 240 V), tuners and meters have power ratings, receivers have gaps, better microphones add talk power.', 'About this page')),
        h('div', { class: 'row wrap rb-presets' }, ...PRESETS.map(([n, p]) => h('button', { class: 'btn small', onclick: () => { Object.assign(d, GEAR_DEFAULT, p); save(); render(); } }, n)))),
      h('div', { class: 'rb-desk-wrap' }, drawDesk(A))),
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
        info('Specs are approximate published figures; prices are typical US street prices, shown for reference. Product names identify equipment only — no affiliation with any manufacturer.', 'About these figures'))));
}

function apply(d) {
  S.rig = d.rig;
  S.gear = Object.fromEntries([...SLOTS, 'mains240'].map((k) => [k, d[k]]));
  save(); bus.emit('rig'); bus.emit('gear');
  const A = analyze(d);
  toast(`Station updated: ${A.r.name}, ${A.r.tx.length ? `${A.outW} W` : 'receive only'}.${A.ok ? '' : ' Check the warnings — the problems are simulated!'}`, A.ok ? 'good' : 'warn', 7000);
  render();
}
