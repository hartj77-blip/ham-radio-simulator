// Radio models. Each has real-world-style limits that change how the sim behaves.
// (Generic names — modelled on common classes of radios, not specific brands.)
import { S } from './state.js';

const HF6 = ['160m', '80m', '40m', '30m', '20m', '17m', '15m', '12m', '10m', '6m'];
export const RIGS = {
  allmode: {
    name: 'AM-991 HF/VHF all-mode', cls: 'All-mode HF + 6 m + 2 m base/mobile', price: 0, maxW: 100, maxWvhf: 50,
    tx: [...HF6, '2m'], rx: [0.5e6, 470e6], modes: ['LSB', 'USB', 'CW', 'AM', 'FM', 'WFM'], atu: true, scope: true, dsp: true, narrowCw: false, face: 'graphite',
    blurb: 'The do-everything starter: HF, 6 m and 2 m, internal tuner, spectrum scope, general-coverage receive.',
  },
  sdr100: {
    name: 'SDR-100 compact HF transceiver', cls: 'Direct-sampling SDR, HF + 6 m', price: 400, maxW: 100,
    tx: HF6, rx: [0.5e6, 74.8e6], modes: ['LSB', 'USB', 'CW', 'AM', 'FM', 'WFM'], atu: true, scope: true, dsp: true, narrowCw: true, face: 'graphite',
    blurb: 'Big crisp waterfall, narrow CW filters and DSP noise reduction built in. HF and 6 m only.',
  },
  qrp: {
    name: 'QRP-10 portable', cls: 'Battery portable, 10 W', price: 250, maxW: 10,
    tx: HF6, rx: [0.5e6, 54e6], modes: ['LSB', 'USB', 'CW', 'AM', 'FM'], atu: true, scope: false, dsp: false, narrowCw: true, face: 'silver',
    blurb: 'For parks, summits and Field Day. 10 W makes every contact count — CW gets through!',
  },
  contest: {
    name: 'K-Pro contest transceiver', cls: 'Top-tier HF + 6 m', price: 1500, maxW: 100,
    tx: HF6, rx: [0.5e6, 54e6], modes: ['LSB', 'USB', 'CW', 'AM', 'FM'], atu: true, scope: true, dsp: true, narrowCw: true, quietRx: 3, face: 'black',
    blurb: 'The quietest receiver in the sim (−3 dB internal noise), roofing-grade narrow filters, DSP, scope.',
  },
  ht: {
    name: 'HT-5 dual-band handheld', cls: '2 m FM handheld, 5 W', price: 60, maxW: 5,
    tx: ['2m'], rx: [88e6, 470e6], modes: ['FM', 'WFM'], atu: false, scope: false, dsp: false, narrowCw: false, face: 'black',
    blurb: 'Pocket radio for repeaters and simplex, plus FM broadcast, NOAA weather and airband (FM only).',
  },
  sdrrx: {
    name: 'WB-SDR wideband receiver', cls: 'Receive-only SDR, 0.5–470 MHz', price: 100, maxW: 0,
    tx: [], rx: [0.5e6, 470e6], modes: ['LSB', 'USB', 'CW', 'AM', 'FM', 'WFM'], atu: false, scope: true, dsp: true, narrowCw: true, face: 'black',
    blurb: 'For listening only: shortwave, broadcast, airband, weather, scanners. No license needed.',
  },
};
export const rig = () => RIGS[S.rig] || RIGS.allmode;
export const rigCanTx = (bandName) => rig().tx.includes(bandName);
export const rigMaxW = (hz) => (rig().maxWvhf && hz > 100e6 ? rig().maxWvhf : rig().maxW);
