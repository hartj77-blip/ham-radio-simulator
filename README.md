# Ham Radio Simulator

Amateur radio training and station simulation in the browser. Wire a station from the wall plug to the antenna, design and measure antennas, search the bands, learn propagation and the license material, then operate.

**No build step.** It's plain HTML, CSS and ES modules. Serve the folder with any static web server:

```bash
python3 -m http.server 8000
```

Or open https://hartj77-blip.github.io/ham-radio-simulator/. Headphones recommended; Chrome or Edge is recommended for voice recognition.

## Three modes

Switch at any time from the selector at the top of the screen. Your log, license and course progress are kept.

| Mode | What it is |
|---|---|
| **Training** | A structured course in 8 modules and 50 steps: station wiring, antenna construction, reading the analyzer and tuning, receiving and searching frequencies, propagation, licensing, your first contact, and VHF repeaters. A guide panel says what to do next, detects automatically when you've done it, explains *why* and *how*, and highlights the control. Checkpoint questions are graded against the live simulation: "where is your SWR dip?", "what is the sign of X at 7.150 MHz?", "which band group is best right now?". Each step links to the reference library. |
| **Simulation** | The full technical simulator. Every radio, antenna and accessory is available with no locks. You wire, design, measure and tune everything yourself, with engineering readouts on the band scope. |
| **Free Play** | Automated and relaxed. The station is wired, the antenna is re-cut for whatever band you're on, and a wide-range tuner keeps it matched. A console changes the station preset, radio, antenna, band, location, time of day and space weather on a whim. **Click anywhere on the map**: the simulator ranks every band for the path to that point (path mode, loss and estimated SNR from the propagation model), tunes the best one and finds a station near that location. |

## Pages

| Group | Page | What you do |
|---|---|---|
| Learn | **Course** | Module overview with progress. Start or resume any module or step. |
| Learn | **Reference library** | 35 in-depth articles with diagrams and worked examples. They cover station wiring, grounding, power supplies, antenna theory (dipoles, verticals, EFHW, Yagi, height and ground, feedlines), SWR, the antenna analyzer (R and X), tuners, meters, the band plan, modes, searching a band, receiver controls, the ionosphere, solar indices, band-by-band behaviour, greyline, VHF, licensing, QSOs, repeaters, CW, logging, contesting, emergency communications and RF safety, plus Q-codes, a formula sheet and a glossary. The library is searchable. |
| Learn | **License study** | Study cards and practice exams for Technician, General and Extra, and a VE exam that grants a license and callsign. |
| Build | **Station wiring** | Wire the station by clicking connectors. DC polarity matters: reversing it blows the fuse. Run coax from the ANT jack through the SWR meter and tuner to the lightning arrestor or dummy load, then bond grounds and connect the mic and paddle. |
| Build | **Antenna** | Choose a dipole, inverted-V, quarter-wave vertical, end-fed half-wave or 3-element Yagi. Set the length (or Auto-size with the Method-of-Moments solver), height, radials and coax, then raise it. Sweep it with the analyzer to see SWR, R and X and get trimming advice. This page also has the antenna builder (yard, rooftop, balcony, park, summit, vehicle…) and the site & design planner. |
| Build | **Antenna workbench** | A NEC-style antenna design tool with patterns, and it reads Touchstone (.s1p) files. |
| Build | **Equipment** | Build a station from real-world equipment. An engineering check covers supply current, amplifier drive, tuner and meter ratings, and 240 V. |
| Operate | **Radio** | An HF/6 m/2 m transceiver with VFO, bands and modes, filters, AGC, RIT, ATT, ATU, S/PO/SWR meter, waterfall, the Find bar, a propagation map with path analysis, and a logger with F-key macros. |
| Operate | **Logbook** | Confirmed contacts, progress toward WAS, DXCC and WAC, and ADIF export. |
| Operate | **Contest practice** | Field Day, a DX contest and a State QSO Party, with an N1MM-style logger and log checking. |

### Design

The interface uses a neutral graphite theme with one instrument-blue accent; amber is reserved for transmit and attention. Inter is used for UI text and JetBrains Mono for data. There is a sidebar for navigation and a persistent status bar showing station, license, grid, solar indices, band conditions and UTC. Icons are inline SVG line icons; there are no emoji. On tablets the training guide becomes a bottom sheet, and on phones the sidebar collapses behind a menu button.

### Contextual notes
When you hit a situation the exams cover (fuse ratings, grounding, SWR, dipole length, sidebands, band edges, the 10-minute ID rule, repeater offsets and CTCSS, MUF, K-index, NVIS), a short note names the exam sub-element. Training shows it in the guide panel and Simulation shows a brief notice. Free Play stays quiet.

### Voice and online operating
- **Push-to-talk:** hold **Space** or the PTT button. Speech recognition turns what you say into text, and simulated stations reply aloud.
- **A shared, real-time band:** you hear any online operator who transmits on your frequency, if propagation between your two locations supports it. Audio passes through your filter, AGC and noise. All users share the same simulated stations, space weather and UTC time. Audio is peer-to-peer WebRTC through the free PeerJS broker.

### The models underneath
- **Ionosphere:** a sun-position model drives foF2/MUF, D-layer absorption, skip zones, multi-hop paths, K-index and auroral loss, and sporadic-E on 6 m.
- **Antennas:** feed-point R and X versus frequency, harmonic operation, height above ground, radial ground loss, directional patterns, and coax loss including the extra loss from mismatch.
- **Receiver:** band noise and static pass through Web Audio IF filters, AGC, FM quieting and squelch.
- **Rules:** FCC Part 97 privileges by license class and mode, including occupied bandwidth at band edges.
- **Simulated operators:** they answer only if they can actually hear you, send partial calls when your signal is weak, and slow down to your CW speed.

## The real world around your radio
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

## Antenna Workbench (a real design tool)
- **Solver:** a thin-wire Method-of-Moments engine using the same physics as NEC-2: EFIE, Galerkin, triangle basis functions, reduced kernel. It handles free space, perfect ground and real ground (reflection-coefficient approximation for currents, Fresnel coefficients for patterns), copper and aluminium conductor loss, and lumped loads. It runs in a Web Worker.
  - Checked against textbook values: half-wave dipole 80 + j44 Ω (thin wire), resonant at 0.486 λ with 73 Ω and 2.09 dBi; quarter-wave monopole over perfect ground 40 + j22 Ω and 5.13 dBi.
- **Templates:** dipole, inverted-V, ground-mounted vertical (with a radial-loss model), elevated ground plane, end-fed half-wave with a 1:N transformer, 3-element Yagi and quad loop. Auto-tune scales a design to resonate at a target frequency. You can export and import NEC-2 decks to cross-check in 4nec2 or EZNEC.
- **Results:** SWR, R/X and Smith-chart plots, azimuth and elevation patterns, take-off angle, front-to-back ratio, 2:1 bandwidth, a rotatable 3D view of the current distribution, and a cut list.
- **Measurements:** import Touchstone `.s1p` or CSV files, or read a NanoVNA live over Web Serial. The tool can mathematically remove the coax between the analyzer and the antenna, then gives trim advice calibrated to your site.
- **Matching:** every L-network solution, with real component values, efficiency at a given coil Q and the matched bandwidth. Also single-stub matches, quarter-wave transformers and unun/balun suggestions.
- **Accuracy:** expect about 1–3% on resonance in the model. A real site adds a few % (insulation, trees, house wiring). Measure, then trim.

The station antennas use the same solver, including your chosen ground type, wire gauge and a 3% insulated-wire correction.

## Rig builder: real-world equipment
Pick each part of the station from a catalog of real models with approximate published specs:

| Slot | Examples |
|---|---|
| Radios | IC-7300, FT-991A, FT-710, TS-590SG, FT-891, IC-705, Xiegu G90, Elecraft K4D |
| Handhelds | UV-5R, UV-K5, FT-60R, TH-D75 |
| Receivers | RTL-SDR V4, RSPdx |
| Power supplies | Astron, Alinco, Powerwerx, SLA and LiFePO4 batteries |
| Tuners | LDG Z-100Plus, MFJ-949E, Palstar AT2K |
| Meters | Daiwa CN-901, Diamond SX-200, TelePost LP-500 |
| Amplifiers | AL-811H, KPA500, ACOM 1000, SPE 1.3K-FA |
| Other | Heil mics, paddles and keys, lightning arrestors |

Each choice really changes the simulation:

- **Power supply:** a supply with too few amps limits your output. A switching supply adds hash on the low bands.
- **Amplifier:** it needs enough drive from the radio, and some need a 240 V circuit.
- **Tuner and meter:** each has a power rating. A tuner that is too small limits your power.
- **Receivers:** each has its own coverage and gaps. For example, the UV-5R has no airband. Receivers also differ in how quiet they are and in features such as scope, IF shift, notch and preamps.
- **Microphone:** a better mic, plus the speech compressor, adds talk power on SSB.

The engineering check flags every problem and shows the cost, weight and current draw. The builder also draws your desk with the gear and cables.

*Specs are approximate, and model names only identify equipment. This project has no affiliation with any manufacturer.*

## Radio master view
Press **Master view** on the radio to see every control at once:

- **VFO:** A/B, A=B, SPLIT and "UP 5". In split, you transmit on VFO B.
- **RF front end:** preamp 1/2, ATT 6/12/18 dB and RF gain.
- **IF and DSP:** AGC fast/mid/slow/off, IF shift, noise blanker, NR, and a manual notch that removes carriers.
- **CW:** keyer speed and pitch.
- **Transmit:** power, mic gain with an ALC meter (too much splatters), and the speech compressor.

All of these change what you hear and how your signal goes out. The view also includes a live diagram of the receive and transmit chains, from antenna to speaker and from mic to antenna, with the real numbers flowing through them.

## World view
A map and a list of everything on the air, organized by what each service is used for. You can toggle each kind of service on or off: amateur HF, VHF and repeaters, beacons, time stations, AM and FM broadcast, aviation, weather, public safety and real players. Each kind comes with a short explanation of its use. You can switch between **My area** (250 km) and **World**, and click a marker or Tune to listen.

## Handheld (phones)
On a phone the app opens to a **handheld radio**. On desktop, switch with the Handheld button. Phone players get a UV-5R the first time they start.

- **Built-in memory channels** for what's really around you: local repeater (offset and tone set), 2 m simplex, NOAA Weather Radio, HEAR, the nearest airport tower and ATIS, aviation guard and nearby FM stations. You can save your own too.

The handheld works like a real dual-band HT:

- **Display:** two lines, A and B. Use **VFO/MR** to switch between frequency and memory-channel modes, **A/B** to pick a line, and **BAND** to cycle through VHF, UHF, FM broadcast and airband.
- **Keypad:** type six digits to set a frequency. **\*** starts a scan and **#** locks the keypad when held.
- **MENU:** a numbered menu on the LCD with SQL, STEP, TX power, shift, offset, CTCSS tone, beep and memory channels. Use ▲▼ to choose and MENU to edit.
- **Side keys and knob:** a PTT bar, **MONI** to open the squelch, **CALL** for the FM broadcast radio, and a volume knob.
- **Models:** choose a UV-5R, UV-K5, FT-60R or TH-D75 from . Each has its own coverage, modes and display.

On iPad and other touch screens, buttons and sliders get bigger automatically, the tabs scroll sideways, and the radio layout adapts to the screen.

## Antenna builder (Antenna page): wherever you live or operate
First pick the place you're putting the antenna:

| Place | Highlights |
|---|---|
| Suburban yard | |
| Rural acreage | |
| City rooftop | |
| Apartment balcony | set your floor |
| HOA / condo | attic dipole or flagpole stealth antennas |
| Park (POTA) | |
| Summit (SOTA) | |
| Vehicle | loaded mobile whip |
| Sailboat | |
| Beach / island trip | |

Each place sets:

- **Supports:** trees, buildings, balcony railings, roof masts, fibreglass poles, the car mount or the boat's mast. You can edit their height and position.
- **Space:** how much room you have.
- **Ground:** for example, salt water at sea or poor ground on a rooftop.
- **Antennas:** which antennas are practical there.
- **Rules and tips:** local and international ones, such as leases and the OTARD rule, HOA covenants and PRB-1, POTA/SOTA etiquette, reciprocal licensing abroad (CEPT, IARP), and marine licensing.

The place also changes the simulation:

- **Noise:** man-made noise relative to a typical suburb, from about −10 dB on a summit to +10 dB on an apartment balcony (based on the ITU-R P.372 noise categories).
- **Losses:** extra loss from concrete and steel, indoor attics, or a shortened mobile whip (about −8 dB on 40 m).
- **Ground:** the place's ground type is used for the antenna.
- **VHF range:** the height of your balcony, roof or mast sets your radio horizon.

From your supports, the builder works out the real feed-point height including sag, how much rope you need, how far an inverted-V's legs droop (which changes its resonance in the solver), the slope of an end-fed, the radials you need (on the ground, elevated, the car body as counterpoise, or the sea itself), and whether the wire fits at all. When a wire is too long it tells you how to deal with it: let the ends hang down, or bend them along the rafters in an attic.

You also get a **bill of materials** with typical prices and a six-step **build checklist**.

## Settings
Press in the top bar:

- **Audio:** master volume, band-noise level, static crashes on or off, sidetone volume and pitch, AI voices on or off.
- **Display:** text and control size, touch mode, which view the app opens in (handheld or station, useful on iPad), PTT on the left for left-handed users, reduced motion.
- **Mode & guidance:** mode, restarting the training course, contextual notes, Explain mode, and how patient simulated operators are.
- **Operating:** PTT key and CW speed.
- **Time:** time warp and space weather.
- **Location and privacy:** your location settings.
- **Your data:** export and import your save, or reset.

## Site & design planner (Antenna page)
The professional design steps, using your real site:

- **Exact length.** The planner solves the antenna you actually have with the Method-of-Moments engine: its height, ground type, wire gauge and insulation. It uses a root-finder on the feed-point reactance and takes about five solves. It shows the result next to the 468/f rule of thumb, so you can see why real antennas differ from the formula.
- **Height for your goal.** Pick NVIS (local), regional or DX. The planner gives the height that puts the main lobe at the right take-off angle, h = λ / (4 sin θ). Your supports cap that height, and the planner tells you how many dB you give up.
- **Real terrain.**
  - It reads the real ground elevation at your location, from Open-Meteo (Copernicus 90 m DEM) worldwide, with USGS 3DEP as a fallback in the US.
  - It takes elevation profiles out to 16 km toward Europe, Asia, South America, Africa and the Pacific.
  - It computes the slope and the horizon angle in each direction. Ground that falls away tilts your lobe lower, which helps DX, and the height recommendation is corrected for it. This is a simplified version of HFTA, the terrain-analysis tool contesters use.
- **Elevation pattern.** It plots the elevation pattern over your ground type, using Fresnel reflection coefficients for real soil, from salt water to sand. Your height is drawn against the ideal height.
- **VHF.** It works out your height above average terrain (HAAT, 3–16 km) and the radio horizon.
- **Your real location.** This is optional. Your browser's location is used only for the elevation lookup and propagation, and is kept in your browser.

**Apply to my antenna** sets the length and height in one click.

## Updates & offline play
A small service worker (`sw.js`) always fetches the newest files first. A new version is picked up on the next load, and an open tab tells you when an update is available. If you're offline, it falls back to the last copy it saved, so the app still starts. **Settings → Data** shows the version you're running and has **Check for update** and **Reload** buttons.

## Disclaimer
The exam questions are original practice questions on the official topics. They are not the NCVEC pool, so study the current official pool before a real exam. Callsigns are randomly generated.
