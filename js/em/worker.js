// Web Worker running the MoM solver off the UI thread.
import { mesh, solve, gain, segmentCurrents } from './mom.js';
import { postZ } from './models.js';

self.onmessage = (e) => {
  const { id, model, freqs, patternF, fMesh } = e.data;
  try {
    const m = mesh(model, fMesh || Math.max(...freqs));
    const sweep = [];
    freqs.forEach((f, i) => {
      const s = solve(m, f);
      sweep.push({ f, Zraw: s.Z, Z: postZ(model, s.Z) });
      if (i % 5 === 0) self.postMessage({ id, progress: (i + 1) / freqs.length });
    });
    let pattern = null, currents = null, segs = null;
    if (patternF) {
      const s = solve(m, patternF);
      const free = (model.ground || {}).type === 'free';
      // elevation of max gain (or horizon plane in free space)
      let bestEl = 0, bestG = -999, bestAz = 0;
      for (let el = free ? 0 : 3; el <= 87; el += 3) for (let az = 0; az < 360; az += 15) {
        const g = gain(s, 90 - el, 90 - az);
        if (g > bestG) { bestG = g; bestEl = el; bestAz = az; }
      }
      if (free) bestEl = 0;
      const azCut = [], elCut = [];
      for (let az = 0; az <= 360; az += 3) azCut.push(gain(s, 90 - bestEl, 90 - az));
      for (let el = 0; el <= 180; el += 2) {
        // elevation cut through the best azimuth (el > 90 = looking out the back)
        const a = el <= 90 ? bestAz : bestAz + 180, ee = el <= 90 ? el : 180 - el;
        elCut.push(gain(s, 90 - ee, 90 - a));
      }
      pattern = { bestEl, bestAz, maxG: bestG, azCut, elCut, free, Z: postZ(model, s.Z), f: patternF };
      currents = segmentCurrents(s);
      segs = m.segs.map((g) => ({ p0: g.p0, p1: g.p1 }));
    }
    self.postMessage({ id, done: true, sweep, pattern, currents, segs });
  } catch (err) {
    self.postMessage({ id, error: String(err && err.message || err) });
  }
};
