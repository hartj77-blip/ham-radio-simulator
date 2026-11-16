// "Find my location & design my antenna": one click locates you, loads the terrain around you,
// picks the band, antenna type, height, orientation and feedline for your goal and your site,
// solves the exact resonant length with the Method-of-Moments engine, raises it and explains
// every decision in a design report.
import { S, save } from './state.js';
import { h, bus, toast, modal, clamp } from './util.js';
import { icon } from './icons.js';
import { BANDS, bandByName, SIDEBAND_FOR } from './data/bandplan.js';
import { path as propPath, bandNoiseDbm, bearing, distanceKm, grid } from './propagation.js';
import { ANT_TYPES, FEEDS, feedLossDb, system } from './antenna.js';
import { qth, loadSite, terrain, heightFor, elevGain, autoSize, P } from './planner.js';
import { env, siteMaxHeight } from './yard.js';
import { rig } from './rigs.js';
import { GROUNDS } from './em/models.js';

const FT = 0.3048;
const GOALS = {
  allround: { label: 'All-round', desc: 'A good general-purpose antenna for the bands that are open now.', angle: 25, km: [800, 2500, 6000] },
  local: { label: 'Local & regional', desc: 'Nets, emergency communications and nearby states (NVIS, 0–800 km).', angle: 70, km: [150, 350, 600] },
  dx: { label: 'Long distance (DX)', desc: 'Other continents: low radiation angles toward the best-open direction.', angle: 12, km: [5000, 8000, 11000] },
  vhf: { label: 'VHF & repeaters', desc: '2 m FM: local repeaters and simplex, line of sight.', angle: 0, km: [] },
};
const REGIONS = [['Europe', 50, 10], ['Japan / Asia', 36, 139], ['South America', -15, -55], ['Africa', 0, 20], ['Australia / Pacific', -30, 145], ['North America', 45, -95]];

function dest(p, brg, km) {
  const R = 6371, d = km / R, th = brg * Math.PI / 180, la = p.lat * Math.PI / 180, lo = p.lon * Math.PI / 180;
  const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(th));
  const lo2 = lo + Math.atan2(Math.sin(th) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2));
  return { lat: la2 * 180 / Math.PI, lon: ((lo2 * 180 / Math.PI + 540) % 360) - 180 };
}

// Rank HF bands by how well they reach the goal's distances from here, right now.
function rankBands(me, goal) {
  const G = GOALS[goal];
  const can = (b) => !['6m', '2m'].includes(b.name) && (!rig().tx.length || rig().tx.includes(b.name));
  const out = [];
  for (const b of BANDS.filter(can)) {
    const f = (b.lo + b.hi) / 2e6;
    const noise = bandNoiseDbm(f, me);
    let snrs = [];
    for (const km of G.km) for (let brg = 0; brg < 360; brg += 45) snrs.push(50 - propPath(me, dest(me, brg, km), f).loss - noise);
    snrs.sort((a, c) => c - a);
    const top = snrs.slice(0, Math.ceil(snrs.length / 2));
    const score = top.reduce((s, x) => s + clamp(x, -20, 40), 0) / top.length + (goal === 'local' && f < 8 ? 3 : 0);
    out.push({ band: b.name, f, score, open: snrs.filter((x) => x > 6).length / snrs.length });
  }
  return out.sort((a, c) => c.score - a.score);
}

function allowed(type) { return env().types.includes(type); }
const axisFor = (brg) => ((Math.round((((brg + 90) % 180) + 180) % 180 / 45) * 45) % 180);

// Build the design (pure planning; no state changes).
function plan(goal, site) {
  const me = qth();
  const support = siteMaxHeight();
  const E = env();
  const ground = E.ground || 'average';
  const why = [];
  if (goal === 'vhf') {
    const type = allowed('vertical') ? 'vertical' : 'dipole';
    why.push(['Band', '2 m (146 MHz) — the busiest local band, with repeaters covering whole regions.']);
    why.push(['Antenna', `A quarter-wave ground plane: vertically polarised like every FM repeater and handheld, omnidirectional, and only ${(234 / 146).toFixed(1)} ft long.`]);
    why.push(['Height', `As high as your site allows (${support} ft). On VHF, range is set by line of sight: radio horizon ≈ 4.12 × √h(m) km, so every extra foot helps.`]);
    why.push(['Feedline', 'LMR-400: at 146 MHz, thin coax loses half your power in 100 ft; foam low-loss cable keeps it to about 1.4 dB.']);
    return { goal, band: '2m', type, height: support, ground, radials: 4, feed: 'LMR-400', axis: 0, heading: 0, why, fHz: 146.0e6, angle: 0 };
  }
  const ranked = rankBands(me, goal);
  const best = ranked[0];
  const B = bandByName(best.band);
  const f = best.f, lamFt = 984 / f;
  why.push(['Band', `${best.band}: from ${grid(me.lat, me.lon).slice(0, 4)} at this time of day it gives the best predicted signal-to-noise to ${goal === 'local' ? 'stations within about 600 km' : goal === 'dx' ? 'other continents' : 'typical distances'} (${ranked.slice(1, 3).map((r) => r.band).join(' and ')} come next). The ionospheric model accounts for the sun's position, MUF and D-layer absorption along each path.`]);
  // Best DX direction: open path and favourable terrain.
  let dir = null;
  if (goal !== 'local') {
    const cands = REGIONS.map(([name, la, lo]) => {
      const tgt = { lat: la, lon: lo };
      const brg = bearing(me, tgt), dist = distanceKm(me, tgt);
      if (dist < 1500) return null;
      const snr = 50 - propPath(me, tgt, f).loss - bandNoiseDbm(f, me);
      const prof = site?.profiles?.reduce((b, p) => (!b || Math.abs(((p.brg - brg + 540) % 360) - 180) < Math.abs(((b.brg - brg + 540) % 360) - 180) ? p : b), null);
      const t = prof ? terrain(prof, 10) : null;
      return { name, brg, dist, snr, t, score: snr - (t ? t.slope * 2 + t.horizon * 3 : 0) };
    }).filter(Boolean).sort((a, c) => c.score - a.score);
    dir = cands[0] || null;
  }
  const angle = clamp(GOALS[goal].angle - (dir?.t && Math.abs(dir.t.slope) >= 0.5 ? -dir.t.slope : 0), 5, 85);
  const idealH = heightFor(f, angle);
  // Choose the antenna type for the goal, band and site.
  let type;
  if (goal === 'local') type = allowed('dipole') ? 'dipole' : allowed('invv') ? 'invv' : 'efhw';
  else if (goal === 'dx' && f >= 13.9 && allowed('yagi') && support >= 30) type = 'yagi';
  else if (goal === 'dx' && support < idealH * 0.6 && allowed('vertical')) type = 'vertical';
  else type = allowed('dipole') ? 'dipole' : allowed('invv') ? 'invv' : allowed('efhw') ? 'efhw' : 'vertical';
  const typeWhy = {
    dipole: 'A half-wave dipole: about 50–75 Ω at resonance, a direct match to coax, efficient and predictable. Its pattern is broadside to the wire.',
    invv: 'An inverted-V dipole: it needs only one tall support at the centre, which suits your site, and its feed impedance is close to 50 Ω.',
    efhw: 'An end-fed half-wave: one wire fed at one end through a 49:1 transformer, ideal where there is no room to feed a wire in the middle.',
    vertical: `A quarter-wave vertical with 32 radials: your supports (${support} ft) cannot get a horizontal antenna high enough for low angles (${idealH.toFixed(0)} ft would be ideal), but a vertical radiates at low angles from ground level.`,
    yagi: `A 3-element Yagi on a rotator: about 6 dB more than a dipole toward the target and 15–20 dB less from behind — the single biggest improvement for DX on ${best.band}.`,
  };
  why.push(['Antenna', typeWhy[type] + (goal === 'local' ? ' For NVIS it is kept low so the energy goes nearly straight up and returns within a few hundred km.' : '')]);
  const height = type === 'vertical' ? 0 : Math.round(clamp(idealH, 10, support));
  if (type !== 'vertical') why.push(['Height', `${height} ft (${(height / lamFt).toFixed(2)} λ). The goal needs a main lobe near ${angle.toFixed(0)}°${dir?.t && Math.abs(dir.t.slope) >= 0.5 ? ` (corrected ${(-dir.t.slope).toFixed(1)}° for the terrain toward ${dir.name})` : ''}; that height is ${idealH.toFixed(0)} ft${idealH > support ? `, but the tallest support your site allows (tree, mast or tower) is ${support} ft, so it goes as high as possible` : ''}.`]);
  let axis = S.antenna.axis || 0, heading = S.antenna.heading || 45;
  if (dir && type === 'yagi') { heading = Math.round(dir.brg); why.push(['Direction', `Beam heading ${heading}° toward ${dir.name} (${Math.round(dir.dist).toLocaleString()} km), the most open region on ${best.band} right now${dir.t ? `; terrain that way ${dir.t.slope < -0.5 ? 'falls away, which helps' : dir.t.slope > 0.5 ? 'rises slightly' : 'is flat'}` : ''}.`]); }
  else if (dir && ['dipole', 'invv'].includes(type)) { axis = axisFor(dir.brg); why.push(['Orientation', `Wire run ${['N–S', 'NE–SW', 'E–W', 'NW–SE'][axis / 45]}, so the broadside lobes point toward ${dir.name} (${Math.round(dir.brg)}°) and the opposite direction.`]); }
  const feed = f > 21 ? 'LMR-400' : 'RG-213';
  const fl = S.antenna.feedLen || 75;
  why.push(['Feedline', `${feed}: ${feedLossDb(feed, fl, f).toFixed(2)} dB loss in ${fl} ft on ${best.band}, versus ${feedLossDb('RG-58', fl, f).toFixed(2)} dB for thin RG-58.`]);
  why.push(['Ground', `${GROUNDS[ground].label.split(' (')[0]} (from your ${E.label.toLowerCase()} site) — used by the solver for the length and by the pattern for the take-off angle.`]);
  return { goal, band: best.band, type, height, ground, radials: 32, feed, axis, heading, why, fHz: B.ph ? (B.ph[0] + B.ph[1]) / 2 : (B.lo + B.hi) / 2, angle, dir, ranked };
}

function locate() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(false);
    navigator.geolocation.getCurrentPosition((pos) => {
      S.op.lat = +pos.coords.latitude.toFixed(4); S.op.lon = +pos.coords.longitude.toFixed(4); save();
      bus.emit('qth'); resolve(true);
    }, () => resolve(false), { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 });
  });
}

export function openDesigner() {
  let close;
  const box = h('div', { class: 'designer' });
  const choose = () => {
    box.innerHTML = '';
    box.append(
      h('div', { class: 'eyebrow' }, 'Antenna designer'),
      h('h2', {}, 'Design the best antenna for my location'),
      h('p', { class: 'small muted' }, 'The designer finds your location, loads the terrain around you, ranks the bands with the propagation model for this time of day, chooses the antenna, height and orientation your site allows, and solves the exact length with the Method-of-Moments engine. Your location stays in this browser.'),
      h('div', { class: 'eyebrow muted' }, 'What do you want to do?'),
      h('div', { class: 'goal-grid' }, ...Object.entries(GOALS).map(([k, g]) => h('button', { class: 'goal-card', onclick: () => run(k) }, h('b', {}, g.label), h('span', { class: 'small muted' }, g.desc)))),
      h('p', { class: 'tiny muted' }, `Site: ${env().label}. Change it in the antenna builder on the Antenna page; the designer only uses supports that exist there.`));
  };
  const run = async (goal) => {
    box.innerHTML = '';
    const list = h('ol', { class: 'design-steps' });
    const step = (t) => { const li = h('li', { class: 'run' }, h('span', { class: 'ds-dot' }), h('span', {}, t)); list.append(li); return (ok = true, note) => { li.className = ok ? 'ok' : 'warn'; if (note) li.append(h('span', { class: 'tiny muted' }, ` — ${note}`)); }; };
    box.append(h('div', { class: 'eyebrow' }, 'Antenna designer'), h('h2', {}, `Designing: ${GOALS[goal].label}`), list);
    let s = step('Finding your location');
    const found = S.op.lat != null || await locate();
    const q = qth();
    s(true, found ? `${q.lat.toFixed(3)}, ${q.lon.toFixed(3)} (${grid(q.lat, q.lon).slice(0, 6)})` : `location unavailable, using the centre of your state (${grid(q.lat, q.lon).slice(0, 4)})`);
    s = step('Loading terrain');
    let site = null;
    try { site = await loadSite(); s(true, `${site.elevM.toFixed(0)} m elevation · ${site.source}`); } catch (e) { s(false, 'elevation service unavailable, assuming flat ground'); }
    s = step('Ranking bands with the propagation model');
    const d = plan(goal, site);
    s(true, `${d.band} is best now`);
    s = step(`Solving the resonant length (${ANT_TYPES[d.type].label})`);
    const a = S.antenna;
    Object.assign(a, { type: d.type, height: d.height || a.height, ground: d.ground, radials: d.radials, feed: d.feed, axis: d.axis, heading: d.heading, built: false });
    a.insulated ??= true; a.wire ||= 'AWG 14 copper';
    const formula = Math.round(ANT_TYPES[d.type].k / (d.fHz / 1e6) * 100) / 100;
    let L = formula, solved = false;
    try { L = await autoSize(a, d.fHz, () => {}); solved = true; s(true, `${L.toFixed(2)} ft (formula: ${formula.toFixed(2)} ft)`); } catch (e) { s(false, `solver unavailable, using the formula: ${formula} ft`); }
    a.length = L; a.sizedBy = 'auto'; a.built = true; a.spliced = 0;
    P().band = d.band;
    S.radio.atuTunedFreq = null;
    save();
    bus.emit('antenna'); bus.emit('antenna-rebuild'); bus.emit('plan-band', d.band);
    const sys = system(d.fHz);
    const b = bandByName(d.band);
    let lo = null, hi = null;
    for (let i = 0; i <= 120; i++) { const f = b.lo - (b.hi - b.lo) * 0.5 + (b.hi - b.lo) * 2 * i / 120; const x = system(f); if (x && x.swrRig < 2) { lo ??= f; hi = f; } }
    s = step('Raising the antenna');
    s(true, sys ? `SWR ${sys.swrRig.toFixed(2)}:1 at ${(d.fHz / 1e6).toFixed(3)} MHz` : 'done');
    const g = d.type === 'vertical' || d.goal === 'vhf' ? null : elevGain(d.type, d.angle || 25, d.fHz / 1e6, d.height * FT, d.ground);
    box.append(
      h('div', { class: 'readouts' },
        h('div', {}, h('span', {}, 'Band'), h('b', {}, d.band)),
        h('div', {}, h('span', {}, 'Antenna'), h('b', {}, ANT_TYPES[d.type].label)),
        h('div', {}, h('span', {}, 'Length'), h('b', {}, `${L.toFixed(2)} ft${['dipole', 'invv'].includes(d.type) ? ` (2 × ${(L / 2).toFixed(2)})` : ''}`)),
        h('div', {}, h('span', {}, 'Height'), h('b', {}, d.type === 'vertical' ? 'ground mounted' : `${d.height} ft`)),
        h('div', {}, h('span', {}, 'SWR at design frequency'), h('b', { class: sys && sys.swrRig < 1.5 ? 'ok' : 'warn' }, sys ? `${sys.swrRig.toFixed(2)}:1` : '—')),
        h('div', {}, h('span', {}, '2:1 bandwidth'), h('b', {}, lo ? `${(lo / 1e6).toFixed(3)}–${(hi / 1e6).toFixed(3)} MHz` : '—')),
        g != null ? h('div', {}, h('span', {}, `Gain at ${d.angle.toFixed(0)}° elevation`), h('b', {}, `${g.toFixed(1)} dBi`)) : '',
        h('div', {}, h('span', {}, 'Feedline'), h('b', {}, `${d.feed}, ${(sys?.totalLoss ?? 0).toFixed(2)} dB`))),
      h('h4', {}, 'Why this design'),
      h('dl', { class: 'design-why' }, ...d.why.flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)])),
      !solved ? h('p', { class: 'tiny warn' }, 'The length solver could not run, so the formula length was used; check the analyzer and trim if needed.') : '',
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', onclick: () => { close(); bus.emit('tune-to', d.goal === 'vhf' ? 146.52e6 : b.ph ? d.fHz : b.def, d.goal === 'vhf' ? 'FM' : b.ph ? SIDEBAND_FOR(d.fHz) : b.defMode); } }, h('span', { html: icon('radio') }), `Tune the radio to ${d.band}`),
        h('button', { class: 'btn', onclick: () => { close(); bus.emit('goto', 'antenna'); } }, 'See it on the Antenna page'),
        h('button', { class: 'btn ghost', onclick: choose }, 'Try another goal')));
    if (S.mode === 'free') bus.emit('tune-to', d.goal === 'vhf' ? 146.52e6 : b.ph ? d.fHz : b.def, d.goal === 'vhf' ? 'FM' : b.ph ? SIDEBAND_FOR(d.fHz) : b.defMode);
    toast(`Antenna designed and raised: ${ANT_TYPES[d.type].label}, ${L.toFixed(2)} ft for ${d.band}.`, 'good', 5000);
  };
  choose();
  close = modal(box, { wide: true });
}
