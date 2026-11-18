// Handheld (HT) view: what the app opens to on a phone. A dual-band handheld the way the
// popular ones really work: two-line A/B display, VFO/MR, BAND, a numbered MENU on the LCD
// (▲▼ to pick, MENU to edit, EXIT to back out), *SCAN, #LOCK, side MONI and CALL keys, a
// volume knob, and a big PTT. It drives the same simulation as the full station.
import { S, save, licName } from './state.js';
import { h, bus, toast, hashStr, clamp } from './util.js';
import { rx, setFreq, setMode } from './radio.js';
import { pttDown, pttUp, sendVoice, txState } from './operating.js';
import { channels as svcChannels, SVC } from './activity.js';
import { RW, WX_CHANNELS, HEAR, wantBroadcast, wantAirports } from './realworld.js';
import { rig, rigRx, RIGS, isHT } from './rigs.js';
import { sUnits } from './propagation.js';
import { net } from './net.js';
import { openStation, applySetup, cutFor } from './setups.js';
import { audio } from './audio.js';

export const isPhone = () => window.matchMedia('(max-width: 760px)').matches || (window.matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 600);

const TONES = [0, 67.0, 71.9, 74.4, 77.0, 79.7, 82.5, 85.4, 88.5, 91.5, 94.8, 97.4, 100.0, 103.5, 107.2, 110.9, 114.8, 118.8, 123.0, 127.3, 131.8, 136.5, 141.3, 146.2, 151.4, 156.7, 162.2, 167.9, 173.8, 179.9, 186.2, 192.8, 203.5, 210.7, 218.1, 225.7, 233.6, 241.8, 250.3];
const STEPS = [2500, 5000, 6250, 10000, 12500, 25000];
// The tones a second-function press on 8 steps through (the common repeater tones).
const COMMON_TONES = [0, 67.0, 88.5, 100.0, 103.5, 107.2, 110.9, 114.8, 123.0, 127.3, 131.8, 136.5, 141.3, 146.2, 151.4, 156.7, 162.2, 167.9, 173.8, 179.9, 186.2, 192.8, 203.5, 210.7, 218.1, 225.7, 233.6, 241.8, 250.3];
const HOLD_MS = 600, F_MS = 3000;
let root, lcd, entry = '', scanning = false, scanTimer = null, lastSub = '', monitor = false;
let fnUntil = 0, fnTimer = null, lcdMsg = null; // F (function) armed until; brief LCD confirmation

const HT = () => (S.ht ||= { vfo: { a: { f: 146.52e6, mode: 'FM', off: 0, tone: 0 }, b: { f: 146.94e6, mode: 'FM', off: -600000, tone: 100 } }, act: 'a', mr: { a: false, b: true }, ch: { a: 0, b: 0 }, menu: null, txp: 'H', beep: true, step: 5000, lock: false, fmRadio: false, offset: 600000 });

// Built-in channels from the real world around you, plus your saved memories.
export function channels() {
  const L = [];
  L.push({ name: 'RPTR', f: 146.94e6, mode: 'FM', off: -600000, tone: 100.0, note: `${S.local?.rpt || 'Local'} repeater` });
  L.push({ name: 'SIMPLX', f: 146.52e6, mode: 'FM', note: '2 m national simplex calling' });
  L.push({ name: 'NOAA WX', f: WX_CHANNELS[hashStr(RW.nws?.office || 'NWS') % 7], mode: 'FM', note: 'NOAA Weather Radio' });
  L.push({ name: 'HEAR', f: HEAR, mode: 'FM', note: 'Ambulance ↔ hospital' });
  L.push({ name: '70CM SX', f: 446.0e6, mode: 'FM', note: '70 cm national simplex (receive)' });
  const ap = RW.airports[0];
  const tw = ap?.freqs.find((x) => /TWR/i.test(x.type)) || ap?.freqs.find((x) => /CTAF|UNIC/i.test(x.type));
  if (tw) L.push({ name: `${ap.ident} TWR`, f: Math.round(tw.mhz * 1e6), mode: 'AM', note: ap.name });
  const at = ap?.freqs.find((x) => /ATIS|AWOS|ASOS/i.test(x.type));
  if (at) L.push({ name: `${ap.ident} ATIS`, f: Math.round(at.mhz * 1e6), mode: 'AM', note: `${ap.name} weather` });
  L.push({ name: 'GUARD', f: 121.5e6, mode: 'AM', note: 'Aviation emergency' });
  for (const c of svcChannels().filter((x) => ['FIRE', 'RAIL', 'MARINE 16', 'BUSINESS', 'FRS 1'].includes(x.call))) L.push({ name: c.call.replace('MARINE 16', 'MAR 16').replace('BUSINESS', 'JOBSITE'), f: c.f, mode: 'FM', note: c.name });
  L.push({ name: 'APRS', f: SVC.aprs, mode: 'FM', note: 'APRS packet data, 1200 baud' });
  for (const m of S.htMem || []) L.push({ ...m, mine: true });
  return L.filter((c) => rigRx(c.f) && rig().modes.includes(c.mode));
}

// Copy the active VFO line into the radio (or back).
const cur = () => HT().vfo[HT().act];
function load(line = HT().act) {
  const v = HT().vfo[line];
  if (!rigRx(v.f)) { v.f = channels()[0]?.f || rig().rx[0]; v.mode = 'FM'; }
  if (!rig().modes.includes(v.mode)) v.mode = rig().modes[0];
  S.radio.rptOffset = v.off || 0; S.radio.toneHz = v.tone || 0;
  setFreq(v.f, { mode: v.mode }); setMode(v.mode);
}
function store() { const v = cur(), r = S.radio; if (v.f === r.freq && v.mode === r.mode && v.off === r.rptOffset && v.tone === r.toneHz) return; v.f = r.freq; v.mode = r.mode; v.off = r.rptOffset; v.tone = r.toneHz; save(); }

function selectCh(i) {
  const L = channels();
  if (!L.length) return;
  const ht = HT(), n = (i + L.length) % L.length;
  ht.ch[ht.act] = n;
  const c = L[n];
  Object.assign(cur(), { f: c.f, mode: c.mode, off: c.off || 0, tone: c.tone || 0 });
  load(); save(); draw();
}

// Pick up a handheld: switch to a handheld radio with its own rubber-duck antenna, and
// remember the base station so it comes back when you return to the full station.
function takeHandheld() {
  if (isHT()) return;
  S.htPrev = { rig: S.rig || 'allmode', antenna: { ...S.antenna }, freq: S.radio.freq, mode: S.radio.mode, power: S.radio.power };
  S.rig = S.htRig && RIGS[S.htRig]?.look === 'ht' ? S.htRig : 'uv5r';
  S.antenna = { ...S.antenna, type: 'vertical', length: cutFor('vertical', '2m'), radials: 0, feed: 'RG-58', feedLen: 0.5, height: 5, built: true, sizedBy: 'auto' };
  S.radio.power = Math.min(S.radio.power, rig().maxW);
  if (!rigRx(S.radio.freq)) { S.radio.freq = HT().vfo[HT().act].f; S.radio.mode = 'FM'; }
  save(); bus.emit('rig'); bus.emit('antenna');
}
function putDownHandheld() {
  const p = S.htPrev;
  if (!p || !isHT()) return;
  S.htRig = S.rig;
  S.rig = p.rig; S.antenna = p.antenna; S.radio.power = p.power ?? S.radio.power;
  delete S.htPrev;
  save(); bus.emit('rig'); bus.emit('antenna'); bus.emit('antenna-rebuild');
  setFreq(p.freq, { mode: p.mode }); setMode(p.mode);
}

export function showHT(on) {
  if (on) takeHandheld(); else putDownHandheld();
  document.body.classList.toggle('ht-view', !!on);
  S.settings.view = on ? 'ht' : 'station';
  save();
  if (on) { wantAirports(); if (isHT()) load(); draw(); }
  bus.emit('view', on ? 'ht' : 'station');
}

// First time on a phone: hand the operator a handheld.
export function phoneStart() {
  if (S.htGranted) return;
  S.htGranted = true;
  (S.owned ||= []).includes('rig-ht') || S.owned.push('rig-ht');
  (S.owned).includes('rig-uv5r') || S.owned.push('rig-uv5r');
  save();
  { applySetup('ht', { quiet: true }); S.rig = 'uv5r'; save(); bus.emit('rig'); }
}

// ------------------------------------------------------------------ menu system (on the LCD)
const MENU = [
  ['SQL', () => ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'], () => String(Math.round(S.radio.sql * 9)), (v) => { S.radio.sql = +v / 9; }],
  ['STEP', () => STEPS.map((s) => (s / 1000).toFixed(2)), () => (HT().step / 1000).toFixed(2), (v) => { HT().step = Math.round(+v * 1000); }],
  ['TXP', () => ['HIGH', 'LOW'], () => (HT().txp === 'L' ? 'LOW' : 'HIGH'), (v) => { HT().txp = v[0]; S.radio.power = v === 'LOW' ? 1 : rig().maxW; }],
  ['SFT-D', () => ['OFF', '+', '-'], () => (S.radio.rptOffset > 0 ? '+' : S.radio.rptOffset < 0 ? '-' : 'OFF'), (v) => { S.radio.rptOffset = v === 'OFF' ? 0 : (v === '+' ? 1 : -1) * HT().offset; }],
  ['OFFSET', () => ['0.600', '1.600', '5.000'], () => (HT().offset / 1e6).toFixed(3), (v) => { HT().offset = Math.round(+v * 1e6); if (S.radio.rptOffset) S.radio.rptOffset = Math.sign(S.radio.rptOffset) * HT().offset; }],
  ['T-CTCS', () => TONES.map((t) => (t ? t.toFixed(1) : 'OFF')), () => (S.radio.toneHz ? S.radio.toneHz.toFixed(1) : 'OFF'), (v) => { S.radio.toneHz = v === 'OFF' ? 0 : +v; }],
  ['BEEP', () => ['ON', 'OFF'], () => (HT().beep ? 'ON' : 'OFF'), (v) => { HT().beep = v === 'ON'; }],
  ['MEM-CH', () => ['SAVE'], () => `${(S.htMem || []).length} USED`, () => { saveMem(); }],
  ['DEL-CH', () => ['CLEAR ALL'], () => `${(S.htMem || []).length} USED`, () => { S.htMem = []; toast('Memories cleared.', 'info', 2000); }],
];
function saveMem() {
  const n = prompt('Channel name (up to 6 characters):', `CH${(S.htMem || []).length + 1}`);
  if (!n) return;
  (S.htMem ||= []).push({ name: n.toUpperCase().slice(0, 6), f: S.radio.freq, mode: S.radio.mode, off: S.radio.rptOffset, tone: S.radio.toneHz });
  save(); toast(`Saved to memory ${S.htMem.length}.`, 'good', 2000);
}
function menuKey(k) {
  const ht = HT();
  const m = ht.menu;
  if (k === 'MENU') {
    if (!m) ht.menu = { i: 0, edit: false };
    else if (!m.edit) { m.edit = true; const [, opts, get] = MENU[m.i]; m.vals = opts(); m.v = Math.max(0, m.vals.indexOf(get())); }
    else { MENU[m.i][3](m.vals[m.v]); m.edit = false; save(); if (HT().beep) audio.beep(1800, 0.05, 0.12); }
  } else if (k === 'EXIT') { if (m?.edit) m.edit = false; else ht.menu = null; }
  else if (k === 'UP' || k === 'DN') {
    const d = k === 'UP' ? -1 : 1;
    if (m.edit) m.v = (m.v + d + m.vals.length) % m.vals.length; else m.i = (m.i + d + MENU.length) % MENU.length;
  }
  draw();
}

// ------------------------------------------------------------------ keys
function digit(d) {
  const ht = HT();
  if (ht.mr[ht.act]) { entry = (entry + d).slice(-3); if (entry.length >= 2 || +entry * 10 > channels().length) { const n = +entry - 1; entry = ''; if (n >= 0 && n < channels().length) selectCh(n); } draw(); return; }
  entry = (entry + d).slice(0, 6);
  if (entry.length === 6) {
    const hz = +entry * 1000; entry = '';
    if (!rigRx(hz)) { toast(`Out of range: the ${rig().name} doesn't receive ${hz / 1e6} MHz.`, 'warn', 3000); return draw(); }
    const mode = hz >= 88e6 && hz < 108e6 ? 'WFM' : hz >= 108e6 && hz < 137e6 ? 'AM' : 'FM';
    const rpt = hz >= 145.1e6 && hz < 147.4e6 && (hz < 146.4e6 || hz > 146.6e6) ? (hz < 147e6 ? -600000 : 600000) : hz >= 442e6 && hz < 450e6 ? 5000000 : 0;
    Object.assign(cur(), { f: hz, mode: rig().modes.includes(mode) ? mode : 'FM', off: rpt, tone: rpt ? cur().tone : 0 });
    load();
  }
  draw();
}
function step(n) { const st = S.radio.mode === 'WFM' ? 100000 : S.radio.mode === 'AM' ? 25000 : HT().step; setFreq(Math.round(S.radio.freq / st) * st + n * st); store(); draw(); }
function arrow(n) {
  const ht = HT();
  if (ht.menu) return menuKey(n > 0 ? 'UP' : 'DN');
  if (ht.mr[ht.act]) selectCh(ht.ch[ht.act] + n); else step(n);
}
function band() {
  // cycle VHF → UHF → FM broadcast (where the radio can receive them)
  const opts = [[146.52e6, 'FM'], [446.0e6, 'FM'], [98.1e6, 'WFM'], [121.5e6, 'AM']].filter(([f, m]) => rigRx(f) && rig().modes.includes(m));
  const i = opts.findIndex(([f]) => Math.abs(f - S.radio.freq) < 60e6 && (f > 400e6) === (S.radio.freq > 400e6) && (f < 110e6) === (S.radio.freq < 110e6) && (f > 108e6 && f < 137e6) === (S.radio.freq > 108e6 && S.radio.freq < 137e6));
  const [f, m] = opts[(i + 1) % opts.length];
  HT().mr[HT().act] = false;
  Object.assign(cur(), { f, mode: m, off: 0, tone: 0 }); load(); draw();
}
// ------------------------------------------------------------------ second functions
// Reached by holding a key (budget handhelds) or by F then the key (rugged handhelds).
function fnDone(msg, lcdText = msg) {
  if (HT().beep) audio.beep(1800, 0.05, 0.12);
  lcdMsg = { text: lcdText, until: Date.now() + 2000 };
  save(); draw();
  toast(msg, 'info', 1600);
}
function toggleTxp() {
  const ht = HT();
  ht.txp = ht.txp === 'L' ? 'H' : 'L';
  S.radio.power = ht.txp === 'L' ? Math.min(1, rig().maxW) : rig().maxW;
  fnDone(`TX power ${ht.txp === 'L' ? 'LOW' : 'HIGH'}: ${S.radio.power} W`, `TX POWER ${ht.txp === 'L' ? 'LOW' : 'HIGH'} ${S.radio.power} W`);
}
const isRev = (k = HT().act) => { const r = HT().rev; return !!(r && r[k] && r[k] === HT().vfo[k].f); };
function toggleReverse() {
  store();
  const ht = HT(), v = cur(), on = isRev();
  if (!on && !v.off) return fnDone('Reverse needs a repeater shift (this is simplex). Set one with SFT.', 'REVERSE: NO SHIFT');
  // Swap receive and transmit: listen on the repeater input, transmit on its output.
  const f = v.f + v.off;
  if (!rigRx(f)) return fnDone(`Can't reverse: ${(f / 1e6).toFixed(3)} MHz is out of range.`, 'REVERSE: OUT OF RANGE');
  v.f = f; v.off = -v.off;
  (ht.rev ||= {})[ht.act] = on ? 0 : v.f;
  load();
  fnDone(on ? `Reverse off: listening on ${(v.f / 1e6).toFixed(3)} MHz.` : `Reverse on: listening on the repeater input, ${(v.f / 1e6).toFixed(3)} MHz.`, on ? 'REVERSE OFF' : `REVERSE ${(v.f / 1e6).toFixed(3)}`);
}
function cycleShift() {
  store();
  const ht = HT(), v = cur();
  if (isRev()) { v.f += v.off; v.off = -v.off; ht.rev[ht.act] = 0; } // leave reverse first
  v.off = v.off === 0 ? -ht.offset : v.off < 0 ? ht.offset : 0;
  load();
  const mhz = (ht.offset / 1e6).toFixed(3);
  fnDone(v.off ? `Shift ${v.off < 0 ? '−' : '+'}${mhz} MHz: transmit on ${((v.f + v.off) / 1e6).toFixed(3)}.` : 'Shift off (simplex).', v.off ? `SHIFT ${v.off < 0 ? '−' : '+'} ${mhz}` : 'SHIFT OFF');
}
function cycleTone() {
  store();
  const v = cur(), t = v.tone || 0;
  const next = COMMON_TONES.find((x) => x > t + 0.05);
  v.tone = next ?? 0;
  load();
  fnDone(v.tone ? `CTCSS tone ${v.tone.toFixed(1)} Hz (hold again for the next one).` : 'CTCSS tone off.', v.tone ? `TONE ${v.tone.toFixed(1)} Hz` : 'TONE OFF');
}
function toggleLock() {
  HT().lock = !HT().lock;
  audio.beep(900, 0.08, 0.1);
  lcdMsg = { text: HT().lock ? 'KEY LOCK' : 'UNLOCKED', until: Date.now() + 2000 };
  save(); draw();
  toast(HT().lock ? 'Keypad locked: hold # to unlock.' : 'Keypad unlocked.', 'info', 1600);
}
function armF(on = true) {
  clearTimeout(fnTimer);
  fnUntil = on ? Date.now() + F_MS : 0;
  if (on) fnTimer = setTimeout(() => { fnUntil = 0; draw(); }, F_MS);
  draw();
}
const fnArmed = () => fnUntil > Date.now();
const accentName = (hex) => {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
  if (!m) return 'coloured';
  const [r, g, b] = m.slice(1).map((x) => parseInt(x, 16) / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  if (mx - mn < 0.15) return 'grey';
  const d = mx - mn, hu = 60 * (mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4);
  return hu < 20 || hu >= 330 ? 'red' : hu < 50 ? 'orange' : hu < 70 ? 'yellow' : hu < 170 ? 'green' : hu < 260 ? 'blue' : 'purple';
};

function toggleScan() {
  scanning = !scanning;
  clearInterval(scanTimer);
  let hold = 0;
  if (scanning) {
    const ht = HT();
    scanTimer = setInterval(() => {
      const busy = rx.smeterDbm > rx.noiseDbm + 10;
      if (busy) { hold = 10; return; } // stop on activity, like a real scanner (resumes after it clears)
      if (hold > 0) { hold--; return; }
      if (ht.mr[ht.act]) selectCh(ht.ch[ht.act] + 1); else step(1);
    }, 500);
  }
  draw();
}

export function initHT(el) {
  root = el;
  root.innerHTML = '';
  const r = rig(), look = r.ht || { body: '#1a1c1f', accent: '#f39a1e', lcd: 'amber' };
  root.style.setProperty('--ht-body', look.body);
  root.style.setProperty('--ht-accent', look.accent);
  root.dataset.lcd = look.lcd;
  const beep = () => { if (HT().beep) audio.beep(HT().menu ? 1500 : 1200, 0.03, 0.08); };
  // A key: short press runs fn. If it has a second function (alt, shown as the coloured
  // sub-label), holding it for HOLD_MS runs alt instead, and so does pressing it right after F.
  const locked = (cls) => { if (HT().lock && !/lock/.test(cls)) { toast('Keypad locked — hold # to unlock.', 'info', 1500); return true; } return false; };
  const key = (lbl, fn, cls = '', sub = '', alt = null) => {
    let t = null, fired = false;
    const b = h('button', { class: `ht-key ${cls}`, onclick: (e) => {
      audio.init();
      if (fired) { fired = false; return; } // the hold already did its job
      if (/fn|menu/.test(cls)) entry = '';
      if (fnArmed() && !/fkey/.test(cls)) { armF(false); if (alt) { if (locked(cls)) return; entry = ''; return alt(e); } }
      if (locked(cls)) return;
      beep(); fn(e);
    } }, lbl, sub ? h('small', {}, sub) : null);
    if (alt) {
      const stop = () => { clearTimeout(t); b.classList.remove('holding'); };
      b.addEventListener('pointerdown', (e) => {
        if (e.button > 0) return;
        fired = false; clearTimeout(t); b.classList.add('holding');
        t = setTimeout(() => {
          b.classList.remove('holding'); fired = true; audio.init();
          if (locked(cls)) return;
          armF(false); entry = '';
          b.classList.add('alt-done'); setTimeout(() => b.classList.remove('alt-done'), 350);
          alt();
        }, HOLD_MS);
      });
      b.addEventListener('pointerup', stop); b.addEventListener('pointercancel', () => { stop(); fired = false; }); b.addEventListener('pointerleave', stop);
      b.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    return b;
  };
  const ptt = h('button', { class: 'ht-ptt', 'aria-label': 'Push to talk' }, 'PTT');
  const down = (e) => { e.preventDefault(); audio.init(); if (scanning) toggleScan(); if (!r.tx.length) return toast('Receive-only radio.', 'warn', 2000); pttDown(); ptt.classList.add('on'); };
  const up = (e) => { e.preventDefault(); if (txState.ptt) pttUp(); ptt.classList.remove('on'); };
  ptt.addEventListener('pointerdown', down); ptt.addEventListener('pointerup', up); ptt.addEventListener('pointercancel', up); ptt.addEventListener('pointerleave', up);
  ptt.addEventListener('contextmenu', (e) => e.preventDefault());
  const moni = h('button', { class: 'ht-side', title: 'MONI: hold to open the squelch' }, 'MONI');
  const mOn = (e) => { e.preventDefault(); monitor = S.radio.sql; S.radio.sql = 0; moni.classList.add('on'); };
  const mOff = () => { if (monitor !== false) { S.radio.sql = monitor; monitor = false; } moni.classList.remove('on'); };
  moni.addEventListener('pointerdown', mOn); moni.addEventListener('pointerup', mOff); moni.addEventListener('pointerleave', mOff);
  const call = h('button', { class: 'ht-side', title: 'CALL: FM broadcast radio on/off', onclick: () => {
    const ht = HT();
    if (!rigRx(98.1e6) || !rig().modes.includes('WFM')) return toast('This radio has no FM broadcast receiver.', 'info', 2000);
    ht.fmRadio = !ht.fmRadio;
    if (ht.fmRadio) { ht.fmBack = { ...cur() }; Object.assign(cur(), { f: ht.fmF || 98.1e6, mode: 'WFM', off: 0, tone: 0 }); wantBroadcast(); } else { ht.fmF = S.radio.freq; Object.assign(cur(), ht.fmBack || cur()); }
    load(); draw();
  } }, 'CALL');
  // volume knob: drag/scroll to turn
  const knob = h('div', { class: 'ht-vol', title: 'Volume: drag or scroll' }, h('i'));
  const setVol = (v) => { S.radio.af = clamp(v, 0, 1); knob.style.setProperty('--rot', `${-135 + S.radio.af * 270}deg`); save(); };
  setVol(S.radio.af);
  let kd = null;
  knob.addEventListener('pointerdown', (e) => { kd = { y: e.clientY, v: S.radio.af }; knob.setPointerCapture(e.pointerId); });
  knob.addEventListener('pointermove', (e) => { if (kd) setVol(kd.v + (kd.y - e.clientY) / 150); });
  knob.addEventListener('pointerup', () => { kd = null; });
  knob.addEventListener('wheel', (e) => { e.preventDefault(); setVol(S.radio.af - Math.sign(e.deltaY) * 0.05); }, { passive: false });
  // long-press # (or F, #) to lock/unlock
  const lockK = key('#', () => {}, 'lock', 'LOCK', toggleLock);

  lcd = h('div', { class: 'ht-lcd' });
  const call0 = () => S.call || 'N0CALL';
  const quick = h('div', { class: 'ht-quick' },
    ...[['Listening', () => `§${call0()}§ listening.`], ['CQ', () => `CQ CQ, this is §${call0()}§, monitoring.`], ['Roger', () => `Roger, thanks. §${call0()}§.`], ['73', () => `{73|Seventy three}, §${call0()}§ clear.`]]
      .map(([l, t]) => h('button', { class: 'ht-chip', onclick: () => { audio.init(); sendVoice(t()); } }, l)));
  const htModels = Object.entries(RIGS).filter(([, x]) => x.look === 'ht');
  const menu = h('details', { class: 'ht-menu' }, h('summary', {}, '☰'),
    h('div', { class: 'ht-menu-list' },
      h('div', { class: 'tiny muted ht-hint' }, `Hold a key for its second function (${accentName(look.accent)} label)${look.keys === 'classic' ? ', or press F then the key' : ''}.`),
      h('hr'),
      h('div', { class: 'tiny muted' }, 'Handheld model'),
      ...htModels.map(([id, x]) => h('button', { class: S.rig === id ? 'sel' : '', onclick: () => { S.rig = id; HT().txp = 'H'; S.radio.power = x.maxW; save(); bus.emit('rig'); toast(`${x.name}`, 'good', 2000); } }, `${S.rig === id ? '● ' : ''}${x.name}`)),
      h('hr'),
      h('button', { onclick: () => bus.emit('open-manual', S.rig) }, 'Operating guide'),
      h('button', { onclick: () => showHT(false) }, 'Full station view'),
      h('button', { onclick: () => { showHT(false); bus.emit('goto', 'license'); } }, `License & study (${licName()})`),
      h('button', { onclick: () => { showHT(false); bus.emit('goto', 'logbook'); } }, 'Logbook'),
      h('button', { onclick: () => { showHT(false); bus.emit('goto', 'rigbuilder'); } }, 'Equipment'),
      h('button', { onclick: () => openStation('setups') }, 'Station setups'),
      h('button', { onclick: () => bus.emit('open-settings') }, 'Settings')));

  const isUV = look.keys === 'uv';
  root.append(h('div', { class: `ht-wrap ${S.settings.leftHand ? 'left' : ''}` },
    h('div', { class: 'ht-side-keys' }, ptt, call, moni),
    h('div', { class: 'ht-body' },
      h('div', { class: 'ht-antenna' }), h('div', { class: 'ht-knobs' }, knob, h('div', { class: 'ht-torch', title: 'Flashlight' }), h('div', { class: 'ht-led', id: 'ht-led' })),
      h('div', { class: 'ht-top row spread' }, h('span', { class: 'ht-brand' }, isUV ? 'DUAL BAND FM TRANSCEIVER' : 'VHF/UHF FM TRANSCEIVER'), menu),
      h('div', { class: 'ht-grille' }),
      lcd,
      h('div', { class: 'ht-model' }, r.code || r.name),
      h('div', { class: 'ht-row4' }, key('VFO/MR', () => { const ht = HT(); ht.mr[ht.act] = !ht.mr[ht.act]; if (ht.mr[ht.act]) selectCh(ht.ch[ht.act]); else draw(); }, 'fn'),
        key('A/B', () => { store(); HT().act = HT().act === 'a' ? 'b' : 'a'; load(); draw(); }, 'fn'), key('BAND', band, 'fn'),
        isUV ? key('', () => document.body.classList.toggle('ht-torch-on'), 'fn')
          : key('F', () => armF(!fnArmed()), 'fn fkey', 'LIGHT', () => { document.body.classList.toggle('ht-torch-on'); fnDone(`Flashlight ${document.body.classList.contains('ht-torch-on') ? 'on' : 'off'}.`, 'LIGHT'); })),
      h('div', { class: 'ht-row4' }, key('MENU', () => menuKey('MENU'), 'menu'), key('▲', () => arrow(1), 'arr'), key('▼', () => arrow(-1), 'arr'), key('EXIT', () => { if (HT().menu) menuKey('EXIT'); else { entry = ''; draw(); } }, 'menu')),
      h('div', { class: 'ht-pad' }, ...['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => {
          const [sub, alt] = { 2: ['TX.P', toggleTxp], 4: ['T.R', toggleReverse], 6: ['SFT', cycleShift], 8: ['CTCS', cycleTone] }[d] || [];
          return key(d, () => digit(d), '', sub, alt);
        }),
        key('*', toggleScan, 'scan', 'SCAN', () => { toggleScan(); fnDone(scanning ? 'Scanning: stops on activity. Press * or PTT to stop.' : 'Scan stopped.', scanning ? 'SCAN' : 'SCAN OFF'); }), key('0', () => digit('0')), lockK)),
    h('div', { class: 'ht-extra' },
      h('div', { class: 'row' }, h('label', { class: 'ht-sl' }, 'SQL ', (() => { const s = h('input', { type: 'range', min: 0, max: 1, step: 0.02, value: S.radio.sql }); s.oninput = () => { S.radio.sql = +s.value; save(); }; return s; })()),
        h('button', { class: 'ht-chip', onclick: () => { if (!net.online) { S.settings.autoOnline = true; save(); bus.emit('radio-side', 'players'); document.querySelector('#net-card button.primary')?.click(); } else toast(`On the air with ${net.roster.length} other player(s).`, 'info', 2500); } }, net.online ? `${net.roster.length} online` : 'Go online')),
      quick,
      h('div', { class: 'ht-sub', id: 'ht-sub' }, ''))));
  if (htListeners) return;
  htListeners = true;
  setInterval(() => { if (document.body.classList.contains('ht-view')) draw(); }, 250);
  bus.on('rig', () => {
    if (isHT() && rig().maxW) S.radio.power = HT().txp === 'L' ? Math.min(1, rig().maxW) : rig().maxW; // keep H/L true to the new model
    if (root) { initHT(root); if (document.body.classList.contains('ht-view') && isHT()) load(); }
  });
}
let htListeners = false;

function draw() {
  if (!lcd) return;
  const r = S.radio, ht = HT();
  store();
  const L = channels();
  const s = sUnits(rx.smeterDbm);
  const bars = clamp(s.s + (s.over > 0 ? 1 : 0), 0, 10);
  const tx = txState.active;
  const busy = rx.smeterDbm > rx.noiseDbm + 10;
  const fmt = (f) => (f / 1e6).toFixed(3);
  const line = (k) => {
    const v = ht.vfo[k], act = ht.act === k, mr = ht.mr[k];
    const ch = L.find((c) => Math.abs(c.f - v.f) < 1000);
    const chNo = ch ? L.indexOf(ch) + 1 : null;
    const main = act && entry ? `<span class="ht-entry">${ht.mr[k] ? 'CH-' + entry.padEnd(2, '_') : (entry + '______').slice(0, 6).replace(/(\d{3})(.)/, '$1.$2')}</span>` : mr && ch ? ch.name : fmt(v.f);
    return `<div class="ht-line ${act ? 'act' : ''}"><span class="ht-ab">${act ? '' : '&nbsp;'}${k.toUpperCase()}</span><span class="ht-ico">${v.off ? (v.off < 0 ? '−' : '+') : ''}${v.tone ? 'CT' : ''}${v.mode !== 'FM' ? v.mode[0] : ''}</span><span class="ht-big">${main}</span><span class="ht-chno">${mr && chNo ? chNo : ''}</span></div>`;
  };
  let body;
  if (ht.menu) {
    const m = ht.menu, [name, , get] = MENU[m.i];
    body = `<div class="ht-line act"><span class="ht-ab">${m.i + 1}</span><span class="ht-big">${name}</span></div><div class="ht-line"><span class="ht-ab">${m.edit ? '' : ''}</span><span class="ht-big ${m.edit ? 'blink' : ''}">${m.edit ? m.vals[m.v] : get()}</span></div>`;
  } else body = line('a') + line('b');
  lcd.innerHTML = `
    <div class="ht-lcd-top"><span class="ht-sm">${Array.from({ length: 6 }, (_, i) => `<i class="${i < Math.ceil((tx ? 10 : bars) * 0.6) ? 'on' : ''}"></i>`).join('')}</span><span>${tx ? '<b class="ht-tx">TX</b>' : busy ? 'RX' : ''}</span><span>${ht.txp === 'L' ? 'L' : 'H'}</span><span>${scanning ? 'SCAN' : ''}</span><span>${ht.lock ? '<b class="ht-lk">LOCK</b>' : ''}</span>${fnArmed() ? '<b class="ht-fn">F</b>' : ''}${isRev() ? '<b class="ht-rev">R</b>' : ''}${r.mode === 'FM' && r.toneHz ? `<span class="ht-tone">T${r.toneHz.toFixed(1)}</span>` : ''}<span>${ht.fmRadio ? 'FM' : ''}</span><span class="ht-batt">▮▮▮▯</span></div>
    ${body}
    <div class="ht-note">${lcdMsg && lcdMsg.until > Date.now() && !tx ? `<b>${lcdMsg.text}</b>` : tx ? `${Math.round(txState.watts)} W → ${(txState.freq / 1e6).toFixed(3)}` : (L.find((c) => Math.abs(c.f - r.freq) < 1000)?.note || s.text)}${!S.license ? ' · listen only' : ''}</div>`;
  lcd.classList.toggle('lit', tx || busy || !!entry || !!ht.menu);
  const led = document.getElementById('ht-led');
  if (led) led.className = `ht-led ${tx ? 'tx' : busy ? 'rx' : ''}`;
  const lines = document.querySelectorAll('.transcript .tl');
  const last = lines[lines.length - 1];
  const sub = document.getElementById('ht-sub');
  if (sub && last && last.textContent !== lastSub) { lastSub = last.textContent; sub.textContent = lastSub.slice(0, 160); }
}

export { setFreq };
