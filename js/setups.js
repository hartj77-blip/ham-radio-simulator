// One-click station setups, radio model picker, game modes, saved antennas, appearance.
import { S, save, licName } from './state.js';
import { h, toast, bus, modal } from './util.js';
import { RIGS, rig } from './rigs.js';
import { ITEMS, owns, freePlay, maxPower } from './store.js';
import { bandByName } from './data/bandplan.js';
import { newLicenseeCall } from './data/world.js';
import { wireStation } from './shack.js';
import { ANT_TYPES } from './antenna.js';

const K = { dipole: 468, invv: 455, vertical: 234, efhw: 456, yagi: 445 };
const cutFor = (type, band) => { const b = bandByName(band); const f = (b.lo + b.hi) / 2e6; return Math.round((K[type] / f) * 100) / 100; };

export const SETUPS = [
  { id: 'home', icon: '🏡', name: 'Classic home HF station', rig: 'allmode', ant: { type: 'dipole', band: '40m', height: 35, feed: 'RG-8X', feedLen: 75, axis: 90 }, tune: ['40m', 'LSB'], needs: [],
    desc: '40 m dipole in the trees, 100 W, internal tuner. Also works 15 m (3rd harmonic) and, with the tuner, most bands.' },
  { id: 'apartment', icon: '🏢', name: 'Apartment / stealth', rig: 'allmode', ant: { type: 'efhw', band: '40m', height: 20, feed: 'RG-58', feedLen: 40, axis: 0 }, tune: ['20m', 'USB'], needs: ['unun'],
    desc: 'One thin end-fed wire out the window to a tree. Resonant on 40/20/15/10 m with no tuner.' },
  { id: 'vertical', icon: '📍', name: 'Backyard vertical (DX on a budget)', rig: 'allmode', ant: { type: 'vertical', band: '20m', radials: 16, feed: 'RG-213', feedLen: 50 }, tune: ['20m', 'USB'], needs: ['rg213'],
    desc: 'Ground-mounted ¼-wave vertical with 16 radials: low take-off angle for DX, small footprint.' },
  { id: 'pota', icon: '🏕', name: 'POTA / Field Day portable', rig: 'qrp', ant: { type: 'efhw', band: '20m', height: 25, feed: 'RG-58', feedLen: 25, axis: 0 }, tune: ['20m', 'CW'], power: 10, needs: ['rig-qrp', 'unun'],
    desc: '10 W QRP rig on battery with a 20 m end-fed on a fishing pole. CW recommended!' },
  { id: 'dx', icon: '🗼', name: 'DX tower station', rig: 'sdr100', ant: { type: 'yagi', band: '20m', height: 70, feed: 'LMR-400', feedLen: 120, heading: 45 }, tune: ['20m', 'USB'], power: 500, needs: ['rig-sdr100', 'yagi', 'rotator', 'mast50', 'tower70', 'lmr400', 'amp500'],
    desc: '3-element Yagi at 70 ft on a rotator, low-loss coax, 500 W amplifier. Point it and work the world.' },
  { id: 'contest', icon: '🏆', name: 'Contest super-station', rig: 'contest', ant: { type: 'yagi', band: '20m', height: 100, feed: 'LMR-400', feedLen: 150, heading: 45 }, tune: ['20m', 'CW'], power: 1500, needs: ['rig-contest', 'yagi', 'rotator', 'mast50', 'tower70', 'tower100', 'lmr400', 'amp500', 'amp1500'],
    desc: 'Top receiver, 100 ft tower, legal-limit amplifier. Built to run pileups.' },
  { id: 'vhf', icon: '🔁', name: 'VHF/UHF FM & repeaters', rig: 'allmode', ant: { type: 'vertical', band: '2m', radials: 4, feed: 'LMR-400', feedLen: 50 }, tune: ['2m', 'FM'], rpt: true, needs: ['lmr400'],
    desc: '2 m ground-plane on the roof. Set up for your local repeater (−600 kHz, 100 Hz tone).' },
  { id: 'ht', icon: '📟', name: 'Handheld (HT) only', rig: 'ht', ant: { type: 'vertical', band: '2m', radials: 0, feed: 'RG-58', feedLen: 3 }, tune: ['2m', 'FM'], rpt: true, power: 5, needs: ['rig-ht'],
    desc: 'A 5 W handheld with its rubber-duck antenna. Repeaters, simplex, weather and FM broadcast.' },
  { id: 'listener', icon: '🎧', name: 'Scanner & shortwave listener', rig: 'sdrrx', ant: { type: 'efhw', band: '40m', height: 30, feed: 'RG-8X', feedLen: 50, axis: 0 }, tune: [null, 'WFM', 98.1e6], needs: ['rig-sdrrx', 'unun'],
    desc: 'Wideband receive-only SDR and a long wire: broadcast, shortwave, WWV, airband, weather radio. No license needed.' },
];

const itemName = (id) => (ITEMS.find((i) => i.id === id) || { name: id }).name;

export function applySetup(id, { quiet } = {}) {
  const p = SETUPS.find((x) => x.id === id);
  if (!p) return false;
  const missing = p.needs.filter((n) => !owns(n));
  if (missing.length && !freePlay()) {
    const cost = missing.reduce((s, n) => s + (ITEMS.find((i) => i.id === n)?.price || 0), 0);
    toast(`🔒 <b>${p.name}</b> needs: ${missing.map(itemName).join(', ')} (₵${cost} at the Hamfest). Or switch to Free play in 🎛 Station.`, 'warn', 9000);
    return false;
  }
  S.rig = p.rig;
  wireStation();
  const a = S.antenna;
  Object.assign(a, { type: p.ant.type, length: cutFor(p.ant.type, p.ant.band), height: p.ant.height ?? a.height, feed: p.ant.feed, feedLen: p.ant.feedLen, radials: p.ant.radials ?? a.radials, axis: p.ant.axis ?? a.axis, heading: p.ant.heading ?? a.heading, built: true, spliced: 0 });
  const r = S.radio;
  r.atuOn = !!RIGS[p.rig].atu; r.atuTunedFreq = null; r.mtBypass = true;
  r.power = Math.min(p.power || 100, maxPower());
  if (p.rpt) { r.rptOffset = -600000; r.toneHz = 100.0; } else { r.rptOffset = 0; r.toneHz = 0; }
  S.setup = id;
  save();
  bus.emit('rig'); bus.emit('shack'); bus.emit('antenna'); bus.emit('antenna-rebuild');
  const [band, mode, f] = p.tune;
  bus.emit('tune-to', f || (p.rpt ? 146940000 : bandByName(band).def), mode);
  if (!quiet) toast(`${p.icon} <b>${p.name}</b> is set up: shack wired, ${ANT_TYPES[a.type].label.toLowerCase()} cut to ${a.length} ft and raised, radio on. Have a look around the Shack and Antenna tabs to see how it's built.`, 'good', 9000);
  return true;
}

// ------------------------------------------------------------------ game modes
export function setGameMode(m) {
  S.gameMode = m;
  if (m === 'free') {
    if (!S.license) S.license = 'E';
    for (const e of ['T', 'G', 'E']) S.exams[e] = S.exams[e] || e === 'T' || (S.license !== 'T' && e === 'G') || S.license === 'E';
    if (!S.call) S.call = newLicenseeCall(S.op.state, S.license);
  }
  save(); bus.emit('license'); bus.emit('money', 0); bus.emit('rig'); bus.emit('antenna-rebuild');
}

// ------------------------------------------------------------------ saved antennas (slots)
export function saveSlot(i) { (S.antSlots ||= [null, null, null])[i] = { ...S.antenna }; save(); toast(`Saved to ANT ${i + 1}.`, 'good', 2500); bus.emit('antslots'); }
export function loadSlot(i) {
  const sl = (S.antSlots || [])[i];
  if (!sl) return;
  const cur = (S.antSlots ||= [null, null, null]).findIndex((x) => x && JSON.stringify({ ...x, built: 0 }) === JSON.stringify({ ...S.antenna, built: 0 }));
  if (S.antenna.built && !owns('antswitch')) return toast('Lower the current antenna first — or buy the 3-way antenna switch to keep several up at once.', 'warn');
  if (cur >= 0) S.antSlots[cur] = { ...S.antenna };
  Object.assign(S.antenna, { ...sl, built: owns('antswitch') ? sl.built : false });
  S.radio.atuTunedFreq = null;
  S.antIdx = i;
  save(); bus.emit('antenna'); bus.emit('antenna-rebuild'); bus.emit('antslots');
}

// ------------------------------------------------------------------ appearance & panels
export function applyLook() {
  const b = document.body;
  const face = S.settings.face && S.settings.face !== 'auto' ? S.settings.face : rig().face;
  b.dataset.face = face;
  b.dataset.lcd = S.settings.lcd || 'green';
  const P = S.settings.panels || {};
  for (const [k, sel] of Object.entries({ players: '#net-panel', scanner: '#scanner-panel', logger: '#operating', map: '#map-panel', finder: '#finder' })) {
    const el = document.querySelector(sel);
    if (el) el.hidden = P[k] === false;
  }
}

// ------------------------------------------------------------------ the 🎛 Station menu
export function openStation(tab = 'setups') {
  let close;
  const body = h('div', { class: 'station-modal' });
  const tabs = [['setups', '⚡ Quick setups'], ['radio', '📻 Radio model'], ['mode', '🎮 Game mode'], ['ants', '📡 Saved antennas'], ['look', '🎨 Appearance & panels']];
  const draw = (t) => {
    body.innerHTML = '';
    body.append(h('div', { class: 'row st-tabs' }, ...tabs.map(([k, l]) => h('button', { class: `rbtn ${k === t ? 'active' : ''}`, onclick: () => draw(k) }, l))));
    if (t === 'setups') {
      body.append(h('p', { class: 'muted small' }, freePlay() ? 'Free play: every setup is available. Pick one and you\'re on the air.' : 'Career mode: setups use gear you own. Locked ones show what to buy at the Hamfest (or switch to Free play).'),
        h('div', { class: 'setup-grid' }, ...SETUPS.map((p) => {
          const missing = p.needs.filter((n) => !owns(n));
          return h('div', { class: `setup-card ${S.setup === p.id ? 'sel' : ''} ${missing.length && !freePlay() ? 'locked' : ''}` },
            h('div', { class: 'su-icon' }, p.icon), h('b', {}, p.name), h('p', { class: 'small' }, p.desc),
            h('div', { class: 'tiny muted' }, `${RIGS[p.rig].name} · ${ANT_TYPES[p.ant.type].label}`),
            missing.length && !freePlay() ? h('div', { class: 'tiny warn' }, '🔒 needs: ' + missing.map(itemName).join(', ')) : null,
            h('button', { class: 'btn primary small', onclick: () => { if (applySetup(p.id)) close(); } }, S.setup === p.id ? 'Re-apply' : 'Use this setup'));
        })));
    }
    if (t === 'radio') {
      body.append(h('div', { class: 'setup-grid' }, ...Object.entries(RIGS).map(([id, r]) => {
        const have = owns(`rig-${id}`);
        return h('div', { class: `setup-card ${S.rig === id || (!S.rig && id === 'allmode') ? 'sel' : ''} ${have ? '' : 'locked'}` },
          h('b', {}, r.name), h('div', { class: 'tiny muted' }, r.cls), h('p', { class: 'small' }, r.blurb),
          h('ul', { class: 'tiny spec' }, h('li', {}, `TX: ${r.tx.length ? `${r.maxW} W · ${r.tx.join(' ')}` : 'receive only'}`), h('li', {}, `RX: ${(r.rx[0] / 1e6).toFixed(1)}–${r.rx[1] / 1e6} MHz · ${r.modes.join('/')}`),
            h('li', {}, [r.atu ? 'ATU' : 'no ATU', r.scope ? 'scope' : 'no scope', r.dsp ? 'DSP NR' : '', r.narrowCw ? 'narrow CW' : '', r.quietRx ? 'ultra-quiet RX' : ''].filter(Boolean).join(' · '))),
          have ? h('button', { class: 'btn primary small', onclick: () => { S.rig = id; save(); bus.emit('rig'); toast(`📻 Now using the ${r.name}.`, 'good'); draw('radio'); } }, S.rig === id ? 'In use' : 'Use this radio') : h('span', { class: 'tiny warn' }, `🔒 ₵${r.price} at the Hamfest`));
      })));
    }
    if (t === 'mode') {
      const card = (m, icon, name, desc) => h('div', { class: `setup-card ${(S.gameMode || 'career') === m ? 'sel' : ''}` }, h('div', { class: 'su-icon' }, icon), h('b', {}, name), h('p', { class: 'small' }, desc),
        h('button', { class: 'btn primary small', onclick: () => { setGameMode(m); toast(`Game mode: ${name}`, 'good'); draw('mode'); } }, (S.gameMode || 'career') === m ? 'Current' : 'Switch'));
      const lic = h('select', {}, ...['T', 'G', 'E'].map((l) => h('option', { value: l, selected: S.license === l }, licName(l))));
      lic.onchange = () => { S.license = lic.value; save(); bus.emit('license'); };
      body.append(h('div', { class: 'setup-grid' },
        card('career', '🎓', 'Career', 'Start as a listener, wire your shack, build antennas, earn your license and credits, buy gear. All the training.'),
        card('free', '🧪', 'Free play / Lab', 'Everything unlocked: all radios, antennas, amplifiers and license privileges. For testing setups and just operating.'),
        card('listener', '🎧', 'Listener', 'No license: scan broadcast, shortwave, airband, weather and the ham bands. Every receiver unlocked.')),
        freePlay() && S.gameMode === 'free' ? h('label', {}, 'License class used in Free play: ', lic) : null,
        h('p', { class: 'muted small' }, 'Your log, awards, scores and training progress are kept when you switch.'));
    }
    if (t === 'ants') {
      S.antSlots ||= [null, null, null];
      body.append(h('p', { class: 'small muted' }, owns('antswitch') ? 'You own the antenna switch: saved antennas stay up and you can flip between them from the radio (ANT 1/2/3).' : 'Save antennas to slots and swap them later (lower the current one first). The 3-way antenna switch add-on lets you keep all three up.'),
        h('div', { class: 'setup-grid' }, ...S.antSlots.map((sl, i) => h('div', { class: `setup-card ${S.antIdx === i ? 'sel' : ''}` }, h('b', {}, `ANT ${i + 1}`),
          h('p', { class: 'small' }, sl ? `${ANT_TYPES[sl.type].label}, ${sl.length} ft${sl.type !== 'vertical' ? `, ${sl.height} ft up` : ''}, ${sl.feedLen} ft ${sl.feed}` : 'empty'),
          h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: () => { saveSlot(i); draw('ants'); } }, 'Save current here'), sl ? h('button', { class: 'btn primary small', onclick: () => { loadSlot(i); draw('ants'); } }, 'Switch to this') : null)))));
    }
    if (t === 'look') {
      const sel = (key, opts, label) => { const s = h('select', {}, ...opts.map(([v, l]) => h('option', { value: v, selected: (S.settings[key] || opts[0][0]) === v }, l))); s.onchange = () => { S.settings[key] = s.value; save(); applyLook(); }; return h('label', {}, label, ' ', s); };
      const chk = (k, l) => { S.settings.panels ||= {}; const c = h('input', { type: 'checkbox', checked: S.settings.panels[k] !== false }); c.onchange = () => { S.settings.panels[k] = c.checked; save(); applyLook(); }; return h('label', { class: 'inline' }, c, ' ', l); };
      const lab = h('input', { type: 'checkbox', checked: !!S.settings.lab }); lab.onchange = () => { S.settings.lab = lab.checked; save(); };
      const ex = h('input', { type: 'checkbox', checked: !!S.settings.explain }); ex.onchange = () => { S.settings.explain = ex.checked; save(); bus.emit('explain'); };
      body.append(
        sel('face', [['auto', 'Match radio model'], ['graphite', 'Graphite'], ['black', 'Black'], ['silver', 'Silver'], ['retro', 'Retro wood & cream']], 'Faceplate'),
        sel('lcd', [['green', 'Green'], ['amber', 'Amber'], ['blue', 'Ice blue'], ['white', 'Paper white']], 'Display colour'),
        h('h4', {}, 'Radio tab panels'),
        h('div', { class: 'row wrap' }, chk('finder', 'Find bar'), chk('players', 'Real players'), chk('scanner', 'What\'s on the air'), chk('logger', 'Logger'), chk('map', 'Propagation map')),
        h('h4', {}, 'Pro tools'),
        h('label', { class: 'inline' }, lab, ' Lab readouts on the band scope (signal / noise dBm, SNR, path, distance)'),
        h('br'), h('label', { class: 'inline' }, ex, ' Explain mode — hover any control to learn what it does'));
    }
  };
  draw(tab);
  close = modal(h('div', {}, h('h2', {}, '🎛 Station'), body), { wide: true });
}
