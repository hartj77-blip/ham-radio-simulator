// More life on the air. All of it is simulated traffic:
//  - Emergency / traffic nets on a schedule (local repeater, 80 m and 40 m), with a net control
//    station that takes check-ins — including yours, if you call in with your callsign.
//  - Slow-speed CW: QRS stations calling CQ in the CW segments, and a code-practice broadcast.
//  - Short-range radio services: CB (channels 9 and 19), FRS walkie-talkies, a GMRS repeater
//    and MURS. These are listen-only: amateur radios are not certified to transmit there.
//  - What most of the spectrum is actually used for: fire dispatch with two-tone paging,
//    railroad road channel and defect detectors, marine VHF, business and highway crews,
//    digital (P25/DMR) systems an analog receiver cannot demodulate, oceanic air traffic and
//    VOLMET on HF, FT8 on every HF band and APRS packets on 2 m.
import { S } from './state.js';
import { rand, randi, pick, chance, now, hashStr, seeded } from './util.js';
import { Station, phone, player } from './world.js';
import { stateBy, usCall, randomOp } from './data/world.js';
import { simDate, grid } from './propagation.js';
import { RW, AIRLINES } from './realworld.js';
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
  if (l.tone) { // paging / SELCAL tone
    st.tx = { kind: st.mode === 'FM' ? 'fmtone' : 'amtone', tone: l.tone, text: '', show: '', note: l.note, start: now(), end: now() + l.dur, sch: { segs: [{ t0: 0, t1: l.dur, amp: 1 }], chars: [], dur: l.dur } };
    bus.emit('station-tx', st);
    st.chatGap = now() + l.dur + 0.15;
    return true;
  }
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

// ------------------------------------------------------------------ everyday radio services
// Most radio traffic is not broadcasting: it is people doing a job. Everything below is
// simulated and receive-only; the frequencies are the real nationwide ones for each service.
export const PART95 = [
  { lo: 26.965e6, hi: 27.405e6, name: 'CB radio', rule: 'CB (Part 95, 11 m band) needs a certified CB radio; amateur transceivers may not be used there.' },
  { lo: 151.8e6, hi: 154.61e6, name: 'MURS', rule: 'MURS (Part 95) is licence-free but only with certified MURS radios, 2 W maximum.' },
  { lo: 462.55e6, hi: 467.725e6, name: 'FRS/GMRS', rule: 'FRS needs a certified FRS radio; GMRS needs a GMRS licence and a certified GMRS radio. Amateur handhelds are not certified for either.' },
];
export const part95At = (hz) => PART95.find((p) => hz >= p.lo && hz <= p.hi && (p.name !== 'MURS' || [151.82e6, 151.88e6, 151.94e6, 154.57e6, 154.6e6].some((f) => Math.abs(hz - f) < 7000)));

// Real nationwide frequencies used below.
export const SVC = {
  fire: 154.190e6, rail: 160.800e6, marine16: 156.800e6, marine22a: 157.100e6, marine13: 156.650e6,
  biz: 151.625e6, bizUhf: 469.500e6, dot: 47.260e6, p25: 155.595e6, dmr: 451.800e6, aprs: 144.390e6,
  oceanic: [5598e3, 8906e3], volmet: [3485e3, 6604e3, 10051e3, 13270e3],
};
// States with no coast, Great Lake or commercially navigable river: no marine VHF traffic.
const DRY = ['AZ', 'NM', 'NV', 'UT', 'CO', 'WY', 'MT', 'ID', 'ND', 'SD', 'NE', 'KS'];
export const hasMarine = () => !DRY.includes(S.op.state);

const STREETS = ['Main Street', 'Mill Road', 'County Road 12', 'Oak Street', 'Highway 9', 'Church Street', 'Maple Avenue', 'Quarry Road', 'River Road', 'Depot Street'];
const hhmm = () => { const h = localHour(); return `${String(Math.floor(h)).padStart(2, '0')}${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`; };
const who = (o, call) => { o.call = call; return o; };
const DISP = { seed: 611, pitch: 1.15, call: 'Dispatch' };

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

// Fire dispatch: a two-tone sequential page opens the station's pagers, then the voice dispatch.
const page = () => { const t = pick([[1082.1, 1232.6], [928.1, 1357.6], [707.3, 1122.5], [1530.0, 832.5]]); return [['tone', t[0], 1, 'Two-tone page: tone A (1 s) then tone B (3 s) opens the pagers of one fire station.'], ['tone', t[1], 3]]; };
const FIRE = [
  (a, b) => {
    const n = randi(1, 6), eng = who(a, `Engine ${n}1`), w = RW.wx || {}, T = hhmm();
    const call = w.storm && chance(0.6) ? 'wires down and arcing across the roadway' : w.snow && chance(0.6) ? 'vehicle off the roadway, unknown injuries' : pick(['commercial fire alarm, general alarm from the pull station', 'motor vehicle accident with injuries, two vehicles', 'smoke investigation, odor of smoke in the residence', 'carbon monoxide alarm sounding, occupants are outside', 'lift assist, no injuries reported', 'brush fire, approximately a quarter acre']);
    return [...page(), [DISP, `${county()} County Fire to Station ${n}, Engine ${n}1, Medic ${n}. Respond for a ${call}. ${randi(100, 2400)} ${pick(STREETS)}, cross of ${pick(STREETS)}. Time out #${T}#.`], [eng, `Engine ${n}1 responding.`], [DISP, `Engine ${n}1 responding, #${T}#.`]];
  },
  (a) => {
    const n = randi(1, 6), eng = who(a, `Engine ${n}1`), st = pick(STREETS), T = hhmm();
    return [[eng, `County, Engine ${n}1 on scene. ${pick(['Single story residential, nothing showing, investigating', 'Two story commercial, alarm sounding, nothing showing', 'Two vehicles, moderate damage, one lane blocked', 'Light smoke from the eaves, stretching a line'])}. Engine ${n}1 will be ${st} command.`], [DISP, `Copy Engine ${n}1 on scene, ${st} command, #${T}#.`]];
  },
  (a) => { const n = randi(1, 6); return [[who(a, `Engine ${n}1`), `County, Engine ${n}1 is clear and available, returning to quarters.`], [DISP, `Engine ${n}1 available, #${hhmm()}#.`]]; },
  () => [...page(), [DISP, `${county()} County Fire with the daily test of the paging system. This is a test only. No response is required. ${county()} County clear, #${hhmm()}#.`]],
];

// Railroad road channel: crews, the dispatcher and the automated trackside defect detector.
const RAIL = [
  () => { const mp = `${randi(20, 480)}.${randi(0, 9)}`; return [[{ seed: 640, pitch: 0.75, call: 'Detector' }, `Detector, milepost ${mp}, track ${pick(['one', 'two'])}. No defects. Repeat, no defects. Total axles, ${randi(60, 620)}. Temperature, ${Math.round(RW.wx?.tempF ?? randi(35, 85))} degrees. Detector out.`]]; },
  (a, b) => { const tr = randi(1000, 8999), dir = pick(['east', 'west', 'north', 'south']), m1 = randi(100, 300), eng = who(a, `${tr} ${dir}`), ds = who(b, 'Dispatcher'); return [[ds, `Dispatcher to the ${tr} ${dir}, over.`], [eng, `${tr} ${dir}, go ahead dispatcher.`], [ds, `${tr}, I have a track warrant for you when you are ready to copy.`], [eng, 'Ready to copy.'], [ds, `Track warrant number ${randi(100, 899)}, to the ${tr} ${dir}. Check box two: proceed from milepost ${m1} to milepost ${m1 + randi(12, 40)} on the main track. Check box eight: hold main track at last named point. Over.`], [eng, `Box two, milepost ${m1} to the last named point on the main, box eight hold the main. Over.`], [ds, `That is correct. O K at #${hhmm()}#. Dispatcher out.`]]; },
  (a, b) => [[who(a, 'Conductor'), 'Yard job, back her up. Five cars to a joint.'], [who(b, 'Engineer'), 'Five cars.'], [a, 'Three cars.'], [a, 'One car. Half a car.'], [a, 'That will do. Stretch them out.'], [b, 'Stretching.'], [a, 'Good joint. Set and centered when you are ready.']],
  (a, b) => { const tr = randi(1000, 8999); return [[who(a, `${tr}`), `${tr} is in the clear at the east siding switch, switch lined and locked normal.`], [who(b, 'Dispatcher'), `Copy ${tr} in the clear, thank you. Dispatcher out.`]]; },
  (a) => [[who(a, 'Engineer'), `Highball the detector. Clear signal at milepost ${randi(20, 480)}.`]],
];

// Marine VHF: channel 16 is for distress and calling only; you hail, then move.
const BOATS = ['Sea Breeze', 'Lady Jane', 'Osprey', 'Second Wind', 'Miss Kelly', 'Northern Light', 'Tidewater', 'Blue Heron', 'Windward', 'Patience'];
const CG = { seed: 650, pitch: 1.0, call: 'Coast Guard' };
const MARINE16 = [
  (a) => { const v = pick(BOATS); return [[who(a, v), `Any station, any station, this is the motor vessel ${v}, radio check channel one six, over.`], [CG, `Vessel calling for a radio check, this is United States Coast Guard. Channel one six is a distress and hailing frequency. Radio checks should be made on channel zero niner. Coast Guard out.`]]; },
  (a, b) => { const v = pick(BOATS), w = pick(BOATS.filter((x) => x !== v)), ch = pick(['six eight', 'six niner', 'seven one', 'seven two']); return [[who(a, v), `${w}, ${w}, this is ${v} on one six, over.`], [who(b, w), `${v}, this is ${w}. Switch ${ch}.`], [a, `${ch.charAt(0).toUpperCase()}${ch.slice(1)}.`]]; },
  () => [[CG, 'Securité, securité, securité. Hello all stations, this is United States Coast Guard. For a safety marine information broadcast, listen channel two two alpha. Coast Guard out.']],
  (a) => { const v = pick(BOATS); return [[who(a, v), `Coast Guard, Coast Guard, this is the sailing vessel ${v}. We are disabled with a fouled propeller, two persons on board, not in distress, requesting commercial assistance.`], [CG, `Vessel ${v}, this is Coast Guard, roger. Shift and answer channel two two alpha, over.`], [a, 'Two two alpha.']]; },
];
const MARINE22 = [
  () => { const p = RW.nws?.periods?.[0]; return [[CG, `Hello all stations, this is United States Coast Guard with a safety marine information broadcast. ${p ? `The National Weather Service forecast for ${p.name.toLowerCase()}: ${p.text} ` : ''}Break. The Coast Guard has received a report of ${pick(['a partially submerged log adrift near the channel entrance', 'a lighted buoy reported extinguished', 'dredging operations in the main channel, the dredge monitors channel one three', 'a navigation light reported off station'])}. All mariners are requested to transit the area with caution. This is United States Coast Guard, out.`]]; },
];
const MARINE13 = [
  (a, b) => { const d = pick(['northbound', 'southbound', 'upbound', 'downbound']); return [[who(a, 'Tow'), `Security call, ${d} tow approaching the ${pick(['highway', 'railroad', 'lift'])} bridge with ${randi(4, 15)} loads. Any concerned traffic, channel one three.`], [who(b, 'Tug'), 'Captain, I am the light boat below the bridge. I will hold up here and see you on the one whistle.'], [a, 'One whistle. Appreciate it, have a good watch.']]; },
  (a, b) => [[who(a, 'Vessel'), `${pick(['Highway', 'Railroad'])} bridge, this is the inbound vessel requesting an opening.`], [who(b, 'Bridge'), 'Roger captain, I will have her open in about five minutes. Stand by for the horn.']],
];

// Business and industrial: the bulk of land-mobile licences.
const BIZ = [
  (a, b) => [[who(a, 'Flagger 1'), 'Flagger one to flagger two, the last car coming to you is the white pickup.'], [who(b, 'Flagger 2'), 'White pickup. Sending mine through after him.'], [a, 'Copy.']],
  (a, b) => [[who(a, 'Foreman'), 'Hey Mike, bring the skid steer around to the north side, and we need two more pallets of block.'], [who(b, 'Operator'), 'On my way. Ten minutes on the block.']],
  (a, b) => [[who(a, 'Base'), 'Base to truck three.'], [who(b, 'Truck 3'), 'Truck three.'], [a, `When you clear that one I have another pickup, a sedan at ${randi(100, 900)} ${pick(STREETS)}, going to the shop.`], [b, 'Copy, about twenty minutes.']],
  (a, b) => [[who(a, 'Crane'), 'Coming up easy. Swing left. Hold that. Down slow, down slow.'], [who(b, 'Rigger'), 'That is good right there. Slack it off.']],
];
const STORE = [
  (a, b) => [[who(a, 'Front end'), `Front end to maintenance, cleanup needed in aisle ${randi(2, 18)}.`], [who(b, 'Maintenance'), 'On my way.']],
  (a, b) => [[who(a, 'Receiving'), `Receiving to a manager, the truck is at dock ${randi(1, 4)} and the driver needs a signature.`], [who(b, 'Manager'), 'Be right there.']],
  (a, b) => [[who(a, 'Service desk'), `Can I get a carry-out to register ${randi(1, 12)} please.`], [who(b, 'Lot'), 'Copy, heading up.']],
];
const DOT = [
  (a, b) => { const w = RW.wx || {}; return w.snow ? [[who(a, 'Plow 14'), 'Fourteen to the shop, I am about out of salt. The state route is slush covered and the ramps are getting slick.'], [who(b, 'Shop'), 'Copy fourteen, come on in and reload. I will send twenty-two up to the ramps.']] : w.storm || w.rain ? [[who(a, 'Unit 22'), 'Twenty-two to the shop, we have a tree down across the northbound lane and standing water under the overpass.'], [who(b, 'Shop'), 'Copy. Sign crew is on the way with high-water signs.']] : [[who(a, 'Unit 22'), `Twenty-two to the shop, the mowing crew is set up at mile marker ${randi(10, 180)}, right lane closed.`], [who(b, 'Shop'), 'Copy twenty-two, I will show the lane closure on the board.']]; },
  (a, b) => [[who(a, 'Unit 9'), 'Nine to the shop, that guardrail by the creek bridge is going to need a crew tomorrow.'], [who(b, 'Shop'), 'Copy nine, I will write it up.']],
];

// HF aeronautical: oceanic flights report their position by voice on single sideband, and the
// ground station tests each aircraft's SELCAL (selective calling) tones.
const NYR = { seed: 660, pitch: 0.95, call: 'New York' };
const sp = (n) => String(n).split('').join(' ');
const OCEANIC = [
  (a) => {
    const [, tel] = pick(AIRLINES), fl = `${tel} ${sp(randi(10, 990))}`, ac = who(a, fl);
    const lat = randi(38, 54), lon = pick([40, 50, 60]), m = simDate(), t = (o) => { const d = new Date(m.getTime() + o * 60000); return sp(`${String(d.getUTCHours()).padStart(2, '0')}${String(d.getUTCMinutes()).padStart(2, '0')}`); };
    const sel = pick(['A H K M', 'B D G S', 'C F J P', 'E L Q R']);
    return [[ac, `New York, New York, ${fl}, position.`], [NYR, `${fl}, New York, go ahead.`],
      [ac, `${fl}, position ${lat} north, ${sp(lon)} west at ${t(-2)}, flight level ${sp(randi(33, 40) * 10)}, estimating ${lat + 1} north, ${sp(lon - 10)} west at ${t(44)}, next ${lat + 2} north, ${sp(lon - 20)} west. Request SELCAL check, ${sel.split(' ').map((c) => ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliet', 'Kilo', 'Lima', 'Mike', 'November', 'Oscar', 'Papa', 'Quebec', 'Romeo', 'Sierra'][c.charCodeAt(0) - 65]).join(' ')}.`],
      [NYR, `${fl}, New York copies your position. Stand by for SELCAL.`], ['tone', pick([312.6, 384.6, 473.2]), 1, 'SELCAL: coded tones ring a chime in one aircraft so the crew need not listen to the static.'], ['tone', pick([582.1, 716.1, 881.0]), 1],
      [ac, `SELCAL checks, ${fl}.`]];
  },
  (a) => { const [, tel] = pick(AIRLINES), fl = `${tel} ${sp(randi(10, 990))}`, ac = who(a, fl), f = randi(33, 39) * 10; return [[ac, `New York, ${fl}, request climb flight level ${sp(f + 20)}.`], [NYR, `${fl}, New York, stand by.`], [NYR, `${fl}, New York. A T C clears ${fl} climb to and maintain flight level ${sp(f + 20)}, report reaching.`], [ac, `Climb and maintain flight level ${sp(f + 20)}, report reaching, ${fl}.`]]; },
];
// VOLMET: scheduled aviation weather for a fixed list of airports (New York: H+00 and H+30).
const VOLMET_CITIES = ['New York Kennedy', 'Newark', 'Boston', 'Baltimore', 'Philadelphia', 'Washington Dulles', 'Detroit', 'Chicago', 'Cleveland', 'Pittsburgh', 'Bangor', 'Windsor Locks', 'Charlotte', 'Atlanta'];
const volmetOn = () => simDate().getUTCMinutes() % 30 < 20;
const VOLMET = [
  () => {
    // every frequency carries the same broadcast: the report depends only on the airport and the hour
    const m = simDate(), V = { seed: 662, pitch: 0.9, call: 'VOLMET' }, hr = String(m.getUTCHours()).padStart(2, '0');
    const i = Math.floor(m.getUTCMinutes() / 4) % (VOLMET_CITIES.length - 3);
    const report = (c) => seeded(`volmet|${c}|${m.getUTCDate()}|${hr}`, () => { const t = randi(-2, 28); return `${c}, ${sp(hr)} 5 1 observation. Wind ${sp(String(randi(1, 36) * 10).padStart(3, '0'))} at ${randi(4, 18)}. Visibility ${pick(['1 0', '1 0', '6', '3'])}. ${pick(['Sky clear', 'Few clouds at 4 thousand', 'Scattered 2 thousand 5 hundred, broken 8 thousand', 'Ceiling 1 thousand 2 hundred overcast, light rain'])}. Temperature ${t}, dew point ${t - randi(1, 12)}. Altimeter ${sp(randi(2972, 3035))}.`; });
    return [[V, 'This is New York Radio. Aviation weather.'], ...VOLMET_CITIES.slice(i, i + 4).map((c) => [V, report(c)])];
  },
];

// The channel plan for your location: one table drives the receiver, the scanner panel, the
// World view and the handheld's memory channels.
export function channels() {
  const C = county(), marine = hasMarine();
  const L = [
    { region: 'SW', kind: 'pers', call: 'CB 19', name: 'CB channel 19 (highway)', f: 27185000, mode: 'AM', km: 12, scripts: CB, gap: [30, 90], powerDbm: 36, antGain: 0, svc: 'CB radio', info: 'truckers and travellers' },
    { region: 'SW', kind: 'pers', call: 'CB 9', name: 'CB channel 9 (emergency)', f: 27065000, mode: 'AM', km: 20, scripts: [(a) => [[a, 'Channel nine, this is a monitoring station. Emergency and travelers assistance only on this channel.']], (a, b) => [[a, 'Channel nine, I have a car in the ditch on county road twelve, nobody hurt, can somebody call it in?'], [b, 'Copy, I am calling the sheriff now. Stay with the vehicle.']]], gap: [120, 300], powerDbm: 36, antGain: 0, svc: 'CB radio', info: 'emergency and traveller assistance' },
    ...SVC.oceanic.map((f) => ({ region: 'SW', kind: 'util', call: 'NY OCEANIC', name: `New York Radio, oceanic air traffic ${f / 1e3} kHz`, f, mode: 'SSB', sb: 'USB', lat: 40.88, lon: -72.69, scripts: OCEANIC, gap: [15, 70], powerDbm: 63, antGain: 3, info: 'North Atlantic position reports and SELCAL checks, USB' })),
    ...SVC.volmet.map((f) => ({ region: 'SW', kind: 'util', call: 'NY VOLMET', name: `New York VOLMET ${f / 1e3} kHz`, f, mode: 'SSB', sb: 'USB', lat: 40.88, lon: -72.69, scripts: VOLMET, gap: [2, 5], powerDbm: 63, antGain: 3, when: volmetOn, info: 'aviation weather at :00–:20 and :30–:50, USB' })),
    { region: 'VHF-LO', kind: 'land', call: 'HWY MAINT', name: `${stateBy(S.op.state)?.name || 'State'} highway maintenance`, f: SVC.dot, mode: 'FM', km: 22, scripts: DOT, gap: [50, 170], powerDbm: 50, antGain: 3, txHeight: 40, info: 'road crews on VHF low band; follows your live weather' },
    { region: 'VHF', kind: 'land', call: 'FIRE', name: `${C} County Fire dispatch`, f: SVC.fire, mode: 'FM', km: 9, scripts: FIRE, gap: [45, 200], powerDbm: 50, antGain: 6, txHeight: 60, info: 'two-tone paging, then the voice dispatch' },
    { region: 'VHF', kind: 'land', call: 'RAIL', name: 'Railroad road channel (AAR 46)', f: SVC.rail, mode: 'FM', km: 14, scripts: RAIL, gap: [40, 160], powerDbm: 46, antGain: 3, txHeight: 12, info: 'crews, dispatcher and the talking defect detector' },
    { region: 'VHF', kind: 'land', call: 'BUSINESS', name: 'Business itinerant 151.625 (job sites)', f: SVC.biz, mode: 'FM', km: 5, scripts: BIZ, gap: [35, 150], powerDbm: 36, antGain: 0, txHeight: 3, info: 'construction, flaggers, towing' },
    { region: 'VHF', kind: 'pers', call: 'MURS 3', name: 'MURS channel 3 (farm/business)', f: 151940000, mode: 'FM', km: 4, scripts: MURS, gap: [60, 180], powerDbm: 33, antGain: 0, txHeight: 3, svc: 'MURS', info: 'licence-free, 2 W' },
    { region: 'VHF', kind: 'land', call: 'SHERIFF', name: `${C} County Sheriff (P25 digital)`, f: SVC.p25, mode: 'FM', km: 11, role: 'digital', digital: 'P25', gap: [8, 40], powerDbm: 50, antGain: 6, txHeight: 60, info: 'digital voice: an analog receiver hears only a buzz' },
    ...(marine ? [
      { region: 'VHF', kind: 'marine', call: 'MARINE 16', name: 'Marine channel 16 (distress and calling)', f: SVC.marine16, mode: 'FM', km: 30, scripts: MARINE16, gap: [50, 200], powerDbm: 44, antGain: 3, txHeight: 15, info: 'hail here, then move to a working channel' },
      { region: 'VHF', kind: 'marine', call: 'MARINE 22A', name: 'Marine channel 22A (Coast Guard broadcasts)', f: SVC.marine22a, mode: 'FM', km: 35, scripts: MARINE22, gap: [150, 420], powerDbm: 47, antGain: 6, txHeight: 60, info: 'safety and weather broadcasts announced on 16' },
      { region: 'VHF', kind: 'marine', call: 'MARINE 13', name: 'Marine channel 13 (bridge-to-bridge)', f: SVC.marine13, mode: 'FM', km: 18, scripts: MARINE13, gap: [70, 240], powerDbm: 30, antGain: 3, txHeight: 12, info: 'ships, tows and drawbridges arranging passage, 1 W' },
    ] : []),
    { region: 'UHF', kind: 'pers', call: 'FRS 1', name: 'FRS channel 1 (walkie-talkies)', f: 462562500, mode: 'FM', km: 1.5, scripts: FRS, gap: [40, 120], powerDbm: 33, antGain: -2, txHeight: 1.5, svc: 'FRS/GMRS', info: 'family radios, 2 W' },
    { region: 'UHF', kind: 'pers', call: 'FRS 7', name: 'FRS channel 7', f: 462712500, mode: 'FM', km: 2.5, scripts: FRS, gap: [60, 200], powerDbm: 27, antGain: -2, txHeight: 1.5, svc: 'FRS/GMRS', info: 'family radios, 0.5 W' },
    { region: 'UHF', kind: 'pers', call: 'GMRS RPT', name: 'GMRS repeater (462.675, tone 141.3)', f: 462675000, mode: 'FM', km: 15, scripts: GMRS, gap: [60, 160], powerDbm: 47, antGain: 6, txHeight: 60, svc: 'FRS/GMRS', gmrs: true, info: 'licensed family and group repeater' },
    { region: 'UHF', kind: 'land', call: 'STORE', name: 'Retail store radios (469.500)', f: SVC.bizUhf, mode: 'FM', km: 2, scripts: STORE, gap: [40, 150], powerDbm: 33, antGain: -2, txHeight: 3, info: 'on-site business handhelds' },
    { region: 'UHF', kind: 'land', call: 'DMR', name: 'Business digital (DMR) 451.800', f: SVC.dmr, mode: 'FM', km: 6, role: 'digital', digital: 'DMR', gap: [10, 50], powerDbm: 44, antGain: 3, txHeight: 30, info: 'digital voice: an analog receiver hears only a buzz' },
  ];
  return L;
}

// Where a channel's transmitter is: fixed sites as given, local ones a set distance from you.
export function channelPos(c, qth = player()) {
  if (c.lat != null) return { lat: c.lat, lon: c.lon };
  const a = (hashStr(c.call) % 360) * Math.PI / 180;
  return { lat: qth.lat + Math.cos(a) * c.km / 111, lon: qth.lon + Math.sin(a) * c.km / 85 };
}

// Stations for the general-coverage regions (called from services.stationsFor).
export function shortRangeStations(regionName, mk, qth) {
  return channels().filter((c) => c.region === regionName).map((c) => mk({
    op: { call: c.call, name: c.name, ...channelPos(c, qth), qth: c.lat != null ? 'New York' : 'local', cont: 'NA', lang: 'en-US' },
    mode: c.mode, sb: c.sb || c.mode, freq: c.f, band: regionName, role: c.role || 'chatter', timer: rand(3, 20),
    scripts: c.scripts, gap: c.gap, powerDbm: c.powerDbm, antGain: c.antGain, txHeight: c.txHeight, svc: c.svc, gmrs: c.gmrs, when: c.when, digital: c.digital,
  }));
}

export function behaveChatter(st) {
  if (st.when && !st.when()) { st.chat = []; return; }
  if (runChat(st)) return;
  st.timer -= 0.1;
  if (st.timer > 0) return;
  st.timer = rand(...(st.gap || [40, 120]));
  const a = { seed: randi(100, 900), call: st.gmrs ? gmrsCall() : '' }, b = { seed: randi(100, 900), call: st.gmrs ? gmrsCall() : '' };
  st.chat = pick(st.scripts)(a, b).map(([who, text, dur, note]) => (who === 'tone' ? { tone: text, dur, note } : { who: who.seed ? who : { seed: 400 }, text }));
}
const gmrsCall = () => `W${pick('ABCDEFGHIJKLMNOPQRSTUVWXYZ')}${pick('ABCDEFGHIJKLMNOPQRSTUVWXYZ')}${pick('ABCDEFGHIJKLMNOPQRSTUVWXYZ')}${randi(100, 999)}`;

// ------------------------------------------------------------------ digital signals
// Stepped-frequency data: `steps` is a list of [seconds, Hz offset] played by audio.fsk().
// Digital voice (P25, DMR): through an analog FM receiver it is only a harsh buzz.
export function behaveDigital(st) {
  if (st.busy) return;
  st.timer -= 0.1;
  if (st.timer > 0) return;
  st.timer = rand(...st.gap);
  const dur = rand(2, 7), dmr = st.digital === 'DMR', steps = [];
  for (let t = 0; t < dur; t += dmr ? 0.03 : 0.02) steps.push([t, dmr ? pick([0, 33, 66]) : rand(-70, 70)]);
  st.tx = { kind: 'fmtone', tone: dmr ? 66 : 190, wave: dmr ? 'sawtooth' : 'square', steps, text: '', show: '', start: now(), end: now() + dur,
    note: `${st.digital} digital voice. An analog FM receiver hears only this buzz; it takes a ${st.digital} radio or decoder software to recover speech, and encrypted traffic cannot be recovered at all.` };
  bus.emit('station-tx', st);
}

// APRS on 144.390 MHz: 1200-baud AFSK packets (1200/2200 Hz) carrying positions and messages.
export function aprsStation(locals, near) {
  return new Station({ op: { call: 'APRS', name: 'APRS packets', ...near(6), cont: 'NA', zone: 4, qth: 'local', lang: 'en-US' },
    mode: 'FM', sb: 'FM', freq: SVC.aprs, band: '2m', role: 'aprs', powerDbm: 47, antGain: 3, timer: rand(3, 12), locals });
}
export function behaveAprs(st) {
  if (st.busy) return;
  st.timer -= 0.1;
  if (st.timer > 0) return;
  st.timer = rand(6, 28);
  const dur = rand(0.45, 0.9), steps = [];
  let hi = false;
  for (let t = 0; t < dur; t += 1 / 1200) { if (t < 0.15 ? Math.round(t * 1200) % 8 === 7 : chance(0.5)) { hi = !hi; steps.push([t, hi ? 1000 : 0]); } }
  const p = player(), l = pick(st.locals || [{ call: 'N0CALL' }]);
  const dm = (v, w, pos, neg) => { const a = Math.abs(v), d = Math.floor(a); return `${String(d).padStart(w, '0')}${((a - d) * 60).toFixed(2).padStart(5, '0')}${v >= 0 ? pos : neg}`; };
  const lat = p.lat + rand(-0.3, 0.3), lon = p.lon + rand(-0.3, 0.3);
  const pkt = pick([
    `${l.call}-9>APRS,WIDE1-1,WIDE2-1:!${dm(lat, 2, 'N', 'S')}/${dm(lon, 3, 'E', 'W')}>${String(randi(0, 359)).padStart(3, '0')}/${String(randi(0, 65)).padStart(3, '0')} mobile`,
    `${l.call}>APRS,WIDE2-1:!${dm(lat, 2, 'N', 'S')}/${dm(lon, 3, 'E', 'W')}-home station`,
    `${l.call}-13>APRS:!${dm(lat, 2, 'N', 'S')}/${dm(lon, 3, 'E', 'W')}_${String(randi(0, 359)).padStart(3, '0')}/${String(randi(0, 20)).padStart(3, '0')}g${String(randi(0, 30)).padStart(3, '0')}t${String(Math.round(RW.wx?.tempF ?? randi(30, 90))).padStart(3, '0')} weather station`,
  ]);
  st.tx = { kind: 'fmtone', tone: 1200, steps, text: '', show: pkt, start: now(), end: now() + dur, note: `APRS packet: ${pkt}` };
  bus.emit('station-tx', st);
}

// FT8: the busiest mode on HF. Every station sends in alternating 15-second slots locked to
// UTC: 79 symbols of 8-tone FSK, 6.25 Hz apart, 12.64 s long, in a 3 kHz window per band.
export const FT8_FREQ = { '160m': 1840000, '80m': 3573000, '40m': 7074000, '30m': 10136000, '20m': 14074000, '17m': 18100000, '15m': 21074000, '12m': 24915000, '10m': 28074000, '6m': 50313000 };
const FT8_N = { '160m': 4, '80m': 7, '40m': 10, '30m': 6, '20m': 12, '17m': 6, '15m': 8, '12m': 4, '10m': 7, '6m': 3 };
export function ft8Stations(band) {
  const base = FT8_FREQ[band.name], out = [];
  if (!base) return out;
  for (let i = 0; i < FT8_N[band.name]; i++) {
    const op = randomOp({ usWeight: 0.45 });
    out.push(new Station({ op, mode: 'FT8', sb: 'USB', freq: base + randi(250, 2600), band: band.name, role: 'ft8', parity: randi(0, 1), seq: randi(0, 3),
      powerDbm: pick([40, 44, 47, 47, 50]), antGain: randi(0, 5), grid4: grid(op.lat, op.lon).slice(0, 4) }));
  }
  return out;
}
export function behaveFt8(st) {
  const ms = simDate().getTime(), slot = Math.floor(ms / 15000), into = (ms % 15000) / 1000;
  if (st.lastSlot === slot || into > 1.2) return;
  st.lastSlot = slot;
  if (slot % 2 !== st.parity) return;
  if (st.rest > 0) { st.rest--; return; }
  if (st.seq === 0 && chance(0.25)) { st.dx = randomOp({ usWeight: 0.45 }).call; st.seq = 1; }
  if (st.seq && !st.dx) st.dx = randomOp({ usWeight: 0.45 }).call;
  const c = st.call, rpt = `${pick(['-', '-', '-', '+'])}${String(randi(1, 21)).padStart(2, '0')}`;
  const msg = st.seq === 0 ? `CQ ${st.op.cont !== 'NA' && chance(0.2) ? 'DX ' : ''}${c} ${st.grid4}` : st.seq === 1 ? `${st.dx} ${c} ${rpt}` : st.seq === 2 ? `${st.dx} ${c} RR73` : `${st.dx} ${c} 73`;
  if (st.seq) { st.seq = (st.seq + 1) % 4; if (!st.seq && chance(0.3)) st.rest = randi(2, 8); }
  const steps = [];
  for (let i = 0; i < 79; i++) steps.push([i * 0.16, randi(0, 7) * 6.25]);
  const start = now() + Math.max(0, 0.5 - into);
  st.tx = { kind: 'data', steps, text: msg, show: msg, start, end: start + 12.64 };
  bus.emit('station-tx', st);
}
