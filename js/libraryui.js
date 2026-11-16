// Reference library: in-depth articles on station building, antennas, measurement, receiving,
// propagation and operating. Linked from Training steps and the question box.
import { h, bus } from './util.js';
import { icon } from './icons.js';
import { STEPS } from './training.js';

const CATS = ['Station', 'Antennas', 'Measurement & tuning', 'Receiving', 'Propagation', 'Operating', 'Reference'];
let root, current = null, query = '';
let LIBRARY = [];
const libById = (id) => LIBRARY.find((a) => a.id === id);
export const libraryReady = import('./data/library.js').then((m) => { LIBRARY = m.LIBRARY; return LIBRARY; }).catch(() => LIBRARY);

export function initLibrary(el) {
  root = el;
  render();
  libraryReady.then(() => { current ||= LIBRARY[0]?.id; render(); });
  bus.on('library', (id) => { current = id; render(); bus.emit('goto', 'library'); root.querySelector('.lib-article')?.scrollTo?.(0, 0); window.scrollTo({ top: 0 }); });
}

function render() {
  root.innerHTML = '';
  const q = query.trim().toLowerCase();
  const match = (a) => !q || `${a.title} ${a.summary} ${a.cat}`.toLowerCase().includes(q) || a.html.toLowerCase().includes(q);
  const search = h('input', { class: 'lib-search', type: 'search', placeholder: 'Search the library', value: query });
  search.oninput = () => { query = search.value; const pos = search.selectionStart; render(); const s = root.querySelector('.lib-search'); s.focus(); s.setSelectionRange(pos, pos); };
  const nav = h('nav', { class: 'lib-nav' }, h('div', { class: 'lib-search-wrap' }, h('span', { html: icon('search') }), search));
  const cats = [...new Set([...CATS, ...LIBRARY.map((a) => a.cat)])];
  for (const c of cats) {
    const items = LIBRARY.filter((a) => a.cat === c && match(a));
    if (!items.length) continue;
    nav.append(h('div', { class: 'lib-cat' }, c), ...items.map((a) => h('button', { class: `lib-item ${a.id === current ? 'active' : ''}`, onclick: () => { current = a.id; render(); window.scrollTo({ top: 0 }); } }, a.title)));
  }
  const a = libById(current);
  const usedIn = a ? STEPS.map((s, i) => [s, i]).filter(([s]) => s.ref === a.id) : [];
  const article = h('article', { class: 'lib-article card' });
  if (a) {
    const idx = LIBRARY.indexOf(a);
    article.append(
      h('div', { class: 'eyebrow' }, a.cat, a.minutes ? h('span', { class: 'muted' }, ` · ${a.minutes} min read`) : null),
      h('h1', {}, a.title),
      a.summary ? h('p', { class: 'lead' }, a.summary) : null,
      h('div', { class: 'prose', html: a.html }),
      usedIn.length ? h('div', { class: 'lib-used' }, h('h4', {}, 'Practise this in the simulator'), h('ul', {}, ...usedIn.map(([s, i]) => h('li', {}, h('button', { class: 'link', onclick: () => { bus.emit('set-mode', 'training'); bus.emit('training-goto', i); } }, typeof s.title === 'function' ? s.title() : s.title))))) : null,
      a.related?.length ? h('div', { class: 'lib-related' }, h('h4', {}, 'Related'), h('div', { class: 'row' }, ...a.related.filter(libById).map((r) => h('button', { class: 'chip', onclick: () => { current = r; render(); window.scrollTo({ top: 0 }); } }, libById(r).title)))) : null,
      h('div', { class: 'row spread lib-pager' },
        idx > 0 ? h('button', { class: 'btn ghost small', onclick: () => { current = LIBRARY[idx - 1].id; render(); window.scrollTo({ top: 0 }); } }, h('span', { html: icon('chevronLeft') }), LIBRARY[idx - 1].title) : h('span'),
        idx < LIBRARY.length - 1 ? h('button', { class: 'btn ghost small', onclick: () => { current = LIBRARY[idx + 1].id; render(); window.scrollTo({ top: 0 }); } }, LIBRARY[idx + 1].title, h('span', { html: icon('chevronRight') })) : h('span')));
  } else article.append(h('p', { class: 'muted' }, 'No article matches your search.'));
  root.append(h('div', { class: 'page-head' }, h('div', {}, h('div', { class: 'eyebrow' }, 'Learn'), h('h1', {}, 'Reference library'),
    h('p', { class: 'lead' }, `${LIBRARY.length} articles covering station wiring, antenna theory and construction, measurement, receiving technique, propagation and operating practice.`))),
  h('div', { class: 'lib-layout' }, nav, article));
}
