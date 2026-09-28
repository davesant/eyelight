// Eyelight - type-anywhere search for any website.
// https://github.com/davesant/eyelight  (MIT)
//
// Requirement IDs (F1.1 etc.) refer to SPEC.md.

import { SHADOW_CSS, HIGHLIGHT_CSS, MARKER_HIGHLIGHT_CSS } from './styles.js';
import { foldQuery, words, foldChar } from './fold.js';
import { buildPageText, findAll, toRange, MAX_MATCHES } from './pagetext.js';
import { loadPages } from './data.js';
import { suggest } from './suggest.js';

export const VERSION = '0.1.0';

export const DEFAULTS = {
  prompt: '',
  include: 'main, [role=main]',
  exclude: '[data-eyelight-ignore]',
  noCapture: '[data-eyelight-nocapture]',
  index: '/eyelight-index.json',
  sitemap: '/sitemap.xml',
  pages: null,
  theme: 'auto',
  position: 'left',
  startMode: 'page',
  caret: 'block',
  highlight: 'marker',
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
    helpSuggest: 'Enter: open page · Esc: back to page matches',
    helpPage: 'Arrows or Tab: next match · Enter: site pages · Esc: close',
    helpTouch: 'Use ↑ ↓ to move between matches',
    total: '{n} on page',
    position: '{i} of {n}',
    none: 'No matches',
    noPages: 'No matching pages',
    announce: '{m} on this page. {s} pages suggested.',
    announcePage: '{m} on this page.',
    closed: 'Search closed',
  },
};

// Default help text when startMode is 'suggest' (suggestions while typing, Esc toggles).
const SUGGEST_FIRST_LABELS = {
  helpSuggest: 'Esc: page matches · Esc Esc: close',
  helpPage: 'Arrows or Tab: next match · Esc: site pages · Esc Esc: close',
};
// Marker shape: the host's SVG filter (turbulence warps each stroke's ends).
const MARKER_FILTER = '<filter id="el-mf" x="-20%" y="-50%" width="140%" height="200%"><feTurbulence type="fractalNoise" ' +
  'baseFrequency="0 0.15" numOctaves="1" result="warp"/><feDisplacementMap xChannelSelector="R" yChannelSelector="G" ' +
  'scale="30" in="SourceGraphic" in2="warp"/></filter>';
const SVGNS = 'http://www.w3.org/2000/svg';

const STORE = 'eyelight.capture';
const WIDGET_ROLES = new Set(('textbox searchbox combobox listbox menu menubar grid tree treegrid tablist slider ' +
  'spinbutton radiogroup application').split(' '));
const NEVER_START = new Set([' ', '/', "'"]); // F1.8: keep page scrolling, button activation and Firefox Quick Find
const svg = (d) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const ICON_SEARCH = svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>');

let warned = false;
function warn(e) {
  if (warned) return;
  warned = true;
  try { console.warn('[eyelight]', e); } catch { /* ignore */ }
}
// NF4: every handler is wrapped so a bug in eyelight never breaks the page.
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
  const pageFirst = (userCfg.startMode || DEFAULTS.startMode) !== 'suggest';
  const baseLabels = pageFirst ? DEFAULTS.labels : { ...DEFAULTS.labels, ...SUGGEST_FIRST_LABELS };
  const cfg = { ...DEFAULTS, ...userCfg, labels: { ...baseLabels, ...(userCfg.labels || {}) } };
  const marker = cfg.highlight !== 'solid';
  const block = cfg.caret !== 'bar';
  const L = cfg.labels;
  const ignore = parseKeys(cfg.ignoreKeys);
  for (const k of ['include', 'exclude', 'noCapture']) { // a bad selector must not break search (NF4)
    try { if (cfg[k]) document.createDocumentFragment().querySelector(cfg[k]); } catch (e) { warn(`invalid ${k} selector: ${cfg[k]}`); cfg[k] = k === 'include' ? DEFAULTS.include : null; }
  }
  const minChars = Math.max(1, Number(cfg.minChars) || 2);
  const maxSugg = Math.max(0, Number(cfg.maxSuggestions) || 0);
  const coarse = mq('(hover: none) and (pointer: coarse)');

  // ---------- DOM ----------
  const host = document.createElement('eyelight-ui');
  host.setAttribute('data-theme', cfg.theme);
  host.setAttribute('data-position', cfg.position);
  host.setAttribute('data-caret', block ? 'block' : 'bar');
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>${SHADOW_CSS}</style><div class="wrap" part="root">
<button class="hint" part="hint" type="button"></button>
<div class="panel" part="panel" role="search" hidden>
<div class="empty" part="empty" hidden></div><ul class="list" part="suggestions" role="listbox" id="el-list" hidden></ul>
<div class="row" part="bar"><span class="prompt" part="prompt" aria-hidden="true"></span>
<span class="field"><input part="input" id="el-input" type="text" role="combobox" aria-autocomplete="list" aria-expanded="false"
 aria-controls="el-list" aria-describedby="el-help" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search"><span class="bcaret" part="cursor" aria-hidden="true" hidden></span><span class="meas" aria-hidden="true"></span></span>
<div class="acts"><span class="count" part="count" id="el-count"></span>
<button class="btn prev" part="button" type="button">${svg('<path d="m6 15 6-6 6 6"/>')}</button>
<button class="btn next" part="button" type="button">${svg('<path d="m6 9 6 6 6-6"/>')}</button>
<button class="btn mode" part="button" type="button" aria-pressed="false"></button>
<button class="btn close" part="button" type="button">${svg('<path d="M6 6l12 12M18 6 6 18"/>')}</button></div></div>
<div class="foot" part="footer"><span id="el-help"></span><button class="btn cap" part="button" type="button" aria-pressed="true"></button></div>
</div><div class="sr" role="status" aria-live="polite"></div></div>
<svg class="marks" part="marks" aria-hidden="true" hidden><defs>${MARKER_FILTER}</defs><g></g></svg>`;
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
  const help = $('#el-help');
  const live = $('.sr');
  const bcaret = $('.bcaret');
  const meas = $('.meas');
  const marksSvg = $('.marks');
  const marksG = $('.marks g');
  const empty = $('.empty');
  empty.textContent = L.noPages;

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
  let marks = []; // marker strokes in document coordinates
  let band = null; // [top, bottom] document band currently drawn
  let markRaf = 0;
  let measureTimer = 0;

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
    renderEmpty();
    const show = isOpen && mode === 'suggest' && listShown && sugg.length > 0;
    list.hidden = !show;
    input.setAttribute('aria-expanded', String(show));
    if (show && active >= 0) input.setAttribute('aria-activedescendant', `el-o${active}`);
    else input.removeAttribute('aria-activedescendant');
  }

  function buildList() {
    list.textContent = '';
    const qws = words(input.value);
    sugg.forEach((e, i) => {
      const li = document.createElement('li');
      li.className = 'opt';
      li.id = `el-o${i}`;
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
    const o = root.getElementById(`el-o${i}`);
    if (o) { // scroll within the list only, never the host page
      if (o.offsetTop < list.scrollTop) list.scrollTop = o.offsetTop;
      else if (o.offsetTop + o.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = o.offsetTop + o.offsetHeight - list.clientHeight;
    }
    renderList();
  }

  // ---------- highlights (F2) ----------
  // The Highlight registry always holds the matches. In marker mode it paints
  // nothing (except in forced colours); the overlay below draws the strokes.
  function paint(remeasure) {
    if (marker) { if (remeasure) measureMarks(); else drawMarks(true); }
    if (!hasHighlights()) return;
    if (!ranges.length) { clearHighlights(); return; }
    const all = new Highlight();
    for (const r of ranges) all.add(r);
    CSS.highlights.set('eyelight', all);
    const cur = ranges[current];
    if (cur) {
      const h = new Highlight(cur);
      h.priority = 1;
      CSS.highlights.set('eyelight-current', h);
    } else CSS.highlights.delete('eyelight-current');
  }

  function clearHighlights() {
    if (!hasHighlights()) return;
    CSS.highlights.delete('eyelight');
    CSS.highlights.delete('eyelight-current');
  }

  // ---------- marker pen overlay (F2.6) ----------
  // Strokes are drawn in an SVG layer inside the component, positioned in page
  // coordinates so they scroll with the page natively, and blended onto it, so
  // the page's DOM is never touched. Each stroke is 1em high, 0.1em below the
  // top of the text, and 0.25em wider than it at each end.
  let cvs = null;
  function isDark(color) { // any CSS colour, via a 1x1 canvas; null if (mostly) transparent
    cvs = cvs || document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    cvs.clearRect(0, 0, 1, 1);
    cvs.fillStyle = color;
    cvs.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = cvs.getImageData(0, 0, 1, 1).data;
    return a < 128 ? null : (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.45;
  }
  function pageIsDark(el) { // first opaque background behind the matches
    for (; el; el = el.parentElement) {
      const d = isDark(getComputedStyle(el).backgroundColor);
      if (d != null) return d;
    }
    return false;
  }

  function lineRects(r) { // merge the fragments of a range that sit on the same line
    const out = [];
    for (const b of [...r.getClientRects()].filter((q) => q.width > 0 && q.height > 0).sort((p, q) => p.top - q.top || p.left - q.left)) {
      const o = out.find((q) => Math.min(q.bottom, b.bottom) - Math.max(q.top, b.top) > Math.min(q.bottom - q.top, b.height) / 2 && b.left <= q.right + 2 && b.right >= q.left - 2);
      if (o) { o.left = Math.min(o.left, b.left); o.right = Math.max(o.right, b.right); o.top = Math.min(o.top, b.top); o.bottom = Math.max(o.bottom, b.bottom); }
      else out.push({ left: b.left, right: b.right, top: b.top, bottom: b.bottom });
    }
    return out;
  }

  let scrollers = new Set(); // overflow containers that hold matches
  function clipOf(el, cache) { // visible padding box of the overflow containers around el (client coords)
    if (!el || el === document.body || el === document.documentElement) return null;
    if (cache.has(el)) return cache.get(el);
    let c = clipOf(el.parentElement, cache);
    const cs = getComputedStyle(el);
    if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
      scrollers.add(el);
      const b = el.getBoundingClientRect();
      const x = b.left + el.clientLeft;
      const y = b.top + el.clientTop;
      c = c ? { left: Math.max(c.left, x), top: Math.max(c.top, y), right: Math.min(c.right, x + el.clientWidth), bottom: Math.min(c.bottom, y + el.clientHeight) }
        : { left: x, top: y, right: x + el.clientWidth, bottom: y + el.clientHeight };
    }
    cache.set(el, c);
    return c;
  }

  function measureMarks() {
    marks = [];
    band = null;
    scrollers = new Set();
    marksSvg.toggleAttribute('hidden', !(isOpen && ranges.length)); // SVG elements have no .hidden property
    if (!isOpen || !ranges.length) { marksG.replaceChildren(); return; }
    host.setAttribute('data-page', pageIsDark(ranges[0].startContainer.parentElement) ? 'dark' : 'light');
    const o = marksSvg.getBoundingClientRect(); // the layer's origin, wherever the page puts it
    const ems = new Map();
    const clips = new Map();
    ranges.forEach((r, i) => {
      const el = r.startContainer.parentElement;
      if (!ems.has(el)) ems.set(el, parseFloat(getComputedStyle(el).fontSize) || 16);
      const em = ems.get(el);
      const c = clipOf(el, clips);
      for (const b of lineRects(r)) {
        let x1 = b.left - em / 4;
        let x2 = b.right + em / 4;
        let y1 = b.top + em / 10;
        let y2 = y1 + em;
        if (c) { x1 = Math.max(x1, c.left); x2 = Math.min(x2, c.right); y1 = Math.max(y1, c.top); y2 = Math.min(y2, c.bottom); }
        if (x2 - x1 > 1 && y2 - y1 > 1) marks.push({ x: x1 - o.left, y: y1 - o.top, w: x2 - x1, h: y2 - y1, i });
      }
    });
    drawMarks(true);
  }

  function drawMarks(force) { // only strokes within a viewport of the screen are drawn
    if (!marks.length) return;
    const vh = window.innerHeight;
    const top = -marksSvg.getBoundingClientRect().top;
    if (!force && band && top >= band[0] && top + vh <= band[1]) return;
    band = [top - vh, top + 2 * vh];
    const frag = document.createDocumentFragment();
    const cur = [];
    for (const m of marks) {
      if (m.y + m.h < band[0] || m.y > band[1]) continue;
      const seed = Math.round(m.y * 7 + m.x * 3) % 200; // stable, different warp per stroke
      const el = document.createElementNS(SVGNS, 'rect');
      el.setAttribute('y', seed);
      el.setAttribute('width', m.w);
      el.setAttribute('height', m.h);
      el.setAttribute('transform', `translate(${m.x} ${m.y - seed})`);
      el.setAttribute('filter', 'url(#el-mf)');
      if (m.i === current) { el.setAttribute('class', 'cur'); cur.push(el); } else frag.append(el);
    }
    frag.append(...cur); // current stroke on top
    marksG.replaceChildren(frag);
  }

  function remeasure(now) { // re-measure on the next frame, or once things settle
    clearTimeout(measureTimer);
    if (now) { if (!markRaf) markRaf = requestAnimationFrame(guard(() => { markRaf = 0; if (isOpen) measureMarks(); })); }
    else measureTimer = setTimeout(guard(() => { if (isOpen) measureMarks(); }), 200);
  }

  const onPageScroll = guard((e) => {
    if (!isOpen || !marks.length) return;
    if (e.target === document || e.target === document.documentElement) {
      if (!markRaf) markRaf = requestAnimationFrame(guard(() => { markRaf = 0; drawMarks(); }));
      remeasure(); // once scrolling settles (sticky and fixed content)
    } else if (scrollers.has(e.target)) remeasure(true);
  });
  const onLayout = guard(() => { if (isOpen && marks.length) remeasure(); }); // images, fonts, <details>

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
    paint(true);
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
    if (m === 'suggest' && pageFirst && isOpen) runSuggest();
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
    if (!silent && (m === 'page' || entries)) announce(m === 'page' ? `${L.mode}. ${countText()}` : `${L.suggestions}. ${sugg.length}`, 150); // else announced once loaded
  }

  // ---------- block cursor (F1.10) ----------
  let caretRaf = 0;
  function placeCaret() {
    caretRaf = 0;
    const pos = input.selectionStart;
    const show = block && isOpen && root.activeElement === input && pos != null && pos === input.selectionEnd;
    bcaret.hidden = !show;
    if (!show) return;
    const v = input.value;
    const cs = getComputedStyle(input); // follow any ::part(input) font styling
    for (const el of [meas, bcaret]) for (const k of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing']) el.style[k] = cs[k];
    meas.textContent = v.slice(0, pos);
    const x = meas.getBoundingClientRect().width;
    bcaret.textContent = v[pos] || '';
    bcaret.style.left = `${Math.max(0, Math.min((parseFloat(cs.paddingLeft) || 0) + x - input.scrollLeft, input.clientWidth - bcaret.offsetWidth))}px`;
  }
  const moveCaret = guard(() => { if (block && !caretRaf && (!isOpen || root.activeElement === input || !bcaret.hidden)) caretRaf = requestAnimationFrame(guard(placeCaret)); });

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

  function renderEmpty() { // page-first: say so when Enter found no pages
    empty.hidden = !(pageFirst && isOpen && mode === 'suggest' && listShown && !sugg.length && entries && input.value.trim());
  }

  function announceState() {
    if (!input.value.trim()) return;
    const m = queryLongEnough() ? (ranges.length ? fmt(L.total, { n: nLabel() }) : L.none) : '';
    if (pageFirst && mode === 'page') { if (m) announce(fmt(L.announcePage, { m })); return; }
    announce(fmt(L.announce, { m, s: sugg.length }).replace(/^\. /, ''));
  }

  const onInput = guard(() => {
    runPage('input');
    if (!pageFirst || mode === 'suggest') runSuggest();
    announceState();
    moveCaret();
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
      setMode(pageFirst ? 'page' : 'suggest', true);
      if (!pageFirst) ensurePages(); // page-first: the index loads on the first Enter
      startObserving();
      trackViewport(true);
      if (marker) {
        document.addEventListener('scroll', onPageScroll, { capture: true, passive: true });
        for (const t of ['load', 'toggle', 'transitionend']) document.addEventListener(t, onLayout, true);
      }
      if (block) document.addEventListener('selectionchange', moveCaret);
    }
    input.focus({ preventScroll: true });
    moveCaret();
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
    measureMarks();
    document.removeEventListener('scroll', onPageScroll, { capture: true });
    for (const t of ['load', 'toggle', 'transitionend']) document.removeEventListener(t, onLayout, true);
    document.removeEventListener('selectionchange', moveCaret);
    clearTimeout(measureTimer);
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
    if (!input.value.trim() || now - lastEsc < 500 || (pageFirst && mode === 'page')) { close(); return; }
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
      muts = muts.filter((m) => m.target !== host && !host.contains(m.target));
      if (!muts.length) return;
      if (muts.every((m) => m.type === 'attributes')) { onLayout(); return; } // layout may move, text didn't change
      dirty = true;
      clearTimeout(moTimer);
      moTimer = setTimeout(guard(() => { if (isOpen && queryLongEnough()) runPage('mutation'); }), 150);
    }));
    mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: !!marker });
  }
  function stopObserving() { if (mo) { mo.disconnect(); mo = null; } clearTimeout(moTimer); }

  const onViewport = guard(() => {
    const vv = window.visualViewport;
    const off = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    host.style.setProperty('--eyelight-kb', `${Math.round(off)}px`);
  });
  function trackViewport(on) {
    const vv = window.visualViewport;
    if (!vv) return;
    vv[on ? 'addEventListener' : 'removeEventListener']('resize', onViewport);
    vv[on ? 'addEventListener' : 'removeEventListener']('scroll', onViewport);
    if (on) onViewport(); else host.style.removeProperty('--eyelight-kb');
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
        if (mod || e.shiftKey || mode !== 'page' || !hasMatches) return; // Shift+arrows still select text
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
        else if (pageFirst) { // Enter asks for site pages; Enter again opens the first one
          e.preventDefault();
          if (mode === 'suggest') { if (sugg[0] && !e.shiftKey) go(sugg[0], false); }
          else if (e.shiftKey || !maxSugg) step(e.shiftKey ? -1 : 1);
          else if (input.value.trim()) setMode('suggest');
        } else if (hasMatches) {
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
  input.addEventListener('focus', guard(() => { listShown = true; renderList(); moveCaret(); }));
  for (const t of ['blur', 'keyup', 'pointerup', 'select', 'scroll']) input.addEventListener(t, moveCaret);
  input.addEventListener('keydown', moveCaret);
  const onResize = guard(() => { moveCaret(); if (isOpen && marker) remeasure(true); });
  window.addEventListener('resize', onResize);
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

  let style = document.querySelector('style[data-eyelight]');
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('data-eyelight', '');
    style.textContent = marker ? MARKER_HIGHLIGHT_CSS : HIGHLIGHT_CSS;
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
      document.removeEventListener('scroll', onPageScroll, { capture: true });
      window.removeEventListener('resize', onResize);
      coarse.removeEventListener && coarse.removeEventListener('change', onMq);
      host.remove();
      style.remove();
      if (window.Eyelight === api) window.Eyelight = { init, version: VERSION };
    }),
  };
  return api;
}

/** Initialise once per page. Safe to call more than once (NF4). */
export function init(cfg) {
  try {
    if (typeof window === 'undefined' || !document.body || !document.body.attachShadow) return null;
    const old = window.Eyelight;
    if (old && old.element) {
      if (old.element.isConnected) return old;
      old.destroy(); // stale instance from a replaced <body>
    }
    const api = create(cfg || {});
    window.Eyelight = api;
    return api;
  } catch (e) {
    warn(e);
    return null;
  }
}
