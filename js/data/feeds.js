// Curated directory of free, public, real-radio resources for the Live feeds page.
// Links were checked in November 2026. kind: 'audio' plays in the built-in player; 'web' opens a new tab.

export const LISTENING_RULES = 'Listening is free and, in most countries, legal for amateur, broadcast, weather and many other services. Some laws restrict recording, re-broadcasting or acting on what you hear from non-public services (in the US, 47 U.S.C. §605), and some receiver sites ask you not to embed or redistribute their audio. Use each service on its own terms.';

export const FEED_DIRECTORY = [
  {
    cat: 'Web SDR receivers',
    intro: 'Real software-defined receivers connected to real antennas. You choose the frequency, mode and filter in your browser, so you can hear the bands exactly as an operator at that site does. Most are run by volunteers: be patient if one is busy or offline.',
    items: [
      { name: 'University of Twente WebSDR', url: 'http://websdr.ewi.utwente.nl:8901/', kind: 'web', region: 'Netherlands', desc: 'The best-known WebSDR: 0 to 29 MHz at once, with hundreds of simultaneous listeners. A good first stop for hearing 80, 40 and 20 m.' },
      { name: 'WebSDR.org directory', url: 'http://websdr.org/', kind: 'web', desc: 'List of WebSDR receivers worldwide, covering LF to microwave, with their bands and locations.' },
      { name: 'KiwiSDR receiver map', url: 'http://rx.linkfanel.net/', kind: 'web', desc: 'Map of several hundred public KiwiSDR receivers (0 to 30 MHz). Pick one near or far from you to compare propagation.' },
      { name: 'SkywaveHF KiwiSDR portal', url: 'https://www.skywavehf.com/', kind: 'web', desc: 'Another way to find and open public KiwiSDR receivers.' },
      { name: 'Receiverbook (OpenWebRX)', url: 'https://www.receiverbook.de/', kind: 'web', desc: 'Directory and map of OpenWebRX receivers, many covering VHF/UHF as well as HF, with digital-mode decoders built in.' },
      { name: 'GlobalTuners', url: 'https://www.globaltuners.com/', kind: 'web', desc: 'Remote-controlled real receivers, including scanners and VHF/UHF. Free account required.' },
      { name: 'Airspy SpyServer directory', url: 'https://airspy.com/directory/', kind: 'web', desc: 'Public SpyServer receivers. These need the free SDR# or SDR++ desktop programs rather than a browser.' },
    ],
  },
  {
    cat: 'Amateur radio audio',
    intro: 'Repeaters, nets and linked systems. Listening to real nets is the fastest way to learn the procedures in the Etiquette and protocols articles.',
    items: [
      { name: 'Broadcastify: Amateur Radio feeds', url: 'https://www.broadcastify.com/listen/', kind: 'web', desc: 'Choose your state, then the Amateur Radio genre, to hear local repeaters and nets.' },
      { name: 'AllStarLink node list', url: 'https://www.allstarlink.org/nodelist/', kind: 'web', desc: 'Searchable list of internet-linked repeaters and hubs; many big hubs are also streamed on Broadcastify.' },
      { name: 'EchoLink', url: 'https://www.echolink.org/', kind: 'web', desc: 'Internet linking for repeaters and stations. Transmitting needs a validated licence; the logins page shows who is on.' },
    ],
  },
  {
    cat: 'Aviation',
    items: [
      { name: 'LiveATC.net', url: 'https://www.liveatc.net/', kind: 'web', desc: 'Live tower, approach, centre and ground audio from airports worldwide. Excellent for hearing disciplined, concise radio procedure.' },
    ],
  },
  {
    cat: 'Public safety and weather',
    items: [
      { name: 'Broadcastify', url: 'https://www.broadcastify.com/listen/', kind: 'web', desc: 'About 7,000 live scanner feeds: fire, EMS, police, rail, marine and more, organised by state and county.' },
      { name: 'NOAA Weather Radio streams (WeatherUSA)', url: 'https://www.weatherusa.net/radio', kind: 'web', desc: 'Live audio from NOAA Weather Radio transmitters on 162.400 to 162.550 MHz, by local station.' },
      { name: 'NOAA Weather Radio stream map', url: 'https://noaaweatherradio.org/', kind: 'web', desc: 'Map of volunteer-run NOAA Weather Radio streams.' },
      { name: 'NOAA Weather Radio (official)', url: 'https://www.weather.gov/nwr/', kind: 'web', desc: 'Official transmitter list, frequencies and coverage maps. Not a stream.' },
    ],
  },
  {
    cat: 'Broadcast',
    items: [
      { name: 'Radio Garden', url: 'https://radio.garden/', kind: 'web', desc: 'Thousands of live broadcast stations on a globe: hear what is on the air anywhere in the world.' },
      { name: 'WWV and WWVH on a WebSDR', url: 'http://websdr.ewi.utwente.nl:8901/', kind: 'web', desc: 'Tune 5, 10 or 15 MHz AM to hear the NIST time stations from Colorado and Hawaii when propagation allows: a free real-time propagation check.' },
    ],
  },
  {
    cat: 'Propagation and spots',
    intro: 'Automated receivers report what they actually hear. Call CQ on a real radio, or just look at the map, to see where the bands are open right now.',
    items: [
      { name: 'Reverse Beacon Network', url: 'https://www.reversebeacon.net/', kind: 'web', desc: 'Skimmer receivers worldwide decode CW and digital CQs and report who they hear, how strong and where.' },
      { name: 'PSK Reporter map', url: 'https://pskreporter.info/pskmap.html', kind: 'web', desc: 'Live map of FT8, FT4, PSK and other digital-mode reception reports, filterable by band and callsign.' },
      { name: 'WSPRnet map', url: 'https://www.wsprnet.org/drupal/wsprnet/map', kind: 'web', desc: 'Weak Signal Propagation Reporter: milliwatt beacons and the stations that heard them.' },
      { name: 'WSPR.live', url: 'https://wspr.live/', kind: 'web', desc: 'Fast queries and dashboards over the full WSPR database.' },
      { name: 'DX Summit', url: 'https://www.dxsummit.fi/', kind: 'web', desc: 'Live DX cluster spots posted by operators.' },
      { name: 'NOAA Space Weather Prediction Center', url: 'https://www.swpc.noaa.gov/', kind: 'web', desc: 'Official solar flux, K-index, flare and geomagnetic storm alerts (the same data this simulator uses).' },
      { name: 'HamQSL solar-terrestrial data', url: 'https://www.hamqsl.com/solar.html', kind: 'web', desc: 'Band-condition summary and the familiar solar data banners.' },
    ],
  },
];

// Free self-study resources, shown in the library's learning-path article and on the Live feeds page.
export const LEARNING = [
  ['Licensing', [
    ['HamStudy.org', 'https://hamstudy.org/', 'Free flashcards and practice exams for every US licence class, built from the official pools.'],
    ['KB6NU No-Nonsense Technician guide', 'https://www.kb6nu.com/study-guides/', 'Free PDF for the July 2026 to June 2030 Technician pool (General and Extra guides are low-cost).'],
    ['NCVEC question pools', 'https://www.ncvec.org/index.php/amateur-question-pools', 'The official public-domain pools: Technician 2026–2030, General 2023–2027, Extra 2024–2028.'],
    ['ARRL: Getting licensed', 'https://www.arrl.org/getting-licensed', 'How exams work and how to find a Volunteer Examiner session.'],
    ['Dave Casler, KE0OG (YouTube)', 'https://www.youtube.com/@DaveCasler', 'Clear, short explanations of licence topics and listener questions.'],
    ['Ham Radio Crash Course (YouTube)', 'https://www.youtube.com/@HamRadioCrashCourse', 'Beginner-friendly videos on gear, modes and getting on the air.'],
  ]],
  ['RF engineering and measurement', [
    ['W2AEW (YouTube)', 'https://www.youtube.com/@w2aew', 'Hands-on RF and test-equipment tutorials: oscilloscopes, spectrum analyzers, VNAs, SWR bridges.'],
    ['Keysight: Spectrum Analysis Basics (AN 150)', 'https://www.keysight.com/us/en/assets/7018-06714/application-notes/5952-0292.pdf', 'The classic application note on how swept and FFT analyzers work: RBW, VBW, detectors, noise.'],
    ['Rohde & Schwarz: Fundamentals of Spectrum Analysis', 'https://www.rohde-schwarz.com/us/_252824.html', 'Rauscher\'s textbook, free digital edition.'],
    ['Electronics Notes: radio and RF', 'https://www.electronics-notes.com/articles/radio/', 'Hundreds of short articles on receivers, modulation, antennas and test equipment.'],
    ['Microwaves101', 'https://www.microwaves101.com/encyclopedias', 'Encyclopedia of microwave and RF engineering terms and techniques.'],
    ['MIT OCW 6.013 Electromagnetics and Applications', 'https://ocw.mit.edu/courses/6-013-electromagnetics-and-applications-spring-2009/', 'Full university course on fields, waves, lines and antennas (free, CC BY-NC-SA).'],
  ]],
  ['Software-defined radio and DSP', [
    ['PySDR', 'https://pysdr.org/', 'Free online textbook: sampling, IQ, FFTs, filters and digital modulation, with Python examples.'],
    ['GNU Radio tutorials', 'https://wiki.gnuradio.org/index.php/Tutorials', 'Official step-by-step tutorials for the free signal-processing toolkit.'],
  ]],
  ['Operating, etiquette and band plans', [
    ['Ethics and Operating Procedures for the Radio Amateur', 'https://www.iaru-r1.org/on-the-air/eop/', 'The IARU\'s free guide to good operating (ON4UN and ON4WW), in many languages.'],
    ['ARRL band plan', 'https://www.arrl.org/band-plan', 'US conventions for where each mode operates within each band.'],
    ['IARU Region 2 band plans', 'https://www.iaru-r2.org/en/on-the-air/band-plans/', 'Band plans for the Americas.'],
    ['IARU Region 1 HF Managers Handbook', 'https://www.iaru-r1.org/reference/handbooks', 'Region 1 HF band plan and operating guidance.'],
    ['FCC Part 97 (eCFR)', 'https://www.ecfr.gov/current/title-47/chapter-I/subchapter-D/part-97', 'The US amateur rules themselves.'],
  ]],
  ['Safety', [
    ['ARRL RF exposure calculator', 'https://www.arrl.org/rf-exposure-calculator', 'Online version of the FCC routine evaluation for amateur stations.'],
    ['FCC OET Bulletin 65 Supplement B', 'https://transition.fcc.gov/Bureaus/Engineering_Technology/Documents/bulletins/oet65/oet65b.pdf', 'The FCC\'s amateur-station RF exposure evaluation guide, with tables of compliance distances.'],
  ]],
];
