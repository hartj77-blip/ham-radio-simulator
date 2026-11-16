// Transmission lines, matching networks, measurement import. Exact circuit maths.
export const C0 = 299792458;

// Cable data: Z0 (ohm), velocity factor, matched loss dB/100 ft at 10 MHz and 100 MHz (typical datasheet values).
export const CABLES = {
  'RG-174': { z0: 50, vf: 0.66, l10: 3.3, l100: 10.6 },
  'RG-58': { z0: 50, vf: 0.66, l10: 1.4, l100: 4.9 },
  'RG-8X': { z0: 50, vf: 0.82, l10: 1.0, l100: 3.7 },
  'LMR-240': { z0: 50, vf: 0.84, l10: 0.8, l100: 3.0 },
  'RG-213': { z0: 50, vf: 0.66, l10: 0.65, l100: 2.2 },
  'LMR-400': { z0: 50, vf: 0.85, l10: 0.42, l100: 1.35 },
  'RG-59': { z0: 75, vf: 0.66, l10: 1.1, l100: 3.4 },
  'RG-6': { z0: 75, vf: 0.83, l10: 0.6, l100: 2.0 },
  '300 Ω twinlead': { z0: 300, vf: 0.82, l10: 0.27, l100: 1.2 },
  '450 Ω ladder line': { z0: 450, vf: 0.91, l10: 0.06, l100: 0.3 },
  '600 Ω open wire': { z0: 600, vf: 0.95, l10: 0.02, l100: 0.1 },
};

// ---- complex arithmetic on [re, im]
export const cx = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1]],
  mul: (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]],
  div: (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; },
  abs: (a) => Math.hypot(a[0], a[1]),
  inv: (a) => { const d = a[0] * a[0] + a[1] * a[1]; return [a[0] / d, -a[1] / d]; },
  tanh: ([x, y]) => { const d = Math.cosh(2 * x) + Math.cos(2 * y); return [Math.sinh(2 * x) / d, Math.sin(2 * y) / d]; },
};

export function lossDbPerM(cable, fHz) {
  const c = CABLES[cable];
  const f = fHz / 1e6;
  const p = Math.log10(c.l100 / c.l10);
  return c.l10 * Math.pow(f / 10, p) / 30.48; // dB per metre
}

function gammaL(cable, fHz, lenM) {
  const c = CABLES[cable];
  const alpha = lossDbPerM(cable, fHz) / 8.685889638;
  const beta = 2 * Math.PI * fHz / (C0 * c.vf);
  return [alpha * lenM, beta * lenM];
}

// Impedance seen at the input of `lenM` metres of cable terminated in Z.
export function lineIn(cable, fHz, lenM, Z) {
  const z0 = [CABLES[cable].z0, 0];
  const t = cx.tanh(gammaL(cable, fHz, lenM));
  return cx.mul(z0, cx.div(cx.add(Z, cx.mul(z0, t)), cx.add(z0, cx.mul(Z, t))));
}
// Remove a cable: impedance at the far (antenna) end given the impedance measured at the near end.
export function deembed(cable, fHz, lenM, Zin) {
  const z0 = [CABLES[cable].z0, 0];
  const t = cx.tanh(gammaL(cable, fHz, lenM));
  return cx.mul(z0, cx.div(cx.sub(Zin, cx.mul(z0, t)), cx.sub(z0, cx.mul(Zin, t))));
}
// Total line loss (dB) including the extra loss caused by mismatch (Z0 real approx).
export function lineLossDb(cable, fHz, lenM, ZL) {
  const A = lossDbPerM(cable, fHz) * lenM;
  const a = Math.pow(10, A / 10);
  const g = gammaMag(ZL, CABLES[cable].z0);
  return 10 * Math.log10((a * a - g * g) / (a * (1 - g * g)));
}

export const gammaOf = (Z, z0 = 50) => cx.div(cx.sub(Z, [z0, 0]), cx.add(Z, [z0, 0]));
export const gammaMag = (Z, z0 = 50) => cx.abs(gammaOf(Z, z0));
export const swr = (Z, z0 = 50) => { const g = gammaMag(Z, z0); return g >= 0.9999 ? 999 : (1 + g) / (1 - g); };
export const zFromGamma = (g, z0 = 50) => cx.mul([z0, 0], cx.div(cx.add([1, 0], g), cx.sub([1, 0], g)));

// ---- components
export function reactanceToPart(X, f) {
  const w = 2 * Math.PI * f;
  if (Math.abs(X) < 0.05) return { type: 'none', value: 0, text: '— (straight wire)', X: 0 };
  if (X >= 0) return { type: 'L', value: X / w, text: fmtL(X / w), X };
  return { type: 'C', value: -1 / (w * X), text: fmtC(-1 / (w * X)), X };
}
export function susceptanceToPart(B, f) {
  const w = 2 * Math.PI * f;
  if (Math.abs(B) < 2e-5) return { type: 'none', value: 0, text: '— (none)', X: Infinity };
  if (B >= 0) return { type: 'C', value: B / w, text: fmtC(B / w), X: -1 / B };
  return { type: 'L', value: -1 / (w * B), text: fmtL(-1 / (w * B)), X: -1 / B };
}
export const fmtL = (h) => (h >= 1e-6 ? `${(h * 1e6).toFixed(2)} µH` : `${(h * 1e9).toFixed(0)} nH`);
export const fmtC = (f) => (f >= 1e-9 ? `${(f * 1e9).toFixed(2)} nF` : `${(f * 1e12).toFixed(0)} pF`);

// Lossy element impedance at frequency f from an ideal part (Q-limited).
function partZ(p, f, QL, QC) {
  const w = 2 * Math.PI * f;
  if (p.type === 'none') return null;
  if (p.type === 'L') { const X = w * p.value; return [X / QL, X]; }
  const X = -1 / (w * p.value); return [-X / QC, X];
}

// L-network solutions matching ZL to Rs. Each solution: {topo, series, shunt, describe(f)}.
// topo 'shuntLoad': source - series - [shunt across load] - load
// topo 'shuntSource': source - [shunt across source] - series - load
export function lNetworks(ZL, f, Rs = 50) {
  const out = [];
  const [RL, XL] = ZL;
  const Y = cx.inv(ZL), G = Y[0], BL = Y[1];
  if (G * Rs <= 1 + 1e-12) {
    const q = Math.sqrt(Math.max(0, G / Rs - G * G));
    for (const Bt of [q, -q]) {
      const B = Bt - BL;
      const Xafter = -Bt / (G * G + Bt * Bt);
      const Xs = -Xafter;
      out.push({ topo: 'shuntLoad', shunt: susceptanceToPart(B, f), series: reactanceToPart(Xs, f) });
    }
  }
  if (RL <= Rs + 1e-12) {
    const q = Math.sqrt(Math.max(0, RL * Rs - RL * RL));
    for (const Xt of [q, -q]) {
      const Xs = Xt - XL;
      const Bp = -(-Xt / (RL * RL + Xt * Xt));
      out.push({ topo: 'shuntSource', series: reactanceToPart(Xs, f), shunt: susceptanceToPart(Bp, f) });
    }
  }
  // drop degenerate (near-zero element) duplicates
  return out.filter((s, i, a) => a.findIndex((t) => t.series.text === s.series.text && t.shunt.text === s.shunt.text && (t.topo === s.topo || s.shunt.type === 'none')) === i);
}

// Input impedance and efficiency of an L-network with fixed components at frequency f.
export function lNetEval(net, ZL, f, QL = 150, QC = 1000) {
  const Zs = partZ(net.series, f, QL, QC) || [0, 0], Zp = partZ(net.shunt, f, QL, QC);
  const Yp = Zp ? cx.inv(Zp) : [0, 0];
  if (net.topo === 'shuntLoad') {
    const Zpar = cx.inv(cx.add(Yp, cx.inv(ZL)));
    const Zin = cx.add(Zs, Zpar);
    const Pin = Zin[0];
    const V = Zpar; // current 1 A
    const Pl = (V[0] ** 2 + V[1] ** 2) * cx.inv(ZL)[0];
    return { Zin, eff: Pl / Pin };
  }
  const Zser = cx.add(Zs, ZL);
  const Yin = cx.add(Yp, cx.inv(Zser));
  const Zin = cx.inv(Yin);
  const Pin = Yin[0];
  const I = cx.inv(Zser);
  const Pl = (I[0] ** 2 + I[1] ** 2) * ZL[0];
  return { Zin, eff: Pl / Pin };
}

// Single shunt-stub match (Pozar). Lengths returned in wavelengths and metres in the given cable.
export function stubMatch(ZL, f, cable = 'RG-213') {
  const Z0 = CABLES[cable].z0, vf = CABLES[cable].vf;
  const lam = C0 / f * vf;
  const [RL, XL] = ZL;
  const ts = Math.abs(RL - Z0) < 1e-9 ? [-XL / (2 * Z0)] : [1, -1].map((sg) => (XL + sg * Math.sqrt(RL * ((Z0 - RL) ** 2 + XL ** 2) / Z0)) / (RL - Z0));
  return ts.map((t) => {
    let d = t >= 0 ? Math.atan(t) / (2 * Math.PI) : (Math.PI + Math.atan(t)) / (2 * Math.PI);
    const B = (RL * RL * t - (Z0 - XL * t) * (XL + Z0 * t)) / (Z0 * (RL * RL + (XL + Z0 * t) ** 2));
    const Y0 = 1 / Z0;
    let lo = -Math.atan(B / Y0) / (2 * Math.PI); if (lo < 0) lo += 0.5;
    let ls = Math.atan(Y0 / B) / (2 * Math.PI); if (ls < 0) ls += 0.5;
    return { d, lo, ls, dM: d * lam, loM: lo * lam, lsM: ls * lam };
  });
}

// Matching-transformer suggestions for a (nearly) resistive load.
export function transformerSuggest(ZL, z0 = 50) {
  const R = ZL[0];
  const ratios = [1, 1.5, 2, 4, 9, 16, 49, 64];
  const best = ratios.map((n) => ({ n, swr: swr([ZL[0] / n, ZL[1] / n], z0) })).sort((a, b) => a.swr - b.swr)[0];
  const zq = Math.sqrt(R * z0);
  return { unun: best, quarterWaveZ0: zq };
}

// ---- measurement import (Touchstone .s1p / CSV)
export function parseMeasurement(text) {
  const lines = text.split(/\r?\n/);
  let unit = 1e9, fmt = 'MA', z0 = 50, param = 'S';
  const pts = [];
  const isS1p = lines.some((l) => /^\s*#/.test(l));
  if (isS1p) {
    for (const l of lines) {
      const s = l.trim();
      if (!s || s.startsWith('!')) continue;
      if (s.startsWith('#')) {
        const t = s.slice(1).trim().toUpperCase().split(/\s+/);
        for (let i = 0; i < t.length; i++) {
          if (t[i] === 'HZ') unit = 1; else if (t[i] === 'KHZ') unit = 1e3; else if (t[i] === 'MHZ') unit = 1e6; else if (t[i] === 'GHZ') unit = 1e9;
          else if (['MA', 'DB', 'RI'].includes(t[i])) fmt = t[i];
          else if (['S', 'Z', 'Y'].includes(t[i])) param = t[i];
          else if (t[i] === 'R') { z0 = parseFloat(t[i + 1]); i++; }
        }
        continue;
      }
      const v = s.split(/\s+/).map(Number);
      if (v.length < 3 || v.some(isNaN)) continue;
      const f = v[0] * unit;
      let a = v[1], b = v[2], g;
      if (fmt === 'RI') g = [a, b];
      else { const mag = fmt === 'DB' ? Math.pow(10, a / 20) : a; const ang = b * Math.PI / 180; g = [mag * Math.cos(ang), mag * Math.sin(ang)]; }
      let Z;
      if (param === 'S') Z = zFromGamma(g, z0);
      else if (param === 'Z') Z = fmt === 'RI' ? [a * z0, b * z0] : [g[0] * z0, g[1] * z0];
      else Z = cx.inv(fmt === 'RI' ? [a / z0, b / z0] : [g[0] / z0, g[1] / z0]);
      pts.push({ f, Z });
    }
    return { pts, kind: 'complex', source: 'Touchstone' };
  }
  // CSV / TSV with a header
  const rows = lines.map((l) => l.split(/[,;\t]/).map((x) => x.trim())).filter((r) => r.length >= 2);
  if (!rows.length) return { pts: [], kind: 'none' };
  const hdr = rows[0].map((h) => h.toLowerCase());
  const hasHdr = hdr.some((h) => /[a-z]/.test(h));
  const body = hasHdr ? rows.slice(1) : rows;
  const col = (re) => hdr.findIndex((h) => re.test(h));
  const fi = Math.max(0, col(/freq/));
  let ri = col(/^r(\b|$|s|_|\s|\()|resist|real/), xi = col(/^x(\b|$|s|_|\s|\()|react|imag/), si = col(/swr/);
  if (!hasHdr) { ri = rows[0].length >= 3 ? 1 : -1; xi = rows[0].length >= 3 ? 2 : -1; si = rows[0].length === 2 ? 1 : -1; }
  for (const r of body) {
    let f = parseFloat(r[fi]);
    if (isNaN(f)) continue;
    if (f < 1000) f *= 1e6; // assume MHz
    if (ri >= 0 && xi >= 0) pts.push({ f, Z: [parseFloat(r[ri]), parseFloat(r[xi])] });
    else if (si >= 0) pts.push({ f, swr: parseFloat(r[si]) });
  }
  return { pts, kind: pts[0]?.Z ? 'complex' : 'swr', source: 'CSV' };
}

// Find resonance (X zero crossing nearest the SWR minimum) and SWR minimum.
export function analyzeSweep(pts, z0 = 50) {
  if (!pts.length) return null;
  const s = pts.map((p) => ({ ...p, swr: p.swr ?? swr(p.Z, z0) }));
  let min = s[0];
  for (const p of s) if (p.swr < min.swr) min = p;
  let res = null;
  if (s[0].Z) {
    const cr = [];
    for (let i = 1; i < s.length; i++) {
      const a = s[i - 1], b = s[i];
      if ((a.Z[1] <= 0 && b.Z[1] > 0) || (a.Z[1] >= 0 && b.Z[1] < 0)) {
        const t = a.Z[1] / (a.Z[1] - b.Z[1]);
        cr.push({ f: a.f + (b.f - a.f) * t, R: a.Z[0] + (b.Z[0] - a.Z[0]) * t, series: a.Z[1] < 0 });
      }
    }
    // prefer series resonance (X going - to +) closest to the SWR minimum
    cr.sort((x, y) => (y.series - x.series) || Math.abs(x.f - min.f) - Math.abs(y.f - min.f));
    res = cr[0] || null;
  }
  // 2:1 bandwidth
  let bw = null;
  const under = s.filter((p) => p.swr <= 2);
  if (under.length) bw = [under[0].f, under[under.length - 1].f];
  return { min, res, bw };
}

// NanoVNA over Web Serial (Chrome/Edge). Returns [{f, Z}]
export async function nanoVnaSweep(start, stop, points = 101, onStatus = () => { }) {
  if (!('serial' in navigator)) throw new Error('Web Serial is not available in this browser (use Chrome or Edge on desktop).');
  const port = await navigator.serial.requestPort();
  await port.open({ baudRate: 115200 });
  const enc = new TextEncoder(), dec = new TextDecoder();
  const writer = port.writable.getWriter();
  const reader = port.readable.getReader();
  let buf = '';
  const readUntilPrompt = async (ms = 15000) => {
    const t0 = Date.now();
    while (!buf.includes('ch> ')) {
      if (Date.now() - t0 > ms) throw new Error('The analyzer did not respond');
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value);
    }
    const out = buf.slice(0, buf.indexOf('ch> '));
    buf = buf.slice(buf.indexOf('ch> ') + 4);
    return out;
  };
  const cmd = async (c) => { await writer.write(enc.encode(c + '\r')); const r = await readUntilPrompt(); return r.split(/\r?\n/).slice(1).map((l) => l.trim()).filter(Boolean); };
  try {
    onStatus('Connected — waking the analyzer…');
    await writer.write(enc.encode('\r'));
    await readUntilPrompt(4000).catch(() => { });
    onStatus('Sweeping…');
    await cmd(`sweep ${Math.round(start)} ${Math.round(stop)} ${points}`);
    await new Promise((r) => setTimeout(r, 800));
    const fr = (await cmd('frequencies')).map(Number).filter((x) => x > 0);
    const dat = (await cmd('data 0')).map((l) => l.split(/\s+/).map(Number));
    onStatus('Done.');
    return fr.map((f, i) => ({ f, Z: zFromGamma(dat[i], 50) })).filter((p) => p.Z.every(isFinite));
  } finally {
    reader.releaseLock(); writer.releaseLock(); await port.close().catch(() => { });
  }
}
