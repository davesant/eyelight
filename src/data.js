// Loads the list of site pages used for suggestions.
// Order: build-time index JSON -> sitemap.xml -> nothing. Inline `pages`
// from the config are always merged in.

import { words } from './fold.js';

const same = (u) => u.origin === location.origin;

function abs(url, base) {
  try { return new URL(url, base); } catch { return null; }
}

/** Accepts {pages:[...]} or a bare array. */
export function normaliseIndex(json, base) {
  const list = Array.isArray(json) ? json : (json && json.pages) || [];
  const out = [];
  for (const p of list) {
    if (!p) continue;
    const u = abs(typeof p === 'string' ? p : p.url, base);
    if (!u || !same(u)) continue;
    out.push({
      url: u.href,
      title: String(p.title || titleFromUrl(u)),
      description: String(p.description || ''),
      keywords: Array.isArray(p.keywords) ? p.keywords.map(String) : String(p.keywords || '').split(',').filter(Boolean),
      headings: Array.isArray(p.headings)
        ? p.headings.filter((h) => h && h.text != null).map((h) => ({ text: String(h.text), id: h.id == null ? '' : String(h.id) }))
        : [],
    });
  }
  return out;
}

export function titleFromUrl(u) {
  const seg = u.pathname.split('/').filter(Boolean).pop();
  if (!seg) return 'Home';
  let s = seg;
  try { s = decodeURIComponent(seg); } catch { /* malformed escape: keep as is */ }
  const t = s.replace(/\.(html?|php)$/i, '').replace(/[-_]+/g, ' ').trim();
  if (/^index$/i.test(t)) return titleFromUrl(new URL('..', u));
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function fromSitemap(xmlText, base) {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  const locs = [...doc.getElementsByTagName('loc')].map((l) => l.textContent.trim());
  const isIndex = !!doc.getElementsByTagName('sitemapindex').length;
  return { isIndex, urls: locs.map((l) => abs(l, base)).filter((u) => u && same(u)) };
}

async function get(url) {
  const r = await fetch(url, { credentials: 'same-origin' });
  if (!r.ok) throw new Error(r.status);
  return r;
}

export async function loadPages(cfg) {
  let pages = [];
  if (cfg.index) {
    try {
      const r = await get(cfg.index);
      pages = normaliseIndex(await r.json(), r.url);
    } catch { /* fall through to sitemap */ }
  }
  if (!pages.length && cfg.sitemap) {
    try {
      const r = await get(cfg.sitemap);
      let sm = fromSitemap(await r.text(), r.url);
      let urls = sm.urls;
      if (sm.isIndex) {
        urls = [];
        for (const child of sm.urls.slice(0, 5)) {
          try { const c = await get(child.href); urls.push(...fromSitemap(await c.text(), c.url).urls); } catch { /* skip */ }
        }
      }
      pages = urls.map((u) => ({ url: u.href, title: titleFromUrl(u), description: '', keywords: [], headings: [] }));
    } catch { /* no sitemap */ }
  }
  if (cfg.pages) pages = pages.concat(normaliseIndex(cfg.pages, location.href));
  return prepare(pages);
}

/** Turn pages into searchable entries (pages plus sections with ids). */
export function prepare(pages) {
  const entries = [];
  const seen = new Set();
  for (const p of pages) {
    if (seen.has(p.url)) continue;
    seen.add(p.url);
    const path = new URL(p.url).pathname;
    entries.push({
      url: p.url,
      title: p.title,
      sub: p.description || path,
      fields: [
        [10, words(p.title)],
        [5, p.keywords.flatMap(words)],
        [3, p.headings.flatMap((h) => words(h.text))],
        [2, words(p.description)],
        [1, words(path)],
      ],
    });
    for (const h of p.headings) {
      if (!h.id) continue;
      const u = new URL(p.url);
      u.hash = h.id;
      entries.push({
        url: u.href,
        title: h.text,
        sub: p.title,
        section: true,
        page: p.url,
        fields: [[8, words(h.text)], [2, words(p.title)]],
      });
    }
  }
  return entries;
}
