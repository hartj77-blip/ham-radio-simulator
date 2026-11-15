// App bootstrap: tabs, header, onboarding, main loops, help & settings.
import { S, save, resetAll, licName, level } from './state.js';
import { h, $, $$, bus, toast, modal } from './util.js';
import { STATES, stateBy } from './data/world.js';
import { audio } from './audio.js';
import { world } from './world.js';
import { SUN, bandConditions, simDate, grid } from './propagation.js';
import { initShackUI, rigStatus, shackTick } from './shack.js';
import { initAntennaUI } from './antenna.js';
import { initRadioUI, rxUpdate, drawFrame, tuneBy, setFreq, setMode, updateDisplay } from './radio.js';
import { initOperatingUI, txState } from './operating.js';
import { initContestUI, contestTick } from './contest.js';
import { initExamUI, sandboxLicense } from './exam.js';
import { initLogbookUI } from './logbook.js';
import { initNetUI } from './net.js';
import { initWorkbenchUI } from './workbench.js';
import { initStoreUI, money, earn } from './store.js';
import { initMapUI, drawMap } from './map.js';
import { elmer } from './elmer.js';

const TABS = [['shack', '🔌 Shack'], ['antenna', '📡 Antenna'], ['workbench', '🛠 Workbench'], ['radio', '📻 Radio'], ['contest', '🏆 Contests'], ['license', '🪪 License'], ['logbook', '📒 Logbook'], ['store', '🛒 Hamfest'], ['help', '❔ Help']];

function header() {
  const st = stateBy(S.op.state);
  $('#station-id').innerHTML = `${S.call ? `<span class="callsign">${S.call}</span>` : '<span class="muted">SWL</span>'} <span class="badge lic-${S.license || 'none'}">${licName()}</span> <span class="muted small">${st ? st.name : ''} · ${st ? grid(st.lat, st.lon).slice(0, 4) : ''}</span>`;
  $('#xp').innerHTML = `<span class="wallet-mini">₵ ${money()}</span> Lv ${level()} · ${S.xp} XP`;
}

function solarBanner() {
  const st = stateBy(S.op.state);
  const bc = bandConditions(st);
  const cls = (c) => `bc-${c.toLowerCase()}`;
  $('#solar').innerHTML = `<span title="Solar Flux Index (10.7 cm)">SFI <b>${SUN.sfi}</b></span> <span title="A-index (daily geomagnetic)">A <b>${SUN.a}</b></span> <span title="K-index (3-hour geomagnetic)">K <b class="${SUN.k >= 5 ? 'bad' : SUN.k >= 4 ? 'warn' : ''}">${SUN.k}</b></span>`
    + bc.map((b) => `<span class="bc" title="day ${b.day} / night ${b.night}">${b.name} <b class="${cls(b.now)}">${b.now}</b></span>`).join('')
    + (SUN.es ? ' <span class="bc" title="Sporadic-E is likely today on 6 m and 10 m">Es <b class="bc-good">likely</b></span>' : '');
}

function clock() {
  const d = simDate();
  $('#clock').innerHTML = `${S.settings.hour != null ? '⏩ ' : ''}${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}<small>Z</small>`;
}

function showTab(t) {
  document.body.dataset.tab = t;
  $$('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === t));
  $$('.tab').forEach((s) => { s.hidden = s.id !== `tab-${t}`; });
  if (t === 'radio') updateDisplay();
  location.hash = t;
}

function onboarding() {
  const name = h('input', { value: S.op.name, placeholder: 'e.g. Jim', size: 14 });
  const sel = h('select', {}, ...STATES.map((s) => h('option', { value: s.abbr, selected: s.abbr === S.op.state }, s.name)));
  const close = modal(h('div', { class: 'onboard' },
    h('h1', {}, '📻 Ham Shack Simulator'),
    h('p', {}, 'Build a real amateur radio station from the wall plug to the antenna, learn what\'s on the license exams along the way, then get on the air and compete in contests.'),
    h('ol', { class: 'steps' },
      h('li', {}, h('b', {}, 'Shack:'), ' wire up power, coax, ground, mic and key.'),
      h('li', {}, h('b', {}, 'Antenna:'), ' cut a wire to length, raise it, check SWR.'),
      h('li', {}, h('b', {}, 'Radio:'), ' tune the bands — listen to CW, SSB, beacons, the local repeater.'),
      h('li', {}, h('b', {}, 'License:'), ' pass the Technician exam to transmit and get your callsign.'),
      h('li', {}, h('b', {}, 'Contests:'), ' run pileups, log accurately, beat your high score.')),
    h('div', { class: 'row wrap' }, h('label', {}, 'Your first name ', name), h('label', {}, 'Your QTH (state) ', sel)),
    h('p', { class: 'muted small' }, '🔊 Use headphones. Voice works best in Chrome or Edge (speech recognition). Your progress saves in this browser.'),
    h('button', { class: 'btn primary big', onclick: () => { S.op.name = name.value.trim(); S.op.state = sel.value; S.started = true; save(); audio.init(); close(); header(); solarBanner(); elmer('welcome'); world.repopulate(); } }, 'Start →'),
  ), { onClose: () => { S.started = true; save(); audio.init(); } });
}

function helpTab(el) {
  const hour = h('input', { type: 'range', min: 0, max: 23.5, step: 0.5, value: S.settings.hour ?? new Date().getUTCHours() });
  const hourLbl = h('span', {}, S.settings.hour == null ? 'real time' : `${S.settings.hour}:00 UTC`);
  const live = h('input', { type: 'checkbox', checked: S.settings.hour == null });
  const applyHour = () => { S.settings.hour = live.checked ? null : +hour.value; hourLbl.textContent = S.settings.hour == null ? 'real time' : `${Math.floor(hour.value)}:${hour.value % 1 ? '30' : '00'} UTC`; save(); world.repopulate(); solarBanner(); clock(); };
  hour.oninput = () => { live.checked = false; applyHour(); };
  live.onchange = applyHour;
  const qth = h('select', {}, ...STATES.map((s) => h('option', { value: s.abbr, selected: s.abbr === S.op.state }, s.name)));
  qth.onchange = () => { S.op.state = qth.value; save(); header(); solarBanner(); world.repopulate(); };
  const rate = h('input', { type: 'range', min: 0.7, max: 1.5, step: 0.05, value: S.settings.ttsRate });
  rate.oninput = () => { S.settings.ttsRate = +rate.value; save(); };
  el.append(h('div', { class: 'help-grid' },
    h('div', { class: 'card' }, h('h3', {}, '🚀 Quick start'),
      h('ol', { class: 'small' },
        h('li', {}, h('b', {}, 'Shack tab: '), 'connect the radio\'s red/black DC leads to + / − on the power supply, run coax from ANT through the SWR meter and tuner to the wall feedthrough, bond GND terminals to the ground bus, plug in mic and paddle, then switch on the supply and the radio.'),
        h('li', {}, h('b', {}, 'Antenna tab: '), 'pick a type and cut the wire (dipole ≈ 468 ÷ MHz feet). Raise it and sweep with the analyzer. Lower it to trim.'),
        h('li', {}, h('b', {}, 'Radio tab: '), 'pick a band, tune with the big knob, mouse wheel, arrow keys or by clicking the waterfall. Voice: 40 m LSB at night, 20 m USB by day. CW: bottom of each band. Try 14.100 for beacons and 146.940 FM for the local repeater (−600 kHz, 100.0 Hz tone).'),
        h('li', {}, h('b', {}, 'License tab: '), 'study, then take the Technician exam to get a callsign. Before that you can transmit into the dummy load.'),
        h('li', {}, h('b', {}, 'Make a QSO: '), 'find someone calling CQ, zero-beat them, press F4 (your call). Copy their report/name/QTH into the logger, send F2 (your reply) and F3 (73), then log it (Ctrl+Enter).'),
        h('li', {}, h('b', {}, 'Contests: '), 'pick an event and race the clock. F1 = CQ, Enter does the next logical thing (ESM).'))),
    h('div', { class: 'card' }, h('h3', {}, '⌨ Keys'),
      h('table', { class: 'tbl small' },
        ...[['Space (hold)', 'Push-to-talk (voice modes)'], ['← → / mouse wheel', 'Tune'], ['F1 … F8', 'Message macros'], ['Enter', 'ESM: send next message / log'], ['Ctrl+Enter', 'Log QSO'], ['Esc', 'Stop sending / wipe logger'], ['Space in call field', 'Jump to next field']].map(([k, v]) => h('tr', {}, h('td', {}, h('kbd', {}, k)), h('td', {}, v)))),
      h('h3', {}, '📖 Lingo'),
      h('p', { class: 'small' }, 'CQ calling anyone · DE from · K over · KN over (only you) · SK end of contact · 73 best regards · RST signal report · 5NN = 599 · QTH location · QSL confirm · QRZ? who\'s calling · QRL? is this freq busy · QSY change freq · QRS send slower · AGN again · TU thank you · OM old man (any male op) · YL young lady · ES and · FB fine business · HW? how copy? · WX weather · UR your')),
    h('div', { class: 'card' }, h('h3', {}, '⚙ Settings'),
      h('label', {}, 'QTH (your state) ', qth),
      h('label', {}, live, ' Real UTC time'), h('label', {}, 'Time warp ', hour, ' ', hourLbl),
      h('p', { class: 'muted tiny' }, 'Propagation follows the sun: low bands open at night, high bands by day.'),
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => { SUN.randomize(); world.repopulate(); solarBanner(); toast(`New space weather: SFI ${SUN.sfi}, K ${SUN.k}`, 'info'); } }, '☀ New space weather')),
      h('label', {}, 'AI voice speed ', rate),
      h('hr'),
      h('p', { class: 'small' }, h('b', {}, 'Sandbox: '), 'skip the exams and grant yourself a license (for jumping straight into contests).'),
      h('div', { class: 'row' }, ...['T', 'G', 'E'].map((l) => h('button', { class: 'btn small', onclick: () => sandboxLicense(l) }, `Grant ${licName(l)}`))),
      h('hr'),
      h('button', { class: 'btn warn small', onclick: () => { if (confirm('Erase ALL progress (license, log, station)?')) resetAll(); } }, 'Reset everything')),
    h('div', { class: 'card' }, h('h3', {}, 'ℹ About realism'),
      h('p', { class: 'small' }, 'Under the hood: a sun-driven ionosphere model (MUF, D-layer absorption, skip, K-index aurora), antenna impedance & SWR (feed-point R/X, harmonics, height above ground, radials, coax loss with mismatch), a receiver chain with real IF filtering, AGC, band noise and static crashes, FCC Part 97 privileges by license class, and AI operators who answer only when they can actually hear you.'),
      h('p', { class: 'small muted' }, 'Exam questions are original practice questions covering the official topics — always study the current NCVEC pool before your real VE session. Callsigns are randomly generated.')),
  ));
}

function init() {
  const nav = $('#tabs');
  for (const [id, label] of TABS) nav.append(h('button', { 'data-tab': id, onclick: () => showTab(id) }, label));
  initShackUI($('#tab-shack'));
  initAntennaUI($('#tab-antenna'));
  initWorkbenchUI($('#tab-workbench'));
  initRadioUI($('#radio-panel'));
  initMapUI($('#map-panel'));
  initOperatingUI($('#operating'));
  initNetUI($('#net-panel'));
  initContestUI($('#tab-contest'));
  initExamUI($('#tab-license'));
  initLogbookUI($('#tab-logbook'));
  initStoreUI($('#tab-store'));
  helpTab($('#tab-help'));
  header(); solarBanner(); clock();
  world.setFreq(S.radio.freq);
  showTab((location.hash || '').slice(1) || (S.started ? 'radio' : 'shack'));

  bus.on('xp', header);
  bus.on('money', (n, why) => { header(); if (n > 0 && why) toast(`+₵${n} (${why})`, 'good', 2500); });
  bus.on('logged', (q) => {
    if (q.status !== 'confirmed' || q.contest) return;
    const prev = S.log.slice(0, -1).filter((x) => x.status === 'confirmed');
    const newDx = q.truth?.country && !prev.some((x) => x.truth?.country === q.truth.country);
    const newSt = q.truth?.state && !prev.some((x) => x.truth?.state === q.truth.state);
    earn(5 + (newDx ? 15 : 0) + (newSt ? 5 : 0), 'QSO');
  });
  bus.on('license', () => { header(); });
  bus.on('goto', showTab);
  bus.on('elmer', (id) => elmer(id));
  bus.on('tune', (n) => tuneBy(n));
  bus.on('tune-to', (f, m) => { setFreq(f); if (m) setMode(m); showTab('radio'); });
  bus.on('band', (b) => {
    if (!b) return;
    if (['80m', '160m'].includes(b)) elmer('propagation_day');
    if (['15m', '12m', '10m'].includes(b)) elmer('muf');
    if (b === '2m') elmer('repeater');
    if (['20m', '17m', '15m', '12m', '10m'].includes(b) && S.tips.includes('muf')) setTimeout(() => elmer('beacon'), 4000);
    if (S.antenna.type === 'yagi') elmer('yagi');
  });
  bus.on('shack', () => { header(); updateDisplay(); });

  // unlock audio on first interaction
  const unlock = () => { audio.init(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  setInterval(() => { world.tick(); rxUpdate(); }, 100);
  setInterval(() => { clock(); contestTick(); $('#operating')?.classList.toggle('is-cw', S.radio.mode === 'CW'); }, 1000);
  setInterval(solarBanner, 60000);
  let last = 0;
  let lastMap = 0;
  const loop = (t) => { if (t - last > 60) { last = t; drawFrame(); } if (t - lastMap > 250) { lastMap = t; drawMap(); shackTick(txState); } requestAnimationFrame(loop); };
  requestAnimationFrame(loop);

  if (!S.started) onboarding();
  else if (S.license && !S.tips.includes('welcome')) elmer('welcome');
}

init();

// debug handle for automated tests / curious players
import * as _radio from './radio.js';
import * as _op from './operating.js';
window.__sim = { S, world, radio: _radio, op: _op, SUN };
