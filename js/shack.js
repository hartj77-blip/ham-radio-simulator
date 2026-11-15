// The Shack: wire up the station (power, coax, ground, mic, key).
import { S, save, addXp } from './state.js';
import { h, toast, bus, $ } from './util.js';
import { elmer } from './elmer.js';
import { audio } from './audio.js';

const DEV = {
  psu: { x: 30, y: 290, w: 180, h: 120, label: '13.8 V DC · 30 A power supply' },
  rig: { x: 240, y: 220, w: 330, h: 160, label: 'HF + 6 m + 2 m transceiver' },
  swr: { x: 600, y: 255, w: 130, h: 95, label: 'SWR / watt meter' },
  atu: { x: 760, y: 245, w: 165, h: 105, label: 'Manual antenna tuner' },
  dl: { x: 780, y: 440, w: 120, h: 52, label: 'Dummy load 50 Ω' },
  arr: { x: 952, y: 135, w: 44, h: 80, label: 'Lightning arrestor' },
  gb: { x: 200, y: 520, w: 520, h: 14, label: 'Copper ground bus → ground rod' },
  mic: { x: 470, y: 430, w: 44, h: 64, label: 'Mic' },
  key: { x: 570, y: 440, w: 80, h: 40, label: 'Paddle' },
};

export const PORTS = [
  { id: 'psu_pos', dev: 'psu', x: 150, y: 320, t: 'post', pol: '+', label: '+' },
  { id: 'psu_neg', dev: 'psu', x: 185, y: 320, t: 'post', pol: '-', label: '−' },
  { id: 'psu_gnd', dev: 'psu', x: 185, y: 395, t: 'gnd', label: 'GND' },
  { id: 'rig_red', dev: 'rig', x: 262, y: 395, t: 'lead', pol: '+', label: 'DC red' },
  { id: 'rig_blk', dev: 'rig', x: 300, y: 395, t: 'lead', pol: '-', label: 'DC blk' },
  { id: 'rig_gnd', dev: 'rig', x: 345, y: 395, t: 'gnd', label: 'GND' },
  { id: 'rig_key', dev: 'rig', x: 395, y: 395, t: 'keyjack', label: 'KEY' },
  { id: 'rig_ant', dev: 'rig', x: 540, y: 395, t: 'coax', label: 'ANT' },
  { id: 'rig_mic', dev: 'rig', x: 530, y: 345, t: 'micjack', label: 'MIC' },
  { id: 'swr_tx', dev: 'swr', x: 618, y: 365, t: 'coax', label: 'TX' },
  { id: 'swr_ant', dev: 'swr', x: 712, y: 365, t: 'coax', label: 'ANT' },
  { id: 'atu_in', dev: 'atu', x: 780, y: 365, t: 'coax', label: 'TX IN' },
  { id: 'atu_gnd', dev: 'atu', x: 842, y: 365, t: 'gnd', label: 'GND' },
  { id: 'atu_out', dev: 'atu', x: 905, y: 365, t: 'coax', label: 'ANT' },
  { id: 'dl_in', dev: 'dl', x: 772, y: 466, t: 'coax', label: 'IN' },
  { id: 'arr_in', dev: 'arr', x: 960, y: 228, t: 'coax', label: 'IN' },
  { id: 'arr_gnd', dev: 'arr', x: 990, y: 228, t: 'gnd', label: 'GND' },
  ...[0, 1, 2, 3, 4, 5].map((i) => ({ id: `gb${i}`, dev: 'gb', x: 240 + i * 85, y: 527, t: 'gbus', label: '' })),
  { id: 'mic_plug', dev: 'mic', x: 492, y: 424, t: 'micplug', label: '' },
  { id: 'key_plug', dev: 'key', x: 610, y: 434, t: 'keyplug', label: '' },
];
const P = Object.fromEntries(PORTS.map((p) => [p.id, p]));

function compatible(a, b) {
  if (a.dev === b.dev) return 'Both ends are on the same device.';
  const pair = [a.t, b.t].sort().join('|');
  const ok = { 'coax|coax': 1, 'lead|post': 1, 'gbus|gnd': 1, 'gnd|gnd': 1, 'micjack|micplug': 1, 'keyjack|keyplug': 1 };
  if (ok[pair]) return null;
  if (a.t === 'coax' || b.t === 'coax') return 'That\'s an RF connector (SO-239) — it takes a PL-259 coax jumper, which only connects to another RF connector.';
  if (a.t === 'lead' || b.t === 'lead' || a.t === 'post' || b.t === 'post') return 'The radio\'s DC power leads go to the power supply\'s binding posts.';
  return 'Those connectors don\'t fit together.';
}

const partners = (id) => S.shack.conn.filter((c) => c.includes(id)).map((c) => (c[0] === id ? c[1] : c[0]));
const connected = (a, b) => S.shack.conn.some((c) => c.includes(a) && c.includes(b));
const toBus = (id) => partners(id).some((p) => p.startsWith('gb')) || partners(id).some((p) => p !== id && P[p].t === 'gnd' && partners(p).some((q) => q.startsWith('gb')));

export function rigStatus() {
  const sh = S.shack;
  const dcOK = connected('rig_red', 'psu_pos') && connected('rig_blk', 'psu_neg');
  const dcRev = connected('rig_red', 'psu_neg') || connected('rig_blk', 'psu_pos');
  const powered = sh.psuOn && sh.rigOn && dcOK && !sh.fuseBlown;
  // follow the RF path
  const path = [];
  let cur = 'rig_ant', end = 'open', reversedMeter = false, hasMeter = false, hasTuner = false;
  const seen = new Set();
  for (let i = 0; i < 8; i++) {
    const nx = partners(cur)[0];
    if (!nx || seen.has(nx)) break;
    seen.add(nx); path.push(nx);
    if (nx === 'arr_in') { end = 'antenna'; break; }
    if (nx === 'dl_in') { end = 'dummy'; break; }
    if (nx === 'swr_tx') { hasMeter = true; cur = 'swr_ant'; continue; }
    if (nx === 'swr_ant') { hasMeter = true; reversedMeter = true; cur = 'swr_tx'; continue; }
    if (nx === 'atu_in') { hasTuner = true; cur = 'atu_out'; continue; }
    if (nx === 'atu_out') { hasTuner = true; cur = 'atu_in'; continue; }
    break;
  }
  const issues = [];
  if (!dcOK) issues.push(dcRev ? '⚠ DC power leads are connected with reversed polarity!' : 'Connect the radio\'s DC leads to the power supply (red → +, black → −).');
  if (sh.fuseBlown) issues.push('The radio\'s fuse is blown. Fix the wiring and replace it.');
  if (end === 'open') issues.push('No antenna or dummy load is connected to the radio\'s ANT jack.');
  if (end === 'antenna' && !S.antenna.built) issues.push('The wall feedthrough goes outside — but no antenna is installed yet (Antenna tab).');
  if (!toBus('rig_gnd')) issues.push('Bond the radio\'s GND terminal to the ground bus.');
  if (!toBus('arr_gnd')) issues.push('The lightning arrestor isn\'t grounded.');
  if (hasTuner && !toBus('atu_gnd')) issues.push('Ground the tuner chassis too.');
  if (!connected('rig_mic', 'mic_plug')) issues.push('Plug in the microphone (needed for voice).');
  if (!connected('rig_key', 'key_plug')) issues.push('Plug in the CW paddle (needed for Morse).');
  if (reversedMeter) issues.push('The SWR meter is connected backwards (TX/ANT swapped) — forward and reflected readings will be swapped.');
  if (!sh.psuOn) issues.push('Turn on the power supply.');
  if (!sh.rigOn) issues.push('Press the radio\'s POWER button.');
  return {
    powered, dcOK, dcRev, end, hasMeter, hasTuner, reversedMeter,
    grounded: toBus('rig_gnd'), arrGrounded: toBus('arr_gnd'),
    mic: connected('rig_mic', 'mic_plug'), key: connected('rig_key', 'key_plug'), issues,
    antennaOk: end === 'antenna' && S.antenna.built,
  };
}

let root, svg, sel = null, statusBox;

export function initShackUI(el) {
  root = el;
  render();
  bus.on('antenna', () => renderStatus());
}

function checkPowerUp() {
  const sh = S.shack;
  if (!(sh.psuOn && sh.rigOn)) return;
  const st = rigStatus();
  if (st.dcRev && !sh.fuseBlown) {
    sh.fuseBlown = true; sh.rigOn = false; S.stats.fuses++; save();
    audio.beep(120, 0.15, 0.4);
    toast('💥 <b>POP!</b> The radio\'s inline fuse blew. Reverse polarity!', 'bad');
    elmer('fuse_blown', true);
  } else if (st.powered) {
    audio.beep(1200, 0.05, 0.1);
    if (!S.tips.includes('shack_on')) { S.tips.push('shack_on'); addXp(15, 'station on the air'); }
  }
}

function render() {
  root.innerHTML = '';
  svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 1040 560');
  svg.classList.add('shack-svg');
  statusBox = h('div', { class: 'card shack-status' });
  const tools = h('div', { class: 'row' },
    h('button', { class: 'btn', onclick: () => { if (confirm('Disconnect every cable?')) { S.shack.conn = []; S.shack.rigOn = false; save(); draw(); } } }, 'Unplug everything'),
    h('button', { class: 'btn', title: 'Skip the wiring lesson', onclick: autoWire }, '⚡ Auto-wire (skip lesson)'),
  );
  root.append(h('div', { class: 'shack-grid' },
    h('div', { class: 'card' }, h('div', { class: 'row spread' }, h('h3', {}, '🔌 Wire up your station'), tools),
      h('p', { class: 'muted small' }, 'Click a connector, then click where the cable should go. Click a cable to unplug it. Coax runs from the radio\'s ANT jack through optional meter/tuner to the wall feedthrough (antenna) or the dummy load.'),
      svg),
    statusBox));
  draw();
}

export function wireStation() { autoWire(); }
function autoWire() {
  S.shack.conn = [['rig_red', 'psu_pos'], ['rig_blk', 'psu_neg'], ['rig_ant', 'swr_tx'], ['swr_ant', 'atu_in'], ['atu_out', 'arr_in'],
    ['rig_gnd', 'gb0'], ['atu_gnd', 'gb3'], ['arr_gnd', 'gb5'], ['psu_gnd', 'gb1'], ['rig_mic', 'mic_plug'], ['rig_key', 'key_plug']];
  S.shack.psuOn = true; S.shack.rigOn = true; S.shack.fuseBlown = false; S.shack.autoWired = true;
  save(); if (svg) draw(); bus.emit('shack');
}

function clickPort(id) {
  const p = P[id];
  if (!sel) { sel = id; draw(); return; }
  if (sel === id) { sel = null; draw(); return; }
  const a = P[sel], b = p;
  const err = compatible(a, b);
  if (err) { toast(err, 'warn'); sel = null; draw(); return; }
  const busy = [a, b].find((x) => partners(x.id).length && !x.id.startsWith('gb'));
  if (busy) { toast(`${DEV[busy.dev].label} ${busy.label} already has a cable. Unplug it first.`, 'warn'); sel = null; draw(); return; }
  S.shack.conn.push([a.id, b.id]);
  sel = null; save(); audio.click();
  // lessons
  const pair = [a.id, b.id];
  if (pair.includes('rig_red') || pair.includes('rig_blk')) elmer('psu_polarity');
  if ((a.t === 'gnd' || a.t === 'gbus') && (b.t === 'gnd' || b.t === 'gbus')) elmer('grounding');
  if (pair.includes('arr_in')) elmer('arrestor');
  if (pair.includes('dl_in')) elmer('dummy_load');
  if (pair.includes('atu_in') || pair.includes('atu_out')) elmer('atu');
  draw(); bus.emit('shack');
}

const NS = 'http://www.w3.org/2000/svg';
const s = (tag, attrs, text) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; return e; };

function draw() {
  svg.innerHTML = '';
  svg.append(s('rect', { x: 0, y: 0, width: 1040, height: 560, class: 'shack-bg' }));
  svg.append(s('rect', { x: 10, y: 410, width: 930, height: 18, class: 'desk' }));
  svg.append(s('line', { x1: 945, y1: 0, x2: 945, y2: 560, class: 'wall' }));
  svg.append(s('text', { x: 1000, y: 30, class: 'svgt', 'text-anchor': 'middle' }, 'OUTSIDE'));
  svg.append(s('path', { d: 'M996 175 C 1030 175 1020 80 1035 40', class: 'coax-out' }));
  svg.append(s('text', { x: 1010, y: 300, class: 'svgt small', 'text-anchor': 'middle', transform: 'rotate(90 1010 300)' }, S.antenna.built ? 'feedline to antenna ✓' : 'feedline (no antenna up)'));
  svg.append(s('path', { d: 'M720 527 L 940 527 L 940 556', class: 'gnd-wire' }));
  svg.append(s('text', { x: 860, y: 550, class: 'svgt small' }, '⏚ ground rod'));
  for (const [k, d] of Object.entries(DEV)) {
    const g = s('g', { class: `dev dev-${k}` });
    g.append(s('rect', { x: d.x, y: d.y, width: d.w, height: d.h, rx: 6 }));
    g.append(s('text', { x: d.x + 6, y: d.y + 16, class: 'devlabel' }, d.label));
    svg.append(g);
  }
  // rig front panel details
  const st = rigStatus();
  const rigOnBtn = s('g', { class: 'btn-svg', style: 'cursor:pointer' });
  rigOnBtn.append(s('circle', { cx: 268, cy: 250, r: 13, class: S.shack.rigOn ? 'pwr on' : 'pwr' }));
  rigOnBtn.append(s('text', { x: 284, y: 255, class: 'svgt small' }, 'POWER'));
  rigOnBtn.onclick = () => { S.shack.rigOn = !S.shack.rigOn; save(); checkPowerUp(); draw(); bus.emit('shack'); };
  svg.append(rigOnBtn);
  svg.append(s('rect', { x: 340, y: 240, width: 160, height: 46, rx: 4, class: st.powered ? 'lcd on' : 'lcd' }));
  svg.append(s('text', { x: 350, y: 270, class: 'lcdtxt' }, st.powered ? (S.radio.freq / 1e6).toFixed(3) + ' ' + S.radio.mode : ''));
  svg.append(s('circle', { cx: 530, cy: 270, r: 26, class: 'knob' }));
  // psu switch + meter
  const sw = s('g', { style: 'cursor:pointer' });
  sw.append(s('rect', { x: 45, y: 345, width: 40, height: 24, rx: 4, class: S.shack.psuOn ? 'sw on' : 'sw' }));
  sw.append(s('text', { x: 92, y: 362, class: 'svgt small' }, S.shack.psuOn ? 'ON' : 'OFF'));
  sw.onclick = () => { S.shack.psuOn = !S.shack.psuOn; save(); checkPowerUp(); draw(); bus.emit('shack'); };
  svg.append(sw);
  svg.append(s('text', { x: 45, y: 335, class: 'svgt small' }, S.shack.psuOn ? `${st.powered ? '13.8 V  2.1 A' : '13.8 V  0.0 A'}` : '—'));
  svg.append(s('text', { x: 795, y: 300, class: 'svgt small' }, 'TUNE    LOAD'));
  svg.append(s('circle', { cx: 808, cy: 320, r: 14, class: 'knob' })); svg.append(s('circle', { cx: 870, cy: 320, r: 14, class: 'knob' }));
  svg.append(s('path', { d: 'M620 330 A 45 45 0 0 1 710 330', class: 'meter-arc' }));
  svg.append(s('line', { id: 'swr-needle', x1: 665, y1: 335, x2: 628, y2: 305, stroke: '#ff5252', 'stroke-width': 2 }));
  svg.append(s('text', { id: 'swr-read', x: 640, y: 345, class: 'svgt small' }, ''));
  // window on the wall + ON AIR sign
  svg.append(s('rect', { x: 620, y: 40, width: 150, height: 110, rx: 4, fill: '#0f2236', stroke: '#6b5a48', 'stroke-width': 6 }));
  svg.append(s('line', { x1: 695, y1: 40, x2: 695, y2: 150, stroke: '#6b5a48', 'stroke-width': 4 }));
  svg.append(s('path', { d: 'M625 140 Q 660 110 700 128 T 765 118 L 765 145 L 625 145 Z', fill: '#1d3a28' }));
  svg.append(s('line', { x1: 640, y1: 132, x2: 750, y2: 70, stroke: '#d9a441', 'stroke-width': 1.2 }));
  const oa = s('g', { id: 'onair', class: 'onair' });
  oa.append(s('rect', { x: 380, y: 40, width: 120, height: 34, rx: 6 }));
  oa.append(s('text', { x: 400, y: 63 }, 'ON THE AIR'));
  svg.append(oa);
  // desk lamp glow
  svg.append(s('circle', { cx: 160, cy: 230, r: 60, fill: 'rgba(255,210,120,0.06)' }));
  // fuse holder on red lead
  svg.append(s('rect', { x: 255, y: 440, width: 22, height: 10, rx: 3, class: S.shack.fuseBlown ? 'fuse blown' : 'fuse' }));
  svg.append(s('text', { x: 252, y: 465, class: 'svgt small' }, S.shack.fuseBlown ? 'FUSE ✗' : 'fuse'));

  // cables
  for (const c of S.shack.conn) {
    const a = P[c[0]], b = P[c[1]];
    const kind = a.t === 'coax' ? 'coax' : a.t === 'lead' || a.t === 'post' ? ((a.t === 'lead' ? a : b).pol === '+' ? 'dcred' : 'dcblk') : a.t === 'gnd' || a.t === 'gbus' ? 'gndc' : 'cord';
    const sag = Math.max(40, Math.abs(a.x - b.x) * 0.25);
    const path = s('path', { d: `M${a.x} ${a.y} C ${a.x} ${a.y + sag}, ${b.x} ${b.y + sag}, ${b.x} ${b.y}`, class: `cable ${kind}` });
    path.onclick = () => { S.shack.conn = S.shack.conn.filter((x) => x !== c); save(); audio.click(); draw(); bus.emit('shack'); };
    path.append(s('title', {}, 'Click to unplug'));
    svg.append(path);
  }
  for (const p of PORTS) {
    const used = partners(p.id).length > 0;
    const g = s('g', { class: `port t-${p.t}${sel === p.id ? ' sel' : ''}${used ? ' used' : ''}`, style: 'cursor:pointer' });
    g.append(s('circle', { cx: p.x, cy: p.y, r: p.t === 'gbus' ? 7 : 9 }));
    if (p.pol) g.append(s('text', { x: p.x, y: p.y + 4, 'text-anchor': 'middle', class: 'pol' }, p.pol === '+' ? '+' : '−'));
    if (p.label) g.append(s('text', { x: p.x, y: p.y + (p.y > 400 && p.dev !== 'dl' ? 24 : -14), 'text-anchor': 'middle', class: 'plabel' }, p.label));
    g.append(s('title', {}, `${DEV[p.dev].label}: ${p.label || 'connector'}`));
    g.onclick = (e) => { e.stopPropagation(); clickPort(p.id); };
    svg.append(g);
  }
  renderStatus();
}

function renderStatus() {
  if (!statusBox) return;
  const st = rigStatus();
  statusBox.innerHTML = '';
  const item = (ok, txt) => h('li', { class: ok ? 'ok' : 'todo' }, ok ? '✅ ' : '⬜ ', txt);
  statusBox.append(...[
    h('h3', {}, 'Station checklist'),
    h('ul', { class: 'checklist' },
      item(st.dcOK, 'DC power: red → +, black → −'),
      item(st.end !== 'open', `RF path: ${st.end === 'antenna' ? 'radio → antenna feedthrough' : st.end === 'dummy' ? 'radio → dummy load' : 'nothing connected'}${st.hasMeter ? ' (via SWR meter)' : ''}${st.hasTuner ? ' (via tuner)' : ''}`),
      item(st.antennaOk, 'Antenna installed outside'),
      item(st.grounded, 'Radio bonded to ground bus'),
      item(st.arrGrounded, 'Lightning arrestor grounded'),
      item(st.mic, 'Microphone plugged in'),
      item(st.key, 'Paddle plugged in'),
      item(st.powered, 'Power supply ON and radio ON'),
    ),
    st.issues.length ? h('div', { class: 'issues' }, h('b', {}, 'Next: '), st.issues[0]) : h('div', { class: 'good-box' }, '🎉 Station is ready. Head to the Radio tab!'),
    S.shack.fuseBlown ? h('button', { class: 'btn warn', onclick: () => {
      if (rigStatus().dcRev) return toast('Fix the reversed polarity first, or the new fuse will blow too!', 'bad');
      S.shack.fuseBlown = false; save(); toast('Fuse replaced with the same 25 A rating. 👍', 'good'); draw();
    } }, '🔧 Replace fuse') : null,
  ].filter(Boolean));
}

// Live meters / ON AIR light (called from the main loop).
export function shackTick(tx, effSwr) {
  const oa = document.getElementById('onair');
  if (!oa || !oa.isConnected) return;
  oa.classList.toggle('on', !!tx.active);
  const n = document.getElementById('swr-needle'), rd = document.getElementById('swr-read');
  const frac = tx.active ? Math.min(1, Math.sqrt((tx.keyed ? tx.watts : 0) / 100)) : 0;
  const a = Math.PI * (1 - frac);
  n.setAttribute('x2', (665 + Math.cos(a) * 40).toFixed(1));
  n.setAttribute('y2', (335 - Math.sin(a) * 40).toFixed(1));
  rd.textContent = tx.active ? `${Math.round(tx.watts)}W  SWR ${tx.swr > 50 ? '∞' : tx.swr.toFixed(1)}` : '';
}
