// Builds a folded, searchable copy of the page's visible text, with a map
// from each folded character back to its DOM text node and offsets, so
// matches can be turned into DOM Ranges without touching the DOM.

import { foldChar, isSpace } from './fold.js';

const SKIP = new Set('SCRIPT STYLE NOSCRIPT TEMPLATE TEXTAREA SELECT OPTION IFRAME OBJECT SVG CANVAS'.split(' '));
const SEP = '\n'; // block separator; queries never contain \n (whitespace folds to ' ')

export const MAX_MATCHES = 2000;

export function buildPageText(roots, exclude, ownHost) {
  const nodes = [];
  const nodeIdx = [];
  const starts = [];
  const ends = [];
  let text = '';
  let lastBlock = null;
  let lastSpace = true;
  const okCache = new Map();
  const blockCache = new Map();

  const ok = (el) => {
    let v = okCache.get(el);
    if (v !== undefined) return v;
    v = true;
    for (let p = el; p; p = p.parentElement) {
      if (SKIP.has(p.tagName.toUpperCase()) || p === ownHost) { v = false; break; }
    }
    if (v && exclude && el.closest(exclude)) v = false;
    if (v && el.checkVisibility) {
      v = el.checkVisibility({ visibilityProperty: true, checkVisibilityCSS: true });
    } else if (v) {
      v = !!(el.offsetParent || el.getClientRects().length);
    }
    okCache.set(el, v);
    return v;
  };

  const inlineCache = new Map();
  const isInline = (el) => {
    let v = inlineCache.get(el);
    if (v === undefined) {
      const d = getComputedStyle(el).display;
      v = d.startsWith('inline') || d === 'contents' || d.startsWith('ruby');
      inlineCache.set(el, v);
    }
    return v;
  };
  // Nearest ancestor that isn't laid out inline: matches never cross it (F2.4).
  const blockOf = (el) => {
    let b = blockCache.get(el);
    if (b) return b;
    b = el;
    while (b.parentElement && isInline(b)) b = b.parentElement;
    blockCache.set(el, b);
    return b;
  };

  for (const root of roots) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.nodeType === 1) {
        // <br> is a line break: treat it as whitespace so "a<br>b" matches "a b" (F2.2)
        if (n.tagName === 'BR' && text && !lastSpace && blockOf(n) === lastBlock) {
          text += ' '; nodeIdx.push(-1); starts.push(0); ends.push(0);
          lastSpace = true;
        }
        continue;
      }
      const el = n.parentElement;
      if (!el || !n.data || !ok(el)) continue;
      const block = blockOf(el);
      if (block !== lastBlock) {
        if (text) { text += SEP; nodeIdx.push(-1); starts.push(0); ends.push(0); }
        lastBlock = block;
        lastSpace = true;
      }
      const ni = nodes.push(n) - 1;
      const data = n.data;
      let i = 0;
      for (const ch of data) {
        const len = ch.length;
        if (isSpace(ch)) {
          if (!lastSpace) {
            text += ' '; nodeIdx.push(ni); starts.push(i); ends.push(i + len);
            lastSpace = true;
          }
        } else {
          const f = foldChar(ch);
          for (const fc of f) {
            text += fc; nodeIdx.push(ni); starts.push(i); ends.push(i + len);
          }
          if (f) lastSpace = false;
        }
        i += len;
      }
    }
    lastBlock = null;
  }
  return { text, nodes, nodeIdx, starts, ends };
}

/** Find all occurrences of a folded query. Returns [start, end) pairs. */
export function findAll(pt, q) {
  const out = [];
  if (!q) return out;
  let from = 0;
  for (;;) {
    const i = pt.text.indexOf(q, from);
    if (i < 0 || out.length >= MAX_MATCHES) break;
    out.push([i, i + q.length]);
    from = i + q.length;
  }
  return out;
}

export function toRange(pt, m) {
  const r = document.createRange();
  const a = m[0];
  const b = m[1] - 1;
  r.setStart(pt.nodes[pt.nodeIdx[a]], pt.starts[a]);
  r.setEnd(pt.nodes[pt.nodeIdx[b]], pt.ends[b]);
  return r;
}
