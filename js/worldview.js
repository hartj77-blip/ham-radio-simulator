// Catalog of everything your radio could hear, by kind of service. Drawn by the area map (areamap.js).
import { S } from './state.js';
import { bus, hashStr } from './util.js';
import { world, player, BEACON_SITES } from './world.js';
import { RW, TIME_STATIONS, WX_CHANNELS, HEAR } from './realworld.js';
import { distanceKm } from './propagation.js';
import { stateBy } from './data/world.js';
import { net } from './net.js';
import { rigRx } from './rigs.js';
import { bandOf } from './data/bandplan.js';
import { channels, channelPos } from './activity.js';

// Kinds of radio service, with what they're used for.
export const KINDS = {
  hamhf: { label: 'Amateur HF', icon: '', col: '#ffb347', range: 'world', use: 'Hobby, DX, contests and emergency nets. 1.8–54 MHz, SSB/CW/digital. Long distance via the ionosphere.' },
  hamvhf: { label: 'Amateur VHF & repeaters', icon: '', col: '#5ee08a', range: 'local', use: 'Local ragchews, nets, ARES/RACES emergency comms. 2 m FM through repeaters (offset + CTCSS tone).' },
  beacon: { label: 'Propagation beacons', icon: '', col: '#c792ea', range: 'world', use: 'NCDXF/IARU beacons rotate through 5 bands every 3 minutes — hear one and you know the band is open to that region.' },
  time: { label: 'Time & frequency', icon: '', col: '#e8e8e8', range: 'world', use: 'NIST WWV/WWVH: atomic-clock time, frequency standard, and space-weather bulletins at :18 / :45.' },
  land: { label: 'Land mobile', icon: '', col: '#ff9e5e', range: 'local', use: 'Radio as a working tool: fire dispatch with two-tone paging, railroads, highway crews, job sites and stores. Narrow FM on VHF and UHF; much of it is moving to digital (P25, DMR).' },
  marine: { label: 'Marine VHF', icon: '', col: '#4dd0e1', range: 'local', use: 'Ships, boats, bridges and the Coast Guard, 156–162 MHz FM. Channel 16 is distress and calling; you hail there and move to a working channel.' },
  pers: { label: 'Personal radio', icon: '', col: '#aed581', range: 'local', use: 'CB (27 MHz AM), FRS and GMRS (462/467 MHz FM) and MURS (151/154 MHz): short-range radio for the public, licence-free or lightly licensed.' },
  util: { label: 'HF aeronautical', icon: '', col: '#b39ddb', range: 'world', use: 'Oceanic flights are out of VHF range, so they report positions by single sideband on HF. VOLMET reads airport weather on a schedule.' },
  air: { label: 'Aviation', icon: '', col: '#ff7a6b', range: 'local', use: 'Tower, ground, approach and ATIS (recorded weather). AM, 108–137 MHz. 121.5 MHz is the emergency (guard) frequency.' },
  wx: { label: 'Weather & alerts', icon: '', col: '#ffd54f', range: 'local', use: 'NOAA Weather Radio: continuous forecasts and the 1050 Hz alert tone for warnings. 162.400–162.550 MHz.' },
  ems: { label: 'Public safety', icon: '', col: '#ef5350', range: 'local', use: 'HEAR ambulance-to-hospital channel (155.340). Most police and fire radio is now digital or encrypted.' },
  bc: { label: 'Broadcast (AM/FM)', icon: '', col: '#4fc3f7', range: 'local', use: 'The few strongest local stations. AM 530–1700 kHz: groundwave by day, skywave at night. FM 88–108 MHz: wide FM, line-of-sight.' },
  players: { label: 'Real players', icon: '', col: '#ffffff', range: 'world', use: 'Other people playing right now. Same band + open path = you can talk.' },
};
const off = (p, km, seed) => { const a = (seed % 360) * Math.PI / 180; return { lat: p.lat + Math.cos(a) * km / 111, lon: p.lon + Math.sin(a) * km / (111 * Math.cos(p.lat * Math.PI / 180)) }; };

// Everything on the air, as {kind, name, f, mode, lat, lon, note}
export function catalog() {
  const me = player(), out = [];
  const add = (kind, o) => out.push({ kind, ...o, km: distanceKm(me, o) });
  for (const st of world.stations) {
    if (!st.op?.lat || st.role === 'caller' || st.role === 'peer') continue;
    const b = bandOf(st.freq);
    const kind = st.role === 'beacon' ? 'beacon' : !b ? null : b.name === '2m' ? 'hamvhf' : 'hamhf';
    if (!kind || (kind === 'hamvhf' && st.role === 'repeater')) continue;
    add(kind, { name: st.op.call, f: st.freq, mode: st.mode === 'SSB' ? st.sb : st.mode, lat: st.op.lat, lon: st.op.lon, note: `${st.op.qth || st.op.country || ''}${st.role === 'cq' ? ' · calling CQ' : ''}` });
  }
  if (!out.some((x) => x.kind === 'beacon')) for (const b of BEACON_SITES) add('beacon', { name: b.call, f: 14.1e6, mode: 'CW', lat: b.lat, lon: b.lon, note: '14.100 / 18.110 / 21.150 / 24.930 / 28.200 MHz' });
  const rp = off(me, 18, hashStr(S.op.state || 'KS'));
  add('hamvhf', { name: `${S.local?.rpt || 'Local'} repeater`, f: 146.94e6, mode: 'FM', lat: rp.lat, lon: rp.lon, note: '−600 kHz, 100.0 Hz tone', rpt: true });
  add('hamvhf', { name: '2 m simplex calling', f: 146.52e6, mode: 'FM', ...off(me, 4, 77), note: 'national calling frequency' });
  for (const t of TIME_STATIONS) add('time', { name: `${t.call} ${t.f / 1e6} MHz`, f: t.f, mode: 'AM', lat: t.lat, lon: t.lon, note: `${t.kw} kW` });
  for (const b of RW.broadcast || []) add('bc', { name: b.name, f: b.f, mode: b.mode === 'WFM' ? 'WFM' : 'AM', lat: b.lat, lon: b.lon, note: b.state || '' });
  for (const a of RW.airports || []) for (const fr of a.freqs.filter((x) => /ATIS|TWR|GND|APP|DEP|CTAF|UNIC|AWOS|ASOS/i.test(x.type)).slice(0, 4)) add('air', { name: `${a.ident} ${fr.type}`, f: Math.round(fr.mhz * 1e6), mode: 'AM', lat: a.lat, lon: a.lon, note: a.name });
  add('air', { name: 'Guard (emergency)', f: 121.5e6, mode: 'AM', ...me, note: 'monitored by all aircraft' });
  const wxp = off(me, 35, hashStr(RW.nws?.office || 'NWS'));
  add('wx', { name: `NOAA Weather Radio${RW.nws?.office ? ` (${RW.nws.office})` : ''}`, f: WX_CHANNELS[hashStr(RW.nws?.office || 'NWS') % 7], mode: 'FM', ...wxp, note: RW.nws?.alerts?.length ? `${RW.nws.alerts[0].event}` : 'forecast & alerts' });
  for (const c of channels()) add(c.kind, { name: c.name, f: c.f, mode: c.mode === 'SSB' ? c.sb : c.mode, ...channelPos(c, me), note: c.info });
  add('ems', { name: 'HEAR hospital channel', f: HEAR, mode: 'FM', ...off(me, 8, 200), note: 'ambulance ↔ hospital' });
  for (const e of net.roster || []) { const st = stateBy(e.state); if (st) add('players', { name: e.call, f: e.freq, mode: e.mode, lat: st.lat, lon: st.lon, note: `${st.name}${e.tx ? ' · talking' : ''}`, roster: e }); }
  return out;
}

// Tune the radio to a catalog item (or join a player).
export function tuneItem(it) {
  if (it.roster) return bus.emit('net-join', it.roster);
  if (!rigRx(it.f)) { bus.emit('tune-to', it.f, it.mode); return; }
  if (it.rpt) { S.radio.rptOffset = -600000; S.radio.toneHz = 100; }
  bus.emit('tune-to', it.f, it.mode === 'SSB' ? undefined : it.mode);
}
