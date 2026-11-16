// More life on the air. All of it is simulated traffic:
//  - Emergency / traffic nets on a schedule (local repeater, 80 m and 40 m), with a net control
//    station that takes check-ins — including yours, if you call in with your callsign.
//  - Slow-speed CW: QRS stations calling CQ in the CW segments, and a code-practice broadcast.
//  - Short-range radio services: CB (channels 9 and 19), FRS walkie-talkies, a GMRS repeater
//    and MURS. These are listen-only: amateur radios are not certified to transmit there.
import { S } from './state.js';
import { rand, randi, pick, chance, now, hashStr, seeded } from './util.js';
import { Station, phone, player } from './world.js';
import { stateBy, usCall } from './data/world.js';
import { simDate } from './propagation.js';
import { schedule } from './morse.js';
import { bus } from './util.js';

const NAMES = ['Bob', 'Jim', 'Sue', 'Dave', 'Pat', 'Ken', 'Linda', 'Rick', 'Amy', 'Walt', 'Gary', 'Carol', 'Tom', 'Deb', 'Mike', 'Ann', 'Ray', 'Joan', 'Al', 'Beth', 'Hank', 'Lou'];
const county = () => seeded(`county|${S.op.state}`, () => pick(['Washington', 'Jefferson', 'Franklin', 'Lincoln', 'Madison', 'Jackson', 'Clay', 'Marion', 'Greene', 'Union']));

// Local solar-ish time at the player's longitude (hours, 0–24).
export function localHour(d = simDate()) {
  const p = player();
  return ((d.getUTCHours() + d.getUTCMinutes() / 60 + p.lon / 15) % 24 + 24) % 24;
}
const inWindow = (h, a, b) => (a <= b ? h >= a && h < b : h >= a || h < b);

// ------------------------------------------------------------------ nets
export const NETS = [
  { id: 'ares', band: '2m', freq: 146940000, mode: 'FM', from: 19, to: 20, title: () => `${county()} County ARES net`, kind: 'emergency', desc: 'Weekly-style emergency-service net on the local repeater. Practise a formal check-in: wait for net control to ask, then give your callsign, name and location.' },
  { id: 'traffic80', band: '80m', freq: 3940000, mode: 'LSB', from: 18.5, to: 19.5, title: () => `${stateBy(S.op.state)?.name || 'State'} traffic net`, kind: 'traffic', desc: 'Evening phone traffic net: stations check in and pass formal messages across the state.' },
  { id: 'emcomm40', band: '40m', freq: 7240000, mode: 'LSB', from: 12, to: 13, title: () => 'Regional emergency practice net', kind: 'emergency', desc: 'Midday HF practice net for emergency communicators across the region.' },
  { id: 'wx20', band: '20m', freq: 14325000, mode: 'USB', from: 15, to: 16, title: () => 'Severe weather net (practice session)', kind: 'weather', desc: 'Afternoon weather-reporting net: stations send ground-truth weather reports to net control.' },
];
export const netActive = (n, d = simDate()) => inWindow(localHour(d), n.from, n.to);
export const netsOn = (band) => NETS.filter((n) => n.band === band && netActive(n));
export function nextNet(n, d = simDate()) {
  const h = localHour(d);
  const dh = ((n.from - h) % 24 + 24) % 24;
  return netActive(n, d) ? 0 : dh;
}

function netCheckins(seed, n) {
  const st = stateBy(S.op.state) || stateBy('KS');
  return seeded(`net|${seed}|${Math.floor(simDate().getTime() / 864e5)}`, () => Array.from({ length: n }, () => ({ call: usCall(st), name: pick(NAMES), loc: pick(['north side', 'downtown', 'the east end', 'near the fairgrounds', 'out west of town', 'up on the ridge', 'by the river', 'south of the highway']), seed: randi(100, 900) })));
}

// The net script: preamble, check-ins, traffic, close. Repeats while the net window is open,
// with "late check-ins" rounds so there is always something to hear.
function netScript(net, ncs, ins) {
  const N = net.title();
  const L = [];
  const say = (who, text) => L.push({ who, text });
  say(ncs, `Good evening. This is §${ncs.call}§, net control for the ${N}. This is a directed net. Please do not transmit unless called by net control. Stations with emergency or priority traffic, please call now.`);
  say(ncs, 'Hearing none. We will now take check-ins. Please give your call sign, name and location, and indicate if you have traffic.');
  for (const c of ins.slice(0, randi(3, ins.length))) {
    say(c, `§${c.call}§, ${c.name}, ${c.loc}${chance(0.2) ? ', with traffic' : ', no traffic'}.`);
    say(ncs, `§${c.call}§, thank you ${c.name}.`);
  }
  say(ncs, 'Any further check-ins? Late or short-time stations, call now.');
  say(ncs, '__open__');
  if (net.kind === 'traffic') say(ncs, 'Net control has one piece of formal traffic for the ' + (stateBy(S.op.state)?.name || 'state') + ' section. Is there a station able to take it? Hearing none, I will hold it for the next session.');
  if (net.kind === 'weather') say(ins[0], `§${ins[0].call}§ with a report: ${pick(['light rain, wind about ten miles per hour from the south', 'clear skies, no severe weather', 'pea-sized hail just started, wind gusting to thirty', 'heavy rain, visibility under one mile'])}.`);
  if (net.kind === 'emergency') say(ncs, `Reminder: the county emergency operations center will run a drill next month. Volunteers should check their go-kits and battery backup.`);
  say(ncs, `This is §${ncs.call}§ closing the ${N} for this session. Thank you to all who checked in. The repeater is returned to normal use. §${ncs.call}§ clear.`);
  return L;
}

// Called from world.populate / populate2m.
export function netStations(band) {
  const out = [];
  for (const net of netsOn(band.name)) {
    const st = stateBy(S.op.state) || stateBy('KS');
    const ncs = seeded(`ncs|${net.id}|${S.op.state}`, () => ({ call: usCall(st), name: pick(NAMES), seed: randi(50, 99) }));
    if (net.band === '2m') continue; // the repeater runs its own net (see repeaterNet)
    const p = player();
    const a = (hashStr(net.id) % 360) * Math.PI / 180, km = net.band === '80m' ? 180 : 600;
    const s = new Station({ op: { call: ncs.call, name: ncs.name, lat: p.lat + Math.cos(a) * km / 111, lon: p.lon + Math.sin(a) * km / 85, qth: st.name, cont: 'NA', lang: 'en-US' },
      mode: 'SSB', sb: net.mode, freq: net.freq, band: band.name, role: 'net', net, ncs, powerDbm: 53, antGain: 4, timer: rand(1, 6) });
    s.ins = netCheckins(net.id, 7);
    out.push(s);
  }
  return out;
}

// Generic scripted-conversation runner (nets and short-range chatter).
function runChat(st) {
  if (st.busy || st.queue?.length) return true;
  if (!st.chat?.length) return false;
  if (now() < (st.chatGap || 0)) return true;
  const l = st.chat.shift();
  if (l.text === '__open__') { st.openFor = now() + 12; st.chatGap = now() + 12; return true; }
  st.seed = l.who.seed; st.pitch = l.who.pitch || st.pitch; st.speaker = l.who;
  const p = phone(l.text);
  st.send(p.show, p.say);
  st.chatGap = now() + rand(1.2, 2.6);
  return true;
}

export function behaveNet(st) {
  if (!netActive(st.net)) { st.chat = []; return; }
  if (runChat(st)) return;
  st.timer -= 0.1;
  if (st.timer > 0) return;
  st.timer = rand(40, 90);
  st.chat = netScript(st.net, st.ncs, st.ins);
}

// The local repeater's net: returns chat lines while the net window is open.
export function repeaterNet(rpt) {
  const net = NETS.find((n) => n.id === 'ares');
  if (!netActive(net)) return null;
  const st = stateBy(S.op.state) || stateBy('KS');
  const ncs = seeded(`ncs|ares|${S.op.state}`, () => ({ call: usCall(st), name: pick(NAMES), seed: randi(50, 99) }));
  rpt.netOn = true;
  return netScript(net, ncs, [...(rpt.locals || []).map((l, i) => ({ ...l, loc: pick(['north side', 'downtown', 'east end', 'by the fairgrounds']), seed: 100 + i * 37 })), ...netCheckins('ares', 3)]);
}

// The player checks in: net control acknowledges by callsign.
export function netCheckinFromPlayer(stations, msg, a) {
  const st = stations.find((s) => (s.role === 'net' || (s.role === 'repeater' && s.netOn)) && (s.role === 'repeater' || Math.abs(s.freq - msg.freq) < 1500));
  if (!st || !a.hasMy) return false;
  const net = st.net || NETS.find((n) => n.id === 'ares');
  if (!netActive(net)) return false;
  const ncs = st.ncs || seeded(`ncs|ares|${S.op.state}`, () => ({ call: 'NCS', name: 'Net control', seed: 60 }));
  const nm = a.pname ? ` ${a.pname.charAt(0)}${a.pname.slice(1).toLowerCase()}` : '';
  const line = { who: ncs, text: `§${S.call}§, thank you${nm}, you are checked in. Welcome to the ${net.title()}. Any traffic? Hearing none, stand by.` };
  st.chat = [line, ...(st.chat || []).filter((l) => l.text !== '__open__')];
  st.chatGap = now() + rand(1.5, 2.5);
  (S.flags ||= {}).netCheckin = 1;
  bus.emit('net-checkin', net);
  return true;
}

// ------------------------------------------------------------------ slow CW and code practice
const PRACTICE = [
  'VVV VVV CQ CQ CQ DE QRS QRS = THIS IS A CODE PRACTICE TRANSMISSION AT TEN WORDS PER MINUTE = COPY WHAT YOU CAN AND DO NOT WORRY ABOUT MISSED LETTERS = KEEP WRITING AND THE NEXT WORD WILL COME = AR',
  'VVV VVV = THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG 1234567890 = LISTEN FOR THE RHYTHM OF EACH CHARACTER NOT THE DOTS AND DASHES = AR',
  'VVV VVV = A DIPOLE FOR FORTY METERS IS ABOUT SIXTY FIVE FEET LONG = THE SWR SHOULD BE LOWEST IN THE MIDDLE OF THE BAND = AR',
  'VVV VVV = RST MEANS READABILITY STRENGTH AND TONE = 599 IS OFTEN SENT AS 5NN = QTH MEANS LOCATION AND OP MEANS OPERATOR = AR',
];
export function cwStations(band, list) {
  const out = [];
  if (!['80m', '40m'].includes(band.name)) return out;
  const st = stateBy(S.op.state) || stateBy('KS');
  const p = player();
  const lo = band.name === '40m' ? 7040000 : 3540000;
  for (let i = 0; i < 3; i++) {
    const a = rand(0, 6.28), km = rand(60, 700);
    const f = lo + randi(0, 18) * 1000 + randi(-150, 150);
    if (list.concat(out).some((s) => Math.abs(s.freq - f) < 400)) continue;
    out.push(new Station({ op: { call: usCall(st), name: pick(NAMES), lat: p.lat + Math.cos(a) * km / 111, lon: p.lon + Math.sin(a) * km / 85, qth: st.name, cont: 'NA', lang: 'en-US' },
      mode: 'CW', sb: 'CW', freq: f, band: band.name, role: 'cq', wpm: randi(8, 13), powerDbm: 50, antGain: 2, qrs: true, timer: rand(1, 12) }));
  }
  const pf = band.name === '40m' ? 7047500 : 3581500;
  out.push(new Station({ op: { call: 'QRS', name: 'Code practice', lat: p.lat + 3, lon: p.lon + 5, qth: 'regional', cont: 'NA', lang: 'en-US' },
    mode: 'CW', sb: 'CW', freq: pf, band: band.name, role: 'cwpractice', wpm: 10, powerDbm: 58, antGain: 4, timer: rand(1, 4), idx: randi(0, PRACTICE.length - 1) }));
  return out;
}
export function behaveCwPractice(st) {
  if (st.busy) return;
  st.timer -= 0.1;
  if (st.timer > 0) return;
  st.timer = rand(6, 14);
  st.idx = (st.idx + 1) % PRACTICE.length;
  st.wpm = pick([5, 10, 10, 13, 15]);
  st.send(PRACTICE[st.idx].replace('TEN WORDS', `${['FIVE', 'TEN', 'TEN', 'THIRTEEN', 'FIFTEEN'][[5, 10, 10, 13, 15].indexOf(st.wpm)]} WORDS`));
}

// ------------------------------------------------------------------ short-range services
export const PART95 = [
  { lo: 26.965e6, hi: 27.405e6, name: 'CB radio', rule: 'CB (Part 95, 11 m band) needs a certified CB radio; amateur transceivers may not be used there.' },
  { lo: 151.8e6, hi: 154.61e6, name: 'MURS', rule: 'MURS (Part 95) is licence-free but only with certified MURS radios, 2 W maximum.' },
  { lo: 462.55e6, hi: 467.725e6, name: 'FRS/GMRS', rule: 'FRS needs a certified FRS radio; GMRS needs a GMRS licence and a certified GMRS radio. Amateur handhelds are not certified for either.' },
];
export const part95At = (hz) => PART95.find((p) => hz >= p.lo && hz <= p.hi && (p.name !== 'MURS' || [151.82e6, 151.88e6, 151.94e6, 154.57e6, 154.6e6].some((f) => Math.abs(hz - f) < 7000)));

const CB = [
  (a, b) => [[a, 'Breaker one-nine, how about that eastbound, you got your ears on?'], [b, 'Yeah, go ahead, you got the eastbound.'], [a, 'How does it look over your shoulder? Any bears back there?'], [b, 'Clean and green back to the yardstick at the county line. Smokey was taking pictures at the overpass about ten miles back though.'], [a, 'Ten-four, appreciate it. Keep the shiny side up.']],
  (a, b) => [[a, 'Break one-nine for a radio check.'], [b, 'You are wall to wall and treetop tall, come on.'], [a, 'Ten-four, thanks for the check.']],
  (a, b) => [[a, 'Westbound, there is a four-wheeler broke down on the right shoulder at the mile marker one-twelve.'], [b, 'Copy that, thanks driver. We will move over.']],
  (a) => [[a, 'Any westbound, you got a copy? Looking for a good place to eat off the next exit.'], [{ seed: 520 }, 'Truck stop at the next exit has a decent diner. Exit on the right.'], [a, 'Ten-four, appreciate you.']],
];
const FRS = [
  (a, b) => [[a, 'Mom, we are at the trailhead. Can you hear me?'], [b, 'I hear you. Stay on the main trail and check in when you reach the lake.'], [a, 'Okay. Over and out.']],
  (a, b) => [[a, 'Team two, this is team one, we are at the north gate.'], [b, 'Copy team one, team two is ten minutes out.']],
  (a, b) => [[a, 'Hey, are you guys at the campsite yet?'], [b, 'Yeah, site forty-two. Bring the extra firewood.'], [a, 'Got it.']],
];
const GMRS = [
  (a, b) => [[a, `${a.call} for a radio check on the repeater.`], [b, `${b.call}, you are full quieting into the machine. Good signal.`], [a, `Thanks, ${a.call} clear.`]],
  (a, b) => [[a, `${a.call} mobile, heading home from the store. Anybody need anything?`], [b, `${b.call}, grab some milk if you can. Thanks.`], [a, `Will do. ${a.call}.`]],
];
const MURS = [
  (a, b) => [[a, 'Gate two, delivery truck coming through in five minutes.'], [b, 'Copy, gate two is open.']],
  (a, b) => [[a, 'Feed barn to the house, the north pasture gate is closed now.'], [b, 'Got it, thanks.']],
];
const gmrsCall = () => `W${pick('ABCDEFGHIJKLMNOPQRSTUVWXYZ')}${pick('ABCDEFGHIJKLMNOPQRSTUVWXYZ')}${pick('ABCDEFGHIJKLMNOPQRSTUVWXYZ')}${randi(100, 999)}`;

// Stations for the general-coverage regions (called from services.stationsFor).
export function shortRangeStations(regionName, mk, qth) {
  const out = [];
  const at = (km, s) => { const a = (s % 360) * Math.PI / 180; return { lat: qth.lat + Math.cos(a) * km / 111, lon: qth.lon + Math.sin(a) * km / 85 }; };
  const add = (o) => out.push(mk({ ...o, role: 'chatter', timer: rand(3, 20), op: { cont: 'NA', lang: 'en-US', ...o.op } }));
  if (regionName === 'SW') {
    add({ op: { call: 'CB 19', name: 'CB channel 19 (highway)', ...at(12, 19), qth: 'highway' }, mode: 'AM', sb: 'AM', freq: 27185000, band: 'SW', scripts: CB, gap: [30, 90], powerDbm: 36, antGain: 0, svc: 'CB radio' });
    add({ op: { call: 'CB 9', name: 'CB channel 9 (emergency)', ...at(20, 9), qth: 'local' }, mode: 'AM', sb: 'AM', freq: 27065000, band: 'SW', scripts: [(a) => [[a, 'Channel nine, this is a monitoring station. Emergency and travelers assistance only on this channel.']], (a, b) => [[a, 'Channel nine, I have a car in the ditch on county road twelve, nobody hurt, can somebody call it in?'], [b, 'Copy, I am calling the sheriff now. Stay with the vehicle.']]], gap: [120, 300], powerDbm: 36, antGain: 0, svc: 'CB radio' });
  }
  if (regionName === 'VHF') {
    add({ op: { call: 'MURS 3', name: 'MURS channel 3 (farm/business)', ...at(4, 3), qth: 'local' }, mode: 'FM', sb: 'FM', freq: 151940000, band: 'VHF', scripts: MURS, gap: [60, 180], powerDbm: 33, antGain: 0, txHeight: 3, svc: 'MURS' });
  }
  if (regionName === 'UHF') {
    add({ op: { call: 'FRS 1', name: 'FRS channel 1 (walkie-talkies)', ...at(1.5, 1), qth: 'nearby' }, mode: 'FM', sb: 'FM', freq: 462562500, band: 'UHF', scripts: FRS, gap: [40, 120], powerDbm: 33, antGain: -2, txHeight: 1.5, svc: 'FRS/GMRS' });
    add({ op: { call: 'FRS 7', name: 'FRS channel 7', ...at(2.5, 7), qth: 'nearby' }, mode: 'FM', sb: 'FM', freq: 462712500, band: 'UHF', scripts: FRS, gap: [60, 200], powerDbm: 27, antGain: -2, txHeight: 1.5, svc: 'FRS/GMRS' });
    add({ op: { call: 'GMRS RPT', name: 'GMRS repeater (462.675, tone 141.3)', ...at(15, 20), qth: 'local' }, mode: 'FM', sb: 'FM', freq: 462675000, band: 'UHF', scripts: GMRS, gap: [60, 160], powerDbm: 47, antGain: 6, txHeight: 60, svc: 'FRS/GMRS', gmrs: true });
  }
  return out;
}

export function behaveChatter(st) {
  if (runChat(st)) return;
  st.timer -= 0.1;
  if (st.timer > 0) return;
  st.timer = rand(...(st.gap || [40, 120]));
  const a = { seed: randi(100, 900), call: st.gmrs ? gmrsCall() : '' }, b = { seed: randi(100, 900), call: st.gmrs ? gmrsCall() : '' };
  st.chat = pick(st.scripts)(a, b).map(([who, text]) => ({ who: who.seed ? who : { seed: 400 }, text }));
}
