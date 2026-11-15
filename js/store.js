// Hamfest: earn credits by operating, buy upgrades that change the physics of your station.
import { S, save } from './state.js';
import { h, toast, bus } from './util.js';
import { RIGS, rig } from './rigs.js';

export const ITEMS = [
  ...Object.entries(RIGS).filter(([, r]) => r.price).map(([id, r]) => ({ id: `rig-${id}`, cat: 'Radios', name: r.name, price: r.price, icon: id === 'ht' ? '📟' : id === 'sdrrx' ? '📡' : '📻', desc: `${r.cls}. ${r.blurb}` })),
  { id: 'antswitch', cat: 'Antennas', name: 'Antenna switch (3-way)', price: 80, icon: '🔀', desc: 'Keep up to three antennas up at once and switch between them from the radio.' },
  { id: 'rg213', cat: 'Feedline', name: 'RG-213 coax (100 ft)', price: 60, icon: '🧵', desc: 'Thick, low-loss coax. About half the loss of RG-8X on 10 m.' },
  { id: 'lmr400', cat: 'Feedline', name: 'LMR-400 coax (100 ft)', price: 120, icon: '🧵', desc: 'Foam low-loss cable. The VHF favourite.' },
  { id: 'mast50', cat: 'Supports', name: '50 ft telescoping mast', price: 150, icon: '🗼', desc: 'Get wires above the trees. Raises your max antenna height to 50 ft.' },
  { id: 'tower70', cat: 'Supports', name: '70 ft lattice tower', price: 600, icon: '🗼', desc: 'Serious DX height. Max antenna height 70 ft.', needs: 'mast50' },
  { id: 'tower100', cat: 'Supports', name: '100 ft tower', price: 1500, icon: '🗼', desc: 'Contest-station height. Max antenna height 100 ft.', needs: 'tower70' },
  { id: 'unun', cat: 'Antennas', name: '49:1 unun (EFHW kit)', price: 50, icon: '🧲', desc: 'Unlocks the end-fed half-wave antenna.' },
  { id: 'yagi', cat: 'Antennas', name: '3-element Yagi kit', price: 350, icon: '📡', desc: 'Unlocks the Yagi beam (~6 dB forward gain).' },
  { id: 'rotator', cat: 'Antennas', name: 'Antenna rotator', price: 250, icon: '🔄', desc: 'Turn your beam from the shack. Without it the Yagi is stuck where you aimed it.' },
  { id: 'cwfilter', cat: 'Radio', name: 'Narrow CW filters (400/250 Hz)', price: 80, icon: '🎚', desc: 'Dig weak CW out of a pileup. Narrower filter = less noise.' },
  { id: 'dsp', cat: 'Radio', name: 'DSP noise reduction', price: 120, icon: '🔇', desc: 'Adds an NR button: quieter background hiss and better CW decoding.' },
  { id: 'amp500', cat: 'Power', name: '500 W linear amplifier', price: 700, icon: '⚡', desc: 'About +7 dB over 100 W. Mind your license power limits!' },
  { id: 'amp1500', cat: 'Power', name: 'Legal-limit amplifier (1500 W)', price: 1800, icon: '⚡', desc: 'The US legal limit (1500 W PEP). General class or higher on most HF bands.', needs: 'amp500' },
];

export const money = () => S.money ?? (S.money = 100);
export const freePlay = () => S.gameMode === 'free' || S.gameMode === 'listener';
export const owns = (id) => freePlay() || id === 'rig-allmode' || (S.owned || []).includes(id);
export function earn(n, why) {
  S.money = money() + n; save();
  bus.emit('money', n, why);
}
export const maxHeight = () => (owns('tower100') ? 100 : owns('tower70') ? 70 : owns('mast50') ? 50 : 35);
// Amplifiers need ~50–100 W of drive, so they only help with a full-power radio.
export const maxPower = () => { const r = rig(); if (r.maxW >= 50) return owns('amp1500') ? 1500 : owns('amp500') ? 500 : r.maxW; return r.maxW; };
export const feedOwned = (f) => f === 'RG-58' || f === 'RG-8X' || (f === 'RG-213' && owns('rg213')) || (f === 'LMR-400' && owns('lmr400'));
export const antOwned = (t) => (t === 'yagi' ? owns('yagi') : t === 'efhw' ? owns('unun') : true);

// FCC power limits (simplified): Technicians 200 W PEP on HF; 30 m 200 W for everyone; else 1500 W.
export function powerLimit(lic, hz) {
  if (hz >= 10.1e6 && hz <= 10.15e6) return 200;
  if (lic === 'T' && hz < 30e6) return 200;
  return 1500;
}

let root;
export function initStoreUI(el) { root = el; render(); bus.on('money', render); }

function buy(it) {
  if (owns(it.id)) return;
  if (it.needs && !owns(it.needs)) return toast(`You need the ${ITEMS.find((x) => x.id === it.needs).name} first.`, 'warn');
  if (money() < it.price) return toast(`Not enough credits — operate more! (${money()} / ${it.price})`, 'warn');
  S.money -= it.price; (S.owned ||= []).push(it.id); save();
  toast(`🛒 Bought: ${it.name}${it.id.startsWith('rig-') ? ' — switch to it in 🎛 Station → Radio model.' : it.id === 'antswitch' ? ' — save antennas in 🎛 Station → Saved antennas.' : ''}`, 'good');
  bus.emit('money', 0); bus.emit('store'); bus.emit('antenna-rebuild');
}

function render() {
  if (!root) return;
  root.innerHTML = '';
  const cats = [...new Set(ITEMS.map((i) => i.cat))];
  root.append(
    h('div', { class: 'card store-head' }, h('div', { class: 'row spread' },
      h('div', {}, h('h2', {}, '🛒 Hamfest'), h('p', { class: 'muted small' }, 'Earn credits: confirmed QSOs (+5, more for new states and countries), contests (score ÷ 5), passing exams (+100). Spend them on gear that really changes your station\'s performance.')),
      h('div', { class: 'wallet' }, h('span', {}, 'Credits'), h('b', {}, `₵ ${money()}`)))),
    ...cats.map((c) => h('div', { class: 'card' }, h('h3', {}, c), h('div', { class: 'store-grid' },
      ...ITEMS.filter((i) => i.cat === c).map((it) => {
        const own = owns(it.id), locked = it.needs && !owns(it.needs);
        return h('div', { class: `store-item ${own ? 'owned' : ''} ${locked ? 'locked' : ''}` },
          h('div', { class: 'si-icon' }, it.icon),
          h('div', { class: 'si-body' }, h('b', {}, it.name), h('p', { class: 'small muted' }, it.desc),
            own ? h('span', { class: 'badge ok' }, '✓ owned') : h('button', { class: 'btn primary small', disabled: locked || money() < it.price, onclick: () => buy(it) }, `₵ ${it.price}`)));
      })))));
}
