// Online mode: real voice (and CW) between players, game-voice-chat style but through
// the radio model. Peer-to-peer WebRTC via PeerJS. You only hear another player when
// you're tuned to their frequency, in the right mode, and propagation supports the path.
import { S } from './state.js';
import { h, toast, bus, now, clamp, randi } from './util.js';
import { audio } from './audio.js';
import { voice } from './voice.js';
import { world, Station } from './world.js';
import { stateBy } from './data/world.js';
import { bandOf } from './data/bandplan.js';

const PEERJS = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';

export const net = {
  online: false, peer: null, id: null, peers: new Map(), status: 'offline',
  isPeerCall(call) { for (const p of this.peers.values()) if (p.call === call) return true; return false; },
};

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
  const mic = await voice.getMic();
  if (!mic) toast(`Microphone unavailable (${voice.micError || 'permission denied'}). You can still listen and send CW.`, 'warn');
  else mic.getAudioTracks().forEach((t) => { t.enabled = false; });
  const id = `hamshack-${(S.call || 'swl').toLowerCase()}-${randi(1000, 9999)}`;
  const peer = new window.Peer(id);
  net.peer = peer;
  peer.on('open', (pid) => { net.id = pid; net.online = true; setStatus('online'); render(); });
  peer.on('connection', (conn) => setupConn(conn));
  peer.on('call', (call) => { call.answer(voice.micStream || undefined); call.on('stream', (st) => attachStream(call.peer, st)); });
  peer.on('error', (e) => { toast(`Network: ${e.type || e.message}`, 'warn'); if (!net.online) setStatus('offline'); });
  peer.on('disconnected', () => setStatus('reconnecting…') || peer.reconnect());
  clearInterval(net.timer);
  net.timer = setInterval(tick, 400);
}

function goOffline() {
  clearInterval(net.timer);
  for (const p of net.peers.values()) removePeer(p.id);
  net.peer && net.peer.destroy();
  net.peer = null; net.online = false; net.id = null;
  setStatus('offline'); render();
}

function connect(id) {
  id = id.trim().toLowerCase();
  if (!net.peer || !id || id === net.id || net.peers.has(id)) return;
  setupConn(net.peer.connect(id, { reliable: true }));
}

function setupConn(conn) {
  const p = { id: conn.peer, conn, call: '?', st: null, station: null, media: null, last: now() };
  net.peers.set(conn.peer, p);
  conn.on('open', () => {
    send(p, hello());
    // the lexicographically smaller id places the media call (avoids duplicates)
    if (net.id < conn.peer && voice.micStream) {
      const call = net.peer.call(conn.peer, voice.micStream);
      call.on('stream', (st) => attachStream(conn.peer, st));
    }
    send(p, { t: 'peers', ids: [...net.peers.keys()].filter((k) => k !== conn.peer) });
    render();
  });
  conn.on('data', (d) => onData(p, d));
  conn.on('close', () => { removePeer(conn.peer); render(); });
  conn.on('error', () => { removePeer(conn.peer); render(); });
}

function removePeer(id) {
  const p = net.peers.get(id);
  if (!p) return;
  try { p.conn.close(); } catch (e) { }
  if (p.station) world.stations = world.stations.filter((s) => s !== p.station);
  if (p.media) try { p.media.gain.disconnect(); } catch (e) { }
  net.peers.delete(id);
}

function attachStream(id, stream) {
  const p = net.peers.get(id);
  if (!p || !audio.ready) return;
  p.media = audio.streamIn(stream);
}

const send = (p, m) => { try { p.conn.open && p.conn.send(m); } catch (e) { } };
const broadcast = (m) => { for (const p of net.peers.values()) send(p, m); };
const hello = () => ({ t: 'hello', call: S.call || 'SWL', state: S.op.state, name: S.op.name });

let myTx = { tx: false, freq: 0, mode: 'USB', dbm: 0 };
function myState() { return { t: 'st', freq: myTx.tx ? myTx.freq : S.radio.freq, mode: S.radio.mode, tx: myTx.tx, dbm: myTx.dbm }; }

function onData(p, d) {
  p.last = now();
  if (d.t === 'hello') { p.call = d.call; p.qth = d.state; p.name = d.name; ensureStation(p); render(); toast(`🌐 ${d.call} (${d.state}) is connected.`, 'good'); }
  else if (d.t === 'peers') { for (const id of d.ids || []) if (!net.peers.has(id) && id !== net.id) connect(id); }
  else if (d.t === 'st') {
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
  // keep peer stations present on the band the player is listening to
  for (const p of net.peers.values()) {
    if (!p.station) continue;
    const b = bandOf(p.station.freq);
    p.station.band = b ? b.name : null;
    const here = p.station.band && p.station.band === world.band;
    const inList = world.stations.includes(p.station);
    if (here && !inList) world.stations.push(p.station);
    if (!here && inList) world.stations = world.stations.filter((s) => s !== p.station);
  }
  if (Math.random() < 0.1) render();
}

net.setPtt = (on, p) => {
  if (voice.micStream) voice.micStream.getAudioTracks().forEach((t) => { t.enabled = on && p?.via === 'rf'; });
  myTx = on && p && p.via === 'rf' ? { tx: true, freq: p.txf, mode: S.radio.mode, dbm: p.dbm } : { tx: false };
  if (net.online) broadcast(myState());
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
let root, statusEl;
function setStatus(s) { net.status = s; if (statusEl) statusEl.textContent = s; }

export function initNetUI(el) { root = el; render(); }

function render() {
  if (!root) return;
  root.innerHTML = '';
  const idIn = h('input', { placeholder: 'friend\'s station ID', size: 26 });
  statusEl = h('span', { class: `badge ${net.online ? 'ok' : ''}` }, net.status);
  const peers = [...net.peers.values()];
  root.append(h('div', { class: 'card net' },
    h('div', { class: 'row spread' }, h('h3', {}, '🌐 On the air with real people'), statusEl),
    h('p', { class: 'small muted' }, 'Like voice chat in other games — but through the radio. Hold SPACE (PTT) to talk. You hear another player only when you\'re on the same frequency and mode and the band is open between your QTHs. Audio is peer-to-peer (WebRTC); the free PeerJS server is used only to introduce you.'),
    net.online
      ? h('div', {},
        h('div', { class: 'row' }, h('span', {}, 'Your station ID: '), h('code', { class: 'peer-id' }, net.id), h('button', { class: 'btn small', onclick: () => { navigator.clipboard?.writeText(net.id); toast('Copied! Send it to a friend.', 'good'); } }, 'Copy')),
        h('div', { class: 'row' }, idIn, h('button', { class: 'btn primary', onclick: () => connect(idIn.value) }, 'Connect'), h('button', { class: 'btn', onclick: goOffline }, 'Go offline')),
        peers.length ? h('table', { class: 'tbl' }, h('tr', {}, h('th', {}, 'Call'), h('th', {}, 'QTH'), h('th', {}, 'Freq'), h('th', {}, 'Mode'), h('th', {}, 'Audio'), h('th', {}, '')),
          ...peers.map((p) => h('tr', {}, h('td', {}, h('b', {}, p.call)), h('td', {}, p.qth || ''), h('td', {}, p.st ? (p.st.freq / 1e6).toFixed(3) : '—'), h('td', {}, p.st?.mode || ''),
            h('td', {}, p.media ? '🔊' : '—'), h('td', {}, p.st ? h('button', { class: 'btn small', onclick: () => bus.emit('tune-to', p.st.freq, p.st.mode) }, 'Tune to') : ''))))
          : h('p', { class: 'muted small' }, 'Nobody connected yet. Share your ID, or paste a friend\'s and click Connect. Then agree on a frequency (e.g. 14.250 USB by day, 7.200 LSB at night).'))
      : h('button', { class: 'btn primary', onclick: goOnline }, 'Go online (uses microphone)'),
  ));
}
