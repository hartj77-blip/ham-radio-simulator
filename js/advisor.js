// "Station plan for my location": an educational report that looks at where you actually are
// (grid square, elevation, terrain toward each continent, man-made noise, latitude, live MUF),
// asks where you will operate and what you want to do, and then recommends a whole station —
// radio, HF antenna, VHF/UHF, best bands by time of day, power, feedline, grounding and the
// local rules — explaining every recommendation with the facts of your location. One click
// applies it.
import { S, save } from './state.js';
import { h, bus, toast, modal, clamp } from './util.js';
import { icon } from './icons.js';
import { BANDS, bandByName } from './data/bandplan.js';
import { path as propPath, bandNoiseDbm, bearing, distanceKm, grid, interp, dayFactor, mufAt, bandConditions, sUnits, SUN } from './propagation.js';
import { ANT_TYPES, feedLossDb } from './antenna.js';
import { qth, loadSite, terrain, heightFor } from './planner.js';
import { ENVS } from './yard.js';
import { RIGS } from './rigs.js';
import { SETUPS, applySetup, cutFor } from './setups.js';
import { maxHeight } from './limits.js';
import { RW } from './realworld.js';
import { openDesigner } from './autodesign.js';

const FT = 0.3048;

export const PLAN_STEP = {
  m: 'antenna', kind: 'read', title: 'Plan a station for your location', ref: 'height-ground',
  text: 'Open <b>Station plan for my location</b>. Tell it where you will operate and what interests you, then read the report: it uses your grid square, elevation, the terrain toward each continent, the noise of your site and the live MUF to recommend a radio, an HF antenna (type, length, height and direction), a VHF antenna, the best bands for each time of day, the feedline and the grounding, and explains why for each. Apply the station when you are done.',
};

const GOALS = {
  local: { label: 'Local & emergency', desc: 'Repeaters, nets, emergency communications and nearby states.' },
  dx: { label: 'Long-distance HF', desc: 'Other continents: DX, contests, low radiation angles.' },
  allround: { label: 'All-round', desc: 'A bit of everything: HF across the day plus 2 m locally.' },
  listen: { label: 'Listening only', desc: 'Shortwave, broadcast, airband and weather. No licence needed.' },
};
const REGIONS = [['Europe', 50, 10], ['Japan / Asia', 36, 139], ['South America', -15, -55], ['Africa', 0, 20], ['Australia / Pacific', -30, 145], ['North America', 45, -95]];
const PERIODS = [['Morning', 8], ['Afternoon', 14], ['Evening', 19], ['Night', 2]];
const RANGES = [['Regional', '200–800 km', [300, 600]], ['Domestic', '1,000–3,000 km', [1500, 2500]], ['Long distance', '5,000 km +', [6000, 9000]]];
const FEED_LEN = { suburban: 75, rural: 150, city: 100, apartment: 30, hoa: 50, park: 25, summit: 25, vehicle: 15, boat: 35, beach: 50 };
const PORTABLE = ['park', 'summit', 'vehicle', 'beach'];
const HF = BANDS.filter((b) => !['6m', '2m'].includes(b.name));
const fOf = (b) => (b.lo + b.hi) / 2e6;
const lam = (f) => 984 / f; // wavelength in ft
const ft = (x) => `${Math.round(x)} ft`;
const an = (w) => (/^[aeiou]/i.test(w) ? `an ${w}` : `a ${w}`);
const m = (x) => `${Math.round(x)} m`;

function dest(p, brg, km) {
  const R = 6371, d = km / R, th = brg * Math.PI / 180, la = p.lat * Math.PI / 180, lo = p.lon * Math.PI / 180;
  const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(th));
  const lo2 = lo + Math.atan2(Math.sin(th) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2));
  return { lat: la2 * 180 / Math.PI, lon: ((lo2 * 180 / Math.PI + 540) % 360) - 180 };
}

// ------------------------------------------------------------------ location
function locate() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(false);
    navigator.geolocation.getCurrentPosition((pos) => {
      S.op.lat = +pos.coords.latitude.toFixed(4); S.op.lon = +pos.coords.longitude.toFixed(4); save();
      bus.emit('qth'); resolve(true);
    }, () => resolve(false), { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 });
  });
}
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

// Usable heights at a site, from the yard's supports (the user's edited copy when there is one).
function siteHeights(id) {
  const E = ENVS[id], y = S.yard?.envs?.[id];
  const sup = y?.sup || E.sup, floor = y?.floor ?? E.floors ?? 0;
  const base = (p) => (p.onFloor ? (floor || 1) * 10 : p.onRoof ? (floor || E.floors || 1) * 10 + 4 : 0);
  const top = (p) => base(p) + (p.kind === 'tree' ? Math.min(p.h, 60) : p.kind === 'mast' ? Math.min(p.h, maxHeight()) : p.h);
  const tops = sup.map(top).sort((a, b) => b - a);
  const mast = sup.find((p) => p.kind === 'mast');
  const mountable = sup.filter((p) => p.kind !== 'tree').map(top);
  return { max: tops[0], second: tops[1] ?? tops[0], mast: mast ? top(mast) : null, vhf: id === 'vehicle' ? 6 : Math.max(...(mountable.length ? mountable : tops)), floorFt: E.floors ? (floor || E.floors) * 10 : 0, lot: y?.lot ?? E.lot };
}

// Run fn with the simulated clock at a given UTC hour (and live ionosphere off, so the model
// follows the hour), then restore it. Never saved.
function atHour(utcH, fn) {
  const had = Object.prototype.hasOwnProperty.call(S.settings, 'hour'), prev = S.settings.hour;
  S.settings.hour = utcH;
  try { const d = new Date(); d.setUTCHours(Math.floor(utcH), Math.round((utcH % 1) * 60), 0, 0); return fn(d); }
  finally { if (had) S.settings.hour = prev; else delete S.settings.hour; }
}
const utcFor = (localSolar, lon) => (((localSolar - lon / 15) % 24) + 24) % 24;

// Predicted SNR (100 W into a dipole, 2.4 kHz) for each HF band over a set of distances, all bearings.
function bandScores(me, kms, envNoise, d) {
  return HF.map((b) => {
    const f = fOf(b), noise = bandNoiseDbm(f, me) + envNoise * (f > 30 ? 0.5 : 1);
    const snrs = [];
    for (const km of kms) for (let brg = 0; brg < 360; brg += 45) snrs.push(50 - propPath(me, dest(me, brg, km), f, d).loss - noise);
    snrs.sort((a, c) => c - a);
    const top = snrs.slice(0, Math.ceil(snrs.length / 2));
    return { band: b.name, f, snr: top.reduce((s, x) => s + x, 0) / top.length };
  }).sort((a, c) => c.snr - a.snr);
}

function timeTable(me, envNoise) {
  return PERIODS.map(([label, loc]) => atHour(utcFor(loc, me.lon), (d) => ({
    label, loc, df: dayFactor(me, d), muf: mufAt(me, d).muf,
    cells: RANGES.map(([, , kms]) => bandScores(me, kms, envNoise, d).filter((x) => x.snr > 3).slice(0, 2)),
  })));
}

// The region with the best opening on this band at some point of the day, corrected for terrain.
function bestRegion(me, f, site, hM) {
  return REGIONS.map(([name, la, lo]) => {
    const tgt = { lat: la, lon: lo }, dist = distanceKm(me, tgt);
    if (dist < 2500) return null;
    const brg = bearing(me, tgt);
    const snr = Math.max(...PERIODS.map(([, loc]) => atHour(utcFor(loc, me.lon), (d) => 50 - propPath(me, tgt, f, d).loss - bandNoiseDbm(f, me))));
    const prof = site?.profiles?.reduce((b, p) => (!b || Math.abs(((p.brg - brg + 540) % 360) - 180) < Math.abs(((b.brg - brg + 540) % 360) - 180) ? p : b), null);
    const t = prof ? terrain(prof, hM) : null;
    return { name, brg, dist, snr, t, score: snr - (t ? t.slope * 2 + Math.max(0, t.horizon) * 3 : 0) };
  }).filter(Boolean).sort((a, c) => c.score - a.score)[0] || null;
}

// ------------------------------------------------------------------ the plan
function buildPlan(envId, goal, site, found) {
  const me = qth(), E = ENVS[envId], H = siteHeights(envId), T = E.types;
  const g6 = grid(me.lat, me.lon).slice(0, 6), g4 = g6.slice(0, 4);
  const out = { envId, goal, me, E, H, g6, found, site };
  const portable = PORTABLE.includes(envId);
  const where = E.label.toLowerCase();

  // --- location facts
  const df = dayFactor(me);
  const solarNow = ((new Date().getUTCHours() + new Date().getUTCMinutes() / 60 + me.lon / 15) % 24 + 24) % 24;
  const muf = mufAt(me);
  const conds = bandConditions(me);
  const absLat = Math.abs(me.lat);
  const euPath = [0.25, 0.5, 0.75].map((x) => Math.abs(interp(me, { lat: 50, lon: 10 }, x).lat));
  const euMax = Math.max(...euPath);
  const n40 = sUnits(bandNoiseDbm(7.1, me) + E.noise), n20 = sUnits(bandNoiseDbm(14.2, me) + E.noise);
  const haat = site ? site.elevM - site.profiles.reduce((s, p) => s + terrain(p, 0).avgFar, 0) / site.profiles.length : null;
  out.loc = { df, solarNow, muf, conds, absLat, euMax, n40, n20, haat };
  const L = [];
  L.push(['Grid square', `${g6}${found ? ' from your device location' : ' — the centre of your state, because your location was not available. Allow location access and reopen the plan for an exact result'}. Grid squares are how hams exchange location in contests, on VHF and in FT8; yours is ${g4}.`]);
  if (site) L.push(['Elevation', `${m(site.elevM)} (${ft(site.elevM / FT)}) above sea level${haat != null ? `, ${haat >= 0 ? `${m(haat)} above` : `${m(-haat)} below`} the average terrain 3–16 km around you` : ''}. Elevation above sea level does nothing for HF by itself; what matters is the slope of the land within about 1.5 km (it tilts the radiation pattern) and, on VHF, how high you are above the surrounding terrain${haat != null ? (haat > 30 ? ' — you are on high ground, which is a real VHF advantage' : haat < -30 ? ' — you are lower than the land around you, so nearby high ground can shadow VHF signals' : '') : ''}.`]);
  else L.push(['Elevation', 'The elevation service could not be reached, so the plan assumes flat ground. Terrain only changes the details (height and direction), not the type of station.']);
  L.push(['Noise', `A ${where} has man-made noise ${E.noise > 0 ? `about ${E.noise} dB above` : E.noise < 0 ? `about ${-E.noise} dB below` : 'equal to'} a typical residential area. Expect a band-noise floor near ${n40.text} on 40 m and ${n20.text} on 20 m right now. ${E.noise >= 6 ? 'Noise, not power, will limit what you can hear: favour CW and FT8, the higher bands, and a receiver with good noise reduction.' : E.noise <= -4 ? 'A quiet site is worth more than an amplifier: you will hear stations that are buried in town noise.' : 'This is the reference level the band-noise model assumes.'}`]);
  L.push(['Latitude', absLat >= 55
    ? `${absLat.toFixed(1)}° is inside or near the auroral zone: geomagnetic storms (K 5 and above) cause auroral absorption that can close HF for hours, especially on polar paths. The higher bands and daylight paths to the south suffer least; on VHF, aurora itself becomes a propagation mode.`
    : absLat <= 25
      ? `${absLat.toFixed(1)}° is close to the geomagnetic equator: the F2 layer is densest here, so 15, 12 and 10 m open more often and stay open later than at mid-latitudes, and trans-equatorial propagation (TEP) can link you to the other hemisphere in the evening.`
      : `${absLat.toFixed(1)}° is a mid-latitude location. Your great-circle path to Europe reaches ${euMax.toFixed(0)}°${me.lon < -30 ? 'N' : ''}${euMax > 58 ? ', inside the auroral zone, so that path weakens when the K-index rises' : ', clear of the auroral zone'} (K is ${SUN.k} now).`]);
  L.push(['Right now', `Local solar time about ${String(Math.floor(solarNow)).padStart(2, '0')}:${String(Math.floor((solarNow % 1) * 60)).padStart(2, '0')}, ${df > 0.8 ? 'full daylight: the D layer absorbs 160–40 m during the day and the higher MUF opens 20–10 m' : df < 0.05 ? 'night: absorption is gone, so 80 and 40 m carry long distances while the high bands close' : 'twilight (greyline): absorption is low while the F layer is still ionised — a favourite time for long-distance contacts'}. The MUF for a 3,000 km hop over you is ${muf.muf.toFixed(1)} MHz (${muf.live ? 'live ionosonde-assimilated data' : 'modelled'}), so bands below about ${(muf.muf * 0.85).toFixed(0)} MHz support domestic skip.`]);
  out.locWhy = L;

  // --- radio
  let rig, alt = null; const RW_ = [];
  if (goal === 'listen') { rig = 'sdrrx'; RW_.push(`A wideband SDR receiver covers everything from AM broadcast to airband and 70 cm in one box, shows a waterfall of whole bands, and needs no licence.`); }
  else if (['park', 'summit'].includes(envId)) { rig = 'qrp'; alt = 'ht'; RW_.push(`At ${an(where)} every gram and every amp-hour counts: a 10 W battery transceiver draws about 2.5 A on transmit versus over 20 A for a 100 W base radio, so a small LiFePO4 pack lasts a whole activation. 10 W is about 1 S-unit below 100 W; CW and FT8 make up the difference.`); }
  else if (envId === 'vehicle') { rig = 'allmode'; RW_.push('A 100 W all-band radio with a detachable head is the classic mobile installation: HF on the loaded whip, 2 m FM on a roof magmount. Wire it directly to the battery with fuses in both leads.'); }
  else if (['apartment', 'hoa'].includes(envId)) {
    rig = 'allmode'; alt = goal === 'local' ? 'ht' : 'qrp';
    RW_.push(`An all-band base radio gives you HF and 2 m from one box, with an internal tuner for the compromise antennas ${an(where)} allows. Run it at 25–50 W: the antenna is close to people and to your neighbours' electronics, and halving power costs only half an S-unit.`);
  } else if (goal === 'dx' && envId === 'rural') { rig = 'contest'; RW_.push(`At a quiet rural site the band noise is about ${-E.noise} dB lower than in town, so the receiver's own noise and its narrow filters start to matter: a contest-grade receiver pulls out the weak DX a town station never hears. (In a city, the band noise would swamp that advantage.)`); }
  else if (goal === 'dx') { rig = 'sdr100'; RW_.push(`For DX, a direct-sampling SDR transceiver gives a wide waterfall to spot openings, narrow CW filters and DSP noise reduction — useful against the ${E.noise > 0 ? 'higher ' : ''}man-made noise of ${an(where)}.`); }
  else { rig = 'allmode'; RW_.push('An all-band 100 W base transceiver (HF, 6 m and 2 m) is the best first radio: every band and mode, an internal tuner, a spectrum scope and general-coverage receive.'); }
  if (goal === 'local' && !alt && rig !== 'qrp') { alt = 'ht'; RW_.push('Add a dual-band handheld as a go-kit: in an emergency you take it with you, and it reaches the local repeaters from almost anywhere in town.'); }
  if (alt === 'qrp') RW_.push('Alternative: a 10 W QRP field radio. Less power means less interference to neighbours and a smaller RF-exposure distance, and it goes to the park when you want a better antenna site.');
  if (alt === 'ht' && goal !== 'local') RW_.push('Add a dual-band handheld for repeaters and simplex; on summits and in parks it also spots you to local stations.');
  out.rig = rig; out.alt = alt; out.rigWhy = RW_;

  // --- HF antenna
  const A = { why: [] };
  const pick = (...ts) => ts.find((t) => T.includes(t));
  if (envId === 'vehicle') Object.assign(A, { type: 'vertical', band: '20m', note: 'loaded HF whip (about 7 ft)' });
  else if (envId === 'boat') Object.assign(A, { type: 'vertical', band: '20m', note: 'insulated backstay with an automatic tuner at its base' });
  else if (goal === 'listen') Object.assign(A, { type: 'efhw', band: '40m', note: 'long wire for receiving' });
  else if (goal === 'local' && envId === 'apartment') Object.assign(A, { type: 'efhw', band: '40m', multi: true, note: 'from the balcony to the courtyard tree' });
  else if (goal === 'local') Object.assign(A, { type: pick('dipole', 'invv', 'efhw'), band: '40m', nvis: true });
  else if (goal === 'dx') {
    if (['beach'].includes(envId)) Object.assign(A, { type: 'vertical', band: '20m' });
    else if (T.includes('yagi') && envId === 'rural' && H.mast >= 30) Object.assign(A, { type: 'yagi', band: '20m' });
    else if (['park', 'summit', 'apartment'].includes(envId)) Object.assign(A, { type: 'efhw', band: '20m' });
    else if (T.includes('dipole') && H.second - 2 >= lam(14.2) * 0.45) Object.assign(A, { type: 'dipole', band: '20m' });
    else Object.assign(A, { type: pick('vertical', 'efhw', 'dipole'), band: '20m' });
  } else {
    if (['apartment', 'park', 'summit', 'beach'].includes(envId)) Object.assign(A, { type: pick('efhw', 'invv', 'vertical'), band: '40m', multi: true });
    else if (envId === 'hoa') Object.assign(A, { type: 'dipole', band: '20m' });
    else if (T.includes('dipole') && H.lot >= 66) Object.assign(A, { type: 'dipole', band: '40m' });
    else Object.assign(A, { type: pick('efhw', 'invv', 'vertical'), band: '40m', multi: true });
  }
  const bf = fOf(bandByName(A.band)), lamFt = lam(bf);
  A.length = cutFor(A.type, A.band);
  const angle = A.nvis ? 75 : goal === 'dx' ? 12 : 25;
  const ideal = heightFor(bf, angle);
  const avail = A.type === 'dipole' ? H.second - 2 : A.type === 'yagi' ? (H.mast || 35) + 3 : H.max - 1;
  if (A.type === 'vertical') A.height = envId === 'vehicle' ? 4 : 0;
  else if (A.nvis) A.height = Math.round(clamp(0.2 * lamFt, 12, avail));
  else A.height = Math.round(clamp(ideal, 10, avail));
  A.region = A.nvis || envId === 'apartment' || A.type === 'vertical' || A.type === 'efhw' && goal === 'listen' ? null : bestRegion(me, bf, site, A.height * FT);
  A.axis = A.region ? ((Math.round((((A.region.brg + 90) % 180) + 180) % 180 / 45) * 45) % 180) : (S.antenna.axis || 0);
  A.heading = A.region ? Math.round(A.region.brg) : (S.antenna.heading || 45);
  const lab = ANT_TYPES[A.type].label;
  const typeWhy = {
    dipole: `A half-wave dipole is the reference antenna: about 50–75 Ω at the centre, so it matches coax directly, and it is efficient and predictable.${A.band === '40m' ? ' Cut for 40 m it is also resonant on 15 m (its third harmonic), and the radio\'s tuner handles the rest.' : ''}`,
    invv: 'An inverted-V needs only one tall support in the middle and drops its legs toward the ground, so it fits where there is one good support.',
    efhw: `An end-fed half-wave is one wire fed at the end through a 49:1 transformer — ideal where you cannot get coax to the middle of a wire${A.band === '40m' ? '. Cut for 40 m it is resonant on 40, 20, 15 and 10 m without a tuner' : ''}.`,
    vertical: envId === 'vehicle' ? 'On a vehicle only a vertical is practical: a loaded whip about 7 ft long, using the car body as its ground. It is a compromise (about −4 dB on 20 m, −8 dB on 40 m) but a mobile station works the whole country.' : (E.ground === 'salt' ? 'Over salt water a vertical is the best antenna there is: the sea is an almost perfect ground plane, so it radiates at the very low angles that reach other continents — the reason DXpeditions set up at the water\'s edge.' : 'A quarter-wave vertical radiates equally in all directions at low angles, which suits long distance; it needs radials (16 or more on the ground) to be efficient.'),
    yagi: `A 3-element Yagi on a rotator: about 6 dB of gain toward the target and 15–20 dB rejection from behind. With space and a tower, nothing improves DX more on 20 m.`,
  };
  A.why.push(['Type', `${lab}${A.note ? ` (${A.note})` : ''}. ${typeWhy[A.type]}${!T.includes('yagi') && goal === 'dx' ? ` A beam is not practical at ${an(where)}.` : ''}`]);
  A.why.push(['Length', `${A.length} ft${['dipole', 'invv'].includes(A.type) ? ` (two legs of ${(A.length / 2).toFixed(1)} ft)` : ''}, from ${({ dipole: 468, invv: 455, vertical: 234, efhw: 456, yagi: 445 })[A.type]} / f(MHz) at ${bf.toFixed(2)} MHz. Cut it a little long and trim it while watching the SWR dip — nearby objects shift resonance a few percent.${A.type === 'dipole' && A.length + 10 > H.lot ? ` It is longer than your ${H.lot} ft of space, so let the ends drop or bend.` : ''}`]);
  if (A.type === 'vertical') A.why.push(['Height', envId === 'vehicle' ? 'On the trunk lip or roof, as high and as central on the metal body as you can.' : E.ground === 'salt' ? 'At ground level, within a wavelength of the water — the closer to the sea, the lower the take-off angle.' : `Ground-mounted with radials, or elevated on a support with 2–4 elevated radials. Height is not critical for a vertical; the radial system is.`]);
  else if (A.nvis) A.why.push(['Height', `${ft(A.height)} (${(A.height / lamFt).toFixed(2)} λ). For near-vertical incidence skywave (NVIS) a low dipole — 0.1 to 0.25 λ — sends most energy straight up, and the ionosphere returns it within 0–600 km with no skip zone. That is why emergency networks use 40 m by day and 80 m at night on low wires.`]);
  else A.why.push(['Height', `${ft(A.height)} (${(A.height / lamFt).toFixed(2)} λ). ${goal === 'dx' ? 'Long distance needs a main lobe near 12°' : 'General use wants a main lobe near 25°'}, which a horizontal antenna gets at ${ft(ideal)} (h = λ / 4 sin θ)${ideal > avail ? `; ${A.type === 'yagi' ? `your tower puts the boom at ${ft(avail)}; a 50–70 ft tower is the classic upgrade, because every extra foot lowers the angle` : `the tallest usable ${A.type === 'dipole' ? 'pair of supports' : 'support'} at your site is ${ft(avail)}, so go as high as you can — every extra foot lowers the angle`}` : '; your supports reach that'}.${H.floorFt && A.type !== 'yagi' ? ` The building raises it ${H.floorFt} ft above the street, but the roof and floors below act as a lossy ground.` : ''}`]);
  if (A.region) {
    const t = A.region.t;
    A.why.push([A.type === 'yagi' ? 'Direction' : 'Orientation', `${A.type === 'yagi' ? `Point the beam at ${A.heading}°` : `Run the wire ${['N–S', 'NE–SW', 'E–W', 'NW–SE'][A.axis / 45]} so its broadside lobes point at ${Math.round(A.region.brg)}° and the reverse`}: toward ${A.region.name} (${Math.round(A.region.dist).toLocaleString()} km), the region with the strongest predicted opening on ${A.band} from ${g4} over the day${t ? `. The terrain that way ${t.slope < -0.5 ? `falls away (${t.slope.toFixed(1)}°), which lowers your take-off angle — free gain` : t.slope > 0.5 ? `rises (${t.slope.toFixed(1)}°), which raises your take-off angle slightly` : 'is flat'}${t.horizon > 1 ? ` and hills block angles below ${t.horizon.toFixed(1)}°` : ''}` : ''}.`]);
  } else if (A.type !== 'vertical' && !A.nvis) A.why.push(['Orientation', 'Not critical here: a low or end-fed wire on several bands radiates in many directions.']);
  else if (envId === 'apartment') A.why.push(['Orientation', `Set by your building: run the wire from the balcony toward the courtyard tree (or along the outside wall) — getting it outside and away from the concrete matters far more than its direction.${goal === 'local' ? ' A wire this high is not an NVIS antenna, so for local work 2 m from the balcony is your main tool and HF covers the regional nets on 40 m.' : ''}`]);
  else if (A.nvis) A.why.push(['Orientation', 'Not critical for NVIS: a low dipole radiates nearly straight up, so its signal comes down in all directions around you.']);
  out.hf = A;

  // --- VHF/UHF
  const up = Math.max(0, haat ?? 0), hAgl = H.vhf, h1 = hAgl * FT + up, hHt = 1.5 + up;
  const R = (a, b) => 4.12 * (Math.sqrt(a) + Math.sqrt(b));
  const V = { hAgl, h1, simplex: R(h1, 10), rpt: R(h1, 150), ht: R(hHt, 10), htRpt: R(hHt, 150) };
  V.needRoof = !['vehicle', 'park', 'summit'].includes(envId) && V.simplex > V.ht * 1.25;
  V.why = [
    ['Horizon', `Radio horizon d ≈ 4.12 (√h₁ + √h₂) km with heights in metres (the 4/3-earth radio horizon). Your antenna at about ${ft(hAgl)} ${haat != null && haat > 5 ? `plus the ${m(haat)} you sit above the surrounding terrain ` : ''} gives ≈ ${V.simplex.toFixed(0)} km to another base station 10 m up, and ≈ ${V.rpt.toFixed(0)} km to a repeater 150 m above the terrain.${haat != null && haat < -20 ? ` You sit about ${m(-haat)} below the average terrain around you, so higher ground will shadow some directions; a repeater on a hilltop is the way over it.` : ''}`],
    ['Antenna', V.needRoof ? `Yes, put an outdoor antenna up: a handheld at street level reaches only ≈ ${V.ht.toFixed(0)} km simplex, and indoors it loses another 10–20 dB to the walls. A quarter-wave ground plane or a collinear at ${ft(hAgl)} ${envId === 'apartment' ? 'on the balcony' : envId === 'city' ? 'on the roof' : 'on the mast or roof'} more than doubles your coverage${envId === 'apartment' ? ' — your floor height is the best thing about an apartment for VHF' : envId === 'city' ? ' — a rooftop is the best VHF site in town' : ''}.` : envId === 'vehicle' ? 'A 5/8-wave magmount in the middle of the roof: the metal roof is its ground plane, and it is 3 dB better than a quarter wave at low angles.' : `A handheld with a better antenna (a 19-inch quarter-wave whip or a roll-up J-pole hung high) is enough at ${an(where)}: being up on a hill or out in the open is what counts on VHF.`],
    ['Repeaters', `Typical repeaters sit on hills or towers and cover 40–80 km for a mobile. From your antenna, line of sight to a well-sited repeater is ≈ ${V.rpt.toFixed(0)} km; a handheld at ground level gets ≈ ${V.htRpt.toFixed(0)} km. Beyond the horizon, signals drop fast.`],
    ['Feedline', `At 146 MHz coax loss is 3–4× higher than on HF: ${FEED_LEN[envId]} ft of RG-58 loses ${feedLossDb('RG-58', FEED_LEN[envId], 146).toFixed(1)} dB, LMR-400 only ${feedLossDb('LMR-400', FEED_LEN[envId], 146).toFixed(1)} dB.`],
  ];
  out.vhf = V;

  // --- time-of-day table
  out.times = timeTable(me, E.noise);

  // --- power, feedline, grounding
  const len = FEED_LEN[envId], fmax = A.multi || A.type === 'dipole' && A.band === '40m' ? 28.5 : bf;
  const coaxes = ['RG-58', 'RG-8X', 'RG-213', 'LMR-400'];
  const feed = (portable ? coaxes : coaxes.slice(1)).find((c) => feedLossDb(c, len, fmax) <= (portable ? 1.2 : 1)) || 'LMR-400';
  out.feed = feed; out.feedLen = len; out.coaxes = coaxes; out.fmax = fmax;
  const pw = rig === 'qrp' ? 10 : rig === 'sdrrx' ? 0 : ['apartment', 'hoa'].includes(envId) ? 50 : 100;
  // RF exposure: minimum distance on 10 m (uncontrolled limit 180/f² mW/cm²), 50 % duty (FT8), dipole gain, ground reflection 2.56.
  const rfx = (w, f) => Math.sqrt(2.56 * w * 1000 * 0.5 * 1.64 / (4 * Math.PI * (180 / (f * f)))) / 100;
  out.power = pw;
  const P = [];
  if (pw) P.push(['Power', `${pw} W${pw === 100 ? ' is the standard for a home station; an amplifier adds about 1 S-unit per 4× power and is the last thing to buy — antenna and site come first' : pw === 50 ? ' (turned down from 100 W): in an apartment or attic the antenna is close to people and neighbours\' electronics, and 50 W is only half an S-unit below 100 W' : ': battery-friendly, and with CW or FT8 a 10 W signal is readable around the world when the band is open'}.`]);
  P.push(['Feedline', `${feed} for about ${len} ft: ${feedLossDb(feed, len, fmax).toFixed(2)} dB at ${fmax.toFixed(0)} MHz (the highest band you will use — loss rises with frequency). ${portable ? 'At a portable site light coax matters more than a fraction of a dB.' : `RG-58 would lose ${feedLossDb('RG-58', len, fmax).toFixed(2)} dB over the same run.`}${['efhw', 'vertical'].includes(A.type) ? ' Put a common-mode choke at the feed point so the coax shield does not become part of the antenna and carry RF into the house.' : ' Use a 1:1 current balun at the dipole centre.'}`]);
  const G = {
    suburban: 'Bring the coax in through a grounded entry panel with a lightning arrestor, bond that ground rod to the house electrical service ground (NEC 810 / your national code), and disconnect the antenna when storms are forecast.',
    rural: 'Tall trees and a tower in open country attract lightning: a single-point ground panel, arrestors on every line, a ground rod at the tower base bonded to the service ground, and disconnect when storms approach. Long coax runs need their shields grounded where they enter the building.',
    city: 'Bond the mast to the building\'s lightning-protection system (ask the building engineer), run coax down a riser rather than over the parapet, and fit an arrestor where it enters your space.',
    apartment: 'You usually cannot install a proper ground on a balcony: use a temporary antenna, disconnect and bring it in when storms are forecast, and never leave a wire up unattended in a thunderstorm. A common-mode choke keeps RF off the coax and out of the building wiring.',
    hoa: 'An attic antenna is protected by the house, but the coax should still pass a grounded arrestor; bond a flagpole vertical to a ground rod and to the service ground.',
    park: 'No ground needed for a temporary station, but take the antenna down and leave at the first thunder — a wire in a tree is a lightning target.',
    summit: 'Summits are the most dangerous place to be in a thunderstorm: check the forecast, pack up at the first sign of build-up, and descend.',
    vehicle: 'Bond the mount, trunk lid, hood and exhaust to the body; ground the radio\'s negative lead at the battery. Lightning protection is the car body itself.',
    boat: 'Bond the tuner and counterpoise to the keel or a sintered-bronze ground plate; a lightning-protection path from the mast to the water is standard practice.',
    beach: 'Keep the antenna away from the tide line in wet salt sand, and leave at the first thunder: an open beach is a lightning hazard.',
  };
  P.push(['Grounding', G[envId]]);
  if (pw) P.push(['RF exposure', `Every station must evaluate RF exposure (FCC §1.1310 and §97.13 in the US). At ${pw} W of FT8 on 10 m, keep people at least ≈ ${rfx(pw, 28.5).toFixed(1)} m from the antenna (≈ ${rfx(pw, 14.2).toFixed(1)} m on 20 m).${['apartment', 'city', 'hoa'].includes(envId) ? ` At ${an(where)} that includes neighbours on the next balcony or floor${['apartment'].includes(envId) ? ' — another reason to run 50 W or less' : ''}.` : ''}`]);
  out.powerWhy = P;

  // --- rules & neighbours
  out.rules = [...E.rules];
  if (['suburban', 'rural', 'city'].includes(envId) && !E.rules.some((r) => /PRB-1/.test(r))) out.rules.push('US: the PRB-1 rule requires towns to "reasonably accommodate" amateur antennas in zoning; it does not override private covenants such as HOA rules or a lease.');
  if (envId === 'apartment') out.rules.push('Ask the landlord before putting anything outside; a removable antenna that comes down after each session is usually acceptable where a permanent one is not. PRB-1 does not apply to leases.');
  out.rules.push('If you cause interference to a neighbour, fix it first at your end: common-mode chokes, ferrites on the neighbour\'s cables, and lower power. Good relations matter more than any rule.');
  if (goal === 'local' && RW.nws?.office) out.rules.push(`For emergency work, join your local ARES/RACES group and the SKYWARN spotter network run by the National Weather Service office ${RW.nws.office}.`);

  // --- preset to apply
  let preset;
  if (goal === 'listen') preset = 'listener';
  else if (['park', 'summit'].includes(envId)) preset = 'pota';
  else if (envId === 'vehicle') preset = goal === 'local' ? 'vhf' : 'vertical';
  else if (['beach', 'boat'].includes(envId)) preset = 'vertical';
  else if (['apartment', 'hoa'].includes(envId)) preset = goal === 'local' ? 'vhf' : 'apartment';
  else if (goal === 'dx') preset = A.type === 'yagi' ? 'dx' : A.type === 'vertical' ? 'vertical' : 'home';
  else preset = 'home';
  out.preset = preset;
  out.reads = [goal === 'listen' ? 'band-by-band' : 'height-ground', { dipole: 'dipole-build', invv: 'dipole-build', efhw: 'efhw', vertical: 'verticals', yagi: 'yagi' }[A.type], goal === 'local' ? 'emergency' : goal === 'dx' ? 'greyline' : ['apartment', 'city', 'hoa'].includes(envId) ? 'rf-safety' : 'feedlines'];
  return out;
}

// Apply: the closest preset wires the station, then the plan's own antenna, feedline and radio.
function apply(p) {
  if (!applySetup(p.preset, { quiet: true })) return;
  const a = S.antenna, A = p.hf, pre = SETUPS.find((x) => x.id === p.preset);
  const hfPreset = pre.ant.band !== '2m';
  if (hfPreset && ENVS[p.envId].types.includes(A.type)) {
    Object.assign(a, { type: A.type, length: A.length, height: A.type === 'vertical' ? a.height : A.height, axis: A.axis, heading: A.heading, feed: p.goal === 'listen' ? a.feed : p.feed, feedLen: p.feedLen, built: true, spliced: 0, sizedBy: 'setup' });
    if (A.type === 'vertical') a.radials = ENVS[p.envId].ground === 'salt' ? 4 : 32;
  }
  if (p.rig !== S.rig && RIGS[p.rig]) { S.rig = p.rig; S.radio.power = Math.min(S.radio.power || 100, RIGS[p.rig].maxW || 0); }
  if (p.power && S.radio.power > p.power) S.radio.power = p.power;
  S.radio.atuTunedFreq = null;
  save();
  bus.emit('rig'); bus.emit('shack'); bus.emit('antenna'); bus.emit('antenna-rebuild');
  const hfNote = !hfPreset && p.goal !== 'listen' ? ` Build the plan's ${ANT_TYPES[A.type].label.split(' (')[0].toLowerCase()} for HF on the Antenna page.` : '';
  toast(`Station applied: <b>${RIGS[S.rig].name}</b> (${RIGS[S.rig].code}) with ${an(ANT_TYPES[a.type].label.toLowerCase())} cut to ${a.length} ft${a.type !== 'vertical' ? ` at ${a.height} ft` : ''}, ${a.feedLen} ft of ${a.feed}. Started from the "${pre.name}" preset.${hfNote}`, 'good', 9000);
}

// ------------------------------------------------------------------ UI
const why = (rows) => h('dl', { class: 'design-why' }, ...rows.flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]));
const ro = (k, v, cls) => h('div', {}, h('span', {}, k), h('b', { class: cls || null }, v));
const sec = (n, title, ...kids) => h('section', { class: 'sp-sec' }, h('div', { class: 'sp-head' }, h('span', { class: 'sp-num' }, String(n)), h('h3', {}, title)), ...kids);

function renderPlan(p, close, back) {
  const A = p.hf, V = p.vhf, R = RIGS[p.rig], site = p.site;
  const nodes = [];
  nodes.push(h('div', { class: 'row spread' },
    h('div', {}, h('div', { class: 'eyebrow' }, 'Station plan'), h('h2', {}, `${GOALS[p.goal].label} station at ${an(p.E.label.toLowerCase())}, ${p.g6.slice(0, 4)}`)),
    h('button', { class: 'btn ghost small', onclick: back }, 'Change answers')));
  nodes.push(h('div', { class: 'readouts sp-glance' },
    ro('Radio', `${R.code} · ${R.name}`), ro('HF antenna', p.goal === 'listen' ? 'Long wire' : `${ANT_TYPES[A.type].label.split(' (')[0]}, ${A.band}`),
    ro('Length / height', `${A.length} ft${A.type === 'vertical' ? '' : ` · ${A.height} ft up`}`), ro('VHF', p.goal === 'listen' ? 'Discone / whip' : V.needRoof ? `Outdoor, ${V.hAgl} ft` : 'Handheld + whip'),
    ro('Power', p.power ? `${p.power} W` : 'Receive only'), ro('Feedline', `${p.feed}, ${p.feedLen} ft`)));

  // 1. location
  const terr = site ? h('table', { class: 'tbl small sp-terr' }, h('tr', {}, h('th', {}, 'Toward'), h('th', {}, 'Bearing'), h('th', {}, 'Slope (first 1.5 km)'), h('th', {}, 'Horizon'), h('th', {}, 'Effect')),
    ...site.profiles.map((x) => { const t = terrain(x, (A.height || 10) * FT); return h('tr', {}, h('td', {}, x.name), h('td', { class: 'mono' }, `${Math.round(x.brg)}°`), h('td', { class: `mono ${t.slope < -1 ? 'ok' : t.slope > 1 ? 'bad' : ''}` }, `${t.slope >= 0 ? '+' : ''}${t.slope.toFixed(2)}°`), h('td', { class: `mono ${t.horizon > 1 ? 'bad' : ''}` }, `${t.horizon.toFixed(2)}°`), h('td', { class: 'muted' }, t.slope < -1 ? 'falls away — helps DX' : t.slope > 1 ? 'rises — raises take-off angle' : t.horizon > 1 ? 'hills block low angles' : 'flat — neutral')); })) : null;
  const conds = h('div', { class: 'sp-conds' }, ...p.loc.conds.map((c) => h('div', {}, h('span', {}, c.name.replace('-', '–')), h('b', { class: c.now === 'Good' ? 'ok' : c.now === 'Fair' ? 'warn' : 'bad' }, c.now))));
  nodes.push(sec(1, 'Your location',
    h('div', { class: 'readouts' }, ro('Grid square', p.g6), ro('Coordinates', `${p.me.lat.toFixed(3)}, ${p.me.lon.toFixed(3)}`), ro('Elevation', site ? `${Math.round(site.elevM)} m` : 'unknown'),
      ro('Noise vs. suburb', `${p.E.noise > 0 ? '+' : ''}${p.E.noise} dB`, p.E.noise >= 6 ? 'warn' : p.E.noise < 0 ? 'ok' : ''), ro('MUF (3,000 km)', `${p.loc.muf.muf.toFixed(1)} MHz`), ro('Sun', p.loc.df > 0.5 ? 'Day' : p.loc.df < 0.05 ? 'Night' : 'Greyline')),
    !p.found ? h('p', { class: 'small warn' }, 'Your device did not share its location, so this plan uses the centre of your state. Allow location access and reopen the plan for an exact result.') : null,
    why(p.locWhy),
    h('h4', {}, 'Band conditions over you now'), conds,
    terr ? h('h4', {}, `Terrain around you (antenna at ${A.height || 10} ft)`) : null, terr,
    terr ? h('p', { class: 'tiny muted' }, 'Ground that falls away within 1.5 km tilts your pattern down (good for DX); rising ground tilts it up; a horizon above about 1° blocks the lowest angles. Source: ' + site.source + '.') : null));

  // 2. radio
  nodes.push(sec(2, 'Radio',
    h('div', { class: 'sp-rigs' }, ...[p.rig, p.alt].filter(Boolean).map((id, i) => h('div', { class: `sp-rig ${i ? '' : 'main'}` }, h('div', { class: 'tiny muted' }, i ? 'Add' : 'Recommended'), h('b', {}, RIGS[id].name), h('div', { class: 'tiny mono' }, `${RIGS[id].code} · ${RIGS[id].cls}`), h('p', { class: 'small muted' }, RIGS[id].blurb)))),
    why([['Why', p.rigWhy.join(' ')]])));

  // 3. HF antenna
  nodes.push(sec(3, p.goal === 'listen' ? 'Receiving antenna' : 'HF antenna',
    h('div', { class: 'readouts' }, ro('Type', ANT_TYPES[A.type].label.split(' (')[0]), ro('Band', `${A.band}${A.multi ? ' + harmonics' : ''}`), ro('Length', `${A.length} ft`), ro('Height', A.type === 'vertical' ? 'ground / mount' : `${A.height} ft`),
      ro(A.type === 'yagi' ? 'Heading' : 'Orientation', A.region ? (A.type === 'yagi' ? `${A.heading}°` : ['N–S', 'NE–SW', 'E–W', 'NW–SE'][A.axis / 45]) : 'any')),
    why(p.goal === 'listen' ? [...A.why.slice(0, 1), ['Receiving', `For listening, height and resonance matter far less than distance from noise: run the wire away from the house wiring${['apartment', 'city'].includes(p.envId) ? ', or use an active loop on the balcony, which rejects local noise' : ''}, and feed it through a 9:1 or 49:1 transformer with a choke.`]] : A.why),
    h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => { close(); openDesigner(); } }, h('span', { html: icon('wand') }), 'Design it exactly'), h('span', { class: 'tiny muted' }, 'The designer solves the exact resonant length with the Method-of-Moments engine and raises it.'))));

  // 4. VHF/UHF
  nodes.push(sec(4, 'VHF / UHF',
    h('div', { class: 'readouts' }, ro('Antenna height', `${V.hAgl} ft`), ro('Simplex to a base', `≈ ${V.simplex.toFixed(0)} km`), ro('To a repeater', `≈ ${V.rpt.toFixed(0)} km`), ro('Handheld, simplex', `≈ ${V.ht.toFixed(0)} km`)),
    why(p.goal === 'listen' ? [V.why[0], ['Antenna', 'A discone or a simple vertical whip mounted as high as you can covers airband, weather radio, FM and the 2 m and 70 cm ham bands for listening.']] : V.why)));

  // 5. time of day
  nodes.push(sec(5, 'Best bands by time of day here',
    h('p', { class: 'small muted' }, `Predicted with the propagation model for ${p.g6.slice(0, 4)}, today's solar flux (${SUN.sfi}) and your site's noise, for 100 W into a simple antenna. Times are local solar time.`),
    h('table', { class: 'tbl small sp-times' },
      h('tr', {}, h('th', {}, 'Time'), h('th', {}, 'MUF'), ...RANGES.map(([n, d]) => h('th', {}, n, h('span', { class: 'sp-sub' }, d)))),
      ...p.times.map((r) => h('tr', {}, h('td', {}, h('b', {}, r.label), h('span', { class: 'sp-sub' }, `${String(r.loc).padStart(2, '0')}:00 · ${r.df > 0.5 ? 'day' : r.df < 0.05 ? 'night' : 'low sun'}`)), h('td', { class: 'mono' }, `${r.muf.toFixed(1)} MHz`),
        ...r.cells.map((c) => h('td', {}, c.length ? c.map((x, i) => h('span', { class: `sp-band ${x.snr > 15 ? 'good' : x.snr > 8 ? 'fair' : 'weak'} ${i ? 'alt' : ''}` }, x.band)) : h('span', { class: 'muted' }, 'closed')))))),
    why([['Read it', 'By day the D layer absorbs the low bands and a high MUF opens the high bands; at night absorption disappears and the MUF falls, so the action moves down to 40 and 80 m. Short distances need high angles, which the ionosphere returns only below the critical frequency — that is why regional contacts move to the lowest bands first.']])));

  // 6. power, feedline, grounding
  const coax = h('table', { class: 'tbl small sp-coax' }, h('tr', {}, h('th', {}, `${p.feedLen} ft of`), ...[7, 14, 28, 146].map((f) => h('th', {}, `${f} MHz`))),
    ...p.coaxes.map((c) => h('tr', { class: c === p.feed ? 'best' : '' }, h('td', {}, c), ...[7, 14, 28, 146].map((f) => { const l = feedLossDb(c, p.feedLen, f); return h('td', { class: `mono ${l > 2 ? 'bad' : l > 1 ? 'warn' : ''}` }, `${l.toFixed(2)} dB`); }))));
  nodes.push(sec(6, 'Power, feedline and grounding', why(p.powerWhy), h('h4', {}, 'Coax loss for your run'), coax));

  // 7. rules
  nodes.push(sec(7, 'Rules and neighbours', h('ul', { class: 'small sp-rules' }, ...p.rules.map((r) => h('li', {}, r)))));

  // 8. next steps
  const LIB = { 'height-ground': 'Height and ground', 'dipole-build': 'Building a dipole', efhw: 'The end-fed half-wave', verticals: 'Verticals and radials', yagi: 'Yagi beams', emergency: 'Emergency communications', greyline: 'Greyline propagation', 'rf-safety': 'RF safety', feedlines: 'Feedlines', 'band-by-band': 'Band by band' };
  nodes.push(sec(8, 'Next steps',
    h('div', { class: 'row' },
      h('button', { class: 'btn primary', onclick: () => { apply(p); close(); } }, h('span', { html: icon('check') }), 'Apply this station'),
      p.goal !== 'listen' ? h('button', { class: 'btn', onclick: () => { close(); openDesigner(); } }, h('span', { html: icon('wand') }), 'Design the antenna exactly') : null,
      h('button', { class: 'btn', onclick: () => { close(); bus.emit('goto', 'antenna'); } }, h('span', { html: icon('antenna') }), 'Open the antenna builder')),
    h('p', { class: 'tiny muted' }, `Apply starts from the closest preset ("${SETUPS.find((x) => x.id === p.preset).name}"), then sets this plan's radio, antenna, height, orientation and feedline.`),
    h('div', { class: 'sp-reads' }, h('span', { class: 'tiny muted' }, 'Read more:'), ...[...new Set(p.reads)].map((id) => h('button', { class: 'link small', onclick: () => { close(); bus.emit('library', id); } }, h('span', { html: icon('book') }), LIB[id] || id)))));
  return nodes;
}

export function openStationPlan() {
  let close;
  const box = h('div', { class: 'designer station-plan' });
  let envId = ENVS[S.yard?.env] ? S.yard.env : 'suburban', goal = 'allround';
  let found = S.op.lat != null, site = null, siteErr = false;
  const status = h('p', { class: 'small muted sp-status' }, found ? `Location: ${grid(qth().lat, qth().lon).slice(0, 6)}. Loading terrain…` : 'Finding your location…');
  const prep = (async () => {
    if (!found) found = await locate();
    const q = qth();
    status.textContent = found ? `Location: ${grid(q.lat, q.lon).slice(0, 6)} (${q.lat.toFixed(3)}, ${q.lon.toFixed(3)}). Loading terrain…` : `Location unavailable — using the centre of your state (${grid(q.lat, q.lon).slice(0, 4)}). Loading terrain…`;
    try { site = await withTimeout(loadSite(), 15000); } catch (e) { siteErr = true; }
    status.textContent = `${found ? `Location: ${grid(q.lat, q.lon).slice(0, 6)} (${q.lat.toFixed(3)}, ${q.lon.toFixed(3)})` : `Location unavailable — using the centre of your state (${grid(q.lat, q.lon).slice(0, 4)})`} · ${site ? `${Math.round(site.elevM)} m elevation, terrain loaded` : 'terrain unavailable, assuming flat ground'}.`;
  })();

  const cards = (opts, cur, set) => h('div', { class: 'goal-grid sp-cards' }, ...opts.map(([k, label, desc]) => h('button', { class: `goal-card ${k === cur ? 'sel' : ''}`, 'aria-pressed': String(k === cur), onclick: () => { set(k); choose(); } }, h('b', {}, label), h('span', { class: 'small muted' }, desc))));
  const choose = () => {
    box.innerHTML = '';
    box.append(
      h('div', { class: 'eyebrow' }, 'Station plan'),
      h('h2', {}, 'Plan a station for my location'),
      h('p', { class: 'small muted' }, 'Answer two questions. The plan uses your location, the terrain around you, your site\'s noise, your latitude and the live ionosphere to recommend a whole station, and explains why each choice suits where you are. Your location stays in this browser.'),
      status,
      h('div', { class: 'eyebrow muted' }, 'Where will you operate?'),
      cards(Object.entries(ENVS).map(([k, E]) => [k, E.label, E.desc]), envId, (k) => { envId = k; }),
      h('div', { class: 'eyebrow muted' }, 'What interests you most?'),
      cards(Object.entries(GOALS).map(([k, g]) => [k, g.label, g.desc]), goal, (k) => { goal = k; }),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: run }, h('span', { html: icon('sparkles') }), 'Build my station plan')));
  };
  const run = async () => {
    box.innerHTML = '';
    box.append(h('div', { class: 'eyebrow' }, 'Station plan'), h('h2', {}, 'Building your plan'), status);
    await prep;
    // Use the chosen place in the antenna builder too (the same state the yard uses).
    const y = (S.yard ||= {});
    if (y.env !== envId) { y.env = envId; save(); bus.emit('antenna'); }
    let p;
    try { p = buildPlan(envId, goal, site, found); } catch (e) { console.error(e); box.append(h('p', { class: 'bad' }, `Could not build the plan: ${e.message}`)); return; }
    box.innerHTML = '';
    box.append(...renderPlan(p, () => close(), choose));
    box.closest('#modal')?.scrollTo?.(0, 0);
  };
  choose();
  close = modal(box, { wide: true });
}
