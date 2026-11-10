import { buildIndex, search, suggest } from './search.js';
import { isDevanagari } from './translit.js';

const $ = (sel) => document.querySelector(sel);
const view = $('#view');
const input = $('#q');
const clearBtn = $('#clear');

let entries = [];
let index = [];
let byId = new Map();

// ---------- storage (recent searches, saved words) ----------
// localStorage can be missing or throw (private mode); the app must still work.
const store = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* not persisted */ }
  },
};

const recent = {
  list: () => store.get('recent', []),
  add(q) {
    const t = q.trim();
    if (!t) return;
    const next = [t, ...recent.list().filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 8);
    store.set('recent', next);
  },
  clear: () => store.set('recent', []),
};

const saved = {
  ids: () => store.get('saved', []),
  has: (id) => saved.ids().includes(id),
  toggle(id) {
    const ids = saved.ids();
    const next = ids.includes(id) ? ids.filter((x) => x !== id) : [id, ...ids];
    store.set('saved', next);
    updateSavedCount();
    return next.includes(id);
  },
};

function updateSavedCount() {
  const n = saved.ids().length;
  $('#saved-count').textContent = n ? String(n) : '';
}

// ---------- rendering helpers ----------
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const POS_LONG = {
  'noun (m.)': 'noun, masculine',
  'noun (f.)': 'noun, feminine',
};

function wordRow(entry, why = '') {
  return `<li><a class="word-row" href="#/w/${entry.id}">
    <span class="row-head" lang="hi">${esc(entry.headword)}</span>
    <span class="row-body">
      <span class="row-roman">${esc(entry.transliteration)}</span>
      <span class="row-pos">${esc(entry.pos)}</span><br>
      <span class="row-mean">${esc(entry.meanings.join(', '))}</span>
      ${why ? `<br><span class="why">${esc(why)}</span>` : ''}
    </span>
  </a></li>`;
}

function whyText(result, query) {
  if (result.how === 'spelling') return `Close to “${query.trim()}”`;
  if (result.how === 'meaning') return 'Matched the English meaning';
  return '';
}

// ---------- views ----------
function renderHome() {
  const recents = recent.list();
  const sorted = [...entries].sort((a, b) => a.headword.localeCompare(b.headword, 'hi'));
  view.innerHTML = `
    ${recents.length ? `
      <h2 class="section-title">Recent searches</h2>
      <ul class="chips">${recents.map((q) => `<li><a class="chip" ${isDevanagari(q) ? 'lang="hi"' : ''} href="#/search/${encodeURIComponent(q)}">${esc(q)}</a></li>`).join('')}</ul>
      <button type="button" class="link-button" id="clear-recent">Clear recent searches</button>
    ` : `
      <h2 class="section-title">Try searching</h2>
      <ul class="chips">
        ${['dharm', 'धर्म', 'gyaan', 'shanti', 'vishwas', 'water'].map((q) => `<li><a class="chip" ${isDevanagari(q) ? 'lang="hi"' : ''} href="#/search/${encodeURIComponent(q)}">${esc(q)}</a></li>`).join('')}
      </ul>
    `}
    <h2 class="section-title">All ${entries.length} words</h2>
    <ul class="words">${sorted.map((e) => wordRow(e)).join('')}</ul>
  `;
  $('#clear-recent')?.addEventListener('click', () => { recent.clear(); renderHome(); });
}

function renderResults(query) {
  const results = search(index, query, { limit: 30 });
  if (!results.length) return renderNoResults(query);

  const strong = results.filter((r) => r.how !== 'spelling');
  const weak = results.filter((r) => r.how === 'spelling');

  if (!strong.length) {
    view.innerHTML = `
      <h2 class="section-title">No exact match. Did you mean</h2>
      <ul class="words">${weak.map((r) => wordRow(r.entry)).join('')}</ul>`;
    return;
  }
  view.innerHTML = `
    <h2 class="visually-hidden">Results for ${esc(query)}</h2>
    <ul class="words">${strong.map((r) => wordRow(r.entry, whyText(r, query))).join('')}</ul>
    ${weak.length ? `<details class="more"><summary>${weak.length} similar spelling${weak.length > 1 ? 's' : ''}</summary>
      <ul class="words">${weak.map((r) => wordRow(r.entry)).join('')}</ul></details>` : ''}`;
}

function renderNoResults(query) {
  const close = suggest(index, query);
  const deva = isDevanagari(query);
  view.innerHTML = `
    <div class="empty">
      <h2>No word matches “${esc(query.trim())}”</h2>
      <p>${deva
        ? 'Check the spelling, or try typing the word in Roman letters.'
        : 'Spell it the way it sounds, type it in Devanagari, or search an English meaning.'}
        This dictionary has ${entries.length} words so far.</p>
    </div>
    ${close.length ? `<h2 class="section-title">Closest words</h2>
      <ul class="words">${close.map((e) => wordRow(e)).join('')}</ul>` : ''}`;
}

function renderEntry(id) {
  const e = byId.get(id);
  if (!e) {
    view.innerHTML = `<div class="empty"><h2>This word isn't in the dictionary</h2>
      <p>The link may be from an older version.</p><a class="chip" href="#/">See all words</a></div>`;
    return;
  }
  const otherSpellings = e.romanised.filter((r) => r !== e.transliteration);
  const example = esc(e.example).replace(esc(e.headword), `<mark>${esc(e.headword)}</mark>`);
  const isSaved = saved.has(e.id);
  const fromSearch = input.value.trim();

  view.innerHTML = `
    <article class="entry">
      <a class="back" href="${fromSearch ? `#/search/${encodeURIComponent(fromSearch)}` : '#/'}">
        ${fromSearch ? 'Back to results' : 'All words'}</a>
      <h1 class="headword" lang="hi">${esc(e.headword)}</h1>
      <p class="iast" lang="hi-Latn">${esc(e.transliteration)}</p>
      <p class="pos">${esc(POS_LONG[e.pos] ?? e.pos)}</p>
      <p class="also">Also typed as ${otherSpellings.map((s) => `<b>${esc(s)}</b>`).join(', ')}</p>

      <div class="entry-actions">
        <button type="button" class="btn" id="save" aria-pressed="${isSaved}">${isSaved ? 'Saved' : 'Save word'}</button>
        <button type="button" class="btn" id="share">Share</button>
      </div>

      <section class="block">
        <h2 class="section-title">Meaning</h2>
        <ol class="meanings">${e.meanings.map((m) => `<li>${esc(m)}</li>`).join('')}</ol>
      </section>

      <section class="block">
        <h2 class="section-title">Example</h2>
        <p class="example" lang="hi">${example}</p>
      </section>
    </article>`;

  document.title = `${e.headword} (${e.transliteration}) · Shabdkosh`;
  const saveBtn = $('#save');
  saveBtn.addEventListener('click', () => {
    const on = saved.toggle(e.id);
    saveBtn.setAttribute('aria-pressed', String(on));
    saveBtn.textContent = on ? 'Saved' : 'Save word';
  });
  $('#share').addEventListener('click', () => shareEntry(e));
}

async function shareEntry(e) {
  const url = location.href;
  const text = `${e.headword} (${e.transliteration}): ${e.meanings.join(', ')}`;
  if (navigator.share) {
    try { await navigator.share({ title: e.headword, text, url }); return; } catch { /* cancelled */ }
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    toast('Link copied');
  } catch {
    toast('Copy the address bar to share');
  }
}

function renderSaved() {
  const list = saved.ids().map((id) => byId.get(id)).filter(Boolean);
  view.innerHTML = list.length
    ? `<h2 class="section-title">Saved words</h2><ul class="words">${list.map((e) => wordRow(e)).join('')}</ul>`
    : `<div class="empty"><h2>No saved words yet</h2>
        <p>Open a word and press Save word to keep it here. Saved words stay on this device.</p></div>`;
}

let toastTimer;
function toast(msg) {
  document.querySelector('.toast')?.remove();
  const t = document.createElement('div');
  t.className = 'toast';
  t.setAttribute('role', 'status');
  t.textContent = msg;
  document.body.append(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 2200);
}

// ---------- routing ----------
// #/              home (or live results while typing)
// #/search/<q>    results for q
// #/w/<id>        one entry
// #/saved         saved words
function route() {
  const hash = location.hash.slice(1) || '/';
  const [, kind, arg = ''] = hash.split('/');
  document.title = 'Shabdkosh';
  clearBtn.hidden = !input.value;

  if (kind === 'w') {
    renderEntry(Number(arg));
    window.scrollTo(0, 0);
  } else if (kind === 'saved') {
    renderSaved();
  } else if (kind === 'search') {
    const q = decodeURIComponent(arg);
    if (input.value !== q) input.value = q;
    clearBtn.hidden = !q;
    renderResults(q);
  } else {
    input.value = '';
    clearBtn.hidden = true;
    renderHome();
  }
}

function onType() {
  const q = input.value;
  clearBtn.hidden = !q;
  const target = q.trim() ? `#/search/${encodeURIComponent(q.trim())}` : '#/';
  // replaceState so each keystroke doesn't become a Back-button step.
  history.replaceState(null, '', target);
  route();
}

// Remember a search once the person acts on it (opens a result or presses Enter),
// not on every keystroke.
view.addEventListener('click', (ev) => {
  const row = ev.target.closest('a.word-row');
  if (row && input.value.trim() && location.hash.startsWith('#/search/')) recent.add(input.value);
});

$('#search-form').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const q = input.value.trim();
  if (!q) return;
  recent.add(q);
  const results = search(index, q, { limit: 2 });
  // One clear winner: go straight to it.
  if (results.length === 1 || (results[0] && results[0].score >= 90 && (results[1]?.score ?? 0) < 90)) {
    location.hash = `#/w/${results[0].entry.id}`;
  }
  input.blur();
});

input.addEventListener('input', onType);
clearBtn.addEventListener('click', () => { input.value = ''; onType(); input.focus(); });
window.addEventListener('hashchange', route);

async function start() {
  try {
    const res = await fetch('data/entries.json');
    entries = await res.json();
  } catch {
    view.innerHTML = `<div class="empty"><h2>The word list didn't load</h2>
      <p>Connect to the internet once so it can be saved for offline use, then reload.</p></div>`;
    return;
  }
  index = buildIndex(entries);
  byId = new Map(entries.map((e) => [e.id, e]));
  updateSavedCount();
  route();
  if (!location.hash.startsWith('#/w/')) input.focus({ preventScroll: true });

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

start();
