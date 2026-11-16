// Radio models. Each has real-world-style limits that change how the sim behaves.
// Generic classes of radio, plus the real-world catalog in data/gear.js.
import { S } from './state.js';
import { REAL_RIGS, GEAR } from './data/gear.js';

const HF6 = ['160m', '80m', '40m', '30m', '20m', '17m', '15m', '12m', '10m', '6m'];
export const RIGS = {
  allmode: {
    name: 'All-Band Base Transceiver', code: 'AB-100', cls: 'All-mode HF + 6 m + 2 m base/mobile', price: 0, maxW: 100, maxWvhf: 50,
    tx: [...HF6, '2m'], rx: [0.5e6, 470e6], modes: ['LSB', 'USB', 'CW', 'AM', 'FM', 'WFM'], atu: true, scope: true, dsp: true, narrowCw: false, face: 'graphite',
    blurb: 'The do-everything starter: HF, 6 m and 2 m, internal tuner, spectrum scope, general-coverage receive.',
  },
  sdr100: {
    name: 'Compact SDR Transceiver', code: 'CS-100', cls: 'Direct-sampling SDR, HF + 6 m', price: 400, maxW: 100,
    tx: HF6, rx: [0.5e6, 74.8e6], modes: ['LSB', 'USB', 'CW', 'AM', 'FM', 'WFM'], atu: true, scope: true, dsp: true, narrowCw: true, face: 'graphite',
    blurb: 'Big crisp waterfall, narrow CW filters and DSP noise reduction built in. HF and 6 m only.',
  },
  qrp: {
    name: 'QRP Field Transceiver', code: 'QF-10', cls: 'Battery portable, 10 W', price: 250, maxW: 10,
    tx: HF6, rx: [0.5e6, 54e6], modes: ['LSB', 'USB', 'CW', 'AM', 'FM'], atu: true, scope: false, dsp: false, narrowCw: true, face: 'silver',
    blurb: 'For parks, summits and Field Day. 10 W makes every contact count — CW gets through!',
  },
  contest: {
    name: 'Contest-Grade Transceiver', code: 'CG-100', cls: 'Top-tier HF + 6 m', price: 1500, maxW: 100,
    tx: HF6, rx: [0.5e6, 54e6], modes: ['LSB', 'USB', 'CW', 'AM', 'FM'], atu: true, scope: true, dsp: true, narrowCw: true, quietRx: 3, face: 'black',
    blurb: 'The quietest receiver in the sim (−3 dB internal noise), roofing-grade narrow filters, DSP, scope.',
  },
  ht: {
    name: 'Dual-Band Handheld', code: 'DH-5', cls: '2 m FM handheld, 5 W', price: 60, maxW: 5,
    tx: ['2m'], rx: [88e6, 470e6], modes: ['FM', 'WFM', 'AM'], atu: false, scope: false, dsp: false, narrowCw: false, face: 'black',
    blurb: 'Pocket radio for repeaters and simplex, plus FM broadcast, NOAA weather and airband (AM receive).',
  },
  sdrrx: {
    name: 'Wideband SDR Receiver', code: 'WR-1', cls: 'Receive-only SDR, 0.5–470 MHz', price: 100, maxW: 0,
    tx: [], rx: [0.5e6, 470e6], modes: ['LSB', 'USB', 'CW', 'AM', 'FM', 'WFM'], atu: false, scope: true, dsp: true, narrowCw: true, face: 'black',
    blurb: 'For listening only: shortwave, broadcast, airband, weather, scanners. No license needed.',
  },
};
Object.assign(RIGS.allmode, { drawA: 22, look: 'classic', ifs: true, notch: true, preamps: 1, agc: true });
Object.assign(RIGS.sdr100, { drawA: 21, look: 'touch', ifs: true, notch: true, preamps: 2, agc: true });
Object.assign(RIGS.qrp, { drawA: 2.5, look: 'portable', preamps: 1, agc: true });
Object.assign(RIGS.contest, { drawA: 22, look: 'contest', ifs: true, notch: true, preamps: 2, agc: true });
Object.assign(RIGS.ht, { drawA: 1.6, look: 'ht', ht: { body: '#1a1c1f', accent: '#5ee08a', lcd: 'green', keys: 'classic' } });
Object.assign(RIGS.sdrrx, { drawA: 0.4, look: 'sdr' });
Object.assign(RIGS, REAL_RIGS);
export const rig = () => RIGS[S.rig] || RIGS.allmode;
// Can the current receiver tune this frequency? (some radios have gaps, e.g. no airband)
export const rigRx = (hz, r = rig()) => (r.rxBands ? r.rxBands.some(([a, b]) => hz >= a && hz <= b) : hz >= r.rx[0] && hz <= r.rx[1]);
export const isHT = (r = rig()) => r.look === 'ht';

// Station accessories chosen in the Rig builder (power supply, tuner, meter, amp, mic, key).
export const GEAR_DEFAULT = { psu: 'gen30', tuner: 'gen300', meter: 'gen200', amp: 'none', mic: 'stock', key: 'gen', arrestor: 'gen', mains240: false };
export const gear = () => (S.gear = { ...GEAR_DEFAULT, ...(S.gear || {}) });
export const gearOf = (cat) => GEAR[cat].items[gear()[cat]] || Object.values(GEAR[cat].items)[0];
// Power the supply can actually deliver: the radio needs ~drawA at full output (+2 A receive).
export function psuLimitW(r = rig()) {
  const p = gearOf('psu');
  if (!r.maxW || !r.drawA) return Infinity;
  if (p.amps >= r.drawA) return Infinity;
  return Math.max(1, Math.floor(r.maxW * Math.max(0, (p.amps - 2) / (r.drawA - 2)) / 5) * 5);
}
export const rigCanTx = (bandName) => rig().tx.includes(bandName);
export const rigMaxW = (hz) => (rig().maxWvhf && hz > 100e6 ? rig().maxWvhf : rig().maxW);
