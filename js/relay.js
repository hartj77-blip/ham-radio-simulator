// Relay: a public message broker (MQTT over a secure websocket) that every player connects to.
// Direct browser-to-browser links (WebRTC) give the best audio, but they fail between many home,
// mobile and school networks. The relay always works, so through it everyone sees everyone on
// the player list and can always hear one another:
//   hb        heartbeats (who is online and where they are tuned): the player list
//   air       station state and CW, for every player on the air
//   v/<band>  voice while transmitting, 8 kHz mu-law (like a phone line), per band
// Like real radio, anything sent this way is public: anyone on the broker could listen.
import { clamp } from './util.js';

const LIB = 'https://unpkg.com/mqtt@5.10.1/dist/mqtt.min.js';
const BROKERS = ['wss://broker.hivemq.com:8884/mqtt', 'wss://broker.emqx.io:8084/mqtt'];
const ROOT = 'hamradiosim/v1';
export const VOICE_RATE = 8000;

export const relay = { client: null, ok: false, broker: null, voiceSub: null };
const handlers = { hb: null, air: null, voice: null, bye: null, status: null };

function loadLib() {
  if (window.mqtt) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = LIB; s.onload = res; s.onerror = () => rej(new Error('Could not load the relay library'));
    document.head.append(s);
  });
}

// A broker address saved in this browser (for testing against a local broker) comes first.
function brokers() {
  let own = null;
  try { own = localStorage.getItem('hrs-relay'); } catch (e) { /* storage blocked */ }
  return own ? [own] : BROKERS;
}

export async function relayStart(id, h) {
  Object.assign(handlers, h);
  if (relay.client) return;
  try { await loadLib(); } catch (e) { handlers.status?.(false); return; }
  const list = brokers();
  let i = 0;
  const open = () => {
    const url = list[i % list.length];
    const c = window.mqtt.connect(url, {
      clientId: `hrs-${id}`.slice(0, 64), clean: true, keepalive: 20, reconnectPeriod: 0, connectTimeout: 8000,
      will: { topic: `${ROOT}/bye`, payload: JSON.stringify({ id }), qos: 0, retain: false },
    });
    relay.client = c;
    c.on('connect', () => {
      relay.ok = true; relay.broker = url;
      c.subscribe([`${ROOT}/hb`, `${ROOT}/air`, `${ROOT}/bye`]);
      relay.voiceSub = null;
      handlers.status?.(true);
    });
    c.on('message', (topic, buf) => {
      try {
        if (topic.startsWith(`${ROOT}/v/`)) { const from = topic.split('/').pop(); if (from !== id) handlers.voice?.(from, new Uint8Array(buf)); return; }
        const m = JSON.parse(new TextDecoder().decode(buf));
        if (!m || m.id === id) return;
        if (topic === `${ROOT}/hb`) handlers.hb?.(m);
        else if (topic === `${ROOT}/air`) handlers.air?.(m);
        else if (topic === `${ROOT}/bye`) handlers.bye?.(m.id);
      } catch (e) { /* malformed message from someone else: ignore */ }
    });
    const lost = () => {
      if (relay.client !== c) return;
      const was = relay.ok;
      relay.ok = false;
      try { c.end(true); } catch (e) { }
      relay.client = null;
      if (was) handlers.status?.(false);
      i++; // try the next broker
      relay.retry = setTimeout(() => { if (relay.wanted) open(); }, i % list.length ? 500 : 5000);
    };
    c.on('close', lost);
    c.on('error', lost);
  };
  relay.wanted = true;
  open();
}

export function relayStop(id) {
  relay.wanted = false;
  clearTimeout(relay.retry);
  const c = relay.client;
  relay.client = null; relay.ok = false; relay.voiceSub = null;
  if (!c) return;
  try { c.publish(`${ROOT}/bye`, JSON.stringify({ id })); } catch (e) { }
  setTimeout(() => { try { c.end(); } catch (e) { } }, 200);
}

const pub = (topic, m) => { if (relay.ok) try { relay.client.publish(`${ROOT}/${topic}`, typeof m === 'string' || m instanceof Uint8Array ? m : JSON.stringify(m)); } catch (e) { } };
export const relayHb = (m) => pub('hb', m);
export const relayAir = (m) => pub('air', m);
export const relayVoice = (band, id, bytes) => pub(`v/${band || 'x'}/${id}`, bytes);

// Listen for voice on one band only (the one the receiver is on), so a player only downloads
// the audio they could hear.
export function relayListen(band) {
  if (!relay.ok) return;
  const t = band ? `${ROOT}/v/${band}/+` : null;
  if (t === relay.voiceSub) return;
  if (relay.voiceSub) relay.client.unsubscribe(relay.voiceSub);
  relay.voiceSub = t;
  if (t) relay.client.subscribe(t);
}

// ---- 8 kHz mu-law codec ----
const BIAS = 0x84, CLIP = 32635;
export function ulawEncode(f) {
  let s = Math.round(clamp(f, -1, 1) * 32767);
  const sign = s < 0 ? 0x80 : 0;
  if (sign) s = -s;
  if (s > CLIP) s = CLIP;
  s += BIAS;
  let exp = 7;
  for (let m = 0x4000; (s & m) === 0 && exp > 0; m >>= 1) exp--;
  const man = (s >> (exp + 3)) & 0x0f;
  return ~(sign | (exp << 4) | man) & 0xff;
}
export const ULAW = (() => {
  const t = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const u = ~i & 0xff, sign = u & 0x80, exp = (u >> 4) & 7, man = u & 0x0f;
    const s = (((man << 3) + BIAS) << exp) - BIAS;
    t[i] = (sign ? -s : s) / 32768;
  }
  return t;
})();

// Downsample a block of microphone audio to 8 kHz (box filter, enough for a speech channel).
export function toVoiceBytes(input, rate) {
  const ratio = rate / VOICE_RATE, n = Math.floor(input.length / ratio);
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.floor(i * ratio), b = Math.max(a + 1, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let k = a; k < b; k++) sum += input[k];
    out[i] = ulawEncode(sum / (b - a));
  }
  return out;
}
