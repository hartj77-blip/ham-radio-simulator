// Live feeds: real radio you can listen to from the browser. A curated directory of public web
// SDR receivers, scanner/air-band audio, propagation spot networks and space-weather data;
// a search of the Radio Browser directory; and the user's own saved feeds (audio streams or
// receiver pages) with a built-in player that can hand its audio to the spectrum analyzer.
import { S, save } from './state.js';
import { h, bus, toast, download } from './util.js';
import { icon } from './icons.js';
import { FEED_DIRECTORY, LISTENING_RULES } from './data/feeds.js';
import { specCtx } from './spectrum.js';

const RB = 'https://de1.api.radio-browser.info/json';
const TAGS = ['scanner', 'police', 'aviation', 'atc', 'ham radio', 'amateur radio', 'shortwave', 'weather', 'news', 'public safety'];
const CATS = ['Web SDR receivers', 'Amateur radio audio', 'Aviation', 'Public safety and weather', 'Broadcast', 'Propagation and spots', 'Other'];

let root, results = [], searching = false, query = '', editing = null, filter = 'all';
const P = { el: null, feed: null, cors: false, node: null };

const uid = () => Math.random().toString(36).slice(2, 10);
const isHttp = (u) => /^https?:\/\//i.test(u || '');
const isPlaylist = (u) => /\.(pls|m3u)(\?|$)/i.test(u);
const isHls = (u) => /\.m3u8(\?|$)/i.test(u);

// ------------------------------------------------------------------ player
async function resolvePlaylist(url) {
  const r = await fetch(url);
  const txt = await r.text();
  const m = txt.match(/^File\d+=(https?:\/\/\S+)/m) || txt.match(/^(https?:\/\/\S+)/m);
  if (!m) throw new Error('empty playlist');
  return m[1].trim();
}
function stop() {
  if (P.el) { P.el.pause(); P.el.removeAttribute('src'); P.el.load(); }
  P.el = null; P.feed = null; P.node = null; P.cors = false;
  renderPlayer();
}
async function play(feed) {
  stop();
  let url = feed.url;
  if (!isHttp(url)) { toast('Feeds must be web addresses starting with https://', 'warn'); return; }
  if (location.protocol === 'https:' && /^http:/i.test(url)) {
    toast('This stream uses plain http, which browsers block on a secure page. Opening it in a new tab instead.', 'warn', 7000);
    window.open(url, '_blank', 'noopener'); return;
  }
  P.feed = { ...feed, status: 'Connecting…' }; renderPlayer();
  try { if (isPlaylist(url)) url = await resolvePlaylist(url); } catch (e) { toast('Could not read that playlist from here. Opening it in a new tab.', 'warn'); window.open(feed.url, '_blank', 'noopener'); stop(); return; }
  if (isHls(url) && !document.createElement('audio').canPlayType('application/vnd.apple.mpegurl')) {
    toast('This is an HLS (.m3u8) stream, which only Safari plays directly. Opening it in a new tab.', 'warn', 7000); window.open(url, '_blank', 'noopener'); stop(); return;
  }
  const tryPlay = async (cors) => {
    const el = new Audio();
    if (cors) el.crossOrigin = 'anonymous';
    el.preload = 'none'; el.src = url; el.volume = S.feedVol ?? 0.8;
    await el.play();
    return el;
  };
  try { P.el = await tryPlay(true); P.cors = true; } catch (e) {
    try { P.el = await tryPlay(false); P.cors = false; } catch (e2) {
      P.feed = null; renderPlayer();
      toast('That stream would not play. It may be offline, need its own player page, or use a format this browser does not support.', 'warn', 8000); return;
    }
  }
  P.feed = { ...feed, status: 'Live' };
  P.el.addEventListener('waiting', () => { if (P.feed) { P.feed.status = 'Buffering…'; renderPlayer(); } });
  P.el.addEventListener('playing', () => { if (P.feed) { P.feed.status = 'Live'; renderPlayer(); } });
  P.el.addEventListener('error', () => { if (P.feed) { P.feed.status = 'Stream error'; renderPlayer(); } });
  renderPlayer();
}
function analyze() {
  if (!P.el || !P.cors) return;
  const ctx = specCtx();
  if (!P.node) { P.node = ctx.createMediaElementSource(P.el); P.node.connect(ctx.destination); }
  bus.emit('spectrum-src', P.node, P.feed.name);
  bus.emit('goto', 'rftools');
  setTimeout(() => document.getElementById('rt-sec-spectrum')?.scrollIntoView({ behavior: 'smooth' }), 100);
}

let playerEl;
function renderPlayer() {
  if (!playerEl) return;
  playerEl.innerHTML = '';
  playerEl.hidden = !P.feed;
  if (!P.feed) return;
  const vol = h('input', { type: 'range', min: 0, max: 1, step: 0.01, value: S.feedVol ?? 0.8, 'aria-label': 'Volume' });
  vol.oninput = () => { S.feedVol = +vol.value; if (P.el) P.el.volume = +vol.value; save(); };
  playerEl.append(
    h('span', { class: 'fp-icon', html: icon('volume') }),
    h('div', { class: 'fp-meta' }, h('b', {}, P.feed.name), h('span', { class: 'small muted' }, P.feed.status, P.feed.freq ? ` · ${P.feed.freq}` : '')),
    vol,
    P.cors ? h('button', { class: 'btn small', onclick: analyze, title: 'Show this audio on the spectrum analyzer' }, h('span', { html: icon('waveform') }), 'Analyze') : h('span', { class: 'tiny muted', title: 'The stream server does not allow other pages to read its audio (no CORS), so it can play but not be analysed. You can still analyse it with Browser tab audio.' }, 'Analysis unavailable'),
    h('button', { class: 'btn small warn', onclick: stop }, 'Stop'));
}

// ------------------------------------------------------------------ Radio Browser search
async function search(q, tag) {
  searching = true; render();
  try {
    const p = new URLSearchParams({ hidebroken: 'true', is_https: 'true', order: 'clickcount', reverse: 'true', limit: '40' });
    if (q) p.set('name', q);
    if (tag) p.set('tag', tag);
    const r = await fetch(`${RB}/stations/search?${p}`);
    if (!r.ok) throw new Error(r.status);
    const list = await r.json();
    results = list.map((x) => ({ id: x.stationuuid, name: (x.name || '').trim().slice(0, 70), url: x.url_resolved || x.url, kind: 'audio', cat: /scanner|police|fire|ems|public safety/i.test(x.tags) ? 'Public safety and weather' : /aviation|atc|air/i.test(x.tags) ? 'Aviation' : /ham|amateur/i.test(x.tags) ? 'Amateur radio audio' : 'Broadcast', notes: [x.country, x.state, x.codec && `${x.codec} ${x.bitrate || ''}k`].filter(Boolean).join(' · '), homepage: x.homepage, tags: x.tags }));
  } catch (e) { results = []; toast('The Radio Browser directory could not be reached. Try again in a moment.', 'warn'); }
  searching = false; render();
}

// ------------------------------------------------------------------ my feeds
function feeds() { if (!Array.isArray(S.feeds)) S.feeds = []; return S.feeds; }
function addFeed(f, quiet) {
  if (!isHttp(f.url)) { toast('Enter a full web address starting with https://', 'warn'); return false; }
  if (feeds().some((x) => x.url === f.url)) { if (!quiet) toast('That feed is already in your list.', 'info'); return false; }
  feeds().unshift({ id: uid(), name: f.name || f.url, url: f.url, kind: f.kind || 'audio', cat: f.cat || 'Other', freq: f.freq || '', notes: f.notes || '', added: Date.now() });
  save(); if (!quiet) toast(`Added “${f.name || 'feed'}” to My feeds.`, 'good', 2500);
  return true;
}
function openFeed(f) { if (f.kind === 'audio') play(f); else window.open(f.url, '_blank', 'noopener'); }

function feedForm(f) {
  const v = { name: '', url: '', kind: 'audio', cat: 'Amateur radio audio', freq: '', notes: '', ...(f || {}) };
  const name = h('input', { type: 'text', value: v.name, placeholder: 'e.g. Local 2 m repeater' });
  const url = h('input', { type: 'text', value: v.url, placeholder: 'https://…', inputmode: 'url' });
  const kind = h('select', {}, h('option', { value: 'audio', selected: v.kind === 'audio' }, 'Audio stream (plays here)'), h('option', { value: 'web', selected: v.kind === 'web' }, 'Web page or receiver (opens in a new tab)'));
  const cat = h('select', {}, ...CATS.map((c) => h('option', { value: c, selected: c === v.cat }, c)));
  const freq = h('input', { type: 'text', value: v.freq, placeholder: 'e.g. 146.940 MHz FM' });
  const notes = h('input', { type: 'text', value: v.notes, placeholder: 'Optional' });
  const submit = () => {
    const nv = { name: name.value.trim(), url: url.value.trim(), kind: kind.value, cat: cat.value, freq: freq.value.trim(), notes: notes.value.trim() };
    if (f) { if (!isHttp(nv.url)) { toast('Enter a full web address starting with https://', 'warn'); return; } Object.assign(feeds().find((x) => x.id === f.id), nv); save(); editing = null; render(); }
    else if (addFeed(nv)) render();
  };
  return h('div', { class: 'feed-form' },
    h('label', {}, 'Name', name), h('label', {}, 'Address (URL)', url), h('label', {}, 'Type', kind), h('label', {}, 'Category', cat), h('label', {}, 'Frequency (optional)', freq), h('label', {}, 'Notes', notes),
    h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: submit }, f ? 'Save changes' : 'Add feed'), f ? h('button', { class: 'btn ghost', onclick: () => { editing = null; render(); } }, 'Cancel') : null));
}

function exportFeeds() { download('my-radio-feeds.json', JSON.stringify(feeds(), null, 2), 'application/json'); }
function importFeeds() {
  const inp = h('input', { type: 'file', accept: '.json,application/json' });
  inp.onchange = async () => {
    try {
      const list = JSON.parse(await inp.files[0].text());
      if (!Array.isArray(list)) throw new Error();
      let n = 0; for (const f of list) if (f && typeof f.url === 'string' && addFeed({ ...f, name: String(f.name || '').slice(0, 80), notes: String(f.notes || '').slice(0, 200), freq: String(f.freq || '').slice(0, 40) }, true)) n++;
      toast(`Imported ${n} feed${n === 1 ? '' : 's'}.`, 'good'); render();
    } catch (e) { toast('That file is not a feed list exported from this page.', 'warn'); }
  };
  inp.click();
}

// ------------------------------------------------------------------ rendering
function feedRow(f, { mine, directory } = {}) {
  const playing = P.feed && P.feed.url === f.url;
  const actions = h('div', { class: 'feed-actions' },
    f.kind === 'audio'
      ? h('button', { class: `btn small ${playing ? 'active' : 'primary'}`, onclick: () => (playing ? stop() : play(f)) }, h('span', { html: icon(playing ? 'minus' : 'play') }), playing ? 'Stop' : 'Listen')
      : h('a', { class: 'btn small primary', href: f.url, target: '_blank', rel: 'noopener' }, h('span', { html: icon('external') }), 'Open'),
    !mine ? h('button', { class: 'btn small ghost', title: 'Save to My feeds', onclick: () => { addFeed(f); render(); } }, '+ Save') : null,
    mine ? h('button', { class: 'btn small ghost', onclick: () => { editing = f.id; render(); } }, 'Edit') : null,
    mine ? h('button', { class: 'btn small ghost', title: 'Remove', onclick: () => { S.feeds = feeds().filter((x) => x.id !== f.id); save(); render(); } }, h('span', { html: icon('x') })) : null,
    f.homepage && !directory ? h('a', { class: 'btn small ghost', href: f.homepage, target: '_blank', rel: 'noopener', title: 'Station home page' }, h('span', { html: icon('globe') })) : null);
  return h('div', { class: `feed-row ${playing ? 'playing' : ''}` },
    h('span', { class: 'feed-kind', html: icon(f.kind === 'audio' ? 'volume' : 'globe'), title: f.kind === 'audio' ? 'Audio stream' : 'Web receiver or page' }),
    h('div', { class: 'feed-meta' }, h('b', {}, f.name), f.desc ? h('div', { class: 'small' }, f.desc) : null,
      h('div', { class: 'tiny muted' }, [f.freq, f.notes, f.region].filter(Boolean).join(' · ') || (directory ? new URL(f.url).hostname : f.url))),
    actions);
}

function render() {
  if (!root) return;
  root.innerHTML = '';
  const mine = feeds();
  const qIn = h('input', { type: 'search', placeholder: 'Station name, e.g. “weather” or “ATC”', value: query });
  qIn.onkeydown = (e) => { if (e.key === 'Enter') { query = qIn.value.trim(); search(query); } };
  const catFilter = h('div', { class: 'row feed-filter' }, ...['all', ...FEED_DIRECTORY.map((c) => c.cat)].map((c) => h('button', { class: `chip ${filter === c ? 'active' : ''}`, onclick: () => { filter = c; render(); } }, c === 'all' ? 'All' : c)));

  root.append(
    h('div', { class: 'page-head' }, h('div', {}, h('div', { class: 'eyebrow' }, 'Listen'), h('h1', {}, 'Live feeds'),
      h('p', { class: 'lead' }, 'Hear real radio. Tune web SDR receivers around the world yourself, listen to live amateur, air-band and weather audio, follow live propagation spots, and save your own feeds. Everything here is real; nothing in this page is simulated.'))),
    h('div', { class: 'callout' }, h('span', { html: icon('info') }), h('span', {}, LISTENING_RULES)),

    h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('div', {}, h('h3', {}, `My feeds (${mine.length})`), h('p', { class: 'small muted' }, 'Saved in this browser only. Audio streams play here; receiver pages open in a new tab.')),
        h('div', { class: 'row' }, h('button', { class: 'btn small ghost', onclick: importFeeds }, h('span', { html: icon('upload') }), 'Import'), mine.length ? h('button', { class: 'btn small ghost', onclick: exportFeeds }, h('span', { html: icon('download') }), 'Export') : null)),
      mine.length ? h('div', { class: 'feed-list' }, ...mine.map((f) => (editing === f.id ? feedForm(f) : feedRow(f, { mine: true })))) : h('p', { class: 'small muted' }, 'No saved feeds yet. Save one from the directory below, or add your own.'),
      h('details', { class: 'feed-add', open: !mine.length }, h('summary', {}, 'Add a feed'),
        h('p', { class: 'small muted' }, 'Paste a direct stream address (MP3, AAC or Ogg, or a .pls/.m3u playlist) to play it here, or any receiver page (WebSDR, KiwiSDR, OpenWebRX, Broadcastify, LiveATC) to keep it one click away. Many scanner sites only allow listening through their own player; save those as web pages.'),
        editing ? null : feedForm())),

    h('section', { class: 'card' },
      h('h3', {}, 'Find streams'),
      h('p', { class: 'small muted' }, 'Search the Radio Browser community directory for streams people have listed, including scanner, air-band and amateur feeds. Only secure (https) streams are shown because browsers block the others on this page.'),
      h('div', { class: 'row' }, qIn, h('button', { class: 'btn primary', onclick: () => { query = qIn.value.trim(); search(query); } }, h('span', { html: icon('search') }), 'Search')),
      h('div', { class: 'row feed-tags' }, ...TAGS.map((t) => h('button', { class: 'chip', onclick: () => search('', t) }, t))),
      searching ? h('p', { class: 'small muted' }, 'Searching…') : results.length ? h('div', { class: 'feed-list' }, ...results.map((f) => feedRow(f))) : null),

    h('section', {}, h('h2', { class: 'feed-h2' }, 'Directory'),
      h('p', { class: 'small muted' }, 'Free, public services, checked for this release. Receiver pages are run by volunteers and universities; availability changes, so if one is down try another.'),
      catFilter,
      ...FEED_DIRECTORY.filter((c) => filter === 'all' || c.cat === filter).map((c) => h('div', { class: 'card' }, h('h3', {}, c.cat), c.intro ? h('p', { class: 'small muted' }, c.intro) : null,
        h('div', { class: 'feed-list' }, ...c.items.map((f) => feedRow({ ...f, cat: c.cat }, { directory: true })))))));
}

export function initFeeds(el) {
  root = el;
  playerEl = h('div', { class: 'feed-player', hidden: true });
  document.body.append(playerEl);
  render();
  bus.on('tab', () => renderPlayer());
}
