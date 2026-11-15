// Live propagation map: coastlines, day/night terminator (greyline), stations on the band,
// and the great-circle path to whoever you're hearing. Click a station to tune to it.
import { S } from './state.js';
import { h, bus, now } from './util.js';
import { world, player } from './world.js';
import { dayFactor, interp, simDate, distanceKm } from './propagation.js';
import { stateBy } from './data/world.js';
import { net } from './net.js';

const LAND_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-110m.json';
let land = null, landTried = false, cv, ctx, nightImg = null, nightAt = 0, hover = null, root;

// Minimal TopoJSON decoder for the land object.
function decodeTopo(topo) {
  const { scale, translate } = topo.transform;
  const arcs = topo.arcs.map((arc) => { let x = 0, y = 0; return arc.map(([dx, dy]) => { x += dx; y += dy; return [x * scale[0] + translate[0], y * scale[1] + translate[1]]; }); });
  const ring = (ids) => ids.flatMap((i, k) => { const a = i >= 0 ? arcs[i] : arcs[~i].slice().reverse(); return k ? a.slice(1) : a; });
  const polys = [];
  const geom = (g) => {
    if (g.type === 'GeometryCollection') g.geometries.forEach(geom);
    else if (g.type === 'Polygon') polys.push(g.arcs.map(ring));
    else if (g.type === 'MultiPolygon') g.arcs.forEach((p) => polys.push(p.map(ring)));
  };
  geom(topo.objects.land);
  return polys;
}

async function loadLand() {
  if (landTried) return; landTried = true;
  try {
    const r = await fetch(LAND_URL);
    land = decodeTopo(await r.json());
  } catch (e) { land = null; }
}

export function initMapUI(el) {
  root = el;
  cv = h('canvas', { class: 'pmap', title: 'Click a station to tune to it' });
  root.append(h('div', { class: 'card map-card' },
    h('div', { class: 'row spread' }, h('h3', {}, '🗺 Propagation map'), h('span', { class: 'muted tiny', id: 'map-legend' }, '')),
    cv));
  ctx = cv.getContext('2d');
  cv.addEventListener('mousemove', (e) => { hover = { x: e.offsetX, y: e.offsetY }; });
  cv.addEventListener('mouseleave', () => { hover = null; });
  cv.addEventListener('click', (e) => {
    const r = pickRoster(e.offsetX, e.offsetY);
    if (r) return bus.emit('net-join', r);
    const st = pickAt(e.offsetX, e.offsetY); if (st) bus.emit('tune-to', st.freq, st.mode === 'CW' ? 'CW' : st.mode === 'FM' ? 'FM' : st.sb);
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
  // recompute the terminator shading at most every 30 s
  if (nightImg && now() - nightAt < 30 && nightImg.width === W) return nightImg;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const d = simDate();
  const step = 4;
  for (let py = 0; py < H; py += step) for (let px = 0; px < W; px += step) {
    const lat = 90 - (py + step / 2) / H * 180, lon = (px + step / 2) / W * 360 - 180;
    const df = dayFactor({ lat, lon }, d);
    if (df < 1) { x.fillStyle = `rgba(2,6,20,${0.62 * (1 - df)})`; x.fillRect(px, py, step, step); }
    if (df > 0.02 && df < 0.35) { x.fillStyle = 'rgba(255,170,60,0.10)'; x.fillRect(px, py, step, step); }
  }
  nightImg = c; nightAt = now();
  return c;
}

export function drawMap() {
  if (!cv || !cv.offsetParent) return;
  const dpr = window.devicePixelRatio || 1;
  const W = cv.clientWidth, H = Math.round(W / 2);
  if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.height = `${H}px`; nightImg = null; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // ocean
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0b2742'); g.addColorStop(0.5, '#0e3354'); g.addColorStop(1, '#0b2742');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // graticule
  ctx.strokeStyle = 'rgba(120,170,220,0.10)'; ctx.lineWidth = 1;
  for (let lon = -180; lon <= 180; lon += 30) { const [x] = proj(0, lon, W, H); ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let lat = -60; lat <= 60; lat += 30) { const [, y] = proj(lat, 0, W, H); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  // land
  if (land) {
    ctx.fillStyle = '#2c4a33'; ctx.strokeStyle = '#4f7a55';
    for (const poly of land) {
      ctx.beginPath();
      for (const r of poly) r.forEach(([lon, lat], i) => { const [x, y] = proj(lat, lon, W, H); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.fill('evenodd'); ctx.stroke();
    }
  }
  ctx.drawImage(nightLayer(W, H), 0, 0, W, H);
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
  if (leg) leg.innerHTML = `<span style="color:#ffd166">●</span> SSB <span style="color:#7fd3ff">●</span> CW <span style="color:#ff6bd5">◯</span> real players (click to join) · bright = heard now · ${world.band || ''} ${land ? '' : '(coastlines need internet)'}`;
}
