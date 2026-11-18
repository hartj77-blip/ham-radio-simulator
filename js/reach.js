// Range & reception estimate for the antenna you have designed, at your location, right now.
//  • How far your transmitted signal should reach on each amateur band (voice and CW)
//  • What you can expect to hear: ham stations by region and band, and the non-ham services
// Uses the same propagation model, antenna gain and noise figures as the receiver, so the numbers
// agree with what the radio does. They are estimates: terrain and buildings are not modelled.
import { S } from './state.js';
import { h, bus } from './util.js';
import { BANDS } from './data/bandplan.js';
import { path as propPath, bearing, distanceKm, bandNoiseDbm, sUnits, SUN } from './propagation.js';
import { system, patternGain } from './antenna.js';
import { antennaAglFt, siteEffects } from './yard.js';
import { qth } from './planner.js';
import { rig, rigRx, rigCanTx, rigMaxW, isHT } from './rigs.js';
import { maxPower } from './limits.js';
import { TIME_STATIONS } from './realworld.js';

const DIST = [5, 10, 20, 40, 80, 150, 300, 500, 800, 1200, 1800, 2500, 3500, 5000, 7000, 10000, 14000];
const BRGS = [0, 45, 90, 135, 180, 225, 270, 315];
const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
const num = (n) => Math.round(n).toLocaleString('en-US');
const round = (km) => (km >= 1000 ? Math.round(km / 100) * 100 : km >= 100 ? Math.round(km / 10) * 10 : Math.round(km));
const dist = (km) => `${num(round(km))} km (${num(round(km * 0.621))} mi)`;
const span = (a, b) => `${num(round(a))}–${num(round(b))} km (${num(round(a * 0.621))}–${num(round(b * 0.621))} mi)`;

function dest(p, brg, km) {
  const R = 6371, d = km / R, th = brg * Math.PI / 180, la = p.lat * Math.PI / 180, lo = p.lon * Math.PI / 180;
  const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(th));
  const lo2 = lo + Math.atan2(Math.sin(th) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2));
  return { lat: la2 * 180 / Math.PI, lon: ((lo2 * 180 / Math.PI + 540) % 360) - 180 };
}

// Line of sight with antenna heights in metres (same model as the receiver uses on VHF/UHF).
const horizonKm = (h1, h2) => 4.12 * (Math.sqrt(h1) + Math.sqrt(h2));
function losLoss(km, fMHz, h1, h2) {
  const beyond = Math.max(0, km - horizonKm(h1, h2));
  return 32.45 + 20 * Math.log10(Math.max(0.5, km)) + 20 * Math.log10(fMHz) + 6 + beyond * (0.22 + 0.0012 * fMHz) + (beyond > 0 ? 8 : 0);
}

const ant = () => ({ ...S.antenna, built: true }); // estimate for the design even before it is raised
const myHeightM = () => (isHT() ? 1.5 : Math.max(2, antennaAglFt() * 0.3048));
const txWatts = (hz) => Math.max(0.5, Math.min(S.radio.power || 100, maxPower(), rigMaxW(hz)));

// Antenna-system gain on an amateur band (null when the antenna cannot be modelled there).
function bandGain(hz) {
  const a = ant(), sys = system(hz, a);
  if (!sys) return null;
  return { swr: sys.swrRig, at: (brg, km, mode) => patternGain(hz, brg, km, a, mode) + sys.effDb - sys.totalLoss };
}
// Off the amateur bands the antenna is not resonant: same allowances as the receiver.
const offBandGain = (hz) => (hz < 1.7e6 ? -14 : hz < 30e6 ? -8 : -4);

// ------------------------------------------------------------------ transmit reach
function hfReach(b, g, me) {
  const f = b.def / 1e6, site = siteEffects(f);
  const dbm = 10 * Math.log10(txWatts(b.def) * 1000) - site.lossDb;
  const rows = DIST.map((km) => {
    const snr = BRGS.map((brg) => { const far = dest(me, brg, km); return dbm + g.at(brg, km, 'SSB') + 2 - propPath(me, far, f).loss - bandNoiseDbm(f, far); });
    const best = snr.indexOf(Math.max(...snr));
    return { km, snr: [...snr].sort((x, y) => y - x)[2], best }; // third-best bearing: reachable in several directions
  });
  const zones = (thr) => {
    const out = [];
    rows.forEach((r, i) => { if (r.snr < thr) return; const last = out[out.length - 1]; if (last && last.j === i - 1) last.j = i; else out.push({ i, j: i }); });
    return out.map((z) => ({ lo: z.i ? DIST[z.i] : 0, hi: DIST[z.j], best: rows[z.j].best }));
  };
  return { voice: zones(10), cw: zones(-4) }; // SSB needs ~10 dB in 2.4 kHz; CW in 500 Hz copies ~14 dB lower
}
function zoneText(z) {
  if (!z.length) return null;
  return z.map((x) => (x.lo ? span(x.lo, x.hi) : `up to ${dist(x.hi)}`)).join(', then ');
}

function vhfReach(b, g) {
  const f = b.def / 1e6, fm = b.defMode === 'FM', site = siteEffects(f), h1 = myHeightM();
  const dbm = 10 * Math.log10(txWatts(b.def) * 1000) - site.lossDb;
  const gain = Math.max(...BRGS.map((brg) => g.at(brg, 30, fm ? 'FM' : 'SSB')));
  const thr = bandNoiseDbm(f) + (fm ? 19 : 10); // FM needs a stronger signal than SSB
  const to = (h2, theirGain) => { let km = 0; for (let d = 1; d <= 500; d += d < 50 ? 1 : 5) { if (dbm + gain + theirGain - losLoss(d, f, h1, h2) >= thr) km = d; else break; } return km; };
  return { h1, fm, list: fm ? [['a handheld', to(1.5, -3)], ['a car', to(2, 2)], ['a home station', to(10, 4)], ['a hilltop repeater', to(60, 7)]] : [['a car', to(2, 0)], ['a home station', to(10, 3)], ['a hilltop station', to(60, 6)]] };
}

// ------------------------------------------------------------------ receive
const PLACES = [['US East Coast', 40.7, -74], ['US Midwest', 41.9, -87.6], ['US West Coast', 34.1, -118.2], ['Caribbean', 18.4, -66.1], ['Europe', 50, 10],
  ['South America', -23.5, -46.6], ['Africa', -26, 28], ['Japan', 36, 139], ['Australia', -34, 151]];

function hamGrid(me, gains) {
  const rows = [['Within 150 km', dest(me, 90, 150)], ['About 800 km away', dest(me, 90, 800)], ...PLACES.map(([n, lat, lon]) => [n, { lat, lon }])]
    .filter(([, p], i) => i < 2 || distanceKm(me, p) > 400);
  return rows.map(([name, p]) => {
    const km = distanceKm(me, p), brg = bearing(me, p);
    return { name, km, cells: BANDS.map((b) => {
      const g = gains[b.name]; if (!g || !rigRx(b.def)) return null;
      const f = b.def / 1e6, site = siteEffects(f), fm = b.defMode === 'FM';
      const loss = f >= 100 ? losLoss(km, f, myHeightM(), 10) : propPath(p, me, f).loss;
      const dbm = 50 + 3 + g.at(brg, km, fm ? 'FM' : 'SSB') - loss - site.lossDb; // a typical 100 W station with a dipole
      const over = dbm - (bandNoiseDbm(f, me) + site.noiseDb);
      return { over, s: sUnits(dbm).text.replace('+0', '') };
    }) };
  });
}

// Typical non-amateur signals: [name, Hz, mode, transmitter dBm EIRP, distance km, transmitter height m (0 = HF/MW path), note]
function services(me) {
  const wwv = TIME_STATIONS.map((t) => ({ t, km: distanceKm(me, t) }));
  const eu = { lat: 50, lon: 10 }, us = { lat: 36.2, lon: -86.9 };
  const best = (list) => list.map((x) => ({ ...x, lv: level(x, me) })).sort((a, b) => b.lv.over - a.lv.over)[0];
  return [
    { name: 'Local AM broadcast', f: 1000e3, mode: 'AM', eirp: 70, km: 40, note: '10 kW station about 40 km away, by ground wave' },
    { name: 'Distant AM broadcast', f: 1000e3, mode: 'AM', eirp: 77, km: 1200, far: dest(me, 80, 1200), note: '50 kW clear-channel station about 1,200 km away; skywave, so after dark only' },
    best(wwv.map(({ t, km }) => ({ name: `Time signals (${t.call} ${t.f / 1e6} MHz)`, f: t.f, mode: 'AM', eirp: 10 * Math.log10(t.kw * 1e6) + 2, km, far: t, note: `${t.call === 'WWV' ? 'Fort Collins, Colorado' : 'Kauai, Hawaii'}, ${num(round(km))} km away; best of the time-signal frequencies right now` }))),
    best([[5.95e6, us, 'North American'], [9.6e6, us, 'North American'], [9.6e6, eu, 'European'], [11.8e6, eu, 'European'], [15.3e6, eu, 'European']].map(([f, far, who]) => ({ name: `Shortwave broadcast (${(f / 1e6).toFixed(1)} MHz)`, f, mode: 'AM', eirp: 84, km: distanceKm(me, far), far, note: `${who} 250 kW broadcaster; strongest shortwave broadcast band right now` }))),
    { name: 'CB radio (27 MHz)', f: 27.185e6, mode: 'AM', eirp: 36, km: 8, ht: 2, note: '4 W mobile about 8 km away; distant "skip" appears when 10 m is open' },
    { name: 'FM broadcast', f: 98.1e6, mode: 'WFM', eirp: 77, km: 50, ht: 250, note: '50 kW station on a tall tower about 50 km away' },
    { name: 'Aircraft in flight', f: 124e6, mode: 'AM', eirp: 44, km: 200, ht: 10000, note: 'Airliner at cruising altitude 200 km away; height gives aircraft a very long line of sight' },
    { name: 'Airport tower / ATIS', f: 121.5e6, mode: 'AM', eirp: 44, km: 30, ht: 12, note: 'Ground station about 30 km away' },
    { name: '2 m amateur repeater', f: 146.94e6, mode: 'FM', eirp: 59, km: 30, ht: 60, ham: '2m', note: 'Hilltop repeater about 30 km away' },
    { name: 'Police, fire, rail, marine VHF', f: 155.34e6, mode: 'FM', eirp: 56, km: 25, ht: 60, note: 'Dispatch repeater about 25 km away (many agencies are now digital or encrypted)' },
    { name: 'NOAA Weather Radio', f: 162.55e6, mode: 'FM', eirp: 60, km: 50, ht: 100, note: '1 kW transmitter about 50 km away' },
    { name: '70 cm amateur / GMRS repeater', f: 446e6, mode: 'FM', eirp: 53, km: 15, ht: 60, note: 'Repeater about 15 km away' },
  ];
}
function level(x, me, gains) {
  const f = x.f / 1e6, site = siteEffects(f);
  if (!rigRx(x.f) || !rig().modes.includes(x.mode)) return { over: -Infinity, none: true };
  const far = x.far || dest(me, 90, x.km);
  const loss = x.ht ? losLoss(x.km, f, x.ht, myHeightM()) : propPath(far, me, f).loss;
  const g = x.ham && gains?.[x.ham] ? gains[x.ham].at(bearing(me, far), x.km, 'FM') : offBandGain(x.f);
  const dbm = x.eirp + g - loss - site.lossDb;
  const bw = x.mode === 'WFM' ? 18 : x.mode === 'FM' ? 7 : 4; // wider receiver filter lets in more noise
  return { over: dbm - (bandNoiseDbm(f, me) + site.noiseDb + bw), s: sUnits(dbm).text.replace('+0', ''), limit: x.ht ? horizonKm(x.ht, myHeightM()) : null };
}
const verdict = (lv) => (lv.none ? ['Radio does not tune this', 'muted'] : lv.over >= 25 ? ['Strong', 'ok'] : lv.over >= 10 ? ['Clear', 'ok'] : lv.over >= 3 ? ['Weak but readable', 'warn'] : ['Unlikely', 'muted']);

// ------------------------------------------------------------------ UI
let root, timer;
export function mountReach(el) {
  root = el; render();
  if (mountReach.wired) return; mountReach.wired = true;
  for (const ev of ['antenna', 'rig', 'shack', 'realworld', 'mode']) bus.on(ev, refreshReach);
}
export function refreshReach() { clearTimeout(timer); timer = setTimeout(render, 250); }

function render() {
  if (!root || !root.isConnected) return;
  const me = qth(), a = S.antenna, r = rig();
  const gains = Object.fromEntries(BANDS.map((b) => [b.name, bandGain(b.def)]));
  const match = (b) => { const g = gains[b.name]; if (!g) return ['n/a', 'muted']; const s = g.swr; return [(s > 50 ? 'SWR ∞' : `SWR ${s.toFixed(1)}`) + (s > 3 ? ' · tuner needed' : ''), s <= 2 ? 'ok' : s <= 3 ? 'warn' : 'bad']; };

  const txRows = BANDS.map((b) => {
    const [mt, mc] = match(b), g = gains[b.name];
    const lead = [h('td', {}, h('b', {}, b.name)), h('td', { class: mc }, mt)];
    if (!r.tx.length || !rigCanTx(b.name)) return h('tr', { class: 'none' }, ...lead, h('td', { colspan: 2 }, r.tx.length ? `The ${r.name} does not transmit on ${b.name}.` : 'This radio is receive-only.'));
    if (!g) return h('tr', { class: 'none' }, ...lead, h('td', { colspan: 2 }, 'This antenna cannot be modelled on this band.'));
    const tail = '';
    if (b.def >= 50e6) {
      const v = vhfReach(b, g);
      const es = b.name === '6m' ? (SUN.es ? ' Sporadic-E is active now: 700–2,300 km openings are possible.' : ' Occasional sporadic-E openings reach 700–2,300 km, mostly in early summer.') : '';
      return h('tr', {}, ...lead, h('td', { colspan: 2 }, `${v.fm ? 'FM' : 'SSB'} line of sight: ${v.list.map(([n, km]) => `${n} ${km < 1 ? 'under 1 km' : dist(km)}`).join(' · ')}.${es}${tail}`));
    }
    const z = hfReach(b, g, me), vt = zoneText(z.voice), ct = zoneText(z.cw);
    const far = z.voice.length ? z.voice[z.voice.length - 1] : z.cw[z.cw.length - 1];
    const skip = (zs) => (zs.length > 1 ? ' (skip zone between)' : '');
    return h('tr', {}, ...lead,
      h('td', {}, b.ph ? (vt ? vt + skip(z.voice) : 'No reliable voice range right now') : 'No voice on this band'),
      h('td', {}, (ct ? ct + skip(z.cw) : 'Band closed right now') + (far && a.type !== 'vertical' ? `. Best toward the ${COMPASS[far.best]}.` : '') + tail));
  });

  const grid = hamGrid(me, gains);
  const cell = (c) => (!c ? h('td', { class: 'muted' }, '·') : c.over >= 20 ? h('td', { class: 'ok' }, h('b', {}, c.s)) : c.over >= 8 ? h('td', { class: 'ok' }, c.s) : c.over >= -4 ? h('td', { class: 'warn', title: 'Too weak for voice; CW or FT8 only' }, 'CW') : h('td', { class: 'muted' }, '–'));
  const svc = services(me).map((x) => ({ x, lv: x.lv || level(x, me, gains) }));

  const pw = r.tx.length ? `${Math.round(txWatts(14e6))} W` : 'receive only';
  root.innerHTML = '';
  root.append(h('div', { class: 'card reach' },
    h('h3', {}, 'Range and what you can hear from here'),
    h('p', { class: 'small' }, `Estimated for your ${a.type === 'yagi' ? 'Yagi' : a.type === 'vertical' ? 'vertical' : 'wire antenna'} (${a.length.toFixed(1)} ft${a.type === 'vertical' ? '' : `, ${a.height} ft high`}, ${a.feedLen} ft of ${a.feed}) with the ${r.name} at ${pw}, from ${me.real ? 'your location' : `the middle of ${S.op.state}`}, in the conditions right now.${a.built ? '' : ' The antenna is not raised yet, so this is what the design would do.'}`),
    h('h4', {}, 'How far your signal should reach'),
    h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl small' }, h('tr', {}, h('th', {}, 'Band'), h('th', {}, 'Match'), h('th', {}, 'Voice (SSB)'), h('th', {}, 'CW and digital')), ...txRows)),
    h('p', { class: 'muted tiny' }, 'Range to a typical station with a simple antenna, reachable in at least three compass directions. HF bands change through the day: 160–40 m reach farthest at night, 20–10 m in daylight. A "skip zone" is the gap between where the ground wave fades and where the signal returns from the ionosphere. Where the match column says a tuner is needed, the radio cuts its power into that mismatch, so expect less than shown unless you tune or resize the antenna. Whether you may transmit on a band depends on your licence (License study page).'),
    h('h4', {}, 'Amateur stations you can expect to hear right now'),
    h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl small reach-grid' }, h('tr', {}, h('th', {}, 'From'), ...BANDS.map((b) => h('th', {}, b.name))),
      ...grid.map((g) => h('tr', {}, h('td', {}, g.name, g.name.startsWith('Within') || g.name.startsWith('About') ? '' : h('span', { class: 'muted tiny' }, ` ${num(round(g.km))} km`)), ...g.cells.map(cell))))),
    h('p', { class: 'muted tiny' }, 'Signal strength of a typical 100 W station on your S-meter. Bold = strong, CW = too weak for voice but workable on CW or FT8, – = not audible, · = antenna or radio does not cover the band. If you can hear a station this well, a similar station can usually hear you.'),
    h('h4', {}, 'Other signals you can pick up in your area'),
    h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl small' }, h('tr', {}, h('th', {}, 'Signal'), h('th', {}, 'With this antenna'), h('th', {}, 'Line-of-sight limit'), h('th', {}, 'Assumes')),
      ...svc.map(({ x, lv }) => { const [t, c] = verdict(lv); return h('tr', {}, h('td', {}, x.name), h('td', { class: c }, t, lv.s && lv.over >= 3 ? h('span', { class: 'muted' }, ` ${lv.s}`) : ''), h('td', {}, lv.limit ? dist(lv.limit) : lv.none ? '' : 'not line of sight'), h('td', { class: 'muted' }, x.note)); }))),
    h('p', { class: 'muted tiny' }, `Line-of-sight limit is the radio horizon for your antenna at ${Math.round(myHeightM() / 0.3048)} ft above ground: 4.12 × (√h₁ + √h₂) km with heights in metres. Raising the antenna extends it. All figures are estimates from the simulator's propagation model: hills, buildings and local noise are not included, and real results vary from hour to hour. The "What's on the air near you" list on the Radio page shows the actual stations and channels for your location.`)));
}
