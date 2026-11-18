// "My area" map: what is on the air around you, on real geography. State outlines and
// cities for orientation, range rings from your station, one marker per signal, grouped by
// what the signal is for. Scroll or pinch to zoom, drag to pan, click a marker to tune.
import { S, save } from './state.js';
import { h, bus, clamp } from './util.js';
import { player } from './world.js';
import { getLand, decodeTopo } from './map.js';
import { catalog, tuneItem } from './worldview.js';
import { wantBroadcast, wantAirports } from './realworld.js';
import { rigRx } from './rigs.js';

const STATES_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/states-10m.json';

// Marker groups: [label, colour, shape, catalog kinds]
export const GROUPS = {
  ham: ['Ham radio', '#ffb347', 'circle', ['hamhf', 'hamvhf', 'beacon']],
  safety: ['Public safety & weather', '#ef5350', 'square', ['land', 'ems', 'wx']],
  air: ['Aviation', '#b39ddb', 'diamond', ['air', 'util']],
  marine: ['Marine', '#4dd0e1', 'tri', ['marine']],
  bc: ['Broadcast & time', '#4fc3f7', 'bar', ['bc', 'time']],
  pers: ['CB & walkie-talkies', '#aed581', 'dot', ['pers']],
  players: ['Players', '#ffffff', 'ring', ['players']],
};
const GROUP_OF = Object.fromEntries(Object.entries(GROUPS).flatMap(([g, x]) => x[3].map((k) => [k, g])));
const ZOOMS = [25, 50, 100, 250, 1000];

// A few cities for orientation: [name, lat, lon, rank] (rank 1 shows first when zoomed out).
const CITIES = [
  ['New York', 40.71, -74.01, 1], ['Los Angeles', 34.05, -118.24, 1], ['Chicago', 41.88, -87.63, 1], ['Houston', 29.76, -95.37, 1], ['Phoenix', 33.45, -112.07, 1],
  ['Philadelphia', 39.95, -75.17, 2], ['San Antonio', 29.42, -98.49, 2], ['San Diego', 32.72, -117.16, 2], ['Dallas', 32.78, -96.8, 1], ['San Jose', 37.34, -121.89, 2],
  ['Austin', 30.27, -97.74, 2], ['Jacksonville', 30.33, -81.66, 2], ['Columbus', 39.96, -83.0, 2], ['Charlotte', 35.23, -80.84, 2], ['Indianapolis', 39.77, -86.16, 2],
  ['San Francisco', 37.77, -122.42, 1], ['Seattle', 47.61, -122.33, 1], ['Denver', 39.74, -104.99, 1], ['Washington', 38.9, -77.04, 1], ['Boston', 42.36, -71.06, 1],
  ['Nashville', 36.16, -86.78, 2], ['Oklahoma City', 35.47, -97.52, 2], ['El Paso', 31.76, -106.49, 2], ['Portland', 45.52, -122.68, 2], ['Las Vegas', 36.17, -115.14, 2],
  ['Detroit', 42.33, -83.05, 1], ['Memphis', 35.15, -90.05, 2], ['Louisville', 38.25, -85.76, 2], ['Baltimore', 39.29, -76.61, 2], ['Milwaukee', 43.04, -87.91, 2],
  ['Albuquerque', 35.08, -106.65, 2], ['Tucson', 32.22, -110.97, 3], ['Fresno', 36.74, -119.79, 3], ['Sacramento', 38.58, -121.49, 2], ['Kansas City', 39.1, -94.58, 2],
  ['Atlanta', 33.75, -84.39, 1], ['Omaha', 41.26, -95.93, 2], ['Colorado Springs', 38.83, -104.82, 3], ['Raleigh', 35.78, -78.64, 2], ['Miami', 25.76, -80.19, 1],
  ['Minneapolis', 44.98, -93.27, 1], ['Tulsa', 36.15, -95.99, 3], ['Wichita', 37.69, -97.34, 3], ['New Orleans', 29.95, -90.07, 2], ['Cleveland', 41.5, -81.69, 2],
  ['Tampa', 27.95, -82.46, 2], ['Honolulu', 21.31, -157.86, 2], ['Anchorage', 61.22, -149.9, 2], ['Pittsburgh', 40.44, -80.0, 2], ['Cincinnati', 39.1, -84.51, 2],
  ['St. Louis', 38.63, -90.2, 1], ['Orlando', 28.54, -81.38, 2], ['Salt Lake City', 40.76, -111.89, 1], ['Boise', 43.62, -116.2, 2], ['Spokane', 47.66, -117.43, 3],
  ['Richmond', 37.54, -77.44, 3], ['Des Moines', 41.59, -93.62, 3], ['Buffalo', 42.89, -78.88, 2], ['Rochester', 43.16, -77.61, 3], ['Albany', 42.65, -73.75, 3],
  ['Hartford', 41.76, -72.69, 3], ['Providence', 41.82, -71.41, 3], ['Worcester', 42.26, -71.8, 3], ['Springfield', 42.1, -72.59, 3], ['Portland ME', 43.66, -70.26, 3],
  ['Manchester', 42.99, -71.46, 3], ['Burlington', 44.48, -73.21, 3], ['Billings', 45.78, -108.5, 2], ['Fargo', 46.88, -96.79, 2], ['Sioux Falls', 43.55, -96.73, 3],
  ['Little Rock', 34.75, -92.29, 3], ['Jackson', 32.3, -90.18, 3], ['Birmingham', 33.52, -86.8, 2], ['Charleston', 32.78, -79.93, 3], ['Norfolk', 36.85, -76.29, 3],
  ['Cheyenne', 41.14, -104.82, 3], ['Reno', 39.53, -119.81, 3], ['Lubbock', 33.58, -101.86, 3], ['Madison', 43.07, -89.4, 3], ['Grand Rapids', 42.96, -85.67, 3],
  ['Toronto', 43.65, -79.38, 1], ['Montréal', 45.5, -73.57, 1], ['Vancouver', 49.28, -123.12, 1], ['Ottawa', 45.42, -75.7, 2], ['Calgary', 51.05, -114.07, 2],
  ['Winnipeg', 49.9, -97.14, 2], ['Halifax', 44.65, -63.58, 2], ['Mexico City', 19.43, -99.13, 1], ['Monterrey', 25.69, -100.32, 2], ['Tijuana', 32.51, -117.04, 3], ['Havana', 23.11, -82.37, 2],
];

let states = null, statesTried = false;
async function loadStates() {
  if (statesTried) return; statesTried = true;
  try {
    const topo = await (await fetch(STATES_URL)).json();
    states = { nation: withBox(decodeTopo(topo, 'nation')), states: withBox(decodeTopo(topo, 'states')) };
  } catch (e) { states = null; }
}
// polygons → flat list of rings with a bounding box, so off-screen ones are skipped
function withBox(polys) {
  const out = [];
  for (const poly of polys) for (const r of poly) {
    let a = 180, b = -180, c = 90, d = -90;
    for (const [lon, lat] of r) { if (lon < a) a = lon; if (lon > b) b = lon; if (lat < c) c = lat; if (lat > d) d = lat; }
    out.push({ r, box: [a, b, c, d] });
  }
  return out;
}
let landBoxed = null, landSrc = null;

let root, cv, tipEl, legendEl, zoomEl, pts = [], hover = null, pan = { lat: 0, lon: 0 };
const V = () => {
  const v = (S.area ||= { on: {}, km: 100 });
  for (const g of Object.keys(GROUPS)) v.on[g] ??= g !== 'bc';
  return v;
};
const fmtF = (f) => (f >= 1.7e6 ? `${(f / 1e6).toFixed(3)} MHz` : `${Math.round(f / 1e3)} kHz`);
const mi = (km) => Math.round(km * 0.621);

export function initAreaMap(el) {
  root = el;
  cv = h('canvas', { class: 'area-map' });
  tipEl = h('div', { class: 'area-tip' }, 'Click a marker to tune to it.');
  legendEl = h('div', { class: 'area-legend' });
  zoomEl = h('div', { class: 'seg area-zoom' });
  root.append(h('div', { class: 'area-wrap' },
    h('div', { class: 'area-top' }, zoomEl,
      h('button', { class: 'btn small ghost', title: 'Centre on my station', onclick: () => { pan = { lat: 0, lon: 0 }; draw(); } }, 'Centre')),
    h('div', { class: 'area-canvas' }, cv,
      h('div', { class: 'area-pm' }, h('button', { title: 'Zoom in', onclick: () => zoom(1 / 1.5) }, '+'), h('button', { title: 'Zoom out', onclick: () => zoom(1.5) }, '−'))),
    tipEl, legendEl));
  renderChrome();

  // drag to pan, wheel / pinch to zoom, click to tune
  const ptrs = new Map(); let moved = 0, pinch = 0;
  cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]); moved = 0; pinch = 0; });
  cv.addEventListener('pointermove', (e) => {
    const b = cv.getBoundingClientRect();
    hover = { x: e.clientX - b.left, y: e.clientY - b.top };
    const prev = ptrs.get(e.pointerId);
    if (!prev) { draw(); return; }
    ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (ptrs.size === 2) {
      const [p, q] = [...ptrs.values()], d = Math.hypot(p[0] - q[0], p[1] - q[1]);
      if (pinch) zoom(pinch / d, true);
      pinch = d; moved = 99;
    } else {
      const dx = e.clientX - prev[0], dy = e.clientY - prev[1];
      moved += Math.abs(dx) + Math.abs(dy);
      const k = scale();
      pan.lon -= dx / k.x; pan.lat += dy / k.y;
    }
    draw();
  });
  const up = (e) => { ptrs.delete(e.pointerId); pinch = 0; if (e.type === 'pointerup' && moved < 6) { const it = pick(); if (it) { tuneItem(it); tip(it, true); } } };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('pointerleave', () => { hover = null; draw(); });
  cv.addEventListener('wheel', (e) => { e.preventDefault(); zoom(e.deltaY > 0 ? 1.2 : 1 / 1.2); }, { passive: false });

  for (const ev of ['realworld', 'roster', 'band', 'qth']) bus.on(ev, () => { if (ev === 'qth') pan = { lat: 0, lon: 0 }; renderChrome(); draw(); });
  setInterval(() => { if (cv.offsetParent && !document.hidden) draw(); }, 1000);
  loadStates().then(draw);
  if (V().on.air) wantAirports();
}

function zoom(f, quiet) {
  const v = V();
  v.km = clamp(v.km * f, 8, 4000);
  if (!quiet) { save(); renderChrome(); }
  draw();
}

function renderChrome() {
  const v = V();
  zoomEl.innerHTML = '';
  for (const z of ZOOMS) zoomEl.append(h('button', { class: Math.abs(v.km - z) / z < 0.12 ? 'active' : '', title: `${mi(z)} miles across each side`, onclick: () => { v.km = z; pan = { lat: 0, lon: 0 }; save(); renderChrome(); draw(); } }, z >= 1000 ? `${z / 1000}k km` : `${z} km`));
  const all = catalog(), n = {};
  for (const it of all) { const g = GROUP_OF[it.kind]; n[g] = (n[g] || 0) + 1; }
  legendEl.innerHTML = '';
  for (const [g, [label, col]] of Object.entries(GROUPS)) legendEl.append(h('button', {
    class: `area-chip ${v.on[g] ? 'on' : ''}`, style: { '--c': col }, 'aria-pressed': String(!!v.on[g]),
    onclick: () => { v.on[g] = !v.on[g]; if (v.on[g] && g === 'bc') wantBroadcast(); if (v.on[g] && g === 'air') wantAirports(); save(); renderChrome(); draw(); },
  }, h('i'), label, h('span', {}, String(n[g] || 0))));
}

function tip(it, tuned) {
  if (!it) { tipEl.textContent = 'Click a marker to tune to it.'; return; }
  const can = rigRx(it.f) || it.roster;
  tipEl.innerHTML = `<b>${it.name}</b> · <span class="mono">${fmtF(it.f)}</span> ${it.mode} · ${Math.round(it.km).toLocaleString()} km${it.note ? ` · ${it.note}` : ''}${tuned ? (can ? ' — <span class="ok">tuned</span>' : ' — <span class="warn">this radio cannot receive it</span>') : ''}`;
}

function pick() {
  if (!hover) return null;
  let best = null, bd = 16;
  for (const p of pts) { const d = Math.hypot(p.x - hover.x, p.y - hover.y); if (d < bd) { bd = d; best = p.it; } }
  return best;
}

// pixels per degree at the current zoom
function scale() {
  const W = cv.clientWidth || 600, me = player();
  const ppk = (W / 2) / V().km;
  return { x: ppk * 111.32 * Math.cos(me.lat * Math.PI / 180), y: ppk * 110.57, ppk };
}

function shape(ctx, kind, x, y, r) {
  ctx.beginPath();
  if (kind === 'square') ctx.rect(x - r, y - r, 2 * r, 2 * r);
  else if (kind === 'diamond') { ctx.moveTo(x, y - r * 1.3); ctx.lineTo(x + r * 1.3, y); ctx.lineTo(x, y + r * 1.3); ctx.lineTo(x - r * 1.3, y); ctx.closePath(); }
  else if (kind === 'tri') { ctx.moveTo(x, y - r * 1.3); ctx.lineTo(x + r * 1.2, y + r); ctx.lineTo(x - r * 1.2, y + r); ctx.closePath(); }
  else if (kind === 'bar') ctx.rect(x - r * 0.6, y - r * 1.3, r * 1.2, r * 2.6);
  else ctx.arc(x, y, kind === 'dot' ? r * 0.75 : r, 0, 7);
}

export function draw() {
  if (!cv || !cv.offsetParent) return;
  const v = V(), me = player();
  const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = Math.round(clamp(W * 0.7, 260, 520));
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.height = `${H}px`; }
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const k = scale(), cLat = me.lat + pan.lat, cLon = me.lon + pan.lon;
  const proj = (lat, lon) => [W / 2 + (lon - cLon) * k.x, H / 2 - (lat - cLat) * k.y];
  const view = [cLon - W / 2 / k.x, cLon + W / 2 / k.x, cLat - H / 2 / k.y, cLat + H / 2 / k.y];
  const vis = (b) => b[1] >= view[0] && b[0] <= view[1] && b[3] >= view[2] && b[2] <= view[3];
  const trace = (list) => { ctx.beginPath(); for (const { r, box } of list) { if (!vis(box)) continue; r.forEach(([lon, lat], i) => { const [x, y] = proj(lat, lon); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); } };

  // water, then land
  ctx.fillStyle = '#0a1826'; ctx.fillRect(0, 0, W, H);
  const land = getLand();
  if (land && landSrc !== land) { landBoxed = withBox(land); landSrc = land; }
  if (landBoxed) { trace(landBoxed); ctx.fillStyle = '#1f303e'; ctx.fill('evenodd'); ctx.strokeStyle = '#2f4354'; ctx.lineWidth = 1; ctx.stroke(); }
  if (states) {
    trace(states.nation); ctx.fillStyle = '#243a4b'; ctx.fill('evenodd');
    trace(states.states); ctx.strokeStyle = 'rgba(150,180,205,0.32)'; ctx.lineWidth = 1; ctx.stroke();
    trace(states.nation); ctx.strokeStyle = 'rgba(190,215,235,0.6)'; ctx.lineWidth = 1.2; ctx.stroke();
  }
  // cities
  const maxRank = v.km > 1500 ? 1 : v.km > 400 ? 2 : 3;
  ctx.font = '11px Inter, system-ui, sans-serif'; ctx.textBaseline = 'middle';
  for (const [name, lat, lon, rank] of CITIES) {
    if (rank > maxRank) continue;
    const [x, y] = proj(lat, lon);
    if (x < 0 || y < 0 || x > W || y > H) continue;
    ctx.fillStyle = 'rgba(220,232,244,0.5)'; ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    ctx.fillStyle = 'rgba(190,206,222,0.62)'; ctx.fillText(name, x + 6, y);
  }
  // range rings from the station
  const [mx, my] = proj(me.lat, me.lon);
  const ringStep = [5, 10, 25, 50, 100, 250, 500, 1000, 2500].find((s) => v.km / s <= 3.2) || 2500;
  ctx.font = '10px "JetBrains Mono", ui-monospace, monospace';
  for (let km = ringStep; km <= v.km * 2.5; km += ringStep) {
    ctx.strokeStyle = 'rgba(160,200,235,0.2)'; ctx.setLineDash([4, 5]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(mx, my, km * k.ppk, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(170,205,235,0.75)';
    ctx.fillText(`${km} km · ${mi(km)} mi`, mx + km * k.ppk * 0.71 + 4, my - km * k.ppk * 0.71);
  }
  // markers
  const items = catalog().filter((x) => v.on[GROUP_OF[x.kind]]);
  const tuned = items.find((x) => Math.abs(x.f - S.radio.freq) < 3000);
  pts = [];
  for (const it of items) {
    const [x, y] = proj(it.lat, it.lon);
    if (x < -12 || y < -12 || x > W + 12 || y > H + 12) continue;
    pts.push({ x, y, it });
  }
  const hv = pick();
  if (tuned) { const [tx, ty] = proj(tuned.lat, tuned.lon); ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(tx, ty); ctx.stroke(); ctx.setLineDash([]); }
  for (const { x, y, it } of pts) {
    const [, col, sh] = GROUPS[GROUP_OF[it.kind]];
    const big = it === hv || it === tuned;
    ctx.lineWidth = 1.5; ctx.strokeStyle = '#06101a'; ctx.fillStyle = col;
    if (sh === 'ring') { ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.fillStyle = it.roster?.tx ? '#ff5b5b' : '#0b1e30'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
    else { shape(ctx, it.rpt ? 'tri' : sh, x, y, big ? 6 : 4.5); ctx.fill(); ctx.stroke(); }
    if (big) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 10, 0, 7); ctx.stroke(); }
  }
  // labels: tuned and players first, then nearest; skip any that would overlap
  ctx.font = '600 11px Inter, system-ui, sans-serif';
  const taken = [];
  const order = [...pts].sort((a, b) => (b.it === tuned) - (a.it === tuned) || (b.it.kind === 'players') - (a.it.kind === 'players') || a.it.km - b.it.km);
  let n = 0;
  for (const { x, y, it } of order) {
    if (n >= 22) break;
    const text = it.name.length > 26 ? `${it.name.slice(0, 25)}…` : it.name;
    const w = ctx.measureText(text).width + 8;
    const box = [x + 9, y - 9, w, 17];
    if (box[0] + w > W) box[0] = x - 9 - w;
    if (taken.some((t) => box[0] < t[0] + t[2] && box[0] + box[2] > t[0] && box[1] < t[1] + t[3] && box[1] + box[3] > t[1])) continue;
    taken.push(box); n++;
    ctx.fillStyle = 'rgba(8,14,22,0.78)'; ctx.fillRect(...box);
    ctx.fillStyle = it === tuned ? '#fff' : '#d5e0ea'; ctx.fillText(text, box[0] + 4, box[1] + 9);
  }
  // you
  ctx.fillStyle = '#ff4d4d'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(mx, my, 6, 0, 7); ctx.fill(); ctx.stroke();
  ctx.font = '700 11px Inter, system-ui, sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(S.call || 'You', mx + 10, my + 12);
  cv.style.cursor = hv ? 'pointer' : 'grab';
  if (hover) tip(hv);
  if (!land && !states) { ctx.fillStyle = 'rgba(200,215,230,0.6)'; ctx.font = '11px Inter, sans-serif'; ctx.fillText('Map outlines need an internet connection.', 10, H - 12); }
}
