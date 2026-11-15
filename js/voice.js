// Push-to-talk voice: microphone capture + speech recognition, and a parser that
// turns spoken ham-speak ("kilo delta nine x-ray yankee zulu, five nine") into text.
import { S } from './state.js';
import { lev } from './util.js';
import { STATES } from './data/world.js';

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

export const voice = {
  recogSupported: !!SR,
  micStream: null,
  micError: null,
  recog: null,
  finalText: '',
  interim: '',

  async getMic() {
    if (this.micStream) return this.micStream;
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      return this.micStream;
    } catch (e) { this.micError = e.message || String(e); return null; }
  },

  start(onInterim) {
    this.finalText = ''; this.interim = '';
    if (!SR) return false;
    try {
      const r = new SR();
      r.lang = 'en-US'; r.interimResults = true; r.continuous = true; r.maxAlternatives = 1;
      r.onresult = (ev) => {
        let fin = '', inter = '';
        for (let i = 0; i < ev.results.length; i++) {
          if (ev.results[i].isFinal) fin += ev.results[i][0].transcript + ' ';
          else inter += ev.results[i][0].transcript + ' ';
        }
        this.finalText = fin; this.interim = inter;
        onInterim && onInterim(fin + inter);
      };
      r.onerror = (e) => { this.lastError = e.error; };
      r.start();
      this.recog = r;
      return true;
    } catch (e) { this.lastError = String(e); return false; }
  },

  stop() {
    return new Promise((res) => {
      const r = this.recog;
      if (!r) return res('');
      let done = false;
      const finish = () => { if (done) return; done = true; this.recog = null; res((this.finalText + ' ' + this.interim).trim()); };
      r.onend = finish;
      try { r.stop(); } catch (e) { finish(); }
      setTimeout(finish, 1500);
    });
  },
};

const PHON = {
  alpha: 'A', alfa: 'A', bravo: 'B', charlie: 'C', charley: 'C', delta: 'D', echo: 'E', eco: 'E', foxtrot: 'F', fox: 'F', golf: 'G',
  hotel: 'H', india: 'I', juliet: 'J', juliett: 'J', kilo: 'K', keylo: 'K', lima: 'L', mike: 'M', november: 'N', oscar: 'O',
  papa: 'P', poppa: 'P', quebec: 'Q', romeo: 'R', sierra: 'S', ciara: 'S', tango: 'T', uniform: 'U', victor: 'V', whiskey: 'W',
  whisky: 'W', xray: 'X', 'x-ray': 'X', yankee: 'Y', zulu: 'Z',
  zero: '0', one: '1', two: '2', three: '3', tree: '3', four: '4', five: '5', fife: '5', six: '6', seven: '7', eight: '8', nine: '9', niner: '9',
};
const PHRASES = [
  [/\bx ray\b/g, 'xray'], [/\bseventy[- ]three\b/g, ' 73 '], [/\bthis is\b/g, ' DE '], [/\bsay again\b/g, ' AGN '],
  [/\bplease repeat\b/g, ' AGN '], [/\bagain\b/g, ' AGN '], [/\bthank you\b/g, ' TU '], [/\bthanks\b/g, ' TU '],
  [/\bfive by nine\b/g, ' five nine '], [/\b(seek you|see you|sea queue|c q)\b/g, ' CQ '], [/\bq r z\b/g, ' QRZ '],
  [/\bcontest\b/g, ' TEST '], [/\bfield day\b/g, ' FD '], [/\bover\b/g, ' K '], [/\bclear\b/g, ' CL '], [/\broger\b/g, ' R '],
  [/\bmy name is\b/g, ' NAME '], [/\bname here is\b/g, ' NAME '], [/\bname is\b/g, ' NAME '], [/\bstroke\b|\bslash\b|\bportable\b/g, ' / '],
  [/\bfifty[- ]nine\b/g, ' 59 '], [/\bfive[- ]nine\b/g, ' 59 '],
];
const STATE_PHRASES = STATES.map((s) => [s.name.toLowerCase(), s.abbr]).sort((a, b) => b[0].length - a[0].length);

const CALL_RE = /^([A-Z]{1,2}|[0-9][A-Z]|[A-Z][0-9])[0-9][A-Z]{1,4}$/;

export function normalizeSpeech(text, knownCalls = []) {
  let t = ' ' + String(text).toLowerCase().replace(/[.,!?;:]/g, ' ') + ' ';
  for (const [re, rep] of PHRASES) t = t.replace(re, rep);
  for (const [name, ab] of STATE_PHRASES) t = t.replace(new RegExp(`\\b${name}\\b`, 'g'), ` @${ab} `);
  const words = t.split(/\s+/).filter(Boolean);
  const out = [];
  let buf = '';
  const flush = () => { if (buf) out.push(buf); buf = ''; };
  for (const w0 of words) {
    if (w0.startsWith('@')) { flush(); out.push(w0.slice(1)); continue; }
    const w = w0.replace(/[^a-z0-9/-]/g, '');
    let ch = PHON[w];
    if (!ch && /^[a-z0-9]{1,4}$/.test(w0) && /\d/.test(w0)) ch = w0.toUpperCase(); // "kd9" style fragments
    if (!ch && /^[b-hj-z]$/.test(w0)) ch = w0.toUpperCase();
    if (!ch && /^\d+$/.test(w0)) ch = w0;
    if (ch) {
      // split heuristics: callsign followed by digits, or a long number followed by letters
      if (buf && CALL_RE.test(buf) && /^\d/.test(ch)) flush();
      else if (buf && /^\d{2,}$/.test(buf) && /^[A-Z]/.test(ch)) flush();
      buf += ch;
    } else {
      flush();
      out.push(w0.toUpperCase());
    }
  }
  flush();
  // snap near-miss callsigns (speech recognition errors) to known ones
  const known = [S.call, ...knownCalls].filter(Boolean);
  return out.map((tok) => {
    if (tok.length < 4 || !/\d/.test(tok)) return tok;
    let best = tok, bd = 2;
    for (const k of known) { const d = lev(tok, k); if (d < bd || (d === bd && d <= 1)) { best = k; bd = d; } }
    return bd <= 1 ? best : tok;
  }).join(' ');
}
