// 🏡 Antenna builder: hang the antenna wherever you actually live or operate — a suburban yard,
// a farm, a city rooftop, an apartment balcony, an HOA attic, a park, a summit, a car, a boat or
// a beach. The place sets the supports, the space, the ground, the man-made noise and the losses
// (all of which feed the simulation), plus the local rules. Then a real bill of materials and the
// build steps, like an actual weekend project.
import { S, save, addXp } from './state.js';
import { h, bus, toast, clamp } from './util.js';
import { maxHeight } from './store.js';
import { ANT_TYPES, FEEDS } from './antenna.js';
import { targetHz } from './planner.js';
import { GROUNDS } from './em/models.js';

const NS = 'http://www.w3.org/2000/svg';
const s = (tag, a = {}, ...kids) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(a)) e.setAttribute(k, v); for (const c of kids) if (c != null) e.append(typeof c === 'string' ? document.createTextNode(c) : c); return e; };

// noise: man-made noise vs. a typical residential area, dB (after ITU-R P.372 environment
// categories: city/business ≈ +6…+10, quiet rural ≈ −8). loss(fMHz): extra system loss in dB
// from nearby structures, indoor mounting or shortened antennas.
const ALL = ['dipole', 'invv', 'vertical', 'efhw', 'yagi'];
export const ENVS = {
  suburban: {
    icon: '🏡', label: 'Suburban yard', scene: 'yard', lot: 140, ground: 'average', noise: 0, loss: () => 0, types: ALL,
    desc: 'A house on a typical lot with a couple of trees.',
    sup: [{ id: 'treeA', kind: 'tree', name: 'Oak', x: 10, h: 45 }, { id: 'house', kind: 'house', name: 'House eave', x: 60, h: 18 }, { id: 'treeB', kind: 'tree', name: 'Maple', x: 125, h: 40 }, { id: 'mast', kind: 'mast', name: 'Mast', x: 85, h: 35 }],
    ends: { a: 'treeA', b: 'treeB', apex: 'mast', low: 'house', vert: null, yagi: 'mast' }, stake: 8,
    rules: ['Check your deed/HOA covenants and local zoning for towers (US: the PRB-1 rule asks towns to "reasonably accommodate" ham antennas — it does not override private covenants).', 'Keep wires well clear of power lines: if it falls, it must not touch one.'],
  },
  rural: {
    icon: '🚜', label: 'Rural acreage', scene: 'farm', lot: 400, ground: 'good', noise: -6, loss: () => 0, types: ALL,
    desc: 'Space, tall trees and a quiet noise floor — the antenna farm dream.',
    sup: [{ id: 'treeA', kind: 'tree', name: 'Cottonwood', x: 30, h: 70 }, { id: 'barn', kind: 'house', name: 'Barn roof', x: 160, h: 28 }, { id: 'treeB', kind: 'tree', name: 'Oak', x: 360, h: 60 }, { id: 'mast', kind: 'mast', name: 'Tower', x: 250, h: 35 }],
    ends: { a: 'treeA', b: 'treeB', apex: 'mast', low: 'barn', vert: null, yagi: 'mast' }, stake: 8,
    rules: ['Rural noise is often 5–10 dB lower than in town: weak DX that is buried in a city is readable here.', 'Throw lines realistically reach ~60 ft in a tree; above that you need a climber or a tower.', 'Long runs: use low-loss coax (LMR-400 / hardline) or ladder line.'],
  },
  city: {
    icon: '🏙', label: 'City rooftop', scene: 'city', lot: 90, ground: 'poor', noise: 9, loss: () => 1, types: ALL, floors: 8,
    desc: 'Flat roof of a mid-rise building, with permission from the owner.',
    sup: [{ id: 'roofmast', kind: 'mast', name: 'Roof mast', x: 15, h: 20, onRoof: true }, { id: 'stair', kind: 'house', name: 'Stair / elevator housing', x: 75, h: 12, onRoof: true }, { id: 'parapet', kind: 'rail', name: 'Parapet', x: 45, h: 4, onRoof: true }],
    ends: { a: 'roofmast', b: 'stair', apex: 'roofmast', low: 'parapet', vert: 'parapet', yagi: 'roofmast' }, stake: 4, stakeOnRoof: true,
    rules: ['Get written permission from the building owner; roofs have other users (HVAC techs, cellular sites) — do an RF-exposure evaluation (FCC §97.13).', 'City man-made noise (LED lighting, switch-mode supplies, data lines) is the #1 enemy: expect S7–S9 noise on 80/40 m.', 'Bond the mast to the building\'s lightning protection; run coax down a riser, not over the parapet edge.', 'The roof height is a huge plus on VHF/UHF.'],
  },
  apartment: {
    icon: '🏢', label: 'Apartment balcony', scene: 'apartment', lot: 14, ground: 'poor', noise: 10, loss: () => 3, types: ['vertical', 'efhw', 'invv', 'dipole'], floors: 4,
    desc: 'A balcony a few floors up. Small, stealthy and noisy — but very doable.',
    sup: [{ id: 'rail', kind: 'rail', name: 'Balcony railing', x: 2, h: 4, onFloor: true }, { id: 'pole', kind: 'pole', name: 'Painter\'s-pole mast', x: 12, h: 12, onFloor: true }, { id: 'tree', kind: 'tree', name: 'Courtyard tree', x: 70, h: 45 }],
    ends: { a: 'pole', b: 'tree', efA: 'tree', apex: 'pole', low: 'rail', vert: 'rail', yagi: 'pole' }, stake: 4, stakeOnFloor: true,
    rules: ['Check your lease: many forbid "external antennas". Stealth options: a thin wire to a tree, a vertical on a clamp that comes down after the session, a magnetic loop.', 'US: the FCC OTARD rule protects TV dishes and broadband antennas — NOT amateur antennas.', 'Concrete and rebar detune and absorb (~3 dB); the building\'s electronics add noise. Use a common-mode choke at the feed and run lower power to avoid interfering with neighbours.', 'FT8 and CW go a long way from a compromise antenna. On VHF your floor height is a real advantage.'],
  },
  hoa: {
    icon: '🏘', label: 'HOA / condo (stealth)', scene: 'attic', lot: 46, ground: 'average', noise: 4, loss: (f) => (f > 50 ? 4 : 3), types: ['dipole', 'invv', 'vertical', 'efhw'],
    desc: 'No visible antennas allowed: an attic dipole and a "flagpole" vertical.',
    sup: [{ id: 'gableA', kind: 'attic', name: 'Attic gable (west)', x: 0, h: 17 }, { id: 'ridge', kind: 'attic', name: 'Attic ridge', x: 23, h: 24 }, { id: 'gableB', kind: 'attic', name: 'Attic gable (east)', x: 46, h: 17 }, { id: 'flag', kind: 'pole', name: 'Flagpole', x: 70, h: 25 }],
    ends: { a: 'gableA', b: 'gableB', apex: 'ridge', low: 'gableB', vert: null, yagi: 'flag' }, stake: 9,
    rules: ['HOA covenants (CC&Rs) can legally ban outdoor antennas; PRB-1 does not override them. Stealth is the answer.', 'Indoors, wiring, ducts and foil insulation detune the antenna (2–5 %) and cost ~3 dB. Re-sweep after installing — the dip moves.', 'Bend the ends of an attic dipole along the rafters if it\'s too long — it still works.', 'A flagpole with a hidden vertical (and radials under the lawn) is the classic stealth DX antenna.'],
  },
  park: {
    icon: '🌲', label: 'Park (POTA)', scene: 'park', lot: 150, ground: 'average', noise: -5, loss: () => 0, types: ALL,
    desc: 'Parks On The Air: a picnic table, trees and a battery.',
    sup: [{ id: 'treeA', kind: 'tree', name: 'Pine', x: 10, h: 50 }, { id: 'pole', kind: 'pole', name: 'Fibreglass pole (31 ft)', x: 70, h: 31 }, { id: 'table', kind: 'table', name: 'Picnic table', x: 85, h: 3 }, { id: 'treeB', kind: 'tree', name: 'Oak', x: 140, h: 40 }],
    ends: { a: 'treeA', b: 'treeB', apex: 'pole', low: 'table', vert: null, yagi: 'pole' }, stake: 6,
    rules: ['Leave no trace: no nails, no climbing, soft rope around branches; don\'t string wire across trails.', 'Parks are quiet — your noise floor is far lower than at home.', 'A POTA activation needs 10 contacts from inside the park boundary.', 'Operating abroad? Check reciprocal licensing (CEPT T/R 61-01 in Europe, IARP in the Americas).'],
  },
  summit: {
    icon: '⛰', label: 'Mountain summit (SOTA)', scene: 'summit', lot: 70, ground: 'poor', noise: -10, loss: () => 0, types: ['invv', 'efhw', 'vertical', 'dipole'],
    desc: 'Summits On The Air: a 20 ft pole on rocky ground with the world below you.',
    sup: [{ id: 'cairnA', kind: 'rock', name: 'Rock (west)', x: 0, h: 4 }, { id: 'pole', kind: 'pole', name: 'Fibreglass pole (20 ft)', x: 35, h: 20 }, { id: 'cairnB', kind: 'rock', name: 'Rock (east)', x: 70, h: 4 }],
    ends: { a: 'pole', b: 'cairnB', apex: 'pole', low: 'cairnB', vert: null, yagi: 'pole' }, stake: 3,
    rules: ['The ground falls away in every direction: the effective height for low-angle radiation is huge — free dB toward DX. Load your real location in the Site planner to see it.', 'Rocky ground is a poor reflector: verticals need elevated radials.', 'Weight matters: thin wire, a 6 m / 20 ft fibreglass pole, a 2–3 Ah LiFePO4.', 'Watch the weather — lightning on a summit is not a joke. Pack up early.'],
  },
  vehicle: {
    icon: '🚙', label: 'Vehicle (mobile)', scene: 'vehicle', lot: 15, ground: 'average', noise: 3, loss: (f) => (f < 5 ? 12 : f < 10 ? 8 : f < 22 ? 4 : f < 30 ? 2 : 0), types: ['vertical'],
    desc: 'A loaded HF whip on the car — or a 5/8 λ magmount for VHF.',
    sup: [{ id: 'car', kind: 'car', name: 'Trunk-lip mount', x: 8, h: 4 }],
    ends: { a: 'car', b: 'car', apex: 'car', low: 'car', vert: 'car', yagi: 'car' }, stake: 3,
    rules: ['An HF mobile whip is a shortened, loaded vertical: ~−8 dB on 40 m, −4 dB on 20 m versus a full-size antenna (the sim applies this). Bandwidth is narrow — retune when you QSY.', 'Bond the hood, trunk lid and exhaust to the body; put ferrites on noisy wiring (fuel pump, LED lights).', 'Mount on the roof centre for VHF; check overhead clearance (garages, drive-throughs).', 'Many places restrict using a radio while driving — the passenger operates or you pull over.'],
  },
  boat: {
    icon: '⛵', label: 'Sailboat', scene: 'boat', lot: 40, ground: 'salt', noise: -6, loss: () => 0, types: ['vertical', 'efhw'],
    desc: 'Insulated backstay or a wire up the mast, over salt water.',
    sup: [{ id: 'mast', kind: 'boatmast', name: 'Mast', x: 16, h: 48 }, { id: 'stern', kind: 'rail', name: 'Stern rail', x: 38, h: 6 }],
    ends: { a: 'mast', b: 'stern', apex: 'mast', low: 'stern', vert: 'stern', yagi: 'mast' }, stake: 6,
    rules: ['Salt water is an almost perfect ground: a vertical over the sea has superb low-angle gain — DXpeditions set up at the water\'s edge for this.', 'The classic: insulators in the backstay, an automatic tuner at its base, and a copper-foil counterpoise to the keel / seawater.', 'Marine HF (ITU maritime service) needs a ship station licence and its own channels; ham bands need your amateur licence (and permission in foreign waters).'],
  },
  beach: {
    icon: '🏖', label: 'Beach / island trip', scene: 'beach', lot: 140, ground: 'salt', noise: -4, loss: () => 0, types: ALL,
    desc: 'A vertical at the water\'s edge — the DXpedition secret.',
    sup: [{ id: 'palmA', kind: 'tree', name: 'Palm', x: 15, h: 32 }, { id: 'pole', kind: 'pole', name: 'Fibreglass pole (31 ft)', x: 110, h: 31 }, { id: 'palmB', kind: 'tree', name: 'Palm', x: 70, h: 28 }],
    ends: { a: 'palmA', b: 'palmB', apex: 'pole', low: 'palmB', vert: null, yagi: 'pole' }, stake: 6,
    rules: ['Put verticals within a wavelength of the water: up to ~10 dB more at low angles out over the sea.', 'Abroad you operate under a reciprocal licence (CEPT, IARP) or a local permit — sign e.g. "FG/W1ABC" and follow the host country\'s band plan.', 'Salt spray eats connectors: seal everything.'],
  },
};
const envState = (id) => { const E = ENVS[id]; return { lot: E.lot, sup: E.sup.map((x) => ({ ...x })), ends: { ...E.ends }, stake: E.stake ?? 8, floor: E.floors ?? 0 }; };
const YS = () => {
  const y = (S.yard ||= {});
  if (y.sup && !y.envs) { y.envs = { suburban: { lot: y.lot, sup: y.sup, ends: { ...ENVS.suburban.ends, ...y.ends }, stake: y.stake, floor: 0 } }; delete y.sup; delete y.lot; delete y.ends; delete y.stake; }
  y.env = ENVS[y.env] ? y.env : 'suburban'; y.envs ||= {}; y.steps ||= {};
  return y;
};
const Y = () => { const y = YS(); return (y.envs[y.env] ||= envState(y.env)); };
export const env = () => ENVS[YS().env];
const mastH = () => maxHeight(); // a mast/tower's height is what you bought (35 ft push-up pole to start)
// Height above ground of a support's base (roof / balcony floor).
const baseOf = (p) => { const y = Y(), E = env(); return p.onFloor ? (y.floor || 1) * 10 : p.onRoof ? (y.floor || E.floors || 1) * 10 + 4 : 0; };
// Usable top of a support: throw lines reach ~60 ft in a tree; masts are what you own.
const top = (p) => baseOf(p) + (p.kind === 'tree' ? Math.min(p.h, 60) : p.kind === 'mast' ? Math.min(p.h, mastH()) : p.h);
const sup = (id) => Y().sup.find((x) => x.id === id);
// ground level for leg stakes (balcony floor / roof)
const stakeH = () => { const y = Y(), E = env(); return y.stake + (E.stakeOnFloor ? (y.floor || 1) * 10 : E.stakeOnRoof ? (y.floor || E.floors) * 10 + 4 : 0); };

// What the place does to your signal (used by the receiver and transmitter).
export function siteEffects(fMHz) {
  const E = env();
  return { noiseDb: E.noise * (fMHz > 30 ? 0.5 : 1), lossDb: E.loss(fMHz) };
}
// The tallest height you can actually hang something at, here.
export function siteMaxHeight() { return Math.max(maxHeight(), ...Y().sup.map((p) => top(p))); }
// Antenna base height above ground (balcony, roof, mast top...), for VHF line-of-sight.
export function antennaAglFt(a = S.antenna) {
  if (a.agl != null) return a.agl;
  return a.type === 'vertical' ? 6 : a.height;
}

// ------------------------------------------------------------------ geometry
export function geometry(a = S.antenna) {
  const y = Y();
  const E = env();
  const L = a.length || 0, out = { notes: [], ok: true };
  const bad = (t) => { out.notes.push(['bad', t]); out.ok = false; }, warn = (t) => out.notes.push(['warn', t]), ok = (t) => out.notes.push(['ok', t]);
  if (!E.types.includes(a.type)) { bad(`The ${ANT_TYPES[a.type].label.split(' (')[0].toLowerCase()} isn't practical here. Try: ${E.types.map((t) => ANT_TYPES[t].label.split(' (')[0].toLowerCase()).join(', ')}.`); return out; }
  if (a.type === 'dipole' || (a.type === 'efhw')) {
    const A = sup(a.type === 'efhw' ? y.ends.efA || y.ends.a : y.ends.a), B = sup(a.type === 'efhw' ? y.ends.low : y.ends.b);
    if (!A || !B || A === B) { bad('Pick two different supports for the ends.'); return out; }
    const span = Math.abs(A.x - B.x);
    const hTie = Math.min(top(A), top(B)) - 2; // tie-off point a little below the top
    const rope = span - L;
    if (a.type === 'efhw') {
      const hi = Math.max(top(A), top(B)) - 1, lo = Math.max(1, Math.min(top(A), top(B)) - 1);
      const drop = hi - lo, run = Math.sqrt(Math.max(0, L * L - drop * drop));
      if (run > span + 4) warn(`The ${L.toFixed(0)} ft wire is longer than the ${span} ft between supports — the far end will droop or zig-zag. Fine for an EFHW, but keep it in the clear.`);
      out.height = Math.round(Math.max(3, (hi + Math.max(lo, hi - L)) / 2 - L * 0.02));
      out.slope = Math.round(Math.atan2(drop, Math.min(run, span)) * 180 / Math.PI);
      out.ropes = [Math.max(0, span - run)];
      ok(`Sloper from ${hi} ft (${A.name}) down to ${lo} ft (${B.name}) — about ${out.slope}° slope, average height ${out.height} ft.`);
    } else {
      const sag = Math.max(0.6, Math.min(span, L) * 0.035 + 0.8); // wire + coax weight at the centre
      if (rope < 0 && E.scene === 'attic') {
        out.height = Math.round(hTie - sag);
        out.ropes = [0, 0];
        warn(`The wire is ${(-rope).toFixed(0)} ft longer than the attic: bend the last ${(-rope / 2).toFixed(0)} ft of each leg along the rafters (keep the ends apart). It still works; expect the resonance to shift a few % — re-sweep.`);
      } else if (rope < 0) {
        // wire longer than the span: ends hang down (a "drooping" dipole)
        const hang = -rope / 2;
        out.height = Math.round(hTie - sag);
        out.endsAt = Math.round(hTie - hang);
        if (out.endsAt < 8) bad(`The wire is ${(-rope).toFixed(0)} ft longer than the ${span} ft span: the ends would hang down to ${out.endsAt > 0 ? `${out.endsAt} ft — below head height` : 'the ground'}. Move a support, or use an inverted-V.`);
        else warn(`The wire is ${(-rope).toFixed(0)} ft longer than the span: let the last ${hang.toFixed(0)} ft of each end hang down to ${out.endsAt} ft (this slightly lowers the resonant frequency). Insulate the ends — they carry high voltage.`);
        out.ropes = [0, 0];
      } else {
        out.height = Math.round(hTie - sag);
        out.ropes = [rope / 2 + 6, rope / 2 + 6];
        ok(`Span ${span} ft, wire ${L.toFixed(1)} ft: ${(rope / 2).toFixed(0)} ft of rope each side. Centre sags ~${sag.toFixed(1)} ft with the coax → ${out.height} ft at the feed point.`);
      }
      if (Math.min(top(A), top(B)) < 25) warn('Low end supports: under ~λ/4 the dipole fires mostly upward (NVIS) — good for nearby, poor for DX.');
    }
    if (A.kind === 'tree' || B.kind === 'tree') ok('Trees sway: use a pulley and a counterweight on the rope so wind doesn\'t snap the wire.');
  } else if (a.type === 'invv') {
    const P = sup(y.ends.apex);
    if (!P) { bad('Pick a centre support.'); return out; }
    const apex = Math.round(top(P) - 1), legH = L / 2, stake = stakeH(), drop = apex - stake;
    if (drop >= legH * 0.97) { out.droop = 85; bad(`Each ${legH.toFixed(0)} ft leg can't reach from a ${apex} ft apex down to the ${stake} ft leg ends. Lower the apex to about ${Math.floor(stake + legH * 0.7)} ft (45° droop), raise the stakes, or add rope at the leg ends.`); out.height = apex; out.footprint = 0; out.ropes = [6, 6]; return finish(out); }
    out.droop = Math.round(Math.asin(clamp(drop / legH, 0, 1)) * 180 / Math.PI);
    const foot = 2 * Math.sqrt(Math.max(0, legH * legH - drop * drop));
    out.height = apex;
    out.footprint = Math.round(foot);
    out.ropes = [6, 6];
    if (foot > y.lot) bad(`The legs need ${out.footprint} ft of ground but your lot is ${y.lot} ft wide. Raise the apex, bend the legs, or shorten the antenna (use a higher band).`);
    else ok(`Apex ${apex} ft on the ${P.name}, legs down to ${stake} ft leg ends: ${out.droop}° droop, ${out.footprint} ft footprint.`);
    if (out.droop > 50) warn(`A ${out.droop}° droop is steep: the included angle is under 90°, which lowers feed impedance and gain. Aim for 30–45°.`);
    if (y.stake < 8 && !E.stakeOnFloor && !E.stakeOnRoof) warn('Keep the leg ends above head height (8 ft+) — the tips carry RF voltage.');
  } else if (a.type === 'vertical') {
    const V = sup(y.ends.vert), rad = L; // quarter-wave radials ≈ radiator length
    out.agl = V ? top(V) : 0; out.height = Math.round(out.agl); out.footprint = Math.round(rad * 2);
    if (E.scene === 'vehicle') {
      if (L > 9) warn(`A full λ/4 here is ${L.toFixed(0)} ft — on a car you use a ~7 ft loaded whip (a hamstick or screwdriver). The sim applies the loading loss: ${E.loss(targetHz() / 1e6)} dB at ${(targetHz() / 1e6).toFixed(1)} MHz.`);
      else ok('Full-size on this band: a whip this short is efficient (VHF/10 m).');
      ok('The car body is the counterpoise — bond it well.');
    } else if (E.ground === 'salt') ok(`Over salt water the sea is the ground plane: no radial field needed — superb low-angle radiation.`);
    else if (V) ok(`Elevated on the ${V.name.toLowerCase()} (${Math.round(out.agl)} ft up): use 2–4 elevated radials (or a counterpoise wire) cut to ~${rad.toFixed(0)} ft, sloping down at ~45°.`);
    else if (rad * 2 > y.lot) warn(`Full λ/4 radials need a ${Math.round(rad * 2)} ft circle; you have ${y.lot} ft. Shorter radials work — use more of them (they're on the ground, not resonant).`);
    else ok(`Ground-mounted: ${a.radials} radials of ~${rad.toFixed(0)} ft fit in your ${y.lot} ft.`);
  } else if (a.type === 'yagi') {
    const T = sup(y.ends.yagi) || y.sup.find((x) => x.kind === 'mast');
    out.height = Math.round((T ? top(T) : 35) + 3);
    const el = (a.length || 30) * 1.06;
    ok(`On the ${T?.name.toLowerCase() || 'mast'}: boom ${out.height} ft up; turning radius ~${(el / 2 + 4).toFixed(0)} ft — keep it clear of trees and the house.`);
    if (out.height > 40) warn('Over ~40 ft you\'ll want a guyed or self-supporting tower and a thrust bearing above the rotator.');
  }
  return finish(out, a);
}
function finish(out, a = S.antenna) {
  out.height = Math.round(out.height ?? a.height);
  if (a.type !== 'vertical' && out.ok && out.height < 6) { out.notes.unshift(['bad', `The feed point would be only ${Math.max(0, out.height)} ft up — on the ground, practically. Hang it from a taller support, or use the pole as the centre of an inverted-V.`]); out.ok = false; }
  out.agl ??= out.height;
  const m = Y().sup.find((p) => p.kind === 'mast');
  if (m && m.h > mastH()) out.notes.push(['warn', `Your mast/tower only reaches ${mastH()} ft (buy a taller one at the Hamfest).`]);
  return out;
}

// ------------------------------------------------------------------ bill of materials
export function bom(a = S.antenna, g = geometry(a)) {
  const L = a.length || 0, items = [];
  const add = (q, what, usd) => items.push([q, what, usd]);
  const wire = { dipole: L, invv: L, efhw: L + 1, vertical: 0, yagi: 0 }[a.type];
  const ins = a.insulated !== false ? 'insulated' : 'bare';
  const gauge = (a.wire || 'AWG 14 copper').replace('AWG ', '#').replace(' copper', '');
  if (wire) add(`${Math.ceil(wire * 1.06 + 2)} ft`, `${gauge} stranded copper antenna wire (${ins}) — ${a.type === 'efhw' ? 'one piece' : `2 legs of ${(L / 2).toFixed(2)} ft + 6 in each for the wraps`}`, Math.ceil(wire * 1.06 + 2) * 0.35);
  if (a.type === 'dipole' || a.type === 'invv') add('1', '1:1 current balun / centre insulator (SO-239)', 45);
  if (a.type === 'efhw') add('1', '49:1 unun (EFHW transformer) + 0.05 λ counterpoise', 60);
  if (wire) add(a.type === 'efhw' ? '1' : '2', 'End insulators (ceramic "dog-bone")', 4);
  const rope = (g.ropes || []).reduce((s2, r) => s2 + r, 0) + (a.type !== 'vertical' ? (g.height || a.height) * 2 + 10 : 0);
  if (a.type !== 'vertical' && a.type !== 'yagi') add(`${Math.ceil(rope)} ft`, 'UV-resistant 3/16″ Dacron/polyester rope (halyards)', rope * 0.12);
  if (a.type !== 'vertical' && a.type !== 'yagi') add('2', 'Pulleys + counterweights (let the trees sway)', 18);
  if (a.type !== 'vertical' && a.type !== 'yagi') add('1', 'Throw line + 10 oz throw weight (or slingshot launcher)', 35);
  if (a.type === 'vertical') { add('1', `${L.toFixed(1)} ft telescoping aluminium or fibreglass-supported radiator`, 90); add(`${Math.ceil(a.radials * L)} ft`, `#14–#18 radial wire (${a.radials} × ${L.toFixed(0)} ft) + ground staples`, a.radials * L * 0.12); add('1', 'Radial plate + 8 ft ground rod', 55); }
  if (a.type === 'yagi') { add('1', '3-element Yagi (aluminium tubing, boom, hairpin match)', 450); add('1', 'Rotator + control cable', 380); add('1', 'Thrust bearing + mast pipe', 120); }
  add(`${a.feedLen} ft`, `${a.feed} coax (${FEEDS[a.feed]?.[2] || ''})`, a.feedLen * ({ 'RG-58': 0.35, 'RG-8X': 0.45, 'RG-213': 0.95, 'LMR-400': 1.2 }[a.feed] || 0.5));
  add('4', 'PL-259 connectors (silver/Teflon) + adapters', 16);
  add('1', 'Coax-seal / self-amalgamating tape (weatherproof every outdoor connector)', 9);
  add('1', 'Lightning arrestor at the entry + ground-rod bond (#6 copper)', 60);
  const total = items.reduce((s2, x) => s2 + x[2], 0);
  return { items, total };
}

const STEPS = [
  ['measure', 'Measure and cut the wire', 'Cut a few inches long. Leave 6 in on each end for the wrap around the insulator — fold back extra instead of cutting it off, so you can lengthen later.'],
  ['assemble', 'Assemble on the ground', 'Wire through the end insulators, twist and solder the wraps, connect the balun/unun, and tape the connector joints.'],
  ['throw', 'Get lines over the supports', 'Throw-line and weight (or slingshot) over a strong branch high up and in the clear. Pull up a pulley and the rope halyard.'],
  ['hoist', 'Hoist it', 'Raise both ends evenly. Use a counterweight so the tree can sway without snapping the wire. Keep the ends above head height.'],
  ['coax', 'Run the coax', 'Make a drip loop before the house, go through the grounded lightning arrestor, then inside. Weatherproof every outdoor connector.'],
  ['sweep', 'Sweep with the analyzer and adjust', 'Check where the SWR dip is (analyzer above). Dip below the band = too long: fold back wire. Above = too short: unfold some. Repeat until it sits in the band.'],
];

// ------------------------------------------------------------------ UI
let root, listening = false;
export function mountYard(el) {
  root = el; render();
  if (listening) return; listening = true;
  bus.on('antenna', () => { if (root?.isConnected) render(); });
}

function drawYard(a, g) {
  const y = Y(), E = env(), W = 760, H = 250, G = 214;
  const tops = y.sup.map((p) => top(p) + 6);
  const maxFt = Math.max(40, ...tops, (g.height || 0) + 8);
  const k = (G - 16) / maxFt;
  const span = Math.max(y.lot, 30, ...y.sup.map((p) => p.x + 12));
  const sx = (ft) => 40 + ft / span * (W - 80), sy = (ft) => G - ft * k;
  const sea = E.scene === 'boat', beach = E.scene === 'beach';
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'yard-svg' },
    s('defs', {}, s('linearGradient', { id: 'ySky', x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, 'stop-color': '#16324f' }), s('stop', { offset: 1, 'stop-color': '#3a6a8e' }))),
    s('rect', { x: 0, y: 0, width: W, height: G, fill: 'url(#ySky)' }));
  // scenery
  if (E.scene === 'city' || E.scene === 'apartment') {
    for (let i = 0; i < 9; i++) { const bw = 50 + (i * 37) % 40, bh = 40 + (i * 53) % 90; svg.append(s('rect', { x: i * 90 - 10, y: sy(bh), width: bw, height: G - sy(bh), fill: '#22303d', opacity: 0.8 })); }
  }
  if (E.scene === 'summit') svg.append(s('path', { d: `M0 ${G} L${W * 0.15} ${G - 20} L${W * 0.5} ${G - 2} L${W * 0.85} ${G - 22} L${W} ${G} L${W} ${H} L0 ${H} Z`, fill: '#3b3f44' }), s('path', { d: `M0 ${H} L0 ${G + 30} L${W * 0.25} ${G + 10} L${W * 0.5} ${G} L${W * 0.75} ${G + 12} L${W} ${G + 34} L${W} ${H} Z`, fill: '#55606a' }));
  svg.append(s('rect', { x: 0, y: G, width: W, height: H - G, fill: sea ? '#1b4f7a' : E.scene === 'city' || E.scene === 'apartment' ? '#3a3f45' : E.scene === 'summit' ? '#5b6168' : beach ? '#d9c38d' : '#2a4a2a' }));
  if (beach) svg.append(s('rect', { x: W * 0.72, y: G, width: W * 0.28, height: H - G, fill: '#1b5f8a' }), s('text', { x: W - 8, y: H - 6, class: 'yard-t', 'text-anchor': 'end' }, 'sea →'));
  if (sea) svg.append(s('path', { d: `M${sx(0)} ${G - 4} L${sx(40)} ${G - 4} L${sx(36)} ${G + 10} L${sx(4)} ${G + 10} Z`, fill: '#e8e8e8' }));
  // building for floors
  if (E.floors) {
    const bh = (y.floor || E.floors) * 10 + (E.scene === 'city' ? 4 : 0);
    svg.append(s('rect', { x: sx(-2), y: sy(bh), width: Math.max(140, sx(Math.min(y.lot, 100)) - sx(-2)), height: G - sy(bh), fill: '#6b6f74' }));
    for (let fl = 1; fl <= Math.floor(bh / 10); fl++) for (let wx = 0; wx < 6; wx++) svg.append(s('rect', { x: sx(-2) + 10 + wx * 26, y: sy(fl * 10) + 6, width: 14, height: Math.max(4, 10 * k - 10), fill: fl === y.floor && E.scene === 'apartment' ? '#ffd27a' : '#2b3138' }));
    svg.append(s('text', { x: sx(-2) + 6, y: sy(bh) - 4, class: 'yard-t' }, E.scene === 'apartment' ? `floor ${y.floor}` : `roof, ${bh} ft`));
  }
  if (E.scene === 'attic') { const hx = sx(23); svg.append(s('rect', { x: sx(0), y: sy(10), width: sx(46) - sx(0), height: G - sy(10), fill: '#7a6a58' }), s('path', { d: `M${sx(0) - 8} ${sy(10)} L${hx} ${sy(26)} L${sx(46) + 8} ${sy(10)} Z`, fill: '#4a3a2e', opacity: 0.55, stroke: '#2a1e14' }), s('text', { x: hx, y: sy(13), class: 'yard-t', 'text-anchor': 'middle' }, 'attic (seen through the roof)')); }
  const step = maxFt > 90 ? 20 : 10;
  for (let ft = step; ft < maxFt; ft += step) svg.append(s('line', { x1: 0, x2: W, y1: sy(ft), y2: sy(ft), stroke: '#ffffff12' }), s('text', { x: 4, y: sy(ft) - 2, class: 'yard-t' }, `${ft}′`));
  const placed = [];
  for (const p of y.sup) {
    const x = sx(p.x), b = baseOf(p), t = top(p);
    if (p.kind === 'tree' && /palm/i.test(p.name)) svg.append(s('path', { d: `M${x} ${G} Q ${x + 6} ${sy(t / 2)} ${x} ${sy(t)}`, stroke: '#7a5a34', 'stroke-width': 5, fill: 'none' }), ...[-1, 1, -0.5, 0.5].map((d) => s('path', { d: `M${x} ${sy(t)} q ${d * 26} -6 ${d * 34} 12`, stroke: '#2e7b3a', 'stroke-width': 4, fill: 'none' })));
    else if (p.kind === 'tree') svg.append(s('rect', { x: x - 4, y: sy(p.h * 0.55), width: 8, height: G - sy(p.h * 0.55), fill: '#5b3d22' }), s('ellipse', { cx: x, cy: sy(p.h * 0.72), rx: 10 + p.h * 0.4, ry: p.h * k * 0.32, fill: E.scene === 'park' ? '#2b5f30' : '#2e6b34', opacity: 0.9 }));
    if (p.kind === 'house') svg.append(s('rect', { x: x - 36, y: sy(t), width: 72, height: sy(b) - sy(t), fill: '#7a6a58' }), b ? null : s('path', { d: `M${x - 44} ${sy(t)} L${x} ${sy(t + 10)} L${x + 44} ${sy(t)} Z`, fill: '#4a3a2e' }));
    if (p.kind === 'mast' || p.kind === 'pole' || p.kind === 'boatmast') svg.append(s('rect', { x: x - (p.kind === 'pole' ? 1.5 : 2.5), y: sy(t), width: p.kind === 'pole' ? 3 : 5, height: sy(b) - sy(t), fill: p.kind === 'pole' ? '#c9b98a' : '#b8c0c8' }), p.kind === 'mast' ? s('line', { x1: x, y1: sy(b + (t - b) * 0.6), x2: x + 26, y2: sy(b), stroke: '#ffffff40' }) : null);
    if (p.kind === 'boatmast') svg.append(s('line', { x1: x, y1: sy(t), x2: sx(38), y2: sy(6), stroke: '#cfd6dd', 'stroke-width': 1.5 }));
    if (p.kind === 'rail') svg.append(s('rect', { x: x - 6, y: sy(t), width: 24, height: sy(b) - sy(t), fill: 'none', stroke: '#cfd6dd', 'stroke-width': 1.5 }));
    if (p.kind === 'table') svg.append(s('rect', { x: x - 14, y: sy(t), width: 28, height: 3, fill: '#8a6a43' }), s('rect', { x: x - 6, y: sy(t) + 3, width: 12, height: 6, fill: '#222' }));
    if (p.kind === 'rock') svg.append(s('ellipse', { cx: x, cy: sy(t / 2), rx: 14, ry: (t / 2) * k + 2, fill: '#6d737a' }));
    if (p.kind === 'car') svg.append(s('rect', { x: x - 40, y: sy(4.5), width: 80, height: 4.5 * k - 6, rx: 8, fill: '#8a2b2b' }), s('rect', { x: x - 22, y: sy(6), width: 40, height: 1.6 * k, rx: 6, fill: '#6a2020' }), s('circle', { cx: x - 24, cy: G - 4, r: 7, fill: '#111' }), s('circle', { cx: x + 24, cy: G - 4, r: 7, fill: '#111' }));
    if (p.kind !== 'attic') { const near = placed.some((px) => Math.abs(px - x) < 120); placed.push(x); svg.append(s('text', { x, y: G + (near ? 30 : 14), class: 'yard-t', 'text-anchor': 'middle' }, `${p.name.split(' (')[0]} ${Math.round(t)}′`)); }
    else svg.append(s('circle', { cx: x, cy: sy(t), r: 3, fill: '#c9b98a' }), s('text', { x, y: sy(t) - 6, class: 'yard-t', 'text-anchor': 'middle' }, p.name.replace('Attic ', '')));
  }
  // the antenna
  const wire = (pts, dash) => svg.append(s('polyline', { points: pts.map(([fx, fy]) => `${sx(fx)},${sy(fy)}`).join(' '), fill: 'none', stroke: '#ffb347', 'stroke-width': 2.5, 'stroke-dasharray': dash || 'none' }));
  const dot = (fx, fy) => svg.append(s('circle', { cx: sx(fx), cy: sy(fy), r: 4, fill: '#fff' }));
  if (a.type === 'dipole' && sup(y.ends.a) && sup(y.ends.b) && g.ok !== false) {
    const A = sup(y.ends.a), B = sup(y.ends.b), [l, r] = A.x < B.x ? [A, B] : [B, A];
    const tie = Math.min(top(l), top(r)) - 2, mid = (l.x + r.x) / 2, half = Math.min(a.length / 2, (r.x - l.x) / 2);
    wire([[mid - half, tie], [mid, g.height], [mid + half, tie]]);
    if (g.endsAt != null) { wire([[mid - half, tie], [mid - half, g.endsAt]]); wire([[mid + half, tie], [mid + half, g.endsAt]]); }
    svg.append(s('line', { x1: sx(l.x), y1: sy(top(l) - 2), x2: sx(mid - half), y2: sy(tie), stroke: '#e8e1d0', 'stroke-dasharray': '3 3' }), s('line', { x1: sx(r.x), y1: sy(top(r) - 2), x2: sx(mid + half), y2: sy(tie), stroke: '#e8e1d0', 'stroke-dasharray': '3 3' }));
    dot(mid, g.height);
  }
  if (a.type === 'efhw' && sup(y.ends.efA || y.ends.a) && sup(y.ends.low)) { const A = sup(y.ends.efA || y.ends.a), B = sup(y.ends.low); wire([[A.x, top(A) - 1], [B.x, Math.max(top(B) - 1, 1)]]); dot(B.x, Math.max(top(B) - 1, 1)); }
  if (a.type === 'invv' && sup(y.ends.apex)) {
    const P = sup(y.ends.apex), foot = (g.footprint || 0) / 2, st = stakeH();
    wire([[P.x - foot, st], [P.x, top(P) - 1], [P.x + foot, st]]); dot(P.x, top(P) - 1);
  }
  if (a.type === 'vertical') { const V = sup(y.ends.vert); const x = V ? V.x : (y.sup.find((p) => p.kind === 'mast' || p.kind === 'pole')?.x ?? y.lot / 2), b = V ? top(V) : 0, L = E.scene === 'vehicle' ? Math.min(a.length, 9) : a.length; wire([[x, b], [x, b + L]]); dot(x, b); if (!V) svg.append(s('line', { x1: sx(x - a.length), x2: sx(x + a.length), y1: G + 2, y2: G + 2, stroke: '#ffb347', 'stroke-dasharray': '2 3' })); else wire([[x - 6, b - 2], [x, b], [x + 6, b - 2]], '2 2'); }
  if (a.type === 'yagi') { const T = sup(y.ends.yagi) || y.sup[0]; const x = sx(T.x), yy = sy(g.height); svg.append(s('rect', { x: x - 40, y: yy - 2, width: 80, height: 4, fill: '#ffb347' }), ...[-30, 0, 30].map((d) => s('line', { x1: x + d, x2: x + d, y1: yy - 12, y2: yy + 12, stroke: '#ffb347', 'stroke-width': 2 }))); }
  if (g.height != null) svg.append(s('text', { x: W - 8, y: 18, class: 'yard-t big', 'text-anchor': 'end' }, a.type === 'vertical' ? `base ${Math.round(g.agl ?? 0)} ft above ground` : `feed point ${g.height} ft${g.droop != null ? ` · droop ${g.droop}°` : ''}${g.slope != null ? ` · slope ${g.slope}°` : ''}`));
  return svg;
}

function render() {
  if (!root) return;
  const a = S.antenna, ys = YS(), y = Y(), E = env(), g = geometry(a), B = bom(a, g);
  root.innerHTML = '';
  const supSel = (key, label, filter = () => true) => { const sl = h('select', {}, ...y.sup.filter(filter).map((p) => h('option', { value: p.id, selected: y.ends[key] === p.id }, `${p.name} (${Math.round(top(p))} ft)`))); sl.onchange = () => { y.ends[key] = sl.value; save(); render(); }; return h('label', {}, `${label} `, sl); };
  const num = (obj, key, min, max, after) => { const i = h('input', { type: 'number', min, max, value: obj[key], style: { width: '64px' } }); i.onchange = () => { obj[key] = clamp(+i.value || min, min, max); save(); after ? after() : render(); }; return i; };
  const vertOpts = [h('option', { value: '', selected: !y.ends.vert }, 'Ground mounted'), ...y.sup.filter((p) => !['tree', 'attic', 'rock'].includes(p.kind)).map((p) => h('option', { value: p.id, selected: y.ends.vert === p.id }, `On the ${p.name.toLowerCase()} (${Math.round(top(p))} ft)`))];
  const vSel = h('select', {}, ...vertOpts); vSel.onchange = () => { y.ends.vert = vSel.value || null; save(); render(); };
  const mounts = a.type === 'dipole' ? [supSel('a', 'End 1'), supSel('b', 'End 2')]
    : a.type === 'efhw' ? [supSel(y.ends.efA ? 'efA' : 'a', 'High end'), supSel('low', 'Feed end')]
    : a.type === 'invv' ? [supSel('apex', 'Centre support', (p) => !['rail', 'table', 'rock'].includes(p.kind)), h('label', {}, `Leg ends ${E.stakeOnFloor ? 'above the balcony floor' : E.stakeOnRoof ? 'above the roof' : 'on stakes at'} `, num(y, 'stake', 2, 30), ' ft')]
    : a.type === 'yagi' ? [supSel('yagi', 'Mounted on', (p) => ['mast', 'pole', 'boatmast'].includes(p.kind))]
    : [h('label', {}, 'Vertical ', vSel)];
  const hang = h('button', { class: 'btn primary', id: 'yard-hang', disabled: !g.ok || g.height == null, onclick: () => {
    if (a.type !== 'vertical') a.height = Math.max(3, g.height);
    if (g.droop != null) a.droop = g.droop;
    a.agl = g.agl ?? a.height; a.ground = E.ground;
    S.radio.atuTunedFreq = null; save(); bus.emit('antenna'); bus.emit('antenna-rebuild');
    toast(`${E.icon} Installed${a.type !== 'vertical' ? ` at ${a.height} ft` : ` with its base ${Math.round(a.agl)} ft up`}${g.droop != null ? `, ${g.droop}° droop` : ''} — ground set to ${GROUNDS[E.ground].label.split(' (')[0].toLowerCase()}. Sweep it with the analyzer.`, 'good', 6000);
  } }, `${E.icon} Install it here`);
  const st = (ys.steps[a.type] ||= {});
  const done = STEPS.filter(([kk]) => st[kk]).length;
  const fx = siteEffects(7), fv = siteEffects(146);
  const fxTxt = `Man-made noise ${fx.noiseDb > 0 ? '+' : ''}${fx.noiseDb} dB on HF vs. a typical suburb${fx.lossDb ? ` · ${fx.lossDb} dB extra loss on 40 m` : ''}${fv.lossDb ? ` · ${fv.lossDb} dB on 2 m` : ''} · ground: ${GROUNDS[E.ground].label.split(' (')[0].toLowerCase()}`;
  root.append(h('div', { class: 'card yard' },
    h('div', { class: 'row spread wrap' }, h('h3', {}, `${E.icon} Antenna builder — where are you putting it?`), h('span', { class: 'muted tiny' }, 'The place sets the supports, space, ground, noise and rules — and they all feed the simulation.')),
    h('div', { class: 'env-pick' }, ...Object.entries(ENVS).map(([id, X]) => h('button', { class: `env-btn ${ys.env === id ? 'active' : ''}`, title: X.desc, onclick: () => { ys.env = id; save(); bus.emit('antenna'); render(); } }, h('span', { class: 'env-ic' }, X.icon), X.label))),
    h('div', { class: 'env-info row wrap' }, h('span', { class: 'small' }, h('b', {}, E.label), ` — ${E.desc}`), h('span', { class: 'tiny env-fx' }, fxTxt)),
    drawYard(a, g),
    h('div', { class: 'yard-grid' },
      h('div', {},
        h('h4', {}, 'Supports & space'),
        E.floors ? h('label', { class: 'small' }, E.scene === 'apartment' ? 'Your floor ' : 'Building floors ', num(y, 'floor', 1, 60), ` (≈ ${(y.floor || 1) * 10} ft up)`) : null,
        h('table', { class: 'tbl small' }, h('tr', {}, h('th', {}, ''), h('th', {}, 'Height ft'), h('th', {}, 'Position ft')),
          ...y.sup.map((p) => h('tr', {}, h('td', {}, `${{ tree: /palm/i.test(p.name) ? '🌴' : '🌳', house: '🏠', mast: '🗼', pole: '🎣', rail: '🚧', attic: '📐', table: '🪑', rock: '🪨', car: '🚙', boatmast: '⛵' }[p.kind] || '•'} ${p.name}${baseOf(p) ? ` (+${baseOf(p)} ft base)` : ''}`),
            h('td', {}, p.kind === 'mast' ? h('span', {}, num(p, 'h', 10, mastH()), h('span', { class: 'tiny muted' }, ` max ${mastH()}`)) : num(p, 'h', 2, 120)), h('td', {}, num(p, 'x', 0, y.lot))))),
        h('label', { class: 'small' }, `${E.scene === 'apartment' ? 'Balcony' : E.scene === 'boat' ? 'Boat' : E.scene === 'attic' ? 'Attic' : E.scene === 'city' ? 'Roof' : 'Usable'} width `, num(y, 'lot', 8, 600), ' ft  ', h('button', { class: 'link small', onclick: () => { ys.envs[ys.env] = envState(ys.env); save(); render(); } }, 'reset this place')),
        h('h4', {}, `Mounting the ${ANT_TYPES[a.type].label.split(' (')[0].toLowerCase()}`),
        h('div', { class: 'row wrap' }, ...mounts),
        h('ul', { class: 'rb-checks' }, ...g.notes.map(([kk, t]) => h('li', { class: kk }, `${kk === 'ok' ? '✓' : kk === 'warn' ? '⚠' : '✗'} ${t}`))),
        hang,
        h('h4', {}, `📜 Rules & tips for ${E.label.toLowerCase()}`),
        h('ul', { class: 'small env-rules' }, ...E.rules.map((r) => h('li', {}, r)))),
      h('div', {},
        h('h4', {}, `🧾 Bill of materials ≈ $${Math.round(B.total)}`),
        h('table', { class: 'tbl small' }, ...B.items.map(([q, w, usd]) => h('tr', {}, h('td', { class: 'mono' }, q), h('td', {}, w), h('td', { class: 'muted' }, `$${Math.round(usd)}`)))),
        h('h4', {}, `🔧 Build steps (${done}/${STEPS.length})`),
        h('ol', { class: 'yard-steps' }, ...STEPS.map(([kk, t, d]) => { const c = h('input', { type: 'checkbox', checked: !!st[kk] }); c.onchange = () => { st[kk] = c.checked; save(); if (STEPS.every(([k2]) => st[k2]) && !st.xp) { st.xp = 1; addXp(20, 'antenna built'); toast('🔧 Antenna project complete! +20 XP', 'good'); } render(); }; return h('li', { class: st[kk] ? 'done' : '' }, h('label', {}, c, ' ', h('b', {}, t)), h('div', { class: 'tiny muted' }, d)); })),
        h('p', { class: 'tiny muted' }, `Design frequency ${(targetHz() / 1e6).toFixed(3)} MHz. Prices are typical US retail, for planning.`)))));
}
