// Operating guides: original quick-reference manuals for each radio and accessory class.
// Opened from the radio faceplate bar, the handheld menu and the Equipment page.
import { S } from './state.js';
import { h, modal, bus } from './util.js';
import { icon } from './icons.js';
import { rig, RIGS, gear } from './rigs.js';
import { GEAR } from './data/gear.js';

let DATA = null;
const load = () => (DATA ||= import('./data/manuals.js').catch(() => ({ MANUALS: {}, GEAR_GUIDES: {} })));

export async function openManual(rigId = S.rig || 'allmode', section = null) {
  const { MANUALS, GEAR_GUIDES } = await load();
  const r = RIGS[rigId] || rig();
  const m = MANUALS[rigId];
  const body = h('div', { class: 'manual' });
  let close;
  const toc = h('nav', { class: 'man-toc' });
  const content = h('div', { class: 'man-content' });
  const showRadio = () => {
    content.innerHTML = '';
    if (!m) { content.append(h('p', { class: 'muted' }, 'No guide is available for this radio yet.')); return; }
    content.append(
      h('div', { class: 'eyebrow' }, 'Operating guide'),
      h('h2', { html: m.title }),
      h('p', { class: 'lead', html: m.summary }),
      m.specs?.length ? h('table', { class: 'tbl small man-specs' }, h('tbody', {}, ...m.specs.map(([k, v]) => h('tr', {}, h('th', { html: k }), h('td', { html: v }))))) : '',
      ...m.sections.map((sec, i) => h('section', { id: `man-s${i}` }, h('h3', {}, sec.h), h('div', { class: 'prose', html: sec.html }))));
  };
  const showGear = (cat) => {
    const g = GEAR_GUIDES[cat];
    content.innerHTML = '';
    if (!g) return;
    const item = GEAR[cat]?.items[gear()[cat]];
    content.append(h('div', { class: 'eyebrow' }, 'Accessory guide'), h('h2', {}, g.title),
      item ? h('p', { class: 'lead' }, `In your station: ${item.name}. ${item.desc || ''}`) : '',
      h('div', { class: 'prose', html: g.html }));
  };
  const item = (label, fn, active) => h('button', { class: `lib-item ${active ? 'active' : ''}`, onclick: (e) => { toc.querySelectorAll('.lib-item').forEach((b) => b.classList.remove('active')); e.currentTarget.classList.add('active'); fn(); content.scrollTop = 0; } }, label);
  toc.append(h('div', { class: 'lib-cat' }, 'This radio'), item(r.code ? `${r.code} ${r.name}` : r.name, showRadio, !section),
    ...(m ? m.sections.map((sec, i) => h('button', { class: 'lib-item sub', onclick: () => { if (!content.querySelector('#man-s0')) showRadio(); content.querySelector(`#man-s${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, sec.h)) : []),
    h('div', { class: 'lib-cat' }, 'Station accessories'),
    ...Object.keys(GEAR_GUIDES).map((cat) => item(GEAR_GUIDES[cat].title, () => showGear(cat), section === cat)),
    h('div', { class: 'lib-cat' }, 'Other radios'),
    (() => { const s = h('select', {}, ...Object.entries(RIGS).filter(([id]) => MANUALS[id]).map(([id, x]) => h('option', { value: id, selected: id === rigId }, `${x.code || ''} ${x.name}`))); s.onchange = () => { close(); openManual(s.value); }; return s; })());
  if (section && GEAR_GUIDES[section]) showGear(section); else showRadio();
  body.append(toc, content);
  close = modal(h('div', {}, body, h('p', { class: 'tiny muted man-note' }, 'Original guide written for this simulator. The radios are generic replicas of common equipment classes; consult your own radio\'s documentation for real hardware.')), { wide: true });
}

export const manualButton = (rigId, label = 'Operating guide') => h('button', { class: 'btn small', onclick: () => openManual(rigId) }, h('span', { html: icon('book') }), label);
bus.on('open-manual', (id, sec) => openManual(id, sec));
