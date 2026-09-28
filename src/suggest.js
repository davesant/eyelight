// Ranks site entries against a query. Every query word must prefix-match
// (or, for 3+ letters, appear inside) a word in one of the entry's fields.

import { words, foldQuery } from './fold.js';

function wordScore(qw, list) {
  let best = 0;
  for (const w of list) {
    if (w === qw) return 1;
    if (w.startsWith(qw)) best = Math.max(best, 0.7);
    else if (qw.length >= 3 && w.includes(qw)) best = Math.max(best, 0.3);
  }
  return best;
}

export function suggest(entries, query, max) {
  const qws = words(query);
  if (!qws.length) return [];
  const fq = foldQuery(query);
  const scored = [];
  for (const e of entries) {
    let total = 0;
    let ok = true;
    let primary = false; // did the entry's own first field match?
    for (const qw of qws) {
      let best = 0;
      e.fields.forEach(([weight, list], i) => {
        const s = wordScore(qw, list) * weight;
        if (s > best) best = s;
        if (i === 0 && s > 0) primary = true;
      });
      if (!best) { ok = false; break; }
      total += best;
    }
    if (!ok || (e.section && !primary)) continue;
    if (foldQuery(e.title).startsWith(fq)) total += 5;
    if (e.section) total -= 0.5;
    scored.push([total, e]);
  }
  scored.sort((a, b) => b[0] - a[0]);
  const out = [];
  const perPage = new Map();
  for (const [, e] of scored) {
    if (e.section) {
      const n = perPage.get(e.page) || 0;
      if (n >= 2) continue;
      perPage.set(e.page, n + 1);
    }
    out.push(e);
    if (out.length >= max) break;
  }
  return out;
}
