// Transceiver front panel, panadapter/waterfall and the receive audio chain.
import { S, save, addXp } from './state.js';
import { h, $, $$, clamp, fmtFreq, bus, now, toast, rand, chance, db2amp } from './util.js';
import { BANDS, bandOf, bandByName, privilegeMap, CTCSS, SIDEBAND_FOR } from './data/bandplan.js';
import { audio } from './audio.js';
import { world, player, phone } from './world.js';
import { rigStatus } from './shack.js';
import { system, ANT_TYPES } from './antenna.js';
import { bandNoiseDbm, sUnits, distanceKm, bearing } from './propagation.js';
import { elmer } from './elmer.js';
import { ui as opUi, txState } from './operating.js';
import { net } from './net.js';
import { owns, maxPower } from './store.js';
import { serviceOf, SERVICE_REGIONS } from './services.js';
import { RW, WX_CHANNELS, HEAR } from './realworld.js';
import { hashStr } from './util.js';
const regionOf = (hz) => bandOf(hz) || serviceOf(hz);

const R = () => S.radio;
let wf, wfCtx, spec, meterCv, lcd, panel;
let agc = 1;
let lastSmeter = -127;
export const rx = { strongest: null, decoder: '', smeterDbm: -127, noiseDbm: -130 };

export const dialHz = () => R().freq + (R().ritOn ? R().rit : 0);

export function setFreq(hz, opts = {}) {
  const r = R();
  const old = bandOf(r.freq), oldReg = regionOf(r.freq);
  r.freq = Math.round(clamp(hz, 0.5e6, 470e6));
  const nb = bandOf(r.freq);
  const nr = regionOf(r.freq);
  if (!nb && nr && (!oldReg || oldReg.name !== nr.name)) {
    // entering a non-ham service region: pick its natural mode and tuning step
    if (oldReg) r.lastByBand[oldReg.name] = { f: prevFreq, mode: r.mode };
    if (opts.mode) r.mode = opts.mode; else if (!opts.keepMode) r.mode = nr.mode;
    r.step = nr.step;
    applyMode();
  }
  if (nb && (!old || old.name !== nb.name)) {
    if (old) r.lastByBand[old.name] = { f: hzOld(old), mode: r.mode };
    if (!opts.keepMode) {
      const last = r.lastByBand[nb.name];
      if (last && opts.fromBand) { r.freq = last.f; r.mode = last.mode; }
      else if (opts.fromBand) r.mode = nb.defMode;
    }
    if (nb.name === '2m' && r.mode !== 'FM' && opts.fromBand) r.mode = 'FM';
    applyMode();
  }
  world.setFreq(r.freq);
  save();
  updateDisplay();
}
let prevFreq = R().freq;
function hzOld(b) { return prevFreq >= b.lo && prevFreq <= b.hi ? prevFreq : b.def; }

export function setMode(m) {
  R().mode = m;
  applyMode();
  if ((m === 'USB' || m === 'LSB') && m !== SIDEBAND_FOR(R().freq)) elmer('sideband');
  save(); updateDisplay();
}
function applyMode() {
  const r = R();
  audio.setMode(r.mode, r.filter[r.mode], r.pitch);
  for (const id of [...audio.voices.keys()]) audio.remove(id);
}

// ------------------------------------------------------------------ receive chain
bus.on('station-tx', (st) => {
  if (!audio.ready || !rigStatus().powered) return;
  if (st.band !== world.band) return;
  const off = st.freq - dialHz();
  const span = R().mode === 'WFM' || st.mode === 'WFM' ? 150000 : R().mode === 'FM' || st.mode === 'FM' ? 15000 : 6000;
  if (Math.abs(off) > span) return;
  const tx = st.tx;
  if (tx.kind === 'peervoice' || tx.kind === 'stream') return;
  const start = audio.t + Math.max(0, tx.start - now());
  if (tx.kind === 'cw' || tx.kind === 'cwtone' || tx.kind === 'amtone' || tx.kind === 'fmtone') audio.cw(st.id, tx.sch.segs, start, Math.max(20, toneFor(st)));
  else audio.babble(st.id, start, tx.end - tx.start, 700);
  tx.heard = false;
});

function toneFor(st) {
  const r = R(), d = dialHz();
  if (st.tx && st.tx.kind === 'cwtone') return r.mode === 'FM' ? 1000 : -1;
  if (st.tx && st.tx.kind === 'fmtone') return (r.mode === 'FM' || r.mode === 'WFM') && Math.abs(st.freq - d) < 7000 ? st.tx.tone : -1;
  if (st.tx && st.tx.kind === 'amtone') {
    const tn = st.tx.tone, off = st.freq - d;
    return r.mode === 'AM' ? (Math.abs(off) < 4000 ? tn : -1) : r.mode === 'USB' ? tn + off : r.mode === 'LSB' ? tn - off : r.mode === 'CW' ? r.pitch + off : -1;
  }
  switch (r.mode) {
    case 'CW': return r.pitch + (st.freq - d);
    case 'USB': return st.freq - d;
    case 'LSB': return d - st.freq;
    case 'AM': return Math.abs(st.freq - d) + 10;
    default: return -1;
  }
}

function inPassband(tone) {
  const r = R(), w = r.filter[r.mode];
  if (r.mode === 'CW') return Math.abs(tone - r.pitch) < w / 2 + 40;
  if (r.mode === 'AM') return tone > 50 && tone < w / 2;
  return tone > 200 && tone < 250 + w;
}

// Called ~10x per second.
export function rxUpdate() {
  if (!audio.ready) return;
  const rs = rigStatus();
  const r = R();
  const transmitting = txState.active;
  if (!rs.powered || transmitting) {
    audio.setNoise(0);
    audio.muteStreams();
    for (const [id] of audio.voices) audio.setVoice(id, { rms: 0 });
    if (net.peerGains) for (const p of net.peerGains()) p.gain.gain.setTargetAtTime(0, audio.t, 0.02);
    rx.smeterDbm = -127;
    return;
  }
  audio.setAF(r.af);
  const d = dialHz(), f = d / 1e6;
  const att = r.rfAtt;
  const sys = rs.antennaOk ? system(d) : null;
  let nf = -132;
  if (rs.antennaOk && sys) nf = Math.max(-132, bandNoiseDbm(f, player()) + sys.effDb - sys.totalLoss);
  nf -= att;
  nf = Math.max(nf, -132);
  const bw = r.mode === 'CW' ? r.filter.CW : r.mode === 'FM' ? 12000 : r.mode === 'WFM' ? 150000 : r.mode === 'AM' ? r.filter.AM / 2 : r.filter[r.mode];
  const nBW = nf + 10 * Math.log10(bw / 2400);
  rx.noiseDbm = nf;
  const NREF = 0.1;
  let maxRms = NREF, strongest = null, strongDbm = -200;
  const sigs = [];
  const t = now();
  for (const st of world.stations) {
    if (!st.tx || t > st.tx.end + 0.3 || t < st.tx.start - 0.2) continue;
    const dbm = world.rxDbm(st) - att;
    const off = st.freq - d;
    let tone = toneFor(st), audible = false, intelligible = false;
    const ao = Math.abs(off), fmRx = r.mode === 'FM' || r.mode === 'WFM';
    if (st.tx.kind === 'stream') {
      // real broadcast audio: AM needs AM (or SSB, tuned close); WFM needs a wide FM receiver
      if (st.mode === 'AM') { audible = !fmRx && ao < (r.mode === 'AM' ? r.filter.AM / 2 + 800 : 3200); intelligible = r.mode === 'AM' ? ao < 2500 : ao < 150; }
      else { audible = (r.mode === 'WFM' && ao < 110000) || (r.mode === 'FM' && ao < 60000); intelligible = r.mode === 'WFM' && ao < 70000; }
    } else if (st.tx.kind === 'amtone' || st.tx.kind === 'fmtone') {
      audible = tone > 0 && (r.mode === 'CW' ? inPassband(tone) : tone < 3500);
      audio.setVoice(st.id, { tone });
    } else if (st.mode === 'AM') {
      audible = !fmRx && ao < 6000;
      intelligible = (r.mode === 'AM' && ao < 2500) || ((r.mode === 'USB' || r.mode === 'LSB') && ao < 300);
      audio.setVoice(st.id, { tone: 700 + off / 8 });
    } else if (st.mode === 'CW' || st.tx.kind === 'cwtone') {
      audible = tone > 0 && inPassband(tone);
      if (st.tx.kind === 'cwtone') audible = r.mode === 'FM' && Math.abs(off) < 7000;
      audio.setVoice(st.id, { tone });
    } else if (st.mode === 'FM') {
      audible = fmRx ? ao < 9000 : ao < 8000;
      intelligible = fmRx && ao < 4000;
      audio.setVoice(st.id, { tone: 700 + off / 10 });
    } else {
      // SSB voice: audio is shifted by the tuning error; wrong sideband = inverted garble
      const sameSb = r.mode === st.sb || r.mode === 'AM';
      const shift = r.mode === 'USB' ? off : r.mode === 'LSB' ? -off : r.mode === 'CW' ? r.pitch + off - 1200 : Math.abs(off);
      const center = r.mode === 'CW' ? r.pitch + off + (st.sb === 'USB' ? 1200 : -1200)
        : (st.sb === 'USB' ? 1 : -1) * (r.mode === 'LSB' ? -1 : 1) * 1200 + shift;
      audible = r.mode !== 'FM' && center > 150 && center < 3100;
      intelligible = sameSb && r.mode !== 'CW' && Math.abs(off) < 350;
      audio.setVoice(st.id, { tone: clamp(center * 0.6, 150, 3000) });
    }
    const snr = dbm - nBW;
    sigs.push({ st, dbm, snr, audible, intelligible, off });
    if (audible) {
      const rms = NREF * db2amp(snr);
      if (rms > maxRms) maxRms = rms;
      if (dbm > strongDbm) { strongDbm = dbm; strongest = { st, snr, intelligible, off, dbm }; }
    }
  }
  // network peers (other players)
  const peerSigs = net.signals ? net.signals(d, r.mode, att, nBW) : [];
  for (const p of peerSigs) if (p.audible) { const rms = NREF * db2amp(p.snr); if (rms > maxRms) maxRms = rms; if (p.dbm > strongDbm) strongDbm = p.dbm; }

  // FM squelch & limiter quieting
  let noiseRms = NREF;
  let open = true;
  if (r.mode === 'FM' || r.mode === 'WFM') {
    const thr = -6 + r.sql * 26;
    const best = strongest ? strongest.snr : -50;
    const peerBest = Math.max(-50, ...peerSigs.filter((p) => p.audible).map((p) => p.snr));
    const b = Math.max(best, peerBest);
    open = r.mode === 'WFM' || r.sql < 0.02 || b > thr;
    noiseRms = open ? 0.22 * clamp(db2amp(-Math.max(0, b) * 0.9), 0.01, 1) : 0;
  }
  // AGC (fast attack, slow decay)
  const target = clamp(0.28 / maxRms, 0.02, 1);
  agc = target < agc ? target : agc + (target - agc) * 0.08;
  audio.setNoise(noiseRms * agc * (r.nr && owns('dsp') ? 0.55 : 1));
  for (const s of sigs) {
    let rms = s.audible && open ? NREF * db2amp(s.snr) * agc : 0;
    if ((r.mode === 'FM' || r.mode === 'WFM') && (s.st.mode === 'FM' || s.st.mode === 'WFM') && s.audible) rms = open ? 0.25 : 0;
    if (s.st.tx.kind === 'stream') {
      const lvl = s.audible && open ? clamp((s.intelligible ? 1 : 0.35) * (s.st.mode === 'WFM' ? clamp((s.snr - 3) / 12, 0, 1) * 1.2 : NREF * db2amp(s.snr) * agc / 0.12), 0, 1.5) : 0;
      if (lvl > 0.01 && !s.st.dead) { const rec = audio.stream(s.st.id, s.st.url); if (rec.dead) s.st.dead = true; }
      audio.streamLevel(s.st.id, lvl, r.af);
      if (lvl > 0.01 && S.settings.subtitles && s.st.lastSub !== s.st.id) { s.st.lastSub = s.st.id; opUi.transcript(s.st.op.call, `📻 ${s.st.op.name} — live${s.st.dead ? ' (stream unavailable)' : ''}`, 'rx'); }
      s.st.rxSnrRecent = s.snr;
      continue;
    }
    if (s.intelligible && s.snr > -1 && s.st.tx.kind === 'voice') {
      rms *= 0.06; // the TTS voice carries the intelligible audio
      speakIfNeeded(s, open ? (r.mode === 'FM' ? 0.9 : clamp(db2amp(s.snr) * agc * 0.35, 0.05, 1)) : 0);
    }
    audio.setVoice(s.st.id, { rms });
    s.st.rxSnrRecent = s.snr;
  }
  for (const p of peerSigs) p.node.gain.setTargetAtTime(p.audible && open ? clamp(db2amp(p.snr) * agc * 0.3, 0, 1.4) : 0, audio.t, 0.05);
  // QRN static crashes on the low bands
  // (real thunderstorms nearby — from the live weather — make it much worse)
  const qrn = (f < 2.5 ? 0.08 : f < 5 ? 0.05 : f < 8 ? 0.025 : f < 15 ? 0.006 : 0) * (RW.wx?.storm ? 4 : 1);
  if (rs.antennaOk && r.mode !== 'FM' && r.mode !== 'WFM' && chance(qrn)) audio.crash(NREF * agc * rand(2, 8));
  audio.streamGC();
  // S-meter
  const sm = Math.max(nf, strongDbm);
  lastSmeter = sm > lastSmeter ? sm : lastSmeter + (sm - lastSmeter) * 0.25;
  rx.smeterDbm = lastSmeter;
  rx.strongest = strongest;
  updateDecoder(strongest);
}

function speakIfNeeded(s, vol) {
  const tx = s.st.tx;
  if (tx.heard || !tx.say) return;
  if (now() - tx.start > 1.5) return;
  tx.heard = true;
  tx.speaking = true;
  const st = s.st;
  const pitch = clamp(st.pitch + s.off / 450 * (R().mode === 'LSB' ? -1 : 1), 0.2, 2);
  audio.speak(tx.say, { lang: st.op.lang, seed: st.seed, rate: (st.rate || 1) * (S.settings.ttsRate || 1), pitch, volume: vol }).then(() => {
    tx.speaking = false; tx.end = Math.min(tx.end, now());
    if (tx.courtesy) courtesy();
  });
  setTimeout(() => { tx.speaking = false; }, 25000);
  if (S.settings.subtitles) opUi.transcript(st.call === 'beacon' ? '' : (st.speaker ? st.speaker.call : st.call), tx.show, 'rx');
}

function courtesy() { if (R().mode === 'FM') { audio.beep(880, 0.08, 0.12, 0.25); audio.beep(660, 0.1, 0.12, 0.36); } }
bus.on('courtesy', () => { if (R().mode === 'FM' && Math.abs(R().freq - 146940000) < 5000) courtesy(); });

// CW decoder: locks onto the strongest CW signal in the passband.
let decState = { id: null, idx: 0, txStart: 0, text: '', call: '', end: 0 };
function flushDecoder() {
  if (decState.text.trim() && S.settings.subtitles) opUi.transcript(decState.call, decState.text.trim(), 'rx', null, 'CW decoder');
  decState.text = '';
}
function updateDecoder(s) {
  if (!S.settings.decoder) return;
  if (decState.text && now() > decState.end + 0.6) flushDecoder();
  if (!s || !(s.st.mode === 'CW') || !s.st.tx || !s.st.tx.sch || R().mode === 'FM') return;
  const tx = s.st.tx;
  if (decState.id !== s.st.id || decState.txStart !== tx.start) {
    flushDecoder();
    decState = { id: s.st.id, idx: 0, txStart: tx.start, text: '', call: s.st.call, end: tx.end };
    rx.decoder += ' ';
  }
  const el = now() - tx.start;
  const chars = tx.sch.chars;
  let out = '';
  while (decState.idx < chars.length && chars[decState.idx].t <= el) {
    let c = chars[decState.idx].c;
    const pErr = clamp((4 - s.snr - (R().nr && owns('dsp') ? 3 : 0)) / 14, 0, 0.6);
    if (c !== ' ' && Math.random() < pErr) c = 'ETIANMSURWDKGOH'[Math.floor(Math.random() * 15)];
    out += c.length > 1 ? `<${c}>` : c;
    decState.idx++;
  }
  if (out) { decState.text += out; rx.decoder = (rx.decoder + out).slice(-220); opUi.decoder(rx.decoder); }
}

// ------------------------------------------------------------------ panel UI
export function initRadioUI(el) {
  panel = el;
  el.innerHTML = '';
  const r = R();
  lcd = h('div', { class: 'lcd-panel' });
  meterCv = h('canvas', { width: 300, height: 120, class: 'meter' });
  meterCv.onclick = () => { r.meter = { S: 'PO', PO: 'SWR', SWR: 'S' }[r.meter] || 'S'; save(); };
  wf = h('canvas', { width: 900, height: 300, class: 'waterfall', title: 'Click to tune' });
  wfCtx = wf.getContext('2d');
  wf.addEventListener('click', onWfClick);
  wf.addEventListener('wheel', (e) => { e.preventDefault(); tuneBy(Math.sign(e.deltaY) * -1); }, { passive: false });

  const knob = h('div', { class: 'vfo-knob', title: 'Drag or scroll to tune' }, h('div', { class: 'dimple' }));
  let drag = null;
  knob.addEventListener('pointerdown', (e) => { drag = { a: angle(e, knob) }; knob.setPointerCapture(e.pointerId); });
  knob.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const a = angle(e, knob);
    let d = a - drag.a; if (d > 180) d -= 360; if (d < -180) d += 360;
    if (Math.abs(d) >= 6) { tuneBy(Math.round(d / 6)); drag.a = a; knobRot += d; knob.style.transform = `rotate(${knobRot}deg)`; }
  });
  knob.addEventListener('pointerup', () => { drag = null; });
  knob.addEventListener('wheel', (e) => { e.preventDefault(); const n = -Math.sign(e.deltaY); tuneBy(n); knobRot += n * 12; knob.style.transform = `rotate(${knobRot}deg)`; }, { passive: false });

  const bandBtns = h('div', { class: 'btn-grid bands' }, ...BANDS.map((b) => h('button', { class: 'rbtn', 'data-band': b.name, onclick: () => { prevFreq = R().freq; const last = R().lastByBand[b.name]; setFreq(last ? last.f : b.def, { fromBand: true }); } }, b.name)));
  const modeBtns = h('div', { class: 'btn-grid modes' }, ...['LSB', 'USB', 'CW', 'AM', 'FM', 'WFM'].map((m) => h('button', { class: 'rbtn', 'data-mode': m, onclick: () => setMode(m) }, m)));
  const stepSel = h('select', { class: 'rsel', title: 'Tuning step' }, ...[10, 50, 100, 500, 1000, 5000, 10000].map((s) => h('option', { value: s, selected: s === r.step }, s >= 1000 ? `${s / 1000} kHz` : `${s} Hz`)));
  stepSel.onchange = () => { r.step = +stepSel.value; save(); };
  const freqIn = h('input', { class: 'rsel', placeholder: 'kHz ↵', size: 9, title: 'Type a frequency in kHz and press Enter' });
  freqIn.onkeydown = (e) => { if (e.key === 'Enter') { const v = parseFloat(freqIn.value); if (v > 1000) { prevFreq = R().freq; setFreq(v * 1000); freqIn.value = ''; freqIn.blur(); } } };

  const slider = (label, min, max, step, val, fn, fmt = (v) => v) => {
    const out = h('span', { class: 'val' }, fmt(val));
    const i = h('input', { type: 'range', min, max, step, value: val });
    i.oninput = () => { fn(+i.value); out.textContent = fmt(+i.value); save(); };
    return h('label', { class: 'knobrow' }, h('span', {}, label), i, out);
  };
  const filterSel = h('select', { class: 'rsel', id: 'filter-sel' });
  const fillFilters = () => {
    const opts = { CW: owns('cwfilter') ? [250, 400, 500, 800, 1200, 2400] : [500, 800, 1200, 2400], USB: [1800, 2100, 2400, 2700, 3000], LSB: [1800, 2100, 2400, 2700, 3000], AM: [3000, 6000, 9000], FM: [12000], WFM: [150000] }[r.mode];
    filterSel.innerHTML = '';
    for (const w of opts) filterSel.append(h('option', { value: w, selected: w === r.filter[r.mode] }, w >= 1000 ? `${w / 1000} kHz` : `${w} Hz`));
  };
  filterSel.onchange = () => { r.filter[r.mode] = +filterSel.value; applyMode(); save(); updateDisplay(); };
  panel.fillFilters = fillFilters;

  const atuBtn = h('button', { class: 'rbtn', id: 'atu-btn', onclick: () => { r.atuOn = !r.atuOn; save(); updateDisplay(); } }, 'ATU');
  const tuneBtn = h('button', { class: 'rbtn warnb', onclick: atuTune, title: 'Transmit a low-power carrier and let the automatic tuner find a match' }, 'TUNE');
  const attBtn = h('button', { class: 'rbtn', id: 'att-btn', onclick: () => { r.rfAtt = r.rfAtt ? 0 : 12; save(); updateDisplay(); } }, 'ATT');
  const ritBtn = h('button', { class: 'rbtn', id: 'rit-btn', onclick: () => { r.ritOn = !r.ritOn; save(); updateDisplay(); } }, 'RIT');
  const ritSl = h('input', { type: 'range', min: -2000, max: 2000, step: 10, value: r.rit });
  ritSl.oninput = () => { r.rit = +ritSl.value; save(); updateDisplay(); };
  ritSl.ondblclick = () => { r.rit = 0; ritSl.value = 0; save(); updateDisplay(); };

  const rptSel = h('select', { class: 'rsel' }, ...[[0, 'Simplex'], [-600000, '− 600 kHz'], [600000, '+ 600 kHz']].map(([v, l]) => h('option', { value: v, selected: v === r.rptOffset }, l)));
  rptSel.onchange = () => { r.rptOffset = +rptSel.value; save(); updateDisplay(); };
  const toneSel = h('select', { class: 'rsel' }, ...CTCSS.map((t) => h('option', { value: t, selected: t === r.toneHz }, t ? `${t.toFixed(1)} Hz` : 'Tone off')));
  toneSel.onchange = () => { r.toneHz = +toneSel.value; save(); updateDisplay(); };

  const rotator = h('div', { id: 'rotator' });

  const mtuner = h('div', { id: 'mtuner' });

  el.append(h('div', { class: 'rig' },
    h('div', { class: 'rig-top' },
      h('div', { class: 'rig-left' }, meterCv, h('div', { class: 'muted tiny center' }, 'click meter: S / PO / SWR')),
      lcd,
      h('div', { class: 'rig-right' }, knob, h('div', { class: 'row center' }, stepSel, freqIn)),
    ),
    h('div', { class: 'rig-mid' }, h('div', { class: 'wf-wrap' }, wf)),
    h('div', { class: 'rig-controls' },
      h('div', { class: 'ctl-group' }, h('div', { class: 'ctl-title' }, 'HAM BANDS'), bandBtns,
        h('div', { class: 'ctl-title', style: { marginTop: '8px' } }, 'GENERAL COVERAGE (RX)'), serviceButtons()),
      h('div', { class: 'ctl-group' }, h('div', { class: 'ctl-title' }, 'MODE'), modeBtns, h('label', { class: 'knobrow' }, h('span', {}, 'FILTER'), filterSel)),
      h('div', { class: 'ctl-group' }, h('div', { class: 'ctl-title' }, 'AUDIO'),
        slider('AF GAIN', 0, 1, 0.01, r.af, (v) => { r.af = v; }, (v) => Math.round(v * 100)),
        slider('SQL', 0, 1, 0.01, r.sql, (v) => { r.sql = v; }, (v) => Math.round(v * 100)),
        h('div', { class: 'row' }, attBtn, ritBtn, ritSl), owns('dsp') ? h('button', { class: `rbtn ${r.nr ? 'active' : ''}`, onclick: (e) => { r.nr = !r.nr; e.target.classList.toggle('active', r.nr); save(); } }, 'NR (DSP)') : null),
      h('div', { class: 'ctl-group' }, h('div', { class: 'ctl-title' }, 'TRANSMIT'),
        slider('POWER', 5, maxPower(), 5, Math.min(r.power, maxPower()), (v) => { r.power = v; if (v <= 25) elmer('power_min'); }, (v) => `${v} W`),
        h('div', { class: 'row' }, atuBtn, tuneBtn),
        h('div', { class: 'fm-only' }, h('label', { class: 'knobrow' }, h('span', {}, 'OFFSET'), rptSel), h('label', { class: 'knobrow' }, h('span', {}, 'CTCSS'), toneSel)),
        rotator, mtuner),
    ),
  ));
  fillFilters();
  updateDisplay();
  bus.on('antenna', updateDisplay);
  bus.on('shack', updateDisplay);
  bus.on('license', updateDisplay);
}
// One-touch presets for the non-ham services (receive only).
function serviceButtons() {
  const go = (f, m) => { prevFreq = R().freq; setFreq(f, { mode: m }); setMode(m); };
  const lastIn = (name, def) => R().lastByBand[name]?.f || def;
  const P = [
    ['AM BC', () => go(lastIn('MW', 1000e3), 'AM'), 'AM broadcast 530–1700 kHz (real stations)'],
    ['WWV', () => go(10e6, 'AM'), 'WWV/WWVH time signals on 10 MHz'],
    ['FM BC', () => go(lastIn('FM', 98.1e6), 'WFM'), 'FM broadcast 88–108 MHz (real stations)'],
    ['AIR', () => { const ap = RW.airports[0]; const tw = ap?.freqs.find((x) => /TWR/i.test(x.type)) || ap?.freqs[0]; go(tw ? Math.round(tw.mhz * 1e6) : 121.5e6, 'AM'); }, 'Airband: nearest airport tower'],
    ['NOAA WX', () => go(WX_CHANNELS[hashStr(RW.nws?.office || 'NWS') % 7], 'FM'), 'NOAA Weather Radio'],
    ['EMS', () => go(HEAR, 'FM'), 'HEAR ambulance ↔ hospital (155.340)'],
  ];
  return h('div', { class: 'btn-grid bands' }, ...P.map(([l, fn, t]) => h('button', { class: 'rbtn svc', title: t, onclick: fn }, l)));
}

let knobRot = 0;
const angle = (e, el) => { const b = el.getBoundingClientRect(); return Math.atan2(e.clientY - (b.top + b.height / 2), e.clientX - (b.left + b.width / 2)) * 180 / Math.PI; };

export function tuneBy(n) {
  const r = R();
  prevFreq = r.freq;
  const sv = serviceOf(r.freq);
  const step = sv ? Math.max(r.step, sv.mode === 'WFM' ? 100000 : sv.name === 'AIR' ? 5000 : 1000) : r.mode === 'FM' && r.step < 5000 ? 5000 : r.step;
  setFreq(Math.round((r.freq + n * step) / step) * step);
  if (!S.tips.includes('first_listen')) elmer('first_listen');
}

function onWfClick(e) {
  const r = R();
  const span = spanHz();
  const x = e.offsetX / wf.clientWidth;
  let f = r.freq - span / 2 + x * span;
  // snap to a nearby signal
  let best = null, bd = r.mode === 'CW' ? 400 : r.mode === 'WFM' ? 120000 : serviceOf(f) ? 6000 : 1500;
  for (const st of world.stations) {
    const d = Math.abs(st.freq - f);
    if (d < bd && st.role !== 'caller') { bd = d; best = st; }
  }
  if (best && ((r.mode === 'CW') === (best.mode === 'CW') || serviceOf(f))) f = best.freq;
  else f = Math.round(f / (r.mode === 'CW' ? 10 : r.mode === 'FM' ? 5000 : 100)) * (r.mode === 'CW' ? 10 : r.mode === 'FM' ? 5000 : 100);
  prevFreq = r.freq;
  setFreq(f);
}

const spanHz = () => { const sv = serviceOf(R().freq); if (sv) return sv.span; return R().mode === 'FM' || world.band === '2m' ? 200000 : 24000; };

// ------------------------------------------------------------------ ATU
function atuTune() {
  const rs = rigStatus(), r = R();
  if (!rs.powered) return toast('Turn the radio on first (Shack tab).', 'warn');
  if (rs.end === 'open') { elmer('no_antenna', true); return toast('ATU: no load connected! "HI SWR" — the tuner refuses to tune into an open connector.', 'bad'); }
  const txf = r.freq;
  if (rs.end === 'antenna') {
    const chk = opUi.legal(txf, 'CW');
    if (!chk.ok) return toast(`Tuning is transmitting! ${chk.reason}`, 'bad');
  }
  const sys = rs.end === 'antenna' ? system(txf) : null;
  const swr = sys ? sys.swrRig : 1.0;
  txState.flash(1.2, 'TUNE');
  audio.beep(1500, 0.03, 0.05);
  setTimeout(() => {
    if (swr <= 3.0) {
      r.atuOn = true; r.atuTunedFreq = txf; save();
      toast(`ATU tuned: SWR ${swr.toFixed(1)}:1 → 1.1:1 at ${(txf / 1e6).toFixed(3)} MHz.`, 'good');
      elmer('atu');
    } else {
      toast(`ATU: tune failed — SWR ${swr > 50 ? '>50' : swr.toFixed(1)}:1 is beyond the internal tuner's 3:1 range.${rs.hasTuner ? ' Try the external manual tuner.' : ''} Is your antenna built for this band?`, 'bad');
      elmer('swr_high');
    }
    updateDisplay();
  }, 1200);
}

// Manual (external) tuner: find the TUNE/LOAD settings that null the SWR.
function mtOptimum(f) {
  const a = S.antenna, k = (a.length || 1) * 0.37 + a.feedLen * 0.11;
  return { t: 50 + 40 * Math.sin(f / 1e6 * 0.53 + k), l: 50 + 40 * Math.cos(f / 1e6 * 0.29 + k * 1.7) };
}
export function manualTunerSwr(f, swrRig) {
  const m = S.radio.mt || { t: 50, l: 50 };
  const o = mtOptimum(f);
  const d = Math.hypot(m.t - o.t, m.l - o.l);
  const floor = swrRig > 12 ? 1 + (swrRig - 12) * 0.2 : 1.05;
  return Math.min(swrRig * (1 + d / 25) + 1, floor + d * d * 0.012 * Math.max(1, swrRig / 2));
}

// Effective SWR the rig's final amplifier sees.
export function effectiveSwr(f) {
  const rs = rigStatus(), r = R();
  if (rs.end === 'dummy') return 1.0;
  if (rs.end !== 'antenna') return 999;
  const sys = system(f);
  if (!sys) return 999;
  let swr = sys.swrRig;
  if (rs.hasTuner && !r.mtBypass) swr = manualTunerSwr(f, swr);
  if (r.atuOn && r.atuTunedFreq && Math.abs(f - r.atuTunedFreq) < Math.max(8000, f * 0.005) && swr <= 3.05) swr = 1.1 + (swr - 1) * 0.04;
  return swr;
}

// ------------------------------------------------------------------ display
export function updateDisplay() {
  if (!lcd) return;
  const r = R(), rs = rigStatus();
  const band = bandOf(r.freq);
  const txf = r.mode === 'FM' ? r.freq + r.rptOffset : r.freq;
  const swr = rs.powered ? effectiveSwr(r.freq) : 0;
  lcd.className = 'lcd-panel' + (rs.powered ? ' on' : '');
  lcd.innerHTML = rs.powered ? `
    <div class="lcd-row small"><span>VFO-A</span><span>${band ? band.name : serviceOf(r.freq)?.label || 'GEN'}</span><span class="${r.atuOn ? 'hl' : 'dim'}">ATU${r.atuOn && r.atuTunedFreq && Math.abs(r.freq - r.atuTunedFreq) < Math.max(8000, r.freq * 0.005) ? '✓' : ''}</span><span class="${r.rfAtt ? 'hl' : 'dim'}">ATT</span><span>${r.power}W</span><span id="lcd-tx" class="dim">TX</span></div>
    <div class="lcd-freq">${fmtFreq(r.freq)}<span class="unit">MHz</span></div>
    <div class="lcd-row"><span class="mode">${r.mode}</span><span>FIL ${r.filter[r.mode] >= 1000 ? (r.filter[r.mode] / 1000) + 'k' : r.filter[r.mode]}</span>
      <span class="${r.ritOn ? 'hl' : 'dim'}">RIT ${r.rit >= 0 ? '+' : ''}${(r.rit / 1000).toFixed(2)}</span>
      ${r.mode === 'FM' ? `<span>${r.rptOffset ? (r.rptOffset < 0 ? '−' : '+') + 'SHIFT' : 'SIMP'}</span><span>${r.toneHz ? 'T ' + r.toneHz.toFixed(1) : ''}</span>` : ''}
      <span>SWR ${swr > 50 ? '∞' : swr.toFixed(1)}</span></div>
    <div class="lcd-row small"><span>${rs.end === 'antenna' ? (S.antenna.built ? ANT_TYPES[S.antenna.type].label.split('(')[0] : 'NO ANTENNA UP') : rs.end === 'dummy' ? 'DUMMY LOAD' : 'ANT: OPEN'}</span>
      ${r.mode === 'FM' && r.rptOffset ? `<span>TX ${(txf / 1e6).toFixed(3)}</span>` : ''}</div>`
    : `<div class="lcd-off">${rs.issues[0] || 'OFF'}<br><small>(fix it in the Shack tab)</small></div>`;
  $$('.rbtn[data-band]', panel).forEach((b) => b.classList.toggle('active', band && b.dataset.band === band.name));
  $$('.rbtn[data-mode]', panel).forEach((b) => b.classList.toggle('active', b.dataset.mode === r.mode));
  $('#atu-btn', panel)?.classList.toggle('active', r.atuOn);
  $('#att-btn', panel)?.classList.toggle('active', !!r.rfAtt);
  $('#rit-btn', panel)?.classList.toggle('active', r.ritOn);
  panel.classList.toggle('mode-fm', r.mode === 'FM');
  panel.fillFilters && panel.fillFilters();
  // rotator & manual tuner widgets
  const rot = $('#rotator', panel);
  if (rot) {
    rot.innerHTML = '';
    if (S.antenna.type === 'yagi' && S.antenna.built && owns('rotator')) {
      const i = h('input', { type: 'range', min: 0, max: 359, value: S.antenna.heading });
      const v = h('span', { class: 'val' }, `${S.antenna.heading}°`);
      i.oninput = () => { S.antenna.heading = +i.value; v.textContent = `${i.value}°`; save(); };
      rot.append(h('label', { class: 'knobrow' }, h('span', {}, 'ROTATOR'), i, v));
    }
  }
  const mt = $('#mtuner', panel);
  if (mt) {
    mt.innerHTML = '';
    if (rs.hasTuner) {
      r.mt ||= { t: 50, l: 50 };
      const mk = (k, label) => {
        const i = h('input', { type: 'range', min: 0, max: 100, step: 0.5, value: r.mt[k] });
        i.oninput = () => { r.mt[k] = +i.value; save(); };
        return h('label', { class: 'knobrow' }, h('span', {}, label), i);
      };
      if (r.mtBypass == null) r.mtBypass = true;
      const byp = h('button', { class: `rbtn ${r.mtBypass ? 'active' : ''}`, onclick: () => { r.mtBypass = !r.mtBypass; save(); updateDisplay(); } }, r.mtBypass ? 'BYPASS' : 'IN LINE');
      mt.append(h('div', { class: 'ctl-title' }, 'MANUAL TUNER ', byp), ...(r.mtBypass ? [] : [mk('t', 'TUNE'), mk('l', 'LOAD')]),
        r.mtBypass ? h('div', { class: 'muted tiny' }, 'Tuner bypassed. Put it in line to match antennas the internal ATU can\'t.') : h('div', { class: 'muted tiny' }, 'Hold CARRIER and watch the SWR meter while adjusting TUNE and LOAD for a dip.'),
        r.mtBypass ? '' : h('button', { class: 'rbtn', onpointerdown: () => txState.carrier(true), onpointerup: () => txState.carrier(false), onpointerleave: () => txState.carrier(false) }, '◉ CARRIER'));
    }
  }
}

// ------------------------------------------------------------------ waterfall + meter drawing
let wfBuf = null, wfBufCtx = null, lastWfFreq = null;
function colorFor(v) {
  // v: 0..1
  const stops = [[0, 6, 10, 30], [0.25, 10, 40, 140], [0.5, 30, 170, 200], [0.7, 240, 220, 60], [0.85, 255, 120, 20], [1, 255, 255, 255]];
  for (let i = 1; i < stops.length; i++) if (v <= stops[i][0]) {
    const [a, r0, g0, b0] = stops[i - 1], [b, r1, g1, b1] = stops[i], t = (v - a) / (b - a);
    return [r0 + (r1 - r0) * t, g0 + (g1 - g0) * t, b0 + (b1 - b0) * t];
  }
  return [255, 255, 255];
}

export function drawFrame() {
  if (!wf || !panel.offsetParent) return;
  const W = wf.width, H = wf.height, specH = 90;
  const r = R(), rs = rigStatus();
  const span = spanHz(), f0 = r.freq - span / 2;
  const bins = new Float32Array(W);
  const nf = rx.noiseDbm;
  for (let i = 0; i < W; i++) bins[i] = rs.powered ? nf + (Math.random() - 0.5) * 5 : -140;
  const t = now();
  const addSig = (fc, dbm, kind, sb, keyed) => {
    if (!keyed) return;
    const hzPerBin = span / W;
    let lo, hi;
    if (kind === 'cw') { lo = fc - 20; hi = fc + 20; }
    else if (kind === 'wfm') { lo = fc - 90000; hi = fc + 90000; }
    else if (kind === 'am') { lo = fc - 4500; hi = fc + 4500; }
    else if (kind === 'fm') { lo = fc - 7000; hi = fc + 7000; }
    else if (sb === 'LSB') { lo = fc - 2800; hi = fc - 200; } else { lo = fc + 200; hi = fc + 2800; }
    const a = Math.floor((lo - f0) / hzPerBin), b = Math.ceil((hi - f0) / hzPerBin);
    for (let i = Math.max(0, a); i <= Math.min(W - 1, b); i++) {
      const v = kind === 'voice' ? dbm - 6 - Math.random() * 14 - ((i - a) / (b - a + 1)) * 8 : dbm - (kind === 'fm' ? Math.random() * 3 : 0);
      if (v > bins[i]) bins[i] = v;
    }
  };
  if (rs.powered) {
    for (const st of world.stations) {
      if (!st.tx || t < st.tx.start || t > st.tx.end + (st.tx.speaking ? 3 : 0)) continue;
      if (Math.abs(st.freq - r.freq) > span) continue;
      const dbm = world.rxDbm(st) - r.rfAtt + 10 * Math.log10(2400 / 50) * (st.mode === 'CW' ? 0.3 : 0);
      let keyed = true;
      if (st.tx.sch) { const el = t - st.tx.start; keyed = st.tx.sch.segs.some((s) => el >= s.t0 && el <= s.t1); }
      const kind = st.mode === 'WFM' ? 'wfm' : st.mode === 'AM' && st.tx.kind !== 'amtone' ? 'am' : st.mode === 'CW' || st.tx.kind === 'cwtone' || st.tx.kind === 'amtone' ? 'cw' : st.mode === 'FM' ? 'fm' : 'voice';
      addSig(st.freq, dbm, kind, st.sb, keyed || kind === 'am' || kind === 'wfm');
    }
    if (net.waterfall) for (const p of net.waterfall()) addSig(p.freq, p.dbm, p.kind, p.sb, true);
    if (txState.active) addSig(txState.freq, -40, txState.mode === 'CW' ? 'cw' : txState.mode === 'FM' ? 'fm' : 'voice', txState.mode, txState.keyed);
  }
  // scroll waterfall (kept in an offscreen buffer so overlays don't smear)
  if (!wfBuf) { wfBuf = document.createElement('canvas'); wfBuf.width = W; wfBuf.height = H - specH; wfBufCtx = wfBuf.getContext('2d'); wfBufCtx.fillStyle = '#05080d'; wfBufCtx.fillRect(0, 0, W, H); }
  if (lastWfFreq != null && lastWfFreq !== r.freq) {
    const dx = Math.round(((lastWfFreq - r.freq) / span) * W);
    if (Math.abs(dx) < W) { const tmp = wfBufCtx.getImageData(0, 0, W, wfBuf.height); wfBufCtx.fillStyle = '#05080d'; wfBufCtx.fillRect(0, 0, W, wfBuf.height); wfBufCtx.putImageData(tmp, dx, 0); }
    else { wfBufCtx.fillStyle = '#05080d'; wfBufCtx.fillRect(0, 0, W, wfBuf.height); }
  }
  lastWfFreq = r.freq;
  wfBufCtx.drawImage(wfBuf, 0, 0, W, wfBuf.height - 1, 0, 1, W, wfBuf.height - 1);
  const row = wfBufCtx.createImageData(W, 1);
  for (let i = 0; i < W; i++) {
    const v = clamp((bins[i] - nf + 3) / 45, 0, 1);
    const [cr, cg, cb] = colorFor(v);
    row.data[i * 4] = cr; row.data[i * 4 + 1] = cg; row.data[i * 4 + 2] = cb; row.data[i * 4 + 3] = 255;
  }
  wfBufCtx.putImageData(row, 0, 0);
  wfCtx.drawImage(wfBuf, 0, specH);
  // spectrum
  wfCtx.fillStyle = '#05080d'; wfCtx.fillRect(0, 0, W, specH);
  const band = bandOf(r.freq);
  const xOf = (f) => ((f - f0) / span) * W;
  if (band) {
    wfCtx.fillStyle = 'rgba(255,60,60,0.15)';
    if (band.lo > f0) wfCtx.fillRect(0, 0, xOf(band.lo), specH);
    if (band.hi < f0 + span) wfCtx.fillRect(xOf(band.hi), 0, W - xOf(band.hi), specH);
    for (const seg of privilegeMap(S.license, band)) {
      wfCtx.fillStyle = seg.allow === 'ALL' ? 'rgba(80,220,120,0.55)' : 'rgba(90,160,255,0.55)';
      wfCtx.fillRect(xOf(seg.lo), specH - 5, xOf(seg.hi) - xOf(seg.lo), 5);
    }
  }
  wfCtx.strokeStyle = '#7fe0ff'; wfCtx.beginPath();
  for (let i = 0; i < W; i++) { const y = specH - 8 - clamp((bins[i] + 135) / 75, 0, 1) * (specH - 14); i ? wfCtx.lineTo(i, y) : wfCtx.moveTo(i, y); }
  wfCtx.stroke();
  // passband overlay
  const d = dialHz(), w = r.filter[r.mode];
  let pl, ph;
  if (r.mode === 'USB') { pl = d + 250; ph = d + 250 + w; } else if (r.mode === 'LSB') { pl = d - 250 - w; ph = d - 250; }
  else if (r.mode === 'CW') { pl = d - w / 2; ph = d + w / 2; } else { pl = d - w / 2; ph = d + w / 2; }
  wfCtx.fillStyle = 'rgba(255,255,255,0.08)'; wfCtx.fillRect(xOf(pl), 0, Math.max(2, xOf(ph) - xOf(pl)), H);
  wfCtx.strokeStyle = '#ff4d4d'; wfCtx.beginPath(); wfCtx.moveTo(W / 2 + 0.5, 0); wfCtx.lineTo(W / 2 + 0.5, specH); wfCtx.stroke();
  // scale
  wfCtx.fillStyle = '#9fb3c8'; wfCtx.font = '10px monospace';
  const tick = span > 2e6 ? 200000 : span > 1e6 ? 100000 : span > 300000 ? 50000 : span > 100000 ? 20000 : span > 30000 ? 10000 : 2000;
  for (let f = Math.ceil(f0 / tick) * tick; f < f0 + span; f += tick) {
    const x = xOf(f); wfCtx.fillRect(x, specH - 12, 1, 4);
    wfCtx.fillText(f >= 30e6 ? (f / 1e6).toFixed(tick >= 100000 ? 1 : 2) : (f / 1000).toFixed(0), x - 18, specH - 14);
  }
  if (!rs.powered) { wfCtx.fillStyle = '#ffd166'; wfCtx.font = '16px sans-serif'; wfCtx.fillText('Radio is off — finish wiring in the Shack tab', W / 2 - 170, specH / 2); }
  drawMeter(rs);
  const txl = document.getElementById('lcd-tx');
  if (txl) txl.className = txState.active ? 'tx-on' : 'dim';
}

function drawMeter(rs) {
  const c = meterCv.getContext('2d'), W = meterCv.width, H = meterCv.height, r = R();
  c.fillStyle = rs.powered ? '#f3e7c4' : '#3a3a3a'; c.fillRect(0, 0, W, H);
  if (!rs.powered) return;
  const cx = W / 2, cy = H + 40, rad = 140;
  const arc = (a0, a1, col, lw = 3) => { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.arc(cx, cy, rad, a0, a1); c.stroke(); };
  const A0 = -Math.PI * 0.78, A1 = -Math.PI * 0.22;
  arc(A0, A1, '#222', 2);
  c.fillStyle = '#222'; c.font = '10px sans-serif'; c.textAlign = 'center';
  const mode = txState.active ? (r.meter === 'S' ? 'PO' : r.meter) : 'S';
  let frac = 0;
  const lab = (fr, txt, col = '#222') => { const a = A0 + (A1 - A0) * fr; c.fillStyle = col; c.fillText(txt, cx + Math.cos(a) * (rad + 10), cy + Math.sin(a) * (rad + 10)); };
  if (mode === 'S') {
    ['1', '3', '5', '7', '9'].forEach((s, i) => lab((+s) / 15, s));
    ['+20', '+40', '+60'].forEach((s, i) => lab((9 + (i + 1) * 2) / 15, s, '#c00'));
    arc(A0 + (A1 - A0) * 0.6, A1, '#c00', 3);
    const s = rx.smeterDbm;
    frac = s >= -73 ? (9 + clamp((s + 73) / 10, 0, 6)) / 15 : clamp((9 + (s + 73) / 6) / 15, 0, 1);
    c.fillText('S', 14, 20);
    c.textAlign = 'left'; c.fillText(sUnits(s).text, 6, H - 8);
  } else if (mode === 'PO') {
    [0, 25, 50, 75, 100].forEach((w) => lab(Math.sqrt(w / 100), String(w)));
    frac = Math.sqrt(clamp(txState.watts / 100, 0, 1)) * (txState.keyed ? 1 : 0.02);
    c.fillText('PO (W)', 30, 20);
  } else {
    [[1, '1'], [1.5, '1.5'], [2, '2'], [3, '3'], [5, '5'], [10, '∞']].forEach(([v, l]) => lab(Math.log(v) / Math.log(10), l, v >= 3 ? '#c00' : '#222'));
    frac = txState.active ? clamp(Math.log(Math.min(txState.swr, 10)) / Math.log(10), 0, 1) : 0;
    c.fillText('SWR', 24, 20);
  }
  const a = A0 + (A1 - A0) * frac;
  c.strokeStyle = '#111'; c.lineWidth = 2; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * (rad + 4), cy + Math.sin(a) * (rad + 4)); c.stroke();
  c.textAlign = 'right'; c.fillStyle = '#555'; c.fillText(mode, W - 6, 14);
}

export function stationInfo(call) {
  const st = world.stations.find((s) => s.call === call);
  if (!st) return null;
  const me = player();
  return { st, dist: distanceKm(me, st.op), brg: bearing(me, st.op) };
}
