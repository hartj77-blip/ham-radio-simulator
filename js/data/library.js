// Reference library: in-depth technical articles linked from Training mode.
// Plain HTML strings; no build step. Diagrams are inline SVG using currentColor
// and theme CSS variables so they render in both light and dark themes.
//
// Shape: { id, cat, title, summary, minutes, html, related: [ids] }

import { RF_LIBRARY } from './library-rf.js';

export const LIBRARY = [
  // ---------------------------------------------------------------- Station
  {
    id: 'station-wiring',
    cat: 'Station',
    title: 'Wiring a station: power, RF path and grounding',
    summary: 'How to deliver clean 13.8 V DC to a transceiver with the right wire gauge, fusing, connectors and polarity.',
    minutes: 6,
    html: `
<p>Nearly every modern HF and VHF transceiver is designed to run from a nominal <b>13.8 V DC</b> supply, the float voltage of a 12 V lead-acid battery. Most manufacturers specify an operating range of roughly 13.8 V ±15% (about 11.7 to 15.9 V). Within that window the radio works, but output power, transmitted signal quality and receiver performance are best near 13.8 V. A station that is wired carelessly will show its faults on transmit, when current demand jumps from about 1 to 2 A to more than 20 A.</p>

<svg viewBox="0 0 640 150" class="diag" role="img" aria-label="DC power wiring: AC outlet to power supply to fused leads to transceiver, all bonded to a ground bus" style="font:12px sans-serif">
<g fill="none" stroke="currentColor" stroke-width="1.5">
<rect x="10" y="30" width="90" height="44" rx="4"/><rect x="160" y="30" width="110" height="44" rx="4"/><rect x="380" y="30" width="110" height="44" rx="4"/>
<path d="M100 52H160"/><path d="M270 44H380M270 60H380" style="stroke:var(--accent)"/>
<rect x="306" y="38" width="22" height="12" style="stroke:var(--accent)"/><rect x="306" y="54" width="22" height="12" style="stroke:var(--accent)"/>
<path d="M30 130H610" stroke-width="3"/><path d="M215 74V130M435 74V130M590 52V130" stroke-dasharray="4 3"/>
<path d="M490 52H590"/>
</g>
<g fill="currentColor"><text x="55" y="56" text-anchor="middle">120 V AC</text><text x="215" y="50" text-anchor="middle">Power supply</text><text x="215" y="66" text-anchor="middle">13.8 V, 30 A</text>
<text x="435" y="56" text-anchor="middle">Transceiver</text><text x="317" y="24" text-anchor="middle">fuses + and −</text><text x="545" y="46" text-anchor="middle">to coax / RF</text><text x="320" y="146" text-anchor="middle">station ground bus (bonded)</text></g>
</svg>

<h4>How much current?</h4>
<p>A 100 W HF transceiver typically draws <b>18 to 23 A</b> at full output on transmit (for example, many current models specify 21 to 22 A maximum) and 1 to 3 A on receive. The power amplifier is only about 35 to 45% efficient, so 100 W of RF requires roughly 250 to 300 W of DC input. VHF/UHF FM mobiles rated at 50 W draw about 10 to 13 A. Size everything in the DC path for the <em>peak</em> transmit current, not the average.</p>
<div class="formula">P = E × I &nbsp;&nbsp; 13.8 V × 22 A ≈ 304 W DC input for 100 W RF output (≈ 33% efficiency)</div>

<h4>Wire gauge and voltage drop</h4>
<p>Voltage drop is the main design constraint. Current flows out on the positive lead and back on the negative lead, so the resistance that matters is the <b>round-trip</b> length. Copper wire resistance at room temperature is approximately:</p>
<table><thead><tr><th>AWG</th><th>Ω per 1000 ft</th><th>Drop at 22 A, 6 ft run (12 ft loop)</th><th>Drop at 22 A, 10 ft run</th></tr></thead>
<tbody><tr><td>14</td><td>2.53</td><td>0.67 V</td><td>1.11 V</td></tr>
<tr><td>12</td><td>1.59</td><td>0.42 V</td><td>0.70 V</td></tr>
<tr><td>10</td><td>1.00</td><td>0.26 V</td><td>0.44 V</td></tr>
<tr><td>8</td><td>0.63</td><td>0.17 V</td><td>0.28 V</td></tr></tbody></table>
<p>A common target is less than 0.5 V of drop at peak current. For a typical desk run of up to about 6 ft (1.8 m), <b>10 AWG</b> is a good choice; 12 AWG is acceptable for short runs. Mobile installations, where the run from the battery to the trunk may be 15 to 20 ft, often need 8 AWG or heavier. The voltage drop is not just an efficiency issue: a radio that sags below about 12.5 V on SSB peaks may produce distorted, splattering audio.</p>

<h4>Fusing</h4>
<p>A fuse protects the <em>wire</em>, not the radio. Place it as close to the source (battery or supply terminals) as practical, and rate it below the ampacity of the conductor but above the radio's peak draw. A 30 A fuse on 10 AWG feeding a 22 A radio is typical. The DC cable supplied with most transceivers already carries fuses in <b>both</b> the positive and negative leads. The negative fuse matters in vehicles: if the negative return opens, return current can try to flow through the coaxial shield, CAT cables or other chassis paths, which are not designed to carry 20 A. Never replace a blown fuse with a higher rating; find out why it blew.</p>

<h4>Connectors: genderless high-current DC connectors</h4>
<p>The de facto amateur DC connector is a <b>genderless, colour-coded snap-together housing</b> that accepts 15 A, 30 A or 45 A contacts (the same housing fits all three). The 30 A contact suits 12 to 16 AWG wire; the 45 A contact suits 10 to 14 AWG. Crimp with the correct ratcheting tool and pull-test each contact. ARES and RACES groups standardized the orientation so that any two stations are compatible: viewed from the mating face with the tongues on top, <b>red is on the right</b> ("red right, tongue top"). A distribution block (for example, a fused Powerpole strip) lets one supply feed several radios with individual fuses.</p>

<h4>Polarity</h4>
<p>Reversing polarity is the most common way to damage a radio. Most transceivers contain a reverse-polarity diode across the input that conducts heavily and blows the fuse, but you should not rely on it. Use red for positive and black for negative throughout, label everything, and check with a meter before first connection. If you use zip cord, the ribbed or marked conductor is conventionally negative; verify it.</p>

<h4>Bonding the station</h4>
<p>Every chassis in the operating position (radio, power supply, tuner, amplifier, computer interface) should be bonded to a common ground bus with short, heavy conductors. Bonding keeps all equipment at the same potential during a fault or lightning surge and reduces RF currents on interconnecting cables. See the grounding article for how the bus connects to the building's electrical ground.</p>

<div class="callout">Practical tip: measure the voltage at the radio's DC jack while transmitting a steady carrier at full power. If it is more than about 0.5 V below the supply's output terminal reading, your wiring is too light or a connection is poor.</div>
<div class="callout warn">Safety: a 12 V battery or 30 A supply can deliver hundreds of amperes into a short circuit, enough to melt wire and start a fire. Always fuse at the source, and never route unfused DC wiring through a vehicle firewall without a grommet.</div>

<h4>Key points</h4>
<ul><li>Design for 13.8 V nominal and about 22 A peak for a 100 W rig.</li>
<li>Keep round-trip voltage drop under about 0.5 V; 10 AWG for typical desk runs.</li>
<li>Fuse both leads, close to the source, sized to protect the wire.</li>
<li>Use these connectors in the standard "red right, tongue top" orientation.</li>
<li>Check polarity with a meter before connecting a radio.</li></ul>
`,
    related: ['power-supplies', 'grounding', 'rf-path', 'formulas'],
  },
  {
    id: 'rf-path',
    cat: 'Station',
    title: 'The RF path: from transceiver to antenna',
    summary: 'The order of meter, tuner, arrestor and feedthrough between radio and antenna, and the coaxial connectors that join them.',
    minutes: 6,
    html: `
<p>The RF path is every component the transmitted signal passes through between the transceiver's antenna connector and the antenna itself. Each item has a specific job, and the order in which they are connected matters for both measurement and safety.</p>

<svg viewBox="0 0 660 110" class="diag" role="img" aria-label="RF path block diagram: radio, power and SWR meter, tuner, lightning arrestor, wall feedthrough, antenna" style="font:11px sans-serif">
<g fill="none" stroke="currentColor" stroke-width="1.5">
<rect x="6" y="30" width="78" height="40" rx="4"/><rect x="110" y="30" width="86" height="40" rx="4"/><rect x="222" y="30" width="78" height="40" rx="4"/><rect x="326" y="30" width="86" height="40" rx="4"/><rect x="438" y="30" width="86" height="40" rx="4"/>
<path d="M84 50H110M196 50H222M300 50H326M412 50H438M524 50H600V18" style="stroke:var(--accent)"/>
<path d="M584 18H616M600 18L586 4M600 18L614 4"/><path d="M369 70V96M357 96H381M361 101H377M365 106H373"/>
<path d="M481 22V78" stroke-dasharray="3 3" style="stroke:var(--muted)"/>
</g>
<g fill="currentColor" text-anchor="middle"><text x="45" y="54">Radio</text><text x="153" y="47">Power/SWR</text><text x="153" y="61">meter</text><text x="261" y="54">Tuner</text><text x="369" y="47">Lightning</text><text x="369" y="61">arrestor</text><text x="481" y="47">Wall</text><text x="481" y="61">feedthrough</text><text x="600" y="100">Antenna</text></g>
</svg>

<h4>The usual order, and why</h4>
<ol>
<li><b>Transceiver.</b> Its output network is designed for a 50 Ω resistive load.</li>
<li><b>Low-pass filter</b> (optional, HF). Attenuates harmonics that could cause TV or other interference. It is designed for 50 Ω, so it belongs on the radio side of the tuner where the impedance is matched.</li>
<li><b>Power/SWR meter.</b> Placed between radio and tuner, it shows the SWR the <em>radio</em> sees. This is the reading you adjust the tuner to minimize and the one that tells you whether the transmitter is safe. A meter placed after the tuner would instead show the SWR of the antenna system, which the tuner cannot change. Some operators fit a second meter there for diagnostic purposes.</li>
<li><b>Antenna tuner</b> (if used). Transforms whatever impedance the feedline presents into 50 Ω for the radio.</li>
<li><b>Antenna switch</b> (if used). In stations with several antennas.</li>
<li><b>Lightning arrestor (antenna discharge unit).</b> Mounted where the feedline enters the building, ideally outside or on a grounded entry panel, and bonded to the single-point ground. Its job is to divert surge energy to ground <em>before</em> it reaches the operating position.</li>
<li><b>Wall feedthrough.</b> A bulkhead panel or weatherproof entry. A metal entry panel bonded to ground can serve as the single-point ground for all coax, rotator and control lines.</li>
<li><b>Feedline and antenna.</b> Coax runs to the feedpoint; for balanced antennas a balun or common-mode choke is fitted there.</li>
</ol>

<h4>Coaxial connectors</h4>
<table><thead><tr><th>Connector</th><th>Mating</th><th>Practical upper limit</th><th>Typical use</th></tr></thead><tbody>
<tr><td><b>PL-259 / SO-239</b> ("UHF")</td><td>Threaded coupling ring</td><td>Excellent at HF; acceptable to about 150 to 300 MHz</td><td>HF and most VHF transceivers, tuners, meters</td></tr>
<tr><td><b>Type N</b></td><td>Threaded, gasketed</td><td>About 11 GHz; constant 50 Ω</td><td>VHF/UHF, outdoor connections, high-quality coax such as LMR-400</td></tr>
<tr><td><b>BNC</b></td><td>Bayonet (quarter turn)</td><td>About 4 GHz</td><td>Test equipment, older handhelds, low-power links</td></tr>
<tr><td><b>SMA</b></td><td>Small threaded</td><td>About 18 GHz</td><td>Handheld radios, SDRs, analyzers</td></tr></tbody></table>
<p>The PL-259/SO-239 pair, despite the "UHF" name, is not constant-impedance, which is why Type N is preferred above 2 m. Handhelds are a frequent source of confusion: many radios have an SMA-<em>male</em> jack and accept SMA-female antennas, while others, notably many low-cost imports, use the opposite (radio SMA-female). Buy adapters for the specific radio. Every adapter adds a small loss and another potential point of failure, so minimize them, especially outdoors.</p>

<h4>Assembly and weatherproofing</h4>
<p>A properly installed PL-259 has the center pin soldered and the braid either soldered through the body holes or clamped (crimp types). Check with an ohmmeter that the center conductor is not shorted to the shield before use. Outdoor connections should be wrapped first with a layer of electrical tape, then self-amalgamating (self-fusing) tape, then a final layer of UV-resistant electrical tape; the first layer makes later removal easy. Form a drip loop so water runs away from the connector, and point connectors downward where possible.</p>

<div class="callout">Practical tip: when troubleshooting a high SWR, move the meter step by step toward the antenna. A reading that changes abruptly across one component points to that component, connector or adapter.</div>
<div class="callout warn">Safety: an arrestor only works if it has a short, low-inductance connection to the same ground system as the building's electrical service. An arrestor mounted on the operating desk does little except bring the surge indoors.</div>

<h4>Key points</h4>
<ul><li>Radio → (low-pass filter) → meter → tuner → switch → arrestor → feedthrough → antenna.</li>
<li>The meter between radio and tuner shows what the radio sees.</li>
<li>Arrestors belong at the building entry, bonded to the single-point ground.</li>
<li>Use PL-259 at HF, Type N for VHF/UHF and outdoors, BNC and SMA for portable gear.</li>
<li>Weatherproof every outdoor connector and minimize adapters.</li></ul>
`,
    related: ['station-wiring', 'grounding', 'swr', 'antenna-tuner', 'feedlines', 'meters'],
  },
  {
    id: 'grounding',
    cat: 'Station',
    title: 'Grounding and bonding: safety, RF and lightning',
    summary: 'Three different jobs called "ground", the single-point ground concept, bonding, and an overview of NEC Article 810.',
    minutes: 7,
    html: `
<p>"Ground" is one word for three distinct functions. Confusing them leads to stations that are unsafe, noisy or both. A well-designed station handles all three, and the most important principle linking them is <b>bonding</b>: everything is connected together so that no dangerous voltage difference can appear between any two items.</p>

<h4>1. AC safety ground</h4>
<p>The equipment grounding conductor (the green or bare wire in a three-prong outlet) gives fault current a low-resistance path back to the service panel so that a breaker trips if a hot conductor touches a metal chassis. It is required by electrical code and must never be defeated. Do not use "cheater" adapters, and do not cut the ground pin to cure hum.</p>

<h4>2. RF ground (RF reference)</h4>
<p>Unbalanced antennas such as verticals, end-fed wires and random wires need a return path for RF current, a counterpoise or radial system. An RF "ground" in the operating room is often ineffective: a ground wire running from a second-floor shack to a rod is itself an antenna, and if its length approaches a quarter wavelength (about 33 ft on 7 MHz) it presents a <em>high</em> impedance at the radio. Symptoms of RF in the shack include tingling microphones, distorted audio and computer interface lockups. The better cure is usually to keep RF off the feedline in the first place with a common-mode choke at the feedpoint and to use antennas that do not rely on the station equipment as part of the radiator.</p>

<h4>3. Lightning protection</h4>
<p>A lightning strike, or a nearby strike inducing current in antennas and wiring, involves currents of tens of kiloamperes rising in microseconds. At these speeds inductance dominates: even a few feet of wire develops thousands of volts. The goal is not to "send lightning to ground" through the shack, but to make every conductor entering the building rise and fall in potential <em>together</em>, and to divert surge current to earth at the building entrance.</p>

<h4>The single-point ground</h4>
<p>All conductors that enter the building (coax shields, arrestors, rotator cables, telephone and cable TV protectors, and the AC service ground) should be bonded at <b>one point</b>, usually an entry panel near the electrical service. Equipment inside the shack is bonded to a station ground bus, which is connected to that single point with one conductor. This prevents surge current from flowing <em>through</em> the equipment between two separate grounds.</p>
<ul>
<li>Use wide copper strap or heavy wire (6 AWG or larger) for bonds; keep them short and straight with gentle bends.</li>
<li>Drive ground rods (typically 8 ft, copper-clad) at the antenna base and entry point; space multiple rods at least their length apart.</li>
<li>Every separate ground rod <b>must be bonded</b> to the electrical service grounding electrode. An isolated rod creates a dangerous potential difference during a fault or strike.</li>
<li>Do not use gas pipes. Metallic water pipes may be part of the service electrode system, but follow local code.</li>
</ul>

<h4>NEC Article 810 overview</h4>
<p>In the United States, the National Electrical Code (NFPA 70), <b>Article 810</b>, "Radio and Television Equipment", covers amateur antennas and lead-ins. In summary (consult the edition adopted in your jurisdiction and your local authority having jurisdiction):</p>
<ul>
<li>Antenna masts and metal structures must be grounded.</li>
<li>Each coaxial lead-in must have its outer conductor grounded, and an <b>antenna discharge unit</b> (lightning arrestor) is required for each lead-in conductor where the code calls for it, located outside or inside nearest the point of entry, not near combustible material.</li>
<li>Grounding conductors must be copper or another corrosion-resistant material, run in as straight a line as practical, and for amateur transmitting stations be not smaller than <b>10 AWG copper</b> (and not smaller than the lead-in conductor).</li>
<li>A separate antenna ground electrode must be bonded to the building's power grounding electrode system with a conductor not smaller than <b>6 AWG copper</b>.</li>
<li>Outdoor antennas and lead-ins must be kept clear of power lines with specified clearances.</li>
</ul>
<p>This summary is a simplification. Electrical codes change with each edition and are interpreted locally.</p>

<h4>The arrestor</h4>
<p>A coaxial arrestor contains a gas discharge tube or a quarter-wave shorting stub between the center conductor and the grounded body. Gas-tube units have a DC path and work at any frequency within their rating but must be sized for the transmitter's peak RF voltage (a 100 W signal at 50 Ω is about 100 V peak; at high SWR it can be several times higher). Quarter-wave stub types are DC-shorted and frequency-specific. The arrestor's body must bolt directly to a grounded plate or panel.</p>

<div class="callout">Practical tip: the simplest and most effective protection during a storm is to disconnect antennas outside the building and unplug equipment from the mains. No hardware fully protects against a direct strike.</div>
<div class="callout warn">Safety: never work on antennas, feedlines or ground systems when thunderstorms are within audible range. Bonding work near the electrical service panel should be done by, or checked by, a qualified electrician.</div>

<h4>Key points</h4>
<ul><li>Safety ground, RF ground and lightning protection are different jobs.</li>
<li>Bond everything to a single-point ground at the building entry.</li>
<li>Every ground rod must be bonded to the electrical service ground.</li>
<li>NEC Article 810 sets minimum conductor sizes and arrestor requirements.</li>
<li>Cure RF in the shack primarily with feedpoint chokes, not long ground wires.</li></ul>
`,
    related: ['station-wiring', 'rf-path', 'rf-safety', 'efhw'],
  },
  {
    id: 'power-supplies',
    cat: 'Station',
    title: 'Power supplies: linear, switching and battery',
    summary: 'Choosing and sizing a 13.8 V supply, the trade-off between linear and switch-mode designs, and controlling supply noise.',
    minutes: 5,
    html: `
<p>A transceiver is only as good as the power that feeds it. The supply must hold 13.8 V steady while the load swings from about 2 A on receive to more than 20 A on voice peaks, and it must not add noise to the receiver.</p>

<h4>Sizing</h4>
<p>Start from the radio's specified maximum current, then add margin. A 100 W HF transceiver typically draws 20 to 23 A at full output. A supply rated for <b>25 to 30 A continuous</b> is the usual choice; this leaves headroom for an accessory or two. Note the difference between <em>continuous</em> and <em>intermittent (ICS)</em> ratings: a "30 A peak / 25 A continuous" unit is fine for SSB and CW, while sustained high-duty-cycle modes such as FT8, RTTY or long FM transmissions approach continuous load.</p>
<div class="formula">Required supply current ≈ radio peak current × 1.2 to 1.3 &nbsp;&nbsp; e.g. 22 A × 1.25 ≈ 28 A → choose a 30 A supply</div>
<p>For a VHF/UHF mobile at 50 W, a 15 to 20 A supply suffices; a QRP (5 to 10 W) radio may need only 2 to 3 A.</p>

<h4>Linear supplies</h4>
<p>A linear supply uses a 60 Hz mains transformer, rectifier, large filter capacitors and series pass transistors that drop the excess voltage as heat. Advantages: very low radiated and conducted RF noise, simple and robust. Disadvantages: heavy (a 30 A linear supply weighs 20 to 30 lb, 9 to 14 kg), roughly 50 to 60% efficient, and hot. A good linear supply includes <b>overvoltage crowbar</b> protection: if a pass transistor shorts, the crowbar fires and blows the fuse instead of applying full unregulated voltage (often 18 to 22 V) to the radio.</p>

<h4>Switching (switch-mode) supplies</h4>
<p>A switching supply rectifies the mains directly, chops it at tens to hundreds of kilohertz, and uses a small high-frequency transformer. Advantages: light (2 to 5 lb), 80 to 90% efficient, cool running. Disadvantage: the switching frequency and its harmonics can produce <b>RF interference</b>, heard as a buzz, a regular comb of carriers across the HF bands, or a raised noise floor. Supplies intended for amateur use are designed and filtered to minimize this, and some include a "noise offset" control that shifts the switching frequency away from a frequency in use. Generic industrial or computer supplies are often much noisier.</p>

<h4>Diagnosing supply noise</h4>
<ol>
<li>Tune to a quiet frequency and note the S-meter and noise level.</li>
<li>Run the radio from a battery with the supply unplugged from the mains. If the noise disappears, the supply (or something sharing its wiring) is responsible.</li>
<li>Try ferrite chokes (type 31 or 43 material) on the DC leads and AC cord near the supply, and bond the supply chassis to the station ground bus.</li>
</ol>

<h4>Batteries</h4>
<p>Batteries are noise-free and essential for emergency and portable work. A lead-acid battery reads about 12.6 to 12.8 V at rest when fully charged and about 13.6 to 13.8 V on float. Lithium iron phosphate (LiFePO4) batteries hold about 13.0 to 13.3 V for most of their discharge, which suits radios well, and they deliver far more usable capacity per pound. Estimate run time from the average current, not the peak:</p>
<div class="formula">Example: receive 2 A for 80% of the time, transmit 20 A for 20% → average ≈ 0.8×2 + 0.2×20 = 5.6 A; a 50 Ah battery gives about 50 / 5.6 ≈ 9 h (less for lead-acid, which should not be discharged below about 50%).</div>

<h4>Remote sense and wiring</h4>
<p>Some supplies offer remote-sense terminals that regulate at the load rather than at the terminals, compensating for cable drop. Otherwise keep the DC cable short and heavy. Connect the supply's chassis or negative terminal to the station bonding bus as the manufacturer recommends.</p>

<div class="callout">Practical tip: a supply that is quiet on the bench may become noisy when its DC leads are long; they act as antennas for the switching harmonics. Keep leads short and twisted together.</div>
<div class="callout warn">Safety: linear supplies contain large filter capacitors that can hold a dangerous charge after power is removed. Do not open a supply unless you are qualified to service mains-powered equipment.</div>

<h4>Key points</h4>
<ul><li>Choose a supply rated 25 to 30 A continuous for a 100 W rig.</li>
<li>Linear: heavy and quiet. Switching: light and efficient, but may generate RFI.</li>
<li>Overvoltage crowbar protection is important on linear supplies.</li>
<li>Test for supply noise by switching to battery power.</li>
<li>Estimate battery run time from average current and usable capacity.</li></ul>
`,
    related: ['station-wiring', 'grounding', 'receiver-controls'],
  },

  // --------------------------------------------------------------- Antennas
  {
    id: 'antenna-basics',
    cat: 'Antennas',
    title: 'Antenna fundamentals: wavelength, resonance and the half-wave dipole',
    summary: 'Wavelength, resonance, the 468/f dipole formula and where it comes from, and current, voltage and impedance along a dipole.',
    minutes: 7,
    html: `
<p>An antenna converts RF current in a conductor into an electromagnetic wave and, by reciprocity, does the reverse on receive. Its behavior is governed almost entirely by its size compared with the wavelength.</p>

<h4>Wavelength</h4>
<p>Radio waves travel at the speed of light, about 300,000,000 m/s in free space. Wavelength is speed divided by frequency:</p>
<div class="formula">λ (m) = 300 / f (MHz) &nbsp;&nbsp;&nbsp; λ (ft) ≈ 984 / f (MHz)</div>
<p>At 14.2 MHz, λ = 300 / 14.2 = 21.1 m (69.3 ft). This is why the 20 m band has its name: the band names are approximate wavelengths.</p>

<h4>Resonance</h4>
<p>A conductor is <b>resonant</b> when its feedpoint impedance is purely resistive, that is, the reactance is zero. A straight wire about one-half wavelength long, fed in the center, is the first resonance and the basis of the <b>half-wave dipole</b>. Resonance is not a requirement for an antenna to radiate (a non-resonant antenna with a tuner can radiate efficiently), but a resonant antenna near 50 Ω is easy to feed with coaxial cable without a tuner.</p>

<h4>Where 468/f comes from</h4>
<p>A half wavelength in free space is 984 / 2 = <b>492 / f</b> feet. A real wire resonates somewhat shorter, mainly because of <em>end effect</em>: capacitance at the open ends of the wire makes it behave electrically longer than its physical length. The amount depends on the ratio of length to conductor diameter; for typical HF wire antennas the physical length is about 95% of a free-space half wavelength:</p>
<div class="formula">L (ft) ≈ 0.95 × 492 / f = 468 / f (MHz) &nbsp;&nbsp;&nbsp; L (m) ≈ 142.5 / f (MHz)</div>
<p>This factor is often loosely called a "velocity factor", but strictly the wave on a bare wire in air travels at nearly the speed of light; the shortening comes from end effect and conductor thickness. Insulated wire shortens resonance further, often by another 2 to 3%, and nearby objects and the ground also shift it. Treat 468/f as a starting point that is usually within a few percent.</p>
<p>Worked examples:</p>
<ul>
<li>7.150 MHz: 468 / 7.150 = <b>65.5 ft</b> (each leg 32.7 ft); metric 142.5 / 7.150 = 19.9 m.</li>
<li>14.200 MHz: 468 / 14.200 = 33.0 ft (each leg 16.5 ft).</li>
<li>3.800 MHz: 468 / 3.800 = 123.2 ft.</li>
</ul>

<h4>Current and voltage distribution</h4>
<svg viewBox="0 0 640 140" class="diag" role="img" aria-label="Half-wave dipole showing current maximum at the center and voltage maxima at the ends" style="font:12px sans-serif">
<g fill="none" stroke-width="2">
<path d="M40 90H314M326 90H600" stroke="currentColor" stroke-width="3"/>
<path d="M40 90C150 10 490 10 600 90" style="stroke:var(--accent)"/>
<path d="M40 20C120 75 250 90 320 90C390 90 520 75 600 20" style="stroke:var(--muted)" stroke-dasharray="6 4"/>
<path d="M314 90V125M326 90V125" stroke="currentColor"/>
</g>
<g fill="currentColor"><text x="320" y="24" text-anchor="middle">current I (maximum at center)</text><text x="44" y="16">voltage V (max at ends)</text><text x="332" y="122">feedpoint ≈ 50–75 Ω</text><text x="40" y="112">λ/4</text><text x="580" y="112">λ/4</text></g>
</svg>
<p>On a resonant half-wave dipole the current is maximum at the center and falls to zero at the ends, following approximately a half-cycle of a sine wave. Voltage does the opposite: minimum at the center and maximum at the ends. Impedance is the ratio of voltage to current, so it is low at the center and very high (thousands of ohms) at the ends. This is why center feed gives an impedance near 50 to 75 Ω, while end feed requires a high-impedance transformer (see the end-fed half-wave article). The high voltage at the ends is also why end insulators matter and why the ends should be out of reach.</p>

<h4>Feedpoint impedance</h4>
<p>In free space a thin half-wave dipole at resonance has a radiation resistance of about <b>73 Ω</b> (strictly, an exact half-wave has 73 + j42.5 Ω; trimming it slightly shorter to reach resonance brings the resistance near 70 Ω). Over real ground the value depends on height: at practical heights of roughly 0.2 to 0.5 λ it is commonly 50 to 80 Ω, and an inverted-V configuration lowers it toward 50 Ω. Either way, a dipole fed with 50 Ω coax typically shows an SWR of 1.5:1 or better at resonance.</p>

<h4>Radiation pattern</h4>
<p>In free space a dipole radiates a figure-eight pattern broadside to the wire, with nulls off the ends, and has a gain of <b>2.15 dBi</b> (decibels relative to an isotropic radiator). Gains quoted in <b>dBd</b> use the dipole as the reference: dBi = dBd + 2.15. At heights below about one-half wavelength, the pattern becomes nearly omnidirectional and radiation goes mostly upward.</p>

<div class="callout">Practical tip: always cut a new dipole a few percent long. It is easy to trim wire off or fold it back; adding wire means splices.</div>

<h4>Key points</h4>
<ul><li>λ (m) = 300 / f (MHz); a half-wave dipole is L (ft) ≈ 468 / f.</li>
<li>The 0.95 factor accounts for end effect and conductor thickness; it is a starting estimate.</li>
<li>Current peaks at the center, voltage at the ends.</li>
<li>Resonant dipole impedance: about 73 Ω in free space, 50 to 80 Ω at practical heights.</li>
<li>Dipole gain is 2.15 dBi = 0 dBd.</li></ul>
`,
    related: ['dipole-build', 'height-ground', 'swr', 'formulas', 'efhw'],
  },
  {
    id: 'dipole-build',
    cat: 'Antennas',
    title: 'Building and trimming a dipole',
    summary: 'Materials, a step-by-step trimming procedure using the measured SWR minimum, baluns and chokes, and the inverted-V variant.',
    minutes: 7,
    html: `
<p>The half-wave dipole is the reference antenna of amateur radio: inexpensive, predictable and efficient. Building one well is mostly a matter of careful measurement and a methodical trimming procedure.</p>

<h4>Materials</h4>
<ul>
<li><b>Wire:</b> 14 AWG stranded copper (bare or insulated) or copper-clad steel for long spans. Insulated wire resonates 2 to 3% lower than bare wire of the same length.</li>
<li><b>Center insulator</b> or a 1:1 current balun with eyelets to take the strain.</li>
<li><b>End insulators</b> (ceramic or plastic "dog bone" type). The ends carry high RF voltage.</li>
<li><b>Support rope:</b> UV-resistant polyester (Dacron) or similar; nylon stretches and degrades in sunlight.</li>
<li><b>Feedline:</b> 50 Ω coax (see the feedline article for loss figures).</li>
</ul>

<h4>Cutting</h4>
<p>Compute the length with L (ft) = 468 / f, then add about 3 to 5% and a few inches per end for wrapping through the insulators. For 7.150 MHz: 468 / 7.150 = 65.5 ft total, so cut two legs of about 34 ft each plus wrap allowance.</p>

<h4>Trimming procedure</h4>
<ol>
<li>Raise the antenna to its <b>final height and configuration</b>. Height, slope and nearby objects all shift resonance; trimming at head height on sawhorses gives misleading results.</li>
<li>Sweep the SWR with an antenna analyzer, or with the transceiver at low power across the band, and find the frequency of minimum SWR, <b>f<sub>measured</sub></b>.</li>
<li>Compute the corrected total length:
<div class="formula">L<sub>new</sub> = L<sub>old</sub> × f<sub>measured</sub> / f<sub>target</sub></div></li>
<li>Remove (or add) half of the difference from <b>each</b> leg so the antenna stays symmetrical.</li>
<li>Raise it again and re-measure. Usually two passes are enough.</li>
</ol>
<p>Worked example: the dipole is 65.5 ft long and the SWR minimum is at 6.950 MHz, but you want 7.150 MHz. L<sub>new</sub> = 65.5 × 6.950 / 7.150 = 63.67 ft. Remove 1.83 ft (about 22 in) in total, roughly 11 in from each leg. If the minimum had been <em>above</em> the target, the ratio would be greater than one and the antenna would need lengthening. Rather than cutting, many builders fold the excess back along the wire and wrap it; folded-back wire has only a small effect on resonance.</p>
<p>The ratio method works because resonant frequency is inversely proportional to length. It is approximate (end effect does not scale perfectly), which is why a second measurement is advisable.</p>

<h4>Baluns and common-mode chokes</h4>
<p>A dipole is a <em>balanced</em> antenna; coax is an <em>unbalanced</em> line. Without a balun, some current flows on the outside of the coax shield. That <b>common-mode current</b> makes the feedline part of the antenna, distorts the pattern, can bring RF into the shack and can make SWR readings change as you move the cable. A <b>1:1 current balun</b> or common-mode choke at the feedpoint presents a high impedance to current on the outside of the shield while passing the desired signal inside. Common forms are ferrite beads (type 31 or 43 material) slipped over the coax, or several turns of coax wound through a ferrite toroid. A simple coiled-coax choke (several turns in a coil of a few inches diameter) works over a limited frequency range and is less effective than a ferrite choke.</p>

<h4>The inverted-V</h4>
<svg viewBox="0 0 400 190" class="diag" role="img" aria-label="Inverted-V dipole on a single mast with balun at the apex and an included angle of 90 to 120 degrees" style="font:12px sans-serif">
<g fill="none" stroke="currentColor" stroke-width="2">
<path d="M200 30V180" stroke-width="3" style="stroke:var(--muted)"/>
<path d="M200 36L60 140M200 36L340 140" style="stroke:var(--accent)"/>
<rect x="191" y="28" width="18" height="16" fill="none"/>
<path d="M60 140L40 175M340 140L360 175" stroke-dasharray="3 3"/>
<path d="M172 57A35 35 0 0 0 228 57" stroke-width="1"/>
<path d="M20 180H380"/>
</g>
<g fill="currentColor"><text x="214" y="24">balun / choke</text><text x="200" y="80" text-anchor="middle">90–120°</text><text x="44" y="132">insulator</text><text x="282" y="132">insulator</text><text x="210" y="172">mast</text><text x="18" y="168">rope</text></g>
</svg>
<p>An inverted-V hangs from a single central support with the legs sloping down toward the ground. It needs only one tall support, has a more omnidirectional pattern than a flat dipole, and its feedpoint impedance is closer to 50 Ω. Keep the <b>included angle at the apex between about 90° and 120°</b>; narrower angles reduce efficiency and raise the effect of ground. Because the ends are closer to ground and to each other, an inverted-V typically resonates lower than a flat dipole of the same length, so expect to trim it a few percent shorter.</p>

<h4>Multiband options</h4>
<p>A <b>fan dipole</b> connects several dipoles for different bands to one feedpoint; each resonant element takes power on its own band. A <b>trap dipole</b> uses parallel LC traps to electrically shorten the wire on higher bands. A center-fed doublet with ladder line and a tuner covers many bands without resonance.</p>

<div class="callout">Practical tip: make the final trimming adjustments in the morning and again in wet weather if possible. Rain and ice can lower resonance noticeably on wire antennas near trees.</div>
<div class="callout warn">Safety: the ends of a dipole carry high RF voltage. Keep them well above head height, and never throw a support line over or near a power line.</div>

<h4>Key points</h4>
<ul><li>Cut long, raise to final height, then measure.</li>
<li>L<sub>new</sub> = L<sub>old</sub> × f<sub>measured</sub> / f<sub>target</sub>; trim equally from both legs.</li>
<li>Use a 1:1 current balun or choke to suppress common-mode current on the coax.</li>
<li>Inverted-V: one support, apex angle 90 to 120°, impedance near 50 Ω, trims a bit shorter.</li></ul>
`,
    related: ['antenna-basics', 'antenna-analyzer', 'swr', 'feedlines', 'height-ground'],
  },
  {
    id: 'verticals',
    cat: 'Antennas',
    title: 'Vertical antennas and radial systems',
    summary: 'The quarter-wave vertical, why radials matter, ground loss and efficiency, and low-angle radiation.',
    minutes: 6,
    html: `
<p>A vertical antenna is, in effect, half of a dipole stood on end, with the other half supplied by the ground or by a system of wires called radials. Verticals are compact, omnidirectional, and radiate well at the low elevation angles useful for long-distance (DX) contacts, but their performance depends heavily on the ground system.</p>

<h4>The quarter-wave vertical</h4>
<p>The basic vertical radiator is a quarter wavelength high. Using the same end-effect factor as the dipole:</p>
<div class="formula">L (ft) ≈ 234 / f (MHz) &nbsp;&nbsp;&nbsp; L (m) ≈ 71.3 / f (MHz)</div>
<p>Examples: 14.200 MHz → 234 / 14.2 = 16.5 ft; 7.150 MHz → 32.7 ft; 146 MHz → 1.6 ft (19.2 in). Tubing elements, which are thicker, resonate a little shorter than wire.</p>

<h4>Radiation resistance and ground loss</h4>
<p>Over a perfect ground, a quarter-wave vertical has a radiation resistance of about <b>36 Ω</b>. Real soil is lossy, and the RF return current flowing through it dissipates power in a loss resistance R<sub>g</sub> that appears in series with the radiation resistance. Efficiency is:</p>
<div class="formula">Efficiency = R<sub>r</sub> / (R<sub>r</sub> + R<sub>g</sub>)</div>
<p>With R<sub>r</sub> = 36 Ω and only a few short radials, R<sub>g</sub> may be 20 to 40 Ω, giving efficiency of roughly 50 to 65%. Note that the feedpoint then reads close to 50 Ω and shows a pleasing low SWR. <b>A low SWR on a vertical can be a symptom of ground loss</b>, not a sign of a good antenna. As the radial system improves, efficiency rises and the feedpoint resistance falls toward 36 Ω.</p>

<h4>Ground-mounted radials</h4>
<p>Radials lying on or just under the soil are not resonant; the soil detunes them, so their exact length is not critical. The goal is to collect return current before it flows through lossy earth. More radials matter more than longer ones. General guidance, based on classic measurements and modeling:</p>
<table><thead><tr><th>Number of radials</th><th>Suggested length</th><th>Approximate ground loss</th></tr></thead><tbody>
<tr><td>4 to 8</td><td>0.1 λ</td><td>High (efficiency often 40 to 60%)</td></tr>
<tr><td>16</td><td>0.1 to 0.15 λ</td><td>Moderate</td></tr>
<tr><td>32 to 60</td><td>0.25 λ or more</td><td>Low; within about 1 dB of an ideal ground</td></tr></tbody></table>
<p>These figures are approximate and depend on soil conductivity.</p>

<h4>Elevated radials</h4>
<p>If the base of the vertical is raised a few feet or more above ground, a small number (two to four) of <b>resonant</b> quarter-wave radials performs well. Unlike ground radials, elevated radials should be cut to resonance and kept symmetrical. Sloping them downward at 30 to 45° raises the feedpoint impedance from about 22 Ω (horizontal radials) toward 50 Ω, which is why VHF ground-plane antennas often have drooping radials.</p>

<h4>Take-off angle and pattern</h4>
<p>A vertical has an omnidirectional azimuth pattern. In elevation, over perfect ground it would radiate most strongly right along the horizon. Over real ground, the reflected wave cancels much of the energy at very low angles, and the main lobe of a quarter-wave vertical over average ground typically peaks around <b>20 to 25°</b>. That is still lower than a horizontal dipole at modest height, which is why verticals are popular on 40, 80 and 160 m where getting a dipole high enough is impractical. Ground conductivity in the far field (hundreds of wavelengths out) also affects low-angle performance; saltwater locations are ideal.</p>

<h4>Other verticals</h4>
<ul>
<li><b>5/8-λ vertical:</b> common at VHF; about 3 dB more gain than a quarter wave at low angles; needs a matching network.</li>
<li><b>Loaded short verticals:</b> use coils or capacitance hats to reach resonance in a shorter height; efficiency falls as radiation resistance drops.</li>
<li><b>Multiband trap verticals:</b> traps isolate sections of the radiator on each band.</li>
</ul>
<p>Verticals also tend to receive more man-made noise than horizontal antennas, since most local noise is vertically polarized.</p>

<div class="callout">Practical tip: install as many ground radials as you practically can, even if they are short. Inexpensive insulated wire laid on the lawn and pinned down settles into the grass within weeks.</div>

<h4>Key points</h4>
<ul><li>Quarter-wave vertical length ≈ 234 / f (ft).</li>
<li>Radiation resistance ≈ 36 Ω; ground loss adds in series and wastes power.</li>
<li>Many ground radials beat a few long ones; elevated radials should be resonant.</li>
<li>Low SWR on a vertical may mean high ground loss.</li>
<li>Main lobe over real ground typically 20 to 25°.</li></ul>
`,
    related: ['antenna-basics', 'height-ground', 'efhw', 'grounding'],
  },
  {
    id: 'efhw',
    cat: 'Antennas',
    title: 'The end-fed half-wave (EFHW) antenna',
    summary: 'How an end-fed half-wave works, the 49:1 transformer, multiband harmonic operation, and counterpoise and choke requirements.',
    minutes: 6,
    html: `
<p>The end-fed half-wave is a half-wave wire fed at one end instead of the center. It has become popular for portable and limited-space operation because it needs only one feedpoint near the operator and works on several harmonically related bands without a tuner.</p>

<h4>Why the impedance is high</h4>
<p>On a half-wave wire, current is near zero and voltage is maximum at the ends (see the antenna fundamentals article). The impedance at the end is therefore very high, typically <b>2,000 to 5,000 Ω</b> depending on wire diameter, height and surroundings. Coax at 50 Ω cannot feed it directly; a step-up transformer is required.</p>

<h4>The 49:1 transformer</h4>
<p>Impedance transforms as the square of the turns ratio. A 1:7 turns ratio gives 1:49, so 50 Ω on the coax side becomes 50 × 49 = <b>2,450 Ω</b> on the antenna side, in the middle of the expected range. A common design uses a type 43 ferrite toroid (for example an FT-240-43 for 100 W SSB) with 2 primary turns and 14 secondary turns, autotransformer-wound. A small capacitor, often about 100 to 150 pF, across the primary compensates for leakage inductance and improves the match on the higher bands. A 64:1 transformer (1:8 turns, about 3,200 Ω) is sometimes used for longer or higher wires. Because the transformer is an <em>unun</em> (unbalanced to unbalanced), it does not provide balun action.</p>
<div class="formula">Z<sub>ratio</sub> = (N<sub>secondary</sub> / N<sub>primary</sub>)² &nbsp;&nbsp; (14 / 2)² = 49</div>

<h4>Multiband operation through harmonics</h4>
<p>A wire that is a half wave on 40 m is a full wave on 20 m, 1.5 λ on 15 m and 2 λ on 10 m. At every one of these, the end of the wire is again a voltage maximum and high impedance, so the same transformer matches it. A 40 m EFHW therefore covers <b>40, 20, 15 and 10 m</b>, and an 80 m EFHW (about 130 ft) adds 80 m. The harmonic resonances fall slightly <em>higher</em> than exact multiples, because end effect shortens only the ends of the wire, not each half-wave segment. Builders trim for the best compromise across bands, sometimes with a small loading coil to fix the lowest band. Bands that are not harmonically related (30, 17 and 12 m) generally need a tuner.</p>
<p>Starting length: about 66 to 68 ft for a 40 m EFHW using a 49:1 transformer, trimmed in place. On higher harmonics the wire is longer than a half wave, so the pattern breaks into several lobes; gain toward some directions rises while gaps appear in others.</p>

<h4>Counterpoise and common-mode current</h4>
<p>An end-fed antenna still needs a return path for its (small) feedpoint current. Because current at the high-impedance end is low, a short counterpoise suffices, often the outside of the coax shield itself, or a short wire of roughly 0.05 λ. If nothing is provided deliberately, the coax shield and the station equipment become the counterpoise, and RF current flows into the shack. Typical remedies:</p>
<ul>
<li>A short dedicated counterpoise wire at the transformer (a few feet to about 0.05 λ).</li>
<li>A common-mode choke on the coax some distance from the transformer (often about 0.05 λ, which on 40 m is roughly 7 ft) so that a defined length of shield acts as counterpoise and the rest is isolated.</li>
</ul>

<h4>Deployment</h4>
<p>Common configurations are a sloper (one end high in a tree, the transformer near the ground), an inverted-L, or an inverted-V supported in the middle. Keep the far end (high voltage) out of reach and away from foliage, which detunes it and absorbs power.</p>

<h4>Power and losses</h4>
<p>Ferrite transformers have losses, usually 0.5 to 1 dB in a well-made unit, that appear as heat. High-duty-cycle digital modes heat the core much more than SSB, so a transformer rated "100 W SSB" may be good for only 30 to 50 W on FT8. If the transformer becomes warm after a few minutes, reduce power.</p>

<div class="callout">Practical tip: when trimming an EFHW, set the lowest band first, then check the harmonics. If the higher bands are resonant too low, a small capacitor across the primary or a minor length change usually brings them in.</div>
<div class="callout warn">Safety: the far end of an EFHW can reach several kilovolts even at 100 W. Keep it out of reach of people and animals.</div>

<h4>Key points</h4>
<ul><li>A half-wave wire fed at the end presents roughly 2 to 5 kΩ.</li>
<li>A 49:1 unun (1:7 turns) transforms 50 Ω to about 2,450 Ω.</li>
<li>Works on harmonics: 40/20/15/10 m on one wire.</li>
<li>Provide a counterpoise and a common-mode choke to keep RF out of the shack.</li>
<li>Derate the transformer for high-duty-cycle modes.</li></ul>
`,
    related: ['antenna-basics', 'grounding', 'antenna-tuner', 'feedlines'],
  },
  {
    id: 'yagi',
    cat: 'Antennas',
    title: 'Yagi-Uda beam antennas',
    summary: 'Driven element, reflector and directors; gain and front-to-back ratio; feeding a Yagi; and rotators.',
    minutes: 6,
    html: `
<p>The Yagi-Uda antenna (usually just "Yagi" or "beam") concentrates energy in one direction using a driven element and one or more <em>parasitic</em> elements that are not connected to the feedline. It is the standard directional antenna for 20 m and above and for VHF/UHF weak-signal work.</p>

<svg viewBox="0 0 420 170" class="diag" role="img" aria-label="Three-element Yagi seen from above: reflector, driven element and director on a boom, with the main lobe toward the director" style="font:12px sans-serif">
<g fill="none" stroke="currentColor" stroke-width="2">
<path d="M60 85H300" stroke-width="4" style="stroke:var(--muted)"/>
<path d="M80 20V150"/><path d="M170 26V80M170 90V144" style="stroke:var(--accent)"/><path d="M260 32V138"/>
<path d="M310 85H400M388 78L400 85L388 92"/>
</g>
<g fill="currentColor" text-anchor="middle"><text x="80" y="166">Reflector</text><text x="170" y="166">Driven</text><text x="260" y="166">Director</text><text x="80" y="14">~5% longer</text><text x="260" y="26">~5% shorter</text><text x="355" y="76">main lobe</text><text x="125" y="78">0.15–0.25 λ</text></g>
</svg>

<h4>The elements</h4>
<ul>
<li><b>Driven element:</b> connected to the feedline; approximately a resonant half-wave dipole.</li>
<li><b>Reflector:</b> behind the driven element, about 5% longer. Its induced current re-radiates with a phase that reinforces radiation in the forward direction and cancels it to the rear.</li>
<li><b>Directors:</b> in front of the driven element, each about 5% shorter. Additional directors increase forward gain and narrow the beam.</li>
</ul>
<p>Element spacing is typically 0.1 to 0.25 λ. Longer booms, not just more elements, are what produce more gain.</p>

<h4>Gain and front-to-back ratio</h4>
<table><thead><tr><th>Design</th><th>Free-space gain (approx.)</th><th>Front-to-back</th></tr></thead><tbody>
<tr><td>2 elements (driven + reflector)</td><td>about 4 dBd (6 dBi)</td><td>10 to 15 dB</td></tr>
<tr><td>3 elements</td><td>about 5.5 to 6 dBd (7.5 to 8 dBi)</td><td>15 to 25 dB</td></tr>
<tr><td>5 elements (long boom)</td><td>about 8 to 9 dBd</td><td>20 to 30 dB</td></tr></tbody></table>
<p>These are representative values; a real design trades gain against front-to-back ratio and bandwidth. Mounted over ground, a horizontal Yagi gains up to about another 5 to 6 dB at its main elevation angle from ground reflection, which is why manufacturers sometimes quote "gain over ground" figures that look high. Compare antennas in free space and in the same units (dBi = dBd + 2.15).</p>
<p><b>Front-to-back ratio</b> (F/B) is the difference in signal strength between the forward direction and directly behind. A good F/B is valuable for rejecting interference as much as gain is for transmitting.</p>

<h4>Feeding a Yagi</h4>
<p>Parasitic elements couple strongly to the driven element and lower its feedpoint resistance, typically to 20 to 30 Ω for a 3-element design. Common matching methods are the <b>gamma match</b> (a rod and series capacitor tapping the driven element), the <b>hairpin (beta) match</b> with a split driven element, and direct feed with a suitable transformer. A common-mode choke at the feedpoint is advisable.</p>

<h4>Rotators and aiming</h4>
<p>A beam must be turned. Rotators are rated by the wind load area (ft² or m²) and the torque they can handle; light-duty TV rotators are suitable only for small VHF arrays, while HF tribanders need a heavier unit. A thrust bearing above the rotator in a tower relieves it of vertical load. Beam headings come from great-circle bearings; an azimuthal-equidistant map centered on your location shows them directly. For example, from the central United States, Europe lies roughly to the northeast, not due east.</p>

<h4>Multiband Yagis</h4>
<p>Tribanders cover 20, 15 and 10 m using traps or interlaced elements. They compromise gain and F/B on each band compared with monobanders, but provide good performance from one boom and rotator.</p>

<div class="callout">Practical tip: when listening, rotate the beam to peak a signal and then rotate 180° to null it. The difference is a rough on-air check of front-to-back ratio, and nulling is a powerful tool against interference.</div>
<div class="callout warn">Safety: towers and beams are heavy, and wind loads are large. Follow manufacturer ratings, use fall protection, and never climb alone.</div>

<h4>Key points</h4>
<ul><li>Reflector about 5% longer, directors about 5% shorter than the driven element.</li>
<li>3-element Yagi: about 7.5 to 8 dBi free space, F/B 15 to 25 dB.</li>
<li>Gain depends mostly on boom length.</li>
<li>Driven-element impedance is low and needs a matching system.</li>
<li>Aim with great-circle bearings; F/B helps reject interference.</li></ul>
`,
    related: ['antenna-basics', 'height-ground', 'greyline', 'rf-safety'],
  },
  {
    id: 'height-ground',
    cat: 'Antennas',
    title: 'Antenna height, ground effects and NVIS',
    summary: 'How height above ground in wavelengths sets take-off angle and feedpoint impedance, and how to use near-vertical-incidence skywave.',
    minutes: 6,
    html: `
<p>For horizontal antennas, the most important installation variable is <b>height above ground measured in wavelengths</b>. A 40 ft (12 m) height is low on 80 m and quite high on 10 m. Height determines the vertical (elevation) pattern and therefore which distances the antenna serves best.</p>

<h4>Ground reflection</h4>
<p>Energy radiated downward reflects from the ground and combines with the direct wave. For horizontal polarization the reflection reverses phase, so the two waves cancel along the horizon and reinforce at angles where the extra path length is a half wavelength. For a horizontal antenna at height h, the first (lowest) lobe peaks at approximately:</p>
<div class="formula">sin θ = λ / (4h) &nbsp;&nbsp;&nbsp; θ = arcsin(1 / (4 × h/λ))</div>
<table><thead><tr><th>Height</th><th>Lowest lobe peak</th><th>Character</th></tr></thead><tbody>
<tr><td>0.25 λ or less</td><td>90° (straight up)</td><td>NVIS; regional coverage</td></tr>
<tr><td>0.5 λ</td><td>30°</td><td>Good general-purpose</td></tr>
<tr><td>0.75 λ</td><td>19.5°</td><td>Medium-distance DX</td></tr>
<tr><td>1.0 λ</td><td>14.5°</td><td>Good DX</td></tr>
<tr><td>1.5 λ</td><td>9.6°</td><td>Strong low-angle DX</td></tr>
<tr><td>2.0 λ</td><td>7.2°</td><td>Very low angle; higher lobes appear too</td></tr></tbody></table>
<p>This simplified model assumes a perfectly reflecting flat ground; real ground modifies the results slightly but the trend holds. Above about 0.5 λ, additional higher-angle lobes form.</p>
<p>Worked example: a dipole at 35 ft. On 20 m (λ ≈ 69 ft at 14.2 MHz) it is 0.5 λ high, so it peaks near 30°, adequate for DX. On 40 m (λ ≈ 138 ft) the same height is 0.25 λ and most energy goes nearly straight up: excellent for contacts within a few hundred miles, weak for DX.</p>

<h4>Which angle do you need?</h4>
<p>Long-distance HF paths typically arrive at low angles: on 20 m, roughly 5 to 15° for intercontinental paths. One-hop paths of 500 to 1,500 miles use moderate angles of 10 to 30°. Short paths under about 300 miles need high angles, approaching vertical. Matching antenna height to the path you want is often worth more than a few dB of gain.</p>

<h4>Effect on feedpoint impedance</h4>
<p>Mutual coupling with its ground "image" changes a dipole's feedpoint resistance with height. Over real ground, it tends to be low at very low heights (where ground losses also rise), reaches a maximum of about 80 to 95 Ω around 0.3 to 0.35 λ, and then oscillates around the free-space value of about 73 Ω with decreasing swings as height increases. Resonant frequency also shifts slightly with height, which is one reason to trim an antenna at its final height.</p>

<h4>NVIS: near-vertical-incidence skywave</h4>
<p>NVIS deliberately radiates nearly straight up so that the signal reflects from the ionosphere and returns over a circle roughly 0 to 300 miles (0 to 500 km) in radius, with no skip zone. It is widely used for emergency and regional communication in hilly terrain, where ground-wave and VHF paths are blocked.</p>
<ul>
<li><b>Frequency:</b> must be below the F2 <em>critical frequency</em> (foF2), the highest frequency reflected at vertical incidence. In practice this means about 3 to 8 MHz: 80 m and 60 m at night and in winter, 40 m during the day when foF2 is high.</li>
<li><b>Antenna:</b> a horizontal dipole at 0.1 to 0.25 λ (on 80 m, roughly 12 to 30 ft). A wire on the ground underneath, slightly longer than the dipole, can add 3 to 6 dB of upward gain over poor soil.</li>
<li><b>Polarization:</b> horizontal; verticals are poor NVIS antennas because they have a null overhead.</li>
</ul>

<h4>Verticals and ground</h4>
<p>Verticals depend on ground differently: near-field ground (radials) controls loss, and far-field ground conductivity controls how much low-angle energy survives reflection. Height of the base matters much less than for horizontal antennas.</p>

<div class="callout">Practical tip: if you can only put up one antenna at modest height, a horizontal dipole for 40 m serves regional contacts well and a vertical serves DX. Many stations use both and switch between them.</div>

<h4>Key points</h4>
<ul><li>Height in wavelengths, not feet, determines the vertical pattern.</li>
<li>Lowest lobe: sin θ = λ / 4h; 30° at 0.5 λ, about 14.5° at 1 λ.</li>
<li>Low dipoles (0.1 to 0.25 λ) are ideal for NVIS on 80, 60 and 40 m.</li>
<li>Feedpoint resistance varies with height around 73 Ω.</li></ul>
`,
    related: ['antenna-basics', 'ionosphere', 'verticals', 'emergency', 'yagi'],
  },
  {
    id: 'feedlines',
    cat: 'Antennas',
    title: 'Feedlines: coax, ladder line and loss',
    summary: 'Characteristic impedance, velocity factor, loss of common coax types by frequency, ladder line, and how mismatch increases loss.',
    minutes: 7,
    html: `
<p>The feedline carries RF between the station and the antenna. A good feedline delivers most of the transmitter's power to the antenna and most of the received signal to the receiver; a poor choice can waste half of either.</p>

<svg viewBox="0 0 420 160" class="diag" role="img" aria-label="Coaxial cable cross-section: center conductor, dielectric, braided shield and outer jacket" style="font:12px sans-serif">
<g fill="none" stroke="currentColor" stroke-width="1.5">
<circle cx="90" cy="80" r="66"/><circle cx="90" cy="80" r="58" stroke-dasharray="3 2" stroke-width="3"/><circle cx="90" cy="80" r="52" style="stroke:var(--muted)"/>
<circle cx="90" cy="80" r="9" style="fill:var(--accent);stroke:var(--accent)"/>
<path d="M99 80H210M135 50H210M146 28H210M152 112H210" style="stroke:var(--muted)"/>
</g>
<g fill="currentColor"><text x="216" y="84">center conductor (diameter d)</text><text x="216" y="54">dielectric (ε)</text><text x="216" y="32">braid shield (inner diameter D)</text><text x="216" y="116">outer jacket</text></g>
</svg>

<h4>Characteristic impedance</h4>
<p>Every transmission line has a characteristic impedance Z<sub>0</sub> set by its geometry and insulation, independent of length. For coax:</p>
<div class="formula">Z<sub>0</sub> = (138 / √ε) × log<sub>10</sub>(D / d)</div>
<p>where D is the inside diameter of the shield, d the center conductor diameter and ε the dielectric constant. Amateur and most commercial radio gear uses <b>50 Ω</b>; cable and satellite TV use 75 Ω. If the load equals Z<sub>0</sub>, there is no reflection and the impedance seen at the input equals Z<sub>0</sub> at any length.</p>

<h4>Velocity factor</h4>
<p>RF travels more slowly in a dielectric than in air. The velocity factor VF = 1 / √ε. Solid polyethylene (ε ≈ 2.3) gives VF ≈ 0.66; foamed dielectrics give 0.78 to 0.85; open-wire line approaches 0.95 or more. VF matters when a line must be a specific electrical length, such as a quarter-wave matching section or a stub:</p>
<div class="formula">Physical length = (λ / 4) × VF &nbsp;&nbsp; e.g. quarter wave at 14.2 MHz in RG-213: (246 / 14.2) × 0.66 ≈ 11.4 ft</div>

<h4>Common coax types</h4>
<table><thead><tr><th>Cable</th><th>OD</th><th>VF</th><th>Loss dB/100 ft at 10 MHz</th><th>at 30 MHz</th><th>at 150 MHz</th></tr></thead><tbody>
<tr><td>RG-58 (solid PE)</td><td>0.195 in</td><td>0.66</td><td>≈ 1.5</td><td>≈ 2.7</td><td>≈ 6.0</td></tr>
<tr><td>RG-8X (mini-8, foam)</td><td>0.242 in</td><td>0.78–0.82</td><td>≈ 1.0</td><td>≈ 1.9</td><td>≈ 4.5</td></tr>
<tr><td>RG-213 (solid PE)</td><td>0.405 in</td><td>0.66</td><td>≈ 0.6</td><td>≈ 1.1</td><td>≈ 2.7</td></tr>
<tr><td>LMR-400 (foam, foil+braid)</td><td>0.405 in</td><td>0.85</td><td>≈ 0.4</td><td>≈ 0.7</td><td>≈ 1.5</td></tr>
<tr><td>450 Ω window line</td><td>~1 in wide</td><td>≈ 0.91</td><td>≈ 0.1 (matched)</td><td>≈ 0.2</td><td>not usual</td></tr></tbody></table>
<p>Values are approximate matched-line figures from typical manufacturer data; individual products vary. Coax loss rises roughly with the square root of frequency at HF and faster at UHF.</p>
<p>Worked example: 100 ft of RG-58 on 2 m (146 MHz) loses about 6 dB, so 50 W from the radio becomes about 12.5 W at the antenna, and received signals lose the same 6 dB. The same run of LMR-400 loses about 1.5 dB, delivering about 35 W. At 7 MHz the difference is small; at VHF and UHF cable choice is critical.</p>

<h4>Ladder line (open-wire and window line)</h4>
<p>Balanced parallel-conductor lines of 300 to 600 Ω have very low loss because most of the field is in air. They tolerate high SWR with modest additional loss, which makes them ideal for multiband non-resonant antennas fed through a tuner. The disadvantages: they must be kept several inches away from metal and cannot be buried or taped to a tower, they need a balanced tuner or a balun at the tuner, and wet weather changes their characteristics somewhat.</p>

<h4>Mismatch and additional loss</h4>
<p>When the load does not equal Z<sub>0</sub>, part of the power reflects back toward the source (see the SWR article). In a lossless line this reflected power is not lost; a matched transmitter or tuner re-reflects it toward the antenna. In a real line, however, power traveling back and forth suffers line attenuation each trip, so <b>total loss increases with SWR</b>. The effect is small on short, low-loss lines and large on long, lossy lines at high SWR.</p>
<p>Line loss also hides mismatch. Reflected power is attenuated on its way back, so the SWR measured at the radio is lower than at the antenna. Example: 100 ft of RG-58 at 28 MHz (≈ 2.6 dB loss) with a 3:1 SWR at the antenna (|Γ| = 0.5). The reflection returns attenuated by twice the line loss, 5.2 dB, so |Γ| at the radio ≈ 0.5 × 10<sup>−5.2/20</sup> ≈ 0.28 and the measured SWR is only about 1.8:1. A lossy feedline makes a bad antenna look good.</p>

<div class="callout">Practical tip: for runs over about 50 ft above 20 MHz, or any VHF/UHF installation, use RG-213 or LMR-400 class cable. RG-58 is fine for short HF jumpers and portable use.</div>

<h4>Key points</h4>
<ul><li>Use 50 Ω coax to match amateur equipment.</li>
<li>VF = 1/√ε; 0.66 for solid PE, about 0.8 to 0.85 for foam.</li>
<li>Loss increases with frequency, length and SWR.</li>
<li>Ladder line has very low loss even at high SWR but needs careful routing and a balanced match.</li>
<li>A lossy line lowers the SWR you measure at the radio.</li></ul>
`,
    related: ['swr', 'rf-path', 'antenna-tuner', 'formulas'],
  },

  // ---------------------------------------------------- Measurement & tuning
  {
    id: 'swr',
    cat: 'Measurement & tuning',
    title: 'Standing wave ratio (SWR) and reflection',
    summary: 'Reflection coefficient, SWR, return loss and mismatch loss, with a reference table and what "acceptable SWR" really means.',
    minutes: 7,
    html: `
<p>When a feedline is terminated in a load equal to its characteristic impedance Z<sub>0</sub>, all the power traveling toward the load is absorbed. When the load is different, part of the wave reflects. The forward and reflected waves combine along the line into a pattern of voltage maxima and minima: a <b>standing wave</b>. SWR describes how severe that pattern is.</p>

<h4>Reflection coefficient</h4>
<div class="formula">Γ = (Z<sub>L</sub> − Z<sub>0</sub>) / (Z<sub>L</sub> + Z<sub>0</sub>)</div>
<p>Γ (gamma) is a complex number; its magnitude |Γ| runs from 0 (perfect match) to 1 (open or short circuit, all power reflected). The fraction of power reflected is |Γ|².</p>

<h4>SWR</h4>
<div class="formula">SWR = (1 + |Γ|) / (1 − |Γ|) &nbsp;&nbsp;&nbsp; |Γ| = (SWR − 1) / (SWR + 1)</div>
<p>For a purely resistive load the SWR is simply the larger impedance divided by the smaller: a 75 Ω load on a 50 Ω line gives 75/50 = 1.5:1 (Γ = 25/125 = 0.2); a 25 Ω load gives 50/25 = 2:1 (Γ = −25/75 = −0.33). Note that two different loads, 25 Ω and 100 Ω, both give 2:1; SWR alone does not tell you which way the antenna is off, nor whether reactance is present.</p>

<h4>Return loss and mismatch loss</h4>
<div class="formula">Return loss (dB) = −20 log<sub>10</sub>|Γ| &nbsp;&nbsp;&nbsp; Mismatch loss (dB) = −10 log<sub>10</sub>(1 − |Γ|²)</div>
<p>Return loss expresses how far below the forward power the reflected power is; higher is better. Mismatch loss is how much less power a load absorbs than it would if matched, assuming nothing re-reflects the returning wave.</p>

<h4>Reference table</h4>
<table><thead><tr><th>SWR</th><th>|Γ|</th><th>Return loss</th><th>Reflected power</th><th>Mismatch loss</th></tr></thead><tbody>
<tr><td>1.0:1</td><td>0</td><td>∞</td><td>0%</td><td>0 dB</td></tr>
<tr><td>1.5:1</td><td>0.20</td><td>14.0 dB</td><td>4.0%</td><td>0.18 dB</td></tr>
<tr><td>2.0:1</td><td>0.333</td><td>9.5 dB</td><td>11.1%</td><td>0.51 dB</td></tr>
<tr><td>3.0:1</td><td>0.50</td><td>6.0 dB</td><td>25.0%</td><td>1.25 dB</td></tr>
<tr><td>5.0:1</td><td>0.667</td><td>3.5 dB</td><td>44.4%</td><td>2.55 dB</td></tr>
<tr><td>10:1</td><td>0.818</td><td>1.7 dB</td><td>66.9%</td><td>4.81 dB</td></tr></tbody></table>

<h4>Where does reflected power go?</h4>
<p>A common misconception is that reflected power is simply lost. On a lossless line, power reflected from the antenna travels back to the source; if the source (or a tuner) is matched to the line as seen from its end, the power is re-reflected toward the antenna and eventually radiated. With a tuner adjusted correctly, even a high SWR on a low-loss line such as ladder line costs little. The real costs of SWR are:</p>
<ul>
<li><b>Transmitter protection.</b> A solid-state transmitter expects 50 Ω. A mismatch raises voltages or currents in the final amplifier.</li>
<li><b>Additional line loss.</b> Power traveling back and forth on a lossy coax is attenuated on every trip.</li>
<li><b>High voltage and current</b> at points along the line, which can stress connectors and components at high power.</li>
</ul>

<h4>Radio fold-back</h4>
<p>Modern transceivers measure SWR internally and automatically reduce output when it rises. The threshold varies by model, but power reduction typically begins somewhere around 1.5:1 to 2:1 and becomes substantial by 3:1. If a radio produces only a fraction of its rated power into an antenna, fold-back is a likely cause. This is a protective feature, not a fault.</p>

<h4>What is "acceptable"?</h4>
<ul>
<li><b>1.5:1 or less:</b> excellent; no practical loss, no fold-back.</li>
<li><b>Up to 2:1:</b> generally acceptable for solid-state radios without a tuner; mismatch loss 0.5 dB, not noticeable on the air.</li>
<li><b>2:1 to 3:1:</b> use an internal or external tuner; check feedline loss on long coax runs.</li>
<li><b>Above 3:1:</b> beyond most internal tuners; use an external wide-range tuner, ideally with low-loss line, or fix the antenna.</li>
</ul>
<p>A "perfect" 1:1 is not required for good signals. A difference of 0.5 dB is less than a tenth of an S-unit at the receiving end.</p>

<div class="callout">Practical tip: an SWR that is low everywhere, across a wide frequency range, is suspicious. It often indicates a lossy feedline, a dummy load, a failed connection to a resistive component, or a vertical with high ground loss.</div>

<h4>Key points</h4>
<ul><li>Γ = (Z − Z<sub>0</sub>)/(Z + Z<sub>0</sub>); SWR = (1 + |Γ|)/(1 − |Γ|).</li>
<li>Reflected power fraction = |Γ|²: 11% at 2:1, 25% at 3:1.</li>
<li>Reflected power is not automatically lost; extra loss comes from the feedline.</li>
<li>Radios fold back power as SWR rises past roughly 1.5 to 2:1.</li>
<li>Below 2:1 is fine for most purposes.</li></ul>
`,
    related: ['antenna-analyzer', 'antenna-tuner', 'feedlines', 'meters', 'formulas'],
  },
  {
    id: 'antenna-analyzer',
    cat: 'Measurement & tuning',
    title: 'Using an antenna analyzer: reading SWR, R and X',
    summary: 'How to read an SWR sweep and the resistance and reactance traces, find resonance and bandwidth, and decide which way to trim.',
    minutes: 7,
    html: `
<p>An antenna analyzer is a low-power signal source combined with a bridge or vector measurement circuit. It sweeps a range of frequencies and reports SWR and, on most units, the complex impedance Z = R + jX at each frequency. It lets you tune an antenna without transmitting and tells you <em>why</em> the SWR is what it is.</p>

<h4>Reading an SWR sweep</h4>
<svg viewBox="0 0 420 200" class="diag" role="img" aria-label="SWR versus frequency curve with a minimum at resonance and 2 to 1 bandwidth points marked" style="font:11px sans-serif">
<g fill="none" stroke-width="1.5">
<path d="M40 20V170H400" stroke="currentColor"/>
<path d="M40 128H400" style="stroke:var(--muted)" stroke-dasharray="4 3"/>
<path d="M55 30C130 150 175 162 215 162C255 162 300 150 385 30" style="stroke:var(--accent)" stroke-width="2.5"/>
<path d="M215 162V178M135 128V178M298 128V178" stroke="currentColor" stroke-dasharray="2 3"/>
</g>
<g fill="currentColor"><text x="8" y="132">2:1</text><text x="8" y="166">1:1</text><text x="8" y="26">SWR</text><text x="196" y="194">f min</text><text x="112" y="194">2:1 low</text><text x="280" y="194">2:1 high</text><text x="360" y="186">f →</text><text x="170" y="118">2:1 bandwidth</text></g>
<path d="M140 122H293" stroke="currentColor" fill="none"/>
</svg>
<ul>
<li><b>The minimum</b> is the frequency where the antenna is best matched to 50 Ω. For a dipole or vertical this is close to resonance.</li>
<li><b>The minimum value</b> indicates how close the resistance is to 50 Ω. A dipole with a minimum of 1.4:1 probably has R ≈ 70 Ω (or ≈ 35 Ω) at resonance.</li>
<li><b>The 2:1 bandwidth</b> is the span between the frequencies where SWR crosses 2:1. Typical values for a wire dipole: roughly 150 to 250 kHz on 80 m, 300 to 400 kHz on 40 m (enough for the whole band), and wider on higher bands. Thicker conductors give wider bandwidth.</li>
<li>If the minimum is <b>below</b> the band, the antenna is <b>too long</b>; if above, <b>too short</b>.</li>
</ul>

<h4>Resistance and reactance</h4>
<p>The impedance at the feedpoint has two parts. <b>R</b>, the resistive part, includes radiation resistance plus losses; it represents power actually leaving the line. <b>X</b>, the reactive part, represents energy stored and returned each cycle in the antenna's electric or magnetic fields. Resonance is defined as <b>X = 0</b>.</p>
<svg viewBox="0 0 420 180" class="diag" role="img" aria-label="Resistance and reactance versus frequency: reactance negative below resonance, zero at resonance, positive above" style="font:11px sans-serif">
<g fill="none" stroke-width="1.5">
<path d="M40 15V165M40 90H400" stroke="currentColor"/>
<path d="M50 160C150 120 260 60 395 20" style="stroke:var(--accent)" stroke-width="2.5"/>
<path d="M50 72C150 66 260 62 395 52" style="stroke:var(--muted)" stroke-width="2.5" stroke-dasharray="6 3"/>
<path d="M205 90V170" stroke="currentColor" stroke-dasharray="2 3"/>
</g>
<g fill="currentColor"><text x="4" y="24">+X</text><text x="4" y="164">−X</text><text x="8" y="94">0</text><text x="60" y="150">X &lt; 0: capacitive, too short</text><text x="226" y="30">X &gt; 0: inductive, too long</text><text x="320" y="70">R</text><text x="210" y="178">resonance, X = 0</text></g>
</svg>
<ul>
<li><b>X &lt; 0 (capacitive):</b> the antenna is electrically <b>too short</b> at this frequency. Below resonance a dipole looks capacitive.</li>
<li><b>X &gt; 0 (inductive):</b> the antenna is electrically <b>too long</b> at this frequency.</li>
<li><b>X = 0:</b> resonance. R at that frequency is the radiation resistance plus losses.</li>
</ul>
<p>Many low-cost analyzers display |X| without a sign. To determine the sign, change frequency slightly: for a simple antenna near series resonance, |X| decreases as you move toward resonance. Some analyzers show the sign directly or display a Smith chart.</p>
<p>The SWR minimum and X = 0 usually coincide closely but not exactly, because R also changes with frequency. For trimming purposes the SWR minimum is adequate.</p>

<h4>Where to measure</h4>
<p>Measuring directly at the feedpoint gives the true antenna impedance. Measuring at the shack end of the feedline is more convenient, and on a low-loss line the <b>frequency of the SWR minimum is the same</b>, because SWR does not vary along a lossless line. However, the line transforms R and X: the values at the shack end equal the antenna values only if the line is an electrical half wavelength (or a multiple) long at that frequency. Feedline loss also lowers the measured SWR. Most analyzers can compensate for a known line if configured to do so.</p>

<h4>Step-by-step procedure</h4>
<ol>
<li>Discharge static from the antenna by briefly shorting the coax center to shield (antennas accumulate charge, which can damage an analyzer input).</li>
<li>Connect the analyzer, set the sweep to cover the band plus some margin on both sides.</li>
<li>Find the SWR minimum frequency and value. Note the 2:1 points.</li>
<li>Check X at your target frequency: negative means lengthen, positive means shorten.</li>
<li>Compute the length correction: L<sub>new</sub> = L<sub>old</sub> × f<sub>measured</sub> / f<sub>target</sub>.</li>
<li>Adjust symmetrically, re-hoist and repeat until the minimum is where you want it.</li>
<li>If the minimum value is high (above about 1.5:1) at resonance, R is far from 50 Ω; consider a matching network, a different height or configuration, or check for a fault.</li>
</ol>

<div class="callout">Practical tip: strong signals from nearby AM broadcast stations or other transmitters can upset analyzer readings, especially on 160 and 80 m. If readings are erratic, try a different time of day or a unit with a filtered detector.</div>

<h4>Key points</h4>
<ul><li>SWR minimum below the band means too long; above means too short.</li>
<li>X &lt; 0 capacitive (too short); X &gt; 0 inductive (too long); X = 0 is resonance.</li>
<li>2:1 bandwidth shows usable range without a tuner.</li>
<li>The SWR-minimum frequency survives a low-loss feedline; R and X do not.</li>
<li>Discharge the antenna before connecting the analyzer.</li></ul>
`,
    related: ['swr', 'dipole-build', 'antenna-basics', 'antenna-tuner', 'formulas'],
  },
  {
    id: 'antenna-tuner',
    cat: 'Measurement & tuning',
    title: 'Antenna tuners: what they do and how to use them',
    summary: 'A tuner matches the transmitter to the feedline; it does not fix the antenna. Network types, tuning procedure and losses.',
    minutes: 6,
    html: `
<p>An antenna tuner, more accurately an <b>impedance matching network</b> or transmatch, transforms the impedance it sees at its output into 50 Ω at its input. The transceiver then sees a low SWR and delivers full power without fold-back. That is all a tuner does.</p>

<h4>What a tuner does not do</h4>
<p>A tuner in the shack does not change the SWR on the feedline between the tuner and the antenna, does not change the antenna's resonance, and does not make a poor antenna radiate better. If the feedline is lossy coax and the antenna is badly mismatched, a large fraction of the power can still be lost in the line even though the radio shows 1:1. A tuner is most effective with low-loss line (ladder line or short, heavy coax), or when placed at the antenna feedpoint.</p>

<h4>Network types</h4>
<ul>
<li><b>L-network:</b> two elements, one in series and one in shunt. It can match any resistive load with the right arrangement and is very efficient, but needs switching to reverse the configuration for loads above or below 50 Ω. Most automatic tuners use L-networks with relay-switched banks of inductors and capacitors.</li>
<li><b>T-network:</b> series capacitor, shunt inductor, series capacitor; a high-pass design. It matches a very wide range of impedances with simple controls and is common in manual tuners. Its weakness is that it has many settings that produce a match, some with very high circulating current and significant loss.</li>
<li><b>Pi-network:</b> shunt C, series L, shunt C; low-pass, the same topology used in tube amplifier output stages.</li>
<li><b>Balanced tuners</b> (or a tuner with a balun) feed ladder line.</li>
</ul>

<h4>Internal and automatic tuners</h4>
<p>Many transceivers contain an internal automatic tuner. These typically match SWRs up to about <b>3:1</b> on HF (some specify slightly less on 6 m). They are intended to touch up a nearly resonant antenna, for example to use the whole band with a dipole, not to load a random wire. External automatic tuners often handle 10:1 or more. A remote automatic tuner mounted at the antenna base (for example at a vertical or end-fed wire) is especially effective because the coax then runs at low SWR.</p>

<h4>Manual tuning procedure</h4>
<ol>
<li>Set the transceiver to the operating frequency and reduce power to <b>10 W or less</b> (or the tuner manufacturer's recommended tuning power). Check that the frequency is clear and identify if you transmit.</li>
<li>Set the tuner to a previously recorded setting for that band, or to the manual's starting point.</li>
<li>In receive, adjust the controls for maximum background noise. This gets you near the match without transmitting.</li>
<li>Transmit a steady carrier (CW key-down, or AM/FM/RTTY mode at low power) and adjust the controls alternately for minimum reflected power on the meter between the radio and tuner.</li>
<li>For a T-network, among the settings that give a match, prefer the one with the <b>greatest output capacitance</b> (and generally the least inductance); this usually gives the lowest loss.</li>
<li>Record the settings for each band segment, then increase power.</li>
</ol>

<h4>Tuner losses</h4>
<p>Real inductors have resistance, and a matching network can circulate RF currents several times higher than in the line. Losses are typically a fraction of a dB for modest mismatches but can reach several dB at extreme impedances, particularly very low resistances (short antennas on low bands). Signs of excessive loss are a tuner that gets warm, arcing in capacitors, or a match that drifts as components heat. A match obtained with a very narrow, touchy setting is often a lossy one.</p>

<div class="callout">Practical tip: a tuner that will not match on one band can often be helped by changing the feedline length by a quarter wavelength or so; this changes the impedance the tuner sees without changing the antenna.</div>
<div class="callout warn">Safety: never adjust a tuner's controls or switch the inductor while transmitting at high power. The arc can damage switch contacts, and inside the tuner RF voltages can reach kilovolts.</div>

<h4>Key points</h4>
<ul><li>A tuner matches the radio to the line; it does not fix the antenna or the line SWR.</li>
<li>L-networks are efficient; T-networks are flexible but can be lossy.</li>
<li>Internal ATUs typically handle about 3:1.</li>
<li>Tune at 10 W or less; peak receive noise first.</li>
<li>Low-loss feedline or a tuner at the feedpoint makes tuning effective.</li></ul>
`,
    related: ['swr', 'feedlines', 'rf-path', 'efhw', 'meters'],
  },
  {
    id: 'meters',
    cat: 'Measurement & tuning',
    title: 'Meters: S-meter, power and SWR meters, PEP versus average',
    summary: 'The S-unit scale and its dBm calibration, how directional wattmeters work, and the difference between PEP and average power.',
    minutes: 6,
    html: `
<h4>The S-meter</h4>
<p>The S-meter indicates received signal strength on a scale from S1 to S9, with values above S9 given in decibels (S9 + 10 dB, S9 + 20 dB and so on). The IARU Region 1 technical recommendation (R.1, 1981) defines the scale:</p>
<ul>
<li>Each S-unit is <b>6 dB</b> (a doubling of signal voltage, four times the power).</li>
<li>On HF (below 30 MHz), <b>S9 = 50 µV</b> into 50 Ω = <b>−73 dBm</b>.</li>
<li>On VHF and above, S9 = 5 µV = −93 dBm.</li>
</ul>
<table><thead><tr><th>S-unit (HF)</th><th>dBm</th><th>µV into 50 Ω</th></tr></thead><tbody>
<tr><td>S9 + 20 dB</td><td>−53</td><td>500</td></tr>
<tr><td>S9 + 10 dB</td><td>−63</td><td>158</td></tr>
<tr><td>S9</td><td>−73</td><td>50</td></tr>
<tr><td>S8</td><td>−79</td><td>25</td></tr>
<tr><td>S7</td><td>−85</td><td>12.6</td></tr>
<tr><td>S6</td><td>−91</td><td>6.3</td></tr>
<tr><td>S5</td><td>−97</td><td>3.2</td></tr>
<tr><td>S3</td><td>−109</td><td>0.8</td></tr>
<tr><td>S1</td><td>−121</td><td>0.2</td></tr></tbody></table>
<p>In practice, few amateur receivers follow this standard accurately. Many compress the lower S-units to 3 or 4 dB each, and readings change with preamp and attenuator settings. Treat S-meter reports as relative, not absolute.</p>
<p>The 6 dB per S-unit convention has a useful consequence: <b>doubling transmitter power (+3 dB) raises the received signal only half an S-unit</b>. Going from 100 W to 1,500 W (+11.8 dB) is about two S-units. Antenna improvements are often more cost-effective than power.</p>

<h4>Power and SWR meters</h4>
<p>An in-line RF wattmeter uses a <b>directional coupler</b>, a sampling circuit that responds separately to the wave traveling toward the antenna (forward) and the wave returning (reflected). From these, the meter computes SWR:</p>
<div class="formula">|Γ| = √(P<sub>ref</sub> / P<sub>fwd</sub>) &nbsp;&nbsp; SWR = (1 + |Γ|) / (1 − |Γ|) &nbsp;&nbsp; Power delivered = P<sub>fwd</sub> − P<sub>ref</sub></div>
<p>Example: forward 100 W, reflected 11 W: |Γ| = √0.11 = 0.33, SWR ≈ 2:1, delivered about 89 W into the line. Common meter styles:</p>
<ul>
<li><b>Cross-needle</b> meters show forward and reflected power simultaneously; SWR is read where the needles cross.</li>
<li><b>Switched single-meter</b> designs require a calibrate step (set forward to full scale, then switch to read SWR).</li>
<li><b>Plug-in element</b> wattmeters (sometimes called "slug" type) use interchangeable elements for each frequency and power range and are the laboratory-grade standard.</li>
</ul>
<p>Meters are rated for a frequency range and power range; accuracy is commonly ±5 to 10% of full scale, so readings near the bottom of a scale are less reliable.</p>

<h4>PEP versus average power</h4>
<p><b>Peak envelope power (PEP)</b> is the average power during one RF cycle at the crest of the modulation envelope. It is the measure used in FCC rules (for example, the 1,500 W PEP maximum for amateurs). <b>Average power</b> is the mean over a longer time.</p>
<table><thead><tr><th>Mode</th><th>Average / PEP</th></tr></thead><tbody>
<tr><td>CW key down, FM, constant-carrier digital (FT8)</td><td>≈ 100%</td></tr>
<tr><td>SSB two-tone test</td><td>50%</td></tr>
<tr><td>SSB voice, no processing</td><td>roughly 10 to 25%</td></tr>
<tr><td>SSB voice, heavy speech processing</td><td>roughly 30 to 50%</td></tr></tbody></table>
<p>An average-reading meter on SSB voice will show a needle that flicks well below the transmitter's PEP; that is normal. Use a peak-reading meter to check SSB output. To compute PEP from a peak voltage measured across a 50 Ω load:</p>
<div class="formula">PEP = (V<sub>peak</sub> × 0.707)² / R &nbsp;&nbsp; e.g. 100 V peak across 50 Ω: (70.7)² / 50 = 100 W PEP</div>

<div class="callout">Practical tip: when giving signal reports, remember a "20 over S9" signal and an "S7" signal differ by 32 dB, a factor of about 1,600 in power. Small S-meter differences are not significant.</div>

<h4>Key points</h4>
<ul><li>S-unit = 6 dB; HF S9 = −73 dBm (50 µV); VHF S9 = −93 dBm.</li>
<li>Doubling power gives half an S-unit.</li>
<li>Directional wattmeters measure forward and reflected power; SWR follows from their ratio.</li>
<li>PEP is the regulatory measure; average power on SSB voice is much lower.</li></ul>
`,
    related: ['swr', 'formulas', 'receiver-controls', 'rf-path'],
  },

  // -------------------------------------------------------------- Receiving
  {
    id: 'who-is-where',
    cat: 'Receiving',
    title: 'The whole dial: who uses which frequencies, and why',
    summary: 'What each part of the radio spectrum is good at, who was given it, and whether a private person in the US may listen or transmit there.',
    minutes: 7,
    html: `
<p>A receiver that tunes from 500 kHz to 500 MHz covers almost every kind of two-way radio there is. It is not a random jumble. Each service sits where the physics suits its job, and once you know the pattern you can guess what you are hearing from the frequency alone. In the simulator, the <b>Where you are</b> panel above the radio does this for whatever is tuned in, and <b>Whole dial</b> lists every band.</p>

<h4>Frequency decides range</h4>
<table><thead><tr><th>Range</th><th>How it travels</th><th>So it is used by</th></tr></thead><tbody>
<tr><td>Below 2 MHz</td><td>Along the ground by day; reflected by the ionosphere at night</td><td>AM broadcasting, navigation beacons, time signals</td></tr>
<tr><td>2 to 30 MHz (HF, "shortwave")</td><td>Reflected by the ionosphere, across oceans; which frequencies work depends on the hour and the sun</td><td>Anyone who needs distance with no infrastructure: international broadcasters, ships, aircraft over oceans, the military, and radio amateurs</td></tr>
<tr><td>30 to 300 MHz (VHF)</td><td>Line of sight, a little past the horizon, over hills fairly well</td><td>County-wide services: fire, police, railways, boats, aircraft, FM radio, weather radio, the 2 m amateur band</td></tr>
<tr><td>300 MHz and up (UHF)</td><td>Line of sight, short antennas, good inside buildings</td><td>Handhelds in towns: businesses, city services, FRS and GMRS walkie-talkies, the 70 cm amateur band</td></tr>
</tbody></table>
<p>The same rule explains <b>when</b> to use a band. In daylight the D layer of the ionosphere absorbs the lower shortwave frequencies and the F layer reflects the higher ones, so go high by day (20 m to 10 m) and low by night (40 m to 160 m). VHF and UHF do not care about the hour; they care about antenna height.</p>

<h4>Why hams have bands everywhere</h4>
<p>The amateur service is the only one given a slice in every part of the spectrum, so that amateurs can experiment with every kind of propagation. Each band has a personality: 80 m for regional evening nets, 40 m for something at any hour, 20 m for daytime worldwide contacts, 10 m for low-power miracles when the sun is active, and 2 m for local repeaters. Inside each band, Morse and data sit at the bottom and voice at the top, partly by rule and partly by agreement.</p>

<h4>May I listen?</h4>
<p>In the United States, almost always yes. Federal law allows reception of radio signals sent in the clear. The exceptions: cellular telephone calls may not be intercepted, and scrambled or encrypted traffic may not be decoded. What you overhear on channels that are not broadcast, amateur or CB is not yours to pass on or profit from (Communications Act section 705), and a few states restrict scanners in vehicles. Other countries are stricter. This is a summary, not legal advice.</p>
<p>You need very little to listen for real: a $30 shortwave portable, a $25 handheld (owning one and listening needs no licence), a $30 RTL-SDR dongle for a computer, or nothing at all, using the web receivers on the Live feeds page.</p>

<h4>May I transmit?</h4>
<p>Only with authority, and the authority depends on the service.</p>
<table><thead><tr><th>Step</th><th>What it takes</th><th>What you get</th></tr></thead><tbody>
<tr><td>FRS, CB, MURS</td><td>Nothing: no licence, no exam. Use a radio certified for that service.</td><td>FRS: 2 W UHF walkie-talkies, a mile or so. CB: 4 W at 27 MHz, a few miles from a vehicle. MURS: 2 W VHF, five channels.</td></tr>
<tr><td>GMRS</td><td>A $35 FCC licence, no exam, covering your family for ten years</td><td>Up to 50 W on the walkie-talkie channels, and repeaters</td></tr>
<tr><td>Technician</td><td>One 35-question exam</td><td>Every amateur band above 30 MHz (6 m, 2 m, 70 cm and up), plus 10 m voice from 28.3 to 28.5 MHz and Morse on parts of 80, 40 and 15 m</td></tr>
<tr><td>General</td><td>A second 35-question exam</td><td>Most of every HF band: worldwide voice, Morse and data</td></tr>
<tr><td>Amateur Extra</td><td>A 50-question exam</td><td>The remaining HF segments</td></tr>
</tbody></table>
<p>Everything else is closed to private individuals. Aviation and marine channels are for aircraft and vessels. Police, fire, railway and business channels belong to the agency or company that holds the licence. Broadcast bands need a broadcast licence. Federal frequencies cannot be licensed at all. An amateur transceiver is not certified for CB, FRS, GMRS, MURS or marine use, so a ham licence does not let you use it there.</p>
<p>The one exception is a real emergency. FCC rules never prevent an amateur station from using any means of radio at its disposal to call for help when human life is in immediate danger and normal communication is not available (47 CFR 97.403 and 97.405).</p>

<h4>Helper channels</h4>
<p>Every amateur band and every kind of non-amateur traffic in the simulator has a <b>helper channel</b>: the simulator's own station, which does not exist on the air. Tune to one and it explains aloud who is on that band, why they are there, what hardware you would connect to hear or use it, and which exam facts belong to it. The same briefing appears in writing in the panel above the radio. Because the helpers carry the explanation, the bands hold fewer invented stations than before.</p>
`,
    related: ['bandplan', 'licensing', 'tuning-searching', 'band-by-band'],
  },
  {
    id: 'bandplan',
    cat: 'Receiving',
    title: 'US amateur bands and license privileges',
    summary: 'Frequency limits for the US amateur bands from 160 m to 70 cm, the CW/data and phone segments, and what each license class may use.',
    minutes: 8,
    html: `
<p>The FCC allocates amateur frequencies in Part 97 (sections 97.301 and 97.305). The rules define which <b>emission types</b> (CW, data/RTTY, phone, image) are permitted in each segment and which <b>license classes</b> may transmit there. Separately, voluntary <em>band plans</em> published by the ARRL and regional coordinators recommend where specific activities (FT8, SSTV, beacons, repeaters) take place within those legal limits.</p>

<h4>HF bands</h4>
<table><thead><tr><th>Band</th><th>Limits (MHz)</th><th>Extra</th><th>General</th><th>Technician</th></tr></thead><tbody>
<tr><td>160 m</td><td>1.800–2.000</td><td>All modes, whole band</td><td>All modes, whole band</td><td>None</td></tr>
<tr><td>80 m</td><td>3.500–4.000</td><td>CW/data 3.500–3.600; phone 3.600–4.000</td><td>CW/data 3.525–3.600; phone 3.800–4.000</td><td>CW only 3.525–3.600</td></tr>
<tr><td>60 m</td><td>5 channels near 5.3–5.4</td><td>USB phone, CW, data; 100 W ERP</td><td>Same as Extra</td><td>None</td></tr>
<tr><td>40 m</td><td>7.000–7.300</td><td>CW/data 7.000–7.125; phone 7.125–7.300</td><td>CW/data 7.025–7.125; phone 7.175–7.300</td><td>CW only 7.025–7.125</td></tr>
<tr><td>30 m</td><td>10.100–10.150</td><td>CW/data only; 200 W PEP</td><td>Same as Extra</td><td>None</td></tr>
<tr><td>20 m</td><td>14.000–14.350</td><td>CW/data 14.000–14.150; phone 14.150–14.350</td><td>CW/data 14.025–14.150; phone 14.225–14.350</td><td>None</td></tr>
<tr><td>17 m</td><td>18.068–18.168</td><td>CW/data 18.068–18.110; phone 18.110–18.168</td><td>Same as Extra</td><td>None</td></tr>
<tr><td>15 m</td><td>21.000–21.450</td><td>CW/data 21.000–21.200; phone 21.200–21.450</td><td>CW/data 21.025–21.200; phone 21.275–21.450</td><td>CW only 21.025–21.200</td></tr>
<tr><td>12 m</td><td>24.890–24.990</td><td>CW/data 24.890–24.930; phone 24.930–24.990</td><td>Same as Extra</td><td>None</td></tr>
<tr><td>10 m</td><td>28.000–29.700</td><td>CW/data 28.000–28.300; phone 28.300–29.700</td><td>Same as Extra</td><td>CW/data 28.000–28.300; SSB 28.300–28.500</td></tr></tbody></table>
<p>Notes: CW is permitted throughout every amateur band. Technician HF privileges are limited to 200 W PEP. The 60 m band has historically consisted of five specific channels (center frequencies 5332, 5348, 5358.5, 5373 and 5405 kHz) with USB voice, CW and certain data modes at 100 W ERP; the FCC has considered changes to this allocation, so check the current rules before operating there. The holders of the grandfathered Advanced class have additional phone segments between the General and Extra limits.</p>

<h4>VHF and UHF bands</h4>
<table><thead><tr><th>Band</th><th>Limits (MHz)</th><th>Privileges</th><th>Notes</th></tr></thead><tbody>
<tr><td>6 m</td><td>50.0–54.0</td><td>Technician and above</td><td>50.0–50.1 CW only; SSB calling 50.125; FM simplex 52.525</td></tr>
<tr><td>2 m</td><td>144.0–148.0</td><td>Technician and above</td><td>144.0–144.1 CW only; SSB calling 144.200; FM simplex calling 146.520</td></tr>
<tr><td>1.25 m</td><td>222.0–225.0</td><td>Technician and above</td><td>219–220 MHz restricted to fixed digital message forwarding; FM calling 223.500</td></tr>
<tr><td>70 cm</td><td>420.0–450.0</td><td>Technician and above</td><td>Shared with government radiolocation; FM simplex calling 446.000; SSB 432.100</td></tr></tbody></table>
<p>Above 50 MHz, all license classes from Technician up share full privileges. The maximum transmitter power for any amateur is 1,500 W PEP except where specific limits apply.</p>

<h4>License privileges summarized</h4>
<ul>
<li><b>Technician:</b> all amateur bands above 50 MHz; CW on parts of 80, 40 and 15 m; CW, data and SSB phone on parts of 10 m.</li>
<li><b>General:</b> adds most of every HF band, including phone on 160, 80, 60, 40, 20, 17, 15, 12 and 10 m, but excludes the bottom 25 kHz of 80, 40, 20 and 15 m and some phone sub-bands reserved for Extra.</li>
<li><b>Amateur Extra:</b> all amateur privileges.</li>
</ul>

<h4>Staying inside the band edges</h4>
<p>The displayed frequency on a transceiver is the suppressed-carrier frequency for SSB, but the signal occupies about 3 kHz to one side. On LSB, the signal extends <em>below</em> the dial; on USB, <em>above</em> it. A General operator on 40 m LSB must therefore set the dial at least about 3 kHz above 7.175 MHz (for example, 7.178 MHz or higher) to keep the whole signal within privileges; on 20 m USB, the dial must be at least 3 kHz below 14.350 MHz. CW and data signals are narrow but also need a small margin at band edges.</p>

<h4>Voluntary band plans</h4>
<p>Within the legal segments, common practice groups activities: CW usually near the bottom of each band, digital modes such as FT8 at specific frequencies (for example 7.074 and 14.074 MHz), SSTV near 14.230 MHz, and beacons at 14.100, 18.110, 21.150, 24.930 and 28.200 MHz (the International Beacon Project). Following the band plan avoids conflict even where the rules would allow otherwise.</p>

<div class="callout">Practical tip: print the ARRL band chart (or your national equivalent) and keep it at the operating position. Privileges change occasionally; always confirm against current FCC rules.</div>

<h4>Key points</h4>
<ul><li>Part 97 defines legal segments; band plans add voluntary conventions.</li>
<li>Technician: full VHF/UHF privileges plus limited HF CW and 10 m SSB.</li>
<li>General: most HF; Extra: everything.</li>
<li>Account for SSB bandwidth near segment edges.</li>
<li>60 m is channelized with USB voice and an ERP limit.</li></ul>
`,
    related: ['licensing', 'modes', 'band-by-band', 'tuning-searching'],
  },
  {
    id: 'modes',
    cat: 'Receiving',
    title: 'Operating modes: CW, SSB, AM, FM and digital',
    summary: 'How each common mode works, its bandwidth, sideband conventions, and the popular digital modes FT8 and PSK31.',
    minutes: 7,
    html: `
<p>A <em>mode</em> is the way information is impressed on the radio signal. Each represents a trade-off between bandwidth, power efficiency, audio quality and ability to get through weak or noisy conditions.</p>

<h4>CW (Morse code)</h4>
<p>CW (continuous wave) switches a single carrier on and off. A well-shaped CW signal at typical speeds occupies roughly 100 to 200 Hz, so receivers can use very narrow filters (200 to 500 Hz) that admit little noise. CW is therefore the most power-efficient traditional mode: a CW signal can be copied under conditions that would make SSB unintelligible, often by 10 dB or more. See the CW article.</p>

<h4>SSB (single sideband)</h4>
<p>An AM signal consists of a carrier and two identical sidebands. SSB removes the carrier and one sideband, putting all the transmitter power into one voice-carrying sideband about <b>2.4 to 3 kHz</b> wide. It is the standard voice mode on HF.</p>
<ul>
<li><b>LSB</b> (lower sideband) is conventional <b>below 10 MHz</b>: 160, 80 and 40 m.</li>
<li><b>USB</b> (upper sideband) is conventional <b>above 10 MHz</b>: 20, 17, 15, 12, 10 m and VHF/UHF SSB.</li>
<li><b>Exception: 60 m</b> uses USB by FCC rule, despite being below 10 MHz.</li>
</ul>
<p>The convention is historical (it arose from early heterodyne filter designs) but is universal; a signal received on the wrong sideband sounds inverted and unintelligible. Digital modes on HF use USB on all bands by convention.</p>
<p>Because SSB has no carrier, the receiver must reinsert one at the correct frequency. If tuned slightly off, voices sound high-pitched ("Donald Duck") or low and muffled. Tuning SSB is covered in the searching article.</p>

<h4>AM (amplitude modulation)</h4>
<p>AM transmits the carrier and both sidebands. It occupies about <b>6 kHz</b> (twice the audio bandwidth) and is less efficient: at 100% modulation two-thirds of the power is in the carrier, which carries no information. AM survives in amateur radio as a niche with excellent audio fidelity, commonly around 3.885, 7.290 and 29.000 to 29.200 MHz in the US. Keep AM operation courteous given its width.</p>

<h4>FM (frequency modulation)</h4>
<p>FM varies the carrier frequency with the audio. Amateur voice FM uses about ±5 kHz deviation (wideband) or ±2.5 kHz (narrowband) and occupies roughly <b>11 to 16 kHz</b>. FM has a <em>capture effect</em>: the stronger of two signals on a channel dominates, and noise disappears once the signal is above threshold, giving clear audio. It is the standard for VHF/UHF repeaters and simplex, and is used on 10 m above 29.5 MHz. It is wasteful of spectrum and weak-signal performance for HF.</p>

<h4>Digital modes</h4>
<table><thead><tr><th>Mode</th><th>Bandwidth</th><th>Character</th><th>Common frequencies (USB dial, MHz)</th></tr></thead><tbody>
<tr><td>FT8</td><td>50 Hz</td><td>15-second timed transmissions; decodes below −20 dB SNR in 2.5 kHz bandwidth; minimal exchange</td><td>1.840, 3.573, 5.357, 7.074, 10.136, 14.074, 18.100, 21.074, 24.915, 28.074, 50.313</td></tr>
<tr><td>FT4</td><td>about 90 Hz</td><td>Faster 7.5-second cycle, for contesting</td><td>7.0475, 14.080, 21.140</td></tr>
<tr><td>PSK31</td><td>about 60 Hz</td><td>Real-time keyboard conversation</td><td>7.070, 14.070</td></tr>
<tr><td>RTTY</td><td>about 250 to 500 Hz</td><td>45.45 baud, 170 Hz shift; contests</td><td>14.080 to 14.100 region</td></tr>
<tr><td>Winlink / VARA / PACTOR</td><td>500 Hz to 2.4 kHz</td><td>Email over radio; emergency use</td><td>Assigned channels</td></tr></tbody></table>
<p>FT8 requires accurate computer clock time (within about one second) because transmissions are synchronized to 15-second periods. Its sensitivity is remarkable, but it conveys only call signs, grid locator and signal reports. Digital modes generate constant-envelope signals that run the transmitter at near 100% duty cycle while transmitting, so many operators reduce power to protect the final amplifier.</p>

<h4>Bandwidth summary</h4>
<table><thead><tr><th>Mode</th><th>Typical occupied bandwidth</th><th>Typical receive filter</th></tr></thead><tbody>
<tr><td>CW</td><td>100–200 Hz</td><td>250–500 Hz</td></tr>
<tr><td>FT8</td><td>50 Hz (within a 3 kHz passband)</td><td>2.5–3 kHz (software decodes all)</td></tr>
<tr><td>SSB</td><td>2.4–3 kHz</td><td>2.4–2.7 kHz</td></tr>
<tr><td>AM</td><td>6 kHz</td><td>6 kHz</td></tr>
<tr><td>FM (amateur)</td><td>11–16 kHz</td><td>12–15 kHz</td></tr></tbody></table>

<div class="callout">Practical tip: when you hear a signal and do not recognize it, check the mode first. A garbled voice is often SSB on the wrong sideband; a steady warbling tone may be a digital mode; a raspy hiss with a rhythm may be RTTY.</div>

<h4>Key points</h4>
<ul><li>CW is narrowest and most power-efficient of the traditional modes.</li>
<li>SSB: LSB below 10 MHz, USB above; 60 m is USB by rule.</li>
<li>AM about 6 kHz; FM about 11 to 16 kHz with capture effect.</li>
<li>FT8 is extremely sensitive, 50 Hz wide, and time-synchronized.</li></ul>
`,
    related: ['bandplan', 'tuning-searching', 'cw', 'receiver-controls'],
  },
  {
    id: 'tuning-searching',
    cat: 'Receiving',
    title: 'Tuning and searching a band methodically',
    summary: 'Choosing a band, setting the receiver up, scanning for signals, tuning SSB and CW correctly, and using the waterfall and filters.',
    minutes: 7,
    html: `
<p>Listening well is the foundation of operating. Experienced operators find more stations not because their receivers are better, but because they search systematically and set up the receiver properly before they start.</p>

<h4>1. Pick the band for the time of day</h4>
<p>Propagation determines what you can hear. As a general guide (details in the band-by-band article):</p>
<ul>
<li><b>Daytime:</b> 20, 17, 15 m (and 12 and 10 m at higher solar activity) for long distance; 40 m for regional contacts.</li>
<li><b>Evening and night:</b> 40, 80 and 160 m; 20 m often stays open into the evening.</li>
<li>Check solar indices and beacons (14.100, 18.110, 21.150, 24.930, 28.200 MHz) for a quick indication of which bands are open.</li>
</ul>

<h4>2. Set up the receiver</h4>
<ol>
<li>Select the mode and sideband appropriate for the segment (LSB below 10 MHz, USB above; CW in the lower segment).</li>
<li>Set the <b>filter width</b>: about 2.4 kHz for SSB, 500 Hz for searching CW (narrow to 250 Hz on a crowded band).</li>
<li>Set the <b>AGC</b>: slow for SSB, fast for CW.</li>
<li>Set RF gain fully up (or use it to reduce noise on noisy low bands), AF gain to a comfortable level on band noise.</li>
<li>Choose the <b>preamp/attenuator</b>: on 160 to 40 m, atmospheric noise usually exceeds receiver noise, so the preamp adds nothing but overload; on 15 to 10 m, a preamp can help.</li>
<li>Set the tuning <b>step</b>: 10 Hz or a fine knob rate for SSB and CW; larger steps (1 kHz) only for moving quickly between segments.</li>
<li>Center RIT/XIT to zero.</li>
</ol>

<h4>3. Scan the segment</h4>
<p>Tune slowly and steadily through the segment in one direction. On SSB, tune at a rate of roughly 1 kHz every second or two; a signal is recognized as a change from the hiss. On a panadapter or waterfall display, you can see signals as bright traces and click to them directly, which is much faster on a busy band. Note frequencies of interesting signals and come back; many stations are in contacts and will call CQ when they finish.</p>

<h4>4. Tune an SSB signal correctly</h4>
<p>When you find an SSB signal, adjust the tuning in small steps until the voice sounds natural. If it sounds high-pitched and thin, you are tuned too far in one direction; if low and muffled, too far in the other. If it is completely unintelligible no matter how you tune, you are probably on the wrong sideband. Being within about 20 to 50 Hz sounds natural for most voices. Once a contact is under way, use RIT rather than the main dial to fine-tune the other station so your transmit frequency stays put.</p>

<h4>5. Zero-beat a CW signal</h4>
<p>Your transceiver produces a CW sidetone (often 600 to 700 Hz). To transmit exactly on the other station's frequency, tune until the received tone matches your sidetone pitch. Most radios offer a tuning indicator or an automatic "CW zero" function, and some offer a spot tone for comparison. Calling off-frequency is a common reason replies are missed by stations using narrow filters.</p>

<h4>6. Use the receiver's interference tools</h4>
<ul>
<li><b>Filter width and passband shift (IF shift):</b> narrow the filter or move the passband to exclude an adjacent signal.</li>
<li><b>Notch filter:</b> removes a steady carrier (a heterodyne) from the audio.</li>
<li><b>Noise blanker:</b> for impulsive noise (ignition, electric fences). It can cause distortion on a busy band; turn it off when not needed.</li>
<li><b>Noise reduction (DSP NR):</b> reduces random hiss; set modestly, because high settings distort weak signals.</li>
<li><b>Attenuator:</b> when strong signals cause overload (distortion, intermodulation "splatter" heard all across the band), add 10 to 20 dB of attenuation. If the band noise drops but signals remain readable, you lose nothing.</li>
</ul>

<h4>7. Listen before transmitting</h4>
<p>Before calling, listen long enough to understand what is happening on the frequency: is the station in a contact, running a pileup, operating split, or part of a net? This is both courtesy and good tactics.</p>

<div class="callout">Practical tip: if you hear a weak station, try narrowing the filter, adding RIT, and switching antennas before giving up. Weak signals also fade in and out (QSB); wait for a peak.</div>

<h4>Key points</h4>
<ul><li>Choose the band by time of day and solar conditions.</li>
<li>Set mode, filter, AGC, gain and step before searching.</li>
<li>Scan slowly in one direction, or use the waterfall.</li>
<li>Tune SSB until the voice is natural; zero-beat CW to your sidetone.</li>
<li>Use the attenuator if strong signals overload the receiver.</li></ul>
`,
    related: ['receiver-controls', 'modes', 'band-by-band', 'qso', 'cw'],
  },
  {
    id: 'receiver-controls',
    cat: 'Receiving',
    title: 'Receiver controls explained',
    summary: 'What AF and RF gain, squelch, AGC, IF filters, noise blanker and reduction, attenuator, preamp, RIT/XIT and VFO step actually do.',
    minutes: 6,
    html: `
<p>Modern transceivers have many receive controls, most of which exist to help copy a weak signal in the presence of noise or strong adjacent signals. Understanding what each does in the signal chain makes it clear when to use it.</p>

<h4>AF gain</h4>
<p>The audio (volume) control. It changes only the loudness at the speaker; it does not affect what the receiver can or cannot copy.</p>

<h4>RF gain</h4>
<p>Controls the gain of the RF and IF stages ahead of the detector. At maximum, the receiver is most sensitive and the AGC sets the operating level. Reducing RF gain lowers the noise floor and the S-meter "parks" at a higher reading; signals below that level become inaudible. On noisy low bands this produces a quieter background and less listener fatigue. Many operators keep RF gain fully up and use AGC instead; both approaches are valid.</p>

<h4>Squelch</h4>
<p>Mutes the audio until a signal exceeds a threshold. Essential on FM to silence the loud noise between transmissions. Set it just past the point where noise is silenced; setting it higher will cut off weak stations. On SSB and CW, squelch is normally left open because weak signals are what you are looking for.</p>

<h4>AGC (automatic gain control)</h4>
<p>AGC adjusts receiver gain automatically so that strong and weak signals produce similar audio levels. Its <em>decay</em> (release) time is selectable:</p>
<ul>
<li><b>Fast</b> (roughly 0.1 to 0.3 s): CW and rapid fading; the gain recovers quickly between characters.</li>
<li><b>Slow</b> (roughly 1 to 3 s): SSB voice; prevents noise from pumping up between words.</li>
<li><b>Off</b>: occasionally used for weak-signal CW with RF gain set manually; beware loud signals.</li>
</ul>

<h4>IF filter width and passband shift</h4>
<p>The IF filter (analog crystal or DSP) sets how much spectrum reaches the detector. Narrower filters admit less noise and fewer adjacent signals but must still pass the wanted signal: about 2.4 kHz for SSB, 250 to 500 Hz for CW, 6 kHz for AM, wider for FM. Halving the bandwidth reduces noise power by 3 dB. <b>Passband shift</b> (IF shift) moves the filter relative to the signal to remove interference on one side; <b>width</b> controls narrow or widen it.</p>

<h4>Noise blanker (NB)</h4>
<p>Detects short, high-amplitude impulses (power line arcing, vehicle ignition, some switching noise) and briefly blanks the receiver during each pulse, before the narrow filters spread the pulse out. Effective on impulse noise, but on a crowded band strong signals can trigger it and cause intermodulation distortion. Use only when needed.</p>

<h4>Noise reduction (NR)</h4>
<p>DSP algorithm working on the audio to reduce random noise relative to voice or CW. Moderate settings improve listening comfort; aggressive settings produce a watery, artifacts-laden sound and can make weak signals harder to copy.</p>

<h4>Attenuator (ATT) and preamp</h4>
<p>The attenuator inserts a fixed loss (commonly 6, 12, 18 or 20 dB) at the receiver input; the preamp adds gain (10 to 20 dB). On HF, especially 160 to 40 m, external atmospheric and man-made noise usually far exceeds the receiver's internal noise, so a preamp adds no sensitivity and increases susceptibility to overload. A useful test: if switching in the attenuator lowers band noise and signals equally, the receiver had sensitivity to spare and you lose nothing. On 15 m and above and on VHF/UHF, a preamp can help.</p>

<h4>RIT and XIT</h4>
<p><b>RIT</b> (receiver incremental tuning, also "clarifier") shifts only the receive frequency by a small amount, typically up to ±9.99 kHz, leaving the transmit frequency fixed. Use it to correct for a station that is slightly off your frequency without moving your own transmit frequency, which is important when you are the station others are calling. <b>XIT</b> shifts only the transmit frequency. Always clear RIT/XIT after a contact.</p>

<h4>VFO and tuning step</h4>
<p>The variable frequency oscillator sets the operating frequency; most radios have two (VFO A and B) for split operation, where you listen on one and transmit on the other, as rare DX stations often require. The tuning <em>step</em> sets how far each click of the knob moves: 1 to 10 Hz for SSB and CW, 5, 12.5 or 25 kHz channel steps for FM.</p>

<div class="callout">Practical tip: when a strong station nearby makes the whole band sound "splattery", first try the attenuator. If the splatter disappears, it was your receiver overloading, not the other station's signal.</div>

<h4>Key points</h4>
<ul><li>AF gain is volume only; RF gain changes sensitivity and noise floor.</li>
<li>Squelch for FM; leave it open on SSB and CW.</li>
<li>AGC slow for SSB, fast for CW.</li>
<li>Narrow filters reduce noise and interference; match width to mode.</li>
<li>Use the attenuator on the low bands; preamp mainly on 15 m and above.</li>
<li>RIT shifts receive only; XIT shifts transmit only.</li></ul>
`,
    related: ['tuning-searching', 'meters', 'modes', 'cw'],
  },

  // ------------------------------------------------------------ Propagation
  {
    id: 'ionosphere',
    cat: 'Propagation',
    title: 'The ionosphere and HF skywave propagation',
    summary: 'The D, E, F1 and F2 layers, how they change from day to night, critical frequency, MUF and LUF, skip zones and multi-hop paths.',
    minutes: 7,
    html: `
<p>HF signals reach beyond the horizon by refraction in the <b>ionosphere</b>, a region of the upper atmosphere roughly 60 to 500 km (40 to 300 miles) high where solar ultraviolet and X-ray radiation strips electrons from gas molecules. The free electrons bend radio waves back toward Earth. How strongly depends on the electron density and the frequency.</p>

<h4>The layers</h4>
<table><thead><tr><th>Layer</th><th>Height</th><th>Present</th><th>Effect</th></tr></thead><tbody>
<tr><td>D</td><td>60–90 km</td><td>Daytime only; disappears quickly after sunset</td><td>Absorbs lower frequencies (160, 80, and partly 40 m) during the day; does not refract HF usefully</td></tr>
<tr><td>E</td><td>90–150 km (peak near 110 km)</td><td>Daytime; weak at night</td><td>Refracts lower HF for single hops up to about 2,000 km (1,250 mi); home of sporadic-E</td></tr>
<tr><td>F1</td><td>150–220 km</td><td>Daytime, mostly summer</td><td>Merges with F2 at night</td></tr>
<tr><td>F2</td><td>220–400+ km</td><td>Day and night (weaker at night)</td><td>Main layer for long-distance HF; single hop up to about 4,000 km (2,500 mi)</td></tr></tbody></table>
<p>At night the D and E layers largely disappear and F1 and F2 merge into a single F layer. Absorption drops, which is why 160 and 80 m open for long distances after dark, while the reduced F-layer density causes the higher bands to close.</p>

<h4>Critical frequency, MUF and LUF</h4>
<ul>
<li><b>Critical frequency</b> (foF2 for the F2 layer): the highest frequency reflected when transmitted straight up. Typically 3 to 12 MHz, depending on time and solar activity.</li>
<li><b>Maximum usable frequency (MUF):</b> the highest frequency that will be refracted back to Earth over a given path. Oblique rays are refracted more easily than vertical ones, so the MUF for a long path is about three times foF2 (the "secant law": MUF ≈ foF2 × sec θ, where θ is the angle of incidence at the layer).</li>
<li><b>Lowest usable frequency (LUF):</b> the frequency below which D-layer absorption makes signals too weak. It rises during the day and with solar flare activity.</li>
</ul>
<p>The best frequency for a path is usually somewhat below the MUF; the "optimum working frequency" is often quoted as about 85% of the MUF. If the LUF rises above the MUF, the path is closed on all frequencies.</p>

<h4>Skip and the skip zone</h4>
<svg viewBox="0 0 520 190" class="diag" role="img" aria-label="Skywave geometry: signal refracts from the F2 layer and returns to Earth beyond a skip zone, with a second hop" style="font:11px sans-serif">
<g fill="none" stroke-width="1.5">
<path d="M10 175Q260 140 510 175" stroke="currentColor" stroke-width="2.5"/>
<path d="M10 45Q260 5 510 45" style="stroke:var(--muted)" stroke-dasharray="6 4"/>
<path d="M40 168L150 24L262 158L372 24L480 168" style="stroke:var(--accent)" stroke-width="2"/>
<path d="M40 168Q75 166 98 163" stroke="currentColor" stroke-dasharray="2 2"/>
<path d="M100 175V186M258 167V186"/>
</g>
<g fill="currentColor"><text x="20" y="160">TX</text><text x="250" y="150">1st hop</text><text x="470" y="160">2nd hop</text><text x="150" y="44" text-anchor="middle">F2 layer</text><text x="130" y="185">skip zone</text><text x="30" y="186">ground wave</text></g>
</svg>
<p>A signal launched at a low angle travels far before returning; one launched higher returns closer. Above the critical frequency, rays steeper than a certain angle pass through the layer and are lost. The result is a <b>skip zone</b>: a region beyond the reach of ground wave but nearer than the first skywave landing, where the signal cannot be heard. Stations a few hundred miles away may be inaudible while stations 1,500 miles away are strong. As frequency rises toward the MUF, the skip zone grows.</p>

<h4>Multi-hop propagation</h4>
<p>Signals that return to Earth can reflect from the ground or sea and travel up again for a second hop, a third, and so on. Each hop adds loss (ground reflection and D-layer absorption twice per hop in daytime), so paths that need fewer, longer hops from low launch angles are stronger. This is the reason low-angle antennas favor DX. Paths over seawater lose less at the ground reflection than paths over dry land.</p>

<h4>Daily and seasonal patterns</h4>
<ul>
<li>MUF rises after sunrise, peaks in early afternoon local time at the path midpoint, and falls after sunset, reaching a minimum just before dawn.</li>
<li>In winter the daytime F2 MUF is often higher than in summer (the "winter anomaly"), but days are short; in summer the MUF is lower and flatter, with stronger D-layer absorption.</li>
<li>Equinox months (March, April, September, October) often give the best worldwide conditions, especially on north-south and transequatorial paths.</li>
</ul>

<div class="callout">Practical tip: if the station you want is in the skip zone, try a lower band. Lowering frequency moves you farther below the MUF, so steeper rays return and the skip distance shrinks.</div>

<h4>Key points</h4>
<ul><li>D absorbs, E and F refract; F2 provides most long-distance HF.</li>
<li>At night D and E vanish and F1/F2 merge: low bands open, high bands close.</li>
<li>MUF ≈ 3 × foF2 for long paths; work just below the MUF.</li>
<li>The skip zone lies between ground-wave range and the first skywave return.</li>
<li>Fewer, longer hops mean stronger signals.</li></ul>
`,
    related: ['solar', 'band-by-band', 'greyline', 'height-ground', 'vhf-propagation'],
  },
  {
    id: 'solar',
    cat: 'Propagation',
    title: 'Solar activity and propagation indices',
    summary: 'The solar cycle, solar flux index, A and K indices, geomagnetic storms, flares, aurora and sporadic-E.',
    minutes: 6,
    html: `
<p>The Sun creates and sustains the ionosphere. Its ultraviolet and X-ray output, which varies over minutes, days and years, controls how high the MUF climbs. Its charged-particle output, the solar wind, disturbs the Earth's magnetic field and can degrade propagation.</p>

<h4>The sunspot cycle</h4>
<p>Solar activity follows a cycle averaging about <b>11 years</b> from minimum to minimum. At solar maximum there are more sunspots and active regions, more ultraviolet output, higher electron density in the F2 layer and higher MUFs: 15, 12 and 10 m open for worldwide contacts and even 6 m can support F2 propagation. At minimum, the higher bands may be closed for long periods and 40, 30 and 20 m carry most DX traffic. Solar Cycle 25 began around December 2019 and was expected to peak in about 2024 to 2025; conditions decline gradually over the following years.</p>

<h4>Solar flux index (SFI)</h4>
<p>The SFI is the solar radio emission at 10.7 cm wavelength (2,800 MHz), measured daily in Penticton, Canada, in solar flux units. It correlates well with ionizing ultraviolet output:</p>
<table><thead><tr><th>SFI</th><th>Typical HF conditions</th></tr></thead><tbody>
<tr><td>65–80</td><td>Solar minimum; 10 m rarely open for F2; 20 m the main daytime DX band</td></tr>
<tr><td>80–120</td><td>Moderate; 15 m and 17 m open regularly, 10 m sometimes</td></tr>
<tr><td>120–180</td><td>Good; 10 and 12 m open daily on many paths</td></tr>
<tr><td>above 180</td><td>Excellent high-band conditions; 6 m F2 possible</td></tr></tbody></table>

<h4>K and A indices (geomagnetic activity)</h4>
<p>The <b>K index</b> measures disturbance of the geomagnetic field over a 3-hour period on a quasi-logarithmic scale of 0 to 9. The planetary <b>Kp</b> index combines observatories worldwide. The <b>A index</b> is a daily, roughly linear measure (0 to 400) derived from the eight K readings of a day.</p>
<table><thead><tr><th>K</th><th>A (approx.)</th><th>Condition</th></tr></thead><tbody>
<tr><td>0–1</td><td>0–7</td><td>Quiet</td></tr>
<tr><td>2–3</td><td>8–15</td><td>Unsettled</td></tr>
<tr><td>4</td><td>16–29</td><td>Active</td></tr>
<tr><td>5</td><td>30–49</td><td>Minor storm (NOAA G1)</td></tr>
<tr><td>6</td><td>50–99</td><td>Moderate storm (G2)</td></tr>
<tr><td>7–9</td><td>100–400</td><td>Strong to extreme storm (G3–G5)</td></tr></tbody></table>
<p>For HF, the ideal combination is <b>high SFI and low K/A</b>. A K index of 4 or more degrades high-latitude paths noticeably.</p>

<h4>Geomagnetic storms</h4>
<p>Coronal mass ejections and high-speed solar wind streams arrive one to four days after leaving the Sun. They compress the magnetosphere, deposit energy into the high-latitude ionosphere and can deplete the F2 layer. HF conditions on polar paths may collapse for a day or more, while low-latitude and transequatorial paths are less affected. Recovery often brings a period of enhanced conditions.</p>

<h4>Solar flares and radio blackouts</h4>
<p>A large flare emits X-rays that reach Earth in about eight minutes and sharply increase D-layer ionization on the sunlit hemisphere. The result is a <b>sudden ionospheric disturbance</b> (short-wave fade or radio blackout): HF signals on the daylight side vanish, lower frequencies first, for minutes to hours. NOAA rates these R1 to R5.</p>

<h4>Aurora</h4>
<p>During geomagnetic storms, auroral ionization at high latitudes can reflect VHF signals (6 m, 2 m, even 70 cm). Antennas are pointed north (in the Northern Hemisphere) toward the auroral zone rather than at the other station. Signals have a characteristic raspy, hissing distortion; CW is the most effective mode, and SSB is barely readable.</p>

<h4>Sporadic-E (Es)</h4>
<p>Sporadic-E is patchy, intense ionization in the E layer, not directly tied to the sunspot cycle. It is most common in the Northern Hemisphere from <b>May to August</b>, with a smaller peak around late December and early January. It supports single-hop contacts of roughly 500 to 1,400 miles (800 to 2,300 km) on 10 and 6 m, and occasionally 2 m; multiple Es hops can stretch 6 m contacts across oceans. Openings can appear and vanish within minutes.</p>

<div class="callout">Practical tip: the NOAA Space Weather Prediction Center publishes current SFI, Kp and alerts. Many operators also watch the International Beacon Project frequencies to see which paths are open in real time.</div>

<h4>Key points</h4>
<ul><li>Solar cycle about 11 years; higher activity means higher MUFs.</li>
<li>SFI tracks ionizing radiation: higher is better for HF.</li>
<li>K (0–9, 3-hour) and A (daily) measure geomagnetic disturbance: lower is better.</li>
<li>Flares cause daylight-side HF blackouts; storms degrade polar paths.</li>
<li>Sporadic-E peaks in summer and opens 10 and 6 m.</li></ul>
`,
    related: ['ionosphere', 'band-by-band', 'vhf-propagation', 'greyline'],
  },
  {
    id: 'band-by-band',
    cat: 'Propagation',
    title: 'Band-by-band propagation guide',
    summary: 'Typical day and night behavior of each HF band from 160 to 10 m, plus 6 m, and what each is best used for.',
    minutes: 6,
    html: `
<p>Each amateur band behaves differently because each sits at a different point relative to the ionosphere's MUF and LUF. The table below describes typical behavior at mid-latitudes in the Northern Hemisphere. Real conditions vary with season and the solar cycle, so treat it as a starting point.</p>

<table><thead><tr><th>Band</th><th>Daytime</th><th>Night</th><th>Best use</th></tr></thead><tbody>
<tr><td>160 m (1.8 MHz)</td><td>Ground wave only, roughly 50 to 150 mi; heavy D-layer absorption</td><td>Regional to continental; DX on quiet winter nights near sunrise and sunset</td><td>Winter-night DX, regional nets; demanding antennas</td></tr>
<tr><td>80 m (3.5 MHz)</td><td>NVIS, 0 to about 250 mi; absorption limits range</td><td>Several hundred to 2,000+ mi; DX in winter; high static in summer</td><td>Regional nets, emergency (NVIS), winter DX</td></tr>
<tr><td>60 m (5.3 MHz)</td><td>Reliable NVIS and regional</td><td>Regional to continental</td><td>Emergency and regional communication</td></tr>
<tr><td>40 m (7 MHz)</td><td>Regional, about 100 to 600 mi; some NVIS</td><td>Worldwide DX; skip lengthens and short-range contacts disappear</td><td>The all-around band: regional by day, DX by night</td></tr>
<tr><td>30 m (10.1 MHz)</td><td>Medium range, often to 1,500 mi</td><td>Often open for DX through the night</td><td>CW and digital only; consistent DX</td></tr>
<tr><td>20 m (14 MHz)</td><td>Worldwide DX, the main DX band</td><td>Closes in the evening at solar minimum; may stay open all night near solar maximum</td><td>Primary long-distance band in most of the cycle</td></tr>
<tr><td>17 m (18 MHz)</td><td>Excellent DX when the MUF supports it</td><td>Usually closes after dark</td><td>Daytime DX; uncrowded (no contests)</td></tr>
<tr><td>15 m (21 MHz)</td><td>Strong worldwide DX at moderate to high solar activity</td><td>Usually closed</td><td>Daytime DX; Technician CW</td></tr>
<tr><td>12 m (24.9 MHz)</td><td>DX at moderate to high solar activity</td><td>Closed</td><td>Daytime DX; no contests</td></tr>
<tr><td>10 m (28 MHz)</td><td>Worldwide with low power near solar maximum; Es in summer; often dead at minimum</td><td>Closed (occasional evening openings near maximum)</td><td>Technician SSB, FM above 29.5 MHz, low-power DX</td></tr>
<tr><td>6 m (50 MHz)</td><td>Sporadic-E in summer; F2 near solar peaks; TEP</td><td>Mostly local; meteor scatter</td><td>"The magic band": sudden openings</td></tr></tbody></table>

<h4>General patterns</h4>
<ul>
<li><b>Higher bands are daytime bands</b>: they need high electron density to be refracted, and they open earliest toward the east in the morning and stay open latest toward the west.</li>
<li><b>Lower bands are nighttime bands</b> for distance: they need the D layer to disappear.</li>
<li><b>Noise:</b> atmospheric noise from thunderstorms is heavy on 160 and 80 m in summer and much lower on 20 m and above.</li>
<li><b>Seasons:</b> winter favors the low bands (long nights, low static); summer favors 6 and 10 m through sporadic-E.</li>
<li><b>Solar cycle:</b> at minimum, concentrate on 40, 30 and 20 m; at maximum, 15 to 10 m offer the best DX with modest stations.</li>
</ul>

<h4>Transequatorial propagation (TEP)</h4>
<p>Paths that cross the geomagnetic equator roughly at right angles, for example the US to South America or Europe to southern Africa, can support propagation on 10 and 6 m (occasionally 2 m) in the afternoon and evening, often when other paths are closed. It is strongest around the equinoxes and at higher solar activity.</p>

<h4>Choosing a band: a worked approach</h4>
<p>Suppose it is 1500 UTC in winter on the US east coast, with SFI 140 and K = 2. The path to Europe is in its local evening. 15 and 17 m are likely open to Europe now and will close within an hour or two; 20 m will carry Europe into the evening; 40 m will open to Europe around and after local sunset. Moving down the bands as the path darkens is a standard pattern.</p>

<div class="callout">Practical tip: listening is the best propagation forecast. Before choosing a band, tune across the beacon frequencies and the FT8 frequencies; FT8 activity shows in seconds where signals are getting through.</div>

<h4>Key points</h4>
<ul><li>160 and 80 m: night bands for distance; 80 and 60 m: NVIS by day.</li>
<li>40 m: regional by day, DX by night.</li>
<li>20 m: the most consistent DX band across the cycle.</li>
<li>17 to 10 m: daytime DX that depends strongly on solar activity.</li>
<li>6 m: sporadic-E in summer and F2 near solar maximum.</li></ul>
`,
    related: ['ionosphere', 'solar', 'bandplan', 'greyline', 'tuning-searching'],
  },
  {
    id: 'greyline',
    cat: 'Propagation',
    title: 'Greyline and long-path propagation',
    summary: 'Why paths along the day-night terminator are enhanced, how to use greyline on the low bands, and when signals arrive via the long path.',
    minutes: 5,
    html: `
<p>The <b>greyline</b>, or terminator, is the band around the Earth separating day from night. At any moment one part of it is experiencing sunrise and another part sunset. Paths running along this band often show remarkably strong signals, especially on the lower HF bands.</p>

<h4>Why greyline works</h4>
<p>Two effects combine. On the dark side of sunrise, the D layer has not yet formed, so absorption is low; on the sunset side, the D layer disappears rapidly after the Sun sets while the F layer, which decays much more slowly, remains well ionized. Along the terminator, therefore, there is a strip where absorption is low but the F layer still refracts well. A signal traveling along this strip suffers less loss per hop than it would on a path crossing full daylight or deep night. In addition, ionospheric tilts near the terminator can couple signals into long, low-loss "chordal" hops.</p>
<p>The effect is most valuable on <b>160, 80 and 40 m</b>, where D-layer absorption normally limits daytime range. It also benefits 30 and 20 m at some times.</p>

<h4>Timing</h4>
<ul>
<li>Greyline openings typically last from about 30 minutes before to 30 minutes after local sunrise or sunset; on 160 m the peak can be quite brief.</li>
<li>The terminator is tilted relative to the meridians except at the equinoxes, so the stations it links change with season. Around the solstices it runs at its greatest angle, linking, for example, high northern latitudes with regions far to the south and east or west.</li>
<li>Any two locations that experience sunrise and sunset simultaneously (one at sunrise, the other at sunset, or both at the same event) are candidates for a greyline path.</li>
</ul>
<p>Greyline maps, available in most logging and propagation software, show the terminator in real time and make it easy to see which areas share your twilight.</p>

<h4>Short path and long path</h4>
<p>Two points on Earth are joined by a great circle. The shorter arc is the <b>short path</b>; the remainder, the other way around the globe, is the <b>long path</b>. Long-path distances exceed 20,000 km (12,400 mi), so they require many hops, but they can be stronger than the short path when they run largely along the greyline or through darkness on the low bands, or through daylight on the high bands, while the short path crosses an unfavorable region such as the auroral zone.</p>
<p>Examples often cited by operators in the eastern United States include long-path openings on 20 m toward Southeast Asia and Australia in the morning, with antennas pointed southwest rather than northwest, and on 40 and 80 m around sunrise.</p>
<p>A directional antenna demonstrates long path clearly: the signal peaks with the beam pointed 180° from the short-path bearing. Sometimes both paths are open at once, producing a distinctive echo because the two signals arrive tens of milliseconds apart. For example, if the short path is 10,000 km, the long path is about 30,000 km; the 20,000 km difference at 300,000 km/s is about 67 ms.</p>

<h4>Using greyline in practice</h4>
<ol>
<li>Look up local sunrise and sunset times and those of your target area.</li>
<li>Be on the band 30 to 60 minutes before your sunrise (for paths toward the west) or around your sunset (for paths toward the east).</li>
<li>Listen for signals that rise out of the noise for a short time; be ready to call quickly.</li>
<li>Use a low-angle antenna if available; a vertical or high dipole on 40 m is effective.</li>
</ol>

<div class="callout">Practical tip: keep a note of the greyline openings you hear. Over months, a pattern emerges for your location that no software prediction will match exactly.</div>

<h4>Key points</h4>
<ul><li>The greyline combines low D-layer absorption with a still-ionized F layer.</li>
<li>Most useful on 160, 80 and 40 m around sunrise and sunset.</li>
<li>The terminator angle changes with season, changing which paths open.</li>
<li>Long path follows the great circle the other way round; aim the beam 180° from short path.</li></ul>
`,
    related: ['ionosphere', 'band-by-band', 'solar', 'yagi'],
  },
  {
    id: 'vhf-propagation',
    cat: 'Propagation',
    title: 'VHF and UHF propagation',
    summary: 'Line of sight and the radio horizon, terrain effects, tropospheric ducting, other VHF modes, and the role of repeaters.',
    minutes: 6,
    html: `
<p>Above about 50 MHz the ionosphere normally lets signals pass through instead of refracting them back. VHF and UHF communication is therefore governed mostly by <b>line of sight</b>, the shape of the terrain and the lower atmosphere (troposphere), with occasional exotic modes adding long-distance openings.</p>

<h4>Line of sight and the radio horizon</h4>
<p>The atmosphere's refractive index decreases with height, which bends VHF waves slightly downward and lets them travel a little beyond the optical horizon. The standard model treats the Earth as having 4/3 of its actual radius. The resulting radio horizon distance is:</p>
<div class="formula">d (km) ≈ 4.12 × √h (m) &nbsp;&nbsp;&nbsp; d (mi) ≈ 1.41 × √h (ft)</div>
<p>The maximum line-of-sight range between two stations is the sum of their horizons:</p>
<div class="formula">d<sub>total</sub> ≈ 4.12 × (√h<sub>1</sub> + √h<sub>2</sub>) km</div>
<p>Worked examples:</p>
<ul>
<li>A handheld at 2 m (6.6 ft): 4.12 × 1.41 ≈ 5.8 km (3.6 mi).</li>
<li>A repeater antenna at 100 m (328 ft) on a building or hill: 4.12 × 10 = 41 km (25.5 mi).</li>
<li>Handheld to that repeater: 5.8 + 41 ≈ 47 km (29 mi) under ideal conditions with no obstructions.</li>
</ul>
<p>These are geometric limits. Hills, buildings and foliage block or attenuate signals, while diffraction over sharp ridges ("knife-edge" diffraction) can occasionally help. Signals at UHF penetrate buildings somewhat better through windows and reflect more readily from structures, which is why 70 cm often works better in urban areas, while 2 m tends to cover open terrain slightly better.</p>

<h4>Multipath and "picket fencing"</h4>
<p>In cities, reflections arrive from several directions and add or cancel depending on position. Moving a few inches can change a signal from full quieting to noise. Mobile stations hear this as rapid fluttering, called picket fencing.</p>

<h4>Tropospheric enhancement and ducting</h4>
<p>A <b>temperature inversion</b> (warm air above cooler air) creates a sharp change in refractive index that can bend signals back toward Earth or trap them in a duct between layers. Inversions form commonly on calm, clear evenings and mornings, along coastlines, and along weather fronts and stationary high-pressure systems. Effects range from modest enhancement (extending range to 200 to 500 miles) to strong ducting that carries 2 m and 70 cm signals over 1,000 miles; the record paths between California and Hawaii (about 2,500 miles) are classic marine ducts. Tropo is most common in late summer and early autumn.</p>

<h4>Other VHF propagation modes</h4>
<ul>
<li><b>Sporadic-E:</b> 6 m and occasionally 2 m in summer; 500 to 1,400 miles per hop (see the solar article).</li>
<li><b>Meteor scatter:</b> brief ionized trails from meteors reflect signals for fractions of a second to seconds; digital modes such as MSK144 exploit it on 6 and 2 m over 500 to 1,400 miles.</li>
<li><b>Aurora:</b> during geomagnetic storms; raspy signals, beam pointed toward the auroral zone.</li>
<li><b>Earth-Moon-Earth (EME):</b> reflection from the Moon; requires high gain antennas and power, or very sensitive digital modes.</li>
<li><b>F2 on 6 m:</b> near solar maximum, 6 m can open worldwide.</li>
</ul>

<h4>Repeaters</h4>
<p>Repeaters solve the line-of-sight problem by placing a receiver and transmitter at a high site. A handheld that could reach only a few miles simplex can communicate across an entire metropolitan area through a well-sited repeater. Linked repeater systems and internet-linked networks extend the coverage further. See the repeaters article for operating details.</p>

<h4>Polarization</h4>
<p>FM and repeater work use <b>vertical</b> polarization; weak-signal SSB and CW on VHF/UHF conventionally use <b>horizontal</b> polarization. Cross-polarized antennas can lose 20 dB or more on line-of-sight paths, so match the convention for the activity.</p>

<div class="callout">Practical tip: on 2 m, height is gain. Raising an antenna from 10 ft to 40 ft doubles the radio horizon and usually clears local obstructions, which matters far more than adding power.</div>

<h4>Key points</h4>
<ul><li>Radio horizon d ≈ 4.12√h km (h in meters), or 1.41√h mi (h in feet).</li>
<li>Total range is the sum of both stations' horizons, less obstructions.</li>
<li>Temperature inversions produce tropo enhancement and ducting.</li>
<li>Es, meteor scatter and aurora give occasional long-distance VHF openings.</li>
<li>Vertical polarization for FM; horizontal for SSB/CW weak-signal work.</li></ul>
`,
    related: ['repeaters', 'solar', 'ionosphere', 'formulas'],
  },

  // -------------------------------------------------------------- Operating
  {
    id: 'licensing',
    cat: 'Operating',
    title: 'US amateur licensing and Part 97 basics',
    summary: 'The three license classes, the examination system, call sign formats, station identification and the core rules of Part 97.',
    minutes: 7,
    html: `
<p>In the United States, amateur radio is regulated by the Federal Communications Commission under <b>47 CFR Part 97</b>. A license is required to transmit; anyone may listen. Licenses are issued without regard to age or citizenship (a US mailing address is required), are valid for <b>10 years</b>, and are renewable, with a two-year grace period after expiration during which the holder may renew but may not operate.</p>

<h4>License classes</h4>
<table><thead><tr><th>Class</th><th>Exam element</th><th>Questions</th><th>Pass mark</th><th>Privileges</th></tr></thead><tbody>
<tr><td>Technician</td><td>Element 2</td><td>35</td><td>26 correct (74%)</td><td>All amateur bands above 50 MHz; limited HF (CW on 80, 40, 15 m; CW, data and SSB on part of 10 m)</td></tr>
<tr><td>General</td><td>Element 3 (requires Element 2)</td><td>35</td><td>26 correct</td><td>Most HF privileges on all bands</td></tr>
<tr><td>Amateur Extra</td><td>Element 4 (requires Elements 2 and 3)</td><td>50</td><td>37 correct</td><td>All amateur privileges</td></tr></tbody></table>
<p>Morse code testing was eliminated in 2007. Novice and Advanced licenses are no longer issued but existing ones may be renewed.</p>

<h4>The examination system</h4>
<p>Examinations are given by <b>Volunteer Examiners (VEs)</b>, licensed amateurs accredited by a <b>Volunteer Examiner Coordinator (VEC)</b> such as the ARRL VEC or the W5YI VEC. At least three VEs administer each session. Questions are drawn from public <b>question pools</b> that are revised on a four-year rotation; every question and its answer is published in advance. Sessions are held in person and, with some VECs, remotely by video. A candidate may take more than one element at a session. VECs may charge a modest session fee, and the FCC charges a separate application fee (currently 35 US dollars) for new licenses, upgrades of call sign and renewals, paid online after the session.</p>

<h4>Call sign formats</h4>
<p>US call signs begin with A, K, N or W, contain one digit indicating the call district (0 to 9) at the time of issue, and are grouped by license class:</p>
<table><thead><tr><th>Group</th><th>Available to</th><th>Formats</th><th>Example pattern</th></tr></thead><tbody>
<tr><td>A</td><td>Amateur Extra</td><td>1×2, 2×1, 2×2 (AA–AL prefixes)</td><td>K1XY, KA1X, AB1XY</td></tr>
<tr><td>B</td><td>Advanced</td><td>2×2 (K, N, W + letter)</td><td>KA1XY</td></tr>
<tr><td>C</td><td>General, Technician</td><td>1×3 (K, N, W)</td><td>N1XYZ</td></tr>
<tr><td>D</td><td>Any class</td><td>2×3</td><td>KD1XYZ</td></tr></tbody></table>
<p>New licensees normally receive a sequentially issued Group D call. Vanity call signs may be requested from the group appropriate to the license class.</p>

<h4>Station identification (97.119)</h4>
<ul>
<li>Transmit your assigned call sign <b>at least every 10 minutes</b> during a communication and <b>at the end</b> of each communication.</li>
<li>Identify in English (phonetics are encouraged), in CW, or by the specified method for the mode in use (digital modes identify within the data).</li>
<li>Tactical call signs ("Net Control", "Shelter 3") may be used, but the FCC call sign must still be given at the required intervals.</li>
<li>Transmitting without identification is prohibited, including brief test transmissions.</li>
</ul>

<h4>Other Part 97 essentials</h4>
<ul>
<li><b>Basis and purpose (97.1):</b> non-commercial service for emergency communication, technical advancement, skill development, a reservoir of trained operators, and international goodwill.</li>
<li><b>Control operator (97.103, 97.105):</b> a licensed operator must be responsible for every transmission and may use only the privileges of their own license class.</li>
<li><b>Prohibited communications (97.113):</b> no transmissions for compensation or the business of an employer (with narrow exceptions), no music, no messages encoded to obscure their meaning, no obscene or indecent language, no false or deceptive signals, and no broadcasting to the general public.</li>
<li><b>Interference (97.101):</b> no willful or malicious interference; operators must use good amateur practice and share frequencies.</li>
<li><b>Power (97.313):</b> use the minimum power necessary to carry out the communication; absolute maximum 1,500 W PEP, with lower limits in specific segments.</li>
<li><b>Third-party traffic (97.115):</b> messages on behalf of unlicensed persons are permitted domestically and only with countries that have third-party agreements with the US.</li>
<li><b>RF exposure (97.13):</b> stations must be evaluated for compliance with exposure limits (see the RF safety article).</li>
</ul>

<div class="callout">Practical tip: practice exams that draw from the actual question pool are the most efficient study method, but read the explanations too. Understanding the material makes the next license class much easier.</div>

<h4>Key points</h4>
<ul><li>Technician 35 questions (pass 26), General 35 (26), Extra 50 (37).</li>
<li>Exams are run by volunteer examiners under a VEC; question pools are public.</li>
<li>Licenses last 10 years; call signs reflect class group and district.</li>
<li>Identify every 10 minutes and at the end of each contact.</li>
<li>No business, music, encryption to obscure meaning or broadcasting.</li></ul>
`,
    related: ['bandplan', 'qso', 'rf-safety', 'emergency'],
  },
  {
    id: 'qso',
    cat: 'Operating',
    title: 'Anatomy of a contact (QSO)',
    summary: 'Listening, checking the frequency, calling CQ and answering, signal reports, exchanging information, closing, and the ITU phonetic alphabet.',
    minutes: 7,
    html: `
<p>A contact, or QSO, follows a predictable structure that lets two strangers from different countries communicate efficiently. Learning the pattern removes most of the anxiety of the first contacts.</p>

<h4>1. Listen</h4>
<p>Tune around and listen before you transmit. Listening tells you which band is open, what activity is under way, and whether a frequency is in use. A station you cannot hear may be in contact with someone you can, so a frequency that sounds quiet may not be.</p>

<h4>2. Check the frequency</h4>
<p>Before calling CQ, ask whether the frequency is in use. On phone: "Is this frequency in use? This is N1XYZ." On CW: <code>QRL?</code> (or simply <code>?</code>). Wait several seconds and ask again. If anyone replies (on CW, "C", "Y" or "QRL"), move elsewhere.</p>

<h4>3. Call CQ</h4>
<p>A CQ is a general call to any station. Keep it short and repeat it a few times rather than making one long call:</p>
<div class="formula">"CQ CQ CQ, this is N1XYZ, November One X-ray Yankee Zulu, calling CQ and listening."</div>
<p>On CW: <code>CQ CQ CQ DE N1XYZ N1XYZ K</code>. Pause and listen, then repeat if no one answers.</p>

<h4>4. Answer a call</h4>
<p>When answering, give the other station's call once and your own call clearly, usually twice, using phonetics on phone:</p>
<div class="formula">"N1XYZ, this is W9ABC, Whiskey Nine Alpha Bravo Charlie, over."</div>
<p>Call on the same frequency the CQing station is using (zero-beat on CW).</p>

<h4>5. Exchange information</h4>
<p>A typical first exchange includes a <b>signal report</b>, your <b>name</b> and your <b>location (QTH)</b>. After that, conversations range freely: equipment, weather, conditions. Each transmission ends with the other station's call and yours, and a turnover word ("over" on phone, <code>K</code> or <code>KN</code> on CW).</p>

<h4>Signal reports: RST</h4>
<table><thead><tr><th>Readability (R)</th><th>Strength (S)</th><th>Tone (T, CW only)</th></tr></thead><tbody>
<tr><td>1 Unreadable<br>2 Barely readable<br>3 Readable with considerable difficulty<br>4 Readable with practically no difficulty<br>5 Perfectly readable</td>
<td>1 Faint, barely perceptible<br>3 Weak<br>5 Fairly good<br>7 Moderately strong<br>9 Extremely strong</td>
<td>1 Sixty-cycle AC or less, very rough<br>5 Filtered rectified AC, strongly ripple-modulated<br>8 Near-pure tone, trace of ripple<br>9 Perfect tone</td></tr></tbody></table>
<p>Phone uses RS only ("five nine"); CW uses RST ("599"). Give an honest report: "five seven" tells the other operator something useful; a habitual "five nine" does not (contests excepted, where the report is a formality).</p>

<h4>6. Close the contact</h4>
<p>Thank the other operator, give your call, and sign off: "Thanks for the contact, Bob. 73. W9ABC, clear." On CW: <code>TU 73 SK</code>, with call signs. The final identification satisfies the end-of-communication ID requirement. "73" means best regards; "88" is love and kisses (used informally).</p>

<h4>ITU / NATO phonetic alphabet</h4>
<table><thead><tr><th>A</th><th>Alfa</th><th>J</th><th>Juliett</th><th>S</th><th>Sierra</th></tr></thead><tbody>
<tr><td>B</td><td>Bravo</td><td>K</td><td>Kilo</td><td>T</td><td>Tango</td></tr>
<tr><td>C</td><td>Charlie</td><td>L</td><td>Lima</td><td>U</td><td>Uniform</td></tr>
<tr><td>D</td><td>Delta</td><td>M</td><td>Mike</td><td>V</td><td>Victor</td></tr>
<tr><td>E</td><td>Echo</td><td>N</td><td>November</td><td>W</td><td>Whiskey</td></tr>
<tr><td>F</td><td>Foxtrot</td><td>O</td><td>Oscar</td><td>X</td><td>X-ray</td></tr>
<tr><td>G</td><td>Golf</td><td>P</td><td>Papa</td><td>Y</td><td>Yankee</td></tr>
<tr><td>H</td><td>Hotel</td><td>Q</td><td>Quebec</td><td>Z</td><td>Zulu</td></tr>
<tr><td>I</td><td>India</td><td>R</td><td>Romeo</td><td></td><td></td></tr></tbody></table>
<p>The official ITU spellings are "Alfa" and "Juliett"; the pronunciations are as usually spoken. Numbers are spoken normally; "niner" is sometimes used for 9 to distinguish it from the German "nein". Use the standard alphabet rather than improvised words; it was designed to be understood through noise and across languages.</p>

<h4>DX and pileups</h4>
<p>When many stations call a rare station (a pileup), give your call once, phonetically, and listen. Do not call while the DX station is transmitting. If the DX station says "listening up 5", it is operating <b>split</b>: transmit 5 kHz above its frequency. Exchanges are brief: call sign and signal report.</p>

<div class="callout">Practical tip: write down the other station's call sign, name and QTH as soon as you hear them. It is much easier to keep the contact going, and you will have the information for your log.</div>

<h4>Key points</h4>
<ul><li>Listen, ask "Is this frequency in use?" or QRL?, then call CQ.</li>
<li>Answer with their call once and yours phonetically.</li>
<li>Exchange RST, name and QTH; give honest reports.</li>
<li>Close with 73 and your call sign.</li>
<li>Use the standard ITU phonetic alphabet.</li></ul>
`,
    related: ['q-codes', 'cw', 'logging', 'tuning-searching', 'licensing'],
  },
  {
    id: 'repeaters',
    cat: 'Operating',
    title: 'Repeaters: offsets, tones and etiquette',
    summary: 'How a repeater works, standard offsets on 2 m and 70 cm, CTCSS access tones, simplex, and good repeater operating practice.',
    minutes: 6,
    html: `
<p>A repeater is an automatic station, usually on a tall building, tower or hilltop, that receives on one frequency (its <b>input</b>) and simultaneously retransmits on another (its <b>output</b>). It extends the range of handheld and mobile stations from a few miles to tens of miles.</p>

<svg viewBox="0 0 520 170" class="diag" role="img" aria-label="Repeater operation: handheld transmits on input 146.340 MHz, repeater retransmits on output 146.940 MHz, a 600 kHz offset" style="font:12px sans-serif">
<g fill="none" stroke="currentColor" stroke-width="1.5">
<path d="M260 20L240 120H280Z" style="stroke:var(--muted)"/><path d="M260 20V8"/>
<rect x="30" y="110" width="22" height="40" rx="3"/><path d="M41 110V90"/>
<rect x="468" y="110" width="22" height="40" rx="3"/><path d="M479 110V90"/>
<path d="M60 100Q150 40 236 40" style="stroke:var(--accent)" stroke-width="2"/><path d="M226 34L236 40L227 47" style="stroke:var(--accent)"/>
<path d="M284 40Q370 40 460 100" stroke-dasharray="6 3" stroke-width="2"/><path d="M450 99L460 100L457 90"/>
</g>
<g fill="currentColor" text-anchor="middle"><text x="140" y="40">input 146.340</text><text x="140" y="56">(you transmit)</text><text x="385" y="40">output 146.940</text><text x="385" y="56">(you listen)</text><text x="260" y="140">repeater</text><text x="260" y="156">offset −600 kHz</text><text x="41" y="166">HT</text><text x="479" y="166">HT</text></g>
</svg>

<h4>Offsets</h4>
<p>Repeaters are listed by their <b>output</b> frequency, with the offset to the input. Radios store the offset and switch automatically when you transmit.</p>
<table><thead><tr><th>Band</th><th>Standard offset</th><th>Notes</th></tr></thead><tbody>
<tr><td>2 m</td><td>±600 kHz</td><td>Outputs 146.61–146.97 usually use minus (−); 147.00–147.39 usually plus (+); 145.1–145.5 minus. Regional variations exist.</td></tr>
<tr><td>1.25 m</td><td>−1.6 MHz</td><td>Outputs 223.85–224.98</td></tr>
<tr><td>70 cm</td><td>±5 MHz</td><td>Plus in most of the US (e.g. output 442.x, input 447.x); some regions use minus</td></tr>
<tr><td>6 m</td><td>−1 MHz (−500 kHz in some areas)</td><td>Outputs typically 53.x MHz</td></tr></tbody></table>
<p>Example: a repeater listed as 146.940 (−) has its input at 146.940 − 0.600 = 146.340 MHz.</p>

<h4>Access tones: CTCSS and DCS</h4>
<p>Most repeaters require a <b>CTCSS</b> (Continuous Tone-Coded Squelch System) tone, often called PL. It is a sub-audible tone between 67.0 and 254.1 Hz transmitted continuously under your voice; the repeater ignores signals without the correct tone, which reduces interference from distant co-channel repeaters and noise. Common tones include 88.5, 100.0, 103.5, 123.0, 127.3, 131.8, 141.3, 146.2 and 162.2 Hz. <b>DCS</b> (digital-coded squelch) serves the same purpose with a digital code. If you can hear a repeater but it does not respond when you transmit, a missing or wrong tone is the most likely cause.</p>

<h4>Simplex</h4>
<p>Simplex means transmitting and receiving on the same frequency, station to station without a repeater. If you can communicate simplex, do so and leave the repeater free. National FM simplex calling frequencies in the US: <b>146.520 MHz</b> (2 m), 223.500 MHz (1.25 m), 446.000 MHz (70 cm) and 52.525 MHz (6 m).</p>

<h4>Etiquette</h4>
<ul>
<li><b>Listen first.</b> A repeater may be in use even if no one is speaking at the moment.</li>
<li>To make yourself known, simply give your call: "N1XYZ listening" or "N1XYZ monitoring". CQ is not customary on FM repeaters.</li>
<li><b>Pause</b> a second or two after the other station stops and after the <b>courtesy tone</b> (a short beep the repeater sends after each transmission). The pause lets others, including anyone with an emergency, break in.</li>
<li>Keep transmissions short. Most repeaters have a <b>timeout timer</b> (often about 3 minutes) that shuts off the transmitter if a transmission runs too long; the courtesy tone resets it.</li>
<li>To join a conversation, give your call during a pause. In an emergency, say "Break" or "Priority" (follow local practice) followed by your call; all other traffic should stop.</li>
<li>Do not "kerchunk" (key up briefly without identifying) to test a repeater; identify every time.</li>
<li>Identify at least every 10 minutes and at the end of the contact.</li>
</ul>

<h4>Linked and digital systems</h4>
<p>Many repeaters are linked by radio or the internet (EchoLink, IRLP, AllStar) for wide-area coverage. Digital voice systems (DMR, D-STAR, System Fusion) use their own protocols and require compatible radios and, for DMR, programming of talk groups and color codes.</p>

<div class="callout">Practical tip: if a repeater is noisy when you transmit ("scratchy"), you are near the edge of its coverage. Move a few feet, use a better antenna, or raise power on a handheld before assuming the repeater is at fault.</div>

<h4>Key points</h4>
<ul><li>Input is where you transmit; output is where you listen.</li>
<li>2 m offset 600 kHz; 70 cm offset 5 MHz; 1.25 m −1.6 MHz.</li>
<li>Most repeaters require the correct CTCSS tone.</li>
<li>Use 146.520 MHz simplex when you can.</li>
<li>Pause after the courtesy tone; identify every 10 minutes and at the end.</li></ul>
`,
    related: ['vhf-propagation', 'emergency', 'modes', 'licensing'],
  },
  {
    id: 'cw',
    cat: 'Operating',
    title: 'Morse code (CW) operating',
    summary: 'Morse timing and speed, learning methods, common prosigns and abbreviations, zero-beating, and a typical CW contact.',
    minutes: 6,
    html: `
<p>Morse code remains popular because it is efficient, needs simple equipment, and gets through when voice cannot. A CW signal concentrates all its power in a bandwidth of about 100 to 200 Hz, and the human ear and brain are excellent at picking a tone out of noise.</p>

<h4>Timing</h4>
<p>Morse is built from one time unit:</p>
<ul>
<li>Dit = 1 unit; dah = 3 units.</li>
<li>Space between elements within a character = 1 unit.</li>
<li>Space between characters = 3 units.</li>
<li>Space between words = 7 units.</li>
</ul>
<p>Speed is measured in words per minute (WPM) using the standard word "PARIS", which is exactly 50 units long. Thus:</p>
<div class="formula">Dit length (ms) = 1200 / WPM &nbsp;&nbsp; e.g. 20 WPM → 60 ms dit, 180 ms dah</div>
<p>Typical speeds: 5 to 13 WPM for beginners, 18 to 25 WPM for general conversation, 25 to 40 WPM in contests.</p>

<h4>Learning</h4>
<p>Learn each character as a <em>sound</em> (a rhythm), not as a pattern of dots and dashes to count. Two widely used methods:</p>
<ul>
<li><b>Koch method:</b> start at full target speed (for example 20 WPM) with two characters, and add a character each time you reach about 90% accuracy.</li>
<li><b>Farnsworth timing:</b> send characters at a higher speed with longer gaps between them, so the effective speed is lower but the character sounds do not change as speed increases.</li>
</ul>
<p>Short, frequent practice sessions (15 to 30 minutes daily) work far better than occasional long ones.</p>

<h4>Prosigns</h4>
<p>Procedural signals are sent as a single run-together character (shown with an overbar in print):</p>
<table><thead><tr><th>Prosign</th><th>Meaning</th></tr></thead><tbody>
<tr><td>AR</td><td>End of message (often before calls at the end of a transmission)</td></tr>
<tr><td>K</td><td>Go ahead, any station may transmit</td></tr>
<tr><td>KN</td><td>Go ahead, only the station called</td></tr>
<tr><td>BK</td><td>Break, quick back-and-forth without call signs</td></tr>
<tr><td>BT</td><td>Separator (like a paragraph break), also written =</td></tr>
<tr><td>AS</td><td>Wait</td></tr>
<tr><td>SK</td><td>End of contact</td></tr>
<tr><td>CL</td><td>Closing station, going off the air</td></tr></tbody></table>

<h4>Common abbreviations</h4>
<p><code>CQ</code> calling any station; <code>DE</code> from; <code>ES</code> and; <code>FB</code> fine business (excellent); <code>GM GA GE</code> good morning, afternoon, evening; <code>HR</code> here; <code>NAME</code>; <code>OM</code> old man (any male operator); <code>YL</code> young lady (any female operator); <code>OP</code> operator; <code>RIG</code> radio; <code>ANT</code> antenna; <code>WX</code> weather; <code>TNX</code> or <code>TU</code> thanks; <code>UR</code> your; <code>R</code> received; <code>RST</code>; <code>5NN</code> abbreviated 599 (N for 9); <code>73</code> best regards. Q signals (see the Q-codes article) are used heavily on CW.</p>

<h4>Zero beat and sidetone</h4>
<p>On CW the receiver produces an audio tone from the beat between the incoming signal and the receiver's oscillator. Your transmitter's sidetone pitch (commonly 500 to 700 Hz) corresponds to the receive offset at which you are exactly on frequency. Tune until the other station's tone matches your sidetone, or use the radio's CW tuning indicator or auto-zero function. If you call off frequency, a station using a 250 Hz filter may not hear you at all.</p>

<h4>Keys</h4>
<p>A <b>straight key</b> forms each element manually. <b>Paddles</b> with an electronic <b>keyer</b> generate correctly timed dits and dahs automatically; iambic paddles send alternating elements when both levers are squeezed. Most transceivers include a keyer. Good sending, with correct spacing, matters more than speed.</p>

<h4>A typical CW contact</h4>
<div class="formula">CQ CQ CQ DE N1XYZ N1XYZ K<br>N1XYZ DE W9ABC W9ABC K<br>W9ABC DE N1XYZ GM TNX CALL UR RST 579 579 = NAME JIM JIM = QTH MAINE MAINE = HW? W9ABC DE N1XYZ KN<br>N1XYZ DE W9ABC R TNX JIM UR 589 589 = NAME ANN ANN = QTH OHIO OHIO = HW? N1XYZ DE W9ABC KN<br>(conversation continues) ... TU 73 W9ABC DE N1XYZ SK</div>

<div class="callout">Practical tip: when someone calls you faster than you can copy, send QRS (please send more slowly). Nearly every CW operator will slow down gladly, and it is good practice to answer a station at the speed it called.</div>

<h4>Key points</h4>
<ul><li>Dit 1, dah 3, character gap 3, word gap 7 units; dit (ms) = 1200 / WPM.</li>
<li>Learn by sound with the Koch or Farnsworth method.</li>
<li>Prosigns: AR, K, KN, BK, BT, AS, SK, CL.</li>
<li>Zero-beat by matching the received tone to your sidetone.</li></ul>
`,
    related: ['q-codes', 'qso', 'modes', 'contesting'],
  },
  {
    id: 'logging',
    cat: 'Operating',
    title: 'Logging, UTC and QSL confirmation',
    summary: 'What to record for each contact, why amateurs use UTC, QSL cards and the bureau, Logbook of The World, and the ADIF file format.',
    minutes: 5,
    html: `
<p>A station log records your contacts. The FCC no longer requires most US amateurs to keep a general log, but nearly every active operator does, because logs are needed for awards, contest entries and confirmations, and they are valuable evidence if a question of interference or rule compliance ever arises.</p>

<h4>What to record</h4>
<table><thead><tr><th>Field</th><th>Notes</th></tr></thead><tbody>
<tr><td>Date and time</td><td>In UTC; time the contact started (and optionally ended)</td></tr>
<tr><td>Call sign</td><td>Exactly as given, including any portable indicator (e.g. /P, /M or a prefix)</td></tr>
<tr><td>Frequency or band</td><td>Frequency in MHz is preferable; band at minimum</td></tr>
<tr><td>Mode</td><td>SSB, CW, FM, FT8 and so on</td></tr>
<tr><td>Signal reports</td><td>RST sent and received</td></tr>
<tr><td>Name, QTH</td><td>Optional but useful; grid square for VHF and digital</td></tr>
<tr><td>Power, antenna, notes</td><td>Optional; helpful for evaluating your station</td></tr></tbody></table>

<h4>Coordinated Universal Time (UTC)</h4>
<p>Radio contacts cross time zones, so amateurs log in UTC, the 24-hour time standard at the prime meridian (often called "Zulu" or "Z"). Note that the <b>date also changes at 0000 UTC</b>, which in North America is late afternoon or evening local time: a contact at 8 p.m. EDT on 3 June is logged as 0000 UTC on 4 June.</p>
<table><thead><tr><th>Zone</th><th>Standard time</th><th>Daylight time</th></tr></thead><tbody>
<tr><td>Eastern</td><td>UTC − 5</td><td>UTC − 4</td></tr>
<tr><td>Central</td><td>UTC − 6</td><td>UTC − 5</td></tr>
<tr><td>Mountain</td><td>UTC − 7</td><td>UTC − 6</td></tr>
<tr><td>Pacific</td><td>UTC − 8</td><td>UTC − 7</td></tr></tbody></table>
<p>Example: 2:30 p.m. PST is 14:30 + 8 h = 2230 UTC.</p>

<h4>QSL cards and confirmations</h4>
<p>A <b>QSL card</b> is a written confirmation of a contact, traditionally a postcard showing call sign, date, UTC time, band, mode and report. Cards may be sent directly by mail or through the <b>QSL bureau</b> system, in which national societies forward cards in bulk at low cost but slowly (often a year or more).</p>
<p><b>Logbook of The World (LoTW)</b>, operated by the ARRL, is an electronic confirmation system. Each operator uploads digitally signed log records; when both sides' records match (call signs, band, mode, and time within 30 minutes), the contact is confirmed. LoTW confirmations count for ARRL awards such as DXCC (100 entities confirmed) and WAS (Worked All States). Other online services such as eQSL and Club Log offer their own confirmation and award programs.</p>

<h4>ADIF</h4>
<p>The <b>Amateur Data Interchange Format</b> is the standard text format for exchanging logs between programs. Each field is a tag with a length, followed by the value, and each record ends with an end-of-record tag:</p>
<div class="formula"><code>&lt;CALL:6&gt;W9ABCD &lt;QSO_DATE:8&gt;20261116 &lt;TIME_ON:4&gt;1432 &lt;BAND:3&gt;20m &lt;FREQ:6&gt;14.230 &lt;MODE:3&gt;SSB &lt;RST_SENT:2&gt;59 &lt;RST_RCVD:2&gt;57 &lt;EOR&gt;</code></div>
<p>Dates are YYYYMMDD and times HHMM (or HHMMSS) in UTC. Virtually every logging program, LoTW and contest log checker accepts ADIF, so it is the safe format for backups.</p>

<div class="callout">Practical tip: set your station computer clock to synchronize automatically and display UTC at the operating position. Time errors are the most common reason confirmations fail to match.</div>

<h4>Key points</h4>
<ul><li>Log date, UTC time, call, frequency, mode and reports at minimum.</li>
<li>The UTC date changes at 0000 UTC.</li>
<li>Confirm contacts by QSL card, bureau, LoTW or other services.</li>
<li>ADIF is the universal log exchange format.</li></ul>
`,
    related: ['qso', 'contesting', 'q-codes'],
  },
  {
    id: 'contesting',
    cat: 'Operating',
    title: 'Contesting and Field Day',
    summary: 'How radio contests work: exchanges, scoring, running versus search-and-pounce, etiquette, and ARRL Field Day.',
    minutes: 6,
    html: `
<p>In a radio contest, stations try to make as many valid contacts as possible within a fixed period, exchanging a short, defined piece of information. Contests sharpen operating skills, test stations under pressure, and are an excellent way to make many contacts and work new states and countries quickly.</p>

<h4>The exchange</h4>
<p>Each contest defines its exchange. Examples:</p>
<table><thead><tr><th>Contest</th><th>Exchange</th></tr></thead><tbody>
<tr><td>CQ World Wide DX</td><td>Signal report + CQ zone (e.g. "59 05")</td></tr>
<tr><td>ARRL International DX</td><td>US/Canada: report + state or province; DX: report + power</td></tr>
<tr><td>ARRL November Sweepstakes</td><td>Serial number, precedence (power category), call, check (year first licensed), ARRL/RAC section</td></tr>
<tr><td>North American QSO Party</td><td>Name + state/province</td></tr>
<tr><td>State QSO parties</td><td>Report or serial + county (in-state) or state</td></tr>
<tr><td>ARRL Field Day</td><td>Number of transmitters + class + ARRL/RAC section (e.g. "2A WMA")</td></tr></tbody></table>
<p>Copy and send the exchange exactly; log checkers compare both logs, and errors cost points for one or both stations.</p>

<h4>Scoring</h4>
<p>A typical score is <b>QSO points × multipliers</b>. QSO points vary by mode or by whether the contact is on the same continent. Multipliers are distinct entities worked, such as states, sections, zones or countries, often counted once per band. Because multipliers multiply everything, working a new multiplier is usually worth far more than one more ordinary contact.</p>

<h4>Running and search-and-pounce</h4>
<ul>
<li><b>Running:</b> holding a frequency and calling CQ, letting stations come to you. A good run produces high rates (100 or more contacts per hour), but needs a strong enough signal to attract callers.</li>
<li><b>Search and pounce (S&amp;P):</b> tuning the band and calling stations that are running. This is how most new contesters start, and it is efficient for picking up multipliers.</li>
</ul>
<p>Experienced operators switch between the two as rates rise and fall, and in multi-radio stations do both at once.</p>

<h4>Contest operating practice</h4>
<ul>
<li>Listen to a few exchanges before calling so you know what the running station needs.</li>
<li>Give your call once, phonetically on phone. Do not say "this is"; just the call.</li>
<li>When the running station answers, send only the exchange: "59 05" or "5NN 5". Pleasantries waste time for everyone.</li>
<li>If you are not sure of a call or exchange, ask for a repeat; a busted contact costs points.</li>
<li>Contests are not permitted on 60, 30, 17 and 12 m (by convention for the latter three, and 60 m is channelized). Those bands are a refuge for non-contest operating on busy weekends.</li>
<li>Logging software (for example N1MM Logger+) handles dupes, multipliers, CW keying and the final Cabrillo-format log submitted to the sponsor.</li>
</ul>

<h4>ARRL Field Day</h4>
<p>Field Day is held on the <b>fourth full weekend of June</b>. It is both an operating event and an emergency-preparedness exercise: stations set up temporary antennas and, ideally, run from emergency power. The operating period begins at 1800 UTC Saturday and ends at 2059 UTC Sunday. Stations that do not begin setting up until the start time may operate the full 27 hours; stations that set up earlier (setup may begin up to 24 hours ahead) are limited to 24 consecutive hours of operation.</p>
<table><thead><tr><th>Class</th><th>Description</th></tr></thead><tbody>
<tr><td>A</td><td>Club or group portable station (three or more operators)</td></tr>
<tr><td>B</td><td>One or two person portable station</td></tr>
<tr><td>C</td><td>Mobile station</td></tr>
<tr><td>D</td><td>Home station on commercial power</td></tr>
<tr><td>E</td><td>Home station on emergency power</td></tr>
<tr><td>F</td><td>Emergency operations center</td></tr></tbody></table>
<p>The exchange is the number of simultaneous transmitters plus class, then the ARRL/RAC section, for example "3A EMA" for a three-transmitter club station in Eastern Massachusetts. Bonus points reward emergency power, public demonstrations, message handling and satellite contacts.</p>

<div class="callout">Practical tip: even if you do not intend to submit a score, contests are an efficient way to work many states or countries in a weekend. Submitting a log, however small, helps the sponsor check other logs.</div>

<h4>Key points</h4>
<ul><li>Score = QSO points × multipliers; multipliers are valuable.</li>
<li>Copy the exchange exactly; keep transmissions brief.</li>
<li>Running holds a frequency; S&amp;P finds stations that are running.</li>
<li>No contests on 60, 30, 17 or 12 m.</li>
<li>Field Day: fourth full weekend of June; exchange is transmitters, class, section.</li></ul>
`,
    related: ['qso', 'logging', 'cw', 'emergency'],
  },
  {
    id: 'emergency',
    cat: 'Operating',
    title: 'Emergency communications: ARES, RACES, nets and traffic',
    summary: 'The organizations that provide emergency communication, how directed nets operate, the radiogram format, and the rules that apply.',
    minutes: 7,
    html: `
<p>Emergency communication is one of the foundations of the Amateur Radio Service. When telephone, cellular and internet systems fail or are overloaded, amateurs can provide independent communication using their own equipment and power. Effective service depends far more on training and organization than on equipment.</p>

<h4>Organizations</h4>
<ul>
<li><b>ARES</b> (Amateur Radio Emergency Service): organized by the ARRL through section and county Emergency Coordinators. Members register, train, and serve agencies such as emergency management offices, hospitals and relief organizations under prior agreements.</li>
<li><b>RACES</b> (Radio Amateur Civil Emergency Service): defined in Part 97 (97.407) and administered by government emergency management agencies. RACES stations operate when activated by the responsible civil defense official, and only registered participants may take part. Many operators belong to both ARES and RACES.</li>
<li><b>SKYWARN</b>: National Weather Service program of trained storm spotters, many of whom report by amateur radio.</li>
<li><b>NTS</b> (National Traffic System): ARRL's structured network of nets that relay formal written messages across the country.</li>
</ul>

<h4>Rules for emergencies</h4>
<ul>
<li><b>97.403:</b> no provision of the rules prevents an amateur station from using any means at its disposal to provide essential communication needs in connection with the immediate safety of human life and immediate protection of property when normal communication systems are not available.</li>
<li><b>97.405:</b> a station in distress may use any means to attract attention and obtain assistance, and other stations may assist.</li>
<li>Even during emergencies, normal Part 97 rules apply otherwise: identification, no business communications for the operator's employer, and so on.</li>
</ul>

<h4>Nets</h4>
<p>A <b>net</b> is an organized on-air meeting. In a <b>directed net</b>, a <b>Net Control Station (NCS)</b> manages who transmits and when; this is standard for emergency operation. In an <b>open</b> (free-form) net, stations talk without formal control.</p>
<p>Procedure on a directed net:</p>
<ol>
<li>Listen to the NCS's opening preamble; it states the net's purpose and procedure.</li>
<li>Check in when invited, with your call (phonetically) and, if you have traffic, say so: "N1XYZ, with one priority message for the county EOC."</li>
<li>Do not transmit unless called by or cleared by NCS, except to report an emergency.</li>
<li>When directed to pass traffic, follow NCS instructions; you may be sent to another frequency to exchange a message and then return.</li>
<li>Use plain language, not Q-codes or jargon, on phone emergency nets; served agency staff may be listening.</li>
<li><b>Tactical call signs</b> (for example "Shelter 2", "EOC") identify functions; give your FCC call sign every 10 minutes and at the end of exchanges.</li>
</ol>

<h4>Precedence</h4>
<table><thead><tr><th>Precedence</th><th>Use</th></tr></thead><tbody>
<tr><td>EMERGENCY</td><td>Life-and-death urgency; always spelled out in full</td></tr>
<tr><td>PRIORITY (P)</td><td>Important, time-sensitive official traffic</td></tr>
<tr><td>WELFARE (W)</td><td>Inquiries about, or messages from, people in a disaster area</td></tr>
<tr><td>ROUTINE (R)</td><td>All other traffic</td></tr></tbody></table>

<h4>The ARRL radiogram</h4>
<p>Formal written messages use a fixed format so that they can be relayed accurately by many stations:</p>
<ul>
<li><b>Preamble:</b> message number, precedence, handling instructions (HX, optional), station of origin, check (the number of words in the text), place of origin, time filed, date.</li>
<li><b>Address:</b> name, street address, city, state, ZIP, telephone.</li>
<li><b>Text:</b> ideally 25 words or fewer; "X" replaces a period and "QUERY" a question mark.</li>
<li><b>Signature.</b></li>
</ul>
<p>The check lets every relaying station verify that no words were lost. Transmit the message word for word; do not paraphrase or "correct" it.</p>

<h4>Preparation</h4>
<ul>
<li>A <b>go-kit</b>: radio(s), antennas, feedline, power (batteries and charging), headphones, pencils and forms, local frequency lists, ID and documents, food, water and clothing for at least 24 to 72 hours.</li>
<li>Proficiency: participate in regular nets and exercises (for example the Simulated Emergency Test) and in Field Day.</li>
<li>Training: ARRL emergency communication courses and the FEMA Incident Command System courses (IS-100, IS-200, IS-700) are commonly required by served agencies.</li>
<li>Digital messaging (Winlink email over radio) is widely used to transfer accurate written information.</li>
</ul>

<div class="callout">Practical tip: the most valuable emergency skill is accurate message handling under stress: write everything down, read it back, and pass it exactly as received.</div>

<h4>Key points</h4>
<ul><li>ARES is ARRL-organized; RACES is government-activated under 97.407.</li>
<li>97.403 allows any means when life or property is at immediate risk and normal systems are unavailable.</li>
<li>Directed nets are run by a Net Control Station; transmit only when cleared.</li>
<li>Precedence: Emergency, Priority, Welfare, Routine.</li>
<li>Radiograms have preamble, address, text and signature; the check counts the words.</li></ul>
`,
    related: ['repeaters', 'height-ground', 'licensing', 'contesting'],
  },
  {
    id: 'rf-safety',
    cat: 'Operating',
    title: 'RF exposure and station safety',
    summary: 'FCC RF exposure limits and station evaluation, plus electrical, lightning and tower safety.',
    minutes: 7,
    html: `
<p>Amateur stations involve three main hazards: RF energy, electricity, and work at height. All are manageable with knowledge and sensible procedure.</p>

<h4>RF exposure: the physics</h4>
<p>Radio-frequency energy is <b>non-ionizing</b>: it does not have enough energy per photon to break chemical bonds. Its established biological effect is <b>heating</b> of tissue. The body absorbs RF most efficiently when its dimensions are comparable to the wavelength; for an adult the whole-body resonance lies roughly between 30 and 300 MHz, which is why exposure limits are <b>lowest in the VHF range</b>. The eyes and testes are particularly sensitive to heating because they have limited blood flow to remove heat.</p>

<h4>FCC limits (Maximum Permissible Exposure)</h4>
<p>FCC rules (47 CFR 1.1310) set MPE limits as power density averaged over time, with two tiers: <b>controlled/occupational</b> (people aware of the exposure and able to control it, such as the operator and family members who have been informed) and <b>uncontrolled/general population</b> (neighbors and the public).</p>
<table><thead><tr><th>Frequency</th><th>Controlled (mW/cm²)</th><th>Uncontrolled (mW/cm²)</th></tr></thead><tbody>
<tr><td>3–30 MHz</td><td>900 / f²</td><td>180 / f²</td></tr>
<tr><td>30–300 MHz</td><td>1.0</td><td>0.2</td></tr>
<tr><td>300–1,500 MHz</td><td>f / 300</td><td>f / 1500</td></tr>
<tr><td>1.5–100 GHz</td><td>5.0</td><td>1.0</td></tr></tbody></table>
<p>f is in MHz. Averaging time is 6 minutes for controlled and 30 minutes for uncontrolled environments, so duty cycle matters.</p>

<h4>Station evaluation</h4>
<p>Under 97.13(c) and the FCC's current rules (updated in 2021), every licensee must ensure the station complies, either by determining that it is exempt (using formulas based on power and distance) or by performing a <b>routine evaluation</b>. Evaluation can use FCC OET Bulletin 65 tables, online calculators (such as the ARRL's), calculation, computer modeling, or measurement. Factors include:</p>
<ul>
<li>Transmitter power and feedline loss.</li>
<li>Antenna gain and pattern; distance from the antenna to people.</li>
<li><b>Mode duty factor:</b> roughly 20% for SSB voice without heavy processing, 40% for conversational CW, 100% for FM, FT8 and RTTY.</li>
<li>Transmit/receive time within the averaging period.</li>
</ul>
<p>A simplified far-field estimate is S = P·G / (4πR²), with a ground-reflection factor of 2.56 applied to P·G in the FCC method. Example: 100 W PEP SSB (about 20 W average) into a dipole (G = 1.64) at 14.2 MHz. The uncontrolled limit is 180 / 14.2² ≈ 0.89 mW/cm². Setting S equal to the limit gives R = √(20,000 mW × 1.64 × 2.56 / (4π × 0.89)) ≈ 87 cm, about 3 ft, before allowing for listening time. Results like this show why typical HF stations comply easily, while higher power, high-gain VHF/UHF antennas or antennas close to people need more careful evaluation.</p>
<p>Practical measures: mount antennas high and away from where people spend time; never transmit while anyone is near a directional antenna's main beam; hold a handheld radio away from your eyes and use a body-worn or external antenna where possible.</p>

<h4>Electrical safety</h4>
<ul>
<li>120 V AC can be lethal; current across the chest of as little as 50 to 100 mA can cause ventricular fibrillation.</li>
<li>Amplifiers and some supplies contain voltages of several thousand volts and capacitors that remain charged after power-off. Use bleeder resistors and a grounding stick, and follow the manufacturer's service procedures.</li>
<li>Use a switched, clearly labeled master disconnect for the station so anyone can cut power in an emergency.</li>
<li>Correctly fused DC wiring prevents fires (see the station wiring article).</li>
</ul>

<h4>Lightning</h4>
<p>Disconnect antennas outside the building and unplug equipment when storms threaten. Bond all grounds together as described in the grounding article. Never work on antennas during thunderstorms.</p>

<h4>Antenna and tower safety</h4>
<ul>
<li><b>Power lines:</b> the leading cause of fatal antenna accidents. Site every antenna and support so that if it falls, in any direction, it cannot contact a power line; allow at least the full height plus a generous margin.</li>
<li>Use a full-body <b>fall-arrest harness</b> with a positioning lanyard when climbing, and stay attached at all times.</li>
<li>Never climb alone. Ground crew wear hard hats and stand clear of the area below the climber.</li>
<li>Inspect towers, guys and anchors regularly; follow manufacturer limits for wind load.</li>
<li>Be cautious with support-line launchers and slingshots in public areas.</li>
</ul>

<div class="callout warn">Safety: if you are unsure whether a station complies with RF exposure limits, reduce power, move the antenna farther from people, or perform a formal evaluation. When in doubt about electrical work or climbing, use qualified help.</div>

<h4>Key points</h4>
<ul><li>RF exposure is a heating effect; limits are lowest at 30 to 300 MHz.</li>
<li>Two tiers of MPE limits: controlled and uncontrolled, time-averaged.</li>
<li>Every station must be evaluated or shown exempt.</li>
<li>Duty factor, power, gain and distance determine exposure.</li>
<li>Keep antennas clear of power lines, use fall protection, never climb alone.</li></ul>
`,
    related: ['grounding', 'station-wiring', 'licensing', 'yagi'],
  },

  // -------------------------------------------------------------- Reference
  {
    id: 'q-codes',
    cat: 'Reference',
    title: 'Q-codes and operating abbreviations',
    summary: 'The common Q signals with question and statement meanings, plus frequently used CW and phone abbreviations.',
    minutes: 5,
    html: `
<p>Q signals are three-letter codes beginning with Q, originally adopted for international radiotelegraph communication so that operators without a common language could exchange routine information. Each code can be a question (followed by a question mark) or a statement. They remain standard on CW and digital modes; on phone, a few (QTH, QSL, QRZ, QSY) are used conversationally, but plain language is preferred on emergency nets.</p>

<h4>Common Q signals</h4>
<table><thead><tr><th>Code</th><th>As a question</th><th>As a statement</th></tr></thead><tbody>
<tr><td>QRG</td><td>What is my exact frequency?</td><td>Your exact frequency is ...</td></tr>
<tr><td>QRL</td><td>Is this frequency in use?</td><td>The frequency is in use (I am busy)</td></tr>
<tr><td>QRM</td><td>Is my transmission being interfered with?</td><td>There is interference (from other stations)</td></tr>
<tr><td>QRN</td><td>Are you troubled by static?</td><td>I am troubled by static (atmospheric noise)</td></tr>
<tr><td>QRO</td><td>Shall I increase power?</td><td>Increase power</td></tr>
<tr><td>QRP</td><td>Shall I decrease power?</td><td>Decrease power; also low-power operation (5 W or less)</td></tr>
<tr><td>QRQ</td><td>Shall I send faster?</td><td>Send faster</td></tr>
<tr><td>QRS</td><td>Shall I send more slowly?</td><td>Send more slowly</td></tr>
<tr><td>QRT</td><td>Shall I stop sending?</td><td>I am stopping transmission (closing down)</td></tr>
<tr><td>QRU</td><td>Have you anything for me?</td><td>I have nothing for you</td></tr>
<tr><td>QRV</td><td>Are you ready?</td><td>I am ready</td></tr>
<tr><td>QRX</td><td>When will you call me again?</td><td>Wait; I will call you again at ...</td></tr>
<tr><td>QRZ</td><td>Who is calling me?</td><td>You are being called by ...</td></tr>
<tr><td>QSB</td><td>Are my signals fading?</td><td>Your signals are fading</td></tr>
<tr><td>QSK</td><td>Can you hear me between your signals?</td><td>I can hear you between my signals (full break-in)</td></tr>
<tr><td>QSL</td><td>Can you acknowledge receipt?</td><td>I acknowledge receipt; also a confirmation card</td></tr>
<tr><td>QSO</td><td>Can you communicate with ... ?</td><td>I can communicate with ...; a contact</td></tr>
<tr><td>QSP</td><td>Will you relay to ... ?</td><td>I will relay to ...</td></tr>
<tr><td>QST</td><td>(none)</td><td>General call to all amateurs</td></tr>
<tr><td>QSX</td><td>Will you listen on ... ?</td><td>I am listening on ... (split)</td></tr>
<tr><td>QSY</td><td>Shall I change frequency?</td><td>Change frequency to ...</td></tr>
<tr><td>QTH</td><td>What is your location?</td><td>My location is ...</td></tr>
<tr><td>QTR</td><td>What is the correct time?</td><td>The correct time is ...</td></tr></tbody></table>

<h4>Common abbreviations</h4>
<table><thead><tr><th>Abbreviation</th><th>Meaning</th><th>Abbreviation</th><th>Meaning</th></tr></thead><tbody>
<tr><td>73</td><td>Best regards</td><td>88</td><td>Love and kisses</td></tr>
<tr><td>AGN</td><td>Again</td><td>ANT</td><td>Antenna</td></tr>
<tr><td>BK</td><td>Break (back to you)</td><td>CFM</td><td>Confirm</td></tr>
<tr><td>CQ</td><td>Calling any station</td><td>CUL</td><td>See you later</td></tr>
<tr><td>DE</td><td>From (this is)</td><td>DX</td><td>Distant station</td></tr>
<tr><td>ES</td><td>And</td><td>FB</td><td>Fine business (excellent)</td></tr>
<tr><td>GA / GE / GM</td><td>Good afternoon / evening / morning</td><td>HW?</td><td>How do you copy?</td></tr>
<tr><td>NR</td><td>Number</td><td>OM / YL / XYL</td><td>Operator (male) / young lady / wife</td></tr>
<tr><td>PSE</td><td>Please</td><td>R</td><td>Received, roger</td></tr>
<tr><td>RIG</td><td>Station equipment</td><td>RPT</td><td>Repeat; report</td></tr>
<tr><td>RST</td><td>Readability, strength, tone</td><td>SIG</td><td>Signal</td></tr>
<tr><td>SRI</td><td>Sorry</td><td>TNX / TU</td><td>Thanks / thank you</td></tr>
<tr><td>UR</td><td>Your, you are</td><td>WX</td><td>Weather</td></tr>
<tr><td>XYL</td><td>Wife</td><td>5NN</td><td>599 (abbreviated numbers)</td></tr></tbody></table>

<h4>Cut numbers</h4>
<p>In contests, CW operators often abbreviate digits: T for 0, A for 1, N for 9 (and occasionally E for 5, U for 2). "5NN" is 599; "TT5" means 005.</p>

<div class="callout">Practical tip: on phone, avoid saying "QSL" when you mean "roger"; it is understood, but on emergency nets plain language such as "received" or "understood" is clearer to everyone, including non-amateur listeners.</div>

<h4>Key points</h4>
<ul><li>Q signals are questions with "?" and statements without.</li>
<li>Most used: QRL, QRM, QRN, QRP, QRS, QRT, QRZ, QSB, QSL, QSO, QSY, QTH.</li>
<li>Abbreviations and cut numbers speed CW operation.</li>
<li>Prefer plain language on emergency phone nets.</li></ul>
`,
    related: ['cw', 'qso', 'logging'],
  },
  {
    id: 'formulas',
    cat: 'Reference',
    title: 'Formula and conversion cheat sheet',
    summary: "Ohm's law, power, wavelength and antenna lengths, decibel conversions, SWR and reflection, reactance, resonance and radio horizon.",
    minutes: 6,
    html: `
<h4>Ohm's law and power</h4>
<div class="formula">E = I × R &nbsp;&nbsp; I = E / R &nbsp;&nbsp; R = E / I</div>
<div class="formula">P = E × I = I² × R = E² / R</div>
<p>Example: a 100 W transceiver drawing 22 A at 13.8 V consumes 13.8 × 22 ≈ 304 W. 100 W into 50 Ω: E = √(100 × 50) = 70.7 V RMS, I = √(100 / 50) = 1.41 A. Peak voltage = RMS × 1.414 = 100 V.</p>

<h4>Wavelength and antenna lengths</h4>
<table><thead><tr><th>Quantity</th><th>Formula</th><th>Example (7.150 MHz)</th></tr></thead><tbody>
<tr><td>Wavelength (m)</td><td>300 / f</td><td>42.0 m</td></tr>
<tr><td>Wavelength (ft)</td><td>984 / f</td><td>137.6 ft</td></tr>
<tr><td>Half-wave dipole (ft)</td><td>468 / f</td><td>65.5 ft</td></tr>
<tr><td>Half-wave dipole (m)</td><td>142.5 / f</td><td>19.9 m</td></tr>
<tr><td>Quarter-wave vertical (ft)</td><td>234 / f</td><td>32.7 ft</td></tr>
<tr><td>Quarter-wave in coax (ft)</td><td>(246 / f) × VF</td><td>22.7 ft for VF 0.66</td></tr>
<tr><td>Trim correction</td><td>L<sub>new</sub> = L<sub>old</sub> × f<sub>meas</sub> / f<sub>target</sub></td><td>65.5 × 6.95 / 7.15 = 63.7 ft</td></tr></tbody></table>

<h4>Decibels</h4>
<div class="formula">dB = 10 log<sub>10</sub>(P<sub>2</sub> / P<sub>1</sub>) = 20 log<sub>10</sub>(V<sub>2</sub> / V<sub>1</sub>) &nbsp;&nbsp; dBm = 10 log<sub>10</sub>(P / 1 mW)</div>
<table><thead><tr><th>dB</th><th>Power ratio</th><th>Voltage ratio</th></tr></thead><tbody>
<tr><td>1</td><td>1.26</td><td>1.12</td></tr>
<tr><td>2</td><td>1.58</td><td>1.26</td></tr>
<tr><td>3</td><td>2.0</td><td>1.41</td></tr>
<tr><td>6</td><td>4.0</td><td>2.0</td></tr>
<tr><td>10</td><td>10</td><td>3.16</td></tr>
<tr><td>13</td><td>20</td><td>4.47</td></tr>
<tr><td>20</td><td>100</td><td>10</td></tr>
<tr><td>30</td><td>1,000</td><td>31.6</td></tr>
<tr><td>−3</td><td>0.5</td><td>0.707</td></tr>
<tr><td>−10</td><td>0.1</td><td>0.316</td></tr></tbody></table>
<p>Useful reference levels: 0 dBm = 1 mW; 30 dBm = 1 W; 50 dBm = 100 W; 60 dBm = 1 kW. One S-unit = 6 dB. dBi = dBd + 2.15.</p>
<p>Example: 100 W into a feedline with 3 dB loss delivers 50 W; into an antenna with 6 dBd gain the ERP is 100 × 10<sup>(6−3)/10</sup> ≈ 200 W ERP.</p>

<h4>SWR and reflection</h4>
<div class="formula">Γ = (Z<sub>L</sub> − Z<sub>0</sub>) / (Z<sub>L</sub> + Z<sub>0</sub>) &nbsp;&nbsp; SWR = (1 + |Γ|) / (1 − |Γ|) &nbsp;&nbsp; |Γ| = (SWR − 1) / (SWR + 1)</div>
<div class="formula">Reflected power fraction = |Γ|² &nbsp;&nbsp; Return loss = −20 log|Γ| &nbsp;&nbsp; Mismatch loss = −10 log(1 − |Γ|²)</div>
<p>Resistive load: SWR = Z<sub>L</sub> / Z<sub>0</sub> or Z<sub>0</sub> / Z<sub>L</sub>, whichever is greater than 1. Quick values: 1.5:1 → 4% reflected; 2:1 → 11%; 3:1 → 25%.</p>

<h4>Reactance and resonance</h4>
<div class="formula">X<sub>L</sub> = 2πfL &nbsp;&nbsp;&nbsp; X<sub>C</sub> = 1 / (2πfC) &nbsp;&nbsp;&nbsp; f<sub>r</sub> = 1 / (2π√(LC))</div>
<p>With f in hertz, L in henries, C in farads. Examples at 7 MHz: 1 µH → X<sub>L</sub> = 2π × 7×10<sup>6</sup> × 1×10<sup>−6</sup> ≈ 44 Ω; 100 pF → X<sub>C</sub> = 1 / (2π × 7×10<sup>6</sup> × 100×10<sup>−12</sup>) ≈ 227 Ω. 1 µH with 100 pF resonates at 1 / (2π√(10<sup>−16</sup>)) ≈ 15.9 MHz.</p>
<p>Impedance Z = R + jX; magnitude |Z| = √(R² + X²). Positive X is inductive, negative X capacitive.</p>

<h4>Transmission lines</h4>
<div class="formula">Coax Z<sub>0</sub> = (138 / √ε) log<sub>10</sub>(D / d) &nbsp;&nbsp; VF = 1 / √ε &nbsp;&nbsp; Quarter-wave transformer: Z<sub>0</sub> = √(Z<sub>in</sub> × Z<sub>L</sub>)</div>
<p>Example: to match a 100 Ω load to 50 Ω, a quarter-wave section of √(50 × 100) ≈ 71 Ω line (75 Ω coax is close) is used.</p>

<h4>Propagation</h4>
<div class="formula">Radio horizon: d (km) ≈ 4.12 √h (m) &nbsp;&nbsp; d (mi) ≈ 1.41 √h (ft)</div>
<div class="formula">MUF ≈ f<sub>c</sub> × sec θ (≈ 3 × foF2 for long single hops) &nbsp;&nbsp; Horizontal antenna first lobe: sin θ = λ / (4h)</div>

<h4>Morse timing</h4>
<div class="formula">Dit (ms) = 1200 / WPM</div>

<h4>Key points</h4>
<ul><li>P = E × I; 100 W into 50 Ω is 70.7 V RMS, 1.41 A.</li>
<li>3 dB = ×2 power; 10 dB = ×10; 6 dB = one S-unit.</li>
<li>λ = 300 / f m; dipole 468 / f ft; vertical 234 / f ft.</li>
<li>X<sub>L</sub> = 2πfL; X<sub>C</sub> = 1/(2πfC); f<sub>r</sub> = 1/(2π√LC).</li></ul>
`,
    related: ['antenna-basics', 'swr', 'feedlines', 'meters', 'vhf-propagation'],
  },
  {
    id: 'glossary',
    cat: 'Reference',
    title: 'Glossary of amateur radio terms',
    summary: 'Concise definitions of the technical and operating terms used throughout this library.',
    minutes: 8,
    html: `
<p>Terms are listed alphabetically. Cross-references to articles appear where a fuller treatment is available.</p>
<dl>
<dt>AGC (automatic gain control)</dt><dd>Receiver circuit that adjusts gain so strong and weak signals produce similar audio levels.</dd>
<dt>Amateur Extra</dt><dd>The highest US license class, with all amateur privileges.</dd>
<dt>Antenna analyzer</dt><dd>Instrument that measures SWR and impedance of an antenna system across frequency without transmitting.</dd>
<dt>ARES</dt><dd>Amateur Radio Emergency Service, the ARRL's organization of volunteers for emergency communication.</dd>
<dt>Attenuator</dt><dd>Circuit that reduces signal level by a fixed number of decibels, used to prevent receiver overload.</dd>
<dt>Balun</dt><dd>Device that couples a balanced load (such as a dipole) to an unbalanced line (coax), often also suppressing common-mode current.</dd>
<dt>Band plan</dt><dd>Voluntary arrangement of activities within a band, within the limits set by regulation.</dd>
<dt>Bandwidth</dt><dd>Range of frequencies occupied by a signal or passed by a filter; also the frequency range over which an antenna has acceptable SWR.</dd>
<dt>Common-mode current</dt><dd>Unwanted current flowing on the outside of a coax shield, which makes the feedline radiate.</dd>
<dt>Counterpoise</dt><dd>Conductor or set of wires that provides the return path for an unbalanced antenna in place of an earth connection.</dd>
<dt>CQ</dt><dd>General call inviting any station to respond.</dd>
<dt>Critical frequency</dt><dd>Highest frequency reflected by an ionospheric layer at vertical incidence (foF2 for the F2 layer).</dd>
<dt>CTCSS</dt><dd>Continuous Tone-Coded Squelch System; sub-audible tone (67 to 254 Hz) used to access repeaters.</dd>
<dt>CW</dt><dd>Continuous wave; on-off keyed carrier used for Morse code.</dd>
<dt>dBd, dBi</dt><dd>Antenna gain relative to a dipole and to an isotropic radiator; dBi = dBd + 2.15.</dd>
<dt>dBm</dt><dd>Power level in decibels relative to 1 milliwatt.</dd>
<dt>Dipole</dt><dd>Antenna of two equal conductors fed at the center; usually a half wavelength long.</dd>
<dt>Directional coupler</dt><dd>Circuit that samples forward and reflected power separately; the basis of SWR meters.</dd>
<dt>Duty cycle</dt><dd>Fraction of time a transmitter is producing full output; affects heating and RF exposure.</dd>
<dt>DX</dt><dd>Distant station, usually in another country.</dd>
<dt>End effect</dt><dd>Capacitance at the ends of an antenna element that makes it resonate at a shorter length than a free-space half wavelength.</dd>
<dt>ERP</dt><dd>Effective radiated power; transmitter power minus losses, multiplied by antenna gain relative to a dipole.</dd>
<dt>Feedline</dt><dd>Transmission line connecting transmitter and antenna, such as coax or ladder line.</dd>
<dt>Feedpoint</dt><dd>Point at which the feedline connects to the antenna.</dd>
<dt>FT8</dt><dd>Weak-signal digital mode with 15-second synchronized transmissions and 50 Hz bandwidth.</dd>
<dt>Gamma (Γ)</dt><dd>Reflection coefficient, the ratio of reflected to incident voltage at a load.</dd>
<dt>Greyline</dt><dd>The day-night terminator, along which low-band propagation is often enhanced.</dd>
<dt>Ground wave</dt><dd>Signal that follows the Earth's surface; useful mainly on the lower HF and MF bands.</dd>
<dt>Impedance (Z)</dt><dd>Opposition to alternating current, Z = R + jX, with resistive and reactive parts.</dd>
<dt>Inverted-V</dt><dd>Dipole supported at the center with legs sloping downward.</dd>
<dt>Ionosphere</dt><dd>Ionized region of the upper atmosphere, 60 to 500 km high, that refracts HF signals.</dd>
<dt>LoTW</dt><dd>Logbook of The World, the ARRL's electronic contact-confirmation system.</dd>
<dt>LUF</dt><dd>Lowest usable frequency over a path, set mainly by D-layer absorption.</dd>
<dt>MPE</dt><dd>Maximum permissible exposure; FCC limit on RF power density for human exposure.</dd>
<dt>MUF</dt><dd>Maximum usable frequency over a path at a given time.</dd>
<dt>Net</dt><dd>Organized on-air meeting of stations, often directed by a net control station.</dd>
<dt>NVIS</dt><dd>Near-vertical-incidence skywave; high-angle radiation for regional coverage without a skip zone.</dd>
<dt>PEP</dt><dd>Peak envelope power; average power during one RF cycle at the crest of the modulation envelope.</dd>
<dt>Phonetic alphabet</dt><dd>Standard words (Alfa, Bravo, Charlie ...) used to spell letters clearly by voice.</dd>
<dt>Preamplifier</dt><dd>Receiver input amplifier that adds gain, mainly useful on higher HF and VHF/UHF.</dd>
<dt>Propagation</dt><dd>The manner in which radio waves travel from transmitter to receiver.</dd>
<dt>QRP</dt><dd>Low-power operation, conventionally 5 W or less on CW.</dd>
<dt>QSL</dt><dd>Confirmation of a contact; also "I acknowledge".</dd>
<dt>QSO</dt><dd>A two-way contact.</dd>
<dt>Radial</dt><dd>Wire extending outward from the base of a vertical antenna as part of its ground system.</dd>
<dt>Reactance (X)</dt><dd>Opposition to AC from inductance (positive X) or capacitance (negative X); stores energy rather than dissipating it.</dd>
<dt>Repeater</dt><dd>Station that receives on one frequency and simultaneously retransmits on another to extend coverage.</dd>
<dt>Resonance</dt><dd>Condition in which reactance is zero and the impedance is purely resistive.</dd>
<dt>RIT</dt><dd>Receiver incremental tuning; shifts receive frequency without changing transmit frequency.</dd>
<dt>RST</dt><dd>Readability, strength, tone signal report system.</dd>
<dt>S-meter</dt><dd>Received signal-strength indicator; one S-unit is 6 dB, S9 is −73 dBm on HF.</dd>
<dt>SFI</dt><dd>Solar flux index, the 10.7 cm solar radio flux, an indicator of ionizing radiation.</dd>
<dt>Simplex</dt><dd>Transmitting and receiving on the same frequency without a repeater.</dd>
<dt>Skip zone</dt><dd>Region between ground-wave range and the first skywave return, where a signal is not heard.</dd>
<dt>Split operation</dt><dd>Transmitting on one frequency and receiving on another, common in DX pileups.</dd>
<dt>Sporadic-E</dt><dd>Patches of dense E-layer ionization that open 10, 6 and sometimes 2 m, mainly in summer.</dd>
<dt>SSB</dt><dd>Single sideband; voice mode transmitting one sideband without the carrier.</dd>
<dt>SWR</dt><dd>Standing wave ratio, a measure of mismatch between a line and its load.</dd>
<dt>Tuner (ATU)</dt><dd>Impedance-matching network that presents a 50 Ω load to the transmitter.</dd>
<dt>Unun</dt><dd>Unbalanced-to-unbalanced transformer, such as the 49:1 used on end-fed antennas.</dd>
<dt>UTC</dt><dd>Coordinated Universal Time, the time standard used for logging.</dd>
<dt>Velocity factor (VF)</dt><dd>Speed of a wave in a transmission line as a fraction of the speed of light.</dd>
<dt>VFO</dt><dd>Variable frequency oscillator; the tuning control that sets operating frequency.</dd>
<dt>Yagi</dt><dd>Directional antenna with a driven element and parasitic reflector and director elements.</dd>
<dt>Zero beat</dt><dd>Tuning so that your transmit frequency matches the received station exactly.</dd>
</dl>
`,
    related: ['formulas', 'q-codes', 'antenna-basics', 'swr'],
  },
];

export const libById = (id) => LIBRARY.find((a) => a.id === id);

LIBRARY.push(...RF_LIBRARY);
