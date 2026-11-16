// RF tools: measurement calculators (levels, SWR, feedline, power-meter accuracy, link budget,
// exposure, lengths, resonance, modulation) and a working FFT spectrum analyzer.
// All maths lives in rfmath.js; cable data is shared with the antenna workbench.
import { h, bus } from './util.js';
import { icon } from './icons.js';
import * as R from './rfmath.js';
import { CABLES, lossDbPerM } from './em/tline.js';
import { initSpectrum } from './spectrum.js';

const fx = (v, d = 2) => (Number.isFinite(v) ? (Math.abs(v) >= 1e5 || (Math.abs(v) < 1e-3 && v !== 0) ? v.toExponential(d) : v.toFixed(d)) : '—');
const fw = (w) => (w >= 1000 ? `${fx(w / 1000, 2)} kW` : w >= 1 ? `${fx(w, 2)} W` : w >= 1e-3 ? `${fx(w * 1e3, 2)} mW` : w >= 1e-6 ? `${fx(w * 1e6, 2)} µW` : w >= 1e-9 ? `${fx(w * 1e9, 2)} nW` : `${(w * 1e12).toPrecision(3)} pW`);
const fv = (v) => (v >= 1 ? `${fx(v, 3)} V` : v >= 1e-3 ? `${fx(v * 1e3, 3)} mV` : `${fx(v * 1e6, 3)} µV`);
const flen = (m) => `${fx(m, 2)} m (${fx(m / R.M_PER_FT, 2)} ft)`;
const fhz = (hz) => (hz >= 1e9 ? `${fx(hz / 1e9, 4)} GHz` : hz >= 1e6 ? `${fx(hz / 1e6, 4)} MHz` : hz >= 1e3 ? `${fx(hz / 1e3, 3)} kHz` : `${fx(hz, 2)} Hz`);
const fH = (L) => (L >= 1e-3 ? `${fx(L * 1e3, 3)} mH` : L >= 1e-6 ? `${fx(L * 1e6, 3)} µH` : `${fx(L * 1e9, 2)} nH`);
const fF = (c) => (c >= 1e-6 ? `${fx(c * 1e6, 3)} µF` : c >= 1e-9 ? `${fx(c * 1e9, 3)} nF` : `${fx(c * 1e12, 2)} pF`);

// ------------------------------------------------------------------ tiny calculator framework
// fields: {k, label, v, unit, type: 'num'|'select'|'check', opts, show(st), step}
// out(st) → rows: [label, value, note?] | {head} | {note, kind}
function calc(id, title, blurb, fields, out, { ref, wide } = {}) {
  const st = Object.fromEntries(fields.map((f) => [f.k, f.v]));
  const res = h('div', { class: 'rt-out', 'aria-live': 'polite' });
  const wraps = [];
  const fieldEls = fields.map((f) => {
    let inp;
    if (f.type === 'select') {
      inp = h('select', {}, ...f.opts.map((o) => { const [val, lab] = Array.isArray(o) ? o : [o, o]; return h('option', { value: val, selected: String(val) === String(f.v) }, lab); }));
      inp.onchange = () => { st[f.k] = inp.value; run(); };
    } else if (f.type === 'check') {
      inp = h('input', { type: 'checkbox', checked: !!f.v });
      inp.onchange = () => { st[f.k] = inp.checked; run(); };
    } else {
      inp = h('input', { type: 'number', value: f.v, step: f.step || 'any', inputmode: 'decimal' });
      inp.oninput = () => { st[f.k] = parseFloat(inp.value); run(); };
    }
    const w = f.type === 'check'
      ? h('label', { class: 'rt-field rt-check' }, inp, h('span', {}, f.label))
      : h('label', { class: 'rt-field' }, h('span', { class: 'rt-lab' }, f.label), h('span', { class: 'rt-in' }, inp, f.unit ? h('span', { class: 'rt-unit' }, f.unit) : null));
    wraps.push([f, w]);
    return w;
  });
  function run() {
    for (const [f, w] of wraps) w.hidden = f.show ? !f.show(st) : false;
    res.innerHTML = '';
    let rows;
    try { rows = out(st); } catch (e) { rows = [{ note: 'Check the inputs: every value must be a positive number.', kind: 'warn' }]; }
    const dl = h('dl', { class: 'rt-dl' });
    for (const r of rows || []) {
      if (!r) continue;
      if (r.head) { dl.append(h('dt', { class: 'rt-head' }, r.head), h('dd', { class: 'rt-head' })); continue; }
      if (r.note) { dl.append(h('div', { class: `rt-note ${r.kind || ''}` }, r.note)); continue; }
      const [k, v, note] = r;
      dl.append(h('dt', {}, k), h('dd', {}, h('b', {}, v), note ? h('span', { class: 'muted' }, ` ${note}`) : null));
    }
    res.append(dl);
  }
  run();
  return h('div', { class: `card rt-card${wide ? ' wide' : ''}`, id: `rt-${id}` },
    h('h3', {}, title), blurb ? h('p', { class: 'small muted' }, blurb) : null,
    h('div', { class: 'rt-fields' }, ...fieldEls), res,
    ref ? h('button', { class: 'link small rt-ref', onclick: () => bus.emit('library', ref) }, h('span', { html: icon('book') }), ' How this works') : null);
}
const ok = (x) => Number.isFinite(x) && x > 0;
const need = (...xs) => { if (!xs.every(ok)) throw new Error('bad'); };

// ------------------------------------------------------------------ the calculators
const LEVEL_UNITS = [['W', 'W'], ['mW', 'mW'], ['dBm', 'dBm'], ['dBW', 'dBW'], ['dBuV', 'dBµV (50 Ω)'], ['uV', 'µV rms (50 Ω)'], ['Vrms', 'V rms (50 Ω)'], ['Vpp', 'V peak-to-peak (50 Ω)']];
function toDbm(v, u) {
  switch (u) {
    case 'W': need(v); return R.wToDbm(v);
    case 'mW': need(v); return R.wToDbm(v / 1000);
    case 'dBm': return v;
    case 'dBW': return v + 30;
    case 'dBuV': return R.dbuvToDbm(v);
    case 'uV': need(v); return R.vrmsToDbm(v * 1e-6);
    case 'Vrms': need(v); return R.vrmsToDbm(v);
    case 'Vpp': need(v); return R.wToDbm(R.vppToW(v));
  }
  return NaN;
}

const SECTIONS = [
  {
    id: 'levels', title: 'Power and signal levels', icon: 'zap',
    cards: () => [
      calc('level', 'Level converter', 'Convert between watts, dBm, dBW, microvolts and S-units. Voltages assume a 50 Ω system.', [
        { k: 'v', label: 'Value', v: -73 },
        { k: 'u', label: 'Unit', v: 'dBm', type: 'select', opts: LEVEL_UNITS },
        { k: 'band', label: 'S-meter scale', v: 'hf', type: 'select', opts: [['hf', 'HF (below 30 MHz)'], ['vhf', 'VHF/UHF (30 MHz and up)']] },
      ], (s) => {
        const dbm = toDbm(s.v, s.u);
        if (!Number.isFinite(dbm)) throw new Error();
        const w = R.dbmToW(dbm), vr = R.dbmToVrms(dbm);
        return [['Power', fw(w)], ['dBm', fx(dbm, 2)], ['dBW', fx(dbm - 30, 2)], ['Voltage', `${fv(vr)} rms`, `· ${fv(vr * 2 * Math.SQRT2)} p-p`], ['dBµV', fx(R.dbmToDbuv(dbm), 2)],
          ['S-meter', R.sMeter(dbm, s.band === 'hf' ? 14 : 146).text, s.band === 'hf' ? '(S9 = −73 dBm = 50 µV)' : '(S9 = −93 dBm = 5 µV)'],
          { note: 'S-units follow IARU Region 1 Technical Recommendation R.1: 6 dB per S-unit. Real receivers are rarely calibrated this precisely below S9.' }];
      }, { ref: 'rf-decibels' }),
      calc('db', 'Decibels and gain', 'Turn a gain or loss in dB into a ratio and see its effect on your power.', [
        { k: 'db', label: 'Gain (+) or loss (−)', v: 3, unit: 'dB' },
        { k: 'p', label: 'Starting power', v: 100, unit: 'W' },
      ], (s) => {
        need(s.p);
        const pr = Math.pow(10, s.db / 10), vr = Math.pow(10, s.db / 20);
        return [['Power ratio', `× ${fx(pr, 4)}`], ['Voltage ratio', `× ${fx(vr, 4)}`], ['Resulting power', fw(s.p * pr)], ['S-units equivalent', fx(s.db / 6, 2)],
          { note: '3 dB doubles power; 10 dB is ten times; 6 dB doubles voltage and is one S-unit. Going from 100 W to 1500 W is only 11.8 dB, about two S-units.' }];
      }, { ref: 'rf-decibels' }),
      calc('scope', 'Power from an oscilloscope', 'Measure the voltage across a dummy load with a scope (through a suitable attenuator or ×10 probe) and convert it to power.', [
        { k: 'vpp', label: 'Peak-to-peak voltage', v: 200, unit: 'V' },
        { k: 'r', label: 'Load resistance', v: 50, unit: 'Ω' },
      ], (s) => {
        need(s.vpp, s.r);
        const p = R.vppToW(s.vpp, s.r);
        return [['V peak', `${fx(s.vpp / 2, 2)} V`], ['V rms', `${fx(s.vpp / (2 * Math.SQRT2), 2)} V`], ['Power (steady carrier)', fw(p), `(${fx(R.wToDbm(p), 1)} dBm)`],
          { note: 'For SSB, read the peak-to-peak voltage of the envelope peaks: the same formula then gives PEP. P = Vpp² ÷ 8R holds only for a sine wave into a resistive load.' }];
      }, { ref: 'rf-power-measurement' }),
    ],
  },
  {
    id: 'swr', title: 'SWR and feedlines', icon: 'activity',
    cards: () => [
      calc('swr', 'SWR, return loss and mismatch', 'Enter whichever figure you measured; the others follow from the reflection coefficient |Γ|.', [
        { k: 'by', label: 'I measured', v: 'swr', type: 'select', opts: [['swr', 'SWR'], ['rl', 'Return loss'], ['g', 'Reflection coefficient |Γ|'], ['pw', 'Forward and reflected power'], ['z', 'Load impedance R + jX']] },
        { k: 'swr', label: 'SWR', v: 1.5, unit: ': 1', show: (s) => s.by === 'swr' },
        { k: 'rl', label: 'Return loss', v: 14, unit: 'dB', show: (s) => s.by === 'rl' },
        { k: 'g', label: '|Γ|', v: 0.2, show: (s) => s.by === 'g' },
        { k: 'pf', label: 'Forward power', v: 100, unit: 'W', show: (s) => s.by === 'pw' },
        { k: 'pr', label: 'Reflected power', v: 4, unit: 'W', show: (s) => s.by === 'pw' },
        { k: 'zr', label: 'Resistance R', v: 35, unit: 'Ω', show: (s) => s.by === 'z' },
        { k: 'zx', label: 'Reactance X', v: 10, unit: 'Ω', show: (s) => s.by === 'z' },
        { k: 'z0', label: 'System impedance Z0', v: 50, unit: 'Ω', show: (s) => s.by === 'z' },
        { k: 'p', label: 'Transmitter power', v: 100, unit: 'W', show: (s) => s.by !== 'pw' },
      ], (s) => {
        let g;
        if (s.by === 'swr') { if (!(s.swr >= 1)) throw new Error(); g = R.gammaFromSwr(s.swr); }
        if (s.by === 'rl') { if (!(s.rl >= 0)) throw new Error(); g = R.gammaFromRl(s.rl); }
        if (s.by === 'g') { if (!(s.g >= 0 && s.g < 1)) throw new Error(); g = s.g; }
        if (s.by === 'pw') { need(s.pf); if (!(s.pr >= 0 && s.pr < s.pf)) throw new Error(); g = R.gammaFromPowers(s.pf, s.pr); }
        if (s.by === 'z') { need(s.zr, s.z0); g = R.gammaFromZ(s.zr, s.zx || 0, s.z0); }
        const m = R.mismatch(g), P = s.by === 'pw' ? s.pf : s.p;
        need(P);
        const st = R.lineStress(P, m.swr);
        return [['SWR', `${fx(m.swr, 2)} : 1`], ['|Γ|', fx(m.gamma, 4)], ['Return loss', `${fx(m.returnLoss, 2)} dB`], ['Mismatch loss', `${fx(m.mismatchLoss, 3)} dB`],
          ['Reflected', `${fx(m.reflectedPct, 2)} %`, `(${fw(P * m.reflectedPct / 100)} of ${fw(P)})`],
          ['Peak line voltage', `${fx(st.vpk, 0)} V`, `(${fx(st.vrms, 0)} V rms at the voltage maximum)`],
          { note: s.by === 'pw' ? 'Net power into the line is forward minus reflected. With a lossless line and a tuner, the reflected power is not "lost": it is re-reflected and delivered to the antenna.' : 'Mismatch loss assumes a lossless line and a source matched to 50 Ω. A tuner at the transmitter removes it from the transmitter\'s point of view, but not the extra feedline loss (next calculator).' }];
      }, { ref: 'swr' }),
      calc('coax', 'Feedline loss with SWR', 'Matched loss for common lines (typical datasheet values) plus the additional loss caused by SWR at the antenna.', [
        { k: 'cable', label: 'Feedline', v: 'RG-8X', type: 'select', opts: Object.keys(CABLES) },
        { k: 'f', label: 'Frequency', v: 14.2, unit: 'MHz' },
        { k: 'len', label: 'Length', v: 100, unit: 'ft' },
        { k: 'swr', label: 'SWR at the antenna', v: 3, unit: ': 1' },
        { k: 'p', label: 'Transmitter power', v: 100, unit: 'W' },
      ], (s) => {
        need(s.f, s.len, s.p); if (!(s.swr >= 1)) throw new Error();
        const per100 = lossDbPerM(s.cable, s.f * 1e6) * 30.48;
        const L = R.lineLoss(per100 * s.len / 100, R.gammaFromSwr(s.swr));
        const pa = s.p * L.efficiency;
        return [['Matched loss', `${fx(per100, 2)} dB/100 ft`, `→ ${fx(L.matched, 2)} dB on this run`], ['Extra loss from SWR', `${fx(L.extra, 2)} dB`], ['Total loss', `${fx(L.total, 2)} dB`],
          ['SWR at the transmitter', `${fx(L.swrIn, 2)} : 1`, '(line loss makes SWR look better than it is)'], ['Power reaching the antenna', fw(pa), `(${fx(L.efficiency * 100, 1)} %)`], ['Heat in the cable', fw(s.p - pa)],
          { note: 'Cable figures are interpolated from typical 10 MHz and 100 MHz datasheet values. Old, wet or kinked coax can lose far more; measure it with an analyzer if in doubt.' }];
      }, { ref: 'feedlines' }),
      calc('elen', 'Electrical length in a cable', 'Cut a quarter-wave or half-wave section of coax (stubs, phasing lines, impedance transformers).', [
        { k: 'f', label: 'Frequency', v: 146.52, unit: 'MHz' },
        { k: 'frac', label: 'Wavelength fraction', v: 0.25, unit: 'λ' },
        { k: 'cable', label: 'Cable (sets velocity factor)', v: 'RG-213', type: 'select', opts: Object.keys(CABLES) },
      ], (s) => {
        need(s.f, s.frac);
        const vf = CABLES[s.cable].vf;
        return [['Free-space wavelength', flen(R.wavelength(s.f))], ['Velocity factor', fx(vf, 2)], ['Physical length', flen(R.electricalLength(s.f, s.frac, vf))],
          { note: 'Velocity factor varies between batches. Cut slightly long and trim while checking the stub with an analyzer (a ¼-wave open stub shows a short circuit at its design frequency).' }];
      }, { ref: 'feedlines' }),
    ],
  },
  {
    id: 'meter', title: 'Measurement accuracy', icon: 'target',
    cards: () => [
      calc('meteracc', 'Wattmeter accuracy', 'Analog meters quote accuracy as a percentage of full scale, so a small reading on a large scale is unreliable.', [
        { k: 'fs', label: 'Meter full scale', v: 1000, unit: 'W' },
        { k: 'acc', label: 'Rated accuracy', v: 5, unit: '% of full scale' },
        { k: 'rd', label: 'Your reading', v: 100, unit: 'W' },
      ], (s) => {
        need(s.fs, s.acc, s.rd);
        const e = s.acc / 100 * s.fs, pct = R.meterErrorPct(s.acc, s.fs, s.rd);
        const best = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000].find((x) => x >= s.rd * 1.1) || s.fs;
        return [['Possible error', `± ${fw(e)}`, `(± ${fx(pct, 1)} % of the reading)`], ['True power lies between', `${fw(Math.max(0, s.rd - e))} and ${fw(s.rd + e)}`],
          ['Better range for this reading', `${best} W full scale`, `(± ${fx(s.acc / 100 * best / s.rd * 100, 1)} %)`],
          { note: 'Use a scale (or plug-in element) where the reading falls in the upper third. Reflected power is especially hard to read on a high-power scale: use a lower element for it.' }];
      }, { ref: 'rf-power-measurement' }),
      calc('direct', 'Directivity and mismatch uncertainty', 'A coupler with finite directivity leaks forward power into the reflected reading; a mismatched sensor gives an uncertain power reading.', [
        { k: 'swr', label: 'True load SWR', v: 1.2, unit: ': 1' },
        { k: 'd', label: 'Coupler directivity', v: 25, unit: 'dB' },
        { k: 'ss', label: 'Source SWR', v: 1.5, unit: ': 1' },
        { k: 'sm', label: 'Power-sensor SWR', v: 1.15, unit: ': 1' },
      ], (s) => {
        if (!(s.swr >= 1 && s.ss >= 1 && s.sm >= 1) || !ok(s.d)) throw new Error();
        const de = R.directivityError(s.swr, s.d), mu = R.mismatchUncertainty(R.gammaFromSwr(s.ss), R.gammaFromSwr(s.sm));
        return [{ head: 'SWR bridge' }, ['Displayed SWR could read', `${fx(de.swrLo, 2)} to ${fx(de.swrHi, 2)}`],
          { head: 'Power sensor' }, ['Mismatch uncertainty', `+${fx(mu.plus, 3)} / ${fx(mu.minus, 3)} dB`, `(+${fx((Math.pow(10, mu.plus / 10) - 1) * 100, 1)} / ${fx((Math.pow(10, mu.minus / 10) - 1) * 100, 1)} %)`],
          { note: 'Inexpensive SWR bridges have 15 to 25 dB of directivity, so readings below about 1.2 : 1 are not meaningful. Lab couplers exceed 35 dB.' }];
      }, { ref: 'rf-power-measurement' }),
      calc('atten', 'Attenuator for test equipment', 'Check that a transmitter will not damage an analyzer, SDR or scope input.', [
        { k: 'p', label: 'Transmitter power', v: 100, unit: 'W' },
        { k: 'att', label: 'Total attenuation', v: 40, unit: 'dB' },
        { k: 'max', label: 'Instrument maximum input', v: 20, unit: 'dBm' },
        { k: 'pad1', label: 'First pad rating', v: 100, unit: 'W' },
      ], (s) => {
        need(s.p); if (!(s.att >= 0)) throw new Error();
        const pin = R.wToDbm(s.p) - s.att, margin = s.max - pin;
        return [['Power at the instrument', `${fx(pin, 1)} dBm`, `(${fw(R.dbmToW(pin))})`], ['Margin to maximum', `${fx(margin, 1)} dB`],
          { note: margin < 10 ? 'Not enough margin: add attenuation. Aim for at least 10 dB below the instrument\'s maximum, and remember SSB and keying transients can exceed average power.' : 'Safe margin.', kind: margin < 10 ? 'warn' : 'ok' },
          s.pad1 < s.p ? { note: `The first pad sees the full ${fw(s.p)}: its ${s.pad1} W rating is too low. Use a power attenuator or a coupler/sampler first.`, kind: 'warn' } : null];
      }, { ref: 'rf-power-measurement' }),
    ],
  },
  {
    id: 'links', title: 'Radiated power, links and noise', icon: 'globe',
    cards: () => [
      calc('erp', 'EIRP and ERP', 'Effective radiated power in the antenna\'s best direction. ERP is referenced to a dipole, EIRP to an isotropic radiator.', [
        { k: 'p', label: 'Transmitter power', v: 50, unit: 'W' },
        { k: 'loss', label: 'Feedline and connector loss', v: 1.5, unit: 'dB' },
        { k: 'g', label: 'Antenna gain', v: 6 },
        { k: 'gu', label: 'Gain unit', v: 'dBi', type: 'select', opts: ['dBi', 'dBd'] },
      ], (s) => {
        need(s.p);
        const gi = s.gu === 'dBd' ? R.dbdToDbi(s.g) : s.g;
        const pa = R.wToDbm(s.p) - s.loss;
        return [['Power at the antenna', fw(R.dbmToW(pa))], ['Gain', `${fx(gi, 2)} dBi = ${fx(R.dbiToDbd(gi), 2)} dBd`], ['EIRP', fw(R.dbmToW(pa + gi)), `(${fx(pa + gi, 1)} dBm)`], ['ERP', fw(R.dbmToW(pa + gi - 2.15)), `(${fx(pa + gi - 2.15, 1)} dBm)`]];
      }, { ref: 'rf-link-budget' }),
      calc('link', 'Line-of-sight link budget', 'Received signal and margin for a VHF/UHF/microwave path in free space. Add extra loss for obstructions and foliage.', [
        { k: 'f', label: 'Frequency', v: 146.52, unit: 'MHz' },
        { k: 'd', label: 'Distance', v: 30, unit: 'km' },
        { k: 'p', label: 'Transmitter power', v: 5, unit: 'W' },
        { k: 'gt', label: 'TX antenna gain', v: 2.15, unit: 'dBi' },
        { k: 'gr', label: 'RX antenna gain', v: 2.15, unit: 'dBi' },
        { k: 'loss', label: 'Total cable and other losses', v: 3, unit: 'dB' },
        { k: 'bw', label: 'Receiver bandwidth', v: 12000, unit: 'Hz' },
        { k: 'nf', label: 'Receiver noise figure', v: 6, unit: 'dB' },
        { k: 'req', label: 'SNR needed', v: 12, unit: 'dB' },
      ], (s) => {
        need(s.f, s.d, s.p, s.bw);
        const pl = R.fspl(s.d, s.f), prx = R.wToDbm(s.p) + s.gt + s.gr - s.loss - pl, nf = R.noiseFloor(s.bw, s.nf), snr = prx - nf;
        return [['Free-space path loss', `${fx(pl, 1)} dB`], ['Received power', `${fx(prx, 1)} dBm`, `(${fv(R.dbmToVrms(prx))}, ${R.sMeter(prx, s.f).text})`], ['Noise floor', `${fx(nf, 1)} dBm`], ['SNR', `${fx(snr, 1)} dB`],
          ['Fade margin', `${fx(snr - s.req, 1)} dB`], { note: snr - s.req >= 10 ? 'Comfortable margin for a fixed path.' : snr - s.req >= 0 ? 'Works in free space but little margin for terrain, buildings or fading.' : 'Below the required SNR: more power, gain, height or a shorter path is needed.', kind: snr - s.req >= 10 ? 'ok' : 'warn' },
          s.f < 30 ? { note: 'At HF, atmospheric and man-made noise is usually far above thermal noise (ITU-R P.372), and paths use the ionosphere, so this free-space figure does not apply. Use the propagation map instead.', kind: 'warn' } : null];
      }, { ref: 'rf-link-budget' }),
      calc('horizon', 'Radio horizon and Fresnel zone', 'How far line-of-sight reaches over a smooth earth and how much clearance the path needs.', [
        { k: 'h1', label: 'Antenna height A', v: 10, unit: 'm' },
        { k: 'h2', label: 'Antenna height B', v: 2, unit: 'm' },
        { k: 'd', label: 'Path length', v: 15, unit: 'km' },
        { k: 'f', label: 'Frequency', v: 446, unit: 'MHz' },
      ], (s) => {
        if (!(s.h1 >= 0 && s.h2 >= 0)) throw new Error(); need(s.d, s.f);
        const hz = R.radioHorizon(s.h1, s.h2), fz = R.fresnel(s.d / 2, s.d / 2, s.f);
        return [['Radio horizon', `${fx(hz, 1)} km`, `(${fx(hz / 1.609344, 1)} mi)`], ['First Fresnel radius at mid-path', `${fx(fz, 1)} m`], ['Clearance for 60 % of it', `${fx(fz * 0.6, 1)} m`],
          { note: s.d > hz ? 'The path is longer than the radio horizon: expect diffraction loss or no signal without height or a repeater.' : 'Within the radio horizon if the terrain between is clear.', kind: s.d > hz ? 'warn' : 'ok' }];
      }, { ref: 'rf-link-budget' }),
      calc('noise', 'Receiver sensitivity', 'Thermal noise floor, noise temperature and minimum discernible signal (MDS).', [
        { k: 'nf', label: 'Noise figure', v: 5, unit: 'dB' },
        { k: 'bw', label: 'Bandwidth', v: 500, unit: 'Hz' },
      ], (s) => {
        need(s.bw); if (!(s.nf >= 0)) throw new Error();
        const mds = R.noiseFloor(s.bw, s.nf);
        return [['kTB at 290 K', `${fx(R.noiseFloor(s.bw), 1)} dBm`], ['Noise temperature', `${fx(R.nfToTemp(s.nf), 0)} K`], ['MDS (noise floor)', `${fx(mds, 1)} dBm`, `(${fv(R.dbmToVrms(mds))})`],
          ['Narrowing 2400 → 500 Hz improves SNR by', `${fx(10 * Math.log10(2400 / 500), 1)} dB`], { note: 'Noise power scales with bandwidth: 10·log10(BW). This is why CW and FT8 work at signal levels where SSB is unreadable.' }];
      }, { ref: 'rf-noise' }),
    ],
  },
  {
    id: 'exposure', title: 'RF exposure', icon: 'alert',
    cards: () => [
      calc('mpe', 'RF exposure estimate (FCC)', 'Far-field estimate after FCC OET Bulletin 65. It is a guide for a routine station evaluation, not a substitute for one.', [
        { k: 'f', label: 'Frequency', v: 14.2, unit: 'MHz' },
        { k: 'p', label: 'Transmitter PEP', v: 100, unit: 'W' },
        { k: 'loss', label: 'Feedline loss', v: 1, unit: 'dB' },
        { k: 'g', label: 'Antenna gain', v: 2.15, unit: 'dBi' },
        { k: 'mode', label: 'Mode', v: 'SSB voice', type: 'select', opts: Object.keys(R.DUTY) },
        { k: 't6', label: 'Minutes transmitting in any 6 min', v: 3, unit: 'min' },
        { k: 't30', label: 'Minutes transmitting in any 30 min', v: 15, unit: 'min' },
        { k: 'd', label: 'Distance to people', v: 5, unit: 'm' },
        { k: 'gnd', label: 'Include ground reflection (recommended)', v: true, type: 'check' },
      ], (s) => {
        need(s.f, s.p, s.d);
        const duty = R.DUTY[s.mode];
        const pant = s.p * Math.pow(10, -s.loss / 10);
        const pc = pant * duty * Math.min(1, s.t6 / 6), pu = pant * duty * Math.min(1, s.t30 / 30);
        const lc = R.mpeLimit(s.f, true), lu = R.mpeLimit(s.f, false);
        const sc = R.powerDensity(pc, s.g, s.d, s.gnd), su = R.powerDensity(pu, s.g, s.d, s.gnd);
        const dc = R.safeDistance(pc, s.g, lc, s.gnd), du = R.safeDistance(pu, s.g, lu, s.gnd);
        return [['Average power (controlled / general)', `${fw(pc)} / ${fw(pu)}`],
          { head: 'Controlled (you and your household, aware of exposure)' }, ['Limit', `${fx(lc, 3)} mW/cm²`], ['At this distance', `${fx(sc, 4)} mW/cm²`, `(${fx(sc / lc * 100, 0)} % of limit)`], ['Minimum distance', flen(dc)],
          { head: 'General population (neighbours, public)' }, ['Limit', `${fx(lu, 3)} mW/cm²`], ['At this distance', `${fx(su, 4)} mW/cm²`, `(${fx(su / lu * 100, 0)} % of limit)`], ['Minimum distance', flen(du)],
          { note: su <= lu ? 'Within the general-population limit at this distance.' : 'Exceeds the general-population limit at this distance: increase separation, reduce power or duty, or move the antenna.', kind: su <= lu ? 'ok' : 'warn' },
          { note: 'Limits: 47 CFR §1.1310. Duty factors: OET-65 Supplement B. Close to HF antennas (within about a wavelength) the far-field formula is only approximate; use the FCC/ARRL calculators or a near-field model for those cases.' }];
      }, { ref: 'rf-safety', wide: true }),
    ],
  },
  {
    id: 'antenna', title: 'Antennas, resonance and bandwidth', icon: 'antenna',
    cards: () => [
      calc('lengths', 'Wavelength and antenna lengths', 'Starting cut lengths for wire antennas. Always cut a little long and trim while measuring.', [
        { k: 'f', label: 'Frequency', v: 14.2, unit: 'MHz' },
      ], (s) => {
        need(s.f);
        const L = R.antennaLengths(s.f);
        return [['Wavelength (free space)', flen(R.wavelength(s.f))], ['Half-wave dipole, total', flen(L.dipole.m), '(468 ÷ MHz ft)'], ['Each dipole leg', flen(L.dipole.m / 2)],
          ['Quarter-wave vertical / radial', flen(L.quarter.m), '(234 ÷ MHz ft)'], ['5/8-wave vertical', flen(L.fiveEighths.m)], ['Full-wave loop, perimeter', flen(L.loop.m), '(1005 ÷ MHz ft)'],
          { note: 'The 468 and 234 constants already include about 5 % end effect for thin wire. Insulation, nearby objects and height shift resonance by a few percent.' }];
      }, { ref: 'dipole-build' }),
      calc('lc', 'LC resonance and reactance', 'Resonant frequency of a coil and capacitor, or the part needed to resonate at a frequency.', [
        { k: 'solve', label: 'Solve for', v: 'f', type: 'select', opts: [['f', 'Frequency'], ['L', 'Inductance'], ['C', 'Capacitance']] },
        { k: 'f', label: 'Frequency', v: 7.1, unit: 'MHz', show: (s) => s.solve !== 'f' },
        { k: 'L', label: 'Inductance', v: 5, unit: 'µH', show: (s) => s.solve !== 'L' },
        { k: 'C', label: 'Capacitance', v: 100, unit: 'pF', show: (s) => s.solve !== 'C' },
      ], (s) => {
        let f = s.f * 1e6, L = s.L * 1e-6, Cc = s.C * 1e-12;
        if (s.solve === 'f') { need(L, Cc); f = R.resonantFreq(L, Cc); }
        if (s.solve === 'L') { need(f, Cc); L = R.lForResonance(f, Cc); }
        if (s.solve === 'C') { need(f, L); Cc = R.cForResonance(f, L); }
        return [['Frequency', fhz(f)], ['Inductance', fH(L)], ['Capacitance', fF(Cc)], ['Reactance at resonance', `${fx(R.xl(f, L), 1)} Ω`, '(XL = XC)']];
      }, { ref: 'rf-fundamentals' }),
      calc('q', 'Bandwidth and Q', 'Relation between centre frequency, bandwidth and quality factor of a resonant circuit or antenna.', [
        { k: 'f', label: 'Centre frequency', v: 7.15, unit: 'MHz' },
        { k: 'bw', label: 'Bandwidth (−3 dB)', v: 300, unit: 'kHz' },
      ], (s) => {
        need(s.f, s.bw);
        const Q = s.f * 1000 / s.bw;
        return [['Q', fx(Q, 1)], ['Fractional bandwidth', `${fx(s.bw / (s.f * 1000) * 100, 2)} %`],
          ['Approx. 2 : 1 SWR bandwidth', `${fx(s.bw / Math.SQRT2, 0)} kHz`, '(for a simple resonant antenna whose Q is given, BW at 2 : 1 ≈ BW₃dB ÷ √2)']];
      }, { ref: 'antenna-analyzer' }),
      calc('mod', 'Occupied bandwidth by mode', 'Estimate the bandwidth a signal takes up, and the FM sideband structure.', [
        { k: 'm', label: 'Mode', v: 'FM', type: 'select', opts: ['FM', 'AM', 'SSB', 'CW'] },
        { k: 'dev', label: 'Peak deviation', v: 5, unit: 'kHz', show: (s) => s.m === 'FM' },
        { k: 'af', label: 'Highest audio frequency', v: 3, unit: 'kHz', show: (s) => s.m !== 'CW' },
        { k: 'wpm', label: 'Speed', v: 25, unit: 'WPM', show: (s) => s.m === 'CW' },
      ], (s) => {
        if (s.m === 'FM') {
          need(s.dev, s.af);
          const beta = s.dev / s.af;
          const lines = [0, 1, 2, 3, 4].map((n) => `J${n} ${fx(20 * Math.log10(Math.max(Math.abs(R.besselJ(n, beta)), 1e-6)), 1)} dB`).join(' · ');
          return [['Modulation index β', fx(beta, 2)], ['Carson bandwidth', `${fx(R.carsonBw(s.dev, s.af), 1)} kHz`, '2 × (deviation + audio)'], ['Carrier and sidebands', lines],
            { note: 'The carrier disappears when β = 2.405: the classic method for calibrating deviation with a spectrum analyzer.' }];
        }
        if (s.m === 'AM') { need(s.af); return [['Bandwidth', `${fx(2 * s.af, 1)} kHz`, '2 × highest audio frequency']]; }
        if (s.m === 'SSB') { need(s.af); return [['Bandwidth', `about ${fx(s.af - 0.3, 1)} kHz`, '(audio from about 300 Hz to the highest frequency)']]; }
        need(s.wpm);
        return [['Bandwidth', `about ${fx(s.wpm * 4, 0)} Hz`, '(≈ 4 × WPM with properly shaped keying)'], { note: 'Hard keying with fast rise times produces key clicks far wider than this. Try the keying scenario in the spectrum analyzer.' }];
      }, { ref: 'rf-modulation' }),
      calc('fftcalc', 'FFT analyzer resolution', 'How sample rate, FFT size and window set the resolution bandwidth of an SDR or audio spectrum display.', [
        { k: 'fs', label: 'Sample rate', v: 48000, unit: 'samples/s' },
        { k: 'n', label: 'FFT size', v: '4096', type: 'select', opts: ['256', '512', '1024', '2048', '4096', '8192', '16384', '65536'] },
        { k: 'w', label: 'Window', v: 'Hann', type: 'select', opts: Object.keys(R.WINDOWS) },
        { k: 'bits', label: 'ADC resolution', v: 16, unit: 'bits' },
      ], (s) => {
        need(s.fs, s.bits);
        const p = R.fftParams(s.fs, +s.n, s.w);
        return [['Bin spacing', fhz(p.binHz)], ['Resolution bandwidth (ENBW)', fhz(p.rbwHz), `(window ENBW ${fx(p.enbw, 3)} bins)`], ['Time per FFT frame', `${fx(p.frameS * 1000, 1)} ms`], ['FFT processing gain', `${fx(p.processingGain, 1)} dB`],
          ['Ideal ADC dynamic range', `${fx(R.adcSnr(s.bits), 1)} dB`], { note: 'Finer resolution means longer frames: you trade time response for frequency detail. The noise floor you see drops by 3 dB each time the FFT size doubles.' }];
      }, { ref: 'rf-spectrum-analysis' }),
    ],
  },
];

export function initRfTools(el) {
  const nav = h('div', { class: 'rt-nav' },
    h('button', { class: 'chip', onclick: () => document.getElementById('rt-sec-spectrum')?.scrollIntoView({ behavior: 'smooth' }) }, 'Spectrum analyzer'),
    ...SECTIONS.map((s) => h('button', { class: 'chip', onclick: () => document.getElementById(`rt-sec-${s.id}`)?.scrollIntoView({ behavior: 'smooth' }) }, s.title)));
  const specCard = h('div', { class: 'card spec-card' });
  el.append(
    h('div', { class: 'page-head' }, h('div', {}, h('div', { class: 'eyebrow' }, 'Measure'), h('h1', {}, 'RF tools'),
      h('p', { class: 'lead' }, 'A spectrum analyzer and measurement calculators for power, SWR, feedline loss, meter accuracy, link budgets, RF exposure and antenna design. Every result explains its assumptions, and each tool links to the library article that teaches the method.'))),
    nav,
    h('section', { class: 'rt-sec', id: 'rt-sec-spectrum' }, h('h2', {}, h('span', { html: icon('waveform') }), ' Spectrum analyzer'), specCard),
    ...SECTIONS.map((s) => h('section', { class: 'rt-sec', id: `rt-sec-${s.id}` }, h('h2', {}, h('span', { html: icon(s.icon) }), ` ${s.title}`), h('div', { class: 'rt-grid' }, ...s.cards()))),
    h('div', { class: 'callout' }, h('span', { html: icon('flask') }), 'Impedance matching networks, stub matching, cable de-embedding and NanoVNA sweeps are in the ', h('button', { class: 'link', onclick: () => bus.emit('goto', 'workbench') }, 'Antenna workbench'), '.'));
  initSpectrum(specCard);
}
