// Real-time ionosphere from NOAA SWPC (both feeds allow browser access):
//  - GloTEC: a global grid (5° lon × 2.5° lat) of measured total electron content, NmF2 and hmF2,
//    assimilated from GNSS and ionosonde data every 10 minutes. foF2 = 8.98e-6·√NmF2 MHz;
//    the M(3000)F2 factor is estimated from hmF2, giving MUF(3000) = foF2 · M(3000).
//  - D-RAP: D-region absorption — the highest frequency (MHz) suffering 1 dB of absorption,
//    on a 4° × 2° grid. It rises sharply during solar flares (radio blackouts) and polar-cap events.
import { S } from './state.js';
import { bus } from './util.js';

const BASE = 'https://services.swpc.noaa.gov';
export const IONO = { ready: false, time: null, drapTime: null, xray: '', proton: '', error: null, grid: null, drap: null };

// GloTEC grid layout: lon -177.5..177.5 (72), lat -88.75..88.75 (72)
const NLON = 72, NLAT = 72, LON0 = -177.5, LAT0 = -88.75, DLON = 5, DLAT = 2.5;

async function loadGlotec() {
  const idx = await (await fetch(`${BASE}/products/glotec/geojson_2d_urt.json`, { cache: 'no-cache' })).json();
  const last = idx[idx.length - 1];
  if (IONO.time && last.time_tag === IONO.time) return false;
  const gj = await (await fetch(BASE + last.url)).json();
  const fo = new Float32Array(NLON * NLAT).fill(NaN), hm = new Float32Array(NLON * NLAT).fill(NaN), tec = new Float32Array(NLON * NLAT).fill(NaN);
  for (const f of gj.features) {
    const [lon, lat] = f.geometry.coordinates, p = f.properties;
    const i = Math.round((lat - LAT0) / DLAT), j = Math.round((lon - LON0) / DLON);
    if (i < 0 || i >= NLAT || j < 0 || j >= NLON) continue;
    const k = i * NLON + j;
    if (p.NmF2 > 0) fo[k] = 8.98e-6 * Math.sqrt(p.NmF2);
    if (p.hmF2 > 0) hm[k] = p.hmF2;
    if (p.tec != null) tec[k] = p.tec;
  }
  IONO.grid = { fo, hm, tec };
  IONO.time = last.time_tag;
  return true;
}

async function loadDrap() {
  const txt = await (await fetch(`${BASE}/text/drap_global_frequencies.txt`, { cache: 'no-cache' })).text();
  const lines = txt.split('\n');
  IONO.xray = (txt.match(/X-RAY Message\s*:\s*(.*)/) || [])[1]?.trim() || '';
  IONO.proton = (txt.match(/Proton Message\s*:\s*(.*)/) || [])[1]?.trim() || '';
  IONO.drapTime = (txt.match(/Valid At\s*:\s*(.*)/) || [])[1]?.trim() || null;
  let lons = null; const rows = [];
  for (const l of lines) {
    if (l.startsWith('#') || l.startsWith('-') || !l.trim()) continue;
    if (!l.includes('|')) { lons = l.trim().split(/\s+/).map(Number); continue; }
    const [lat, vals] = l.split('|');
    rows.push({ lat: +lat, v: vals.trim().split(/\s+/).map(Number) });
  }
  if (!lons || !rows.length) throw new Error('D-RAP format');
  IONO.drap = { lons, lats: rows.map((r) => r.lat), v: rows.map((r) => r.v) };
}

const dataOn = () => S.settings.liveIono !== false;
export const ionoLive = () => IONO.ready && dataOn() && S.settings.hour == null;
// A flare or proton event is in progress: apply D-RAP absorption.
export const blackout = () => ionoLive() && IONO.drap && (!/normal/i.test(IONO.xray) || !/normal/i.test(IONO.proton));

function bilinear(arr, lat, lon) {
  let x = (lon - LON0) / DLON, y = (lat - LAT0) / DLAT;
  y = Math.max(0, Math.min(NLAT - 1, y));
  const j0 = Math.floor(x), i0 = Math.floor(y), fx = x - j0, fy = y - i0;
  const at = (i, j) => arr[Math.min(NLAT - 1, i) * NLON + (((j % NLON) + NLON) % NLON)];
  const v = [[at(i0, j0), 1 - fx, 1 - fy], [at(i0, j0 + 1), fx, 1 - fy], [at(i0 + 1, j0), 1 - fx, fy], [at(i0 + 1, j0 + 1), fx, fy]];
  let s = 0, w = 0;
  for (const [a, wx, wy] of v) if (Number.isFinite(a)) { s += a * wx * wy; w += wx * wy; }
  return w > 0 ? s / w : NaN;
}

// M(3000)F2 from the layer height (Dudeney/Shimazaki relation, ΔM neglected).
export const m3000 = (hmF2) => Math.max(2.4, Math.min(4.0, 1490 / (hmF2 + 176)));

// Live F2 parameters at a point, or null when live data is not in use.
export function ionoAt(lat, lon) {
  if (!ionoLive() || !IONO.grid) return null;
  const fo = bilinear(IONO.grid.fo, lat, lon);
  if (!Number.isFinite(fo)) return null;
  const hm = bilinear(IONO.grid.hm, lat, lon);
  const M = m3000(Number.isFinite(hm) ? hm : 300);
  return { foF2: fo, hmF2: hm, m3000: M, muf3000: fo * M, tec: bilinear(IONO.grid.tec, lat, lon) };
}

// Highest frequency affected by 1 dB of D-region absorption (MHz).
export function hafAt(lat, lon) {
  const d = IONO.drap;
  if (!d) return 0;
  const i = d.lats.reduce((b, l, k) => (Math.abs(l - lat) < Math.abs(d.lats[b] - lat) ? k : b), 0);
  const j = d.lons.reduce((b, l, k) => (Math.abs(l - lon) < Math.abs(d.lons[b] - lon) ? k : b), 0);
  return d.v[i]?.[j] || 0;
}
// One-way oblique absorption (dB) at f MHz through the D layer at a point (≈ 3 × vertical at low angles).
export const drapDb = (lat, lon, fMHz) => { const haf = hafAt(lat, lon); return haf > 0 ? 3 * Math.pow(haf / fMHz, 1.5) : 0; };

// Raw grid values for map layers.
export function layerAt(kind, lat, lon) {
  if (kind === 'drap') return hafAt(lat, lon);
  if (!IONO.grid) return NaN;
  if (kind === 'tec') return bilinear(IONO.grid.tec, lat, lon);
  const fo = bilinear(IONO.grid.fo, lat, lon);
  if (kind === 'fof2') return fo;
  const hm = bilinear(IONO.grid.hm, lat, lon);
  return fo * m3000(Number.isFinite(hm) ? hm : 300);
}

async function refresh() {
  if (!dataOn()) return;
  let changed = false;
  try { changed = await loadGlotec(); IONO.ready = true; IONO.error = null; } catch (e) { IONO.error = 'GloTEC unavailable'; }
  try { await loadDrap(); } catch (e) { /* absorption stays modelled */ }
  if (changed || IONO.ready) bus.emit('iono');
}

export function startIono() {
  refresh();
  setInterval(() => { if (!document.hidden) refresh(); }, 10 * 60 * 1000);
  bus.on('iono-toggle', () => { if (dataOn() && !IONO.ready) refresh(); bus.emit('iono'); });
}
