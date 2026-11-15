# 📻 Ham Shack Simulator

A realistic amateur (ham) radio simulator that runs in the browser. You build a station from the wall plug to the antenna, learn the license-exam material as you go, then get on the air and compete in contests.

**No build step.** It's plain HTML, CSS and ES modules. Serve the folder with any static web server:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000. GitHub Pages works too. Use headphones. Chrome or Edge is recommended, because live voice depends on speech recognition.

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
- **Online:** connect to friends peer-to-peer over WebRTC through PeerJS. The difference from normal game chat is that you only hear another player when you're both on the same frequency and mode **and** propagation supports the path between your two states. Their audio goes through your receiver's filter and noise. CW you send reaches them too.

### The realism underneath
- **Ionosphere:** a sun-position model that drives foF2/MUF, D-layer absorption, skip zones, multi-hop paths, K-index and auroral loss, and sporadic-E on 6 m.
- **Antennas:** feed-point R and X versus frequency, harmonic operation, the effect of height above ground on impedance and take-off angle, radial ground loss, directional patterns, coax loss including the extra loss from SWR, and cross-polarization on FM.
- **Receiver:** band noise and QRN static crashes pass through real Web Audio IF filters (CW tones change pitch as you tune), AGC, FM quieting and squelch. Mistuned or wrong-sideband SSB sounds garbled.
- **Rules:** FCC Part 97 privileges by license class and mode, plus the band-edge check for how much spectrum your signal occupies. Unlicensed players can only transmit into the dummy load.
- **AI operators:** they call CQ, ragchew, run contests, answer only if they can actually hear you, send partial calls when your signal is weak, correct busted calls, slow down to your CW speed, and honor QRS.

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
