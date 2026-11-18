// Guidance: hover explanations (Explain mode) and the Find bar that jumps straight to something interesting to hear.
import { S, save } from './state.js';
import { h, $, bus, toast, modal } from './util.js';
import { rigStatus } from './shack.js';
import { world, player } from './world.js';
import { bandOf, bandByName, BANDS } from './data/bandplan.js';
import { path as propPath, bandNoiseDbm } from './propagation.js';
import { rig } from './rigs.js';
import { RW, WX_CHANNELS } from './realworld.js';
import { hashStr } from './util.js';
import { system } from './antenna.js';
import { NETS, netActive, nextNet, localHour, SVC, FT8_FREQ, hasMarine } from './activity.js';

// ------------------------------------------------------------------ Explain mode
const HELP = [
  ['.meter', 'S-meter', 'Signal strength in S-units (each S-unit = 6 dB; S9 = −73 dBm). While transmitting it shows power out (PO) or SWR — click to switch.'],
  ['.lcd-panel', 'Display', 'Frequency (MHz.kHz.Hz), mode, filter width, RIT offset, tuner status and SWR at a glance.'],
  ['.vfo-knob', 'VFO knob', 'Drag or scroll to tune. Pick the step size below it, or type a frequency in kHz.'],
  ['.waterfall', 'Spectrum & waterfall', 'Every signal near your frequency: brightness = strength, time scrolls down. Click a trace to tune to it. Green/blue bars = where your license lets you transmit.'],
  ['.btn-grid.bands .rbtn:not(.svc)', 'Ham bands', 'Jump between amateur bands. Low bands (160–40 m) are best at night, high bands (20–10 m) by day.'],
  ['.rbtn.svc', 'General coverage', 'Receive-only presets outside the ham bands: WWV time signals, oceanic air traffic, airband, NOAA Weather Radio, EMS, fire dispatch, railroad and marine or job-site radio.'],
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
  ['.whereami', 'Where you are', 'Follows the dial: who uses this frequency and why, when it works, what to do here, and whether you could listen or transmit in real life.'],
  ['#find-btn', 'Find', 'Shortcuts that tune you straight to something worth hearing right now.'],
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
  const career = S.mode === 'training';
  setTimeout(() => { const f = document.querySelector('.lf-call'); if (f) { f.value = career ? '' : st.call; f.dispatchEvent(new Event('input')); f.focus(); } }, 200);
  const where = st.op.country !== 'United States' && st.op.country !== st.op.qth ? `${st.op.qth}, ${st.op.country}` : st.op.qth;
  toast(`Found <b>${st.call}</b> (${where}) calling CQ. ${career ? 'Copy their call into the logger (that\'s the skill!) and' : 'Their call is in the logger —'} press <b>F4</b> to answer.`, 'good', 9000);
}
export function initFinder(el) {
  const B = (label, title, fn) => h('button', { class: 'find-btn', title, onclick: fn }, label);
  el.append(h('div', { class: 'finder' }, h('span', { class: 'ctl-title' }, 'FIND'),
    B('Best band now', 'The band most open from your QTH right now that your antenna can work', () => { const [x] = rankBands(); tuneBand(x.b); toast(`<b>${x.b.name}</b> looks best right now (propagation from your QTH${x.swr < 90 ? `, antenna SWR ${x.swr.toFixed(1)}:1` : ''}).`, 'info'); }),
    B('Whole dial', 'Every band from 500 kHz to 500 MHz: who uses it, why, and whether you can listen or transmit in real life', () => bus.emit('whole-dial')),
    B('A voice CQ', 'Tune to someone calling CQ on SSB', () => findCQ(false)),
    B('A CW CQ', 'Tune to someone calling CQ in Morse', () => findCQ(true)),
    B('Beacons', 'NCDXF beacons on 14.100 — check which continents are open', () => bus.emit('tune-to', 14100000, 'CW')),
    B('Repeater', 'Local 2 m repeater, with offset and tone set', () => { S.radio.rptOffset = -600000; S.radio.toneHz = 100; save(); bus.emit('tune-to', 146940000, 'FM'); toast('Local repeater: 146.940 MHz, −600 kHz offset, 100.0 Hz tone. Say your call to check in!', 'info'); }),
    B('WWV', 'Time signal on 10 MHz', () => { (S.flags ||= {}).wwv = 1; bus.emit('tune-to', 10e6, 'AM'); }),
    B('Weather', 'NOAA Weather Radio', () => bus.emit('tune-to', WX_CHANNELS[hashStr(RW.nws?.office || 'NWS') % 7], 'FM')),
    B('FT8', 'The busiest mode on HF: 15-second digital transmissions in a 3 kHz window', () => { const b = bandOf(S.radio.freq); const f = FT8_FREQ[b?.name] || FT8_FREQ[rankBands()[0].b.name] || 14074000; bus.emit('tune-to', f, 'USB'); toast(`FT8 on ${(f / 1e6).toFixed(3)} MHz USB. Each tone is one station sending for 12.6 seconds, then listening for 15. Turn on subtitles to see the decodes.`, 'info', 9000); }),
    B('Fire', 'County fire dispatch: two-tone paging and voice (listen only)', () => bus.emit('tune-to', SVC.fire, 'FM')),
    B('Railroad', 'Railroad road channel: crews, dispatcher, defect detectors (listen only)', () => bus.emit('tune-to', SVC.rail, 'FM')),
    ...(hasMarine() ? [B('Marine', 'Marine VHF channel 16: distress and calling (listen only)', () => bus.emit('tune-to', SVC.marine16, 'FM'))] : []),
    B('Oceanic', 'Airliners over the Atlantic reporting positions on HF sideband (listen only)', () => bus.emit('tune-to', localHour() > 7 && localHour() < 19 ? SVC.oceanic[1] : SVC.oceanic[0], 'USB')),
    B('Nets', 'Scheduled emergency, traffic and weather nets: practise checking in', openNets),
    B('Slow CW', 'Slow-speed CW stations and a code-practice broadcast', () => { const day = localHour() > 7 && localHour() < 18; bus.emit('tune-to', day ? 7047500 : 3581500, 'CW'); toast(`Code practice on ${day ? '7.0475' : '3.5815'} MHz. Slow-speed stations call CQ nearby in the CW segment, at 8–13 wpm.`, 'info', 6000); }),
    B('CB 19', 'CB channel 19, highway traffic (listen only)', () => bus.emit('tune-to', 27185000, 'AM')),
    B('Walkie-talkies', 'FRS channel 1, family walkie-talkies (listen only)', () => bus.emit('tune-to', 462562500, 'FM'))));
}

bus.on('open-nets', () => openNets());
function openNets() {
  let close;
  const row = (n) => {
    const on = netActive(n), dh = nextNet(n);
    return h('tr', { class: on ? 'best' : '' }, h('td', {}, h('b', {}, n.title()), h('div', { class: 'tiny muted' }, n.desc)),
      h('td', { class: 'mono' }, `${(n.freq / 1e6).toFixed(3)} ${n.mode}`), h('td', {}, n.band),
      h('td', {}, on ? h('b', { class: 'ok' }, 'On the air now') : `in ${Math.floor(dh)} h ${Math.round((dh % 1) * 60)} min`),
      h('td', {}, h('button', { class: 'btn small', onclick: () => { close(); if (n.band === '2m') { S.radio.rptOffset = -600000; S.radio.toneHz = 100; save(); } bus.emit('tune-to', n.freq, n.mode); } }, 'Tune')));
  };
  close = modal(h('div', {}, h('div', { class: 'eyebrow' }, 'Nets'), h('h2', {}, 'Scheduled nets'),
    h('p', { class: 'small muted' }, 'A net is an organised on-air meeting run by a net control station. Emergency nets practise for real events; traffic nets pass formal messages. Times are local to your station. To check in, wait until net control asks for check-ins, then transmit your callsign, name and location (hold Space and speak, or type it). Net control will acknowledge you. All nets and stations here are simulated.'),
    h('table', { class: 'tbl small' }, h('thead', {}, h('tr', {}, h('th', {}, 'Net'), h('th', {}, 'Frequency'), h('th', {}, 'Band'), h('th', {}, 'Status'), h('th', {}))), h('tbody', {}, ...NETS.map(row)))), { wide: true });

}
