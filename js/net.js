// Online mode: real voice (and CW) between players, game-voice-chat style but through
// the radio model. Peer-to-peer WebRTC via PeerJS. You only hear another player when
// you're tuned to their frequency, in the right mode, and propagation supports the path.
//
// Two levels. "Online" is presence only: you are in the lobby, others see your callsign and
// state, and you see who is around. "On the air" adds the direct links that carry voice and CW.
//
// Discovery without a server of our own: the first player online claims a well-known
// "lobby" peer ID on the public PeerJS broker and keeps the roster; everyone else sends it
// a heartbeat every 2 s and gets the roster back. If the lobby host leaves, the next player
// to notice claims the ID and takes over.
import { S, save } from './state.js';
import { h, toast, bus, now, randi, rand, info } from './util.js';
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
  online: false, air: false, peer: null, id: null, peers: new Map(), status: 'offline', roster: [], hosting: false,
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

async function goOnline({ air = true } = {}) {
  if (net.online) { if (air && !net.air) { net.air = true; startAir(); heartbeat(); render(); bus.emit('roster'); } return; }
  if (net.status === 'connecting…') { net.air ||= air; return; }
  net.air = air;
  if (air) startAir();
  setStatus('connecting…');
  try { await loadLib(); } catch (e) { setStatus('offline'); return toast('Could not load the networking library (are you offline?).', 'bad'); }
  const id = `hamshack-${(S.call || 'swl').toLowerCase()}-${randi(1000, 9999)}`;
  const peer = new window.Peer(id);
  net.peer = peer;
  peer.on('open', (pid) => { net.id = pid; net.online = true; setStatus(net.air ? 'on the air' : 'online'); tryHost(); render(); bus.emit('roster'); });
  // Direct links and calls are only accepted while on the air.
  peer.on('connection', (conn) => { if (conn.peer === LOBBY) return; if (net.air) setupConn(conn); else { try { conn.close(); } catch (e) { } } });
  peer.on('call', (c) => { if (net.air) onIncomingCall(c); else { try { c.close(); } catch (e) { } } });
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

function startAir() {
  try { audio.init(); } catch (e) { }
  if (S.settings.hour != null) { S.settings.hour = null; save(); world.repopulate(); toast('On the air together, everyone runs on real UTC. Time warp turned off.', 'info'); }
  if (net.online) setStatus('on the air');
}
// Leave the air but stay visible as online.
function goOffAir() {
  for (const p of [...net.peers.values()]) removePeer(p.id);
  net.air = false; S.settings.autoOnline = false; save();
  setStatus('online'); heartbeat(); render(); bus.emit('roster');
}

function goOffline() {
  seen = null; airSeen.clear();
  clearInterval(net.timer); clearInterval(net.hbTimer); clearInterval(lobby.hostTimer); clearTimeout(lobby.retry);
  for (const p of [...net.peers.values()]) removePeer(p.id);
  try { lobby.conn && lobby.conn.close(); } catch (e) { }
  try { lobby.host && lobby.host.destroy(); } catch (e) { }
  Object.assign(lobby, { host: null, registry: null, conn: null });
  net.peer && net.peer.destroy();
  Object.assign(net, { peer: null, online: false, air: false, id: null, roster: [], hosting: false });
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
  return { t: 'hb', id: net.id, air: net.air, call: S.call || 'SWL', state: S.op.state, name: S.op.name || '', lic: S.license || null,
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

// Tell the operator when someone arrives or goes on the air. The first roster after connecting
// is everyone who was already here, so it is not announced.
let seen = null;
const airSeen = new Set(), lastNote = new Map();
function note(e, text) {
  if (S.settings.notifyOnline === false) return;
  const k = `${e.call}|${text}`;
  if (Date.now() - (lastNote.get(k) || 0) < 10 * 60 * 1000) return;
  lastNote.set(k, Date.now());
  const st = stateBy(e.state);
  const line = `${e.call}${st ? ` (${st.name})` : ''} ${text}`;
  toast(`<b>${e.call}</b>${st ? ` (${st.name})` : ''} ${text}`, 'info', 6000);
  if (document.hidden && S.settings.notifyBrowser && 'Notification' in window && Notification.permission === 'granted') {
    try { const n = new Notification('Ham Radio Simulator', { body: line, tag: `hrs-${e.call}` }); n.onclick = () => { window.focus(); bus.emit('goto', 'radio'); bus.emit('radio-side', 'players'); n.close(); }; } catch (err) { /* not allowed here */ }
  }
}
function announce(list) {
  const ids = new Set(list.map((e) => e.id));
  if (seen) for (const e of list) {
    if (!seen.has(e.id)) note(e, e.air === false ? 'is online' : `is on the air on ${(e.freq / 1e6).toFixed(3)} MHz`);
    else if (e.air !== false && !airSeen.has(e.id)) note(e, `went on the air on ${(e.freq / 1e6).toFixed(3)} MHz`);
  }
  airSeen.clear();
  for (const e of list) if (e.air !== false) airSeen.add(e.id);
  seen = ids;
}

function setRoster(list) {
  net.roster = list.filter((x) => x.id && x.id !== net.id).sort((a, b) => (b.tx - a.tx) || ((b.air !== false) - (a.air !== false)) || a.freq - b.freq);
  announce(net.roster);
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
  if (e.air === false) return toast(`${e.call} is online but not on the air yet.`, 'info');
  if (!net.air) await goOnline({ air: true });
  bus.emit('tune-to', e.freq, e.mode);
  if (!net.peers.has(e.id)) connect(e.id);
  const lp = net.peers.get(e.id); if (lp) lp.pinned = true;
  const est = pathEstimate(e);
  const canTalk = S.license && checkTx(S.license, e.freq, e.mode).ok;
  if (talk && canTalk) await ensureMic();
  toast(`Joined <b>${e.call}</b> on ${(e.freq / 1e6).toFixed(3)} ${e.mode}. ${canTalk ? 'Hold <b>SPACE</b> to talk.' : S.license ? 'You can listen — that frequency is outside your privileges for transmitting.' : 'Listening only — get your license to talk.'}${est && !est.open ? '<br>Propagation between you is poor on this band right now.' : ''}`, 'good', 7000);
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
  if (!p) return;
  if (!audio.ready) { p.pendingStream = stream; return; }
  p.pendingStream = null;
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
    if (first) toast(`Linked with ${d.call} (${d.state}).`, 'good');
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
  for (const p of [...net.peers.values()]) {
    if (p.call !== '?' && now() - p.last > 8) { if (p.pinned) toast(`${p.call} went off the air.`, 'info'); removePeer(p.id); continue; }
    if (p.pendingStream && audio.ready) attachStream(p.id, p.pendingStream);
  }
  autoLink();
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

// Like a real receiver: you're linked to every player on the band you're tuned to, so you
// hear anyone who transmits on your frequency (subject to propagation). Links to players on
// other bands are dropped after a while to keep the mesh small. The lower ID initiates.
const MAX_LINKS = 24;
let lastAuto = 0;
function autoLink() {
  if (!net.online || !net.air || now() - lastAuto < 1.5) return;
  lastAuto = now();
  const myBand = world.band;
  const same = net.roster.filter((e) => e.air !== false && bandOf(e.freq)?.name === myBand && myBand);
  same.sort((a, b) => Math.abs(a.freq - S.radio.freq) - Math.abs(b.freq - S.radio.freq));
  for (const e of same) {
    if (net.peers.size >= MAX_LINKS) break;
    if (!net.peers.has(e.id) && net.id < e.id) connect(e.id);
  }
  for (const p of [...net.peers.values()]) {
    const e = net.roster.find((x) => x.id === p.id);
    const band = e ? bandOf(e.freq)?.name : null;
    if (band === myBand || p.pinned) { p.offBand = 0; continue; }
    p.offBand ||= now();
    if (now() - p.offBand > 30) removePeer(p.id);
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
    // How the receiver renders their voice: clean, shifted (mistuned) or inverted (wrong sideband).
    let audible = false, garble = 0, shiftHz = 0;
    if (tx && s.band === world.band) {
      const ao = Math.abs(off);
      if (mode === 'FM') { if (s.mode === 'FM') { audible = ao < 10000; garble = ao < 4000 ? 0 : 1; shiftHz = 700; } else if (ao < 3000) { audible = true; garble = 1; shiftHz = 300; } }
      else if (s.mode === 'SSB') {
        const same = s.sb === mode || mode === 'AM';
        const audioShift = mode === 'LSB' ? -off : off; // + = pitched up
        if (same && ao <= 120) audible = true;
        else if (same && ao < 2600) { audible = true; garble = Math.min(1, (ao - 120) / 180); shiftHz = Math.max(60, ao); }
        else if (!same && ao < 2600) { audible = true; garble = 1; shiftHz = 2900 + audioShift; }
        if (mode === 'CW') { audible = ao < 2600; garble = 1; shiftHz = 900; }
      } else if (s.mode === 'FM' && ao < 8000) { audible = true; garble = 1; shiftHz = 500; }
    }
    if (p.media.wet && audio.ready) {
      p.media.wet.gain.setTargetAtTime(garble, audio.t, 0.05);
      p.media.dry.gain.setTargetAtTime(1 - garble, audio.t, 0.05);
      p.media.osc.frequency.setTargetAtTime(Math.max(30, Math.abs(shiftHz)), audio.t, 0.05);
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
  root.append(h('div', { class: 'card side-card net', id: 'net-card' },
    h('div', { class: 'row spread' }, h('h3', {}, 'Players', info('<b>Online</b> shows who else has the app open; others see your callsign and state. <b>On the air</b> adds a shared, simulated band with other people using the app. You hear anyone who transmits where you are tuned, if the band is open between you. Tune to their frequency (or press Join) and hold SPACE to talk. Voices go directly between browsers; nothing is recorded. Others see your callsign, state and frequency.', 'About players')), h('div', { class: 'row' }, net.hosting ? h('span', { class: 'badge', title: 'Your browser is currently keeping the player list' }, 'lobby host') : null, statusEl)),
    net.online
      ? h('div', {},
        rosterBox,
        net.air ? h('details', { class: 'small' }, h('summary', {}, 'Advanced: connect by station ID'),
          h('div', { class: 'row' }, h('span', {}, 'Your ID: '), h('code', { class: 'peer-id' }, net.id || '…'), h('button', { class: 'btn small', onclick: () => { navigator.clipboard?.writeText(net.id); toast('Copied!', 'good'); } }, 'Copy')),
          h('div', { class: 'row' }, idIn, h('button', { class: 'btn small', onclick: () => connect(idIn.value) }, 'Connect'))) : null,
        h('div', { class: 'row wrap' },
          net.air ? h('button', { class: 'btn small', onclick: goOffAir }, 'Leave the air') : h('button', { class: 'btn primary', id: 'go-air', onclick: () => { S.settings.autoOnline = true; save(); goOnline({ air: true }); } }, 'Go on the air'),
          h('button', { class: 'btn small ghost', onclick: () => { S.settings.presence = false; S.settings.autoOnline = false; save(); goOffline(); } }, 'Go offline'),
          net.air ? autoChk() : null))
      : h('div', { class: 'row wrap' },
        h('button', { class: 'btn primary', id: 'go-online', onclick: () => { S.settings.presence = true; save(); goOnline({ air: false }); } }, 'See who is online'),
        h('button', { class: 'btn', onclick: () => { S.settings.presence = true; S.settings.autoOnline = true; save(); goOnline({ air: true }); } }, 'Go on the air')),
  ));
  renderRoster();
}

function autoChk() {
  const c = h('input', { type: 'checkbox', checked: !!S.settings.autoOnline });
  c.onchange = () => { S.settings.autoOnline = c.checked; save(); };
  return h('label', { class: 'inline small' }, c, ' go on the air automatically when I open the simulator');
}
export function autoOnline() { if (net.online) return; if (S.settings.autoOnline) goOnline({ air: true }); else if (S.settings.presence) goOnline({ air: false }); }
export const setPresence = (on) => { S.settings.presence = on; save(); if (on) goOnline({ air: false }); else if (net.online && !net.air) goOffline(); };
bus.on('presence', setPresence);

function renderRoster() {
  if (!rosterBox || !net.online) return;
  const list = net.roster;
  rosterBox.innerHTML = '';
  if (!list.length) {
    rosterBox.append(h('p', { class: 'muted small' }, net.hosting || (lobby.conn && lobby.conn.open) ? 'Nobody else is online right now. You will be told when someone arrives.' : 'Finding the lobby…'));
    return;
  }
  const dial = S.radio.freq;
  rosterBox.append(h('table', { class: 'tbl roster-tbl' },
    h('tr', {}, ...['', 'Call', 'QTH', 'Freq', 'Mode', 'Path to you', 'Link', ''].map((t) => h('th', {}, t))),
    ...list.map((e) => {
      const linked = net.peers.get(e.id);
      const here = Math.abs(e.freq - dial) < 500 && e.mode === S.radio.mode;
      const est = pathEstimate(e);
      const band = bandOf(e.freq);
      return h('tr', { class: `${e.tx ? 'talking' : ''} ${here ? 'here' : ''}` },
        h('td', {}, e.tx ? h('span', { class: 'onair-dot', title: 'transmitting now' }, '●') : linked?.media ? '' : ''),
        h('td', {}, h('b', {}, e.call), e.lic ? h('span', { class: `badge lic-${e.lic}` }, e.lic) : h('span', { class: 'badge lic-none' }, 'SWL')),
        h('td', {}, `${e.state}${est ? ` · ${Math.round(est.km).toLocaleString()} km` : ''}`),
        h('td', { class: 'mono' }, e.air === false ? '—' : `${(e.freq / 1e6).toFixed(3)}${band ? ` (${band.name})` : ''}`),
        h('td', {}, e.mode),
        h('td', { class: est ? (est.open ? 'ok' : 'bad') : 'muted' }, est ? (est.open ? `≈ ${est.s}` : 'band closed') : '—'),
        h('td', { class: 'small' }, linked ? (linked.media ? 'audio' : '') : bandOf(e.freq)?.name === world.band ? '…' : h('span', { class: 'muted' }, 'other band')),
        h('td', {}, e.air === false ? h('span', { class: 'badge' }, 'online') : here && linked ? h('span', { class: 'badge ok' }, 'joined') : h('button', { class: 'btn primary small', onclick: () => join(e) }, e.tx ? 'Join (talking)' : 'Join')));
    })));
}
