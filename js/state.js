// Persistent game state (localStorage).
import { bus } from './util.js';

const KEY = 'hamshack-sim-v1';

export const defaultState = () => ({
  v: 1,
  started: false,
  op: { name: '', state: 'KS' },
  license: null, // null | 'T' | 'G' | 'E'
  call: null,
  xp: 0,
  shack: { conn: [], psuOn: false, rigOn: false, fuseBlown: false, autoWired: false },
  antenna: {
    type: 'dipole', length: 0, height: 30, axis: 0, heading: 45, radials: 4,
    feed: 'RG-8X', feedLen: 75, built: false, spliced: 0,
  },
  radio: {
    freq: 14250000, mode: 'USB', step: 100, af: 0.6, rfAtt: 0, sql: 0.15,
    filter: { CW: 500, USB: 2400, LSB: 2400, AM: 6000, FM: 12000, WFM: 150000 },
    power: 100, rit: 0, ritOn: false, pitch: 600,
    atuOn: false, atuTunedFreq: null, atuExtTunedFreq: null,
    rptOffset: 0, toneHz: 0, meter: 'S', nb: false, lastByBand: {},
  },
  log: [],
  exams: { T: false, G: false, E: false, history: [] },
  tips: [],
  scores: {},
  settings: {
    subtitles: true, decoder: true, myWpm: 22, sandbox: false, hour: null,
    esm: true, sfiMode: 'random', ttsRate: 1.05,
  },
  stats: { violations: 0, fuses: 0 },
});

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const d = JSON.parse(raw);
    return deepMerge(defaultState(), d);
  } catch (e) {
    console.warn('state load failed', e);
    return defaultState();
  }
}

function deepMerge(base, over) {
  for (const k of Object.keys(over || {})) {
    const v = over[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
      base[k] = deepMerge(base[k], v);
    } else base[k] = v;
  }
  return base;
}

export const S = load();

let saveTimer = null;
export function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore quota */ }
  }, 250);
}

export function resetAll() {
  localStorage.removeItem(KEY);
  location.reload();
}

export function addXp(n, why) {
  S.xp += n;
  save();
  bus.emit('xp', n, why);
}

export const LIC_NAMES = { T: 'Technician', G: 'General', E: 'Amateur Extra' };
export function licName(l = S.license) { return l ? LIC_NAMES[l] : 'Unlicensed (SWL)'; }
export function level(xp = S.xp) { return Math.floor(Math.sqrt(xp / 50)) + 1; }
