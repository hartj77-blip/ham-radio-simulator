// Logbook: QSO list, awards progress (WAS / DXCC / WAC) and ADIF export.
import { S, save } from './state.js';
import { h, bus, download, toast } from './util.js';
import { STATES } from './data/world.js';

let root;
export function initLogbookUI(el) { root = el; render(); bus.on('logged', render); bus.on('license', render); }

function confirmed() { return S.log.filter((q) => q.status === 'confirmed' && !q.contest); }

function render() {
  root.innerHTML = '';
  const conf = S.log.filter((q) => q.status === 'confirmed');
  const states = new Set(conf.map((q) => q.truth?.state).filter(Boolean));
  const dxcc = new Set(conf.map((q) => q.truth?.country).filter(Boolean));
  const conts = new Set(conf.map((q) => q.truth?.cont).filter(Boolean));
  const awards = h('div', { class: 'card awards' }, h('h3', {}, 'Awards'),
    award('Worked All States (WAS)', states.size, 50),
    award('DXCC (100 countries)', dxcc.size, 100),
    award('Worked All Continents', conts.size, 6),
    h('div', { class: 'was-grid' }, ...STATES.map((s) => h('span', { class: `st ${states.has(s.abbr) ? 'got' : ''}`, title: s.name }, s.abbr))),
    dxcc.size ? h('p', { class: 'small' }, h('b', {}, 'Countries: '), [...dxcc].join(', ')) : null);
  const exp = h('button', { class: 'btn', onclick: exportAdif }, 'Export ADIF');
  const clr = h('button', { class: 'btn warn small', onclick: () => { if (confirm('Delete the entire logbook?')) { S.log = []; save(); render(); } } }, 'Clear log');
  const list = S.log.slice().reverse().slice(0, 300);
  const tbl = h('table', { class: 'tbl log' },
    h('tr', {}, ...['UTC', 'Call', 'Band', 'kHz', 'Mode', 'Sent', 'Rcvd', 'Info', 'Status'].map((t) => h('th', {}, t))),
    ...list.map((q) => h('tr', { class: q.dupe ? 'dupe' : '' },
      h('td', {}, q.time.slice(5, 16).replace('T', ' ')), h('td', {}, h('b', {}, q.call)), h('td', {}, q.band), h('td', {}, q.freq), h('td', {}, q.mode),
      h('td', {}, q.exch ? '' : q.rstS), h('td', {}, q.exch ? Object.values(q.exch).join(' ') : q.rstR),
      h('td', { class: 'small' }, q.exch ? (q.contest || '').split('-')[0].toUpperCase() : [q.name, q.qth].filter(Boolean).join(', ') || (q.truth?.country || '')),
      h('td', { class: q.status === 'confirmed' ? 'ok' : 'bad' }, q.dupe ? 'dupe' : q.status === 'confirmed' ? '✓ QSL' : q.status === 'partial' ? 'incomplete' : 'NIL'))));
  root.append(h('div', { class: 'log-grid' },
    h('div', { class: 'card' }, h('div', { class: 'row spread' }, h('h3', {}, `Logbook (${S.log.length} QSOs)`), h('div', { class: 'row' }, exp, clr)),
      S.log.length ? tbl : h('p', { class: 'muted' }, 'No contacts yet. Make your first contact on the Radio page.')),
    awards));
}

function award(name, n, of) {
  return h('div', { class: 'award' }, h('div', { class: 'row spread' }, h('span', {}, name), h('b', {}, `${n}/${of}`)),
    h('div', { class: 'bar' }, h('div', { style: { width: `${Math.min(100, (n / of) * 100)}%` } })));
}

function adifField(k, v) { v = String(v ?? ''); return v ? `<${k}:${v.length}>${v} ` : ''; }

function exportAdif() {
  if (!S.log.length) return toast('Nothing to export yet.', 'warn');
  let out = `Ham Radio Simulator log export\n<ADIF_VER:5>3.1.4 <PROGRAMID:13>HamShack-Sim <EOH>\n`;
  for (const q of S.log) {
    const d = q.time.replace(/[-:]/g, '');
    out += adifField('CALL', q.call) + adifField('QSO_DATE', d.slice(0, 8)) + adifField('TIME_ON', d.slice(9, 13)) + adifField('BAND', q.band.toUpperCase())
      + adifField('FREQ', (q.freq / 1000).toFixed(4)) + adifField('MODE', q.mode) + adifField('RST_SENT', q.rstS || q.exch?.rst) + adifField('RST_RCVD', q.rstR || q.exch?.rst)
      + adifField('NAME', q.name) + adifField('QTH', q.qth) + adifField('STATION_CALLSIGN', S.call) + adifField('COMMENT', q.contest ? `contest ${q.contest.split('-')[0]}` : '') + adifField('SRX_STRING', q.exch ? Object.values(q.exch).join(' ') : '') + '<EOR>\n';
  }
  download(`${S.call || 'swl'}-hamshack.adi`, out);
}
