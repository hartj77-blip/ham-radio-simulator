// Thin-wire Method of Moments solver (EFIE, Galerkin, triangle/rooftop basis,
// reduced kernel with analytic 1/R inner integrals). Same physics family as NEC/MININEC.
// Pure JS, no DOM — runs in a Web Worker or Node.
//
// Geometry: wires [{p0:[x,y,z], p1:[x,y,z], r: radius_m, n?: segments}], metres, z up.
// Ground: {type:'free'} | {type:'perfect'} | {type:'real', er, sigma}
//   Real ground uses the reflection-coefficient approximation (RCA) for currents and
//   Fresnel coefficients for the far field — as NEC-2 does for its "RCA" ground.
// Feed: {wire, at: 0..1} — a delta-gap source at the node nearest that point on the wire.
// Loads: [{wire, at, R, L, C}] series RLC at a node.

export const C0 = 299792458, ETA = 376.730313668, MU0 = 4e-7 * Math.PI;
const CU = 5.8e7; // copper conductivity

const GL8 = [
  [-0.9602898564975363, 0.1012285362903763], [-0.7966664774136267, 0.2223810344533745],
  [-0.5255324099163290, 0.3137066458778873], [-0.1834346424956498, 0.3626837833783620],
  [0.1834346424956498, 0.3626837833783620], [0.5255324099163290, 0.3137066458778873],
  [0.7966664774136267, 0.2223810344533745], [0.9602898564975363, 0.1012285362903763],
];

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.sqrt(dot(a, a));

export function groundEps(ground, f) {
  const lam = C0 / f;
  return [ground.er, -60 * ground.sigma * lam]; // complex relative permittivity (re, im)
}
// complex helpers
const csqrt = (re, im) => { const m = Math.hypot(re, im); const r = Math.sqrt((m + re) / 2); let i = Math.sqrt(Math.max(0, (m - re) / 2)); if (im < 0) i = -i; return [r, i]; };
const cdiv = (a, b, c, d) => { const den = c * c + d * d; return [(a * c + b * d) / den, (b * c - a * d) / den]; };

// Build segments/nodes/basis functions. Returns a "mesh" reusable across frequencies.
export function mesh(model, fMax) {
  const lam = C0 / fMax;
  const segs = [], nodes = [];
  const tol = 1e-4;
  const nodeAt = (p) => {
    for (let i = 0; i < nodes.length; i++) if (len(sub(nodes[i].p, p)) < tol) return i;
    nodes.push({ p: [...p], att: [] });
    return nodes.length - 1;
  };
  model.wires.forEach((w, wi) => {
    const L = len(sub(w.p1, w.p0));
    let n = w.n || Math.max(5, Math.ceil(L / (lam / 24)));
    n = Math.min(n, Math.max(1, Math.floor(L / (4 * w.r)))); // keep seg length > 4 radii
    n = Math.max(1, n);
    const segIdx = [];
    for (let k = 0; k < n; k++) {
      const a = w.p0.map((v, j) => v + (w.p1[j] - v) * (k / n));
      const b = w.p0.map((v, j) => v + (w.p1[j] - v) * ((k + 1) / n));
      const na = nodeAt(a), nb = nodeAt(b);
      const d = sub(b, a), l = len(d);
      const s = { a: na, b: nb, p0: a, p1: b, len: l, t: d.map((x) => x / l), r: w.r, wire: wi, cond: w.cond || CU };
      segIdx.push(segs.length);
      nodes[na].att.push({ seg: segs.length, end: 'a' });
      nodes[nb].att.push({ seg: segs.length, end: 'b' });
      segs.push(s);
    }
    w._segs = segIdx;
  });
  const gnd = model.ground && model.ground.type !== 'free';
  // basis functions: list of halves {seg, shape:'+'|'-', sign}
  const bases = [];
  nodes.forEach((nd, ni) => {
    const half = (att, into) => {
      // into=true: current flows INTO node along this segment; false: flows OUT of node
      const shape = att.end === 'b' ? '+' : '-';
      const sign = att.end === 'b' ? (into ? 1 : -1) : (into ? -1 : 1);
      return { seg: att.seg, shape, sign };
    };
    const onGround = gnd && Math.abs(nd.p[2]) < tol;
    if (nd.att.length >= 2) {
      for (let j = 1; j < nd.att.length; j++) bases.push({ node: ni, halves: [half(nd.att[0], true), half(nd.att[j], false)] });
    }
    if (onGround && nd.att.length >= 1) {
      for (const at of nd.att) bases.push({ node: ni, halves: [half(at, false)], ground: true });
    }
  });
  return { segs, nodes, bases, model };
}

function nodeNearest(m, wireIdx, at) {
  const w = m.model.wires[wireIdx];
  const p = w.p0.map((v, j) => v + (w.p1[j] - v) * at);
  let best = -1, bd = Infinity;
  m.bases.forEach((b, i) => {
    if (!b.halves.some((h) => m.segs[h.seg].wire === wireIdx) && !b.ground) return;
    const d = len(sub(m.nodes[b.node].p, p));
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}

// Interaction of test segment sm with source segment sn (possibly an image).
// Returns {A:[pp,pm,mp,mm] (complex), P (complex)} where p='+' half, m='-' half.
function interact(sm, sn, k) {
  const out = new Float64Array(10); // A++ re/im, A+- , A-+ , A--, P
  const Dm = sm.len, Dn = sn.len, a2 = sn.r * sn.r;
  for (const [xg, wg] of GL8) {
    const u = (xg + 1) * Dm / 2, w = wg * Dm / 2;
    const P = [sm.p0[0] + sm.t[0] * u, sm.p0[1] + sm.t[1] * u, sm.p0[2] + sm.t[2] * u];
    // analytic part: 1/R
    const wv = sub(P, sn.p0);
    const z = dot(wv, sn.t);
    const rho2 = Math.max(dot(wv, wv) - z * z, 0) + a2;
    const rho = Math.sqrt(rho2);
    const I0 = Math.asinh((Dn - z) / rho) + Math.asinh(z / rho);
    const R0 = Math.sqrt(z * z + rho2), R1 = Math.sqrt((Dn - z) * (Dn - z) + rho2);
    const I1 = R1 - R0 + z * I0;
    // numeric smooth part: (e^{-jkR} - 1)/R
    let J0r = I0, J0i = 0, J1r = I1, J1i = 0;
    for (const [xs, ws] of GL8) {
      const v = (xs + 1) * Dn / 2, wv2 = ws * Dn / 2;
      const R = Math.sqrt((v - z) * (v - z) + rho2);
      const kr = k * R;
      const gr = (Math.cos(kr) - 1) / R, gi = -Math.sin(kr) / R;
      J0r += gr * wv2; J0i += gi * wv2;
      J1r += gr * v * wv2; J1i += gi * v * wv2;
    }
    const fp = u / Dm, fm = 1 - fp;
    // inner with shapes: '+' -> J1/Dn ; '-' -> J0 - J1/Dn
    const npR = J1r / Dn, npI = J1i / Dn, nmR = J0r - npR, nmI = J0i - npI;
    out[0] += w * fp * npR; out[1] += w * fp * npI;
    out[2] += w * fp * nmR; out[3] += w * fp * nmI;
    out[4] += w * fm * npR; out[5] += w * fm * npI;
    out[6] += w * fm * nmR; out[7] += w * fm * nmI;
    out[8] += w * J0r; out[9] += w * J0i;
  }
  return out;
}

const mirror = (s) => ({ ...s, p0: [s.p0[0], s.p0[1], -s.p0[2]], p1: [s.p1[0], s.p1[1], -s.p1[2]], t: [s.t[0], s.t[1], -s.t[2]] });

// Solve at frequency f. Returns {Z:[re,im], I (basis currents re/im arrays), m, f}
export function solve(m, f) {
  const k = 2 * Math.PI * f / C0, omega = 2 * Math.PI * f;
  const S = m.segs.length, N = m.bases.length;
  const ground = m.model.ground || { type: 'free' };
  let Rg = null;
  if (ground.type === 'perfect' || ground.pecCurrents) Rg = [-1, 0];
  else if (ground.type === 'real') {
    const [er, ei] = groundEps(ground, f);
    const [nr, ni] = csqrt(er, ei);
    Rg = cdiv(1 - nr, -ni, 1 + nr, ni);
  }
  // segment-pair interaction table
  const T = new Float64Array(S * S * 10);
  const Ti = Rg ? new Float64Array(S * S * 10) : null;
  const imgs = Rg ? m.segs.map(mirror) : null;
  for (let i = 0; i < S; i++) for (let j = 0; j < S; j++) {
    T.set(interact(m.segs[i], m.segs[j], k), (i * S + j) * 10);
    if (Rg) Ti.set(interact(m.segs[i], imgs[j], k), (i * S + j) * 10);
  }
  const Zr = new Float64Array(N * N), Zi = new Float64Array(N * N);
  const c = ETA / (4 * Math.PI);
  const hidx = (hm, hn) => (hm.shape === '+' ? 0 : 2) + (hn.shape === '+' ? 0 : 1);
  for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) {
    let zr = 0, zi = 0;
    for (const hm of m.bases[a].halves) for (const hn of m.bases[b].halves) {
      const sm = m.segs[hm.seg], sn = m.segs[hn.seg];
      const base = (hm.seg * S + hn.seg) * 10, q = hidx(hm, hn) * 2;
      const dm = (hm.shape === '+' ? 1 : -1) / sm.len, dn = (hn.shape === '+' ? 1 : -1) / sn.len;
      const sg = hm.sign * hn.sign;
      // Z = j*eta/4pi * [ k (tm.tn) A - (1/k) dm dn P ]
      const tt = dot(sm.t, sn.t);
      let xr = k * tt * T[base + q] - dm * dn * T[base + 8] / k;
      let xi = k * tt * T[base + q + 1] - dm * dn * T[base + 9] / k;
      if (Rg) {
        const tti = dot(sm.t, imgs[hn.seg].t);
        const yr = k * tti * Ti[base + q] - dm * dn * Ti[base + 8] / k;
        const yi = k * tti * Ti[base + q + 1] - dm * dn * Ti[base + 9] / k;
        xr += Rg[0] * yr - Rg[1] * yi; xi += Rg[0] * yi + Rg[1] * yr;
      }
      // multiply by j*c*sg: (xr + j xi) * j = -xi + j xr
      zr += sg * c * -xi; zi += sg * c * xr;
      // conductor loss (skin effect) on shared segment
      if (hm.seg === hn.seg) {
        const Rs = Math.sqrt(omega * MU0 / (2 * sm.cond));
        const rl = Rs / (2 * Math.PI * sm.r);
        const ov = hm.shape === hn.shape ? sm.len / 3 : sm.len / 6;
        zr += sg * rl * ov;
      }
    }
    Zr[a * N + b] = zr; Zi[a * N + b] = zi;
  }
  // lumped loads
  for (const ld of m.model.loads || []) {
    const bi = nodeNearest(m, ld.wire, ld.at);
    if (bi < 0) continue;
    let xr = ld.R || 0, xi = (ld.L ? omega * ld.L : 0) - (ld.C ? 1 / (omega * ld.C) : 0);
    Zr[bi * N + bi] += xr; Zi[bi * N + bi] += xi;
  }
  const feed = nodeNearest(m, m.model.feed.wire, m.model.feed.at);
  const Vr = new Float64Array(N), Vi = new Float64Array(N);
  Vr[feed] = 1;
  const [Ir, Ii] = csolve(Zr, Zi, Vr, Vi, N);
  const [zr, zi] = cdiv(1, 0, Ir[feed], Ii[feed]);
  return { f, Z: [zr, zi], Ir, Ii, feed, m, Rg, k };
}

// Complex Gaussian elimination with partial pivoting.
function csolve(Ar0, Ai0, br0, bi0, n) {
  const Ar = Float64Array.from(Ar0), Ai = Float64Array.from(Ai0), br = Float64Array.from(br0), bi = Float64Array.from(bi0);
  for (let c = 0; c < n; c++) {
    let p = c, pm = 0;
    for (let r = c; r < n; r++) { const v = Ar[r * n + c] ** 2 + Ai[r * n + c] ** 2; if (v > pm) { pm = v; p = r; } }
    if (p !== c) {
      for (let j = 0; j < n; j++) { let t = Ar[c * n + j]; Ar[c * n + j] = Ar[p * n + j]; Ar[p * n + j] = t; t = Ai[c * n + j]; Ai[c * n + j] = Ai[p * n + j]; Ai[p * n + j] = t; }
      let t = br[c]; br[c] = br[p]; br[p] = t; t = bi[c]; bi[c] = bi[p]; bi[p] = t;
    }
    const pr = Ar[c * n + c], pi = Ai[c * n + c], pd = pr * pr + pi * pi;
    for (let r = c + 1; r < n; r++) {
      const ar = Ar[r * n + c], ai = Ai[r * n + c];
      if (!ar && !ai) continue;
      const fr = (ar * pr + ai * pi) / pd, fi = (ai * pr - ar * pi) / pd;
      for (let j = c; j < n; j++) {
        const xr = Ar[c * n + j], xi = Ai[c * n + j];
        Ar[r * n + j] -= fr * xr - fi * xi; Ai[r * n + j] -= fr * xi + fi * xr;
      }
      br[r] -= fr * br[c] - fi * bi[c]; bi[r] -= fr * bi[c] + fi * br[c];
    }
  }
  const xr = new Float64Array(n), xi = new Float64Array(n);
  for (let r = n - 1; r >= 0; r--) {
    let sr = br[r], si = bi[r];
    for (let j = r + 1; j < n; j++) { sr -= Ar[r * n + j] * xr[j] - Ai[r * n + j] * xi[j]; si -= Ar[r * n + j] * xi[j] + Ai[r * n + j] * xr[j]; }
    const [qr, qi] = cdiv(sr, si, Ar[r * n + r], Ai[r * n + r]);
    xr[r] = qr; xi[r] = qi;
  }
  return [xr, xi];
}

// Current distribution: per segment, complex current at its two ends (for drawing).
export function segmentCurrents(sol) {
  const { m, Ir, Ii } = sol;
  const out = m.segs.map(() => ({ a: [0, 0], b: [0, 0] }));
  m.bases.forEach((b, n) => b.halves.forEach((h) => {
    const s = out[h.seg], v = [h.sign * Ir[n], h.sign * Ii[n]];
    if (h.shape === '+') { s.b[0] += v[0]; s.b[1] += v[1]; } else { s.a[0] += v[0]; s.a[1] += v[1]; }
  }));
  return out;
}

// Far-field gain (dBi, total of both polarizations) at theta (from zenith), phi (from +x), degrees.
export function gain(sol, thDeg, phDeg) {
  const { m, Ir, Ii, k, f } = sol;
  const th = thDeg * Math.PI / 180, ph = phDeg * Math.PI / 180;
  const rh = [Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th)];
  const thv = [Math.cos(th) * Math.cos(ph), Math.cos(th) * Math.sin(ph), -Math.sin(th)];
  const phv = [-Math.sin(ph), Math.cos(ph), 0];
  const ground = m.model.ground || { type: 'free' };
  if (ground.type !== 'free' && thDeg > 90) return -999;
  const radiate = (img) => {
    let Nr = [0, 0, 0], Ni = [0, 0, 0];
    m.bases.forEach((b, n) => b.halves.forEach((h) => {
      const s0 = m.segs[h.seg];
      const s = img ? mirror(s0) : s0;
      const sgn = img ? -h.sign : h.sign;
      for (const [xg, wg] of GL8) {
        const u = (xg + 1) * s.len / 2, w = wg * s.len / 2;
        const fval = h.shape === '+' ? u / s.len : 1 - u / s.len;
        const P = [s.p0[0] + s.t[0] * u, s.p0[1] + s.t[1] * u, s.p0[2] + s.t[2] * u];
        const phs = k * dot(rh, P);
        const er = Math.cos(phs), ei = Math.sin(phs);
        const ar = sgn * fval * w * (Ir[n] * er - Ii[n] * ei), ai = sgn * fval * w * (Ir[n] * ei + Ii[n] * er);
        for (let j = 0; j < 3; j++) { Nr[j] += ar * s.t[j]; Ni[j] += ai * s.t[j]; }
      }
    }));
    return [dot(Nr, thv), dot(Ni, thv), dot(Nr, phv), dot(Ni, phv)];
  };
  let [tr, ti, pr, pi] = radiate(false);
  if (ground.type !== 'free') {
    const [itr, iti, ipr, ipi] = radiate(true);
    let gv = [1, 0], gh = [-1, 0];
    if (ground.type === 'real') {
      const [er, ei] = groundEps(ground, f);
      const sD = Math.cos(th), cD2 = Math.sin(th) ** 2;
      const [qr, qi] = csqrt(er - cD2, ei);
      gh = cdiv(sD - qr, -qi, sD + qr, qi);
      gv = cdiv(er * sD - qr, ei * sD - qi, er * sD + qr, ei * sD + qi);
    }
    // E = direct + (gv * img_theta, -gh * img_phi)
    tr += gv[0] * itr - gv[1] * iti; ti += gv[0] * iti + gv[1] * itr;
    pr += -(gh[0] * ipr - gh[1] * ipi); pi += -(gh[0] * ipi + gh[1] * ipr);
  }
  // |E|^2 * (k*eta/4pi)^2 ; U = |E|^2/(2 eta); G = 4pi U / Pin
  const fac = (k * ETA / (4 * Math.PI)) ** 2;
  const U = fac * (tr * tr + ti * ti + pr * pr + pi * pi) / (2 * ETA);
  const Iin = [Ir[sol.feed], Ii[sol.feed]];
  const Pin = 0.5 * Iin[0]; // Re(V I*) with V=1
  return 10 * Math.log10(Math.max(4 * Math.PI * U / Pin, 1e-12));
}

// Convenience: sweep impedance over frequencies.
export function sweep(model, freqs) {
  const m = mesh(model, Math.max(...freqs));
  return freqs.map((f) => { const s = solve(m, f); return { f, R: s.Z[0], X: s.Z[1] }; });
}
