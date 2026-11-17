// App bootstrap: navigation, status bar, modes, main loops, help.
import { S, save, licName } from './state.js';
import { h, $, $$, bus, toast } from './util.js';
import { icon } from './icons.js';
import { stateBy } from './data/world.js';
import { audio } from './audio.js';
import { world } from './world.js';
import { SUN, bandConditions, simDate, grid, mufAt } from './propagation.js';
import { startIono, IONO, blackout } from './iono.js';
import { initShackUI, shackTick } from './shack.js';
import { initAntennaUI } from './antenna.js';
import { initRadioUI, rxUpdate, drawFrame, tuneBy, setFreq, setMode, updateDisplay } from './radio.js';
import { initOperatingUI, txState } from './operating.js';
import { initContestUI, contestTick } from './contest.js';
import { initExamUI } from './exam.js';
import { initLogbookUI } from './logbook.js';
import { initNetUI, net, autoOnline } from './net.js';
import { initWorkbenchUI } from './workbench.js';
import { initRigBuilder } from './rigbuilder.js';
import { initMapUI, drawMap } from './map.js';
import { initWorldView } from './worldview.js';
import { openStation, applyLook, loadSlot } from './setups.js';
import { initExplain, initFinder } from './guide.js';
import { initTraining, initCourse } from './training.js';
import { initLibrary } from './libraryui.js';
import { MODES, initModes, migrateMode, welcome, initFreeConsole } from './modes.js';
import { initHT, showHT, isPhone, phoneStart } from './htview.js';
import { startRealWorld, RW } from './realworld.js';
import { initScannerUI } from './services.js';
import { elmer } from './elmer.js';
import { openSettings, applySettings } from './settings.js';
import { MISSION, REAL, SIMULATED, SOURCES, REFERENCES } from './data/sources.js';
import { initFeedback, openFeedback } from './feedback.js';
import { initRfTools } from './rftools.js';
import { initFeeds } from './feeds.js';
import { initHistory } from './history.js';
import './manualui.js';

// [id, label, icon, group]
const TABS = [
  ['course', 'Course', 'grad', 'Learn'], ['library', 'Reference library', 'book', 'Learn'], ['license', 'License study', 'badge', 'Learn'], ['history', 'Radio history', 'clock', 'Learn'],
  ['shack', 'Station wiring', 'plug', 'Build'], ['antenna', 'Antenna', 'antenna', 'Build'], ['workbench', 'Antenna workbench', 'flask', 'Build'], ['rigbuilder', 'Equipment', 'layers', 'Build'], ['rftools', 'RF tools', 'waveform', 'Build'],
  ['radio', 'Radio', 'radio', 'Operate'], ['logbook', 'Logbook', 'log', 'Operate'], ['contest', 'Contest practice', 'trophy', 'Operate'], ['feeds', 'Live feeds', 'ear', 'Operate'],
  ['help', 'Help', 'help', 'Support'],
];

function header() {
  const st = stateBy(S.op.state);
  $('#station-id').innerHTML = `<span class="sb-item"><span class="sb-k">Station</span>${S.call ? `<span class="callsign">${S.call}</span>` : '<span class="callsign muted">SWL</span>'}</span>`
    + `<span class="sb-item"><span class="sb-k">License</span><span class="lic lic-${S.license || 'none'}">${licName()}</span></span>`
    + `<span class="sb-item"><span class="sb-k">QTH</span><span>${st ? st.abbr : ''} ${st ? grid(st.lat, st.lon).slice(0, 4) : ''}</span></span>`;
  const on = net.online ? net.roster.length : null;
  $('#xp').innerHTML = on != null ? `<button class="net-badge" id="net-badge" title="Operators online">${icon('users')} ${on} online${net.roster.some((e) => e.tx) ? ' <span class="onair-dot"></span>' : ''}</button>` : '';
  const nb = document.getElementById('net-badge');
  if (nb) nb.onclick = () => { showTab('radio'); document.getElementById('net-card')?.scrollIntoView({ behavior: 'smooth' }); };
}

function solarBanner() {
  const st = stateBy(S.op.state);
  const bc = bandConditions(st);
  const cls = (c) => `bc-${c.toLowerCase()}`;
  const mq = st ? mufAt(st) : null;
  const ionoHtml = mq && mq.live ? `<span class="sb-item" title="Live from NOAA GloTEC (${IONO.time?.slice(11, 16)} UTC): MUF for a 3000 km hop and critical frequency over your location"><span class="sb-k">MUF</span><b>${mq.muf.toFixed(1)}</b><span class="sb-k">foF2</span><b>${mq.foF2.toFixed(1)}</b></span>` : '';
  const bo = blackout() ? `<span class="sb-item" title="NOAA: ${IONO.xray} / ${IONO.proton}"><b class="bad">HF absorption event</b></span>` : '';
  $('#solar').innerHTML = `${SUN.live ? '<span class="live-dot" title="Live data from the NOAA Space Weather Prediction Center">LIVE</span>' : ''}<span class="sb-item" title="Solar Flux Index (10.7 cm)"><span class="sb-k">SFI</span><b>${SUN.sfi}</b></span><span class="sb-item" title="A-index (daily geomagnetic)"><span class="sb-k">A</span><b>${SUN.a}</b></span><span class="sb-item" title="K-index (3-hour geomagnetic)"><span class="sb-k">K</span><b class="${SUN.k >= 5 ? 'bad' : SUN.k >= 4 ? 'warn' : ''}">${SUN.k}</b></span>${ionoHtml}${bo}`
    + `<span class="bc-group">${bc.map((b) => `<span class="bc" title="${b.name}: day ${b.day} / night ${b.night}"><span class="sb-k">${b.name.replace('-', '–')}</span><b class="${cls(b.now)}">${b.now}</b></span>`).join('')}`
    + (SUN.es ? '<span class="bc" title="Sporadic-E is likely today on 6 m and 10 m"><span class="sb-k">Es</span><b class="bc-good">Likely</b></span>' : '') + '</span>';
}

function clock() {
  const d = simDate();
  const w = RW.wx;
  const sky = w ? (w.storm ? 'storms' : w.snow ? 'snow' : w.rain ? 'rain' : w.fog ? 'fog' : w.cloud > 0.6 ? 'overcast' : w.cloud > 0.25 ? 'partly cloudy' : 'clear') : '';
  $('#clock').innerHTML = `${w ? `<span class="sb-item" title="Live weather: ${w.desc} (${w.source}${w.station ? ', ' + w.station : ''})"><span class="sb-k">WX</span>${w.tempF ?? ''}°F ${sky}</span>` : ''}<span class="sb-item utc"><span class="sb-k">${S.settings.hour != null ? 'UTC set' : 'UTC'}</span><b>${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}</b></span>`;
}

function modeSwitch() {
  const el = $('#mode-switch');
  el.innerHTML = '';
  for (const [m, x] of Object.entries(MODES)) el.append(h('button', { class: S.mode === m ? 'active' : '', role: 'tab', 'aria-selected': String(S.mode === m), title: x.desc, onclick: () => bus.emit('set-mode', m) }, h('span', { html: icon(x.icon) }), h('span', { class: 'lbl' }, x.label)));
}

function showTab(t) {
  if (!TABS.some(([id]) => id === t)) t = 'radio';
  if (document.body.classList.contains('ht-view')) showHT(false);
  document.body.dataset.tab = t;
  document.body.classList.remove('nav-open');
  $$('#tabs .nav-item').forEach((b) => b.classList.toggle('active', b.dataset.tab === t));
  $$('.tab').forEach((s) => { s.hidden = s.id !== `tab-${t}`; });
  const def = TABS.find(([id]) => id === t);
  $('#page-title').textContent = def[1];
  $('#page-eyebrow').textContent = def[3];
  if (t === 'radio') updateDisplay();
  bus.emit('tab', t);
  if (location.hash.slice(1) !== t) history.replaceState(null, '', `#${t}`);
}

function helpTab(el) {
  el.append(h('div', { class: 'page-head' }, h('div', {}, h('div', { class: 'eyebrow' }, 'Support'), h('h1', {}, 'Help'), h('p', { class: 'lead' }, 'How the simulator is organised, what is real and what is simulated, sources and credits, keyboard shortcuts and operating abbreviations.'))),
    h('div', { class: 'help-grid' },
      h('div', { class: 'card' }, h('h3', {}, 'Modes'),
        ...Object.entries(MODES).map(([, x]) => h('div', { class: 'help-mode' }, h('span', { class: 'hm-icon', html: icon(x.icon) }), h('div', {}, h('b', {}, x.label), h('p', { class: 'small muted' }, x.desc)))),
        h('p', { class: 'small' }, 'Switch at any time with the selector at the top of the screen. Your log, license and course progress are kept.')),
      h('div', { class: 'card' }, h('h3', {}, 'Workflow'),
        h('ol', { class: 'small steps' },
          h('li', {}, h('b', {}, 'Station wiring: '), 'connect DC power with correct polarity, run coax from the radio\'s ANT jack through the meter and tuner to the arrestor at the wall, bond every chassis to the ground bus, connect microphone and key, then switch on supply and radio.'),
          h('li', {}, h('b', {}, 'Antenna: '), 'choose a type, calculate the length (dipole ≈ 468 ÷ MHz ft), set height and feedline, raise it, then sweep with the analyzer and trim to resonance.'),
          h('li', {}, h('b', {}, 'Radio: '), 'pick a band for the time of day, set the mode (LSB below 10 MHz, USB above), scan with a coarse step and fine-tune. Click the waterfall to jump to a signal.'),
          h('li', {}, h('b', {}, 'License study: '), 'practise the question pool and take the examination for transmit privileges.'),
          h('li', {}, h('b', {}, 'Contacts: '), 'answer a CQ with F4, send your exchange with F2 and 73 with F3, then log (Ctrl+Enter).'))),
      h('div', { class: 'card' }, h('h3', {}, 'Keyboard'),
        h('table', { class: 'tbl small' },
          ...[['Space (hold)', 'Push-to-talk (voice modes)'], ['← → / mouse wheel', 'Tune'], ['F1 … F8', 'Message macros'], ['Enter', 'ESM: send next message / log'], ['Ctrl+Enter', 'Log QSO'], ['Esc', 'Stop sending / clear logger'], ['Space in call field', 'Next field']].map(([k, v]) => h('tr', {}, h('td', {}, h('kbd', {}, k)), h('td', {}, v))))),
      h('div', { class: 'card' }, h('h3', {}, 'Abbreviations'),
        h('p', { class: 'small' }, 'CQ calling any station · DE from · K over · KN over, named station only · SK end of contact · 73 best regards · RST signal report · 5NN 599 · QTH location · QSL confirm · QRZ? who is calling · QRL? is this frequency in use · QSY change frequency · QRS send slower · AGN again · TU thank you · ES and · FB fine business · WX weather · UR your'),
        h('button', { class: 'btn small', onclick: () => bus.emit('library', 'q-codes') }, 'Full Q-code reference')),
      h('div', { class: 'card' }, h('h3', {}, 'Report an issue'),
        h('p', { class: 'small muted' }, 'Found a bug, have an idea or a question? Use the question-mark button in the bottom corner of any page, or open the form here.'),
        h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => openFeedback('bug') }, 'Report a problem'), h('button', { class: 'btn', onclick: () => openFeedback('idea') }, 'Suggest an improvement'))),
      h('div', { class: 'card' }, h('h3', {}, 'Settings'),
        h('p', { class: 'small muted' }, 'Audio, display size and touch layout, mode and guidance, PTT key and CW speed, time and space weather, location, and backup/restore of your data.'),
        h('button', { class: 'btn primary', onclick: () => openSettings() }, 'Open settings')),
      h('div', { class: 'card' }, h('h3', {}, 'About the models'),
        h('p', { class: 'small' }, 'Propagation: a simplified HF model (MUF, D-layer absorption, skip, multi-hop, K-index and auroral loss) driven by live NOAA ionosphere data when available. Antennas: a Method-of-Moments solver with height, ground, radials and coax loss including mismatch. Receiver: IF filtering, AGC, band noise and static. Rules: FCC Part 97 privileges by license class.'),
        h('button', { class: 'btn small', onclick: () => document.getElementById('about-real')?.scrollIntoView({ behavior: 'smooth' }) }, 'What is real and what is simulated')),
    ),
    h('div', { class: 'card about-card', id: 'about-mission' }, h('h3', {}, 'Purpose'), h('p', {}, MISSION)),
    h('div', { class: 'card about-card', id: 'about-real' }, h('h3', {}, 'What is real and what is simulated'),
      h('div', { class: 'real-sim' },
        h('div', {}, h('h4', { class: 'ok' }, 'Real (live or published data)'), h('dl', { class: 'design-why' }, ...REAL.flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]))),
        h('div', {}, h('h4', { class: 'warn' }, 'Simulated'), h('dl', { class: 'design-why' }, ...SIMULATED.flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]))))),
    h('div', { class: 'card about-card', id: 'about-sources' }, h('h3', {}, 'Sources and credits'),
      h('p', { class: 'small muted' }, 'Outside services and libraries the app uses while running. Only your approximate location is sent to the weather, terrain and broadcast services; your name and callsign are never sent.'),
      h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl small' }, h('thead', {}, h('tr', {}, h('th', {}, 'Source'), h('th', {}, 'Used for'), h('th', {}, 'Terms'))),
        h('tbody', {}, ...SOURCES.map(([n, u, l, t]) => h('tr', {}, h('td', {}, h('a', { href: l, target: '_blank', rel: 'noopener' }, n)), h('td', {}, u), h('td', { class: 'muted' }, t)))))),
      h('h4', {}, 'Published references'),
      h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl small' }, h('thead', {}, h('tr', {}, h('th', {}, 'Reference'), h('th', {}, 'Used for'))),
        h('tbody', {}, ...REFERENCES.map(([n, u, l]) => h('tr', {}, h('td', {}, l ? h('a', { href: l, target: '_blank', rel: 'noopener' }, n) : n), h('td', {}, u))))))));

}

function buildChrome() {
  const nav = $('#tabs');
  let group = null;
  for (const [id, label, ic, g] of TABS) {
    if (g === 'Support') continue;
    if (g !== group) { group = g; nav.append(h('div', { class: 'nav-group' }, g)); }
    nav.append(h('button', { class: 'nav-item', 'data-tab': id, onclick: () => showTab(id) }, h('span', { html: icon(ic) }), h('span', {}, label)));
  }
  $('#side-foot').append(
    h('button', { class: 'nav-item', 'data-tab': 'help', onclick: () => showTab('help') }, h('span', { html: icon('help') }), h('span', {}, 'Help')),
    h('button', { class: 'nav-item', onclick: () => openSettings() }, h('span', { html: icon('settings') }), h('span', {}, 'Settings')));
  $('#menu-btn').innerHTML = icon('menu');
  $('#menu-btn').onclick = () => document.body.classList.toggle('nav-open');
  const tool = (id, ic, label, title, fn) => h('button', { class: 'tool-btn', id, title, onclick: fn }, h('span', { html: icon(ic) }), h('span', { class: 'lbl' }, label));
  $('#tb-tools').append(
    tool('station-btn', 'station', 'Station', 'Station presets, radio model, saved antennas, appearance', () => openStation()),
    tool('ht-btn', 'handheld', 'Handheld', 'Switch between the handheld radio and the full station', () => showHT(!document.body.classList.contains('ht-view'))),
    tool('explain-btn', 'info', 'Explain', 'Hover any control to learn what it does', (e) => { S.settings.explain = !S.settings.explain; save(); e.currentTarget.classList.toggle('active', S.settings.explain); toast(S.settings.explain ? 'Explain mode on — hover over any control.' : 'Explain mode off.', 'info', 2500); }));
  $('#explain-btn').classList.toggle('active', !!S.settings.explain);
  modeSwitch();
}

function init() {
  migrateMode();
  buildChrome();
  initModes();
  initFeedback();
  initTraining($('#coach'));
  initExplain();
  initFinder($('#finder'));
  initHT($('#ht-panel'));
  initShackUI($('#tab-shack'));
  initAntennaUI($('#tab-antenna'));
  initWorkbenchUI($('#tab-workbench'));
  initRigBuilder($('#tab-rigbuilder'));
  bus.on('rig', () => { if (S.rbDraft && S.rbDraft.rig !== S.rig) { S.rbDraft.rig = S.rig; } });
  initRadioUI($('#radio-panel'));
  initFreeConsole($('#free-console'));
  initMapUI($('#map-panel'));
  initWorldView($('#world-panel'));
  initScannerUI($('#scanner-panel'));
  startRealWorld();
  startIono();
  bus.on('iono', () => { solarBanner(); world.bandCache = {}; });
  bus.on('realworld', (k) => { if (k === 'sun') { solarBanner(); world.bandCache = {}; } if (k === 'wx') clock(); });
  initOperatingUI($('#operating'));
  initNetUI($('#net-panel'));
  initContestUI($('#tab-contest'));
  initExamUI($('#tab-license'));
  initLogbookUI($('#tab-logbook'));
  initCourse($('#tab-course'));
  initLibrary($('#tab-library'));
  initRfTools($('#tab-rftools'));
  initFeeds($('#tab-feeds'));
  initHistory($('#tab-history'));
  helpTab($('#tab-help'));
  header(); solarBanner(); clock();
  world.setFreq(S.radio.freq);
  const start = (location.hash || '').slice(1);
  showTab(start && start !== 'store' ? start : (S.mode === 'training' ? 'course' : 'radio'));

  bus.on('roster', header);
  bus.on('license', header);
  bus.on('qth', () => { header(); solarBanner(); });
  bus.on('mode', () => { modeSwitch(); header(); });
  bus.on('goto', showTab);
  bus.on('elmer', (id) => elmer(id));
  bus.on('tune', (n) => tuneBy(n));
  bus.on('tune-to', (f, m) => { setFreq(f, { mode: m }); if (m) setMode(m); showTab('radio'); });
  bus.on('ant-slot', (i) => loadSlot(i));
  bus.on('rig', () => { applyLook(); header(); });
  bus.on('explain', () => $('#explain-btn')?.classList.toggle('active', !!S.settings.explain));
  applyLook(); applySettings();
  bus.on('solar', () => { solarBanner(); clock(); });
  bus.on('open-settings', () => openSettings());
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
  const unlock = () => { audio.init(); applySettings(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  setInterval(() => { world.tick(); rxUpdate(); }, 100);
  setInterval(() => { clock(); contestTick(); $('#operating')?.classList.toggle('is-cw', S.radio.mode === 'CW'); }, 1000);
  setInterval(() => { if (SUN.shared()) { world.bandCache = {}; } solarBanner(); }, 60000);
  let lastMap = 0;
  const loop = (t) => { drawFrame(); if (t - lastMap > 250) { lastMap = t; drawMap(); shackTick(txState); } requestAnimationFrame(loop); };
  requestAnimationFrame(loop);

  if (!S.started) welcome((m) => { header(); solarBanner(); showTab(m === 'training' ? 'shack' : 'radio'); if (isPhone()) { phoneStart(); showHT(true); } });
  if (S.started) setTimeout(autoOnline, 1500);
  bus.on('view', (v) => { const b = $('#ht-btn .lbl'); if (b) b.textContent = v === 'ht' ? 'Full station' : 'Handheld'; });
  const sv = S.settings.startView || 'auto';
  if (S.started && (sv === 'ht' || (sv === 'auto' && (S.settings.view === 'ht' || (isPhone() && S.settings.view !== 'station'))))) { if (isPhone()) phoneStart(); showHT(true); }
}

init();

// ------------------------------------------------------------------ always run the newest version
// A service worker fetches our files network-first (see sw.js), so a new deploy is picked up on the
// next load instead of after the browser's cache expires. A returning user whose page was loaded
// from stale cache gets one automatic reload when the worker takes over.
export const appVersion = { modified: null };
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController && S.started && !sessionStorage.getItem('swReloaded')) { sessionStorage.setItem('swReloaded', '1'); location.reload(); }
  });
}
async function checkVersion(announce) {
  try {
    const r = await fetch('js/main.js', { method: 'HEAD', cache: 'no-store' });
    const m = r.headers.get('last-modified') || r.headers.get('etag');
    if (!m) return;
    if (!appVersion.modified) appVersion.modified = m;
    else if (m !== appVersion.modified) {
      toast('A new version is available. <button class="btn small primary" onclick="location.reload()">Reload now</button>', 'info', 60000);
      appVersion.modified = m;
    } else if (announce) toast('You have the latest version.', 'good', 3000);
  } catch (e) { /* offline */ }
}
checkVersion();
setInterval(checkVersion, 10 * 60 * 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkVersion(); });
bus.on('check-version', () => checkVersion(true));

// debug handle for automated tests
import * as _radio from './radio.js';
import * as _op from './operating.js';
window.__sim = { S, world, radio: _radio, op: _op, SUN, net, audio, RW };
