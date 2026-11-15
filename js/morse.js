// Morse code tables and timing (PARIS standard: dit = 1.2 / WPM seconds).
export const MORSE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..',
  M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
  Y: '-.--', Z: '--..', 0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...',
  8: '---..', 9: '----.', '?': '..--..', '/': '-..-.', '=': '-...-', ',': '--..--', '.': '.-.-.-', '+': '.-.-.',
  '<AR>': '.-.-.', '<SK>': '...-.-', '<KN>': '-.--.', '<BT>': '-...-', '<BK>': '-...-.-',
};

export function tokenize(text) {
  const out = [];
  const re = /<[A-Z]{2}>|./g;
  let m;
  const t = String(text).toUpperCase();
  while ((m = re.exec(t))) out.push(m[0]);
  return out;
}

// Returns { segs: [{t0,t1,amp}], chars: [{c,t}], dur }
// Special: '~' = a 1-second key-down (used by beacons), with amp steps via '~1'..'~4'.
export function schedule(text, wpm, opts = {}) {
  const u = 1.2 / wpm;
  const fw = opts.farnsworth ? Math.max(wpm, opts.farnsworth) : null;
  const gapU = fw ? (1.2 / opts.farnsworth) : u;
  const segs = [], chars = [];
  let t = 0;
  let amp = 1;
  for (const tok of tokenize(text)) {
    if (tok === ' ') { t += 4 * gapU; chars.push({ c: ' ', t }); continue; }
    if (tok === '~') { segs.push({ t0: t, t1: t + 1.0, amp }); t += 1.0 + 3 * u; amp *= 0.32; continue; }
    const code = MORSE[tok];
    if (!code) continue;
    chars.push({ c: tok.length > 1 ? tok.replace(/[<>]/g, '') : tok, t });
    for (const el of code) {
      const len = el === '.' ? u : 3 * u;
      segs.push({ t0: t, t1: t + len, amp });
      t += len + u;
    }
    t += 2 * gapU;
  }
  return { segs, chars, dur: t };
}

export const duration = (text, wpm) => schedule(text, wpm).dur;

// Cut numbers used in contests (5NN = 599).
export function cut(n) { return String(n).replace(/9/g, 'N').replace(/^0+/, (z) => 'T'.repeat(z.length)); }
