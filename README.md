# 📻 Ham Shack Simulator

A realistic amateur (ham) radio simulator that runs in the browser. You build a station from the wall plug to the antenna, learn the license-exam material as you go, then get on the air and compete in contests.

**No build step.** It's plain HTML, CSS and ES modules. Serve the folder with any static web server:

```bash
python3 -m http.server 8000
```

Then open https://hartj77-blip.github.io/ham-radio-simulator/ Use headphones. Chrome or Edge is recommended, because live voice depends on speech recognition.

## What you can do

| Tab | What you do |
|---|---|
| 🔌 **Shack** | Wire the station by clicking connectors: the DC leads to the power supply (polarity matters, and reversing it blows the fuse), coax from the radio's ANT jack through the SWR meter and tuner to the lightning arrestor or the dummy load, ground bonding, mic and paddle. |
| 📡 **Antenna** | Pick a dipole, inverted-V, quarter-wave vertical with radials, end-fed half-wave or 3-element Yagi. Cut the wire to length, set the height or radials and the coax, and raise it. Sweep it with the antenna analyzer, which shows the SWR curve plus R and X, then lower it and trim. |
| 📻 **Radio** | An HF/6 m/2 m transceiver with a VFO knob, band and mode buttons, IF filters, AGC, RIT, ATT, squelch, an internal ATU, a manual tuner, a rotator, an S/PO/SWR meter and a live waterfall. Listen to CW and SSB QSOs, NCDXF beacons, and the local 2 m repeater, which needs the correct offset and CTCSS tone. |
| 🏆 **Contests** | Field Day, a DX contest in the style of CQ WW, and a State QSO Party. You can run pileups or search and pounce. The logger works like N1MM, with F-key macros and ESM (Enter Sends Message). After the contest, your log is checked for busted calls, NIL contacts and wrong exchanges. |
| 🪪 **License** | Study cards and practice exams for Technician, General and Extra, plus a "VE exam" that grants your license and callsign. |
| 🛠 **Workbench** | A real antenna design tool, described below. |
| 🛒 **Hamfest** | Spend credits earned by operating on coax, masts and towers, a Yagi and rotator, CW filters, DSP noise reduction and amplifiers. Each upgrade changes the physics. |
| 📒 **Logbook** | Confirmed QSOs, progress toward WAS, DXCC and WAC awards, and ADIF export. |

### Learning as you play
An in-game **Elmer** (mentor) steps in when you hit a situation the exams cover, such as fuse ratings, grounding, SWR, the dipole formula, sideband conventions, band edges, the 10-minute ID rule, repeater offsets and CTCSS, the MUF, the K-index and NVIS. Each tip names the exam sub-element it relates to.

### Voice, like the voice chat in other games
- **Push-to-talk:** hold **Space**, or the PTT button. Speech recognition turns what you say ("Kilo Delta Nine X-ray…, five nine") into text, and the AI stations reply out loud.
- **Online: one shared, real-time band.** Press **Go on the air** once and you stay on the air each time you open the game (you can turn that off). Like a real receiver, you hear *any* player who transmits on the frequency you're tuned to, if propagation between your two states supports it. There's no need to "join" anyone first.
  - **Automatic links:** you link with every player on your current band, and links to players on other bands drop after 30 s.
  - **Realistic tuning:** voices pass through your filter, AGC and noise. Off-tune SSB sounds shifted and garbled, and the wrong sideband sounds inverted ("Donald Duck").
  - **The same world for everyone:** all players share the same AI stations on the same frequencies (generated from the band and the UTC half-hour), the same space weather (from the UTC date and K-index block) and real UTC time.
  - **Roster:** shows every player's call, frequency, mode, who's talking now and whether the band is open between you. **Join** tunes you straight to them.
  - **No server of our own:** the first player online keeps a lobby on the free PeerJS broker, with automatic takeover if they leave. Audio is peer-to-peer WebRTC.

### The realism underneath
- **Ionosphere:** a sun-position model that drives foF2/MUF, D-layer absorption, skip zones, multi-hop paths, K-index and auroral loss, and sporadic-E on 6 m.
- **Antennas:** feed-point R and X versus frequency, harmonic operation, the effect of height above ground on impedance and take-off angle, radial ground loss, directional patterns, coax loss including the extra loss from SWR, and cross-polarization on FM.
- **Receiver:** band noise and QRN static crashes pass through real Web Audio IF filters (CW tones change pitch as you tune), AGC, FM quieting and squelch. Mistuned or wrong-sideband SSB sounds garbled.
- **Rules:** FCC Part 97 privileges by license class and mode, plus the band-edge check for how much spectrum your signal occupies. Unlicensed players can only transmit into the dummy load.
- **AI operators:** they call CQ, ragchew, run contests, answer only if they can actually hear you, send partial calls when your signal is weak, correct busted calls, slow down to your CW speed, and honor QRS.

## 🎛 Easy setup, guidance & customization
- **Three ways to play** (switch any time in 🎛 Station → Game mode):
  - 🎓 **Career:** learn and build everything, earn your license and credits, buy gear.
  - 🧪 **Free play / Lab:** everything unlocked, for testing setups and just operating.
  - 🎧 **Listener:** receive-only and no license needed.
- **One-click station setups:** classic home HF, apartment/stealth, backyard vertical, POTA/Field Day portable, DX tower, contest super-station, VHF/repeater, handheld and scanner listener. Each wires the shack, cuts and raises the antenna and tunes the radio. In Career mode, a setup lists the gear it still needs.
- **Radio models with real limits:**

  | Model | Covers |
  |---|---|
  | All-mode | HF + 6 m + 2 m |
  | Compact SDR | HF + 6 m, narrow filters, DSP |
  | QRP | 10 W portable, no scope |
  | Contest-grade | quietest receiver |
  | Handheld | 2 m FM only |
  | Wideband SDR receiver | receive-only |

  Power, bands, modes, tuner, scope and filters all follow the model.
- **Guidance:**
  - **🎯 Goal bar**, with *Show me* jumping to and highlighting the control.
  - **❓ Explain** mode: hover any control.
  - **FIND bar:** best band now (from propagation *and* your antenna's SWR), a voice or CW CQ to answer, beacons, the local repeater (offset and tone set), WWV, weather and FM broadcast.
- **Add-ons:** a 3-way antenna switch with saved antennas (ANT 1/2/3 on the radio), plus all the earlier Hamfest gear.
- **Pro tools:** Lab readouts on the scope (signal and noise dBm, SNR, path mode, loss, distance, bearing and tuning offset), faceplate themes (graphite, black, silver, retro wood), display colours (green, amber, blue, white), and Radio tab panels you can show or hide.

## 🧓 Elmer, your mentor
In Career mode Elmer (ham slang for a mentor) walks you through everything, one small step at a time. There are 30 steps in 5 chapters: wire the shack, build an antenna, listen, get licensed, and make your first contact.

- **Each step** says exactly what to do. **▶ Show me** jumps to the right tab and highlights the exact connector or button, **❓ Why?** explains the reason, and **🛠 How?** gives detailed instructions.
- **He notices when you get it right**, detecting each step automatically and praising you with the reason it matters.
- **He catches mistakes kindly:** reversed polarity, a wrong connector, a blown fuse, a blocked transmission (with the reason), or a wire cut to the wrong length.
- **Ask Elmer anything** ("why do I need a ground?", "how do I use a repeater?"). A built-in knowledge base of 30+ topics answers *why* or *how* depending on your question, with Show me links.
- **One voice:** the exam-topic lessons appear in his panel instead of pop-ups. You can minimize him, turn step-by-step off, restart the tutorial or hide him (⚙).

## 📟 Handheld mode (phones)
On a phone the app opens to a **handheld radio**, and on desktop you can switch with the 📟 Handheld button.

- **The faceplate:** LCD with channel name, frequency, S-meter, TX/RX and offset/tone indicators; keypad frequency entry; channel up/down; MODE, SHIFT and TONE buttons; and a SCAN that stops on activity.
- **Built-in memory channels** for what's really around you: local repeater (offset and tone set), 2 m simplex, NOAA Weather Radio, HEAR, the nearest airport tower and ATIS, aviation guard and nearby FM stations. You can save your own too.
- **Talking:** a big push-to-talk button, plus quick phrases for when you have no microphone.
- **Getting started:** phone players are handed an HT (5 W, 2 m FM, receive 88–470 MHz including airband AM) on their first launch. The ☰ menu reaches the full station, license study and logbook.

## 🌎 The real world around your radio
The radio is a general-coverage receiver from 0.5 to 470 MHz (it can transmit only in the ham bands). The world it hears is built from live public data. All sources are free, need no API key, and allow browser access (CORS).

| What you hear | Real data | Simulated |
|---|---|---|
| **AM/FM broadcast** (530–1700 kHz, 88–108 MHz) | Real stations from [Radio Browser](https://www.radio-browser.info), with live audio streams, at their **real coordinates** and on the frequency in their name. Low-power FM ("-LP") is modelled at about 100 W. | Transmitter power and height (typical values); stations with unknown locations are left out |
| **NOAA Weather Radio** (162.400–162.550 MHz) | The **real NWS forecast, current observation and active alerts** for your location (api.weather.gov), with the 1050 Hz alert tone | Which of the 7 WX channels your local transmitter uses |
| **Airband** (108–137 MHz AM) | **Real airports near you** and their **published frequencies** (OurAirports); the ATIS reads **real wind, temperature and altimeter**, and the runway in use follows the real wind | The aircraft and controllers (no free live ADS-B feed allows browser access) |
| **WWV / WWVH** (2.5–25 MHz) | Real locations, power, tick format and voice time announcements | – |
| **Ambulances** (HEAR, 155.340 MHz) | The real nationwide hospital channel; your real nearby town | The call traffic (most real public-safety radio is digital/encrypted) |
| **Space weather** | **Live** solar flux and Kp from NOAA SWPC | – |
| **Local weather** | **Live** observation (NWS, or Open-Meteo outside the US). It draws the sky in the antenna scene, and **real thunderstorms add static crashes** on the low bands | – |

Propagation applies to every station: MW groundwave by day and long-distance skywave at night, VHF line of sight using real antenna heights, and HF via the ionosphere model.

## 🛠 Antenna Workbench (a real design tool)
- **Solver:** a thin-wire Method-of-Moments engine using the same physics as NEC-2: EFIE, Galerkin, triangle basis functions, reduced kernel. It handles free space, perfect ground and real ground (reflection-coefficient approximation for currents, Fresnel coefficients for patterns), copper and aluminium conductor loss, and lumped loads. It runs in a Web Worker.
  - Checked against textbook values: half-wave dipole 80 + j44 Ω (thin wire), resonant at 0.486 λ with 73 Ω and 2.09 dBi; quarter-wave monopole over perfect ground 40 + j22 Ω and 5.13 dBi.
- **Templates:** dipole, inverted-V, ground-mounted vertical (with a radial-loss model), elevated ground plane, end-fed half-wave with a 1:N transformer, 3-element Yagi and quad loop. Auto-tune scales a design to resonate at a target frequency. You can export and import NEC-2 decks to cross-check in 4nec2 or EZNEC.
- **Results:** SWR, R/X and Smith-chart plots, azimuth and elevation patterns, take-off angle, front-to-back ratio, 2:1 bandwidth, a rotatable 3D view of the current distribution, and a cut list.
- **Measurements:** import Touchstone `.s1p` or CSV files, or read a NanoVNA live over Web Serial. The tool can mathematically remove the coax between the analyzer and the antenna, then gives trim advice calibrated to your site.
- **Matching:** every L-network solution, with real component values, efficiency at a given coil Q and the matched bandwidth. Also single-stub matches, quarter-wave transformers and unun/balun suggestions.
- **Accuracy:** expect about 1–3% on resonance in the model. A real site adds a few % (insulation, trees, house wiring). Measure, then trim.

The game's own antennas use the same solver, with a 3% insulated-wire correction.

## Disclaimer
The exam questions are original practice questions on the official topics. They are not the NCVEC pool, so study the current official pool before a real exam. Callsigns are randomly generated.
