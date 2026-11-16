// Radio history: real recordings of past radio events (public-domain NASA mission audio from the
// NASA Audio Collection at the Internet Archive) and short histories of amateur radio's role in
// real events. Recordings stream from the Internet Archive; nothing is re-hosted here.
import { h, bus } from './util.js';
import { icon } from './icons.js';

const IA = (id, file) => ({ page: `https://archive.org/details/${id}`, src: `https://archive.org/download/${id}/${file}` });

// Each: title, date, length, what it is, what to listen for (radio lessons), source.
export const RECORDINGS = [
  { id: 'mercury', title: 'Project Mercury', date: '1961–1963', len: '31 min', ...IA('ProjectMercuryHighlights', 'ProjectMercuryHighlights.mp3'),
    about: 'America\'s first crewed spaceflights. Single astronauts in small capsules, talking to a worldwide network of tracking stations as they passed overhead.',
    listen: 'Short, clipped exchanges and frequent loss of signal as the capsule moves between ground stations: line-of-sight radio in action. Note the procedure words and how often each side confirms what it heard.' },
  { id: 'gemini', title: 'Project Gemini', date: '1965–1966', len: '32 min', ...IA('ProjectGeminiHighlights', 'ProjectGeminiHighlights.mp3'),
    about: 'Two-person flights that practised rendezvous, docking and spacewalks in preparation for the Moon.',
    listen: 'Crews reading numbers and checklist items back to the ground. Read-back of critical values is the same discipline used in emergency-net message handling.' },
  { id: 'apollo8', title: 'Apollo 8', date: 'December 1968', len: '22 min', ...IA('Apollo8Highlights', 'Apollo8Highlights.mp3'),
    about: 'The first crewed flight to orbit the Moon, including the crew\'s broadcast from lunar orbit on Christmas Eve.',
    listen: 'Communication stops completely while the spacecraft is behind the Moon ("loss of signal") and resumes when it reappears ("acquisition of signal"). The Moon blocks the path just as a hill blocks a VHF signal.' },
  { id: 'apollo11', title: 'Apollo 11', date: 'July 1969', len: '61 min', ...IA('Apollo11AudioHighlights', 'Apollo11Highlights.mp3'),
    about: 'The first crewed landing on the Moon: launch, lunar orbit, the descent and "The Eagle has landed", and the first steps on the surface.',
    listen: 'A single controller (the capsule communicator) speaks for the whole control room, so the crew hears one voice: exactly how a net control station keeps a busy net orderly. Listen for the calm, brief "go / no go" calls during the descent.' },
  { id: 'apollo13', title: 'Apollo 13', date: 'April 1970', len: '35 min', ...IA('Apollo13Highlights', 'Apollo13Highlights.mp3'),
    about: 'An oxygen tank failure on the way to the Moon turned the mission into a rescue. The crew returned safely after improvising with the lunar module.',
    listen: 'How an emergency is reported on the radio: what happened, what the instruments show, then a calm exchange of facts. This is the model for passing emergency traffic: state the facts, confirm, act.' },
  { id: 'apollo17', title: 'Apollo 17', date: 'December 1972', len: '32 min', ...IA('Apollo17Highlights', 'Apollo17Highlights.mp3'),
    about: 'The last crewed Moon landing to date, with the longest time on the lunar surface.',
    listen: 'Voices delayed by about 1.3 seconds each way: the light-time to the Moon. Notice how both sides leave pauses so they do not talk over each other, as on any half-duplex radio link.' },
  { id: 'astp', title: 'Apollo–Soyuz Test Project', date: 'July 1975', len: '94 min', ...IA('AstpHighlights', 'AstpHighlights.mp3'),
    about: 'The first joint mission between the United States and the Soviet Union: an Apollo and a Soyuz spacecraft docked in orbit.',
    listen: 'Two languages and two sets of procedures on one link. Clear, slow speech and agreed phrases matter more than speed, the same reason amateur radio uses the phonetic alphabet and Q-codes.' },
  { id: 'sts1', title: 'STS-1, first Space Shuttle flight', date: 'April 1981', len: '57 min', ...IA('Sts-1Highlights', 'Sts-1Highlights.mp3'),
    about: 'The first orbital flight of the Space Shuttle, crewed by John Young and Robert Crippen.',
    listen: 'Communication blackout during re-entry, when ionised gas around the vehicle blocks radio signals: a dramatic example of how ionisation affects radio, the same physics that makes the ionosphere reflect HF.' },
  { id: 'sts9', title: 'STS-9, first amateur radio in space', date: 'November–December 1983', len: '54 min', ...IA('Sts-9Highlights', 'Sts-9Highlights.mp3'),
    about: 'The first Spacelab mission. Astronaut Owen Garriott, a licensed amateur, made the first amateur radio contacts from space on 2 m FM with a handheld radio, the beginning of what became amateur radio on the International Space Station.',
    listen: 'Mission highlights from the flight that started amateur radio in space. Today students can talk to the ISS crew on 2 m during scheduled school contacts; your handheld and a simple antenna are enough to hear the station pass overhead.' },
];

// Amateur radio in real events (original summaries; no recordings).
export const EVENTS = [
  { title: 'RMS Titanic and the Radio Act', date: '1912', text: 'The sinking of the Titanic showed how much depended on wireless: distress calls reached ships nearby, but procedures were inconsistent and not every ship kept a radio watch. The US Radio Act of 1912 followed, requiring licences for operators and stations and setting aside frequencies, the beginning of the licensing system amateurs still use.', ref: 'licensing' },
  { title: 'Founding of organised amateur relay networks', date: '1914', text: 'Early amateurs formed relay networks to pass written messages across the country station by station, because individual stations could not cover long distances reliably. Formal traffic handling on today\'s nets descends directly from these relays.', ref: 'emergency', practise: 'nets' },
  { title: 'First amateur radio contact from space', date: '1983', text: 'During the STS-9 Space Shuttle mission an astronaut-amateur made 2 m FM contacts with stations on the ground using a handheld radio. Amateur radio aboard the International Space Station grew from this flight and continues today.', ref: 'vhf-propagation', recording: 'sts9' },
  { title: 'Hurricane Katrina', date: '2005', text: 'When the storm destroyed much of the communications infrastructure along the US Gulf Coast, volunteer amateur operators passed health-and-welfare and emergency messages for shelters, hospitals and relief agencies using HF nets and local VHF repeaters. It is often cited as a case for keeping emergency-capable amateur stations.', ref: 'emergency', practise: 'nets' },
  { title: 'Hurricane Maria in Puerto Rico', date: '2017', text: 'With power and most communications down across the island for weeks, amateur operators handled messages to and from the mainland and supported relief organisations, and many operators volunteered to deploy. Battery power and simple wire antennas were central.', ref: 'power-supplies', practise: 'nets' },
  { title: 'Field Day: practising for the real thing', date: 'Every June', text: 'Each year thousands of operators set up temporary stations on emergency power for 24 hours to practise operating away from home and to show the public what amateur radio can do. Contest practice in this simulator includes a Field Day.', ref: 'contesting' },
];

let root;
export function initHistory(el) {
  root = el;
  render();
}

function render() {
  root.innerHTML = '';
  root.append(
    h('div', { class: 'page-head' }, h('div', {},
      h('div', { class: 'eyebrow' }, 'Learn'), h('h1', {}, 'Radio history'),
      h('p', { class: 'lead' }, 'Listen to real recordings of historic radio links and learn what they teach about radio operating. Mission audio is public domain, from the NASA Audio Collection at the Internet Archive.'))),
    h('div', { class: 'callout' }, h('span', { html: icon('info') }), 'These are real archival recordings, not simulations. They stream from the Internet Archive when you press play and can be long, so use the timeline to skip around.'),
    h('h2', { class: 'hist-h' }, 'Historic recordings'),
    h('div', { class: 'hist-grid' }, ...RECORDINGS.map(card)),
    h('h2', { class: 'hist-h' }, 'Amateur radio in history'),
    h('div', { class: 'hist-events' }, ...EVENTS.map(event)),
    h('p', { class: 'tiny muted' }, 'Recordings: NASA Johnson Space Center, Houston Audio Control Room, via the Internet Archive NASA Audio Collection (US Government works, public domain). Event summaries are original and simplified; see the reference library for detail.'),
  );
}

function card(r) {
  const audio = h('audio', { controls: true, preload: 'none', src: r.src, class: 'hist-audio' });
  audio.addEventListener('play', () => root.querySelectorAll('audio').forEach((a) => { if (a !== audio) a.pause(); }));
  return h('article', { class: 'card hist-card', id: `hist-${r.id}` },
    h('div', { class: 'row spread' }, h('span', { class: 'eyebrow' }, r.date), h('span', { class: 'tiny muted mono' }, r.len)),
    h('h3', {}, r.title),
    h('p', { class: 'small' }, r.about),
    h('div', { class: 'hist-listen small' }, h('b', {}, 'Listen for: '), r.listen),
    audio,
    h('div', { class: 'tiny muted' }, 'Source: ', h('a', { href: r.page, target: '_blank', rel: 'noopener' }, 'NASA Audio Collection, Internet Archive'), ' · public domain'));
}

function event(e) {
  return h('div', { class: 'hist-event' },
    h('div', { class: 'he-date mono' }, e.date),
    h('div', {}, h('b', {}, e.title), h('p', { class: 'small' }, e.text),
      h('div', { class: 'row' },
        e.ref ? h('button', { class: 'btn ghost small', onclick: () => bus.emit('library', e.ref) }, h('span', { html: icon('book') }), 'Read more') : '',
        e.practise === 'nets' ? h('button', { class: 'btn ghost small', onclick: () => bus.emit('open-nets') }, 'Practise on a net') : '',
        e.recording ? h('button', { class: 'btn ghost small', onclick: () => { const c = root.querySelector(`#hist-${e.recording}`); c?.scrollIntoView({ behavior: 'smooth', block: 'center' }); c?.classList.add('pulse-hl'); setTimeout(() => c?.classList.remove('pulse-hl'), 3000); } }, 'Hear the recording') : '')));
}
