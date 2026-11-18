// One-click station setups, radio model picker, saved antennas, appearance.
import { S, save, licName } from './state.js';
import { h, toast, bus, modal } from './util.js';
import { RIGS, rig } from './rigs.js';
import { maxPower } from './limits.js';
import { bandByName } from './data/bandplan.js';
import { wireStation } from './shack.js';
import { ANT_TYPES } from './antenna.js';
import { modelLcd } from './faceplate.js';

const K = { dipole: 468, invv: 455, vertical: 234, efhw: 456, yagi: 445 };
export const cutFor = (type, band) => { const b = bandByName(band); const f = (b.lo + b.hi) / 2e6; return Math.round((K[type] / f) * 100) / 100; };

export const SETUPS = [
  { id: 'home', name: 'Classic home HF station', rig: 'allmode', ant: { type: 'dipole', band: '40m', height: 35, feed: 'RG-8X', feedLen: 75, axis: 90 }, tune: ['40m', 'LSB'], needs: [],
    desc: '40 m dipole in the trees, 100 W, internal tuner. Also works 15 m (3rd harmonic) and, with the tuner, most bands.' },
  { id: 'apartment', name: 'Apartment / stealth', rig: 'allmode', ant: { type: 'efhw', band: '40m', height: 20, feed: 'RG-58', feedLen: 40, axis: 0 }, tune: ['20m', 'USB'], needs: ['unun'],
    desc: 'One thin end-fed wire out the window to a tree. Resonant on 40/20/15/10 m with no tuner.' },
  { id: 'vertical', name: 'Backyard vertical (DX on a budget)', rig: 'allmode', ant: { type: 'vertical', band: '20m', radials: 16, feed: 'RG-213', feedLen: 50 }, tune: ['20m', 'USB'], needs: ['rg213'],
    desc: 'Ground-mounted ¼-wave vertical with 16 radials: low take-off angle for DX, small footprint.' },
  { id: 'pota', name: 'POTA / Field Day portable', rig: 'qrp', ant: { type: 'efhw', band: '20m', height: 25, feed: 'RG-58', feedLen: 25, axis: 0 }, tune: ['20m', 'CW'], power: 10, needs: ['rig-qrp', 'unun'],
    desc: '10 W QRP rig on battery with a 20 m end-fed on a fishing pole. CW recommended!' },
  { id: 'dx', name: 'DX tower station', rig: 'sdr100', ant: { type: 'yagi', band: '20m', height: 70, feed: 'LMR-400', feedLen: 120, heading: 45 }, tune: ['20m', 'USB'], power: 500, needs: ['rig-sdr100', 'yagi', 'rotator', 'mast50', 'tower70', 'lmr400', 'amp500'],
    desc: '3-element Yagi at 70 ft on a rotator, low-loss coax, 500 W amplifier. Point it and work the world.' },
  { id: 'contest', name: 'Contest super-station', rig: 'contest', ant: { type: 'yagi', band: '20m', height: 100, feed: 'LMR-400', feedLen: 150, heading: 45 }, tune: ['20m', 'CW'], power: 1500, needs: ['rig-contest', 'yagi', 'rotator', 'mast50', 'tower70', 'tower100', 'lmr400', 'amp500', 'amp1500'],
    desc: 'Top receiver, 100 ft tower, legal-limit amplifier. Built to run pileups.' },
  { id: 'vhf', name: 'VHF/UHF FM & repeaters', rig: 'allmode', ant: { type: 'vertical', band: '2m', radials: 4, feed: 'LMR-400', feedLen: 50 }, tune: ['2m', 'FM'], rpt: true, needs: ['lmr400'],
    desc: '2 m ground-plane on the roof. Set up for your local repeater (−600 kHz, 100 Hz tone).' },
  { id: 'ht', name: 'Handheld (HT) only', rig: 'ht', ant: { type: 'vertical', band: '2m', radials: 0, feed: 'RG-58', feedLen: 3 }, tune: ['2m', 'FM'], rpt: true, power: 5, needs: ['rig-ht'],
    desc: 'A 5 W handheld with its rubber-duck antenna. Repeaters, simplex, APRS, weather, and fire, rail and marine monitoring.' },
  { id: 'listener', name: 'Scanner & shortwave listener', rig: 'sdrrx', ant: { type: 'efhw', band: '40m', height: 30, feed: 'RG-8X', feedLen: 50, axis: 0 }, tune: [null, 'FM', 154.19e6], needs: ['rig-sdrrx', 'unun'],
    desc: 'Wideband receive-only SDR and a long wire: fire, rail and marine channels, airband, weather radio, WWV and oceanic HF. No license needed.' },
];

export function applySetup(id, { quiet } = {}) {
  const p = SETUPS.find((x) => x.id === id);
  if (!p) return false;
  S.rig = p.rig;
  // Station accessories that suit the setup: an amplifier needs a tuner & meter rated for it.
  const amp = p.needs.some((n) => /^amp/.test(n));
  S.gear = { ...(S.gear || {}), tuner: amp ? 'at2k' : (S.gear?.tuner || 'gen300'), meter: amp ? 'cn901' : S.gear?.meter || 'gen200', amp: 'none' };
  wireStation();
  const a = S.antenna;
  Object.assign(a, { type: p.ant.type, length: cutFor(p.ant.type, p.ant.band), height: p.ant.height ?? a.height, feed: p.ant.feed, feedLen: p.ant.feedLen, radials: p.ant.radials ?? a.radials, axis: p.ant.axis ?? a.axis, heading: p.ant.heading ?? a.heading, built: true, spliced: 0, sizedBy: 'setup' });
  const r = S.radio;
  r.atuOn = !!RIGS[p.rig].atu; r.atuTunedFreq = null; r.mtBypass = true;
  r.power = Math.min(p.power || 100, maxPower());
  if (p.rpt) { r.rptOffset = -600000; r.toneHz = 100.0; } else { r.rptOffset = 0; r.toneHz = 0; }
  S.setup = id;
  save();
  bus.emit('rig'); bus.emit('shack'); bus.emit('antenna'); bus.emit('antenna-rebuild');
  const [band, mode, f] = p.tune;
  bus.emit('tune-to', f || (p.rpt ? 146940000 : bandByName(band).def), mode);
  if (!quiet) toast(`<b>${p.name}</b> is set up: shack wired, ${ANT_TYPES[a.type].label.toLowerCase()} cut to ${a.length} ft and raised, radio on. Inspect the Station wiring and Antenna pages to see how it is built.`, 'good', 9000);
  return true;
}

// ------------------------------------------------------------------ saved antennas (slots)
export function saveSlot(i) { (S.antSlots ||= [null, null, null])[i] = { ...S.antenna }; save(); toast(`Saved to ANT ${i + 1}.`, 'good', 2500); bus.emit('antslots'); }
export function loadSlot(i) {
  const sl = (S.antSlots || [])[i];
  if (!sl) return;
  const cur = (S.antSlots ||= [null, null, null]).findIndex((x) => x && JSON.stringify({ ...x, built: 0 }) === JSON.stringify({ ...S.antenna, built: 0 }));
  if (cur >= 0) S.antSlots[cur] = { ...S.antenna };
  Object.assign(S.antenna, { ...sl });
  S.radio.atuTunedFreq = null;
  S.antIdx = i;
  save(); bus.emit('antenna'); bus.emit('antenna-rebuild'); bus.emit('antslots');
}

// ------------------------------------------------------------------ appearance & panels
export function applyLook() {
  const b = document.body;
  const face = S.settings.face && S.settings.face !== 'auto' ? S.settings.face : 'model';
  b.dataset.face = face;
  b.dataset.lcd = S.settings.lcd && S.settings.lcd !== 'auto' ? S.settings.lcd : modelLcd();
  const P = S.settings.panels || {};
  for (const [k, sel] of Object.entries({ logger: '#operating' })) {
    const el = document.querySelector(sel);
    if (el) el.hidden = P[k] === false;
  }
}

// ------------------------------------------------------------------ the Station dialog
export function openStation(tab = 'setups') {
  let close;
  const body = h('div', { class: 'station-modal' });
  const tabs = [['setups', 'Station presets'], ['radio', 'Radio model'], ['ants', 'Saved antennas'], ['look', 'Appearance & panels']];
  const draw = (t) => {
    body.innerHTML = '';
    body.append(h('div', { class: 'seg st-tabs' }, ...tabs.map(([k, l]) => h('button', { class: k === t ? 'active' : '', onclick: () => draw(k) }, l))));
    if (t === 'setups') {
      body.append(h('p', { class: 'muted small' }, 'Each preset wires the station, cuts and raises the antenna and tunes the radio. Inspect the Station and Antenna pages afterwards to see how it is built.'),
        h('div', { class: 'setup-grid' }, ...SETUPS.map((p) => h('div', { class: `setup-card ${S.setup === p.id ? 'sel' : ''}` },
          h('b', {}, p.name), h('p', { class: 'small muted' }, p.desc),
          h('div', { class: 'tiny mono' }, `${RIGS[p.rig].name} · ${ANT_TYPES[p.ant.type].label}`),
          h('button', { class: 'btn primary small', onclick: () => { if (applySetup(p.id)) close(); } }, S.setup === p.id ? 'Re-apply' : 'Use this preset')))));
    }
    if (t === 'radio') {
      body.append(h('div', { class: 'setup-grid' }, ...Object.entries(RIGS).map(([id, r]) => h('div', { class: `setup-card ${S.rig === id || (!S.rig && id === 'allmode') ? 'sel' : ''}` },
        h('b', {}, r.name), h('div', { class: 'tiny muted' }, r.cls), h('p', { class: 'small muted' }, r.blurb),
        h('ul', { class: 'tiny spec' }, h('li', {}, `TX: ${r.tx.length ? `${r.maxW} W · ${r.tx.join(' ')}` : 'receive only'}`), h('li', {}, `RX: ${(r.rx[0] / 1e6).toFixed(1)}–${r.rx[1] / 1e6} MHz · ${r.modes.join('/')}`),
          h('li', {}, [r.atu ? 'ATU' : 'no ATU', r.scope ? 'scope' : 'no scope', r.dsp ? 'DSP NR' : '', r.narrowCw ? 'narrow CW' : '', r.quietRx ? 'low-noise RX' : ''].filter(Boolean).join(' · '))),
        h('button', { class: 'btn primary small', onclick: () => { S.rig = id; save(); bus.emit('rig'); toast(`Now using the ${r.name}.`, 'good'); draw('radio'); } }, S.rig === id ? 'In use' : 'Use this radio')))));
    }
    if (t === 'ants') {
      S.antSlots ||= [null, null, null];
      body.append(h('p', { class: 'small muted' }, 'Save antennas to the three ports of the antenna switch and select them from the radio (ANT 1/2/3).'),
        h('div', { class: 'setup-grid' }, ...S.antSlots.map((sl, i) => h('div', { class: `setup-card ${S.antIdx === i ? 'sel' : ''}` }, h('b', {}, `ANT ${i + 1}`),
          h('p', { class: 'small' }, sl ? `${ANT_TYPES[sl.type].label}, ${sl.length} ft${sl.type !== 'vertical' ? `, ${sl.height} ft up` : ''}, ${sl.feedLen} ft ${sl.feed}` : 'empty'),
          h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: () => { saveSlot(i); draw('ants'); } }, 'Save current here'), sl ? h('button', { class: 'btn primary small', onclick: () => { loadSlot(i); draw('ants'); } }, 'Select') : null)))));
    }
    if (t === 'look') {
      const sel = (key, opts, label) => { const s = h('select', {}, ...opts.map(([v, l]) => h('option', { value: v, selected: (S.settings[key] || opts[0][0]) === v }, l))); s.onchange = () => { S.settings[key] = s.value; save(); applyLook(); }; return h('label', {}, label, ' ', s); };
      const chk = (k, l) => { S.settings.panels ||= {}; const c = h('input', { type: 'checkbox', checked: S.settings.panels[k] !== false }); c.onchange = () => { S.settings.panels[k] = c.checked; save(); applyLook(); }; return h('label', { class: 'inline' }, c, ' ', l); };
      const lab = h('input', { type: 'checkbox', checked: !!S.settings.lab }); lab.onchange = () => { S.settings.lab = lab.checked; save(); };
      const ex = h('input', { type: 'checkbox', checked: !!S.settings.explain }); ex.onchange = () => { S.settings.explain = ex.checked; save(); bus.emit('explain'); };
      body.append(
        sel('face', [['auto', 'Match radio model'], ['graphite', 'Graphite'], ['black', 'Black'], ['silver', 'Silver'], ['retro', 'Retro wood & cream']], 'Faceplate'),
        sel('lcd', [['auto', 'Match radio model'], ['green', 'Green'], ['amber', 'Amber'], ['blue', 'Ice blue'], ['white', 'Paper white']], 'Display colour'),
        h('h4', {}, 'Radio page panels'),
        h('div', { class: 'row wrap' }, chk('logger', 'Logger')),
        h('h4', {}, 'Engineering'),
        h('label', { class: 'inline' }, lab, ' Lab readouts on the band scope (signal / noise dBm, SNR, path, distance)'),
        h('br'), h('label', { class: 'inline' }, ex, ' Explain mode — hover any control to learn what it does'));
    }
  };
  draw(tab);
  close = modal(h('div', {}, h('h2', {}, 'Station'), body), { wide: true });
}
