// 🏡 Antenna builder: hang the antenna in YOUR yard. Supports (trees, house, mast/tower) and
// lot size set what's physically possible: height, sag, inverted-V droop, whether the wire even
// fits. Then a real bill of materials and the build steps, like an actual weekend project.
import { S, save, addXp } from './state.js';
import { h, bus, toast, clamp } from './util.js';
import { maxHeight } from './store.js';
import { ANT_TYPES, FEEDS } from './antenna.js';
import { targetHz } from './planner.js';

const NS = 'http://www.w3.org/2000/svg';
const s = (tag, a = {}, ...kids) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(a)) e.setAttribute(k, v); for (const c of kids) if (c != null) e.append(typeof c === 'string' ? document.createTextNode(c) : c); return e; };
const Y = () => (S.yard ||= {
  lot: 140, // usable lot width, ft
  sup: [{ id: 'treeA', kind: 'tree', name: 'Oak', x: 10, h: 45 }, { id: 'house', kind: 'house', name: 'House eave', x: 60, h: 18 }, { id: 'treeB', kind: 'tree', name: 'Maple', x: 125, h: 40 }, { id: 'mast', kind: 'mast', name: 'Mast', x: 85, h: 35 }],
  ends: { a: 'treeA', b: 'treeB', apex: 'mast', low: 'house' }, stake: 8, steps: {},
});
const sup = (id) => Y().sup.find((x) => x.id === id);
const mastH = () => maxHeight(); // a mast/tower's height is what you bought (35 ft push-up pole to start)

// ------------------------------------------------------------------ geometry
export function geometry(a = S.antenna) {
  const y = Y();
  const m = y.sup.find((x) => x.kind === 'mast'); if (m) m.h = Math.min(m.h || 35, mastH());
  const L = a.length || 0, out = { notes: [], ok: true };
  const bad = (t) => { out.notes.push(['bad', t]); out.ok = false; }, warn = (t) => out.notes.push(['warn', t]), ok = (t) => out.notes.push(['ok', t]);
  if (a.type === 'dipole' || (a.type === 'efhw')) {
    const A = sup(y.ends.a), B = sup(a.type === 'efhw' ? y.ends.low : y.ends.b);
    if (!A || !B || A === B) { bad('Pick two different supports for the ends.'); return out; }
    const span = Math.abs(A.x - B.x);
    const hTie = Math.min(A.h, B.h) - 2; // tie-off point a little below the top
    const rope = span - L;
    if (a.type === 'efhw') {
      const hi = Math.max(A.h, B.h) - 2, lo = Math.min(A.h, B.h) - 2;
      const drop = hi - lo, run = Math.sqrt(Math.max(0, L * L - drop * drop));
      if (run > span + 4) warn(`The ${L.toFixed(0)} ft wire is longer than the ${span} ft between supports — the far end will droop or zig-zag. Fine for an EFHW, but keep it in the clear.`);
      out.height = Math.round(Math.max(3, (hi + Math.max(lo, hi - L)) / 2 - L * 0.02));
      out.slope = Math.round(Math.atan2(drop, Math.min(run, span)) * 180 / Math.PI);
      out.ropes = [Math.max(0, span - run)];
      ok(`Sloper from ${hi} ft (${A.name}) down to ${lo} ft (${B.name}) — about ${out.slope}° slope, average height ${out.height} ft.`);
    } else {
      const sag = Math.max(0.6, Math.min(span, L) * 0.035 + 0.8); // wire + coax weight at the centre
      if (rope < 0) {
        // wire longer than the span: ends hang down (a "drooping" dipole)
        const hang = -rope / 2;
        out.height = Math.round(hTie - sag);
        out.endsAt = Math.round(hTie - hang);
        if (out.endsAt < 8) bad(`The wire is ${(-rope).toFixed(0)} ft longer than the ${span} ft span: the ends would hang down to ${out.endsAt} ft — below head height. Move a support, or use an inverted-V.`);
        else warn(`The wire is ${(-rope).toFixed(0)} ft longer than the span: let the last ${hang.toFixed(0)} ft of each end hang down to ${out.endsAt} ft (this slightly lowers the resonant frequency). Insulate the ends — they carry high voltage.`);
        out.ropes = [0, 0];
      } else {
        out.height = Math.round(hTie - sag);
        out.ropes = [rope / 2 + 6, rope / 2 + 6];
        ok(`Span ${span} ft, wire ${L.toFixed(1)} ft: ${(rope / 2).toFixed(0)} ft of rope each side. Centre sags ~${sag.toFixed(1)} ft with the coax → ${out.height} ft at the feed point.`);
      }
      if (Math.min(A.h, B.h) < 25) warn('Low end supports: under ~λ/4 the dipole fires mostly upward (NVIS) — good for nearby, poor for DX.');
    }
    if (A.kind === 'tree' || B.kind === 'tree') ok('Trees sway: use a pulley and a counterweight on the rope so wind doesn\'t snap the wire.');
  } else if (a.type === 'invv') {
    const P = sup(y.ends.apex);
    if (!P) { bad('Pick a centre support.'); return out; }
    const apex = P.h - 1, legH = L / 2, drop = apex - y.stake;
    if (drop >= legH * 0.97) { out.droop = 85; bad(`Each ${legH.toFixed(0)} ft leg can't reach from a ${apex} ft apex down to the ${y.stake} ft stakes. Lower the apex to about ${Math.floor(y.stake + legH * 0.7)} ft (45° droop), raise the stakes, or add rope at the leg ends.`); out.height = apex; out.footprint = 0; out.ropes = [6, 6]; return finish(out); }
    out.droop = Math.round(Math.asin(clamp(drop / legH, 0, 1)) * 180 / Math.PI);
    const foot = 2 * Math.sqrt(Math.max(0, legH * legH - drop * drop));
    out.height = apex;
    out.footprint = Math.round(foot);
    out.ropes = [6, 6];
    if (foot > y.lot) bad(`The legs need ${out.footprint} ft of ground but your lot is ${y.lot} ft wide. Raise the apex, bend the legs, or shorten the antenna (use a higher band).`);
    else ok(`Apex ${apex} ft on the ${P.name}, legs down to ${y.stake} ft stakes: ${out.droop}° droop, ${out.footprint} ft footprint.`);
    if (out.droop > 50) warn(`A ${out.droop}° droop is steep: the included angle is under 90°, which lowers feed impedance and gain. Aim for 30–45°.`);
    if (y.stake < 8) warn('Keep the leg ends above head height (8 ft+) — the tips carry RF voltage.');
  } else if (a.type === 'vertical') {
    const rad = L; // quarter-wave radials ≈ radiator length
    out.height = 0; out.footprint = Math.round(rad * 2);
    if (rad * 2 > y.lot) warn(`Full λ/4 radials need a ${Math.round(rad * 2)} ft circle; your lot is ${y.lot} ft. Shorter radials work — use more of them (they're on the ground, not resonant).`);
    else ok(`Ground-mounted: ${a.radials} radials of ~${rad.toFixed(0)} ft fit in your ${y.lot} ft lot.`);
  } else if (a.type === 'yagi') {
    const T = y.sup.find((x) => x.kind === 'mast');
    out.height = (T?.h || 35) + 3;
    const el = (a.length || 30) * 1.06;
    ok(`On the ${T?.name || 'mast'}: boom ${out.height} ft up; turning radius ~${(el / 2 + 4).toFixed(0)} ft — keep it clear of trees and the house.`);
    if (out.height > 40) warn('Over ~40 ft you\'ll want a guyed or self-supporting tower and a thrust bearing above the rotator.');
  }
  return finish(out, a);
}
function finish(out, a = S.antenna) {
  out.height = Math.min(out.height ?? a.height, maxHeight());
  if (a.type !== 'vertical' && (out.height ?? 0) >= maxHeight()) out.notes.push(['warn', `Your gear tops out at ${maxHeight()} ft (buy a taller mast/tower at the Hamfest).`]);
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
  const y = Y(), W = 760, H = 230, G = 200, sx = (ft) => 30 + ft / Math.max(y.lot, 60) * (W - 60), sy = (ft) => G - ft * 3.2;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'yard-svg' },
    s('defs', {}, s('linearGradient', { id: 'ySky', x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, 'stop-color': '#16324f' }), s('stop', { offset: 1, 'stop-color': '#30587a' }))),
    s('rect', { x: 0, y: 0, width: W, height: G, fill: 'url(#ySky)' }), s('rect', { x: 0, y: G, width: W, height: H - G, fill: '#2a4a2a' }));
  for (const ft of [10, 20, 30, 40, 50, 60]) svg.append(s('line', { x1: 0, x2: W, y1: sy(ft), y2: sy(ft), stroke: '#ffffff12' }), s('text', { x: 4, y: sy(ft) - 2, class: 'yard-t' }, `${ft}′`));
  for (const p of y.sup) {
    const x = sx(p.x);
    if (p.kind === 'tree') svg.append(s('rect', { x: x - 4, y: sy(p.h * 0.55), width: 8, height: G - sy(p.h * 0.55), fill: '#5b3d22' }), s('ellipse', { cx: x, cy: sy(p.h * 0.72), rx: 10 + p.h * 0.45, ry: p.h * 3.2 * 0.32, fill: '#2e6b34', opacity: 0.9 }));
    if (p.kind === 'house') svg.append(s('rect', { x: x - 40, y: sy(p.h), width: 80, height: G - sy(p.h), fill: '#7a6a58' }), s('path', { d: `M${x - 48} ${sy(p.h)} L${x} ${sy(p.h + 12)} L${x + 48} ${sy(p.h)} Z`, fill: '#4a3a2e' }), s('rect', { x: x - 10, y: G - 26, width: 16, height: 26, fill: '#3a2a1e' }));
    if (p.kind === 'mast') svg.append(s('rect', { x: x - 2, y: sy(p.h), width: 4, height: G - sy(p.h), fill: '#b8c0c8' }), ...[0.33, 0.66].map((f) => s('line', { x1: x, y1: sy(p.h * f), x2: x + 30, y2: G, stroke: '#ffffff40' })));
    svg.append(s('text', { x, y: G + 14, class: 'yard-t', 'text-anchor': 'middle' }, `${p.name} ${p.h}′`));
  }
  // the antenna
  const wire = (pts) => svg.append(s('polyline', { points: pts.map(([fx, fy]) => `${sx(fx)},${sy(fy)}`).join(' '), fill: 'none', stroke: '#ffb347', 'stroke-width': 2.5 }));
  const dot = (fx, fy) => svg.append(s('circle', { cx: sx(fx), cy: sy(fy), r: 4, fill: '#fff' }));
  if ((a.type === 'dipole' || a.type === 'efhw') && sup(y.ends.a) && sup(a.type === 'efhw' ? y.ends.low : y.ends.b)) {
    const A = sup(y.ends.a), B = sup(a.type === 'efhw' ? y.ends.low : y.ends.b), L = a.length;
    const [l, r] = A.x < B.x ? [A, B] : [B, A];
    if (a.type === 'efhw') { wire([[A.x, A.h - 2], [B.x, Math.max(B.h - 2, 3)]]); dot(A.x, A.h - 2); }
    else {
      const mid = (l.x + r.x) / 2, span = r.x - l.x, half = Math.min(L / 2, span / 2), hang = Math.max(0, (L - span) / 2);
      wire([[mid - half, (g.endsAt ?? Math.min(l.h, r.h) - 2) + (hang ? hang : 0)], [mid, g.height], [mid + half, (g.endsAt ?? Math.min(l.h, r.h) - 2) + (hang ? hang : 0)]].map(([fx, fy], i) => [fx, i === 1 ? fy : Math.min(l.h, r.h) - 2]));
      if (hang) { wire([[mid - half, Math.min(l.h, r.h) - 2], [mid - half, g.endsAt]]); wire([[mid + half, Math.min(l.h, r.h) - 2], [mid + half, g.endsAt]]); }
      svg.append(s('line', { x1: sx(l.x), y1: sy(l.h - 2), x2: sx(mid - half), y2: sy(Math.min(l.h, r.h) - 2), stroke: '#e8e1d0', 'stroke-dasharray': '3 3' }), s('line', { x1: sx(r.x), y1: sy(r.h - 2), x2: sx(mid + half), y2: sy(Math.min(l.h, r.h) - 2), stroke: '#e8e1d0', 'stroke-dasharray': '3 3' }));
      dot(mid, g.height); svg.append(s('path', { d: `M${sx(mid)} ${sy(g.height)} C ${sx(mid)} ${G - 20}, ${sx(sup('house')?.x || mid)} ${G - 30}, ${sx(sup('house')?.x || mid) - 40} ${G - 30}`, stroke: '#111', 'stroke-width': 2, fill: 'none' }));
    }
  }
  if (a.type === 'invv' && sup(y.ends.apex)) {
    const P = sup(y.ends.apex), foot = (g.footprint || 0) / 2;
    wire([[P.x - foot, y.stake], [P.x, P.h - 1], [P.x + foot, y.stake]]); dot(P.x, P.h - 1);
    svg.append(...[-1, 1].map((d) => s('line', { x1: sx(P.x + d * foot), y1: sy(y.stake), x2: sx(P.x + d * (foot + 4)), y2: G, stroke: '#e8e1d0', 'stroke-dasharray': '3 3' })));
  }
  if (a.type === 'vertical') { const x = sup('mast')?.x ?? 85; wire([[x, 0], [x, a.length]]); svg.append(s('line', { x1: sx(x - a.length), x2: sx(x + a.length), y1: G + 2, y2: G + 2, stroke: '#ffb347', 'stroke-dasharray': '2 3' })); }
  if (a.type === 'yagi') { const T = y.sup.find((x) => x.kind === 'mast'); const x = T?.x ?? 85; svg.append(s('rect', { x: sx(x) - 40, y: sy(g.height) - 2, width: 80, height: 4, fill: '#ffb347' }), ...[-30, 0, 30].map((d) => s('line', { x1: sx(x) + d, x2: sx(x) + d, y1: sy(g.height) - 12, y2: sy(g.height) + 12, stroke: '#ffb347', 'stroke-width': 2 }))); }
  if (g.height != null && a.type !== 'vertical') svg.append(s('text', { x: W - 8, y: 18, class: 'yard-t big', 'text-anchor': 'end' }, `feed point ${g.height} ft${g.droop != null ? ` · droop ${g.droop}°` : ''}${g.slope != null ? ` · slope ${g.slope}°` : ''}`));
  return svg;
}

function render() {
  if (!root) return;
  const a = S.antenna, y = Y(), g = geometry(a), B = bom(a, g);
  root.innerHTML = '';
  const supSel = (key, label, filter = () => true) => { const sl = h('select', {}, ...y.sup.filter(filter).map((p) => h('option', { value: p.id, selected: y.ends[key] === p.id }, `${p.name} (${p.h} ft)`))); sl.onchange = () => { y.ends[key] = sl.value; save(); render(); }; return h('label', {}, `${label} `, sl); };
  const num = (obj, key, min, max, after) => { const i = h('input', { type: 'number', min, max, value: obj[key], style: { width: '64px' } }); i.onchange = () => { obj[key] = clamp(+i.value || min, min, max); save(); after ? after() : render(); }; return i; };
  const mounts = a.type === 'dipole' ? [supSel('a', 'End 1'), supSel('b', 'End 2')]
    : a.type === 'efhw' ? [supSel('a', 'High end'), supSel('low', 'Feed end')]
    : a.type === 'invv' ? [supSel('apex', 'Centre support', (p) => p.kind !== 'house'), h('label', {}, 'Leg-end stakes ', num(y, 'stake', 3, 30), ' ft')]
    : [h('span', { class: 'small muted' }, a.type === 'vertical' ? 'Ground-mounted at the mast spot.' : 'Mounted on the mast/tower.')];
  const hang = h('button', { class: 'btn primary', id: 'yard-hang', disabled: !g.ok || g.height == null || a.type === 'vertical', onclick: () => {
    a.height = Math.max(3, g.height); if (g.droop != null) a.droop = g.droop;
    S.radio.atuTunedFreq = null; save(); bus.emit('antenna'); bus.emit('antenna-rebuild');
    toast(`🏡 Hung at ${a.height} ft${g.droop != null ? ` with ${g.droop}° droop` : ''}. Sweep it with the analyzer.`, 'good', 5000);
  } }, '🪢 Hang it here');
  const st = (y.steps[a.type] ||= {});
  const done = STEPS.filter(([k]) => st[k]).length;
  root.append(h('div', { class: 'card yard' },
    h('div', { class: 'row spread wrap' }, h('h3', {}, '🏡 Antenna builder — your yard'), h('span', { class: 'muted tiny' }, 'Supports and lot size decide height, sag, droop and whether it fits.')),
    drawYard(a, g),
    h('div', { class: 'yard-grid' },
      h('div', {},
        h('h4', {}, 'Supports'),
        h('table', { class: 'tbl small' }, h('tr', {}, h('th', {}, ''), h('th', {}, 'Height ft'), h('th', {}, 'Position ft')),
          ...y.sup.map((p) => h('tr', {}, h('td', {}, `${p.kind === 'tree' ? '🌳' : p.kind === 'house' ? '🏠' : '🗼'} ${p.name}`), h('td', {}, p.kind === 'mast' ? h('span', {}, num(p, 'h', 10, mastH()), h('span', { class: 'tiny muted' }, ` max ${mastH()}`)) : num(p, 'h', 6, 90)), h('td', {}, num(p, 'x', 0, y.lot))))),
        h('label', { class: 'small' }, 'Usable lot width ', num(y, 'lot', 40, 600), ' ft'),
        h('h4', {}, `Mounting the ${ANT_TYPES[a.type].label.split(' (')[0].toLowerCase()}`),
        h('div', { class: 'row wrap' }, ...mounts),
        h('ul', { class: 'rb-checks' }, ...g.notes.map(([k, t]) => h('li', { class: k }, `${k === 'ok' ? '✓' : k === 'warn' ? '⚠' : '✗'} ${t}`))),
        hang),
      h('div', {},
        h('h4', {}, `🧾 Bill of materials ≈ $${Math.round(B.total)}`),
        h('table', { class: 'tbl small' }, ...B.items.map(([q, w, usd]) => h('tr', {}, h('td', { class: 'mono' }, q), h('td', {}, w), h('td', { class: 'muted' }, `$${Math.round(usd)}`)))),
        h('h4', {}, `🔧 Build steps (${done}/${STEPS.length})`),
        h('ol', { class: 'yard-steps' }, ...STEPS.map(([k, t, d]) => { const c = h('input', { type: 'checkbox', checked: !!st[k] }); c.onchange = () => { st[k] = c.checked; save(); if (STEPS.every(([kk]) => st[kk]) && !st.xp) { st.xp = 1; addXp(20, 'antenna built'); toast('🔧 Antenna project complete! +20 XP', 'good'); } render(); }; return h('li', { class: st[k] ? 'done' : '' }, h('label', {}, c, ' ', h('b', {}, t)), h('div', { class: 'tiny muted' }, d)); })),
        h('p', { class: 'tiny muted' }, `Design frequency ${(targetHz() / 1e6).toFixed(3)} MHz. Prices are typical US retail, for planning.`)))));
}
