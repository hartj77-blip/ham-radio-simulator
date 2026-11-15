// Antenna + feedline model and the Antenna Workshop UI.
import { S, save, addXp } from './state.js';
import { h, $, clamp, toast, bus } from './util.js';
import { BANDS, bandOf, bandByName } from './data/bandplan.js';
import { elmer } from './elmer.js';
import { buildModel, segment } from './em/models.js';
import { dayFactor, simDate } from './propagation.js';
import { stateBy } from './data/world.js';
import { RW } from './realworld.js';
const STATE_POS = () => stateBy(S.op.state) || stateBy('KS');
import { runSolver } from './em/client.js';
import { antOwned, feedOwned, maxHeight, owns } from './store.js';

export const ANT_TYPES = {
  dipole: { label: 'Half-wave dipole (center-fed)', k: 468, harm: 'odd', Q: 13, gain: 2.15, formula: 'L(ft) ≈ 468 ÷ f(MHz)  (total length, both legs)', polar: 'H',
    desc: 'The classic. Two quarter-wave legs fed in the middle with coax. Bidirectional broadside to the wire when high enough; nearly omni when low. Also works on its odd harmonics (a 40 m dipole loads on 15 m).' },
  invv: { label: 'Inverted-V dipole', k: 455, harm: 'odd', Q: 11, gain: 1.2, formula: 'L(ft) ≈ 455 ÷ f(MHz)  (a bit shorter than a flat dipole)', polar: 'H',
    desc: 'A dipole hung from one center support with the legs sloping down. Needs only one tall support, feed impedance ~50 Ω, more omnidirectional.' },
  vertical: { label: 'Quarter-wave vertical + radials', k: 234, harm: 'odd', Q: 9, gain: 0.0, formula: 'L(ft) ≈ 234 ÷ f(MHz)  (radiator only)', polar: 'V',
    desc: 'Omnidirectional with a low take-off angle — great for DX, poor for close-in contacts. The radial (ground) system matters: few radials = lossy ground, which (sneakily) makes the SWR look better.' },
  efhw: { label: 'End-fed half-wave (49:1 unun)', k: 468, harm: 'all', Q: 12, gain: 1.5, formula: 'L(ft) ≈ 468 ÷ f(MHz)  — resonant on all harmonics', polar: 'H',
    desc: 'A half-wave wire fed at the end through a 49:1 transformer (unun). One wire, one feed point, works on the fundamental and every harmonic (40/20/15/10 m from one wire). The unun costs ~0.8 dB.' },
  yagi: { label: '3-element Yagi (driven element)', k: 445, harm: 'none', Q: 24, gain: 8.1, formula: 'Driven element L(ft) ≈ 445 ÷ f(MHz)  (hairpin match)', polar: 'H',
    desc: 'Directional beam on a rotator: ~6 dB gain over a dipole forward and ~20 dB front-to-back. Narrow bandwidth, single band. Point it at the station!' },
};

// Matched loss dB/100 ft at 10 MHz and 100 MHz
export const FEEDS = {
  'RG-58': [1.4, 4.9, 'thin, cheap, lossy'],
  'RG-8X': [1.0, 3.7, 'mini-8, flexible, OK on HF'],
  'RG-213': [0.65, 2.2, 'thick, low-loss workhorse'],
  'LMR-400': [0.42, 1.35, 'foam low-loss, best for VHF'],
};

export function feedLossDb(type, lenFt, fMHz) {
  const [l10, l100] = FEEDS[type] || FEEDS['RG-8X'];
  const p = Math.log10(l100 / l10);
  return l10 * Math.pow(fMHz / 10, p) * lenFt / 100;
}

const RH = [[0.03, 12], [0.05, 20], [0.1, 35], [0.15, 50], [0.2, 65], [0.25, 78], [0.3, 88], [0.35, 90], [0.4, 85], [0.5, 70], [0.6, 62], [0.7, 70], [0.8, 78], [1, 73], [5, 73]];
function interpTable(t, x) {
  if (x <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) if (x <= t[i][0]) { const [x0, y0] = t[i - 1], [x1, y1] = t[i]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0); }
  return t[t.length - 1][1];
}
const RADIAL_LOSS = { 0: 40, 4: 18, 8: 10, 16: 6, 32: 3, 60: 1 };

export const heightWl = (ant, fMHz) => (ant.height * 0.3048) / (300 / fMHz);

// Feed-point impedance. Returns {R, X, f0, m, Rrad}
// ---- Method-of-Moments impedance table for the game antenna (computed in a worker).
let mom = { sig: null, blocks: [], busy: false, pendingSig: null };
export const momSig = (a) => `${a.type}|${a.length}|${a.height}|${a.radials}|${a.type === 'yagi' ? 0 : a.axis}`;
export const momReady = (a = S.antenna) => mom.sig === momSig(a);
function gameModel(a) {
  const L = a.length;
  switch (a.type) {
    case 'dipole': return buildModel('dipole', { len: L, h: a.height, axis: a.axis });
    case 'invv': return buildModel('invv', { len: L, h: a.height, droop: 40, axis: a.axis });
    case 'vertical': return buildModel('vertical', { len: L, radials: a.radials });
    case 'efhw': return buildModel('efhw', { len: L, h: a.height, cp: 3, ratio: 49 });
    case 'yagi': { const lam = 983.6 / (445 / L); return buildModel('yagi3', { drv: L, refl: L * 1.056, dir: L * 0.95, s1: 0.12 * lam, s2: 0.12 * lam, h: a.height, heading: 0 }, { cond: '½″ aluminium tube' }); }
  }
  return null;
}
export async function requestMom(a = S.antenna) {
  if (!a.length) return;
  const sig = momSig(a);
  if (mom.sig === sig || mom.pendingSig === sig) return;
  mom.pendingSig = sig;
  const blocks = [];
  const wireFt = a.length;
  const bands = BANDS.filter((b) => b.name !== '2m' || wireFt < 10);
  try {
    for (const b of bands) {
      if (mom.pendingSig !== sig) return; // superseded
      const span = b.hi - b.lo, lo = b.lo - span * 0.6, hi = b.hi + span * 0.6;
      const freqs = Array.from({ length: 25 }, (_, i) => lo + (hi - lo) * i / 24);
      const m = segment(gameModel(a), hi);
      // Game wire antennas use insulated #14 wire, which resonates ~3% lower than bare wire.
      const ins = ['dipole', 'invv', 'efhw'].includes(a.type) ? 1.03 : 1;
      const r = await runSolver({ model: m, freqs: freqs.map((f) => f * ins), fMesh: hi * ins });
      blocks.push({ lo, hi, pts: r.sweep.map((p, i) => ({ f: freqs[i], R: p.Z[0], X: p.Z[1] })) });
    }
    if (mom.pendingSig !== sig) return;
    mom = { sig, blocks, busy: false, pendingSig: null };
    bus.emit('antenna');
  } catch (e) { console.warn('MoM failed, using approximate model', e); mom.pendingSig = null; }
}
function momZ(a, fHz) {
  if (mom.sig !== momSig(a)) return null;
  const b = mom.blocks.find((x) => fHz >= x.lo && fHz <= x.hi);
  if (!b) return null;
  const p = b.pts;
  const t = (fHz - p[0].f) / (p[1].f - p[0].f);
  const i = Math.min(p.length - 2, Math.max(0, Math.floor(t)));
  const u = (fHz - p[i].f) / (p[i + 1].f - p[i].f);
  const R = Math.max(0.5, p[i].R + (p[i + 1].R - p[i].R) * u), X = p[i].X + (p[i + 1].X - p[i].X) * u;
  const loss = a.type === 'vertical' ? (RADIAL_LOSS[a.radials] ?? 18) : 0;
  return { R, X, Rrad: Math.max(0.5, R - loss), mom: true };
}

export function feedZ(ant, fHz) {
  const T = ANT_TYPES[ant.type];
  if (!ant.length || !T) return null;
  const mz = momZ(ant, fHz);
  if (mz) { const f0 = T.k / ant.length; const n = fHz / 1e6 / f0; return { ...mz, f0, m: Math.max(1, Math.round(n)) }; }
  const f = fHz / 1e6, f0 = T.k / ant.length, n = f / f0;
  const cands = T.harm === 'odd' ? [1, 3, 5, 7, 9] : T.harm === 'all' ? [1, 2, 3, 4, 5, 6, 7, 8] : [1];
  let m = 1, best = Infinity;
  for (const c of cands) { const d = Math.abs(Math.log(n / c)); if (d < best) { best = d; m = c; } }
  let R, Rrad;
  const hw = heightWl(ant, f);
  switch (ant.type) {
    case 'dipole': R = Rrad = interpTable(RH, hw) * (m > 1 ? 1.45 : 1); break;
    case 'invv': R = Rrad = (40 + 0.35 * interpTable(RH, hw)) * (m > 1 ? 1.5 : 1); break;
    case 'vertical': Rrad = 36 * (m > 1 ? 1.5 : 1); R = Rrad + (RADIAL_LOSS[ant.radials] ?? 18); break;
    case 'efhw': R = Rrad = 48 * (1 + 0.12 * (m - 1)); break;
    default: R = Rrad = 50;
  }
  const Q = T.Q / Math.sqrt(m);
  const X = R * Q * (n / m - m / n);
  return { R, X, f0, m, Rrad };
}

export function gammaMag(Z, Z0 = 50) {
  const nr = Z.R - Z0, ni = Z.X, dr = Z.R + Z0, di = Z.X;
  return Math.sqrt((nr * nr + ni * ni) / (dr * dr + di * di));
}
export const swrFromGamma = (g) => (g >= 0.999 ? 999 : (1 + g) / (1 - g));

// Complete antenna system at frequency: SWR at the rig, feedline losses, efficiency.
export function system(fHz, ant = S.antenna) {
  const f = fHz / 1e6;
  const z = feedZ(ant, fHz);
  if (!z || !ant.built) return null;
  const gL = gammaMag(z);
  const A = feedLossDb(ant.feed, ant.feedLen, f);
  const a = Math.pow(10, A / 10);
  const gIn = gL / a;
  const totalLoss = 10 * Math.log10((a * a - gL * gL) / (a * (1 - gL * gL)));
  let eff = 10 * Math.log10(z.Rrad / z.R); // ground losses
  if (ant.type === 'efhw') eff -= 0.8;
  return { z, swrFeed: swrFromGamma(gL), swrRig: swrFromGamma(gIn), matchedLoss: A, totalLoss, effDb: eff, f0: z.f0, m: z.m };
}

const angDiff = (a, b) => { let d = ((a - b) % 360 + 540) % 360 - 180; return d; };

// Directional + elevation gain (dBi) toward a station at bearing/distance.
export function patternGain(fHz, brg, distKm, ant = S.antenna, rxMode) {
  const T = ANT_TYPES[ant.type];
  const f = fHz / 1e6;
  const hw = heightWl(ant, f);
  const z = feedZ(ant, fHz);
  let g = T.gain;
  if (ant.type === 'yagi') {
    const d = Math.abs(angDiff(brg, ant.heading));
    g = d <= 90 ? T.gain - 12 * (d / 60) ** 2 : -12 + 4 * Math.cos((d - 180) * Math.PI / 90);
    g = Math.max(g, -13);
  } else if (ant.type !== 'vertical') {
    const th = angDiff(brg, ant.axis) * Math.PI / 180;
    const broadside = 20 * Math.log10(Math.max(0.28, Math.abs(Math.sin(th))));
    let omniF = clamp((0.3 - hw) / 0.2, 0, 1);
    if (ant.type === 'invv') omniF = Math.max(omniF, 0.5);
    if (ant.type === 'efhw') omniF = Math.max(omniF, 0.4);
    if (z && z.m > 1) omniF = Math.max(omniF, 0.6);
    g = T.gain + (1 - omniF) * broadside;
  }
  if (f < 50) {
    if (ant.type === 'vertical') {
      if (distKm < 700) g -= 6 * (1 - distKm / 700);
      if (distKm > 2500) g += 2;
    } else {
      if (distKm > 2500) g -= clamp((0.35 - hw) / 0.25, 0, 1) * 7 - (hw >= 0.5 ? 2 : 0);
      if (distKm < 700) g += hw < 0.25 ? 3 : hw > 0.5 ? -4 : 0;
    }
  } else if (rxMode === 'FM' && T.polar === 'H') {
    g -= 15; // cross-polarization: FM/repeaters are vertically polarized
  } else if (rxMode !== 'FM' && T.polar === 'V' && f < 60) {
    g -= 6;
  }
  return g;
}

// Net antenna-system gain (dB) toward a station: pattern + efficiency - feedline losses.
export function netGain(fHz, brg, distKm, mode) {
  const sys = system(fHz);
  if (!sys) return null;
  return patternGain(fHz, brg, distKm, S.antenna, mode) + sys.effDb - sys.totalLoss;
}

// ---------------------------------------------------------------- UI
let root, svgBox, canvas, info, controls;
let analyzer = { band: '20m', atRig: true };

export function initAntennaUI(el) {
  root = el;
  analyzer.band = bandOf(S.radio.freq)?.name || '20m';
  render();
  bus.on('antenna', () => { renderInfo(); requestMom(); });
  bus.on('antenna-rebuild', render);
  bus.on('realworld', (k) => { if (k === 'wx') renderInfo(); });
  requestMom();
}

function render() {
  const a = S.antenna;
  const T = ANT_TYPES[a.type];
  root.innerHTML = '';
  const typeSel = h('select', { id: 'ant-type', disabled: a.built }, ...Object.entries(ANT_TYPES).map(([k, t]) => h('option', { value: k, selected: k === a.type, disabled: !antOwned(k) }, t.label + (antOwned(k) ? '' : ' 🔒 (Hamfest)'))));
  typeSel.onchange = () => { a.type = typeSel.value; a.length = 0; save(); render(); };

  const cut = !!a.length;
  const lenIn = h('input', { type: 'number', id: 'ant-len', min: 0.5, max: 600, step: 0.01, value: a.length || '', placeholder: 'feet', disabled: cut });
  const cutBtn = h('button', { class: 'btn', disabled: cut, onclick: () => {
    const v = parseFloat(lenIn.value);
    if (!(v > 0.3 && v < 600)) return toast('Enter a wire length in feet first (e.g. 33.0).', 'warn');
    a.length = Math.round(v * 100) / 100; save(); render(); elmer('cut_wire');
    if (S.helper?.tutorial && (S.gameMode || 'career') === 'career' && a.type === 'dipole' && (a.length < 60 || a.length > 72) && !S.antenna.built) bus.emit('helper-mistake', 'cut-off', a.length);
  } }, '✂ Cut wire');
  const trim = (ft) => () => {
    if (a.built) return toast('Lower the antenna first — you can\'t trim it up in the tree!', 'warn');
    a.length = Math.max(0.3, Math.round((a.length - ft) * 100) / 100); save(); renderInfo(); bus.emit('antenna');
    $('#ant-len-now').textContent = fmtLen(a.length);
  };
  const splice = () => {
    if (a.built) return toast('Lower the antenna first.', 'warn');
    a.length = Math.round((a.length + 1) * 100) / 100; a.spliced++; save(); renderInfo(); bus.emit('antenna');
    $('#ant-len-now').textContent = fmtLen(a.length);
    toast('You soldered on a foot of wire. It works, but measure twice, cut once!', 'info');
  };

  if (a.height > maxHeight()) a.height = maxHeight();
  const height = h('input', { type: 'range', min: 3, max: maxHeight(), value: a.height, disabled: a.built || a.type === 'vertical' });
  const hLbl = h('span', {}, `${a.height} ft`);
  height.oninput = () => { a.height = +height.value; hLbl.textContent = `${a.height} ft`; save(); renderInfo(); };

  const axis = h('select', { disabled: a.built }, ...[[0, 'N–S wire (broadside E/W)'], [45, 'NE–SW wire (broadside NW/SE)'], [90, 'E–W wire (broadside N/S)'], [135, 'NW–SE wire (broadside NE/SW)']].map(([v, l]) => h('option', { value: v, selected: a.axis === v }, l)));
  axis.onchange = () => { a.axis = +axis.value; save(); renderInfo(); };
  const radials = h('select', { disabled: a.built }, ...Object.keys(RADIAL_LOSS).map((n) => h('option', { value: n, selected: +n === a.radials }, `${n} radials`)));
  radials.onchange = () => { a.radials = +radials.value; save(); renderInfo(); };
  const heading = h('input', { type: 'range', min: 0, max: 359, value: a.heading, disabled: a.built && !owns('rotator'), title: a.built && !owns('rotator') ? 'Buy a rotator to turn the beam while it is up' : '' });
  const headLbl = h('span', {}, `${a.heading}°`);
  heading.oninput = () => { a.heading = +heading.value; headLbl.textContent = `${a.heading}°`; save(); renderInfo(); bus.emit('antenna'); };

  const feed = h('select', { disabled: a.built }, ...Object.entries(FEEDS).map(([k, v]) => h('option', { value: k, selected: k === a.feed, disabled: !feedOwned(k) }, `${k} — ${v[2]}${feedOwned(k) ? '' : ' 🔒'}`)));
  feed.onchange = () => { a.feed = feed.value; save(); renderInfo(); };
  const feedLen = h('input', { type: 'number', min: 10, max: 400, step: 5, value: a.feedLen, disabled: a.built });
  feedLen.onchange = () => { a.feedLen = clamp(+feedLen.value || 50, 3, 500); save(); renderInfo(); };

  const raise = h('button', { class: 'btn primary big', onclick: () => {
    if (!a.length) return toast('Cut your wire to length first.', 'warn');
    a.built = !a.built; S.radio.atuTunedFreq = null; S.radio.atuExtTunedFreq = null; save(); render(); bus.emit('antenna');
    if (a.built) { toast('⬆ Antenna is up! Connect the feedline through the wall entry in the Shack, then check SWR.', 'good'); addXp(10, 'antenna raised'); elmer('antenna_up'); }
  } }, a.built ? '⬇ Lower antenna (to modify)' : '⬆ Raise antenna');

  const newWire = h('button', { class: 'btn small', disabled: a.built, onclick: () => { a.length = 0; a.spliced = 0; save(); render(); } }, 'Start over with new wire');

  controls = h('div', { class: 'ant-controls card' },
    h('h3', {}, 'Build your antenna'),
    h('label', {}, 'Antenna type', typeSel),
    h('p', { class: 'muted small' }, T.desc),
    h('div', { class: 'formula' }, h('details', {}, h('summary', {}, '📐 Elmer\'s formula (exam material)'), h('code', {}, T.formula),
      h('p', { class: 'small' }, 'Lower frequency → longer wire. If the SWR dip is BELOW the band, the antenna is too LONG: trim it. Dip above the band: too short.'))),
    h('fieldset', {}, h('legend', {}, 'Wire'),
      cut ? h('div', { class: 'row' }, h('b', { id: 'ant-len-now' }, fmtLen(a.length)),
        h('button', { class: 'btn small', onclick: trim(1 / 12) }, '−1 in'), h('button', { class: 'btn small', onclick: trim(0.25) }, '−3 in'),
        h('button', { class: 'btn small', onclick: trim(1) }, '−1 ft'), h('button', { class: 'btn small', onclick: splice, title: 'Solder on more wire' }, '+1 ft splice'))
        : h('div', { class: 'row' }, lenIn, cutBtn),
      newWire),
    a.type !== 'vertical' ? h('label', {}, 'Height above ground ', hLbl, height) : h('label', {}, 'Ground radials', radials),
    a.type === 'yagi' ? h('label', {}, 'Rotator heading ', headLbl, heading) : a.type !== 'vertical' ? h('label', {}, 'Wire orientation', axis) : null,
    h('fieldset', {}, h('legend', {}, 'Feedline'), h('label', {}, 'Coax', feed), h('label', {}, 'Length (ft)', feedLen)),
    raise,
  );

  svgBox = h('div', { class: 'ant-svg card' });
  const bandSel = h('select', {}, ...BANDS.map((b) => h('option', { value: b.name, selected: b.name === analyzer.band }, b.name)));
  bandSel.onchange = () => { analyzer.band = bandSel.value; renderInfo(); };
  const atRig = h('input', { type: 'checkbox', checked: analyzer.atRig });
  atRig.onchange = () => { analyzer.atRig = atRig.checked; renderInfo(); };
  canvas = h('canvas', { width: 640, height: 220, class: 'analyzer' });
  canvas.onmousemove = (e) => { analyzer.mx = e.offsetX / canvas.clientWidth; drawAnalyzer(); };
  canvas.onmouseleave = () => { analyzer.mx = null; drawAnalyzer(); };
  info = h('div', { class: 'ant-info' });
  const an = h('div', { class: 'card analyzer-card' },
    h('div', { class: 'row spread' }, h('h3', {}, '📟 Antenna analyzer'),
      h('div', { class: 'row' }, h('label', { class: 'inline' }, 'Sweep ', bandSel), h('label', { class: 'inline' }, atRig, ' measure at shack end of coax'))),
    canvas, info);
  root.append(h('div', { class: 'ant-grid' }, controls, h('div', {}, svgBox, an)));
  renderInfo();
}

const fmtLen = (ft) => `${ft.toFixed(2)} ft (${Math.floor(ft)}′ ${((ft % 1) * 12).toFixed(1)}″)`;

function renderInfo() {
  if (!root || !info) return;
  drawSvg();
  drawAnalyzer();
}

function sweep() {
  const band = bandByName(analyzer.band);
  const span = band.hi - band.lo;
  const lo = band.lo - span * 0.6, hi = band.hi + span * 0.6;
  const pts = [];
  const a = { ...S.antenna, built: true };
  for (let i = 0; i <= 200; i++) {
    const f = lo + (hi - lo) * i / 200;
    const sys = system(f, a);
    if (!sys) return { band, lo, hi, pts: [] };
    pts.push({ f, swr: analyzer.atRig ? sys.swrRig : sys.swrFeed, sys });
  }
  return { band, lo, hi, pts };
}

function drawAnalyzer() {
  const dpr = window.devicePixelRatio || 1;
  const cw = canvas.clientWidth || 640;
  if (canvas.width !== Math.round(cw * dpr)) { canvas.width = Math.round(cw * dpr); canvas.height = Math.round(220 * dpr); }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = cw, H = 220;
  const css = getComputedStyle(document.documentElement);
  ctx.fillStyle = css.getPropertyValue('--lcd-bg') || '#0b1a12'; ctx.fillRect(0, 0, W, H);
  const { band, lo, hi, pts } = sweep();
  const x = (f) => ((f - lo) / (hi - lo)) * W;
  const y = (s) => H - 18 - (Math.log(Math.min(s, 10)) / Math.log(10)) * (H - 30);
  ctx.fillStyle = 'rgba(80,200,120,0.12)'; ctx.fillRect(x(band.lo), 0, x(band.hi) - x(band.lo), H);
  ctx.strokeStyle = 'rgba(160,255,190,0.18)'; ctx.fillStyle = '#7fcf9a'; ctx.font = '11px monospace';
  for (const s of [1, 1.5, 2, 3, 5, 10]) { ctx.beginPath(); ctx.moveTo(0, y(s)); ctx.lineTo(W, y(s)); ctx.stroke(); ctx.fillText(`${s}:1`, 3, y(s) - 2); }
  ctx.fillText(`${(lo / 1e6).toFixed(3)}`, 2, H - 4); ctx.fillText(`${(hi / 1e6).toFixed(3)} MHz`, W - 90, H - 4);
  ctx.fillText(`${band.name} band`, x(band.lo) + 4, 12);
  if (!pts.length) { ctx.fillStyle = '#ffd166'; ctx.font = '14px sans-serif'; ctx.fillText('Cut a wire to see its SWR curve', W / 2 - 110, H / 2); info.innerHTML = ''; return; }
  ctx.strokeStyle = '#5dffa0'; ctx.lineWidth = 2; ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(x(p.f), y(p.swr)) : ctx.moveTo(x(p.f), y(p.swr))));
  ctx.stroke(); ctx.lineWidth = 1;
  let min = pts[0];
  for (const p of pts) if (p.swr < min.swr) min = p;
  ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(x(min.f), y(min.swr), 4, 0, 7); ctx.fill();
  let mk = min;
  if (analyzer.mx != null) { mk = pts[Math.round(clamp(analyzer.mx, 0, 1) * 200)]; ctx.strokeStyle = '#fff6'; ctx.beginPath(); ctx.moveTo(x(mk.f), 0); ctx.lineTo(x(mk.f), H); ctx.stroke(); }
  const z = mk.sys.z;
  const inBand = min.f >= band.lo && min.f <= band.hi;
  const ant = S.antenna;
  let advice;
  const fRes = min.f;
  if (min.swr > 3) advice = `<b>No usable resonance near ${band.name}.</b> This antenna isn't designed for this band${ANT_TYPES[ant.type].harm !== 'none' ? ' (or its harmonics)' : ''}. A tuner might help a little, at a cost.`;
  else if (inBand) advice = `👍 Resonant in-band at <b>${(fRes / 1e6).toFixed(3)} MHz</b> (SWR ${min.swr.toFixed(2)}:1).`;
  else if (fRes < band.lo) advice = `SWR dip at ${(fRes / 1e6).toFixed(3)} MHz is <b>below</b> the band → the antenna is <b>too long</b>. Trim it.`;
  else advice = `SWR dip at ${(fRes / 1e6).toFixed(3)} MHz is <b>above</b> the band → the antenna is <b>too short</b>. Add wire (splice) or start over.`;
  const s = mk.sys;
  info.innerHTML = `
    <div class="readouts">
      <div><span>Freq</span><b>${(mk.f / 1e6).toFixed(3)} MHz</b></div>
      <div><span>SWR</span><b class="${mk.swr < 1.6 ? 'ok' : mk.swr < 3 ? 'warn' : 'bad'}">${mk.swr > 50 ? '>50' : mk.swr.toFixed(2)}:1</b></div>
      <div><span>Feedpoint Z</span><b>${z.R.toFixed(0)} ${z.X >= 0 ? '+' : '−'} j${Math.abs(z.X).toFixed(0)} Ω</b></div>
      <div><span>Coax loss</span><b>${s.matchedLoss.toFixed(2)} dB matched / ${s.totalLoss.toFixed(2)} dB actual</b></div>
      <div><span>Efficiency</span><b>${(Math.pow(10, s.effDb / 10) * 100).toFixed(0)}%</b></div>
      <div><span>Height</span><b>${heightWl(ant, mk.f / 1e6).toFixed(2)} λ</b></div>
    </div>
    <p class="advice">${advice}</p>
    <p class="tiny ${momReady() ? 'ok' : 'muted'}">${momReady() ? `✓ Impedance from the Method-of-Moments solver (same engine as the Workbench)${['dipole', 'invv', 'efhw'].includes(ant.type) ? ', insulated #14 wire' : ''}.` : '⏳ Running the Method-of-Moments solver… (showing a quick estimate meanwhile)'}</p>
    ${analyzer.atRig ? '<p class="muted small">Measuring at the rig end: coax loss makes SWR look better than it really is at the antenna. Untick to see the true feed-point SWR.</p>' : ''}`;
}

// Sky & precipitation from the live local weather (NWS / Open-Meteo).
function wxSky(W, gy, cloud) {
  const w = RW.wx;
  const cover = w ? w.cloud : 0.3;
  const n = Math.round(1 + cover * 9);
  let out = '';
  for (let i = 0; i < n; i++) out += cloud(((i * 137) % (W - 80)) + 40, 30 + ((i * 53) % 90), 0.8 + ((i * 7) % 5) / 6);
  if (cover > 0.75) out += `<rect width="${W}" height="${gy}" fill="rgba(70,80,95,${(cover - 0.6).toFixed(2)})"/>`;
  return out;
}
function wxPrecip(W, H) {
  const w = RW.wx;
  if (!w) return '';
  let out = '';
  if (w.rain || w.storm) for (let i = 0; i < 90; i++) { const x = (i * 97) % W, y = (i * 61) % H; out += `<line x1="${x}" y1="${y}" x2="${x - 4}" y2="${y + 12}" stroke="#9fc3ff" stroke-width="1" opacity="0.55"/>`; }
  if (w.snow) for (let i = 0; i < 80; i++) out += `<circle cx="${(i * 89) % W}" cy="${(i * 47) % H}" r="${1 + (i % 3) * 0.6}" fill="#fff" opacity="0.85"/>`;
  if (w.fog) out += `<rect width="${W}" height="${H}" fill="rgba(200,205,215,0.35)"/>`;
  if (w.storm && Math.random() < 0.5) out += `<polyline points="${W * 0.7},20 ${W * 0.68},80 ${W * 0.72},90 ${W * 0.66},170" stroke="#fff6a8" stroke-width="3" fill="none" opacity="0.9"/>`;
  return out;
}

function drawSvg() {
  const a = S.antenna;
  const W = 760, H = 330, gy = 285;
  const me = (() => { const st = STATE_POS(); return st; })();
  const df = dayFactor(me);
  const d = simDate();
  const solarH = ((d.getUTCHours() + d.getUTCMinutes() / 60 + me.lon / 15) % 24 + 24) % 24;
  const mix = (c1, c2, t) => c1.map((v, i) => Math.round(v + (c2[i] - v) * t));
  const rgb = (c) => `rgb(${c.join(',')})`;
  const dusk = Math.max(0, 1 - Math.abs(df - 0.25) / 0.25) * (df < 0.6 ? 1 : 0);
  const skyTop = mix([8, 12, 32], [52, 120, 200], df), skyBot = mix(mix([20, 30, 60], [150, 200, 240], df), [240, 140, 80], dusk * 0.7);
  const px = (ft) => gy - clamp(ft, 0, 110) * 2.1;
  const sc = 2.4; // px per ft horizontally
  const ay = px(a.type === 'vertical' ? 0 : a.height);
  const lenPx = clamp((a.length || 30) * sc, 40, 600);
  const wire = '#e0b04a';
  // sun / moon on an arc
  const arcT = ((solarH - 6) / 12);
  const celX = 40 + arcT * (W - 80), celY = 40 + (1 - Math.sin(Math.PI * clamp(arcT, 0, 1))) * 150;
  const isDay = df > 0.15;
  const moonT = (((solarH + 6) % 24) / 12);
  const mX = 40 + moonT * (W - 80), mY = 40 + (1 - Math.sin(Math.PI * clamp(moonT, 0, 1))) * 150;
  let stars = '';
  if (df < 0.5) { let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280; for (let i = 0; i < 70; i++) stars += `<circle cx="${(rnd() * W).toFixed(0)}" cy="${(rnd() * (gy - 80)).toFixed(0)}" r="${(rnd() * 1.2 + 0.3).toFixed(1)}" fill="#fff" opacity="${((1 - df * 2) * (0.4 + rnd() * 0.6)).toFixed(2)}"/>`; }
  const cloud = (x, y, s) => `<g opacity="${(0.25 + df * 0.6).toFixed(2)}" fill="${df > 0.3 ? '#fff' : '#8090b0'}"><ellipse cx="${x}" cy="${y}" rx="${30 * s}" ry="${11 * s}"/><ellipse cx="${x + 22 * s}" cy="${y - 7 * s}" rx="${22 * s}" ry="${12 * s}"/><ellipse cx="${x - 20 * s}" cy="${y - 4 * s}" rx="${16 * s}" ry="${9 * s}"/></g>`;
  const tree = (x, topY, k = 1) => `<g><rect x="${x - 5 * k}" y="${topY + 25 * k}" width="${10 * k}" height="${gy - topY - 25 * k}" fill="#5b3d26"/>
    <circle cx="${x}" cy="${topY + 20 * k}" r="${30 * k}" fill="url(#leaf)"/><circle cx="${x - 18 * k}" cy="${topY + 38 * k}" r="${22 * k}" fill="url(#leaf)"/><circle cx="${x + 20 * k}" cy="${topY + 36 * k}" r="${24 * k}" fill="url(#leaf)"/></g>`;
  const mast = (x, topY) => {
    if (a.height > 50) { // lattice tower
      let lat = '';
      for (let y = gy; y > topY; y -= 14) lat += `<line x1="${x - 6}" y1="${y}" x2="${x + 6}" y2="${y - 14}" stroke="#9aa4ad" stroke-width="1"/><line x1="${x + 6}" y1="${y}" x2="${x - 6}" y2="${y - 14}" stroke="#9aa4ad" stroke-width="1"/>`;
      return `<g><line x1="${x - 6}" y1="${gy}" x2="${x - 6}" y2="${topY}" stroke="#b9c2ca" stroke-width="2"/><line x1="${x + 6}" y1="${gy}" x2="${x + 6}" y2="${topY}" stroke="#b9c2ca" stroke-width="2"/>${lat}</g>`;
    }
    return `<g><line x1="${x}" y1="${gy}" x2="${x}" y2="${topY}" stroke="#aeb6bd" stroke-width="4"/><line x1="${x}" y1="${topY + 10}" x2="${x - 40}" y2="${gy}" stroke="#ddd" stroke-width="0.6" opacity="0.6"/><line x1="${x}" y1="${topY + 10}" x2="${x + 40}" y2="${gy}" stroke="#ddd" stroke-width="0.6" opacity="0.6"/></g>`;
  };
  const supportTall = a.height > 35;
  const insul = (x, y) => `<rect x="${x - 4}" y="${y - 3}" width="8" height="6" rx="2" fill="#f2f2f2" stroke="#999" stroke-width="0.5"/>`;
  const coaxTo = (x, y) => `<path d="M${x} ${y + 5} C ${x} ${(y + gy) / 2 + 20}, 220 ${gy - 30}, 128 ${gy - 52}" stroke="#151515" stroke-width="3" fill="none"/>`;
  let ant = '';
  const cx = W / 2 + 60;
  if (a.type === 'dipole' || a.type === 'efhw') {
    const x0 = cx - lenPx / 2, x1 = cx + lenPx / 2;
    const feedX = a.type === 'efhw' ? x0 : cx;
    const sup = (x) => (supportTall ? mast(x, ay - 6) : tree(x, ay - 25));
    const sag = Math.min(18, lenPx * 0.03);
    ant = `${sup(x0 - 26)}${sup(x1 + 26)}
      <path d="M${x0 - 26} ${ay} L ${x0} ${ay}" stroke="#bbb" stroke-width="0.8" stroke-dasharray="2 2"/><path d="M${x1} ${ay} L ${x1 + 26} ${ay}" stroke="#bbb" stroke-width="0.8" stroke-dasharray="2 2"/>
      <path d="M${x0} ${ay} Q ${(x0 + feedX) / 2 || x0} ${ay + sag} ${feedX} ${ay}${a.type === 'dipole' ? ` Q ${(feedX + x1) / 2} ${ay + sag} ${x1} ${ay}` : ` Q ${(x0 + x1) / 2} ${ay + sag * 1.5} ${x1} ${ay}`}" stroke="${wire}" stroke-width="2.5" fill="none"/>
      ${insul(x0, ay)}${insul(x1, ay)}
      ${a.type === 'dipole' ? `<rect x="${feedX - 6}" y="${ay - 5}" width="12" height="11" rx="2" fill="#333" stroke="#888"/>` : `<rect x="${feedX - 9}" y="${ay - 3}" width="18" height="15" rx="2" fill="#2b2b2b" stroke="#aaa"/><text x="${feedX - 8}" y="${ay + 26}" class="svgt small">49:1</text>`}
      ${coaxTo(feedX, ay)}`;
  } else if (a.type === 'invv') {
    const half = lenPx / 2;
    const dx = half * Math.cos(0.7), dy = half * Math.sin(0.7);
    ant = `${mast(cx, ay - 4)}
      <line x1="${cx}" y1="${ay}" x2="${cx - dx}" y2="${Math.min(gy - 6, ay + dy)}" stroke="${wire}" stroke-width="2.5"/>
      <line x1="${cx}" y1="${ay}" x2="${cx + dx}" y2="${Math.min(gy - 6, ay + dy)}" stroke="${wire}" stroke-width="2.5"/>
      ${insul(cx - dx, Math.min(gy - 6, ay + dy))}${insul(cx + dx, Math.min(gy - 6, ay + dy))}
      <rect x="${cx - 6}" y="${ay - 2}" width="12" height="11" rx="2" fill="#333" stroke="#888"/>${coaxTo(cx, ay)}`;
  } else if (a.type === 'vertical') {
    const top = gy - clamp(a.length * sc * 1.2, 30, 230);
    let rad = '';
    const n = Math.min(a.radials, 24);
    for (let i = 0; i < n; i++) { const dx2 = (i - (n - 1) / 2) * (260 / Math.max(n, 1)); rad += `<line x1="${cx}" y1="${gy + 2}" x2="${cx + dx2}" y2="${gy + 26}" stroke="${wire}" stroke-width="1" opacity="0.8"/>`; }
    ant = `${rad}<line x1="${cx}" y1="${gy}" x2="${cx}" y2="${top}" stroke="url(#alu)" stroke-width="6" stroke-linecap="round"/><rect x="${cx - 9}" y="${gy - 12}" width="18" height="12" fill="#444"/>
      <path d="M${cx} ${gy - 6} C ${cx - 100} ${gy - 4}, 200 ${gy - 10}, 128 ${gy - 52}" stroke="#151515" stroke-width="3" fill="none"/>`;
  } else if (a.type === 'yagi') {
    const l = clamp(a.length * sc * 0.75, 40, 200);
    const hd = ((a.heading % 360) + 360) % 360;
    const persp = Math.sin(hd * Math.PI / 180); // boom left/right projection
    const bx = 70 * persp, el = (o, k) => { const x = cx + o * persp; const L = l * k * (0.35 + 0.65 * Math.abs(Math.cos(hd * Math.PI / 180))); return `<line x1="${x - L / 2}" y1="${ay - o * 0.08}" x2="${x + L / 2}" y2="${ay - o * 0.08}" stroke="${k === 1 ? wire : 'url(#alu)'}" stroke-width="3" stroke-linecap="round"/>`; };
    ant = `${mast(cx, ay)}<line x1="${cx - bx}" y1="${ay + 5.6}" x2="${cx + bx}" y2="${ay - 5.6}" stroke="#aaa" stroke-width="4"/>
      ${el(-70, 1.056)}${el(0, 1)}${el(70, 0.95)}
      <text x="${cx + 90}" y="${ay - 28}" class="svgt">↗ ${hd}°</text>${coaxTo(cx, ay)}`;
  }
  const win = (x, y) => `<rect x="${x}" y="${y}" width="16" height="14" fill="${df < 0.3 ? '#ffd27a' : '#9cc6e6'}" stroke="#4a3426"/>`;
  svgBox.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="ant-drawing">
    <defs>
      <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${rgb(skyTop)}"/><stop offset="1" stop-color="${rgb(skyBot)}"/></linearGradient>
      <linearGradient id="grass" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${rgb(mix([20, 50, 25], [70, 130, 60], df))}"/><stop offset="1" stop-color="${rgb(mix([10, 25, 12], [40, 85, 35], df))}"/></linearGradient>
      <radialGradient id="leaf" cx="0.35" cy="0.3"><stop offset="0" stop-color="${rgb(mix([30, 70, 40], [90, 170, 80], df))}"/><stop offset="1" stop-color="${rgb(mix([10, 30, 15], [30, 90, 40], df))}"/></radialGradient>
      <linearGradient id="alu" x1="0" x2="1"><stop offset="0" stop-color="#8a949c"/><stop offset="0.5" stop-color="#e8eef2"/><stop offset="1" stop-color="#7d868d"/></linearGradient>
      <radialGradient id="sunG"><stop offset="0" stop-color="#fff6c0"/><stop offset="0.4" stop-color="#ffd24a"/><stop offset="1" stop-color="rgba(255,200,60,0)"/></radialGradient>
    </defs>
    <rect width="${W}" height="${gy}" fill="url(#sky)"/>${stars}
    ${isDay ? `<circle cx="${celX}" cy="${celY}" r="30" fill="url(#sunG)"/>` : `<circle cx="${mX}" cy="${mY}" r="11" fill="#e9edf5"/><circle cx="${mX + 5}" cy="${mY - 3}" r="10" fill="${rgb(skyTop)}" opacity="0.85"/>`}
    ${wxSky(W, gy, cloud)}
    <path d="M0 ${gy - 40} Q 120 ${gy - 90} 260 ${gy - 45} T 520 ${gy - 55} T ${W} ${gy - 35} V ${gy} H 0 Z" fill="${rgb(mix([15, 30, 35], [80, 120, 110], df))}" opacity="0.6"/>
    <path d="M0 ${gy - 20} Q 200 ${gy - 55} 380 ${gy - 25} T ${W} ${gy - 30} V ${gy} H 0 Z" fill="${rgb(mix([18, 40, 25], [60, 110, 60], df))}" opacity="0.85"/>
    <rect y="${gy}" width="${W}" height="${H - gy}" fill="url(#grass)"/>
    <g><rect x="22" y="${gy - 62}" width="110" height="62" fill="#a07856"/><polygon points="14,${gy - 62} 77,${gy - 104} 140,${gy - 62}" fill="#5d3b2c"/>
      <rect x="104" y="${gy - 100}" width="12" height="26" fill="#6d4a36"/>${win(36, gy - 48)}${win(96, gy - 48)}<rect x="62" y="${gy - 34}" width="20" height="34" fill="#4a3426"/>
      <text x="40" y="${gy - 68}" class="svgt small">SHACK</text><rect x="122" y="${gy - 56}" width="8" height="10" fill="#777"/></g>
    ${ant}
    ${wxPrecip(W, H)}
    <rect x="0" y="0" width="${W}" height="46" fill="rgba(0,0,0,0.35)"/>
    <text x="12" y="19" class="svgt">${ANT_TYPES[a.type].label} — ${a.length ? fmtLen(a.length) : 'uncut wire'}${a.type !== 'vertical' ? ` · ${a.height} ft up${a.height > 35 ? (a.height > 50 ? ' (tower)' : ' (mast)') : ' (trees)'}` : ` · ${a.radials} radials`}</text>
    <text x="12" y="37" class="svgt">${a.built ? '✅ installed' : '🔧 on the ground (not installed)'} · ${a.feedLen} ft ${a.feed} · local time ${Math.floor(solarH)}:${String(Math.floor((solarH % 1) * 60)).padStart(2, '0')}${RW.wx ? ` · live weather: ${RW.wx.desc}, ${RW.wx.tempF}°F${RW.wx.windKt != null ? `, wind ${RW.wx.windKt} kt` : ''}` : ''}</text>
  </svg>`;
}
