// "Where you are": a panel above the radio that follows the dial and answers, for whatever is
// tuned in: who uses this frequency and why, when it works, what to do here, and whether you
// could listen or transmit in real life. Also the whole-dial browser and the helper channels.
import { S, save, licName } from './state.js';
import { h, bus, modal, toast } from './util.js';
import { BANDS, SEGMENTS, bandOf, checkTx } from './data/bandplan.js';
import { ALLOC, SPOTS, HAM, PLAN_2M, CATS, LEGAL, EMERGENCY, gearFor } from './data/spectrum.js';
import { HELPERS, helperAt, helperFor } from './helpers.js';
import { serviceOf } from './services.js';
import { NETS, netActive, localHour, FT8_FREQ } from './activity.js';
import { bandConditions } from './propagation.js';
import { stateBy } from './data/world.js';
import { rig } from './rigs.js';

const M = 1e6;
export const fmtF = (hz) => (hz < 1.8 * M ? `${Math.round(hz / 1e3)} kHz` : `${(hz / M).toFixed(hz % 1e3 ? 4 : 3).replace(/(\.\d{3})0$/, '$1')} MHz`);
const fmtRange = (lo, hi) => (hi < 1.8 * M ? `${Math.round(lo / 1e3)}–${Math.round(hi / 1e3)} kHz` : `${+(lo / M).toFixed(3)}–${+(hi / M).toFixed(3)} MHz`);
const inRx = (hz) => { const [lo, hi] = rig().rx; return hz >= lo && hz <= hi; };
const LN = { T: 'Technician', G: 'General', E: 'Extra' };

// ------------------------------------------------------------------ lookup
function hamEntry(b) {
  return { lo: b.lo, hi: b.hi, cat: 'ham', ham: b, name: `${b.name.replace('m', ' m')} amateur band`, mode: b.defMode, tune: [b.def, b.defMode],
    who: 'Licensed radio amateurs: private people talking to each other for the interest of it. Casual contacts, long-distance chasing, contests, nets and emergency practice. No business, no broadcasting, no music.',
    why: HAM[b.name].why, when: HAM[b.name].when, listen: 'Yes. Anyone may listen to amateur radio, and may repeat what they hear.' };
}
const HAM_ENTRIES = BANDS.map(hamEntry);
export function allocAt(hz) {
  const b = bandOf(hz);
  if (b) return HAM_ENTRIES.find((e) => e.ham === b);
  return ALLOC.filter((a) => hz >= a.lo && hz <= a.hi).sort((x, y) => (x.hi - x.lo) - (y.hi - y.lo))[0] || null;
}
const spotAt = (hz) => SPOTS.filter((p) => Math.abs(p.f - hz) <= p.tol).sort((a, b) => Math.abs(a.f - hz) - Math.abs(b.f - hz))[0] || null;

// What part of an amateur band this is, by convention, and the mode people use there.
function hamSegment(b, hz) {
  const ft8 = FT8_FREQ[b.name];
  if (ft8 && hz >= ft8 - 200 && hz <= ft8 + 3000) return { id: 'ft8', label: 'FT8 window', mode: 'USB' };
  if (b.name === '2m') {
    const p = PLAN_2M.find(([lo, hi]) => hz >= lo * M && hz < hi * M) || PLAN_2M[PLAN_2M.length - 1];
    const weak = hz < 144.3 * M;
    return { id: /repeater/.test(p[2]) ? 'rpt' : /simplex/.test(p[2]) ? 'simplex' : weak ? (hz < 144.1 * M ? 'cw' : 'phone') : 'data', label: p[2], mode: hz < 144.1 * M ? 'CW' : weak ? 'USB' : 'FM' };
  }
  if (hz >= b.cw[0] && hz <= b.cw[1]) return { id: 'cw', label: 'CW (Morse) segment', mode: 'CW' };
  if (b.ph && hz >= b.ph[0] && hz <= b.ph[1]) return { id: 'phone', label: 'phone (voice) segment', mode: hz < 10 * M ? 'LSB' : 'USB' };
  return { id: 'data', label: 'data modes' + (SEGMENTS.some((s) => s.allow === 'ALL' && hz >= s.lo && hz <= s.hi) ? ' and some voice' : ''), mode: 'USB' };
}

// What each licence class may send on this exact frequency (from the table the transmitter uses).
function classPrivs(hz) {
  return ['T', 'G', 'E'].map((l) => {
    const segs = SEGMENTS.filter((s) => s.lic.includes(l) && hz >= s.lo && hz <= s.hi);
    const best = segs.some((s) => s.allow === 'ALL') ? 'voice, CW and data' : segs.some((s) => s.allow === 'CWDATA') ? 'CW and data, no voice' : segs.length ? 'CW only' : null;
    return [l, best];
  });
}

// ------------------------------------------------------------------ the four answers
function context() {
  const hz = S.radio.freq, mode = S.radio.mode;
  const a = allocAt(hz), spot = spotAt(hz), b = bandOf(hz);
  const seg = b ? hamSegment(b, hz) : null;
  const helper = helperAt(hz);
  const want = helper ? (helper.mode === 'SSB' ? helper.sb : helper.mode) : spot?.mode || seg?.mode || a?.mode || null;
  return { hz, mode, a, spot, b, seg, helper, want, hour: Math.floor(localHour()), lic: S.license };
}

function whenLine(c) {
  const day = c.hour >= 7 && c.hour < 18;
  const clock = `${String(c.hour).padStart(2, '0')}:00 local`;
  if (c.b && c.hz < 30 * M) {
    const g = bandConditions(stateBy(S.op.state)).find((x) => x.name.split('-').includes(c.b.name));
    return g ? `Right now (${clock}) this band is ${g.now === 'Closed' ? 'closed for long distance' : g.now.toLowerCase()}, from the live ionosphere data.` : `It is ${day ? 'daytime' : 'night'} at your station (${clock}).`;
  }
  if (c.hz >= 30 * M) return null;
  if (c.hz < 1.71 * M) return `It is ${day ? 'daytime, so expect local stations only' : 'night, so distant stations are coming in'} (${clock}).`;
  return day ? `It is daytime at your station (${clock}): frequencies above about 10 MHz carry furthest now, and lower ones are absorbed until dusk.`
    : `It is night at your station (${clock}): frequencies below about 10 MHz carry furthest now, and higher ones have mostly closed.`;
}

function todo(c) {
  const { a, seg, spot, b, lic } = c;
  if (!a) return ['Nothing is allocated to listeners here.'];
  if (!b) return ['Listen only. Nobody here is expecting a call from you.', a.hear, a.sim].filter(Boolean);
  const out = [];
  if (spot?.rpt || seg.id === 'rpt') out.push('Set FM, the repeater offset (minus 600 kHz below 147 MHz, plus above) and its CTCSS tone.', 'Listen for a minute. Then say your callsign and "listening", or answer someone who does.');
  else if (spot?.simplex || seg.id === 'simplex') out.push('Set FM with the offset on Simplex: radio to radio, no repeater.', 'Say your callsign and "monitoring", or call a station by its callsign.');
  else if (seg.id === 'ft8') out.push('Leave the dial exactly on the FT8 frequency in USB. Each tone in the 3 kHz window is one station.', 'In real life a computer running free software decodes and sends the messages; nobody does FT8 by ear.', 'Turn on subtitles to see what a decoder would print.');
  else if (seg.id === 'cw') out.push('Set CW and a narrow filter, 250 to 500 Hz.', 'Tune until the tone is comfortable, then read the subtitles while you learn the code.', 'Slow stations gather near 7.047 and 3.581 MHz (Find bar, Slow CW).');
  else if (seg.id === 'phone') out.push(`Voice here is ${seg.mode} by convention.`, 'Tune slowly until a voice sounds natural, neither squeaky nor growling.', 'Listen first. To answer a CQ, say their callsign once and yours twice (F4 in the logger).', 'To start a contact, ask "is this frequency in use?", then call CQ (F1).');
  else out.push('Data modes sound like warbles, chirps and buzzes. Each needs a computer to decode.', 'Voice operators stay out of this segment by agreement.');
  if (!lic) out.push('You have no licence yet, so listen. The License study page gets you to Technician.');
  else { const r = checkTx(lic, c.hz, c.mode); out.push(r.ok ? `Your ${LN[lic]} licence lets you transmit here in ${c.mode}.` : r.reason); }
  return out;
}

function listenIRL(c) { return { ok: true, text: `${c.a.listen.replace(/^Yes\.\s*/, '')} ${gearFor(c.hz, c.want || c.mode)}`.trim() }; }
function txIRL(c) {
  const { a, b, hz } = c;
  if (!b) return { v: a.tx[0], text: a.tx[1] };
  const privs = classPrivs(hz);
  return { v: 'lic', text: `With an FCC amateur licence. On this frequency: ${privs.map(([l, p]) => `${LN[l]}, ${p || 'nothing'}`).join('; ')}. The Technician exam is 35 multiple-choice questions with no Morse code. Expect about $15 for the exam session and a $35 FCC fee, for a ten-year licence.` };
}
const VERDICT = { no: ['No', 'bad'], free: ['Yes, licence-free', 'ok'], lic: ['With a licence', 'warn'], role: ['Only on the job', 'warn'] };
const chip = (label, cls) => h('span', { class: `wa-chip ${cls}` }, label);

// Things worth doing at this hour with this licence. Each: label, why, action.
function ideas(c) {
  const day = c.hour >= 7 && c.hour < 18, lic = c.lic;
  const cond = bandConditions(stateBy(S.op.state));
  const open = (n) => cond.find((x) => x.name.split('-').includes(n))?.now !== 'Closed';
  const out = [];
  const tune = (f, m, extra) => () => { if (extra) { Object.assign(S.radio, extra); save(); } bus.emit('tune-to', f, m); };
  const can = (f, m) => (lic && checkTx(lic, f, m).ok ? 'you may transmit' : lic ? 'listen: your licence does not cover it' : 'listen');
  const hp = helperFor(c.hz, c.b?.name, serviceOf(c.hz)?.name);
  if (hp && !c.helper && inRx(hp.f)) out.push({ label: `Helper channel, ${fmtF(hp.f)}`, why: `A spoken briefing on ${hp.label}: who is here, what hardware you need and what the exam asks.`, go: tune(hp.f, hp.mode === 'SSB' ? hp.sb : hp.mode, hp.mode === 'FM' ? { rptOffset: 0 } : null), primary: true });
  for (const n of NETS.filter((x) => netActive(x))) out.push({ label: `Net on the air: ${n.title()}`, why: n.desc, f: n.freq, go: tune(n.freq, n.mode, n.band === '2m' ? { rptOffset: -600000, toneHz: 100 } : null) });
  if (day) out.push({ label: `20 m voice (${can(14.25 * M, 'USB')})`, why: 'It is daytime, and 20 m is the main long-distance band while the sun is up.', f: 14.25 * M, go: tune(14.25 * M, 'USB') });
  else out.push({ label: `40 m voice (${can(7.2 * M, 'LSB')})`, why: 'It is dark, and 40 m now reaches across the continent and beyond.', f: 7.2 * M, go: tune(7.2 * M, 'LSB') },
    { label: `80 m voice (${can(3.86 * M, 'LSB')})`, why: 'The evening band for regional conversations and state nets.', f: 3.86 * M, go: tune(3.86 * M, 'LSB') });
  if (day && open('10m')) out.push({ label: `10 m voice (${can(28.4 * M, 'USB')})`, why: '10 m is open. 28.300 to 28.500 MHz is the only HF voice segment a Technician may use.', f: 28.4 * M, go: tune(28.4 * M, 'USB') });
  out.push({ label: 'Local repeater', why: 'Works at any hour, and is where most new hams make a first contact.', f: 146.94 * M, go: tune(146.94 * M, 'FM', { rptOffset: -600000, toneHz: 100 }) },
    { label: 'WWV time signal', why: 'A ten-second propagation check: if 10 MHz from Colorado is strong, the middle bands are open.', f: 10 * M, go: tune(10 * M, 'AM') },
    { label: 'Airliners over the Atlantic', why: `Real-world listening on shortwave sideband. ${day ? 'By day they use 8.906 MHz.' : 'At night they use 5.598 MHz.'}`, f: day ? 8906e3 : 5598e3, go: tune(day ? 8906e3 : 5598e3, 'USB') });
  if (!lic) out.push({ label: 'Study for the licence', why: 'Listening is free. Transmitting on the amateur bands starts with the Technician exam.', go: () => bus.emit('goto', 'license') });
  return out.filter((x) => !x.f || (inRx(x.f) && allocAt(x.f) !== c.a)).slice(0, 5);
}

// ------------------------------------------------------------------ panel
let root, lastKey = '';
// On a phone the full guide would push the radio off the screen, so it starts as a one-line summary.
const isMin = () => false;
const keyOf = (c) => [c.a?.name, c.a?.lo, c.spot?.name, c.seg?.id, c.seg?.label, c.helper?.id, c.mode, c.want, c.lic, c.hour, isMin(), rig().name, c.b ? checkTx(c.lic, c.hz, c.mode).ok : ''].join('|');

function render(c) {
  root.innerHTML = '';
  const { a, spot, seg, helper } = c;
  const [catName, color] = a ? CATS[a.cat] : ['Unallocated', '#5b6879'];
  const title = a ? a.name + (seg ? `: ${seg.label}` : '') : 'Outside the bands this panel covers';
  const tx = a ? txIRL(c) : null;
  const head = h('div', { class: 'wa-head' },
    h('span', { class: 'wa-dot', style: { background: color } }),
    h('div', { class: 'wa-title' }, h('div', { class: 'eyebrow' }, catName), h('h3', {}, helper ? `Helper channel for ${helper.label}` : title)));
  const card = h('div', { class: 'card side-card whereami' }, head);
  root.append(card);
  if (a) card.append(h('div', { class: 'wa-verdicts' }, h('span', { class: 'wa-k' }, 'In real life'), chip('Listen: yes', 'ok'), chip(`Transmit: ${VERDICT[tx.v][0].toLowerCase()}`, VERDICT[tx.v][1])));
  if (!a) { card.append(h('button', { class: 'btn small', onclick: openDial }, 'Show the whole dial')); return; }
  if (spot) card.append(h('div', { class: 'wa-spot' }, h('b', {}, `${spot.name}. `), spot.text));
  const wrongMode = c.want && c.mode !== c.want && rig().modes.includes(c.want) && !(c.seg?.id === 'data');
  const list = (items) => h('ul', { class: 'wa-list' }, ...items.map((x) => h('li', {}, x)));
  const w = whenLine(c);
  if (w) card.append(h('p', { class: 'wa-now' }, w));
  card.append(h('h4', { class: 'wa-h' }, 'What to do here'), list(todo(c).slice(0, 4)));
  if (wrongMode) card.append(h('button', { class: 'btn small primary', onclick: () => bus.emit('tune-to', S.radio.freq, c.want) }, `You are on ${c.mode}. Switch to ${c.want}`));
  card.append(h('details', { class: 'wa-more' }, h('summary', {}, 'More about this band'),
    h('h4', { class: 'wa-h' }, 'Who is here, and why'), h('p', {}, a.who), h('p', {}, a.why),
    a.when ? h('div', {}, h('h4', { class: 'wa-h' }, 'When it works'), h('p', {}, a.when)) : null,
    h('h4', { class: 'wa-h' }, 'In real life'),
    h('p', {}, chip('Listen: yes', 'ok'), ' ', listenIRL(c).text),
    h('p', {}, chip(`Transmit: ${VERDICT[tx.v][0].toLowerCase()}`, VERDICT[tx.v][1]), ' ', tx.text),
    helper ? h('div', {}, h('h4', { class: 'wa-h' }, 'Hardware to connect'), list(helper.hardware), h('h4', { class: 'wa-h' }, 'For the exam'), list(helper.exam)) : null,
    h('button', { class: 'btn small', onclick: openDial }, 'Show the whole dial')));
  const next = ideas(c);
  if (next.length) card.append(h('div', { class: 'wa-next' }, h('span', { class: 'wa-k' }, 'Try next'), ...next.map((x) => h('button', { class: `chip ${x.primary ? 'active' : ''}`, title: x.why, onclick: () => { x.go(); toast(`<b>${x.label}.</b> ${x.why}`, 'info', 7000); } }, x.label))));
}

function tick(force) {
  if (!root || ((document.body.dataset.tab !== 'radio' || root.hidden) && !force)) return;
  const c = context(), k = keyOf(c);
  if (k === lastKey && !force) return;
  lastKey = k;
  render(c);
}

export function initWhereAmI(el) {
  root = el;
  tick(true);
  setInterval(tick, 400);
  for (const ev of ['license', 'rig', 'tab', 'qth']) bus.on(ev, () => tick(true));
  bus.on('radio-side', () => setTimeout(() => tick(true)));
  bus.on('whole-dial', openDial);
}

// ------------------------------------------------------------------ the whole dial
function dialEntries() {
  const seen = new Set();
  return [...HAM_ENTRIES, ...ALLOC].sort((x, y) => x.lo - y.lo).filter((e) => { // FRS/GMRS has two halves; list it once
    if (e.cat !== 'pers' || !seen.has(e.name)) { seen.add(e.name); return true; } return false;
  });
}
function openDial() {
  let cat = null, openRow = null, close;
  const body = h('div', { class: 'dial' });
  const go = (f, m) => { close(); bus.emit('tune-to', f, m); };
  const strip = () => {
    // log-frequency strip: what occupies each part of the dial, 500 kHz to 500 MHz
    const lo = Math.log(0.5 * M), span = Math.log(500 * M) - lo, cuts = [...new Set([0.5 * M, 500 * M, ...[...HAM_ENTRIES, ...ALLOC].flatMap((e) => [e.lo, e.hi])])].filter((x) => x >= 0.5 * M && x <= 500 * M).sort((x, y) => x - y);
    const x = (f) => ((Math.log(f) - lo) / span) * 100;
    const el = h('div', { class: 'dial-strip' });
    for (let i = 0; i < cuts.length - 1; i++) {
      const e = allocAt(Math.sqrt(cuts[i] * cuts[i + 1]));
      if (!e) continue;
      el.append(h('button', { class: `dial-blk ${cat && e.cat !== cat ? 'dim' : ''}`, title: `${e.name}, ${fmtRange(e.lo, e.hi)}`, style: { left: `${x(cuts[i])}%`, width: `max(2px, ${x(cuts[i + 1]) - x(cuts[i])}%)`, background: CATS[e.cat][1] }, onclick: () => { openRow = e; draw(); body.querySelector('.dial-row.open')?.scrollIntoView({ block: 'center', behavior: 'smooth' }); } }));
    }
    el.append(h('span', { class: 'dial-you', style: { left: `${x(Math.max(0.5 * M, Math.min(500 * M, S.radio.freq)))}%` }, title: `You are here: ${fmtF(S.radio.freq)}` }));
    return h('div', {}, el, h('div', { class: 'dial-axis' }, ...[1, 3, 10, 30, 100, 300].map((f) => h('span', { style: { left: `${x(f * M)}%` } }, `${f} MHz`))));
  };
  const row = (e) => {
    const txv = e.ham ? ['lic', 'With an FCC amateur licence. What each class may do depends on the exact frequency: tune in and the panel above the radio shows it.'] : e.tx;
    const isOpen = openRow === e, here = allocAt(S.radio.freq) === e;
    const hp = HELPERS.find((x) => (e.ham ? x.key === e.ham.name : x.alloc === e));
    const t = e.tune && inRx(e.tune[0]) ? e.tune : null;
    return h('div', { class: `dial-row ${isOpen ? 'open' : ''} ${here ? 'here' : ''}` },
      h('button', { class: 'dial-sum', onclick: () => { openRow = isOpen ? null : e; draw(); } },
        h('span', { class: 'wa-dot', style: { background: CATS[e.cat][1] } }), h('span', { class: 'mono dial-f' }, fmtRange(e.lo, e.hi)), h('b', {}, e.name), here ? h('span', { class: 'wa-chip ok' }, 'you are here') : null,
        h('span', { class: 'dial-v' }, chip('Listen', 'ok'), chip(`Transmit: ${VERDICT[txv[0]][0].toLowerCase()}`, VERDICT[txv[0]][1]))),
      isOpen ? h('div', { class: 'dial-det' },
        h('p', {}, h('b', {}, 'Who: '), e.who), h('p', {}, h('b', {}, 'Why here: '), e.why), e.when ? h('p', {}, h('b', {}, 'When: '), e.when) : null, e.hear ? h('p', {}, h('b', {}, 'Sounds like: '), e.hear) : null,
        h('p', {}, h('b', {}, 'Listen in real life: '), `${e.listen} ${gearFor((e.lo + e.hi) / 2, e.mode)}`), h('p', {}, h('b', {}, 'Transmit in real life: '), txv[1]),
        e.sim ? h('p', { class: 'muted' }, h('b', {}, 'In the simulator: '), e.sim) : null,
        h('div', { class: 'row' }, t ? h('button', { class: 'btn small primary', onclick: () => go(t[0], t[1]) }, `Tune to ${fmtF(t[0])}`) : null,
          hp && inRx(hp.f) ? h('button', { class: 'btn small', onclick: () => go(hp.f, hp.mode === 'SSB' ? hp.sb : hp.mode) }, `Helper channel, ${fmtF(hp.f)}`) : null)) : null);
  };
  function draw() {
    body.innerHTML = '';
    body.append(h('div', { class: 'eyebrow' }, 'The whole dial'), h('h2', {}, 'Who is on which frequencies, and why'),
      h('p', { class: 'small muted' }, 'Radio spectrum is divided by what each frequency is physically good at: low frequencies bend around the earth and bounce off the ionosphere, so they go to long-distance users; high frequencies travel in straight lines and fit small antennas, so they go to local users and are reused in every city. Select a band for the full story. The bar shows 500 kHz to 500 MHz; each octave gets equal width.'),
      strip(),
      h('div', { class: 'row dial-cats' }, h('button', { class: `chip ${cat ? '' : 'active'}`, onclick: () => { cat = null; draw(); } }, 'Everything'),
        ...Object.entries(CATS).map(([k, [n, col]]) => h('button', { class: `chip ${cat === k ? 'active' : ''}`, onclick: () => { cat = cat === k ? null : k; draw(); } }, h('span', { class: 'wa-dot', style: { background: col } }), n))),
      h('div', { class: 'dial-helpers' }, h('b', {}, 'Helper channels: '), h('span', { class: 'small muted' }, 'the simulator\'s own stations, one for each kind of traffic. Each explains aloud who is on the band, what hardware to connect and what the exam asks. '),
        h('div', { class: 'row' }, ...HELPERS.filter((x) => inRx(x.f)).map((x) => h('button', { class: 'chip', title: `Helper channel for ${x.label}`, onclick: () => go(x.f, x.mode === 'SSB' ? x.sb : x.mode) }, `${x.band || x.label.replace(/^the /, '')} · ${fmtF(x.f)}`)))),
      h('div', { class: 'dial-list' }, ...dialEntries().filter((e) => !cat || e.cat === cat).map(row)),
      h('div', { class: 'dial-legal small' }, h('h4', {}, 'Can I listen? Can I transmit?'), h('p', {}, LEGAL), h('p', {}, EMERGENCY),
        h('p', {}, h('b', {}, 'From no paperwork to full privileges: '), 'FRS walkie-talkies, CB and MURS need no licence at all. GMRS is a $35 family licence with no exam. The Technician amateur licence (one 35-question exam) opens every amateur band above 30 MHz and a little of HF. General opens most of HF, which is where worldwide contacts happen. Extra opens the rest. Your simulator licence is: ', h('b', {}, licName()), '.'),
        h('button', { class: 'btn small', onclick: () => { close(); bus.emit('library', 'who-is-where'); } }, 'Read the full article')));
  }
  openRow = allocAt(S.radio.freq);
  draw();
  close = modal(body, { wide: true });
}
