// "Elmer" = a ham radio mentor. Contextual lessons that pop up as you play,
// each tied to a topic you'll see on the license exams.
import { S, save, addXp } from './state.js';
import { toast, bus } from './util.js';

export const TIPS = {
  welcome: ['Welcome to the shack!', 'You start as a <b>shortwave listener (SWL)</b>. Anyone may listen — but to transmit you need an FCC license. Earn your <b>Technician</b> license on the License tab. Meanwhile: wire up the rig, build an antenna, and listen!', 'T1'],
  psu_polarity: ['Polarity matters', 'Red = positive (+), black = negative (−). Reversing DC polarity on a radio blows the fuse (or worse). Fuses protect against <b>excessive current</b> — never replace one with a larger rating.', 'T0A'],
  fuse_blown: ['POP! Fuse blown', 'Reversed polarity tripped the inline fuse. Fix the wiring, then replace the fuse with one of the <b>same rating</b>. A fuse protects against overcurrent and fire.', 'T0A'],
  grounding: ['Bond everything', 'Bond all station equipment to a common ground bus and to the lightning arrestor/ground rod. This reduces RF "bite" and is key for lightning protection: <b>all ground rods/connections must be bonded together</b>.', 'T0A'],
  arrestor: ['Lightning protection', 'The feedline should pass through a <b>grounded lightning arrestor</b> where it enters the building. Mount it on a grounded panel near where the feedline enters.', 'T0A'],
  dummy_load: ['Dummy load', 'A <b>dummy load</b> is a non-radiating resistor that lets you test your transmitter without putting a signal on the air. It presents a perfect 50 Ω (SWR 1:1).', 'T7C'],
  no_antenna: ['Never transmit without a load!', 'Keying up with nothing connected (infinite SWR) can damage the transmitter\'s final amplifier. Modern rigs fold back power to protect themselves.', 'T7C'],
  cut_wire: ['Measure twice, cut once', 'A half-wave dipole is about <b>468 / f(MHz)</b> feet long. A quarter-wave vertical is about <b>234 / f(MHz)</b>. Cut it a little long — it\'s easy to trim, hard to add wire back!', 'T9A'],
  antenna_up: ['Check SWR', 'SWR (standing wave ratio) tells you how well the antenna\'s impedance matches your 50 Ω feedline. <b>1:1 is perfect</b>; most rigs are happy below 2:1. Use the antenna analyzer, then the ATU for the rest.', 'T7C'],
  swr_high: ['High SWR', 'High SWR means an impedance <b>mismatch</b>. Power is reflected, the rig folds back output, and feedline loss increases. Fix the antenna length or use an antenna tuner (matching network).', 'T7C'],
  atu: ['Antenna tuner (ATU)', 'A tuner <b>matches the transmitter to the antenna system impedance</b>. It does NOT make a bad antenna radiate better — feedline loss on the coax still happens on the antenna side of the tuner.', 'T9B'],
  first_listen: ['Listening is the first skill', 'Tune slowly. On SSB, adjust until the voice sounds natural. On CW, tune so the tone matches your sidetone pitch (~600 Hz) — that\'s <b>zero beat</b>.', 'T2B'],
  sideband: ['Which sideband?', 'By convention, voice SSB uses <b>LSB below 10 MHz</b> (160/80/40 m) and <b>USB above</b> (20 m and up, plus VHF). Wrong sideband = "Donald Duck" garble.', 'G2A'],
  privileges: ['Know your privileges', 'Each license class has specific frequency segments and modes. Technicians get CW on 80/40/15 m, CW/data/phone on 10 m (28.3–28.5 MHz phone), and full privileges on 6 m and up.', 'T1B'],
  band_edge: ['Watch the band edge', 'Your dial frequency isn\'t your whole signal! USB extends ~3 kHz <b>above</b> the dial, LSB ~3 kHz <b>below</b>. Stay at least 3 kHz inside your sub-band edge.', 'G1B'],
  id_rule: ['Identify!', 'You must give your callsign <b>at least every 10 minutes</b> during a contact and <b>at the end</b> of the communication. (FCC §97.119)', 'T1F'],
  rst: ['RST reports', 'Signal reports are <b>R</b>eadability (1–5), <b>S</b>trength (1–9), <b>T</b>one (1–9, CW only). "599" = perfect. In contests it\'s sent as "5NN" (cut numbers).', 'T2B'],
  phonetics: ['Use phonetics', 'On voice, spell callsigns with the ITU phonetic alphabet: Kilo, Delta, Nine... It prevents confusion between letters like B, D, E, P, T, V.', 'T2B'],
  cq: ['Calling CQ', 'CQ means "calling any station." Listen first and ask "Is this frequency in use?" (or QRL? on CW) before calling CQ.', 'T2B'],
  repeater: ['Repeaters', 'A repeater receives on one frequency and simultaneously retransmits on another. On 2 m the standard <b>offset is ±600 kHz</b>. Many need a <b>CTCSS (PL) tone</b> — a sub-audible tone — to open.', 'T2A'],
  repeater_no_tone: ['Repeater did not open', 'Your transmission didn\'t key the repeater. Check: correct offset direction (−/+ 600 kHz) and the right CTCSS tone. Repeater listings show both.', 'T2B'],
  propagation_day: ['The ionosphere', 'HF signals travel long distances by refracting off the ionosphere (F layer). During the day, the <b>D layer absorbs</b> low frequencies — 80/160 m are short-range by day, and come alive at night.', 'T3C'],
  muf: ['Maximum Usable Frequency', 'The MUF is the highest frequency that will refract back to Earth for a given path. Higher bands (15/10 m) open when the sun is up and the solar flux is high, then close at night.', 'G3B'],
  skip: ['Skip zone', 'Higher HF frequencies often skip right over nearby stations — the <b>skip zone</b> — so you hear far-away stations but not ones 200 miles away.', 'G3B'],
  kindex: ['K-index & solar flux', 'The <b>Solar Flux Index</b> (10.7 cm radio flux) tracks how ionized the upper atmosphere is — higher is better for HF. The <b>K-index</b> measures short-term geomagnetic disturbance — higher is worse.', 'G3A'],
  nvis: ['Low antennas & NVIS', 'A dipole under ~¼ wavelength high radiates mostly straight up — great for regional (NVIS) contacts on 80/40 m, poor for DX. Get it higher for DX!', 'G9B'],
  vertical_radials: ['Radials matter', 'A ground-mounted vertical needs radials. With few radials, ground loss resistance adds to the 36 Ω radiation resistance — SWR may look better, but efficiency goes down.', 'G9B'],
  feedline_loss: ['Feedline loss', 'Coax loss increases with frequency and with SWR. On VHF, use low-loss coax (LMR-400, hardline). Thin RG-58 eats your signal.', 'T9B'],
  contest: ['Contesting', 'In a contest, keep it short: send only the required exchange. Running = calling CQ on a frequency; Search & Pounce (S&P) = tuning around answering others.', 'G2D'],
  dupe: ['Dupes', 'A "dupe" is a repeated contact with a station already worked on that band/mode. It scores nothing. The logger warns you.', 'G2D'],
  exchange_both: ['Send call + exchange', 'When you pick a caller out of a pileup, send <b>their call AND your exchange</b> together: "W1ABC 5NN 04". It confirms you copied them correctly.', 'G2D'],
  wpm_qrs: ['QRS', 'If someone is sending too fast, send "QRS" (send slower). Most ops will slow down for you. QRQ = send faster.', 'T2B'],
  qcodes: ['Q signals', 'QRM = interference from other stations, QRN = atmospheric noise (static crashes), QSB = fading, QSY = change frequency, QTH = location, QRZ? = who is calling me?', 'T2B'],
  zero_beat: ['Zero-beat the station', 'When answering a CW station, put your signal right on their frequency (zero beat). If you\'re off by more than ~150 Hz they may not hear you through a narrow filter.', 'G2C'],
  tech_hf: ['Technicians on HF', 'Technicians have voice privileges on 10 m (28.300–28.500 MHz) and CW on 80/40/15/10 m. When 10 m is open (high solar flux, daytime) you can work the world!', 'T1B'],
  tx_offband: ['FCC violation!', 'You transmitted outside your privileges. The FCC can issue warnings and fines. Official Observers volunteer to send friendly notices about such mistakes.', 'T1D'],
  power_min: ['Use minimum power', 'FCC rules: use the <b>minimum power necessary</b> to carry out the communication. (§97.313)', 'T1E'],
  exam_pass: ['Licensed!', 'Congratulations! Your new callsign is now in the FCC database (in game). Volunteer Examiners (VEs) give the real exams — usually 35 questions; 26 correct to pass.', 'T1'],
  beacon: ['Beacons', 'The NCDXF beacon network transmits on 14.100, 18.110, 21.150, 24.930 and 28.200 MHz — each beacon sends its call then four 1-second dashes at 100 W, 10 W, 1 W and 0.1 W. Use them to check propagation!', 'G3C'],
  cw_decoder: ['CW decoders', 'The decoder is a crutch that fails on weak or fading signals. Learning to copy by ear is a superpower — there\'s no Morse requirement for any license, but CW gets through when voice can\'t.', 'T8D'],
  ptt_voice: ['Push-to-talk', 'Hold SPACE (or the PTT button) to transmit, just like game voice chat. Speak clearly, use phonetics, and release to listen. If your browser supports speech recognition, the stations will understand you!', 'T2B'],
  yagi: ['Point the beam', 'A Yagi has gain in one direction. Point it using the short-path bearing to the station. Its front-to-back ratio rejects signals from behind.', 'G9C'],
  polarization: ['Polarization', 'VHF FM and repeaters use <b>vertical</b> polarization. A horizontal antenna on FM loses a lot of signal (cross-polarization). SSB/CW on VHF traditionally uses horizontal.', 'T3A'],
};

const queue = [];
let busyUntil = 0;
export function elmer(id, force = false) {
  const t = TIPS[id];
  if (!t) return;
  const seen = S.tips.includes(id);
  if (seen && !force) return;
  if (queue.includes(id)) return;
  if (!seen) { S.tips.push(id); save(); addXp(5, 'lesson'); }
  const nowMs = Date.now();
  if (nowMs < busyUntil) {
    queue.push(id);
    setTimeout(() => { queue.splice(queue.indexOf(id), 1); show(id); }, busyUntil - nowMs);
    busyUntil += 7000;
    return;
  }
  busyUntil = nowMs + 7000;
  show(id);
}
function show(id) {
  const t = TIPS[id];
  // When the Elmer panel is open, lessons go into its feed instead of a pop-up.
  if (S.helper?.on !== false && !S.helper?.min && !document.body.classList.contains('ht-view') && document.getElementById('elmer')) {
    bus.emit('helper-say', `📘 <b>${t[0]}</b> — ${t[1]} <span class="exam-ref">(exam topic ${t[2]})</span>`);
    bus.emit('tip', id);
    return;
  }
  toast(`<div class="elmer"><span class="elmer-ic">🧓</span><div><b>Elmer: ${t[0]}</b><br>${t[1]}<div class="exam-ref">📘 Exam topic ${t[2]}</div></div></div>`, 'elmer', 14000);
  bus.emit('tip', id);
}
