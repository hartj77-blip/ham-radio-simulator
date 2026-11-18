// Non-ham services on a general-coverage receiver: NOAA Weather Radio (real NWS forecasts),
// airband (real airports & frequencies, ATIS from real observations, simulated traffic), HEAR
// ambulance channel, WWV/WWVH, the land-mobile, marine and HF utility channels in activity.js,
// and a handful of the strongest local AM/FM broadcast stations (real stations, live audio).
import { S } from './state.js';
import { h, bus, rand, randi, pick, chance, hashStr, now, clamp } from './util.js';
import { RW, TIME_STATIONS, WX_CHANNELS, HEAR, AIRLINES, wantBroadcast, wantAirports } from './realworld.js';
import { Station, phone, player } from './world.js';
import { stateBy } from './data/world.js';
import { simDate, distanceKm, path as propPath, bandNoiseDbm, sUnits } from './propagation.js';
import { schedule } from './morse.js';
import { bandOf } from './data/bandplan.js';
import { helperStations, behaveHelper } from './helpers.js';
import { shortRangeStations, behaveChatter, behaveDigital, behaveAprs, behaveFt8, channels, channelPos, hasMarine, SVC } from './activity.js';

export const SERVICE_REGIONS = [
  { name: 'MW', label: 'AM broadcast', lo: 520e3, hi: 1710e3, mode: 'AM', step: 10e3, span: 150e3, def: 1000e3 },
  { name: 'SW', label: 'Shortwave', lo: 1.71e6, hi: 30e6, mode: 'AM', step: 5e3, span: 24e3, def: 10e6 },
  { name: 'VHF-LO', label: 'VHF low', lo: 30e6, hi: 87.5e6, mode: 'FM', step: 5e3, span: 200e3, def: 47.26e6 },
  { name: 'FM', label: 'FM broadcast', lo: 87.5e6, hi: 108e6, mode: 'WFM', step: 100e3, span: 2.4e6, def: 98.1e6 },
  { name: 'AIR', label: 'Airband', lo: 108e6, hi: 137e6, mode: 'AM', step: 25e3, span: 500e3, def: 121.5e6 },
  { name: 'VHF', label: 'VHF high', lo: 137e6, hi: 225e6, mode: 'FM', step: 5e3, span: 400e3, def: 154.19e6 },
  { name: 'UHF', label: 'UHF', lo: 225e6, hi: 470e6, mode: 'FM', step: 12.5e3, span: 400e3, def: 462.5625e6 },
];
export const serviceOf = (hz) => (bandOf(hz) ? null : SERVICE_REGIONS.find((r) => hz >= r.lo && hz < r.hi) || null);

const sayNum = (n) => String(n).split('').map((d) => ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'niner'][+d] ?? d).join(' ');
const pair = (n) => { const s = String(n); if (s.length === 4 && !/^0/.test(s.slice(2))) return `${+s.slice(0, 2)} ${+s.slice(2)}`; if (s.length === 3) return `${s[0]} ${+s.slice(1)}`; return s.split('').join(' '); };
const ALPHA = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliet', 'Kilo', 'Lima', 'Mike', 'November', 'Oscar', 'Papa', 'Quebec', 'Romeo', 'Sierra', 'Tango', 'Uniform', 'Victor', 'Whiskey', 'X-ray', 'Yankee', 'Zulu'];
const near = (p, km, seed) => { const a = (seed % 360) * Math.PI / 180; return { lat: p.lat + Math.cos(a) * km / 111, lon: p.lon + Math.sin(a) * km / 85 }; };

function mk(o) {
  const st = new Station({ powerDbm: 50, antGain: 3, wpm: 20, ...o });
  st.qsb.depth = o.mode === 'WFM' || o.mode === 'FM' ? 1 : st.qsb.depth;
  return st;
}

// ------------------------------------------------------------------ build a region's stations
export function stationsFor(region) {
  const out = [];
  const qth = player();
  if (region.name === 'MW' || region.name === 'FM') {
    wantBroadcast();
    for (const b of RW.broadcast.filter((x) => (region.name === 'MW' ? x.mode === 'AM' : x.mode === 'WFM'))) {
      const strong = b.call && b.call.length === 3; // old 3-letter calls are mostly 50 kW clear-channel stations
      const lp = /-LP\b|\bLPFM\b/i.test(b.name); // low-power FM: ~100 W ERP, short tower
      const st = mk({
        op: { call: b.call || b.name.split(/\s+/)[0].toUpperCase(), name: b.name, lat: b.lat, lon: b.lon, qth: b.state, cont: 'NA', lang: 'en-US' },
        mode: b.mode, sb: b.mode, freq: b.f, band: region.name, role: 'bcast', url: b.url, info: b,
        powerDbm: b.mode === 'AM' ? (strong ? 77 : 67) : lp ? 50 : 77, antGain: b.mode === 'AM' ? 0 : 3, txHeight: b.mode === 'AM' ? 0 : lp ? 30 : 250,
      });
      st.tx = { kind: 'stream', start: now() - 1, end: Infinity, show: b.name };
      out.push(st);
    }
  }
  if (region.name === 'SW') {
    for (const t of TIME_STATIONS) {
      const op = { call: t.call, name: `${t.call} (NIST)`, lat: t.lat, lon: t.lon, qth: t.call === 'WWV' ? 'Fort Collins, CO' : 'Kauai, HI', cont: t.call === 'WWV' ? 'NA' : 'OC', lang: 'en-US' };
      const pw = 10 * Math.log10(t.kw * 1e6);
      out.push(mk({ op, mode: 'AM', sb: 'AM', freq: t.f, band: 'SW', role: 'time', voice: t.voice, powerDbm: pw, antGain: 2 }));
      out.push(mk({ op, mode: 'AM', sb: 'AM', freq: t.f, band: 'SW', role: 'timevoice', voice: t.voice, powerDbm: pw - 3, antGain: 2, seed: t.voice === 'male' ? 11 : 12, pitch: t.voice === 'male' ? 0.8 : 1.3 }));
    }
  }
  if (region.name === 'VHF') {
    // NOAA Weather Radio — one transmitter for your NWS office
    const office = RW.nws?.office || 'NWS';
    const ch = WX_CHANNELS[hashStr(office) % WX_CHANNELS.length];
    const tx = near(qth, 25, hashStr(office));
    out.push(mk({ op: { call: `NOAA ${office}`, name: `NOAA Weather Radio (${office})`, ...tx, qth: RW.nws?.city || 'local', cont: 'NA', lang: 'en-US' }, mode: 'FM', sb: 'FM', freq: ch, band: 'VHF', role: 'wx', powerDbm: 60, antGain: 6, txHeight: 200, seed: 21, rate: 0.95, pitch: 0.9 }));
    // HEAR: ambulances talking to the hospital
    const city = RW.nws?.city || stateBy(S.op.state)?.name || 'County';
    out.push(mk({ op: { call: 'HEAR', name: `${city} EMS / hospitals (HEAR)`, ...near(qth, 8, 77), qth: city, cont: 'NA', lang: 'en-US' }, mode: 'FM', sb: 'FM', freq: HEAR, band: 'VHF', role: 'ems', powerDbm: 47, antGain: 3, txHeight: 40, timer: rand(5, 25), city }));
  }
  if (region.name === 'AIR') {
    wantAirports();
    for (const ap of RW.airports) {
      for (const fr of ap.freqs) {
        const kind = /ATIS|AWOS|ASOS/i.test(fr.type) ? 'atis' : /TWR|TOWER/i.test(fr.type) ? 'twr' : /GND|GROUND/i.test(fr.type) ? 'gnd' : /APP|DEP|A\/D|TRACON/i.test(fr.type + fr.desc) ? 'app' : /CTAF|UNIC/i.test(fr.type) ? 'ctaf' : null;
        if (!kind) continue;
        out.push(mk({
          op: { call: ap.ident, name: `${ap.name} ${fr.type}`, lat: ap.lat, lon: ap.lon, qth: ap.city, cont: 'NA', lang: 'en-US' },
          mode: 'AM', sb: 'AM', freq: Math.round(fr.mhz * 1e6), band: 'AIR', role: kind === 'atis' ? 'atis' : 'atc', atc: kind, ap, desc: fr.desc,
          powerDbm: kind === 'atis' ? 44 : 47, antGain: 3, timer: rand(3, 20), txHeight: kind === 'app' ? 3000 : kind === 'atis' ? 30 : 600, // tower/ATIS on the field; approach traffic is airborne seed: 40 + (hashStr(ap.ident + kind) % 30),
        }));
      }
    }
    // 121.5 guard: occasional ELT test or pilot calling guard
    out.push(mk({ op: { call: 'GUARD', name: 'Emergency/guard 121.5', lat: qth.lat + 1, lon: qth.lon, qth: 'airborne', cont: 'NA', lang: 'en-US' }, mode: 'AM', sb: 'AM', freq: 121.5e6, band: 'AIR', role: 'atc', atc: 'guard', powerDbm: 44, antGain: 0, txHeight: 9000, timer: rand(60, 200) }));
  }
  out.push(...shortRangeStations(region.name, mk, qth));
  out.push(...helperStations(region.name, mk, near(qth, 6, 45)));
  return out;
}

// ------------------------------------------------------------------ behaviours
const busyOrWait = (st) => st.busy || (st.queue && st.queue.length);
function say(st, tpl, who) {
  const p = phone(tpl);
  if (who) st.speaker = who; else st.speaker = null;
  st.send(p.show, p.say);
}

export function serviceBehave(st, t) {
  switch (st.role) {
    case 'time': return timeTicks(st);
    case 'timevoice': return timeVoice(st);
    case 'wx': return wxRadio(st);
    case 'atis': return atis(st);
    case 'atc': return atcTraffic(st);
    case 'ems': return ems(st);
    case 'chatter': return behaveChatter(st);
    case 'digital': return behaveDigital(st);
    case 'aprs': return behaveAprs(st);
    case 'ft8': return behaveFt8(st);
    case 'helper': return behaveHelper(st);
  }
}

// WWV/WWVH: 5 ms 1000 Hz (WWV) / 1200 Hz (WWVH) ticks each second; 29 & 59 omitted;
// 800 ms tone at the top of the minute.
function timeTicks(st) {
  const d = simDate();
  const minute = Math.floor(d.getTime() / 60000);
  if (st.lastMin === minute) return;
  st.lastMin = minute;
  const into = (d.getTime() % 60000) / 1000;
  const segs = [];
  for (let s = Math.ceil(into); s < 60; s++) {
    if (s === 29 || s === 59) continue;
    const t0 = s - into;
    segs.push({ t0, t1: t0 + (s === 0 ? 0.8 : 0.005), amp: 1 });
  }
  const tone = st.op.call === 'WWV' ? 1000 : 1200;
  st.tx = { kind: 'amtone', tone, text: '', show: '', start: now(), end: now() + (60 - into), sch: { segs, chars: [], dur: 60 - into } };
  bus.emit('station-tx', st);
}
function timeVoice(st) {
  const d = simDate();
  const sec = (d.getTime() % 60000) / 1000;
  const at = st.voice === 'male' ? 52.5 : 45;
  const minute = Math.floor(d.getTime() / 60000);
  if (st.lastMin === minute || sec < at - 3.2 || sec > at) return;
  st.lastMin = minute;
  const nd = new Date(d.getTime() + 60000);
  const hh = nd.getUTCHours(), mm = nd.getUTCMinutes();
  const txt = `At the tone, ${hh} ${hh === 1 ? 'hour' : 'hours'}, ${mm} ${mm === 1 ? 'minute' : 'minutes'} Coordinated Universal Time.`;
  st.send(`${st.op.call}: ${txt}`, txt);
}

// NOAA Weather Radio: real NWS observations, forecast and alerts, read by a synthetic voice.
function wxScript() {
  const n = RW.nws, w = RW.wx;
  const lines = [];
  if (RW.alerts.length) for (const a of RW.alerts) lines.push({ alert: true }, `The National Weather Service has issued a ${a.event}. ${a.headline || ''}`);
  lines.push(`This is NOAA Weather Radio${n ? `, from the National Weather Service office serving ${n.city || 'your area'}` : ''}. The time is ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: n?.tz || undefined })}.`);
  if (w) lines.push(`Current conditions${w.station ? ` at ${w.station}` : ''}: ${w.desc || 'not available'}. The temperature was ${w.tempF ?? 'missing'} degrees${w.dewF != null ? `, dew point ${w.dewF}` : ''}.${w.windKt != null ? ` Winds ${w.windKt < 3 ? 'calm' : `from ${compass(w.windDir)} at ${Math.round(w.windKt * 1.15)} miles per hour`}.` : ''}${w.altim ? ` The pressure was ${w.altim} inches.` : ''}`);
  for (const p of (n?.periods || []).slice(0, 3)) lines.push(`${p.name}: ${p.text}`);
  if (!n && !w) lines.push('Weather information is temporarily unavailable. Please stand by.');
  return lines;
}
const compass = (d) => (d == null ? 'variable' : ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'][Math.round(d / 45) % 8]);
function wxRadio(st) {
  if (busyOrWait(st)) return;
  if (!st.script || !st.script.length) { st.script = wxScript(); st.pause = now() + 2; }
  if (now() < (st.pause || 0)) return;
  const line = st.script.shift();
  if (line.alert) {
    // 1050 Hz Warning Alarm Tone (8 s in this sim)
    st.tx = { kind: 'fmtone', tone: 1050, text: '', show: '1050 Hz NWR alert tone', start: now(), end: now() + 8, sch: { segs: [{ t0: 0, t1: 8, amp: 1 }], chars: [], dur: 8 } };
    bus.emit('station-tx', st);
    return;
  }
  st.send(line, line);
  st.pause = now() + 0.6;
}

function atis(st) {
  if (busyOrWait(st)) return;
  if (now() < (st.pause || 0)) return;
  const w = RW.wx || {};
  const ap = st.ap;
  const d = simDate();
  const letter = ALPHA[(d.getUTCHours() + hashStr(ap.ident)) % 26];
  const wd = w.windDir != null ? String(Math.round(w.windDir / 10) * 10).padStart(3, '0') : '360';
  const rwy = String(Math.round(((w.windDir ?? 360) || 360) / 10) || 36).padStart(2, '0');
  const tC = w.tempF != null ? Math.round((w.tempF - 32) * 5 / 9) : 15, dC = w.dewF != null ? Math.round((w.dewF - 32) * 5 / 9) : 8;
  const sky = w.cloud > 0.8 ? 'ceiling 3 thousand overcast' : w.cloud > 0.4 ? 'few clouds at 5 thousand' : 'sky clear';
  const vis = w.fog ? '3' : w.rain || w.snow ? '7' : '10';
  const txt = `${ap.name.replace(/International|Regional|Municipal|Airport/gi, '').trim()} information ${letter}. ${String(d.getUTCHours()).padStart(2, '0')}53 Zulu. Wind ${(w.windKt ?? 0) < 3 ? 'calm' : `${sayNum(wd)} at ${w.windKt}`}. Visibility ${vis}. ${w.storm ? 'Thunderstorm. ' : w.snow ? 'Light snow. ' : w.rain ? 'Light rain. ' : ''}${sky}. Temperature ${tC}, dewpoint ${dC}. Altimeter ${w.altim ? sayNum(String(w.altim).replace('.', '')) : 'two niner niner two'}. Landing and departing runway ${sayNum(rwy)}. Advise on initial contact you have information ${letter}.`;
  st.send(`${ap.ident} ATIS: ${txt}`, txt);
  st.pause = now() + 2;
}

function callsign() {
  if (chance(0.25)) { const n = `${randi(1, 9)}${randi(0, 9)}${randi(0, 9)}${pick('ABCDEFGHJKLMNPRSTUVWXYZ')}${pick('ABCDEFGHJKLMNPRSTUVWXYZ')}`; return { show: `N${n}`, say: `${pick(['Cessna', 'Skyhawk', 'Cherokee', 'Bonanza'])} ${n.split('').map((c) => (/\d/.test(c) ? sayNum(c) : ALPHA[c.charCodeAt(0) - 65])).join(' ')}`, ga: true }; }
  const [code, name] = pick(AIRLINES); const num = randi(10, 2999);
  return { show: `${code}${num}`, say: `${name} ${pair(num)}`, ga: false };
}

function atcTraffic(st) {
  if (busyOrWait(st)) return;
  if (st.chat && st.chat.length) {
    if (now() < (st.chatGap || 0)) return;
    const l = st.chat.shift();
    st.seed = l.who === 'ctl' ? st.ctlSeed ||= 40 + randi(0, 20) : 60 + randi(0, 30);
    st.pitch = l.who === 'ctl' ? 0.95 : rand(0.8, 1.2);
    st.rate = 1.15;
    st.send(l.show, l.say);
    st.chatGap = now() + rand(0.4, 1.4);
    return;
  }
  st.timer -= 0.1;
  if (st.timer > 0) return;
  st.timer = st.atc === 'guard' ? rand(120, 400) : rand(6, 30);
  const w = RW.wx || {};
  const rwy = String(Math.round(((w.windDir ?? 360) || 360) / 10) || 36).padStart(2, '0');
  const windTxt = (w.windKt ?? 0) < 3 ? 'wind calm' : `wind ${sayNum(String(Math.round((w.windDir || 0) / 10) * 10).padStart(3, '0'))} at ${w.windKt}`;
  const cs = callsign();
  const fac = st.ap ? `${st.ap.city || st.ap.name.split(' ')[0]}` : '';
  const L = (who, show, sayT) => ({ who, show: `${who === 'ctl' ? (st.atc === 'twr' ? 'TWR' : st.atc === 'gnd' ? 'GND' : st.atc === 'app' ? 'APP' : 'CTL') : cs.show}: ${show}`, say: sayT || show });
  const alt = randi(4, 16) * 1000;
  const hdg = String(randi(1, 36) * 10).padStart(3, '0');
  let chat = [];
  switch (st.atc) {
    case 'twr':
      chat = pick([
        [L('ac', `${fac} tower, ${cs.show}, ten miles out, inbound for landing.`, `${fac} tower, ${cs.say}, ten miles out, inbound for landing.`), L('ctl', `${cs.show}, ${fac} tower, runway ${rwy}, ${windTxt}, cleared to land.`, `${cs.say}, ${fac} tower, runway ${sayNum(rwy)}, ${windTxt}, cleared to land.`), L('ac', `Cleared to land ${rwy}, ${cs.show}.`, `Cleared to land ${sayNum(rwy)}, ${cs.say}.`)],
        [L('ctl', `${cs.show}, runway ${rwy}, ${windTxt}, cleared for takeoff, fly heading ${hdg}.`, `${cs.say}, runway ${sayNum(rwy)}, ${windTxt}, cleared for takeoff, fly heading ${sayNum(hdg)}.`), L('ac', `Cleared for takeoff ${rwy}, heading ${hdg}, ${cs.show}.`, `Cleared for takeoff ${sayNum(rwy)}, heading ${sayNum(hdg)}, ${cs.say}.`)],
        [L('ctl', `${cs.show}, contact departure. Good day.`, `${cs.say}, contact departure. Good day.`), L('ac', `Over to departure, ${cs.show}, good day.`, `Over to departure, ${cs.say}, good day.`)],
      ]);
      break;
    case 'gnd':
      chat = [L('ac', `${fac} ground, ${cs.show}, at the terminal, ready to taxi.`, `${fac} ground, ${cs.say}, at the terminal, ready to taxi.`), L('ctl', `${cs.show}, runway ${rwy}, taxi via Alpha, hold short of runway ${rwy}.`, `${cs.say}, runway ${sayNum(rwy)}, taxi via Alpha, hold short of runway ${sayNum(rwy)}.`), L('ac', `Runway ${rwy} via Alpha, hold short, ${cs.show}.`, `Runway ${sayNum(rwy)} via Alpha, hold short, ${cs.say}.`)];
      break;
    case 'app':
      chat = pick([
        [L('ac', `${fac} approach, ${cs.show}, descending through ${alt + 4000} for ${alt}.`, `${fac} approach, ${cs.say}, descending through ${alt + 4000} for ${alt}.`), L('ctl', `${cs.show}, ${fac} approach, altimeter ${w.altim || '29.92'}, expect vectors for runway ${rwy}.`, `${cs.say}, ${fac} approach, altimeter ${sayNum(String(w.altim || '29.92').replace('.', ''))}, expect vectors for runway ${sayNum(rwy)}.`), L('ac', `Expect ${rwy}, ${cs.show}.`, `Expect ${sayNum(rwy)}, ${cs.say}.`)],
        [L('ctl', `${cs.show}, turn left heading ${hdg}, descend and maintain ${alt}.`, `${cs.say}, turn left heading ${sayNum(hdg)}, descend and maintain ${alt}.`), L('ac', `Left ${hdg}, down to ${alt}, ${cs.show}.`, `Left ${sayNum(hdg)}, down to ${alt}, ${cs.say}.`)],
      ]);
      break;
    case 'ctaf':
      chat = [L('ac', `${st.ap.name.split(' ')[0]} traffic, ${cs.show}, left downwind runway ${rwy}, ${st.ap.name.split(' ')[0]}.`, `${st.ap.name.split(' ')[0]} traffic, ${cs.say}, left downwind runway ${sayNum(rwy)}, ${st.ap.name.split(' ')[0]}.`)];
      break;
    default:
      chat = [L('ac', `Attention all aircraft, you're on guard. Guard, guard.`)];
  }
  st.chat = chat;
}

function ems(st) {
  if (busyOrWait(st)) return;
  if (st.chat && st.chat.length) {
    if (now() < (st.chatGap || 0)) return;
    const l = st.chat.shift();
    st.seed = l.seed; st.pitch = l.pitch; st.rate = 1.1;
    st.send(l.text, l.text);
    st.chatGap = now() + rand(0.8, 2);
    return;
  }
  st.timer -= 0.1;
  if (st.timer > 0) return;
  st.timer = rand(90, 300);
  const unit = `Medic ${randi(1, 12)}`;
  const hosp = `${st.city} ${pick(['Regional', 'Memorial', 'General', "St. Mary's"])}`;
  const age = randi(18, 92), sex = pick(['male', 'female']);
  const c = pick(['chest pain, onset about thirty minutes ago', 'a fall with a possible hip fracture', 'shortness of breath, history of COPD', 'a motor vehicle collision, ambulatory on scene, neck pain', 'altered mental status, blood sugar 48, improving with D10', 'abdominal pain, nausea and vomiting']);
  const eta = randi(4, 22), A = { seed: 81, pitch: 1.0 }, H = { seed: 82, pitch: 1.2 };
  st.chat = [
    { ...A, text: `${hosp}, ${unit}.` },
    { ...H, text: `${unit}, ${hosp}, go ahead.` },
    { ...A, text: `${hosp}, we're en route to your facility with a ${age} year old ${sex}, ${c}. Vitals: blood pressure ${randi(100, 170)} over ${randi(60, 100)}, pulse ${randi(60, 120)}, respirations ${randi(14, 24)}, sat ${randi(91, 99)} percent on ${pick(['room air', 'two liters'])}. ETA ${eta} minutes. Any questions?` },
    { ...H, text: `Copy, ${unit}. No questions. ${pick(['Room 4', 'Trauma 1', 'Room 12', 'triage'])} on arrival.` },
  ];
}

// ------------------------------------------------------------------ "What's on the air near me" panel
let root;
export function initScannerUI(el) {
  root = el;
  render();
  bus.on('realworld', render);
  bus.on('realworld-status', render);
  bus.on('band', render);
}

function est(lat, lon, f, pdbm, gain = 0, alt = 0) {
  const me = player();
  const p = alt && f >= 30e6 ? (() => { const d = Math.max(0.5, distanceKm({ lat, lon }, me)); const hz = 4.12 * (Math.sqrt(alt) + Math.sqrt(10)); const bey = Math.max(0, d - hz); return { loss: 32.45 + 20 * Math.log10(d) + 20 * Math.log10(f / 1e6) + 6 + bey * (0.22 + 0.0012 * f / 1e6) + (bey > 0 ? 8 : 0) }; })() : propPath({ lat, lon }, me, f / 1e6);
  const loss = p.loss;
  const dbm = pdbm + gain - loss - 5;
  const s = sUnits(Math.max(dbm, bandNoiseDbm(f / 1e6, me)));
  return { dbm, s: dbm < bandNoiseDbm(f / 1e6, me) ? '—' : s.text, km: distanceKm(me, { lat, lon }) };
}

function render() {
  if (!root) return;
  root.innerHTML = '';
  const tune = (f, m) => h('button', { class: 'btn small', onclick: () => bus.emit('tune-to', f, m) }, 'Tune');
  const row = (name, f, mode, info, e) => h('tr', {}, h('td', {}, name), h('td', { class: 'mono' }, f >= 30e6 ? (f / 1e6).toFixed(3) : `${(f / 1e3).toFixed(f < 2e6 ? 0 : 1)} kHz`), h('td', {}, mode), h('td', { class: 'small muted' }, info), h('td', { class: e && e.s !== '—' ? 'ok' : 'muted' }, e ? e.s : ''), h('td', {}, tune(f, mode)));
  const st = RW.status;
  const wx = RW.wx;
  const chRow = (c) => { const p = channelPos(c); return row(c.name, c.f, c.mode === 'SSB' ? c.sb : c.mode, c.info, est(p.lat, p.lon, c.f, c.powerDbm, c.antGain, c.txHeight || 0)); };
  const tabs = [
    ['Land mobile & marine', () => [
      ...channels().filter((c) => c.kind === 'land' || c.kind === 'marine').map(chRow),
      row('HEAR — ambulance ↔ hospital', HEAR, 'FM', 'nationwide hospital channel', null),
      ...channels().filter((c) => c.kind === 'pers').map(chRow),
    ]],
    ['Weather & emergency', () => {
      const office = RW.nws?.office || 'NWS';
      return [
        row(`NOAA Weather Radio (${office})`, WX_CHANNELS[hashStr(office) % 7], 'FM', 'real NWS forecast & alerts (channel approximate)', null),
        row('HEAR — ambulance ↔ hospital', HEAR, 'FM', 'nationwide hospital channel (traffic simulated)', null),
        row('Aviation emergency (guard)', 121.5e6, 'AM', 'monitored by all aircraft', null),
        ...(hasMarine() ? [row('Marine channel 16', SVC.marine16, 'FM', 'distress, safety and calling', null)] : []),
        row('CB channel 9', 27065000, 'AM', 'emergency and traveller assistance', null),
      ];
    }],
    ['Airband', () => {
      const rows = [];
      for (const a of RW.airports) for (const fr of a.freqs.filter((x) => /ATIS|TWR|GND|APP|DEP|CTAF|UNIC/i.test(x.type)).slice(0, 5)) rows.push(row(`${a.ident} ${fr.type}`, Math.round(fr.mhz * 1e6), 'AM', `${a.name}${fr.desc ? ' · ' + fr.desc : ''} · ${Math.round(a.d)} km`, null));
      return rows.length ? rows : [h('tr', {}, h('td', { colspan: 6, class: 'muted small' }, st.airports || 'Tune to the airband (108–137 MHz) to load real airports & frequencies near you.'))];
    }],
    ['HF utility', () => [
      ...channels().filter((c) => c.kind === 'util').map(chRow),
      ...TIME_STATIONS.map((t) => row(`${t.call} ${t.f / 1e6} MHz`, t.f, 'AM', `${t.call === 'WWV' ? 'Fort Collins, CO' : 'Kauai, HI'} · ${t.kw} kW`, est(t.lat, t.lon, t.f, 10 * Math.log10(t.kw * 1e6), 2))),
    ]],
    ['Broadcast', () => {
      const list = RW.broadcast.map((b) => { const lp = /-LP\b|\bLPFM\b/i.test(b.name); return { b, e: est(b.lat, b.lon, b.f, b.mode === 'AM' ? (b.call && b.call.length === 3 ? 77 : 67) : lp ? 50 : 77, b.mode === 'AM' ? 0 : 3, b.mode === 'AM' ? 0 : lp ? 30 : 250) }; }).sort((x, y) => y.e.dbm - x.e.dbm);
      return list.length ? list.map(({ b, e }) => row(b.name, b.f, b.mode === 'WFM' ? 'WFM' : 'AM', `${b.state} · ${Math.round(e.km)} km`, e))
        : [h('tr', {}, h('td', { colspan: 6, class: 'muted small' }, st.broadcast || 'Loading the few nearest AM and FM stations…'))];
    }],
  ];
  if (!(S.scanTab < tabs.length)) S.scanTab = 0;
  S.scanTab ??= 0;
  const body = h('table', { class: 'tbl small scan-tbl' }, h('tr', {}, ...['Station', 'Freq', 'Mode', 'Info', 'Est.', ''].map((x) => h('th', {}, x))), ...tabs[S.scanTab][1]());
  root.append(h('div', { class: 'card scanner' },
    h('div', { class: 'row spread' }, h('h3', {}, 'What\'s on the air near you'),
      h('div', { class: 'row' }, ...tabs.map(([n], i) => h('button', { class: `rbtn ${S.scanTab === i ? 'active' : ''}`, onclick: () => { S.scanTab = i; if (n === 'Broadcast') wantBroadcast(); if (n === 'Airband') wantAirports(); render(); } }, n)))),
    h('div', { class: 'small muted' }, `Real data: space weather ${RW.sun ? `✓ NOAA SWPC (SFI ${RW.sun.sfi}, Kp ${RW.sun.k})` : st.sun || '…'} · weather ${wx ? `✓ ${wx.source}${wx.station ? ' ' + wx.station : ''}: ${wx.desc}, ${wx.tempF}°F` : st.wx || '…'} · broadcast ${st.broadcast || 'not loaded'} · airports ${st.airports || 'not loaded'}`),
    body));
}
