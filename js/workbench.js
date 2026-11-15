// Antenna Workbench: design with a Method-of-Moments solver, compare against real analyzer
// measurements, get trim advice, and design matching networks.
import { S, save } from './state.js';
import { h, $, toast, bus, download, clamp } from './util.js';
import { BANDS } from './data/bandplan.js';
import { TEMPLATES, CONDUCTORS, GROUNDS, buildModel, segment, scaleParam, toNEC, fromNEC, FT } from './em/models.js';
import { CABLES, cx, deembed, lineIn, swr, gammaOf, lNetworks, lNetEval, stubMatch, transformerSuggest, parseMeasurement, analyzeSweep, nanoVnaSweep, lossDbPerM } from './em/tline.js';
import { linePlot, smith, polar, wire3d } from './em/plots.js';
import { runSolver } from './em/client.js';

let root;
const W = () => (S.wb ||= {
  tpl: 'dipole', params: {}, cond: 'AWG 14 copper', ground: 'average', fT: 14.175, spanPct: 6,
  meas: null, cable: 'RG-8X', cableFt: 50, deemb: true, plot: 'swr', insul: false, endIn: 3, matchSrc: 'model', manR: 25, manX: -15, QL: 150,
});
let result = null, running = false, view = { yaw: -0.6, pitch: 0.35, zoom: 1 }, cursorF = null;

function params() {
  const w = W();
  const def = Object.fromEntries(Object.entries(TEMPLATES[w.tpl].params).map(([k, v]) => [k, v[1]]));
  w.params[w.tpl] = { ...def, ...(w.params[w.tpl] || {}) };
  return w.params[w.tpl];
}
function model(p = params()) {
  const w = W();
  const m = w.custom && w.tpl === 'custom' ? structuredClone(w.custom) : buildModel(w.tpl, p, { cond: w.cond, ground: w.ground });
  return segment(m, w.fT * 1e6 * (1 + w.spanPct / 100) * 1.02);
}
function freqs() {
  const w = W(), f0 = w.fT * 1e6, sp = f0 * w.spanPct / 100;
  return Array.from({ length: 41 }, (_, i) => f0 - sp + (2 * sp) * i / 40);
}

export function initWorkbenchUI(el) { root = el; render(); }

function render() {
  const w = W();
  root.innerHTML = '';
  const T = TEMPLATES[w.tpl];
  const tplSel = h('select', {}, ...Object.entries(TEMPLATES).map(([k, t]) => h('option', { value: k, selected: k === w.tpl }, t.label)));
  tplSel.onchange = () => { w.tpl = tplSel.value; result = null; save(); render(); };
  const p = params();
  const inputs = Object.entries(T.params).map(([k, [label]]) => {
    const i = h('input', { type: 'number', step: 'any', value: p[k], class: 'num' });
    i.onchange = () => { p[k] = parseFloat(i.value); save(); };
    return h('label', { class: 'wb-param' }, h('span', {}, label), i);
  });
  const condSel = h('select', {}, ...Object.keys(CONDUCTORS).map((k) => h('option', { selected: k === w.cond }, k)));
  condSel.onchange = () => { w.cond = condSel.value; save(); };
  const gndSel = h('select', {}, ...Object.entries(GROUNDS).map(([k, g]) => h('option', { value: k, selected: k === w.ground }, g.label)));
  gndSel.onchange = () => { w.ground = gndSel.value; save(); };
  const fIn = h('input', { type: 'number', step: 'any', value: w.fT, class: 'num' });
  fIn.onchange = () => { w.fT = parseFloat(fIn.value) || 14.175; save(); };
  const bandQuick = h('select', {}, h('option', { value: '' }, 'band…'), ...BANDS.map((b) => h('option', { value: ((b.lo + b.hi) / 2e6).toFixed(3) }, b.name)));
  bandQuick.onchange = () => { if (bandQuick.value) { w.fT = +bandQuick.value; fIn.value = w.fT; save(); } };
  const spIn = h('input', { type: 'number', step: 1, min: 1, max: 60, value: w.spanPct, class: 'num small' });
  spIn.onchange = () => { w.spanPct = clamp(+spIn.value || 6, 1, 60); save(); };
  const prog = h('div', { class: 'progress' }, h('div', { id: 'wb-prog' }));

  const design = h('div', { class: 'card wb-design' },
    h('h3', {}, '📐 Design'),
    h('label', {}, 'Antenna', tplSel), h('p', { class: 'muted small' }, T.help),
    h('div', { class: 'wb-params' }, ...inputs),
    h('label', {}, 'Conductor', condSel), h('label', {}, 'Ground', gndSel),
    h('div', { class: 'row' }, h('label', { class: 'inline' }, 'Target ', fIn, ' MHz'), bandQuick, h('label', { class: 'inline' }, '± ', spIn, ' %')),
    h('div', { class: 'row' },
      h('button', { class: 'btn primary', onclick: simulate, disabled: running }, '▶ Simulate'),
      h('button', { class: 'btn', onclick: autotune, disabled: running, title: 'Scale the main dimension until the model is resonant at the target' }, '🎯 Auto-tune to target')),
    prog,
    h('div', { class: 'row' },
      h('button', { class: 'btn small', onclick: exportNec }, '⬇ NEC-2 deck'),
      h('label', { class: 'btn small filebtn' }, '⬆ Import NEC', h('input', { type: 'file', accept: '.nec,.txt', onchange: importNec })),
      h('button', { class: 'btn small', onclick: useInGame }, '📡 Build this in the game')),
  );

  const geo = h('canvas', { class: 'wb-3d' });
  let drag = null;
  geo.onpointerdown = (e) => { drag = [e.clientX, e.clientY]; geo.setPointerCapture(e.pointerId); };
  geo.onpointermove = (e) => { if (!drag) return; view.yaw += (e.clientX - drag[0]) * 0.01; view.pitch = clamp(view.pitch + (e.clientY - drag[1]) * 0.01, -0.2, 1.4); drag = [e.clientX, e.clientY]; draw3d(); };
  geo.onpointerup = () => { drag = null; };
  geo.onwheel = (e) => { e.preventDefault(); view.zoom = clamp(view.zoom * (e.deltaY > 0 ? 0.9 : 1.1), 0.3, 5); draw3d(); };

  const plotSel = h('div', { class: 'row' }, ...[['swr', 'SWR'], ['rx', 'R / X'], ['smith', 'Smith']].map(([k, l]) => h('button', { class: `rbtn ${w.plot === k ? 'active' : ''}`, onclick: () => { w.plot = k; save(); render(); } }, l)));
  const plotCv = h('canvas', { class: 'wb-plot', id: 'wb-plot' });
  plotCv.onmousemove = (e) => { if (plotCv._invX) { cursorF = plotCv._invX(e.offsetX) * 1e6; drawPlot(); drawReadout(); } };
  plotCv.onmouseleave = () => { cursorF = null; drawPlot(); drawReadout(); };
  const results = h('div', { class: 'card wb-results' },
    h('div', { class: 'row spread' }, h('h3', {}, '📈 Results'), plotSel),
    plotCv, h('div', { id: 'wb-readout', class: 'readouts' }),
    h('div', { class: 'wb-pattern' }, h('canvas', { class: 'wb-polar', id: 'wb-az' }), h('canvas', { class: 'wb-polar', id: 'wb-el' })));

  // measurement card
  const cableSel = h('select', {}, ...Object.keys(CABLES).map((k) => h('option', { selected: k === w.cable }, k)));
  cableSel.onchange = () => { w.cable = cableSel.value; save(); measChanged(); };
  const cableLen = h('input', { type: 'number', value: w.cableFt, step: 'any', class: 'num' });
  cableLen.onchange = () => { w.cableFt = +cableLen.value || 0; save(); measChanged(); };
  const deChk = h('input', { type: 'checkbox', checked: w.deemb });
  deChk.onchange = () => { w.deemb = deChk.checked; save(); measChanged(); };
  const measure = h('div', { class: 'card wb-measure' },
    h('h3', {}, '📟 Real measurements'),
    h('p', { class: 'muted small' }, 'Load a sweep from your antenna analyzer (NanoVNA / RigExpert / any VNA): Touchstone .s1p, or CSV with Freq,R,X (or Freq,SWR). Or read a NanoVNA live over USB (Chrome/Edge desktop).'),
    h('div', { class: 'row' },
      h('label', { class: 'btn filebtn' }, '⬆ Load .s1p / .csv', h('input', { type: 'file', accept: '.s1p,.csv,.txt,.tsv', onchange: loadMeas })),
      h('button', { class: 'btn', onclick: liveVna }, '🔌 Read NanoVNA'),
      w.meas ? h('button', { class: 'btn small', onclick: () => { w.meas = null; save(); render(); } }, 'Clear') : null),
    w.meas ? h('div', { class: 'small ok' }, `${w.meas.pts.length} points from ${w.meas.source} (${(w.meas.pts[0].f / 1e6).toFixed(3)}–${(w.meas.pts[w.meas.pts.length - 1].f / 1e6).toFixed(3)} MHz)`) : null,
    h('fieldset', {}, h('legend', {}, 'Feedline between analyzer and antenna'),
      h('div', { class: 'row' }, h('label', { class: 'inline' }, cableSel), h('label', { class: 'inline' }, cableLen, ' ft'), h('label', { class: 'inline small' }, deChk, ' remove its effect (show antenna feed point)')),
      h('div', { class: 'muted tiny' }, 'Uses the cable\'s velocity factor and loss. If you measured right at the feed point, set length 0. For best results, measure the actual velocity factor of your cable.')),
    h('div', { id: 'wb-trim' }));

  // matching card
  const srcSel = h('select', {}, ...[['model', 'Simulated antenna'], ['meas', 'Measured antenna'], ['manual', 'Enter R + jX']].map(([k, l]) => h('option', { value: k, selected: w.matchSrc === k }, l)));
  srcSel.onchange = () => { w.matchSrc = srcSel.value; save(); render(); };
  const mR = h('input', { type: 'number', value: w.manR, step: 'any', class: 'num small' }), mX = h('input', { type: 'number', value: w.manX, step: 'any', class: 'num small' });
  mR.onchange = () => { w.manR = +mR.value; save(); drawMatch(); }; mX.onchange = () => { w.manX = +mX.value; save(); drawMatch(); };
  const qIn = h('input', { type: 'number', value: w.QL, class: 'num small' });
  qIn.onchange = () => { w.QL = +qIn.value || 150; save(); drawMatch(); };
  const insChk = h('input', { type: 'checkbox', checked: w.insul });
  insChk.onchange = () => { w.insul = insChk.checked; save(); drawCut(); };
  const endIn = h('input', { type: 'number', value: w.endIn, step: 0.5, class: 'num small' });
  endIn.onchange = () => { w.endIn = +endIn.value || 0; save(); drawCut(); };
  const match = h('div', { class: 'card wb-match' },
    h('h3', {}, '🧲 Matching network'),
    h('div', { class: 'row' }, h('label', { class: 'inline' }, 'Match ', srcSel), w.matchSrc === 'manual' ? h('span', { class: 'row' }, mR, ' + j ', mX, ' Ω') : null,
      h('label', { class: 'inline small' }, 'coil Q ', qIn), h('span', { class: 'muted small' }, `at ${w.fT} MHz to 50 Ω`)),
    h('div', { id: 'wb-match' }));
  const cut = h('div', { class: 'card wb-cut' }, h('h3', {}, '✂ Cut list'),
    h('div', { class: 'row' }, h('label', { class: 'inline small' }, insChk, ' insulated wire (≈3% shorter)'), h('label', { class: 'inline small' }, 'end-insulator wrap ', endIn, ' in')),
    h('div', { id: 'wb-cut' }));

  root.append(
    h('div', { class: 'wb-intro card' }, h('b', {}, '🛠 Antenna Workbench'), ' — a real design tool. The solver is a thin-wire Method-of-Moments engine (the same physics as NEC-2). Typical accuracy for wire antennas: resonance within ~1–3%; real-world sites add a few % (trees, house wiring, wire insulation, sag). Model → cut a little long → measure → let the trim advisor finish the job.'),
    h('div', { class: 'wb-grid' },
      h('div', { class: 'wb-col' }, design, cut),
      h('div', { class: 'wb-col' }, h('div', { class: 'card' }, h('h3', {}, '🧊 Geometry & currents'), geo), results),
      h('div', { class: 'wb-col' }, measure, match)));
  requestAnimationFrame(() => { draw3d(); drawPlot(); drawReadout(); drawPattern(); drawTrim(); drawMatch(); drawCut(); });
}

// ------------------------------------------------------------------ solver runs
async function simulate() {
  if (running) return;
  running = true; render();
  const w = W(), m = model();
  try {
    const r = await runSolver({ model: m, freqs: freqs(), patternF: w.fT * 1e6 }, (p) => { const b = $('#wb-prog'); if (b) b.style.width = `${p * 100}%`; });
    result = { ...r, model: m };
  } catch (e) { toast(`Solver error: ${e.message}`, 'bad'); }
  running = false; render();
}

async function autotune() {
  if (running) return;
  if (W().tpl === 'custom') return toast('Auto-tune works on the built-in templates. Scale imported models in your NEC tool.', 'warn');
  running = true; render();
  const w = W();
  const f0 = w.fT * 1e6;
  const X = async (k) => {
    const m = model(scaleParam(w.tpl, params(), k));
    const r = await runSolver({ model: m, freqs: [f0] });
    return r.sweep[0].Z[1];
  };
  try {
    // resonance: X crosses zero. Larger antenna -> lower resonance -> X at f0 goes positive.
    let lo = 0.8, hi = 1.25, xlo = await X(lo), xhi = await X(hi);
    if (Math.sign(xlo) === Math.sign(xhi)) { toast('Couldn\'t bracket a resonance near the target within ±20%. Check the design/band.', 'warn'); }
    else {
      for (let i = 0; i < 14; i++) {
        const mid = (lo + hi) / 2, xm = await X(mid);
        if (Math.sign(xm) === Math.sign(xlo)) { lo = mid; xlo = xm; } else hi = mid;
        const b = $('#wb-prog'); if (b) b.style.width = `${(i + 1) / 14 * 100}%`;
      }
      const k = (lo + hi) / 2;
      w.params[w.tpl] = scaleParam(w.tpl, params(), k);
      for (const [key, v] of Object.entries(w.params[w.tpl])) w.params[w.tpl][key] = Math.round(v * 100) / 100;
      save();
      toast(`Scaled by ${(k * 100).toFixed(1)}% — now resonant at ${w.fT} MHz.`, 'good');
    }
  } catch (e) { toast(`Solver error: ${e.message}`, 'bad'); }
  running = false;
  await simulate();
}

// ------------------------------------------------------------------ measurement
function measPts() {
  const w = W();
  if (!w.meas) return [];
  const lenM = w.cableFt * FT;
  return w.meas.pts.map((p) => (p.Z && w.deemb && lenM > 0 ? { f: p.f, Z: deembed(w.cable, p.f, lenM, p.Z), raw: p.Z } : { ...p }));
}
async function loadMeas(e) {
  const f = e.target.files[0];
  if (!f) return;
  const d = parseMeasurement(await f.text());
  if (!d.pts.length) return toast('Could not read any data points from that file.', 'bad');
  W().meas = { pts: d.pts, source: `${d.source} (${f.name})`, kind: d.kind };
  save(); render();
  toast(`Loaded ${d.pts.length} points.${d.kind === 'swr' ? ' SWR-only data: no phase, so no de-embedding or matching.' : ''}`, 'good');
}
async function liveVna() {
  const w = W(), f0 = w.fT * 1e6, sp = f0 * Math.max(w.spanPct, 5) / 100;
  try {
    const pts = await nanoVnaSweep(f0 - sp, f0 + sp, 101, (s) => toast(s, 'info', 2500));
    if (!pts.length) throw new Error('no data returned');
    w.meas = { pts, source: 'NanoVNA (live)', kind: 'complex' };
    save(); render();
  } catch (e) { toast(`NanoVNA: ${e.message}`, 'bad', 9000); }
}
function measChanged() { drawPlot(); drawReadout(); drawTrim(); drawMatch(); }

// ------------------------------------------------------------------ drawing
function draw3d() {
  const cv = root.querySelector('.wb-3d');
  if (!cv) return;
  const m = result?.model || model();
  const segs = result?.segs || m.wires.map((w) => ({ p0: w.p0, p1: w.p1 }));
  let mags = null;
  if (result?.currents) {
    const v = result.currents.map((c) => (Math.hypot(...c.a) + Math.hypot(...c.b)) / 2);
    const mx = Math.max(...v, 1e-12); mags = v.map((x) => x / mx);
  }
  const fw = m.wires[m.feed.wire];
  const feedPt = fw.p0.map((v, j) => v + (fw.p1[j] - v) * m.feed.at);
  wire3d(cv, { segs, mags, feedPt, ground: (m.ground || {}).type !== 'free', view });
}

function drawPlot() {
  const cv = $('#wb-plot');
  if (!cv) return;
  const w = W();
  const mod = result?.sweep || [];
  const meas = measPts();
  const f0 = w.fT, sp = f0 * w.spanPct / 100;
  let xMin = f0 - sp, xMax = f0 + sp;
  if (meas.length && !mod.length) { xMin = meas[0].f / 1e6; xMax = meas[meas.length - 1].f / 1e6; }
  const band = BANDS.find((b) => b.lo <= f0 * 1e6 && b.hi >= f0 * 1e6);
  const bands = band ? [{ lo: band.lo / 1e6, hi: band.hi / 1e6, color: 'rgba(80,200,120,0.10)' }] : [];
  const mSWR = mod.map((p) => [p.f / 1e6, swr(p.Z)]);
  const meSWR = meas.filter((p) => p.f / 1e6 >= xMin && p.f / 1e6 <= xMax).map((p) => [p.f / 1e6, p.swr ?? swr(p.Z)]);
  if (w.plot === 'smith') {
    smith(cv, [
      { pts: mod.map((p) => gammaOf(p.Z)), color: '#4fc3f7' },
      { pts: meas.filter((p) => p.Z).map((p) => gammaOf(p.Z)), color: '#ffb347' },
    ], [mod.length ? { g: gammaOf(nearest(mod, f0 * 1e6).Z), color: '#fff' } : null].filter(Boolean));
    cv._invX = null;
    return;
  }
  let pl;
  if (w.plot === 'swr') {
    pl = linePlot(cv, { series: [{ pts: mSWR, color: '#4fc3f7', label: 'model' }, { pts: meSWR, color: '#ffb347', label: w.deemb ? 'measured (at antenna)' : 'measured' }],
      xMin, xMax, yMin: 1, yMax: 10, yLog: true, xLabel: 'MHz', bands, hLines: [{ y: 2, color: 'rgba(94,224,138,0.5)' }], cursor: cursorF ? cursorF / 1e6 : null });
  } else {
    const all = [...mod.map((p) => p.Z), ...meas.filter((p) => p.Z).map((p) => p.Z)];
    const ymax = Math.min(2000, Math.max(100, ...all.map((z) => Math.max(z[0], Math.abs(z[1]))))) * 1.1;
    pl = linePlot(cv, { series: [
      { pts: mod.map((p) => [p.f / 1e6, p.Z[0]]), color: '#4fc3f7', label: 'R model' }, { pts: mod.map((p) => [p.f / 1e6, p.Z[1]]), color: '#4fc3f7', dash: [5, 4], label: 'X model' },
      { pts: meas.filter((p) => p.Z).map((p) => [p.f / 1e6, p.Z[0]]), color: '#ffb347', label: 'R meas' }, { pts: meas.filter((p) => p.Z).map((p) => [p.f / 1e6, p.Z[1]]), color: '#ffb347', dash: [5, 4], label: 'X meas' }],
    xMin, xMax, yMin: -ymax, yMax: ymax, xLabel: 'MHz', yLabel: 'Ω', bands, hLines: [{ y: 50, color: 'rgba(94,224,138,0.4)' }, { y: 0, color: 'rgba(255,255,255,0.3)' }], cursor: cursorF ? cursorF / 1e6 : null });
  }
  cv._invX = pl.invX;
}
const nearest = (arr, f) => arr.reduce((a, b) => (Math.abs(b.f - f) < Math.abs(a.f - f) ? b : a));

function drawReadout() {
  const el = $('#wb-readout');
  if (!el) return;
  const w = W();
  const fq = cursorF || w.fT * 1e6;
  const cells = [];
  const box = (k, v, cls = '') => cells.push(`<div><span>${k}</span><b class="${cls}">${v}</b></div>`);
  if (result?.sweep) {
    const p = nearest(result.sweep, fq), s = swr(p.Z);
    const a = analyzeSweep(result.sweep);
    box('Model @ ' + (p.f / 1e6).toFixed(3), `${p.Z[0].toFixed(1)} ${p.Z[1] < 0 ? '−' : '+'} j${Math.abs(p.Z[1]).toFixed(1)} Ω`);
    box('SWR (50 Ω)', s > 50 ? '>50' : s.toFixed(2), s < 1.6 ? 'ok' : s < 3 ? 'warn' : 'bad');
    box('Resonance', a.res ? `${(a.res.f / 1e6).toFixed(3)} MHz (${a.res.R.toFixed(0)} Ω)` : 'outside sweep');
    box('2:1 bandwidth', a.bw ? `${((a.bw[1] - a.bw[0]) / 1e3).toFixed(0)} kHz` : '—');
    if (result.pattern) {
      const pt = result.pattern, az = pt.azCut, back = az[Math.round(((pt.bestAz + 180) % 360) / 3)];
      box('Max gain', `${pt.maxG.toFixed(2)} dBi`);
      box('Take-off angle', pt.free ? 'free space' : `${pt.bestEl}°`);
      box('Front/back', `${(pt.maxG - back).toFixed(1)} dB`);
    }
  }
  const meas = measPts();
  if (meas.length) {
    const p = nearest(meas, fq);
    if (p.Z) box('Measured @ ' + (p.f / 1e6).toFixed(3), `${p.Z[0].toFixed(1)} ${p.Z[1] < 0 ? '−' : '+'} j${Math.abs(p.Z[1]).toFixed(1)} Ω`);
    const s = p.swr ?? swr(p.Z);
    box('Measured SWR', s > 50 ? '>50' : s.toFixed(2), s < 1.6 ? 'ok' : s < 3 ? 'warn' : 'bad');
    if (w.meas?.kind === 'complex' && w.cableFt > 0) box('Coax loss @f', `${(lossDbPerM(w.cable, p.f) * w.cableFt * FT).toFixed(2)} dB`);
  }
  el.innerHTML = cells.join('') || '<div class="muted small">Press ▶ Simulate (and/or load a measurement).</div>';
}

function drawPattern() {
  const az = $('#wb-az'), el = $('#wb-el');
  if (!az || !el) return;
  const pt = result?.pattern;
  if (!pt) { for (const cv of [az, el]) { const c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height); } return; }
  polar(az, { values: pt.azCut, angles: pt.azCut.map((_, i) => i * 3), compass: true, title: `Azimuth @ ${pt.free ? 0 : pt.bestEl}° elev`, maxG: pt.maxG });
  polar(el, { values: pt.elCut.map((v) => Math.max(v, pt.maxG - 40)), angles: pt.elCut.map((_, i) => i * 2), compass: false, title: `Elevation @ ${pt.bestAz}° (front left)`, maxG: pt.maxG });
}

function drawTrim() {
  const el = $('#wb-trim');
  if (!el) return;
  const w = W();
  const meas = measPts();
  if (!meas.length) { el.innerHTML = '<p class="muted small">Load a measurement to get trim advice.</p>'; return; }
  const a = analyzeSweep(meas);
  const fr = a.res ? a.res.f : a.min.f;
  const T = TEMPLATES[w.tpl], p = params();
  const key = T.primary, L = p[key];
  const fT = w.fT * 1e6;
  const newL = L * fr / fT;
  const d = L - newL;
  const per = w.tpl === 'dipole' || w.tpl === 'invv' || w.tpl === 'yagi3' ? 2 : 1;
  const inch = (ft) => `${(Math.abs(ft) * 12).toFixed(1)} in (${(Math.abs(ft) * 30.48).toFixed(1)} cm)`;
  let modelCal = '';
  if (result?.sweep) {
    const am = analyzeSweep(result.sweep);
    if (am.res) modelCal = `<p class="small">Model resonance ${(am.res.f / 1e6).toFixed(3)} MHz vs measured ${(fr / 1e6).toFixed(3)} MHz → your site is <b>${((am.res.f / fr - 1) * 100).toFixed(1)}%</b> ${am.res.f > fr ? 'lower' : 'higher'} than the model. That\'s the "environment factor" (insulation, nearby objects, ground). It\'s baked into the advice below.</p>`;
  }
  el.innerHTML = `
    <div class="readouts">
      <div><span>Measured resonance</span><b>${(fr / 1e6).toFixed(3)} MHz</b></div>
      <div><span>Min SWR</span><b>${a.min.swr.toFixed(2)} @ ${(a.min.f / 1e6).toFixed(3)}</b></div>
      <div><span>2:1 bandwidth</span><b>${a.bw ? ((a.bw[1] - a.bw[0]) / 1e3).toFixed(0) + ' kHz' : '—'}</b></div>
    </div>
    ${modelCal}
    <div class="advice">${Math.abs(fr - fT) / fT < 0.003 ? '👍 Already on target (within 0.3%). Leave it!' :
      `<b>${d > 0 ? '✂ Trim' : '➕ Add'}</b> ${per === 2 ? `<b>${inch(d / 2)}</b> ${d > 0 ? 'off' : 'to'} <b>each</b> end (${inch(d)} total)` : `<b>${inch(d)}</b>`} to move resonance from ${(fr / 1e6).toFixed(3)} to ${w.fT} MHz.
      <div class="muted tiny">Based on the current ${T.params[key][0].toLowerCase()} of ${L} ft scaling inversely with frequency (good to ~1%). Trim a bit less than suggested, re-measure, repeat.</div>`}</div>
    <button class="btn small" id="wb-applytrim">Update design length to ${newL.toFixed(2)} ft</button>`;
  $('#wb-applytrim').onclick = () => { p[key] = Math.round(newL * 100) / 100; save(); render(); };
}

function matchZ() {
  const w = W(), f = w.fT * 1e6;
  if (w.matchSrc === 'manual') return [w.manR, w.manX];
  if (w.matchSrc === 'meas') { const m = measPts().filter((p) => p.Z); return m.length ? nearest(m, f).Z : null; }
  return result?.sweep ? nearest(result.sweep, f).Z : null;
}

function drawMatch() {
  const el = $('#wb-match');
  if (!el) return;
  const w = W(), f = w.fT * 1e6;
  const Z = matchZ();
  if (!Z) { el.innerHTML = `<p class="muted small">${w.matchSrc === 'meas' ? 'Load a measurement with R and X (phase) first.' : 'Run ▶ Simulate first.'}</p>`; return; }
  const s0 = swr(Z);
  const nets = lNetworks(Z, f);
  const src = w.matchSrc === 'meas' ? measPts().filter((p) => p.Z) : w.matchSrc === 'model' ? result?.sweep || [] : [];
  const rows = nets.map((n, i) => {
    const ev = lNetEval(n, Z, f, w.QL, 1000);
    // matched bandwidth with fixed parts
    let bw = '';
    if (src.length > 3) {
      const ok = src.filter((p) => swr(lNetEval(n, p.Z, p.f, w.QL, 1000).Zin) <= 2);
      bw = ok.length ? `${((ok[ok.length - 1].f - ok[0].f) / 1e3).toFixed(0)} kHz` : '—';
    }
    return `<tr><td>${i + 1}</td><td>${schematic(n)}</td><td>${n.series.text}</td><td>${n.shunt.text}</td><td>${(ev.eff * 100).toFixed(1)}% (${(10 * Math.log10(ev.eff)).toFixed(2)} dB)</td><td>${bw}</td></tr>`;
  }).join('');
  const st = stubMatch(Z, f, 'RG-213');
  const tr = transformerSuggest(Z);
  const m2ft = (m) => `${(m / FT).toFixed(2)} ft`;
  el.innerHTML = `
    <p class="small">Load: <b>${Z[0].toFixed(1)} ${Z[1] < 0 ? '−' : '+'} j${Math.abs(Z[1]).toFixed(1)} Ω</b>, SWR ${s0 > 50 ? '>50' : s0.toFixed(2)} unmatched.</p>
    <table class="tbl small"><tr><th>#</th><th>Topology</th><th>Series</th><th>Shunt</th><th>Efficiency (coil Q ${w.QL})</th><th>2:1 BW</th></tr>${rows || '<tr><td colspan=6>No L-network solution.</td></tr>'}</table>
    <p class="muted tiny">"Shunt at load" = shunt part across the antenna terminals, series part toward the radio. A shunt inductor at a Yagi's driven element is a <b>hairpin match</b>.</p>
    <h4>Single-stub (RG-213, VF ${CABLES['RG-213'].vf})</h4>
    <table class="tbl small"><tr><th></th><th>Line from load</th><th>Open stub</th><th>Shorted stub</th></tr>
      ${st.map((s, i) => `<tr><td>${i + 1}</td><td>${m2ft(s.dM)}</td><td>${m2ft(s.loM)}</td><td>${m2ft(s.lsM)}</td></tr>`).join('')}</table>
    <p class="small">Transformer: nearest unun/balun <b>1:${tr.unun.n}</b> → SWR ${tr.unun.swr.toFixed(2)}. Quarter-wave matching section: <b>${tr.quarterWaveZ0.toFixed(0)} Ω</b> line${Math.abs(tr.quarterWaveZ0 - 75) < 8 ? ' — 75 Ω coax (RG-59/RG-6) is close!' : ''}${Math.abs(Z[1]) > Z[0] * 0.3 ? ' (works only if the load is close to resistive)' : ''}.</p>`;
}

function schematic(n) {
  const sym = (p) => (p.type === 'L' ? '⌇L' : p.type === 'C' ? '┤├C' : '—');
  return n.topo === 'shuntLoad' ? `radio ─ ${sym(n.series)} ─┬─ ant<br><span class="muted">${'&nbsp;'.repeat(14)}${sym(n.shunt)}</span>` : `radio ─┬─ ${sym(n.series)} ─ ant<br><span class="muted">${'&nbsp;'.repeat(7)}${sym(n.shunt)}</span>`;
}

function drawCut() {
  const el = $('#wb-cut');
  if (!el) return;
  const w = W(), p = params();
  const k = w.insul ? 0.97 : 1;
  const ftin = (ft) => { const tin = ft * 12; return `${Math.floor(tin / 12)}′ ${(tin % 12).toFixed(1)}″ <span class="muted">(${(ft * 0.3048).toFixed(3)} m)</span>`; };
  const extra = w.endIn / 12;
  const rows = [];
  const add = (name, ft, n = 1, ends = 1) => rows.push(`<tr><td>${name}${n > 1 ? ` × ${n}` : ''}</td><td>${ftin(ft * k)}</td><td>${ftin(ft * k + extra * ends)}</td></tr>`);
  switch (w.tpl) {
    case 'dipole': case 'invv': add('Each leg (from feed point to insulator)', p.len / 2, 2); break;
    case 'vertical': add('Radiator', p.len, 1, 0); add('Radials (λ/4 if possible)', p.len, p.radials, 0); break;
    case 'gp': add('Radiator', p.len, 1, 0); add('Radial', p.radLen, p.nRad); break;
    case 'efhw': add('Radiator wire', p.len); add('Counterpoise', p.cp, 1, 0); break;
    case 'yagi3': add('Reflector (tip-to-tip)', p.refl, 1, 0); add('Driven element (tip-to-tip)', p.drv, 1, 0); add('Director (tip-to-tip)', p.dir, 1, 0); add('Boom (minimum)', p.s1 + p.s2 + 1, 1, 0); break;
    case 'loop': add('Each side', p.len / 4, 4, 0); add('Total perimeter', p.len, 1, 0); break;
  }
  el.innerHTML = `<table class="tbl small"><tr><th>Piece</th><th>Electrical length</th><th>Cut length (incl. wrap)</th></tr>${rows.join('')}</table>
    <p class="muted tiny">Cut ~2% long the first time and trim to the measured resonance. Insulated wire resonates lower than bare wire; the exact factor depends on the insulation (2–5%).</p>`;
}

// ------------------------------------------------------------------ NEC / game
function exportNec() {
  const w = W(), fs = freqs();
  download(`${w.tpl}-${w.fT}MHz.nec`, toNEC(model(), fs[0], fs[fs.length - 1], fs.length, `${TEMPLATES[w.tpl]?.label || 'custom'} @ ${w.fT} MHz`));
}
async function importNec(e) {
  const f = e.target.files[0];
  if (!f) return;
  const m = fromNEC(await f.text());
  if (!m.wires.length) return toast('No GW (wire) cards found.', 'bad');
  const w = W();
  TEMPLATES.custom ||= { label: 'Imported NEC model', primary: null, params: {}, help: 'Imported geometry (metres). Edit in your NEC tool and re-import.' };
  w.tpl = 'custom'; w.custom = m; result = null; save(); render();
  toast(`Imported ${m.wires.length} wires.`, 'good');
}
function useInGame() {
  const w = W(), p = params();
  const map = { dipole: ['dipole', p.len, p.h], invv: ['invv', p.len, p.h], vertical: ['vertical', p.len, 0], efhw: ['efhw', p.len, p.h], yagi3: ['yagi', p.drv, p.h] }[w.tpl];
  if (!map) return toast('That antenna type isn\'t available in the game yet (dipole, inverted-V, vertical, EFHW and Yagi are).', 'warn');
  const a = S.antenna;
  if (a.built) return toast('Lower your current antenna first (Antenna tab).', 'warn');
  Object.assign(a, { type: map[0], length: Math.round(map[1] * 100) / 100, height: Math.round(map[2]) || a.height });
  if (w.tpl === 'vertical') a.radials = [0, 4, 8, 16, 32, 60].reduce((b, x) => (x <= p.radials ? x : b), 0);
  save(); bus.emit('antenna'); bus.emit('antenna-rebuild');
  toast('Design copied to your game antenna. Raise it on the Antenna tab!', 'good');
}
