// Settings: audio, display, layout, mode & guidance, operating, time & propagation,
// location & privacy, and your saved data.
import { S, save, resetAll, licName } from './state.js';
import { h, bus, toast, modal, download } from './util.js';
import { STATES } from './data/world.js';
import { audio } from './audio.js';
import { world } from './world.js';
import { SUN } from './propagation.js';
import { net } from './net.js';
import { sandboxLicense } from './exam.js';
import { applyLook, openStation } from './setups.js';
import { MODES } from './modes.js';
import { reapplyMode } from './radio.js';

const ST = () => S.settings;
const TABS = [['audio', 'Audio'], ['display', 'Display & layout'], ['play', 'Mode & guidance'], ['op', 'Operating'], ['time', 'Time & space weather'], ['loc', 'Location & privacy'], ['data', 'Data']];

// Apply the settings that live outside individual panels (call at start-up and on change).
export function applySettings() {
  const s = ST();
  document.documentElement.style.fontSize = `${Math.round(16 * (s.uiScale || 1))}px`;
  document.body.classList.toggle('reduce-motion', !!s.reduceMotion);
  document.body.classList.toggle('big-touch', s.touch === 'big' || (s.touch !== 'normal' && window.matchMedia('(pointer: coarse)').matches));
  document.body.classList.toggle('left-hand', !!s.leftHand);
  if (audio.ready) audio.setMaster(s.masterVol ?? 1);
}

export function openSettings(tab = 'audio') {
  let close;
  const body = h('div', { class: 'settings-modal' });
  const row = (label, ctl, help) => h('div', { class: 'set-row' }, h('div', {}, h('b', {}, label), help ? h('div', { class: 'tiny muted' }, help) : null), h('div', { class: 'set-ctl' }, ctl));
  const range = (key, min, max, step, fmt, after, obj = ST()) => {
    const out = h('span', { class: 'val' }, fmt(obj[key] ?? (min + max) / 2));
    const i = h('input', { type: 'range', min, max, step, value: obj[key] ?? (min + max) / 2 });
    i.oninput = () => { obj[key] = +i.value; out.textContent = fmt(+i.value); save(); after && after(); };
    return h('span', { class: 'row' }, i, out);
  };
  const check = (key, after, obj = ST(), invert = false) => { const c = h('input', { type: 'checkbox', checked: invert ? obj[key] === false : obj[key] !== false && !!(obj[key] ?? true) }); c.onchange = () => { obj[key] = invert ? !c.checked : c.checked; save(); after && after(); }; return c; };
  const chk0 = (key, after, obj = ST()) => { const c = h('input', { type: 'checkbox', checked: !!obj[key] }); c.onchange = () => { obj[key] = c.checked; save(); after && after(); }; return c; };
  const select = (key, opts, after, obj = ST()) => { const s = h('select', {}, ...opts.map(([v, l]) => h('option', { value: v, selected: String(obj[key] ?? opts[0][0]) === String(v) }, l))); s.onchange = () => { obj[key] = isNaN(+s.value) || s.value === '' ? s.value : +s.value; save(); after && after(); }; return s; };

  const draw = (t) => {
    body.innerHTML = '';
    body.append(h('div', { class: 'set-tabs' }, ...TABS.map(([k, l]) => h('button', { class: `rbtn ${k === t ? 'active' : ''}`, onclick: () => draw(k) }, l))));
    const pane = h('div', { class: 'set-pane' });
    body.append(pane);
    if (t === 'audio') pane.append(
      row('Master volume', range('masterVol', 0, 1.5, 0.05, (v) => `${Math.round(v * 100)}%`, applySettings), 'Overall loudness of the radio.'),
      row('Band noise', range('noiseLvl', 0, 1.5, 0.05, (v) => `${Math.round(v * 100)}%`), '100% = realistic. Lower it if the hiss is tiring — signals will sound cleaner than real life.'),
      row('Static crashes (QRN)', check('qrn'), 'Lightning crashes on the low bands (worse during real nearby storms).'),
      row('CW sidetone volume', range('sideVol', 0, 0.6, 0.02, (v) => `${Math.round(v / 0.6 * 100)}%`)),
      row('CW sidetone pitch', range('pitch', 300, 1000, 10, (v) => `${v} Hz`, reapplyMode, S.radio), 'Also your CW receive pitch (zero-beat).'),
      row('Synthesized voice speed', range('ttsRate', 0.7, 1.5, 0.05, (v) => `${v.toFixed(2)}×`)),
      row('Speak simulated stations aloud', check('tts'), 'Off = subtitles only (quieter for public places).'),
      row('Subtitles', check('subtitles'), 'Show what you hear as text in the transcript.'));
    if (t === 'display') pane.append(
      row('Text & control size', range('uiScale', 0.8, 1.4, 0.05, (v) => `${Math.round(v * 100)}%`, applySettings), 'Make everything bigger on a tablet or TV.'),
      row('Touch controls', select('touch', [['auto', 'Auto (bigger on touch screens)'], ['big', 'Always big'], ['normal', 'Normal']], applySettings)),
      row('Open the app in', select('startView', [['auto', 'Auto: handheld on phones, station elsewhere'], ['ht', 'Handheld radio'], ['station', 'Full station']]), 'iPad/tablet: "Full station" gives you the whole shack with touch-sized controls.'),
      row('Handheld PTT on the left', chk0('leftHand', applySettings), 'For left-handed operators.'),
      row('Reduce motion', chk0('reduceMotion', applySettings), 'Fewer animations.'),
      row('Faceplate', select('face', [['auto', 'Match radio model'], ['graphite', 'Graphite'], ['black', 'Black'], ['silver', 'Silver'], ['retro', 'Retro wood & cream']], applyLook)),
      row('Display colour', select('lcd', [['auto', 'Match radio model'], ['green', 'Green'], ['amber', 'Amber'], ['blue', 'Ice blue'], ['white', 'Paper white']], applyLook)),
      row('Radio page panels', h('button', { class: 'btn small', onclick: () => { close(); openStation('look'); } }, 'Choose panels…')));
    if (t === 'play') {
      pane.append(
        row('Mode', h('div', { class: 'seg' }, ...Object.entries(MODES).map(([m, x]) => h('button', { class: S.mode === m ? 'active' : '', onclick: () => { bus.emit('set-mode', m); draw('play'); } }, x.label))), 'Your log, license and course progress are kept when you switch.'),
        row('Auto-setup in Simulation', check('autoSetup', () => bus.emit('set-mode', S.mode)), 'Wires the station and matches the antenna for you. Turn off to do it all by hand.'),
        row('Restart the training course', h('button', { class: 'btn small', onclick: () => { S.training = { step: 0, done: {}, answers: {}, marks: {}, min: false }; save(); bus.emit('training-goto', 0); toast('Training course restarted.', 'info', 2500); } }, 'Restart'), 'Clears course progress only.'),
        row('Contextual notes', check('notes'), 'Short explanations of exam topics as situations come up (Training).'),
        row('Explain mode', chk0('explain', () => bus.emit('explain')), 'Hover or long-press any control to learn what it does.'),
        row('Lab readouts on the scope', chk0('lab'), 'Signal and noise dBm, SNR, path mode, distance.'),
        row('Simulated operator patience', select('patience', [[1, 'Realistic'], [1.6, 'Patient (more repeats)'], [0.7, 'Contest-fast']]), 'How long simulated stations wait and how often they repeat for you.'),
        row('Sandbox license', h('div', { class: 'row' }, ...['T', 'G', 'E'].map((l) => h('button', { class: 'btn small', onclick: () => sandboxLicense(l) }, `Grant ${licName(l)}`))), 'Skip the exams (for jumping straight into contests).'));
    }
    if (t === 'op') pane.append(
      row('Push-to-talk key', select('pttKey', [[' ', 'Space'], ['Control', 'Ctrl'], ['`', '` (backtick)'], ['Insert', 'Insert']]), 'Hold to transmit on voice modes.'),
      row('My CW speed', range('myWpm', 10, 40, 1, (v) => `${v} wpm`), 'Simulated stations reply at about your speed.'),
      row('ESM (Enter Sends Message)', check('esm'), 'Contest-logger style: Enter does the next logical thing.'),
      row('CW decoder', check('decoder'), 'Show decoded Morse text (a crutch — try copying by ear!).'),
      row('Go on the air automatically', chk0('autoOnline'), 'Rejoin the shared band with real players at start-up.'),
      row('Default tuning step', select('step', [[10, '10 Hz'], [50, '50 Hz'], [100, '100 Hz'], [500, '500 Hz'], [1000, '1 kHz']], null, S.radio)));
    if (t === 'time') {
      const live = h('input', { type: 'checkbox', checked: ST().hour == null });
      const hour = h('input', { type: 'range', min: 0, max: 23.5, step: 0.5, value: ST().hour ?? new Date().getUTCHours() });
      const lbl = h('span', { class: 'val' }, ST().hour == null ? 'real time' : `${ST().hour}:00 UTC`);
      const apply = () => { ST().hour = live.checked ? null : +hour.value; lbl.textContent = ST().hour == null ? 'real time' : `${Math.floor(hour.value)}:${hour.value % 1 ? '30' : '00'} UTC`; save(); world.repopulate(); bus.emit('solar'); };
      hour.oninput = () => { live.checked = false; apply(); }; live.onchange = apply;
      pane.append(
        row('Real UTC time', live, 'Propagation follows the real sun: low bands open at night, high bands by day.'),
        row('Live ionosphere data', check('liveIono', () => bus.emit('iono-toggle')), 'Use the measured ionosphere from NOAA (GloTEC foF2/MUF every 10 minutes, D-RAP flare absorption). Off = modelled from the solar flux only. Applies at real time, not during time warp.'),
        row('Time warp', h('span', { class: 'row' }, hour, lbl), 'Practice night-time 80 m or a daytime 10 m opening.'),
        row('Space weather', h('div', { class: 'row wrap' },
          h('button', { class: 'btn small', onclick: () => { if (net.online) return toast('Online, everyone shares the real space weather — go offline to experiment.', 'warn'); SUN.randomize(); world.repopulate(); bus.emit('solar'); toast(`Practice space weather: SFI ${SUN.sfi}, K ${SUN.k}`, 'info'); } }, 'Random (practice)'),
          h('button', { class: 'btn small', onclick: () => { SUN.override = false; SUN.key = null; SUN.shared(); world.repopulate(); bus.emit('solar'); } }, '↺ Live / shared')), 'Live data comes from NOAA SWPC.'));
    }
    if (t === 'loc') {
      const qth = h('select', {}, ...STATES.map((s) => h('option', { value: s.abbr, selected: s.abbr === S.op.state }, s.name)));
      qth.onchange = () => { S.op.state = qth.value; save(); bus.emit('qth'); world.repopulate(); };
      pane.append(
        row('Your QTH (state)', qth, 'Sets your callsign district, nearby broadcast stations, airports, weather and propagation.'),
        row('Precise location', S.op.lat != null ? h('div', { class: 'row' }, h('span', { class: 'small' }, `${S.op.lat.toFixed(2)}, ${S.op.lon.toFixed(2)}`), h('button', { class: 'btn small', onclick: () => { delete S.op.lat; delete S.op.lon; S.site = null; save(); bus.emit('qth'); draw('loc'); } }, 'Forget it'))
          : h('button', { class: 'btn small', onclick: () => navigator.geolocation?.getCurrentPosition((p) => { S.op.lat = +p.coords.latitude.toFixed(4); S.op.lon = +p.coords.longitude.toFixed(4); save(); bus.emit('qth'); draw('loc'); toast('Using your real location.', 'good'); }, (e) => toast(`Location: ${e.message}`, 'warn')) }, 'Use my real location'),
        'Used for terrain, nearby stations and propagation. It stays in this browser and is never sent to other players (they only see your state).'),
        row('Real-world data', h('div', { class: 'tiny muted' }, 'NOAA SWPC (space weather), NWS / Open-Meteo (weather & elevation), Radio Browser (broadcast streams), OurAirports (airports), USGS (elevation). Only your approximate location is sent to these, never your name or callsign.')));
    }
    if (t === 'data') {
      const file = h('input', { type: 'file', accept: '.json,application/json', hidden: true });
      file.onchange = async () => { try { const d = JSON.parse(await file.files[0].text()); if (!d || typeof d !== 'object' || !d.radio) throw new Error('not a save file'); localStorage.setItem('hamshack-sim-v1', JSON.stringify(d)); location.reload(); } catch (e) { toast(`Import failed: ${e.message}`, 'bad'); } };
      pane.append(
        row('App version', h('div', { class: 'row' }, h('span', { class: 'small mono', id: 'app-ver' }, '…'), h('button', { class: 'btn small', onclick: () => bus.emit('check-version') }, 'Check for update'), h('button', { class: 'btn small', onclick: () => location.reload() }, 'Reload')), 'The app updates itself when it\'s online. If something looks out of date, press Reload.'),
        row('Export my save', h('button', { class: 'btn small', onclick: () => download(`hamshack-${S.call || 'save'}-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(S, null, 1), 'application/json') }, 'Download'), 'Back up your license, log, gear and settings — or move them to another device.'),
        row('Import a save', h('span', {}, file, h('button', { class: 'btn small', onclick: () => file.click() }, 'Load file…')), 'Replaces the current progress.'),
        row('Reset everything', h('button', { class: 'btn warn small', onclick: () => { if (confirm('Erase ALL progress (license, log, station)?')) resetAll(); } }, 'Reset'), 'Cannot be undone.'));
    }
  };
  draw(tab);
  const showVer = () => { const el = document.getElementById('app-ver'); if (!el) return; fetch('js/main.js', { method: 'HEAD', cache: 'no-store' }).then((r) => { const lm = r.headers.get('last-modified'); el.textContent = lm ? `updated ${new Date(lm).toLocaleString()}` : 'current'; }).catch(() => { el.textContent = 'offline copy'; }); };
  body.addEventListener('click', () => setTimeout(showVer, 50)); setTimeout(showVer, 50);
  close = modal(h('div', {}, h('h2', {}, 'Settings'), body), { wide: true });
}
