// World view: everything your radio could hear, sorted by what it's FOR. Toggle each kind of
// service on and off, switch between your local area and the whole world, and tune with a click.
import { S, save } from './state.js';
import { h, bus, hashStr } from './util.js';
import { world, player, BEACON_SITES } from './world.js';
import { RW, TIME_STATIONS, WX_CHANNELS, HEAR, wantBroadcast, wantAirports } from './realworld.js';
import { distanceKm, dayFactor, simDate } from './propagation.js';
import { stateBy } from './data/world.js';
import { net } from './net.js';
import { getLand } from './map.js';
import { rigRx } from './rigs.js';
import { bandOf } from './data/bandplan.js';

// Kinds of radio service, with what they're used for.
export const KINDS = {
  hamhf: { label: 'Amateur HF', icon: '', col: '#ffb347', range: 'world', use: 'Hobby, DX, contests and emergency nets. 1.8–54 MHz, SSB/CW/digital. Long distance via the ionosphere.' },
  hamvhf: { label: 'Amateur VHF & repeaters', icon: '', col: '#5ee08a', range: 'local', use: 'Local ragchews, nets, ARES/RACES emergency comms. 2 m FM through repeaters (offset + CTCSS tone).' },
  beacon: { label: 'Propagation beacons', icon: '', col: '#c792ea', range: 'world', use: 'NCDXF/IARU beacons rotate through 5 bands every 3 minutes — hear one and you know the band is open to that region.' },
  time: { label: 'Time & frequency', icon: '', col: '#e8e8e8', range: 'world', use: 'NIST WWV/WWVH: atomic-clock time, frequency standard, and space-weather bulletins at :18 / :45.' },
  bcam: { label: 'AM broadcast', icon: '', col: '#4fc3f7', range: 'local', use: 'News, talk, sports. 530–1700 kHz: groundwave by day, skywave hundreds of km at night.' },
  bcfm: { label: 'FM broadcast', icon: '', col: '#29b6f6', range: 'local', use: 'Music and public radio, 88–108 MHz wide FM. Line-of-sight, ~50–100 km.' },
  air: { label: 'Aviation', icon: '', col: '#ff7a6b', range: 'local', use: 'Tower, ground, approach and ATIS (recorded weather). AM, 108–137 MHz. 121.5 MHz is the emergency (guard) frequency.' },
  wx: { label: 'Weather & alerts', icon: '', col: '#ffd54f', range: 'local', use: 'NOAA Weather Radio: continuous forecasts and the 1050 Hz alert tone for warnings. 162.400–162.550 MHz.' },
  ems: { label: 'Public safety', icon: '', col: '#ef5350', range: 'local', use: 'HEAR ambulance-to-hospital channel (155.340). Most police and fire radio is now digital or encrypted.' },
  players: { label: 'Real players', icon: '', col: '#ffffff', range: 'world', use: 'Other people playing right now. Same band + open path = you can talk.' },
};
const off = (p, km, seed) => { const a = (seed % 360) * Math.PI / 180; return { lat: p.lat + Math.cos(a) * km / 111, lon: p.lon + Math.sin(a) * km / (111 * Math.cos(p.lat * Math.PI / 180)) }; };

// Everything on the air, as {kind, name, f, mode, lat, lon, note}
export function catalog() {
  const me = player(), out = [];
  const add = (kind, o) => out.push({ kind, ...o, km: distanceKm(me, o) });
  for (const st of world.stations) {
    if (!st.op?.lat || st.role === 'caller' || st.role === 'peer') continue;
    const b = bandOf(st.freq);
    const kind = st.role === 'beacon' ? 'beacon' : !b ? null : b.name === '2m' ? 'hamvhf' : 'hamhf';
    if (!kind || (kind === 'hamvhf' && st.role === 'repeater')) continue;
    add(kind, { name: st.op.call, f: st.freq, mode: st.mode === 'SSB' ? st.sb : st.mode, lat: st.op.lat, lon: st.op.lon, note: `${st.op.qth || st.op.country || ''}${st.role === 'cq' ? ' · calling CQ' : ''}` });
  }
  if (!out.some((x) => x.kind === 'beacon')) for (const b of BEACON_SITES) add('beacon', { name: b.call, f: 14.1e6, mode: 'CW', lat: b.lat, lon: b.lon, note: '14.100 / 18.110 / 21.150 / 24.930 / 28.200 MHz' });
  const rp = off(me, 18, hashStr(S.op.state || 'KS'));
  add('hamvhf', { name: `${S.local?.rpt || 'Local'} repeater`, f: 146.94e6, mode: 'FM', lat: rp.lat, lon: rp.lon, note: '−600 kHz, 100.0 Hz tone', rpt: true });
  add('hamvhf', { name: '2 m simplex calling', f: 146.52e6, mode: 'FM', ...off(me, 4, 77), note: 'national calling frequency' });
  for (const t of TIME_STATIONS) add('time', { name: `${t.call} ${t.f / 1e6} MHz`, f: t.f, mode: 'AM', lat: t.lat, lon: t.lon, note: `${t.kw} kW` });
  for (const b of RW.broadcast || []) add(b.mode === 'AM' ? 'bcam' : 'bcfm', { name: b.name, f: b.f, mode: b.mode === 'WFM' ? 'WFM' : 'AM', lat: b.lat, lon: b.lon, note: b.state || '' });
  for (const a of RW.airports || []) for (const fr of a.freqs.filter((x) => /ATIS|TWR|GND|APP|DEP|CTAF|UNIC|AWOS|ASOS/i.test(x.type)).slice(0, 4)) add('air', { name: `${a.ident} ${fr.type}`, f: Math.round(fr.mhz * 1e6), mode: 'AM', lat: a.lat, lon: a.lon, note: a.name });
  add('air', { name: 'Guard (emergency)', f: 121.5e6, mode: 'AM', ...me, note: 'monitored by all aircraft' });
  const wxp = off(me, 35, hashStr(RW.nws?.office || 'NWS'));
  add('wx', { name: `NOAA Weather Radio${RW.nws?.office ? ` (${RW.nws.office})` : ''}`, f: WX_CHANNELS[hashStr(RW.nws?.office || 'NWS') % 7], mode: 'FM', ...wxp, note: RW.nws?.alerts?.length ? `${RW.nws.alerts[0].event}` : 'forecast & alerts' });
  add('ems', { name: 'HEAR hospital channel', f: HEAR, mode: 'FM', ...off(me, 8, 200), note: 'ambulance ↔ hospital' });
  for (const e of net.roster || []) { const st = stateBy(e.state); if (st) add('players', { name: e.call, f: e.freq, mode: e.mode, lat: st.lat, lon: st.lon, note: `${st.name}${e.tx ? ' · talking' : ''}`, roster: e }); }
  return out;
}

let root, cv, list, hoverPts = [];
const V = () => (S.wv ||= { on: Object.fromEntries(Object.keys(KINDS).map((k) => [k, !['hamhf'].includes(k)])), scale: 'local' });

export function initWorldView(el) {
  root = el;
  render();
  bus.on('realworld', () => { if (!root.hidden) renderList(); });
  bus.on('roster', () => { if (!root.hidden) renderList(); });
  bus.on('band', () => { if (!root.hidden) renderList(); });
  setInterval(() => { if (root.offsetParent && !document.hidden) draw(); }, 1000);
}

function render() {
  const v = V();
  root.innerHTML = '';
  cv = h('canvas', { class: 'wv-map', title: 'Click a marker to tune' });
  cv.addEventListener('click', (e) => { const b = cv.getBoundingClientRect(); const x = e.clientX - b.left, y = e.clientY - b.top; let best = null, bd = 14; for (const p of hoverPts) { const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = p.it; } } if (best) tune(best); });
  list = h('div', { class: 'wv-list' });
  root.append(h('div', { class: 'card wv-card' },
    h('div', { class: 'row spread wrap' }, h('h3', {}, 'World view — what\'s on the air, by use'),
      h('div', { class: 'row' }, ...[['local', 'My area'], ['world', 'World']].map(([k, l]) => h('button', { class: `rbtn ${v.scale === k ? 'active' : ''}`, onclick: () => { v.scale = k; save(); render(); } }, l)))),
    h('div', { class: 'wv-chips' }, ...Object.entries(KINDS).map(([k, K]) => h('button', { class: `wv-chip ${v.on[k] ? 'on' : ''}`, style: { '--c': K.col }, title: K.use, onclick: () => { v.on[k] = !v.on[k]; if (v.on[k] && (k === 'bcam' || k === 'bcfm')) wantBroadcast(); if (v.on[k] && k === 'air') wantAirports(); save(); render(); } }, `${K.icon} ${K.label}`)),
      h('button', { class: 'link small', onclick: () => { for (const k in v.on) v.on[k] = true; wantBroadcast(); wantAirports(); save(); render(); } }, 'all'), h('button', { class: 'link small', onclick: () => { for (const k in v.on) v.on[k] = false; save(); render(); } }, 'none')),
    h('div', { class: 'wv-body' }, cv, list)));
  if (v.on.bcam || v.on.bcfm) wantBroadcast();
  if (v.on.air) wantAirports();
  renderList();
  requestAnimationFrame(draw);
}

function tune(it) {
  if (it.roster) return bus.emit('net-join', it.roster);
  if (!rigRx(it.f)) { bus.emit('tune-to', it.f, it.mode); return; }
  if (it.rpt) { S.radio.rptOffset = -600000; S.radio.toneHz = 100; }
  bus.emit('tune-to', it.f, it.mode === 'SSB' ? undefined : it.mode);
}

function renderList() {
  if (!list) return;
  const v = V(), all = catalog().filter((x) => v.on[x.kind]);
  list.innerHTML = '';
  const fmt = (f) => (f >= 30e6 ? `${(f / 1e6).toFixed(3)} MHz` : f >= 1.7e6 ? `${(f / 1e6).toFixed(3)} MHz` : `${Math.round(f / 1e3)} kHz`);
  for (const [k, K] of Object.entries(KINDS)) {
    if (!v.on[k]) continue;
    const items = all.filter((x) => x.kind === k).sort((a, b) => a.km - b.km);
    const status = k === 'bcam' || k === 'bcfm' ? RW.status?.broadcast : k === 'air' ? RW.status?.airports : null;
    list.append(h('div', { class: 'wv-sec' },
      h('div', { class: 'wv-sec-h', style: { borderColor: K.col } }, h('b', {}, `${K.icon} ${K.label}`), h('span', { class: 'tiny muted' }, ` ${items.length}`)),
      h('div', { class: 'tiny muted' }, K.use),
      items.length ? h('table', { class: 'tbl small' }, ...items.slice(0, 6).map((it) => h('tr', {},
        h('td', {}, it.name), h('td', { class: 'mono' }, fmt(it.f)), h('td', {}, it.mode), h('td', { class: 'muted' }, `${Math.round(it.km).toLocaleString()} km${it.note ? ' · ' + it.note : ''}`),
        h('td', {}, h('button', { class: 'btn small', disabled: !rigRx(it.f) && !it.roster, title: !rigRx(it.f) ? 'Your radio can\'t receive this frequency' : '', onclick: () => tune(it) }, it.roster ? 'Join' : 'Tune'))))) : h('div', { class: 'tiny muted' }, status || 'nothing heard right now')));
  }
}

function draw() {
  if (!cv || !cv.offsetParent) return;
  const v = V(), me = player();
  const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = Math.round(W * (v.scale === 'local' ? 0.75 : 0.5));
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.height = `${H}px`; }
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const R = 260; // km radius for the local view
  const kx = Math.cos(me.lat * Math.PI / 180);
  const proj = v.scale === 'local'
    ? (lat, lon) => [W / 2 + ((lon - me.lon) * 111 * kx) / R * (W / 2), H / 2 - ((lat - me.lat) * 111) / R * (W / 2)]
    : (lat, lon) => [((lon + 180) / 360) * W, ((90 - lat) / 180) * H];
  ctx.fillStyle = '#0c2a46'; ctx.fillRect(0, 0, W, H);
  const land = getLand();
  if (land) {
    ctx.fillStyle = '#21402b'; ctx.strokeStyle = '#3f6a48';
    for (const poly of land) { ctx.beginPath(); for (const r of poly) r.forEach(([lon, lat], i) => { const [x, y] = proj(lat, lon); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.fill('evenodd'); ctx.stroke(); }
  }
  if (v.scale === 'world') {
    const d = simDate();
    for (let py = 0; py < H; py += 6) for (let px = 0; px < W; px += 6) { const df = dayFactor({ lat: 90 - py / H * 180, lon: px / W * 360 - 180 }, d); if (df < 1) { ctx.fillStyle = `rgba(2,6,20,${0.55 * (1 - df)})`; ctx.fillRect(px, py, 6, 6); } }
  } else {
    ctx.strokeStyle = 'rgba(200,220,255,0.18)'; ctx.fillStyle = 'rgba(200,220,255,0.5)'; ctx.font = '10px ui-monospace, monospace';
    for (const km of [50, 100, 200]) { ctx.beginPath(); ctx.arc(W / 2, H / 2, km / R * (W / 2), 0, Math.PI * 2); ctx.stroke(); ctx.fillText(`${km} km`, W / 2 + km / R * (W / 2) * 0.71 + 2, H / 2 - km / R * (W / 2) * 0.71); }
  }
  hoverPts = [];
  const items = catalog().filter((x) => v.on[x.kind] && (v.scale === 'world' || x.km < R * 1.4));
  for (const it of items) {
    const [x, y] = proj(it.lat, it.lon);
    if (x < -10 || y < -10 || x > W + 10 || y > H + 10) continue;
    const K = KINDS[it.kind];
    ctx.fillStyle = K.col; ctx.strokeStyle = '#000';
    ctx.beginPath(); ctx.arc(x, y, it.kind === 'players' ? 5 : 3.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    hoverPts.push({ x, y, it });
  }
  // you
  const [mx, my] = proj(me.lat, me.lon);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(mx, my, 5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(mx, my, 9, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 1;
  // tuned station highlight
  const tuned = items.find((x) => Math.abs(x.f - S.radio.freq) < 3000);
  if (tuned) { const [tx, ty] = proj(tuned.lat, tuned.lon); ctx.strokeStyle = '#fff'; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(tx, ty); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#fff'; ctx.font = '11px Inter, sans-serif'; ctx.fillText(`${tuned.name}`, tx + 7, ty - 6); }
}
