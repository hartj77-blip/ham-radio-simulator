// Project purpose, what is real versus simulated, and credits for every outside resource.
// Shown on the Help page; the README carries the same information.

export const MISSION = 'Ham Radio Simulator is a safe place for people new to amateur radio to learn, practise and build a station. Everything happens inside your browser: the simulator never transmits a radio signal, so you can make mistakes, key up on any frequency and experiment freely without interfering with licensed operators or any real service.';

export const REAL = [
  ['Space weather', 'Solar flux (F10.7) and planetary K-index from NOAA.'],
  ['Ionosphere', 'Measured foF2, layer height and TEC (NOAA GloTEC) and D-layer absorption (NOAA D-RAP), refreshed every 10 minutes.'],
  ['Weather', 'Local conditions, forecasts and alerts for your area (National Weather Service, Open-Meteo).'],
  ['Terrain', 'Ground elevation around your location (Open-Meteo/Copernicus DEM, USGS 3DEP).'],
  ['Broadcast stations', 'Real AM/FM stations near you, with their live audio streams played from the broadcasters.'],
  ['Airports', 'Real airport locations and published radio frequencies (OurAirports).'],
  ['Time and location', 'Real UTC time and, only if you allow it, your device location (kept in your browser).'],
  ['Other users', 'People shown online are real users of this app; voice between them travels over the internet (WebRTC), never over the air.'],
  ['Historic recordings', 'Mission audio on the Radio history page is real NASA archival audio (public domain), streamed from the Internet Archive.'],
  ['Rules and reference data', 'US band edges and license privileges (FCC Part 97), beacon schedule, repeater conventions and equipment specifications are taken from published sources.'],
];

export const SIMULATED = [
  ['Radio signals', 'Nothing is transmitted or received over the air. Every signal you hear is computed or synthesized in the browser.'],
  ['Amateur stations', 'Operators, QSOs, contests, nets, beacons and repeaters are computer-generated; their callsigns are random and do not belong to real people.'],
  ['Short-range radio', 'CB, FRS walkie-talkie, GMRS and MURS conversations are invented. They are listen-only, as amateur radios may not transmit on those services.'],
  ['Propagation', 'Signal strength and path loss come from a simplified model. It is driven by the live data above when available, but it is not a forecast.'],
  ['Antennas', 'Impedance, SWR and patterns come from a numerical (Method-of-Moments) model. Real installations differ by a few percent.'],
  ['Receiver audio', 'Band noise, static, filtering, AGC, CW tones and synthesized voices.'],
  ['Weather radio and ATIS', 'Real forecast and observation text read by a synthesized voice; aircraft and ambulance traffic is invented.'],
  ['WWV', 'An imitation of the NIST time-signal format, not the real broadcast.'],
  ['License and callsign', 'Practice exams use original questions covering the official topics. A license or callsign earned here has no legal standing; real licenses come from a Volunteer Examiner session and the FCC.'],
  ['Logbook confirmations', 'QSL confirmations and awards are simulated and not recognised by any awards programme.'],
];

// [name, what it is used for, provider / link, terms]
export const SOURCES = [
  ['NOAA Space Weather Prediction Center', 'Solar flux, K-index, GloTEC ionosphere grid, D-RAP absorption', 'https://www.swpc.noaa.gov', 'US Government work, public domain'],
  ['National Weather Service API', 'Forecasts, observations and alerts', 'https://www.weather.gov/documentation/services-web-api', 'US Government work, public domain'],
  ['Open-Meteo', 'Weather fallback and terrain elevation (Copernicus DEM GLO-90)', 'https://open-meteo.com', 'Data CC BY 4.0; Copernicus DEM copyright DLR/ESA'],
  ['USGS 3D Elevation Program (EPQS)', 'Terrain elevation in the US', 'https://www.usgs.gov/3d-elevation-program', 'US Government work, public domain'],
  ['Radio Browser', 'Directory of broadcast stations and stream addresses', 'https://www.radio-browser.info', 'Community database; audio streams belong to the broadcasters'],
  ['OurAirports', 'Airport locations and radio frequencies', 'https://ourairports.com/data/', 'Public domain'],
  ['world-atlas (Natural Earth)', 'Coastlines on the propagation map', 'https://github.com/topojson/world-atlas', 'ISC licence; Natural Earth data is public domain'],
  ['PeerJS and PeerJS Cloud', 'Connecting online users (WebRTC signalling)', 'https://peerjs.com', 'MIT licence'],
  ['jsDelivr and unpkg', 'Content delivery for the two libraries above', 'https://www.jsdelivr.com', 'Free public CDNs'],
  ['Inter and JetBrains Mono (Google Fonts)', 'Typefaces', 'https://fonts.google.com', 'SIL Open Font License 1.1'],
  ['Web Speech API', 'Synthesized voices and push-to-talk speech recognition', 'https://developer.mozilla.org/docs/Web/API/Web_Speech_API', 'Built into your browser; some browsers (e.g. Chrome) send recognised speech to the vendor\'s servers'],
  ['NASA Audio Collection (Internet Archive)', 'Historic mission recordings on the Radio history page', 'https://archive.org/details/nasaaudiocollection', 'NASA / US Government works, public domain'],
  ['GitHub Issues', 'Feedback form submissions', 'https://github.com/hartj77-blip/ham-radio-simulator/issues', 'Requires a GitHub account'],
];

// Published references the simulation is based on (not downloaded).
export const REFERENCES = [
  ['FCC 47 CFR Part 97', 'Amateur bands, license privileges, station identification and power rules', 'https://www.ecfr.gov/current/title-47/chapter-I/subchapter-D/part-97'],
  ['NCVEC question pools', 'Topics covered by the practice exams (questions here are original)', 'https://www.ncvec.org'],
  ['ARRL band plan', 'Conventional CW, data and phone segments', 'https://www.arrl.org/band-plan'],
  ['NCDXF/IARU International Beacon Project', 'Beacon frequencies and transmission schedule', 'https://www.ncdxf.org/beacon/'],
  ['NIST WWV/WWVH', 'Time-signal frequencies and broadcast format', 'https://www.nist.gov/time-distribution/radio-station-wwv'],
  ['NEC-2 (Burke & Poggio, Lawrence Livermore National Laboratory)', 'The Method-of-Moments approach used by the antenna solver (independent implementation)', 'https://www.nec2.org'],
  ['Shimazaki (1955) / Dudeney (1983)', 'Relation between F2-layer height and the M(3000)F2 factor', null],
  ['HFTA, Dean Straw N6BV (ARRL Antenna Book)', 'Concept of the simplified terrain assessment', 'https://www.arrl.org/arrl-antenna-book'],
  ['NFPA 70 (NEC) Article 810', 'Antenna grounding and lightning-protection guidance in the library', 'https://www.nfpa.org'],
  ['Published equipment specifications', 'Typical figures for each class of radio and accessory. Equipment uses generic names and model codes; it is not affiliated with or endorsed by any manufacturer', null],
];
