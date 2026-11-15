// Handheld (HT) view: what the app opens to on a phone. A realistic handheld faceplate —
// LCD, keypad, memory channels, scan, big push-to-talk — driving the same simulation.
import { S, save, licName } from './state.js';
import { h, $, bus, toast, hashStr, clamp } from './util.js';
import { rx, setFreq, setMode } from './radio.js';
import { pttDown, pttUp, sendVoice, txState } from './operating.js';
import { RW, WX_CHANNELS, HEAR, wantBroadcast, wantAirports } from './realworld.js';
import { rig } from './rigs.js';
import { sUnits } from './propagation.js';
import { net } from './net.js';
import { openStation, applySetup } from './setups.js';
import { owns } from './store.js';
import { audio } from './audio.js';

export const isPhone = () => window.matchMedia('(max-width: 760px)').matches || (window.matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 600);

const TONES = [0, 67.0, 88.5, 100.0, 103.5, 107.2, 110.9, 114.8, 118.8, 123.0, 127.3, 131.8, 136.5, 141.3, 146.2, 151.4, 156.7, 162.2, 167.9, 173.8, 179.9, 186.2, 192.8, 203.5];
let root, lcd, entry = '', chIdx = 0, scanning = false, scanTimer = null, lastSub = '';

// Built-in channels from the real world around you, plus your saved memories.
export function channels() {
  const L = [];
  L.push({ name: 'RPTR', f: 146.94e6, mode: 'FM', off: -600000, tone: 100.0, note: `${S.local?.rpt || 'Local'} repeater` });
  L.push({ name: 'SIMPLX', f: 146.52e6, mode: 'FM', note: '2 m national simplex calling' });
  L.push({ name: 'NOAA WX', f: WX_CHANNELS[hashStr(RW.nws?.office || 'NWS') % 7], mode: 'FM', note: 'NOAA Weather Radio' });
  L.push({ name: 'HEAR', f: HEAR, mode: 'FM', note: 'Ambulance ↔ hospital' });
  const ap = RW.airports[0];
  const tw = ap?.freqs.find((x) => /TWR/i.test(x.type)) || ap?.freqs.find((x) => /CTAF|UNIC/i.test(x.type));
  if (tw) L.push({ name: `${ap.ident} TWR`, f: Math.round(tw.mhz * 1e6), mode: 'AM', note: ap.name });
  const at = ap?.freqs.find((x) => /ATIS|AWOS|ASOS/i.test(x.type));
  if (at) L.push({ name: `${ap.ident} ATIS`, f: Math.round(at.mhz * 1e6), mode: 'AM', note: `${ap.name} weather` });
  L.push({ name: 'GUARD', f: 121.5e6, mode: 'AM', note: 'Aviation emergency' });
  for (const b of (RW.broadcast || []).filter((x) => x.mode === 'WFM').slice(0, 3)) L.push({ name: (b.call || b.name).slice(0, 7), f: b.f, mode: 'WFM', note: b.name });
  for (const m of S.htMem || []) L.push({ ...m, mine: true });
  return L.filter((c) => c.f >= rig().rx[0] && c.f <= rig().rx[1]);
}

function selectCh(i) {
  const L = channels();
  if (!L.length) return;
  chIdx = (i + L.length) % L.length;
  const c = L[chIdx];
  S.radio.rptOffset = c.off || 0; S.radio.toneHz = c.tone || 0;
  setFreq(c.f, { mode: c.mode }); setMode(c.mode);
  save(); draw();
}

export function showHT(on) {
  document.body.classList.toggle('ht-view', !!on);
  S.settings.view = on ? 'ht' : 'station';
  save();
  if (on) { wantBroadcast(); wantAirports(); draw(); }
  bus.emit('view', on ? 'ht' : 'station');
}

// First time on a phone: hand the operator a handheld.
export function phoneStart() {
  if (S.htGranted) return;
  S.htGranted = true;
  (S.owned ||= []).includes('rig-ht') || S.owned.push('rig-ht');
  save();
  if (S.gameMode !== 'listener') applySetup('ht', { quiet: true });
}

export function initHT(el) {
  root = el;
  const key = (lbl, fn, cls = '') => h('button', { class: `ht-key ${cls}`, onclick: (e) => { audio.click(); fn(e); } }, lbl);
  const digit = (d) => key(d, () => { entry = (entry + d).slice(0, 8); draw(); });
  const ent = () => {
    if (!entry) return;
    let v = parseFloat(entry);
    entry = '';
    if (!(v > 0)) return draw();
    const hz = v < 1000 ? v * 1e6 : v * 1e3;
    const [lo, hi] = rig().rx;
    if (hz < lo || hz > hi) { toast(`Out of range: this radio receives ${lo / 1e6}–${hi / 1e6} MHz.`, 'warn', 3000); return draw(); }
    const mode = hz >= 88e6 && hz < 108e6 ? 'WFM' : hz >= 108e6 && hz < 137e6 ? 'AM' : 'FM';
    S.radio.rptOffset = hz >= 145.1e6 && hz < 147.4e6 && (hz < 146.4e6 || hz > 146.6e6) ? (hz < 147e6 ? -600000 : 600000) : 0;
    if (!S.radio.rptOffset) S.radio.toneHz = 0;
    setFreq(hz, { mode }); setMode(mode);
    chIdx = -1; save(); draw();
  };
  const step = (n) => { const st = S.radio.mode === 'WFM' ? 200000 : S.radio.mode === 'AM' ? 25000 : 5000; setFreq(Math.round(S.radio.freq / st) * st + n * st); chIdx = -1; draw(); };
  const vol = h('input', { type: 'range', min: 0, max: 1, step: 0.02, value: S.radio.af, class: 'ht-slider' });
  vol.oninput = () => { S.radio.af = +vol.value; save(); };
  const sql = h('input', { type: 'range', min: 0, max: 1, step: 0.02, value: S.radio.sql, class: 'ht-slider' });
  sql.oninput = () => { S.radio.sql = +sql.value; save(); };
  const ptt = h('button', { class: 'ht-ptt', 'aria-label': 'Push to talk' }, 'PTT');
  const down = (e) => { e.preventDefault(); audio.init(); if (scanning) toggleScan(); pttDown(); ptt.classList.add('on'); };
  const up = (e) => { e.preventDefault(); if (txState.ptt) pttUp(); ptt.classList.remove('on'); };
  ptt.addEventListener('pointerdown', down); ptt.addEventListener('pointerup', up); ptt.addEventListener('pointercancel', up); ptt.addEventListener('pointerleave', up);
  ptt.addEventListener('contextmenu', (e) => e.preventDefault());

  lcd = h('div', { class: 'ht-lcd' });
  const quick = h('div', { class: 'ht-quick' },
    ...[['📢 Listening', () => `§${S.call || 'N0CALL'}§ listening.`], ['👋 CQ', () => `CQ CQ, this is §${S.call || 'N0CALL'}§, monitoring.`], ['✅ Roger', () => `Roger, thanks. §${S.call || 'N0CALL'}§.`], ['73', () => `{73|Seventy three}, §${S.call || 'N0CALL'}§ clear.`]]
      .map(([l, t]) => h('button', { class: 'ht-chip', onclick: () => { audio.init(); sendVoice(t()); } }, l)));
  const menu = h('details', { class: 'ht-menu' }, h('summary', {}, '☰'),
    h('div', { class: 'ht-menu-list' },
      h('button', { onclick: () => showHT(false) }, '🏠 Full station view'),
      h('button', { onclick: () => { showHT(false); bus.emit('goto', 'license'); } }, `🪪 License & study (${licName()})`),
      h('button', { onclick: () => { showHT(false); bus.emit('goto', 'logbook'); } }, '📒 Logbook'),
      h('button', { onclick: () => openStation('radio') }, '📻 Radio model / setups'),
      h('button', { onclick: () => { const n = prompt('Memory name (6 letters):', 'MYCH'); if (!n) return; (S.htMem ||= []).push({ name: n.toUpperCase().slice(0, 7), f: S.radio.freq, mode: S.radio.mode, off: S.radio.rptOffset, tone: S.radio.toneHz }); save(); toast('💾 Saved to memory.', 'good', 2000); draw(); } }, '💾 Save this frequency'),
      h('button', { onclick: () => { S.htMem = []; save(); draw(); } }, '🗑 Clear my memories')));

  root.append(h('div', { class: 'ht-wrap' },
    h('div', { class: 'ht-body' },
      h('div', { class: 'ht-antenna' }), h('div', { class: 'ht-knobs' }, h('div', { class: 'ht-knob' }), h('div', { class: 'ht-led', id: 'ht-led' })),
      h('div', { class: 'ht-top row spread' }, h('span', { class: 'ht-brand' }, rig().name.split(' ')[0]), menu),
      h('div', { class: 'ht-grille' }),
      lcd,
      h('div', { class: 'ht-row' }, key('▲ CH', () => selectCh(chIdx + 1)), key('▼ CH', () => selectCh(chIdx - 1)), key('◀', () => step(-1)), key('▶', () => step(1))),
      h('div', { class: 'ht-row' }, key('MODE', () => { const ms = rig().modes; setMode(ms[(ms.indexOf(S.radio.mode) + 1) % ms.length]); draw(); }),
        key('SHIFT', () => { const o = S.radio.rptOffset; S.radio.rptOffset = o === 0 ? -600000 : o < 0 ? 600000 : 0; save(); draw(); }),
        key('TONE', () => { const i = TONES.indexOf(S.radio.toneHz); S.radio.toneHz = TONES[(i + 1) % TONES.length]; save(); draw(); }),
        key('SCAN', toggleScan, 'scan')),
      h('div', { class: 'ht-pad' }, ...['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'].map(digit), key('ENT', ent, 'ent')),
      h('div', { class: 'ht-row' }, key('CLR', () => { entry = ''; draw(); }), key(net.online ? '🌐 ON' : '🌐 OFF', (e) => { if (!net.online) { S.settings.autoOnline = true; save(); document.querySelector('#net-card button.primary')?.click(); } else toast(`On the air with ${net.roster.length} other player(s).`, 'info', 2500); })),
      h('label', { class: 'ht-sl' }, '🔊', vol), h('label', { class: 'ht-sl' }, 'SQL', sql),
      quick,
      h('div', { class: 'ht-sub', id: 'ht-sub' }, '')),
    ptt));
  if (htListeners) return;
  htListeners = true;
  setInterval(() => { if (document.body.classList.contains('ht-view')) draw(); }, 250);
  bus.on('rig', () => { if (root) { root.innerHTML = ''; initHT(root); } });
}
let htListeners = false;

function toggleScan() {
  scanning = !scanning;
  clearInterval(scanTimer);
  let hold = 0;
  if (scanning) {
    scanTimer = setInterval(() => {
      const busy = rx.smeterDbm > rx.noiseDbm + 10;
      if (busy) { hold = 10; return; } // stop on activity, like a real scanner
      if (hold > 0) { hold--; return; }
      selectCh(chIdx + 1);
    }, 600);
  }
  draw();
}

function draw() {
  if (!lcd) return;
  const r = S.radio;
  const L = channels();
  const ch = chIdx >= 0 && L[chIdx] && Math.abs(L[chIdx].f - r.freq) < 1000 ? L[chIdx] : L.find((c) => Math.abs(c.f - r.freq) < 1000);
  const s = sUnits(rx.smeterDbm);
  const bars = clamp(s.s + (s.over > 0 ? 1 : 0), 0, 10);
  const tx = txState.active;
  const f = r.freq / 1e6;
  lcd.innerHTML = `
    <div class="ht-lcd-top"><span>${tx ? '<b class="ht-tx">TX</b>' : '<span class="dim">RX</span>'}</span><span>${r.mode}</span><span>${r.rptOffset ? (r.rptOffset < 0 ? '−' : '+') : ''}</span><span>${r.toneHz ? 'T' + r.toneHz.toFixed(1) : ''}</span><span>${scanning ? 'SCAN' : ''}</span><span class="ht-batt">▮▮▮▯</span></div>
    <div class="ht-ch">${entry ? `<span class="ht-entry">${entry}_</span>` : ch ? ch.name : 'VFO'}</div>
    <div class="ht-freq">${entry ? '' : f.toFixed(f >= 100 ? 4 : 4).replace(/0$/, '')}</div>
    <div class="ht-sm">${Array.from({ length: 10 }, (_, i) => `<i class="${i < (tx ? 10 : bars) ? 'on' : ''}"></i>`).join('')}<span>${tx ? `${Math.round(txState.watts)}W` : s.text}</span></div>
    <div class="ht-note">${ch?.note || ''}${!S.license ? ' · 🔒 listen only (no license)' : ''}</div>`;
  const led = document.getElementById('ht-led');
  if (led) led.className = `ht-led ${tx ? 'tx' : rx.smeterDbm > rx.noiseDbm + 10 ? 'rx' : ''}`;
  // last thing heard, as a subtitle
  const lines = document.querySelectorAll('.transcript .tl');
  const last = lines[lines.length - 1];
  const sub = document.getElementById('ht-sub');
  if (sub && last && last.textContent !== lastSub) { lastSub = last.textContent; sub.textContent = lastSub.slice(0, 160); }
}

export { setFreq };
