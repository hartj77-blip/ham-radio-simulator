// Operating position: logger, macros, CW keyboard, push-to-talk, and the TX path.
import { S, save } from './state.js';
import { h, $, $$, clamp, toast, bus, now, wattsToDbm } from './util.js';
import { checkTx, bandOf } from './data/bandplan.js';
import { CONTESTS } from './data/contests.js';
import { DX_ENTITIES, stateBy, phonetic } from './data/world.js';
import { audio } from './audio.js';
import { schedule } from './morse.js';
import { world, playerTransmitted, playerTxStart, phone, myExch, player, activeContest } from './world.js';
import { rigStatus } from './shack.js';
import { effectiveSwr, stationInfo, dialHz } from './radio.js';
import { voice, normalizeSpeech } from './voice.js';
import { elmer } from './elmer.js';
import { net } from './net.js';
import { distanceKm, bearing } from './propagation.js';
import { powerLimit , maxPower } from './limits.js';
import { siteEffects } from './yard.js';
import { rig, rigCanTx, rigMaxW , gearOf } from './rigs.js';

const R = () => S.radio;

// ------------------------------------------------------------------ TX state
export const txState = {
  active: false, freq: 0, mode: 'USB', watts: 0, swr: 1, start: 0, sch: null, label: '', ptt: false, carrierOn: false,
  get keyed() {
    if (!this.active) return false;
    if (this.sch) { const el = now() - this.start; return this.sch.segs.some((s) => el >= s.t0 && el <= s.t1); }
    return true;
  },
  flash(dur, label) {
    const p = prepare('CW', true);
    if (!p) return;
    Object.assign(this, { active: true, freq: p.txf, mode: 'CW', watts: Math.min(10, p.watts), swr: p.swr, start: now(), sch: null, label });
    setTimeout(() => { this.active = false; }, dur * 1000);
  },
  carrier(on) {
    if (on && !this.active) {
      const p = prepare('CW', true);
      if (!p) return;
      Object.assign(this, { active: true, carrierOn: true, freq: p.txf, mode: 'CW', watts: 10, swr: p.swr, start: now(), sch: null });
      this.carrierTimer = setInterval(() => { this.swr = effectiveSwr(R().freq); }, 100);
    } else if (!on && this.carrierOn) {
      this.active = false; this.carrierOn = false; clearInterval(this.carrierTimer);
      const swr = effectiveSwr(R().freq);
      if (swr < 1.6) toast(`Manual tuner matched: SWR ${swr.toFixed(2)}:1`, 'good');
    }
  },
};

export function legal(freq, mode) { return checkTx(S.license, freq, mode); }

function foldback(swr) { return swr <= 1.5 ? 1 : swr <= 2 ? 0.9 : swr <= 2.5 ? 0.6 : swr <= 3 ? 0.35 : 0.08; }

let lastId = Date.now(), lastIdWarn = 0, firstTxSinceId = 0;

// Validate a transmission. Returns {txf, watts, swr, dbm, via} or null.
function prepare(modeOverride, quiet) {
  const r = R(), rs = rigStatus();
  if (!rs.powered) { toast('The radio is off. Finish the wiring on the Station wiring page.', 'warn'); return null; }
  const mode = modeOverride || r.mode;
  const txf = r.split && r.vfoB ? r.vfoB : r.mode === 'FM' ? r.freq + r.rptOffset : r.freq;
  if (!quiet) {
    if (mode === 'CW' && !rs.key) { toast('Plug the CW paddle into the radio (Station wiring page).', 'warn'); return null; }
    if (mode !== 'CW' && !rs.mic) { toast('Plug the microphone into the radio (Station wiring page).', 'warn'); return null; }
  }
  if (!rig().tx.length) { toast(`The ${rig().name} is receive-only. Choose a transceiver in Station → Radio model.`, 'warn'); return null; }
  { const bn = bandOf(txf)?.name; if (bn && !rigCanTx(bn)) { toast(`Your ${rig().name} can't transmit on ${bn} (it covers ${rig().tx.join(', ')}).`, 'warn'); return null; } }
  if (rs.end === 'open') { elmer('no_antenna', true); toast('Nothing connected to the ANT jack! The rig\'s SWR protection shut down the transmitter.', 'bad'); return null; }
  const via = rs.end === 'dummy' ? 'dummy' : 'rf';
  if (via === 'rf') {
    const chk = checkTx(S.license, txf, mode);
    if (!chk.ok) {
      S.stats.violations++; save();
      toast(`<b>Transmission blocked.</b> ${chk.reason}${chk.code === 'nolicense' ? '<br>Tip: you CAN transmit into the dummy load to practice.' : ''}`, 'bad', 9000);
      if (chk.code === 'edge') elmer('band_edge'); else if (chk.code !== 'nolicense') elmer('privileges');
      if (chk.code === 'privilege' && S.license === 'T') elmer('tech_hf');
      bus.emit('helper-mistake', 'tx-blocked', chk.reason);
      return null;
    }
  }
  const swr = effectiveSwr(txf);
  if (via === 'rf' && !S.antenna.built) { elmer('no_antenna', true); toast('The feedline goes outside but there\'s no antenna on it! Build one on the Antenna page.', 'bad'); return null; }
  if (via === 'rf' && S.license && r.power > powerLimit(S.license, txf)) {
    S.stats.violations++; save();
    toast(`<b>Transmission blocked.</b> ${r.power} W exceeds the ${powerLimit(S.license, txf)} W PEP limit for ${S.license === 'T' ? 'Technicians on HF' : 'this band (30 m)'}. Turn the power down.`, 'bad', 9000);
    elmer('power_min');
    return null;
  }
  const fb = foldback(swr);
  const watts = Math.max(0.5, Math.min(r.power, maxPower(), rigMaxW(txf) >= 50 ? Infinity : rigMaxW(txf)) * fb);
  if (swr > 2.0 && !quiet) {
    toast(`High SWR (${swr > 50 ? '∞' : swr.toFixed(1)}:1) — the rig folded back to ${watts.toFixed(0)} W. Tune the ATU or fix the antenna.`, 'warn');
    elmer('swr_high');
  }
  const g = swr >= 999 ? 0.999 : (swr - 1) / (swr + 1);
  // SSB/AM talk power: a better mic, speech compression, and mic gain (too low = weak, too high = ALC splatter)
  const mg = r.micGain ?? 0.5;
  const talk = mode !== 'CW' && mode !== 'FM' ? (gearOf('mic').talk || 0) + (r.comp ? 2.5 : 0) + (mg < 0.3 ? -4 * (0.3 - mg) / 0.3 : 0) - (mg > 0.85 ? 2 : 0) : 0;
  if (mode !== 'CW' && mode !== 'FM' && mg > 0.85 && !quiet) toast('ALC overdriven: mic gain too high — your signal is splattering (wide and distorted). Back it off.', 'warn', 5000);
  const dbm = via === 'dummy' ? -200 : wattsToDbm(watts) + 10 * Math.log10(1 - g * g) + talk - siteEffects(txf / 1e6).lossDb;
  return { txf, watts, swr, dbm, via, mode };
}

function trackId(text) {
  const t = Date.now();
  if (S.call && String(text).toUpperCase().includes(S.call)) { lastId = t; firstTxSinceId = 0; return; }
  if (!firstTxSinceId) firstTxSinceId = t;
  if (t - Math.min(lastId, firstTxSinceId) > 10 * 60 * 1000 && t - lastIdWarn > 10 * 60 * 1000 && rigStatus().end === 'antenna') {
    lastIdWarn = t;
    toast('You haven\'t sent your callsign in over 10 minutes. FCC §97.119 requires an ID every 10 minutes and at the end of a contact.', 'warn', 9000);
    elmer('id_rule', true);
  }
}

// Type-ahead: a message sent while transmitting goes out right after (like real contest loggers).
let pendingTx = null;
function queueTx(fn, label) {
  pendingTx = fn;
  ui.transcript('sys', `queued: ${label}`, 'sys');
}
function runPending() { const fn = pendingTx; pendingTx = null; if (fn) setTimeout(fn, 150); }

function finishTx(p, text, mode) {
  txState.active = false;
  txState.sch = null;
  runPending();
  trackId(text);
  if (p.via !== 'rf') return;
  const r = R();
  const msg = { text, mode: mode === 'CW' ? 'CW' : 'PHONE', sb: r.mode === 'CW' ? 'CW' : r.mode, freq: p.txf, dbm: p.dbm, rptTone: r.toneHz };
  playerTransmitted(msg);
}

export function sendCW(text) {
  text = String(text).toUpperCase().trim();
  if (!text) return;
  if (txState.active) return queueTx(() => sendCW(text), text);
  if (R().mode !== 'CW') { toast('Switch the radio to CW mode to send Morse.', 'warn'); return; }
  const p = prepare('CW');
  if (!p) return;
  audio.init();
  const sch = schedule(text, S.settings.myWpm);
  Object.assign(txState, { active: true, freq: p.txf, mode: 'CW', watts: p.watts, swr: p.swr, start: now() + 0.05, sch });
  audio.sidetone(sch.segs, audio.t + 0.05, R().pitch, S.settings.sideVol ?? 0.25);
  if (p.via === 'rf') playerTxStart(p.txf, 'CW', 'CW', sch.dur);
  ui.transcript('You', text, 'tx', p.via);
  net.sendCW && net.sendCW(text, S.settings.myWpm, p.txf);
  clearTimeout(txState.timer);
  txState.timer = setTimeout(() => finishTx(p, text, 'CW'), sch.dur * 1000 + 100);
}

export function sendVoice(tpl) {
  if (txState.active) return queueTx(() => sendVoice(tpl), phone(tpl).show);
  if (R().mode === 'CW') { toast('Switch to a voice mode (USB/LSB/FM/AM) for phone.', 'warn'); return; }
  const p = prepare();
  if (!p) return;
  audio.init();
  const ph = phone(tpl);
  Object.assign(txState, { active: true, freq: p.txf, mode: R().mode, watts: p.watts, swr: p.swr, start: now(), sch: null });
  ui.transcript('You', ph.show, 'tx', p.via);
  const est = ph.say.split(/\s+/).length * 0.42 + 0.8;
  if (p.via === 'rf') playerTxStart(p.txf, 'PHONE', R().mode, est + 2);
  let ended = false;
  const end = () => { if (ended) return; ended = true; finishTx(p, ph.show, 'PHONE'); };
  audio.speak(ph.say, { lang: 'en-US', seed: 7, rate: 1.08, volume: 0.35 * R().af }).then(end);
  setTimeout(end, est * 1000 + 6000);
}

// Push-to-talk (live microphone)
let pttP = null;
export async function pttDown() {
  if (txState.active || R().mode === 'CW') return;
  const p = prepare();
  if (!p) return;
  audio.init();
  pttP = p;
  Object.assign(txState, { active: true, ptt: true, freq: p.txf, mode: R().mode, watts: p.watts, swr: p.swr, start: now(), sch: null });
  ui.ptt(true);
  elmer('ptt_voice');
  if (p.via === 'rf') playerTxStart(p.txf, 'PHONE', R().mode, 30);
  if (net.setPtt) net.setPtt(true, p);
  if (voice.recogSupported) voice.start((t) => ui.ptt(true, t));
  else voice.getMic();
}
export async function pttUp() {
  if (!txState.ptt) return;
  txState.ptt = false;
  ui.ptt(false);
  if (net.setPtt) net.setPtt(false);
  const raw = voice.recogSupported ? await voice.stop() : '';
  const known = world.stations.filter((s) => Math.abs(s.freq - R().freq) < 3000).map((s) => s.call);
  const text = raw ? normalizeSpeech(raw, known) : '';
  if (raw) ui.transcript('You', `${text}`, 'tx', pttP.via, `heard: "${raw}"`);
  else if (!voice.recogSupported) ui.transcript('sys', 'Your browser has no speech recognition (try Chrome or Edge). Simulated stations can\'t understand live voice — use the macro buttons, or talk to real players via Online.', 'sys');
  finishTx(pttP, text, 'PHONE');
}

// ------------------------------------------------------------------ logger UI
let root, fields = {}, info, macroBox, transcriptBox, decoderBox, pttBtn, contestBar;
const flags = { exchSent: false, myCallSent: false, replied: false };
export let runMode = false;

export const ui = {
  transcript(who, text, kind, via, note) {
    if (!transcriptBox) return;
    const line = h('div', { class: `tl ${kind}` }, h('span', { class: 'who' }, who === 'sys' ? '' : who), ' ', h('span', { class: 'txt' }, text),
      via === 'dummy' ? h('span', { class: 'tag' }, ' (into dummy load)') : null, note ? h('div', { class: 'note' }, note) : null);
    transcriptBox.append(line);
    while (transcriptBox.children.length > 80) transcriptBox.firstChild.remove();
    transcriptBox.scrollTop = transcriptBox.scrollHeight;
  },
  decoder(t) { if (decoderBox) decoderBox.textContent = t; },
  ptt(on, interim) {
    if (!pttBtn) return;
    pttBtn.classList.toggle('on', on);
    pttBtn.querySelector('.ptt-sub').textContent = on ? (interim ? `“${interim.slice(-60)}”` : 'TRANSMITTING — speak now') : 'hold SPACE or click & hold';
  },
  legal,
  refresh() { render(); },
};

function contestDef() { const c = activeContest(); return c ? CONTESTS[c.def.id] : null; }

export function initOperatingUI(el) {
  root = el;
  render();
  bus.on('contest', maybeRender);
  bus.on('license', maybeRender);
  bus.on('band', maybeRender);
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('keyup', onKeyUp, true);
  bus.on('qso-complete', (st) => {
    if (fields.call && !fields.call.value && runMode) { /* nothing */ }
  });
}

let layoutKey = null;
// Re-render only when the logger layout really changes; never lose what was typed.
function maybeRender() { const k = `${contestDef()?.id || 'casual'}|${S.license}|${S.call}`; if (k !== layoutKey) render(); }
function render() {
  if (!root) return;
  const keep = Object.fromEntries(Object.entries(fields).map(([k, i]) => [k, i.value]));
  const hadFocus = document.activeElement && document.activeElement.classList.contains('lf') ? document.activeElement.dataset.k : null;
  layoutKey = `${contestDef()?.id || 'casual'}|${S.license}|${S.call}`;
  root.innerHTML = '';
  const cd = contestDef();
  fields = {};
  const mk = (k, label, ph, w = 8, val = '') => {
    const i = h('input', { class: `lf lf-${k}`, placeholder: ph, size: w, value: val, autocomplete: 'off', spellcheck: 'false', 'data-k': k });
    i.addEventListener('input', () => { i.value = i.value.toUpperCase(); if (k === 'call') onCallInput(); });
    i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.ctrlKey ? logQso() : esm(); } if (e.key === ' ' && k === 'call') { e.preventDefault(); focusNext(i); } });
    fields[k] = i;
    return h('label', { class: 'lfl' }, h('span', {}, label), i);
  };
  const row = h('div', { class: 'log-row' }, mk('call', 'Callsign', 'W1AW', 10));
  if (cd) for (const f of cd.fields) row.append(mk(f.k, f.label, f.ph, f.w, f.def ? (R().mode === 'CW' ? '599' : '59') : ''));
  else { row.append(mk('rstS', 'RST sent', '599', 4, ''), mk('rstR', 'RST rcvd', '579', 4), mk('name', 'Name', 'Bob', 8), mk('qth', 'QTH', 'Ohio', 10)); }
  info = h('div', { class: 'callinfo muted small' }, ' ');
  macroBox = h('div', { class: 'macros' });
  const runBtn = h('button', { class: `rbtn ${runMode ? 'active' : ''}`, onclick: () => { runMode = true; render(); } }, 'RUN');
  const spBtn = h('button', { class: `rbtn ${!runMode ? 'active' : ''}`, onclick: () => { runMode = false; render(); } }, 'S&P');
  const esmChk = h('input', { type: 'checkbox', checked: S.settings.esm });
  esmChk.onchange = () => { S.settings.esm = esmChk.checked; save(); };
  const cwIn = h('input', { class: 'cw-free', placeholder: 'Type CW here and press Enter to send…', spellcheck: 'false' });
  cwIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); sendCW(cwIn.value); cwIn.value = ''; } });
  const wpm = h('input', { type: 'range', min: 5, max: 40, value: S.settings.myWpm });
  const wpmV = h('span', { class: 'val' }, `${S.settings.myWpm} wpm`);
  wpm.oninput = () => { S.settings.myWpm = +wpm.value; wpmV.textContent = `${wpm.value} wpm`; save(); };
  pttBtn = h('button', { class: 'ptt' }, h('div', {}, 'PTT'), h('div', { class: 'ptt-sub' }, 'hold SPACE or click & hold'));
  pttBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); pttDown(); });
  pttBtn.addEventListener('pointerup', () => pttUp());
  pttBtn.addEventListener('pointerleave', () => { if (txState.ptt) pttUp(); });
  transcriptBox = h('div', { class: 'transcript' });
  decoderBox = h('div', { class: 'decoder', title: 'CW decoder' }, '');
  const subChk = h('input', { type: 'checkbox', checked: S.settings.subtitles });
  subChk.onchange = () => { S.settings.subtitles = subChk.checked; save(); };
  const decChk = h('input', { type: 'checkbox', checked: S.settings.decoder });
  decChk.onchange = () => { S.settings.decoder = decChk.checked; save(); if (decChk.checked) elmer('cw_decoder'); };
  contestBar = h('div', { class: 'contest-bar', id: 'contest-bar' });

  root.append(
    contestBar,
    h('div', { class: 'op-grid' },
      h('div', { class: 'card logger' },
        h('div', { class: 'row spread' }, h('h3', {}, cd ? `${cd.name} logger` : 'Logger'),
          h('div', { class: 'row' }, runBtn, spBtn, h('label', { class: 'inline small', title: 'Enter Sends Message (N1MM-style)' }, esmChk, ' ESM'))),
        row, info,
        macroBox,
        h('div', { class: 'row' },
          h('button', { class: 'btn primary', onclick: logQso, title: 'Ctrl+Enter' }, '✓ Log QSO'),
          h('button', { class: 'btn', onclick: wipe, title: 'Esc' }, 'Wipe'),
          h('span', { class: 'muted tiny' }, 'Enter = ESM · Ctrl+Enter = log · Esc = wipe/stop · Space in call field = next field')),
        h('div', { class: 'cw-box' }, h('div', { class: 'row' }, cwIn, h('label', { class: 'knobrow inline' }, h('span', {}, 'KEYER'), wpm, wpmV))),
        h('div', { class: 'ptt-box' }, pttBtn, h('div', { class: 'muted tiny' },
          voice.recogSupported ? 'Speech recognition ON: say callsigns with phonetics ("Kilo Delta Nine…"). Simulated stations will answer.' : 'No speech recognition in this browser — macro buttons speak for you.')),
      ),
      h('div', { class: 'card rxlog' },
        h('div', { class: 'row spread' }, h('h3', {}, 'What you hear'), h('div', { class: 'row' }, h('label', { class: 'inline small' }, subChk, ' subtitles'), h('label', { class: 'inline small' }, decChk, ' CW decoder'))),
        decoderBox, transcriptBox),
    ),
  );
  renderMacros();
  root.classList.toggle('is-cw', R().mode === 'CW');
  for (const [k, v] of Object.entries(keep)) if (fields[k] && v) fields[k].value = v;
  if (hadFocus && fields[hadFocus]) fields[hadFocus].focus();
}

function focusNext(i) {
  const list = Object.values(fields);
  const idx = list.indexOf(i);
  (list[idx + 1] || list[0]).focus();
}

function renderMacros() {
  macroBox.innerHTML = '';
  for (let n = 1; n <= 8; n++) {
    const m = macro(n);
    macroBox.append(h('button', { class: 'macro', title: m.text, onclick: () => fireMacro(n) }, h('b', {}, `F${n}`), ' ', m.label));
  }
}

const my = () => S.call || 'N0CALL';
const his = () => (fields.call?.value || '').trim();

function macro(n) {
  const cd = contestDef(), cw = R().mode === 'CW', m = my(), c = his();
  if (cd) {
    const ex = myExch(activeContest());
    const L = {
      1: ['CQ', cw ? cd.cq.cw(m) : cd.cq.ph(m)],
      2: ['Exch', cw ? ex.cw : ex.ph],
      3: ['TU', cw ? cd.tu.cw(m) : cd.tu.ph(m)],
      4: ['My call', cw ? m : `§${m}§`],
      5: ['His call', cw ? c : `§${c}§`],
      6: ['AGN?', cw ? 'AGN?' : '{AGN?|Say again please?}'],
      7: ['?', cw ? '?' : '{?|Again?}'],
      8: ['NR?', cw ? 'NR?' : '{NR?|Your exchange again please?}'],
    }[n];
    return { label: L[0], text: L[1] };
  }
  const st = stateBy(S.op.state);
  const name = (S.op.name || 'OP').toUpperCase();
  const rstS = fields.rstS?.value || (cw ? '599' : '59');
  const L = {
    1: ['CQ', cw ? `CQ CQ CQ DE ${m} ${m} ${m} K` : `CQ CQ CQ, this is §${m}§, §${m}§, calling CQ and listening.`],
    2: ['Reply', cw ? `${c} DE ${m} TNX FER CALL UR RST ${rstS} ${rstS} NAME ${name} ${name} QTH ${st.name.toUpperCase()} HW? ${c} DE ${m} KN`
      : `§${c}§, this is §${m}§. Thanks for the call. You're #${rstS}# here. My name is {NAME ${name}|${S.op.name || 'unknown'}}, QTH is ${st.name}. How copy? §${c}§, this is §${m}§, over.`],
    3: ['73', cw ? `R R TNX FER QSO 73 ES GL <SK> ${c} DE ${m}` : `Roger, thanks for the contact, {73|seventy three}. §${c}§, this is §${m}§, clear.`],
    4: ['Call him', cw ? `${c ? c + ' DE ' : ''}${m} ${m} K` : `${c ? `§${c}§, this is ` : ''}§${m}§, §${m}§.`],
    5: ['His call', cw ? c : `§${c}§`],
    6: ['AGN?', cw ? 'AGN?' : '{AGN?|Say again please?}'],
    7: ['QRZ?', cw ? 'QRZ?' : '{QRZ?|Q R Z?}'],
    8: ['QRL?', cw ? 'QRL?' : 'Is this frequency in use?'],
  }[n];
  return { label: L[0], text: L[1] };
}

export function fireMacro(n) {
  const m = macro(n);
  if (!m.text.replace(/§|\{|\}|\|/g, '').trim()) { toast('Enter the other station\'s callsign first.', 'warn'); fields.call?.focus(); return; }
  if (n === 1) { runMode = true; $$('.logger .rbtn').forEach((b) => b.classList.toggle('active', b.textContent === 'RUN')); elmer(contestDef() ? 'contest' : 'cq'); }
  if (n === 4) flags.myCallSent = true;
  if (n === 2) { flags.exchSent = true; flags.replied = true; }
  if (R().mode === 'CW') sendCW(m.text.replace(/§|\{[^|]*\||\}/g, '').replace(/\{|\}/g, ''));
  else sendVoice(m.text);
}

function combine(...ns) {
  // send several macros as one transmission
  const cw = R().mode === 'CW';
  const texts = ns.map((n) => macro(n).text);
  if (cw) sendCW(texts.join(' ').replace(/§/g, ''));
  else sendVoice(texts.join(' '));
}

function exchFilled() {
  const cd = contestDef();
  if (!cd) return !!(fields.rstR?.value);
  return cd.fields.every((f) => (fields[f.k]?.value || '').trim());
}

function esm() {
  if (!S.settings.esm) return logQso();
  const c = his();
  const cd = contestDef();
  if (runMode) {
    if (!c) return fireMacro(1);
    if (!flags.exchSent) { flags.exchSent = true; return cd ? combine(5, 2) : fireMacro(2); }
    if (cd ? exchFilled() : true) { fireMacro(3); return logQso(); }
    return fireMacro(6);
  }
  if (!c) { fields.call.focus(); return; }
  if (!flags.myCallSent) return fireMacro(4);
  if (cd) {
    if (exchFilled()) { fireMacro(2); return logQso(); }
    return fireMacro(6);
  }
  if (!flags.replied) return fireMacro(2);
  fireMacro(3);
  return logQso();
}

function wipe() {
  for (const [k, i] of Object.entries(fields)) i.value = (k === 'rst' ? (R().mode === 'CW' ? '599' : '59') : '');
  flags.exchSent = flags.myCallSent = flags.replied = false;
  info.textContent = ' ';
  fields.call?.focus();
}

function onCallInput() {
  const c = his();
  if (c.length < 3) { info.textContent = ' '; return; }
  const parts = [];
  const si = stationInfo(c);
  if (si) parts.push(`${si.st.op.country}${si.st.op.state ? ' · ' + si.st.op.qth : ''} · ${Math.round(si.brg)}° · ${Math.round(si.dist).toLocaleString()} km`);
  else {
    const e = DX_ENTITIES.find((x) => x.pfx.some((p) => c.startsWith(p)));
    if (e) parts.push(`${e.name} (${e.cont}, zone ${e.zone})`);
    else if (/^[KNW]|^A[A-L]/.test(c)) parts.push('United States');
  }
  const band = bandOf(R().freq)?.name;
  const prev = S.log.filter((q) => q.call === c);
  const dupe = activeContest() && prev.some((q) => q.contest === activeContest().id && q.band === band && q.mode === modeName());
  if (dupe) parts.push('DUPE in this contest!');
  else if (prev.length) parts.push(`worked before ×${prev.length}`);
  info.textContent = parts.join('  ·  ') || ' ';
  info.classList.toggle('dupe', !!dupe);
}

const modeName = () => (R().mode === 'CW' ? 'CW' : R().mode === 'FM' ? 'FM' : R().mode === 'AM' ? 'AM' : 'SSB');

export function logQso() {
  const c = his();
  if (!c) { toast('Nothing to log — enter a callsign.', 'warn'); return; }
  const band = bandOf(R().freq)?.name || '?';
  const cd = contestDef();
  const q = {
    id: Date.now(), time: new Date().toISOString(), call: c, band, freq: Math.round(R().freq / 100) / 10, mode: modeName(),
    contest: activeContest() ? activeContest().id : null,
  };
  if (cd) { q.exch = {}; for (const f of cd.fields) q.exch[f.k] = (fields[f.k].value || '').trim(); }
  else Object.assign(q, { rstS: fields.rstS.value || (q.mode === 'CW' ? '599' : '59'), rstR: fields.rstR.value, name: fields.name.value, qth: fields.qth.value });
  const rec = world.findRecord(c, band, q.mode === 'CW' ? 'CW' : 'PH');
  q.status = rec ? (rec.complete ? 'confirmed' : 'partial') : 'nil';
  if (rec) { q.truth = { call: rec.call, exch: rec.exch, country: rec.op?.dxcc || rec.op?.country, state: rec.op?.state, cont: rec.op?.cont, zone: rec.op?.zone }; }
  if (cd && S.log.some((x) => x.contest === q.contest && x.call === c && x.band === band && x.mode === q.mode)) q.dupe = true;
  // remote players (real people) — trust the log
  if (!rec && net.isPeerCall && net.isPeerCall(c)) { q.status = 'confirmed'; q.peer = true; q.truth = { call: c, country: 'United States' }; }
  S.log.push(q);
  save();
  bus.emit('logged', q);
  if (!cd) {
    if (q.status === 'confirmed') {
      const newDx = q.truth?.country && !S.log.slice(0, -1).some((x) => x.status === 'confirmed' && x.truth?.country === q.truth.country);
      const newSt = q.truth?.state && !S.log.slice(0, -1).some((x) => x.status === 'confirmed' && x.truth?.state === q.truth.state);
      
      toast(`QSO with ${c} logged & <b>confirmed</b>.${newDx ? ` New country: ${q.truth.country}!` : ''}${newSt ? ` New state: ${q.truth.state}!` : ''}`, 'good');
    } else if (q.status === 'partial') toast(`Logged ${c} — but the QSO wasn't completed (they never got your report/73). It won't confirm.`, 'warn');
    else toast(`Logged ${c}. No matching station heard you — this would be "Not In Log" (check the call).`, 'warn');
  } else if (q.dupe) toast(`${c} is a dupe — logged, but scores zero.`, 'warn');
  wipe();
}

// ------------------------------------------------------------------ keyboard
function inRadioTab() { return document.body.dataset.tab === 'radio'; }
let spaceHeld = false;
function onKey(e) {
  if (!inRadioTab()) return;
  const tag = (e.target.tagName || '').toLowerCase();
  const typing = tag === 'input' || tag === 'textarea' || tag === 'select';
  if (/^F[1-8]$/.test(e.key)) { e.preventDefault(); fireMacro(+e.key.slice(1)); return; }
  if (e.key === 'Escape') { e.preventDefault(); pendingTx = null; if (txState.active && txState.sch) { audio.stopSidetone(); clearTimeout(txState.timer); txState.active = false; } else wipe(); return; }
  if (typing && e.target.type !== 'range') return;
  const PK = S.settings.pttKey || ' ';
  if (e.key === PK && !e.repeat) { e.preventDefault(); if (!spaceHeld) { spaceHeld = true; pttDown(); } return; }
  if (e.key === PK) { e.preventDefault(); return; }
  if (e.target.type === 'range') return; // arrow keys adjust the focused slider, not the VFO
  if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); bus.emit('tune', 1); }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); bus.emit('tune', -1); }
}
function onKeyUp(e) {
  if (e.key === (S.settings.pttKey || ' ') && spaceHeld) { spaceHeld = false; e.preventDefault(); pttUp(); }
}

export function setContestBar(html) { if (contestBar) contestBar.innerHTML = html; }
