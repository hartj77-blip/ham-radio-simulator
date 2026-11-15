// US amateur bands and license privileges (FCC Part 97.301 / 97.305), simplified:
// 60 m and 70 cm+ omitted. 'CW' = CW only, 'CWDATA' = CW + RTTY/data, 'ALL' = phone/image/CW/data.
export const BANDS = [
  { name: '160m', lo: 1800000, hi: 2000000, def: 1840000, defMode: 'LSB', cw: [1800000, 1840000], ph: [1843000, 2000000] },
  { name: '80m', lo: 3500000, hi: 4000000, def: 3860000, defMode: 'LSB', cw: [3500000, 3570000], ph: [3800000, 4000000] },
  { name: '40m', lo: 7000000, hi: 7300000, def: 7200000, defMode: 'LSB', cw: [7000000, 7060000], ph: [7175000, 7300000] },
  { name: '30m', lo: 10100000, hi: 10150000, def: 10110000, defMode: 'CW', cw: [10100000, 10140000], ph: null },
  { name: '20m', lo: 14000000, hi: 14350000, def: 14250000, defMode: 'USB', cw: [14000000, 14070000], ph: [14150000, 14350000] },
  { name: '17m', lo: 18068000, hi: 18168000, def: 18130000, defMode: 'USB', cw: [18068000, 18100000], ph: [18110000, 18168000] },
  { name: '15m', lo: 21000000, hi: 21450000, def: 21300000, defMode: 'USB', cw: [21000000, 21070000], ph: [21200000, 21450000] },
  { name: '12m', lo: 24890000, hi: 24990000, def: 24950000, defMode: 'USB', cw: [24890000, 24915000], ph: [24930000, 24990000] },
  { name: '10m', lo: 28000000, hi: 29700000, def: 28400000, defMode: 'USB', cw: [28000000, 28070000], ph: [28300000, 28700000] },
  { name: '6m', lo: 50000000, hi: 54000000, def: 50125000, defMode: 'USB', cw: [50000000, 50100000], ph: [50100000, 50300000] },
  { name: '2m', lo: 144000000, hi: 148000000, def: 146520000, defMode: 'FM', cw: [144000000, 144100000], ph: [144200000, 144275000] },
];

const S = (lo, hi, allow, lic, note) => ({ lo: lo * 1000, hi: hi * 1000, allow, lic, note });
export const SEGMENTS = [
  S(1800, 2000, 'ALL', ['E', 'G']),
  S(3500, 3600, 'CWDATA', ['E']), S(3525, 3600, 'CWDATA', ['G']), S(3525, 3600, 'CW', ['T']),
  S(3600, 4000, 'ALL', ['E']), S(3800, 4000, 'ALL', ['G']),
  S(7000, 7125, 'CWDATA', ['E']), S(7025, 7125, 'CWDATA', ['G']), S(7025, 7125, 'CW', ['T']),
  S(7125, 7300, 'ALL', ['E']), S(7175, 7300, 'ALL', ['G']),
  S(10100, 10150, 'CWDATA', ['E', 'G'], '200 W PEP max'),
  S(14000, 14150, 'CWDATA', ['E']), S(14025, 14150, 'CWDATA', ['G']),
  S(14150, 14350, 'ALL', ['E']), S(14225, 14350, 'ALL', ['G']),
  S(18068, 18110, 'CWDATA', ['E', 'G']), S(18110, 18168, 'ALL', ['E', 'G']),
  S(21000, 21200, 'CWDATA', ['E']), S(21025, 21200, 'CWDATA', ['G']), S(21025, 21200, 'CW', ['T']),
  S(21200, 21450, 'ALL', ['E']), S(21275, 21450, 'ALL', ['G']),
  S(24890, 24930, 'CWDATA', ['E', 'G']), S(24930, 24990, 'ALL', ['E', 'G']),
  S(28000, 28300, 'CWDATA', ['E', 'G', 'T']), S(28300, 28500, 'ALL', ['E', 'G', 'T']), S(28500, 29700, 'ALL', ['E', 'G']),
  S(50000, 50100, 'CW', ['E', 'G', 'T']), S(50100, 54000, 'ALL', ['E', 'G', 'T']),
  S(144000, 144100, 'CW', ['E', 'G', 'T']), S(144100, 148000, 'ALL', ['E', 'G', 'T']),
];

export function bandOf(hz) { return BANDS.find((b) => hz >= b.lo && hz <= b.hi) || null; }
export function bandByName(n) { return BANDS.find((b) => b.name === n); }

export const modeClass = (mode) => (mode === 'CW' ? 'CW' : 'PHONE');
const allows = (seg, cls) => seg.allow === 'ALL' || cls === 'CW' || (cls === 'DATA' && seg.allow === 'CWDATA');

// Occupied spectrum for a transmission on dial frequency hz.
export function occupied(hz, mode) {
  switch (mode) {
    case 'USB': return [hz + 100, hz + 2900];
    case 'LSB': return [hz - 2900, hz - 100];
    case 'AM': return [hz - 3000, hz + 3000];
    case 'FM': return [hz - 8000, hz + 8000];
    default: return [hz - 75, hz + 75];
  }
}

function merged(lic, cls) {
  const segs = SEGMENTS.filter((s) => s.lic.includes(lic) && allows(s, cls)).map((s) => [s.lo, s.hi]).sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const s of segs) {
    const last = out[out.length - 1];
    if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1]); else out.push([...s]);
  }
  return out;
}

const LN = { T: 'Technician', G: 'General', E: 'Extra' };

// Returns {ok, reason, code}
export function checkTx(lic, hz, mode) {
  const band = bandOf(hz);
  const [a, b] = occupied(hz, mode);
  if (!band) return { ok: false, code: 'outband', reason: `${(hz / 1e6).toFixed(4)} MHz is not in an amateur band. Transmitting here is illegal.` };
  if (!lic) return { ok: false, code: 'nolicense', reason: 'You need a license to transmit. Pass the Technician exam on the License tab.' };
  const cls = modeClass(mode);
  const ok = merged(lic, cls).some(([lo, hi]) => a >= lo && b <= hi);
  if (ok) return { ok: true };
  // Explain why.
  if (a < band.lo || b > band.hi) {
    return { ok: false, code: 'edge', reason: `Your ${mode} signal occupies ${(a / 1e3).toFixed(1)}–${(b / 1e3).toFixed(1)} kHz, which spills outside the ${band.name} band edge. Remember: ${mode === 'USB' || mode === 'LSB' ? 'an SSB signal extends about 3 kHz to one side of the dial frequency.' : 'keep your whole signal inside the band.'}` };
  }
  const anyPriv = SEGMENTS.some((s) => s.lic.includes(lic) && hz >= s.lo && hz <= s.hi);
  const phoneHere = SEGMENTS.some((s) => s.lic.includes(lic) && hz >= s.lo && hz <= s.hi && s.allow === 'ALL');
  if (anyPriv && cls === 'PHONE' && !phoneHere) return { ok: false, code: 'mode', reason: `This part of ${band.name} is CW/data only for ${LN[lic]} class. Phone (voice) is not permitted here.` };
  if (anyPriv) return { ok: false, code: 'edge', reason: `Part of your signal (${(a / 1e3).toFixed(1)}–${(b / 1e3).toFixed(1)} kHz) falls outside your ${LN[lic]} sub-band. Move a few kHz further inside.` };
  return { ok: false, code: 'privilege', reason: `${LN[lic]} licensees have no ${cls === 'PHONE' ? 'phone ' : ''}privileges at ${(hz / 1e3).toFixed(1)} kHz on ${band.name}.` };
}

// For drawing: privilege intervals [lo,hi,allow] for license within band.
export function privilegeMap(lic, band) {
  if (!lic) return [];
  return SEGMENTS.filter((s) => s.lic.includes(lic) && s.hi > band.lo && s.lo < band.hi).map((s) => ({ lo: s.lo, hi: s.hi, allow: s.allow }));
}

export const SIDEBAND_FOR = (hz) => (hz < 10e6 ? 'LSB' : 'USB');

// 2 m repeater & CTCSS
export const CTCSS = [0, 67.0, 71.9, 74.4, 77.0, 79.7, 82.5, 85.4, 88.5, 91.5, 94.8, 97.4, 100.0, 103.5, 107.2, 110.9, 114.8, 118.8, 123.0, 127.3, 131.8, 136.5, 141.3, 146.2, 151.4, 156.7, 162.2, 167.9, 173.8, 179.9, 186.2, 192.8, 203.5];
