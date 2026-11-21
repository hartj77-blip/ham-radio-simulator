// Faceplates: replicas of the main classes of real transceivers and receivers, without branding.
// Each class has its own physical layout (front-panel key column, rotary controls, screen bezel)
// and each model its own finish. Every key and knob here is functional: it drives the same
// radio state as the controls below the faceplate, so the replica can be operated directly.
import { S, save } from './state.js';
import { h, bus, clamp } from './util.js';
import { rig } from './rigs.js';
import { maxPower } from './limits.js';

// Model finishes (generic; no logos). Values are CSS custom properties on the .rig element.
const FINISH = {
  allmode: { body: '#25292f', edge: '#3a4048', key: '#2c3138', lcd: 'blue' },
  sdr100: { body: '#1d2024', edge: '#33383f', key: '#262a30', lcd: 'blue' },
  qrp: { body: '#8d949b', edge: '#b4bac0', key: '#3b4046', lcd: 'amber', ink: '#1c2126' },
  contest: { body: '#16181b', edge: '#2c3036', key: '#202327', lcd: 'white' },
  sdrrx: { body: '#1b1f25', edge: '#2e343c', key: '#262b32', lcd: 'blue' },
  ic7300: { body: '#1c1e21', edge: '#34383e', key: '#272a2f', lcd: 'blue' },
  ft991a: { body: '#202327', edge: '#3a3f46', key: '#2a2e33', lcd: 'blue' },
  ft710: { body: '#1a1c1f', edge: '#30343a', key: '#25282d', lcd: 'blue' },
  ts590sg: { body: '#1f2125', edge: '#383c42', key: '#2b2e33', lcd: 'amber' },
  ft891: { body: '#1d1f22', edge: '#33373c', key: '#282b30', lcd: 'amber' },
  ic705: { body: '#2a2d31', edge: '#43474d', key: '#32363b', lcd: 'blue' },
  g90: { body: '#17191c', edge: '#2d3035', key: '#23262a', lcd: 'blue' },
  k4: { body: '#131416', edge: '#2a2d31', key: '#1d1f22', lcd: 'white' },
  rtlsdr: { body: '#1e2329', edge: '#323a43', key: '#28303a', lcd: 'blue' },
  rspdx: { body: '#1e2329', edge: '#323a43', key: '#28303a', lcd: 'blue' },
};

// Front-panel keys per class. Each: [label, action id]
const KEYS = {
  touch: [['POWER', 'power'], ['TUNER', 'atu'], ['TUNE', 'tune'], ['P.AMP', 'pre'], ['ATT', 'att'], ['NB', 'nb'], ['NR', 'nr'], ['METER', 'meter']],
  classic: [['POWER', 'power'], ['ATT', 'att'], ['PRE', 'pre'], ['NB', 'nb'], ['NR', 'nr'], ['RIT', 'rit'], ['SPLIT', 'split'], ['AT', 'atu'], ['AT TUNE', 'tune'], ['METER', 'meter']],
  contest: [['POWER', 'power'], ['ATU', 'atu'], ['TUNE', 'tune'], ['PRE', 'pre'], ['ATT', 'att'], ['NB', 'nb'], ['NR', 'nr'], ['SPLIT', 'split'], ['RIT', 'rit'], ['METER', 'meter']],
  mobile: [['POWER', 'power'], ['PRE', 'pre'], ['ATT', 'att'], ['NB', 'nb'], ['DNR', 'nr'], ['CLAR', 'rit'], ['METER', 'meter']],
  portable: [['POWER', 'power'], ['TUNER', 'atu'], ['TUNE', 'tune'], ['P.AMP', 'pre'], ['ATT', 'att'], ['NR', 'nr'], ['METER', 'meter']],
  sdr: [['START', 'power'], ['AGC', 'agc'], ['NB', 'nb'], ['NR', 'nr'], ['ATT', 'att'], ['RIT', 'rit']],
};
// Rotary controls per class: [label, setting id]
const KNOBS = {
  touch: [['AF', 'af'], ['SQL', 'sql'], ['RF PWR', 'pwr'], ['RIT', 'rit']],
  classic: [['AF', 'af'], ['SQL', 'sql'], ['RF PWR', 'pwr'], ['RIT', 'rit']],
  contest: [['AF A', 'af'], ['SQL', 'sql'], ['PWR', 'pwr'], ['RIT', 'rit']],
  mobile: [['AF', 'af'], ['SQL', 'sql'], ['CLAR', 'rit']],
  portable: [['AF', 'af'], ['SQL', 'sql'], ['PWR', 'pwr']],
  sdr: [],
};
const R = () => S.radio;
const SET = {
  af: { get: () => R().af, set: (v) => { R().af = v; }, min: 0, max: 1, fmt: (v) => Math.round(v * 100) },
  sql: { get: () => R().sql, set: (v) => { R().sql = v; }, min: 0, max: 1, fmt: (v) => Math.round(v * 100) },
  pwr: { get: () => R().power, set: (v) => { R().power = Math.round(v / 5) * 5 || 5; }, min: 5, max: () => maxPower(), fmt: (v) => `${Math.round(v)} W` },
  rit: { get: () => R().rit, set: (v) => { R().rit = Math.round(v / 10) * 10; R().ritOn = true; }, min: -2000, max: 2000, fmt: (v) => `${v >= 0 ? '+' : ''}${(v / 1000).toFixed(2)}` },
};

export const modelLcd = () => (FINISH[S.rig] || FINISH.allmode).lcd;

export function decorate(rigEl, api) {
  const rg = rig();
  const look = rg.look === 'ht' ? 'classic' : rg.look || 'classic';
  const fin = FINISH[S.rig] || FINISH.allmode;
  rigEl.dataset.model = S.rig || 'allmode';
  rigEl.style.setProperty('--body', fin.body);
  rigEl.style.setProperty('--edge', fin.edge);
  rigEl.style.setProperty('--key', fin.key);
  if (fin.ink) rigEl.style.setProperty('--ink', fin.ink);

  const act = {
    power: () => { S.shack.rigOn = !S.shack.rigOn; save(); bus.emit('shack'); },
    atu: () => { R().atuOn = !R().atuOn; save(); },
    tune: () => api.atuTune(),
    pre: () => { R().preamp = ((R().preamp || 0) + 1) % ((rg.preamps ?? 1) + 1); save(); },
    att: () => { R().rfAtt = R().rfAtt ? 0 : 12; save(); },
    nb: () => { R().nb = !R().nb; save(); },
    nr: () => { R().nr = !R().nr; save(); },
    rit: () => { R().ritOn = !R().ritOn; save(); },
    split: () => { R().split = !R().split; if (R().split && !R().vfoB) R().vfoB = R().freq + 5000; save(); },
    agc: () => { R().agcSpd = { fast: 'mid', mid: 'slow', slow: 'off', off: 'fast' }[R().agcSpd || 'mid']; save(); },
    meter: () => { R().meter = { S: 'PO', PO: 'SWR', SWR: 'S' }[R().meter] || 'S'; save(); },
  };
  const avail = (id) => (id === 'atu' || id === 'tune' ? rg.atu : id === 'nr' ? rg.dsp : id === 'pre' ? (rg.preamps ?? 1) > 0 : id === 'agc' ? rg.agc !== false : true);
  const keys = h('div', { class: 'fp-keys' }, ...KEYS[look].filter(([, id]) => avail(id)).map(([label, id]) => h('button', {
    class: 'fp-key', 'data-act': id, title: label, onclick: () => { act[id](); api.update(); bus.emit('radio-ctl'); },
  }, h('span', { class: 'led' }), h('span', { class: 'fp-lbl' }, label))));
  const knobs = h('div', { class: 'fp-knobs' }, ...KNOBS[look].map(([label, id]) => knob(label, id, api)));
  const badge = h('div', { class: 'fp-badge' }, h('b', {}, rg.code || ''), h('span', {}, rg.cls || ''));
  const bezel = h('div', { class: 'fp-bezel' });
  rigEl.classList.add('fp', `fp-${look}`);
  rigEl.prepend(bezel);
  rigEl.append(keys, knobs, badge);
  if (look === 'sdr') rigEl.prepend(h('div', { class: 'fp-titlebar' }, h('span', { class: 'dots' }, h('i'), h('i'), h('i')), h('span', {}, `SDR receiver software — ${rg.code || ''}`), h('span', { class: 'menu' }, 'File  View  Source  Audio  Help')));
  sync(rigEl);
}

function knob(label, id, api) {
  const def = SET[id];
  const el = h('div', { class: 'fp-knob', 'data-set': id, title: `${label}: drag up/down or scroll` }, h('div', { class: 'cap' }, h('i')), h('span', { class: 'lbl' }, label), h('span', { class: 'val' }));
  const range = () => [def.min, typeof def.max === 'function' ? def.max() : def.max];
  const bump = (frac) => { const [a, b] = range(); def.set(clamp(def.get() + frac * (b - a), a, b)); save(); api.update(); bus.emit('radio-ctl'); };
  let drag = null;
  el.addEventListener('pointerdown', (e) => { drag = e.clientY; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', (e) => { if (drag == null) return; const d = drag - e.clientY; if (Math.abs(d) >= 3) { bump(d / 300); drag = e.clientY; } });
  el.addEventListener('pointerup', () => { drag = null; });
  el.addEventListener('wheel', (e) => { e.preventDefault(); bump(-Math.sign(e.deltaY) * 0.03); }, { passive: false });
  el.addEventListener('dblclick', () => { if (id === 'rit') { R().rit = 0; save(); api.update(); bus.emit('radio-ctl'); } });
  return el;
}

// Reflect radio state on LEDs and knob positions.
export function sync(rigEl) {
  if (!rigEl) return;
  const r = R();
  const on = { power: S.shack.rigOn, atu: r.atuOn, pre: !!r.preamp, agc: (r.agcSpd || 'mid') !== 'off', att: !!r.rfAtt, nb: !!r.nb, nr: !!r.nr, rit: !!r.ritOn, split: !!r.split, meter: false, tune: !!r.atuTunedFreq && r.atuOn && Math.abs(r.freq - r.atuTunedFreq) < Math.max(8000, r.freq * 0.005) };
  // Keys whose setting has several states show that state on the key itself.
  const txt = { pre: r.preamp ? `P.AMP${r.preamp}` : null, att: r.rfAtt ? `ATT ${r.rfAtt}` : null, agc: `AGC ${({ fast: 'F', mid: 'M', slow: 'S', off: 'OFF' })[r.agcSpd || 'mid']}`, meter: `METER ${r.meter || 'S'}` };
  rigEl.querySelectorAll('.fp-key').forEach((k) => {
    k.classList.toggle('on', !!on[k.dataset.act]);
    const l = k.querySelector('.fp-lbl');
    if (l) { l.dataset.base ??= l.textContent; l.textContent = txt[k.dataset.act] || l.dataset.base; }
  });
  rigEl.querySelectorAll('.fp-knob').forEach((k) => {
    const def = SET[k.dataset.set];
    const a = def.min, b = typeof def.max === 'function' ? def.max() : def.max;
    const v = def.get() ?? a;
    k.querySelector('.cap').style.transform = `rotate(${-135 + 270 * clamp((v - a) / (b - a || 1), 0, 1)}deg)`;
    k.querySelector('.val').textContent = def.fmt(v);
  });
}
