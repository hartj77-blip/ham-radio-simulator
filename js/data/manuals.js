// Operating guides for every radio and accessory in the simulator.
// Original text written for this app. Radios and accessories are described by generic class
// names only; every procedure uses controls that exist in the simulator.

// Small shared fragments (kept short so each guide stays specific to its radio).
const POWER_ON = '<li>Open the <b>Station wiring</b> page (or use the auto-wire option): DC red lead to <b>+</b>, black to <b>&minus;</b>, coax from <b>ANT</b> to the meter, tuner, arrestor and wall feedthrough, every chassis bonded to the ground bus. Switch on the supply, then press the radio&rsquo;s <b>POWER</b> button.</li>';
const FREQ_ENTRY = 'Type a frequency in <b>kHz</b> into the entry box under the VFO knob and press <kbd>Enter</kbd> (for example <code>14074</code> or <code>146520</code>). The box only accepts values above 1000 kHz; use the <b>AM BC</b> button for the lower part of the broadcast band.';
const PTT_HOW = 'Hold <kbd>Space</kbd> (or click and hold the large <b>PTT</b> button) to talk with your own microphone, or use the <b>F1&ndash;F8</b> macro buttons, which speak or key the message for you. In CW, type into the CW box and press <kbd>Enter</kbd>; <kbd>Esc</kbd> stops a message in progress.';
const ATU_STEPS = '<ol><li>Tune to the frequency you intend to use, inside your license privileges (the coloured bar under the scope shows them).</li><li>Make sure a real antenna or dummy load is connected; the tuner will refuse an open connector.</li><li>Press <b>TUNE</b>. The radio sends a short low-power carrier and the tuner searches for a match.</li><li>A good result reads about 1.1:1 and the display shows <b>ATU&#10003;</b>. If it fails, the antenna is beyond the internal tuner&rsquo;s roughly 3:1 range: fix the antenna, or put the external manual tuner <b>IN LINE</b>.</li><li>Retune after moving more than a few kHz (about 0.5 % of the frequency); the check mark disappears when the stored match no longer applies.</li></ol>';

export const MANUALS = {
  // ------------------------------------------------------------------ generic classes
  allmode: {
    title: 'All-Band Base Transceiver (AB-100)',
    summary: 'A one-box station covering HF, 6 m and 2 m in every common mode, with an internal tuner, spectrum scope and wide general-coverage receive.',
    specs: [['Coverage', 'TX 160&ndash;6 m and 2 m; RX 0.5&ndash;470 MHz'], ['Power', '5&ndash;100 W on HF and 6 m; 5&ndash;50 W on 2 m'], ['Modes', 'LSB, USB, CW, AM, FM; WFM receive'], ['Supply', '13.8 V DC, about 22 A at full power'], ['Receiver', 'One preamp, IF shift, manual notch, DSP noise reduction'], ['Tuner', 'Internal automatic, about 3:1 range']],
    sections: [
      { h: 'Front panel at a glance', html: `<ul><li><b>Meter</b> (upper left): S-units on receive. Click it to choose what it shows on transmit: power output (PO) or SWR.</li><li><b>Display</b>: frequency, mode, filter width, RIT offset, ATU and ATT status, power setting and live SWR.</li><li><b>VFO knob</b>: drag in a circle, or use the mouse wheel. The arrow keys also tune. The step selector beside it sets how far each click moves.</li><li><b>Scope and waterfall</b>: click any trace to jump to it; the wheel over the waterfall tunes as well.</li><li><b>Band and mode keys</b>, the <b>GENERAL COVERAGE</b> presets (AM and FM broadcast, time signals, airband, weather, EMS), and the <b>FILTER</b> selector.</li><li><b>AUDIO</b> group: AF GAIN, SQL, ATT, RIT with its slider, NR. <b>TRANSMIT</b> group: POWER, ATU, TUNE, and the FM-only OFFSET and CTCSS selectors.</li></ul>` },
      { h: 'Getting started', html: '<ol>' + POWER_ON + `<li>Press a band key, for example <b>20m</b>. The radio returns to the last frequency you used there.</li><li>Choose a mode. The usual convention is LSB below 10 MHz and USB above.</li><li>Set <b>AF GAIN</b> to a comfortable level and leave <b>SQL</b> at zero on HF.</li><li>` + FREQ_ENTRY + `</li></ol>` },
      { h: 'Receiving', html: `<p>On SSB, tune until voices sound natural; a 10 or 50 Hz step makes that easy. On CW, put the trace under the red centre line and narrow the filter. If a nearby station is overloading you, press <b>ATT</b> (12 dB). <b>NR</b> lowers background hiss on weak signals. Use <b>RIT</b> to fine-tune the receiver alone when the other station drifts; double-click its slider to zero it.</p><p>This radio also receives 2 m FM directly: press <b>2m</b>, select <b>FM</b>, and raise <b>SQL</b> until the hiss just disappears. Open <b>Master view</b> for the preamp, AGC speed, IF shift, noise blanker and notch.</p>` },
      { h: 'Transmitting', html: `<p>Listen first, then ask if the frequency is in use (<b>F8</b>). Set <b>POWER</b> no higher than needed. ` + PTT_HOW + `</p><p>Watch the SWR reading while transmitting; above 2:1 the radio folds back its output. Power is capped at 50 W on 2 m automatically.</p>` },
      { h: 'Using the tuner', html: ATU_STEPS },
      { h: 'Repeaters (FM)', html: `<ol><li>Press <b>2m</b>, select <b>FM</b>, and enter the repeater output frequency.</li><li>In the TRANSMIT group set <b>OFFSET</b> (usually &minus;600 kHz below 147 MHz, +600 kHz above) and the <b>CTCSS</b> tone the repeater requires.</li><li>The display shows the shift and your actual transmit frequency. Key up, wait half a second, then speak.</li></ol>` },
      { h: 'Troubleshooting', html: `<dl><dt>Display dark</dt><dd>Read the message on the display and finish the Station wiring steps it names.</dd><dt>No signals at all</dt><dd>Check AF GAIN, set SQL to zero, and confirm an antenna is built for this band.</dd><dt>ATU tune failed</dt><dd>The mismatch is over 3:1. Check the antenna length for the band or use the external tuner.</dd><dt>2 m transmit refused</dt><dd>You may be outside the band or your license class; read the message that appears.</dd></dl>` },
    ],
  },

  sdr100: {
    title: 'Compact SDR Transceiver (CS-100)',
    summary: 'A 100 W HF and 6 m transceiver that digitises the band directly, giving a sharp waterfall, very narrow CW filters and strong DSP.',
    specs: [['Coverage', 'TX 160&ndash;6 m; RX 0.5&ndash;74.8 MHz'], ['Power', '5&ndash;100 W'], ['Modes', 'LSB, USB, CW, AM, FM; WFM receive'], ['Supply', '13.8 V DC, about 21 A at full power'], ['Receiver', 'Direct sampling, two preamps, IF shift, notch, DSP NR'], ['CW filters', '250 Hz to 2.4 kHz'], ['Tuner', 'Internal automatic, about 3:1 range']],
    sections: [
      { h: 'Front panel at a glance', html: `<ul><li>The <b>waterfall</b> is the centre of this radio. Every signal within the visible span is drawn, so you can see a band&rsquo;s activity before you hear it.</li><li>A green or blue bar along the bottom of the spectrum marks where your license allows you to transmit; red shading marks out-of-band areas.</li><li>Band, mode, filter, audio and transmit controls sit below the scope; <b>Master view</b> exposes the second preamp, AGC, IF shift and notch.</li></ul>` },
      { h: 'Getting started', html: '<ol>' + POWER_ON + `<li>Choose a band, then glance at the waterfall for traces. Click one to tune straight to it; the radio snaps to the nearest signal.</li><li>` + FREQ_ENTRY + `</li></ol>` },
      { h: 'Receiving', html: `<p>Direct sampling means there is no fixed crystal roofing filter; selectivity comes from DSP. For CW, select the 250 or 400 Hz <b>FILTER</b> and centre the trace on the red line; neighbouring signals disappear. For SSB, 2.4 kHz is a good default and 1.8 kHz helps in a crowded contest.</p><p><b>NR</b> is effective here and also helps the on-screen CW decoder copy weak signals. Use <b>P.AMP 1</b> or <b>2</b> in Master view on 15 m and higher where band noise is low; on 80 and 40 m use <b>ATT</b> instead, because atmospheric noise is already louder than the receiver.</p>` },
      { h: 'Transmitting', html: `<p>` + PTT_HOW + ` Your own signal appears on the waterfall while you transmit, which is a quick check that you are where you think you are. Keep the ALC bar in Master view out of the red by lowering MIC GAIN if needed.</p>` },
      { h: 'Using the tuner', html: ATU_STEPS },
      { h: 'Troubleshooting', html: `<dl><dt>Waterfall looks full of noise</dt><dd>Turn off the preamp or press ATT on the low bands.</dd><dt>CW signal heard but not decoded</dt><dd>Centre it under the red line, narrow the filter, and switch NR on.</dd><dt>2 m keys do nothing on transmit</dt><dd>This radio stops at 6 m for transmit and 74.8 MHz for receive.</dd></dl>` },
    ],
  },

  qrp: {
    title: 'QRP Field Transceiver (QF-10)',
    summary: 'A light 10 W battery radio for parks, summits and field events, with a built-in tuner but no scope.',
    specs: [['Coverage', 'TX 160&ndash;6 m; RX 0.5&ndash;54 MHz'], ['Power', '5&ndash;10 W'], ['Modes', 'LSB, USB, CW, AM, FM'], ['Supply', '12&ndash;13.8 V DC, about 2.5 A on transmit; runs from a small battery'], ['Receiver', 'One preamp, narrow CW filters, no DSP noise reduction'], ['Tuner', 'Internal automatic']],
    sections: [
      { h: 'Front panel at a glance', html: `<ul><li>No spectrum scope: the scope area shows a reminder instead. You find stations by tuning and watching the S-meter.</li><li>Small VFO, band and mode keys, FILTER, AF GAIN, SQL, ATT, RIT, POWER (5&ndash;10 W), ATU and TUNE.</li><li>No NR key. Narrow CW filters do the work instead.</li></ul>` },
      { h: 'Getting started', html: '<ol>' + POWER_ON.replace('Switch on the supply', 'Switch on the supply or connect the battery') + `<li>Pick a band that is open (the propagation summary helps) and start on CW or a quiet SSB frequency.</li><li>Set the tuning step to 50 or 100 Hz and turn the knob slowly; without a scope you need to hear each signal.</li></ol>` },
      { h: 'Receiving', html: `<p>Tune slowly and watch the meter needle. For CW, select a 400 or 250 Hz filter once you have found a signal; it improves the signal-to-noise ratio considerably. Use <b>RIT</b> to tweak the pitch of a station that is slightly off your transmit frequency.</p>` },
      { h: 'Transmitting', html: `<p>At 10 W, every decibel counts. CW and the narrow filters on both ends give you roughly a 10 to 13 dB advantage over SSB. Call stations that are already loud rather than calling CQ on a dead band. ` + PTT_HOW + `</p><div class="callout">A low-power station is a test of the antenna. A resonant wire up high will do more for you than any receiver setting.</div>` },
      { h: 'Using the tuner', html: ATU_STEPS + '<p>The tuner draws a little extra current while matching; on battery, tune once per band and leave it.</p>' },
      { h: 'Troubleshooting', html: `<dl><dt>Nobody answers</dt><dd>Try CW, a higher band, or answer a strong CQ rather than calling your own.</dd><dt>Power will not go below 5 W</dt><dd>The POWER slider starts at 5 W in this simulator.</dd><dt>Cannot see signals</dt><dd>There is no scope; listen and watch the S-meter.</dd></dl>` },
    ],
  },

  contest: {
    title: 'Contest-Grade Transceiver (CG-100)',
    summary: 'A top-tier HF and 6 m transceiver with the quietest receiver in the simulator, narrow filtering and a fast scope for crowded bands.',
    specs: [['Coverage', 'TX 160&ndash;6 m; RX 0.5&ndash;54 MHz'], ['Power', '5&ndash;100 W'], ['Modes', 'LSB, USB, CW, AM, FM'], ['Supply', '13.8 V DC, about 22 A at full power'], ['Receiver', 'Lowest internal noise in the simulator, two preamps, IF shift, notch, DSP NR'], ['Tuner', 'Internal automatic']],
    sections: [
      { h: 'Front panel at a glance', html: `<ul><li>Scope and waterfall for spotting runs and callers.</li><li>The logger below the radio: call, report and exchange fields, the <b>F1&ndash;F8</b> macro row and the <b>RUN</b>/<b>S&amp;P</b> buttons.</li><li>Master view: split VFO controls (<b>A/B</b>, <b>A=B</b>, <b>UP 5</b>, <b>SPLIT</b>), preamps, AGC, IF shift, notch and the keyer speed.</li></ul>` },
      { h: 'Getting started', html: '<ol>' + POWER_ON + `<li>Choose a contest or open operating, set your call in the settings, and pick a band.</li><li>Turn on <b>ESM</b> (Enter Sends Message) if you like a keyboard-only workflow.</li></ol>` },
      { h: 'Receiving', html: `<p>The receiver is about 3 dB quieter than the starter radio, which matters on the high bands where weak signals sit just above the noise. In a pileup, narrow the <b>FILTER</b>, use <b>IF SHIFT</b> in Master view to slide a neighbouring splatter out of the passband, and use the <b>NOTCH</b> on a steady carrier.</p>` },
      { h: 'Transmitting', html: `<p><b>Running:</b> <b>F1</b> calls CQ; when someone answers, type the call and press <b>F2</b> for the exchange, then <b>F3</b> to thank and log. With ESM on, <kbd>Enter</kbd> sends the next logical message and <kbd>Ctrl</kbd>+<kbd>Enter</kbd> logs. <b>Search and pounce:</b> click a trace, type the call, <b>F4</b> sends your call.</p><p>For a DX station working split, press <b>UP 5</b> in Master view: you receive on VFO A and transmit 5 kHz higher on VFO B.</p>` },
      { h: 'Using the tuner', html: ATU_STEPS },
      { h: 'Troubleshooting', html: `<dl><dt>Logged contact marked Not In Log</dt><dd>Check the callsign spelling before logging.</dd><dt>Calls go out on the wrong frequency</dt><dd>SPLIT may be on; check the display for SPLIT and switch it off in Master view.</dd><dt>Duplicate warning</dt><dd>You already worked that station on this band and mode.</dd></dl>` },
    ],
  },

  ht: {
    title: 'Dual-Band Handheld (DH-5)',
    summary: 'A pocket 5 W 2 m FM radio that also listens to FM broadcast, weather, airband and public-service channels.',
    specs: [['Coverage', 'TX 2 m; RX 88&ndash;470 MHz'], ['Power', '5 W high, 1 W low'], ['Modes', 'FM; WFM and AM receive'], ['Supply', 'Internal battery pack, about 1.6 A on transmit'], ['Antenna', 'Short flexible whip']],
    sections: [
      { h: 'Front panel at a glance', html: `<ul><li><b>Side keys</b>: <b>PTT</b> (hold to talk), <b>CALL</b> (FM broadcast on/off), <b>MONI</b> (hold to open the squelch).</li><li><b>Top</b>: volume knob (drag up or down, or scroll).</li><li><b>Display</b>: two lines, A and B; the active line is highlighted. Icons show shift (+ or &minus;), tone (CT) and mode.</li><li><b>Keys</b>: <b>VFO/MR</b>, <b>A/B</b>, <b>BAND</b>, <b>MENU</b>, <b>&#9650;</b>/<b>&#9660;</b>, <b>EXIT</b>, the numeric pad, <b>*</b> SCAN and <b>#</b> LOCK (hold).</li></ul>` },
      { h: 'Getting started', html: `<ol><li>Choose <b>Handheld</b> in the toolbar (phones start here). No wiring is needed; the handheld has its own battery and antenna.</li><li>Turn the volume knob up. Press <b>VFO/MR</b> until channel names appear, then step through them with <b>&#9650;</b>/<b>&#9660;</b>.</li><li>To enter a frequency, switch to VFO and type six digits in kHz: <code>146520</code>.</li></ol>` },
      { h: 'Receiving', html: `<p><b>BAND</b> cycles 2 m, 70 cm, FM broadcast and airband. Airband stations are AM and are picked automatically when you enter 108&ndash;137 MHz. <b>*</b> scans and pauses on activity. If a weak station keeps dropping out, lower the squelch in the <b>SQL</b> menu item or hold <b>MONI</b>.</p>` },
      { h: 'Transmitting', html: `<p>Hold <b>PTT</b>, pause briefly, then speak with the radio a few centimetres from your mouth. The quick buttons (Listening, CQ, Roger, 73) send common phrases. Use <b>TXP</b> in the menu to select LOW (1 W) for nearby contacts; it saves battery.</p>` },
      { h: 'Repeaters (FM)', html: `<p>Typing a 2 m repeater frequency sets the standard shift automatically. Add the tone with <b>MENU</b>, then <b>&#9660;</b> to <b>T-CTCS</b>, <b>MENU</b> to edit, <b>&#9650;</b>/<b>&#9660;</b> to the tone, <b>MENU</b> to store, <b>EXIT</b>. The preset <b>RPTR</b> channel is already complete.</p>` },
      { h: 'Troubleshooting', html: `<dl><dt>Keys do nothing</dt><dd>The keypad is locked; hold <b>#</b>.</dd><dt>Repeater does not respond</dt><dd>Check the shift icon and the CT tone.</dd><dt>Cannot transmit on 70 cm</dt><dd>This model transmits on 2 m only in the simulator.</dd></dl>` },
    ],
  },

  sdrrx: {
    title: 'Wideband SDR Receiver (WR-1)',
    summary: 'A receive-only software radio from 0.5 to 470 MHz with a waterfall and DSP, for shortwave, broadcast, airband and band monitoring. No license is needed.',
    specs: [['Coverage', 'RX 0.5&ndash;470 MHz; no transmitter'], ['Modes', 'LSB, USB, CW, AM, FM, WFM'], ['Supply', 'USB powered, about 0.4 A'], ['Display', 'Software waterfall and spectrum'], ['DSP', 'Noise reduction, narrow CW filters']],
    sections: [
      { h: 'Front panel at a glance', html: `<p>The receiver itself is a small box; you operate it entirely from computer software. In this simulator the radio panel plays the role of that software window: the waterfall, frequency display, band and mode keys, FILTER, AF GAIN, SQL, ATT, RIT and NR. Transmit controls are hidden.</p>` },
      { h: 'Getting started', html: `<ol><li>Connect an antenna on the Station wiring page. Any wire works for listening, but a band-specific antenna is better.</li><li>Press a <b>GENERAL COVERAGE</b> preset such as <b>AM BC</b>, <b>WWV</b> or <b>AIR</b> to hear something immediately.</li><li>` + FREQ_ENTRY + `</li></ol>` },
      { h: 'Receiving', html: `<p>Use the waterfall the way listeners do: look for a trace, click it, then choose the mode that matches its shape. A narrow line is CW; a 2&ndash;3 kHz block on one side of the carrier is SSB; a symmetrical block with a centre carrier is AM; a wide flat block on VHF is FM. On the amateur bands, the transcript shows what each station is saying, which is a good way to learn operating practice before you transmit.</p>` },
      { h: 'Transmitting', html: `<p>This is a receiver only. PTT and macro buttons will report that there is no transmitter.</p>` },
      { h: 'Matching the antenna', html: `<p>A receiver does not need a low SWR, but a resonant antenna still hears more on its design band. A long random wire is a reasonable all-band listening antenna.</p>` },
      { h: 'Troubleshooting', html: `<dl><dt>Strong broadcast interference on shortwave</dt><dd>Press ATT.</dd><dt>FM broadcast sounds distorted</dt><dd>Use WFM, not FM.</dd><dt>PTT does nothing</dt><dd>Expected: receive-only device.</dd></dl>` },
    ],
  },

  // ------------------------------------------------------------------ catalog radios: bases
  ic7300: {
    title: 'Touchscreen SDR Base (SDR-B1)',
    summary: 'A popular 100 W HF and 6 m direct-sampling transceiver built around a touchscreen spectrum and waterfall display.',
    specs: [['Coverage', 'TX 160&ndash;6 m; RX 0.03&ndash;74.8 MHz'], ['Power', '5&ndash;100 W'], ['Modes', 'LSB, USB, CW, AM, FM'], ['Supply', '13.8 V DC, about 21 A at full power'], ['Receiver', 'Direct sampling, two preamps, IF shift and twin passband tuning, manual notch, DSP NR'], ['Display', '4.3-inch colour touchscreen with scope and waterfall'], ['Tuner', 'Internal automatic, about 3:1 range']],
    sections: [
      { h: 'Front panel at a glance', html: `<ul><li>On a real radio of this class most settings live on the touchscreen and in its menus. In the simulator, the main panel holds the everyday controls and <b>Master view</b> shows the rest.</li><li>Touching a trace on the real scope tunes to it; here you click the waterfall, which snaps to the nearest signal.</li><li>The meter cycles S, PO and SWR when clicked.</li></ul>` },
      { h: 'Getting started', html: '<ol>' + POWER_ON + `<li>Press a band key, choose USB or LSB, and set AF GAIN.</li><li>Open Master view once and note where P.AMP, AGC, IF SHIFT and NOTCH are.</li></ol>` },
      { h: 'Receiving', html: `<p>The two preamps are graded: <b>P.AMP 1</b> for 15&ndash;10 m, <b>P.AMP 2</b> for 6 m. Leave both off below 20 m. <b>IF SHIFT</b> moves the passband; combined with a narrower FILTER it behaves like twin passband tuning, trimming either edge. The manual <b>NOTCH</b> removes a steady carrier: switch it on and move the NOTCH Hz slider until the tone vanishes.</p><p>Receive extends below the broadcast band, but the frequency box accepts entries only above 1000 kHz.</p>` },
      { h: 'Transmitting', html: `<p>` + PTT_HOW + ` The speech processor (<b>COMP</b> in Master view) adds about 2.5 dB of average talk power on SSB; watch the ALC bar and reduce MIC GAIN if it reaches red. Wide FM broadcast is not available on this model.</p>` },
      { h: 'Using the tuner', html: ATU_STEPS },
      { h: 'Troubleshooting', html: `<dl><dt>FM BC preset changes to another mode</dt><dd>This radio has no WFM mode and does not reach 88 MHz.</dd><dt>Hiss rises when a preamp is on</dt><dd>Normal on low bands; turn it off.</dd></dl>` },
    ],
  },

  ft991a: {
    title: 'All-Band Touchscreen Base (AB-T2)',
    summary: 'A compact 100 W radio covering HF, 6 m, 2 m and 70 cm in all modes, with a touchscreen scope and an internal tuner for HF and 6 m.',
    specs: [['Coverage', 'TX 160&ndash;6 m, 2 m (70 cm on a real radio); RX 0.03&ndash;470 MHz'], ['Power', '5&ndash;100 W HF/6 m; 5&ndash;50 W VHF'], ['Modes', 'LSB, USB, CW, AM, FM; WFM receive; digital voice on a real radio'], ['Supply', '13.8 V DC, about 22 A at full power'], ['Receiver', 'Two preamps, IF shift, notch, DSP NR'], ['Tuner', 'Internal automatic, HF and 6 m only']],
    sections: [
      { h: 'Front panel at a glance', html: `<ul><li>Small touchscreen scope above the controls; in the simulator, the waterfall.</li><li>The same band and mode keys reach from 160 m to 2 m. The GENERAL COVERAGE row reaches broadcast FM, airband, weather and public-service channels.</li><li>On a real radio of this class a digital voice mode is also available; it is not modelled here.</li></ul>` },
      { h: 'Getting started', html: '<ol>' + POWER_ON + `<li>For HF, choose a band and SSB or CW. For local work, press <b>2m</b> and <b>FM</b>.</li><li>` + FREQ_ENTRY + `</li></ol>` },
      { h: 'Receiving', html: `<p>On HF, use the preamp only on the higher bands and ATT on 80 and 40 m. On VHF FM raise <b>SQL</b> until the hiss stops. One receiver serves both HF and VHF, so you cannot listen to a repeater while chasing HF stations; the simulator likewise tunes one frequency at a time.</p>` },
      { h: 'Transmitting', html: `<p>` + PTT_HOW + ` Power is limited to 50 W on VHF automatically. For a mobile or portable VHF contact, 10&ndash;25 W is usually plenty.</p>` },
      { h: 'Using the tuner', html: ATU_STEPS + '<p>The internal tuner is for HF and 6 m. On 2 m, use an antenna cut for the band; the tuner cannot help there.</p>' },
      { h: 'Repeaters (FM)', html: `<p>Select <b>FM</b> on 2 m, enter the output frequency, set <b>OFFSET</b> and <b>CTCSS</b>. The bottom line of the display shows your transmit frequency so you can confirm the shift.</p>` },
      { h: 'Troubleshooting', html: `<dl><dt>2 m SWR high</dt><dd>The HF antenna is not suitable for VHF; build a 2 m vertical.</dd><dt>Cannot transmit on 70 cm</dt><dd>70 cm transmit is not modelled in the simulator.</dd></dl>` },
    ],
  },

  ft710: {
    title: 'SDR Base with External Speaker (SDR-B2)',
    summary: 'A 100 W HF and 6 m SDR transceiver known for handling strong nearby signals cleanly, with a small touch display and scope.',
    specs: [['Coverage', 'TX 160&ndash;6 m; RX 0.03&ndash;56 MHz'], ['Power', '5&ndash;100 W'], ['Modes', 'LSB, USB, CW, AM, FM'], ['Supply', '13.8 V DC, about 23 A at full power'], ['Receiver', 'Very wide strong-signal range, two preamps, IF shift, notch, DSP NR'], ['Display', '3.5-inch touch display with scope'], ['Audio', 'Supplied external speaker']],
    sections: [
      { h: 'Front panel at a glance', html: `<ul><li>A compact front panel with a small touch display; most adjustments are on the main panel and in Master view.</li><li>Audio comes from a separate speaker on a real radio of this class, which noticeably improves clarity.</li></ul>` },
      { h: 'Getting started', html: '<ol>' + POWER_ON + `<li>This radio draws about 23 A at full power. A supply rated below that will limit output; the POWER slider shows the cap and Master view explains it.</li></ol>` },
      { h: 'Receiving', html: `<p>The strength of this design is resistance to overload. During a busy contest, with loud stations close in frequency, you can usually leave <b>ATT</b> off and keep full sensitivity. Narrow the FILTER and use <b>IF SHIFT</b> to dodge splatter. The internal noise is about 2 dB lower than the starter radio.</p>` },
      { h: 'Transmitting', html: `<p>` + PTT_HOW + `</p>` },
      { h: 'Using the tuner', html: ATU_STEPS },
      { h: 'Troubleshooting', html: `<dl><dt>Power limited below 100 W</dt><dd>Your supply cannot deliver about 23 A; choose a 30 A supply.</dd><dt>No VHF</dt><dd>Coverage stops at 56 MHz.</dd></dl>` },
    ],
  },

  ts590sg: {
    title: 'Knob-Panel Base (KP-3)',
    summary: 'A traditional HF and 6 m transceiver with a knob for nearly every function, narrow roofing filters, and no built-in scope.',
    specs: [['Coverage', 'TX 160&ndash;6 m; RX 0.13&ndash;60 MHz'], ['Power', '5&ndash;100 W'], ['Modes', 'LSB, USB, CW, AM, FM'], ['Supply', '13.8 V DC, about 20.5 A at full power'], ['Receiver', 'Down-conversion design with 500 Hz and 2.7 kHz roofing filters, one preamp, IF shift, notch, DSP NR'], ['Display', 'Segment LCD; no scope'], ['Tuner', 'Internal automatic']],
    sections: [
      { h: 'Front panel at a glance', html: `<ul><li>No scope: the waterfall area shows a notice. Tune by ear and watch the S-meter.</li><li>On a real radio of this class almost every function has its own knob or key. The simulator&rsquo;s main panel and Master view give you the same functions without menus.</li></ul>` },
      { h: 'Getting started', html: '<ol>' + POWER_ON + `<li>Pick a band and a 50 or 100 Hz step. Tune slowly; signals come out of silence rather than appearing on a screen.</li></ol>` },
      { h: 'Receiving', html: `<p>A down-conversion receiver places a narrow crystal <em>roofing filter</em> early in the signal path. When you choose a CW filter of 500 Hz or less, strong signals outside that window are rejected before they reach the later stages, so crowded CW bands stay clean. On SSB the 2.7 kHz roofing filter does the same job. Use <b>IF SHIFT</b> and <b>NOTCH</b> in Master view to clean up what remains.</p>` },
      { h: 'Transmitting', html: `<p>` + PTT_HOW + `</p>` },
      { h: 'Using the tuner', html: ATU_STEPS },
      { h: 'Troubleshooting', html: `<dl><dt>Cannot find any stations</dt><dd>Without a scope, use a larger step to sweep, then a smaller one to settle.</dd><dt>Waterfall click does nothing</dt><dd>There is no scope on this model.</dd></dl>` },
    ],
  },

  ft891: {
    title: 'Mini Mobile HF/6m (MM-4)',
    summary: 'A very small 100 W HF and 6 m radio for car and portable use, with a small menu-driven display, no scope and no internal tuner.',
    specs: [['Coverage', 'TX 160&ndash;6 m; RX 0.03&ndash;56 MHz'], ['Power', '5&ndash;100 W'], ['Modes', 'LSB, USB, CW, AM, FM'], ['Supply', '13.8 V DC, about 23 A at full power'], ['Receiver', 'One preamp, IF shift, notch, DSP NR'], ['Display', 'Small LCD; no scope'], ['Tuner', 'None']],
    sections: [
      { h: 'Front panel at a glance', html: `<ul><li>Small front panel; on a real radio of this class most settings sit in a numbered menu. The simulator puts them on the main panel and in Master view.</li><li>There is no ATU or TUNE key, and no scope.</li></ul>` },
      { h: 'Getting started', html: '<ol>' + POWER_ON + `<li>Before transmitting, confirm the antenna is resonant on the band you chose: key a short carrier into a dummy load first, then check the SWR on the antenna.</li></ol>` },
      { h: 'Receiving', html: `<p>Tune by ear and S-meter. In a car, ignition and wiper noise is impulsive, so try <b>NB</b> in Master view before NR.</p>` },
      { h: 'Transmitting', html: `<p>` + PTT_HOW + ` The radio needs about 23 A at full power. On a vehicle battery, run the leads directly to the battery with fuses on both leads.</p>` },
      { h: 'Matching the antenna', html: `<p>With no internal tuner, the radio must see a low SWR from the antenna itself. Options:</p><ul><li><b>Resonant antennas</b>: a dipole or vertical cut for the band, adjusted until the SWR is below 1.5:1.</li><li><b>External tuner</b>: choose a manual or automatic tuner in Equipment, set it <b>IN LINE</b>, and adjust TUNE and LOAD while holding <b>CARRIER</b> at low power (see the tuner guide).</li></ul><p>Above 2:1 the radio reduces its output to protect itself.</p>` },
      { h: 'Troubleshooting', html: `<dl><dt>Output drops on transmit</dt><dd>SWR is above 2:1; fix the antenna or use an external tuner.</dd><dt>No TUNE button</dt><dd>Expected; this radio has no tuner.</dd></dl>` },
    ],
  },

  ic705: {
    title: 'Portable SDR Field Station (PF-5)',
    summary: 'A battery-capable 10 W all-mode radio from HF to 70 cm with a touchscreen scope, built-in position receiver and wireless link, but no internal tuner.',
    specs: [['Coverage', 'TX 160&ndash;6 m and 2 m (70 cm on a real radio); RX 0.03&ndash;470 MHz'], ['Power', '5&ndash;10 W (5 W on the internal battery)'], ['Modes', 'LSB, USB, CW, AM, FM; WFM receive; digital voice on a real radio'], ['Supply', '13.8 V DC external, about 3 A; or internal battery'], ['Receiver', 'Direct sampling, two preamps, IF shift, notch, DSP NR'], ['Tuner', 'None']],
    sections: [
      { h: 'Front panel at a glance', html: `<ul><li>Touchscreen scope and waterfall (the simulator waterfall), with the usual band, mode and audio controls.</li><li>On a real radio of this class, a satellite position receiver sets the clock and grid square, and a short-range wireless link connects a headset or phone. Neither is modelled here.</li></ul>` },
      { h: 'Getting started', html: '<ol>' + POWER_ON + `<li>For field use choose the 20 Ah lithium battery in Equipment. It powers this radio for many hours.</li></ol>` },
      { h: 'Receiving', html: `<p>Even at low power, the receiver is a full SDR: click traces on the waterfall, use narrow CW filters and NR, and the preamps on the upper bands.</p>` },
      { h: 'Transmitting', html: `<p>` + PTT_HOW + ` At 10 W, favour CW and spots where stations are already loud. Your own trace appears on the waterfall.</p>` },
      { h: 'Matching the antenna', html: `<p>There is no internal tuner. Use a resonant antenna (a dipole or vertical cut for the band) or add an external tuner in Equipment. With a manual tuner, hold <b>CARRIER</b> and adjust TUNE and LOAD for minimum SWR; at 10 W this is safe for the radio.</p>` },
      { h: 'Repeaters (FM)', html: `<p>On 2 m, select FM, enter the output frequency, and set <b>OFFSET</b> and <b>CTCSS</b>.</p>` },
      { h: 'Troubleshooting', html: `<dl><dt>Output folds back</dt><dd>SWR is above 2:1 and there is no tuner to help.</dd><dt>No TUNE button</dt><dd>Expected for this model.</dd></dl>` },
    ],
  },

  g90: {
    title: 'Budget Field SDR (BF-6)',
    summary: 'An inexpensive 20 W HF radio with a wide-range internal tuner, a small spectrum display and a detachable head.',
    specs: [['Coverage', 'TX 160&ndash;10 m; RX 0.5&ndash;30 MHz'], ['Power', '5&ndash;20 W'], ['Modes', 'LSB, USB, CW, AM'], ['Supply', '13.8 V DC, about 8 A at full power'], ['Receiver', 'One preamp; no DSP NR, IF shift or notch'], ['Display', 'Small spectrum display'], ['Tuner', 'Internal, wide range']],
    sections: [
      { h: 'Front panel at a glance', html: `<ul><li>A small head with a narrow spectrum display; on a real radio of this class the head can be detached and used on a cable.</li><li>No 6 m and no FM. The NR, notch and IF shift controls are greyed out in Master view.</li></ul>` },
      { h: 'Getting started', html: '<ol>' + POWER_ON + `<li>Choose an HF band. The 8 A draw lets a small battery run it comfortably.</li></ol>` },
      { h: 'Receiving', html: `<p>The receiver is about 2 dB noisier than the starter radio, and there is no DSP noise reduction. Narrow filters are your main tool: 500 Hz or less on CW, 2.1 kHz on SSB in noise.</p>` },
      { h: 'Transmitting', html: `<p>` + PTT_HOW + ` Twenty watts is about 7 dB above 4 W but only about 7 dB below 100 W, so good antennas still matter.</p>` },
      { h: 'Using the tuner', html: ATU_STEPS },
      { h: 'Troubleshooting', html: `<dl><dt>FM or 6 m buttons disabled</dt><dd>Not supported by this model.</dd><dt>Noisy band</dt><dd>Narrow the filter; there is no NR.</dd></dl>` },
    ],
  },

  k4: {
    title: 'Dual-Receiver Flagship (DR-7)',
    summary: 'A top-tier HF and 6 m transceiver with two independent receivers, a large touchscreen panadapter and the widest dynamic range in the catalog.',
    specs: [['Coverage', 'TX 160&ndash;6 m; RX 0.1&ndash;54 MHz'], ['Power', '5&ndash;100 W'], ['Modes', 'LSB, USB, CW, AM, FM'], ['Supply', '13.8 V DC, about 22 A at full power'], ['Receiver', 'Two receivers, lowest noise in the catalog, two preamps, IF shift, notch, DSP NR'], ['Display', 'Large touchscreen panadapter'], ['Tuner', 'Internal automatic']],
    sections: [
      { h: 'Front panel at a glance', html: `<ul><li>A large panadapter showing the whole band segment; in the simulator, the waterfall.</li><li>Two complete receivers. On a real radio of this class you can hear both at once, one in each ear.</li></ul>` },
      { h: 'Getting started', html: '<ol>' + POWER_ON + `<li>Open Master view to see both VFOs.</li></ol>` },
      { h: 'Receiving', html: `<p><b>Dual receive, conceptually:</b> a DX station working split transmits on one frequency and listens on another. With two receivers you hear the DX station in one ear and the pileup in the other, so you can find the frequency where the DX station is listening. In the simulator, VFO A is your receive frequency and VFO B is your split transmit frequency; use <b>A/B</b> in Master view to listen briefly on B, then swap back.</p>` },
      { h: 'Transmitting', html: `<p>` + PTT_HOW + ` For split, press <b>UP 5</b> (sets VFO B 5 kHz up and turns SPLIT on) and adjust as needed.</p>` },
      { h: 'Using the tuner', html: ATU_STEPS },
      { h: 'Troubleshooting', html: `<dl><dt>Transmitting on the wrong frequency</dt><dd>Check SPLIT in Master view.</dd><dt>Only one audio channel</dt><dd>The simulator plays one receiver at a time.</dd></dl>` },
    ],
  },

  // ------------------------------------------------------------------ catalog radios: handhelds
  uv5r: {
    title: 'Budget Dual-Band Handheld (HT-A1)',
    summary: 'An inexpensive 4 W 2 m and 70 cm FM handheld, driven by a keypad and a numbered menu, with FM broadcast receive but no airband.',
    specs: [['Coverage', 'TX 2 m (70 cm on a real radio); RX 65&ndash;108, 136&ndash;174 and 400&ndash;520 MHz'], ['Power', '4 W high, 1 W low'], ['Modes', 'FM; WFM broadcast receive'], ['Supply', 'Internal battery, about 1.5 A on transmit'], ['Gaps', 'No 108&ndash;136 MHz airband, no AM']],
    sections: [
      { h: 'Front panel at a glance', html: `<ul><li>Two-line display (A on top, B below). Each line holds a frequency or a channel name.</li><li><b>VFO/MR</b> switches between frequency mode and memory mode. <b>A/B</b> chooses which line is active. <b>BAND</b> cycles 2 m, 70 cm and FM broadcast.</li><li>The small labels under some number keys are reminders; in the simulator those keys enter digits, and the functions are reached through <b>MENU</b>.</li></ul>` },
      { h: 'Getting started', html: `<ol><li>Select <b>Handheld</b> in the toolbar. Turn up the volume knob.</li><li>Press <b>VFO/MR</b> for VFO mode, then type <code>146520</code>; the display updates when the sixth digit is entered.</li><li>Press <b>A/B</b> and set the second line to another frequency; switching lines is quicker than retyping.</li></ol>` },
      { h: 'Receiving', html: `<p>Press <b>CALL</b> for FM broadcast, and again to return. Airband is not available on this radio; the frequency entry refuses it. Weather and public-service channels on VHF are within range.</p>` },
      { h: 'Using the menu', html: `<table><thead><tr><th>#</th><th>Item</th><th>What it sets</th></tr></thead><tbody><tr><td>1</td><td>SQL</td><td>Squelch 0&ndash;9</td></tr><tr><td>2</td><td>STEP</td><td>Arrow-key step, 2.5&ndash;25 kHz</td></tr><tr><td>3</td><td>TXP</td><td>HIGH or LOW power</td></tr><tr><td>4</td><td>SFT-D</td><td>Shift direction: OFF, +, &minus;</td></tr><tr><td>5</td><td>OFFSET</td><td>0.600, 1.600 or 5.000 MHz</td></tr><tr><td>6</td><td>T-CTCS</td><td>Transmit tone</td></tr><tr><td>7</td><td>BEEP</td><td>Key beep</td></tr><tr><td>8</td><td>MEM-CH</td><td>Save the current settings as a channel</td></tr><tr><td>9</td><td>DEL-CH</td><td>Clear all your saved channels</td></tr></tbody></table><p><b>MENU</b> opens; <b>&#9650;</b>/<b>&#9660;</b> select; <b>MENU</b> edits; <b>&#9650;</b>/<b>&#9660;</b> change; <b>MENU</b> stores; <b>EXIT</b> backs out.</p>` },
      { h: 'Repeaters (FM)', html: `<ol><li>In VFO mode type the repeater output; the standard shift is applied.</li><li>Check <b>SFT-D</b> and <b>OFFSET</b> if the repeater is non-standard.</li><li>Set <b>T-CTCS</b> to the access tone.</li><li>Save with <b>MEM-CH</b>, give it a name of up to six characters, and recall it in memory mode by typing its two-digit number.</li></ol>` },
      { h: 'Troubleshooting', html: `<dl><dt>Frequency refused</dt><dd>It falls in a receive gap (for example airband).</dd><dt>Repeater silent</dt><dd>Wrong tone or shift; check the display icons.</dd></dl>` },
    ],
  },

  uvk5: {
    title: 'Wideband Dual-Band Handheld (HT-A2)',
    summary: 'A low-cost 5 W 2 m and 70 cm FM handheld with continuous receive from 18 to 470 MHz, including AM airband.',
    specs: [['Coverage', 'TX 2 m (70 cm on a real radio); RX 18&ndash;470 MHz continuous'], ['Power', '5 W high, 1 W low'], ['Modes', 'FM; AM and WFM receive'], ['Supply', 'Internal battery, about 1.6 A on transmit']],
    sections: [
      { h: 'Front panel at a glance', html: `<ul><li>Same layout as other keypad handhelds: two lines, <b>VFO/MR</b>, <b>A/B</b>, <b>BAND</b>, <b>MENU</b>, arrows, <b>EXIT</b>, keypad, <b>*</b> SCAN, <b>#</b> LOCK.</li><li>Distinguishing feature: the receiver covers everything from 18 to 470 MHz with no gaps.</li></ul>` },
      { h: 'Getting started', html: `<ol><li>Select <b>Handheld</b>, then this model from the handheld menu (&#9776;).</li><li>Press <b>BAND</b> repeatedly; the cycle now includes airband.</li></ol>` },
      { h: 'Receiving', html: `<p>Airband (108&ndash;137 MHz) is amplitude modulated; type a tower frequency such as <code>121500</code> and the radio selects AM automatically. Preset channels include the nearest tower, its weather broadcast and the guard frequency. Use <b>*</b> to scan a list of aviation channels in memory mode; scanning pauses on activity and resumes after it clears. The front end is simple, so strong nearby transmitters can cause false signals.</p>` },
      { h: 'Transmitting', html: `<p>Hold <b>PTT</b>. Select LOW power with the <b>TXP</b> menu item for close contacts. Remember that this radio can listen to aviation and public-service channels, but transmitting there is prohibited; the simulator refuses any transmit frequency outside your amateur privileges.</p>` },
      { h: 'Repeaters (FM)', html: `<p>Enter the output frequency, confirm the shift icon, set <b>T-CTCS</b>, and save with <b>MEM-CH</b>.</p>` },
      { h: 'Troubleshooting', html: `<dl><dt>Airband sounds garbled</dt><dd>Check the mode icon shows AM.</dd><dt>Transmit refused on a frequency you can hear</dt><dd>Wideband receive does not mean wideband transmit; only 2 m amateur frequencies are allowed.</dd></dl>` },
    ],
  },

  ft60r: {
    title: 'Rugged Dual-Band Handheld (HT-B1)',
    summary: 'A durable 5 W 2 m and 70 cm FM handheld with a large memory capacity and AM airband receive.',
    specs: [['Coverage', 'TX 2 m (70 cm on a real radio); RX 108&ndash;470 MHz'], ['Power', '5 W high, 1 W low'], ['Modes', 'FM; AM receive'], ['Memories', '1000 on a real radio'], ['Supply', 'Internal battery, about 1.5 A on transmit']],
    sections: [
      { h: 'Front panel at a glance', html: `<ul><li>Classic keypad layout with a two-line display.</li><li>Built to survive drops and rain; a sensible choice for emergency-communication volunteers.</li></ul>` },
      { h: 'Getting started', html: `<ol><li>Select <b>Handheld</b> and choose this model from the &#9776; menu.</li><li>Press <b>VFO/MR</b> to browse the preset channels with <b>&#9650;</b>/<b>&#9660;</b>.</li></ol>` },
      { h: 'Receiving', html: `<p>Covers airband and VHF/UHF but not broadcast FM, so <b>CALL</b> does nothing on this model. The receiver is slightly quieter than budget handhelds and holds up well near strong signals.</p>` },
      { h: 'Transmitting', html: `<p>Hold <b>PTT</b>, pause, speak. In a net, use LOW power when the repeater is close to save battery for a long operation. Keep transmissions short and release PTT fully between overs so the repeater can reset and others can break in with priority traffic.</p><div class="callout">For emergency work, program the local repeaters, a simplex pair and the weather channel before you need them, and carry a spare battery.</div>` },
      { h: 'Repeaters (FM)', html: `<p>On a real radio of this class, 1000 memories can be organised into banks for different areas. In the simulator, build a list with <b>MEM-CH</b> (frequency, shift and tone are stored together) and recall entries by number in memory mode.</p>` },
      { h: 'Troubleshooting', html: `<dl><dt>CALL key says no FM broadcast</dt><dd>Expected for this model.</dd><dt>Airband station heard but distorted</dt><dd>Confirm the mode icon shows AM; type the frequency again to reselect it.</dd><dt>Memory list too long to browse</dt><dd>Type the two-digit channel number in memory mode.</dd></dl>` },
    ],
  },

  thd75: {
    title: 'Tri-Band Digital Handheld (HT-C1)',
    summary: 'A high-end 5 W handheld that also receives HF SSB, CW and AM, with position reporting and digital voice on a real radio.',
    specs: [['Coverage', 'TX 2 m (more bands on a real radio); RX 0.1&ndash;524 MHz'], ['Power', '5 W high, 1 W low'], ['Modes', 'FM, AM, LSB, USB, CW; WFM receive; digital voice on a real radio'], ['Supply', 'Internal battery, about 1.8 A on transmit'], ['Extras', 'Satellite positioning and position reporting on a real radio; DSP NR']],
    sections: [
      { h: 'Front panel at a glance', html: `<ul><li>Keypad handheld layout, plus single-sideband receive, which is unusual for a handheld.</li><li>On a real radio of this class, a positioning receiver and a packet position-reporting system let others see your location on a map; digital voice links you to networks. These are not modelled in the simulator.</li></ul>` },
      { h: 'Getting started', html: `<ol><li>Select <b>Handheld</b> and choose this model.</li><li>For HF listening, use the full station view: this radio appears there with all modes enabled, and you can type a frequency such as <code>7200</code> in kHz.</li></ol>` },
      { h: 'Receiving', html: `<p>HF receive through a short whip is limited, but strong broadcast and amateur SSB stations are audible in the evening. In the station view, choose LSB or USB and tune in 10 or 50 Hz steps. NR is available.</p>` },
      { h: 'Transmitting', html: `<p>FM on 2 m as with any handheld. Use the handheld quick buttons or hold <b>PTT</b>. Select LOW with the <b>TXP</b> menu item when a repeater is nearby. In the full station view the POWER slider sets the same radio between 5 W and its maximum.</p>` },
      { h: 'Repeaters (FM)', html: `<p>Enter the output frequency, check the shift icon, set the tone with <b>T-CTCS</b>, then <b>MEM-CH</b>.</p>` },
      { h: 'Troubleshooting', html: `<dl><dt>SSB sounds like ducks</dt><dd>Wrong sideband or slightly off frequency; fine-tune with a 10 Hz step.</dd><dt>No map position</dt><dd>Position reporting is not simulated.</dd></dl>` },
    ],
  },

  // ------------------------------------------------------------------ catalog receivers
  rtlsdr: {
    title: 'USB SDR Dongle Receiver (RX-D1)',
    summary: 'A very low-cost USB receiver with an HF upconverter, run entirely from PC software; a great first listening tool, but with a simple 8-bit front end.',
    specs: [['Coverage', 'RX 0.5&ndash;470 MHz (HF through the built-in upconverter); no transmitter'], ['Converter', '8-bit'], ['Modes', 'LSB, USB, CW, AM, FM, WFM in software'], ['Supply', 'USB bus power'], ['Front end', 'Simple; about 6 dB noisier than a dedicated receiver']],
    sections: [
      { h: 'Front panel at a glance', html: `<p>There is no front panel. Everything is done in software on a computer. In this simulator, the radio panel stands in for that software: waterfall, frequency, mode, filter, gain controls and NR.</p>` },
      { h: 'Getting started', html: `<ol><li>Connect an antenna on the Station wiring page.</li><li>Press <b>FM BC</b> to confirm everything works, then try <b>AIR</b> and <b>NOAA WX</b>.</li><li>For HF, use the band keys or type a frequency in kHz.</li></ol>` },
      { h: 'Receiving', html: `<p>An 8-bit converter has limited dynamic range. Strong broadcast signals can raise the noise floor or create images across the waterfall. The cure is less gain, not more: press <b>ATT</b>, or reduce <b>RF GAIN</b> in Master view, until the noise floor drops and the false signals disappear. On HF a resonant or filtered antenna helps a great deal.</p>` },
      { h: 'Transmitting', html: `<p>Receive only.</p>` },
      { h: 'Matching the antenna', html: `<p>Any antenna can be connected. For VHF a short vertical is fine; for HF a long wire gives the most signal. On a real dongle of this class, the HF input is often a separate path through the upconverter, and a simple broadcast-band filter in line greatly reduces overload on shortwave.</p>` },
      { h: 'Troubleshooting', html: `<dl><dt>Phantom signals everywhere</dt><dd>Overload: press ATT or lower RF GAIN.</dd><dt>Weak signals buried</dt><dd>Try a better antenna rather than more gain.</dd></dl>` },
    ],
  },

  rspdx: {
    title: '14-bit Wideband SDR Receiver (RX-D2)',
    summary: 'A receive-only 14-bit SDR with three antenna inputs and a high-dynamic-range mode for the low bands, operated from PC software.',
    specs: [['Coverage', 'RX 0.5&ndash;470 MHz in the simulator; no transmitter'], ['Converter', '14-bit'], ['Inputs', 'Three selectable antenna ports'], ['Modes', 'LSB, USB, CW, AM, FM, WFM in software'], ['Supply', 'USB bus power'], ['Special', 'High-dynamic-range mode below about 2 MHz']],
    sections: [
      { h: 'Front panel at a glance', html: `<p>A compact box with three antenna connectors and a USB port. All operation is through software; in the simulator, the radio panel is that software window.</p>` },
      { h: 'Getting started', html: `<ol><li>Wire an antenna on the Station wiring page. If you add an antenna switch, the <b>ANT</b> buttons in the TRANSMIT group select between slots, mimicking the three inputs.</li><li>` + FREQ_ENTRY + `</li></ol>` },
      { h: 'Receiving', html: `<p>The 14-bit converter gives a much wider range between the weakest and strongest signals it can handle at once than an 8-bit dongle; the noise floor in the simulator is about 7 dB lower. On a real receiver of this class, the high-dynamic-range mode improves reception of the medium-wave and 160 m bands where strong broadcast stations are nearby. Use NR and narrow filters as you would on a transceiver.</p>` },
      { h: 'Transmitting', html: `<p>Receive only.</p>` },
      { h: 'Matching the antenna', html: `<p>Use different antennas on each input, for example a long wire for HF and a vertical for VHF, and compare them with the antenna buttons.</p>` },
      { h: 'Troubleshooting', html: `<dl><dt>Antenna buttons missing</dt><dd>Add an antenna switch and fill at least one slot.</dd></dl>` },
    ],
  },
};

export const GEAR_GUIDES = {
  psu: {
    title: 'Power supplies and batteries',
    html: `<p>A 100 W transceiver draws roughly 20&ndash;23 A on transmit and about 2 A on receive. The supply must deliver that current continuously at about 13.8 V; if it cannot, the simulator limits your output and Master view explains why.</p>
<table><thead><tr><th>Type</th><th>Strengths</th><th>Watch for</th></tr></thead><tbody>
<tr><td>30 A switching</td><td>Light, inexpensive, ample current</td><td>Can add faint tones (birdies) on the low bands</td></tr>
<tr><td>35 A linear</td><td>Electrically very quiet, robust</td><td>Heavy; continuous rating is below the peak figure</td></tr>
<tr><td>30 A switching with meters</td><td>Shows voltage and current; adjustable noise offset</td><td>Still a switching design</td></tr>
<tr><td>Compact 30 A switching</td><td>Small, convenient DC outlets</td><td>Same as other switchers</td></tr>
<tr><td>12 V sealed lead-acid</td><td>Silent, cheap</td><td>Voltage sags under load; suits low-power radios</td></tr>
<tr><td>20 Ah lithium iron phosphate</td><td>Light, flat voltage curve, quiet</td><td>Needs a matching charger</td></tr>
</tbody></table>
<ol><li>Connect red to <b>+</b> and black to <b>&minus;</b>. Reversed polarity blows the radio&rsquo;s fuse.</li><li>Bond the supply&rsquo;s ground terminal to the station ground bus.</li><li>Switch on the supply before the radio, and off after it.</li></ol>
<div class="callout warn">Fuse both DC leads when connecting to a battery. A shorted lead can deliver hundreds of amperes.</div>` },

  tuner: {
    title: 'Antenna tuners',
    html: `<p>A tuner (more accurately a matching network) transforms the antenna system&rsquo;s impedance to the 50 ohms the radio expects. It does not make the antenna radiate better; it protects the radio and lets it deliver full power.</p>
<ul><li><b>None</b>: rely on the radio&rsquo;s internal ATU or a resonant antenna.</li><li><b>Manual T-network, 300 W</b>: two capacitors and an inductor; matches most coax-fed wires.</li><li><b>Compact automatic, 125 W</b>: finds a match on its own; not rated for amplifiers.</li><li><b>Manual T-network with cross-needle meter, 300 W</b>: reads forward and reflected power while you tune.</li><li><b>Roller-inductor legal-limit</b> and <b>heavy-duty 3 kW roller</b>: for amplifier stations.</li></ul>
<p>The tuner&rsquo;s power rating caps the station: the POWER slider will not exceed it.</p>
<p><b>Tuning a manual T-network</b></p>
<ol><li>In the TRANSMIT group, set <b>POWER</b> to 5&ndash;10 W.</li><li>Check you are on a clear frequency inside your privileges.</li><li>Press <b>BYPASS</b> so it reads <b>IN LINE</b>. The TUNE and LOAD sliders appear.</li><li>Click the meter until it reads <b>SWR</b>.</li><li>Hold <b>CARRIER</b> and move <b>TUNE</b> slowly until the needle dips. Release.</li><li>Hold <b>CARRIER</b> again and move <b>LOAD</b> for a deeper dip. Release.</li><li>Alternate small adjustments until SWR is below 1.5:1, then restore normal power.</li><li>Note the settings for each band; repeat when you change band.</li></ol>
<p><b>Automatic tuners</b>: select the frequency, press <b>TUNE</b>, and wait for the result. The internal tuner handles up to about 3:1; for worse mismatches, put the manual tuner in line first.</p>
<div class="callout warn">Never adjust a tuner at full power. Arcing can damage capacitors, and a severe mismatch can stress the radio&rsquo;s output stage.</div>` },

  meter: {
    title: 'SWR and power meters',
    html: `<p>The meter sits in the coax between the radio and the tuner or antenna. It measures forward power and reflected power, and from them the standing wave ratio.</p>
<ul><li><b>Basic HF/VHF meter</b>: up to 200 W; good for a starter station.</li><li><b>Cross-needle, 2 kW</b>: two needles show forward and reflected power at once; SWR is read where they cross. Suitable with an amplifier.</li><li><b>Wide-range 1.8&ndash;200 MHz</b>: one meter for HF and VHF.</li><li><b>Digital station monitor</b>: precise digital readings and an RF envelope display for checking your signal.</li></ul>
<ol><li>Connect the <b>TX</b> port to the radio and the <b>ANT</b> port toward the antenna. Reversing them swaps the forward and reflected readings.</li><li>Pick a range above the power you will run.</li><li>Read SWR while transmitting a steady carrier or CW.</li></ol>
<table><thead><tr><th>SWR</th><th>Meaning</th></tr></thead><tbody><tr><td>Below 1.5:1</td><td>Excellent</td></tr><tr><td>1.5&ndash;2:1</td><td>Acceptable for most radios</td></tr><tr><td>2&ndash;3:1</td><td>Radio reduces power; use a tuner</td></tr><tr><td>Above 3:1</td><td>Check the antenna, feed line and connectors</td></tr></tbody></table>
<p>The radio&rsquo;s own meter does the same job: click it to show SWR during transmit.</p>` },

  amp: {
    title: 'Linear amplifiers',
    html: `<p>An amplifier raises the radio&rsquo;s output to several hundred watts or more. In the simulator, choosing one raises the top of the POWER slider to the amplifier&rsquo;s output, provided the radio supplies enough drive and the mains circuit and tuner are adequate.</p>
<table><thead><tr><th>Type</th><th>Output</th><th>Drive</th><th>Mains</th></tr></thead><tbody>
<tr><td>Tube, four-tube design</td><td>800 W</td><td>about 70 W</td><td>120 V</td></tr>
<tr><td>Solid-state</td><td>500 W</td><td>about 30 W</td><td>120 V</td></tr>
<tr><td>Single-tube</td><td>1 kW</td><td>about 60 W</td><td>240 V</td></tr>
<tr><td>Automatic solid-state</td><td>1.3 kW</td><td>about 50 W</td><td>240 V</td></tr>
</tbody></table>
<p><b>Tube amplifier tune-up</b></p>
<ol><li>Connect to a dummy load or a well-matched antenna; confirm SWR below 1.5:1 at low power.</li><li>Set the tuning and loading controls to the starting values for the band.</li><li>Apply low drive (10&ndash;20 W) in CW and peak the output with the tune control.</li><li>Increase drive in steps, adjusting load and tune for maximum output while keeping plate current within the rated value.</li><li>Stop at rated output; do not overdrive.</li></ol>
<p>Solid-state amplifiers need no tune-up but must see a low SWR; they shut down on a mismatch.</p>
<p><b>ALC</b>: the amplifier can send a control voltage back to reduce drive. Keep the ALC indicator in Master view out of the red; excess drive causes splatter that interferes with nearby stations.</p>
<p><b>Limits</b>: in the simulator, Technician licensees are limited to 200 W on HF, everyone is limited to 200 W on 30 m, and the general maximum is 1500 W. Use only the power you need.</p>
<div class="callout warn">Tube amplifiers contain lethal voltages that can remain after switch-off. Never open the cabinet while it is connected. At high power, evaluate RF exposure distances and keep antennas away from people.</div>` },

  mic: {
    title: 'Microphones',
    html: `<ul><li><b>Stock hand mic</b>: perfectly adequate; includes the PTT switch.</li><li><b>Broadcast desk mic</b>: shaped response with emphasis on the upper speech frequencies, worth about 1.5 dB of perceived talk power in the simulator.</li><li><b>Boom headset</b>: keeps the microphone at a fixed distance and leaves your hands free; worth about 2 dB, and favoured for contests.</li></ul>
<ol><li>Plug the microphone into the radio&rsquo;s <b>MIC</b> jack on the Station wiring page.</li><li>Speak across the microphone, a few centimetres away, at normal volume.</li><li>Adjust <b>MIC GAIN</b> in Master view so the ALC bar moves on voice peaks but does not stay in the red.</li><li>Use <b>COMP</b> sparingly; heavy compression sounds distorted.</li></ol>
<p>In the simulator, hold <kbd>Space</kbd> to transmit with your computer&rsquo;s microphone. Where the browser supports speech recognition, simulated stations hear what you say; otherwise use the macro buttons.</p>` },

  key: {
    title: 'Keys and paddles',
    html: `<ul><li><b>Straight key</b>: one lever; you form every dot and dash by hand. Good for learning rhythm.</li><li><b>Iambic paddle</b>: two levers feed the radio&rsquo;s electronic keyer: one makes dots, the other dashes, and squeezing both alternates them.</li><li><b>Semi-automatic bug</b>: a mechanical pendulum makes dots automatically; you form dashes by hand.</li></ul>
<ol><li>Plug the key into the radio&rsquo;s <b>KEY</b> jack on the Station wiring page.</li><li>Set <b>KEY SPEED</b> and the sidetone <b>PITCH</b> in Master view.</li><li>Select <b>CW</b> mode, type into the CW box, and press <kbd>Enter</kbd> to send; <b>F1&ndash;F8</b> send stored messages; <kbd>Esc</kbd> stops sending.</li></ol>
<p>Send at a speed you can also copy. Other operators will usually reply at the speed you send.</p>` },

  arrestor: {
    title: 'Lightning protection',
    html: `<p>An arrestor in the coax where it enters the building gives surge current a path to ground before it reaches the radio.</p>
<ul><li><b>Gas-tube arrestor</b>: a gas-discharge element that conducts above a set voltage. Inexpensive and effective when properly bonded.</li><li><b>DC-blocked quarter-wave protector</b>: a shorted stub shunts out-of-band surge energy directly to ground; blocks DC, so it cannot pass power to a remote device.</li></ul>
<ol><li>Mount the arrestor at the entry point, on a grounded panel.</li><li>Bond it to the station ground rod with a short, heavy conductor.</li><li>Bond the station ground bus to the same ground system, including the radio, tuner and supply.</li></ol>
<div class="callout warn">No arrestor makes a station safe from a direct strike. When storms approach, disconnect the antenna feed lines outside the building and unplug the equipment.</div>` },
};

export const manualFor = (id) => MANUALS[id] || null;
