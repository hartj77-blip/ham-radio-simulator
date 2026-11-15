// Simplified but physically-motivated HF/VHF propagation model.
import { clamp, rand, randi, chance } from './util.js';
import { S, save } from './state.js';

const R = 6371;
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

export function distanceKm(a, b) {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
}
export function bearing(a, b) {
  const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}
// point a fraction f along the great circle
export function interp(a, b, f) {
  const d = distanceKm(a, b) / R;
  if (d < 1e-6) return { ...a };
  const A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d);
  const x = A * Math.cos(rad(a.lat)) * Math.cos(rad(a.lon)) + B * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon));
  const y = A * Math.cos(rad(a.lat)) * Math.sin(rad(a.lon)) + B * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon));
  const z = A * Math.sin(rad(a.lat)) + B * Math.sin(rad(b.lat));
  return { lat: deg(Math.atan2(z, Math.sqrt(x * x + y * y))), lon: deg(Math.atan2(y, x)) };
}
export function grid(lat, lon) {
  lon += 180; lat += 90;
  const A = 'ABCDEFGHIJKLMNOPQR', a = 'abcdefghijklmnopqrstuvwx';
  return A[Math.floor(lon / 20)] + A[Math.floor(lat / 10)] + Math.floor((lon % 20) / 2) + Math.floor(lat % 10) + a[Math.floor((lon % 2) * 12)] + a[Math.floor((lat % 1) * 24)];
}

export const SUN = {
  sfi: 140, k: 2, a: 8, es: false, seed: 0,
  randomize() {
    this.sfi = randi(68, 230);
    this.k = Math.min(7, Math.max(0, Math.round(-Math.log(Math.random()) * 1.6)));
    this.a = [0, 3, 7, 15, 27, 48, 80, 132][this.k] + randi(0, 3);
    this.es = chance(0.25);
  },
};
SUN.randomize();

// Simulated UTC time. Real UTC unless the player overrides the hour (time warp).
export function simDate() {
  const d = new Date();
  if (S.settings.hour != null) {
    d.setUTCHours(Math.floor(S.settings.hour), Math.round((S.settings.hour % 1) * 60));
  }
  return d;
}

// 0 (full night) .. 1 (full day) at a location, from solar elevation.
export function dayFactor(p, d = simDate()) {
  const doy = Math.floor((d - Date.UTC(d.getUTCFullYear(), 0, 0)) / 864e5);
  const decl = -23.44 * Math.cos(rad((360 / 365) * (doy + 10)));
  const utcH = d.getUTCHours() + d.getUTCMinutes() / 60;
  const solarH = utcH + p.lon / 15;
  const ha = rad((solarH - 12) * 15);
  const sinEl = Math.sin(rad(p.lat)) * Math.sin(rad(decl)) + Math.cos(rad(p.lat)) * Math.cos(rad(decl)) * Math.cos(ha);
  return clamp((sinEl + 0.08) / 0.38, 0, 1);
}

export function foF2(df) {
  const day = 3 + 0.045 * SUN.sfi, night = 2.0 + 0.017 * SUN.sfi;
  return (night + (day - night) * df) * (1 - 0.05 * Math.max(0, SUN.k - 3));
}

// Path calculation. Returns {loss (dB), muf (MHz), dist, mode}
export function path(a, b, fMHz, d = simDate()) {
  const dist = Math.max(1, distanceKm(a, b));
  const fspl = 32.45 + 20 * Math.log10(dist) + 20 * Math.log10(fMHz);
  if (fMHz >= 50) {
    // VHF: line of sight / tropo, plus sporadic-E on 6 m
    let loss = fspl + 10 + Math.max(0, dist - 40) * (fMHz > 100 ? 0.9 : 0.6);
    let mode = 'LOS';
    if (fMHz < 60) {
      const df = dayFactor(interp(a, b, 0.5), d);
      if (SUN.es && dist > 700 && dist < 2300) { const esLoss = fspl + 18 + (1 - df) * 12; if (esLoss < loss) { loss = esLoss; mode = 'Es'; } }
      const muf = foF2(df) * 3.4;
      if (muf > fMHz && dist > 2000) { const f2 = fspl + 15; if (f2 < loss) { loss = f2; mode = 'F2'; } }
    }
    return { loss, muf: 0, dist, mode };
  }
  // Ground wave for short paths
  const ground = fspl + 6 + dist * (fMHz / 12);
  const hops = Math.max(1, Math.ceil(dist / 3500));
  const hopLen = dist / hops;
  const M = 1 + 2.4 * Math.pow(Math.min(hopLen, 3500) / 3500, 0.8);
  // sample control points along the path; MUF limited by worst point
  let muf = Infinity, absorb = 0;
  const pts = hops === 1 ? [0.5] : Array.from({ length: hops }, (_, i) => (i + 0.5) / hops);
  for (const f of pts) {
    const p = interp(a, b, f);
    const df = dayFactor(p, d);
    muf = Math.min(muf, foF2(df) * M);
    absorb += df * Math.sqrt(SUN.sfi / 100) * 420 / (fMHz * fMHz);
  }
  // also absorption at endpoints for low bands
  absorb += 0.5 * (dayFactor(a, d) + dayFactor(b, d)) * 120 / (fMHz * fMHz);
  let over = fMHz > muf ? (fMHz / muf - 1) * 140 : 0;
  // polar/aurora
  const maxLat = Math.max(...[0.25, 0.5, 0.75].map((f) => Math.abs(interp(a, b, f).lat)));
  const kLoss = SUN.k * 1.2 + (maxLat > 55 ? SUN.k * 4 : 0);
  const sky = fspl + absorb + over + (hops - 1) * 4 + kLoss + 8;
  const loss = Math.min(sky, ground);
  return { loss, muf, dist, mode: ground < sky ? 'ground' : `${hops}F2` };
}

// Band noise in dBm (2.4 kHz bandwidth) at the player's location.
const NOISE_S = { 1.8: [5, 7], 3.5: [4, 6.5], 7: [4, 5.5], 10: [3, 3.5], 14: [3, 2.5], 18: [2, 1.5], 21: [2, 1.5], 24: [1, 1], 28: [1, 0.5], 50: [0, 0], 144: [-1, -1] };
export function bandNoiseDbm(fMHz, where) {
  const keys = Object.keys(NOISE_S).map(Number).sort((a, b) => a - b);
  let k = keys[0];
  for (const x of keys) if (fMHz >= x - 0.3) k = x;
  const [dayS, nightS] = NOISE_S[k];
  const df = where ? dayFactor(where) : 0.5;
  const s = nightS + (dayS - nightS) * df + SUN.k * 0.25;
  return -73 - 6 * (9 - s);
}

export const sUnits = (dbm) => {
  if (dbm >= -73) return { s: 9, over: Math.round(dbm + 73), text: dbm > -72 ? `S9+${Math.round((dbm + 73) / 10) * 10}` : 'S9' };
  const s = clamp(Math.round(9 + (dbm + 73) / 6), 0, 9);
  return { s, over: 0, text: `S${s}` };
};

// Band condition summary for the header, like the classic solar banner.
export function bandConditions(where) {
  const groups = [['80m-40m', 5.3], ['30m-20m', 12], ['17m-15m', 19.5], ['12m-10m', 26.5]];
  const out = [];
  const df = dayFactor(where);
  for (const [name, f] of groups) {
    const test = (dff) => {
      const muf = foF2(dff) * 3.4;
      const absorb = dff * Math.sqrt(SUN.sfi / 100) * 420 / (f * f);
      if (f > muf * 1.05) return 'Closed';
      const margin = muf / f;
      const sc = (margin > 1.4 ? 2 : margin > 1.1 ? 1 : 0) - (absorb > 12 ? 2 : absorb > 5 ? 1 : 0) - (SUN.k >= 5 ? 1 : 0);
      return sc >= 2 ? 'Good' : sc >= 1 ? 'Fair' : 'Poor';
    };
    out.push({ name, day: test(1), night: test(0), now: test(df) });
  }
  return out;
}

export { save };
