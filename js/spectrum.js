// FFT spectrum analyzer with waterfall, markers, averaging and max-hold.
// Sources: built-in test signals (each demonstrates one measurement idea), the microphone /
// line input, the audio of another browser tab (e.g. a web SDR) and live feeds from the
// Live feeds page. Levels are dBFS (full-scale sine = 0 dBFS) unless a calibration offset is set.
import { h, bus, toast } from './util.js';
import { icon } from './icons.js';
import { WINDOWS, windowTable, powerSpectrum, fftParams } from './rfmath.js';

const FS_SYN = 48000;
let actx = null;
export function specCtx() {
  if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
  if (actx.state === 'suspended') actx.resume();
  return actx;
}

// ------------------------------------------------------------------ test signals
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const amp = (dbfs) => Math.pow(10, dbfs / 20); // peak amplitude of a sine at that dBFS
const TAU = 2 * Math.PI;

const SCEN = {
  carrier: {
    label: 'Single carrier in noise', lesson: 'Change the FFT size and window: the carrier level stays put while the displayed noise floor moves by 10·log10 of the RBW change. Signals are measured in the RBW; noise depends on it.',
    params: [['f', 'Frequency', 'kHz', 1, 23, 0.01, 8.0], ['lvl', 'Level', 'dBFS', -120, 0, 1, -20], ['nz', 'Noise (total)', 'dBFS', -120, -10, 1, -60]],
    gen: (p, t) => amp(p.lvl) * Math.sin(TAU * p.f * 1000 * t),
  },
  two: {
    label: 'Two close signals (resolution)', lesson: 'Two carriers can only be told apart when the resolution bandwidth is narrower than their spacing. Reduce the spacing, then increase the FFT size until they separate. A rectangular window resolves equal signals best but buries a weak neighbour in leakage.',
    params: [['sep', 'Spacing', 'Hz', 2, 400, 1, 40], ['l2', 'Second signal', 'dB', -80, 0, 1, -30], ['nz', 'Noise (total)', 'dBFS', -120, -10, 1, -90]],
    gen: (p, t) => 0.3 * Math.sin(TAU * 6000 * t) + 0.3 * amp(p.l2) * Math.sin(TAU * (6000 + p.sep) * t),
  },
  am: {
    label: 'AM: carrier and sidebands', lesson: 'Each sideband sits at the carrier ± the audio frequency, with a level of 20·log10(m/2) relative to the carrier: −6 dBc at 100 % modulation. Most of the power stays in the carrier.',
    params: [['fa', 'Audio tone', 'kHz', 0.2, 5, 0.05, 1.0], ['m', 'Modulation depth', '%', 0, 100, 1, 80], ['nz', 'Noise (total)', 'dBFS', -120, -10, 1, -90]],
    gen: (p, t) => 0.4 * (1 + (p.m / 100) * Math.cos(TAU * p.fa * 1000 * t)) * Math.cos(TAU * 12000 * t),
  },
  fm: {
    label: 'FM: Bessel sidebands', lesson: 'Sidebands appear every audio-frequency step, with levels set by Bessel functions of β = deviation ÷ audio frequency. At β = 2.405 the carrier vanishes: set audio 1 kHz and deviation 2.405 kHz to see it.',
    params: [['fa', 'Audio tone', 'kHz', 0.2, 3, 0.05, 1.0], ['dev', 'Deviation', 'kHz', 0, 8, 0.005, 2.405], ['nz', 'Noise (total)', 'dBFS', -120, -10, 1, -90]],
    gen: (p, t) => 0.5 * Math.cos(TAU * 12000 * t + (p.dev / p.fa) * Math.sin(TAU * p.fa * 1000 * t)),
  },
  imd: {
    label: 'Two-tone test (amplifier linearity)', lesson: 'Two equal tones through an amplifier: third-order products appear at 2f1 − f2 and 2f2 − f1. Raise the drive and watch them grow 3 dB for every 1 dB of drive. Use the delta marker to read IMD in dBc; good SSB transmitters manage −30 dBc or better.',
    params: [['sp', 'Tone spacing', 'Hz', 200, 2000, 10, 1000], ['dr', 'Overdrive', '%', 0, 100, 1, 25], ['nz', 'Noise (total)', 'dBFS', -120, -10, 1, -100]],
    gen: (p, t) => { const x = 0.35 * (Math.sin(TAU * (12000 - p.sp / 2) * t) + Math.sin(TAU * (12000 + p.sp / 2) * t)); return x - (p.dr / 100) * 1.2 * x * x * x; },
  },
  harm: {
    label: 'Harmonics and spurious emissions', lesson: 'A non-linear stage creates harmonics at 2f, 3f and so on. FCC §97.307 requires spurious emissions below 30 MHz to be at least 43 dB below the mean power of the wanted signal (60 dB for transmitters on 30 to 225 MHz). Measure each harmonic with a delta marker.',
    params: [['a2', '2nd-order distortion', '%', 0, 50, 0.5, 5], ['a3', '3rd-order distortion', '%', 0, 50, 0.5, 3], ['nz', 'Noise (total)', 'dBFS', -120, -10, 1, -100]],
    gen: (p, t) => { const x = 0.5 * Math.sin(TAU * 3000 * t); return x + (p.a2 / 100) * x * x * 2 + (p.a3 / 100) * x * x * x * 4; },
  },
  cw: {
    label: 'CW keying and key clicks', lesson: 'The keying waveform\'s rise time sets how wide a CW signal is. With 0.1 ms edges the signal splatters key clicks across kilohertz; 5 ms raised-cosine edges keep it within a few hundred hertz. Use max hold.',
    params: [['rise', 'Rise / fall time', 'ms', 0.1, 10, 0.1, 0.2], ['wpm', 'Speed', 'WPM', 10, 40, 1, 25], ['nz', 'Noise (total)', 'dBFS', -120, -10, 1, -100]],
    gen: null, // stateful, see cwGen
  },
  weak: {
    label: 'Weak signal under the noise', lesson: 'This carrier is below the displayed noise at small FFT sizes. Increase the FFT size (narrower RBW lowers the noise in each bin) and turn on averaging (which smooths the noise without lowering it) until it appears.',
    params: [['lvl', 'Carrier level', 'dBFS', -110, -40, 1, -78], ['nz', 'Noise (total)', 'dBFS', -80, -10, 1, -40]],
    gen: (p, t) => amp(p.lvl) * Math.sin(TAU * 9876.5 * t),
  },
  ssb: {
    label: 'SSB voice (upper sideband)', lesson: 'A voice signal fills about 2.4 kHz on one side of the suppressed carrier at 12 kHz. Use max hold to see the occupied bandwidth and look for the suppressed carrier and unwanted sideband, which a good transmitter keeps 40 to 60 dB down.',
    params: [['sup', 'Carrier suppression', 'dB', 20, 80, 1, 50], ['opp', 'Opposite sideband', 'dB', 20, 80, 1, 45], ['nz', 'Noise (total)', 'dBFS', -120, -10, 1, -95]],
    gen: null, // stateful, see ssbGen
  },
};

const cw = { r: 0, key: false, pos: 0 };
const CW_PATTERN = [1, 1, 3, 1, 1, 1, 3, 3, 1, 1, 3, 1, 1, 7]; // on/off element lengths in dits, alternating
function cwGen(p, t, dt) {
  const dit = 1.2 / p.wpm;
  const period = CW_PATTERN.reduce((a, b) => a + b, 0) * dit;
  let x = (t % period) / dit, on = true;
  for (const len of CW_PATTERN) { if (x < len) break; x -= len; on = !on; }
  const step = dt / Math.max(p.rise / 1000, 1e-5);
  cw.r = Math.min(1, Math.max(0, cw.r + (on ? step : -step)));
  const env = Math.sin((Math.PI / 2) * cw.r) ** 2;
  return 0.5 * env * Math.sin(TAU * 12000 * t);
}
const ssb = { tones: Array.from({ length: 24 }, () => ({ f: 300 + Math.random() * 2400, ph: Math.random() * TAU, a: Math.random() })), env: 0.5, tgt: 0.5 };
function ssbGen(p, t) {
  if (Math.random() < 0.0006) ssb.tgt = Math.random() < 0.25 ? 0.03 : 0.2 + Math.random() * 0.8;
  ssb.env += (ssb.tgt - ssb.env) * 0.002;
  let y = 0;
  const o = amp(-p.opp);
  for (const k of ssb.tones) { y += k.a * (Math.cos(TAU * (12000 + k.f) * t + k.ph) + o * Math.cos(TAU * (12000 - k.f) * t + k.ph)); }
  return 0.04 * ssb.env * y + amp(-p.sup) * 0.25 * Math.cos(TAU * 12000 * t);
}

// ------------------------------------------------------------------ analyzer state
const A = {
  src: 'syn', scen: 'carrier', p: {}, N: 4096, win: 'Hann', avg: 1, hold: false, top: 0, range: 120, cal: 0, paused: false,
  t: 0, avgBuf: null, avgCount: 0, holdBuf: null, last: null, markers: [], fs: FS_SYN,
  live: null, // { analyser, stop(), label }
};
for (const [k, s] of Object.entries(SCEN)) A.p[k] = Object.fromEntries(s.params.map(([id, , , , , , v]) => [id, v]));

let root, cv, wf, wfx, readout, paramBox, lessonEl, srcInfo;

function synthFrame(N) {
  const s = SCEN[A.scen], p = A.p[A.scen], dt = 1 / FS_SYN, out = new Float32Array(N);
  const nz = p.nz != null ? amp(p.nz) / Math.SQRT2 : 0; // rms of the noise
  for (let i = 0; i < N; i++) {
    const t = A.t + i * dt;
    const v = A.scen === 'cw' ? cwGen(p, t, dt) : A.scen === 'ssb' ? ssbGen(p, t) : s.gen(p, t);
    out[i] = v + (nz ? nz * gauss() : 0);
  }
  A.t += N * dt;
  return out;
}

function liveFrame(N) {
  const an = A.live?.analyser;
  if (!an) return null;
  if (an.fftSize !== Math.min(N, 32768)) an.fftSize = Math.min(N, 32768);
  const buf = new Float32Array(an.fftSize);
  an.getFloatTimeDomainData(buf);
  return buf;
}

function resetTraces() { A.avgBuf = null; A.avgCount = 0; A.holdBuf = null; }

function step() {
  if (A.paused) return;
  const N = A.src === 'syn' ? A.N : Math.min(A.N, 32768);
  const samples = A.src === 'syn' ? synthFrame(N) : liveFrame(N);
  if (!samples) return;
  const win = windowTable(A.win, samples.length);
  const ps = powerSpectrum(samples, win);
  if (!A.avgBuf || A.avgBuf.length !== ps.length) { A.avgBuf = new Float64Array(ps.length); A.avgCount = 0; A.holdBuf = null; }
  // power (not dB) averaging, exponential once the count is reached
  A.avgCount = Math.min(A.avgCount + 1, A.avg);
  const k = 1 / A.avgCount;
  for (let i = 0; i < ps.length; i++) { const pw = Math.pow(10, ps[i] / 10); A.avgBuf[i] = A.avgBuf[i] * (1 - k) + pw * k; }
  const trace = new Float32Array(ps.length);
  for (let i = 0; i < ps.length; i++) trace[i] = 10 * Math.log10(Math.max(A.avgBuf[i], 1e-24)) + A.cal;
  if (A.hold) { if (!A.holdBuf || A.holdBuf.length !== trace.length) A.holdBuf = Float32Array.from(trace); else for (let i = 0; i < trace.length; i++) A.holdBuf[i] = Math.max(A.holdBuf[i], trace[i]); }
  A.last = { trace, raw: ps, N: samples.length, win };
  draw();
}

// ------------------------------------------------------------------ drawing
const PAD = { l: 46, r: 10, t: 10, b: 22 };
function binOfX(x, W, n) { return Math.round(((x - PAD.l) / (W - PAD.l - PAD.r)) * (n - 1)); }
function xOfBin(b, W, n) { return PAD.l + (b / (n - 1)) * (W - PAD.l - PAD.r); }
function yOfDb(d, H) { return PAD.t + ((A.top - d) / A.range) * (H - PAD.t - PAD.b); }
const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#41b8e8';

function draw() {
  if (!A.last || !cv.isConnected) return;
  const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
  if (cv.width !== W * dpr || cv.height !== H * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  g.fillStyle = css('--bg-2'); g.fillRect(0, 0, W, H);
  const n = A.last.trace.length, fs = A.src === 'syn' ? FS_SYN : (actx?.sampleRate || 48000), nyq = fs / 2;
  // grid
  g.strokeStyle = css('--line-2'); g.lineWidth = 1; g.fillStyle = css('--muted'); g.font = '10px "JetBrains Mono", monospace';
  for (let d = Math.ceil((A.top - A.range) / 10) * 10; d <= A.top; d += 10) { const y = yOfDb(d, H); g.beginPath(); g.moveTo(PAD.l, y); g.lineTo(W - PAD.r, y); g.stroke(); g.fillText(String(d), 4, y + 3); }
  const kstep = nyq > 30000 ? 5000 : nyq > 12000 ? 2000 : 1000;
  for (let f = 0; f <= nyq; f += kstep) { const x = xOfBin((f / nyq) * (n - 1), W, n); g.beginPath(); g.moveTo(x, PAD.t); g.lineTo(x, H - PAD.b); g.stroke(); g.fillText(`${f / 1000}k`, x - 8, H - 6); }
  const line = (arr, color, w) => { g.strokeStyle = color; g.lineWidth = w; g.beginPath(); const px = W - PAD.l - PAD.r; for (let x = 0; x < px; x++) { const b0 = Math.floor((x / px) * n), b1 = Math.max(b0 + 1, Math.floor(((x + 1) / px) * n)); let m = -999; for (let b = b0; b < b1 && b < n; b++) m = Math.max(m, arr[b]); const y = Math.min(H - PAD.b, Math.max(PAD.t, yOfDb(m, H))); x ? g.lineTo(PAD.l + x, y) : g.moveTo(PAD.l + x, y); } g.stroke(); };
  if (A.hold && A.holdBuf) line(A.holdBuf, css('--amber'), 1);
  line(A.last.trace, css('--accent'), 1.4);
  // markers
  A.markers.forEach((m, i) => {
    const b = Math.min(n - 1, m.bin), x = xOfBin(b, W, n), y = yOfDb(A.last.trace[b], H);
    g.fillStyle = i ? css('--ok') : css('--amber');
    g.beginPath(); g.moveTo(x, y - 2); g.lineTo(x - 5, y - 10); g.lineTo(x + 5, y - 10); g.closePath(); g.fill();
    g.fillText(i ? 'Δ' : '1', x - 3, y - 13);
  });
  // waterfall
  const ww = wf.width, row = wfx.getImageData(0, 0, ww, wf.height - 1);
  wfx.putImageData(row, 0, 1);
  const img = wfx.createImageData(ww, 1);
  for (let x = 0; x < ww; x++) {
    const b = Math.floor((x / ww) * n), v = Math.max(0, Math.min(1, (A.last.trace[b] - (A.top - A.range)) / A.range));
    const [r, gg, bb] = heat(v);
    img.data[x * 4] = r; img.data[x * 4 + 1] = gg; img.data[x * 4 + 2] = bb; img.data[x * 4 + 3] = 255;
  }
  wfx.putImageData(img, 0, 0);
  updateReadout(fs);
}
function heat(v) {
  const stops = [[0, [8, 12, 20]], [0.35, [20, 50, 120]], [0.55, [30, 150, 200]], [0.75, [240, 200, 60]], [1, [255, 255, 255]]];
  for (let i = 1; i < stops.length; i++) if (v <= stops[i][0]) { const [a, ca] = stops[i - 1], [b, cb] = stops[i], t = (v - a) / (b - a); return ca.map((c, j) => c + (cb[j] - c) * t); }
  return [255, 255, 255];
}

function updateReadout(fs) {
  const L = A.last, n = L.trace.length, binHz = fs / L.N, p = fftParams(fs, L.N, A.win);
  const sorted = Float32Array.from(L.trace).sort();
  // median of exponentially distributed noise power is 1.59 dB below its mean (single frames);
  // with averaging the distribution narrows, so apply the correction only without averaging
  const med = sorted[Math.floor(n / 2)] + (A.avg === 1 ? 1.59 : 0);
  let pk = 1; for (let i = 1; i < n; i++) if (L.trace[i] > L.trace[pk]) pk = i;
  // 99 % occupied bandwidth (power-based)
  let tot = 0; const pw = L.trace.map((d) => Math.pow(10, d / 10)); for (const v of pw) tot += v;
  let acc = 0, lo = 0, hi = n - 1; for (let i = 0; i < n; i++) { acc += pw[i]; if (acc >= tot * 0.005) { lo = i; break; } }
  acc = 0; for (let i = n - 1; i >= 0; i--) { acc += pw[i]; if (acc >= tot * 0.005) { hi = i; break; } }
  const u = A.cal ? 'dBm' : 'dBFS';
  const f = (b) => `${(b * binHz / 1000).toFixed(3)} kHz`;
  const mk = A.markers.map((m, i) => {
    const b = Math.min(n - 1, m.bin);
    if (!i) return `<div><span class="k">Marker 1</span> ${f(b)} · <b>${L.trace[b].toFixed(1)} ${u}</b></div>`;
    const b0 = Math.min(n - 1, A.markers[0].bin);
    return `<div><span class="k">Δ marker</span> ${((b - b0) * binHz).toFixed(1)} Hz · <b>${(L.trace[b] - L.trace[b0]).toFixed(1)} dB</b></div>`;
  }).join('');
  readout.innerHTML = `<div><span class="k">RBW</span> <b>${p.rbwHz.toFixed(2)} Hz</b> · bin ${binHz.toFixed(2)} Hz · frame ${(p.frameS * 1000).toFixed(0)} ms</div>`
    + `<div><span class="k">Peak</span> ${f(pk)} · <b>${L.trace[pk].toFixed(1)} ${u}</b></div>`
    + `<div><span class="k">Noise floor</span> <b>${med.toFixed(1)} ${u}</b> in RBW · ${(med - 10 * Math.log10(p.rbwHz)).toFixed(1)} ${u}/Hz</div>`
    + `<div><span class="k">Peak SNR</span> <b>${(L.trace[pk] - med).toFixed(1)} dB</b> · 99 % occupied BW ${(((hi - lo) + 1) * binHz / 1000).toFixed(2)} kHz</div>` + mk;
}

// ------------------------------------------------------------------ live sources
async function useMic() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    attachStream(stream, 'Microphone / line input');
  } catch (e) { toast('Microphone access was not allowed or no input is available.', 'warn'); setSrc('syn'); }
}
async function useTab() {
  if (!navigator.mediaDevices?.getDisplayMedia) { toast('This browser cannot capture tab audio. Use Chrome or Edge on a computer.', 'warn'); setSrc('syn'); return; }
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    if (!stream.getAudioTracks().length) { stream.getTracks().forEach((t) => t.stop()); toast('No audio was shared. Choose a tab and tick "Share tab audio".', 'warn'); setSrc('syn'); return; }
    attachStream(stream, 'Shared tab audio');
  } catch (e) { setSrc('syn'); }
}
function attachStream(stream, label) {
  const ctx = specCtx();
  const node = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = Math.min(A.N, 32768); analyser.smoothingTimeConstant = 0;
  node.connect(analyser);
  stopLive();
  A.live = { analyser, label, stop: () => { node.disconnect(); stream.getTracks().forEach((t) => t.stop()); } };
  stream.getTracks().forEach((t) => t.addEventListener('ended', () => { if (A.live?.label === label) setSrc('syn'); }));
  resetTraces(); renderControls();
}
// Called by the live-feeds page with a node in specCtx()
export function analyzeNode(node, label) {
  const analyser = specCtx().createAnalyser();
  analyser.fftSize = Math.min(A.N, 32768); analyser.smoothingTimeConstant = 0;
  node.connect(analyser);
  stopLive();
  A.src = 'feed';
  A.live = { analyser, label, stop: () => { try { node.disconnect(analyser); } catch (e) { } } };
  resetTraces(); renderControls();
}
function stopLive() { if (A.live) { A.live.stop(); A.live = null; } }
function setSrc(s) {
  if (s === A.src && s !== 'syn') return;
  stopLive();
  A.src = s; resetTraces(); A.markers = [];
  if (s === 'mic') useMic();
  if (s === 'tab') useTab();
  renderControls();
}

// ------------------------------------------------------------------ controls
const sel = (val, opts, on) => { const s = h('select', {}, ...opts.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return h('option', { value: v, selected: String(v) === String(val) }, l); })); s.onchange = () => on(s.value); return s; };

function renderControls() {
  paramBox.innerHTML = '';
  const s = SCEN[A.scen];
  if (A.src === 'syn') {
    paramBox.append(h('label', { class: 'rt-field' }, h('span', { class: 'rt-lab' }, 'Test signal'), sel(A.scen, Object.entries(SCEN).map(([k, x]) => [k, x.label]), (v) => { A.scen = v; resetTraces(); A.markers = []; renderControls(); })));
    for (const [id, lab, unit, lo, hi, st] of s.params) {
      const val = h('span', { class: 'mono' }, `${A.p[A.scen][id]} ${unit}`);
      const r = h('input', { type: 'range', min: lo, max: hi, step: st, value: A.p[A.scen][id] });
      r.oninput = () => { A.p[A.scen][id] = parseFloat(r.value); val.textContent = `${r.value} ${unit}`; if (!A.hold) resetTraces(); };
      paramBox.append(h('label', { class: 'rt-field spec-param' }, h('span', { class: 'rt-lab' }, lab, ' ', val), r));
    }
    lessonEl.innerHTML = `<span>${icon('bulb')}</span><span>${s.lesson}</span>`;
    lessonEl.hidden = false;
    srcInfo.textContent = 'Synthesized at 48 kHz: a 24 kHz slice of spectrum, as an SDR or a receiver\'s IF would show it.';
  } else {
    lessonEl.hidden = true;
    srcInfo.textContent = A.live ? `Analysing: ${A.live.label} (${(actx?.sampleRate || 48000) / 1000} kHz sample rate). Levels are relative to full scale; enter a calibration offset after measuring a known signal to read absolute levels.` : 'Waiting for permission…';
  }
  srcSeg.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.src === A.src));
}
let srcSeg;

export function initSpectrum(el) {
  root = el;
  cv = h('canvas', { class: 'spec-cv', 'aria-label': 'Spectrum display. Click to place a marker, shift-click for a delta marker.' });
  wf = h('canvas', { class: 'spec-wf', width: 1024, height: 140 });
  wfx = wf.getContext('2d');
  readout = h('div', { class: 'spec-readout mono small' });
  paramBox = h('div', { class: 'spec-params' });
  lessonEl = h('div', { class: 'callout spec-lesson' });
  srcInfo = h('p', { class: 'small muted' });
  srcSeg = h('div', { class: 'seg' },
    ...[['syn', 'Test signals', 'flask'], ['mic', 'Microphone / line in', 'mic'], ['tab', 'Browser tab audio', 'external']].map(([k, l, ic]) => h('button', { 'data-src': k, onclick: () => setSrc(k) }, h('span', { html: icon(ic) }), h('span', {}, l))));
  const pick = (e, delta) => {
    if (!A.last) return;
    const r = cv.getBoundingClientRect(), n = A.last.trace.length;
    let b = Math.max(0, Math.min(n - 1, binOfX(e.clientX - r.left, r.width, n)));
    // snap to the local peak within ±3 bins
    for (let i = Math.max(0, b - 3); i <= Math.min(n - 1, b + 3); i++) if (A.last.trace[i] > A.last.trace[b]) b = i;
    if (delta && A.markers.length) A.markers[1] = { bin: b }; else A.markers = [{ bin: b }];
    draw();
  };
  cv.addEventListener('click', (e) => pick(e, e.shiftKey));
  const ctl = (lab, node) => h('label', { class: 'rt-field' }, h('span', { class: 'rt-lab' }, lab), node);
  const cal = h('input', { type: 'number', value: 0, step: 0.1 }); cal.oninput = () => { A.cal = parseFloat(cal.value) || 0; resetTraces(); };
  const holdBtn = h('button', { class: 'btn small', onclick: () => { A.hold = !A.hold; A.holdBuf = null; holdBtn.classList.toggle('active', A.hold); } }, 'Max hold');
  const pauseBtn = h('button', { class: 'btn small', onclick: () => { A.paused = !A.paused; pauseBtn.textContent = A.paused ? 'Run' : 'Pause'; } }, 'Pause');
  const peakBtn = h('button', { class: 'btn small', onclick: () => {
    if (!A.last) return; const t = A.last.trace; let pk = 1; for (let i = 1; i < t.length; i++) if (t[i] > t[pk]) pk = i;
    if (!A.markers.length) A.markers = [{ bin: pk }];
    else { let nx = -1; for (let i = 1; i < t.length - 1; i++) if (t[i] > t[i - 1] && t[i] >= t[i + 1] && Math.abs(i - pk) > 4 && (nx < 0 || t[i] > t[nx])) nx = i; A.markers = [{ bin: pk }, { bin: nx > 0 ? nx : pk }]; }
    draw();
  } }, 'Peak search');
  root.append(
    h('div', { class: 'row spread' }, srcSeg, h('div', { class: 'row' }, peakBtn, holdBtn, h('button', { class: 'btn small ghost', onclick: () => { A.markers = []; draw(); } }, 'Clear markers'), pauseBtn)),
    srcInfo,
    h('div', { class: 'spec-layout' },
      h('div', { class: 'spec-main' }, cv, wf, h('p', { class: 'tiny muted' }, 'Click the trace to place a marker; shift-click (or use Peak search twice) for a delta marker. Amber trace: max hold.')),
      h('div', { class: 'spec-side' }, readout,
        h('div', { class: 'spec-ctl' },
          ctl('FFT size', sel(A.N, [1024, 2048, 4096, 8192, 16384, 32768, 65536], (v) => { A.N = +v; resetTraces(); A.markers = []; })),
          ctl('Window', sel(A.win, Object.keys(WINDOWS), (v) => { A.win = v; resetTraces(); })),
          ctl('Averaging', sel(A.avg, [[1, 'Off'], [4, '4'], [16, '16'], [64, '64']], (v) => { A.avg = +v; resetTraces(); })),
          ctl('Reference level', sel(A.top, [10, 0, -10, -20, -30, -40], (v) => { A.top = +v; })),
          ctl('Display range', sel(A.range, [[60, '60 dB'], [80, '80 dB'], [100, '100 dB'], [120, '120 dB'], [140, '140 dB']], (v) => { A.range = +v; })),
          ctl('Calibration offset (dB)', cal)),
        paramBox)),
    lessonEl);
  renderControls();
  // run only while the RF tools tab is visible
  let timer = null;
  const run = () => { if (!timer) timer = setInterval(step, 70); };
  const halt = () => { clearInterval(timer); timer = null; };
  bus.on('tab', (t) => (t === 'rftools' ? run() : halt()));
  if (document.body.dataset.tab === 'rftools') run();
  bus.on('spectrum-src', (node, label) => analyzeNode(node, label));
}
