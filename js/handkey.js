// Hand keying: send Morse yourself instead of typing it.
//  • Straight key: you time every dit and dah (hold SPACE in CW mode, or press the KEY pad).
//  • Iambic paddle: [ makes dits and ] makes dahs at the keyer speed; squeeze both to alternate.
// What you key is decoded from its timing, shown as you send, and transmitted as that text when
// you pause, so simulated stations answer what you actually sent, mistakes included.
import { S } from './state.js';
import { h, now } from './util.js';
import { audio } from './audio.js';
import { MORSE } from './morse.js';

const CODE = {};
for (const [c, m] of Object.entries(MORSE)) if (c.length === 1 && !CODE[m]) CODE[m] = c;

let hooks = null; // { prepare, begin, keying, finish } supplied by operating.js
let tx = null;    // the transmission in progress
let unit = 0.06;  // current dit length in seconds
let downAt = 0, upAt = 0, isDown = false, cur = '', text = '';
let charTimer = null, endTimer = null, blockedUntil = 0;
let readout = null;
const pad = { dit: false, dah: false }, mem = { dit: false, dah: false };
let keyer = null, lastEl = null;

const keyerUnit = () => 1.2 / (S.settings.myWpm || 20);
export const handActive = () => !!tx;

function show() {
  if (!readout) return;
  const wpm = Math.round(1.2 / unit);
  readout.textContent = tx ? `${text}${cur ? ` ${cur.replace(/\./g, '·').replace(/-/g, '–')}` : ''}  (${wpm} wpm)` : text ? `Sent: ${text}` : '';
}

function commitChar() {
  if (!cur) return;
  text += CODE[cur] || '*';
  cur = '';
  show();
}

function down() {
  if (isDown) return;
  const t = now();
  if (!tx) {
    if (t < blockedUntil) return;
    const p = hooks.prepare();
    if (!p) { blockedUntil = t + 2; return; }
    audio.init();
    tx = p; text = ''; cur = '';
    hooks.begin(p);
  } else {
    const gap = t - upAt;
    if (gap > 2 * unit) commitChar();
    if (gap > 5 * unit && text && !text.endsWith(' ')) text += ' ';
  }
  clearTimeout(charTimer); clearTimeout(endTimer);
  isDown = true; downAt = t;
  hooks.keying(true);
  audio.keyTone(true, S.radio.pitch, S.settings.sideVol ?? 0.25);
}

function up(known) {
  if (!isDown) return;
  const t = now(), dur = t - downAt;
  isDown = false; upAt = t;
  hooks.keying(false);
  audio.keyTone(false);
  if (known) cur += known; // the keyer made this element, so its length is exact
  else if (dur < 2 * unit) { cur += '.'; unit = Math.min(0.3, Math.max(0.025, unit * 0.7 + dur * 0.3)); }
  else { cur += '-'; unit = Math.min(0.3, Math.max(0.025, unit * 0.8 + (dur / 3) * 0.2)); }
  show();
  charTimer = setTimeout(commitChar, 2.5 * unit * 1000);
  endTimer = setTimeout(end, Math.max(1.5, 14 * unit) * 1000);
}

function end() {
  if (!tx || isDown) return;
  commitChar();
  const p = tx, sent = text.trim();
  tx = null;
  show();
  hooks.finish(p, sent, Math.round(1.2 / unit));
}

// ---- straight key
export function straight(on) {
  if (keyer) return;
  if (on && !tx) unit = keyerUnit(); // start from the keyer speed, then follow the operator's fist
  on ? down() : up();
}

// ---- iambic keyer (mode A style: alternates while both paddles are held)
export function paddle(which, on) {
  pad[which] = on;
  if (on) { mem[which] = true; if (!keyer && !isDown) nextElement(); }
}
function nextElement() {
  keyer = null;
  let el = null;
  const want = (k) => pad[k] || mem[k];
  if (want('dit') && want('dah')) el = lastEl === 'dit' ? 'dah' : 'dit';
  else if (want('dit')) el = 'dit';
  else if (want('dah')) el = 'dah';
  mem.dit = mem.dah = false;
  if (!el) { lastEl = null; return; }
  unit = keyerUnit();
  down();
  if (!isDown) { lastEl = null; return; } // transmission refused (wiring, licence, band edge)
  lastEl = el;
  keyer = setTimeout(() => { up(el === 'dit' ? '.' : '-'); keyer = setTimeout(nextElement, unit * 1000); }, (el === 'dit' ? 1 : 3) * unit * 1000);
}

export function releaseAll() {
  pad.dit = pad.dah = false; mem.dit = mem.dah = false;
  if (!keyer && isDown) up();
}

// ---- keyboard: PTT key = straight key, [ and ] = paddle. Returns true when the key was used.
export function handKeyEvent(e, isDownEvent, pttKey) {
  const which = e.key === pttKey ? 'key' : e.key === '[' ? 'dit' : e.key === ']' ? 'dah' : null;
  if (!which) return false;
  e.preventDefault();
  if (isDownEvent && e.repeat) return true;
  which === 'key' ? straight(isDownEvent) : paddle(which, isDownEvent);
  return true;
}

// ---- on-screen pads
export function initHandKey(h_) {
  hooks = h_;
  if (initHandKey.wired) return; initHandKey.wired = true;
  window.addEventListener('blur', releaseAll);
}
export function handKeyBox() {
  const mk = (label, sub, fn) => {
    const b = h('button', { class: 'keypad', type: 'button' }, h('div', {}, label), h('div', { class: 'ptt-sub' }, sub));
    const set = (on) => { b.classList.toggle('on', on); fn(on); };
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture?.(e.pointerId); set(true); });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, () => set(false));
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    return b;
  };
  const pk = S.settings.pttKey && S.settings.pttKey !== ' ' ? S.settings.pttKey.toUpperCase() : 'SPACE';
  readout = h('div', { class: 'key-readout', title: 'What your keying decodes to' });
  return h('div', { class: 'key-box cw-only' },
    h('div', { class: 'row key-pads' },
      mk('KEY', `straight key · hold ${pk}`, (on) => straight(on)),
      mk('DIT', 'paddle · [', (on) => paddle('dit', on)),
      mk('DAH', 'paddle · ]', (on) => paddle('dah', on))),
    readout,
    h('div', { class: 'muted tiny' }, 'Hand keying (CW mode). Straight key: you time every dit and dah, and the decoder follows your speed. Paddle: dits and dahs come at the KEYER speed; hold both to alternate. Pause for a moment and what you keyed is sent. A * marks a character that was not valid Morse.'));
}
