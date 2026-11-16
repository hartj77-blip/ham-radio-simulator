// The three ways to use the simulator, and the automation behind Free Play.
//  - Training:   a guided course with step detection, checkpoints and reference reading.
//  - Simulation: every control and every piece of equipment; you build and tune it yourself.
//  - Free Play:  the station is wired and matched for you; change anything and click the map to tune.
import { S, save } from './state.js';
import { h, bus, toast, modal } from './util.js';
import { icon } from './icons.js';
import { STATES, stateBy, newLicenseeCall } from './data/world.js';
import { BANDS, bandOf, bandByName, SIDEBAND_FOR } from './data/bandplan.js';
import { path as propPath, bandNoiseDbm, distanceKm, bearing, SUN } from './propagation.js';
import { world, player } from './world.js';
import { rig, RIGS, rigRx } from './rigs.js';
import { ANT_TYPES } from './antenna.js';
import { wireStation } from './shack.js';
import { SETUPS, applySetup, cutFor } from './setups.js';
import { audio } from './audio.js';
import { openDesigner } from './autodesign.js';
import { openStationPlan } from './advisor.js';

export const MODES = {
  training: { label: 'Training', icon: 'grad', desc: 'A step-by-step course: wire a station, build and tune an antenna, search the bands, learn propagation and make your first contact. Every step explains why it matters.' },
  simulation: { label: 'Simulation', icon: 'cpu', desc: 'The full technical simulator. Every radio, antenna and accessory is available; you wire, design, measure and tune everything yourself, with engineering readouts.' },
  free: { label: 'Free Play', icon: 'sparkles', desc: 'Automated and relaxed. The station is wired and matched for you. Change any equipment on a whim, and click anywhere on the map to tune to the best band for that location.' },
};

export function migrateMode() {
  if (!S.mode && S.started) S.mode = { career: 'training', free: 'free', listener: 'free' }[S.gameMode] || 'training';
  delete S.gameMode; delete S.money; delete S.owned; delete S.xp;
  if (S.helper && !S.training) S.training = { step: 0, done: {}, answers: {}, marks: {}, min: false };
  document.body.dataset.mode = S.mode || 'training';
}

const ensureLicense = () => {
  if (!S.license) S.license = 'E';
  for (const e of ['T', 'G', 'E']) S.exams[e] = S.exams[e] || e === 'T' || (S.license !== 'T' && e === 'G') || S.license === 'E';
  if (!S.call) S.call = newLicenseeCall(S.op.state, S.license);
};

export function setAppMode(m, { quiet } = {}) {
  if (!MODES[m]) return;
  S.mode = m;
  document.body.dataset.mode = m;
  if (m === 'simulation') { ensureLicense(); S.settings.lab = true; }
  if (m === 'free') {
    ensureLicense();
    if (!S.shack.rigOn || !S.antenna.built) applySetup(S.setup && SETUPS.some((x) => x.id === S.setup) ? S.setup : 'home', { quiet: true });
    S.radio.atuOn = true;
    autoMatch();
  }
  save();
  bus.emit('mode', m); bus.emit('license'); bus.emit('rig'); bus.emit('antenna-rebuild');
  if (!quiet) toast(`<b>${MODES[m].label} mode.</b> ${m === 'training' ? 'Follow the guide on the right.' : m === 'free' ? 'Click the map to tune anywhere in the world.' : 'Everything is unlocked; build and tune it yourself.'}`, 'info', 4500);
}

// ------------------------------------------------------------------ Free Play automation
// Re-cut the antenna for the band you are on and let the tuner match it — like an
// automatic screwdriver antenna plus a wide-range tuner.
function autoMatch() {
  if (S.mode !== 'free') return;
  const b = bandOf(S.radio.freq);
  const a = S.antenna;
  if (b) {
    let type = a.type;
    if (type === 'yagi' && b.name === '160m') type = 'dipole';
    const L = cutFor(type, b.name);
    // Keep an antenna that is already cut for this band (e.g. an exact MoM-solved design); re-cut otherwise.
    const fits = type === a.type && a.length && Math.abs(a.length - L) / L < 0.08;
    if (!fits) { a.type = type; a.length = L; a.sizedBy = 'auto'; a.built = true; bus.emit('antenna'); }
  }
  S.radio.atuOn = true;
  S.radio.atuTunedFreq = S.radio.freq;
  save();
}

// ------------------------------------------------------------------ map targeting
// Rank the bands for a path from your station to a point on the map.
export function analyzeTarget(lat, lon) {
  const me = player(), tgt = { lat, lon };
  const dist = distanceKm(me, tgt), brg = bearing(me, tgt);
  const rows = [];
  for (const b of BANDS) {
    if (!rigRx(b.def)) continue;
    const f = (b.lo + b.hi) / 2e6;
    const p = propPath(me, tgt, f);
    const sig = 50 - p.loss; // 100 W, isotropic antennas
    const snr = sig - bandNoiseDbm(f, me);
    rows.push({ band: b.name, f, snr, loss: p.loss, mode: p.mode, muf: p.muf, live: p.live, tx: rig().tx.includes(b.name) });
  }
  rows.sort((a, b) => b.snr - a.snr);
  return { lat, lon, dist, brg, rows, best: rows.find((r) => r.snr > 3) || null };
}

export const mapTarget = { t: null };

function onMapTarget({ lat, lon }) {
  const an = analyzeTarget(lat, lon);
  mapTarget.t = an;
  bus.emit('target', an);
  if (S.mode !== 'free') return;
  if (!an.best) return toast(`No band is open to that location right now (${Math.round(an.dist).toLocaleString()} km). Try another time of day in the console.`, 'warn', 5000);
  tuneToTarget(an);
}

export function tuneToTarget(an, bandName = an.best?.band) {
  const b = bandByName(bandName);
  if (!b) return;
  const sb = b.name === '2m' ? 'FM' : SIDEBAND_FOR(b.def);
  bus.emit('tune-to', b.def, sb);
  // Find someone on that band near the target.
  setTimeout(() => {
    let best = null, bd = Infinity;
    for (const st of world.stations) {
      if (!st.op?.lat || st.role === 'beacon' || st.role === 'peer' || st.role === 'caller') continue;
      const d = distanceKm(st.op, an);
      if (d < bd) { bd = d; best = st; }
    }
    if (S.antenna.type === 'yagi') { S.antenna.heading = Math.round(an.brg); save(); bus.emit('antenna'); }
    if (best && bd < Math.max(1500, an.dist * 0.4)) {
      bus.emit('tune-to', best.freq, best.mode === 'CW' ? 'CW' : best.mode === 'FM' ? 'FM' : best.sb);
      toast(`Tuned to <b>${best.call}</b> (${best.op.qth || best.op.country || ''}) on ${(best.freq / 1e6).toFixed(3)} MHz ${best.mode === 'SSB' ? best.sb : best.mode} — ${b.name} is the best band to that area now.`, 'good', 6000);
    } else toast(`Tuned to ${b.name} (${(b.def / 1e6).toFixed(3)} MHz), the best band to that location now. No station is active right there — listen, or call CQ.`, 'info', 6000);
  }, 120);
}

// ------------------------------------------------------------------ Free Play console
export function initFreeConsole(el) {
  const draw = () => {
    el.innerHTML = '';
    if (S.mode !== 'free') { el.hidden = true; return; }
    el.hidden = false;
    const sel = (opts, cur, on, id) => { const s = h('select', { id }, ...opts.map(([v, l]) => h('option', { value: v, selected: String(v) === String(cur) }, l))); s.onchange = () => on(s.value); return s; };
    const field = (label, ctl) => h('label', { class: 'fc-field' }, h('span', {}, label), ctl);
    const hour = h('input', { type: 'range', min: 0, max: 23.5, step: 0.5, value: S.settings.hour ?? new Date().getUTCHours() });
    const hourLbl = h('span', { class: 'mono small' }, S.settings.hour == null ? 'Live' : `${String(Math.floor(S.settings.hour)).padStart(2, '0')}:${S.settings.hour % 1 ? '30' : '00'}Z`);
    hour.oninput = () => { S.settings.hour = +hour.value; hourLbl.textContent = `${String(Math.floor(hour.value)).padStart(2, '0')}:${hour.value % 1 ? '30' : '00'}Z`; save(); };
    hour.onchange = () => { world.repopulate(); bus.emit('solar'); };
    el.append(h('div', { class: 'card free-console' },
      h('div', { class: 'fc-head' }, h('div', {}, h('div', { class: 'eyebrow' }, 'Free Play'), h('h3', {}, 'Station console')),
        h('div', { class: 'row' }, h('div', { class: 'fc-hint' }, h('span', { html: icon('pin') }), 'Click anywhere on the map below to tune to the best band for that location.'), h('button', { class: 'btn primary small', onclick: () => openDesigner() }, h('span', { html: icon('wand') }), 'Design the best antenna for my location'), h('button', { class: 'btn small', onclick: () => openStationPlan() }, h('span', { html: icon('compass') }), 'Station plan'))),
      h('div', { class: 'fc-grid' },
        field('Station preset', sel(SETUPS.map((p) => [p.id, p.name]), S.setup || 'home', (v) => { applySetup(v, { quiet: true }); autoMatch(); draw(); toast(`Station changed: ${SETUPS.find((p) => p.id === v).name}.`, 'good', 3000); })),
        field('Radio', sel(Object.entries(RIGS).map(([id, r]) => [id, r.name]), S.rig || 'allmode', (v) => { S.rig = v; save(); bus.emit('rig'); autoMatch(); })),
        field('Antenna', sel(Object.entries(ANT_TYPES).map(([k, v]) => [k, v.label]), S.antenna.type, (v) => { S.antenna.type = v; save(); autoMatch(); bus.emit('antenna-rebuild'); draw(); })),
        field('Band', sel(BANDS.filter((b) => rigRx(b.def)).map((b) => [b.name, b.name]), bandOf(S.radio.freq)?.name || '20m', (v) => { const b = bandByName(v); bus.emit('tune-to', b.def, b.defMode); })),
        field('Location', sel(STATES.map((s) => [s.abbr, s.name]), S.op.state, (v) => { S.op.state = v; delete S.op.lat; delete S.op.lon; save(); bus.emit('qth'); world.repopulate(); })),
        h('div', { class: 'fc-field' }, h('span', {}, 'Time (UTC) ', hourLbl), h('div', { class: 'row' }, hour, h('button', { class: 'btn ghost small', onclick: () => { S.settings.hour = null; save(); world.repopulate(); bus.emit('solar'); draw(); } }, 'Live'))),
        h('div', { class: 'fc-field' }, h('span', {}, 'Space weather'), h('div', { class: 'row' },
          h('button', { class: 'btn ghost small', onclick: () => { SUN.randomize(); world.repopulate(); bus.emit('solar'); toast(`Space weather: SFI ${SUN.sfi}, K ${SUN.k}.`, 'info', 3000); } }, 'Randomise'),
          h('button', { class: 'btn ghost small', onclick: () => { SUN.override = false; SUN.key = null; SUN.shared(); world.repopulate(); bus.emit('solar'); } }, 'Live'))))));
  };
  draw();
  for (const ev of ['mode', 'rig', 'qth', 'band']) bus.on(ev, draw);
}

export function targetCard(t) {
  return h('div', { class: 'target-card' },
    h('div', { class: 'tc-head' }, h('span', { html: icon('target') }), h('b', {}, 'Path analysis'),
      h('span', { class: 'muted small' }, `${t.lat.toFixed(1)}°, ${t.lon.toFixed(1)}° · ${Math.round(t.dist).toLocaleString()} km · bearing ${Math.round(t.brg)}°`)),
    h('table', { class: 'tbl small' }, h('thead', {}, h('tr', {}, h('th', {}, 'Band'), h('th', {}, 'Path'), h('th', {}, 'Loss'), h('th', {}, 'Est. SNR'), h('th', {}))),
      h('tbody', {}, ...t.rows.filter((r) => r.f < 60).slice(0, 6).map((r) => h('tr', { class: r === t.best ? 'best' : '' },
        h('td', {}, h('b', {}, r.band)), h('td', {}, r.mode), h('td', {}, `${r.loss.toFixed(0)} dB`),
        h('td', { class: r.snr > 15 ? 'ok' : r.snr > 3 ? 'warn' : 'bad' }, `${r.snr > 0 ? '+' : ''}${r.snr.toFixed(0)} dB`),
        h('td', {}, r.snr > 3 ? h('button', { class: 'btn ghost small', onclick: () => tuneToTarget(t, r.band) }, 'Tune') : h('span', { class: 'tiny muted' }, 'closed')))))),
    h('p', { class: 'tiny muted' }, `Estimate for 100 W between isotropic antennas, from the same propagation model the receiver uses. ${t.rows.some((r) => r.live) ? 'The F2 layer along the path is the live NOAA GloTEC measurement.' : 'MUF and absorption are modelled from the sun along the path.'}`));
}

// ------------------------------------------------------------------ welcome
export function welcome(onDone) {
  const name = h('input', { value: S.op.name, placeholder: 'First name (optional)' });
  const sel = h('select', {}, ...STATES.map((s) => h('option', { value: s.abbr, selected: s.abbr === S.op.state }, s.name)));
  let close;
  const finish = (mode) => {
    S.op.name = name.value.trim(); S.op.state = sel.value; S.started = true;
    audio.init();
    if (mode === 'training') { S.training = { step: 0, done: {}, answers: {}, marks: {}, min: false }; }
    save(); close();
    bus.emit('qth'); world.repopulate();
    setAppMode(mode, { quiet: true });
    onDone && onDone(mode);
  };
  const card = (m) => h('button', { class: 'mode-card', onclick: () => finish(m) },
    h('span', { class: 'mc-icon', html: icon(MODES[m].icon) }), h('b', {}, MODES[m].label), h('span', { class: 'small muted' }, MODES[m].desc),
    h('span', { class: 'mc-go' }, 'Start', h('span', { html: icon('arrowRight') })));
  close = modal(h('div', { class: 'welcome' },
    h('div', { class: 'eyebrow' }, 'Amateur radio training & station simulation'),
    h('h1', {}, 'Ham Radio Simulator'),
    h('p', { class: 'lead' }, 'Build a complete amateur radio station in your browser — wiring, antenna design and measurement, receiving and operating — using a propagation model driven by live NOAA ionosphere data and a Method-of-Moments antenna solver.'),
    h('div', { class: 'row welcome-fields' }, h('label', { class: 'fc-field' }, h('span', {}, 'Name'), name), h('label', { class: 'fc-field' }, h('span', {}, 'Location (state)'), sel)),
    h('div', { class: 'mode-grid' }, card('training'), card('simulation'), card('free')),
    h('div', { class: 'callout welcome-safe' }, 'Nothing here transmits a real radio signal. Practise and experiment freely without interfering with licensed operators. Live data (space weather, ionosphere, weather, broadcast stations) is real; the radio traffic and stations are simulated.'),
    h('p', { class: 'tiny muted' }, 'Headphones recommended. Voice recognition works best in Chrome or Edge. You can change mode at any time from the mode selector at the top of the screen. Progress is saved in this browser.')),
  { wide: true, onClose: () => { if (!S.started) { S.started = true; S.mode ||= 'training'; save(); setAppMode(S.mode, { quiet: true }); } audio.init(); } });
}

export function initModes() {
  bus.on('map-target', onMapTarget);
  bus.on('set-mode', (m) => setAppMode(m));
  bus.on('band', () => { if (S.mode === 'free') autoMatch(); });
  setInterval(() => { if (S.mode === 'free' && S.radio.atuTunedFreq !== S.radio.freq && bandOf(S.radio.freq)) autoMatch(); }, 1500);
}
export { stateBy };
