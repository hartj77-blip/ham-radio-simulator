# Ham Radio Simulator

A safe place for people new to amateur (ham) radio to learn, practise and build a station. Everything runs in your browser and **nothing is ever transmitted over the air**, so you can wire equipment wrongly, key up on any frequency and experiment freely without interfering with licensed operators or any real radio service.

Open it at https://hartj77-blip.github.io/ham-radio-simulator/ (headphones recommended; Chrome or Edge for voice recognition), or run it locally. There is no build step: it is plain HTML, CSS and JavaScript modules.

```bash
python3 -m http.server 8000
```

## Modes

| Mode | Purpose |
|---|---|
| Training | A guided course of 8 modules and 50 steps: station wiring, antenna construction, reading an analyzer and tuning, searching the bands, propagation, licensing, a first contact and repeaters. Steps are detected as you complete them, each explains why it matters, and checkpoint questions are graded against your actual station and current conditions. |
| Simulation | The full simulator with every radio, antenna and accessory available. You wire, design, measure and tune everything yourself, with engineering readouts. |
| Free Play | The station is wired and matched automatically. Change any equipment, location, time of day or space weather, and click the map to tune the best band to that place. |

## What you can do

- **Learn:** follow the course, read the reference library (53 articles covering stations, antennas, measurement, RF analysis, receiving, propagation, operating, and etiquette and protocols), follow the free self-study path for RF communications, and study for the Technician, General and Extra exams with practice tests.
- **Build:** wire a station connector by connector (polarity, RF path, grounding), design antennas with a Method-of-Moments solver and an SWR/impedance analyzer, place them at a realistic site (yard, rooftop, balcony, park, vehicle and others), assess terrain, and assemble equipment from real-world specifications.
- **Design in one click:** "Find my location & design the best antenna" chooses the band, antenna type, height, orientation and feedline for your goal and site, solves the exact length and explains each decision.
- **Equipment replicas:** 20 radios (base, touchscreen SDR, flagship, mobile, portable, handheld and PC-software receivers) and their accessories, under generic names, each with a faceplate laid out like its real-world class and fully working keys and knobs. Every model has an original operating guide, opened from the radio.
- **Measure (RF tools):** an FFT spectrum analyzer with waterfall, markers, averaging, max hold and five window functions. Nine test signals each teach one technique: resolution bandwidth, weak signals in noise, AM and FM sidebands, two-tone IMD, harmonics, key clicks and SSB. It can also analyse real audio from the microphone/line input, another browser tab (for example a web SDR) or a live feed. Calculators cover levels (W, dBm, µV, S-units), SWR, return loss and mismatch, feedline loss with SWR, electrical length, wattmeter accuracy, coupler directivity and mismatch uncertainty, test-equipment attenuation, EIRP/ERP, line-of-sight link budget, radio horizon and Fresnel zone, receiver sensitivity, FCC RF exposure (MPE), antenna lengths, LC resonance, Q and bandwidth, occupied bandwidth by mode and FFT resolution.
- **Listen (Live feeds):** a checked directory of real web SDR receivers, amateur, air-band, scanner and weather audio, broadcast streams and live propagation spot networks; a search of the Radio Browser stream directory; and your own saved feeds (audio streams play in a built-in player that can send its audio to the spectrum analyzer; receiver pages open in a new tab). Feeds can be exported and imported.
- **Get your bearings:** a "Where you are" panel above the radio follows the dial and answers four questions for whatever is tuned in: who uses this frequency and why, when it works, what to do there, and whether you could listen or transmit in real life (US rules, summarised). "Whole dial" lists every band from 500 kHz to 500 MHz the same way. Each amateur band and each kind of non-amateur traffic has a helper channel, the simulator's own station, which explains the band aloud and in writing: who is on it, what hardware to connect, and what the exam asks about it.
- **Operate:** a transceiver with VFO, filters, AGC, RIT, tuner, meters and waterfall; a dial populated the way real spectrum is used (amateur voice, CW, FT8 and APRS, plus public safety, rail, marine, aviation, business and personal radio, with only a handful of broadcast stations); a propagation map with live ionosphere layers and click-to-analyse paths; a logger with contest practice; a handheld view for phones; and an optional shared band where other users can hear you over the internet.
- **Give feedback:** the question-mark button opens a form that creates a GitHub issue.

## What is real and what is simulated

**Real (live or published data)**
- Space weather: solar flux and K-index (NOAA).
- Ionosphere: measured foF2, layer height and electron content (NOAA GloTEC) and D-layer absorption (NOAA D-RAP), every 10 minutes. These set the maximum usable frequency on every simulated path.
- Weather, forecasts and alerts for your area (National Weather Service, Open-Meteo).
- Terrain elevation around your location (Open-Meteo/Copernicus, USGS).
- The few nearest AM and FM broadcast stations (four per band) and their live audio streams, played from the broadcasters. Broadcasting is deliberately a small part of the dial.
- The nationwide frequencies used for fire, railroad, marine VHF, business, CB, FRS/GMRS, MURS, APRS, FT8, oceanic air traffic and VOLMET.
- Airport locations and published radio frequencies (OurAirports).
- UTC time, and your device location only if you allow it.
- Everything on the Live feeds page (web SDRs, scanner/air-band/weather audio, broadcast streams, spot networks), and any real audio you choose to analyse.
- Other users shown online are real people; their voices travel over the internet (WebRTC), never by radio.
- Band edges and license privileges (FCC Part 97), beacon schedules, repeater conventions and typical equipment specifications from published sources.

**Simulated**
- All radio signals. Nothing is transmitted or received over the air.
- Helper channels are the simulator's own guide stations and do not exist on the air.
- Amateur stations, contacts, contests, beacons and repeaters are computer-generated; callsigns are random and do not belong to real people.
- Propagation is a simplified model driven by the live data above; it is not a forecast.
- Antenna impedance, SWR and patterns come from a numerical model; real installations differ by a few percent.
- Receiver noise, static, filtering and synthesized voices.
- The spectrum analyzer's test signals.
- NOAA Weather Radio and airport ATIS read real forecast and observation text in a synthesized voice; aircraft and ambulance traffic is invented. WWV is an imitation of the NIST format.
- Everyday two-way traffic is invented: fire dispatch with two-tone paging, railroad crews and defect detectors, marine VHF (in states with navigable water), highway, job-site and store radios, CB, FRS, GMRS and MURS, oceanic position reports with SELCAL, and VOLMET weather (its numbers are made up). Some of it follows your live weather.
- Digital signals are imitations of how they sound: FT8 in its 15-second UTC slots on every HF band (with the text a decoder would show), APRS packets on 144.390 MHz, and P25/DMR digital voice, which an analog receiver hears only as a buzz.
- Licenses, callsigns, QSL confirmations and awards earned here have no legal or official standing. Real licenses are issued by the FCC after a Volunteer Examiner session; practice questions are original and cover the official topics, not the official pool.

## Sources and credits

Services and libraries used while the app runs:

| Source | Used for | Terms |
|---|---|---|
| [NOAA Space Weather Prediction Center](https://www.swpc.noaa.gov) | Solar flux, K-index, GloTEC ionosphere grid, D-RAP absorption | US Government work, public domain |
| [National Weather Service API](https://www.weather.gov/documentation/services-web-api) | Forecasts, observations, alerts | US Government work, public domain |
| [Open-Meteo](https://open-meteo.com) | Weather fallback, terrain elevation (Copernicus DEM GLO-90) | Data CC BY 4.0; Copernicus DEM copyright DLR/ESA |
| [USGS 3D Elevation Program](https://www.usgs.gov/3d-elevation-program) | US terrain elevation | US Government work, public domain |
| [Radio Browser](https://www.radio-browser.info) | Broadcast station directory and stream addresses | Community database; streams belong to the broadcasters |
| [OurAirports](https://ourairports.com/data/) | Airport locations and frequencies | Public domain |
| [world-atlas](https://github.com/topojson/world-atlas) / Natural Earth | Map coastlines | ISC licence; Natural Earth is public domain |
| [PeerJS](https://peerjs.com) and PeerJS Cloud | Connecting online users (WebRTC signalling) | MIT licence |
| [jsDelivr](https://www.jsdelivr.com), [unpkg](https://unpkg.com) | Delivering the two libraries above | Free public CDNs |
| [Inter](https://rsms.me/inter/), [JetBrains Mono](https://www.jetbrains.com/lp/mono/) via Google Fonts | Typefaces | SIL Open Font License 1.1 |
| [Web Speech API](https://developer.mozilla.org/docs/Web/API/Web_Speech_API) | Synthesized voices, push-to-talk recognition | Built into the browser; some browsers send recognised speech to the vendor's servers |
| [GitHub Issues](https://github.com/hartj77-blip/ham-radio-simulator/issues) | Feedback submissions | Requires a GitHub account |

Published references the simulation is based on:

- [47 CFR §1.1310](https://www.ecfr.gov/current/title-47/chapter-I/subchapter-A/part-1/subpart-I/section-1.1310) and FCC OET Bulletin 65 Supplement B: RF exposure limits and duty factors.
- IARU Region 1 Technical Recommendation R.1: S-meter calibration. ITU-R P.372: radio noise levels.
- Times Microwave LMR datasheets: coax attenuation.
- [IARU Ethics and Operating Procedures for the Radio Amateur](https://www.iaru-r1.org/on-the-air/eop/) and ARRL net/radiogram practice: etiquette and protocol articles.

- [FCC 47 CFR Part 97](https://www.ecfr.gov/current/title-47/chapter-I/subchapter-D/part-97): amateur bands, privileges, identification and power rules.
- [NCVEC question pools](https://www.ncvec.org): topics covered by the practice exams.
- [ARRL band plan](https://www.arrl.org/band-plan): conventional CW, data and phone segments.
- [NCDXF/IARU International Beacon Project](https://www.ncdxf.org/beacon/): beacon frequencies and schedule.
- [NIST WWV/WWVH](https://www.nist.gov/time-distribution/radio-station-wwv): time-signal frequencies and format.
- [NEC-2](https://www.nec2.org) (Burke and Poggio, Lawrence Livermore National Laboratory): the Method-of-Moments approach used by the antenna solver, independently implemented.
- Shimazaki (1955) and Dudeney (1983): relation between F2-layer height and the M(3000)F2 factor.
- HFTA by Dean Straw, N6BV ([ARRL Antenna Book](https://www.arrl.org/arrl-antenna-book)): concept behind the simplified terrain assessment.
- NFPA 70 (National Electrical Code) Article 810: grounding and lightning-protection guidance in the library.
- Published equipment specifications: typical figures for each class of radio and accessory. All equipment uses generic names and model codes; the project is not affiliated with or endorsed by any manufacturer.

## Privacy

Progress is saved only in your browser. If you allow location access, your coordinates stay in the browser; only an approximate position is sent to the weather, terrain and broadcast services listed above. Your name and callsign are never sent anywhere. Online users see only your simulated callsign, state and frequency.

## Updates

A small service worker loads the newest version when you are online and falls back to the last saved copy when you are offline. Settings, Data shows the version and has Check for update and Reload buttons.
