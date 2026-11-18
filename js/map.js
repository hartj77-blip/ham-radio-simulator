// Live propagation map: coastlines, day/night terminator (greyline), stations on the band,
// and the great-circle path to whoever you're hearing. Click a station to tune to it.
import { S } from './state.js';
import { h, bus, now, info } from './util.js';
import { world, player } from './world.js';
import { dayFactor, interp, simDate, distanceKm } from './propagation.js';
import { stateBy } from './data/world.js';
import { net } from './net.js';
import { mapTarget, targetCard } from './modes.js';
import { IONO, layerAt, ionoLive } from './iono.js';
import { save } from './state.js';

const LAND_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-110m.json';
let land = null, landTried = false, cv, ctx, nightImg = null, nightAt = 0, hover = null, root;

// Live ionosphere overlays (NOAA GloTEC / D-RAP).
export const LAYERS = {
  none: { label: 'Off' },
  muf: { label: 'MUF (3000 km)', unit: 'MHz', lo: 3, hi: 35, ticks: [5, 10, 14, 21, 28], note: 'Highest frequency that one 3000 km F2 hop can use. Bands below the MUF are open; above it signals pass into space.' },
  fof2: { label: 'foF2', unit: 'MHz', lo: 1, hi: 14, ticks: [2, 4, 7, 10, 13], note: 'Critical frequency: the highest frequency reflected straight down (NVIS). Bands below foF2 work for local, high-angle contacts.' },
  tec: { label: 'TEC', unit: 'TECU', lo: 0, hi: 60, ticks: [10, 20, 30, 40, 50], note: 'Total electron content of the column above each point (1 TECU = 10¹⁶ electrons/m²). More electrons, higher MUF.' },
  drap: { label: 'Absorption', unit: 'MHz', lo: 0, hi: 15, ticks: [3, 6, 9, 12], note: 'D-RAP: highest frequency losing 1 dB to the daytime D layer. It jumps during solar flares (radio blackouts): low bands go silent first.' },
};
// perceptual ramp (dark blue → teal → green → yellow → red)
const RAMP = [[20, 40, 110], [30, 110, 170], [40, 170, 160], [120, 200, 90], [230, 210, 60], [240, 120, 40], [210, 40, 50]];
export function rampColor(t) {
  t = Math.max(0, Math.min(1, t)) * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(t)), f = t - i;
  return RAMP[i].map((c, k) => Math.round(c + (RAMP[i + 1][k] - c) * f));
}
let ionoImg = null, ionoKey = '';
function ionoLayer(kind, W, H) {
  const L = LAYERS[kind];
  const key = `${kind}|${IONO.time}|${IONO.drapTime}|${W}`;
  if (ionoImg && ionoKey === key) return ionoImg;
  const cw = 180, ch = 90;
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const x = c.getContext('2d'), img = x.createImageData(cw, ch), px = img.data;
  for (let py = 0; py < ch; py++) for (let qx = 0; qx < cw; qx++) {
    const lat = 90 - (py + 0.5) / ch * 180, lon = (qx + 0.5) / cw * 360 - 180;
    const v = layerAt(kind, lat, lon);
    const i = (py * cw + qx) * 4;
    if (!Number.isFinite(v)) continue;
    const t = (v - L.lo) / (L.hi - L.lo);
    const [r, g, b] = rampColor(t);
    px[i] = r; px[i + 1] = g; px[i + 2] = b;
    px[i + 3] = kind === 'drap' ? Math.round(Math.min(1, v / 4) * 140) : 95;
  }
  x.putImageData(img, 0, 0);
  ionoImg = c; ionoKey = key;
  return c;
}
const mapLayer = () => (S.settings.mapLayer ?? 'muf');

// Minimal TopoJSON decoder: one named object → polygons of [lon, lat] rings.
export function decodeTopo(topo, name = 'land') {
  const { scale, translate } = topo.transform;
  const arcs = topo.arcs.map((arc) => { let x = 0, y = 0; return arc.map(([dx, dy]) => { x += dx; y += dy; return [x * scale[0] + translate[0], y * scale[1] + translate[1]]; }); });
  const ring = (ids) => ids.flatMap((i, k) => { const a = i >= 0 ? arcs[i] : arcs[~i].slice().reverse(); return k ? a.slice(1) : a; });
  const polys = [];
  const geom = (g) => {
    if (g.type === 'GeometryCollection') g.geometries.forEach(geom);
    else if (g.type === 'Polygon') polys.push(g.arcs.map(ring));
    else if (g.type === 'MultiPolygon') g.arcs.forEach((p) => polys.push(p.map(ring)));
  };
  geom(topo.objects[name]);
  return polys;
}

async function loadLand() {
  if (landTried) return; landTried = true;
  try {
    const r = await fetch(LAND_URL);
    land = decodeTopo(await r.json());
  } catch (e) { land = null; }
}

export const getLand = () => { loadLand(); return land; };
export function initMapUI(el) {
  root = el;
  cv = h('canvas', { class: 'pmap', title: 'Click a station to tune to it, or any location for a path analysis' });
  const tbox = h('div', { class: 'map-target' });
  const layerSeg = h('div', { class: 'seg layer-seg' }), layerInfo = h('div', { class: 'layer-info' });
  root.append(h('div', { class: 'map-card' },
    h('div', { class: 'map-layers' }, layerSeg, info('Day and night, stations on your band, and the live ionosphere from NOAA. Click a station to tune to it. Click anywhere else to see which band reaches that place.', 'About this map'), layerInfo),
    cv, h('div', { class: 'muted tiny', id: 'map-legend' }), tbox));
  const drawLayerSeg = () => {
    layerSeg.innerHTML = '';
    for (const [k, L] of Object.entries(LAYERS)) layerSeg.append(h('button', { class: mapLayer() === k ? 'active' : '', onclick: () => { S.settings.mapLayer = k; save(); drawLayerSeg(); } }, L.label));
    const L = LAYERS[mapLayer()];
    layerInfo.innerHTML = '';
    if (mapLayer() === 'none') return;
    if (!ionoLive() && mapLayer() !== 'drap') { layerInfo.append(h('span', { class: 'tiny muted' }, IONO.error || (S.settings.hour != null ? 'Live data applies to real time only — time warp is on.' : S.settings.liveIono === false ? 'Live ionosphere data is turned off in Settings.' : 'Loading live data from NOAA…'))); return; }
    const grad = `linear-gradient(90deg, ${[0, 1, 2, 3, 4, 5, 6].map((i) => `rgb(${rampColor(i / 6).join(',')})`).join(', ')})`;
    layerInfo.append(h('div', { class: 'ramp' }, h('div', { class: 'ramp-bar', style: { background: grad } }),
      h('div', { class: 'ramp-ticks' }, ...L.ticks.map((t) => h('span', { style: { left: `${((t - L.lo) / (L.hi - L.lo)) * 100}%` } }, t)), h('span', { class: 'unit' }, L.unit))),
      info(`${L.note} Source: NOAA SWPC ${mapLayer() === 'drap' ? `D-RAP, ${IONO.drapTime || ''}` : `GloTEC, ${IONO.time ? IONO.time.slice(11, 16) + ' UTC' : ''}`}.`, 'What this layer shows'));
  };
  drawLayerSeg();
  bus.on('iono', drawLayerSeg);
  bus.on('target', (t) => { tbox.innerHTML = ''; tbox.append(targetCard(t)); });
  ctx = cv.getContext('2d');
  cv.addEventListener('mousemove', (e) => { hover = { x: e.offsetX, y: e.offsetY }; });
  cv.addEventListener('mouseleave', () => { hover = null; });
  cv.addEventListener('click', (e) => {
    const r = pickRoster(e.offsetX, e.offsetY);
    if (r) return bus.emit('net-join', r);
    const st = pickAt(e.offsetX, e.offsetY); if (st) return bus.emit('tune-to', st.freq, st.mode === 'CW' ? 'CW' : st.mode === 'FM' ? 'FM' : st.sb);
    const W = cv.clientWidth, H = cv.clientHeight;
    bus.emit('map-target', { lat: 90 - (e.offsetY / H) * 180, lon: (e.offsetX / W) * 360 - 180 });
  });
  loadLand();
}

const proj = (lat, lon, W, H) => [((lon + 180) / 360) * W, ((90 - lat) / 180) * H];
let lastPts = [], rosterPts = [];
function pickRoster(x, y) { let best = null, bd = 12; for (const p of rosterPts) { const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = p.e; } } return best; }

function pickAt(x, y) {
  let best = null, bd = 12;
  for (const p of lastPts) { const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = p.st; } }
  return best;
}

function nightLayer(W, H) {
  // Recompute the terminator shading at most every 30 s. One pixel per 3 screen pixels, then
  // scaled up with smoothing so the greyline is a soft gradient instead of blocks.
  if (nightImg && now() - nightAt < 30 && nightImg.dw === W) return nightImg;
  const step = 3, cw = Math.ceil(W / step), ch = Math.ceil(H / step);
  const c = document.createElement('canvas'); c.width = cw; c.height = ch; c.dw = W;
  const x = c.getContext('2d');
  const img = x.createImageData(cw, ch), px = img.data;
  const d = simDate();
  for (let py = 0; py < ch; py++) for (let qx = 0; qx < cw; qx++) {
    const lat = 90 - (py + 0.5) / ch * 180, lon = (qx + 0.5) / cw * 360 - 180;
    const df = dayFactor({ lat, lon }, d);
    const i = (py * cw + qx) * 4;
    const night = 0.5 * (1 - df), grey = df > 0.02 && df < 0.35 ? 0.12 * (1 - Math.abs(df - 0.18) / 0.17) : 0;
    const a = night + grey;
    // night: deep blue-black; greyline: warm amber tint
    px[i] = Math.round((2 * night + 230 * grey) / Math.max(a, 1e-6)); px[i + 1] = Math.round((6 * night + 150 * grey) / Math.max(a, 1e-6)); px[i + 2] = Math.round((18 * night + 60 * grey) / Math.max(a, 1e-6));
    px[i + 3] = Math.round(Math.min(1, a) * 255);
  }
  x.putImageData(img, 0, 0);
  nightImg = c; nightAt = now();
  return c;
}

// Land as Path2Ds, rebuilt only when the map width changes. `fill` is the closed polygons;
// `coast` leaves out the seams the data adds where a polygon is cut at the ±180° meridian or
// closed along the south pole, so they don't show as straight lines across the map.
let landP = null, landPW = 0, landPSrc = null;
const seam = ([lo1, la1], [lo2, la2]) => Math.abs(lo2 - lo1) > 180 || (Math.abs(lo1) > 179.9 && Math.abs(lo2) > 179.9) || (la1 < -89.9 && la2 < -89.9);
function landPath(W, H) {
  if (!land) return null;
  if (landP && landPW === W && landPSrc === land) return landP;
  const fill = new Path2D(), coast = new Path2D();
  for (const poly of land) for (const r of poly) r.forEach((pt, i) => {
    const [x, y] = proj(pt[1], pt[0], W, H);
    if (i) fill.lineTo(x, y); else fill.moveTo(x, y);
    if (i && !seam(r[i - 1], pt)) coast.lineTo(x, y); else coast.moveTo(x, y);
  });
  landP = { fill, coast }; landPW = W; landPSrc = land;
  return landP;
}

export function drawMap() {
  if (!cv || !cv.offsetParent) return;
  const dpr = window.devicePixelRatio || 1;
  const W = cv.clientWidth, H = Math.round(W / 2);
  if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.height = `${H}px`; nightImg = null; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // ocean
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0a1622'); g.addColorStop(0.5, '#0d1d2c'); g.addColorStop(1, '#0a1622');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // graticule
  ctx.strokeStyle = 'rgba(140,170,200,0.08)'; ctx.lineWidth = 1;
  for (let lon = -180; lon <= 180; lon += 30) { const [x] = proj(0, lon, W, H); ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let lat = -60; lat <= 60; lat += 30) { const [, y] = proj(lat, 0, W, H); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  // land
  const lp = landPath(W, H);
  if (lp) { ctx.fillStyle = '#26394a'; ctx.fill(lp.fill, 'evenodd'); }
  ctx.imageSmoothingEnabled = true;
  const lk = mapLayer();
  if (lk !== 'none' && ((lk === 'drap' && IONO.drap) || (lk !== 'drap' && ionoLive()))) ctx.drawImage(ionoLayer(lk, W, H), 0, 0, W, H);
  ctx.drawImage(nightLayer(W, H), 0, 0, W, H);
  // Coastlines go on top of the ionosphere and night overlays so the continents stay readable.
  if (lp) {
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(5,10,16,0.55)'; ctx.lineWidth = 2.5; ctx.stroke(lp.coast);
    ctx.strokeStyle = 'rgba(214,226,238,0.75)'; ctx.lineWidth = 1; ctx.stroke(lp.coast);
  }
  // stations
  const me = player();
  const [mx, my] = proj(me.lat, me.lon, W, H);
  const t = now();
  lastPts = [];
  let strongest = null, sd = -999;
  for (const st of world.stations) {
    if (!st.op || st.role === 'beacon' && !st.tx) continue;
    const active = st.tx && t >= st.tx.start && t <= st.tx.end + 0.3;
    let snr = -99;
    try { snr = st.rxSnrRecent ?? -99; } catch (e) { }
    const [x, y] = proj(st.op.lat, st.op.lon, W, H);
    lastPts.push({ x, y, st });
    const heard = active && snr > -3;
    if (heard && snr > sd) { sd = snr; strongest = st; }
    const col = st.role === 'peer' ? '#ff6bd5' : st.mode === 'CW' ? '#7fd3ff' : st.mode === 'FM' ? '#c3a6ff' : '#ffd166';
    ctx.globalAlpha = heard ? 1 : 0.45;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(x, y, heard ? 4 : 2.5, 0, 7); ctx.fill();
    if (heard) { ctx.strokeStyle = col; ctx.globalAlpha = 0.5 * (0.5 + 0.5 * Math.sin(t * 6)); ctx.beginPath(); ctx.arc(x, y, 8 + Math.max(0, snr) / 4, 0, 7); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  // path to strongest (or hovered) station
  const hv = hover ? pickAt(hover.x, hover.y) : null;
  const target = hv || strongest;
  if (target) {
    ctx.strokeStyle = hv ? 'rgba(255,255,255,0.8)' : 'rgba(255,179,71,0.85)'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
    ctx.beginPath();
    let px = null;
    for (let i = 0; i <= 64; i++) {
      const p = interp(me, target.op, i / 64);
      const [x, y] = proj(p.lat, p.lon, W, H);
      if (px != null && Math.abs(x - px) > W / 2) ctx.moveTo(x, y); else (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      px = x;
    }
    ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    const [tx, ty] = proj(target.op.lat, target.op.lon, W, H);
    const label = `${target.call} · ${target.op.qth}${target.op.country && target.op.country !== 'United States' && target.op.country !== target.op.qth ? ', ' + target.op.country : ''} · ${Math.round(distanceKm(me, target.op)).toLocaleString()} km · ${(target.freq / 1e6).toFixed(3)} ${target.mode}`;
    ctx.font = '12px system-ui, sans-serif';
    const w = ctx.measureText(label).width + 12;
    const lx = Math.min(Math.max(4, tx + 10), W - w - 4), ly = Math.max(18, ty - 10);
    ctx.fillStyle = 'rgba(10,16,24,0.85)'; ctx.fillRect(lx, ly - 14, w, 20);
    ctx.fillStyle = '#e3e9f0'; ctx.fillText(label, lx + 6, ly);
  }
  // other players online (from the lobby roster)
  rosterPts = [];
  for (const e of net.roster || []) {
    const st = stateBy(e.state);
    if (!st) continue;
    const jx = ((e.id.charCodeAt(e.id.length - 1) % 7) - 3) * 2, jy = ((e.id.charCodeAt(e.id.length - 2) % 7) - 3) * 2;
    const [x, y] = proj(st.lat, st.lon, W, H);
    rosterPts.push({ x: x + jx, y: y + jy, e });
    ctx.strokeStyle = '#ff6bd5'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x + jx, y + jy, 6, 0, 7); ctx.stroke();
    if (e.tx) { ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 8); ctx.fillStyle = '#ff3b3b'; ctx.beginPath(); ctx.arc(x + jx, y + jy, 4, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
    ctx.fillStyle = '#ffc2f0'; ctx.font = 'bold 10px system-ui'; ctx.fillText(`${e.call} ${(e.freq / 1e6).toFixed(3)}`, x + jx + 9, y + jy - 6);
    ctx.lineWidth = 1;
  }
  const rh = hover ? pickRoster(hover.x, hover.y) : null;
  if (rh) { ctx.font = '12px system-ui'; const lbl = `${rh.call} (${rh.state}) · ${(rh.freq / 1e6).toFixed(3)} ${rh.mode}${rh.tx ? ' · ON AIR' : ''} — click to join`; const w = ctx.measureText(lbl).width + 12; ctx.fillStyle = 'rgba(40,10,35,0.9)'; ctx.fillRect(Math.min(hover.x + 10, W - w - 4), hover.y - 24, w, 20); ctx.fillStyle = '#fff'; ctx.fillText(lbl, Math.min(hover.x + 10, W - w - 4) + 6, hover.y - 10); }
  // live value under the cursor
  if (hover && lk !== 'none' && !(hv) && (ionoLive() || lk === 'drap')) {
    const hl = 90 - hover.y / H * 180, hn = hover.x / W * 360 - 180, v = layerAt(lk, hl, hn);
    if (Number.isFinite(v)) {
      const t = `${LAYERS[lk].label} ${v.toFixed(lk === 'tec' ? 0 : 1)} ${LAYERS[lk].unit}`;
      ctx.font = '11px "JetBrains Mono", monospace'; const tw = ctx.measureText(t).width + 12;
      const tx3 = Math.min(hover.x + 12, W - tw - 4), ty3 = Math.max(16, hover.y - 10);
      ctx.fillStyle = 'rgba(8,13,19,0.88)'; ctx.fillRect(tx3, ty3 - 13, tw, 18); ctx.fillStyle = '#e4e9ef'; ctx.fillText(t, tx3 + 6, ty3);
    }
  }
  // analysed target
  const tg = mapTarget.t;
  if (tg) {
    ctx.strokeStyle = 'rgba(65,184,232,0.9)'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
    ctx.beginPath(); let px2 = null;
    for (let i = 0; i <= 64; i++) { const p = interp(me, tg, i / 64); const [x, y] = proj(p.lat, p.lon, W, H); if (px2 != null && Math.abs(x - px2) > W / 2) ctx.moveTo(x, y); else (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); px2 = x; }
    ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    const [tx2, ty2] = proj(tg.lat, tg.lon, W, H);
    ctx.strokeStyle = '#41b8e8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(tx2, ty2, 7, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(tx2 - 11, ty2); ctx.lineTo(tx2 - 4, ty2); ctx.moveTo(tx2 + 4, ty2); ctx.lineTo(tx2 + 11, ty2); ctx.moveTo(tx2, ty2 - 11); ctx.lineTo(tx2, ty2 - 4); ctx.moveTo(tx2, ty2 + 4); ctx.lineTo(tx2, ty2 + 11); ctx.stroke(); ctx.lineWidth = 1;
    const lbl = `${Math.round(tg.dist).toLocaleString()} km · ${Math.round(tg.brg)}° · ${tg.best ? `best ${tg.best.band}` : 'no open band'}`;
    ctx.font = '11px "JetBrains Mono", monospace'; const w2 = ctx.measureText(lbl).width + 12;
    const lx2 = Math.min(Math.max(4, tx2 + 12), W - w2 - 4), ly2 = Math.min(H - 6, Math.max(18, ty2 + 22));
    ctx.fillStyle = 'rgba(8,13,19,0.88)'; ctx.fillRect(lx2, ly2 - 14, w2, 19); ctx.fillStyle = '#9fdcf4'; ctx.fillText(lbl, lx2 + 6, ly2);
  }
  // home QTH
  ctx.fillStyle = '#ff4d4d'; ctx.strokeStyle = '#fff';
  ctx.beginPath(); ctx.arc(mx, my, 5, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px system-ui'; ctx.fillText(S.call || 'You', mx + 8, my + 4);
  // sun position
  const d = simDate();
  const doy = Math.floor((d - Date.UTC(d.getUTCFullYear(), 0, 0)) / 864e5);
  const decl = -23.44 * Math.cos((2 * Math.PI / 365) * (doy + 10));
  const sunLon = -((d.getUTCHours() + d.getUTCMinutes() / 60 - 12) * 15);
  const [sx, sy] = proj(decl, ((sunLon + 540) % 360) - 180, W, H);
  const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 14);
  sg.addColorStop(0, 'rgba(255,240,150,1)'); sg.addColorStop(1, 'rgba(255,200,60,0)');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, 14, 0, 7); ctx.fill();
  const leg = document.getElementById('map-legend');
  if (leg) leg.innerHTML = `<span class="lg" style="--c:#ffd166"></span>SSB <span class="lg" style="--c:#7fd3ff"></span>CW <span class="lg ring" style="--c:#ff6bd5"></span>online operators · bright = heard now · ${world.band || ''} ${land ? '' : '(coastlines need internet)'}`;
}
