// Feedback: a small "?" button that opens a form for reporting a problem, suggesting an
// improvement or asking a question. The site has no server, so the report becomes a
// pre-filled GitHub issue (or can be copied to the clipboard instead).
import { S } from './state.js';
import { h, toast, modal } from './util.js';
import { icon } from './icons.js';
import { rig } from './rigs.js';

const REPO = 'hartj77-blip/ham-radio-simulator';
const KINDS = [
  ['bug', 'Something is wrong', 'Describe what happened and what you expected instead.', 'bug'],
  ['idea', 'Suggest an improvement', 'Describe the feature or change you would like.', 'enhancement'],
  ['question', 'Ask a question', 'What would you like to know?', 'question'],
];

// Non-personal context that helps reproduce a problem. No name, callsign or precise location.
function diagnostics() {
  const r = S.radio || {};
  return [
    `- Page: ${document.body.dataset.tab || '?'}`,
    `- Mode: ${S.mode || '?'}`,
    `- Radio: ${rig().name} · ${(r.freq / 1e6).toFixed(3)} MHz ${r.mode || ''}`,
    `- Antenna: ${S.antenna?.type || '?'}${S.antenna?.built ? ' (up)' : ' (down)'}`,
    `- Training step: ${S.mode === 'training' ? (S.training?.step ?? 0) + 1 : 'n/a'}`,
    `- View: ${window.innerWidth}×${window.innerHeight}${document.body.classList.contains('ht-view') ? ' · handheld' : ''}`,
    `- Browser: ${navigator.userAgent}`,
  ].join('\n');
}

export function openFeedback(kind = 'bug') {
  let close, cur = kind;
  const seg = h('div', { class: 'seg fb-kinds' });
  const title = h('input', { type: 'text', placeholder: 'Short summary', maxlength: 120 });
  const body = h('textarea', { rows: 6 });
  const steps = h('textarea', { rows: 3, placeholder: '1. Go to …\n2. Click …\n3. See …' });
  const stepsField = h('label', { class: 'fc-field' }, h('span', {}, 'Steps to reproduce (optional)'), steps);
  const diag = h('input', { type: 'checkbox', checked: true });
  const diagPre = h('pre', { class: 'fb-diag' }, diagnostics());
  const drawKinds = () => {
    seg.innerHTML = '';
    for (const [k, label] of KINDS) seg.append(h('button', { class: k === cur ? 'active' : '', onclick: () => { cur = k; drawKinds(); } }, label));
    const K = KINDS.find((x) => x[0] === cur);
    body.placeholder = K[2];
    stepsField.hidden = cur !== 'bug';
  };
  drawKinds();
  const compose = () => {
    const K = KINDS.find((x) => x[0] === cur);
    const t = title.value.trim() || (body.value.trim().split('\n')[0] || K[1]).slice(0, 80);
    let md = `${body.value.trim() || '_No description_'}\n`;
    if (cur === 'bug' && steps.value.trim()) md += `\n**Steps to reproduce**\n${steps.value.trim()}\n`;
    if (diag.checked) md += `\n<details><summary>Diagnostics</summary>\n\n${diagnostics()}\n</details>\n`;
    md += '\n_Submitted from the in-app feedback form._';
    return { title: `[${K[1]}] ${t}`, body: md, label: K[3] };
  };
  const valid = () => {
    if (!body.value.trim() && !title.value.trim()) { toast('Please describe the issue first.', 'warn', 3000); body.focus(); return false; }
    return true;
  };
  const submit = () => {
    if (!valid()) return;
    const c = compose();
    // Keep the URL within browser limits: long diagnostics are trimmed.
    let b = c.body;
    if (b.length > 6000) b = b.slice(0, 6000) + '\n…';
    const url = `https://github.com/${REPO}/issues/new?${new URLSearchParams({ title: c.title, body: b, labels: c.label })}`;
    window.open(url, '_blank', 'noopener');
    close();
    toast('GitHub opened in a new tab with your report filled in. Review it and press <b>Create</b> to submit.', 'good', 7000);
  };
  const copy = async () => {
    if (!valid()) return;
    const c = compose();
    try { await navigator.clipboard.writeText(`${c.title}\n\n${c.body}`); toast('Report copied to the clipboard.', 'good', 3000); } catch (e) { toast('Could not access the clipboard.', 'warn', 3000); }
  };
  close = modal(h('div', { class: 'feedback' },
    h('div', { class: 'eyebrow' }, 'Feedback'),
    h('h2', {}, 'Report an issue'),
    h('p', { class: 'small muted' }, 'Found a bug, have an idea or a question? Your report is posted as an issue on the project\'s GitHub page, where you can follow its progress.'),
    seg,
    h('label', { class: 'fc-field' }, h('span', {}, 'Title'), title),
    h('label', { class: 'fc-field' }, h('span', {}, 'Description'), body),
    stepsField,
    h('label', { class: 'inline small fb-diag-toggle' }, diag, ' Include diagnostics (page, mode, radio, screen size, browser — no personal details)'),
    h('details', { class: 'fb-diag-box' }, h('summary', { class: 'tiny muted' }, 'Show what is included'), diagPre),
    h('div', { class: 'row fb-actions' },
      h('button', { class: 'btn primary', onclick: submit }, h('span', { html: icon('external') }), 'Submit on GitHub'),
      h('button', { class: 'btn ghost', onclick: copy }, 'Copy report'),
      h('span', { class: 'tiny muted' }, 'Submitting requires a free GitHub account.'))));
  setTimeout(() => title.focus(), 50);
}

export function initFeedback() {
  const btn = h('button', { class: 'fb-fab', title: 'Report an issue or send feedback', 'aria-label': 'Report an issue or send feedback', onclick: () => openFeedback() }, h('span', { html: icon('help') }));
  document.body.append(btn);
}
