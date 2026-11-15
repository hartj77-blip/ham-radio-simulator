// Online mode: real voice (and CW) between players, game-voice-chat style but through
// the radio model. Peer-to-peer WebRTC via PeerJS. You only hear another player when
// you're tuned to their frequency, in the right mode, and propagation supports the path.
//
// Discovery without a server of our own: the first player online claims a well-known
// "lobby" peer ID on the public PeerJS broker and keeps the roster; everyone else sends it
// a heartbeat every 2 s and gets the roster back. If the lobby host leaves, the next player
// to notice claims the ID and takes over.
import { S } from './state.js';
import { h, toast, bus, now, randi, rand } from './util.js';
import { audio } from './audio.js';
import { voice } from './voice.js';
import { world, Station, player } from './world.js';
import { stateBy } from './data/world.js';
import { bandOf, checkTx } from './data/bandplan.js';
import { path as propPath, bandNoiseDbm, sUnits, distanceKm } from './propagation.js';

const PEERJS = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
const LOBBY = 'hamshack-sim-lobby-v1';
const HB_MS = 2000, STALE_MS = 9000;

export const net = {
  online: false, peer: null, id: null, peers: new Map(), status: 'offline', roster: [], hosting: false,
  isPeerCall(call) { for (const p of this.peers.values()) if (p.call === call) return true; return false; },
};
const lobby = { host: null, registry: null, hostTimer: null, conn: null, retry: null, lastRoster: 0 };
bus.on('net-join', (e) => join(e));

function loadLib() {
  if (window.Peer) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = PEERJS; s.onload = res; s.onerror = () => rej(new Error('Could not load PeerJS'));
    document.head.append(s);
  });
}

async function goOnline() {
  audio.init();
  setStatus('connecting…');
  try { await loadLib(); } catch (e) { setStatus('offline'); return toast('Could not load the networking library (are you offline?).', 'bad'); }
  const id = `hamshack-${(S.call || 'swl').toLowerCase()}-${randi(1000, 9999)}`;
  const peer = new window.Peer(id);
  net.peer = peer;
  peer.on('open', (pid) => { net.id = pid; net.online = true; setStatus('online'); tryHost(); render(); });
  peer.on('connection', (conn) => { if (conn.peer !== LOBBY) setupConn(conn); });
  peer.on('call', onIncomingCall);
  peer.on('error', (e) => {
    if (e.type === 'peer-unavailable' && String(e.message || '').includes(LOBBY)) return relobby();
    if (e.type === 'peer-unavailable') return toast('That station is no longer online.', 'warn');
    toast(`Network: ${e.type || e.message}`, 'warn');
    if (!net.online) setStatus('offline');
  });
  peer.on('disconnected', () => { setStatus('reconnecting…'); try { peer.reconnect(); } catch (e) { } });
  clearInterval(net.timer); clearInterval(net.hbTimer);
  net.timer = setInterval(tick, 400);
  net.hbTimer = setInterval(heartbeat, HB_MS);
}

function goOffline() {
  clearInterval(net.timer); clearInterval(net.hbTimer); clearInterval(lobby.hostTimer); clearTimeout(lobby.retry);
  for (const p of [...net.peers.values()]) removePeer(p.id);
  try { lobby.conn && lobby.conn.close(); } catch (e) { }
  try { lobby.host && lobby.host.destroy(); } catch (e) { }
  Object.assign(lobby, { host: null, registry: null, conn: null });
  net.peer && net.peer.destroy();
  Object.assign(net, { peer: null, online: false, id: null, roster: [], hosting: false });
  setStatus('offline'); render(); bus.emit('roster');
}

// ------------------------------------------------------------------ lobby (discovery)
function tryHost() {
  if (!net.online) return;
  clearTimeout(lobby.retry);
  const lp = new window.Peer(LOBBY);
  lp.on('open', () => {
    lobby.host = lp; lobby.registry = new Map(); net.hosting = true;
    render();
    lp.on('connection', (c) => {
      c.on('data', (d) => { if (d && d.t === 'hb' && d.id) lobby.registry.set(d.id, { ...d, last: Date.now(), conn: c }); });
      c.on('close', () => { for (const [k, v] of lobby.registry) if (v.conn === c) lobby.registry.delete(k); });
    });
    clearInterval(lobby.hostTimer);
    lobby.hostTimer = setInterval(hostTick, HB_MS);
    heartbeat(); hostTick();
  });
  lp.on('error', (e) => {
    try { lp.destroy(); } catch (x) { }
    if (lobby.host === lp) { lobby.host = null; net.hosting = false; clearInterval(lobby.hostTimer); }
    if (e.type === 'unavailable-id') joinLobby();
    else relobby();
  });
  lp.on('disconnected', () => { try { lp.reconnect(); } catch (e) { } });
}

function hostTick() {
  const t = Date.now();
  for (const [k, v] of lobby.registry) if (t - v.last > STALE_MS) lobby.registry.delete(k);
  const list = [...lobby.registry.values()].map(({ conn, last, ...rest }) => rest);
  for (const v of lobby.registry.values()) { try { v.conn && v.conn.open && v.conn.send({ t: 'roster', list }); } catch (e) { } }
  setRoster(list);
}

function joinLobby() {
  if (!net.online || lobby.conn) return;
  const c = net.peer.connect(LOBBY, { reliable: true });
  lobby.conn = c; lobby.lastRoster = Date.now();
  c.on('open', heartbeat);
  c.on('data', (d) => { if (d && d.t === 'roster' && lobby.conn === c) { lobby.lastRoster = Date.now(); setRoster(d.list || []); } });
  c.on('close', () => { if (lobby.conn === c) relobby(); });
  c.on('error', () => { if (lobby.conn === c) relobby(); });
}

function relobby() {
  try { lobby.conn && lobby.conn.close(); } catch (e) { }
  lobby.conn = null;
  if (!net.online || net.hosting) return;
  clearTimeout(lobby.retry);
  lobby.retry = setTimeout(() => { lobby.retry = null; tryHost(); }, rand(400, 2500)); // random back-off so one player wins
}

function myInfo() {
  const r = S.radio;
  return { t: 'hb', id: net.id, call: S.call || 'SWL', state: S.op.state, name: S.op.name || '', lic: S.license || null,
    freq: myTx.tx ? myTx.freq : r.freq, mode: r.mode, tx: !!myTx.tx, mic: !!voice.micStream, ts: Date.now() };
}

function heartbeat() {
  if (!net.online || !net.id) return;
  // watchdog: WebRTC doesn't always report a vanished host, so treat a silent lobby as gone
  if (!net.hosting && lobby.conn && Date.now() - lobby.lastRoster > 7000) relobby();
  if (!net.hosting && !lobby.conn && !lobby.retry) relobby();
  const info = myInfo();
  if (net.hosting && lobby.registry) lobby.registry.set(net.id, { ...info, last: Date.now(), conn: null });
  else if (lobby.conn && lobby.conn.open) { try { lobby.conn.send(info); } catch (e) { } }
}

function setRoster(list) {
  net.roster = list.filter((x) => x.id && x.id !== net.id).sort((a, b) => (b.tx - a.tx) || a.freq - b.freq);
  bus.emit('roster');
  renderRoster();
}

// Rough "can I hear them?" estimate from the propagation model (100 W, dipoles).
export function pathEstimate(e) {
  const st = stateBy(e.state);
  if (!st || !e.freq) return null;
  const me = player();
  const f = e.freq / 1e6;
  const p = propPath(st, me, f);
  const dbm = 50 + 2 + 2 - p.loss;
  const snr = dbm - bandNoiseDbm(f, me);
  return { snr, s: sUnits(Math.max(dbm, bandNoiseDbm(f, me))).text, km: distanceKm(me, st), open: snr > 3 };
}

// Join: tune to them, open a direct link (audio + CW), and get ready to talk.
async function join(e, talk = true) {
  if (!net.online) return;
  bus.emit('tune-to', e.freq, e.mode);
  if (!net.peers.has(e.id)) connect(e.id);
  const est = pathEstimate(e);
  const canTalk = S.license && checkTx(S.license, e.freq, e.mode).ok;
  if (talk && canTalk) await ensureMic();
  toast(`📻 Joined <b>${e.call}</b> on ${(e.freq / 1e6).toFixed(3)} ${e.mode}. ${canTalk ? 'Hold <b>SPACE</b> to talk.' : S.license ? 'You can listen — that frequency is outside your privileges for transmitting.' : 'Listening only — get your license to talk.'}${est && !est.open ? '<br>⚠ Propagation between you is poor on this band right now.' : ''}`, 'good', 7000);
}

// ------------------------------------------------------------------ direct links (audio/CW)
function connect(id) {
  id = String(id).trim().toLowerCase();
  if (!net.peer || !id || id === net.id || net.peers.has(id) || id === LOBBY) return;
  setupConn(net.peer.connect(id, { reliable: true }));
}

function setupConn(conn) {
  if (net.peers.has(conn.peer)) { try { conn.close(); } catch (e) { } return; }
  const p = { id: conn.peer, conn, call: '?', st: null, station: null, media: null, mcall: null, sentMine: false, hasMic: false, last: now() };
  net.peers.set(conn.peer, p);
  conn.on('open', () => { send(p, hello()); render(); });
  conn.on('data', (d) => onData(p, d));
  conn.on('close', () => { removePeer(conn.peer); render(); });
  conn.on('error', () => { removePeer(conn.peer); render(); });
}

function removePeer(id) {
  const p = net.peers.get(id);
  if (!p) return;
  try { p.conn.close(); } catch (e) { }
  try { p.mcall && p.mcall.close(); } catch (e) { }
  if (p.station) world.stations = world.stations.filter((s) => s !== p.station);
  if (p.media) try { p.media.gain.disconnect(); } catch (e) { }
  net.peers.delete(id);
  renderRoster();
}

// Media: whoever has a microphone places the call (smaller id wins if both do).
function maybeCall(p) {
  if (!voice.micStream || p.sentMine || !net.peer) return;
  if (p.hasMic && !p.mcall && net.id > p.id) return; // let them call; we'll answer with our mic
  try { p.mcall && p.mcall.close(); } catch (e) { }
  const c = net.peer.call(p.id, voice.micStream);
  p.mcall = c; p.sentMine = true;
  c.on('stream', (st) => attachStream(p.id, st));
}
function onIncomingCall(call) {
  const p = net.peers.get(call.peer);
  if (p) { if (p.mcall && p.mcall !== call) { try { p.mcall.close(); } catch (e) { } } p.mcall = call; p.sentMine = !!voice.micStream; }
  call.answer(voice.micStream || undefined);
  call.on('stream', (st) => attachStream(call.peer, st));
}
function attachStream(id, stream) {
  const p = net.peers.get(id);
  if (!p || !audio.ready) return;
  if (p.media) { try { p.media.gain.disconnect(); } catch (e) { } }
  p.media = audio.streamIn(stream);
  renderRoster();
}

async function ensureMic() {
  if (voice.micStream) return true;
  const mic = await voice.getMic();
  if (!mic) { toast(`Microphone unavailable (${voice.micError || 'permission denied'}). You can still listen and send CW.`, 'warn'); return false; }
  mic.getAudioTracks().forEach((t) => { t.enabled = false; });
  for (const p of net.peers.values()) { send(p, hello()); maybeCall(p); }
  heartbeat();
  return true;
}

const send = (p, m) => { try { p.conn.open && p.conn.send(m); } catch (e) { } };
const broadcast = (m) => { for (const p of net.peers.values()) send(p, m); };
const hello = () => ({ t: 'hello', call: S.call || 'SWL', state: S.op.state, name: S.op.name, mic: !!voice.micStream });

let myTx = { tx: false, freq: 0, mode: 'USB', dbm: 0 };
function myState() { return { t: 'st', freq: myTx.tx ? myTx.freq : S.radio.freq, mode: S.radio.mode, tx: myTx.tx, dbm: myTx.dbm }; }

function onData(p, d) {
  p.last = now();
  if (d.t === 'hello') {
    const first = p.call === '?';
    p.call = d.call; p.qth = d.state; p.name = d.name; p.hasMic = !!d.mic;
    ensureStation(p); maybeCall(p); render();
    if (first) toast(`🌐 Linked with ${d.call} (${d.state}).`, 'good');
  } else if (d.t === 'st') {
    p.st = d; ensureStation(p);
    const s = p.station;
    s.freq = d.freq; s.mode = d.mode === 'CW' ? 'CW' : d.mode === 'FM' ? 'FM' : 'SSB'; s.sb = d.mode; s.powerDbm = d.dbm || 50;
    if (d.tx && s.mode !== 'CW') { if (!s.tx || s.tx.kind !== 'peervoice' || s.tx.end < now()) s.tx = { kind: 'peervoice', start: now(), end: now() + 600, show: '' }; }
    else if (!d.tx && s.tx && s.tx.kind === 'peervoice') s.tx.end = now();
  } else if (d.t === 'cw') {
    ensureStation(p);
    const s = p.station;
    s.freq = d.freq; s.mode = 'CW'; s.wpm = d.wpm; s.powerDbm = d.dbm || 50;
    s.send(d.text);
  }
}

function ensureStation(p) {
  if (p.station) return;
  const st = stateBy(p.qth) || stateBy('KS');
  p.station = new Station({ op: { call: p.call, lat: st.lat, lon: st.lon, cont: 'NA', zone: st.zone, qth: st.name, name: p.name || '', lang: 'en-US', country: 'United States', state: st.abbr, dxcc: 'United States' }, mode: 'SSB', sb: 'USB', freq: 0, band: null, role: 'peer', antGain: 2, powerDbm: 50 });
  p.station.qsb.depth = 3;
}

function tick() {
  broadcast(myState());
  // drop linked players that went silent (closed tab, lost network)
  for (const p of [...net.peers.values()]) if (p.call !== '?' && now() - p.last > 8) { toast(`🌐 ${p.call} went off the air.`, 'info'); removePeer(p.id); }
  // keep linked players present on the band the player is listening to
  for (const p of net.peers.values()) {
    if (!p.station) continue;
    const b = bandOf(p.station.freq);
    p.station.band = b ? b.name : null;
    const here = p.station.band && p.station.band === world.band;
    const inList = world.stations.includes(p.station);
    if (here && !inList) world.stations.push(p.station);
    if (!here && inList) world.stations = world.stations.filter((s) => s !== p.station);
  }
}

net.setPtt = (on, p) => {
  if (on && !voice.micStream && net.online) ensureMic();
  if (voice.micStream) voice.micStream.getAudioTracks().forEach((t) => { t.enabled = on && p?.via === 'rf'; });
  myTx = on && p && p.via === 'rf' ? { tx: true, freq: p.txf, mode: S.radio.mode, dbm: p.dbm } : { tx: false };
  if (net.online) { broadcast(myState()); heartbeat(); }
};
net.sendCW = (text, wpm, freq) => { if (net.online) broadcast({ t: 'cw', text, wpm, freq, dbm: 50 }); };

// Receiver hook: levels for each peer's voice stream.
net.signals = (dial, mode, att, nBW) => {
  const out = [];
  for (const p of net.peers.values()) {
    if (!p.media || !p.station) continue;
    const s = p.station;
    const tx = s.tx && s.tx.kind === 'peervoice' && s.tx.end > now();
    const off = s.freq - dial;
    let audible = false;
    if (tx && s.band === world.band) {
      if (mode === 'FM') audible = s.mode === 'FM' && Math.abs(off) < 5000;
      else if (mode === 'USB' || mode === 'LSB' || mode === 'AM') audible = s.mode === 'SSB' && (s.sb === mode || mode === 'AM') && Math.abs(off) < 400;
    }
    const dbm = s.freq ? world.rxDbm(s) - att : -200;
    out.push({ node: p.media.gain, gain: p.media.gain, audible, snr: dbm - nBW, dbm });
  }
  return out;
};
net.peerGains = () => [...net.peers.values()].filter((p) => p.media).map((p) => p.media);

// ------------------------------------------------------------------ UI
let root, statusEl, rosterBox;
function setStatus(s) { net.status = s; if (statusEl) statusEl.textContent = s; }

export function initNetUI(el) { root = el; render(); setInterval(renderRoster, 1500); }

function render() {
  if (!root) return;
  root.innerHTML = '';
  const idIn = h('input', { placeholder: 'station ID (optional)', size: 24 });
  statusEl = h('span', { class: `badge ${net.online ? 'ok' : ''}` }, net.status);
  rosterBox = h('div', { class: 'roster' });
  root.append(h('div', { class: 'card net', id: 'net-card' },
    h('div', { class: 'row spread' }, h('h3', {}, '🌐 Who\'s on the air (real players)'), h('div', { class: 'row' }, net.hosting ? h('span', { class: 'badge', title: 'Your browser is currently keeping the player list' }, 'lobby host') : null, statusEl)),
    h('p', { class: 'small muted' }, 'Like voice chat in other games — but through the radio. Go online to see every player, their frequency and who\'s talking right now. Press Join to tune in, then hold SPACE to talk. You only hear each other on the same frequency and mode, when the band is open between your QTHs. Others see your callsign, state and frequency while you\'re online.'),
    net.online
      ? h('div', {},
        rosterBox,
        h('details', { class: 'small' }, h('summary', {}, 'Advanced: connect by station ID'),
          h('div', { class: 'row' }, h('span', {}, 'Your ID: '), h('code', { class: 'peer-id' }, net.id || '…'), h('button', { class: 'btn small', onclick: () => { navigator.clipboard?.writeText(net.id); toast('Copied!', 'good'); } }, 'Copy')),
          h('div', { class: 'row' }, idIn, h('button', { class: 'btn small', onclick: () => connect(idIn.value) }, 'Connect'))),
        h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: goOffline }, 'Go offline')))
      : h('button', { class: 'btn primary', onclick: goOnline }, '🌐 Go online — see who\'s on'),
  ));
  renderRoster();
}

function renderRoster() {
  if (!rosterBox || !net.online) return;
  const list = net.roster;
  rosterBox.innerHTML = '';
  if (!list.length) {
    rosterBox.append(h('p', { class: 'muted small' }, net.hosting || (lobby.conn && lobby.conn.open) ? '📭 Nobody else is online right now. Leave this open — you\'ll see players appear here. (Share the game link with a friend!)' : '⏳ Finding the lobby…'));
    return;
  }
  const dial = S.radio.freq;
  rosterBox.append(h('table', { class: 'tbl roster-tbl' },
    h('tr', {}, ...['', 'Call', 'QTH', 'Freq', 'Mode', 'Path to you', ''].map((t) => h('th', {}, t))),
    ...list.map((e) => {
      const linked = net.peers.get(e.id);
      const here = Math.abs(e.freq - dial) < 500 && e.mode === S.radio.mode;
      const est = pathEstimate(e);
      const band = bandOf(e.freq);
      return h('tr', { class: `${e.tx ? 'talking' : ''} ${here ? 'here' : ''}` },
        h('td', {}, e.tx ? h('span', { class: 'onair-dot', title: 'transmitting now' }, '●') : linked?.media ? '🔊' : ''),
        h('td', {}, h('b', {}, e.call), e.lic ? h('span', { class: `badge lic-${e.lic}` }, e.lic) : h('span', { class: 'badge lic-none' }, 'SWL')),
        h('td', {}, `${e.state}${est ? ` · ${Math.round(est.km).toLocaleString()} km` : ''}`),
        h('td', { class: 'mono' }, `${(e.freq / 1e6).toFixed(3)}${band ? ` (${band.name})` : ''}`),
        h('td', {}, e.mode),
        h('td', { class: est ? (est.open ? 'ok' : 'bad') : 'muted' }, est ? (est.open ? `≈ ${est.s}` : 'band closed') : '—'),
        h('td', {}, here && linked ? h('span', { class: 'badge ok' }, 'joined') : h('button', { class: 'btn primary small', onclick: () => join(e) }, e.tx ? '▶ Join (on air)' : '▶ Join')));
    })));
}
