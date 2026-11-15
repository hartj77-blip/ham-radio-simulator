// Canvas plotting helpers shared by the Workbench and the game: line plots, Smith chart,
// polar patterns and a rotatable 3D wire view.

export function setupCanvas(cv) {
  const dpr = window.devicePixelRatio || 1;
  const w = cv.clientWidth || cv.width, h = cv.clientHeight || cv.height;
  if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, W: w, H: h };
}

const css = (n, d) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || d;

// series: [{pts:[[x,y]], color, width, dash, label}]
export function linePlot(cv, { series, xMin, xMax, yMin, yMax, yLog, xLabel, yLabel, bands = [], marks = [], hLines = [], cursor }) {
  const { ctx, W, H } = setupCanvas(cv);
  const L = 44, R = 10, T = 12, B = 26;
  ctx.fillStyle = css('--plot-bg', '#0b1219'); ctx.fillRect(0, 0, W, H);
  const fy = (y) => (yLog ? Math.log(y) : y);
  const X = (x) => L + (x - xMin) / (xMax - xMin) * (W - L - R);
  const Y = (y) => T + (1 - (fy(Math.min(Math.max(y, yMin), yMax)) - fy(yMin)) / (fy(yMax) - fy(yMin))) * (H - T - B);
  for (const b of bands) { ctx.fillStyle = b.color; ctx.fillRect(X(b.lo), T, X(b.hi) - X(b.lo), H - T - B); }
  ctx.font = '10px ui-monospace, monospace'; ctx.fillStyle = '#7f93a8'; ctx.strokeStyle = 'rgba(140,170,200,0.13)';
  const yt = yLog ? [1, 1.5, 2, 3, 5, 10].filter((v) => v >= yMin && v <= yMax) : niceTicks(yMin, yMax, 5);
  for (const v of yt) { ctx.beginPath(); ctx.moveTo(L, Y(v)); ctx.lineTo(W - R, Y(v)); ctx.stroke(); ctx.fillText(yLog ? `${v}:1` : fmt(v), 2, Y(v) + 3); }
  for (const v of niceTicks(xMin, xMax, 6)) { ctx.beginPath(); ctx.moveTo(X(v), T); ctx.lineTo(X(v), H - B); ctx.stroke(); ctx.fillText(fmt(v), X(v) - 14, H - 10); }
  for (const hl of hLines) { ctx.strokeStyle = hl.color; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(L, Y(hl.y)); ctx.lineTo(W - R, Y(hl.y)); ctx.stroke(); ctx.setLineDash([]); }
  if (xLabel) ctx.fillText(xLabel, W - R - ctx.measureText(xLabel).width, H - 1);
  if (yLabel) ctx.fillText(yLabel, L + 4, T + 8);
  for (const s of series) {
    if (!s.pts.length) continue;
    ctx.strokeStyle = s.color; ctx.lineWidth = s.width || 2; ctx.setLineDash(s.dash || []);
    ctx.beginPath();
    s.pts.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
    ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
  }
  for (const mk of marks) { ctx.fillStyle = mk.color; ctx.beginPath(); ctx.arc(X(mk.x), Y(mk.y), 4, 0, 7); ctx.fill(); if (mk.label) ctx.fillText(mk.label, X(mk.x) + 6, Y(mk.y) - 6); }
  if (cursor != null) { ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.moveTo(X(cursor), T); ctx.lineTo(X(cursor), H - B); ctx.stroke(); }
  // legend
  let lx = L + 8;
  for (const s of series.filter((s) => s.label)) { ctx.fillStyle = s.color; ctx.fillRect(lx, T + 14, 12, 3); ctx.fillStyle = '#c9d6e3'; ctx.fillText(s.label, lx + 16, T + 18); lx += ctx.measureText(s.label).width + 34; }
  return { X, Y, invX: (px) => xMin + (px - L) / (W - L - R) * (xMax - xMin) };
}

function niceTicks(a, b, n) {
  const span = b - a, step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= n) || mag * 10;
  const out = [];
  for (let v = Math.ceil(a / step) * step; v <= b + 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}
const fmt = (v) => (Math.abs(v) >= 1000 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1).replace(/\.0$/, '') : v.toFixed(3).replace(/\.?0+$/, ''));

// Smith chart. traces: [{pts:[[re,im] gamma], color, label}], marks: [{g:[re,im], color}]
export function smith(cv, traces, marks = []) {
  const { ctx, W, H } = setupCanvas(cv);
  ctx.fillStyle = css('--plot-bg', '#0b1219'); ctx.fillRect(0, 0, W, H);
  const r0 = Math.min(W, H) / 2 - 10, cx = W / 2, cy = H / 2;
  const P = (g) => [cx + g[0] * r0, cy - g[1] * r0];
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r0, 0, 7); ctx.clip();
  ctx.strokeStyle = 'rgba(140,170,200,0.22)';
  for (const r of [0, 0.2, 0.5, 1, 2, 5]) { const c = r / (1 + r), rad = 1 / (1 + r); ctx.beginPath(); ctx.arc(cx + c * r0, cy, rad * r0, 0, 7); ctx.stroke(); }
  for (const x of [0.2, 0.5, 1, 2, 5]) for (const s of [1, -1]) { ctx.beginPath(); ctx.arc(cx + r0, cy - s * r0 / x, r0 / x, 0, 7); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(cx - r0, cy); ctx.lineTo(cx + r0, cy); ctx.stroke();
  // SWR 2 circle
  ctx.strokeStyle = 'rgba(94,224,138,0.5)'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(cx, cy, r0 / 3, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  for (const t of traces) {
    ctx.strokeStyle = t.color; ctx.lineWidth = 2; ctx.beginPath();
    t.pts.forEach((g, i) => { const [x, y] = P(g); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.stroke(); ctx.lineWidth = 1;
  }
  for (const m of marks) { const [x, y] = P(m.g); ctx.fillStyle = m.color; ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill(); }
  ctx.restore();
  ctx.strokeStyle = '#4a5d72'; ctx.beginPath(); ctx.arc(cx, cy, r0, 0, 7); ctx.stroke();
  ctx.fillStyle = '#7f93a8'; ctx.font = '10px ui-monospace, monospace';
  ctx.fillText('50 Ω', cx + 3, cy - 4); ctx.fillText('SWR 2', cx + r0 / 3 + 2, cy + 12);
}

// Polar plot of gain in dBi. values over angles [deg]; compass=true for azimuth (0 at top, clockwise)
export function polar(cv, { values, angles, title, compass, maxG, ringDb = [0, -3, -10, -20, -30] }) {
  const { ctx, W, H } = setupCanvas(cv);
  ctx.fillStyle = css('--plot-bg', '#0b1219'); ctx.fillRect(0, 0, W, H);
  const cx = W / 2, cy = compass ? H / 2 + 6 : H - 22, r0 = compass ? Math.min(W, H - 12) / 2 - 14 : Math.min(W / 2, H - 34) - 8;
  const top = maxG ?? Math.max(...values);
  // ARRL-style log-periodic scale: 0.89^(-dB/2)
  const rr = (db) => r0 * Math.pow(0.89, -(Math.max(db, -40)) / 2);
  ctx.strokeStyle = 'rgba(140,170,200,0.2)'; ctx.fillStyle = '#7f93a8'; ctx.font = '10px ui-monospace, monospace';
  for (const d of ringDb) { ctx.beginPath(); compass ? ctx.arc(cx, cy, rr(d), 0, 7) : ctx.arc(cx, cy, rr(d), Math.PI, 2 * Math.PI); ctx.stroke(); ctx.fillText(`${d}`, cx + 2, cy - rr(d) + 10); }
  for (let a = 0; a < 360; a += 30) {
    if (!compass && a > 180) break;
    const th = compass ? (a - 90) * Math.PI / 180 : Math.PI + a * Math.PI / 180;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(th) * r0, cy + Math.sin(th) * r0); ctx.stroke();
    if (compass) ctx.fillText(a === 0 ? 'N' : a === 90 ? 'E' : a === 180 ? 'S' : a === 270 ? 'W' : `${a}`, cx + Math.cos(th) * (r0 + 8) - 6, cy + Math.sin(th) * (r0 + 8) + 4);
  }
  ctx.fillStyle = 'rgba(255,179,71,0.18)'; ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 2; ctx.beginPath();
  values.forEach((v, i) => {
    const a = angles[i];
    const th = compass ? (a - 90) * Math.PI / 180 : Math.PI + a * Math.PI / 180;
    const r = rr(v - top);
    const x = cx + Math.cos(th) * r, y = cy + Math.sin(th) * r;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.lineWidth = 1;
  ctx.fillStyle = '#c9d6e3'; ctx.fillText(title || '', 6, 12);
  ctx.fillText(`max ${top.toFixed(2)} dBi`, W - 92, 12);
}

// Rotatable 3D wire view. segs: [{p0,p1}], mags: per-segment relative current 0..1
export function wire3d(cv, { segs, mags, feedPt, ground, view }) {
  const { ctx, W, H } = setupCanvas(cv);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0c1a2b'); g.addColorStop(1, '#13283b');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (!segs.length) return;
  let ext = 1, zmax = 0;
  for (const s of segs) for (const p of [s.p0, s.p1]) { ext = Math.max(ext, Math.abs(p[0]), Math.abs(p[1]), p[2] / 2); zmax = Math.max(zmax, p[2]); }
  const yaw = view.yaw, pitch = view.pitch, sc = Math.min(W, H) / (2.3 * ext) * (view.zoom || 1);
  const prj = ([x, y, z]) => {
    const x1 = x * Math.cos(yaw) - y * Math.sin(yaw), y1 = x * Math.sin(yaw) + y * Math.cos(yaw);
    const z2 = z * Math.cos(pitch) - y1 * Math.sin(pitch), d = y1 * Math.cos(pitch) + z * Math.sin(pitch);
    return [W / 2 + x1 * sc, H / 2 - (z2 - zmax / 2 * Math.cos(pitch)) * sc, d];
  };
  if (ground) {
    ctx.strokeStyle = 'rgba(94,170,110,0.25)';
    const n = 8, e = ext * 1.2;
    for (let i = -n; i <= n; i++) {
      const a = prj([i * e / n, -e, 0]), b = prj([i * e / n, e, 0]); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      const c = prj([-e, i * e / n, 0]), d = prj([e, i * e / n, 0]); ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.stroke();
    }
    // mast shadows
    ctx.strokeStyle = 'rgba(160,160,160,0.25)';
    for (const s of segs) for (const p of [s.p0]) { const a = prj(p), b = prj([p[0], p[1], 0]); ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.setLineDash([]); }
  }
  const order = segs.map((s, i) => ({ s, i, d: (prj(s.p0)[2] + prj(s.p1)[2]) / 2 })).sort((a, b) => b.d - a.d);
  for (const { s, i } of order) {
    const a = prj(s.p0), b = prj(s.p1);
    const m = mags ? mags[i] : 0.3;
    ctx.strokeStyle = mags ? heat(m) : '#d9a441';
    ctx.lineWidth = 2 + (mags ? m * 4 : 0);
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  }
  ctx.lineWidth = 1;
  if (feedPt) { const f = prj(feedPt); ctx.fillStyle = '#ff4d4d'; ctx.beginPath(); ctx.arc(f[0], f[1], 5, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = '10px sans-serif'; ctx.fillText('feed', f[0] + 7, f[1] - 6); }
  ctx.fillStyle = '#7f93a8'; ctx.font = '10px ui-monospace, monospace';
  ctx.fillText(mags ? 'colour = current magnitude (blue low → red high) · drag to rotate · wheel to zoom' : 'drag to rotate · wheel to zoom', 8, H - 8);
}
export function heat(v) {
  v = Math.max(0, Math.min(1, v));
  const stops = [[0, [40, 80, 220]], [0.35, [40, 200, 220]], [0.6, [120, 230, 90]], [0.8, [250, 200, 40]], [1, [255, 60, 40]]];
  for (let i = 1; i < stops.length; i++) if (v <= stops[i][0]) {
    const [a, c0] = stops[i - 1], [b, c1] = stops[i], t = (v - a) / (b - a);
    return `rgb(${c0.map((x, j) => Math.round(x + (c1[j] - x) * t)).join(',')})`;
  }
  return 'rgb(255,60,40)';
}
