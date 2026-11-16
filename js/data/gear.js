// Real-world equipment catalog. Specs are approximate published figures (manufacturer
// datasheets / common reviews) and are used to drive the simulation. Model names are used
// only to identify the equipment; this game is not affiliated with any manufacturer.
//
// Price: `usd` is a typical street price; `price` is the in-game cost in credits (Career).
const HF = ['160m', '80m', '40m', '30m', '20m', '17m', '15m', '12m', '10m'];
const HF6 = [...HF, '6m'];
const cr = (usd) => Math.max(10, Math.round(usd / 4 / 10) * 10);
const M = 1e6;

// ---------------------------------------------------------------- transceivers & receivers
// look: faceplate layout used by the radio view — 'touch' (big touchscreen + scope), 'classic'
// (LCD + rows of keys), 'contest' (dual receivers, two knobs), 'portable', 'mobile', 'ht', 'sdr'.
export const REAL_RIGS = {
  ic7300: {
    name: 'Icom IC-7300', maker: 'Icom', usd: 1100, cls: 'HF + 6 m SDR base, 100 W', maxW: 100, drawA: 21,
    tx: HF6, rx: [0.03 * M, 74.8 * M], modes: ['LSB', 'USB', 'CW', 'AM', 'FM'], atu: true, scope: true, dsp: true, narrowCw: true, quietRx: 1,
    face: 'black', look: 'touch', weight: 4.2, ifs: true, notch: true, preamps: 2, agc: true,
    blurb: 'The best-selling HF rig of its era: direct-sampling SDR, 4.3″ touchscreen with real-time scope and waterfall, internal ATU.',
  },
  ft991a: {
    name: 'Yaesu FT-991A', maker: 'Yaesu', usd: 1250, cls: 'HF/6 m/2 m/70 cm all-mode, 100 W HF / 50 W VHF', maxW: 100, maxWvhf: 50, drawA: 22,
    tx: [...HF6, '2m'], rx: [0.03 * M, 470 * M], modes: ['LSB', 'USB', 'CW', 'AM', 'FM', 'WFM'], atu: true, scope: true, dsp: true, narrowCw: true, quietRx: 0,
    face: 'black', look: 'touch', weight: 4.3, ifs: true, notch: true, preamps: 2, agc: true,
    blurb: 'HF to 70 cm in one box: SSB/CW/FM/AM/C4FM, touchscreen scope, internal tuner (HF/6 m).',
  },
  ft710: {
    name: 'Yaesu FT-710 AESS', maker: 'Yaesu', usd: 1000, cls: 'HF + 6 m SDR, 100 W', maxW: 100, drawA: 23,
    tx: HF6, rx: [0.03 * M, 56 * M], modes: ['LSB', 'USB', 'CW', 'AM', 'FM'], atu: true, scope: true, dsp: true, narrowCw: true, quietRx: 2,
    face: 'black', look: 'touch', weight: 5.0, ifs: true, notch: true, preamps: 2, agc: true,
    blurb: 'Excellent strong-signal receiver for the money, 3.5″ touch display with scope, matched external speaker.',
  },
  ts590sg: {
    name: 'Kenwood TS-590SG', maker: 'Kenwood', usd: 1500, cls: 'HF + 6 m, 100 W, roofing filters', maxW: 100, drawA: 20.5,
    tx: HF6, rx: [0.13 * M, 60 * M], modes: ['LSB', 'USB', 'CW', 'AM', 'FM'], atu: true, scope: false, dsp: true, narrowCw: true, quietRx: 2,
    face: 'black', look: 'classic', weight: 7.4, ifs: true, notch: true, preamps: 1, agc: true,
    blurb: 'Down-conversion receiver with 500 Hz / 2.7 kHz roofing filters — a contester favourite. No built-in scope: tune by ear.',
  },
  ft891: {
    name: 'Yaesu FT-891', maker: 'Yaesu', usd: 650, cls: 'HF + 6 m mobile/portable, 100 W', maxW: 100, drawA: 23,
    tx: HF6, rx: [0.03 * M, 56 * M], modes: ['LSB', 'USB', 'CW', 'AM', 'FM'], atu: false, scope: false, dsp: true, narrowCw: true, quietRx: 0,
    face: 'black', look: 'mobile', weight: 1.9, ifs: true, notch: true, preamps: 1, agc: true,
    blurb: 'Tiny 100 W rig for the car or a park table. No internal tuner — pair it with an external ATU or resonant antennas.',
  },
  ic705: {
    name: 'Icom IC-705', maker: 'Icom', usd: 1300, cls: 'HF–70 cm portable SDR, 10 W', maxW: 10, drawA: 3,
    tx: [...HF6, '2m'], rx: [0.03 * M, 470 * M], modes: ['LSB', 'USB', 'CW', 'AM', 'FM', 'WFM'], atu: false, scope: true, dsp: true, narrowCw: true, quietRx: 1,
    face: 'black', look: 'portable', weight: 1.1, ifs: true, notch: true, preamps: 2, agc: true, battery: true,
    blurb: 'A shack-in-a-lunchbox: touchscreen scope, GPS, Bluetooth, 5 W on its battery, 10 W on 13.8 V.',
  },
  g90: {
    name: 'Xiegu G90', maker: 'Xiegu', usd: 450, cls: 'HF SDR portable, 20 W', maxW: 20, drawA: 8,
    tx: HF, rx: [0.5 * M, 30 * M], modes: ['LSB', 'USB', 'CW', 'AM'], atu: true, scope: true, dsp: false, narrowCw: true, quietRx: -2,
    face: 'black', look: 'portable', weight: 1.0, ifs: false, notch: false, preamps: 1, agc: true,
    blurb: 'Budget 20 W HF with a wide-range built-in tuner and a small spectrum display. Great for portable on a budget.',
  },
  k4: {
    name: 'Elecraft K4D', maker: 'Elecraft', usd: 6300, cls: 'Dual-receiver HF + 6 m flagship, 100 W', maxW: 100, drawA: 22,
    tx: HF6, rx: [0.1 * M, 54 * M], modes: ['LSB', 'USB', 'CW', 'AM', 'FM'], atu: true, scope: true, dsp: true, narrowCw: true, quietRx: 4,
    face: 'black', look: 'contest', weight: 6.8, ifs: true, notch: true, preamps: 2, agc: true,
    blurb: 'Top-of-the-line contest/DX station: dual receivers, huge touchscreen panadapter, best-in-class dynamic range.',
  },
  // ------------------------------------------------ handhelds
  uv5r: {
    name: 'Baofeng UV-5R', maker: 'Baofeng', usd: 25, cls: 'Dual-band 2 m/70 cm FM handheld, 4 W', maxW: 4, drawA: 1.5,
    tx: ['2m'], rx: [65 * M, 520 * M], rxBands: [[65 * M, 108 * M], [136 * M, 174 * M], [400 * M, 520 * M]], modes: ['FM', 'WFM'], atu: false, scope: false, dsp: false, narrowCw: false, quietRx: -3,
    face: 'black', look: 'ht', weight: 0.25, ht: { body: '#141414', accent: '#f39a1e', lcd: 'amber', keys: 'uv' },
    blurb: 'The famous $25 dual-bander. Broadcast FM receive, no airband (no AM). Wide-open front end — strong signals overload it.',
  },
  uvk5: {
    name: 'Quansheng UV-K5', maker: 'Quansheng', usd: 30, cls: 'Dual-band FM handheld with wideband/AM receive, 5 W', maxW: 5, drawA: 1.6,
    tx: ['2m'], rx: [18 * M, 470 * M], modes: ['FM', 'WFM', 'AM'], atu: false, scope: false, dsp: false, narrowCw: false, quietRx: -2,
    face: 'black', look: 'ht', weight: 0.2, ht: { body: '#1b1d20', accent: '#7cc4ff', lcd: 'white', keys: 'uv' },
    blurb: 'Cheap, hackable, and it hears airband AM. A popular first radio.',
  },
  ft60r: {
    name: 'Yaesu FT-60R', maker: 'Yaesu', usd: 160, cls: 'Rugged dual-band FM handheld, 5 W', maxW: 5, drawA: 1.5,
    tx: ['2m'], rx: [108 * M, 470 * M], modes: ['FM', 'AM'], atu: false, scope: false, dsp: false, narrowCw: false, quietRx: 1,
    face: 'black', look: 'ht', weight: 0.37, ht: { body: '#23262a', accent: '#9aa3ad', lcd: 'amber', keys: 'classic' },
    blurb: 'A tank. Good receiver, airband AM, 1000 memories. ARES/RACES favourite.',
  },
  thd75: {
    name: 'Kenwood TH-D75A', maker: 'Kenwood', usd: 700, cls: 'Tri-band handheld, APRS/D-STAR, HF SSB/CW receive', maxW: 5, drawA: 1.8,
    tx: ['2m'], rx: [0.1 * M, 524 * M], modes: ['FM', 'WFM', 'AM', 'LSB', 'USB', 'CW'], atu: false, scope: false, dsp: true, narrowCw: false, quietRx: 1,
    face: 'black', look: 'ht', weight: 0.36, ht: { body: '#1f2226', accent: '#e33d3d', lcd: 'white', keys: 'classic' },
    blurb: 'A full receiver in your pocket: listen to HF SSB/CW, broadcast, airband — plus APRS, GPS and D-STAR.',
  },
  // ------------------------------------------------ receivers
  rtlsdr: {
    name: 'RTL-SDR Blog V4', maker: 'RTL-SDR Blog', usd: 40, cls: 'USB SDR dongle, receive only', maxW: 0, drawA: 0.3,
    tx: [], rx: [0.5 * M, 470 * M], modes: ['LSB', 'USB', 'CW', 'AM', 'FM', 'WFM'], atu: false, scope: true, dsp: true, narrowCw: true, quietRx: -6,
    face: 'black', look: 'sdr', weight: 0.05,
    blurb: '8-bit dongle with an HF upconverter: hears everything, but a noisy front end and only 48 dB of dynamic range.',
  },
  rspdx: {
    name: 'SDRplay RSPdx-R2', maker: 'SDRplay', usd: 240, cls: '14-bit wideband SDR receiver', maxW: 0, drawA: 0.3,
    tx: [], rx: [0.5 * M, 470 * M], modes: ['LSB', 'USB', 'CW', 'AM', 'FM', 'WFM'], atu: false, scope: true, dsp: true, narrowCw: true, quietRx: 1,
    face: 'black', look: 'sdr', weight: 0.3,
    blurb: '14-bit ADC, three antenna inputs, HDR mode for low bands. A serious listening receiver.',
  },
};
for (const r of Object.values(REAL_RIGS)) r.price = cr(r.usd);

// ---------------------------------------------------------------- station accessories
export const GEAR = {
  psu: {
    label: 'Power supply', icon: '🔋', items: {
      gen30: { name: 'Generic 30 A switching supply', usd: 90, amps: 30, noiseDb: 1, kind: 'switching', starter: true, desc: 'Gets you on the air. Cheap switchers can add a little hash (birdies) on the low bands.' },
      rs35m: { name: 'Astron RS-35M', usd: 280, amps: 25, peakA: 35, noiseDb: 0, kind: 'linear', desc: 'Heavy, linear, bullet-proof and dead quiet. 25 A continuous, 35 A peak.' },
      dm330: { name: 'Alinco DM-330MV', usd: 170, amps: 30, noiseDb: 0.5, kind: 'switching', desc: 'Light switching supply with a noise-offset knob to move birdies off your frequency.' },
      sps30: { name: 'Powerwerx SPS-30DM', usd: 140, amps: 30, noiseDb: 0.5, kind: 'switching', desc: 'Compact 30 A switcher with Powerpole outputs.' },
      sla12: { name: '12 V 9 Ah SLA battery', usd: 35, amps: 9, noiseDb: 0, kind: 'battery', volts: 12.2, desc: 'Silent, but voltage sags under load. Fine for QRP and HTs.' },
      lfp20: { name: 'Bioenno 12 V 20 Ah LiFePO4', usd: 230, amps: 20, noiseDb: 0, kind: 'battery', volts: 13.2, desc: 'Light, flat discharge curve, perfect for POTA/SOTA — quiet as a linear supply.' },
    },
  },
  tuner: {
    label: 'Antenna tuner', icon: '🎚', items: {
      none: { name: 'None (rig ATU / resonant antennas)', usd: 0, maxW: Infinity, range: 0, starter: true, desc: 'Use the radio\'s internal tuner, if it has one, or a resonant antenna.' },
      gen300: { name: 'Generic 300 W manual T-network', usd: 120, maxW: 300, range: 10, manual: true, starter: true, desc: 'Three knobs: TX, ANT and inductor. Matches most coax-fed wires.' },
      z100: { name: 'LDG Z-100Plus', usd: 160, maxW: 125, range: 10, auto: true, desc: 'Small auto-tuner (memories, latching relays). 125 W max — not for amplifiers.' },
      mfj949: { name: 'MFJ-949E', usd: 230, maxW: 300, range: 12, manual: true, meter: true, desc: 'Classic manual tuner with built-in cross-needle meter and dummy load.' },
      at2k: { name: 'Palstar AT2K', usd: 650, maxW: 2000, range: 10, manual: true, desc: 'Roller-inductor legal-limit manual tuner. Handles the amplifier.' },
      at1kd: { name: 'Ameritron ATR-30', usd: 750, maxW: 3000, range: 10, manual: true, desc: 'Big roller-inductor tuner for full legal limit and beyond.' },
    },
  },
  meter: {
    label: 'SWR / watt meter', icon: '📏', items: {
      gen200: { name: 'Generic HF/VHF SWR meter (200 W)', usd: 40, maxW: 200, hi: 150 * M, starter: true, desc: 'Basic cross-needle meter.' },
      cn901: { name: 'Daiwa CN-901HP', usd: 160, maxW: 2000, hi: 150 * M, desc: 'Cross-needle, 20/200/2000 W ranges, PEP hold. The classic.' },
      sx200: { name: 'Diamond SX-200', usd: 150, maxW: 200, hi: 200 * M, desc: '1.8–200 MHz with a single meter. Good for HF + VHF shacks.' },
      lp500: { name: 'TelePost LP-500 digital', usd: 450, maxW: 3000, hi: 54 * M, desc: 'Digital station monitor: power, SWR and an RF envelope scope.' },
    },
  },
  amp: {
    label: 'Amplifier', icon: '⚡', items: {
      none: { name: 'None', usd: 0, out: 0, drive: 0, starter: true, desc: 'Barefoot (radio power only).' },
      al811h: { name: 'Ameritron AL-811H', usd: 1100, out: 800, drive: 70, mains: 120, mainsA: 15, tube: true, desc: 'Four 811A tubes, 800 W out, runs on 120 V. Needs about 70 W of drive and manual tune-up.' },
      kpa500: { name: 'Elecraft KPA500', usd: 2600, out: 500, drive: 30, mains: 120, mainsA: 10, desc: 'Solid-state, no tune-up, instant band change. 500 W from ~30 W drive.' },
      acom1000: { name: 'ACOM 1000', usd: 3200, out: 1000, drive: 60, mains: 240, mainsA: 10, tube: true, desc: 'Single 4CX800A tube, 1 kW. Needs a 240 V circuit.' },
      spe13k: { name: 'SPE Expert 1.3K-FA', usd: 4300, out: 1300, drive: 50, mains: 240, mainsA: 13, auto: true, desc: 'Solid-state 1.3 kW with a built-in auto-tuner. Needs 240 V for full output.' },
    },
  },
  mic: {
    label: 'Microphone', icon: '🎙', items: {
      stock: { name: 'Stock hand mic', usd: 0, talk: 0, starter: true, desc: 'The mic that came in the box. Perfectly fine.' },
      heilpr781: { name: 'Heil PR-781 desk mic', usd: 250, talk: 1.5, desc: 'Broadcast-style desk mic with a rising "DX" response — about 1.5 dB more talk power.' },
      heilpro7: { name: 'Heil Pro 7 headset', usd: 230, talk: 2, desc: 'Headset with boom mic: hands free for contesting, consistent mic distance.' },
    },
  },
  key: {
    label: 'CW key', icon: '🔑', items: {
      straight: { name: 'Straight key', usd: 40, iambic: false, desc: 'One lever, you form every dit and dah by hand.' },
      gen: { name: 'Generic iambic paddle', usd: 0, iambic: true, starter: true, desc: 'The paddle in the starter kit.' },
      by1: { name: 'Bencher BY-1 iambic paddle', usd: 150, iambic: true, desc: 'Squeeze keying with the rig\'s keyer. The standard paddle.' },
      vibro: { name: 'Vibroplex Original bug', usd: 350, iambic: false, bug: true, desc: 'Semi-automatic "bug": the pendulum makes dits, you make the dahs.' },
    },
  },
  arrestor: {
    label: 'Lightning protection', icon: '⛈', items: {
      gen: { name: 'Generic gas-tube coax arrestor', usd: 30, starter: true, desc: 'SO-239 gas-discharge arrestor. Bond it to the ground rod.' },
      polyphaser: { name: 'PolyPhaser IS-50UX-C0', usd: 120, desc: 'Quarter-wave stub / gas-tube protector — professional grade.' },
    },
  },
};
for (const cat of Object.values(GEAR)) for (const it of Object.values(cat.items)) it.price = it.usd ? cr(it.usd) : 0;

export const gearItem = (cat, id) => GEAR[cat]?.items[id] || null;
