// The real world around the radio: live space weather, live local weather, real broadcast
// stations (with live audio streams), NOAA Weather Radio built from real NWS forecasts,
// real airports & their published frequencies, WWV/WWVH time stations, and EMS traffic.
// Everything is fetched from free, keyless, CORS-enabled public sources and cached.
import { S, save } from './state.js';
import { bus, rand, randi, pick, seeded, chance } from './util.js';
import { stateBy, STATES } from './data/world.js';
import { SUN, distanceKm, simDate } from './propagation.js';

const RB = 'https://de1.api.radio-browser.info/json';
const NWS = 'https://api.weather.gov';
const SWPC = 'https://services.swpc.noaa.gov';
const OA = 'https://raw.githubusercontent.com/davidmegginson/ourairports-data/main';

export const RW = {
  sun: null, wx: null, nws: null, alerts: [], broadcast: [], airports: [], status: {},
};

const me = () => stateBy(S.op.state) || stateBy('KS');
const cacheGet = (k, maxAgeMs) => { try { const v = JSON.parse(localStorage.getItem(`rw:${k}`)); if (v && Date.now() - v.t < maxAgeMs) return v.d; } catch (e) { } return null; };
const cacheSet = (k, d) => { try { localStorage.setItem(`rw:${k}`, JSON.stringify({ t: Date.now(), d })); } catch (e) { } };
async function getJSON(url, opt = {}) {
  const r = await fetch(url, { headers: { Accept: 'application/json, application/geo+json', ...(opt.headers || {}) } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}
const setStatus = (k, v) => { RW.status[k] = v; bus.emit('realworld-status', k, v); };

// ------------------------------------------------------------------ space weather (NOAA SWPC)
export async function loadSpaceWeather() {
  try {
    const flux = await getJSON(`${SWPC}/json/f107_cm_flux.json`);
    const kp = await getJSON(`${SWPC}/products/noaa-planetary-k-index.json`);
    const f = flux.find((x) => x.flux) || flux[0];
    const last = Array.isArray(kp[0]) ? kp[kp.length - 1] : kp[kp.length - 1];
    const K = Array.isArray(last) ? parseFloat(last[1]) : last.Kp;
    const A = Array.isArray(last) ? parseFloat(last[2]) : last.a_running;
    RW.sun = { sfi: Math.round(f.flux), k: Math.round(K), a: Math.round(A) || 0, at: f.time_tag };
    if (!SUN.override) { SUN.sfi = RW.sun.sfi; SUN.k = Math.min(9, RW.sun.k); SUN.a = RW.sun.a; SUN.live = true; SUN.key = 'live'; }
    setStatus('sun', 'live');
    bus.emit('realworld', 'sun');
  } catch (e) { setStatus('sun', 'unavailable'); }
}

// ------------------------------------------------------------------ local weather (NWS, US)
const WMO = { 0: 'clear', 1: 'mostly clear', 2: 'partly cloudy', 3: 'overcast', 45: 'fog', 48: 'fog', 51: 'drizzle', 53: 'drizzle', 55: 'drizzle', 61: 'rain', 63: 'rain', 65: 'heavy rain', 71: 'snow', 73: 'snow', 75: 'heavy snow', 80: 'showers', 81: 'showers', 82: 'heavy showers', 95: 'thunderstorms', 96: 'thunderstorms with hail', 99: 'thunderstorms with hail' };
function classify(text = '') {
  const t = text.toLowerCase();
  return {
    storm: /thunder|t-storm|tstm/.test(t), rain: /rain|drizzle|shower/.test(t), snow: /snow|sleet|ice/.test(t), fog: /fog|mist|haze/.test(t),
    cloud: /cloud|overcast/.test(t) ? (/overcast|mostly cloudy/.test(t) ? 0.9 : 0.5) : /clear|sunny|fair/.test(t) ? 0.05 : 0.3,
  };
}

export async function loadWeather() {
  const st = me();
  const key = `wx:${st.abbr}`;
  const cached = cacheGet(key, 20 * 60e3);
  if (cached) { RW.wx = cached.wx; RW.nws = cached.nws; RW.alerts = cached.alerts || []; bus.emit('realworld', 'wx'); return; }
  try {
    const pt = await getJSON(`${NWS}/points/${st.lat.toFixed(4)},${st.lon.toFixed(4)}`);
    const p = pt.properties;
    const city = p.relativeLocation?.properties?.city, stateAb = p.relativeLocation?.properties?.state;
    const [fc, stns] = await Promise.all([getJSON(p.forecast), getJSON(p.observationStations)]);
    let obs = null, obsName = null;
    for (const f of (stns.features || []).slice(0, 3)) {
      try { const o = await getJSON(`${f.id}/observations/latest`); if (o.properties?.temperature?.value != null) { obs = o.properties; obsName = f.properties.name; break; } } catch (e) { }
    }
    const periods = (fc.properties?.periods || []).slice(0, 4).map((x) => ({ name: x.name, text: x.detailedForecast, short: x.shortForecast, temp: x.temperature }));
    let alerts = [];
    try { const al = await getJSON(`${NWS}/alerts/active?point=${st.lat.toFixed(4)},${st.lon.toFixed(4)}`); alerts = (al.features || []).slice(0, 3).map((a) => ({ event: a.properties.event, headline: a.properties.headline, desc: (a.properties.description || '').slice(0, 600), severity: a.properties.severity })); } catch (e) { }
    const C = obs?.temperature?.value, wind = obs?.windSpeed?.value, dir = obs?.windDirection?.value, pres = obs?.barometricPressure?.value, dew = obs?.dewpoint?.value;
    const desc = obs?.textDescription || periods[0]?.short || '';
    RW.wx = {
      source: 'NWS', desc, tempF: C != null ? Math.round(C * 9 / 5 + 32) : periods[0]?.temp, dewF: dew != null ? Math.round(dew * 9 / 5 + 32) : null,
      windKt: wind != null ? Math.round(wind / 1.852) : null, windDir: dir != null ? Math.round(dir) : null,
      altim: pres != null ? (pres / 3386.39).toFixed(2) : null, station: obsName, ...classify(desc),
    };
    RW.nws = { office: p.cwa, city, state: stateAb, periods, grid: p.gridId, radar: p.radarStation, tz: p.timeZone };
    RW.alerts = alerts;
    cacheSet(key, { wx: RW.wx, nws: RW.nws, alerts });
    setStatus('wx', 'live');
    bus.emit('realworld', 'wx');
  } catch (e) {
    // outside the US or NWS unavailable: Open-Meteo
    try {
      const o = await getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${st.lat}&longitude=${st.lon}&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure&temperature_unit=fahrenheit&wind_speed_unit=kn`);
      const c = o.current;
      const desc = WMO[c.weather_code] || 'fair';
      RW.wx = { source: 'Open-Meteo', desc, tempF: Math.round(c.temperature_2m), windKt: Math.round(c.wind_speed_10m), windDir: Math.round(c.wind_direction_10m), altim: (c.surface_pressure / 33.8639).toFixed(2), ...classify(desc) };
      cacheSet(key, { wx: RW.wx, nws: null, alerts: [] });
      setStatus('wx', 'live');
      bus.emit('realworld', 'wx');
    } catch (e2) { setStatus('wx', 'unavailable'); }
  }
}

// ------------------------------------------------------------------ broadcast stations (Radio Browser)
// Real stations with real coordinates; RF frequency taken from the station's name/tags.
function parseFreq(s) {
  const t = ` ${s} `.toUpperCase();
  let m = t.match(/(?:^|[^\d.])(8[89]|9\d|10[0-7])\.(\d)(?:\s*(?:FM|MHZ)?)(?![\d])/);
  if (m) { const f = parseFloat(`${m[1]}.${m[2]}`); if (f >= 88.1 && f <= 107.9) return { f: Math.round(f * 10) * 1e5, mode: 'WFM' }; }
  m = t.match(/(?:^|[^\d.])(5[3-9]0|[6-9][0-9]0|1[0-6][0-9]0|1700)\s*(?:AM|KHZ)/);
  if (m) return { f: +m[1] * 1e3, mode: 'AM' };
  m = t.match(/\bAM\s*(5[3-9]0|[6-9][0-9]0|1[0-6][0-9]0)\b/);
  if (m) return { f: +m[1] * 1e3, mode: 'AM' };
  return null;
}
function nearestStates(n = 5) {
  const m = me();
  return STATES.map((s) => ({ s, d: distanceKm(m, s) })).sort((a, b) => a.d - b.d).slice(0, n).map((x) => x.s);
}
export async function loadBroadcast() {
  const m = me();
  const key = `bc4:${m.abbr}`;
  const cached = cacheGet(key, 24 * 3600e3);
  if (cached) { RW.broadcast = cached; bus.emit('realworld', 'broadcast'); setStatus('broadcast', `${cached.length} stations`); return; }
  setStatus('broadcast', 'loading…');
  const out = [], seen = new Set();
  for (const st of nearestStates(10)) {
    try {
      const list = await getJSON(`${RB}/stations/search?countrycode=US&state=${encodeURIComponent(st.name)}&is_https=true&hidebroken=true&has_geo_info=true&limit=500&order=clickcount&reverse=true`);
      for (const x of list) {
        const fq = parseFreq(`${x.name} ${x.tags}`);
        if (!fq) continue;
        const k = `${fq.f}|${(x.name || '').slice(0, 12)}`;
        if (seen.has(k)) continue;
        seen.add(k);
        // only stations with real coordinates go on the air — no guessed locations
        if (x.geo_lat == null || x.geo_long == null || Math.abs(x.geo_lat) < 1) continue;
        const hasGeo = true, lat = x.geo_lat, lon = x.geo_long;
        const call = ((x.name || '').toUpperCase().match(/\b[KW][A-Z]{2,3}\b/) || [])[0] || null;
        out.push({ id: x.stationuuid, name: x.name.trim().slice(0, 48), call, f: fq.f, mode: fq.mode, url: x.url_resolved || x.url, lat, lon, geo: hasGeo, state: st.abbr, codec: x.codec, homepage: x.homepage });
      }
    } catch (e) { }
  }
  RW.broadcast = out;
  cacheSet(key, out);
  setStatus('broadcast', `${out.length} stations`);
  bus.emit('realworld', 'broadcast');
}

// ------------------------------------------------------------------ airports (OurAirports, real frequencies)
export async function loadAirports() {
  const m = me();
  const key = `ap2:${m.abbr}`;
  const cached = cacheGet(key, 30 * 24 * 3600e3);
  if (cached) { RW.airports = cached; bus.emit('realworld', 'airports'); setStatus('airports', `${cached.length} airports`); return; }
  setStatus('airports', 'loading airport database (one-time, ~12 MB)…');
  try {
    const apTxt = await (await fetch(`${OA}/airports.csv`)).text();
    const near = [];
    for (const line of apTxt.split('\n')) {
      if (!line.includes('"large_airport"') && !line.includes('"medium_airport"')) continue;
      const c = csvRow(line);
      const lat = +c[4], lon = +c[5];
      if (!isFinite(lat)) continue;
      const d = distanceKm(m, { lat, lon });
      if (d > 320) continue;
      near.push({ ident: c[1], type: c[2], name: c[3], lat, lon, elev: +c[6] || 0, city: c[10], d, iata: c[13], freqs: [] });
    }
    near.sort((a, b) => a.d - b.d);
    const keep = near.slice(0, 14);
    const frTxt = await (await fetch(`${OA}/airport-frequencies.csv`)).text();
    const idx = Object.fromEntries(keep.map((a) => [a.ident, a]));
    for (const line of frTxt.split('\n')) {
      const c = csvRow(line);
      const a = idx[c[2]];
      if (!a) continue;
      const f = parseFloat(c[5]);
      if (f >= 108 && f <= 137) a.freqs.push({ type: c[3], desc: c[4], mhz: f });
    }
    RW.airports = keep.filter((a) => a.freqs.length);
    cacheSet(key, RW.airports);
    setStatus('airports', `${RW.airports.length} airports`);
    bus.emit('realworld', 'airports');
  } catch (e) { setStatus('airports', 'unavailable'); }
}
function csvRow(line) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { q = !q; continue; }
    if (ch === ',' && !q) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur.replace(/\r$/, ''));
  return out;
}

// ------------------------------------------------------------------ fixed real-world stations
// NIST WWV (Fort Collins, CO) and WWVH (Kekaha, Kauai, HI) time & frequency stations.
export const TIME_STATIONS = [
  ...[2.5, 5, 10, 15, 20, 25].map((f) => ({ call: 'WWV', f: f * 1e6, lat: 40.678, lon: -105.04, kw: f === 2.5 || f === 25 ? 2.5 : 10, voice: 'male' })),
  ...[2.5, 5, 10, 15].map((f) => ({ call: 'WWVH', f: f * 1e6, lat: 21.987, lon: -159.763, kw: f === 2.5 ? 5 : 10, voice: 'female' })),
];
// NOAA Weather Radio channels (the seven official frequencies).
export const WX_CHANNELS = [162.400, 162.425, 162.450, 162.475, 162.500, 162.525, 162.550].map((x) => x * 1e6);
// Hospital Emergency Administrative Radio — nationwide ambulance-to-hospital channel.
export const HEAR = 155.340e6;

export function startRealWorld() {
  loadSpaceWeather();
  loadWeather();
  setInterval(loadSpaceWeather, 30 * 60e3);
  setInterval(loadWeather, 20 * 60e3);
  bus.on('qth', () => { RW.broadcast = []; RW.airports = []; loadWeather(); });
}
// Heavier data is loaded only when you tune near it.
let bcRequested = false, apRequested = false;
export function wantBroadcast() { if (!bcRequested) { bcRequested = true; loadBroadcast(); } }
export function wantAirports() { if (!apRequested) { apRequested = true; loadAirports(); } }
bus.on('qth', () => { bcRequested = false; apRequested = false; });

// Airline telephony designators (ICAO code -> spoken callsign) for simulated traffic.
export const AIRLINES = [['AAL', 'American'], ['DAL', 'Delta'], ['UAL', 'United'], ['SWA', 'Southwest'], ['ASA', 'Alaska'], ['JBU', 'JetBlue'], ['FFT', 'Frontier'], ['NKS', 'Spirit'], ['SKW', 'Skywest'], ['ENY', 'Envoy'], ['RPA', 'Brickyard'], ['FDX', 'FedEx'], ['UPS', 'U P S']];
