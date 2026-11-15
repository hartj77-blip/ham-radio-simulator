// Contest tab: pick an event, run it against the clock, get a checked score.
import { S, save, addXp } from './state.js';
import { h, toast, bus, modal, $ } from './util.js';
import { CONTESTS } from './data/contests.js';
import { world } from './world.js';
import { setContestBar } from './operating.js';
import { bandOf } from './data/bandplan.js';
import { elmer } from './elmer.js';

let root;
let setup = { id: 'fd', mode: 'MIXED', mins: 15, cls: '1D' };

export function initContestUI(el) { root = el; render(); bus.on('license', render); }

function render() {
  root.innerHTML = '';
  const c = world.contest;
  if (c) {
    root.append(h('div', { class: 'card' }, h('h3', {}, `🏆 ${c.def.name} in progress`),
      h('p', {}, 'Head to the Radio tab and make contacts! The logger switches to contest mode and the bands fill with contest stations.'),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => bus.emit('goto', 'radio') }, 'Go to radio →'), h('button', { class: 'btn warn', onclick: () => endContest() }, 'End contest now'))));
    return;
  }
  const defs = Object.values(CONTESTS);
  const pickBox = h('div', { class: 'contest-picks' }, ...defs.map((d) => h('div', { class: `contest-card ${setup.id === d.id ? 'sel' : ''}`, onclick: () => { setup.id = d.id; render(); } },
    h('h4', {}, d.name), h('p', { class: 'small' }, d.desc),
    h('div', { class: 'tiny muted' }, 'Best: ', bestScore(d.id)))));
  const modeSel = h('select', {}, ...['MIXED', 'CW', 'PHONE'].map((m) => h('option', { value: m, selected: setup.mode === m }, m === 'MIXED' ? 'Mixed (CW + phone)' : m)));
  modeSel.onchange = () => { setup.mode = modeSel.value; };
  const minSel = h('select', {}, ...[5, 10, 15, 30, 60].map((m) => h('option', { value: m, selected: setup.mins === m }, `${m} minutes`)));
  minSel.onchange = () => { setup.mins = +minSel.value; };
  const clsIn = h('input', { value: setup.cls, size: 4 });
  clsIn.oninput = () => { setup.cls = clsIn.value.toUpperCase(); };
  const start = h('button', { class: 'btn primary big', onclick: startContest }, '▶ Start contest');
  const scores = h('div', { class: 'card' }, h('h3', {}, '🥇 Your best scores'),
    ...defs.map((d) => h('div', {}, h('b', {}, d.name), (S.scores[d.id] || []).length ? h('table', { class: 'tbl' }, h('tr', {}, h('th', {}, 'Date'), h('th', {}, 'Mins'), h('th', {}, 'QSOs'), h('th', {}, 'Accuracy'), h('th', {}, 'Score')),
      ...(S.scores[d.id] || []).slice(0, 5).map((s) => h('tr', {}, h('td', {}, new Date(s.t).toLocaleDateString()), h('td', {}, s.mins), h('td', {}, s.valid), h('td', {}, `${s.acc}%`), h('td', {}, h('b', {}, s.score)))))
      : h('p', { class: 'muted small' }, 'Not entered yet.'))));
  root.append(h('div', { class: 'contest-grid' },
    h('div', { class: 'card' }, h('h3', {}, '📣 Enter a contest'), pickBox,
      h('div', { class: 'row wrap' }, h('label', {}, 'Mode ', modeSel), h('label', {}, 'Duration ', minSel), setup.id === 'fd' ? h('label', {}, 'Your FD class ', clsIn) : null),
      h('p', { class: 'muted small' }, 'How it works: Call CQ (F1) to RUN and pick calls out of the pileup, or tune around and SEARCH & POUNCE stations calling CQ. Copy the call and exchange into the logger. Your log is checked afterward: busted calls and wrong exchanges cost you, just like in real contests. Contesting is not permitted on 30/17/12 m (WARC bands).'),
      h('div', { class: 'kbd-help small' }, h('b', {}, 'Keys: '), 'F1 CQ · F2 exchange · F3 TU · F4 my call · F5 his call · F6 AGN? · Enter = ESM (does the right thing) · Ctrl+Enter = log · Esc = wipe'),
      S.license ? start : h('div', { class: 'issues' }, 'You need a license to enter contests. Pass the Technician exam (License tab) — or enable sandbox mode in Help.')),
    scores));
}

function bestScore(id) { const s = (S.scores[id] || [])[0]; return s ? `${s.score} pts (${s.valid} QSOs)` : '—'; }

function startContest() {
  const def = CONTESTS[setup.id];
  const runId = `${def.id}-${Date.now()}`;
  world.contest = { id: runId, def, mode: setup.mode, cls: /^\d{1,2}[A-F]$/.test(setup.cls) ? setup.cls : '1D', start: Date.now(), end: Date.now() + setup.mins * 60000, mins: setup.mins };
  world.repopulate();
  elmer('contest');
  bus.emit('contest');
  bus.emit('goto', 'radio');
  toast(`🏁 ${def.name} has started! ${setup.mins} minutes on the clock. Good luck!`, 'good');
  const b = bandOf(S.radio.freq);
  if (b && ['30m', '17m', '12m', '2m'].includes(b.name)) toast('You\'re on a band with no contest activity. Try 20 m, 40 m or 15 m.', 'warn');
}

export function contestTick() {
  const c = world.contest;
  if (!c) { setContestBar(''); return; }
  const left = Math.max(0, c.end - Date.now());
  const sc = score(c);
  const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
  const rate = sc.valid ? Math.round(sc.valid / Math.max(1, (Date.now() - c.start) / 3600000)) : 0;
  setContestBar(`<b>🏆 ${c.def.name}</b> <span class="timer ${left < 60000 ? 'bad' : ''}">⏱ ${m}:${String(s).padStart(2, '0')}</span> <span>QSOs ${sc.claimedQ}</span> <span>Pts ${sc.claimedPts}</span> <span>Mults ${sc.claimedMults}</span> <span>Claimed ${sc.claimed}</span> <span>Rate ${rate}/hr</span> <button class="btn small" id="end-contest">End</button>`);
  const b = document.getElementById('end-contest');
  if (b) b.onclick = () => endContest();
  if (left <= 0) endContest();
}

function qPoints(def, q, truth) {
  const cw = q.mode === 'CW';
  if (def.id === 'dx') {
    const cont = truth?.cont, country = truth?.country;
    if (!country) return 1;
    if (country === 'United States') return 0;
    return cont === 'NA' ? 2 : 3;
  }
  return cw ? 2 : 1;
}

function exchOk(def, q, t) {
  if (!t || !t.exch) return false;
  const e = q.exch || {};
  const norm = (x) => String(x || '').toUpperCase().replace(/^0+/, '');
  if (def.id === 'fd') return norm(e.cls) === norm(t.exch.cls) && norm(e.sec) === norm(t.exch.sec);
  if (def.id === 'dx') return norm(e.zone) === norm(t.exch.zone);
  return norm(e.st) === norm(t.exch.st);
}

export function score(c) {
  const def = c.def;
  const qs = S.log.filter((q) => q.contest === c.id);
  let claimedPts = 0, pts = 0, valid = 0, dupes = 0, nil = 0, badEx = 0, partial = 0;
  const multsClaimed = new Set(), mults = new Set();
  const multKey = (q, useTruth) => {
    const t = useTruth ? q.truth : null;
    if (def.id === 'dx') return [`Z${useTruth ? t?.zone : q.exch?.zone}`, `C${useTruth ? t?.country : q.call.slice(0, 2)}`];
    if (def.id === 'qp') return [`S${useTruth ? t?.exch?.st : q.exch?.st}`];
    return [];
  };
  const notes = [];
  for (const q of qs) {
    if (q.dupe) { dupes++; continue; }
    const p = qPoints(def, q, q.truth);
    claimedPts += p;
    multKey(q, false).forEach((k) => multsClaimed.add(k));
    if (q.status === 'nil') { nil++; pts -= p; notes.push(`${q.call}: not in their log (busted call?)`); continue; }
    if (q.status === 'partial') { partial++; notes.push(`${q.call}: QSO never completed`); continue; }
    if (!exchOk(def, q, q.truth)) { badEx++; notes.push(`${q.call}: wrong exchange (logged ${Object.values(q.exch || {}).join(' ')}, they sent ${q.truth?.exch ? Object.entries(q.truth.exch).filter(([k]) => !['cw', 'ph'].includes(k)).map(([, v]) => v).join(' ') : '?'})`); continue; }
    valid++; pts += p;
    multKey(q, true).forEach((k) => mults.add(k));
  }
  const mul = (set) => (def.id === 'fd' ? 2 : Math.max(1, set.size));
  const claimed = claimedPts * mul(multsClaimed);
  const final = Math.max(0, pts) * mul(mults);
  return { qs, claimedQ: qs.length, claimedPts, claimedMults: def.id === 'fd' ? '×2 pwr' : multsClaimed.size, claimed, valid, dupes, nil, badEx, partial, pts: Math.max(0, pts), mults: def.id === 'fd' ? '×2 (≤100 W)' : mults.size, final, notes };
}

export function endContest() {
  const c = world.contest;
  if (!c) return;
  world.contest = null;
  world.repopulate();
  bus.emit('contest');
  const sc = score(c);
  const mins = Math.max(1, Math.round((Math.min(Date.now(), c.end) - c.start) / 60000));
  const acc = sc.claimedQ ? Math.round(100 * sc.valid / sc.claimedQ) : 0;
  const entry = { t: Date.now(), score: sc.final, valid: sc.valid, mins, acc };
  (S.scores[c.def.id] ||= []).push(entry);
  S.scores[c.def.id].sort((a, b) => b.score - a.score);
  S.scores[c.def.id] = S.scores[c.def.id].slice(0, 10);
  addXp(Math.min(300, 10 + sc.final), 'contest');
  save();
  render();
  setContestBar('');
  modal(h('div', {},
    h('h2', {}, `🏁 ${c.def.name} — results`),
    h('div', { class: 'readouts' },
      h('div', {}, h('span', {}, 'Claimed'), h('b', {}, `${sc.claimed}`)),
      h('div', {}, h('span', {}, 'Checked score'), h('b', { class: 'ok' }, `${sc.final}`)),
      h('div', {}, h('span', {}, 'QSOs logged'), h('b', {}, sc.claimedQ)),
      h('div', {}, h('span', {}, 'Valid'), h('b', {}, sc.valid)),
      h('div', {}, h('span', {}, 'Points'), h('b', {}, sc.pts)),
      h('div', {}, h('span', {}, 'Multipliers'), h('b', {}, sc.mults)),
      h('div', {}, h('span', {}, 'Dupes'), h('b', {}, sc.dupes)),
      h('div', {}, h('span', {}, 'Busted / NIL'), h('b', { class: sc.nil ? 'bad' : '' }, sc.nil)),
      h('div', {}, h('span', {}, 'Wrong exchange'), h('b', { class: sc.badEx ? 'bad' : '' }, sc.badEx)),
      h('div', {}, h('span', {}, 'Log accuracy'), h('b', {}, `${acc}%`)),
    ),
    sc.notes.length ? h('div', {}, h('h3', {}, 'Log checking report (UBN)'), h('ul', { class: 'small' }, ...sc.notes.slice(0, 25).map((n) => h('li', {}, n)))) : h('p', {}, sc.claimedQ ? '✨ Clean log — no errors!' : 'No QSOs logged. Try calling CQ with F1, or tune for stations calling CQ.'),
    h('p', { class: 'muted small' }, 'Busted calls (NIL) cost a penalty equal to the QSO\'s points, like real log checking. Wrong exchanges score zero.'),
  ));
}
