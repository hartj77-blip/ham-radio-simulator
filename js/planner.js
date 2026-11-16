// Site & antenna design planner — the professional side of antenna building.
//  • Site: real ground elevation (USGS 3DEP 1 m in the US, Open-Meteo worldwide) at your QTH
//  • Terrain: elevation profiles toward the major DX regions → slope & horizon angle (a simplified
//    take on HFTA, the terrain-assessment tool contesters use)
//  • Height: the height that puts the main lobe at the take-off angle your goal needs,
//    corrected for terrain tilt and capped by your supports, with the dB cost of compromise
//  • Pattern: elevation pattern over your ground type (Fresnel reflection coefficients)
//  • Length: exact resonant length from the Method-of-Moments solver for your wire, insulation,
//    height and ground
//  • VHF: height above average terrain (HAAT) and radio horizon
import { S, save } from './state.js';
import { h, $, bus, toast, clamp } from './util.js';
import { BANDS, bandByName } from './data/bandplan.js';
import { stateBy } from './data/world.js';
import { bearing, distanceKm } from './propagation.js';
import { segment, postZ, GROUNDS, CONDUCTORS } from './em/models.js';
import { ANT_TYPES, gameModel, RADIAL_LOSS } from './antenna.js';
import { runSolver } from './em/client.js';
import { siteMaxHeight } from './yard.js';
import { setupCanvas } from './em/plots.js';

const FT = 0.3048, C = 299.792458; // MHz·m
export const P = () => (S.plan ||= { band: '40m', seg: 'center', goal: 'regional', dir: 'EU' });
export const qth = () => (S.op.lat != null ? { lat: S.op.lat, lon: S.op.lon, real: true } : { ...(stateBy(S.op.state) || stateBy('KS')), real: false });

export const GOALS = {
  nvis: { label: 'Local / NVIS (0–500 km)', angle: 75, note: 'High-angle radiation fills in the skip zone — regional nets, emergency comms.' },
  regional: { label: 'Regional (500–2000 km)', angle: 30, note: 'Medium angles: most domestic contacts and contests.' },
  dx: { label: 'DX (2000 km +)', angle: 12, note: 'Low angles reach other continents. Height and terrain matter most here.' },
};
const TARGETS = { EU: ['Europe', 50, 10], JA: ['Japan / Asia', 36, 139], SA: ['South America', -15, -55], AF: ['Africa', 0, 20], OC: ['Australia / Pacific', -30, 145] };
export const targetHz = (b = P().band, seg = P().seg) => SEG(b, seg);
const SEG = (b, seg) => { const B = bandByName(b); if (seg === 'cw' && B.cw) return (B.cw[0] + B.cw[1]) / 2; if (seg === 'phone' && B.ph) return (B.ph[0] + B.ph[1]) / 2; return (B.lo + B.hi) / 2; };

// ------------------------------------------------------------------ elevation data
const DISTS = [0, 0.15, 0.3, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8, 12, 16]; // km
function dest(p, brg, km) {
  const R = 6371, d = km / R, th = brg * Math.PI / 180, la = p.lat * Math.PI / 180, lo = p.lon * Math.PI / 180;
  const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(th));
  const lo2 = lo + Math.atan2(Math.sin(th) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2));
  return { lat: la2 * 180 / Math.PI, lon: lo2 * 180 / Math.PI };
}
async function openMeteo(pts) {
  const r = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${pts.map((p) => p.lat.toFixed(5)).join(',')}&longitude=${pts.map((p) => p.lon.toFixed(5)).join(',')}`);
  if (!r.ok) throw new Error(`Open-Meteo ${r.status}`);
  const j = await r.json();
  if (!j.elevation) throw new Error('no elevation');
  return j.elevation;
}
async function usgs(pts) {
  const one = async (p) => { const r = await fetch(`https://epqs.nationalmap.gov/v1/json?x=${p.lon.toFixed(5)}&y=${p.lat.toFixed(5)}&units=Meters&wkid=4326&includeDate=false`); const j = await r.json(); const v = parseFloat(j.value); if (!isFinite(v) || v < -1000) throw new Error('no data'); return v; };
  const out = new Array(pts.length);
  let i = 0;
  await Promise.all(Array.from({ length: 8 }, async () => { while (i < pts.length) { const k = i++; out[k] = await one(pts[k]); } }));
  return out;
}

export async function loadSite(force) {
  const q = qth();
  const key = `${q.lat.toFixed(3)},${q.lon.toFixed(3)}`;
  if (!force && S.site?.key === key) return S.site;
  const dirs = Object.entries(TARGETS).map(([id, [name, la, lo]]) => ({ id, name, brg: bearing(q, { lat: la, lon: lo }) }));
  const pts = [q];
  for (const d of dirs) for (const km of DISTS.slice(1)) pts.push(dest(q, d.brg, km));
  let elev = null, source = null;
  try { elev = await openMeteo(pts); source = 'Open-Meteo (Copernicus DEM, 90 m)'; } catch (e) { }
  if (!elev) { try { elev = await usgs(pts); source = 'USGS 3DEP (1 m)'; } catch (e) { } }
  if (!elev) throw new Error('Elevation services unavailable — check your connection.');
  const e0 = elev[0];
  let k = 1;
  const profiles = dirs.map((d) => ({ ...d, pts: DISTS.map((km, i) => ({ km, m: i === 0 ? e0 : elev[k++] })) }));
  S.site = { key, lat: q.lat, lon: q.lon, real: q.real, elevM: e0, source, profiles, t: Date.now() };
  save();
  return S.site;
}

// Terrain analysis for one direction at antenna height hM.
export function terrain(prof, hM) {
  const e0 = prof.pts[0].m;
  let horizon = -90;
  for (const p of prof.pts.slice(1)) horizon = Math.max(horizon, Math.atan2(p.m - (e0 + hM), p.km * 1000) * 180 / Math.PI);
  // average slope of the first ~1.5 km (the reflection zone for low-angle HF)
  const near = prof.pts.filter((p) => p.km > 0 && p.km <= 1.5);
  const slope = near.length ? near.reduce((s, p) => s + Math.atan2(p.m - e0, p.km * 1000), 0) / near.length * 180 / Math.PI : 0;
  // HAAT-style: average elevation 3–16 km
  const far = prof.pts.filter((p) => p.km >= 3);
  const avg = far.reduce((s, p) => s + p.m, 0) / Math.max(1, far.length);
  return { horizon, slope, avgFar: avg };
}

// ------------------------------------------------------------------ physics helpers
const csqrt = (re, im) => { const m = Math.hypot(re, im); const r = Math.sqrt((m + re) / 2); let i = Math.sqrt(Math.max(0, (m - re) / 2)); if (im < 0) i = -i; return [r, i]; };
function gammaH(deg, fMHz, ground) {
  const G = GROUNDS[ground] || GROUNDS.average;
  if (G.type !== 'real') return [-1, 0];
  const er = G.er, ei = -60 * G.sigma * (C / fMHz);
  const s = Math.sin(deg * Math.PI / 180), c2 = Math.cos(deg * Math.PI / 180) ** 2;
  const [qr, qi] = csqrt(er - c2, ei);
  const nr = s - qr, ni = -qi, dr = s + qr, di = qi, dd = dr * dr + di * di;
  return [(nr * dr + ni * di) / dd, (ni * dr - nr * di) / dd];
}
function gammaV(deg, fMHz, ground) {
  const G = GROUNDS[ground] || GROUNDS.average;
  if (G.type !== 'real') return [1, 0];
  const er = G.er, ei = -60 * G.sigma * (C / fMHz);
  const s = Math.sin(deg * Math.PI / 180), c2 = Math.cos(deg * Math.PI / 180) ** 2;
  const [qr, qi] = csqrt(er - c2, ei);
  const nr = er * s - qr, ni = ei * s - qi, dr = er * s + qr, di = ei * s + qi, dd = dr * dr + di * di;
  return [(nr * dr + ni * di) / dd, (ni * dr - nr * di) / dd];
}
// Gain (dBi) vs elevation angle for a horizontal dipole (broadside) at height hM, or a vertical.
export function elevGain(type, deg, fMHz, hM, ground) {
  if (deg <= 0) return -40;
  const k = 2 * Math.PI * fMHz / C;
  if (type === 'vertical') {
    const [gr, gi] = gammaV(deg, fMHz, ground);
    const m = Math.hypot(1 + gr, gi) * Math.cos(deg * Math.PI / 180);
    return 20 * Math.log10(Math.max(m, 1e-3)) + 0.0 + (ground === 'perfect' ? 0 : -1.5);
  }
  const [gr, gi] = gammaH(deg, fMHz, ground);
  const ph = -2 * k * hM * Math.sin(deg * Math.PI / 180);
  const rr = 1 + gr * Math.cos(ph) - gi * Math.sin(ph), ri = gr * Math.sin(ph) + gi * Math.cos(ph);
  return 2.15 + 20 * Math.log10(Math.max(Math.hypot(rr, ri), 1e-3));
}

// Height (ft) that puts the first lobe at angle θ: h = λ / (4 sin θ)
export const heightFor = (fMHz, deg) => (C / fMHz) / (4 * Math.sin(deg * Math.PI / 180)) / FT;

// Exact resonant length: bisection on feed-point reactance of the *same* MoM model the game uses,
// with this antenna's height, ground, wire gauge and insulation.
export const antDefaults = (a = S.antenna) => { a.ground ||= 'average'; a.wire ||= 'AWG 14 copper'; if (a.insulated == null) a.insulated = true; return a; };
export async function autoSize(a, fHz, onProgress) {
  antDefaults(a);
  const L0 = ANT_TYPES[a.type].k / (fHz / 1e6);
  const fs = fHz * (a.insulated && ['dipole', 'invv', 'efhw'].includes(a.type) ? 1.03 : 1); // insulation slows the wave ~3%
  const Z = async (L) => (await runSolver({ model: segment(gameModel({ ...a, length: L }), fs * 1.05), freqs: [fs] }, null, 'fast')).sweep[0].Zraw;
  let n = 0; const tick = () => onProgress && onProgress(Math.min(0.95, ++n / 12));
  if (a.type === 'efhw') {
    // End-fed half-wave = parallel (high-Z) resonance: find the length where R peaks (golden-section).
    const g = 0.618034; let lo = L0 * 0.88, hi = L0 * 1.1;
    let c = hi - g * (hi - lo), d = lo + g * (hi - lo), rc = (await Z(c))[0], rd = (await Z(d))[0];
    for (let i = 0; i < 12; i++) {
      if (rc > rd) { hi = d; d = c; rd = rc; c = hi - g * (hi - lo); rc = (await Z(c))[0]; } else { lo = c; c = d; rc = rd; d = lo + g * (hi - lo); rd = (await Z(d))[0]; }
      tick();
    }
    return refine(a, (lo + hi) / 2, fHz, fs / fHz, onProgress);
  }
  // Series resonance: X = 0. Illinois (modified regula-falsi) — reactance is nearly linear in
  // length near resonance, so this converges in a handful of solves.
  const X = async (L) => { tick(); return (await Z(L))[1]; };
  let lo = L0 * 0.85, hi = L0 * 1.18, xlo = await X(lo), xhi = await X(hi), side = 0, L = L0;
  if (Math.sign(xlo) === Math.sign(xhi)) return refine(a, L0, fHz, fs / fHz, onProgress);
  for (let i = 0; i < 12; i++) {
    L = (lo * xhi - hi * xlo) / (xhi - xlo);
    const xm = await X(L);
    if (Math.abs(xm) < 0.3 || hi - lo < 0.002) break;
    if (Math.sign(xm) === Math.sign(xlo)) { lo = L; xlo = xm; if (side === -1) xhi /= 2; side = -1; }
    else { hi = L; xhi = xm; if (side === 1) xlo /= 2; side = 1; }
  }
  return refine(a, L, fHz, fs / fHz, onProgress);
}

// Final step: what an operator actually sees is the SWR dip on the analyzer, which sits where
// |Γ| is smallest — not exactly where X = 0 when R ≠ 50 Ω. Sweep, find the dip, rescale (wire
// antennas scale ~1/f), repeat once.
async function refine(a, L, fHz, ins, onProgress) {
  const loss = a.type === 'vertical' ? (RADIAL_LOSS[a.radials] ?? 18) : 0;
  for (let it = 0; it < 2; it++) {
    const freqs = Array.from({ length: 25 }, (_, i) => fHz * (0.94 + 0.12 * i / 24));
    const m = segment(gameModel({ ...a, length: L }), fHz * 1.07 * ins);
    const r = await runSolver({ model: m, freqs: freqs.map((f) => f * ins), fMesh: fHz * 1.07 * ins }, null, 'fast');
    const g = r.sweep.map((p) => { const [R0, X] = postZ(m, p.Zraw); const R = R0 + loss; return Math.hypot(R - 50, X) / Math.hypot(R + 50, X); });
    let k = 1; for (let i = 1; i < g.length - 1; i++) if (g[i] < g[k]) k = i;
    const d = g[k - 1] - 2 * g[k] + g[k + 1], off = d > 0 ? clamp(0.5 * (g[k - 1] - g[k + 1]) / d, -0.5, 0.5) : 0;
    const fDip = freqs[k] + off * (freqs[1] - freqs[0]);
    onProgress && onProgress(0.96 + it * 0.02);
    if (Math.abs(fDip / fHz - 1) < 0.0015) break;
    L *= fDip / fHz;
  }
  return Math.round(L * 100) / 100;
}

// ------------------------------------------------------------------ UI
let root, busy = false, listening = false;
export function mountPlanner(el) {
  root = el; render();
  if (listening) return; listening = true;
  bus.on('antenna', () => { if (!busy) render(); });
  bus.on('qth', () => { if (!busy) render(); });
}

export function render() {
  if (!root || !root.isConnected) return;
  const p = P(), a = antDefaults(), site = S.site?.key === `${qth().lat.toFixed(3)},${qth().lon.toFixed(3)}` ? S.site : null;
  root.innerHTML = '';
  const sel = (key, opts, obj = p) => { const s = h('select', {}, ...opts.map(([v, l]) => h('option', { value: v, selected: obj[key] === v }, l))); s.onchange = () => { obj[key] = s.value; save(); if (obj === a) bus.emit('antenna'); else if (key === 'band') bus.emit('plan-band', s.value); render(); }; return s; };
  const band = bandByName(p.band) || bandByName('40m');
  const fHz = SEG(p.band, p.seg), f = fHz / 1e6, lamFt = C / f / FT;
  const goal = GOALS[p.goal];
  const prof = site?.profiles.find((x) => x.id === p.dir) || site?.profiles[0];
  const ter = prof ? terrain(prof, a.height * FT) : null;
  const tilt = ter && p.goal !== 'nvis' && Math.abs(ter.slope) >= 0.5 ? -ter.slope : 0; // ground falling away tilts lobes down
  const wantAngle = clamp(goal.angle + tilt, 3, 89);
  const idealH = a.type === 'vertical' ? 0 : heightFor(f, wantAngle);
  const support = siteMaxHeight();
  const useH = a.type === 'vertical' ? 0 : Math.min(idealH, support);
  const gIdeal = elevGain(a.type, goal.angle, f, idealH * FT, a.ground), gUse = elevGain(a.type, goal.angle, f, useH * FT, a.ground);
  const gNow = elevGain(a.type, goal.angle, f, (a.type === 'vertical' ? 0 : a.height) * FT, a.ground);
  const isVhf = f > 50;
  const haat = site ? site.elevM + a.height * FT - site.profiles.reduce((s, x) => s + terrain(x, 0).avgFar, 0) / site.profiles.length : null;
  const vhfRange = haat != null ? 4.12 * (Math.sqrt(Math.max(1, haat)) + Math.sqrt(10)) : null;

  const out = h('div', { class: 'plan-out' });
  const lenBox = h('div', { class: 'readouts' });
  const doSize = async () => {
    if (busy) return; busy = true;
    lenBox.innerHTML = '<div><span>Resonant length</span><b>⏳ solving…</b></div>';
    try {
      const L = await autoSize(a, fHz);
      p.lastSize = { type: a.type, band: p.band, seg: p.seg, L, h: a.height, ground: a.ground, wire: a.wire, ins: a.insulated };
      save();
    } catch (e) { toast(`Solver: ${e.message}`, 'bad'); }
    busy = false; render();
  };
  const ls = p.lastSize && p.lastSize.type === a.type && p.lastSize.band === p.band ? p.lastSize : null;
  lenBox.innerHTML = ls ? `<div><span>Resonant length (${(f).toFixed(3)} MHz)</span><b>${ls.L.toFixed(2)} ft</b></div>
    ${['dipole', 'invv'].includes(a.type) ? `<div><span>Each leg</span><b>${(ls.L / 2).toFixed(2)} ft</b></div>` : ''}
    <div><span>Rule of thumb said</span><b>${(ANT_TYPES[a.type].k / f).toFixed(2)} ft</b></div>
    <div><span>Solved for</span><b>${ls.h} ft up · ${GROUNDS[ls.ground].label.split(' (')[0]} · #${ls.wire.split(' ')[1]} wire${ls.ins ? ' insulated' : ' bare'}</b></div>`
    : '<div><span>Resonant length</span><b>press 🎯 Calculate</b></div>';

  const terrRows = site ? site.profiles.map((x) => { const t = terrain(x, a.height * FT); return h('tr', { class: x.id === p.dir ? 'sel' : '' },
    h('td', {}, `${x.name} (${Math.round(x.brg)}°)`), h('td', { class: t.slope < -1 ? 'ok' : t.slope > 1 ? 'bad' : '' }, `${t.slope >= 0 ? '+' : ''}${t.slope.toFixed(2)}°`),
    h('td', { class: t.horizon > 1 ? 'bad' : 'ok' }, `${t.horizon.toFixed(2)}°`), h('td', { class: 'small muted' }, t.slope < -1 ? 'falls away — helps DX' : t.slope > 1 ? 'rises — raises take-off angle' : t.horizon > 1 ? 'hills block low angles' : 'flat — neutral')); }) : [];

  const goalAdvice = a.type === 'vertical'
    ? `Verticals radiate at low angles regardless of height (great for ${p.goal === 'nvis' ? 'DX, poor for NVIS — use a low dipole for NVIS' : 'DX'}). What matters is the radial field: ${a.radials} radials${a.radials < 16 ? ' — add more to cut ground loss' : ' — good'}.`
    : `For ${goal.label.toLowerCase()} the main lobe should be near <b>${goal.angle}°</b>${tilt ? ` (${wantAngle.toFixed(1)}° locally — the terrain tilts your pattern ${tilt > 0 ? 'down' : 'up'} by ${Math.abs(tilt).toFixed(1)}°)` : ''}. That needs <b>${idealH.toFixed(0)} ft</b> (${(idealH / lamFt).toFixed(2)} λ). ${idealH > support ? `Your supports reach <b>${support} ft</b> → you give up <b>${(gIdeal - gUse).toFixed(1)} dB</b> at ${goal.angle}° (more height at the Hamfest).` : 'Your supports can reach that. 👍'} At your current ${a.height} ft you have <b>${gNow.toFixed(1)} dBi</b> at ${goal.angle}° (ideal ${gIdeal.toFixed(1)} dBi).`;

  root.append(h('div', { class: 'card planner' },
    h('div', { class: 'row spread' }, h('h3', {}, '🧭 Site & design planner'), h('span', { class: 'muted tiny' }, 'Professional mode: real terrain, MoM-solved lengths, ground-reflection patterns')),
    h('div', { class: 'plan-grid' },
      h('div', {},
        h('label', {}, 'Band ', sel('band', BANDS.map((b) => [b.name, b.name]))), h('label', {}, 'Optimise for ', sel('seg', [['center', 'whole band'], ['cw', 'CW end'], ['phone', 'phone end']])),
        h('label', {}, 'Goal ', sel('goal', Object.entries(GOALS).map(([k, g]) => [k, g.label]))), h('div', { class: 'muted tiny' }, goal.note),
        h('label', {}, 'Ground ', sel('ground', Object.entries(GROUNDS).filter(([k]) => k !== 'free').map(([k, g]) => [k, g.label]), a)),
        h('label', {}, 'Wire ', sel('wire', Object.keys(CONDUCTORS).filter((k) => k.includes('copper')).map((k) => [k, k]), a),
          h('label', { class: 'inline small' }, (() => { const c = h('input', { type: 'checkbox', checked: a.insulated }); c.onchange = () => { a.insulated = c.checked; save(); bus.emit('antenna'); render(); }; return c; })(), ' insulated')),
        h('div', { class: 'row' },
          h('button', { class: 'btn primary', id: 'plan-calc', onclick: doSize }, '🎯 Calculate exact length'),
          ls ? h('button', { class: 'btn', onclick: () => applyPlan(ls, idealH, support) }, '✅ Apply to my antenna') : null)),
      h('div', {}, lenBox, h('div', { class: 'advice small', html: goalAdvice }),
        isVhf ? h('div', { class: 'advice small', html: haat != null ? `📡 VHF: height above average terrain (3–16 km) ≈ <b>${haat.toFixed(0)} m</b> → radio horizon to a 10 m-high station ≈ <b>${vhfRange.toFixed(0)} km</b>. Every 10 ft of height helps.` : 'Load your site to compute VHF coverage.' }) : null),
      h('div', {}, h('canvas', { class: 'plan-pat', id: 'plan-pat' }), h('div', { class: 'muted tiny' }, `Elevation pattern over ${GROUNDS[a.ground].label.split(' (')[0].toLowerCase()} at ${f.toFixed(3)} MHz: your height (orange) vs. ideal (blue dashed). Shaded = goal angles.`))),
    h('h4', {}, '🏔 Your site'),
    site ? h('div', {},
      h('p', { class: 'small', html: `Ground elevation <b>${site.elevM.toFixed(1)} m (${(site.elevM / FT).toFixed(0)} ft)</b> at ${site.lat.toFixed(4)}, ${site.lon.toFixed(4)}${site.real ? ' (your location)' : ' (state centre — use your real location for accuracy)'} · source: ${site.source}.` }),
      h('table', { class: 'tbl small' }, h('tr', {}, h('th', {}, 'Toward'), h('th', {}, 'Slope (first 1.5 km)'), h('th', {}, 'Horizon angle'), h('th', {}, '')), ...terrRows),
      h('label', { class: 'small' }, 'Design for direction ', sel('dir', Object.entries(TARGETS).map(([k, [n]]) => [k, n]))))
      : h('p', { class: 'small muted' }, 'Load real terrain to see how the land around you tilts your signal toward each continent.'),
    h('div', { class: 'row' },
      h('button', { class: 'btn', onclick: async () => { try { toast('Loading terrain…', 'info', 2000); await loadSite(true); render(); } catch (e) { toast(e.message, 'bad'); } } }, site ? '↻ Reload terrain' : '🏔 Load my terrain'),
      h('button', { class: 'btn', onclick: useMyLocation }, S.op.lat != null ? '📍 Real location in use' : '📍 Use my real location'),
      S.op.lat != null ? h('button', { class: 'link small', onclick: () => { delete S.op.lat; delete S.op.lon; save(); bus.emit('qth'); render(); } }, 'use state centre') : null),
    h('p', { class: 'muted tiny' }, 'Accuracy: MoM lengths ≈1–2% for a clear site; real installs shift a few % (nearby trees, buildings, sag). Terrain analysis is a simplified HFTA (slope & horizon only, no diffraction). Your location is only sent to the elevation service and stays in your browser.')));
  drawPattern(idealH, wantAngle);
}

function applyPlan(ls, idealH, support) {
  const a = S.antenna, p = P();
  a.length = ls.L; a.sizedBy = 'plan';
  if (a.type !== 'vertical') a.height = Math.round(Math.min(idealH, support));
  S.radio.atuTunedFreq = null;
  save(); bus.emit('antenna'); bus.emit('antenna-rebuild');
  toast(`✅ Applied: ${ls.L.toFixed(2)} ft${a.type !== 'vertical' ? ` at ${a.height} ft` : ''}. Check the analyzer below — the dip should sit right in the band.`, 'good', 7000);
}

function useMyLocation() {
  if (!navigator.geolocation) return toast('Location not available in this browser.', 'warn');
  navigator.geolocation.getCurrentPosition(async (pos) => {
    S.op.lat = +pos.coords.latitude.toFixed(4); S.op.lon = +pos.coords.longitude.toFixed(4); save();
    bus.emit('qth');
    try { await loadSite(true); } catch (e) { toast(e.message, 'bad'); }
    render();
    toast('📍 Using your real location for terrain and propagation.', 'good');
  }, (e) => toast(`Location: ${e.message}`, 'warn'), { enableHighAccuracy: false, timeout: 15000 });
}

function drawPattern(idealH, wantAngle) {
  const cv = document.getElementById('plan-pat');
  if (!cv) return;
  const p = P(), a = S.antenna;
  const f = SEG(p.band, p.seg) / 1e6;
  if (idealH == null) { const g = GOALS[p.goal]; idealH = a.type === 'vertical' ? 0 : heightFor(f, g.angle); }
  const { ctx, W, H } = setupCanvas(cv);
  ctx.fillStyle = '#0b1219'; ctx.fillRect(0, 0, W, H);
  const cx = 14, cy = H - 14, R = Math.min(W - 28, H - 24);
  const g = GOALS[p.goal];
  const max = 9, min = -21;
  const rr = (db) => R * clamp((db - min) / (max - min), 0, 1);
  // goal wedge
  const a0 = (g.angle - (p.goal === 'nvis' ? 15 : 8)) * Math.PI / 180, a1 = (g.angle + (p.goal === 'nvis' ? 15 : 8)) * Math.PI / 180;
  ctx.fillStyle = 'rgba(94,224,138,0.12)'; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, -a1, -a0); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(140,170,200,0.2)'; ctx.fillStyle = '#7f93a8'; ctx.font = '10px ui-monospace, monospace';
  for (const db of [6, 0, -10, -20]) { ctx.beginPath(); ctx.arc(cx, cy, rr(db), -Math.PI / 2, 0); ctx.stroke(); ctx.fillText(`${db}`, cx + rr(db) - 8, cy + 11); }
  for (const deg of [10, 30, 60, 90]) { const t = deg * Math.PI / 180; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(t) * R, cy - Math.sin(t) * R); ctx.stroke(); ctx.fillText(`${deg}°`, cx + Math.cos(t) * (R + 2), cy - Math.sin(t) * (R + 2)); }
  const trace = (hFt, col, dash) => {
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash(dash || []); ctx.beginPath();
    for (let d = 0.5; d <= 90; d += 0.5) { const gdb = elevGain(a.type, d, f, hFt * FT, a.ground); const t = d * Math.PI / 180; const x = cx + Math.cos(t) * rr(gdb), y = cy - Math.sin(t) * rr(gdb); d === 0.5 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
  };
  if (a.type !== 'vertical') trace(idealH, '#4fc3f7', [5, 4]);
  trace(a.type === 'vertical' ? 0 : a.height, '#ffb347');
  ctx.fillStyle = '#c9d6e3'; ctx.fillText('dBi', W - 26, 12);
}
