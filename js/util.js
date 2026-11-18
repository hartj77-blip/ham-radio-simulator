// Small shared helpers.
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (k === 'html') e.innerHTML = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) {
    if (k == null || k === false) continue;
    e.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
  return e;
}

export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const rand = (a, b) => a + Math.random() * (b - a);
export const randi = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (a) => a[Math.floor(Math.random() * a.length)];
export const chance = (p) => Math.random() < p;
export const db2amp = (d) => Math.pow(10, d / 20);
export const db2pow = (d) => Math.pow(10, d / 10);
export const pow2db = (p) => 10 * Math.log10(Math.max(p, 1e-30));
export const wattsToDbm = (w) => 10 * Math.log10(w * 1000);
export const dbmToWatts = (d) => Math.pow(10, d / 10) / 1000;

export function weighted(items) {
  // items: [[value, weight], ...]
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [v, w] of items) { if ((r -= w) <= 0) return v; }
  return items[items.length - 1][0];
}

export function poisson(lambda) {
  const L = Math.exp(-lambda); let k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
}

export function fmtFreq(hz) {
  hz = Math.round(hz);
  const mhz = Math.floor(hz / 1e6);
  const khz = Math.floor((hz % 1e6) / 1000);
  const rest = Math.floor((hz % 1000) / 10);
  return `${mhz}.${String(khz).padStart(3, '0')}.${String(rest).padStart(2, '0')}`;
}
export const fmtKhz = (hz) => (hz / 1000).toFixed(1);

export function lev(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

// tiny event bus
const handlers = {};
export const bus = {
  on(ev, fn) { (handlers[ev] ||= []).push(fn); return () => bus.off(ev, fn); },
  off(ev, fn) { handlers[ev] = (handlers[ev] || []).filter((f) => f !== fn); },
  emit(ev, ...a) { for (const f of handlers[ev] || []) { try { f(...a); } catch (e) { console.error(e); } } },
};

export function toast(msg, kind = 'info', ms = 6000) {
  const box = document.getElementById('toasts');
  if (!box) return;
  const t = h('div', { class: `toast ${kind}` });
  t.innerHTML = msg;
  t.addEventListener('click', () => t.remove());
  box.append(t);
  while (box.children.length > 5) box.firstChild.remove();
  setTimeout(() => t.classList.add('fade'), ms);
  setTimeout(() => t.remove(), ms + 600);
}

export function modal(contentNode, { onClose, wide } = {}) {
  const m = document.getElementById('modal');
  m.innerHTML = '';
  const card = h('div', { class: 'modal-card' + (wide ? ' wide' : '') });
  const close = () => { m.hidden = true; m.innerHTML = ''; onClose && onClose(); };
  card.append(h('button', { class: 'modal-x', onclick: close, title: 'Close' }, '×'), contentNode);
  m.append(card);
  m.hidden = false;
  m.onclick = (e) => { if (e.target === m) close(); };
  return close;
}

export function download(filename, text, type = 'text/plain') {
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: filename });
  document.body.append(a); a.click(); a.remove();
}

export const now = () => performance.now() / 1000;

// Deterministic randomness: run fn with Math.random replaced by a seeded PRNG
// (mulberry32). Used so every player sees the same shared world.
export function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function seeded(seed, fn) {
  let a = typeof seed === 'number' ? seed >>> 0 : hashStr(String(seed));
  const prng = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const orig = Math.random;
  Math.random = prng;
  try { return fn(); } finally { Math.random = orig; }
}

// A small "?" button that keeps explanatory text off the page until someone asks for it.
export function info(content, label = 'About this') {
  const b = h('button', { class: 'info-btn', type: 'button', title: label, 'aria-label': label }, '?');
  b.onclick = (e) => {
    e.stopPropagation();
    const open = document.querySelector('.info-pop');
    if (open) { const same = open._for === b; open.remove(); if (same) return; }
    const pop = h('div', { class: 'info-pop', role: 'tooltip' });
    if (typeof content === 'string') pop.innerHTML = content; else pop.append(content);
    pop._for = b;
    document.body.append(pop);
    const r = b.getBoundingClientRect(), w = Math.min(360, innerWidth - 24);
    pop.style.width = `${w}px`;
    pop.style.left = `${Math.max(12, Math.min(innerWidth - w - 12, r.left - 20))}px`;
    const below = r.bottom + 8 + pop.offsetHeight < innerHeight;
    pop.style.top = `${below ? r.bottom + 8 : Math.max(12, r.top - 8 - pop.offsetHeight)}px`;
    const close = (ev) => { if (ev.type === 'keydown' ? ev.key !== 'Escape' : pop.contains(ev.target)) return; pop.remove(); removeEventListener('pointerdown', close, true); removeEventListener('keydown', close, true); removeEventListener('scroll', close, true); };
    setTimeout(() => { addEventListener('pointerdown', close, true); addEventListener('keydown', close, true); addEventListener('scroll', close, true); });
  };
  return b;
}
