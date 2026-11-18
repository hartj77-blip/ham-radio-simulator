// Transceiver front panel, panadapter/waterfall and the receive audio chain.
import { S, save } from './state.js';
import { h, $, $$, clamp, fmtFreq, bus, now, toast, rand, chance, db2amp } from './util.js';
import { BANDS, bandOf, bandByName, privilegeMap, txAdvice, CTCSS, SIDEBAND_FOR } from './data/bandplan.js';
import { audio } from './audio.js';
import { world, player, phone } from './world.js';
import { rigStatus } from './shack.js';
import { system, ANT_TYPES } from './antenna.js';
import { bandNoiseDbm, sUnits, distanceKm, bearing } from './propagation.js';
import { elmer } from './elmer.js';
import { decorate as decorateFaceplate, sync as syncFaceplate } from './faceplate.js';
import { manualButton } from './manualui.js';
import { ui as opUi, txState } from './operating.js';
import { net } from './net.js';
import { owns, maxPower } from './limits.js';
import { mountMaster, render as renderMaster } from './masterview.js';
import { siteEffects } from './yard.js';
import { serviceOf, SERVICE_REGIONS } from './services.js';
import { rig , rigRx, gearOf } from './rigs.js';
import { RW, WX_CHANNELS, HEAR } from './realworld.js';
import { hashStr } from './util.js';
import { SVC, hasMarine, localHour } from './activity.js';
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
  const [rxLo, rxHi] = rig().rx;
  if (!rigRx(hz)) toast(`Your ${rig().name} receives ${(rxLo / 1e6).toFixed(1)}–${rxHi / 1e6} MHz.`, 'warn', 3500);
  r.freq = Math.round(clamp(hz, rxLo, rxHi));
  if (Math.abs(r.freq - 10e6) < 3000 || Math.abs(r.freq - 15e6) < 3000 || Math.abs(r.freq - 5e6) < 3000) (S.flags ||= {}).wwv = 1;
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
  rxUpdate(); // do not wait for the next 100 ms tick: the receiver follows the dial at once
}
let prevFreq = R().freq;
function hzOld(b) { return prevFreq >= b.lo && prevFreq <= b.hi ? prevFreq : b.def; }

export function setMode(m) {
  if (!rig().modes.includes(m)) { toast(`The ${rig().name} doesn't do ${m}.`, 'warn', 3000); m = rig().modes[0]; }
  R().mode = m;
  applyMode();
  if ((m === 'USB' || m === 'LSB') && m !== SIDEBAND_FOR(R().freq)) elmer('sideband');
  save(); updateDisplay();
  rxUpdate();
}
export function reapplyMode() { applyMode(); }
function applyMode() {
  const r = R();
  audio.setMode(r.mode, r.filter[r.mode], r.pitch, rig().ifs ? r.ifShift || 0 : 0);
  audio.setNotch(r.notch && rig().notch ? r.notchHz || 1000 : null);
  for (const id of [...audio.voices.keys()]) audio.remove(id);
}

// ------------------------------------------------------------------ receive chain
bus.on('station-tx', (st) => {
  if (!audio.ready || !rigStatus().powered) return;
  if (st.band !== world.band) return;
  const off = st.freq - dialHz();
  const span = R().mode === 'WFM' || st.mode === 'WFM' ? 150000 : R().mode === 'FM' || st.mode === 'FM' ? 15000 : 6000;
  if (Math.abs(off) > span) return;
  startVoice(st);
  st.tx.heard = false;
});

// Start the sound of a transmission. Also used when you tune onto a station that is already
// talking: a real receiver produces audio the moment the dial lands, so the sound is joined
// part-way through instead of waiting for that station's next transmission.
function startVoice(st) {
  const tx = st.tx;
  if (!tx || tx.kind === 'peervoice' || tx.kind === 'stream') return;
  const el = Math.max(0, now() - tx.start); // seconds of it already gone
  const start = audio.t + Math.max(0, tx.start - now());
  const dur = tx.end - tx.start - el;
  const tone = Math.max(20, toneFor(st));
  // Everything is shifted so the part still to come starts now; nothing is scheduled in the past.
  if (tx.steps) audio.fsk(st.id, start, dur, tone, el ? tx.steps.filter(([t], i, a2) => t >= el || !(a2[i + 1] && a2[i + 1][0] <= el)).map(([t, hz]) => [Math.max(0, t - el), hz]) : tx.steps, tx.wave);
  else if (tx.kind === 'cw' || tx.kind === 'cwtone' || tx.kind === 'amtone' || tx.kind === 'fmtone') {
    const segs = el ? tx.sch.segs.filter((g) => g.t1 > el).map((g) => ({ ...g, t0: Math.max(0, g.t0 - el), t1: g.t1 - el })) : tx.sch.segs;
    if (segs.length) audio.cw(st.id, segs, start, tone);
  } else audio.babble(st.id, start, dur, 700);
}

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
  const sh = rig().ifs ? r.ifShift || 0 : 0;
  if (r.mode === 'CW') return Math.abs(tone - r.pitch - sh) < w / 2 + 40;
  if (r.mode === 'AM') return tone > 50 && tone < w / 2;
  return tone > 200 + sh && tone < 250 + w + sh;
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
  const att = r.rfAtt + (1 - (r.rfGain ?? 1)) * 30; // ATT pad + RF gain backed off
  const sys = rs.antennaOk ? system(d) : null;
  let nf = -132;
  if (rs.antennaOk && sys) nf = Math.max(-132, bandNoiseDbm(f, player()) + sys.effDb - sys.totalLoss);
  nf -= att;
  nf = Math.max(nf, -132 - (rig().quietRx || 0) - [0, 6, 9][r.preamp || 0] * (f > 14 ? 1 : 0.3));
  if (f < 10) nf += gearOf('psu').noiseDb || 0; // switching-supply hash on the low bands
  const site = siteEffects(f); // where the antenna is: city noise, building/indoor/mobile losses
  if (rs.antennaOk) nf += site.noiseDb;
  const bw = r.mode === 'CW' ? r.filter.CW : r.mode === 'FM' ? 12000 : r.mode === 'WFM' ? 150000 : r.mode === 'AM' ? r.filter.AM / 2 : r.filter[r.mode];
  const nBW = nf + 10 * Math.log10(bw / 2400);
  rx.noiseDbm = nf;
  const NREF = 0.1;
  let maxRms = NREF, strongest = null, strongDbm = -200;
  const sigs = [];
  const t = now();
  for (const st of world.stations) {
    if (!st.tx || t > st.tx.end + 0.3 || t < st.tx.start - 0.2) continue;
    const dbm = world.rxDbm(st) - att - site.lossDb;
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
    } else if (st.mode === 'CW' || st.mode === 'FT8' || st.tx.kind === 'cwtone') {
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
      const sh = rig().ifs ? r.ifShift || 0 : 0;
      audible = r.mode !== 'FM' && center > 150 + sh && center < 3100 + sh;
      intelligible = sameSb && r.mode !== 'CW' && Math.abs(off) < 350;
      audio.setVoice(st.id, { tone: clamp(center * 0.6, 150, 3000) });
    }
    if (audible && st.tx.kind !== 'stream' && t < st.tx.end - 0.15 && !audio.has(st.id)) startVoice(st); // tuned in mid-transmission
    const snr = dbm - nBW;
    sigs.push({ st, dbm, snr, audible, intelligible, off, tone });
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
  // Tuned away from (or squelched) the station whose voice is playing: cut it at once, as a
  // receiver would, so the next station is not left waiting behind it.
  if (speaking) {
    const cur = sigs.find((x) => x.st === speaking.st);
    if (!(cur && cur.st.tx === speaking.tx && cur.intelligible && cur.snr > -1 && open)) stopSpeaking();
  }
  // AGC (fast attack, slow decay)
  const target = clamp(0.28 / maxRms, 0.02, 1);
  const spd = r.agcSpd || 'mid';
  if (spd === 'off') agc = 0.7; // no AGC: strong signals blast, weak ones vanish — ride the RF gain
  else agc = target < agc ? target : agc + (target - agc) * ({ fast: 0.3, mid: 0.08, slow: 0.025 }[spd] || 0.08);
  rx.agcDb = 20 * Math.log10(agc); rx.att = att; rx.bw = bw;
  audio.setNoise(noiseRms * agc * (r.nr && (owns('dsp') || rig().dsp) ? 0.55 : 1) * (S.settings.noiseLvl ?? 1));
  for (const s of sigs) {
    let rms = s.audible && open ? NREF * db2amp(s.snr) * agc : 0;
    if (r.notch && rig().notch && s.tone > 0 && Math.abs(s.tone - (r.notchHz || 1000)) < 70 && ['cw', 'cwtone', 'amtone'].includes(s.st.tx.kind) || (r.notch && rig().notch && s.st.mode === 'CW' && Math.abs(s.tone - (r.notchHz || 1000)) < 70)) rms *= 0.04;
    if ((r.mode === 'FM' || r.mode === 'WFM') && (s.st.mode === 'FM' || s.st.mode === 'WFM') && s.audible) rms = open ? 0.25 : 0;
    if (s.st.tx.kind === 'stream') {
      const lvl = s.audible && open ? clamp((s.intelligible ? 1 : 0.35) * (s.st.mode === 'WFM' ? clamp((s.snr - 3) / 12, 0, 1) * 1.2 : NREF * db2amp(s.snr) * agc / 0.12), 0, 1.5) : 0;
      if (lvl > 0.01 && !s.st.dead) { const rec = audio.stream(s.st.id, s.st.url); if (rec.dead) s.st.dead = true; }
      audio.streamLevel(s.st.id, lvl, r.af);
      if (lvl > 0.01 && S.settings.subtitles && s.st.lastSub !== s.st.id) { s.st.lastSub = s.st.id; opUi.transcript(s.st.op.call, `${s.st.op.name} — live${s.st.dead ? ' (stream unavailable)' : ''}`, 'rx'); }
      s.st.rxSnrRecent = s.snr;
      continue;
    }
    if (s.intelligible && s.snr > -1 && s.st.tx.kind === 'voice') {
      rms *= 0.06; // the TTS voice carries the intelligible audio
      speakIfNeeded(s, open ? (r.mode === 'FM' ? 0.9 : clamp(db2amp(s.snr) * agc * 0.35, 0.05, 1)) : 0);
    }
    audio.setVoice(s.st.id, { rms });
    s.st.rxSnrRecent = s.snr;
    // what a decoder would show for data signals (a real radio needs a computer for this)
    const tx = s.st.tx;
    if (S.settings.subtitles && s.audible && open && !tx.noted) {
      if (s.st.mode === 'FT8') { if (s.snr > -16 && t > tx.end - 0.5) { tx.noted = true; opUi.transcript(s.st.call, tx.show, 'rx', null, `FT8 decode, ${Math.round(clamp(s.snr, -24, 20))} dB`); } }
      else if (tx.note && s.snr > 3) { tx.noted = true; opUi.transcript(s.st.call, tx.note, 'rx'); }
    }
  }
  for (const p of peerSigs) p.node.gain.setTargetAtTime(p.audible && open ? clamp(db2amp(p.snr) * agc * 0.3, 0, 1.4) : 0, audio.t, 0.05);
  // QRN static crashes on the low bands
  // (real thunderstorms nearby — from the live weather — make it much worse)
  const qrn = (f < 2.5 ? 0.08 : f < 5 ? 0.05 : f < 8 ? 0.025 : f < 15 ? 0.006 : 0) * (RW.wx?.storm ? 4 : 1);
  if (rs.antennaOk && S.settings.qrn !== false && r.mode !== 'FM' && r.mode !== 'WFM' && chance(qrn)) audio.crash(NREF * agc * rand(2, 8) * (r.nb ? 0.12 : 1)); // the noise blanker gates impulse noise
  audio.streamGC();
  // S-meter
  const sm = Math.max(nf, strongDbm);
  lastSmeter = sm > lastSmeter ? sm : lastSmeter + (sm - lastSmeter) * 0.25;
  rx.smeterDbm = lastSmeter;
  rx.strongest = strongest;
  if (strongest && strongest.snr > 10 && !S.flags?.heard) { (S.flags ||= {}).heard = 1; save(); }
  updateDecoder(strongest);
}

let speaking = null; // { st, tx, utt } for the synthesized voice now playing
function stopSpeaking() {
  const sp = speaking;
  if (!sp) return;
  speaking = null;
  sp.utt.cancelled = true;
  sp.tx.speaking = false;
  sp.tx.heard = false; // tune back while it is still transmitting and you pick it up again
  audio.cancelSpeech();
}

function speakIfNeeded(s, vol) {
  const tx = s.st.tx;
  if (tx.heard || !tx.say) return;
  if (speaking && speaking.tx !== tx) return; // another station on frequency is mid-sentence
  // Joining part-way through: say only what is left of the sentence.
  let say = tx.say;
  const el = now() - tx.start;
  if (el > 1) {
    const words = say.split(/\s+/);
    const skip = Math.ceil(words.length * el / Math.max(1, tx.end - tx.start));
    if (words.length - skip < 2) return;
    say = words.slice(skip).join(' ');
  }
  tx.heard = true;
  tx.speaking = true;
  const st = s.st;
  const utt = { cancelled: false };
  speaking = { st, tx, utt };
  const pitch = clamp(st.pitch + s.off / 450 * (R().mode === 'LSB' ? -1 : 1), 0.2, 2);
  (S.settings.tts === false ? new Promise((res) => setTimeout(res, Math.min(9000, 400 + say.length * 55))) : audio.speak(say, { lang: st.op.lang, seed: st.seed, rate: (st.rate || 1) * (S.settings.ttsRate || 1), pitch, volume: vol })).then(() => {
    if (utt.cancelled) return; // cut off by tuning away: the station itself is still transmitting
    if (speaking && speaking.utt === utt) speaking = null;
    tx.speaking = false; tx.end = Math.min(tx.end, now());
    if (tx.courtesy) courtesy();
  });
  setTimeout(() => { if (!utt.cancelled) tx.speaking = false; if (speaking && speaking.utt === utt) speaking = null; }, 25000);
  if (S.settings.subtitles && !tx.subbed) { tx.subbed = true; opUi.transcript(st.call === 'beacon' ? '' : (st.speaker ? st.speaker.call : st.call), tx.show, 'rx'); }
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
  freqIn.onkeydown = (e) => { if (e.key === 'Enter') { const v = parseFloat(freqIn.value); if (v >= 100) { prevFreq = R().freq; setFreq(v * 1000); freqIn.value = ''; freqIn.blur(); } } };

  const slider = (label, min, max, step, val, fn, fmt = (v) => v) => {
    const out = h('span', { class: 'val' }, fmt(val));
    const i = h('input', { type: 'range', min, max, step, value: val });
    i.oninput = () => { fn(+i.value); out.textContent = fmt(+i.value); save(); };
    return h('label', { class: 'knobrow' }, h('span', {}, label), i, out);
  };
  const filterSel = h('select', { class: 'rsel', id: 'filter-sel' });
  const fillFilters = () => {
    const opts = { CW: owns('cwfilter') || rig().narrowCw ? [250, 400, 500, 800, 1200, 2400] : [500, 800, 1200, 2400], USB: [1800, 2100, 2400, 2700, 3000], LSB: [1800, 2100, 2400, 2700, 3000], AM: [3000, 6000, 9000], FM: [12000], WFM: [150000] }[r.mode];
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

  const mvBtn = h('button', { class: `btn small ${S.settings.master ? 'active' : ''}`, id: 'master-btn', title: 'Show every control and the signal chain inside the radio', onclick: () => { S.settings.master = !S.settings.master; save(); mvBtn.classList.toggle('active', S.settings.master); renderMaster(); } }, 'Master view');
  const rg0 = rig();
  el.append(h('div', { class: 'rig-bar row spread' },
    h('div', { class: 'rig-badge' }, h('span', { class: 'rig-maker' }, rg0.code || ''), h('span', { class: 'rig-model' }, rg0.name), h('span', { class: 'tiny muted' }, ` ${rg0.cls}`)),
    h('div', { class: 'row' }, manualButton(S.rig || 'allmode'), h('button', { class: 'btn small', onclick: () => bus.emit('goto', 'rigbuilder') }, 'Equipment'), mvBtn)));
  const rigEl = h('div', { class: `rig look-${rg0.look || 'classic'}` },
    h('div', { class: 'rig-top' },
      h('div', { class: 'rig-left' }, meterCv, h('div', { class: 'muted tiny center' }, 'click meter: S / PO / SWR')),
      lcd,
      h('div', { class: 'rig-right' }, knob, h('div', { class: 'row center' }, stepSel, freqIn)),
    ),
    h('div', { class: 'rig-mid' }, h('div', { class: 'wf-wrap' }, wf, wfToolbar(), h('div', { class: 'no-scope-msg' }, `The ${rig().name} has no spectrum scope — tune by ear, like the old days. (Watch the S-meter!)`))),
    h('div', { class: 'rig-controls' },
      h('div', { class: 'ctl-group' }, h('div', { class: 'ctl-title' }, 'HAM BANDS'), bandBtns,
        h('div', { class: 'ctl-title', style: { marginTop: '8px' } }, 'GENERAL COVERAGE (RX)'), serviceButtons()),
      h('div', { class: 'ctl-group' }, h('div', { class: 'ctl-title' }, 'MODE'), modeBtns, h('label', { class: 'knobrow' }, h('span', {}, 'FILTER'), filterSel)),
      h('div', { class: 'ctl-group' }, h('div', { class: 'ctl-title' }, 'AUDIO'),
        slider('AF GAIN', 0, 1, 0.01, r.af, (v) => { r.af = v; }, (v) => Math.round(v * 100)),
        slider('SQL', 0, 1, 0.01, r.sql, (v) => { r.sql = v; }, (v) => Math.round(v * 100)),
        h('div', { class: 'row' }, attBtn, ritBtn, ritSl), owns('dsp') || rig().dsp ? h('button', { class: `rbtn ${r.nr ? 'active' : ''}`, onclick: (e) => { r.nr = !r.nr; e.target.classList.toggle('active', r.nr); save(); } }, 'NR (DSP)') : null),
      h('div', { class: 'ctl-group tx-group', hidden: !rg0.tx.length }, h('div', { class: 'ctl-title' }, 'TRANSMIT'),
        slider('POWER', 5, maxPower(), 5, Math.min(r.power, maxPower()), (v) => { r.power = v; if (v <= 25) elmer('power_min'); }, (v) => `${v} W`),
        h('div', { class: 'row' }, atuBtn, tuneBtn),
        h('div', { class: 'fm-only' }, h('label', { class: 'knobrow' }, h('span', {}, 'OFFSET'), rptSel), h('label', { class: 'knobrow' }, h('span', {}, 'CTCSS'), toneSel)),
        rotator, mtuner, h('div', { id: 'antswitch' })),
    ),
  );
  el.append(rigEl);
  decorateFaceplate(rigEl, { atuTune, update: updateDisplay });
  const mv = h('div', { id: 'master-view', class: 'master-view' });
  el.append(mv); mountMaster(mv);
  fillFilters();
  updateDisplay();
  if (radioListeners) return;
  radioListeners = true;
  bus.on('rig', () => { const r2 = R(); if (!rig().modes.includes(r2.mode)) r2.mode = rig().modes[0]; if (r2.power > maxPower()) r2.power = maxPower(); if (!(r2.power > 0) && maxPower() > 0) r2.power = Math.min(100, maxPower()); initRadioUI(panel); applyMode(); world.setFreq(r2.freq); });
  bus.on('antenna', updateDisplay);
  bus.on('shack', updateDisplay);
  bus.on('license', updateDisplay);
}
// One-touch presets for the non-ham services (receive only).
function serviceButtons() {
  const go = (f, m) => { prevFreq = R().freq; setFreq(f, { mode: m }); setMode(m); };
  const lastIn = (name, def) => R().lastByBand[name]?.f || def;
  const P = [
    ['WWV', () => go(10e6, 'AM'), 'WWV/WWVH time signals on 10 MHz'],
    ['OCEANIC', () => go(localHour() > 7 && localHour() < 19 ? SVC.oceanic[1] : SVC.oceanic[0], 'USB'), 'Oceanic air traffic on HF single sideband: position reports and SELCAL (8906 kHz by day, 5598 kHz at night)'],
    ['AIR', () => { const ap = RW.airports[0]; const tw = ap?.freqs.find((x) => /TWR/i.test(x.type)) || ap?.freqs[0]; go(tw ? Math.round(tw.mhz * 1e6) : 121.5e6, 'AM'); }, 'Airband: nearest airport tower'],
    ['NOAA WX', () => go(WX_CHANNELS[hashStr(RW.nws?.office || 'NWS') % 7], 'FM'), 'NOAA Weather Radio'],
    ['EMS', () => go(HEAR, 'FM'), 'HEAR ambulance ↔ hospital (155.340)'],
    ['FIRE', () => go(SVC.fire, 'FM'), 'County fire dispatch: two-tone paging, then the voice dispatch (154.190)'],
    ['RAIL', () => go(SVC.rail, 'FM'), 'Railroad road channel: crews, dispatcher and defect detectors (160.800)'],
    hasMarine() ? ['MARINE', () => go(SVC.marine16, 'FM'), 'Marine VHF channel 16: distress and calling (156.800)'] : ['JOB SITE', () => go(SVC.biz, 'FM'), 'Business itinerant channel: construction crews, flaggers, towing (151.625)'],
  ];
  return h('div', { class: 'btn-grid bands' }, ...P.map(([l, fn, t]) => h('button', { class: 'rbtn svc', title: t, onclick: fn }, l)));
}

let knobRot = 0, radioListeners = false;
const angle = (e, el) => { const b = el.getBoundingClientRect(); return Math.atan2(e.clientY - (b.top + b.height / 2), e.clientX - (b.left + b.width / 2)) * 180 / Math.PI; };

export function tuneBy(n) {
  const r = R();
  prevFreq = r.freq;
  const sv = serviceOf(r.freq);
  const step = sv ? Math.max(r.step, sv.mode === 'WFM' ? 100000 : sv.name === 'AIR' ? 5000 : 1000) : r.mode === 'FM' && r.step < 5000 ? 5000 : r.step;
  setFreq(Math.round((r.freq + n * step) / step) * step);
  if (!S.tips.includes('first_listen')) elmer('first_listen');
}

function wfToolbar() {
  const speed = h('select', { class: 'rsel wf-speed', title: 'Waterfall scroll speed' }, ...Object.entries(WF_RATES).map(([k2, v]) => h('option', { value: k2 }, `${k2[0].toUpperCase()}${k2.slice(1)} (${v} rows/s)`)));
  speed.onchange = () => { S.settings.wfSpeed = speed.value; save(); };
  wfTools = h('div', { class: 'wf-tools' },
    h('span', { class: 'wf-lab' }, 'Span'),
    h('button', { class: 'rbtn wf-in', title: 'Zoom in (narrower span)', onclick: () => wfZoom(-1) }, '−'),
    h('span', { class: 'wf-span mono' }),
    h('button', { class: 'rbtn wf-out', title: 'Zoom out (wider span)', onclick: () => wfZoom(1) }, '+'),
    h('span', { class: 'wf-lab' }, 'Waterfall'), speed);
  setTimeout(updateWfTools);
  return wfTools;
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


// ------------------------------------------------------------------ ATU
function atuTune() {
  const rs = rigStatus(), r = R();
  if (!rs.powered) return toast('Turn the radio on first (Station wiring page).', 'warn');
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
  // Free Play: the antenna is re-cut for each band and a wide-range tuner matches it automatically.
  if (S.mode === 'free' && r.atuOn) swr = Math.min(swr, 1.1 + Math.min(swr - 1, 4) * 0.02);
  return swr;
}

// ------------------------------------------------------------------ display
export function updateDisplay() {
  updateWfTools();
  if (!lcd) return;
  const r = R(), rs = rigStatus();
  const band = bandOf(r.freq);
  const txf = r.mode === 'FM' ? r.freq + r.rptOffset : r.freq;
  const swr = rs.powered ? effectiveSwr(r.freq) : 0;
  lcd.className = 'lcd-panel' + (rs.powered ? ' on' : '');
  lcd.innerHTML = rs.powered ? `
    <div class="lcd-row small"><span>VFO-A${r.split ? ' <b class="hl">SPLIT</b>' : ''}</span>${r.preamp ? `<span class="hl">P.AMP${r.preamp}</span>` : ''}${r.nb ? '<span class="hl">NB</span>' : ''}${r.notch && rig().notch ? '<span class="hl">NOTCH</span>' : ''}<span>${band ? band.name : serviceOf(r.freq)?.label || 'GEN'}</span>${rig().atu ? `<span class="${r.atuOn ? 'hl' : 'dim'}">ATU${r.atuOn && r.atuTunedFreq && Math.abs(r.freq - r.atuTunedFreq) < Math.max(8000, r.freq * 0.005) ? '✓' : ''}</span>` : ''}<span class="${r.rfAtt ? 'hl' : 'dim'}">ATT</span>${rig().tx.length ? `<span>${r.power}W</span><span id="lcd-tx" class="dim">TX</span>` : '<span>RX ONLY</span>'}</div>
    <div class="lcd-freq">${fmtFreq(r.freq)}<span class="unit">MHz</span></div>
    <div class="lcd-row"><span class="mode">${r.mode}</span><span>FIL ${r.filter[r.mode] >= 1000 ? (r.filter[r.mode] / 1000) + 'k' : r.filter[r.mode]}</span>
      <span class="${r.ritOn ? 'hl' : 'dim'}">RIT ${r.rit >= 0 ? '+' : ''}${(r.rit / 1000).toFixed(2)}</span>
      ${r.mode === 'FM' ? `<span>${r.rptOffset ? (r.rptOffset < 0 ? '−' : '+') + 'SHIFT' : 'SIMP'}</span><span>${r.toneHz ? 'T ' + r.toneHz.toFixed(1) : ''}</span>` : ''}
      ${rig().tx.length ? `<span>SWR ${swr > 50 ? '∞' : swr.toFixed(1)}</span>` : ''}</div>
    <div class="lcd-row small"><span>${rs.end === 'antenna' ? (S.antenna.built ? ANT_TYPES[S.antenna.type].label.split('(')[0] : 'NO ANTENNA UP') : rs.end === 'dummy' ? 'DUMMY LOAD' : 'ANT: OPEN'}</span>
      ${r.mode === 'FM' && r.rptOffset ? `<span>TX ${(txf / 1e6).toFixed(3)}</span>` : ''}
      ${rig().tx.length ? (() => { const a = txAdvice(S.license, txf, r.mode); return `<span class="lcd-priv ${a.ok ? 'ok' : 'no'}" title="${a.long.replace(/"/g, '&quot;')}">${a.short}</span>`; })() : ''}</div>`
    : `<div class="lcd-off">${rs.issues[0] || 'OFF'}<br><small>(see the Station wiring page)</small></div>`;
  $$('.rbtn[data-band]', panel).forEach((b) => b.classList.toggle('active', band && b.dataset.band === band.name));
  $$('.rbtn[data-mode]', panel).forEach((b) => b.classList.toggle('active', b.dataset.mode === r.mode));
  $('#atu-btn', panel)?.classList.toggle('active', r.atuOn);
  $('#att-btn', panel)?.classList.toggle('active', !!r.rfAtt);
  $('#rit-btn', panel)?.classList.toggle('active', r.ritOn);
  panel.classList.toggle('mode-fm', r.mode === 'FM');
  document.body.classList.toggle('op-cw', r.mode === 'CW');
  panel.fillFilters && panel.fillFilters();
  // rotator & manual tuner widgets
  if (rs.powered && rs.antennaOk && swr > 0 && swr < 2 && bandOf(r.freq) && !S.flags?.lowSwr) { (S.flags ||= {}).lowSwr = 1; save(); }
  // rig capabilities & antenna switch
  const rg = rig();
  $$('.rbtn[data-mode]', panel).forEach((b) => { b.disabled = !rg.modes.includes(b.dataset.mode); });
  $('#atu-btn', panel)?.toggleAttribute('hidden', !rg.atu);
  panel.querySelector('.warnb')?.toggleAttribute('hidden', !rg.atu);
  panel.classList.toggle('no-scope', !rg.scope);
  syncFaceplate(panel.querySelector('.rig'));
  const asw = $('#antswitch', panel);
  if (asw) {
    asw.innerHTML = '';
    const slots = S.antSlots || [];
    if (owns('antswitch') && slots.some(Boolean)) asw.append(h('div', { class: 'ctl-title' }, 'ANTENNA'), h('div', { class: 'row' }, ...slots.map((sl, i) => sl ? h('button', { class: `rbtn ${S.antIdx === i ? 'active' : ''}`, title: `${sl.type} ${sl.length} ft`, onclick: () => bus.emit('ant-slot', i) }, `ANT ${i + 1}`) : null)));
  }
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
// The panadapter works like a real FFT display: each pixel column is one frequency bin of
// width span ÷ pixels, noise is shown per bin (so narrow signals stand out above it, as on a
// real radio), the trace redraws every frame and the waterfall adds rows at a fixed rate in
// rows per second, independent of the frame rate.
export const WF_RATES = { slow: 15, normal: 30, fast: 60 };
const HF_SPANS = [10e3, 25e3, 50e3, 100e3, 200e3];
const WIDE_ZOOM = [0.25, 0.5, 1, 2, 4];
const wideBase = () => { const sv = serviceOf(R().freq); if (sv) return sv.span; return R().mode === 'FM' || world.band === '2m' ? 200000 : 0; };
function zoomKey() { return wideBase() ? 'wfZoomWide' : 'wfZoomHF'; }
function zoomIdx() { const k = zoomKey(); return clamp(R()[k] ?? (k === 'wfZoomHF' ? 1 : 2), 0, 4); }
function spanHz() { const b = wideBase(), z = zoomIdx(); return b ? b * WIDE_ZOOM[z] : HF_SPANS[z]; }
export function wfZoom(dir) { const k = zoomKey(); R()[k] = clamp(zoomIdx() + dir, 0, 4); save(); wfReset = true; updateWfTools(); }
const fmtSpan = (hz) => (hz >= 1e6 ? `${+(hz / 1e6).toFixed(2)} MHz` : `${+(hz / 1e3).toFixed(1)} kHz`);

let wfBuf = null, wfBufCtx = null, lastWfFreq = null, lastWfSpan = null, wfReset = true, wfAcc = 0, wfLastT = 0, trace = null, wfTools = null;
const COLORS = (() => {
  const stops = [[0, 6, 10, 30], [0.25, 10, 40, 140], [0.5, 30, 170, 200], [0.7, 240, 220, 60], [0.85, 255, 120, 20], [1, 255, 255, 255]];
  const lut = new Uint8ClampedArray(256 * 3);
  for (let n = 0; n < 256; n++) {
    const v = n / 255;
    for (let i = 1; i < stops.length; i++) if (v <= stops[i][0]) {
      const [a, r0, g0, b0] = stops[i - 1], [b, r1, g1, b1] = stops[i], t = (v - a) / (b - a);
      lut[n * 3] = r0 + (r1 - r0) * t; lut[n * 3 + 1] = g0 + (g1 - g0) * t; lut[n * 3 + 2] = b0 + (b1 - b0) * t; break;
    }
  }
  return lut;
})();

// Deterministic pseudo-random in [0, 1)
const hash = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
const seedOf = (o) => o._wfSeed ??= [...String(o.id ?? o.freq ?? 0)].reduce((s, c) => (s * 31 + c.charCodeAt(0)) % 9973, 7);
// Speech-like envelope (0..1): syllables of ~0.22 s with gaps between words and phrase pauses.
function speechEnv(seed, t, floor = 0.003) {
  const P = Math.floor(t / 2.6);
  if (hash(seed + 2, P) < 0.2 && t / 2.6 - P < 0.3) return floor; // pause for breath
  const L = 0.2 + 0.06 * hash(seed + 3, P), k = Math.floor(t / L), ph = t / L - k;
  if (hash(seed, k) < 0.22) return floor; // gap between words
  return Math.max(floor, Math.pow(Math.sin(Math.PI * ph), 0.7) * (0.25 + 0.75 * hash(seed + 1, k)));
}
// Long-term average speech spectrum, relative power vs audio frequency (peak near 500 Hz,
// about −10 dB at 2 kHz and −16 dB at 2.8 kHz).
const speechShape = (a) => (a < 500 ? Math.pow(10, -((500 - a) / 300) * 0.6) : Math.pow(10, -((a - 500) / 2300) * 1.6));
// Exponential power noise averaged over two looks (what an FFT bin shows), in dB about 0.
const noiseDb = () => 10 * Math.log10(Math.max(1e-6, (-Math.log(1 - Math.random()) - Math.log(1 - Math.random())) / 2));

function computeBins(Wb, span, f0, nfBin, t, rs, r) {
  const bins = new Float32Array(Wb);
  for (let i = 0; i < Wb; i++) bins[i] = rs.powered ? nfBin + noiseDb() : -170;
  if (!rs.powered) return bins;
  const hzPerBin = span / Wb;
  const pw = new Float64Array(Wb); // added signal power, mW
  const binOf = (f) => Math.floor((f - f0) / hzPerBin);
  // spread `dbm` over [lo, hi] weighted by shape(f) (relative); the total power is conserved
  const spread = (lo, hi, dbm, shape) => {
    let a = binOf(lo), b = binOf(hi);
    if (b < 0 || a >= Wb) return;
    const ws = []; let sum = 0;
    for (let i = a; i <= b; i++) { const w = shape ? shape(f0 + (i + 0.5) * hzPerBin) : 1; ws.push(w); sum += w; }
    const tot = Math.pow(10, dbm / 10);
    for (let i = a; i <= b; i++) if (i >= 0 && i < Wb) pw[i] += tot * ws[i - a] / sum * (shape ? Math.exp(-Math.log(1 - Math.random())) : 1);
  };
  const addSig = (fc, dbm, kind, sb, keyed, seed) => {
    if (!keyed) return;
    if (kind === 'cw') spread(fc - 15, fc + 15, dbm);
    else if (kind === 'ft8') spread(fc, fc + 50, dbm); // 8 tones 6.25 Hz apart
    else if (kind === 'wfm') spread(fc - 90000, fc + 90000, dbm - 0.5 * Math.random());
    else if (kind === 'fm') spread(fc - 7000, fc + 7000, dbm - Math.random());
    else if (kind === 'am') {
      // steady carrier with about two-thirds of the power; programme audio in the sidebands
      spread(fc - 10, fc + 10, dbm - 1.8);
      const env = speechEnv(seed, t, 0.25), side = dbm - 6 + 10 * Math.log10(env);
      const sh = (f) => speechShape(Math.abs(f - fc));
      spread(fc - 4500, fc - 100, side - 3, sh); spread(fc + 100, fc + 4500, side - 3, sh);
    } else {
      const env = speechEnv(seed, t), d = sb === 'LSB' ? -1 : 1, lv = dbm + 10 * Math.log10(env);
      const sh = (f) => speechShape(Math.abs(f - fc));
      if (d > 0) spread(fc + 200, fc + 2800, lv, sh); else spread(fc - 2800, fc - 200, lv, sh);
    }
  };
  for (const st of world.stations) {
    if (!st.tx || t < st.tx.start || t > st.tx.end + (st.tx.speaking ? 3 : 0)) continue;
    if (Math.abs(st.freq - r.freq) > span) continue;
    const dbm = world.rxDbm(st) - r.rfAtt;
    let keyed = true;
    if (st.tx.sch) { const el = t - st.tx.start; keyed = st.tx.sch.segs.some((s) => el >= s.t0 && el <= s.t1); }
    const kind = st.mode === 'WFM' ? 'wfm' : st.mode === 'AM' && st.tx.kind !== 'amtone' ? 'am' : st.mode === 'CW' || st.tx.kind === 'cwtone' || st.tx.kind === 'amtone' ? 'cw' : st.mode === 'FT8' ? 'ft8' : st.mode === 'FM' ? 'fm' : 'voice';
    addSig(st.freq, dbm, kind, st.sb, keyed || kind === 'am' || kind === 'wfm', seedOf(st));
  }
  if (net.waterfall) for (const p of net.waterfall()) addSig(p.freq, p.dbm, p.kind, p.sb, true, seedOf(p));
  if (txState.active) addSig(txState.freq, -40, txState.mode === 'CW' ? 'cw' : txState.mode === 'FM' ? 'fm' : 'voice', txState.mode, txState.keyed, 99);
  for (let i = 0; i < Wb; i++) if (pw[i] > 0) bins[i] = 10 * Math.log10(Math.pow(10, bins[i] / 10) + pw[i]);
  return bins;
}

function updateWfTools() {
  if (!wfTools) return;
  wfTools.querySelector('.wf-span').textContent = fmtSpan(spanHz());
  const z = zoomIdx();
  wfTools.querySelector('.wf-in').disabled = z === 0;
  wfTools.querySelector('.wf-out').disabled = z === 4;
  wfTools.querySelector('.wf-speed').value = S.settings.wfSpeed || 'normal';
}

export function drawFrame() {
  if (!wf || !panel.offsetParent) return;
  const cw = wf.clientWidth, ch = wf.clientHeight;
  if (!cw || !ch) return;
  const k = Math.min(window.devicePixelRatio || 1, 2);
  const W = Math.round(cw * k), H = Math.round(ch * k);
  if (wf.width !== W || wf.height !== H) { wf.width = W; wf.height = H; wfBuf = null; }
  const specH = Math.round(90 * k), wfH = H - specH;
  const r = R(), rs = rigStatus();
  const span = spanHz(), f0 = r.freq - span / 2, hzPerBin = span / W;
  const nf = rx.noiseDbm, nfBin = nf - 10 * Math.log10(2400 / hzPerBin); // noise per bin
  const t = now();
  const bins = computeBins(W, span, f0, nfBin, t, rs, r);

  // waterfall buffer: scroll sideways when retuned, clear when the span changes
  if (!wfBuf || wfBuf.width !== W || wfBuf.height !== wfH) { wfBuf = document.createElement('canvas'); wfBuf.width = W; wfBuf.height = wfH; wfBufCtx = wfBuf.getContext('2d'); wfReset = true; }
  if (wfReset || span !== lastWfSpan) { wfBufCtx.fillStyle = '#05080d'; wfBufCtx.fillRect(0, 0, W, wfH); trace = null; wfReset = false; }
  else if (lastWfFreq != null && lastWfFreq !== r.freq) {
    const dx = Math.round(((lastWfFreq - r.freq) / span) * W);
    wfBufCtx.globalCompositeOperation = 'copy'; wfBufCtx.drawImage(wfBuf, dx, 0); wfBufCtx.globalCompositeOperation = 'source-over';
    wfBufCtx.fillStyle = '#05080d';
    if (dx > 0) wfBufCtx.fillRect(0, 0, dx, wfH); else if (dx < 0) wfBufCtx.fillRect(W + dx, 0, -dx, wfH);
    trace = null;
  }
  lastWfFreq = r.freq; lastWfSpan = span;
  // rows due since the last frame, at a fixed rate (rows per second)
  const nowMs = performance.now(), dt = wfLastT ? Math.min(0.5, (nowMs - wfLastT) / 1000) : 0;
  wfLastT = nowMs;
  wfAcc += dt * (WF_RATES[S.settings.wfSpeed] || WF_RATES.normal);
  const rows = Math.min(Math.floor(wfAcc), 30);
  wfAcc -= rows;
  if (rows > 0) {
    wfBufCtx.globalCompositeOperation = 'copy'; wfBufCtx.drawImage(wfBuf, 0, rows); wfBufCtx.globalCompositeOperation = 'source-over';
    const img = wfBufCtx.createImageData(W, rows);
    for (let row = 0; row < rows; row++) {
      const b = row === 0 ? bins : computeBins(W, span, f0, nfBin, t - row / 30, rs, r);
      for (let i = 0; i < W; i++) {
        const n = Math.round(clamp((b[i] - nfBin + 4) / 50, 0, 1) * 255) * 3, o = (row * W + i) * 4;
        img.data[o] = COLORS[n]; img.data[o + 1] = COLORS[n + 1]; img.data[o + 2] = COLORS[n + 2]; img.data[o + 3] = 255;
      }
    }
    wfBufCtx.putImageData(img, 0, 0);
  }
  wfCtx.setTransform(1, 0, 0, 1, 0, 0);
  wfCtx.drawImage(wfBuf, 0, specH);

  // spectrum trace (lightly smoothed, as most radios do)
  if (!trace || trace.length !== W) trace = Float32Array.from(bins);
  else for (let i = 0; i < W; i++) trace[i] = trace[i] * 0.55 + bins[i] * 0.45;
  wfCtx.fillStyle = '#05080d'; wfCtx.fillRect(0, 0, W, specH);
  const band = bandOf(r.freq);
  const xOf = (f) => ((f - f0) / span) * W;
  if (band) {
    wfCtx.fillStyle = 'rgba(255,60,60,0.15)';
    if (band.lo > f0) wfCtx.fillRect(0, 0, xOf(band.lo), specH);
    if (band.hi < f0 + span) wfCtx.fillRect(xOf(band.hi), 0, W - xOf(band.hi), specH);
    for (const seg of privilegeMap(S.license, band)) {
      wfCtx.fillStyle = seg.allow === 'ALL' ? 'rgba(80,220,120,0.55)' : 'rgba(90,160,255,0.55)';
      wfCtx.fillRect(xOf(seg.lo), specH - 5 * k, xOf(seg.hi) - xOf(seg.lo), 5 * k);
    }
  }
  const top = nfBin + 70, rng = 85; // display from 15 dB below the noise to 70 dB above
  wfCtx.strokeStyle = '#7fe0ff'; wfCtx.lineWidth = k; wfCtx.beginPath();
  for (let i = 0; i < W; i++) { const y = specH - 8 * k - clamp((trace[i] - (top - rng)) / rng, 0, 1) * (specH - 14 * k); i ? wfCtx.lineTo(i, y) : wfCtx.moveTo(i, y); }
  wfCtx.stroke();
  // passband overlay
  const d = dialHz(), w = r.filter[r.mode];
  let pl, ph;
  if (r.mode === 'USB') { pl = d + 250; ph = d + 250 + w; } else if (r.mode === 'LSB') { pl = d - 250 - w; ph = d - 250; }
  else { pl = d - w / 2; ph = d + w / 2; }
  wfCtx.fillStyle = 'rgba(255,255,255,0.08)'; wfCtx.fillRect(xOf(pl), 0, Math.max(2 * k, xOf(ph) - xOf(pl)), H);
  wfCtx.strokeStyle = '#ff4d4d'; wfCtx.lineWidth = k; wfCtx.beginPath(); wfCtx.moveTo(W / 2 + 0.5, 0); wfCtx.lineTo(W / 2 + 0.5, specH); wfCtx.stroke();
  // frequency scale: aim for a label every ~110 CSS pixels
  wfCtx.fillStyle = '#9fb3c8'; wfCtx.font = `${10 * k}px monospace`;
  const raw = span / (cw / 110), mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const tick = [1, 2, 5, 10].map((m) => m * mag).find((x) => x >= raw);
  for (let f = Math.ceil(f0 / tick) * tick; f < f0 + span; f += tick) {
    const x = xOf(f); wfCtx.fillRect(x, specH - 12 * k, k, 4 * k);
    const lab = f >= 30e6 ? (f / 1e6).toFixed(tick >= 100000 ? 1 : tick >= 10000 ? 2 : 3) : (f / 1000).toFixed(tick >= 1000 ? 0 : 1);
    wfCtx.fillText(lab, x - wfCtx.measureText(lab).width / 2, specH - 14 * k);
  }
  if (S.settings.lab && rs.powered) {
    const s = rx.strongest;
    wfCtx.font = `${11 * k}px ui-monospace, monospace`; wfCtx.fillStyle = 'rgba(0,0,0,0.6)'; wfCtx.fillRect(4 * k, 4 * k, Math.min(W - 8 * k, 600 * k), 30 * k);
    wfCtx.fillStyle = '#9dffb9';
    wfCtx.fillText(`Noise ${rx.noiseDbm.toFixed(1)} dBm (${nfBin.toFixed(1)} dBm/bin, ${hzPerBin.toFixed(0)} Hz bins)  S-meter ${rx.smeterDbm.toFixed(1)} dBm${s ? `  Sig ${s.dbm.toFixed(1)} dBm  SNR ${s.snr.toFixed(1)} dB` : ''}`, 10 * k, 16 * k);
    if (s) { const p = s.st.path || {}; wfCtx.fillText(`${s.st.call}  ${s.st.op.qth || ''}  ${p.dist ? Math.round(p.dist) + ' km' : ''}  brg ${p.brg != null ? Math.round(p.brg) + '°' : '?'}  path ${p.mode || '?'}  loss ${p.loss ? p.loss.toFixed(1) + ' dB' : '?'}  off ${(s.off >= 0 ? '+' : '') + Math.round(s.off)} Hz`, 10 * k, 29 * k); }
  }
  if (!rs.powered) { wfCtx.fillStyle = '#ffd166'; wfCtx.font = `${16 * k}px sans-serif`; const m = 'Radio is off — complete the Station wiring'; wfCtx.fillText(m, (W - wfCtx.measureText(m).width) / 2, specH / 2); }
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
