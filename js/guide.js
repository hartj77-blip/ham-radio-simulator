// Guidance: a goal tracker with "Show me", hover explanations (Explain mode),
// and the Find bar that jumps straight to something interesting to hear.
import { S, save, addXp } from './state.js';
import { h, $, bus, toast, modal } from './util.js';
import { rigStatus } from './shack.js';
import { world, player } from './world.js';
import { bandOf, bandByName, BANDS } from './data/bandplan.js';
import { path as propPath, bandNoiseDbm } from './propagation.js';
import { rig } from './rigs.js';
import { earn, freePlay } from './store.js';
import { RW, WX_CHANNELS } from './realworld.js';
import { hashStr } from './util.js';
import { system } from './antenna.js';

// ------------------------------------------------------------------ goals
const GOALS = [
  { id: 'wire', name: 'Wire up your station', tab: 'shack', sel: '.shack-status', how: 'Connect power (red→+, black→−), coax from ANT to the wall feedthrough, grounds, mic and key, then switch on. Or press 🎛 Station → Quick setups.', done: () => rigStatus().powered && rigStatus().end !== 'open' },
  { id: 'antenna', name: 'Put up an antenna', tab: 'antenna', sel: '.ant-controls .btn.big', how: 'Pick a type, cut the wire (dipole ≈ 468 ÷ MHz feet), and raise it.', done: () => S.antenna.built && rigStatus().antennaOk },
  { id: 'listen', name: 'Hear your first station', tab: 'radio', sel: '#finder', how: 'Use the Find bar ("Best band now") or click a signal on the waterfall.', done: () => S.flags?.heard },
  { id: 'swr', name: 'Get a low SWR (under 2:1)', tab: 'radio', sel: '#atu-btn', how: 'Tune to a band your antenna is cut for, then press TUNE to let the tuner match it.', done: () => S.flags?.lowSwr },
  { id: 'wwv', name: 'Listen to WWV (propagation check)', tab: 'radio', sel: '.rbtn.svc', how: 'Press WWV under General Coverage. Hear the ticks? Then 10 MHz is open from Colorado to you.', done: () => S.flags?.wwv },
  { id: 'license', name: 'Earn your Technician license', tab: 'license', sel: '.exam-row', how: 'Study, then take the VE exam (26 of 35 to pass).', done: () => !!S.license, skip: () => S.gameMode === 'listener' },
  { id: 'qso', name: 'Make your first contact', tab: 'radio', sel: '.logger', how: 'Find a CQ (Find bar), press F4 to call, F2 to reply, F3 to sign, then Log QSO.', done: () => S.log.some((q) => q.status === 'confirmed'), skip: () => S.gameMode === 'listener' },
  { id: 'dx', name: 'Work a DX (foreign) station', tab: 'radio', sel: '#map-panel', how: 'Try 20 m in daytime or 40 m at night. The map shows who you can hear.', done: () => S.log.some((q) => q.status === 'confirmed' && q.truth?.country && q.truth.country !== 'United States'), skip: () => S.gameMode === 'listener' },
  { id: 'repeater', name: 'Talk through the local repeater', tab: 'radio', sel: '#finder', how: 'Find bar → Repeater sets 146.940 −600 with a 100 Hz tone. Call with your callsign.', done: () => S.log.some((q) => q.mode === 'FM') || S.flags?.rpt, skip: () => S.gameMode === 'listener' },
  { id: 'workbench', name: 'Design an antenna in the Workbench', tab: 'workbench', sel: '.wb-design', how: 'Pick a template, Auto-tune to your band, look at the pattern.', done: () => S.flags?.wb },
  { id: 'contest', name: 'Enter a contest', tab: 'contest', sel: '.contest-picks', how: 'Pick Field Day for an easy start. F1 = CQ, Enter does the next thing.', done: () => Object.values(S.scores || {}).some((x) => x.length), skip: () => S.gameMode === 'listener' },
  { id: 'online', name: 'Get on the air with real players', tab: 'radio', sel: '#net-card', how: 'Press "Go on the air with real players" and tune where they are.', done: () => !!S.settings.autoOnline },
];
const active = () => GOALS.filter((g) => !(g.skip && g.skip()));

let bar;
export function initGuide(el) {
  bar = el;
  render();
  setInterval(check, 2000);
  bus.on('goto-goal', (id) => showMe(GOALS.find((g) => g.id === id)));
}
function check() {
  S.flags ||= {};
  let changed = false;
  for (const g of active()) {
    if (S.flags[`goal_${g.id}`]) continue;
    let ok = false;
    try { ok = !!g.done(); } catch (e) { }
    if (ok) {
      S.flags[`goal_${g.id}`] = Date.now(); changed = true;
      if (!freePlay()) { addXp(25, 'goal'); earn(15, 'goal'); }
      toast(`🎯 Goal complete: <b>${g.name}</b>`, 'good', 5000);
    }
  }
  if (changed) save();
  render();
}
function render() {
  if (!bar) return;
  const list = active();
  const next = list.find((g) => !S.flags?.[`goal_${g.id}`]);
  const doneN = list.filter((g) => S.flags?.[`goal_${g.id}`]).length;
  bar.innerHTML = '';
  if (S.settings.hideGuide) { bar.append(h('button', { class: 'link small', onclick: () => { S.settings.hideGuide = false; save(); render(); } }, '🎯 show goals')); return; }
  bar.append(h('div', { class: 'guide-inner' },
    h('span', { class: 'g-prog', title: `${doneN} of ${list.length} goals` }, h('span', { style: { width: `${(doneN / list.length) * 100}%` } })),
    next ? h('span', {}, h('b', {}, '🎯 Next: '), next.name, h('span', { class: 'muted small' }, ` — ${next.how}`)) : h('span', {}, '🏅 All goals complete — you\'re a real ham now. 73!'),
    next ? h('button', { class: 'btn primary small', onclick: () => showMe(next) }, 'Show me') : null,
    h('button', { class: 'btn small', onclick: allGoals }, `Goals ${doneN}/${list.length}`),
    h('button', { class: 'link small', title: 'Hide the goal bar', onclick: () => { S.settings.hideGuide = true; save(); render(); } }, '✕')));
}
function allGoals() {
  const close = modal(h('div', {}, h('h2', {}, '🎯 Goals'), h('p', { class: 'muted small' }, 'A path from first listen to seasoned operator. Each one teaches something on the license exams or that every ham uses.'),
    h('ol', { class: 'goal-list' }, ...active().map((g) => h('li', { class: S.flags?.[`goal_${g.id}`] ? 'ok' : '' }, h('b', {}, g.name), h('div', { class: 'small muted' }, g.how),
      h('button', { class: 'btn small', onclick: () => { close(); showMe(g); } }, 'Show me'))))));
}
function showMe(g) {
  if (!g) return;
  bus.emit('goto', g.tab);
  setTimeout(() => {
    const el = document.querySelector(g.sel);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('pulse-hl');
    setTimeout(() => el.classList.remove('pulse-hl'), 4000);
  }, 120);
  toast(`🧭 <b>${g.name}</b><br>${g.how}`, 'info', 8000);
}

// ------------------------------------------------------------------ Explain mode
const HELP = [
  ['.meter', 'S-meter', 'Signal strength in S-units (each S-unit = 6 dB; S9 = −73 dBm). While transmitting it shows power out (PO) or SWR — click to switch.'],
  ['.lcd-panel', 'Display', 'Frequency (MHz.kHz.Hz), mode, filter width, RIT offset, tuner status and SWR at a glance.'],
  ['.vfo-knob', 'VFO knob', 'Drag or scroll to tune. Pick the step size below it, or type a frequency in kHz.'],
  ['.waterfall', 'Spectrum & waterfall', 'Every signal near your frequency: brightness = strength, time scrolls down. Click a trace to tune to it. Green/blue bars = where your license lets you transmit.'],
  ['.btn-grid.bands .rbtn:not(.svc)', 'Ham bands', 'Jump between amateur bands. Low bands (160–40 m) are best at night, high bands (20–10 m) by day.'],
  ['.rbtn.svc', 'General coverage', 'Receive-only presets outside the ham bands: AM/FM broadcast, WWV time signals, airband, NOAA Weather Radio, EMS.'],
  ['.btn-grid.modes', 'Mode', 'LSB/USB = voice (LSB below 10 MHz, USB above). CW = Morse. AM = broadcast & airband. FM = repeaters/VHF. WFM = FM broadcast.'],
  ['#filter-sel', 'IF filter', 'How much spectrum you listen to. Narrower = less noise and interference, but too narrow distorts voice. CW loves 250–500 Hz.'],
  ['.knobrow:has(input[type=range])', 'Control', 'AF GAIN = volume. SQL = squelch (mutes FM noise until a signal opens it). POWER = transmit power — use the minimum needed.'],
  ['#att-btn', 'Attenuator', 'Cuts 12 dB from everything — for very strong nearby signals that overload the receiver.'],
  ['#rit-btn', 'RIT', 'Receiver Incremental Tuning: fine-tune what you hear without moving your transmit frequency.'],
  ['#atu-btn', 'Antenna tuner', 'Matches your antenna system to 50 Ω so the rig delivers full power. It doesn\'t make a bad antenna radiate better.'],
  ['.fm-only', 'Repeater settings', 'Repeaters listen on one frequency and transmit on another: 2 m offset is ±600 kHz. Most also need a CTCSS (PL) tone.'],
  ['.logger', 'Logger', 'Type the call you\'re working; F-keys send standard messages. Enter does the next logical step (ESM). Ctrl+Enter logs.'],
  ['.ptt', 'Push-to-talk', 'Hold SPACE (or this button) to transmit your voice. Release to listen.'],
  ['.pmap', 'Propagation map', 'Day/night, the greyline, every station on your band, and the path to who you\'re hearing. Click to tune.'],
  ['.scanner', 'What\'s on the air', 'Real stations and services near you, with estimated signal strength. Tune to any of them.'],
  ['#finder', 'Find bar', 'Shortcuts that tune you straight to something worth hearing right now.'],
  ['.shack-svg', 'Shack wiring', 'Click a connector, then where the cable goes. Coax: radio ANT → meter → tuner → wall. Bond every GND to the ground bus.'],
  ['.analyzer', 'Antenna analyzer', 'SWR across the band. A dip below the band = antenna too long (trim it). Above = too short.'],
];
let pop;
export function initExplain() {
  pop = h('div', { class: 'help-pop', hidden: true });
  document.body.append(pop);
  document.addEventListener('mouseover', (e) => {
    if (!S.settings.explain) { pop.hidden = true; return; }
    for (const [sel, title, text] of HELP) {
      let el = null;
      try { el = e.target.closest(sel); } catch (x) { }
      if (el) {
        pop.innerHTML = `<b>${title}</b><br>${text}`;
        const r = el.getBoundingClientRect();
        pop.style.left = `${Math.min(window.innerWidth - 300, Math.max(8, r.left))}px`;
        pop.style.top = `${r.bottom + 8 + window.scrollY > window.scrollY + window.innerHeight - 120 ? r.top - 110 + window.scrollY : r.bottom + 8 + window.scrollY}px`;
        pop.hidden = false;
        return;
      }
    }
    pop.hidden = true;
  });
}

// ------------------------------------------------------------------ Find bar
// Bands ranked by how open they are from your QTH AND how well your antenna works there.
function rankBands() {
  const me = player();
  const refs = [[45, 1200], [70, 6500], [300, 9000], [180, 2500], [120, 11000]]; // bearing, km
  const dest = (b, km) => { const R = 6371, d = km / R, th = b * Math.PI / 180, la = me.lat * Math.PI / 180, lo = me.lon * Math.PI / 180;
    const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(th)); const lo2 = lo + Math.atan2(Math.sin(th) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2));
    return { lat: la2 * 180 / Math.PI, lon: lo2 * 180 / Math.PI }; };
  const out = [];
  const tuner = rigStatus().hasTuner || rig().atu;
  for (const b of BANDS.filter((x) => !['6m', '2m'].includes(x.name) && (rig().tx.length ? rig().tx.includes(x.name) : true))) {
    const f = (b.lo + b.hi) / 2e6;
    let score = 0;
    for (const [brg, km] of refs) { const snr = 50 - propPath(dest(brg, km), me, f).loss - bandNoiseDbm(f, me); if (snr > 6) score += km / 1000; }
    score += f / 30; // prefer higher bands when equal
    const sys = S.antenna.built ? system(b.def) : null;
    const swr = sys ? sys.swrRig : 99;
    if (swr > (rigStatus().hasTuner ? 10 : tuner ? 3 : 2)) score *= 0.15; // antenna can't be matched there
    out.push({ b, score, swr });
  }
  return out.sort((x, y) => y.score - x.score);
}
const bestBand = () => rankBands()[0].b;
function tuneBand(b, mode) { bus.emit('tune-to', S.radio.lastByBand[b.name]?.f || b.def, mode || b.defMode); }
function findCQ(cw) {
  const want = cw ? 'CW' : 'SSB';
  const pickOne = () => {
    const nf = bandNoiseDbm(S.radio.freq / 1e6, player());
    return world.stations.filter((s) => s.role === 'cq' && s.mode === want && world.rxDbm(s) > nf + 12).sort((a, b) => world.rxDbm(b) - world.rxDbm(a))[0];
  };
  let st = bandOf(S.radio.freq) ? pickOne() : null;
  for (const { b } of rankBands().slice(0, 4)) {
    if (st) break;
    tuneBand(b, cw ? 'CW' : b.defMode);
    st = pickOne();
  }
  if (!st) return toast('Nobody strong is calling CQ right now — try again in a minute, or call CQ yourself (F1).', 'warn');
  bus.emit('tune-to', st.freq, cw ? 'CW' : st.sb);
  const career = !freePlay();
  setTimeout(() => { const f = document.querySelector('.lf-call'); if (f) { f.value = career ? '' : st.call; f.dispatchEvent(new Event('input')); f.focus(); } }, 200);
  const where = st.op.country !== 'United States' && st.op.country !== st.op.qth ? `${st.op.qth}, ${st.op.country}` : st.op.qth;
  toast(`🎯 Found <b>${st.call}</b> (${where}) calling CQ. ${career ? 'Copy their call into the logger (that\'s the skill!) and' : 'Their call is in the logger —'} press <b>F4</b> to answer.`, 'good', 9000);
}
export function initFinder(el) {
  const B = (label, title, fn) => h('button', { class: 'find-btn', title, onclick: fn }, label);
  el.append(h('div', { class: 'finder' }, h('span', { class: 'ctl-title' }, 'FIND'),
    B('📈 Best band now', 'The band most open from your QTH right now that your antenna can work', () => { const [x] = rankBands(); tuneBand(x.b); toast(`📈 <b>${x.b.name}</b> looks best right now (propagation from your QTH${x.swr < 90 ? `, antenna SWR ${x.swr.toFixed(1)}:1` : ''}).`, 'info'); }),
    B('🗣 A voice CQ', 'Tune to someone calling CQ on SSB', () => findCQ(false)),
    B('📟 A CW CQ', 'Tune to someone calling CQ in Morse', () => findCQ(true)),
    B('📡 Beacons', 'NCDXF beacons on 14.100 — check which continents are open', () => bus.emit('tune-to', 14100000, 'CW')),
    B('🔁 Repeater', 'Local 2 m repeater, with offset and tone set', () => { S.radio.rptOffset = -600000; S.radio.toneHz = 100; save(); bus.emit('tune-to', 146940000, 'FM'); toast('🔁 Local repeater: 146.940 MHz, −600 kHz offset, 100.0 Hz tone. Say your call to check in!', 'info'); }),
    B('⏱ WWV', 'Time signal on 10 MHz', () => { (S.flags ||= {}).wwv = 1; bus.emit('tune-to', 10e6, 'AM'); }),
    B('🌦 Weather', 'NOAA Weather Radio', () => bus.emit('tune-to', WX_CHANNELS[hashStr(RW.nws?.office || 'NWS') % 7], 'FM')),
    B('📻 FM radio', 'FM broadcast band', () => bus.emit('tune-to', S.radio.lastByBand.FM?.f || 98.1e6, 'WFM'))));
}
