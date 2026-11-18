// License tab: study, practice exams, and the VE exam session that earns your license.
import { S, save, licName } from './state.js';
import { h, toast, bus, pick, modal } from './util.js';
import { POOL, EXAM } from './data/questions.js';
import { newLicenseeCall, STATES } from './data/world.js';
import { BANDS, privilegeMap, privRanges, allowLabel, fmtRange, OTHER_HAM } from './data/bandplan.js';
import { powerLimit } from './limits.js';
import { elmer } from './elmer.js';

let root;
const ORDER = ['T', 'G', 'E'];
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

export function initExamUI(el) { root = el; render(); bus.on('license', render); }

function canTake(el) {
  if (el === 'T') return true;
  if (el === 'G') return S.exams.T;
  return S.exams.G;
}

function render() {
  root.innerHTML = '';
  const lic = S.license;
  const status = h('div', { class: 'card lic-status' },
    h('h3', {}, 'Your license'),
    h('div', { class: 'lic-big' }, S.call ? h('span', { class: 'callsign' }, S.call) : h('span', { class: 'muted' }, 'No callsign yet'), ' ', h('span', { class: `badge lic-${lic || 'none'}` }, licName())),
    h('p', { class: 'small' }, lic ? 'You may transmit within your privileges. The summary below compares the classes; the full frequency list is under "Where you can transmit".' : 'You can listen to everything, and transmit into the dummy load to practice. Pass the Technician exam to get on the air!'),
    privTable(),
  );
  const study = h('div', { class: 'card' }, h('h3', {}, 'Study & exams'),
    h('p', { class: 'muted small' }, 'Real US exams are given by Volunteer Examiners: Technician 35 questions (26 to pass), General 35 (26), Extra 50 (37). Practice questions here follow the same topics. Every lesson Elmer gives you in-game is exam material too!'),
    ...ORDER.map((el) => {
      const E = EXAM[el];
      const passed = S.exams[el];
      const stats = studyStats(el);
      return h('div', { class: 'exam-row' },
        h('div', {}, h('b', {}, E.name), passed ? h('span', { class: 'badge ok' }, '✓ passed') : null,
          h('div', { class: 'muted tiny' }, `${POOL[el].length} questions in pool · studied ${stats.seen} · mastered ${stats.mastered}`)),
        h('div', { class: 'row' },
          h('button', { class: 'btn', onclick: () => flashcards(el) }, 'Study'),
          h('button', { class: 'btn', onclick: () => exam(el, false) }, 'Practice exam'),
          h('button', { class: 'btn primary', disabled: passed || !canTake(el), title: canTake(el) ? '' : 'Pass the previous element first', onclick: () => exam(el, true) }, passed ? 'Passed' : 'Take VE exam')));
    }),
  );
  const hist = h('div', { class: 'card' }, h('h3', {}, 'Exam history'),
    S.exams.history.length ? h('table', { class: 'tbl' }, h('tr', {}, h('th', {}, 'Date'), h('th', {}, 'Element'), h('th', {}, 'Type'), h('th', {}, 'Score'), h('th', {}, 'Result')),
      ...S.exams.history.slice(-12).reverse().map((x) => h('tr', {}, h('td', {}, new Date(x.t).toLocaleDateString()), h('td', {}, x.el), h('td', {}, x.real ? 'VE session' : 'practice'), h('td', {}, `${x.score}/${x.n}`), h('td', { class: x.pass ? 'ok' : 'bad' }, x.pass ? 'PASS' : 'fail'))))
      : h('p', { class: 'muted' }, 'No exams taken yet.'));
  root.append(h('div', { class: 'exam-grid' }, status, study, privGuide(), hist));
}

// What each licence class adds, in plain words.
const GIVES = {
  T: ['Entry licence: one 35-question exam, no Morse code.',
    'Every amateur privilege above 50 MHz: all of 6 m, 2 m, 1.25 m, 70 cm and the microwave bands, up to 1500 W. This is where local FM repeaters, simplex, satellites and the ISS are.',
    'A small slice of HF. On 10 m: CW, RTTY and data on 28.000–28.300 MHz and SSB voice on 28.300–28.500 MHz.',
    'CW only on parts of 80 m (3.525–3.600), 40 m (7.025–7.125) and 15 m (21.025–21.200 MHz).',
    'HF power is limited to 200 W PEP.',
    'Nothing on 160, 60, 30, 20, 17 or 12 m.'],
  G: ['Everything a Technician has, plus the Technician HF power cap is lifted (1500 W PEP; 200 W on 30 m).',
    'Voice, CW and data on every HF band: 160, 80, 60, 40, 30, 20, 17, 15, 12 and 10 m. This is the worldwide-contact licence.',
    'All of 160, 30, 17, 12 and 10 m, with nothing held back.',
    'On 80, 40, 20 and 15 m you get most of each band; the bottom 25 kHz of the CW/data part and the lower end of the phone part are reserved for Extra.'],
  E: ['Every US amateur frequency and mode. Nothing is held back.',
    'Adds the Extra-only segments on 80, 40, 20 and 15 m: the bottom 25 kHz of each (prime DX CW territory) and the lower phone segments (3.600–3.800, 7.125–7.175, 14.150–14.225 and 21.200–21.275 MHz).',
    'Eligible for the shortest (Group A) callsigns.'],
};
let guideLic = null;
function privGuide() {
  const lic = guideLic || S.license || 'T';
  const next = { T: 'G', G: 'E' };
  const rows = [];
  for (const b of BANDS) {
    const rs = privRanges(lic, b);
    if (!rs.length) { const need = ORDER.find((l) => privRanges(l, b).length); rows.push(h('tr', { class: 'none' }, h('td', {}, b.name), h('td', { colspan: 3 }, `No privileges. Needs ${licName(need)}.`))); continue; }
    rs.forEach((r, i) => rows.push(h('tr', { class: i < rs.length - 1 ? 'cont' : '' }, h('td', {}, i ? '' : h('b', {}, b.name)), h('td', { class: 'f' }, fmtRange(r.lo, r.hi)),
      h('td', { class: `m-${r.allow}` }, allowLabel(r.allow, b.name)), h('td', {}, `${powerLimit(lic, r.lo)} W`))));
  }
  const others = OTHER_HAM.map((o) => h('tr', { class: o.lic.includes(lic) ? '' : 'none' }, h('td', {}, h('b', {}, o.name)), h('td', {}, o.ranges), h('td', {}, o.lic.includes(lic) ? o.note : `No privileges. Needs ${licName(o.lic[0])}.`)));
  return h('div', { class: 'card priv-guide' },
    h('h3', {}, 'Where you can transmit'),
    h('p', { class: 'small' }, S.license ? `You hold ${licName()}. Pick a class to see exactly what it allows.` : 'You are unlicensed: you may listen on any frequency and transmit only into the dummy load. Pick a class to see exactly what it would allow.'),
    h('div', { class: 'seg' }, ...ORDER.map((l) => h('button', { class: l === lic ? 'active' : '', onclick: () => { guideLic = l; render(); } }, licName(l) + (l === S.license ? ' (yours)' : '')))),
    h('h4', {}, `What ${licName(lic)} gives you`),
    h('ul', { class: 'small' }, ...GIVES[lic].map((t) => h('li', {}, t)), next[lic] ? h('li', { class: 'muted' }, `Next step: ${licName(next[lic])}. Select it above to compare.`) : null),
    h('h4', {}, `${licName(lic)} transmit frequencies (MHz)`),
    h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('tr', {}, h('th', {}, 'Band'), h('th', {}, 'Frequencies'), h('th', {}, 'What you may send'), h('th', {}, 'Max power (PEP)')), ...rows)),
    h('h4', {}, 'Other amateur bands (real-world rules; not simulated for transmitting)'),
    h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('tr', {}, h('th', {}, 'Band'), h('th', {}, 'Frequencies'), h('th', {}, 'Rules')), ...others)),
    h('h4', {}, 'Rules that apply to every class'),
    h('ul', { class: 'small' },
      h('li', {}, 'Your whole signal must stay inside your segment, not just the dial frequency. SSB spreads about 3 kHz to one side of the dial (above it on USB, below on LSB), so stay 3 kHz inside the edge. FM needs about 8 kHz each side.'),
      h('li', {}, 'CW is allowed anywhere you have any privileges. Phone is allowed only in the phone segments.'),
      h('li', {}, 'On a repeater, it is your transmit frequency (receive frequency plus offset) that must be inside your privileges.'),
      h('li', {}, 'Use the minimum power needed, and give your callsign every 10 minutes and at the end of a contact.'),
      h('li', {}, 'Outside the amateur bands you may only listen. CB, FRS, GMRS, MURS, marine, aviation and public-safety channels are never legal with an amateur transceiver, whatever your licence class.'),
      h('li', {}, 'On the radio: the green bar under the band scope marks where you may use phone, blue is CW/data only, and the display shows TX OK or NO TX for the frequency and mode you are on.')),
    h('p', { class: 'muted tiny' }, 'US rules (FCC Part 97), simplified. Legacy Novice and Advanced classes are not shown. A simulated licence has no legal standing; check the current FCC rules or the ARRL band chart before transmitting on a real radio.'));
}

function privTable() {
  const rows = BANDS.map((b) => {
    const cell = (l) => {
      const segs = privilegeMap(l, b);
      if (!segs.length) return h('td', { class: 'np' }, '—');
      const ph = segs.some((s) => s.allow === 'ALL');
      return h('td', { class: ph ? 'ph' : 'cw' }, ph ? (segs.every((s) => s.allow === 'ALL') ? 'all modes' : 'CW + phone') : 'CW' + (segs.some((s) => s.allow === 'CWDATA') ? '/data' : ''));
    };
    return h('tr', {}, h('td', {}, b.name), cell('T'), cell('G'), cell('E'));
  });
  return h('table', { class: 'tbl priv' }, h('tr', {}, h('th', {}, 'Band'), h('th', { class: S.license === 'T' ? 'me' : '' }, 'Tech'), h('th', { class: S.license === 'G' ? 'me' : '' }, 'General'), h('th', { class: S.license === 'E' ? 'me' : '' }, 'Extra')), ...rows);
}

function studyStats(el) {
  S.study ||= {};
  const qs = POOL[el];
  let seen = 0, mastered = 0;
  for (const q of qs) { const s = S.study[q.id]; if (s) { seen++; if (s.ok >= 2 && s.ok > s.bad) mastered++; } }
  return { seen, mastered };
}

function flashcards(el) {
  S.study ||= {};
  const qs = POOL[el];
  // prioritise unseen and missed
  const score = (q) => { const s = S.study[q.id] || { ok: 0, bad: 0 }; return s.ok - s.bad * 2 + Math.random(); };
  let deck = [...qs].sort((a, b) => score(a) - score(b));
  let i = 0;
  const box = h('div', { class: 'quiz' });
  const show = () => {
    const q = deck[i % deck.length];
    const answers = shuffle(q.a.map((t, k) => ({ t, ok: k === 0 })));
    box.innerHTML = '';
    const exp = h('div', { class: 'explain', hidden: true }, h('b', {}, ''), q.exp);
    const next = h('button', { class: 'btn primary', hidden: true, onclick: () => { i++; show(); } }, 'Next →');
    box.append(h('div', { class: 'qmeta' }, `${EXAM[el].name} · ${q.sub} · card ${i + 1}`), h('div', { class: 'qtext' }, q.q),
      h('div', { class: 'answers' }, ...answers.map((a, k) => {
        const b = h('button', { class: 'ans' }, `${'ABCD'[k]}. ${a.t}`);
        b.onclick = () => {
          if (!exp.hidden) return;
          const s = (S.study[q.id] ||= { ok: 0, bad: 0 });
          a.ok ? s.ok++ : s.bad++;
          save();
          box.querySelectorAll('.ans').forEach((x, j) => x.classList.add(answers[j].ok ? 'right' : x === b ? 'wrong' : 'dim'));
          exp.hidden = false; next.hidden = false; next.focus();
        };
        return b;
      })), exp, next);
  };
  show();
  modal(h('div', {}, h('h2', {}, `Study: ${EXAM[el].name}`), box), { wide: true, onClose: render });
}

function exam(el, real) {
  const E = EXAM[el];
  const n = Math.min(E.n, POOL[el].length);
  const passMark = Math.ceil(n * E.pass / E.n);
  // draw across subelements like the real exam
  const qs = shuffle(POOL[el]).slice(0, n).map((q) => ({ ...q, answers: shuffle(q.a.map((t, k) => ({ t, ok: k === 0 }))), pick: null }));
  let i = 0;
  const box = h('div', { class: 'quiz' });
  const nav = h('div', { class: 'qnav' });
  const show = () => {
    const q = qs[i];
    box.innerHTML = '';
    box.append(h('div', { class: 'qmeta' }, `${real ? 'VE exam session' : 'Practice'} · Question ${i + 1} of ${n} · pass mark ${passMark}`), h('div', { class: 'qtext' }, q.q),
      h('div', { class: 'answers' }, ...q.answers.map((a, k) => h('button', { class: `ans ${q.pick === k ? 'picked' : ''}`, onclick: () => { q.pick = k; if (i < n - 1) { i++; } show(); } }, `${'ABCD'[k]}. ${a.t}`))),
      h('div', { class: 'row spread' },
        h('button', { class: 'btn', disabled: i === 0, onclick: () => { i--; show(); } }, '← Back'),
        h('span', { class: 'muted small' }, `${qs.filter((x) => x.pick != null).length}/${n} answered`),
        i < n - 1 ? h('button', { class: 'btn', onclick: () => { i++; show(); } }, 'Skip →') : h('button', { class: 'btn primary', onclick: grade }, 'Hand in answer sheet')));
    nav.innerHTML = '';
    qs.forEach((x, k) => nav.append(h('button', { class: `qdot ${x.pick != null ? 'done' : ''} ${k === i ? 'cur' : ''}`, onclick: () => { i = k; show(); } }, k + 1)));
  };
  let close;
  const grade = () => {
    if (qs.some((x) => x.pick == null) && !confirm('Some questions are unanswered. Hand in anyway?')) return;
    const score = qs.filter((x) => x.pick != null && x.answers[x.pick].ok).length;
    const pass = score >= passMark;
    S.study ||= {};
    for (const q of qs) { const s = (S.study[q.id] ||= { ok: 0, bad: 0 }); q.pick != null && q.answers[q.pick].ok ? s.ok++ : s.bad++; }
    S.exams.history.push({ t: Date.now(), el, real, score, n, pass });
    save();
    box.innerHTML = '';
    nav.innerHTML = '';
    box.append(h('h2', { class: pass ? 'ok' : 'bad' }, pass ? `PASS — ${score}/${n}` : `Not this time — ${score}/${n} (needed ${passMark})`));
    if (pass && real) grantLicense(el, box);
    box.append(h('h3', {}, 'Review'), ...qs.filter((q) => q.pick == null || !q.answers[q.pick].ok).map((q) => h('div', { class: 'review' },
      h('div', { class: 'qtext small' }, q.q), h('div', { class: 'ok small' }, '✓ ', q.a[0]), q.pick != null ? h('div', { class: 'bad small' }, '✘ ', q.answers[q.pick].t) : h('div', { class: 'muted small' }, '(unanswered)'), h('div', { class: 'explain small' }, q.exp))));
    if (score === n) box.append(h('p', {}, 'Perfect score!'));
  };
  show();
  close = modal(h('div', {}, h('h2', {}, `${real ? 'VE Exam' : 'Practice exam'}: ${E.name}`), nav, box), { wide: true, onClose: render });
}

function grantLicense(el, box) {
  S.exams[el] = true;
  const prev = S.license;
  S.license = el;
  let msg;
  if (!S.call) {
    S.call = newLicenseeCall(S.op.state, el);
    msg = `The FCC has issued your callsign: <b>${S.call}</b>`;
  } else msg = `Upgrade to ${licName(el)} is in the FCC database. You may sign "${S.call}/A${el === 'E' ? 'E' : 'G'}" until it appears… (in the sim it\'s instant).`;


  save();
  box.append(h('div', { class: 'good-box' }, h('div', { html: `${msg}` }),
    el === 'E' ? h('button', { class: 'btn', onclick: (e) => { S.call = newLicenseeCall(S.op.state, 'E'); save(); e.target.textContent = `New vanity call: ${S.call}`; bus.emit('license'); } }, 'Apply for a short Extra-class (Group A) callsign') : null));
  elmer('exam_pass', true);
  if (el === 'T') setTimeout(() => elmer('tech_hf', true), 2000);
  bus.emit('license');
}

export function sandboxLicense(el) {
  for (const e of ORDER) { S.exams[e] = true; if (e === el) break; }
  S.license = el;
  if (!S.call) S.call = newLicenseeCall(S.op.state, el);
  S.settings.sandbox = true;
  save();
  bus.emit('license');
  toast(`Sandbox: you now hold a ${licName(el)} license as ${S.call}.`, 'good');
}
