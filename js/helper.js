// Elmer, your on-screen mentor: a step-by-step tutorial for Career mode that notices
// when you get things right, explains mistakes kindly, and answers "why?" and "how?".
import { S, save, addXp } from './state.js';
import { h, $, bus, toast } from './util.js';
import { rigStatus, isConnected } from './shack.js';
import { world } from './world.js';
import { bandOf } from './data/bandplan.js';
import { system } from './antenna.js';
import { audio } from './audio.js';

const H = () => (S.helper ||= { on: true, tutorial: true, step: 0, min: false });
const goTab = (t) => bus.emit('goto', t);
const anyConn = (port) => S.shack.conn.some((c) => c.includes(port));
const callField = () => (document.querySelector('.lf-call')?.value || '').trim();

// ------------------------------------------------------------------ the tutorial
const STEPS = [
  // Chapter 1 — wire the shack
  { ch: 'Wire the shack', tab: 'shack', sel: '[data-port="rig_red"]', title: 'Connect the red power lead',
    text: 'Click the radio\'s <b>red DC lead</b> (bottom-left of the radio), then click the <b>red + post</b> on the power supply.',
    why: 'Your radio runs on 13.8 V DC from the power supply. Red is always positive (+). Getting polarity right is the first rule of DC wiring — reverse it and the fuse blows (or worse).',
    how: 'Click the small grey "+" circle labelled "DC red" under the radio. It turns yellow. Now click the red "+" post near the top of the power supply. A red cable appears.',
    done: () => isConnected('rig_red', 'psu_pos'), praise: 'Red to positive — perfect. That\'s the #1 rule of DC wiring.' },
  { ch: 'Wire the shack', tab: 'shack', sel: '[data-port="rig_blk"]', title: 'Connect the black power lead',
    text: 'Now the <b>black lead</b> ("DC blk") to the black <b>− post</b> on the power supply.',
    why: 'Black is negative (−), the return path. Both leads are fused on a real radio so a short can\'t start a fire.',
    how: 'Click "DC blk" under the radio, then the black "−" post next to the red one on the power supply.',
    done: () => isConnected('rig_blk', 'psu_neg'), praise: 'Black to negative. Power wiring done — exactly right.' },
  { ch: 'Wire the shack', tab: 'shack', sel: '[data-port="rig_ant"]', title: 'Run coax to the SWR meter',
    text: 'Connect the radio\'s <b>ANT</b> jack to the SWR meter\'s <b>TX</b> jack.',
    why: 'Coax carries the radio-frequency signal. The SWR/watt meter shows your output power and how well the antenna is matched — you\'ll use it every time you tune up.',
    how: 'Click "ANT" on the back-right of the radio, then "TX" on the left of the SWR / watt meter.',
    done: () => isConnected('rig_ant', 'swr_tx'), praise: 'Nice — the meter now sees everything your radio sends.' },
  { ch: 'Wire the shack', tab: 'shack', sel: '[data-port="swr_ant"]', title: 'Meter to the antenna tuner',
    text: 'Connect the meter\'s <b>ANT</b> jack to the tuner\'s <b>TX IN</b>.',
    why: 'An antenna tuner matches your antenna\'s impedance to the 50 Ω your radio wants, so you can use an antenna on bands it wasn\'t cut for.',
    how: 'Click "ANT" on the right of the SWR meter, then "TX IN" on the left of the manual antenna tuner.',
    done: () => isConnected('swr_ant', 'atu_in'), praise: 'Good. Signal flows radio → meter → tuner.' },
  { ch: 'Wire the shack', tab: 'shack', sel: '[data-port="atu_out"]', title: 'Tuner out through the wall',
    text: 'Connect the tuner\'s <b>ANT</b> jack to the <b>lightning arrestor</b> on the wall (its IN jack).',
    why: 'The feedline leaves the house through a grounded lightning arrestor. It protects you and your gear from static and nearby strikes.',
    how: 'Click "ANT" on the right of the tuner, then "IN" on the lightning arrestor at the top right, on the wall.',
    done: () => isConnected('atu_out', 'arr_in'), praise: 'The RF path is complete: radio → meter → tuner → wall → antenna.' },
  { ch: 'Wire the shack', tab: 'shack', sel: '[data-port="rig_gnd"]', title: 'Ground the radio',
    text: 'Connect the radio\'s <b>GND</b> terminal to the copper <b>ground bus</b> at the bottom.',
    why: 'Bonding everything to one ground reduces RF "bite" on the mic, hum and noise — and is essential for lightning safety.',
    how: 'Click "GND" under the radio, then any brass dot on the copper bar at the bottom.',
    done: () => rigStatus().grounded, praise: 'Radio bonded to ground. Your future self thanks you.' },
  { ch: 'Wire the shack', tab: 'shack', sel: '[data-port="arr_gnd"]', title: 'Ground the lightning arrestor',
    text: 'Connect the arrestor\'s <b>GND</b> to the ground bus too.',
    why: 'A lightning arrestor only works if it has a short, solid path to ground. All grounds must be bonded together.',
    how: 'Click "GND" on the lightning arrestor, then a free dot on the ground bus.',
    done: () => rigStatus().arrGrounded, praise: 'Lightning protection grounded — that\'s on the exam, and it saves stations.' },
  { ch: 'Wire the shack', tab: 'shack', sel: '[data-port="atu_gnd"]', title: 'Ground the tuner',
    text: 'One more: the tuner\'s <b>GND</b> to the ground bus.',
    why: 'Every metal box in the RF path should be bonded so they all sit at the same potential.',
    how: 'Click "GND" in the middle of the tuner, then a free dot on the ground bus.',
    done: () => anyConn('atu_gnd'), praise: 'Everything is bonded. Textbook station grounding!' },
  { ch: 'Wire the shack', tab: 'shack', sel: '[data-port="mic_plug"]', title: 'Plug in the microphone',
    text: 'Connect the <b>Mic</b> to the radio\'s <b>MIC</b> jack.',
    why: 'You need a mic for voice (phone) modes — SSB, FM and AM.',
    how: 'Click the yellow dot on top of the Mic, then "MIC" on the front of the radio.',
    done: () => rigStatus().mic, praise: 'Mic connected — you\'re ready for voice.' },
  { ch: 'Wire the shack', tab: 'shack', sel: '[data-port="key_plug"]', title: 'Plug in the CW paddle',
    text: 'Connect the <b>Paddle</b> to the radio\'s <b>KEY</b> jack.',
    why: 'The paddle sends Morse code (CW). No Morse test is required for a license any more, but CW gets through when voice can\'t.',
    how: 'Click the dot on top of the Paddle, then "KEY" under the radio.',
    done: () => rigStatus().key, praise: 'Paddle in. Now you can send Morse too.' },
  { ch: 'Wire the shack', tab: 'shack', sel: '[data-ctl="psu-switch"]', title: 'Switch on the power supply',
    text: 'Flip the power supply switch to <b>ON</b>.',
    why: 'Always connect everything first and switch on last — it avoids sparks and surprises.',
    how: 'Click the grey switch on the front of the power supply.',
    done: () => S.shack.psuOn, praise: 'Power supply on — 13.8 volts ready.' },
  { ch: 'Wire the shack', tab: 'shack', sel: '[data-ctl="rig-power"]', title: 'Turn on the radio',
    text: 'Press the radio\'s round <b>POWER</b> button.',
    why: 'If the wiring is right, the display lights up. If polarity were reversed, this is when the fuse would pop.',
    how: 'Click the round button marked POWER at the top-left of the radio.',
    done: () => rigStatus().powered, praise: '🎉 The radio is alive! You just wired a complete station.' },
  // Chapter 2 — build an antenna
  { ch: 'Build an antenna', tab: 'antenna', sel: '#ant-type', title: 'Choose a half-wave dipole',
    text: 'In the Antenna tab, make sure the type is <b>Half-wave dipole</b>.',
    why: 'The dipole is the classic first antenna: two equal wires fed in the middle. Simple, efficient and easy to tune.',
    how: 'Use the "Antenna type" drop-down at the top of the Build card.',
    done: () => S.antenna.type === 'dipole', praise: 'A dipole — the antenna nearly every ham starts with.' },
  { ch: 'Build an antenna', tab: 'antenna', sel: '#ant-autosize', title: 'Size the wire for 40 meters',
    text: 'Set <b>Design for</b> to <b>40m</b> and press <b>🎯 Auto-size</b>. (By hand: <b>468 ÷ 7.15 MHz ≈ 65.5 ft</b> — type it or use the +/− buttons.)',
    why: 'A half-wave dipole is about 468 ÷ frequency (MHz) feet long — that formula is on the Technician exam. Lower frequency means longer wire. Auto-size goes further: it solves the real antenna (height, ground, wire, insulation) with the same method professional modelling software uses.',
    how: 'In the Wire length box choose "Design for: 40m", then press 🎯 Auto-size. Or type 65.5 in the length box. The −/+ buttons let out or take in wire an inch or a foot at a time.',
    done: () => !!S.antenna.sizedBy && S.antenna.length >= 60 && S.antenna.length <= 72, praise: 'Wire sized for 40 m. 468 ÷ MHz — remember it for the exam!' },
  { ch: 'Build an antenna', tab: 'antenna', sel: '.ant-controls input[type=range]', title: 'Get it up high',
    text: 'Set the <b>height</b> to at least <b>30 ft</b>.',
    why: 'Higher antennas radiate at lower angles for longer-distance contacts and pick up less local noise. Under ~¼ wavelength they mostly fire straight up (good for nearby, poor for DX).',
    how: 'Drag the "Height above ground" slider to 30 ft or more.',
    done: () => S.antenna.height >= 30, praise: 'Good height for 40 m.' },
  { ch: 'Build an antenna', tab: 'antenna', sel: '.ant-controls .btn.big', title: 'Raise the antenna',
    text: 'Press <b>⬆ Raise antenna</b>.',
    why: 'Once it\'s up, the feedline connects through the wall and your radio can hear the world.',
    how: 'The big orange button at the bottom of the Build card.',
    done: () => S.antenna.built, praise: 'It\'s up in the trees! Now let\'s check how well it\'s matched.' },
  { ch: 'Build an antenna', tab: 'antenna', sel: '.analyzer', title: 'Check SWR on the analyzer',
    text: 'Set the analyzer\'s <b>Sweep</b> to <b>40m</b> and look for the SWR dip inside the green band.',
    why: 'SWR (standing wave ratio) shows how well the antenna matches 50 Ω. 1:1 is perfect, under 2:1 is great. A dip below the band = too long; above = too short.',
    how: 'Pick "40m" in the Sweep drop-down at the top-right of the analyzer. Hover the graph to read SWR at any frequency. If the dip is low, lower the antenna and trim a few inches.',
    done: () => { const s = S.antenna.built ? system(7.15e6) : null; return s && s.swrRig < 2.2; }, praise: 'Low SWR on 40 m — your antenna is resonant. Real hams spend hours getting this right!' },
  // Chapter 3 — listen
  { ch: 'Listen on the radio', tab: 'radio', sel: '.rbtn[data-band="40m"]', title: 'Pick the 40 meter band',
    text: 'On the Radio tab, press the <b>40m</b> band button.',
    why: '40 m (7.0–7.3 MHz) is open somewhere almost any time of day — busy at night, regional by day.',
    how: 'The BAND buttons are at the bottom-left of the radio.',
    done: () => bandOf(S.radio.freq)?.name === '40m', praise: 'You\'re on 40 meters.' },
  { ch: 'Listen on the radio', tab: 'radio', sel: '.rbtn[data-mode="LSB"]', title: 'Select LSB',
    text: 'Choose the <b>LSB</b> mode.',
    why: 'Voice below 10 MHz uses lower sideband (LSB) by convention; 20 m and up uses USB. Wrong sideband sounds like Donald Duck.',
    how: 'MODE buttons are next to the band buttons.',
    done: () => S.radio.mode === 'LSB' && bandOf(S.radio.freq)?.name === '40m', praise: 'LSB on 40 m — the convention every ham follows.' },
  { ch: 'Listen on the radio', tab: 'radio', sel: '.rig-controls .ctl-group:nth-child(3)', title: 'Turn up the volume',
    text: 'Set <b>AF GAIN</b> to around half (put your headphones on!).',
    why: 'AF gain is the volume. Static and noise are normal — that\'s the sound of the band. Signals pop out of it.',
    how: 'Drag the AF GAIN slider in the AUDIO group.',
    done: () => S.radio.af >= 0.35, praise: 'Hear that hiss? That\'s the ionosphere talking.' },
  { ch: 'Listen on the radio', tab: 'radio', sel: '.waterfall', title: 'Tune in a station',
    text: 'Click a bright trace on the <b>waterfall</b>, or press <b>FIND → 🗣 A voice CQ</b>.',
    why: 'The waterfall shows every signal near you: brightness = strength. Tuning right onto a voice makes it sound natural.',
    how: 'Click directly on a bright vertical stripe in the blue waterfall. Or use the mouse wheel / arrow keys to tune.',
    done: () => S.flags?.heard, praise: 'You\'re hearing your first station — welcome to ham radio!' },
  { ch: 'Listen on the radio', tab: 'radio', sel: '.warnb', title: 'Tune the antenna tuner',
    text: 'Press <b>TUNE</b> so the tuner matches your antenna on this frequency.',
    why: 'A quick tune lets the radio deliver full power with low SWR. (Tuning sends a brief signal — in the real world you need a license for that; here we let you practice.)',
    how: 'The TUNE button is in the TRANSMIT group.',
    done: () => S.radio.atuTunedFreq != null, praise: 'Tuned and matched. Watch the SWR reading on the display.' },
  { ch: 'Listen on the radio', tab: 'radio', sel: '.rbtn.svc:nth-child(2)', title: 'Listen to WWV',
    text: 'Press <b>WWV</b> (General coverage) and listen for the ticks.',
    why: 'WWV in Colorado broadcasts time ticks on 2.5–25 MHz. Hearing it tells you which frequencies are open from there to you — an instant propagation check.',
    how: 'The WWV button is under "GENERAL COVERAGE (RX)".',
    done: () => S.flags?.wwv, praise: 'Tick… tick… That\'s NIST\'s atomic clock, bounced off the ionosphere.' },
  // Chapter 4 — license
  { ch: 'Get licensed', tab: 'license', sel: '.exam-row button', title: 'Study 10 flashcards',
    text: 'Open the License tab and <b>Study</b> the Technician questions. Answer 10 cards.',
    why: 'To transmit you need an FCC license. The Technician exam is 35 multiple-choice questions; you need 26 right.',
    how: 'Press "Study" on the Technician row. Each card shows the explanation after you answer.',
    done: () => Object.keys(S.study || {}).filter((k) => k.startsWith('T')).length >= 10, praise: 'Ten cards studied. Keep going until you\'re confident.' },
  { ch: 'Get licensed', tab: 'license', sel: '.exam-row .btn.primary', title: 'Take the Technician exam',
    text: 'When ready, press <b>Take VE exam</b> on the Technician row.',
    why: 'Pass and you get a callsign and transmit privileges. Fail? Study the review and try again — real VE sessions let you retake too.',
    how: 'Answer all 35 questions, then "Hand in answer sheet".',
    done: () => !!S.license, praise: '🎉 You\'re licensed! Your callsign is on the top bar.' },
  // Chapter 5 — first contact
  { ch: 'Your first contact', tab: 'radio', sel: '#finder', title: 'Find someone calling CQ',
    text: 'Press <b>FIND → 🗣 A voice CQ</b> (or 📟 for Morse).',
    why: 'CQ means "calling any station". Answering a CQ is the easiest way to make your first contact.',
    how: 'The FIND bar is above the radio. It tunes you right onto someone calling CQ.',
    done: () => { const s = world.stations.find((x) => x.role === 'cq' && Math.abs(x.freq - S.radio.freq) < 300); return !!s; }, praise: 'Found one! Listen to their callsign.' },
  { ch: 'Your first contact', tab: 'radio', sel: '.lf-call', title: 'Copy their callsign',
    text: 'Type the station\'s <b>callsign</b> into the logger\'s Callsign box (listen, or read the subtitles).',
    why: 'Copying the callsign correctly is the core skill. A wrong call = no contact in their log.',
    how: 'Click the Callsign box in the Logger and type the call you heard, e.g. W1ABC.',
    done: () => { const c = callField(); return c && world.stations.some((s) => s.call === c); }, praise: 'Callsign copied correctly!' },
  { ch: 'Your first contact', tab: 'radio', sel: '.macro:nth-child(4)', title: 'Call them (F4)',
    text: 'Press <b>F4</b> (or hold SPACE and say your call with phonetics).',
    why: 'You answer a CQ by giving your own callsign. Keep it short — they\'re listening for who\'s calling.',
    how: 'Press F4 on your keyboard or click the "F4 Call him" button. Wait for their reply.',
    done: () => world.stations.some((s) => s.pq && s.pq.stage === 'sentExch'), praise: 'They heard you and came back! Copy their report, name and QTH.' },
  { ch: 'Your first contact', tab: 'radio', sel: '.macro:nth-child(2)', title: 'Reply with your report (F2)',
    text: 'Type their report, name and QTH into the logger, then press <b>F2</b> to send yours.',
    why: 'A basic contact exchanges a signal report (RST), name and location. Then you both say 73 (best regards).',
    how: 'Fill RST rcvd / Name / QTH from what they said, then press F2.',
    done: () => [...world.records.values()].some((r) => r.complete), praise: 'Exchange complete — that\'s a real QSO!' },
  { ch: 'Your first contact', tab: 'radio', sel: '.logger .btn.primary', title: 'Sign off and log it',
    text: 'Press <b>F3</b> (73) and then <b>✔ Log QSO</b>.',
    why: 'Every contact goes in your log. A confirmed QSO counts toward awards like Worked All States and DXCC.',
    how: 'Press F3 to send 73, then the orange "Log QSO" button (or Ctrl+Enter).',
    done: () => S.log.some((q) => q.status === 'confirmed'), praise: '🏆 Your first logged, confirmed contact. You\'re a ham radio operator now. 73!' },
];

// ------------------------------------------------------------------ "Ask Elmer" knowledge base
const KB = [
  { k: ['swr', 'standing', 'mismatch', 'reflected'], t: 'SWR', why: 'SWR measures how well your antenna system matches the radio\'s 50 Ω. A mismatch reflects power back; the radio protects itself by cutting power, and coax loss goes up.', how: 'Check it with the antenna analyzer (Antenna tab) or watch SWR on the display while transmitting. Trim the antenna to move the dip into the band, then press TUNE for the rest.', show: ['antenna', '.analyzer'] },
  { k: ['ground', 'grounding', 'bond', 'earth'], t: 'Grounding', why: 'Bonding all equipment to one ground keeps everything at the same potential: less RF in the shack, less noise, and a safe path for lightning surges.', how: 'In the Shack, connect every GND terminal (radio, tuner, arrestor) to the copper ground bus.', show: ['shack', '.shack-svg'] },
  { k: ['fuse', 'polarity', 'reverse', 'red', 'black', 'blown', 'pop'], t: 'Power & polarity', why: 'DC has a direction: red is +, black is −. Reverse it and the protective fuse blows. Fuses protect against excessive current — always replace with the same rating.', how: 'Red lead → + post, black lead → − post. If the fuse blew, fix the wiring and press "Replace fuse".', show: ['shack', '.shack-status'] },
  { k: ['coax', 'feedline', 'cable', 'rg', 'lmr'], t: 'Coax / feedline', why: 'Coax carries the RF between radio and antenna. Thicker, foam coax (RG-213, LMR-400) loses less signal, especially at higher frequencies.', how: 'Chain it radio ANT → SWR meter → tuner → wall arrestor. Better coax is at the Hamfest.' },
  { k: ['tuner', 'atu', 'match', 'matching'], t: 'Antenna tuner', why: 'A tuner transforms your antenna system\'s impedance to 50 Ω so the radio gives full power. It doesn\'t make a poor antenna radiate better.', how: 'Press TUNE on the radio (internal ATU, up to 3:1). For worse mismatches put the manual tuner in line and adjust TUNE/LOAD while holding CARRIER.', show: ['radio', '#atu-btn'] },
  { k: ['dipole', 'length', 'long', 'cut', '468', 'formula', 'wire'], t: 'Dipole length', why: 'A half-wave dipole resonates when it\'s about half a wavelength long: length (ft) ≈ 468 ÷ frequency (MHz).', how: 'For 40 m: 468 ÷ 7.15 ≈ 65.5 ft. For 20 m: 468 ÷ 14.2 ≈ 33 ft. Or press 🎯 Auto-size on the Antenna tab to solve it exactly.', show: ['antenna', '#ant-autosize'] },
  { k: ['trim', 'too long', 'too short', 'resonant', 'dip'], t: 'Trimming', why: 'Shorter wire = higher resonant frequency. If the SWR dip is below the band, the antenna is too long.', how: 'Lower the antenna, use the −1 in / −3 in buttons, raise it, re-check the analyzer. The Workbench trim advisor calculates exactly how much.' },
  { k: ['vertical', 'radial', 'radials'], t: 'Verticals & radials', why: 'A ¼-wave vertical radiates at low angles (good for DX) but needs a radial ground system. Few radials = ground loss = wasted power.', how: 'Choose "Quarter-wave vertical" and as many radials as you can (16+ is good). Length ≈ 234 ÷ MHz.' },
  { k: ['height', 'high', 'tower', 'mast', 'tree'], t: 'Antenna height', why: 'Higher antennas radiate at lower angles for long-distance contacts. Low dipoles (under ¼ λ) favour nearby stations (NVIS).', how: 'Use the height slider. Trees allow 35 ft; buy a mast or tower at the Hamfest to go higher.' },
  { k: ['band', 'which band', 'best band', 'open', 'propagation', 'night', 'day', 'muf'], t: 'Picking a band', why: 'The sun ionizes the upper atmosphere. By day the high bands (20–10 m) open for long distances; at night the low bands (80–40 m) come alive.', how: 'Press FIND → 📈 Best band now. The header also shows band conditions, and WWV is a quick check.', show: ['radio', '#finder'] },
  { k: ['lsb', 'usb', 'sideband', 'donald', 'garbled', 'duck'], t: 'Sidebands', why: 'SSB voice uses one sideband. Convention: LSB below 10 MHz (160/80/40 m), USB above (20 m and up). The wrong one sounds like Donald Duck.', how: 'Choose LSB or USB with the MODE buttons; tune slowly until voices sound natural.' },
  { k: ['cw', 'morse', 'code', 'paddle', 'key'], t: 'CW (Morse)', why: 'CW is the most efficient mode: narrow signals get through when voice can\'t. No Morse test is required for any license.', how: 'Switch to CW mode, type in the CW box and press Enter, or use the F-key macros. Turn on the CW decoder while you learn.' },
  { k: ['cq', 'call', 'calling', 'answer', 'contact', 'qso', 'talk'], t: 'Making a contact', why: 'CQ means "calling any station". Answer a CQ with your callsign, exchange report/name/QTH, then sign with 73.', how: 'FIND → A voice CQ. Type their call, press F4. When they reply, fill the logger and press F2, then F3 and Log QSO. Or hold SPACE and speak.', show: ['radio', '#finder'] },
  { k: ['rst', 'report', '599', '59', 'signal report'], t: 'Signal reports', why: 'RST = Readability (1–5), Strength (1–9), Tone (1–9, CW only). 59 or 599 means perfectly readable and strong.', how: 'Read your S-meter for the S number; most contacts send 59.' },
  { k: ['log', 'logbook', 'logging', 'confirm', 'qsl'], t: 'Logging', why: 'Your log records every contact. Confirmed contacts count toward awards like WAS and DXCC.', how: 'Fill the Callsign and exchange fields, then Log QSO (Ctrl+Enter). The Logbook tab shows awards and exports ADIF.', show: ['logbook', '.awards'] },
  { k: ['license', 'exam', 'test', 'technician', 'general', 'extra', 'study'], t: 'Getting licensed', why: 'An FCC license is required to transmit. Technician = 35 questions (26 to pass) and covers VHF/UHF plus some HF.', how: 'License tab → Study, then Take VE exam. Elmer\'s tips across the game are all exam material.', show: ['license', '.exam-row'] },
  { k: ['callsign', 'call sign', 'my call'], t: 'Callsigns', why: 'Your callsign identifies you on the air. You must give it at least every 10 minutes and at the end of each contact.', how: 'Pass the Technician exam to be issued one. Extras can apply for a short vanity call.' },
  { k: ['identify', 'id', '10 minutes', 'ten minutes'], t: 'Station ID', why: 'FCC rules (§97.119): identify with your callsign at least every 10 minutes during a contact and at the end.', how: 'Most macros include your call. The game warns you if you forget.' },
  { k: ['privilege', 'privileges', 'blocked', 'not allowed', 'segment', 'edge'], t: 'Privileges', why: 'Each license class may transmit only on certain frequencies and modes. SSB also spreads ~3 kHz to one side of your dial frequency.', how: 'Look for the green/blue bars under the band scope: green = voice OK, blue = CW/data only. Stay 3 kHz inside the edge.', show: ['radio', '.waterfall'] },
  { k: ['repeater', 'offset', 'tone', 'ctcss', 'pl', '2m', 'fm'], t: 'Repeaters', why: 'A repeater listens on one frequency and transmits on another from a high site, extending your range. Most need a CTCSS (PL) tone.', how: 'FIND → 🔁 Repeater sets 146.940 MHz, −600 kHz offset and a 100 Hz tone. Then say your callsign.', show: ['radio', '#finder'] },
  { k: ['squelch', 'sql', 'hiss'], t: 'Squelch', why: 'Squelch mutes the receiver until a signal is strong enough — mostly used on FM.', how: 'Turn SQL up until the hiss just stops.' },
  { k: ['filter', 'bandwidth', 'narrow', 'wide'], t: 'Filters', why: 'A narrower filter lets in less noise and interference, so weak signals stand out. Too narrow distorts voice.', how: 'Use the FILTER drop-down: ~2.4 kHz for voice, 250–500 Hz for CW.' },
  { k: ['rit', 'clarifier', 'off frequency'], t: 'RIT', why: 'RIT shifts what you hear without moving your transmit frequency — handy when the other station is slightly off.', how: 'Press RIT and nudge the slider until their voice sounds right.' },
  { k: ['waterfall', 'scope', 'spectrum'], t: 'Waterfall', why: 'It shows signals over frequency (left-right) and time (scrolling down). Brighter = stronger.', how: 'Click a trace to tune to it. Turn on Lab readouts (🎛 Station → Appearance) for dBm and SNR numbers.', show: ['radio', '.waterfall'] },
  { k: ['s-meter', 'smeter', 's meter', 'meter'], t: 'S-meter', why: 'The S-meter shows signal strength in S-units; each is 6 dB, and S9 is −73 dBm.', how: 'Click the meter to switch between S, power out (PO) and SWR.' },
  { k: ['power', 'watts', 'amplifier', 'amp'], t: 'Power', why: 'Rules say use the minimum power needed. Technicians are limited to 200 W PEP on HF.', how: 'Set POWER in the TRANSMIT group. Amplifiers are at the Hamfest.' },
  { k: ['wwv', 'time', 'tick'], t: 'WWV', why: 'NIST\'s time station in Colorado transmits on 2.5, 5, 10, 15, 20 and 25 MHz. Whichever you hear tells you what\'s open.', how: 'Press WWV under General coverage, or FIND → ⏱ WWV.' },
  { k: ['weather', 'noaa', 'wx'], t: 'Weather radio', why: 'NOAA Weather Radio broadcasts your local forecast and warnings 24/7 on 162.400–162.550 MHz. Here it reads the real NWS forecast.', how: 'FIND → 🌦 Weather, or the NOAA WX button.' },
  { k: ['contest', 'pileup', 'run', 'exchange'], t: 'Contests', why: 'Contests are timed events to make as many contacts as possible. Short exchanges, accurate logging.', how: 'Contests tab → pick Field Day → Start. F1 = CQ; Enter does the next step.', show: ['contest', '.contest-picks'] },
  { k: ['online', 'players', 'friend', 'multiplayer', 'voice chat'], t: 'Real players', why: 'Other players are on a shared band: you hear anyone transmitting where you\'re tuned, if propagation allows.', how: 'Radio tab → "Go on the air with real players". Tune to their frequency and hold SPACE to talk.', show: ['radio', '#net-card'] },
  { k: ['workbench', 'design', 'nec', 'simulate', 'nanovna', 'analyzer file'], t: 'Workbench', why: 'The Workbench simulates real antennas with the same physics as NEC-2 and can read your real analyzer.', how: 'Workbench tab → pick a template → Auto-tune → Simulate. Load a .s1p file for trim advice.', show: ['workbench', '.wb-design'] },
  { k: ['credits', 'money', 'buy', 'store', 'hamfest', 'upgrade'], t: 'Credits & gear', why: 'You earn credits for confirmed contacts, goals, contests and exams.', how: 'Spend them in the Hamfest tab on coax, towers, beams, radios and amplifiers.', show: ['store', '.store-head'] },
  { k: ['dummy', 'dummy load', 'practice'], t: 'Dummy load', why: 'A dummy load absorbs your signal without radiating — you can test or practice transmitting legally without a license.', how: 'In the Shack, connect the coax to the Dummy load instead of the wall.' },
];

export function askElmer(q) {
  const s = ` ${String(q).toLowerCase().replace(/[^a-z0-9\s-]/g, ' ')} `;
  const intent = /\bwhy\b|\bwhat\b|\bpurpose\b|\bmean/.test(s) ? 'why' : 'how';
  let best = null, bs = 0;
  for (const e of KB) {
    let sc = 0;
    for (const k of e.k) if (s.includes(` ${k} `) || s.includes(` ${k}s `) || (k.length > 4 && s.includes(k))) sc += k.includes(' ') ? 3 : 2;
    if (e.t && s.includes(e.t.toLowerCase())) sc += 2;
    if (sc > bs) { bs = sc; best = e; }
  }
  if (!best) return { t: 'Hmm', text: 'I\'m not sure about that one. Try asking about SWR, grounding, dipole length, which band, sidebands, calling CQ, repeaters, the license exam…', chips: ['What is SWR?', 'How do I call CQ?', 'Which band is best?'] };
  return { t: best.t, text: intent === 'why' ? `${best.why}<br><span class="muted">How: ${best.how}</span>` : `${best.how}<br><span class="muted">Why: ${best.why}</span>`, show: best.show };
}

// ------------------------------------------------------------------ panel
let panel, feedEl, lastStep = -1;
const feed = [];
function say(html, kind = 'info') {
  feed.push({ html, kind, t: Date.now() });
  while (feed.length > 6) feed.shift();
  drawFeed();
  if (H().min && kind === 'good') { const b = $('#elmer-badge'); if (b) b.hidden = false; }
}
function drawFeed() {
  if (!feedEl) return;
  feedEl.innerHTML = '';
  for (const m of feed) feedEl.append(h('div', { class: `ef ef-${m.kind}`, html: m.html }));
  feedEl.scrollTop = feedEl.scrollHeight;
}

function highlight(tab, sel) {
  if (tab) goTab(tab);
  setTimeout(() => {
    const el = document.querySelector(sel);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('pulse-hl');
    setTimeout(() => el.classList.remove('pulse-hl'), 4500);
  }, 150);
}

const curStep = () => STEPS[H().step];
const tutorialActive = () => H().on && H().tutorial && (S.gameMode || 'career') === 'career' && H().step < STEPS.length;

function render() {
  if (!panel) return;
  const st = H();
  panel.innerHTML = '';
  document.body.classList.toggle('tutorial-on', tutorialActive());
  if (!st.on) { panel.append(h('button', { class: 'elmer-fab', title: 'Bring back Elmer', onclick: () => { st.on = true; st.min = false; save(); render(); } }, '🧓')); return; }
  if (st.min) {
    panel.append(h('button', { class: 'elmer-fab', title: 'Open Elmer — your mentor', onclick: () => { st.min = false; save(); render(); } }, '🧓', h('span', { class: 'elmer-badge', id: 'elmer-badge', hidden: true }, '!')));
    return;
  }
  const s = curStep();
  const chapters = [...new Set(STEPS.map((x) => x.ch))];
  const inCh = s ? STEPS.filter((x) => x.ch === s.ch) : [];
  const ask = h('input', { class: 'elmer-ask', placeholder: 'Ask Elmer… e.g. "why ground?"' });
  const doAsk = (q) => {
    if (!q.trim()) return;
    say(`<b>You:</b> ${q.replace(/</g, '&lt;')}`, 'you');
    const a = askElmer(q);
    say(`<b>${a.t}:</b> ${a.text}`, 'answer');
    if (a.show) { const [tab, sel] = a.show; feed[feed.length - 1].html += ` <button class="link elmer-show" data-tab="${tab}" data-sel="${sel}">▶ Show me</button>`; drawFeed(); }
    ask.value = '';
  };
  ask.addEventListener('keydown', (e) => { if (e.key === 'Enter') doAsk(ask.value); e.stopPropagation(); });
  const tutOn = tutorialActive();
  panel.append(h('div', { class: 'elmer-card' },
    h('div', { class: 'elmer-head' }, h('span', { class: 'elmer-av' }, '🧓'), h('b', {}, 'Elmer'), h('span', { class: 'muted tiny' }, 'your mentor'),
      h('span', { style: { flex: 1 } }),
      h('button', { class: 'link', title: 'Settings', onclick: () => settings() }, '⚙'),
      h('button', { class: 'link', title: 'Minimize', onclick: () => { st.min = true; save(); render(); } }, '—')),
    tutOn && s ? h('div', { class: 'elmer-step' },
      h('div', { class: 'tiny muted' }, `Chapter ${chapters.indexOf(s.ch) + 1}/${chapters.length}: ${s.ch} · step ${inCh.indexOf(s) + 1} of ${inCh.length}`),
      h('div', { class: 'e-prog' }, h('span', { style: { width: `${(st.step / STEPS.length) * 100}%` } })),
      h('div', { class: 'e-title' }, s.title), h('div', { class: 'e-text', html: s.text }),
      h('div', { class: 'row' },
        h('button', { class: 'btn primary small', onclick: () => highlight(s.tab, s.sel) }, '▶ Show me'),
        h('button', { class: 'btn small', onclick: () => say(`<b>Why?</b> ${s.why}`, 'answer') }, '❓ Why?'),
        h('button', { class: 'btn small', onclick: () => say(`<b>How:</b> ${s.how}`, 'answer') }, '🛠 How?'),
        h('button', { class: 'link small', title: 'Skip this step', onclick: () => { st.step++; save(); render(); } }, 'skip ›')))
      : h('div', { class: 'elmer-step' }, h('div', { class: 'e-text' }, (S.gameMode || 'career') === 'career' && st.tutorial && st.step >= STEPS.length ? '🎓 You finished the tutorial! Ask me anything, any time.' : 'Ask me anything — why something works, or how to do it.'),
        (S.gameMode || 'career') === 'career' && !st.tutorial ? h('button', { class: 'btn small', onclick: () => { st.tutorial = true; save(); render(); } }, '▶ Step-by-step tutorial') : null),
    feedEl = h('div', { class: 'elmer-feed' }),
    h('div', { class: 'row elmer-askrow' }, ask, h('button', { class: 'btn small', onclick: () => doAsk(ask.value) }, 'Ask')),
    h('div', { class: 'row elmer-chips' }, ...['What is SWR?', 'Why ground?', 'Which band?', 'How do I call CQ?'].map((q) => h('button', { class: 'ht-chip', onclick: () => doAsk(q) }, q)))));
  drawFeed();
}

function settings() {
  const st = H();
  say(`<b>Settings</b><br>
    <button class="btn small" data-act="tut">${st.tutorial ? '⏸ Turn off step-by-step' : '▶ Turn on step-by-step'}</button>
    <button class="btn small" data-act="restart">↺ Restart tutorial</button>
    <button class="btn small" data-act="hide">Hide Elmer</button>`, 'answer');
}

function check() {
  const st = H();
  if (!tutorialActive()) { render.lastActive !== false && render(); render.lastActive = false; return; }
  render.lastActive = true;
  let advanced = 0;
  const praises = [];
  while (st.step < STEPS.length) {
    let ok = false;
    try { ok = !!STEPS[st.step].done(); } catch (e) { }
    if (!ok) break;
    praises.push(STEPS[st.step].praise);
    st.step++; advanced++;
  }
  if (advanced) {
    save();
    addXp(3 * advanced, 'tutorial');
    for (const pr of praises.slice(-3)) say(`✅ ${pr}`, 'good');
    audio.ready && audio.beep(1320, 0.05, 0.06);
    if (st.step >= STEPS.length) say('🎓 <b>Tutorial complete!</b> You wired a station, built an antenna, listened, got licensed and made a contact. I\'m still here if you have questions.', 'good');
    render();
  } else if (lastStep !== st.step) { render(); }
  lastStep = st.step;
}

// Kind explanations when something goes wrong.
const MISTAKES = {
  connector: (msg) => `🤔 Not quite — ${msg} <br><span class="muted">Tip: the same kind of connector goes together: coax ↔ coax, DC lead ↔ power post, GND ↔ ground.</span>`,
  fuse: () => '💥 That fuse blew because the power leads are reversed. No harm done in the sim! Swap them (red → +, black → −), then press <b>Replace fuse</b>. The fuse did its job: it protects against too much current.',
  'tx-blocked': (reason) => `🛑 The radio refused to transmit: ${reason}<br><span class="muted">Ask me "privileges" to learn where you can transmit.</span>`,
  polarity: () => '⚠️ Careful — that lead is on the <b>wrong post</b>. Red goes to + and black to −. If you switch on like this the fuse will blow. Click the cable to unplug it and try again.',
  'cut-off': (len) => `📏 ${len} ft is not a 40 m length. The formula gives about 65.5 ft (468 ÷ 7.15) — set Design for 40m and press 🎯 Auto-size, or type 65.5.`,
  'high-swr': (swr) => `📈 SWR is ${swr}:1 — the antenna isn't matched on this frequency. Try a band it's cut for, or press TUNE.`,
};

export function initHelper(el) {
  panel = el;
  if (!S.helper && (S.gameMode || 'career') !== 'career') H().min = true;
  H();
  render();
  setInterval(check, 800);
  bus.on('helper-mistake', (kind, info) => { if (!H().on) return; const f = MISTAKES[kind]; if (f) { say(f(info), 'warn'); if (H().min) { H().min = false; render(); } } });
  bus.on('rig', render); bus.on('license', render);
  bus.on('helper-say', (html) => say(html, 'answer'));
  bus.on('helper-refresh', () => render());
  panel.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act], button.elmer-show');
    if (!b) return;
    const st = H();
    if (b.classList.contains('elmer-show')) return highlight(b.dataset.tab, b.dataset.sel);
    if (b.dataset.act === 'tut') st.tutorial = !st.tutorial;
    if (b.dataset.act === 'restart') { st.tutorial = true; st.step = 0; }
    if (b.dataset.act === 'hide') { st.on = false; toast('Elmer is hiding in the corner (🧓). Click him any time.', 'info', 4000); }
    save(); render();
  });
  if (tutorialActive() && st0()) say('👋 Hi, I\'m <b>Elmer</b> — that\'s what hams call a mentor. I\'ll walk you through building your station one step at a time and cheer when you get it right. Press <b>▶ Show me</b> anytime, or ask me "why?" and "how?".', 'answer');
}
const st0 = () => H().step === 0;
