// The simulated ham bands: computer-generated operators who call CQ, ragchew, run contests,
// answer your CQ in pileups, plus NCDXF beacons and a local 2 m repeater.
import { rig } from './rigs.js';
import { S, save } from './state.js';
import { rand, randi, pick, chance, poisson, weighted, lev, bus, now, clamp, seeded } from './util.js';
import { BANDS, bandOf } from './data/bandplan.js';
import { randomOp, isCallsign, phonetic, digitsSpoken, stateBy, STATE_NAME_TO_ABBR, usCall } from './data/world.js';
import { path as propPath, bearing, distanceKm, bandNoiseDbm, simDate } from './propagation.js';
import { schedule, cut } from './morse.js';
import { netGain, system } from './antenna.js';
import { rigStatus } from './shack.js';
import { serviceOf, stationsFor, serviceBehave } from './services.js';
import { helperStations, behaveHelper } from './helpers.js';
import { netStations, cwStations, behaveNet, behaveCwPractice, repeaterNet, netCheckinFromPlayer, netsOn, ft8Stations, aprsStation } from './activity.js';

let NEXT_ID = 1;
export const activeContest = () => (world.contest && !['30m', '17m', '12m', '2m'].includes(world.band) ? world.contest : null);
export const player = () => { if (S.op.lat != null) return { lat: S.op.lat, lon: S.op.lon }; const st = stateBy(S.op.state) || stateBy('KS'); return { lat: st.lat, lon: st.lon }; };

const RIGS = ['SDR TCVR', 'HOMEBREW', '100W TCVR', 'OLD TUBE RIG', 'KIT RIG', 'QRP RIG', 'MOBILE RIG', 'SDR BASE', 'DUAL RX TCVR', 'VINTAGE RIG'];
const ANTS = ['DIPOLE AT 40 FT', 'VERTICAL', '3 EL YAGI', 'END FED', 'INV V', 'HEX BEAM', 'LOOP', 'G5RV'];
const WX = ['SUNNY', 'CLOUDY', 'RAIN', 'SNOW', 'WINDY', 'CLEAR'];
const greet = (st) => { const h = (simDate().getUTCHours() + st.op.lon / 15 + 24) % 24; return h < 12 ? 'GM' : h < 18 ? 'GA' : 'GE'; };
const greetWord = (g) => ({ GM: 'Good morning', GA: 'Good afternoon', GE: 'Good evening' }[g]);

// Phone text helper: §CALL§ -> phonetics when spoken, #123# -> digits spoken.
export function phone(tpl) {
  return {
    show: tpl.replace(/\{([^|}]*)\|([^}]*)\}/g, '$1').replace(/§([A-Z0-9/]+)§/g, '$1').replace(/#([0-9A-Z]+)#/g, '$1'),
    say: tpl.replace(/\{([^|}]*)\|([^}]*)\}/g, '$2').replace(/§([A-Z0-9/]+)§/g, (_, c) => phonetic(c)).replace(/#([0-9A-Z]+)#/g, (_, n) => digitsSpoken(n)),
  };
}

export class Station {
  constructor(o) {
    Object.assign(this, { id: NEXT_ID++, wpm: randi(16, 28), powerDbm: 50, antGain: randi(0, 6), st: 'idle', timer: rand(0.5, 6), queue: [], pq: null, worked: false, tries: 0, cqCount: 0 }, o);
    this.seed = randi(0, 1000);
    this.rate = rand(0.95, 1.15);
    this.pitch = rand(0.85, 1.15);
    this.qsb = { ph: rand(0, 6.28), per: rand(5, 22), depth: rand(1, this.op && this.op.cont !== 'NA' ? 12 : 6) };
    this.drift = 0;
  }
  get call() { return this.op.call; }
  get busy() { return !!this.tx && (now() < this.tx.end || this.tx.speaking); }
  send(text, sayText) {
    const t = now();
    if (this.mode === 'CW') {
      const sch = schedule(text, this.wpm);
      this.tx = { text, show: text, start: t + 0.05, end: t + 0.05 + sch.dur, sch, kind: 'cw' };
    } else {
      const words = (sayText || text).split(/\s+/).length;
      const dur = words * 0.42 / this.rate + 0.7;
      this.tx = { text, show: text, say: sayText || text, start: t + 0.05, end: t + 0.05 + dur, kind: 'voice' };
    }
    this.lastSent = { text, sayText };
    bus.emit('station-tx', this);
  }
  sendMsg(cwText, phoneTpl) {
    if (this.mode === 'CW') return this.send(cwText);
    const p = phone(phoneTpl);
    this.send(p.show, p.say);
  }
  later(delay, fn) { this.queue.push({ at: now() + delay, fn }); }
}

// ------------------------------------------------------------------ world
bus.on('realworld', () => world.refreshService());
export const world = {
  stations: [],
  bandCache: {},
  band: null,
  contest: null,
  records: new Map(), // key call|band|mode -> {call, exch, complete, time}
  lastTick: 0,
  rptAttempts: 0,

  bandFor(hz) { return bandOf(hz); },

  setFreq(hz) {
    const b = bandOf(hz) || serviceOf(hz);
    const name = b ? b.name : null;
    if (name === this.band) return;
    const cid = this.contest ? this.contest.id : null;
    const slot = worldSlot();
    if (this.band) this.bandCache[this.band] = { stations: this.stations.filter((s) => s.role !== 'caller' && s.role !== 'peer'), t: now(), contest: cid, slot: this.slot };
    const peers = this.stations.filter((s) => s.role === 'peer');
    this.band = name;
    const c = name && this.bandCache[name];
    if (b && b.mode && !bandOf(hz)) this.stations = stationsFor(b); // non-ham service region
    else if (c && c.slot === slot && c.contest === cid && (cid || now() - c.t < 1800)) this.stations = c.stations;
    else this.stations = name ? populateShared(b, this.contest) : [];
    // A band that was just built starts with every station waiting out a random pause, which
    // leaves several seconds of dead air after a band change. Shorten those first pauses so
    // there is something to hear almost at once, as there is on a real band.
    if (!(c && this.stations === c.stations)) for (const st of this.stations) if (st.timer > 0 && st.timer < 60) st.timer *= 0.15;
    this.slot = slot;
    for (const p of peers) if (p.band === name) this.stations.push(p);
    bus.emit('band', name);
  },

  // Every 30 minutes (UTC) the shared band population turns over, the same for every player.
  // real-world data arrived: rebuild the service region you're listening to
  refreshService() {
    const sv = serviceOf(S.radio.freq);
    if (!sv) return;
    const peers = this.stations.filter((s) => s.role === 'peer');
    this.stations = [...stationsFor(sv), ...peers];
  },

  refreshSlot() {
    const slot = worldSlot();
    if (slot === this.slot || !this.band || this.contest) return;
    const b = bandOf(S.radio.freq);
    if (!b || b.name !== this.band) return;
    const keep = this.stations.filter((s) => s.role === 'peer' || s.role === 'caller' || s.pq);
    this.stations = [...populateShared(b, null), ...keep];
    this.slot = slot;
    this.bandCache = {};
  },

  repopulate() { this.bandCache = {}; const b = bandOf(S.radio.freq); this.band = null; this.setFreq(S.radio.freq); },

  // Received signal in dBm at the player's receiver input (before AGC).
  rxDbm(st, fHz = st.freq) {
    const me = player();
    if (!st.path || now() - st.path.t > 15 || st.path.f !== Math.round(fHz / 1e5)) {
      // your antenna's height above ground (balcony/roof/mast) sets your radio horizon on VHF
      const myH = rig().look === 'ht' ? 1.5 : Math.max(2, (S.antenna.agl ?? (S.antenna.type === 'vertical' ? 6 : S.antenna.height)) * 0.3048);
      const p = st.txHeight && fHz >= 30e6 ? losPath(st.op, me, fHz / 1e6, st.txHeight, myH) : propPath(st.op, me, fHz / 1e6);
      st.path = { loss: p.loss, mode: p.mode, dist: p.dist, brg: bearing(me, st.op), t: now(), f: Math.round(fHz / 1e5) };
    }
    const g = rxAntGain(fHz, st.path.brg, st.path.dist, st.mode === 'FM' ? 'FM' : 'SSB');
    const q = st.qsb, t = now();
    const fade = q.depth * (0.5 + 0.5 * Math.sin(t * 2 * Math.PI / q.per + q.ph)) * (0.6 + 0.4 * Math.sin(t * 0.37 + q.ph * 2));
    if (st.fixedDbm != null) return st.fixedDbm; // helper channels are always clearly audible
    const dbm = st.powerDbm + st.antGain + g - st.path.loss - fade + (st.elevBoost || 0);
    return st.minDbm != null ? Math.max(st.minDbm, dbm) : dbm; // other players: always workable unless realistic propagation is chosen
  },

  // Player's signal-to-noise at a station (dB, in that station's filter BW).
  playerSnrAt(st, msg) {
    const me = player();
    const f = msg.freq / 1e6;
    const p = propPath(me, st.op, f);
    const g = txAntGain(msg.freq, bearing(me, st.op), p.dist, msg.mode === 'PHONE' && msg.sb === 'FM' ? 'FM' : 'SSB');
    const sig = msg.dbm + g + st.antGain - p.loss;
    const bw = msg.mode === 'CW' ? 500 : 2400;
    const noise = bandNoiseDbm(f, st.op) + 10 * Math.log10(bw / 2400);
    return sig - noise;
  },

  tick() {
    const t = now();
    for (const st of [...this.stations]) {
      if (st.queue.length) {
        const due = st.queue.filter((q) => q.at <= t);
        if (due.length) { st.queue = st.queue.filter((q) => q.at > t); for (const q of due) q.fn(); }
      }
      if (st.busy) continue;
      if (st.tx && !st.tx.done) { st.tx.done = true; onTxEnd(st); }
      behave(st, t);
    }
    if (t - (this.lastSlotCheck || 0) > 10) { this.lastSlotCheck = t; this.refreshSlot(); }
    // gentle churn during (single-player) contests: stations come and go
    if (this.contest && t - (this.lastChurn || 0) > 25 && this.band) {
      this.lastChurn = t;
      const b = bandOf(S.radio.freq);
      if (b && b.name === this.band && b.name !== '2m') churn(b, this.contest);
    }
  },

  addRecord(st, complete) {
    const key = `${st.call}|${this.band}|${st.mode === 'CW' ? 'CW' : 'PH'}`;
    const r = this.records.get(key) || { call: st.call, band: this.band, mode: st.mode, exch: st.exch, op: st.op, time: Date.now() };
    r.complete = r.complete || complete;
    r.time = Date.now();
    this.records.set(key, r);
    return r;
  },
  findRecord(call, band, mode) { return this.records.get(`${call}|${band}|${mode === 'CW' ? 'CW' : 'PH'}`); },
};

// VHF/UHF line-of-sight with real antenna heights: radio horizon d = 4.12(√h1 + √h2) km,
// gentle diffraction/tropo loss beyond it (~0.3 dB/km at 100 MHz).
function losPath(a, b, fMHz, hTx, hRx = 10) {
  const dist = Math.max(0.5, distanceKm(a, b));
  const fspl = 32.45 + 20 * Math.log10(dist) + 20 * Math.log10(fMHz);
  const horizon = 4.12 * (Math.sqrt(hTx) + Math.sqrt(hRx));
  const beyond = Math.max(0, dist - horizon);
  const loss = fspl + 6 + beyond * (0.22 + 0.0012 * fMHz) + (beyond > 0 ? 8 : 0);
  return { loss, dist, mode: beyond > 0 ? 'diffraction/tropo' : 'LOS' };
}

function rxAntGain(fHz, brg, dist, mode) {
  const rs = rigStatus();
  if (rs.end === 'dummy') return -70;
  if (rs.end !== 'antenna' || !S.antenna.built) return -45;
  if (!bandOf(fHz)) return fHz < 1.7e6 ? -14 : fHz < 30e6 ? -8 : -4; // general coverage: non-resonant antenna
  const g = netGain(fHz, brg, dist, mode);
  return g == null ? -45 : g;
}
const txAntGain = rxAntGain;

// ------------------------------------------------------------------ population
// Kept modest on purpose: each band also has a helper channel (helpers.js) that explains it.
const CASUAL_N = { '160m': 6, '80m': 13, '40m': 20, '30m': 8, '20m': 24, '17m': 10, '15m': 15, '12m': 7, '10m': 13, '6m': 6 };
const US_W = { '160m': 0.9, '80m': 0.85, '40m': 0.75, '30m': 0.6, '20m': 0.45, '17m': 0.45, '15m': 0.45, '12m': 0.45, '10m': 0.5, '6m': 0.8 };

function predictedSnr(op, band, f) {
  const p = propPath(op, player(), f / 1e6);
  return 50 + 3 - p.loss - bandNoiseDbm(f / 1e6, player());
}

function placeFreq(range, list, spacing, round) {
  for (let i = 0; i < 40; i++) {
    let f = rand(range[0] + spacing, range[1] - spacing);
    if (round) f = Math.round(f / round) * round + randi(-40, 40);
    if (list.every((s) => Math.abs(s.freq - f) > spacing)) return f;
  }
  return null;
}

function contestOk(contest, op) {
  if (!contest) return true;
  if (contest.def.id === 'fd') return op.country === 'United States' || op.country === 'Canada';
  if (contest.def.id === 'qp') return op.country === 'United States' || op.country === 'Canada';
  return true;
}

export function makeExch(contest, st) {
  const op = st.op;
  switch (contest.def.id) {
    case 'fd': {
      const cls = `${weighted([[1, 30], [2, 25], [3, 15], [4, 8], [5, 5], [6, 3]])}${weighted([['A', 50], ['D', 20], ['E', 10], ['B', 8], ['F', 5], ['C', 3]])}`;
      const sec = op.state || op.prov || 'ON';
      return { cls, sec, cw: `${cls} ${sec}`, ph: `#${cls}# ${op.state ? stateBy(op.state).name : op.qth}` };
    }
    case 'dx': {
      const z = op.zone;
      return { rst: st.mode === 'CW' ? '599' : '59', zone: String(z), cw: `5NN ${z}`, ph: `#59# #${z}#` };
    }
    default: {
      const s = op.state || op.prov || 'ON';
      return { rst: st.mode === 'CW' ? '599' : '59', st: s, cw: `5NN ${s}`, ph: `#59# ${op.state ? stateBy(op.state).name : op.qth}` };
    }
  }
}

function newStation(band, contest, list, opts = {}) {
  const usW = contest?.def.id === 'dx' ? 0.25 : US_W[band.name] ?? 0.5;
  let op = null;
  for (let i = 0; i < 12; i++) {
    const cand = randomOp({ usWeight: usW, onlyUS: contest && contest.def.id !== 'dx' && chance(0.92) });
    if (!contestOk(contest, cand)) continue;
    const snr = predictedSnr(cand, band, (band.lo + band.hi) / 2);
    if (snr > (opts.minSnr ?? -4)) { op = cand; break; }
  }
  if (!op) return null;
  const cwShare = band.name === '30m' ? 1 : contest ? (contest.mode === 'CW' ? 1 : contest.mode === 'PHONE' ? 0 : 0.5) : band.name === '160m' ? 0.5 : 0.4;
  const mode = !band.ph || chance(cwShare) ? 'CW' : band.name === '2m' ? 'FM' : 'SSB';
  const sb = band.lo < 10e6 ? 'LSB' : 'USB';
  const range = mode === 'CW' ? band.cw : band.ph;
  const freq = placeFreq(range, list, mode === 'CW' ? 450 : 3200, mode === 'CW' ? 100 : 1000);
  if (freq == null) return null;
  const st = new Station({
    op, mode, sb, freq, band: band.name,
    powerDbm: weighted([[50, 60], [37, 6], [57, 12], [60, 22]]),
    antGain: op.cont === 'NA' ? randi(0, 6) : randi(3, 10),
    wpm: contest ? randi(24, 34) : randi(13, 28),
  });
  if (contest) {
    st.role = 'run'; st.exch = makeExch(contest, st);
  } else {
    st.role = weighted([['cq', 55], ['rag', 45]]);
  }
  st.timer = rand(0.2, contest ? 4 : 10);
  return st;
}

// The shared world: band population is a pure function of (band, 30-min UTC slot), so
// every player online sees the same stations on the same frequencies at the same time.
const nearMe = () => { const p = player(); return { lat: p.lat + 0.05, lon: p.lon + 0.05 }; };
export const worldSlot = () => Math.floor(simDate().getTime() / 1800000);
function populateShared(band, contest) {
  if (contest || band.name === '2m') return populate(band, contest);
  return seeded(`band|${band.name}|${worldSlot()}`, () => populate(band, null, true));
}

// shared=true: the world's population independent of where *you* are (you hear the subset
// that propagates to you); otherwise stations are picked to be audible from your QTH.
function populate(band, contest, shared = false) {
  const list = [];
  if (band.name === '2m') return populate2m(band);
  const n = contest ? 30 : Math.round((CASUAL_N[band.name] || 10) * (shared ? 2.2 : 1));
  for (let i = 0; i < n; i++) {
    const st = newStation(band, contest, list, shared ? { minSnr: -Infinity } : {});
    if (!st) continue;
    list.push(st);
    if (st.role === 'rag') {
      // partner on same frequency
      const op2 = randomOp({ usWeight: US_W[band.name] ?? 0.5 });
      const p = new Station({ op: op2, mode: st.mode, sb: st.sb, freq: st.freq + randi(-60, 60), band: band.name, role: 'rag', wpm: st.wpm + randi(-3, 3) });
      st.partner = p; p.partner = st; st.ragTurn = 0; p.ragTurn = 0; st.leader = true;
      p.timer = 9999;
      list.push(p);
    }
  }
  if (!contest) list.push(...netStations(band), ...cwStations(band, list), ...helperStations(band.name, (o) => new Station(o), nearMe()));
  list.push(...ft8Stations(band)); // FT8 never stops, contest or not
  const beaconF = { '20m': 14100000, '17m': 18110000, '15m': 21150000, '12m': 24930000, '10m': 28200000 }[band.name];
  if (beaconF && !contest) list.push(new Station({ op: BEACONS[0], mode: 'CW', freq: beaconF, band: band.name, role: 'beacon', wpm: 22, powerDbm: 50, antGain: 2, slot: Object.keys({ '20m': 0, '17m': 1, '15m': 2, '12m': 3, '10m': 4 }).indexOf(band.name) }));
  return list;
}

function churn(band, contest) {
  const list = world.stations;
  const idle = list.filter((s) => (s.role === 'cq' || s.role === 'run') && !s.pq && !s.busy && s.st === 'listen');
  if (idle.length && chance(0.4) && list.length > 4) {
    const gone = pick(idle);
    world.stations = list.filter((s) => s !== gone);
  }
  if (chance(0.5)) {
    const st = newStation(band, contest, world.stations);
    if (st) { st.role = contest ? 'run' : 'cq'; world.stations.push(st); }
  }
}

// NCDXF/IARU beacons (approximate locations)
const BCN = [['4U1UN', 40.75, -73.97], ['VE8AT', 79.99, -85.9], ['W6WX', 37.15, -121.9], ['KH6RS', 20.77, -156.3], ['ZL6B', -41.06, 175.6],
  ['VK6RBP', -32.1, 116.05], ['JA2IGY', 34.46, 136.8], ['RR9O', 54.98, 82.9], ['VR2B', 22.27, 114.15], ['4S7B', 6.9, 79.87],
  ['ZS6DN', -25.9, 28.3], ['5Z4B', -1.25, 36.7], ['4X6TU', 32.1, 34.8], ['OH2B', 60.3, 24.4], ['CS3B', 32.8, -17.2],
  ['LU4AA', -34.6, -58.4], ['OA4B', -12.1, -76.9], ['YV5B', 9.1, -67.8]];
const BEACONS = BCN.map(([call, lat, lon]) => ({ call, lat, lon, cont: '', zone: 0, qth: 'beacon', name: '', lang: 'en-US' }));
export const BEACON_SITES = BEACONS;

// ------------------------------------------------------------------ 2 m FM
function populate2m(band) {
  const me = player();
  const near = (km) => { const a = rand(0, 2 * Math.PI); return { lat: me.lat + Math.cos(a) * km / 111, lon: me.lon + Math.sin(a) * km / 85 }; };
  const st = stateBy(S.op.state) || stateBy('KS');
  if (!S.local || S.local.state !== S.op.state || S.local.v !== 3) {
    const d = typeof st.dist === 'number' ? st.dist : 7;
    // seeded by state, so players in the same state share the same local repeater and locals
    S.local = seeded(`local|${S.op.state}`, () => ({
      v: 3,
      state: S.op.state,
      rpt: pick(['W', 'K', 'N']) + d + pick(['RPT', 'ARC', 'MRA', 'EOC', 'VHF', 'SKY']),
      locals: Array.from({ length: 10 }, () => ({ call: usCall(st), name: pick(['Bob', 'Jim', 'Sue', 'Dave', 'Pat', 'Ken', 'Linda', 'Rick', 'Amy', 'Walt', 'Gary', 'Carol', 'Tom', 'Deb', 'Ann', 'Ray']) })),
    }));
    save();
  }
  const rptPos = near(18);
  const rpt = new Station({
    op: { call: S.local.rpt + '/R', ...rptPos, cont: 'NA', zone: 4, qth: 'local', name: 'repeater', lang: 'en-US' },
    mode: 'FM', sb: 'FM', freq: 146940000, band: '2m', role: 'repeater', powerDbm: 50, antGain: 9,
    input: 146340000, tone: 100.0, lastId: now() - rand(200, 500), timer: rand(8, 25),
  });
  rpt.locals = S.local.locals.map((l) => ({ ...l, ...near(rand(3, 40)) }));
  const simplex = new Station({
    op: { call: S.local.locals[0].call, ...near(12), cont: 'NA', zone: 4, qth: 'local', name: S.local.locals[0].name, lang: 'en-US' },
    mode: 'FM', sb: 'FM', freq: 146520000, band: '2m', role: 'simplex', powerDbm: 44, antGain: 3, timer: rand(20, 60),
  });
  return [rpt, simplex, aprsStation(S.local.locals, near), ...helperStations('2m', (o) => new Station(o), nearMe())];
}

const RPT_CHAT = [
  (a, b) => [`§${b.call}§ from §${a.call}§, you around this morning?`, `§${a.call}§, yeah I'm here. Just heading in to work. How's it going?`, `Doing good. Did you get that antenna up over the weekend?`, `Sure did, the new vertical is working great. Talked to a guy in Japan on 10 meters.`, `Nice! Alright, I'll let you go. §${a.call}§ clear.`, `§${b.call}§ clear.`],
  (a) => [`§${a.call}§ monitoring.`],
  (a, b) => [`§${b.call}§, §${a.call}§.`, `Go ahead ${a.name}.`, `Are we still on for the club meeting Thursday? Seven P M at the library.`, `Affirmative, I'll bring the coax crimper. §${b.call}§.`, `Sounds good. 73, §${a.call}§.`],
  (a) => [`This is §${a.call}§. Reminder, the weekly net is tonight at eight on this repeater. All check-ins welcome. §${a.call}§.`],
  (a, b) => [`§${b.call}§ this is §${a.call}§, how's my audio on the new handheld?`, `${a.name}, you're full quieting, audio sounds great. §${b.call}§.`, `Thanks. Seventy three. §${a.call}§ clear.`],
  (a, b) => [`§${b.call}§, §${a.call}§, you on frequency?`, `Go ahead ${a.name}.`, `Just wanted to say the swap meet is Saturday at the fairgrounds, gates open at seven.`, `Thanks, I'll be there looking for a power supply. §${b.call}§.`],
  (a) => [`§${a.call}§ mobile, heading north on the interstate. Anybody around for a chat?`],
  (a, b) => [`§${b.call}§ from §${a.call}§.`, `Morning ${a.name}, go ahead.`, `How did the antenna work out? Did you get the SWR down?`, `Got it down to about one point three to one after trimming a couple of inches off each leg. Works great now.`, `Glad to hear it. §${a.call}§.`],
  (a, b) => [`This is §${a.call}§ with a reminder: license exams are this Saturday at the community center, nine A M. Bring a photo ID.`, `Thanks ${a.name}, my nephew is taking his Technician. §${b.call}§.`],
  (a, b) => [`§${b.call}§ this is §${a.call}§, are you on the air from the new house yet?`, `Just a handheld so far, ${a.name}. The roof antenna goes up this weekend.`, `Let me know if you need a hand with the mast. §${a.call}§.`],
  (a) => [`§${a.call}§ testing, one, two, three. Testing on the repeater, §${a.call}§.`],
  (a, b) => [`§${b.call}§ from §${a.call}§, the sky is getting dark out west. Might be time to watch for a SKYWARN activation tonight.`, `Copy that ${a.name}, I'll keep the radio on. §${b.call}§.`],
];

// ------------------------------------------------------------------ behaviours
function cqText(st) {
  const c = st.call;
  if (st.mode === 'CW') {
    if (st.op.cont !== 'NA' && chance(0.3)) return [`CQ DX CQ DX DE ${c} ${c} K`];
    return [pick([`CQ CQ CQ DE ${c} ${c} ${c} K`, `CQ CQ DE ${c} ${c} K`, `CQ CQ CQ DE ${c} ${c} K`])];
  }
  return [null, pick([`CQ CQ CQ, this is §${c}§, §${c}§, calling CQ and listening.`, `CQ CQ, §${c}§ calling CQ. §${c}§ standing by.`, `CQ CQ CQ, this is §${c}§ §${c}§ §${c}§, CQ and standing by.`])];
}

function contestCq(st) {
  const c = st.call, id = activeContest().def.id;
  if (st.mode === 'CW') return { fd: pick([`CQ FD ${c} ${c}`, `CQ FD ${c}`]), dx: pick([`CQ TEST ${c} ${c}`, `${c} TEST`, `CQ ${c}`]), qp: pick([`CQ QP ${c} ${c}`, `CQ QP ${c}`]) }[id];
  const p = phone({ fd: `CQ Field Day, CQ Field Day, §${c}§, §${c}§, Field Day.`, dx: `CQ contest, CQ contest, §${c}§, §${c}§, contest.`, qp: `CQ QSO party, §${c}§, §${c}§, QSO party.` }[id]);
  return p;
}

function sendContestCq(st) {
  const m = contestCq(st);
  if (typeof m === 'string') st.send(m); else st.send(m.show, m.say);
}

function ragText(st) {
  const o = st.partner, me = st.op, turn = st.ragTurn++;
  const rst = `${randi(4, 5)}${randi(5, 9)}${st.mode === 'CW' ? 9 : ''}`;
  if (st.mode === 'CW') {
    if (turn === 0) return `${o.call} DE ${me.call} ${greet(st)} OM TNX FER CALL UR RST ${rst} ${rst} NAME ${me.name.toUpperCase()} ${me.name.toUpperCase()} QTH ${me.qth.toUpperCase()} HW? ${o.call} DE ${me.call} KN`;
    if (turn === 1) return `${o.call} DE ${me.call} R FB ${o.op.name.toUpperCase()} RIG HR ${pick(RIGS)} PWR 100W ANT ${pick(ANTS)} WX ${pick(WX)} ${randi(35, 85)}F <BT> ${o.call} DE ${me.call} KN`;
    if (turn === 2) return `${o.call} DE ${me.call} R TNX FER FB QSO ${o.op.name.toUpperCase()} HPE CUAGN 73 <SK> ${o.call} DE ${me.call}`;
    return null;
  }
  if (turn === 0) return `§${o.call}§, this is §${me.call}§. ${greetWord(greet(st))}, thanks for coming back. You're #${rst}# here. Name is ${me.name}, QTH ${me.qth}. Back to you. §${o.call}§ from §${me.call}§.`;
  if (turn === 1) return `Roger ${o.op.name}, good copy. Running about a hundred watts into a ${pick(['dipole', 'vertical', 'beam', 'end fed wire', 'loop'])} here. Weather is ${pick(WX).toLowerCase()} today. So, how long have you been a ham? §${o.call}§, §${me.call}§.`;
  if (turn === 2) return `Well ${o.op.name}, I need to run, thanks for the nice chat. Seventy three and hope to work you again. §${o.call}§ this is §${me.call}§, clear.`;
  return null;
}

function behave(st, t) {
  switch (st.role) {
    case 'cq': return behaveCq(st, t);
    case 'rag': return behaveRag(st, t);
    case 'run': return behaveRun(st, t);
    case 'caller': return behaveCaller(st, t);
    case 'beacon': return behaveBeacon(st, t);
    case 'repeater': return behaveRepeater(st, t);
    case 'simplex': return behaveSimplex(st, t);
    case 'net': return behaveNet(st, t);
    case 'cwpractice': return behaveCwPractice(st, t);
    case 'helper': return behaveHelper(st);
    default: return serviceBehave(st, t);
  }
}

function tickTimer(st) { st.timer -= 0.1; return st.timer <= 0; }

function behaveCq(st) {
  if (st.pq) return engagedTimeout(st);
  if (!tickTimer(st)) return;
  if (st.st === 'listen') {
    if (st.cqCount > randi(5, 9)) { st.st = 'qrt'; st.timer = rand(60, 200); return; }
  }
  if (st.st === 'qrt') { st.cqCount = 0; }
  st.cqCount++;
  const [cw, ph] = cqText(st);
  st.sendMsg(cw, ph);
  st.st = 'cq';
}

function behaveRag(st) {
  if (!st.leader && st.timer > 9000) return; // waits for partner
  if (!tickTimer(st)) return;
  const txt = ragText(st);
  if (!txt) {
    if (st.leader) {
      const p = st.partner;
      world.stations = world.stations.filter((x) => x !== p);
      st.partner = null; st.role = 'cq'; st.st = 'idle'; st.timer = rand(5, 30);
    } else st.timer = 9999;
    return;
  }
  if (st.mode === 'CW') st.send(txt); else { const p = phone(txt); st.send(p.show, p.say); }
  st.st = 'rag';
  st.timer = 9999;
}

function behaveRun(st) {
  if (st.pq) return engagedTimeout(st);
  if (!tickTimer(st)) return;
  if (st.st === 'listen' && chance(0.33)) {
    // work an (inaudible) caller
    const fake = randomOp({ usWeight: 0.6 }).call;
    const ex = makeExch(activeContest(), st);
    if (st.mode === 'CW') st.send(`${fake} ${ex.cw}`); else { const p = phone(`§${fake}§ ${ex.ph}`); st.send(p.show, p.say); }
    st.st = 'fakeqso';
    return;
  }
  if (st.st === 'fakeqso') {
    if (st.mode === 'CW') st.send(pick([`TU ${st.call}`, 'TU', `R TU ${st.call}`])); else { const p = phone(`Thanks, §${st.call}§.`); st.send(p.show, p.say); }
    st.st = 'tu';
    return;
  }
  sendContestCq(st);
  st.st = 'cq';
}

function behaveBeacon(st) {
  const sec = Math.floor(simDate().getTime() / 1000);
  const slot = Math.floor(sec / 10);
  if (st.lastSlot === slot) return;
  st.lastSlot = slot;
  const idx = ((slot - st.slot) % 18 + 18) % 18;
  st.op = BEACONS[idx];
  st.path = null;
  st.send(`${st.op.call} ~~~~`);
}

function behaveCaller(st) {
  if (now() - st.born > 90 || st.tries > 4) { world.stations = world.stations.filter((x) => x !== st); }
}

function onTxEnd(st) {
  const pat = S.settings.patience || 1; // Settings → operator patience
  if (st.role === 'cq' && (st.st === 'cq')) { st.st = 'listen'; st.timer = rand(3.5, 7) * pat; }
  if (st.role === 'run' && (st.st === 'cq' || st.st === 'tu')) { st.st = 'listen'; st.timer = rand(1.8, 3.2) * pat; }
  if (st.role === 'run' && st.st === 'fakeqso') { st.timer = rand(1.2, 2); }
  if (st.role === 'rag' && st.partner) {
    st.partner.timer = rand(1.5, 4);
    if (!st.partner.leader && st.partner.timer > 9000) st.partner.timer = rand(1.5, 4);
  }
  if (st.pq) st.pq.lastAct = now();
}

function engagedTimeout(st) {
  const idle = now() - (st.pq.lastAct || now());
  const lim = activeContest() ? 9 : 30;
  if (idle > lim) {
    const pc = S.call;
    if (st.pq.stage !== 'done' && chance(0.6)) st.sendMsg(`${pc}?`, `§${pc}§?`);
    st.pq = null;
    st.st = st.role === 'run' ? 'listen' : 'listen';
    st.timer = rand(2, 4);
  }
}

// ------------------------------------------------------------------ repeater
function behaveRepeater(st, t) {
  if (st.chat && st.chat.length) {
    if (st.chatGap && now() < st.chatGap) return;
    const line = st.chat.shift();
    if (line.text === '__open__') { st.chatGap = now() + 12; return; }
    st.speaker = line.who;
    st.seed = line.who.seed; st.rate = 1.05;
    const p = phone(line.text);
    st.send(p.show, p.say);
    st.tx.courtesy = true;
    st.chatGap = now() + rand(1.2, 3);
    return;
  }
  if (now() - st.lastId > 600) {
    st.lastId = now();
    const sch = schedule(`DE ${st.call}`, 20);
    st.tx = { text: `DE ${st.call}`, show: `DE ${st.call} (repeater CW ID)`, start: now() + 0.1, end: now() + 0.1 + sch.dur, sch, kind: 'cwtone' };
    bus.emit('station-tx', st);
    return;
  }
  if (st.pq) {
    if (now() - st.pq.lastAct > 60) st.pq = null;
    return;
  }
  st.netOn = netsOn('2m').length > 0;
  if (!tickTimer(st)) return;
  const netLines = repeaterNet(st);
  if (netLines) { st.timer = rand(25, 50); st.chat = netLines; return; }
  st.timer = rand(30, 90);
  const locals = st.locals.map((l, i) => ({ ...l, seed: 100 + i * 37 }));
  const a = pick(locals), b = pick(locals.filter((x) => x !== a));
  const lines = pick(RPT_CHAT)(a, b);
  st.chat = lines.map((text, i) => ({ text, who: i % 2 === 0 ? a : b }));
}

function behaveSimplex(st) {
  if (st.pq) { if (now() - st.pq.lastAct > 45) st.pq = null; return; }
  if (!tickTimer(st)) return;
  st.timer = rand(90, 240);
  st.sendMsg('', `This is §${st.call}§ monitoring simplex, 146.52.`);
}

// ------------------------------------------------------------------ player transmissions
export function analyze(text) {
  const T = String(text).toUpperCase().replace(/[^A-Z0-9/?<> ]/g, ' ');
  const tokens = T.split(/\s+/).filter(Boolean);
  const calls = tokens.filter((t) => isCallsign(t.replace(/\?$/, '')) && !t.endsWith('?'));
  const partials = tokens.filter((t) => t.length > 1 && t.endsWith('?')).map((t) => t.slice(0, -1));
  const has = (...w) => w.some((x) => tokens.includes(x));
  let pname = null;
  const ni = tokens.findIndex((t) => t === 'NAME' || t === 'OP');
  if (ni >= 0) { let j = ni + 1; while (['IS', 'HR', 'HERE', 'HERES', 'ES'].includes(tokens[j])) j++; if (tokens[j] && /^[A-Z]{2,12}$/.test(tokens[j])) pname = tokens[j]; }
  return {
    tokens, calls, partials,
    hasCQ: has('CQ'),
    hasMy: S.call ? tokens.includes(S.call) : false,
    agn: has('AGN', '?', 'AGAIN', 'RPT?', 'NR?', 'QRZ?') && !partials.length,
    qrz: has('QRZ', 'QRZ?'),
    tu: has('TU', 'TNX', 'THANKS', '73', 'QSL', 'R'),
    end: has('73', 'SK', '<SK>', 'CL'),
    rst: tokens.some((t) => /^([1-5][1-9][1-9N]|5NN|[1-5][1-9])$/.test(t)),
    pname,
  };
}

function myExch(contest, mode) {
  const st = stateBy(S.op.state);
  switch (contest.def.id) {
    case 'fd': return { cw: `${contest.cls} ${S.op.state}`, ph: `#${contest.cls}# ${st.name}`, need: [contest.cls, S.op.state] };
    case 'dx': return { cw: `5NN ${st.zone}`, ph: `#59# #${st.zone}#`, need: [String(st.zone)] };
    default: return { cw: `5NN ${S.op.state}`, ph: `#59# ${st.name}`, need: [S.op.state] };
  }
}
export { myExch };

function hasExch(a, contest) {
  const need = myExch(contest).need;
  return need.every((n) => a.tokens.includes(n) || a.tokens.includes(n.replace(/^0+/, '')) || a.tokens.some((t) => t.endsWith(n) && /^(5NN|599|59)/.test(t)));
}

const tolFor = (msg) => (msg.mode === 'CW' ? 180 : msg.sb === 'FM' ? 6000 : 450);
function modeMatches(st, msg) {
  if (msg.mode === 'CW') return st.mode === 'CW';
  if (msg.sb === 'FM') return st.mode === 'FM';
  return st.mode === 'SSB' && st.sb === msg.sb;
}

let wrongSideband = 0, offFreq = 0;

// A station that hears someone start calling keeps listening until they finish.
export function playerTxStart(freq, mode, sb, dur) {
  const msg = { mode: mode === 'CW' ? 'CW' : 'PHONE', sb: mode === 'CW' ? 'CW' : sb, freq };
  const tol = tolFor(msg) + 200;
  for (const st of world.stations) {
    if (Math.abs(st.freq - freq) > tol || !modeMatches(st, msg)) continue;
    if (st.st === 'listen' || st.pq) st.timer = Math.max(st.timer, dur + 2.5);
    if (st.pq) st.pq.lastAct = now() + dur;
    if (st.role === 'caller' && st.born) st.born = Math.max(st.born, now() - 60);
  }
}

// msg = {text, mode:'CW'|'PHONE', sb, freq, dbm, rpt:{offset,tone}}
export function playerTransmitted(msg) {
  const a = analyze(msg.text);
  msg.a = a;
  if (world.band === '2m' && msg.sb === 'FM') return repeaterInput(msg, a);
  if (netCheckinFromPlayer(world.stations, msg, a)) return;
  const tol = tolFor(msg);
  const near = world.stations.filter((st) => st.role !== 'beacon' && Math.abs(st.freq - msg.freq) <= tol + (st.role === 'caller' ? 400 : 0));
  // wrong sideband / off frequency hints
  const sbWrong = world.stations.some((st) => st.mode === 'SSB' && msg.mode === 'PHONE' && st.sb !== msg.sb && Math.abs(st.freq - msg.freq) < 600);
  if (sbWrong && ++wrongSideband >= 2) bus.emit('elmer', 'sideband');
  const cands = near.filter((st) => modeMatches(st, msg));
  if (!cands.length && !a.hasCQ) {
    const close = world.stations.find((st) => modeMatches(st, msg) && Math.abs(st.freq - msg.freq) < tol * 4 && Math.abs(st.freq - msg.freq) > tol);
    if (close && ++offFreq >= 2) { bus.emit('elmer', 'zero_beat'); offFreq = 0; }
  }
  // Callers responding to the player's CQ get priority.
  const callers = world.stations.filter((st) => st.role === 'caller' && Math.abs(st.freq - msg.freq) < 900 && modeMatches(st, msg));
  if (callers.length && !a.hasCQ) return handleCallers(callers, msg, a);
  if (a.hasCQ || (activeContest() && a.tu && !callers.length && a.tokens.includes(S.call) && !cands.some((s) => s.pq))) {
    if (!a.hasMy) bus.emit('elmer', 'id_rule');
    const busy = world.stations.filter((st) => modeMatches(st, msg) && Math.abs(st.freq - msg.freq) < (msg.mode === 'CW' ? 300 : 2500) && st.role !== 'caller' && st.role !== 'beacon' && world.playerSnrAt(st, msg) > 0);
    if (busy.length && chance(0.7)) {
      const b = busy[0];
      b.later(rand(0.5, 1.2), () => b.sendMsg(pick(['QRL', 'QRL QRL', 'PSE QSY']), 'This frequency is in use, please Q S Y.'));
      return;
    }
    for (const c of callers) { c.tries++; if (chance(0.6)) c.later(rand(0.3, 1.5), () => callerSendCall(c)); }
    spawnCallers(msg, a, a.hasMy ? 1 : 0.3);
    return;
  }
  // Engaged station first, else a listening station that hears us.
  const engaged = cands.find((st) => st.pq);
  if (engaged) return progressQso(engaged, msg, a);
  if (!a.hasMy && !a.partials.length) return;
  const listening = cands.filter((st) => (st.st === 'listen' || (st.role === 'cq' && st.st === 'qrt' && false)) && (st.role === 'cq' || st.role === 'run'));
  listening.sort((x, y) => Math.abs(x.freq - msg.freq) - Math.abs(y.freq - msg.freq));
  const st = listening[0];
  if (!st) return;
  // Calling someone else's call? then not for this station
  if (a.calls.some((c) => c !== S.call && c !== st.call)) return;
  const snr = world.playerSnrAt(st, msg);
  if (snr < (msg.mode === 'CW' ? -2 : 3)) { if (snr > -8 && chance(0.5)) st.later(rand(0.6, 1.2), () => st.sendMsg('?', 'QRZ? Station calling, again please?')); return; }
  st.queue = st.queue.filter(() => false);
  startQso(st, msg, a, snr);
}

function startQso(st, msg, a, snr) {
  const pc = S.call;
  // courtesy: answer at (about) the speed you were called
  if (st.mode === 'CW' && !activeContest()) st.wpm = clamp(Math.min(st.wpm, S.settings.myWpm + 2), 8, 40);
  st.pq = { stage: 'answered', lastAct: now(), snr, pname: a.pname };
  st.timer = 99;
  const partial = snr < (msg.mode === 'CW' ? 3 : 8) && chance(0.5);
  if (partial) {
    st.pq.stage = 'partial';
    const frag = pc.slice(0, Math.max(2, Math.floor(pc.length / 2)));
    st.later(rand(0.5, 1.1), () => st.sendMsg(`${frag}?`, `Station with §${frag}§, again?`));
    return;
  }
  replyToCaller(st, snr);
}

function sToRst(snr, cw) {
  const r = snr > 10 ? 5 : snr > 4 ? 4 : 3;
  const s = clamp(Math.round(snr / 4), 1, 9);
  return cw ? `${r}${s}9` : `${r}${s}`;
}

function replyToCaller(st, snr) {
  const pc = S.call, c = st.call;
  st.pq.stage = 'sentExch';
  st.pq.lastAct = now();
  if (activeContest()) {
    if (st.worked) {
      st.later(rand(0.4, 0.9), () => st.sendMsg(`${pc} QSO B4 TU`, `§${pc}§, we worked before, thanks. QRZ.`));
      st.pq = null; st.st = 'listen'; st.timer = rand(2, 3);
      bus.emit('elmer', 'dupe');
      return;
    }
    st.later(rand(0.3, 0.9), () => st.sendMsg(`${pc} ${st.exch.cw}`, `§${pc}§ ${st.exch.ph}`));
    world.addRecord(st, false);
    return;
  }
  const rst = sToRst(snr, st.mode === 'CW');
  const g = greet(st), N = st.op.name.toUpperCase(), Q = st.op.qth.toUpperCase();
  st.pq.rstSent = rst;
  st.exch = { rst, name: st.op.name, qth: st.op.qth };
  world.addRecord(st, false);
  st.later(rand(0.6, 1.4), () => st.sendMsg(
    `${pc} DE ${c} ${g} TNX FER CALL UR RST ${rst} ${rst} NAME ${N} ${N} QTH ${Q} ${Q} HW? ${pc} DE ${c} KN`,
    `§${pc}§, this is §${c}§. ${greetWord(g)} and thanks for the call. You're #${rst}# here. My name is ${st.op.name}, QTH is ${st.op.qth}. How copy? §${pc}§, this is §${c}§, over.`));
}

function progressQso(st, msg, a) {
  const pc = S.call, c = st.call, pq = st.pq;
  pq.lastAct = now();
  if (a.pname) pq.pname = a.pname;
  if (pq.stage === 'partial') {
    if (a.hasMy) return replyToCaller(st, pq.snr + 4);
    return;
  }
  if (a.tokens.includes('QRS') && st.mode === 'CW') {
    st.wpm = Math.max(8, st.wpm - 6);
    bus.emit('elmer', 'wpm_qrs');
    st.later(rand(0.4, 1), () => st.lastSent && st.send(st.lastSent.text, st.lastSent.sayText));
    return;
  }
  if (a.agn || (a.partials.length && !a.hasMy)) {
    st.later(rand(0.4, 1), () => st.lastSent && st.send(st.lastSent.text, st.lastSent.sayText));
    return;
  }
  if (activeContest()) {
    if (pq.stage === 'sentExch') {
      if (hasExch(a, activeContest())) {
        st.later(rand(0.3, 0.8), () => st.sendMsg(pick([`TU ${c}`, 'TU', `R TU ${c}`]), `Thanks, §${c}§, QRZ.`));
        st.worked = true; pq.stage = 'done';
        world.addRecord(st, true);
        bus.emit('qso-complete', st);
        setTimeout(() => { if (st.pq === pq) st.pq = null; st.st = 'listen'; st.timer = rand(1.5, 2.5); }, 200);
      } else if (a.hasMy) {
        st.later(rand(0.4, 0.9), () => st.sendMsg(`${pc} ${st.exch.cw}`, `§${pc}§ ${st.exch.ph}`));
      } else {
        st.later(rand(0.4, 0.9), () => st.sendMsg(pick(['NR?', 'AGN?', 'EXCH?']), 'Please copy your exchange again?'));
      }
    }
    return;
  }
  // casual
  if (pq.stage === 'sentExch') {
    if (!a.rst && !a.end) {
      st.later(rand(0.6, 1.2), () => st.sendMsg(`${pc} DE ${c} UR RST? KN`, `§${pc}§, did you copy my signal report? What's my report? Over.`));
      bus.emit('elmer', 'rst');
      return;
    }
    const nm = (pq.pname || 'OM').toUpperCase();
    pq.stage = 'done';
    st.worked = true;
    world.addRecord(st, true);
    st.later(rand(0.7, 1.4), () => st.sendMsg(
      `R R ${pc} DE ${c} TNX FER QSO ${nm} 73 ES GL <SK> ${pc} DE ${c} TU EE`,
      `Roger roger, thanks ${pq.pname ? pq.pname.charAt(0) + pq.pname.slice(1).toLowerCase() : 'old man'}, great to work you. Seventy three and good luck. §${pc}§, this is §${c}§, clear.`));
    bus.emit('qso-complete', st);
    setTimeout(() => { if (st.pq === pq) st.pq = null; st.st = 'listen'; st.timer = rand(8, 20); st.cqCount = 0; }, 3000);
    return;
  }
  if (pq.stage === 'done' && a.end) { /* final 73s */ }
}

// ------------------------------------------------------------------ pileups for the player's CQ
function spawnCallers(msg, a, idFactor) {
  const b = bandOf(msg.freq);
  if (!b) return;
  const contest = activeContest();
  let lambda = (contest ? 2.4 : 0.9) * idFactor;
  if (msg.mode === 'CW' && contest) lambda *= 1.15;
  const cands = [];
  for (let i = 0; i < 14; i++) {
    const op = randomOp({ usWeight: contest?.def.id === 'dx' ? 0.2 : (US_W[b.name] ?? 0.5), onlyUS: contest && contest.def.id !== 'dx' });
    if (!contestOk(contest, op)) continue;
    const tmp = new Station({ op, mode: msg.mode === 'CW' ? 'CW' : msg.sb === 'FM' ? 'FM' : 'SSB', sb: msg.sb, freq: msg.freq, band: b.name });
    tmp.antGain = randi(0, 8); tmp.powerDbm = weighted([[50, 65], [57, 10], [60, 15], [40, 10]]);
    const snrThem = world.playerSnrAt(tmp, msg);
    if (snrThem < 2) continue;
    if (contest && world.records.get(`${op.call}|${b.name}|${msg.mode === 'CW' ? 'CW' : 'PH'}`)?.complete) continue;
    cands.push(tmp);
  }
  const frac = cands.length / 14;
  let n = Math.min(cands.length, poisson(lambda * (0.4 + frac)));
  const existing = world.stations.filter((s) => s.role === 'caller').length;
  n = Math.min(n, 5 - existing);
  for (let i = 0; i < n; i++) {
    const c = cands[i];
    c.role = 'caller'; c.st = 'calling'; c.born = now(); c.tries = 0;
    c.freq = msg.freq + (msg.mode === 'CW' ? randi(-220, 220) : randi(-120, 120));
    c.wpm = contest ? randi(22, 34) : randi(13, 26);
    c.exch = contest ? makeExch(contest, c) : null;
    world.stations.push(c);
    c.later(rand(0.25, 1.8), () => callerSendCall(c));
  }
  if (!n && chance(0.15) && !contest) bus.emit('elmer', 'muf');
}

function callerSendCall(c) {
  const pc = S.call;
  if (activeContest()) c.sendMsg(chance(0.3) ? `${c.call} ${c.call}` : c.call, `§${c.call}§`);
  else c.sendMsg(`${pc} DE ${c.call} ${c.call} K`, `§${pc}§, this is §${c.call}§, §${c.call}§.`);
  c.st = 'calling';
}

function handleCallers(callers, msg, a) {
  const pc = S.call, contest = activeContest();
  const active = callers.find((c) => c.pq && c.pq.stage !== 'done');
  // QRZ / AGN / ? -> everyone calls again
  if ((a.agn || a.qrz) && !a.calls.length && !a.partials.length) {
    if (active) { active.later(rand(0.3, 0.8), () => active.lastSent && active.send(active.lastSent.text, active.lastSent.sayText)); return; }
    for (const c of callers) { c.tries++; c.later(rand(0.2, 1.2), () => callerSendCall(c)); }
    return;
  }
  // partial query like "W1?" or "AB?"
  if (a.partials.length && !a.calls.length) {
    const frag = a.partials[0];
    const m = callers.filter((c) => c.call.includes(frag));
    for (const c of (m.length ? m : [])) c.later(rand(0.2, 0.8), () => c.sendMsg(`${c.call} ${c.call}`, `§${c.call}§ §${c.call}§`));
    return;
  }
  // exact / fuzzy pick
  let target = null, fuzzy = false;
  for (const t of a.calls) {
    if (t === pc) continue;
    target = callers.find((c) => c.call === t);
    if (target) break;
    const near = callers.map((c) => [c, lev(c.call, t)]).filter(([, d]) => d <= 2).sort((x, y) => x[1] - y[1])[0];
    if (near) { target = near[0]; fuzzy = true; break; }
  }
  if (!target && active && (a.tu || a.end)) return finishCaller(active, msg, a);
  if (!target && active) {
    // continuing exchange with active caller
    if (contest) return;
    return casualCallerProgress(active, msg, a);
  }
  if (!target) return;
  if (target.pq && ['sentExch', 'sentReply'].includes(target.pq.stage) && (a.tu || a.end) && !(contest && hasExch(a, contest) && !a.tu)) return finishCaller(target, msg, a);
  for (const c of callers) if (c !== target && !c.pq) { c.st = 'waiting'; }
  const snr = world.playerSnrAt(target, msg);
  target.pq = target.pq || { stage: 'picked', lastAct: now(), snr };
  target.pq.lastAct = now();
  if (contest) {
    const exOk = hasExch(a, contest);
    if (!exOk) {
      target.later(rand(0.3, 0.8), () => target.sendMsg('?', 'Copy your exchange again?'));
      bus.emit('elmer', 'exchange_both');
      return;
    }
    const corr = fuzzy ? `${target.call} ${target.call} ` : '';
    target.later(rand(0.3, 0.8), () => target.sendMsg(`${corr}${pick(['TU', 'R', ''])} ${target.exch.cw}`.trim(), `${fuzzy ? `Correction, my call is §${target.call}§. ` : ''}Thanks, ${target.exch.ph}`));
    target.pq.stage = 'sentExch';
    world.addRecord(target, true);
    bus.emit('qso-complete', target);
    target.worked = true;
    return;
  }
  // casual: player sent "THEIRCALL DE MYCALL ... UR RST ..."
  const nm = (a.pname || 'OM').toUpperCase();
  const rst = sToRst(snr, target.mode === 'CW');
  const N = target.op.name.toUpperCase(), Q = target.op.qth.toUpperCase();
  target.exch = { rst, name: target.op.name, qth: target.op.qth };
  target.pq.stage = 'sentReply';
  world.addRecord(target, false);
  target.later(rand(0.6, 1.3), () => target.sendMsg(
    `${fuzzy ? `${target.call} ` : ''}R ${pc} DE ${target.call} ${greet(target)} ${nm} TNX FER RPT UR RST ${rst} ${rst} NAME ${N} ${N} QTH ${Q} ${Q} HW? ${pc} DE ${target.call} KN`,
    `${fuzzy ? `Correction, my call is §${target.call}§. ` : ''}§${pc}§ from §${target.call}§, thanks for the report. You're #${rst}# here. Name is ${target.op.name}, located in ${target.op.qth}. Back to you, §${pc}§ from §${target.call}§.`));
}

function casualCallerProgress(c, msg, a) {
  if (c.pq.stage === 'sentReply' && (a.end || a.tu || a.rst)) return finishCaller(c, msg, a);
}

function finishCaller(c, msg, a) {
  const pc = S.call;
  if (activeContest()) {
    c.pq.stage = 'done';
    world.stations = world.stations.filter((x) => x !== c);
    // remaining callers call again, maybe new ones join
    for (const o of world.stations.filter((x) => x.role === 'caller')) { o.tries++; if (chance(0.75)) o.later(rand(0.3, 1.5), () => callerSendCall(o)); }
    if (a.tokens.includes(pc)) spawnCallers(msg, a, 0.7);
    return;
  }
  c.pq.stage = 'done';
  world.addRecord(c, true);
  c.worked = true;
  bus.emit('qso-complete', c);
  c.later(rand(0.6, 1.2), () => c.sendMsg(`TU ${pc} 73 <SK> EE`, `Thanks, seventy three. §${c.call}§ clear.`));
  setTimeout(() => { world.stations = world.stations.filter((x) => x !== c); }, 15000);
  for (const o of world.stations.filter((x) => x.role === 'caller' && x !== c)) o.later(rand(5, 8), () => callerSendCall(o));
}

// ------------------------------------------------------------------ repeater input
function repeaterInput(msg, a) {
  const rpt = world.stations.find((s) => s.role === 'repeater');
  const simplex = world.stations.find((s) => s.role === 'simplex');
  const txF = msg.freq;
  if (simplex && Math.abs(txF - simplex.freq) < 6000) {
    if (a.hasMy || a.hasCQ) {
      simplex.pq = { lastAct: now() };
      simplex.later(rand(1.5, 3), () => simplex.sendMsg('', `§${S.call}§, this is §${simplex.call}§ on simplex. You're coming in loud and clear. Name is ${simplex.op.name}. What's your name? Over.`));
    }
    return;
  }
  if (!rpt) return;
  if (Math.abs(txF - rpt.input) < 6000) {
    if (Math.abs(msg.rptTone - rpt.tone) > 0.5) {
      if (++world.rptAttempts >= 2) bus.emit('elmer', 'repeater_no_tone');
      bus.emit('rpt', { opened: false });
      return;
    }
    world.rptAttempts = 0;
    bus.emit('rpt', { opened: true });
    if (netCheckinFromPlayer([rpt], msg, a)) { (S.flags ||= {}).rpt = 1; rpt.later(0.6, () => bus.emit('courtesy')); return; }
    (S.flags ||= {}).rpt = 1;
    bus.emit('elmer', 'repeater');
    // courtesy tone after you unkey
    rpt.later(0.6, () => bus.emit('courtesy'));
    if (a.hasMy || a.hasCQ || a.tokens.includes('MONITORING') || a.tokens.includes('LISTENING')) {
      const L = rpt.locals[randi(0, rpt.locals.length - 1)];
      const who = { ...L, seed: 300 };
      const nm = a.pname ? a.pname.charAt(0) + a.pname.slice(1).toLowerCase() : null;
      rpt.chat = [];
      if (!rpt.pq) {
        rpt.pq = { lastAct: now(), who, n: 0 };
        rpt.chatGap = now() + rand(2.5, 4);
        rpt.chat.push({ who, text: `§${S.call}§, this is §${L.call}§. Welcome to the repeater! You're full quieting. Name here is ${L.name}. What's your name and where are you located? §${L.call}§.` });
      } else {
        rpt.pq.lastAct = now(); rpt.pq.n++;
        rpt.chatGap = now() + rand(2.5, 4);
        const w = rpt.pq.who;
        if (rpt.pq.n === 1) rpt.chat.push({ who: w, text: `Nice to meet you${nm ? ' ' + nm : ''}. Hey, we have a net here Tuesday nights at eight, you should check in. Anyway, I'm about to head out. Seventy three, §${w.call}§ clear.` });
        else { rpt.chat.push({ who: w, text: `Roger, seventy three. §${w.call}§.` }); rpt.pq = null; }
        world.addRecord({ call: w.call, mode: 'FM', exch: {}, op: rpt.op }, true);
      }
    }
    return;
  }
  if (rpt && Math.abs(txF - rpt.freq) < 6000) {
    if (chance(0.7)) {
      const L = rpt.locals[0];
      rpt.chat = [{ who: { ...L, seed: 301 }, text: `Station calling, I can hear you simplex on the output. You need a minus six hundred offset and a one hundred hertz tone for the repeater. §${L.call}§.` }];
      rpt.chatGap = now() + 3;
    }
    bus.emit('elmer', 'repeater');
  }
}
