// Training mode: a structured course that walks you through building and operating a station.
// Each step says what to do, detects when you have done it, explains why it matters and links to
// the reference library. Checkpoint questions are graded against the live simulation, so the
// right answer depends on the antenna you actually built and the conditions right now.
import { S, save } from './state.js';
import { h, $, bus, toast } from './util.js';
import { icon } from './icons.js';
import { rigStatus, isConnected } from './shack.js';
import { world } from './world.js';
import { bandOf, bandByName } from './data/bandplan.js';
import { system, feedZ, analyzer } from './antenna.js';
import { SUN, bandConditions, mufAt } from './propagation.js';
import { stateBy } from './data/world.js';
import { isHT } from './rigs.js';
import { audio } from './audio.js';

const T = () => (S.training ||= { step: 0, done: {}, answers: {}, marks: {}, min: false });
const goTab = (t) => bus.emit('goto', t);
const callField = () => (document.querySelector('.lf-call')?.value || '').trim();
const f40 = 7.15e6;

// Where is the SWR minimum of the antenna as built, around a band?
function dipNear(bandName) {
  const b = bandByName(bandName);
  const span = b.hi - b.lo, lo = b.lo - span * 0.6, hi = b.hi + span * 0.6;
  const a = { ...S.antenna, built: true };
  let best = null;
  for (let i = 0; i <= 160; i++) {
    const f = lo + (hi - lo) * i / 160;
    const s = system(f, a);
    if (s && (!best || s.swrRig < best.swr)) best = { f, swr: s.swrRig };
  }
  if (!best) return null;
  return { ...best, where: best.f < b.lo ? 'below' : best.f > b.hi ? 'above' : 'inside' };
}
const xAt = (hz) => { const z = feedZ({ ...S.antenna, built: true }, hz); return z ? z.X : 0; };
const bestBandGroup = () => {
  const bc = bandConditions(stateBy(S.op.state));
  const rank = { Good: 3, Fair: 2, Poor: 1, Closed: 0 };
  const top = Math.max(...bc.map((b) => rank[b.now]));
  return bc.filter((b) => rank[b.now] === top).map((b) => b.name);
};

// ------------------------------------------------------------------ the curriculum
// kind: 'do' (detected automatically), 'quiz' (checkpoint question), 'read' (study, then continue)
export const MODULES = [
  { id: 'wiring', title: 'Station wiring', blurb: 'DC power, the RF path from radio to antenna, grounding and accessories.', refs: ['station-wiring', 'rf-path', 'grounding'] },
  { id: 'antenna', title: 'Antenna construction', blurb: 'Choose an antenna, calculate its length, set its height and raise it.', refs: ['antenna-basics', 'dipole-build', 'height-ground'] },
  { id: 'tuning', title: 'Reading the analyzer & tuning', blurb: 'Interpret an SWR sweep, read R and X, trim to resonance and use the tuner correctly.', refs: ['swr', 'antenna-analyzer', 'antenna-tuner'] },
  { id: 'receiving', title: 'Receiving & searching frequencies', blurb: 'Band plan, sidebands, tuning steps, filters, the waterfall and reference signals.', refs: ['bandplan', 'tuning-searching', 'receiver-controls'] },
  { id: 'propagation', title: 'Propagation', blurb: 'How the sun, the ionosphere and the time of day decide which bands are open.', refs: ['ionosphere', 'solar', 'band-by-band'] },
  { id: 'license', title: 'Licensing', blurb: 'Study the question pool and take the Technician examination.', refs: ['licensing'] },
  { id: 'qso', title: 'Your first contact', blurb: 'Answer a CQ, exchange reports and log the contact correctly.', refs: ['qso', 'logging'] },
  { id: 'vhf', title: 'VHF & repeaters', blurb: 'Program offset and CTCSS tone and access the local 2 m repeater.', refs: ['repeaters', 'vhf-propagation'] },
];

export const STEPS = [
  // ---------------- Module 1: wiring
  { m: 'wiring', tab: 'shack', sel: '[data-port="rig_red"]', title: 'Connect the positive DC lead', ref: 'station-wiring',
    text: 'Click the radio\'s <b>red DC lead</b> (DC red, below the radio), then the <b>red + terminal</b> on the power supply.',
    why: 'The transceiver runs on 13.8 V DC. Red is positive by convention. Reversed polarity blows the fuse in the DC lead — or damages a radio without protection.',
    how: 'Click the "DC red" connector under the radio (it highlights), then the red + post on the power supply. A red cable is drawn.',
    done: () => isConnected('rig_red', 'psu_pos'), praise: 'Positive lead connected to the positive terminal.' },
  { m: 'wiring', tab: 'shack', sel: '[data-port="rig_blk"]', title: 'Connect the negative DC lead', ref: 'station-wiring',
    text: 'Connect the <b>black lead</b> (DC blk) to the black <b>− terminal</b>.',
    why: 'Black is the negative return. Both conductors are fused on a properly built DC cable so a short circuit cannot overheat the wiring.',
    how: 'Click "DC blk" under the radio, then the black − post on the supply.',
    done: () => isConnected('rig_blk', 'psu_neg'), praise: 'DC power is wired with correct polarity.' },
  { m: 'wiring', tab: 'shack', sel: '[data-port="rig_ant"]', title: 'Coax: radio to SWR/power meter', ref: 'rf-path',
    text: 'Run coax from the radio\'s <b>ANT</b> jack to the <b>TX</b> input of the SWR/power meter.',
    why: 'The meter sits directly at the transmitter output so it reads forward and reflected power exactly as the radio sees them.',
    how: 'Click the ANT connector on the radio, then the TX connector on the meter.',
    done: () => isConnected('rig_ant', 'swr_tx'), praise: 'Meter inserted at the transmitter output.' },
  { m: 'wiring', tab: 'shack', sel: '[data-port="swr_ant"]', title: 'Coax: meter to antenna tuner', ref: 'rf-path',
    text: 'Connect the meter\'s <b>ANT</b> output to the tuner\'s <b>TX IN</b>.',
    why: 'With the meter between radio and tuner, it shows the SWR the radio sees — which is what you adjust the tuner to minimise.',
    how: 'Click the meter\'s ANT connector, then TX IN on the tuner.',
    done: () => isConnected('swr_ant', 'atu_in'), praise: 'Tuner inserted after the meter.' },
  { m: 'wiring', tab: 'shack', sel: '[data-port="atu_out"]', title: 'Tuner output to the lightning arrestor', ref: 'rf-path',
    text: 'Connect the tuner\'s <b>ANT</b> output to the <b>lightning arrestor</b> at the wall entry.',
    why: 'The feedline should pass through a grounded arrestor where it enters the building, so a surge is diverted to ground outside the shack.',
    how: 'Click the tuner ANT connector, then the arrestor\'s IN connector on the wall.',
    done: () => isConnected('atu_out', 'arr_in'), praise: 'RF path complete to the wall entry.' },
  { m: 'wiring', tab: 'shack', sel: '[data-port="rig_gnd"]', title: 'Bond the radio to the ground bus', ref: 'grounding',
    text: 'Connect the radio\'s <b>GND</b> terminal to the copper <b>ground bus</b>.',
    why: 'Bonding every chassis to one bus keeps all equipment at the same potential: less RF on cables, less noise and a defined path for fault and surge currents.',
    how: 'Click the radio GND terminal, then any point on the copper bus.',
    done: () => S.shack.conn.some((c) => c.includes('rig_gnd') && c.includes('gb')), praise: 'Radio bonded.' },
  { m: 'wiring', tab: 'shack', sel: '[data-port="arr_gnd"]', title: 'Ground the lightning arrestor', ref: 'grounding',
    text: 'Bond the arrestor\'s <b>GND</b> to the ground bus.',
    why: 'An arrestor is only effective with a low-impedance path to the ground rod. All grounding electrodes must be bonded together (NEC Article 810).',
    how: 'Click the arrestor GND terminal, then the ground bus.',
    done: () => S.shack.conn.some((c) => c.includes('arr_gnd') && c.includes('gb')), praise: 'Arrestor grounded.' },
  { m: 'wiring', tab: 'shack', sel: '[data-port="atu_gnd"]', title: 'Bond the antenna tuner', ref: 'grounding',
    text: 'Bond the tuner\'s <b>GND</b> to the ground bus.',
    why: 'Tuners can carry large RF voltages. A bonded chassis prevents RF burns and stray RF in the shack.',
    how: 'Click the tuner GND terminal, then the ground bus.',
    done: () => S.shack.conn.some((c) => c.includes('atu_gnd') && c.includes('gb')), praise: 'Every chassis is bonded to a single ground point.' },
  { m: 'wiring', tab: 'shack', sel: '[data-port="mic_plug"]', title: 'Connect the microphone', ref: 'station-wiring',
    text: 'Plug the <b>microphone</b> into the radio\'s <b>MIC</b> jack.',
    why: 'Voice modes (SSB, AM, FM) need audio input. The PTT switch on the microphone keys the transmitter.',
    how: 'Click the microphone\'s plug, then MIC on the radio.',
    done: () => isConnected('mic_plug', 'rig_mic'), praise: 'Microphone connected.' },
  { m: 'wiring', tab: 'shack', sel: '[data-port="key_plug"]', title: 'Connect the CW paddle', ref: 'cw',
    text: 'Plug the <b>paddle</b> into the <b>KEY</b> jack.',
    why: 'CW (Morse) is the most power-efficient mode: a narrow carrier is readable at signal levels where voice is lost in noise.',
    how: 'Click the paddle plug, then KEY on the radio.',
    done: () => isConnected('key_plug', 'rig_key'), praise: 'Key connected.' },
  { m: 'wiring', tab: 'shack', sel: '[data-ctl="psu-switch"]', title: 'Switch on the power supply', ref: 'power-supplies',
    text: 'Switch on the <b>power supply</b>.',
    why: 'Power the supply first and the radio second; switch off in reverse order. This avoids switching transients reaching the radio.',
    how: 'Click the switch on the power supply front panel.',
    done: () => S.shack.psuOn, praise: '13.8 V is available.' },
  { m: 'wiring', tab: 'shack', sel: '[data-ctl="rig-power"]', title: 'Switch on the transceiver', ref: 'station-wiring',
    text: 'Press the radio\'s <b>POWER</b> button.',
    why: 'With power, RF path, grounding and accessories in place the station is complete and safe to operate.',
    how: 'Click the round POWER button at the top left of the radio.',
    done: () => rigStatus().powered && !isHT(), praise: 'The station is wired and powered.' },

  // ---------------- Module 2: antenna
  { m: 'antenna', tab: 'antenna', sel: '#ant-type', title: 'Select a half-wave dipole', ref: 'antenna-basics',
    text: 'On the Antenna page, set the antenna type to <b>Half-wave dipole</b>.',
    why: 'Two equal conductors fed at the centre: about 50–75 Ω at resonance, a good match to 50 Ω coax, and simple to adjust. It is the reference antenna against which others are compared.',
    how: 'Use the "Antenna type" selector at the top of the build panel.',
    done: () => S.antenna.type === 'dipole', praise: 'Dipole selected.' },
  { m: 'antenna', kind: 'quiz', title: 'Calculate the length', ref: 'antenna-basics',
    text: 'Before cutting wire, calculate it. Using <b>L(ft) = 468 ÷ f(MHz)</b>, how long is a dipole for <b>7.150 MHz</b>?',
    options: [['32.7 ft', false], ['65.5 ft', true], ['131 ft', false], ['234 ft', false]],
    explain: '468 ÷ 7.150 = 65.45 ft, so each leg is about 32.7 ft. The constant 468 is the free-space half wavelength (492 ÷ f) reduced about 5% for end effect.' },
  { m: 'antenna', tab: 'antenna', sel: '#ant-autosize', title: 'Size the wire for 40 m', ref: 'dipole-build',
    text: 'Set <b>Design for</b> to <b>40m</b> and either type <b>65.5</b> in the length field or press <b>Auto-size</b>.',
    why: 'The formula is a starting point. Auto-size solves the actual wire at its actual height with a Method-of-Moments model — the same approach professional software (NEC) uses.',
    how: 'Choose 40m under "Design for", then press Auto-size, or enter the length and press Tab.',
    done: () => !!S.antenna.sizedBy && S.antenna.length >= 60 && S.antenna.length <= 72, praise: 'Wire cut for 40 m.' },
  { m: 'antenna', tab: 'antenna', sel: '#ant-height', title: 'Set the height to at least 30 ft', ref: 'height-ground',
    text: 'Raise the support height to <b>30 ft or more</b>.',
    why: 'Height in wavelengths sets the elevation angle of radiation. On 40 m, 30 ft is about 0.22 λ: still high-angle, good for regional contacts. Higher favours long distance.',
    how: 'Drag the height slider or use the +1 / +5 buttons.',
    done: () => S.antenna.height >= 30, praise: 'Height set.' },
  { m: 'antenna', tab: 'antenna', sel: '.ant-controls .btn.big', title: 'Raise the antenna', ref: 'dipole-build',
    text: 'Press <b>Raise antenna</b>.',
    why: 'The feedline now connects through the wall entry and the radio is connected to a real load.',
    how: 'The button at the bottom of the build panel.',
    done: () => S.antenna.built, praise: 'Antenna is up.' },

  // ---------------- Module 3: analyzer & tuning
  { m: 'tuning', tab: 'antenna', sel: '.analyzer', title: 'Sweep 40 m with the analyzer', ref: 'antenna-analyzer',
    text: 'In the analyzer, set <b>Sweep</b> to <b>40m</b>. The shaded area is the band; the curve is SWR versus frequency.',
    why: 'An analyzer injects a small signal and measures the impedance at each frequency. The lowest point of the SWR curve is the resonant frequency.',
    how: 'Use the Sweep selector at the top right of the analyzer.',
    done: () => analyzer.band === '40m' && S.antenna.built, praise: 'Sweep running on 40 m.' },
  { m: 'tuning', kind: 'quiz', tab: 'antenna', sel: '.analyzer', title: 'Locate the resonance', ref: 'antenna-analyzer',
    text: 'Look at the sweep. Where is the <b>SWR minimum</b> (yellow dot) relative to the shaded 40 m band?',
    options: () => [['Below the band', dipNear('40m')?.where === 'below'], ['Inside the band', dipNear('40m')?.where === 'inside'], ['Above the band', dipNear('40m')?.where === 'above']],
    explain: () => { const d = dipNear('40m'); return `Your minimum is at ${(d.f / 1e6).toFixed(3)} MHz (SWR ${d.swr.toFixed(2)}:1). ${d.where === 'below' ? 'A dip below the band means the antenna is electrically too long.' : d.where === 'above' ? 'A dip above the band means the antenna is too short.' : 'Inside the band: the antenna is resonant where you want it.'}`; } },
  { m: 'tuning', tab: 'antenna', sel: '.len-row', title: 'Lengthen the wire by 3 ft', ref: 'dipole-build', mark: () => S.antenna.length,
    text: 'As an experiment, make the antenna <b>3 ft longer</b> (press <b>+1 ft</b> three times) and watch the curve.',
    why: 'Seeing cause and effect is the fastest way to learn trimming. Resonant frequency is inversely proportional to length.',
    how: 'Use the +1 ft button in the length row.',
    done: (mk) => S.antenna.length >= mk + 2.9, praise: 'Wire lengthened.' },
  { m: 'tuning', kind: 'quiz', tab: 'antenna', sel: '.analyzer', title: 'Which way did the dip move?', ref: 'antenna-basics',
    text: 'After lengthening the wire, the SWR minimum moved…',
    options: [['Lower in frequency', true], ['Higher in frequency', false], ['It did not move', false]],
    explain: 'A longer conductor is a larger fraction of a wavelength at a lower frequency, so resonance moves down. Roughly: Δf / f ≈ −ΔL / L. 3 ft on 65.5 ft is 4.6%, about 330 kHz on 40 m.' },
  { m: 'tuning', kind: 'quiz', tab: 'antenna', sel: '.analyzer', title: 'Read the reactance', ref: 'antenna-analyzer',
    text: 'Hover the analyzer at <b>7.150 MHz</b> and read the <b>Feedpoint Z</b> (R ± jX). What is the sign of X?',
    options: () => [['Positive (+jX, inductive)', xAt(f40) >= 0], ['Negative (−jX, capacitive)', xAt(f40) < 0]],
    explain: () => `At 7.150 MHz X is ${xAt(f40) >= 0 ? '+' : '−'}j${Math.abs(xAt(f40)).toFixed(0)} Ω. Positive (inductive) reactance means the antenna is longer than resonant at this frequency; negative (capacitive) means it is shorter. At resonance X = 0.` },
  { m: 'tuning', tab: 'antenna', sel: '#ant-autosize', title: 'Trim back to resonance', ref: 'dipole-build',
    text: 'Bring the minimum back to the middle of the band so that SWR at <b>7.150 MHz</b> is <b>below 1.5:1</b>. Use the −1 ft / −1 in buttons, or Auto-size.',
    why: 'Practical trimming rule: new length = old length × (f measured ÷ f wanted). Trim in small steps; it is easy to remove wire and hard to add it back.',
    how: 'Shorten by the amount the analyzer\'s advice line suggests, then check the sweep again.',
    done: () => { const s = S.antenna.built ? system(f40) : null; return s && s.swrRig < 1.5; }, praise: 'Resonant on 40 m with low SWR.' },
  { m: 'tuning', tab: 'radio', sel: '.rbtn[data-band="30m"]', title: 'Go to a band the antenna is not cut for', ref: 'antenna-tuner',
    text: 'On the Radio page select <b>30m</b>. Watch the SWR reading on the display.',
    why: 'A 40 m dipole is not resonant on 30 m: the feed impedance is far from 50 Ω, so SWR is high. This is where an antenna tuner is useful.',
    how: 'Press the 30m band button.',
    done: () => bandOf(S.radio.freq)?.name === '30m', praise: 'On 30 m.' },
  { m: 'tuning', tab: 'radio', sel: '.warnb', title: 'Match it with the tuner', ref: 'antenna-tuner',
    text: 'Enable <b>ATU</b> and press <b>TUNE</b>.',
    why: 'The tuner transforms the impedance at the radio to 50 Ω so the transmitter delivers full power. It does not make the antenna resonant: the mismatch and its extra loss remain on the coax beyond the tuner.',
    how: 'In the TRANSMIT group: ATU, then TUNE. Internal tuners typically match up to about 3:1.',
    done: () => S.radio.atuTunedFreq != null && bandOf(S.radio.atuTunedFreq)?.name === '30m', praise: 'Matched on 30 m by the tuner.' },
  { m: 'tuning', kind: 'quiz', title: 'What did the tuner change?', ref: 'antenna-tuner',
    text: 'After tuning on 30 m, which statement is correct?',
    options: [['The antenna is now resonant on 30 m', false], ['The radio now sees about 50 Ω; the mismatch on the feedline is unchanged', true], ['Feedline loss is now zero', false]],
    explain: 'The tuner sits at the radio end. Between tuner and antenna the standing waves — and the additional loss they cause — are exactly as before.' },

  // ---------------- Module 4: receiving
  { m: 'receiving', tab: 'radio', sel: '.rbtn[data-band="40m"]', title: 'Select the 40 m band', ref: 'bandplan',
    text: 'Press the <b>40m</b> band button.',
    why: '40 m (7.000–7.300 MHz in the US) is open somewhere at almost any hour — regional by day, long distance at night.',
    how: 'The band buttons are at the bottom left of the radio.',
    done: () => bandOf(S.radio.freq)?.name === '40m', praise: 'On 40 m.' },
  { m: 'receiving', tab: 'radio', sel: '.rbtn[data-mode="LSB"]', title: 'Select lower sideband', ref: 'modes',
    text: 'Choose <b>LSB</b>.',
    why: 'Convention: voice SSB uses LSB below 10 MHz and USB above (60 m is the exception, USB). On the wrong sideband speech is inverted and unintelligible.',
    how: 'Use the MODE buttons.',
    done: () => S.radio.mode === 'LSB' && bandOf(S.radio.freq)?.name === '40m', praise: 'LSB selected.' },
  { m: 'receiving', tab: 'radio', sel: '.rig-controls .ctl-group:nth-child(3)', title: 'Set the audio gain', ref: 'receiver-controls',
    text: 'Set <b>AF GAIN</b> to about half. Use headphones.',
    why: 'AF gain is volume only. A steady hiss is band noise — atmospheric and man-made — and sets the weakest signal you can hear.',
    how: 'Drag the AF GAIN slider in the AUDIO group.',
    done: () => S.radio.af >= 0.35, praise: 'Audio set.' },
  { m: 'receiving', tab: 'radio', sel: '.rig-right select', title: 'Use a coarse step to scan', ref: 'tuning-searching',
    text: 'Set the tuning step to <b>1 kHz</b> to move through the band quickly.',
    why: 'Search coarsely, then fine-tune. SSB stations are typically 3 kHz apart; a 1 kHz step lets you scan the phone segment quickly without skipping a station.',
    how: 'Use the step selector under the tuning knob.',
    done: () => S.radio.step === 1000, praise: 'Scanning step set.' },
  { m: 'receiving', tab: 'radio', sel: '.waterfall', title: 'Find and tune a station', ref: 'tuning-searching',
    text: 'Scan the phone segment (7.125–7.300 MHz) with the knob or wheel, or click a trace on the waterfall. Fine-tune until the voice sounds natural.',
    why: 'The waterfall shows signals across frequency (horizontal) and time (scrolling). Brightness is strength. A voice signal is a band about 2.4 kHz wide.',
    how: 'Click a bright vertical trace, then use a 10 Hz or 50 Hz step for the final adjustment.',
    done: () => S.flags?.heard, praise: 'Station received.' },
  { m: 'receiving', tab: 'radio', sel: '#filter-sel', title: 'Narrow the receive filter', ref: 'receiver-controls',
    text: 'Reduce the SSB filter to <b>2.1 kHz</b> or narrower.',
    why: 'Noise power is proportional to bandwidth: halving the bandwidth lowers the noise by 3 dB. Too narrow and speech becomes muffled.',
    how: 'Use the FILTER selector in the MODE group.',
    done: () => (S.radio.filter.LSB <= 2100 || S.radio.filter.USB <= 2100), praise: 'Filter narrowed.' },
  { m: 'receiving', tab: 'radio', sel: '.rbtn[data-mode="CW"]', title: 'Copy CW in the CW segment', ref: 'cw',
    text: 'Switch to <b>CW</b>, tune into the CW segment at the bottom of the band (below 7.060 MHz) and set the filter to <b>500 Hz</b> or narrower.',
    why: 'CW occupies under 200 Hz, so a 500 Hz filter keeps the signal and rejects most of the noise. Tune so the tone matches your sidetone pitch — that is zero-beat.',
    how: 'Mode CW, tune below 7.060, FILTER 500 Hz.',
    done: () => S.radio.mode === 'CW' && S.radio.freq < 7.06e6 && S.radio.freq >= 7e6 && S.radio.filter.CW <= 500, praise: 'Receiving CW with a narrow filter.' },
  { m: 'receiving', tab: 'radio', sel: '.rbtn.svc:nth-child(2)', title: 'Check propagation with WWV', ref: 'tuning-searching',
    text: 'Press <b>WWV</b> (General Coverage) and listen for the once-per-second ticks.',
    why: 'NIST station WWV (Fort Collins, CO) transmits on 2.5, 5, 10, 15, 20 and 25 MHz. Which of them you can hear tells you which frequencies are open from Colorado to you.',
    how: 'The WWV button is under GENERAL COVERAGE. Also try 5 and 15 MHz by typing them in.',
    done: () => S.flags?.wwv, praise: 'Reference signal received.' },
  { m: 'receiving', tab: 'radio', sel: '.rig-right input', title: 'Listen for the 20 m beacons', ref: 'band-by-band',
    text: 'Tune <b>14.100 MHz CW</b>. The NCDXF/IARU beacons transmit there in turn, every 10 seconds, around the world.',
    why: 'Beacons transmit known power from known locations. Hearing one tells you the path to that region is open on that band right now.',
    how: 'Type 14100 in the frequency field and press Enter, then select CW.',
    done: () => Math.abs(S.radio.freq - 14.1e6) < 600 && S.radio.mode === 'CW', praise: 'Monitoring the beacon frequency.' },

  // ---------------- Module 5: propagation
  { m: 'propagation', kind: 'read', title: 'How the ionosphere works', ref: 'ionosphere',
    text: 'Read <b>The ionosphere</b> in the reference library: layers, critical frequency, MUF and skip distance. Continue when you are done.' },
  { m: 'propagation', kind: 'quiz', title: 'Read the geomagnetic conditions', ref: 'solar',
    text: () => `The status bar shows the current <b>K-index: ${SUN.k}</b>. How would you describe the geomagnetic field?`,
    options: () => [['Quiet (K 0–2)', SUN.k <= 2], ['Unsettled to active (K 3–4)', SUN.k >= 3 && SUN.k <= 4], ['Storm (K 5 or more)', SUN.k >= 5]],
    explain: 'K is a 3-hour index of geomagnetic disturbance from 0 to 9. High K increases absorption, especially on paths that pass near the poles, and degrades HF; it can also bring aurora on VHF.' },
  { m: 'propagation', kind: 'quiz', title: 'Choose a band for right now', ref: 'band-by-band',
    text: 'Using the band-condition readout in the status bar (it uses the time of day at your location), which group of bands is in the best condition now?',
    options: () => { const best = bestBandGroup(); return ['80m-40m', '30m-20m', '17m-15m', '12m-10m'].map((g) => [g.replace('-', '–'), best.includes(g)]); },
    explain: 'By day the D layer absorbs the low bands and the higher MUF opens the high bands. At night absorption disappears and the MUF falls, so the low bands carry long distance and the high bands close.' },
  { m: 'propagation', kind: 'quiz', tab: 'radio', sel: '#map-panel', title: 'Use the live MUF', ref: 'ionosphere',
    text: () => { const q = mufAt(stateBy(S.op.state)); return `${q.live ? 'NOAA\'s live measurement' : 'The model'} puts the <b>MUF for a 3000 km hop</b> over your location at <b>${q.muf.toFixed(1)} MHz</b> right now (shown in the status bar and as the MUF layer on the map). Which is the <b>highest</b> band that can support a 3000 km contact from here?`; },
    options: () => { const m = mufAt(stateBy(S.op.state)).muf; const bands = [['80 m (3.5 MHz)', 3.5], ['40 m (7 MHz)', 7], ['20 m (14 MHz)', 14], ['15 m (21 MHz)', 21], ['10 m (28 MHz)', 28]]; const best = bands.filter(([, f]) => f < m).pop()?.[1] ?? 3.5; return bands.map(([l, f]) => [l, f === best]); },
    explain: 'Signals below the MUF are refracted back to Earth; above it they pass through the F2 layer into space. Operators work just below the MUF, where absorption is lowest — the classic rule is about 85% of the MUF (the "optimum working frequency").' },
  { m: 'propagation', kind: 'read', tab: 'radio', sel: '#map-panel', title: 'Study the propagation map', ref: 'greyline',
    text: 'On the Radio page, find the propagation map. Switch the live layers between MUF, foF2, TEC and absorption and compare them with the day/night terminator (the greyline). Then click a spot to see the path analysis: distance, bearing and the best band to that location.' },

  // ---------------- Module 6: licensing
  { m: 'license', tab: 'license', sel: '.exam-row button', title: 'Study 10 question-pool cards', ref: 'licensing',
    text: 'On the License page, press <b>Study</b> on the Technician row and answer 10 cards.',
    why: 'You need an FCC license to transmit. The Technician exam has 35 questions drawn from a public pool; 26 correct answers pass.',
    how: 'Each card shows the explanation after you answer.',
    done: () => Object.keys(S.study || {}).filter((k) => k.startsWith('T')).length >= 10, praise: 'Ten cards studied.' },
  { m: 'license', tab: 'license', sel: '.exam-row .btn.primary', title: 'Take the Technician examination', ref: 'licensing',
    text: 'Press <b>Take VE exam</b> on the Technician row.',
    why: 'Passing issues a callsign and Technician privileges: all amateur bands above 50 MHz and limited HF (CW on 80/40/15 m, CW and SSB on part of 10 m).',
    how: 'Answer all 35 questions, then hand in the answer sheet. You may retake it.',
    done: () => !!S.license, praise: 'Licensed. Your callsign is shown in the status bar.' },

  // ---------------- Module 7: first contact
  { m: 'qso', tab: 'radio', sel: '#finder', title: 'Find a station calling CQ', ref: 'qso',
    text: 'Use <b>Find: Voice CQ</b> (or CW CQ), or search the band yourself.',
    why: 'CQ means "calling any station". Answering a CQ is the simplest way to make a contact.',
    how: 'The Find bar is above the radio.',
    done: () => world.stations.some((x) => x.role === 'cq' && Math.abs(x.freq - S.radio.freq) < 300), praise: 'Station calling CQ located.' },
  { m: 'qso', tab: 'radio', sel: '.lf-call', title: 'Copy the callsign', ref: 'qso',
    text: 'Enter the station\'s <b>callsign</b> in the logger.',
    why: 'Copying the call correctly is the core operating skill: a wrong call means no contact in the other station\'s log.',
    how: 'Listen (or read the transcript) and type the callsign.',
    done: () => { const c = callField(); return c && world.stations.some((s) => s.call === c); }, praise: 'Callsign copied correctly.' },
  { m: 'qso', tab: 'radio', sel: '.macro:nth-child(4)', title: 'Call the station (F4)', ref: 'qso',
    text: 'Press <b>F4</b> to send your callsign (or hold Space and say it using phonetics).',
    why: 'Answer a CQ with your own callsign, once or twice, briefly.',
    how: 'F4 on the keyboard, or the F4 button in the logger.',
    done: () => world.stations.some((s) => s.pq && s.pq.stage === 'sentExch'), praise: 'They answered. Copy their report, name and location.' },
  { m: 'qso', tab: 'radio', sel: '.macro:nth-child(2)', title: 'Send your report (F2)', ref: 'qso',
    text: 'Enter their report, name and QTH in the logger, then press <b>F2</b>.',
    why: 'A basic exchange is signal report (RST), name and location. RST: readability 1–5, strength 1–9, tone 1–9 (CW only).',
    how: 'Fill in the fields, then F2.',
    done: () => [...world.records.values()].some((r) => r.complete), praise: 'Exchange complete.' },
  { m: 'qso', tab: 'radio', sel: '.logger .btn.primary', title: 'Sign and log the contact', ref: 'logging',
    text: 'Press <b>F3</b> (73) and then <b>Log QSO</b>.',
    why: 'Log date and time in UTC, frequency, mode, callsign and reports. Confirmed contacts count toward awards such as WAS and DXCC.',
    how: 'F3, then Log QSO (Ctrl+Enter).',
    done: () => S.log.some((q) => q.status === 'confirmed'), praise: 'First contact logged and confirmed.' },

  // ---------------- Module 8: VHF & repeaters
  { m: 'vhf', tab: 'radio', sel: '.rbtn[data-band="2m"]', title: 'Select 2 m FM', ref: 'repeaters',
    text: 'Select the <b>2m</b> band and <b>FM</b> mode.',
    why: '2 m (144–148 MHz) is the busiest local band. FM through repeaters gives reliable coverage over a whole region from a handheld or mobile.',
    how: 'Band 2m, then mode FM.',
    done: () => bandOf(S.radio.freq)?.name === '2m' && S.radio.mode === 'FM', praise: 'On 2 m FM.' },
  { m: 'vhf', tab: 'radio', sel: '.rig-right input', title: 'Tune the repeater output', ref: 'repeaters',
    text: 'Tune to the local repeater output, <b>146.940 MHz</b>.',
    why: 'You listen on the repeater\'s output frequency. Its input — where you transmit — is offset from it.',
    how: 'Type 146940 in the frequency field and press Enter.',
    done: () => Math.abs(S.radio.freq - 146.94e6) < 2500, praise: 'Listening to the repeater output.' },
  { m: 'vhf', tab: 'radio', sel: '.fm-only', title: 'Program offset and tone', ref: 'repeaters',
    text: 'Set <b>OFFSET −600 kHz</b> and <b>CTCSS 100.0 Hz</b>.',
    why: 'Standard 2 m offset is 600 kHz; above 147 MHz it is usually positive, below usually negative. The sub-audible CTCSS tone opens the repeater\'s receiver and rejects interference.',
    how: 'In the TRANSMIT group, choose the offset and the tone.',
    done: () => S.radio.rptOffset === -600000 && Math.abs(S.radio.toneHz - 100) < 0.05, praise: 'Repeater programmed.' },
  { m: 'vhf', tab: 'radio', sel: '.ptt', title: 'Access the repeater', ref: 'repeaters',
    text: 'Hold <b>Space</b> (push-to-talk) and identify: say your callsign, for example "<i>this is ... listening</i>".',
    why: 'Identify with your callsign at the start and at least every 10 minutes. Pause between transmissions so others can break in, and listen for the courtesy tone.',
    how: 'Hold Space or the PTT button, speak, then release to listen.',
    done: () => S.flags?.rpt, praise: 'Repeater accessed. Course complete.' },
];

const modOf = (s) => MODULES.find((m) => m.id === s.m);
const val = (v, ...a) => (typeof v === 'function' ? v(...a) : v);
export const trainingActive = () => S.mode === 'training' && T().step < STEPS.length;
export const progress = () => ({ done: Object.keys(T().done).length, total: STEPS.length });
export const moduleProgress = (id) => { const st = STEPS.filter((s) => s.m === id); return { done: st.filter((s) => T().done[STEPS.indexOf(s)]).length, total: st.length }; };

// ------------------------------------------------------------------ question & answer
const KB = [
  { k: ['swr', 'standing', 'mismatch', 'reflected'], t: 'SWR', a: 'SWR measures how closely the load matches the 50 Ω line. A mismatch reflects part of the power; the radio reduces output to protect itself and feedline loss rises. Under 2:1 is usually acceptable.', ref: 'swr' },
  { k: ['ground', 'grounding', 'bond', 'earth'], t: 'Grounding', a: 'Bond every chassis to one ground bus, and bond that to the lightning-protection ground. This keeps all equipment at the same potential and gives surges a path outside.', ref: 'grounding' },
  { k: ['fuse', 'polarity', 'reverse', 'red', 'black', 'blown'], t: 'DC power & polarity', a: 'Red to +, black to −. Reversed polarity blows the fuse in the DC lead. Always replace a fuse with the same rating.', ref: 'station-wiring' },
  { k: ['coax', 'feedline', 'cable', 'rg', 'lmr'], t: 'Feedline', a: 'Coax loss rises with frequency and length; thicker and foam-dielectric cables (RG-213, LMR-400) lose less. Mismatch adds further loss.', ref: 'feedlines' },
  { k: ['tuner', 'atu', 'match', 'matching'], t: 'Antenna tuner', a: 'A tuner transforms the impedance seen by the radio to 50 Ω. It does not change the antenna or remove the mismatch loss on the feedline.', ref: 'antenna-tuner' },
  { k: ['dipole', 'length', 'cut', '468', 'formula', 'wire'], t: 'Dipole length', a: 'L(ft) ≈ 468 ÷ f(MHz). For 7.150 MHz: 65.5 ft. Cut slightly long and trim.', ref: 'antenna-basics' },
  { k: ['trim', 'too long', 'too short', 'resonant', 'dip', 'resonance'], t: 'Trimming', a: 'Dip below the band: too long, shorten. Dip above: too short, lengthen. New length ≈ old length × f measured ÷ f wanted.', ref: 'dipole-build' },
  { k: ['reactance', 'impedance', 'r and x', 'jx'], t: 'Impedance', a: 'Z = R + jX. X > 0 (inductive): longer than resonant. X < 0 (capacitive): shorter. Resonance is where X = 0.', ref: 'antenna-analyzer' },
  { k: ['analyzer', 'sweep', 'curve'], t: 'Antenna analyzer', a: 'An analyzer sweeps frequency and shows SWR, R and X. Read the minimum for resonance and the 2:1 points for usable bandwidth.', ref: 'antenna-analyzer' },
  { k: ['vertical', 'radial', 'radials'], t: 'Verticals', a: 'A quarter-wave vertical (234 ÷ MHz ft) radiates at low angles but depends on its radial system; few radials mean high ground loss.', ref: 'verticals' },
  { k: ['height', 'high', 'tower', 'mast', 'nvis'], t: 'Height', a: 'Higher antennas (in wavelengths) radiate at lower angles for long distance. Below about 0.25 λ, radiation goes mostly upward (NVIS, 0–500 km).', ref: 'height-ground' },
  { k: ['band', 'which band', 'best band', 'open', 'propagation', 'night', 'day', 'muf'], t: 'Choosing a band', a: 'By day the higher bands (20–10 m) open for long distance; at night the lower bands (80–40 m). Check the band-condition readout, WWV and the beacons.', ref: 'band-by-band' },
  { k: ['lsb', 'usb', 'sideband'], t: 'Sidebands', a: 'LSB below 10 MHz, USB above (and on 60 m). The wrong sideband produces inverted, unintelligible speech.', ref: 'modes' },
  { k: ['cw', 'morse', 'code', 'paddle', 'zero beat'], t: 'CW', a: 'CW is a keyed carrier. Use a 250–500 Hz filter and tune so the tone matches your sidetone (zero beat).', ref: 'cw' },
  { k: ['search', 'scan', 'find', 'tune', 'tuning', 'step'], t: 'Searching a band', a: 'Pick a band for the time of day, set the correct mode, scan with a 1 kHz step, then fine-tune with 10–50 Hz. Use the waterfall to see where activity is.', ref: 'tuning-searching' },
  { k: ['cq', 'call', 'answer', 'contact', 'qso'], t: 'Making a contact', a: 'Listen first. Answer a CQ with your callsign; exchange report, name and location; sign with 73 and your callsign.', ref: 'qso' },
  { k: ['rst', 'report', '599', '59'], t: 'Signal reports', a: 'RST: Readability 1–5, Strength 1–9, Tone 1–9 (CW only).', ref: 'qso' },
  { k: ['log', 'logbook', 'qsl', 'adif'], t: 'Logging', a: 'Record UTC date/time, frequency, mode, callsign and reports. Export ADIF for logging services.', ref: 'logging' },
  { k: ['license', 'exam', 'technician', 'general', 'extra'], t: 'Licensing', a: 'Technician: 35 questions, 26 to pass. General: 35, 26 to pass. Extra: 50, 37 to pass.', ref: 'licensing' },
  { k: ['identify', 'id', '10 minutes', 'callsign'], t: 'Station identification', a: 'Identify at least every 10 minutes during a contact and at the end (47 CFR 97.119).', ref: 'licensing' },
  { k: ['privilege', 'privileges', 'blocked', 'segment', 'edge'], t: 'Privileges', a: 'Each license class has specific frequency segments and modes. Keep your whole signal inside the segment: SSB occupies about 3 kHz on one side of the dial frequency.', ref: 'bandplan' },
  { k: ['repeater', 'offset', 'tone', 'ctcss', 'pl'], t: 'Repeaters', a: '2 m offset is 600 kHz (70 cm: 5 MHz). Most repeaters need a CTCSS tone. Identify, keep transmissions short and pause between them.', ref: 'repeaters' },
  { k: ['squelch', 'filter', 'agc', 'rit', 'attenuator', 'noise blanker'], t: 'Receiver controls', a: 'Filter sets bandwidth; AGC holds output level steady; RIT shifts receive only; ATT reduces strong signals; squelch mutes the receiver until a signal arrives.', ref: 'receiver-controls' },
  { k: ['s-meter', 'meter', 's9'], t: 'S-meter', a: 'One S-unit is 6 dB. S9 is −73 dBm on HF.', ref: 'meters' },
  { k: ['k index', 'sfi', 'solar', 'sunspot', 'a index'], t: 'Solar indices', a: 'SFI tracks ionising radiation (higher is better for the high bands). A and K measure geomagnetic disturbance (lower is better).', ref: 'solar' },
  { k: ['greyline', 'grayline', 'terminator'], t: 'Greyline', a: 'Along the day/night terminator, D-layer absorption is low while the F layer is still ionised, which favours long-distance low-band paths.', ref: 'greyline' },
  { k: ['safety', 'rf exposure', 'mpe'], t: 'RF safety', a: 'Evaluate RF exposure for your power, frequency and antenna distance; keep antennas away from people; never work on energised equipment.', ref: 'rf-safety' },
  { k: ['dummy', 'dummy load'], t: 'Dummy load', a: 'A non-radiating 50 Ω resistor for testing a transmitter without putting a signal on the air.', ref: 'rf-path' },
];
export function ask(q) {
  const s = ` ${String(q).toLowerCase().replace(/[^a-z0-9\s-]/g, ' ')} `;
  let best = null, bs = 0;
  for (const e of KB) {
    let sc = 0;
    for (const k of e.k) if (s.includes(` ${k} `) || s.includes(` ${k}s `) || (k.length > 4 && s.includes(k))) sc += k.includes(' ') ? 3 : 2;
    if (sc > bs) { bs = sc; best = e; }
  }
  return best || { t: 'No match', a: 'Try a topic such as SWR, grounding, dipole length, reactance, which band, sidebands, searching a band, repeaters or the license exam. The reference library covers each in depth.', ref: null };
}

// ------------------------------------------------------------------ panel
let panel, feedEl, lastStep = -1;
const feed = [];
function say(html, kind = 'info') {
  feed.push({ html, kind });
  while (feed.length > 5) feed.shift();
  drawFeed();
}
function drawFeed() {
  if (!feedEl) return;
  feedEl.innerHTML = '';
  for (const m of feed) feedEl.append(h('div', { class: `cf cf-${m.kind}`, html: m.html }));
  feedEl.scrollTop = feedEl.scrollHeight;
}
export function highlight(tab, sel) {
  if (tab) goTab(tab);
  if (!sel) return;
  setTimeout(() => {
    const el = document.querySelector(sel);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('pulse-hl');
    setTimeout(() => el.classList.remove('pulse-hl'), 4500);
  }, 150);
}
const refLink = (id, label = 'Read in library') => (id ? h('button', { class: 'btn ghost small', onclick: () => bus.emit('library', id) }, h('span', { html: icon('book') }), label) : null);

export function goToStep(i) {
  const t = T();
  t.step = Math.max(0, Math.min(STEPS.length, i));
  delete t.marks[t.step];
  save(); render();
}

function render() {
  if (!panel) return;
  const t = T();
  panel.innerHTML = '';
  const on = S.mode === 'training';
  document.body.classList.toggle('coach-on', on && !t.min);
  panel.hidden = !on;
  if (!on) return;
  if (t.min) {
    panel.append(h('button', { class: 'coach-tab', title: 'Open the training guide', onclick: () => { t.min = false; save(); render(); } }, h('span', { html: icon('grad') }), h('span', {}, 'Guide')));
    return;
  }
  const s = STEPS[t.step];
  const p = progress();
  const head = h('div', { class: 'coach-head' },
    h('div', { class: 'coach-title' }, h('span', { html: icon('grad') }), h('b', {}, 'Training guide')),
    h('button', { class: 'icon-btn', title: 'Course overview', onclick: () => goTab('course'), html: icon('list') }),
    h('button', { class: 'icon-btn', title: 'Collapse', onclick: () => { t.min = true; save(); render(); }, html: icon('chevronRight') }));
  const prog = h('div', { class: 'coach-prog' }, h('div', { class: 'bar' }, h('span', { style: { width: `${(p.done / p.total) * 100}%` } })), h('span', { class: 'tiny muted' }, `${p.done} of ${p.total} steps`));
  let body;
  if (!s) {
    body = h('div', { class: 'coach-step' }, h('div', { class: 'eyebrow' }, 'Course complete'),
      h('h3', {}, 'You have completed the training course.'),
      h('p', { class: 'small' }, 'You wired a station, built and tuned an antenna, searched the bands, studied propagation, got licensed, made a contact and used a repeater. Switch to Simulation mode to design more advanced stations.'),
      h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: () => goToStep(0) }, 'Restart course'), h('button', { class: 'btn primary small', onclick: () => bus.emit('set-mode', 'simulation') }, 'Go to Simulation')));
  } else {
    const mod = modOf(s), inMod = STEPS.filter((x) => x.m === s.m), mi = MODULES.indexOf(mod);
    if (s.mark && t.marks[t.step] == null) { t.marks[t.step] = s.mark(); save(); }
    body = h('div', { class: 'coach-step' },
      h('div', { class: 'eyebrow' }, `Module ${mi + 1} · ${mod.title}`, h('span', { class: 'muted' }, ` — step ${inMod.indexOf(s) + 1} of ${inMod.length}`)),
      h('h3', {}, val(s.title)),
      h('div', { class: 'small step-text', html: val(s.text) }));
    if (s.kind === 'quiz') {
      const answered = t.answers[t.step];
      const opts = val(s.options);
      const box = h('div', { class: 'quiz' });
      opts.forEach(([label, ok], i) => box.append(h('button', { class: `quiz-opt ${answered != null ? (ok ? 'right' : answered === i ? 'wrong' : 'dim') : ''}`, disabled: answered != null, onclick: () => {
        t.answers[t.step] = i; save();
        if (ok) { say(`<b>Correct.</b> ${val(s.explain)}`, 'good'); audio.ready && audio.beep(1320, 0.05, 0.06); } else say(`<b>Not quite.</b> ${val(s.explain)}`, 'warn');
        render();
      } }, h('span', { class: 'qk' }, String.fromCharCode(65 + i)), label)));
      body.append(box);
      if (answered != null) body.append(h('div', { class: 'row' }, h('button', { class: 'btn primary small', onclick: () => complete(true) }, 'Continue', h('span', { html: icon('arrowRight') })), opts[answered]?.[1] ? null : h('button', { class: 'btn small', onclick: () => { delete t.answers[t.step]; save(); render(); } }, 'Try again')));
      if (s.sel) body.append(h('div', { class: 'row' }, h('button', { class: 'btn ghost small', onclick: () => highlight(s.tab, s.sel) }, h('span', { html: icon('target') }), 'Show me')));
    } else if (s.kind === 'read') {
      body.append(h('div', { class: 'row' }, refLink(s.ref, 'Open article'), s.sel ? h('button', { class: 'btn ghost small', onclick: () => highlight(s.tab, s.sel) }, h('span', { html: icon('target') }), 'Show me') : null,
        h('button', { class: 'btn primary small', onclick: () => complete(true) }, 'Continue', h('span', { html: icon('arrowRight') }))));
    } else {
      body.append(
        h('div', { class: 'row' },
          h('button', { class: 'btn primary small', onclick: () => highlight(s.tab, s.sel) }, h('span', { html: icon('target') }), 'Show me'),
          h('button', { class: 'btn small', onclick: () => say(`<b>Why it matters.</b> ${s.why}`, 'info') }, 'Why'),
          h('button', { class: 'btn small', onclick: () => say(`<b>How.</b> ${s.how}`, 'info') }, 'How')),
        h('div', { class: 'coach-detect tiny muted' }, h('span', { class: 'pulse-dot' }), 'Waiting for you to complete this step'));
    }
    body.append(h('div', { class: 'row coach-nav' },
      h('button', { class: 'link small', disabled: t.step === 0, onclick: () => goToStep(t.step - 1) }, 'Back'),
      s.ref ? refLink(s.ref) : null,
      h('span', { style: { flex: 1 } }),
      h('button', { class: 'link small', title: 'Skip this step', onclick: () => complete(false) }, 'Skip')));
  }
  const askIn = h('input', { class: 'coach-ask', placeholder: 'Ask a question, e.g. "what is reactance?"' });
  const doAsk = (q) => {
    if (!q.trim()) return;
    const a = ask(q);
    say(`<b>${a.t}.</b> ${a.a}${a.ref ? ` <button class="link ref-link" data-ref="${a.ref}">Read more</button>` : ''}`, 'info');
    askIn.value = '';
  };
  askIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') doAsk(askIn.value); e.stopPropagation(); });
  feedEl = h('div', { class: 'coach-feed' });
  panel.append(h('div', { class: 'coach-card' }, head, prog, body, feedEl,
    h('div', { class: 'coach-askrow' }, askIn, h('button', { class: 'icon-btn', title: 'Ask', onclick: () => doAsk(askIn.value), html: icon('search') }))));
  drawFeed();
}

function complete(byUser) {
  const t = T();
  if (t.step >= STEPS.length) return;
  if (byUser) t.done[t.step] = 1;
  t.step++;
  save(); render(); bus.emit('training-progress');
}

function check() {
  const t = T();
  if (!trainingActive()) { if (render.lastActive !== false) { render.lastActive = false; render(); } return; }
  render.lastActive = true;
  let advanced = 0;
  const praises = [];
  while (t.step < STEPS.length) {
    const s = STEPS[t.step];
    if (s.kind) break; // quizzes and readings need the user
    if (s.mark && t.marks[t.step] == null) { t.marks[t.step] = s.mark(); save(); }
    let ok = false;
    try { ok = !!s.done(t.marks[t.step]); } catch (e) { /* not ready */ }
    if (!ok) break;
    praises.push(s.praise);
    t.done[t.step] = 1; t.step++; advanced++;
  }
  if (advanced) {
    save();
    for (const pr of praises.slice(-2)) say(`<b>Step complete.</b> ${pr}`, 'good');
    audio.ready && audio.beep(1320, 0.05, 0.06);
    render(); bus.emit('training-progress');
  } else if (lastStep !== t.step) render();
  lastStep = t.step;
}

const MISTAKES = {
  connector: (msg) => `<b>Connection refused.</b> ${msg} Like connects to like: coax to coax, DC lead to a power terminal, GND to ground.`,
  fuse: () => '<b>Fuse blown.</b> The DC leads were reversed. Correct the polarity (red to +, black to −) and press Replace fuse. The fuse did its job: it interrupts excessive current.',
  'tx-blocked': (reason) => `<b>Transmission blocked.</b> ${reason}`,
  polarity: () => '<b>Polarity error.</b> That lead is on the wrong terminal. If you switch on like this the fuse will blow. Click the cable to remove it.',
  'cut-off': (len) => `<b>Check the length.</b> ${len} ft does not resonate on 40 m. 468 ÷ 7.15 ≈ 65.5 ft.`,
  'high-swr': (swr) => `<b>High SWR (${swr}:1).</b> The antenna is not matched on this frequency. Use a band it is cut for, or the tuner.`,
};

export function initTraining(el) {
  panel = el;
  T();
  render();
  setInterval(check, 800);
  bus.on('helper-mistake', (kind, info) => { if (S.mode !== 'training') return; const f = MISTAKES[kind]; if (f) { say(f(info), 'warn'); if (T().min) { T().min = false; save(); render(); } } });
  bus.on('helper-say', (html) => say(html, 'note'));
  bus.on('mode', render); bus.on('license', render);
  bus.on('training-goto', (i) => goToStep(i));
  panel.addEventListener('click', (e) => { const b = e.target.closest('.ref-link'); if (b) bus.emit('library', b.dataset.ref); });
  if (trainingActive() && T().step === 0 && !feed.length) say('Work through each step at your own pace. Steps are detected automatically as you complete them. Use <b>Show me</b> to locate a control and <b>Why</b> for the reasoning behind it.', 'info');
}

// ------------------------------------------------------------------ course overview page
export function initCourse(el) {
  const draw = () => {
    el.innerHTML = '';
    const t = T(), p = progress();
    el.append(h('div', { class: 'page-head' },
      h('div', {}, h('div', { class: 'eyebrow' }, 'Training'), h('h1', {}, 'Course overview'),
        h('p', { class: 'lead' }, 'A structured path from an empty desk to your first contact. Each module combines hands-on steps in the simulator with checkpoint questions and reference reading.')),
      h('div', { class: 'stat-tile' }, h('span', { class: 'tiny muted' }, 'Progress'), h('b', {}, `${Math.round((p.done / p.total) * 100)}%`), h('span', { class: 'tiny muted' }, `${p.done} / ${p.total} steps`))),
    S.mode !== 'training' ? h('div', { class: 'callout' }, 'You are in ', h('b', {}, S.mode === 'free' ? 'Free Play' : 'Simulation'), ' mode. Switch to Training to follow the guide alongside the simulator. ', h('button', { class: 'btn primary small', onclick: () => bus.emit('set-mode', 'training') }, 'Switch to Training')) : '');
    const grid = h('div', { class: 'module-grid' });
    MODULES.forEach((m, mi) => {
      const mp = moduleProgress(m.id);
      const first = STEPS.findIndex((s) => s.m === m.id);
      const current = STEPS[t.step]?.m === m.id;
      grid.append(h('div', { class: `module-card ${mp.done === mp.total ? 'complete' : ''} ${current ? 'current' : ''}` },
        h('div', { class: 'row spread' }, h('span', { class: 'mod-num' }, String(mi + 1).padStart(2, '0')), h('span', { class: 'tiny muted' }, `${mp.done}/${mp.total}`)),
        h('h3', {}, m.title), h('p', { class: 'small muted' }, m.blurb),
        h('div', { class: 'bar' }, h('span', { style: { width: `${(mp.done / mp.total) * 100}%` } })),
        h('ol', { class: 'mod-steps' }, ...STEPS.map((s, i) => [s, i]).filter(([s]) => s.m === m.id).map(([s, i]) => h('li', { class: `${t.done[i] ? 'done' : ''} ${i === t.step ? 'now' : ''}` },
          h('button', { class: 'link', onclick: () => { if (S.mode !== 'training') bus.emit('set-mode', 'training'); goToStep(i); highlight(s.tab, s.sel); } },
            h('span', { html: icon(t.done[i] ? 'checkCircle' : 'circle') }), val(s.title), s.kind ? h('span', { class: 'kind' }, s.kind === 'quiz' ? 'checkpoint' : 'reading') : null)))),
        h('div', { class: 'row' },
          h('button', { class: `btn ${current ? 'primary' : ''} small`, onclick: () => { if (S.mode !== 'training') bus.emit('set-mode', 'training'); goToStep(first + Math.max(0, STEPS.slice(first).findIndex((s, k) => s.m === m.id && !t.done[first + k]))); const s = STEPS[T().step]; if (s) highlight(s.tab, s.sel); } }, current ? 'Continue' : mp.done ? 'Resume' : 'Start'),
          ...m.refs.slice(0, 2).map((r) => h('button', { class: 'btn ghost small', onclick: () => bus.emit('library', r) }, h('span', { html: icon('book') }), 'Read')))));
    });
    el.append(grid);
  };
  draw();
  bus.on('training-progress', () => { if (!el.hidden) draw(); });
  bus.on('mode', draw);
  bus.on('tab', (t) => { if (t === 'course') draw(); });
}
