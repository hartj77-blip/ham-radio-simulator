// Web Audio receiver model: band noise -> IF filter -> AGC -> AF gain.
// Signals (CW tones, SSB "babble", network voice) are injected before the filter,
// so tuning and filter width behave like a real receiver.
import { clamp, rand } from './util.js';

class AudioEngine {
  constructor() { this.ctx = null; this.voices = new Map(); this.ttsVoices = []; this.ttsToken = 0; }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
    this.master = ctx.createGain(); this.master.gain.value = 0.9;
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -10; this.limiter.ratio.value = 12;
    this.af = ctx.createGain(); this.af.gain.value = 0.6;
    this.agc = ctx.createGain(); this.agc.gain.value = 1;
    this.rxIn = ctx.createGain();
    this.filters = [0, 1, 2, 3].map(() => ctx.createBiquadFilter());
    let n = this.rxIn;
    for (const f of this.filters) { n.connect(f); n = f; }
    this.notch = ctx.createBiquadFilter(); this.notch.type = 'allpass';
    n.connect(this.notch); this.notch.connect(this.agc); this.agc.connect(this.af); this.af.connect(this.limiter);
    this.limiter.connect(this.master); this.master.connect(ctx.destination);

    // white noise buffer
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    this.noiseSrc = this.loopNoise();
    this.noiseGain = ctx.createGain(); this.noiseGain.gain.value = 0;
    this.noiseSrc.connect(this.noiseGain); this.noiseGain.connect(this.rxIn);
    // static crashes (QRN)
    const cs = this.loopNoise();
    this.crashGain = ctx.createGain(); this.crashGain.gain.value = 0;
    cs.connect(this.crashGain); this.crashGain.connect(this.rxIn);

    // sidetone / local beeps bypass the IF filter
    this.sideOsc = ctx.createOscillator(); this.sideOsc.frequency.value = 600;
    this.sideGain = ctx.createGain(); this.sideGain.gain.value = 0;
    this.sideOsc.connect(this.sideGain); this.sideGain.connect(this.af);
    this.sideOsc.start();
    this.setMode('USB', 2400, 600);
    this.loadVoices();
  }

  get ready() { return !!this.ctx; }
  get t() { return this.ctx ? this.ctx.currentTime : 0; }

  loopNoise() {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf; s.loop = true;
    s.loopStart = 0; s.start(0, Math.random() * 2.5);
    return s;
  }

  // Manual notch filter (null = off).
  setNotch(hz) { if (!this.ctx) return; if (!hz) { this.notch.type = 'allpass'; return; } this.notch.type = 'notch'; this.notch.frequency.setTargetAtTime(hz, this.t, 0.01); this.notch.Q.value = 18; }
  setMode(mode, width, pitch, shift = 0) {
    if (!this.ctx) return;
    this.mode = mode; this.width = width; this.pitch = pitch;
    const [a, b, c, d] = this.filters;
    const set = (f, type, freq, Q) => { f.type = type; f.frequency.setTargetAtTime(freq, this.t, 0.01); f.Q.value = Q; };
    if (mode === 'CW') {
      const Q = clamp(pitch / width, 0.5, 30), c0 = clamp(pitch + shift, 200, 2500);
      set(a, 'bandpass', c0, Q); set(b, 'bandpass', c0, Q);
      set(c, 'lowpass', 3000, 0.7); set(d, 'highpass', 150, 0.7);
    } else if (mode === 'WFM') {
      set(a, 'highpass', 40, 0.7); set(b, 'highpass', 40, 0.7); set(c, 'lowpass', 15000, 0.7); set(d, 'lowpass', 15000, 0.7);
    } else if (mode === 'FM') {
      set(a, 'highpass', 300, 0.7); set(b, 'highpass', 300, 0.7); set(c, 'lowpass', 3000, 0.7); set(d, 'lowpass', 3000, 0.7);
    } else if (mode === 'AM') {
      set(a, 'highpass', 120, 0.7); set(b, 'highpass', 120, 0.7);
      set(c, 'lowpass', width / 2, 0.7); set(d, 'lowpass', width / 2, 0.7);
    } else {
      const lo = clamp(250 + shift, 50, 2000);
      set(a, 'highpass', lo, 0.7); set(b, 'highpass', lo, 0.7);
      set(c, 'lowpass', lo + width, 0.7); set(d, 'lowpass', lo + width, 0.7);
    }
  }

  // RMS of white noise after the IF filter is ~0.577*sqrt(bw/nyquist); compensate so
  // that `rms` is the level actually heard.
  noiseComp() {
    const bw = this.mode === 'CW' ? this.width * 1.2 : this.mode === 'FM' ? 2700 : this.mode === 'WFM' ? 15000 : this.mode === 'AM' ? this.width / 2 : this.width;
    return 1 / (0.577 * Math.sqrt(bw / (this.ctx.sampleRate / 2)));
  }

  setNoise(rms) { if (this.ctx) this.noiseGain.gain.setTargetAtTime(rms * this.noiseComp(), this.t, 0.05); }
  setAF(v) { if (this.ctx) this.af.gain.setTargetAtTime(v * v * 1.6, this.t, 0.03); }
  setMaster(v) { if (this.ctx) this.master.gain.setTargetAtTime(0.9 * v, this.t, 0.03); }
  setAGC(v) { if (this.ctx) this.agc.gain.setTargetAtTime(v, this.t, 0.08); }

  crash(rms) {
    if (!this.ctx) return;
    const g = this.crashGain.gain, t = this.t, peak = rms * this.noiseComp();
    g.cancelScheduledValues(t);
    g.setValueAtTime(0, t);
    g.linearRampToValueAtTime(peak, t + 0.004);
    g.setTargetAtTime(peak * 0.3, t + 0.01, 0.02);
    g.setTargetAtTime(0, t + 0.04 + Math.random() * 0.1, 0.05);
  }

  // ---- voices ----
  cw(id, segs, start, toneHz) {
    this.remove(id);
    const ctx = this.ctx;
    const osc = ctx.createOscillator(); osc.frequency.value = Math.max(20, toneHz);
    const key = ctx.createGain(); key.gain.value = 0;
    const lvl = ctx.createGain(); lvl.gain.value = 0;
    osc.connect(key); key.connect(lvl); lvl.connect(this.rxIn);
    const g = key.gain;
    for (const s of segs) {
      g.setTargetAtTime(s.amp ?? 1, start + s.t0, 0.004);
      g.setTargetAtTime(0, start + s.t1, 0.004);
    }
    const end = start + (segs.length ? segs[segs.length - 1].t1 : 0) + 0.2;
    osc.start(start); osc.stop(end + 0.1);
    const v = { kind: 'cw', osc, lvl, end };
    osc.onended = () => { if (this.voices.get(id) === v) this.voices.delete(id); try { lvl.disconnect(); } catch (e) { } };
    this.voices.set(id, v);
    return v;
  }

  // Frequency-shift-keyed data (FT8, packet, digital voice). `steps` is [[seconds, Hz], ...]:
  // offsets added to the oscillator's frequency, so retuning still moves the whole signal.
  fsk(id, start, dur, toneHz, steps, type = 'sine') {
    this.remove(id);
    const ctx = this.ctx;
    const osc = ctx.createOscillator(); osc.type = type; osc.frequency.value = Math.max(20, toneHz);
    const key = ctx.createGain(); key.gain.value = 0;
    const lvl = ctx.createGain(); lvl.gain.value = 0;
    osc.connect(key); key.connect(lvl); lvl.connect(this.rxIn);
    key.gain.setTargetAtTime(type === 'sine' ? 1 : 0.5, start, 0.004);
    key.gain.setTargetAtTime(0, start + dur, 0.004);
    const end = start + dur + 0.2;
    if (ctx.createConstantSource) {
      const sh = ctx.createConstantSource(); sh.offset.value = 0; sh.connect(osc.frequency);
      for (const [t, hz] of steps) sh.offset.setValueAtTime(hz, start + t);
      sh.start(start); sh.stop(end + 0.1);
    }
    osc.start(start); osc.stop(end + 0.1);
    const v = { kind: 'cw', osc, lvl, end };
    osc.onended = () => { if (this.voices.get(id) === v) this.voices.delete(id); try { lvl.disconnect(); } catch (e) { } };
    this.voices.set(id, v);
    return v;
  }

  // Unintelligible voice-like sound (mistuned or overlapping SSB/FM).
  babble(id, start, dur, centerHz = 700) {
    this.remove(id);
    const ctx = this.ctx;
    const src = this.loopNoise();
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = clamp(centerHz, 120, 3500); bp.Q.value = 1.4;
    const bp2 = ctx.createBiquadFilter(); bp2.type = 'bandpass'; bp2.frequency.value = clamp(centerHz * 2.3, 200, 4000); bp2.Q.value = 2;
    const env = ctx.createGain(); env.gain.value = 0.45;
    const lfo = ctx.createOscillator(); lfo.frequency.value = rand(3, 5.5);
    const lfo2 = ctx.createOscillator(); lfo2.frequency.value = rand(0.7, 1.6);
    const lg = ctx.createGain(); lg.gain.value = 0.4; const lg2 = ctx.createGain(); lg2.gain.value = 0.25;
    lfo.connect(lg); lg.connect(env.gain); lfo2.connect(lg2); lg2.connect(env.gain);
    const key = ctx.createGain(); key.gain.value = 0;
    const lvl = ctx.createGain(); lvl.gain.value = 0;
    src.connect(bp); src.connect(bp2); bp.connect(env); bp2.connect(env); env.connect(key); key.connect(lvl); lvl.connect(this.rxIn);
    key.gain.setTargetAtTime(9, start, 0.02);
    key.gain.setTargetAtTime(0, start + dur, 0.05);
    lfo.start(start); lfo2.start(start);
    const end = start + dur + 0.3;
    src.stop(end); lfo.stop(end); lfo2.stop(end);
    const v = { kind: 'babble', src, bp, bp2, lvl, end };
    src.onended = () => { if (this.voices.get(id) === v) this.voices.delete(id); try { lvl.disconnect(); } catch (e) { } };
    this.voices.set(id, v);
    return v;
  }

  setVoice(id, { tone, rms }) {
    const v = this.voices.get(id);
    if (!v) return;
    if (tone != null && v.kind === 'cw') v.osc.frequency.setTargetAtTime(clamp(tone, 20, 8000), this.t, 0.01);
    if (tone != null && v.kind === 'babble') { v.bp.frequency.setTargetAtTime(clamp(tone, 120, 3500), this.t, 0.02); v.bp2.frequency.setTargetAtTime(clamp(tone * 2.3, 200, 4000), this.t, 0.02); }
    if (rms != null) v.lvl.gain.setTargetAtTime(v.kind === 'babble' ? rms * 2.5 : rms * 1.414, this.t, 0.04);
  }
  has(id) { return this.voices.has(id); }
  remove(id) {
    const v = this.voices.get(id);
    if (!v) return;
    try { v.lvl.gain.setTargetAtTime(0, this.t, 0.01); (v.osc || v.src).stop(this.t + 0.05); } catch (e) { }
    this.voices.delete(id);
  }

  sidetone(segs, start, pitch, level = 0.25) {
    if (!this.ctx) return;
    this.sideOsc.frequency.setValueAtTime(pitch, start);
    const g = this.sideGain.gain;
    for (const s of segs) { g.setTargetAtTime(level, start + s.t0, 0.004); g.setTargetAtTime(0, start + s.t1, 0.004); }
  }
  // Live key-down / key-up tone for hand keying.
  keyTone(on, pitch, level = 0.25) {
    if (!this.ctx) return;
    if (on && pitch) this.sideOsc.frequency.setValueAtTime(pitch, this.t);
    this.sideGain.gain.cancelScheduledValues(this.t);
    this.sideGain.gain.setTargetAtTime(on ? level : 0, this.t, 0.004);
  }
  stopSidetone() { if (this.ctx) { this.sideGain.gain.cancelScheduledValues(this.t); this.sideGain.gain.setTargetAtTime(0, this.t, 0.005); } }

  beep(freq = 1000, dur = 0.12, level = 0.15, when = 0) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    const t = this.t + when;
    o.frequency.value = freq; g.gain.value = 0;
    g.gain.setTargetAtTime(level, t, 0.005); g.gain.setTargetAtTime(0, t + dur, 0.01);
    o.connect(g); g.connect(this.af); o.start(t); o.stop(t + dur + 0.1);
  }
  click() { this.beep(2400, 0.008, 0.2); }

  // Network voice: MediaStream -> gain -> receiver input.
  // ---- live audio streams (real broadcast stations) ----
  // Played through the receiver chain when the server allows CORS; otherwise played directly
  // with the level set by the simulated signal strength.
  stream(id, url) {
    this.streams ||= new Map();
    let rec = this.streams.get(id);
    if (rec) { rec.seen = performance.now(); return rec; }
    rec = { url, seen: performance.now(), direct: false, node: null, level: 0 };
    const el = new Audio();
    el.crossOrigin = 'anonymous'; el.preload = 'none'; el.src = url;
    rec.el = el;
    try {
      const src = this.ctx.createMediaElementSource(el);
      const g = this.ctx.createGain(); g.gain.value = 0;
      // Two paths: clean, and an off-tune path (hard clipped and thinned) that streamRough() blends in.
      const dry = this.ctx.createGain(); dry.gain.value = 1;
      const wet = this.ctx.createGain(); wet.gain.value = 0;
      const sh = this.ctx.createWaveShaper(); const curve = new Float32Array(257);
      for (let i = 0; i < 257; i++) curve[i] = clamp((i / 128 - 1) * 8, -1, 1) * 0.45;
      sh.curve = curve;
      const hp = this.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1300;
      src.connect(dry); dry.connect(g); src.connect(sh); sh.connect(hp); hp.connect(wet); wet.connect(g);
      g.connect(this.rxIn); rec.node = g; rec.dry = dry; rec.wet = wet;
    } catch (e) { rec.direct = true; }
    el.addEventListener('error', () => {
      if (rec.direct || rec.dead) { rec.dead = true; return; }
      // CORS refused: fall back to direct playback (no receiver filtering)
      rec.direct = true;
      const e2 = new Audio(); e2.src = url; e2.volume = 0; rec.el = e2;
      e2.addEventListener('error', () => { rec.dead = true; });
      e2.play().catch(() => { rec.dead = true; });
    });
    el.play().catch(() => { });
    this.streams.set(id, rec);
    return rec;
  }
  streamLevel(id, level, af = 1) {
    const rec = this.streams?.get(id);
    if (!rec) return;
    rec.level = level;
    if (level > 0.001) rec.seen = performance.now();
    if (rec.direct) rec.el.volume = clamp(level * af * af * 1.6, 0, 1);
    else if (rec.node) rec.node.gain.setTargetAtTime(level, this.t, level > 0.001 ? 0.05 : 0.015); // cut fast, like a receiver leaving a signal
  }
  // How badly off-tune a live stream is (0 clean .. 1): cross-fades towards the distorted path.
  streamRough(id, x) {
    const rec = this.streams?.get(id);
    if (!rec || !rec.dry) return;
    rec.dry.gain.setTargetAtTime(1 - 0.9 * x, this.t, 0.03);
    rec.wet.gain.setTargetAtTime(x, this.t, 0.03);
  }
  // Silence every live stream except the ones the receiver is on right now. A stream whose
  // station has left the band you are listening to is no longer updated by the receiver loop,
  // so without this it would keep playing after you tune away.
  muteStreamsExcept(keep) { if (this.streams) for (const [id, rec] of this.streams) if (!keep.has(id) && rec.level > 0) this.streamLevel(id, 0); }
  streamGC(keepMs = 15000) {
    if (!this.streams) return;
    const t = performance.now();
    for (const [id, rec] of this.streams) if (t - rec.seen > keepMs) { try { rec.el.pause(); rec.el.removeAttribute('src'); rec.el.load(); } catch (e) { } this.streams.delete(id); }
  }
  muteStreams() { if (this.streams) for (const id of this.streams.keys()) this.streamLevel(id, 0); }

  // A real player's voice entering the receiver. `dry` is the correctly-tuned path; `wet`
  // ring-modulates the audio (frequency shift / spectrum inversion) to imitate a mistuned or
  // wrong-sideband SSB signal.
  streamIn(stream) {
    const el = new Audio(); el.muted = true; el.srcObject = stream; el.play().catch(() => { });
    const src = this.ctx.createMediaStreamSource(stream);
    return { ...this.nodeIn(src), el };
  }
  // The same receiver input for audio arriving some other way (the relay): feed `src`.
  nodeIn(src = this.ctx.createGain()) {
    const ctx = this.ctx;
    const out = ctx.createGain(); out.gain.value = 0;
    const dry = ctx.createGain(); dry.gain.value = 1;
    const rm = ctx.createGain(); rm.gain.value = 0;
    const osc = ctx.createOscillator(); osc.frequency.value = 800; osc.connect(rm.gain); osc.start();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2800;
    const wet = ctx.createGain(); wet.gain.value = 0;
    src.connect(dry); dry.connect(out);
    src.connect(rm); rm.connect(lp); lp.connect(wet); wet.connect(out);
    out.connect(this.rxIn);
    return { gain: out, dry, wet, osc, src, input: src };
  }

  // ---- speech synthesis ----
  loadVoices() {
    if (!('speechSynthesis' in window)) return;
    const f = () => { this.ttsVoices = speechSynthesis.getVoices(); };
    f(); speechSynthesis.onvoiceschanged = f;
  }
  pickVoice(lang = 'en-US', seed = 0) {
    const vs = this.ttsVoices;
    if (!vs.length) return null;
    const en = vs.filter((v) => /^en/i.test(v.lang));
    const exact = vs.filter((v) => v.lang.replace('_', '-').toLowerCase() === lang.toLowerCase());
    // Hams worldwide mostly use English on the air; prefer an accent-matching English voice.
    const accent = en.filter((v) => v.lang.replace('_', '-').toLowerCase() === lang.toLowerCase());
    const pool = accent.length ? accent : (exact.length && Math.abs(seed) % 4 === 0 ? exact : en.length ? en : vs);
    return pool[Math.abs(seed) % pool.length];
  }
  speak(text, { lang, seed, rate = 1, pitch = 1, volume = 1 } = {}) {
    if (!('speechSynthesis' in window)) return Promise.resolve(false);
    const token = ++this.ttsToken;
    return new Promise((res) => {
      const u = new SpeechSynthesisUtterance(text);
      const v = this.pickVoice(lang, seed);
      if (v) { u.voice = v; u.lang = v.lang; }
      u.rate = clamp(rate, 0.5, 2); u.pitch = clamp(pitch, 0, 2); u.volume = clamp(volume, 0, 1);
      u.onend = () => res(token === this.ttsToken);
      u.onerror = () => res(false);
      // Chrome can drop an utterance queued in the same instant as a cancel(), so leave a short gap.
      const wait = Math.max(0, 70 - (performance.now() - (this.cancelAt || -1e9)));
      if (wait) setTimeout(() => { if (token === this.ttsToken) speechSynthesis.speak(u); else res(false); }, wait); else speechSynthesis.speak(u);
      setTimeout(() => res(false), 30000);
    });
  }
  cancelSpeech() { if ('speechSynthesis' in window) { this.ttsToken++; this.cancelAt = performance.now(); speechSynthesis.cancel(); } }
  get speaking() { return 'speechSynthesis' in window && speechSynthesis.speaking; }
}

export const audio = new AudioEngine();
