// RF measurement maths used by the RF tools page. Pure functions, no DOM, so they can be
// checked against reference values (see the worked examples in the library articles).
// Units are stated in every name or comment; frequencies are MHz unless noted.

export const C = 299792458; // speed of light, m/s (exact)
export const LOG10 = Math.log10;

// ---------------------------------------------------------------- power, voltage and decibels
export const wToDbm = (w) => 10 * LOG10(w * 1000);
export const dbmToW = (dbm) => Math.pow(10, dbm / 10) / 1000;
// RMS volts across R for a given power (sine or any waveform, RMS)
export const dbmToVrms = (dbm, R = 50) => Math.sqrt(dbmToW(dbm) * R);
export const vrmsToDbm = (v, R = 50) => wToDbm((v * v) / R);
// dBµV is volts relative to 1 µV: 20·log10(V / 1e-6)
export const dbmToDbuv = (dbm, R = 50) => 20 * LOG10(dbmToVrms(dbm, R) / 1e-6);
export const dbuvToDbm = (dbuv, R = 50) => vrmsToDbm(Math.pow(10, dbuv / 20) * 1e-6, R);
// Power from an oscilloscope reading across a resistive load: P = Vpp² / (8R) for a sine wave
export const vppToW = (vpp, R = 50) => (vpp * vpp) / (8 * R);

// S-meter per IARU Region 1 Technical Recommendation R.1: S9 = −73 dBm below 30 MHz,
// −93 dBm at and above 30 MHz, 6 dB per S-unit.
export function sMeter(dbm, fMHz = 14) {
  const s9 = fMHz < 30 ? -73 : -93;
  const over = dbm - s9;
  if (over >= 0) return { s: 9, over, text: over < 0.5 ? 'S9' : `S9+${Math.round(over)} dB` };
  const s = 9 + over / 6;
  if (s < 1) return { s, over, text: 'below S1' };
  return { s, over, text: `S${Math.floor(s + 1e-9)}` };
}

// ---------------------------------------------------------------- reflection, SWR, return loss
// Everything follows from |Γ| (reflection coefficient magnitude, 0..1).
export function mismatch(g) {
  g = Math.min(Math.max(g, 0), 0.999999);
  const swr = (1 + g) / (1 - g);
  return {
    gamma: g,
    swr,
    returnLoss: g > 0 ? -20 * LOG10(g) : Infinity, // dB
    mismatchLoss: -10 * LOG10(1 - g * g), // dB not delivered to the load (lossless line, matched source)
    reflectedPct: g * g * 100,
    deliveredPct: (1 - g * g) * 100,
  };
}
export const gammaFromSwr = (s) => (s - 1) / (s + 1);
export const gammaFromRl = (rl) => Math.pow(10, -rl / 20);
export const gammaFromPowers = (fwd, ref) => Math.sqrt(Math.max(0, ref) / Math.max(fwd, 1e-12));
// Complex load R + jX on a line of characteristic impedance Z0 → |Γ|
export function gammaFromZ(R, X, Z0 = 50) {
  const nr = R - Z0, dr = R + Z0;
  return Math.sqrt((nr * nr + X * X) / (dr * dr + X * X));
}
// Highest RMS voltage and current on a lossless line carrying P watts at a given SWR
// (voltage maximum = √(P·Z0·SWR); peak = √2 × RMS). Useful for rating capacitors and coax.
export function lineStress(P, swr, Z0 = 50) {
  const vrms = Math.sqrt(P * Z0 * swr), irms = Math.sqrt((P * swr) / Z0);
  return { vrms, vpk: vrms * Math.SQRT2, irms, ipk: irms * Math.SQRT2 };
}

// ---------------------------------------------------------------- feedline loss with mismatch
// matchedDb: matched loss of the whole line (dB). gL: |Γ| at the load.
// Total loss = 10·log10[(a² − |Γ|²) / (a·(1 − |Γ|²))], a = 10^(matched/10)  (ARRL Antenna Book).
// |Γ| seen at the transmitter is reduced by twice the one-way loss: |Γin| = |ΓL| · 10^(−matched/10).
export function lineLoss(matchedDb, gL) {
  const a = Math.pow(10, matchedDb / 10);
  const g2 = gL * gL;
  const total = 10 * LOG10((a * a - g2) / (a * (1 - g2)));
  const gIn = gL / a;
  return { matched: matchedDb, total, extra: total - matchedDb, gIn, swrIn: (1 + gIn) / (1 - gIn), efficiency: Math.pow(10, -total / 10) };
}

// ---------------------------------------------------------------- radiated power and links
export const dbdToDbi = (dbd) => dbd + 2.15;
export const dbiToDbd = (dbi) => dbi - 2.15;
// Free-space path loss, d in km, f in MHz: 20log(d) + 20log(f) + 32.45 dB
export const fspl = (dKm, fMHz) => 20 * LOG10(dKm) + 20 * LOG10(fMHz) + 20 * LOG10((4 * Math.PI * 1e9) / C);
// Thermal noise power in a bandwidth at 290 K plus receiver noise figure, dBm
export const noiseFloor = (bwHz, nfDb = 0) => 10 * LOG10(1.380649e-23 * 290 * 1000) + 10 * LOG10(bwHz) + nfDb;
export const nfToTemp = (nfDb) => 290 * (Math.pow(10, nfDb / 10) - 1);
export const tempToNf = (k) => 10 * LOG10(1 + k / 290);
// Radio horizon over a smooth earth with standard refraction (k = 4/3), heights in metres → km
export const radioHorizon = (h1, h2 = 0) => Math.sqrt(2 * (4 / 3) * 6371e3) / 1000 * (Math.sqrt(h1) + Math.sqrt(h2));
// Radius of the n-th Fresnel zone at a point d1 / d2 km from each end, f in MHz → metres
export const fresnel = (d1Km, d2Km, fMHz, n = 1) => Math.sqrt((n * (C / (fMHz * 1e6)) * d1Km * d2Km * 1000) / (d1Km + d2Km));

// ---------------------------------------------------------------- RF exposure (FCC)
// Maximum permissible exposure, 47 CFR §1.1310 Table 1, power density in mW/cm² (f in MHz).
export function mpeLimit(fMHz, controlled) {
  const f = fMHz;
  if (controlled) {
    if (f < 3) return 100;
    if (f < 30) return 900 / (f * f);
    if (f < 300) return 1.0;
    if (f < 1500) return f / 300;
    return 5;
  }
  if (f < 1.34) return 100;
  if (f < 30) return 180 / (f * f);
  if (f < 300) return 0.2;
  if (f < 1500) return f / 1500;
  return 1.0;
}
// Duty factors for common emissions (FCC OET Bulletin 65 Supplement B, Table 1)
export const DUTY = { 'SSB voice': 0.2, 'SSB voice, heavy processing': 0.4, 'CW': 0.4, 'FM / AM carrier': 1.0, 'FT8 / RTTY / data': 1.0 };
// Far-field power density with optional ground reflection (×2.56 for a 1.6 field factor), mW/cm².
// pAvgW: average power at the antenna after duty and time averaging.
export function powerDensity(pAvgW, gainDbi, distM, ground = true) {
  const eirpMw = pAvgW * 1000 * Math.pow(10, gainDbi / 10);
  const rCm = distM * 100;
  return ((ground ? 2.56 : 1) * eirpMw) / (4 * Math.PI * rCm * rCm);
}
export function safeDistance(pAvgW, gainDbi, limit, ground = true) {
  const eirpMw = pAvgW * 1000 * Math.pow(10, gainDbi / 10);
  return Math.sqrt(((ground ? 2.56 : 1) * eirpMw) / (4 * Math.PI * limit)) / 100; // metres
}

// ---------------------------------------------------------------- wavelength and antenna lengths
export const wavelength = (fMHz) => C / (fMHz * 1e6); // metres
export const M_PER_FT = 0.3048;
// Practical cut lengths for thin wire at HF (end effect included): dipole 468/f ft, ¼-wave 234/f ft,
// full-wave loop 1005/f ft. Always cut long and trim with an analyzer.
export function antennaLengths(fMHz) {
  const ft = { dipole: 468 / fMHz, quarter: 234 / fMHz, loop: 1005 / fMHz, fiveEighths: 585 / fMHz };
  return Object.fromEntries(Object.entries(ft).map(([k, v]) => [k, { ft: v, m: v * M_PER_FT }]));
}
// Physical length of an electrical fraction of a wavelength in a cable with velocity factor vf
export const electricalLength = (fMHz, fraction, vf) => wavelength(fMHz) * fraction * vf;

// ---------------------------------------------------------------- resonance and reactance
export const resonantFreq = (L, Cf) => 1 / (2 * Math.PI * Math.sqrt(L * Cf)); // H, F → Hz
export const lForResonance = (fHz, Cf) => 1 / (Math.pow(2 * Math.PI * fHz, 2) * Cf);
export const cForResonance = (fHz, L) => 1 / (Math.pow(2 * Math.PI * fHz, 2) * L);
export const xl = (fHz, L) => 2 * Math.PI * fHz * L;
export const xc = (fHz, Cf) => 1 / (2 * Math.PI * fHz * Cf);

// ---------------------------------------------------------------- spectrum analysis (FFT)
export const WINDOWS = {
  Rectangular: () => 1,
  Hann: (n, N) => 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / (N - 1)),
  Hamming: (n, N) => 0.54 - 0.46 * Math.cos((2 * Math.PI * n) / (N - 1)),
  'Blackman-Harris': (n, N) => { const x = (2 * Math.PI * n) / (N - 1); return 0.35875 - 0.48829 * Math.cos(x) + 0.14128 * Math.cos(2 * x) - 0.01168 * Math.cos(3 * x); },
  'Flat top': (n, N) => { const x = (2 * Math.PI * n) / (N - 1); return 0.21557895 - 0.41663158 * Math.cos(x) + 0.277263158 * Math.cos(2 * x) - 0.083578947 * Math.cos(3 * x) + 0.006947368 * Math.cos(4 * x); },
};
export function windowTable(name, N) {
  const f = WINDOWS[name] || WINDOWS.Hann;
  const w = new Float32Array(N);
  let s = 0, s2 = 0;
  for (let n = 0; n < N; n++) { w[n] = f(n, N); s += w[n]; s2 += w[n] * w[n]; }
  return { w, cg: s / N, enbw: (N * s2) / (s * s) };
}
// Frequency resolution figures for an FFT analyzer
export function fftParams(fsHz, N, windowName = 'Hann') {
  const { enbw, cg } = windowTable(windowName, N);
  return { binHz: fsHz / N, rbwHz: (enbw * fsHz) / N, enbw, cg, frameS: N / fsHz, processingGain: 10 * LOG10(N / 2) };
}
// Ideal ADC signal-to-quantization-noise ratio, full-scale sine
export const adcSnr = (bits) => 6.02 * bits + 1.76;

// In-place radix-2 FFT on separate real/imag arrays (length must be a power of two)
export function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}
// Single-sided power spectrum in dBFS (a full-scale sine reads 0 dBFS at its peak bin).
export function powerSpectrum(samples, win) {
  const N = samples.length, re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < N; i++) re[i] = samples[i] * win.w[i];
  fft(re, im);
  const out = new Float32Array(N / 2), norm = 2 / (N * win.cg);
  for (let k = 0; k < N / 2; k++) { const m = Math.hypot(re[k], im[k]) * norm; out[k] = 20 * LOG10(Math.max(m, 1e-12)); }
  return out;
}

// ---------------------------------------------------------------- modulation and bandwidth
export const carsonBw = (devHz, fmHz) => 2 * (devHz + fmHz);
// Bessel function of the first kind (integer order) by series; adequate for β ≤ 20
export function besselJ(n, x) {
  let sum = 0, term = Math.pow(x / 2, n) / factorial(n);
  for (let k = 0; k < 60; k++) {
    sum += term;
    term *= -(x * x / 4) / ((k + 1) * (k + 1 + n));
    if (Math.abs(term) < 1e-16) break;
  }
  return sum;
}
function factorial(n) { let f = 1; for (let i = 2; i <= n; i++) f *= i; return f; }

// ---------------------------------------------------------------- measurement uncertainty
// Mismatch uncertainty between a source and a meter (both |Γ|): limits in dB
export const mismatchUncertainty = (gS, gM) => ({ plus: 20 * LOG10(1 + gS * gM), minus: 20 * LOG10(1 - gS * gM) });
// Directional-coupler directivity error: the measured |Γ| can lie anywhere in |Γ| ± 10^(−D/20)
export function directivityError(trueSwr, dirDb) {
  const g = gammaFromSwr(trueSwr), e = Math.pow(10, -dirDb / 20);
  const lo = Math.max(0, g - e), hi = Math.min(0.9999, g + e);
  return { swrLo: (1 + lo) / (1 - lo), swrHi: (1 + hi) / (1 - hi) };
}
// Analog meter accuracy is usually quoted as ± % of full scale; the error grows at low readings
export const meterErrorPct = (fsPct, fullScale, reading) => (fsPct * fullScale) / Math.max(reading, 1e-9);
