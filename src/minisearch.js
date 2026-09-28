// Minisearch - type-anywhere search for any website.
// https://github.com/davesant/minisearch  (MIT)
//
// Requirement IDs (F1.1 etc.) refer to SPEC.md.

import { SHADOW_CSS, HIGHLIGHT_CSS } from './styles.js';
import { foldQuery, words, foldChar } from './fold.js';
import { buildPageText, findAll, toRange, MAX_MATCHES } from './pagetext.js';
import { loadPages } from './data.js';
import { suggest } from './suggest.js';

export const VERSION = '0.1.0';

export const DEFAULTS = {
  prompt: '',
  include: 'main, [role=main]',
  exclude: '[data-minisearch-ignore]',
  noCapture: '[data-minisearch-nocapture]',
  index: '/minisearch-index.json',
  sitemap: '/sitemap.xml',
  pages: null,
  theme: 'auto',
  position: 'center',
  minChars: 2,
  maxSuggestions: 8,
  ignoreKeys: '',
  capture: true,
  hint: true,
  mobileButton: 'auto',
  navigate: null,
  labels: {
    hint: 'Search this site. Start typing anywhere to search.',
    hintOff: 'Search this site',
    input: 'Search this site and page',
    suggestions: 'Pages on this site',
    prev: 'Previous match',
    next: 'Next match',
    mode: 'On this page',
    close: 'Close search',
    captureOn: 'Type-to-search: on',
    captureOff: 'Type-to-search: off',
    helpSuggest: 'Esc: page matches · Esc Esc: close',
    helpPage: 'Arrows or Tab: next match · Esc: site pages · Esc Esc: close',
    helpTouch: 'Use ↑ ↓ to move between matches',
    total: '{n} on page',
    position: '{i} of {n}',
    none: 'No matches',
    announce: '{m} on this page. {s} pages suggested.',
    closed: 'Search closed',
  },
};

const STORE = 'minisearch.capture';
const WIDGET_ROLES = new Set(('textbox searchbox combobox listbox menu menubar grid tree treegrid tablist slider ' +
  'spinbutton radiogroup application').split(' '));
const NEVER_START = new Set([' ', '/', "'"]); // F1.8: keep page scrolling, button activation and Firefox Quick Find
const svg = (d) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const ICON_SEARCH = svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>');

let warned = false;
function warn(e) {
  if (warned) return;
  warned = true;
  try { console.warn('[minisearch]', e); } catch { /* ignore */ }
}
// NF4: every handler is wrapped so a bug in minisearch never breaks the page.
const guard = (fn) => function guarded(...a) {
  try { return fn.apply(this, a); } catch (e) { warn(e); return undefined; }
};
function storeGet() { try { return localStorage.getItem(STORE); } catch { return null; } }
function storeSet(v) { try { if (v == null) localStorage.removeItem(STORE); else localStorage.setItem(STORE, v); } catch { /* ignore */ } }
const fmt = (s, o) => String(s).replace(/\{(\w+)\}/g, (_, k) => o[k]);
const mq = (q) => (window.matchMedia ? matchMedia(q) : { matches: false, addEventListener() {} });
const hasHighlights = () => typeof CSS !== 'undefined' && CSS.highlights && typeof Highlight === 'function';

function parseKeys(v) {
  if (!v) return new Set();
  const arr = Array.isArray(v) ? v : String(v).includes(',') ? String(v).split(',') : [...String(v)];
  return new Set(arr.map((k) => k.trim()).filter(Boolean));
}

export function create(userCfg = {}) {
  const cfg = { ...DEFAULTS, ...userCfg, labels: { ...DEFAULTS.labels, ...(userCfg.labels || {}) } };
  const L = cfg.labels;
  const ignore = parseKeys(cfg.ignoreKeys);
  for (const k of ['include', 'exclude', 'noCapture']) { // a bad selector must not break search (NF4)
    try { if (cfg[k]) document.createDocumentFragment().querySelector(cfg[k]); } catch (e) { warn(`invalid ${k} selector: ${cfg[k]}`); cfg[k] = k === 'include' ? DEFAULTS.include : null; }
  }
  const minChars = Math.max(1, Number(cfg.minChars) || 2);
  const maxSugg = Math.max(0, Number(cfg.maxSuggestions) || 0);
  const coarse = mq('(hover: none) and (pointer: coarse)');

  // ---------- DOM ----------
  const host = document.createElement('minisearch-ui');
  host.setAttribute('data-theme', cfg.theme);
  host.setAttribute('data-position', cfg.position);
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>${SHADOW_CSS}</style><div class="wrap" part="root">
<button class="hint" part="hint" type="button"></button>
<div class="panel" part="panel" role="search" hidden>
<ul class="list" part="suggestions" role="listbox" id="ms-list" hidden></ul>
<div class="row" part="bar"><span class="prompt" part="prompt" aria-hidden="true"></span>
<input part="input" id="ms-input" type="text" role="combobox" aria-autocomplete="list" aria-expanded="false"
 aria-controls="ms-list" aria-describedby="ms-help" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search">
<div class="acts"><span class="count" part="count" id="ms-count"></span>
<button class="btn prev" part="button" type="button">${svg('<path d="m6 15 6-6 6 6"/>')}</button>
<button class="btn next" part="button" type="button">${svg('<path d="m6 9 6 6 6-6"/>')}</button>
<button class="btn mode" part="button" type="button" aria-pressed="false"></button>
<button class="btn close" part="button" type="button">${svg('<path d="M6 6l12 12M18 6 6 18"/>')}</button></div></div>
<div class="foot" part="footer"><span id="ms-help"></span><button class="btn cap" part="button" type="button" aria-pressed="true"></button></div>
</div><div class="sr" role="status" aria-live="polite"></div></div>`;
  const $ = (s) => root.querySelector(s);
  const wrap = $('.wrap');
  const hint = $('.hint');
  const panel = $('.panel');
  const list = $('.list');
  const input = $('input');
  const count = $('.count');
  const prevBtn = $('.prev');
  const nextBtn = $('.next');
  const modeBtn = $('.mode');
  const closeBtn = $('.close');
  const capBtn = $('.cap');
  const help = $('#ms-help');
  const live = $('.sr');

  $('.row .prompt').textContent = cfg.prompt;
  $('.row .prompt').hidden = !cfg.prompt;
  panel.setAttribute('aria-label', L.input);
  input.setAttribute('aria-label', L.input);
  list.setAttribute('aria-label', L.suggestions);
  prevBtn.setAttribute('aria-label', L.prev);
  nextBtn.setAttribute('aria-label', L.next);
  closeBtn.setAttribute('aria-label', L.close);
  modeBtn.textContent = L.mode;

  // ---------- state ----------
  let isOpen = false;
  let mode = 'suggest';
  let capture = cfg.capture !== false && storeGet() !== 'off';
  let touch = false;
  let pt = null; // page text index
  let dirty = true;
  let ranges = [];
  let current = -1;
  let entries = null;
  let pagesPromise = null;
  let sugg = [];
  let active = -1;
  let listShown = false;
  let prevFocus = null;
  let lastEsc = -1e9;
  let mo = null;
  let moTimer = 0;
  let liveTimer = 0;
  let destroyed = false;

  // ---------- helpers ----------
  function deepActive() {
    let a = document.activeElement;
    while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement;
    return a;
  }

  function roots() {
    let els = [];
    try { els = [...document.querySelectorAll(cfg.include)]; } catch { /* bad selector */ }
    els = els.filter((el) => !els.some((o) => o !== el && o.contains(el)));
    return els.length ? els : [document.body];
  }

  function pageText() {
    if (!pt || dirty) {
      pt = buildPageText(roots(), cfg.exclude, host);
      dirty = false;
    }
    return pt;
  }

  function announce(msg, delay = 600) {
    clearTimeout(liveTimer);
    liveTimer = setTimeout(guard(() => {
      live.textContent = live.textContent === msg ? msg + String.fromCharCode(160) : msg; // re-announce identical text
    }), delay);
  }

  function nLabel() { return ranges.length >= MAX_MATCHES ? `${MAX_MATCHES}+` : String(ranges.length); }
  function queryLongEnough() { return [...foldQuery(input.value)].length >= minChars; }

  function countText() {
    if (!queryLongEnough()) return '';
    if (!ranges.length) return L.none;
    if (current >= 0) return fmt(L.position, { i: current + 1, n: nLabel() });
    return fmt(L.total, { n: nLabel() });
  }

  // WCAG 2.5.3: the accessible name must contain the visible text.
  function labelWith(visible, label) {
    return !visible || label.toLowerCase().includes(visible.toLowerCase()) ? label : `${visible} - ${label}`;
  }

  function renderHint() {
    touch = cfg.mobileButton === 'always' || (cfg.mobileButton !== 'never' && coarse.matches);
    wrap.classList.toggle('touch', touch);
    const showHint = cfg.hint !== false && !(cfg.mobileButton === 'never' && coarse.matches);
    hint.hidden = isOpen || !showHint;
    hint.textContent = '';
    if (touch || !capture) {
      hint.innerHTML = ICON_SEARCH;
      if (!touch) {
        const p = document.createElement('span');
        p.className = 'prompt';
        p.setAttribute('part', 'prompt');
        p.textContent = cfg.prompt || 'Search';
        hint.append(p);
      }
      hint.setAttribute('aria-label', labelWith(touch ? '' : cfg.prompt || 'Search', L.hintOff));
    } else {
      const p = document.createElement('span');
      p.className = 'prompt';
      p.setAttribute('part', 'prompt');
      p.textContent = cfg.prompt;
      p.hidden = !cfg.prompt;
      const c = document.createElement('span');
      c.className = 'caret';
      c.setAttribute('part', 'caret');
      c.setAttribute('aria-hidden', 'true');
      hint.append(p, c); // new caret element = blink restarts for another 5 s (F1.3)
      hint.setAttribute('aria-label', labelWith(cfg.prompt, L.hint));
    }
    capBtn.textContent = capture ? L.captureOn : L.captureOff;
    capBtn.setAttribute('aria-pressed', String(capture));
  }

  function renderHelp() {
    help.textContent = touch ? L.helpTouch : mode === 'page' ? L.helpPage : L.helpSuggest;
  }

  function renderCount() {
    count.textContent = countText();
    const none = !ranges.length;
    prevBtn.disabled = none;
    nextBtn.disabled = none;
  }

  function markTitle(el, text, qws) {
    for (const tok of String(text).split(/([\p{L}\p{N}]+)/u)) {
      if (!tok) continue;
      const f = [...tok].map(foldChar).join('');
      const qw = qws.find((w) => f.startsWith(w));
      if (qw) {
        const chars = [...tok];
        const m = document.createElement('mark');
        m.textContent = chars.slice(0, qw.length).join('');
        el.append(m, chars.slice(qw.length).join(''));
      } else el.append(tok);
    }
  }

  function renderList() {
    const show = isOpen && mode === 'suggest' && listShown && sugg.length > 0;
    list.hidden = !show;
    input.setAttribute('aria-expanded', String(show));
    if (show && active >= 0) input.setAttribute('aria-activedescendant', `ms-o${active}`);
    else input.removeAttribute('aria-activedescendant');
  }

  function buildList() {
    list.textContent = '';
    const qws = words(input.value);
    sugg.forEach((e, i) => {
      const li = document.createElement('li');
      li.className = 'opt';
      li.id = `ms-o${i}`;
      li.setAttribute('role', 'option');
      li.tabIndex = -1; // a tap focuses the option (inside the component) instead of blurring to nowhere
      li.setAttribute('part', 'suggestion');
      li.setAttribute('aria-selected', String(i === active));
      const t = document.createElement('span');
      t.className = 't';
      markTitle(t, e.title, qws);
      const s = document.createElement('span');
      s.className = 's';
      s.textContent = e.sub;
      li.append(t, s);
      li.addEventListener('click', guard((ev) => go(e, ev.ctrlKey || ev.metaKey || ev.shiftKey)));
      list.append(li);
    });
    renderList();
  }

  function setActive(i) {
    active = i;
    list.querySelectorAll('.opt').forEach((o, j) => o.setAttribute('aria-selected', String(j === i)));
    const o = root.getElementById(`ms-o${i}`);
    if (o) { // scroll within the list only, never the host page
      if (o.offsetTop < list.scrollTop) list.scrollTop = o.offsetTop;
      else if (o.offsetTop + o.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = o.offsetTop + o.offsetHeight - list.clientHeight;
    }
    renderList();
  }

  // ---------- highlights (F2) ----------
  function paint() {
    if (!hasHighlights()) return;
    if (!ranges.length) {
      CSS.highlights.delete('minisearch');
      CSS.highlights.delete('minisearch-current');
      return;
    }
    const all = new Highlight();
    for (const r of ranges) all.add(r);
    CSS.highlights.set('minisearch', all);
    const cur = ranges[current];
    if (cur) {
      const h = new Highlight(cur);
      h.priority = 1;
      CSS.highlights.set('minisearch-current', h);
    } else CSS.highlights.delete('minisearch-current');
  }

  function clearHighlights() {
    if (!hasHighlights()) return;
    CSS.highlights.delete('minisearch');
    CSS.highlights.delete('minisearch-current');
  }

  function firstVisible() {
    const top = window.visualViewport ? window.visualViewport.offsetTop : 0;
    for (let i = 0; i < ranges.length; i++) {
      const r = ranges[i].getBoundingClientRect();
      if ((r.width || r.height) && r.bottom > top) return i;
    }
    return 0;
  }

  function runPage(reason) {
    const prev = ranges[current];
    const prevIdx = current;
    ranges = [];
    current = -1;
    const fq = foldQuery(input.value);
    if ([...fq].length >= minChars) {
      const p = pageText();
      try {
        ranges = findAll(p, fq).map((m) => toRange(p, m));
      } catch {
        dirty = true; // DOM changed under us; rebuild once
        const p2 = pageText();
        ranges = findAll(p2, fq).map((m) => toRange(p2, m));
      }
    }
    if (ranges.length && mode === 'page') {
      if (reason === 'mutation') current = Math.max(0, Math.min(prevIdx, ranges.length - 1));
      else {
        if (prev) {
          try { current = ranges.findIndex((r) => r.compareBoundaryPoints(Range.START_TO_START, prev) >= 0); } catch { current = -1; }
        }
        if (current < 0) current = firstVisible();
        scrollToRange(ranges[current]);
      }
    }
    paint();
    renderCount();
  }

  // F4.4: scroll nested containers, then the window, so the match sits above the bar.
  function scrollToRange(r) {
    if (!r) return;
    // Read the preference fresh each time: cached MediaQueryLists can go stale (seen in WebKit).
    const behavior = mq('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
    for (let p = r.startContainer.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
      if (p.scrollHeight <= p.clientHeight + 1 && p.scrollWidth <= p.clientWidth + 1) continue;
      const cs = getComputedStyle(p);
      if (!/(auto|scroll)/.test(cs.overflowY + cs.overflowX)) continue;
      const pr = p.getBoundingClientRect();
      const rr = r.getBoundingClientRect();
      if (rr.top < pr.top || rr.bottom > pr.bottom) p.scrollTop += rr.top - pr.top - (p.clientHeight - rr.height) / 2;
      if (rr.left < pr.left || rr.right > pr.right) p.scrollLeft += rr.left - pr.left - (p.clientWidth - rr.width) / 2;
    }
    const rr = r.getBoundingClientRect();
    const vv = window.visualViewport;
    const top = (vv ? vv.offsetTop : 0) + 8;
    const panelTop = panel.hidden ? Infinity : panel.getBoundingClientRect().top;
    const bottom = Math.min(vv ? vv.offsetTop + vv.height : window.innerHeight, panelTop) - 8;
    let dy = 0;
    let dx = 0;
    if (rr.top < top || rr.bottom > bottom) dy = rr.top - (top + bottom) / 2 + rr.height / 2;
    if (rr.left < 0 || rr.right > window.innerWidth) dx = rr.left - window.innerWidth / 2;
    if (dx || dy) window.scrollBy({ top: dy, left: dx, behavior });
  }

  function step(d) {
    if (!ranges.length) return;
    if (mode !== 'page') setMode('page', true);
    const n = ranges.length;
    current = current < 0 ? firstVisible() : (current + d + n) % n;
    paint();
    renderCount();
    scrollToRange(ranges[current]);
    announce(countText(), 150);
  }

  function setMode(m, silent) {
    mode = m;
    if (m === 'suggest' && !silent) listShown = true;
    modeBtn.setAttribute('aria-pressed', String(m === 'page'));
    wrap.dataset.mode = m;
    if (m === 'page' && ranges.length && current < 0 && !silent) {
      current = firstVisible();
      paint();
      scrollToRange(ranges[current]);
    }
    renderHelp();
    renderCount();
    renderList();
    if (!silent) announce(m === 'page' ? `${L.mode}. ${countText()}` : `${L.suggestions}. ${sugg.length}`, 150);
  }

  // ---------- suggestions (F3) ----------
  function ensurePages() {
    if (!pagesPromise) {
      pagesPromise = loadPages(cfg).then((e) => { entries = e; }, () => { entries = []; });
    }
    return pagesPromise;
  }

  function runSuggest() {
    const q = input.value;
    if (!q.trim() || !maxSugg) {
      sugg = [];
      active = -1;
      buildList();
      return;
    }
    if (!entries) {
      ensurePages().then(guard(() => { if (isOpen && input.value === q) { runSuggest(); announceState(); } }));
      return;
    }
    sugg = suggest(entries, q, maxSugg);
    active = -1;
    buildList();
  }

  function announceState() {
    if (!input.value.trim()) return;
    const m = queryLongEnough() ? (ranges.length ? fmt(L.total, { n: nLabel() }) : L.none) : '';
    announce(fmt(L.announce, { m, s: sugg.length }).replace(/^\. /, ''));
  }

  const onInput = guard(() => {
    runPage('input');
    runSuggest();
    announceState();
  });

  function go(e, newTab) {
    if (newTab) { window.open(e.url, '_blank', 'noopener'); return; }
    close();
    if (typeof cfg.navigate === 'function') cfg.navigate(e.url);
    else location.assign(e.url);
  }

  // ---------- open / close (F1, F5) ----------
  function open() {
    if (!isOpen) {
      isOpen = true;
      prevFocus = deepActive();
      panel.hidden = false;
      hint.hidden = true;
      listShown = true;
      dirty = true;
      setMode('suggest', true);
      ensurePages();
      startObserving();
      trackViewport(true);
    }
    input.focus({ preventScroll: true });
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    const focusInside = !!root.activeElement;
    input.value = '';
    ranges = [];
    current = -1;
    sugg = [];
    active = -1;
    lastEsc = -1e9;
    pt = null;
    clearHighlights();
    buildList();
    renderCount();
    panel.hidden = true;
    stopObserving();
    trackViewport(false);
    renderHint();
    if (focusInside) {
      if (prevFocus && prevFocus.isConnected && prevFocus !== document.body && typeof prevFocus.focus === 'function') {
        prevFocus.focus({ preventScroll: true });
      } else if (root.activeElement) root.activeElement.blur();
    }
    prevFocus = null;
    announce(L.closed, 50);
  }

  function onEsc() {
    const now = performance.now();
    if (!input.value.trim() || now - lastEsc < 500) { close(); return; }
    lastEsc = now;
    setMode(mode === 'suggest' ? 'page' : 'suggest');
  }

  function setCapture(on) {
    capture = !!on;
    storeSet(capture ? null : 'off');
    renderHint();
    announce(capture ? L.captureOn : L.captureOff, 50);
  }

  // ---------- page observers ----------
  function startObserving() {
    if (mo || typeof MutationObserver !== 'function') return;
    mo = new MutationObserver(guard((muts) => {
      if (muts.every((m) => m.target === host || host.contains(m.target))) return;
      dirty = true;
      clearTimeout(moTimer);
      moTimer = setTimeout(guard(() => { if (isOpen && queryLongEnough()) runPage('mutation'); }), 150);
    }));
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  function stopObserving() { if (mo) { mo.disconnect(); mo = null; } clearTimeout(moTimer); }

  const onViewport = guard(() => {
    const vv = window.visualViewport;
    const off = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    host.style.setProperty('--ms-kb', `${Math.round(off)}px`);
  });
  function trackViewport(on) {
    const vv = window.visualViewport;
    if (!vv) return;
    vv[on ? 'addEventListener' : 'removeEventListener']('resize', onViewport);
    vv[on ? 'addEventListener' : 'removeEventListener']('scroll', onViewport);
    if (on) onViewport(); else host.style.removeProperty('--ms-kb');
  }

  // ---------- keyboard ----------
  function blocked(path) { // F1.5
    const t = path[0];
    // A focused custom element whose internals we can't see (closed shadow root) may be a text field.
    if (t && t.nodeType === 1 && t !== host && t.tagName.includes('-') && !t.shadowRoot) return true;
    for (const n of path) {
      if (!n || n.nodeType !== 1) continue;
      if (n.constructor && n.constructor.formAssociated) return true;
      const tag = n.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || n.isContentEditable) return true;
      const role = (n.getAttribute('role') || '').trim().split(/\s+/)[0];
      if (role && WIDGET_ROLES.has(role)) return true;
      if (n.getAttribute('aria-modal') === 'true') return true;
      try { if (cfg.noCapture && n.matches(cfg.noCapture)) return true; } catch { /* bad selector */ }
    }
    try {
      for (const d of document.querySelectorAll('dialog[open]')) if (d.matches(':modal')) return true;
    } catch { /* :modal unsupported */ }
    return false;
  }

  const onKey = guard((e) => {
    if (destroyed || e.isComposing || e.keyCode === 229) return; // NF6.3 IME
    if (!host.isConnected) return; // host page swapped <body>; bodyWatch re-attaches
    const path = e.composedPath ? e.composedPath() : [e.target];
    if (path.includes(host) && path[0] !== hint) return; // typing on the focused idle hint still opens search
    if (e.defaultPrevented) return; // F1.7 host already handled it
    const altGr = e.getModifierState && e.getModifierState('AltGraph');
    if (!altGr && (e.ctrlKey || e.metaKey || e.altKey)) return; // F1.6
    if (blocked(path)) return;
    if (e.key === 'Escape') {
      if (isOpen) { e.preventDefault(); input.focus({ preventScroll: true }); onEsc(); }
      return;
    }
    if (!capture) return; // NF6.2
    const k = e.key;
    if (!k || [...k].length !== 1 || ignore.has(k)) return; // printable only; dead keys are 'Dead'
    if (NEVER_START.has(k)) return; // F1.8: never taken from the page (still typeable in the box)
    e.preventDefault();
    open();
    input.value += k;
    input.setSelectionRange(input.value.length, input.value.length);
    onInput();
  });

  const onInputKey = guard((e) => {
    if (e.isComposing || e.keyCode === 229) return;
    const mod = e.ctrlKey || e.metaKey || e.altKey;
    const hasMatches = ranges.length > 0;
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        onEsc();
        break;
      case 'ArrowDown':
      case 'ArrowUp': {
        if (mod) return;
        const d = e.key === 'ArrowDown' ? 1 : -1;
        if (mode === 'suggest' && sugg.length) {
          listShown = true;
          const n = sugg.length;
          setActive(active < 0 ? (d > 0 ? 0 : n - 1) : (active + d + n) % n);
        } else if (hasMatches) step(d);
        else return;
        e.preventDefault();
        break;
      }
      case 'ArrowLeft':
      case 'ArrowRight':
        if (mod || mode !== 'page' || !hasMatches) return;
        e.preventDefault();
        step(e.key === 'ArrowRight' ? 1 : -1);
        break;
      case 'Tab': // NF6.4: only in page mode with matches; otherwise normal focus movement
        if (mod || mode !== 'page' || !hasMatches) return;
        e.preventDefault();
        step(e.shiftKey ? -1 : 1);
        break;
      case 'Enter':
        if (mod) return;
        if (mode === 'suggest' && active >= 0 && sugg[active]) { e.preventDefault(); go(sugg[active], false); }
        else if (hasMatches) {
          e.preventDefault();
          if (mode !== 'page') setMode('page');
          else step(e.shiftKey ? -1 : 1);
        } else if (mode === 'suggest' && sugg.length) { e.preventDefault(); go(sugg[0], false); }
        break;
      default:
    }
  });

  // ---------- focus not obscured (WCAG 2.4.11) ----------
  const checkObscured = guard(() => {
    const t = deepActive();
    if (!t || t === document.body || host.contains(t) || root.contains(t)) { hint.classList.remove('obscuring'); return; }
    const el = isOpen ? panel : hint;
    if (el.hidden) return;
    const r = t.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    const overlap = r.bottom > b.top && r.top < b.bottom && r.right > b.left && r.left < b.right;
    if (!isOpen) hint.classList.toggle('obscuring', overlap);
    else if (overlap) window.scrollBy(0, r.bottom - b.top + 16);
  });
  let scrollRaf = 0;
  const onScroll = () => {
    if (scrollRaf) return;
    scrollRaf = requestAnimationFrame(() => { scrollRaf = 0; if (!isOpen) checkObscured(); });
  };

  // ---------- wire up ----------
  input.addEventListener('input', onInput);
  input.addEventListener('keydown', onInputKey);
  input.addEventListener('focus', guard(() => { listShown = true; renderList(); }));
  wrap.addEventListener('focusout', guard((e) => {
    if (!e.relatedTarget || !root.contains(e.relatedTarget)) { listShown = false; renderList(); }
  }));
  // Keep keys typed inside the component away from host shortcut handlers (NF6.3).
  for (const t of ['keydown', 'keyup', 'keypress']) {
    wrap.addEventListener(t, (e) => {
      if (e.target === hint) return; // let it reach the window handler (type-anywhere)
      if (t === 'keydown' && e.key === 'Escape' && e.target !== input && isOpen) { e.preventDefault(); guard(onEsc)(); }
      e.stopPropagation();
    });
  }
  // Mouse clicks on bar buttons keep focus in the input so arrow keys keep working.
  panel.addEventListener('mousedown', (e) => {
    if (!touch && e.target.closest && e.target.closest('button, .opt')) e.preventDefault();
  });
  hint.addEventListener('click', guard(() => open()));
  prevBtn.addEventListener('click', guard(() => step(-1)));
  nextBtn.addEventListener('click', guard(() => step(1)));
  modeBtn.addEventListener('click', guard(() => setMode(mode === 'page' ? 'suggest' : 'page')));
  closeBtn.addEventListener('click', guard(() => close()));
  capBtn.addEventListener('click', guard(() => setCapture(!capture)));

  window.addEventListener('keydown', onKey);
  const bodyWatch = typeof MutationObserver === 'function' ? new MutationObserver(guard(() => {
    if (!host.isConnected && document.body) { document.body.append(host); dirty = true; }
    if (!style.isConnected) (document.head || document.documentElement).prepend(style);
  })) : null;
  document.addEventListener('focusin', checkObscured);
  window.addEventListener('scroll', onScroll, { passive: true });
  const onMq = guard(() => { renderHint(); renderHelp(); });
  coarse.addEventListener && coarse.addEventListener('change', onMq);

  let style = document.querySelector('style[data-minisearch]');
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('data-minisearch', '');
    style.textContent = HIGHLIGHT_CSS;
    (document.head || document.documentElement).prepend(style);
  }

  renderHint();
  renderHelp();
  renderCount();
  document.body.append(host);
  if (bodyWatch) bodyWatch.observe(document.documentElement, { childList: true });

  const api = {
    version: VERSION,
    config: cfg,
    init: () => api,
    element: host,
    open: guard((q) => {
      open();
      if (typeof q === 'string') { input.value = q; onInput(); }
    }),
    close: guard(close),
    setTheme: guard((t) => host.setAttribute('data-theme', t)),
    setCapture: guard(setCapture),
    get capture() { return capture; },
    get isOpen() { return isOpen; },
    reindex: guard(() => { pagesPromise = null; entries = null; dirty = true; return ensurePages(); }),
    destroy: guard(() => {
      close();
      destroyed = true;
      window.removeEventListener('keydown', onKey);
      if (bodyWatch) bodyWatch.disconnect();
      document.removeEventListener('focusin', checkObscured);
      window.removeEventListener('scroll', onScroll);
      coarse.removeEventListener && coarse.removeEventListener('change', onMq);
      host.remove();
      style.remove();
      if (window.Minisearch === api) window.Minisearch = { init, version: VERSION };
    }),
  };
  return api;
}

/** Initialise once per page. Safe to call more than once (NF4). */
export function init(cfg) {
  try {
    if (typeof window === 'undefined' || !document.body || !document.body.attachShadow) return null;
    const old = window.Minisearch;
    if (old && old.element) {
      if (old.element.isConnected) return old;
      old.destroy(); // stale instance from a replaced <body>
    }
    const api = create(cfg || {});
    window.Minisearch = api;
    return api;
  } catch (e) {
    warn(e);
    return null;
  }
}
