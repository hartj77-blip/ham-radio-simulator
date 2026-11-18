// Radio page layout: the radio and logger stay on screen; the map, the list of what is on the
// air, the other players and the band guide share one tabbed side panel.
import { S, save } from './state.js';
import { h, $, bus } from './util.js';
import { icon } from './icons.js';
import { net } from './net.js';
import { initMapUI } from './map.js';
import { initAreaMap, draw as drawArea } from './areamap.js';

const TABS = [['map', 'Map', 'map'], ['air', 'On the air', 'activity'], ['players', 'Players', 'users'], ['guide', 'Guide', 'compass']];
const PANE = { map: '#map-panel', air: '#scanner-panel', players: '#net-panel', guide: '#guide-panel' };

function showSide(t) {
  if (!PANE[t]) t = 'map';
  S.radioTab = t; save();
  for (const [k, sel] of Object.entries(PANE)) $(sel).hidden = k !== t;
  renderTabs();
  if (t === 'map') requestAnimationFrame(drawArea);
}

function renderTabs() {
  const el = $('#side-tabs');
  el.innerHTML = '';
  const others = (net.roster || []).length;
  for (const [k, label, ic] of TABS) el.append(h('button', { class: S.radioTab === k ? 'active' : '', role: 'tab', 'aria-selected': String(S.radioTab === k), 'data-side': k, onclick: () => showSide(k) },
    h('span', { html: icon(ic) }), label, k === 'players' && others ? h('span', { class: 'count' }, String(others)) : null));
}

// One drawer at a time under the rig bar: the Find shortcuts, or Quick setup.
function drawer(name) {
  const els = { find: $('#finder'), quick: $('#free-console') };
  for (const [k, el] of Object.entries(els)) el.classList.toggle('open', k === name && !el.classList.contains('open'));
  document.querySelectorAll('[data-drawer]').forEach((b) => b.classList.toggle('active', els[b.dataset.drawer]?.classList.contains('open')));
}

export function initRadioPage() {
  // Map tab: your area first, the world propagation map one click away.
  const mp = $('#map-panel');
  const local = h('div', { id: 'map-local' }), worldEl = h('div', { id: 'map-world' });
  const seg = h('div', { class: 'seg map-scale' });
  const setScale = (s) => {
    S.mapView = s; save();
    local.hidden = s !== 'local'; worldEl.hidden = s !== 'world';
    seg.innerHTML = '';
    for (const [k, l] of [['local', 'My area'], ['world', 'World']]) seg.append(h('button', { class: s === k ? 'active' : '', onclick: () => setScale(k) }, l));
    if (s === 'local') requestAnimationFrame(drawArea);
  };
  mp.append(h('div', { class: 'card side-card' }, seg, local, worldEl));
  initAreaMap(local);
  initMapUI(worldEl);
  setScale(S.mapView === 'world' ? 'world' : 'local');

  showSide(S.radioTab || (S.mode === 'training' ? 'guide' : 'map'));
  bus.on('roster', renderTabs);
  bus.on('radio-side', showSide);
  bus.on('radio-drawer', drawer);
  bus.on('map-target', () => { if (S.mapView !== 'world') return; });
  // close the Find drawer once a shortcut was used
  $('#finder').addEventListener('click', (e) => { if (e.target.closest('.find-btn')) drawer(null); });
  bus.on('tab', (t) => { if (t === 'radio') requestAnimationFrame(drawArea); });
}
