// Helper channels: the simulator's own guide stations, one for each kind of radio traffic.
// Each one repeats a short spoken briefing (who uses this band, why, when it works, what you
// need to hear it or use it for real, and what the exam asks about it). The same information
// is shown in writing by the "Where you are" panel (whereami.js). They are clearly labelled
// as simulator stations: none of them exists on the air.
import { now } from './util.js';
import { BANDS, SEGMENTS } from './data/bandplan.js';
import { ALLOC, HAM, gearFor } from './data/spectrum.js';

const M = 1e6;
const mhz = (hz) => (hz / M).toFixed(3);
const allocAt = (hz) => ALLOC.filter((a) => hz >= a.lo && hz <= a.hi).sort((x, y) => (x.hi - x.lo) - (y.hi - y.lo))[0];

// The sub-band a licence class may use for a kind of emission, read from the same table the
// transmitter checks, so the advice here can never disagree with the simulator's rules.
function segText(band, lic, allow) {
  const segs = SEGMENTS.filter((s) => s.lic.includes(lic) && s.hi > band.lo && s.lo < band.hi && (allow === 'ALL' ? s.allow === 'ALL' : true));
  if (!segs.length) return null;
  const lo = Math.min(...segs.map((s) => s.lo)), hi = Math.max(...segs.map((s) => s.hi));
  return `${mhz(lo)} to ${mhz(hi)} MHz`;
}

const HF_EXAM = {
  '160m': ['Signals this low need darkness: the D layer absorbs them in daylight.', 'The legal limit is 1,500 W PEP, and you must always use the minimum power that makes the contact.'],
  '80m': ['Voice below 10 MHz is lower sideband by convention.', 'Daytime absorption in the D layer is why 80 m is a night band.'],
  '40m': ['Voice below 10 MHz is lower sideband by convention.', 'The skip zone is the ring between the end of your ground wave and the first sky-wave return, where nobody hears you.'],
  '20m': ['Voice on 14 MHz and above is upper sideband by convention.', 'The F2 layer is responsible for the longest hops, because it is the highest.', 'An SSB voice signal is about 3 kHz wide, so keep the dial 3 kHz inside the band edge.'],
  '17m': ['30 m, 17 m and 12 m are the bands where contests are not held, by agreement.', 'Voice on 14 MHz and above is upper sideband by convention.'],
  '15m': ['The higher the solar flux, the higher the maximum usable frequency, and the better 15 m gets.', 'Technicians may send Morse here but not voice.'],
  '12m': ['30 m, 17 m and 12 m are the bands where contests are not held, by agreement.', 'It opens when the maximum usable frequency climbs above 25 MHz.'],
  '10m': ['Technicians may use SSB voice only from 28.300 to 28.500 MHz, with at most 200 W PEP.', 'Technicians may also use CW and data from 28.000 to 28.300 MHz.', 'Sporadic E brings strong short-skip signals in late spring and summer.'],
  '6m': ['50.0 to 50.1 MHz is CW only.', 'Technicians have every amateur privilege above 30 MHz.', 'Sporadic E is the usual cause of long-distance contacts on 6 m.'],
};

function hfHelper(name, f) {
  const b = BANDS.find((x) => x.name === name);
  const sb = f < 10 * M ? 'LSB' : 'USB';
  const len = Math.round(468 / (f / M));
  const g = segText(b, 'G', 'ALL'), t = segText(b, 'T', 'ALL'), tAny = segText(b, 'T');
  const exam = [...HF_EXAM[name]];
  if (g) exam.unshift(`General class voice on ${name}: ${g}.`);
  exam.push(t ? `Technician voice on ${name}: ${t}.` : tAny ? `Technicians may transmit on ${name} only in ${tAny}, and only in the modes allowed there.` : `Technicians have no privileges on ${name}; it takes a General licence.`);
  exam.push('Give your callsign at least every ten minutes and at the end of every contact.');
  return {
    id: `ham-${name}`, key: name, f, mode: 'SSB', sb, band: name, title: `the ${name.replace('m', ' metre')} amateur band`,
    purpose: HAM[name].why, when: HAM[name].when,
    who: 'Licensed radio amateurs, talking to each other for its own sake: casual contacts, long-distance chasing, contests, nets and emergency practice. No business, no broadcasting, no music.',
    hardware: [
      'An HF transceiver (100 W is standard) and a 13.8 V supply rated for at least 20 A.',
      `An antenna for this band. A half-wave dipole is about ${len} ft of wire (468 divided by ${(f / M).toFixed(1)} MHz), fed at the centre with 50 ohm coax.`,
      'An SWR meter to check the match, and an antenna tuner if the antenna is not cut for this band.',
      'A microphone for voice, a key for Morse, or a computer and USB sound interface for FT8.',
      'A ground bus bonding every chassis, and a lightning arrestor where the coax enters the building.',
    ],
    build: 'Wire all of this on the Station wiring page and cut the antenna on the Antenna page.',
    exam,
  };
}

const NOT_HAM = 'The only time a ham may transmit outside the amateur bands is when life or property is in immediate danger and no other communication is available.';

export const HELPERS = [
  hfHelper('160m', 1.9 * M), hfHelper('80m', 3.85 * M), hfHelper('40m', 7.26 * M), hfHelper('20m', 14.28 * M), hfHelper('17m', 18.15 * M),
  hfHelper('15m', 21.35 * M), hfHelper('12m', 24.96 * M), hfHelper('10m', 28.45 * M), hfHelper('6m', 50.2 * M),
  { id: 'ham-2m', key: '2m', band: '2m', f: 147 * M, mode: 'FM', sb: 'FM', title: 'the 2 metre amateur band and its repeaters',
    purpose: HAM['2m'].why, when: HAM['2m'].when,
    who: 'Local hams: commuters, club members, storm spotters and emergency teams, mostly through repeaters. Also APRS position packets on 144.390 and the space station on 145.800.',
    hardware: [
      'A 5 W handheld (from about $30) or a 50 W mobile radio with a 13.8 V supply.',
      'A quarter-wave vertical antenna, 19 inches long (234 divided by 146 MHz, in feet). Height matters more than power: a roof antenna beats ten times the watts.',
      'For each repeater, program three things: the output frequency, the offset (plus or minus 600 kHz on 2 m) and the CTCSS tone.',
    ],
    build: 'Try it: Find bar, Repeater. Or switch to the Handheld view at the top of the screen.',
    exam: ['The standard repeater offset is 600 kHz on 2 m and 5 MHz on 70 cm.', 'A CTCSS tone is a sub-audible tone sent with your voice to open the repeater\'s receiver.', 'The national simplex calling frequency is 146.520 MHz.', 'Technicians have every amateur privilege above 30 MHz.', '144.0 to 144.1 MHz is CW only.', 'VHF travels a little beyond the visible horizon because the atmosphere bends it slightly.', 'FM repeaters use vertical polarisation; weak-signal SSB uses horizontal.', 'Give your callsign every ten minutes and at the end of the contact.'] },
  { id: 'am', key: 'MW', def: true, f: 1.7 * M, mode: 'AM', sb: 'AM', title: 'the A M broadcast band',
    hardware: ['Any AM radio. No licence, no antenna to connect.', 'To hear distant stations at night, a tuned loop antenna beside the radio, turned to null out the local station on the same channel.'],
    exam: ['An AM signal is a carrier plus two sidebands, and is twice as wide as the audio it carries.', 'Amateurs may never broadcast to the public or transmit music.', 'If a neighbour\'s AM radio picks up your ham station, the usual cause is that the receiver is overloaded by your strong signal, not that your transmitter is faulty.'] },
  { id: 'swl', key: 'SW', def: true, f: 6.1 * M, mode: 'AM', sb: 'AM', title: 'shortwave listening',
    hardware: ['A shortwave portable receiver. One with SSB also hears hams, aircraft and ships.', 'Twenty to thirty feet of wire out of a window, clipped to the whip antenna.', 'A spot away from phone chargers, LED lamps and routers, which bury shortwave in noise.', 'No transmitter and no licence.'],
    exam: ['The ionosphere reflects frequencies below the maximum usable frequency and lets higher ones escape to space.', 'The D layer absorbs lower frequencies in daylight; that is why low bands are for night and high bands for day.', 'A higher solar flux index means better conditions on the higher bands; a high K index means a disturbed, poor band.', 'WWV on 5, 10 and 15 MHz is a quick check of which frequencies are open.'] },
  { id: 'cb', key: 'SW', al: ['CB radio'], f: 27.205 * M, mode: 'AM', sb: 'AM', title: 'C B radio',
    hardware: ['A certified CB radio: 4 W, 40 channels, run from 12 V in a vehicle. No licence.', 'An antenna, which matters more than the radio. A full quarter-wave whip is 102 inches; shorter ones use a loading coil.', 'An SWR meter. Adjust the antenna length until SWR is under 2 to 1 on channels 1 and 40.'],
    exam: ['CB is the 11 metre band and is not an amateur band: a ham licence gives no extra rights there, and a ham transceiver may not be used on it.', 'A quarter-wave vertical is 234 divided by the frequency in megahertz, in feet.', 'High SWR means power is being reflected by a mismatched antenna.', NOT_HAM] },
  { id: 'air', key: 'AIR', def: true, f: 123.3 * M, mode: 'AM', sb: 'AM', title: 'the aviation band',
    hardware: ['A scanner or handheld receiver that covers 118 to 137 MHz in AM. Many ham handhelds do.', 'A vertical antenna about 23 inches long, a quarter wave at 125 MHz, with a view of the sky.', 'No transmitter. Listening needs no licence.', 'Look up your local airport\'s tower, ground and ATIS frequencies in a chart or online directory.'],
    exam: ['Causing interference to aviation or any safety service is the most serious offence an amateur can commit; a transmitter\'s harmonics and spurious signals must be kept out of these bands.', 'A low-pass filter at the transmitter reduces harmonics.', NOT_HAM] },
  { id: 'scan', key: 'VHF', def: true, f: 155.1 * M, mode: 'FM', sb: 'FM', title: 'fire, police, ambulance and business radio',
    hardware: ['An analog scanner or a wide-receive handheld for conventional FM channels.', 'A digital trunking scanner, or an SDR dongle with decoding software, where agencies use P25 or DMR. Nothing may be used to decode encrypted traffic.', 'A discone or other wideband antenna, outdoors and high if you can.', 'An online frequency database for your county, because every agency is licensed on different channels.'],
    exam: ['Squelch mutes the receiver when no signal is present.', 'DMR puts two digital voice conversations on one 12.5 kHz channel by taking turns in time slots.', 'An FM voice signal with 5 kHz deviation is between 10 and 15 kHz wide.', 'On FM the strongest signal captures the receiver and the weaker one is not heard at all.', NOT_HAM] },
  { id: 'sea', key: 'VHF', al: ['Marine VHF', 'Marine coast stations and AIS'], f: 156.425 * M, mode: 'FM', sb: 'FM', title: 'marine V H F',
    hardware: ['On a boat: a fixed 25 W marine VHF radio wired to the 12 V battery and to the GPS, so the red distress button sends your position.', 'An antenna as high as possible, ideally at the masthead: range over water is set by height.', 'A 5 W waterproof handheld as a backup.', 'On land: any scanner or wide-receive handheld, to listen only.'],
    exam: ['VHF range is roughly line of sight, so raising the antenna extends it.', 'Mayday is the voice distress call; it has absolute priority on every service.', 'A ham radio may not be used on marine channels, except in a real emergency with no other means.'] },
  { id: 'rail', key: 'VHF', al: ['Railroad'], f: 161.1 * M, mode: 'FM', sb: 'FM', title: 'railroad radio',
    hardware: ['Any scanner, or a 2 metre handheld that also receives 160 to 162 MHz.', 'A quarter-wave antenna cut for 161 MHz, about 18 inches, placed outdoors or in a window facing the track.', 'A list of the channels your local railroad uses. Listen only.'],
    exam: ['Simplex means both stations transmit and receive on the same frequency, with no repeater.', 'Squelch mutes the receiver when no signal is present.', NOT_HAM] },
  { id: 'frs', key: 'UHF', al: ['FRS and GMRS (walkie-talkies)'], f: 462.6 * M, mode: 'FM', sb: 'FM', title: 'F R S and G M R S walkie-talkies',
    hardware: ['FRS: nothing to connect. Buy two FRS handhelds; the antenna is fixed by law. No licence.', 'GMRS: a $35 licence with no exam, then a handheld, or a 50 W mobile with a roof antenna, and access to local GMRS repeaters.', 'Set every radio in the group to the same channel and the same privacy tone. The tone hides other users from you; it does not make you private.'],
    exam: ['UHF gets through buildings better than VHF because its shorter wavelength passes through windows and gaps more easily.', 'FRS and GMRS are not amateur services. A ham handheld is not certified for them and a ham licence does not cover them.', 'A CTCSS tone only opens a squelch. Anyone without the tone still hears everything.'] },
  { id: 'biz', key: 'UHF', def: true, f: 464.5 * M, mode: 'FM', sb: 'FM', title: 'U H F business and city radio',
    hardware: ['A scanner or wide-receive handheld to listen. Digital systems need a digital scanner.', 'To use radios in your own business you need an FCC Part 90 licence, obtained through a frequency coordinator, and certified business radios.'],
    exam: ['Amateur radio may never be used for business: no communications in which you have a financial interest.', 'DMR puts two digital voice conversations on one 12.5 kHz channel by taking turns in time slots.', NOT_HAM] },
];

for (const hp of HELPERS) {
  hp.label = hp.title.replace(/\b([A-Z]) (?=[A-Z]\b)/g, '$1'); // the title is spelled out for the speech synthesiser
  if (hp.band) continue;
  const a = allocAt(hp.f);
  hp.alloc = a;
  hp.purpose ||= a.why; hp.who ||= a.who; hp.when ||= a.when || (hp.f < 30 * M ? null : 'Line of sight: the same by day and by night.');
}

export const helperAt = (hz) => HELPERS.find((x) => Math.abs(x.f - hz) < (x.mode === 'SSB' ? 1500 : 5000)) || null;
// The helper that explains wherever the dial is: by amateur band, else by service.
export function helperFor(hz, bandName, regionName) {
  if (bandName) return HELPERS.find((x) => x.key === bandName) || null;
  const a = allocAt(hz);
  const inReg = HELPERS.filter((x) => x.key === regionName);
  return inReg.find((x) => a && x.al?.includes(a.name)) || inReg.find((x) => x.def) || null;
}

// What the helper says, one sentence per transmission.
export function helperScript(hp) {
  const a = hp.alloc;
  const tx = hp.band ? 'To transmit here in real life you need an F C C amateur licence. The exam is thirty-five multiple-choice questions, with no Morse code.' : `Can you transmit here in real life? ${a.tx[1]}`;
  return [
    `This is the simulator's helper channel for ${hp.title}. It is not a real station.`,
    `Who is here. ${hp.who}`,
    `Why this band. ${hp.purpose}`,
    hp.when ? `When it works. ${hp.when}` : null,
    `What you need. ${hp.hardware.join(' ')}`,
    hp.band ? null : `To listen for real. ${gearFor(hp.f, hp.mode)}`,
    tx,
    `For the exam. ${hp.exam.join(' ')}`,
    'All of this is written in the panel above the radio. The helper channel now repeats.',
  ].filter(Boolean);
}

// Stations for a band or service region. mk builds a Station; pos is a point near the player.
export function helperStations(key, mk, pos) {
  return HELPERS.filter((x) => x.key === key).map((hp) => {
    const st = mk({
      op: { call: 'HELPER', name: 'Helper channel', ...pos, qth: 'simulator', cont: 'NA', zone: 4, lang: 'en-US' },
      mode: hp.mode, sb: hp.sb, freq: hp.f, band: key, role: 'helper', helper: hp, fixedDbm: -65, powerDbm: 50, antGain: 0, timer: 2,
    });
    st.seed = 7; st.rate = 1; st.pitch = 1; st.qsb.depth = 0;
    return st;
  });
}

export function behaveHelper(st) {
  if (st.busy || now() < (st.pause || 0)) return;
  st.script ||= helperScript(st.helper);
  st.line = (st.line ?? -1) + 1;
  if (st.line >= st.script.length) { st.line = -1; st.pause = now() + 8; return; }
  const text = st.script[st.line];
  st.send(text, text.replace(/\bMHz\b/g, 'megahertz').replace(/\bkHz\b/g, 'kilohertz').replace(/(\d) W\b/g, '$1 watts').replace(/(\d) ft\b/g, '$1 feet'));
  st.pause = now() + 0.6;
}
