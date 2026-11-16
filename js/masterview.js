// 🎛 Master view: every control on the radio at once (the things real rigs hide in menus and
// second-function keys), plus a live look inside the box — the receive and transmit signal chains
// with the actual numbers flowing through them.
import { S, save } from './state.js';
import { h, bus, clamp } from './util.js';
import { rig, gearOf } from './rigs.js';
import { rx, reapplyMode, updateDisplay, setFreq, effectiveSwr } from './radio.js';
import { maxPower, powerChain } from './store.js';
import { txState } from './operating.js';
import { rigStatus } from './shack.js';
import { fmtFreq } from './util.js';

const R = () => S.radio;
let root, timer = null;

export function mountMaster(el) {
  root = el;
  render();
  if (timer) return;
  timer = setInterval(() => { if (S.settings.master && root?.isConnected && !document.hidden) live(); }, 300);
  bus.on('rig', () => render());
}

const seg = (opts, cur, fn, { dis } = {}) => h('div', { class: 'mv-seg' }, ...opts.map(([v, l]) => h('button', { class: `rbtn ${cur === v ? 'active' : ''}`, disabled: dis, onclick: () => { fn(v); save(); reapplyMode(); updateDisplay(); render(); } }, l)));
const tog = (lbl, on, fn, { dis, title } = {}) => h('button', { class: `rbtn ${on ? 'active' : ''}`, disabled: dis, title: dis ? 'Not on this radio model' : title || '', onclick: () => { fn(!on); save(); reapplyMode(); updateDisplay(); render(); } }, lbl);
function sl(lbl, min, max, step, val, fn, fmt, { dis, id } = {}) {
  const out = h('span', { class: 'val' }, fmt(val));
  const i = h('input', { type: 'range', min, max, step, value: val, disabled: dis, id });
  i.oninput = () => { fn(+i.value); out.textContent = fmt(+i.value); save(); reapplyMode(); };
  i.ondblclick = () => { const d = (min + max) / 2; if (min < 0) { i.value = 0; fn(0); out.textContent = fmt(0); save(); reapplyMode(); } else void d; };
  return h('label', { class: 'knobrow' }, h('span', {}, lbl), i, out);
}

export function render() {
  if (!root) return;
  root.innerHTML = '';
  root.hidden = !S.settings.master;
  if (!S.settings.master) return;
  const r = R(), rg = rig();
  r.vfoB ??= r.freq + 5000;
  const grp = (title, ...kids) => h('div', { class: 'ctl-group mv-grp' }, h('div', { class: 'ctl-title' }, title), ...kids);
  root.append(
    h('div', { class: 'mv-head row spread' }, h('b', {}, `🎛 MASTER VIEW — every control on the ${rg.name}`), h('span', { class: 'muted tiny' }, 'Greyed controls don\'t exist on this model. Double-click a slider to centre it.')),
    h('div', { class: 'mv-grid' },
      grp('VFO',
        h('div', { class: 'mv-vfo' }, h('div', {}, h('span', { class: 'tiny muted' }, 'VFO A (RX)'), h('b', { class: 'mono' }, fmtFreq(r.freq))), h('div', {}, h('span', { class: 'tiny muted' }, `VFO B${r.split ? ' (TX)' : ''}`), h('b', { class: 'mono' }, fmtFreq(r.vfoB)))),
        h('div', { class: 'row' },
          h('button', { class: 'rbtn', onclick: () => { const a = r.freq; setFreq(r.vfoB); r.vfoB = a; save(); render(); } }, 'A/B'),
          h('button', { class: 'rbtn', onclick: () => { r.vfoB = r.freq; save(); render(); } }, 'A=B'),
          h('button', { class: 'rbtn', onclick: () => { r.vfoB = r.freq + 5000; r.split = true; save(); render(); updateDisplay(); }, title: 'Classic DX pileup: listen here, transmit 5 kHz up' }, 'UP 5'),
          tog('SPLIT', !!r.split, (v) => { r.split = v; }, { title: 'Transmit on VFO B, receive on VFO A (DXpeditions work "split")' })),
        sl('RIT', -2000, 2000, 10, r.rit, (v) => { r.rit = v; r.ritOn = v !== 0; updateDisplay(); }, (v) => `${v >= 0 ? '+' : ''}${v} Hz`)),
      grp('RF FRONT END',
        h('div', { class: 'knobrow' }, h('span', {}, 'PREAMP'), seg([[0, 'OFF'], [1, 'P.AMP 1'], [2, 'P.AMP 2']].filter(([v]) => v <= (rg.preamps ?? 1)), r.preamp || 0, (v) => { r.preamp = v; })),
        h('div', { class: 'knobrow' }, h('span', {}, 'ATT'), seg([[0, 'OFF'], [6, '6 dB'], [12, '12 dB'], [18, '18 dB']], r.rfAtt || 0, (v) => { r.rfAtt = v; })),
        sl('RF GAIN', 0, 1, 0.01, r.rfGain ?? 1, (v) => { r.rfGain = v; }, (v) => `${Math.round(v * 100)}`),
        h('p', { class: 'tiny muted' }, 'Preamps help on 15 m and up where the band is quiet; on 80/40 m the atmospheric noise is already louder than the radio — use ATT instead.')),
      grp('IF / DSP',
        h('div', { class: 'knobrow' }, h('span', {}, 'AGC'), seg([['fast', 'FAST'], ['mid', 'MID'], ['slow', 'SLOW'], ['off', 'OFF']], r.agcSpd || 'mid', (v) => { r.agcSpd = v; }, { dis: rg.agc === false })),
        sl('IF SHIFT', -1200, 1200, 20, r.ifShift || 0, (v) => { r.ifShift = v; }, (v) => `${v >= 0 ? '+' : ''}${v} Hz`, { dis: !rg.ifs }),
        h('div', { class: 'row' },
          tog('NB', !!r.nb, (v) => { r.nb = v; }, { title: 'Noise blanker: gates impulse noise (static crashes, ignition)' }),
          tog('NR', !!r.nr, (v) => { r.nr = v; }, { dis: !rg.dsp, title: 'DSP noise reduction' }),
          tog('NOTCH', !!r.notch, (v) => { r.notch = v; }, { dis: !rg.notch, title: 'Manual notch: removes a steady carrier/tone' })),
        sl('NOTCH Hz', 300, 3000, 10, r.notchHz || 1000, (v) => { r.notchHz = v; }, (v) => `${v}`, { dis: !rg.notch || !r.notch })),
      grp('CW',
        sl('KEY SPEED', 10, 40, 1, S.settings.myWpm || 22, (v) => { S.settings.myWpm = v; }, (v) => `${v} wpm`),
        sl('PITCH', 300, 1000, 10, r.pitch, (v) => { r.pitch = v; }, (v) => `${v} Hz`),
        h('div', { class: 'tiny muted' }, `Key: ${gearOf('key').name}`)),
      grp('TRANSMIT',
        sl('POWER', 5, maxPower(), 5, Math.min(r.power, maxPower()), (v) => { r.power = v; updateDisplay(); }, (v) => `${v} W`),
        sl('MIC GAIN', 0, 1, 0.01, r.micGain ?? 0.5, (v) => { r.micGain = v; }, (v) => `${Math.round(v * 100)}`),
        h('div', { class: 'row' }, tog('COMP', !!r.comp, (v) => { r.comp = v; }, { title: 'Speech processor: ~2.5 dB more average talk power on SSB' }),
          tog('ATU', !!r.atuOn, (v) => { r.atuOn = v; }, { dis: !rg.atu })),
        h('div', { class: 'mv-alc' }, h('span', { class: 'tiny' }, 'ALC'), h('div', { class: 'mv-bar' }, h('i', { id: 'mv-alc' }))),
        powerChain().limits.length ? h('div', { class: 'tiny warn' }, '⚠ ' + powerChain().limits.join('; ')) : null)),
    h('div', { class: 'mv-chain' },
      h('div', { class: 'ctl-title' }, 'INSIDE THE RADIO — RECEIVE CHAIN'),
      h('div', { class: 'mv-flow', id: 'mv-rx' }),
      h('div', { class: 'ctl-title' }, 'TRANSMIT CHAIN'),
      h('div', { class: 'mv-flow', id: 'mv-tx' })));
  live();
}

function block(name, val, note, cls = '') { return `<div class="mv-blk ${cls}"><b>${name}</b><span>${val}</span>${note ? `<i>${note}</i>` : ''}</div>`; }
const arrow = '<div class="mv-arr">→</div>';
function live() {
  const rxEl = document.getElementById('mv-rx'), txEl = document.getElementById('mv-tx');
  if (!rxEl) return;
  const r = R(), rg = rig(), rs = rigStatus();
  const sig = rx.strongest ? rx.strongest.dbm : null;
  const swr = rs.powered ? effectiveSwr(r.freq) : 0;
  const dbm = (v) => (v == null ? '—' : `${v.toFixed(0)} dBm`);
  rxEl.innerHTML = [
    block('ANTENNA', S.antenna.built ? `${S.antenna.type}` : 'none', `${S.antenna.feedLen} ft ${S.antenna.feed}`),
    block('ATU', r.atuOn && rg.atu ? 'IN' : 'thru', `SWR ${swr > 50 ? '∞' : swr.toFixed(1)}`, r.atuOn ? 'on' : ''),
    block('ATT / PRE', `${r.rfAtt ? `−${r.rfAtt} dB` : r.preamp ? `P${r.preamp}` : 'flat'}`, `RF gain ${Math.round((r.rfGain ?? 1) * 100)}`),
    block('BPF', r.freq < 30e6 ? 'HF band filter' : 'VHF', `${(r.freq / 1e6).toFixed(3)} MHz`),
    block(rg.look === 'touch' || rg.look === 'sdr' || rg.look === 'portable' ? 'ADC (SDR)' : 'MIXER', 'signal', dbm(sig)),
    block('IF FILTER', `${rx.bw >= 1000 ? (rx.bw / 1000).toFixed(1) + ' kHz' : rx.bw + ' Hz'}`, rg.ifs && r.ifShift ? `shift ${r.ifShift > 0 ? '+' : ''}${r.ifShift}` : 'centred'),
    block('NB / NR', `${r.nb ? 'NB' : ''}${r.nb && r.nr ? '+' : ''}${r.nr && rg.dsp ? 'NR' : ''}` || 'off', r.notch ? `notch ${r.notchHz || 1000} Hz` : '', r.nb || r.nr ? 'on' : ''),
    block('AGC', `${(rx.agcDb ?? 0).toFixed(0)} dB`, (r.agcSpd || 'mid').toUpperCase()),
    block('DEMOD', r.mode, `noise ${dbm(rx.noiseDbm)}`),
    block('AF', `${Math.round(r.af * 100)}`, 'speaker'),
  ].join(arrow);
  const tx = txState.active;
  const mg = r.micGain ?? 0.5;
  const alc = tx && r.mode !== 'CW' ? clamp(mg * (r.comp ? 1.25 : 1), 0, 1.2) : 0;
  const bar = document.getElementById('mv-alc');
  if (bar) { bar.style.width = `${Math.min(100, alc * 100)}%`; bar.className = alc > 0.85 ? 'over' : ''; }
  const amp = gearOf('amp');
  txEl.innerHTML = [
    block(r.mode === 'CW' ? 'KEYER' : 'MIC', r.mode === 'CW' ? `${S.settings.myWpm || 22} wpm` : gearOf('mic').name.replace('Stock ', ''), r.mode === 'CW' ? gearOf('key').name : `gain ${Math.round(mg * 100)}`),
    block('PROC', r.comp && r.mode !== 'CW' ? 'COMP' : 'off', '', r.comp ? 'on' : ''),
    block('MODULATOR', r.mode, r.split ? `TX on VFO B ${(r.vfoB / 1e6).toFixed(3)}` : ''),
    block('PA', tx ? `${Math.round(txState.watts)} W` : `${Math.min(r.power, maxPower())} W set`, `max ${rg.maxW} W`, tx ? 'tx' : ''),
    amp.out ? block('AMPLIFIER', amp.name.split(' ').slice(-1)[0], `${amp.out} W`) : '',
    block('LPF', 'harmonics −50 dB', ''),
    block('SWR BRIDGE', swr > 50 ? '∞' : swr.toFixed(2), swr > 2 ? 'fold-back!' : 'OK', swr > 2 ? 'bad' : ''),
    block('ANTENNA', S.antenna.built ? 'radiating' : 'none', ''),
  ].filter(Boolean).join(arrow);
}
