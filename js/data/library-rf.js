// Library articles: RF analysis and measurement, etiquette and protocols, and a self-study path.
// Same shape as library.js: { id, cat, title, summary, minutes, html, related }.
import { LEARNING } from './feeds.js';

const tool = (label) => `<div class="callout">Try it: open <b>RF tools</b> from the sidebar and use <b>${label}</b>.</div>`;

const learningHtml = LEARNING.map(([group, items]) => `<h4>${group}</h4><ul>${items.map(([n, u, d]) => `<li><a href="${u}" target="_blank" rel="noopener">${n}</a>: ${d}</li>`).join('')}</ul>`).join('');

export const RF_LIBRARY = [
  // ================================================================ RF analysis
  {
    id: 'rf-fundamentals',
    cat: 'RF analysis',
    title: 'RF fundamentals: frequency, wavelength, impedance and resonance',
    summary: 'The handful of relationships that every RF calculation is built on.',
    minutes: 7,
    html: `
<p>Radio frequency (RF) energy is an alternating electromagnetic field. Everything you measure on a station, from SWR to the shape of a signal on a waterfall, comes back to four ideas: <b>frequency</b>, <b>wavelength</b>, <b>impedance</b> and <b>resonance</b>.</p>
<h4>Frequency and wavelength</h4>
<p>A wave travels one wavelength in one cycle. In free space it moves at the speed of light, c = 299,792,458 m/s, so:</p>
<div class="formula">λ (metres) = 299.79 ÷ f (MHz) &nbsp;&nbsp;·&nbsp;&nbsp; 14.2 MHz → 21.1 m &nbsp;·&nbsp; 146 MHz → 2.05 m &nbsp;·&nbsp; 446 MHz → 0.67 m</div>
<p>Band names come from wavelength: the "20 metre band" is 14.0 to 14.35 MHz. In cable, waves travel slower, by the <b>velocity factor</b> (0.66 for solid polyethylene, about 0.8 to 0.85 for foam), so a quarter-wave of RG-213 is only 66% as long as a quarter-wave in air.</p>
<table><thead><tr><th>ITU name</th><th>Range</th><th>Typical amateur use</th></tr></thead><tbody>
<tr><td>MF</td><td>300 kHz – 3 MHz</td><td>160 m, ground wave and night-time skywave</td></tr>
<tr><td>HF</td><td>3 – 30 MHz</td><td>80 m to 10 m, worldwide via the ionosphere</td></tr>
<tr><td>VHF</td><td>30 – 300 MHz</td><td>6 m, 2 m: local, repeaters, sporadic-E, meteor scatter</td></tr>
<tr><td>UHF</td><td>300 MHz – 3 GHz</td><td>70 cm, 23 cm: local, satellites, digital voice</td></tr>
<tr><td>SHF</td><td>3 – 30 GHz</td><td>Microwave links, EME, rain scatter</td></tr></tbody></table>
<h4>Impedance and reactance</h4>
<p>Impedance Z = R + jX combines resistance R (which absorbs or radiates power) with reactance X (which stores energy and returns it every cycle). Inductors have positive reactance that rises with frequency; capacitors have negative reactance that falls with frequency:</p>
<div class="formula">X<sub>L</sub> = 2πfL &nbsp;&nbsp;&nbsp; X<sub>C</sub> = 1 ÷ (2πfC)</div>
<p>An antenna's feedpoint impedance is mostly resistance at resonance; above resonance it becomes inductive (+jX), below it capacitive (−jX). This is exactly what an antenna analyzer shows you.</p>
<h4>Resonance and Q</h4>
<p>When X<sub>L</sub> = X<sub>C</sub> the reactances cancel: f = 1 ÷ (2π√LC). The sharpness of a resonance is its <b>Q</b>, the ratio of centre frequency to −3 dB bandwidth. High-Q circuits are selective (good filters) but narrow (a high-Q antenna has little SWR bandwidth). Loss lowers Q, which is why a lossy antenna can look "broadband" on an analyzer while radiating poorly.</p>
<h4>Skin effect</h4>
<p>RF current flows in a thin layer near the surface of a conductor. At 14 MHz the skin depth in copper is about 17 µm, so the surface condition matters more than the bulk: corroded or steel conductors have far higher RF resistance than their DC resistance suggests.</p>
${tool('LC resonance and reactance')}
<h4>Key points</h4><ul><li>λ(m) = 300 ÷ MHz; shorten by the velocity factor in cable.</li><li>Impedance = resistance + reactance; resonance means the reactance cancels.</li><li>Q = f ÷ bandwidth; low loss gives high Q and narrow bandwidth.</li></ul>`,
    related: ['rf-decibels', 'antenna-basics', 'feedlines'],
  },
  {
    id: 'rf-decibels',
    cat: 'RF analysis',
    title: 'Decibels, dBm and S-units',
    summary: 'Why RF uses logarithms, and how to move confidently between watts, dBm, microvolts and S-units.',
    minutes: 7,
    html: `
<p>Radio signals range from kilowatts at a transmitter to a fraction of a picowatt at a receiver, a span of more than 10<sup>15</sup>. Decibels compress that range and turn multiplication into addition: a chain of gains and losses becomes a simple sum.</p>
<div class="formula">dB = 10·log10(P2 ÷ P1) for power &nbsp;&nbsp;·&nbsp;&nbsp; dB = 20·log10(V2 ÷ V1) for voltage (same impedance)</div>
<table><thead><tr><th>dB</th><th>Power ratio</th><th>Voltage ratio</th></tr></thead><tbody>
<tr><td>1</td><td>1.26</td><td>1.12</td></tr><tr><td>3</td><td>2.0</td><td>1.41</td></tr><tr><td>6</td><td>4.0</td><td>2.0</td></tr><tr><td>10</td><td>10</td><td>3.16</td></tr><tr><td>20</td><td>100</td><td>10</td></tr><tr><td>30</td><td>1000</td><td>31.6</td></tr></tbody></table>
<h4>Absolute units: the letter after dB</h4>
<p>A plain dB is a ratio. Add a reference and it becomes an absolute level:</p>
<ul>
<li><b>dBm</b>: relative to 1 milliwatt. 0 dBm = 1 mW, +30 dBm = 1 W, +50 dBm = 100 W, +60 dBm = 1 kW, −73 dBm = 50 pW.</li>
<li><b>dBW</b>: relative to 1 watt (dBm − 30).</li>
<li><b>dBµV</b>: relative to 1 microvolt. In a 50 Ω system, dBµV = dBm + 107.</li>
<li><b>dBi / dBd</b>: antenna gain relative to an isotropic radiator or a half-wave dipole. dBi = dBd + 2.15. Manufacturers who quote dBi get a bigger number for the same antenna.</li>
<li><b>dBc</b>: relative to the carrier, used for harmonics, sidebands and phase noise (−43 dBc means 43 dB below the wanted signal).</li>
<li><b>dBFS</b>: relative to an analog-to-digital converter's full scale; what an SDR displays before calibration.</li>
</ul>
<h4>S-units</h4>
<p>IARU Region 1 Technical Recommendation R.1 defines S9 as −73 dBm (50 µV into 50 Ω) below 30 MHz and −93 dBm (5 µV) above 30 MHz, with <b>6 dB per S-unit</b>. In practice most analog S-meters are only roughly calibrated, often closer to 3 to 5 dB per S-unit at the low end. Treat S-units as a relative indication unless you have checked the meter against a signal generator.</p>
<h4>Common mistakes</h4>
<ul>
<li><b>Adding absolute levels.</b> Two −80 dBm signals do not make −160 dBm or 0 dBm: convert to watts, add, convert back. Two equal powers add to +3 dB (−77 dBm).</li>
<li><b>Mixing voltage and power dB.</b> A 2× voltage is 6 dB, a 2× power is 3 dB.</li>
<li><b>Overestimating power upgrades.</b> 100 W to 1500 W is 11.8 dB, about two S-units. An antenna improvement of the same size is often cheaper and helps on receive as well.</li>
</ul>
<div class="formula">Received power (dBm) = TX power (dBm) − feedline loss + TX gain − path loss + RX gain − RX feedline loss</div>
${tool('Level converter and Decibels and gain')}`,
    related: ['rf-fundamentals', 'rf-link-budget', 'meters'],
  },
  {
    id: 'rf-spectrum-analysis',
    cat: 'RF analysis',
    title: 'Spectrum analysis: RBW, windows, detectors and noise',
    summary: 'How swept and FFT spectrum analyzers work and how to read one accurately, including on an SDR waterfall.',
    minutes: 11,
    html: `
<p>A spectrum analyzer shows power versus frequency. It answers questions an oscilloscope cannot: is my transmitter clean, how wide is this signal, what is that interference, how far below the signal is the noise? Every SDR panadapter and waterfall is a spectrum analyzer too, so the same rules apply.</p>
<h4>Two architectures</h4>
<p>A <b>swept-tuned</b> analyzer is a superheterodyne receiver whose local oscillator sweeps across the span; a narrow IF filter (the <b>resolution bandwidth</b>, RBW) and a detector draw one point at a time. An <b>FFT</b> analyzer (and every SDR) digitises a block of samples and computes all frequencies at once with the fast Fourier transform. Modern instruments combine both: they sweep in FFT-sized chunks.</p>
<h4>Resolution bandwidth</h4>
<p>RBW is the bandwidth of the "filter" that defines each point on the trace. It sets three things at once:</p>
<ul>
<li><b>Resolution</b>: two signals closer together than about one RBW merge into one peak.</li>
<li><b>Noise floor</b>: noise power is proportional to bandwidth, so the displayed noise moves by 10·log10(RBW2 ÷ RBW1). Going from 10 kHz to 100 Hz RBW lowers the noise floor by 20 dB, while a carrier's level does not change.</li>
<li><b>Speed</b>: narrow filters take longer to respond. For an FFT, frame time is N ÷ fs; for a swept analyzer, sweep time grows as span ÷ RBW².</li>
</ul>
<p>For an FFT of N samples at sample rate fs, the bin spacing is fs ÷ N and the RBW is that spacing multiplied by the window's <b>equivalent noise bandwidth</b> (ENBW).</p>
<h4>Windows</h4>
<p>An FFT assumes the block of samples repeats forever. A signal that does not fit a whole number of cycles in the block has a discontinuity at the edges, which smears its energy across many bins (<b>leakage</b>). A window tapers the block to zero at the edges:</p>
<table><thead><tr><th>Window</th><th>ENBW (bins)</th><th>Use</th></tr></thead><tbody>
<tr><td>Rectangular</td><td>1.00</td><td>Narrowest peaks, worst leakage; transients and signals exactly on a bin.</td></tr>
<tr><td>Hann</td><td>1.50</td><td>Good general-purpose choice.</td></tr>
<tr><td>Hamming</td><td>1.36</td><td>Similar to Hann, lower nearest side lobe.</td></tr>
<tr><td>Blackman-Harris (4-term)</td><td>2.00</td><td>Very low leakage: weak signals next to strong ones, harmonics, IMD.</td></tr>
<tr><td>Flat top</td><td>3.77</td><td>Accurate amplitude (under 0.1 dB scalloping error); wide peaks.</td></tr></tbody></table>
<p>With a Hann window, a tone halfway between two bins reads up to 1.4 dB low (<b>scalloping loss</b>). Use a flat-top window, or a marker that interpolates, when the exact level matters.</p>
<h4>Detectors and averaging</h4>
<p>Each display point may represent many measurements. <b>Peak</b> detection shows the highest (good for finding intermittent spurs), <b>sample</b> shows one value, <b>RMS/average</b> shows true power (correct for noise and digital signals). Averaging the logarithm (video averaging in dB) under-reads noise by about 2.5 dB; averaging power, as the simulator does, does not. Averaging reduces the <i>variance</i> of noise, making a weak carrier easier to see, but it does not lower the average noise level: only a narrower RBW does that.</p>
<h4>Reference level, attenuation and dynamic range</h4>
<p>The input mixer or ADC has a maximum level. Too much signal creates distortion products inside the analyzer that look like the transmitter's own spurs. The test: add 10 dB of input attenuation. A real spur drops 10 dB along with everything else; one generated inside the analyzer drops much more. Always pad a transmitter down well below the instrument's maximum input (+20 to +30 dBm for many instruments, less for SDR dongles).</p>
<h4>Measurements you will make</h4>
<ul>
<li><b>Harmonics and spurs</b>: delta marker from the carrier, in dBc. FCC §97.307 requires spurious emissions below 30 MHz to be at least 43 dB below the mean power of the fundamental (transmitters installed after 2002), and at least 60 dB below for 30 to 225 MHz.</li>
<li><b>Two-tone IMD</b>: feed two equal audio tones into an SSB transmitter; third-order products appear at 2f1 − f2 and 2f2 − f1. −30 dBc (relative to one tone) or better is a clean amplifier; ALC overshoot and overdrive make it much worse.</li>
<li><b>Occupied bandwidth</b>: the width containing 99% of the power.</li>
<li><b>FM deviation</b>: find the modulation frequency at which the carrier disappears (β = 2.405).</li>
<li><b>Phase noise</b>: noise skirt either side of a clean carrier, in dBc/Hz at an offset. It sets how close to a strong signal you can hear a weak one (reciprocal mixing).</li>
</ul>
<div class="callout warn">Never connect a transmitter directly to an analyzer, SDR or NanoVNA. Use a dummy load plus a sampler, or a power attenuator, and check the level with the Attenuator calculator first.</div>
${tool('Spectrum analyzer (every lesson above has a test signal)')}`,
    related: ['rf-signal-id', 'rf-sdr', 'rf-modulation', 'rf-noise'],
  },
  {
    id: 'rf-signal-id',
    cat: 'RF analysis',
    title: 'Identifying signals on a waterfall',
    summary: 'Recognise common modes, digital voice, beacons and interference by bandwidth, rhythm and shape.',
    minutes: 8,
    html: `
<p>A waterfall shows frequency across, time downward and strength as colour. With practice you can identify most signals before you decode them. Look at four things: <b>bandwidth</b>, <b>structure</b> (lines, blocks, sidebands), <b>timing</b> (continuous, keyed, periodic) and <b>location</b> in the band plan.</p>
<table><thead><tr><th>Signal</th><th>Width</th><th>What it looks like</th></tr></thead><tbody>
<tr><td>CW (Morse)</td><td>50 to 150 Hz</td><td>A thin dashed line; keying rhythm visible. Key clicks show as faint horizontal flares either side.</td></tr>
<tr><td>FT8</td><td>50 Hz</td><td>Many short blocks starting together every 15 s, around 14.074, 7.074 MHz and so on. FT4 blocks are 7.5 s and about 90 Hz wide.</td></tr>
<tr><td>WSPR</td><td>6 Hz</td><td>Very thin traces about 110 s long within a 200 Hz window, starting on even minutes.</td></tr>
<tr><td>RTTY</td><td>about 250 Hz</td><td>Two parallel lines 170 Hz apart (mark and space), continuous during a transmission.</td></tr>
<tr><td>PSK31</td><td>about 60 Hz</td><td>A single fuzzy line with two faint traces; often several stacked in a small segment.</td></tr>
<tr><td>SSB voice</td><td>2.4 to 3 kHz</td><td>Irregular speckled block on one side of an invisible carrier, following the rhythm of speech.</td></tr>
<tr><td>AM</td><td>6 to 10 kHz</td><td>Strong steady centre carrier with symmetrical sidebands.</td></tr>
<tr><td>NBFM</td><td>11 to 16 kHz</td><td>Wide, flat block that fills the channel; the carrier stays during pauses (squelch tail when it drops).</td></tr>
<tr><td>DMR</td><td>12.5 kHz channel</td><td>Flat block with a pulsed texture from two time slots; sounds like a buzz on an analog radio.</td></tr>
<tr><td>D-STAR / P25 / System Fusion</td><td>6.25 to 12.5 kHz</td><td>Flat, noise-like blocks with sharp edges; continuous during an over.</td></tr></tbody></table>
<h4>Interference and non-amateur signals</h4>
<ul>
<li><b>Switch-mode power supplies, LED drivers, chargers</b>: lines repeated at regular spacing (tens of kHz) across a band, often drifting with load or temperature.</li>
<li><b>Power-line noise</b>: broadband raspy buzz with a 120 Hz rhythm (100 Hz in 50 Hz countries), worse in dry or wet weather depending on the fault.</li>
<li><b>Plasma TVs, solar inverters, VDSL</b>: broad hash covering whole bands; VDSL shows as raised noise in sharply edged blocks.</li>
<li><b>Over-the-horizon radar</b>: very wide, sweeping or pulsed signals that sound like rapid ticking; report them through the IARU Monitoring System.</li>
<li><b>Birdies</b>: steady carriers generated inside your own receiver; they do not change with the antenna disconnected.</li>
</ul>
<div class="callout">Test any mystery signal by disconnecting the antenna. If it stays, it is in your receiver or station. If it goes away, turn off the house breakers one at a time on battery power to find a local source.</div>
<p>The free Signal Identification Wiki (sigidwiki.com) has audio and waterfall samples for hundreds of signals. Use the Web SDR receivers on the Live feeds page to see them on real bands.</p>`,
    related: ['rf-spectrum-analysis', 'modes', 'bandplan', 'interference-protocol'],
  },
  {
    id: 'rf-modulation',
    cat: 'RF analysis',
    title: 'Modulation and bandwidth',
    summary: 'How AM, SSB, FM and digital modes place information in the spectrum, and how wide they must be.',
    minutes: 8,
    html: `
<p>Modulation varies a carrier's amplitude, frequency or phase to carry information. Whatever the method, information creates <b>sidebands</b>, and the faster the information changes, the wider the signal.</p>
<h4>AM</h4>
<p>A carrier modulated by a tone of frequency f<sub>m</sub> produces sidebands at the carrier ± f<sub>m</sub>. Bandwidth is twice the highest audio frequency. At modulation depth m, each sideband is 20·log10(m/2) relative to the carrier (−6 dBc at 100%), and total power is P<sub>c</sub>(1 + m²/2): even at full modulation two-thirds of the power is in the carrier, which carries no information.</p>
<h4>SSB</h4>
<p>Single sideband removes the carrier and one sideband. All transmitter power goes into one sideband about 2.4 to 2.8 kHz wide. Convention: LSB below 10 MHz, USB above (and on 60 m, where the rules specify USB). A good transmitter suppresses the carrier and the opposite sideband by 40 to 60 dB.</p>
<h4>FM</h4>
<p>FM varies frequency by the peak deviation Δf. The modulation index β = Δf ÷ f<sub>m</sub>. The sidebands follow Bessel functions: there are many, spaced at f<sub>m</sub>, and the carrier itself vanishes at β = 2.405, 5.52 and 8.65. Carson's rule estimates the bandwidth containing about 98% of the power:</p>
<div class="formula">BW ≈ 2 × (Δf + f<sub>m</sub>) &nbsp;&nbsp; 5 kHz deviation, 3 kHz audio → 16 kHz &nbsp;·&nbsp; 2.5 kHz deviation (narrow) → 11 kHz</div>
<h4>Digital modes</h4>
<p>Digital modes key the carrier between discrete states. The bandwidth depends on the <b>symbol rate</b> (baud) and the number of tones or phases. FT8 sends 8-tone FSK at 6.25 baud with 6.25 Hz spacing, so it fits in 50 Hz and decodes down to about −21 dB SNR in a 2500 Hz reference bandwidth. RTTY uses 45.45 baud with 170 Hz shift. Wideband modes such as OFDM spread many slow carriers side by side to resist multipath.</p>
<h4>Bandwidth and noise</h4>
<p>A receiver's noise is proportional to its bandwidth. Narrow modes concentrate power where the receiver filter can be narrow, which is why a 5 W FT8 or CW signal can be copied where 100 W of SSB cannot. Every halving of bandwidth gains 3 dB.</p>
<h4>Keeping your signal clean</h4>
<ul><li><b>CW</b>: keying edges of about 5 ms keep the signal narrow; very fast edges produce key clicks.</li>
<li><b>SSB</b>: excessive microphone gain or compression and ALC overshoot cause splatter (IMD) that can extend several kHz from your frequency.</li>
<li><b>Digital</b>: keep the transmitter's ALC at zero by setting audio drive below the ALC threshold; overdriven FT8 shows up as ghost signals across the passband.</li></ul>
${tool('Occupied bandwidth by mode, and the AM, FM, two-tone and CW keying test signals in the spectrum analyzer')}`,
    related: ['modes', 'rf-spectrum-analysis', 'rf-signal-id'],
  },
  {
    id: 'rf-noise',
    cat: 'RF analysis',
    title: 'Noise, sensitivity and dynamic range',
    summary: 'kTB, noise figure, minimum discernible signal, external noise on HF and receiver dynamic range.',
    minutes: 8,
    html: `
<p>Every resistor at a temperature T generates thermal noise. The available noise power in a bandwidth B is kTB, which at 290 K is <b>−174 dBm per hertz</b>. A receiver adds its own noise, expressed as a <b>noise figure</b> (NF) in dB:</p>
<div class="formula">Noise floor (dBm) = −174 + 10·log10(B in Hz) + NF &nbsp;&nbsp; 500 Hz, NF 5 dB → −142 dBm &nbsp;·&nbsp; 2.4 kHz, NF 5 dB → −135 dBm</div>
<p>The <b>minimum discernible signal</b> (MDS) is a signal equal to this floor. Noise temperature is an equivalent way to express NF: T<sub>e</sub> = 290 × (10<sup>NF/10</sup> − 1). A 1 dB NF preamp is 75 K; 3 dB is 290 K.</p>
<h4>HF is limited by external noise</h4>
<p>Below about 30 MHz, natural and man-made noise picked up by the antenna is far stronger than kTB. ITU-R Recommendation P.372 gives typical levels: at 7 MHz, residential man-made noise is around 50 dB above kTB, and even a quiet rural site is around 30 dB above. So a receiver with a 15 dB noise figure is already more sensitive than the band allows. Turning on a preamp on 40 m just amplifies the band noise and strong signals; use the RF attenuator instead if the S-meter noise reading does not change when you switch the preamp off.</p>
<p>The test: disconnect the antenna. If the noise on the S-meter or waterfall drops by several dB, the band noise dominates and receiver sensitivity is not your limit.</p>
<h4>VHF and up</h4>
<p>Above about 50 MHz, especially on weak-signal work, external noise falls towards kTB and receiver NF and feedline loss matter. A low-noise preamplifier at the antenna (before the coax loss) can improve SNR by several dB on 2 m and 70 cm; one in the shack cannot recover loss that came before it.</p>
<h4>Dynamic range</h4>
<p>Sensitivity is only half the story: a receiver must also handle strong signals. <b>Blocking dynamic range</b> is how strong an off-channel signal can be before it desensitises the receiver; <b>IMD dynamic range</b> and third-order intercept (IP3) describe when two strong signals mix to create phantom signals; <b>reciprocal mixing</b> from local-oscillator phase noise raises the noise floor near strong signals. For an ideal N-bit ADC, the signal-to-quantisation-noise ratio is 6.02N + 1.76 dB, and processing gain from a narrow FFT bin adds 10·log10(N/2) for an N-point FFT.</p>
${tool('Receiver sensitivity and FFT analyzer resolution')}`,
    related: ['receiver-controls', 'rf-link-budget', 'rf-sdr'],
  },
  {
    id: 'rf-power-measurement',
    cat: 'RF analysis',
    title: 'Measuring RF power accurately',
    summary: 'Average vs PEP, directional wattmeters, diode and thermal sensors, oscilloscopes, and the errors that catch people out.',
    minutes: 10,
    html: `
<p>"I'm running 100 watts" rarely means exactly that. Knowing how your meter works tells you how far to trust it.</p>
<h4>What kind of power?</h4>
<ul>
<li><b>Average power</b>: heating power averaged over time. Correct for CW key-down, FM, and constant-envelope digital modes.</li>
<li><b>PEP (peak envelope power)</b>: the average power over one RF cycle at the highest peak of the modulation envelope. The FCC limits amateur power as PEP (§97.313). On SSB voice the average is typically only 10 to 30% of PEP, so an average-reading meter on SSB reads far below your PEP.</li>
</ul>
<h4>Directional wattmeters</h4>
<p>A directional coupler samples the forward and reflected waves separately. The classic plug-in element meter is rated <b>±5% of full scale</b>, so a 1000 W element reading 100 W could be anywhere from 50 to 150 W. Choose an element or range where the reading falls in the upper third of the scale. Cross-needle meters read forward and reflected power at once, so the SWR is where the needles cross.</p>
<p>The coupler's <b>directivity</b>, how well it rejects the wave going the other way, limits SWR accuracy. With 20 dB directivity, a perfect 1.0:1 load can read up to 1.22:1. Inexpensive bridges are 15 to 25 dB, so do not chase readings below about 1.2:1 on them.</p>
<h4>Sensors in test equipment</h4>
<ul>
<li><b>Thermal sensors</b> (thermistor, thermocouple) measure heating: true average power for any waveform, slow, the reference standard.</li>
<li><b>Diode sensors</b> are fast and sensitive. Below about −20 dBm they respond to power (square law) and read the true average of any waveform; at higher levels they become peak detectors calibrated for a sine wave and misread modulated signals.</li>
<li><b>Mismatch uncertainty</b>: if both the source and the sensor are imperfectly matched, part of the power bounces between them. With a 1.5:1 source and 1.15:1 sensor, the reading is uncertain by about ±0.16 dB (±4%).</li>
</ul>
<h4>The oscilloscope method</h4>
<p>Across a 50 Ω dummy load (through a suitable attenuator or a probe rated for the voltage), measure the peak-to-peak voltage. For a sine wave, P = V<sub>pp</sub>² ÷ (8R). 100 W into 50 Ω is 200 V<sub>pp</sub>. On SSB, measure the envelope peaks for PEP. Check the scope's bandwidth: a scope is already 3 dB low at its rated bandwidth, so a 20 MHz scope reads a 28 MHz signal several dB low. Use one rated well above the frequency you measure. A two-tone test on a scope shows a clean "string of sausages" envelope; flat tops mean the amplifier is limiting.</p>
<h4>Dummy loads and attenuators</h4>
<p>A good dummy load should show under 1.1:1 across the band you are measuring. Most are rated for short duty (for example 1 kW for 30 seconds in oil). Attenuators also have power ratings, and the first pad in a chain takes nearly all the power. Before connecting any sensitive instrument, work out the level it will see.</p>
<h4>A trustworthy setup</h4>
<ol><li>Transmitter → short, good coax → wattmeter → dummy load.</li><li>Use a steady carrier (CW key-down or FM) at modest power for calibration checks.</li><li>Use the meter's PEP or peak-hold function for SSB.</li><li>Compare two meters if you can; a disagreement of 10% is normal for analog meters.</li></ol>
${tool('Wattmeter accuracy, Directivity and mismatch uncertainty, Power from an oscilloscope, and Attenuator for test equipment')}`,
    related: ['meters', 'swr', 'rf-spectrum-analysis'],
  },
  {
    id: 'rf-antenna-measurement',
    cat: 'RF analysis',
    title: 'Measuring antennas accurately',
    summary: 'Calibration, reference planes, de-embedding coax, common-mode current and what an analyzer can and cannot tell you.',
    minutes: 9,
    html: `
<p>An antenna analyzer or vector network analyzer (VNA) measures impedance at its connector. Getting a meaningful answer about the <i>antenna</i> takes care at every step.</p>
<h4>1. Calibrate at the right place</h4>
<p>A VNA is calibrated by measuring known standards: <b>short, open and load</b> (SOL). The point where you attach them is the <b>reference plane</b>: everything beyond it is measured, everything before it is removed. Calibrate at the end of any adapter or test cable you will use. Recalibrate if you change the frequency span or number of points (or use a calibration that interpolates). A cheap 50 Ω load with 1.1:1 SWR limits your accuracy to that level.</p>
<h4>2. Measure at the feedpoint, or remove the coax mathematically</h4>
<p>Coax transforms impedance. A 50 + j0 Ω antenna reads 50 + j0 Ω through any length of 50 Ω coax, but anything else is rotated around the Smith chart and its SWR is improved by line loss. Either measure at the feedpoint (battery-powered analyzer up the ladder, carefully), or measure the coax's electrical length and loss and <b>de-embed</b> it. The Antenna workbench does this from a Touchstone file or a live NanoVNA sweep.</p>
<h4>3. Watch for common-mode current</h4>
<p>If current flows on the outside of the coax shield, the feedline becomes part of the antenna. Signs: readings change when you touch or move the coax, the resonance shifts with feedline length, RF in the shack. A choke (several turns of coax through a suitable ferrite) at the feedpoint fixes most cases. Test the choke itself: its impedance should be several thousand ohms (resistive) on the bands of interest.</p>
<h4>4. Know what SWR does not tell you</h4>
<p>A low SWR means the load matches 50 Ω; it does not mean the antenna radiates well. A dummy load has perfect SWR. Lossy ground systems, lossy traps and long runs of lossy coax all <i>improve</i> SWR while wasting power. Look at the resistance at resonance: a quarter-wave vertical over a perfect ground is about 36 Ω; if you read 50 Ω, the extra is probably ground loss.</p>
<h4>5. Patterns and gain</h4>
<p>Pattern measurements need the far field, beyond about 2D²/λ (and at least several wavelengths) from the antenna, and a site free of reflections. Practical amateur methods: compare signal reports on the Reverse Beacon Network or WSPR between two antennas switched back and forth, or use a calibrated receiver at a fixed distance on VHF/UHF. Always compare, never trust a single absolute number.</p>
<h4>6. Interference and accuracy</h4>
<p>Analyzers inject a small signal and can be overloaded by nearby AM broadcast stations or other transmitters, giving noisy or wrong readings on low bands. Use more averaging, a narrower IF setting, or a broadcast-band filter.</p>
<div class="callout">Workflow: calibrate at the end of the feedline → sweep → note resonance and resistance → de-embed if needed → trim in small steps (about 1% length per 1% frequency) → re-sweep.</div>`,
    related: ['antenna-analyzer', 'swr', 'feedlines', 'rf-power-measurement'],
  },
  {
    id: 'rf-link-budget',
    cat: 'RF analysis',
    title: 'Link budgets, ERP and the radio horizon',
    summary: 'Predict whether a VHF/UHF or microwave path will work, and express radiated power correctly.',
    minutes: 8,
    html: `
<p>A link budget adds up every gain and loss between two radios and compares the received signal with what the receiver needs.</p>
<div class="formula">P<sub>RX</sub> = P<sub>TX</sub> − L<sub>TX cable</sub> + G<sub>TX</sub> − L<sub>path</sub> + G<sub>RX</sub> − L<sub>RX cable</sub> &nbsp;&nbsp;(all in dB)</div>
<h4>ERP and EIRP</h4>
<p><b>EIRP</b> is the power an isotropic antenna would need to produce the same field in the best direction: transmitter power minus losses plus gain in dBi. <b>ERP</b> uses a dipole as the reference, so ERP = EIRP − 2.15 dB. 50 W into 1.5 dB of feedline and a 6 dBi antenna gives about 141 W EIRP (86 W ERP). Repeater coordinators often specify ERP.</p>
<h4>Free-space path loss</h4>
<div class="formula">FSPL (dB) = 20·log10(d km) + 20·log10(f MHz) + 32.45 &nbsp;&nbsp; 30 km at 146 MHz → 105.3 dB</div>
<p>Doubling the distance adds 6 dB. Higher frequencies do not travel "less far" in free space; the higher loss reflects the smaller capture area of an antenna of a given gain. Real terrain, buildings and foliage add loss on top, often 10 to 30 dB at VHF/UHF in built-up areas.</p>
<h4>Radio horizon</h4>
<p>The atmosphere bends VHF and UHF slightly towards the earth. Modelled as an earth 4/3 its real size:</p>
<div class="formula">d (km) ≈ 4.12 × (√h1 + √h2), heights in metres &nbsp;&nbsp; 10 m and 2 m → 18.9 km</div>
<p>Height is the cheapest gain on VHF: raising an antenna from 3 to 12 m doubles the horizon.</p>
<h4>Fresnel zone clearance</h4>
<p>A radio path is not a thin line. The first Fresnel zone is an ellipsoid around the line of sight; its radius at mid-path is r = 17.32 × √(d ÷ 4f) metres with d in km and f in GHz. Keep at least 60% of it clear of obstacles, or expect extra loss. At 446 MHz over 15 km, the mid-path radius is about 50 m: a hill that does not block the line of sight can still cost several dB.</p>
<h4>Noise and margin</h4>
<p>Compare the received power with the noise floor (−174 dBm/Hz + 10·log10 bandwidth + noise figure) and the SNR the mode needs: roughly 12 dB for good FM voice, 6 dB for SSB, near 0 dB for CW and −20 dB for FT8. The difference is the <b>fade margin</b>. Allow 10 dB or more for a reliable fixed path, more for mobile operation where the signal flutters.</p>
${tool('EIRP and ERP, Line-of-sight link budget, and Radio horizon and Fresnel zone')}`,
    related: ['vhf-propagation', 'rf-decibels', 'rf-noise'],
  },
  {
    id: 'rf-sdr',
    cat: 'RF analysis',
    title: 'Software-defined radio: sampling, I/Q and the FFT',
    summary: 'How an SDR turns RF into numbers, why I/Q matters and what limits its performance.',
    minutes: 8,
    html: `
<p>A software-defined radio digitises a slice of spectrum and does the filtering, demodulation and display in software. Every web SDR on the Live feeds page and most modern transceivers work this way.</p>
<h4>Sampling and Nyquist</h4>
<p>A converter sampling at f<sub>s</sub> samples per second can represent frequencies up to f<sub>s</sub>/2 (the Nyquist frequency). Anything above that <b>aliases</b>, folding back to appear at a false frequency. So an SDR has an anti-alias filter in front of the ADC. A direct-sampling HF SDR may sample the whole 0 to 30 MHz range at 60 to 130 MHz.</p>
<h4>I/Q (complex) sampling</h4>
<p>Many SDRs first mix the signal down with two local oscillators 90° apart, producing <b>I</b> (in-phase) and <b>Q</b> (quadrature) signals. Together they distinguish frequencies above and below the centre, so a pair sampled at f<sub>s</sub> shows a full f<sub>s</sub> of bandwidth: a 2.4 MS/s dongle shows 2.4 MHz. Imperfect I/Q balance produces a mirror image of strong signals on the opposite side of centre.</p>
<h4>From samples to spectrum</h4>
<p>The panadapter is an FFT of blocks of samples, as described in the spectrum analysis article. A waterfall stacks successive FFTs. Demodulation filters out one channel, shifts it to baseband and decimates to a lower sample rate.</p>
<h4>Performance limits</h4>
<ul><li><b>ADC bits</b>: an ideal N-bit converter gives 6.02N + 1.76 dB of SNR over the full bandwidth. Narrow channels gain processing gain on top, so a 14-bit ADC (86 dB) can show over 120 dB of range in a 500 Hz bin.</li>
<li><b>Overload</b>: when the total input exceeds full scale, the ADC clips and spurious signals appear everywhere. Use the attenuator or a band filter when a strong local signal is present.</li>
<li><b>Gain setting</b>: too little gain and the ADC's own noise sets the floor; too much and you overload. Increase gain until the band noise rises a few dB above the no-antenna floor, and stop there.</li></ul>
<p>The free PySDR textbook (see the self-study path) goes much further, with code you can run.</p>
${tool('FFT analyzer resolution, and Browser tab audio in the spectrum analyzer while a web SDR plays in another tab')}`,
    related: ['rf-spectrum-analysis', 'rf-noise', 'receiver-controls'],
  },

  // ================================================================ Etiquette & protocols
  {
    id: 'etiquette',
    cat: 'Etiquette & protocols',
    title: 'Operating etiquette: the essentials',
    summary: 'The habits that make you welcome on any band, and the Part 97 rules behind them.',
    minutes: 9,
    html: `
<p>Amateur frequencies are shared: no one owns a frequency (§97.101(b)), and the whole service depends on operators being considerate. In 1928 Paul Segal, W9EEA, wrote <b>The Amateur's Code</b>: the radio amateur is <i>considerate, loyal, progressive, friendly, balanced and patriotic</i>. Nearly every rule of good operating follows from the first word.</p>
<h4>Listen first, then ask</h4>
<ul>
<li>Listen for at least a minute before transmitting; the other half of a contact may be too weak for you to hear.</li>
<li>On CW and digital, send <b>QRL?</b>. On voice, ask "Is this frequency in use?" and then listen again. Only call CQ after silence.</li>
<li>Check the band plan: use the CW, digital and phone segments for those modes, and stay off beacon frequencies, net frequencies at net time, and DX windows.</li>
</ul>
<h4>Identify properly</h4>
<p>§97.119: give your callsign at the end of each communication and at least every 10 minutes during it, in English on phone or in Morse on CW. Tactical calls ("Net Control", "Aid Station 3") are fine as long as you also give your FCC callsign. Unidentified transmissions, including "kerchunking" a repeater, are not allowed.</p>
<h4>Use the minimum power necessary</h4>
<p>§97.313(a): use the minimum power needed to carry out the communication. Turn down for local contacts; a 1500 W signal next door to a QRP station is not considerate.</p>
<h4>What not to transmit</h4>
<p>§97.113 prohibits music (with narrow exceptions), obscene or indecent language, messages encoded to hide their meaning, and communications for your employer or for business. Keep contacts friendly: politics and religion are best avoided on the air, which is heard by everyone.</p>
<h4>Never cause or react to deliberate interference</h4>
<p>§97.101(d) prohibits wilful or malicious interference. If someone is deliberately interfering, <b>do not respond</b> on the air; that is the reaction they want. Move frequency, log the details, and report it (see the interference article).</p>
<h4>Keep your signal clean</h4>
<p>Tune up into a dummy load or a clear frequency, briefly and at low power, and identify. Do not overdrive SSB (splatter) or digital (ALC); keep CW keying soft enough to avoid clicks. A clean narrow signal is the most considerate thing you can transmit.</p>
<h4>On voice</h4>
<ul><li>Pause before speaking so stations can break in, especially on repeaters.</li><li>Speak clearly at a normal pace; use phonetics for callsigns and anything that must be exact.</li><li>Do not use CW Q-codes and abbreviations excessively on phone; plain language is clearer ("my location is", not "my QTH is").</li><li>Let the other station finish. If two of you double, one should yield.</li></ul>
<h4>Working DX and pileups</h4>
<ul><li>Listen to the DX station's pattern before calling. Where is it listening? Is it working by number or area?</li><li>If it says "UP" or "listening 5 to 10 up", it is operating <b>split</b>: transmit on that offset, never on its frequency. Use your radio's split function.</li><li>Call with your full callsign once, then listen. Do not call when it is working someone else or calling a different area.</li><li>Never "tune up" on the DX frequency, and do not tell other operators that they are on the wrong frequency on that frequency: the "frequency police" cause more interference than the mistake.</li><li>Once you are in the log, move on so others get a turn.</li></ul>
<h4>Be helpful</h4>
<p>Welcome newcomers, answer CQs from slow CW operators at their speed, and give honest, useful signal reports. The best way to learn etiquette is to listen to experienced operators on real nets and pileups: try the receivers on the Live feeds page.</p>`,
    related: ['phonetics-procedure', 'qso', 'repeaters', 'interference-protocol'],
  },
  {
    id: 'phonetics-procedure',
    cat: 'Etiquette & protocols',
    title: 'Phonetics, procedure words and prosigns',
    summary: 'The ITU phonetic alphabet, standard voice procedure words, CW prosigns and the RST report.',
    minutes: 7,
    html: `
<h4>ITU phonetic alphabet</h4>
<p>Letters sound alike over a noisy channel (B, D, E, P, T, V). The ITU alphabet, used by aviation, maritime services and amateurs worldwide, avoids that ambiguity:</p>
<table><tbody>
<tr><td>A Alfa</td><td>B Bravo</td><td>C Charlie</td><td>D Delta</td><td>E Echo</td><td>F Foxtrot</td><td>G Golf</td></tr>
<tr><td>H Hotel</td><td>I India</td><td>J Juliett</td><td>K Kilo</td><td>L Lima</td><td>M Mike</td><td>N November</td></tr>
<tr><td>O Oscar</td><td>P Papa</td><td>Q Quebec</td><td>R Romeo</td><td>S Sierra</td><td>T Tango</td><td>U Uniform</td></tr>
<tr><td>V Victor</td><td>W Whiskey</td><td>X X-ray</td><td>Y Yankee</td><td>Z Zulu</td><td></td><td></td></tr></tbody></table>
<p>Numbers are spoken digit by digit; aviation and maritime pronounce 3 "tree", 5 "fife" and 9 "niner". Use the standard words rather than invented ones ("Kilowatt", "Radio"): standard phonetics are recognised by operators of every language. Spell your callsign phonetically when calling and when signal or language makes it necessary; a clear contact on a repeater needs fewer.</p>
<h4>Voice procedure words</h4>
<table><thead><tr><th>Word</th><th>Meaning</th></tr></thead><tbody>
<tr><td>Over</td><td>I have finished; your turn to reply.</td></tr>
<tr><td>Out / Clear</td><td>Contact ended; no reply expected. ("Over and out" is a contradiction.)</td></tr>
<tr><td>Roger</td><td>I received your last transmission. It does not mean yes.</td></tr>
<tr><td>Wilco</td><td>I will comply (includes roger; "roger wilco" is redundant).</td></tr>
<tr><td>Say again</td><td>Repeat your last transmission ("say again all after…").</td></tr>
<tr><td>I spell</td><td>Phonetic spelling follows.</td></tr>
<tr><td>Correction</td><td>I made an error; the correct version follows.</td></tr>
<tr><td>Stand by / Wait</td><td>Pause; I will come back to you.</td></tr>
<tr><td>Break</td><td>I need to interrupt. Reserve for priority or emergency traffic on nets; many groups use "Break break" for emergencies only.</td></tr>
<tr><td>Mayday / Pan-pan</td><td>Distress (life in danger) / urgency. Any station hearing them should stop and listen.</td></tr></tbody></table>
<h4>CW prosigns</h4>
<p>Prosigns are sent as one character with no letter space (shown with a bar).</p>
<table><thead><tr><th>Prosign</th><th>Meaning</th></tr></thead><tbody>
<tr><td>CQ</td><td>Calling any station</td></tr><tr><td>DE</td><td>From (this is)</td></tr>
<tr><td>K</td><td>Over: any station may answer</td></tr><tr><td>KN</td><td>Over: only the station I am working</td></tr>
<tr><td>BK</td><td>Break: quick back-and-forth</td></tr><tr><td>AR</td><td>End of message</td></tr>
<tr><td>SK</td><td>End of contact</td></tr><tr><td>BT</td><td>Separator (=), like a new paragraph</td></tr>
<tr><td>AS</td><td>Wait</td></tr><tr><td>CL</td><td>Closing station, going off the air</td></tr></tbody></table>
<h4>The RST signal report</h4>
<p>R (readability, 1 to 5), S (strength, 1 to 9), T (tone, 1 to 9; CW and digital only). "59" on phone, "599" on CW (often sent "5NN"). Give an honest report: "57, copying you fine with some fading" helps the other operator more than an automatic 59. Contests use 59/599 as a formality.</p>`,
    related: ['etiquette', 'q-codes', 'cw', 'qso'],
  },
  {
    id: 'nets-traffic',
    cat: 'Etiquette & protocols',
    title: 'Nets, net control and formal traffic',
    summary: 'How directed nets run, how to check in, priority traffic, and the ARRL radiogram format.',
    minutes: 9,
    html: `
<p>A <b>net</b> is a scheduled on-air meeting. Nets range from social rag-chews to the National Traffic System and emergency nets. Learning net procedure is the best preparation for public-service and emergency work.</p>
<h4>Open and directed nets</h4>
<p>In an <b>open</b> (informal) net, stations talk freely and take turns. In a <b>directed</b> net, the <b>net control station</b> (NCS) manages everything: no one transmits unless called by NCS, except to check in when asked, or for priority and emergency traffic. Emergency nets are almost always directed.</p>
<h4>Checking in</h4>
<ol><li>Listen to how this net operates: the preamble explains the format.</li><li>When NCS calls for check-ins, unkey, pause, then give your callsign phonetically, once: "Kilo Alpha One Bravo Charlie Delta". Some nets also want your name, location and "with traffic" or "no traffic".</li><li>Wait to be acknowledged. Do not repeat yourself over other stations.</li><li>To leave early, ask NCS: "KA1BCD, request to be excused".</li></ol>
<h4>Priority and emergency traffic</h4>
<p>Any station with emergency traffic (immediate threat to life or property) may break in at any time: in the pause, say "Emergency traffic" or "Break, priority traffic", then your callsign. Everyone else stops transmitting until NCS has handled it. §97.403 allows any means of radio communication when needed to protect life and property and no other means is available.</p>
<h4>Net control's job</h4>
<ul><li>Open on time with the preamble and the purpose of the net.</li><li>Keep a log of check-ins and traffic.</li><li>Call stations in turn; keep transmissions short.</li><li>Identify regularly (every 10 minutes) and close the net formally.</li></ul>
<h4>The ARRL radiogram</h4>
<p>Formal written messages (traffic) follow a fixed format so they can pass through many stations without error:</p>
<table><thead><tr><th>Part</th><th>Contents</th></tr></thead><tbody>
<tr><td>Preamble</td><td>Number · Precedence · Handling instructions (HX) · Station of origin · Check (word count of the text) · Place of origin · Time filed · Date</td></tr>
<tr><td>Address</td><td>Name, street, city, state, ZIP, phone</td></tr>
<tr><td>Text</td><td>Usually 25 words or fewer; "X" for a full stop, "QUERY" for a question mark</td></tr>
<tr><td>Signature</td><td>Who the message is from</td></tr></tbody></table>
<p>Precedence: <b>EMERGENCY</b> (always spelled out), <b>PRIORITY</b> (P), <b>WELFARE</b> (W), <b>ROUTINE</b> (R). In served-agency work (Red Cross, emergency management) you may use the ICS-213 general message form instead. Copy exactly what is sent; never correct or "improve" a message you are relaying.</p>
<h4>Tactical calls and plain language</h4>
<p>During events and emergencies, use tactical callsigns that describe the location or function ("Shelter 2", "Finish line"), plain language rather than Q-codes or 10-codes, and 24-hour local time unless told otherwise. You must still identify with your own callsign every 10 minutes and at the end.</p>
<div class="callout">Practise: find a local net through the Amateur radio audio feeds on the Live feeds page, or the ARES/NTS net in your section, and listen to a few sessions before you check in.</div>`,
    related: ['emergency', 'repeaters', 'phonetics-procedure'],
  },
  {
    id: 'digital-etiquette',
    cat: 'Etiquette & protocols',
    title: 'Etiquette on digital modes, repeaters and linked systems',
    summary: 'Good practice for FT8/FT4, APRS, DMR and other digital voice, and internet-linked repeaters.',
    minutes: 8,
    html: `
<h4>FT8 and FT4</h4>
<ul><li><b>Keep the signal clean.</b> Set the audio drive so the ALC reads zero; reduce power rather than overdrive. Overdriven FT8 creates ghost signals across the passband.</li>
<li><b>Pick a clear transmit frequency</b> and leave "Hold Tx Freq" on. Answer a CQ by calling on your own clear spot rather than on top of the CQing station, unless it is working a pileup that way.</li>
<li><b>Transmit in the right period.</b> Do not transmit in the same 15-second slot as a strong local station you could have heard.</li>
<li><b>Finish properly.</b> RR73 or 73 ends the contact; do not keep repeating if the other station has moved on.</li>
<li><b>DXpeditions using Fox/Hound mode</b>: hounds (callers) transmit above 1000 Hz on the dial frequency the expedition announces, never on the standard FT8 frequency.</li>
<li>Use the minimum power that works; FT8 decodes at −21 dB SNR, so 100 W is rarely necessary.</li></ul>
<h4>APRS</h4>
<ul><li>In North America, APRS uses 144.390 MHz.</li><li>Use a sensible path: WIDE1-1,WIDE2-1 for mobile and portable stations; fixed stations near a digipeater need little or none.</li><li>Do not beacon too often: every 30 minutes for a fixed station, and smart beaconing for vehicles. Every unnecessary packet takes channel time from everyone.</li></ul>
<h4>DMR, D-STAR, System Fusion and other digital voice</h4>
<ul><li>Key up and wait about a second before speaking so the system and the far-end links can connect.</li><li>Leave a gap between overs so other stations can join and the repeater can reset its timeout.</li><li>On wide-area or worldwide talkgroups and reflectors, call, make contact, then move to a local or "TAC" talkgroup for a long conversation.</li><li>Program your radio with a correct radio ID (DMR) or callsign; do not use someone else's ID.</li></ul>
<h4>Linked repeaters (AllStar, EchoLink, IRLP)</h4>
<ul><li>Your voice may be going out over many transmitters across a region or the world. Keep it brief and pause longer between overs (2 to 3 seconds).</li><li>Do not connect a busy local repeater to a large network without checking with its owner.</li><li>Do not "kerchunk" to test access; identify if you key up.</li></ul>
<h4>Packet, Winlink and data</h4>
<p>Check a channel is clear before connecting, respect the published frequencies for each network, and remember that the amateur service may not be used for encrypted traffic or business email.</p>`,
    related: ['etiquette', 'repeaters', 'modes'],
  },
  {
    id: 'interference-protocol',
    cat: 'Etiquette & protocols',
    title: 'Interference: courtesy, troubleshooting and reporting',
    summary: 'What to do when signals collide, when your neighbour hears you, and when someone interferes deliberately.',
    minutes: 7,
    html: `
<h4>Accidental interference</h4>
<p>Most interference is accidental: a station starts transmitting on a frequency it thought was clear, or propagation changes and brings in a station that could not hear you before. Be gracious: "QRL" or "This frequency is in use, thank you" once, and then, if needed, move. Neither of you owns the frequency.</p>
<h4>When your transmitter is the problem (RFI you cause)</h4>
<p>If neighbours report your signal on their TV, audio system or phone:</p>
<ol><li>Check your own station first: is your signal clean (no harmonics, splatter), are cables bonded and is there common-mode current on the feedline?</li><li>Find out exactly when and on which bands it happens.</li><li>Most cases are fixed with ferrite chokes on the affected equipment's cables; this is usually <i>susceptibility</i> of the device, not a fault in your transmitter, but helping solves the problem and keeps good relations.</li><li>The ARRL RFI pages and Technical Information Service have step-by-step guides.</li></ol>
<h4>When you receive interference (RFI you hear)</h4>
<p>Use battery power and switch off household breakers one at a time to find a local source. A portable AM radio or a handheld SDR makes a good direction finder for power-line noise. Utility power-line noise is the responsibility of the utility, and §15.15 and §15.5 make unintentional radiators responsible for not causing harmful interference.</p>
<h4>Deliberate interference</h4>
<ul><li><b>Never respond on the air</b>, not even to say "you are interfering".</li><li>Change frequency if necessary and continue.</li><li>Record the details: date, time (UTC), frequency, mode, what was transmitted, audio or recordings if you can.</li><li>In the US, report it to the ARRL <b>Volunteer Monitor</b> program, which works with the FCC Enforcement Bureau. Elsewhere, contact your national society or regulator.</li></ul>
<h4>Intruders on amateur bands</h4>
<p>Non-amateur signals in exclusive amateur bands (broadcasters, radars, fishing-boat radios) are tracked by the IARU Monitoring System. Use the signal identification article and a web SDR to characterise them, then report through your national society's IARU monitoring coordinator.</p>`,
    related: ['etiquette', 'rf-signal-id', 'grounding'],
  },
  {
    id: 'operating-abroad',
    cat: 'Etiquette & protocols',
    title: 'Operating abroad and international protocol',
    summary: 'Reciprocal licensing, CEPT, callsign formats, regional band-plan differences and third-party rules.',
    minutes: 6,
    html: `
<h4>You need permission in every country</h4>
<p>Your licence is valid only where it was issued. To transmit elsewhere you need either a reciprocal permit or an arrangement that covers you automatically:</p>
<ul><li><b>CEPT T/R 61-01</b>: lets licensees from participating countries (including the US, under conditions that depend on licence class) operate for short visits in other participating countries, mostly in Europe, without a separate licence. Carry your licence, proof of citizenship and the FCC public notice.</li><li><b>IARP</b> (Inter-American Amateur Radio Permit) covers several countries in the Americas.</li><li>Elsewhere, apply to the country's regulator; allow months. Some countries do not permit visitors at all.</li></ul>
<p>US licensees operating in Canada need no permit (US–Canada agreement), but must follow Canadian rules and band limits.</p>
<h4>Callsign format</h4>
<p>Under CEPT and most reciprocal arrangements, put the host country's prefix <i>before</i> your call, separated by a slash: a US station in Germany signs <b>DL/W1AW</b>; in Canada, <b>VE3/W1AW</b> (with the province's prefix). Suffixes such as /P (portable), /M (mobile), /MM (maritime mobile) and /AM (aeronautical mobile) indicate the type of operation; maritime and aeronautical mobile operation also need permission from the vessel's or aircraft's master.</p>
<h4>Different regions, different bands</h4>
<p>The ITU divides the world into three regions with different allocations. Examples: 40 m is 7.000 to 7.300 MHz in Region 2 (the Americas) but only 7.000 to 7.200 MHz in Regions 1 and 3; 80 m phone segments differ; 60 m channels and power limits vary country by country. Use the band plan of the country you are operating in (IARU Region 1, 2 and 3 publish them).</p>
<h4>Third-party traffic</h4>
<p>You may pass messages for, or let an unlicensed person speak to, a station in another country only if the two countries have a third-party agreement (§97.115) or the third party is eligible to be a control operator. The FCC publishes the list of countries with agreements. Messages must not be for business, and no compensation may be involved.</p>
<h4>Language and courtesy</h4>
<p>English is the common language of international amateur radio, but a few words of the other operator's language ("merci", "danke", "gracias", "arigato") are always appreciated. Use standard ITU phonetics, speak slowly, and avoid slang and idioms.</p>`,
    related: ['licensing', 'etiquette', 'bandplan'],
  },

  // ================================================================ Self-study
  {
    id: 'learning-path',
    cat: 'Self-study',
    title: 'A free self-study path for RF communications',
    summary: 'A step-by-step plan from first listening to accurate RF measurement, using this simulator and the best free resources.',
    minutes: 8,
    html: `
<p>Everything below is free. Work through the stages in order, spending a week or two on each. Each stage pairs reading with doing: radio is learned by listening and measuring, not just studying.</p>
<h4>Stage 1: Listen</h4>
<ul><li>Open the <b>Live feeds</b> page and tune a web SDR (the University of Twente receiver is a good start) across 40 m and 20 m in the evening. Find CW, SSB and FT8.</li><li>Listen to a local repeater or net on Broadcastify, and to LiveATC for disciplined procedure.</li><li>Read: <i>Anatomy of a contact</i>, <i>Operating etiquette</i>, <i>Phonetics, procedure words and prosigns</i>.</li></ul>
<h4>Stage 2: Fundamentals</h4>
<ul><li>Read <i>RF fundamentals</i> and <i>Decibels, dBm and S-units</i>. Practise with the Level converter until dBm conversions are automatic.</li><li>Start the Technician question pool on HamStudy.org or in License study here.</li></ul>
<h4>Stage 3: Build a station (in the simulator)</h4>
<ul><li>Follow the Course: wire a station, build and tune a dipole, read the analyzer.</li><li>Read <i>SWR</i>, <i>Feedlines</i> and <i>Measuring antennas accurately</i>. Use the Feedline loss calculator to see why "low SWR" can still mean high loss.</li></ul>
<h4>Stage 4: Spectrum and signals</h4>
<ul><li>Read <i>Spectrum analysis</i> and <i>Identifying signals on a waterfall</i>.</li><li>Work through every test signal in the RF tools spectrum analyzer: resolution, weak signal, AM, FM (find the carrier null), two-tone IMD, harmonics and key clicks.</li><li>Then analyse real audio: play a web SDR in another tab and choose Browser tab audio.</li></ul>
<h4>Stage 5: Propagation and links</h4>
<ul><li>Read the propagation articles and <i>Link budgets</i>. Compare what the simulator's propagation map predicts with what the Reverse Beacon Network and PSK Reporter show live.</li></ul>
<h4>Stage 6: Measurement and safety</h4>
<ul><li>Read <i>Measuring RF power accurately</i> and <i>RF exposure and station safety</i>. Run the RF exposure calculator for the station you plan to build.</li><li>Watch W2AEW's videos on SWR bridges, spectrum analyzers and the NanoVNA.</li></ul>
<h4>Stage 7: Get licensed and on the air</h4>
<ul><li>Pass the practice exams here and on HamStudy.org until you score above 85% consistently, then find a Volunteer Examiner session through the ARRL or your local club.</li><li>Check into a local net. Make your first contacts with the procedure you learned.</li></ul>
<h4>Stage 8: Go deeper</h4>
<ul><li>PySDR for SDR and DSP, the Keysight and Rohde &amp; Schwarz spectrum-analysis primers, and MIT OpenCourseWare for electromagnetics.</li></ul>
<h3>Free resources</h3>
${learningHtml}`,
    related: ['etiquette', 'rf-fundamentals', 'rf-spectrum-analysis', 'licensing'],
  },
];
