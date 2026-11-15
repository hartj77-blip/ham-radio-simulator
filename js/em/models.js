// Parametric antenna templates -> wire models for the MoM solver, plus NEC-2 deck export/import.
import { C0 } from './mom.js';

export const FT = 0.3048, IN = 0.0254;
export const AWG = (g) => 0.127e-3 * Math.pow(92, (36 - g) / 39) / 2; // radius in metres
export const CONDUCTORS = {
  'AWG 10 copper': { r: AWG(10) }, 'AWG 12 copper': { r: AWG(12) }, 'AWG 14 copper': { r: AWG(14) },
  'AWG 16 copper': { r: AWG(16) }, 'AWG 18 copper': { r: AWG(18) },
  '½″ aluminium tube': { r: 0.25 * IN, cond: 3.5e7 }, '1″ aluminium tube': { r: 0.5 * IN, cond: 3.5e7 },
};
export const GROUNDS = {
  free: { type: 'free', label: 'Free space' },
  perfect: { type: 'perfect', label: 'Perfect ground' },
  average: { type: 'real', er: 13, sigma: 0.005, label: 'Average ground (εr 13, σ 5 mS/m)' },
  poor: { type: 'real', er: 5, sigma: 0.001, label: 'Poor/sandy (εr 5, σ 1 mS/m)' },
  good: { type: 'real', er: 20, sigma: 0.0303, label: 'Very good/farmland (εr 20, σ 30 mS/m)' },
  salt: { type: 'real', er: 81, sigma: 5, label: 'Salt water (εr 81, σ 5 S/m)' },
};
// Ground-system loss resistance for ground-mounted λ/4 verticals vs. number of λ/4 buried radials
// (approximate, after Sevick / Rudge measurements over average soil).
export const RADIAL_LOSS = { 0: 40, 4: 18, 8: 12, 16: 7, 32: 3.5, 60: 1.5, 120: 0.5 };

export const TEMPLATES = {
  dipole: {
    label: 'Half-wave dipole', primary: 'len',
    params: { len: ['Total length (ft)', 33.0], h: ['Height (ft)', 35], axis: ['Wire runs toward (°)', 0] },
    help: 'Center-fed. L ≈ 468/f(MHz) ft to start.',
  },
  invv: {
    label: 'Inverted-V dipole', primary: 'len',
    params: { len: ['Total wire length (ft)', 32.0], h: ['Apex height (ft)', 35], droop: ['Leg droop below horizontal (°)', 40], axis: ['Legs run toward (°)', 0] },
    help: 'One center support; legs slope down. Resonates lower than a flat dipole of the same length.',
  },
  vertical: {
    label: '¼-wave vertical (ground mounted)', primary: 'len',
    params: { len: ['Radiator height (ft)', 16.5], radials: ['Buried radials (count)', 16] },
    help: 'Fed at ground level against buried radials. Ground loss is added from published radial-field data (approximate).',
  },
  gp: {
    label: '¼-wave ground plane (elevated radials)', primary: 'len',
    params: { len: ['Radiator length (ft)', 16.5], radLen: ['Radial length (ft)', 16.8], nRad: ['Number of radials', 4], droop: ['Radial droop (°)', 30], h: ['Base height (ft)', 10] },
    help: 'Elevated radials replace the lossy ground. Drooping radials raise the impedance toward 50 Ω.',
  },
  efhw: {
    label: 'End-fed half-wave (49:1)', primary: 'len',
    params: { len: ['Wire length (ft)', 66.0], h: ['Height (ft)', 30], cp: ['Counterpoise / coax shield (ft)', 3], ratio: ['Transformer ratio (1:N)', 49] },
    help: 'Fed at one end through a 1:N unun. The model shows the impedance after an ideal transformer.',
  },
  yagi3: {
    label: '3-element Yagi', primary: 'drv',
    params: { refl: ['Reflector (ft)', 35.5], drv: ['Driven element (ft)', 33.6], dir: ['Director (ft)', 31.9], s1: ['Refl→driven spacing (ft)', 8.0], s2: ['Driven→director spacing (ft)', 8.0], h: ['Height (ft)', 50], heading: ['Beam heading (°)', 0] },
    help: 'Raw driven-element impedance (~20–30 Ω) — use the matcher for a hairpin or gamma match.',
  },
  loop: {
    label: 'Full-wave quad loop', primary: 'len',
    params: { len: ['Total loop perimeter (ft)', 71.5], h: ['Bottom height (ft)', 25] },
    help: 'Square loop in a vertical plane, fed at bottom center. L ≈ 1005/f(MHz) ft.',
  },
};

// direction vector in the horizontal plane for compass bearing (0 = north = +y, 90 = east = +x)
const dirv = (deg) => [Math.sin(deg * Math.PI / 180), Math.cos(deg * Math.PI / 180)];

// Build a MoM model. p = parameter values (feet / degrees); fMax for segmentation hints.
export function buildModel(tpl, p, { cond = 'AWG 14 copper', ground = 'average' } = {}) {
  const c = CONDUCTORS[cond] || CONDUCTORS['AWG 14 copper'];
  const r = c.r, cnd = c.cond;
  const G = GROUNDS[ground] || GROUNDS.average;
  const W = (p0, p1, extra = {}) => ({ p0, p1, r, cond: cnd, ...extra });
  const m = { wires: [], loads: [], feed: { wire: 0, at: 0.5 }, ground: G, post: null };
  switch (tpl) {
    case 'dipole': {
      const L = p.len * FT, h = p.h * FT, [dx, dy] = dirv(p.axis || 0);
      m.wires.push(W([-dx * L / 2, -dy * L / 2, h], [dx * L / 2, dy * L / 2, h], { even: true }));
      break;
    }
    case 'invv': {
      const half = p.len * FT / 2, h = p.h * FT, a = (p.droop || 0) * Math.PI / 180, [dx, dy] = dirv(p.axis || 0);
      const hz = half * Math.cos(a), vz = half * Math.sin(a);
      const apex = [0, 0, h];
      m.wires.push(W([-dx * hz, -dy * hz, Math.max(0.3, h - vz)], apex), W(apex, [dx * hz, dy * hz, Math.max(0.3, h - vz)]));
      m.feed = { wire: 0, at: 1 };
      break;
    }
    case 'vertical': {
      const L = p.len * FT;
      m.wires.push(W([0, 0, 0], [0, 0, L]));
      m.feed = { wire: 0, at: 0 };
      const n = Object.keys(RADIAL_LOSS).map(Number).reduce((b, x) => (x <= (p.radials ?? 16) ? x : b), 0);
      m.loads.push({ wire: 0, at: 0, R: RADIAL_LOSS[n] });
      m.ground = { ...(G.type === 'free' ? GROUNDS.average : G), pecCurrents: true };
      break;
    }
    case 'gp': {
      const L = p.len * FT, h = Math.max(0.5, p.h * FT), rl = p.radLen * FT, a = (p.droop || 0) * Math.PI / 180;
      const base = [0, 0, h];
      m.wires.push(W(base, [0, 0, h + L]));
      for (let i = 0; i < Math.max(1, Math.round(p.nRad)); i++) {
        const az = (i / Math.round(p.nRad)) * 2 * Math.PI;
        m.wires.push(W(base, [rl * Math.cos(a) * Math.cos(az), rl * Math.cos(a) * Math.sin(az), Math.max(0.2, h - rl * Math.sin(a))]));
      }
      m.feed = { wire: 0, at: 0 };
      break;
    }
    case 'efhw': {
      const L = p.len * FT, h = p.h * FT, cp = Math.max(0.3, p.cp * FT);
      const fp = [0, 0, h];
      m.wires.push(W([0, 0, Math.max(0.2, h - cp)], fp), W(fp, [0, L, h]));
      m.feed = { wire: 0, at: 1 };
      m.post = { ratio: p.ratio || 49 };
      break;
    }
    case 'yagi3': {
      const h = p.h * FT, [bx, by] = dirv(p.heading || 0);
      const ex = [by, -bx]; // element direction: perpendicular to boom
      const el = (Lft, pos) => { const L = Lft * FT; const c0 = [bx * pos, by * pos]; return W([c0[0] - ex[0] * L / 2, c0[1] - ex[1] * L / 2, h], [c0[0] + ex[0] * L / 2, c0[1] + ex[1] * L / 2, h], { even: true }); };
      const s1 = p.s1 * FT, s2 = p.s2 * FT;
      m.wires.push(el(p.drv, 0), el(p.refl, -s1), el(p.dir, s2));
      m.feed = { wire: 0, at: 0.5 };
      break;
    }
    case 'loop': {
      const s = p.len * FT / 4, h = p.h * FT;
      const A = [-s / 2, 0, h], B = [s / 2, 0, h], Cc = [s / 2, 0, h + s], D = [-s / 2, 0, h + s];
      m.wires.push(W(A, B, { even: true }), W(B, Cc), W(Cc, D), W(D, A));
      m.feed = { wire: 0, at: 0.5 };
      break;
    }
  }
  return m;
}

// Assign segment counts (λ/24 at fMax, even where a center feed is needed).
export function segment(model, fMax) {
  const lam = C0 / fMax;
  for (const w of model.wires) {
    const L = Math.hypot(w.p1[0] - w.p0[0], w.p1[1] - w.p0[1], w.p1[2] - w.p0[2]);
    let n = Math.max(w.even ? 12 : 7, Math.ceil(L / (lam / 40)));
    if (w.even && n % 2) n++;
    n = Math.min(n, Math.max(2, Math.floor(L / (4 * w.r))));
    w.n = Math.min(n, 120);
  }
  return model;
}

// Apply the template's post-processing (e.g. ideal transformer) to a solved impedance.
export function postZ(model, Z) {
  if (model.post && model.post.ratio) return [Z[0] / model.post.ratio, Z[1] / model.post.ratio];
  return Z;
}

export function scaleParam(tpl, p, k) {
  const q = { ...p };
  const key = TEMPLATES[tpl].primary;
  if (tpl === 'yagi3') { q.refl *= k; q.drv *= k; q.dir *= k; }
  else if (tpl === 'gp') { q.len *= k; q.radLen *= k; }
  else q[key] *= k;
  return q;
}

// ---- NEC-2 card deck
export function toNEC(model, f0, f1, nf, title = 'HamShack Workbench') {
  const out = [`CM ${title}`, 'CE'];
  const segs = [];
  model.wires.forEach((w, i) => {
    let n = w.n || 11;
    const isFeed = i === model.feed.wire;
    if (isFeed && model.feed.at > 0.01 && model.feed.at < 0.99 && n % 2 === 0) n += 1; // odd count -> center segment source
    segs.push(n);
    out.push(`GW ${i + 1} ${n} ${w.p0.map((v) => v.toFixed(4)).join(' ')} ${w.p1.map((v) => v.toFixed(4)).join(' ')} ${w.r.toExponential(4)}`);
  });
  const G = model.ground || { type: 'free' };
  out.push(`GE ${G.type === 'free' ? 0 : 1}`);
  if (G.type === 'perfect') out.push('GN 1');
  else if (G.type === 'real') out.push(`GN 2 0 0 0 ${G.er} ${G.sigma}`);
  out.push(`LD 5 0 0 0 ${(model.wires[0].cond || 5.8e7).toExponential(3)}`);
  for (const ld of model.loads || []) {
    const n = segs[ld.wire];
    out.push(`LD 0 ${ld.wire + 1} ${Math.max(1, Math.round(ld.at * (n - 1)) + 1)} ${Math.max(1, Math.round(ld.at * (n - 1)) + 1)} ${ld.R || 0} ${ld.L || 0} ${ld.C || 0}`);
  }
  const fw = model.feed.wire, n = segs[fw];
  const seg = model.feed.at <= 0.01 ? 1 : model.feed.at >= 0.99 ? n : Math.ceil(n / 2);
  out.push(`EX 0 ${fw + 1} ${seg} 0 1 0`);
  out.push(`FR 0 ${nf} 0 0 ${(f0 / 1e6).toFixed(4)} ${((f1 - f0) / Math.max(1, nf - 1) / 1e6).toFixed(5)}`);
  out.push('RP 0 91 1 1000 0 0 1 1', 'EN');
  return out.join('\n');
}

export function fromNEC(text) {
  const m = { wires: [], loads: [], feed: { wire: 0, at: 0.5 }, ground: GROUNDS.free };
  const tags = {};
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim().split(/[\s,]+/);
    if (t[0] === 'GW') {
      const v = t.slice(1).map(Number);
      tags[v[0]] = m.wires.length;
      m.wires.push({ p0: [v[2], v[3], v[4]], p1: [v[5], v[6], v[7]], r: v[8] || 0.001, n: v[1] });
    } else if (t[0] === 'GN') {
      const v = t.slice(1).map(Number);
      m.ground = v[0] === 1 ? GROUNDS.perfect : v[0] === -1 ? GROUNDS.free : { type: 'real', er: v[4] || 13, sigma: v[5] || 0.005, label: 'from file' };
    } else if (t[0] === 'EX') {
      const v = t.slice(1).map(Number);
      const wi = tags[v[1]] ?? 0, w = m.wires[wi];
      m.feed = { wire: wi, at: w ? (v[2] - 0.5) / w.n : 0.5 };
    }
  }
  return m;
}
