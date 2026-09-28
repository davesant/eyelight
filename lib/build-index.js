// Builds minimarker-index.json from a folder of built HTML files.
// No dependencies: uses lightweight regex extraction, which is reliable for
// the parts we need (title, meta tags, headings) in generated HTML.

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', copy: '©', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };

export function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

const clean = (s) => decode(s.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

function attr(tag, name) {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return m ? decode(m[1] ?? m[2] ?? m[3] ?? '') : null;
}

function meta(html, name) {
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const n = (attr(m[0], 'name') || attr(m[0], 'property') || '').toLowerCase();
    if (n === name) return attr(m[0], 'content');
  }
  return null;
}

/** Extract index data from one HTML document. Returns null if the page opts out. */
export function extractPage(html, { selectorStrip = ['nav', 'footer'], levels = [1, 2, 3] } = {}) {
  let h = html.replace(/<!--[\s\S]*?-->/g, '');
  const robots = (meta(h, 'robots') || '').toLowerCase();
  const own = (meta(h, 'minimarker') || '').toLowerCase();
  if (robots.includes('noindex') || own.includes('noindex')) return null;
  const title = clean((h.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '');
  const description = meta(h, 'description') || meta(h, 'og:description') || '';
  const keywords = (meta(h, 'keywords') || '').split(',').map((k) => k.trim()).filter(Boolean);
  h = h.replace(/<(script|style|template|noscript|svg)\b[\s\S]*?<\/\1>/gi, '');
  for (const t of selectorStrip) h = h.replace(new RegExp(`<${t}\\b[\\s\\S]*?</${t}>`, 'gi'), '');
  h = h.replace(/<([a-z][\w-]*)\b[^>]*\sdata-minimarker-ignore\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  const headings = [];
  const re = new RegExp(`<h([${levels.join('')}])\\b([^>]*)>([\\s\\S]*?)</h\\1>`, 'gi');
  for (const m of h.matchAll(re)) {
    const text = clean(m[3]);
    if (!text) continue;
    let id = attr(`<h ${m[2]}>`, 'id');
    if (!id) { const inner = m[3].match(/<a\b[^>]*\s(?:id|name)\s*=\s*["']?([^"'\s>]+)/i); if (inner) id = decode(inner[1]); }
    const entry = { text, level: Number(m[1]) };
    if (id) entry.id = id;
    headings.push(entry);
  }
  const h1 = headings.find((x) => x.level === 1);
  return {
    title: title || (h1 && h1.text) || '',
    description: clean(description),
    keywords,
    headings: headings.filter((x) => !(x.level === 1 && x.text === title)),
  };
}

async function* walk(dir) {
  for (const d of await readdir(dir, { withFileTypes: true })) {
    if (d.name.startsWith('.') || d.name === 'node_modules') continue;
    const p = join(dir, d.name);
    if (d.isDirectory()) yield* walk(p);
    else if (/\.html?$/i.test(d.name)) yield p;
  }
}

function toUrl(file, dir, base, cleanUrls) {
  let rel = relative(dir, file).split(sep).join('/');
  if (/(^|\/)index\.html?$/i.test(rel)) rel = rel.replace(/index\.html?$/i, '');
  else if (cleanUrls) rel = rel.replace(/\.html?$/i, '');
  return base.replace(/\/?$/, '/') + rel;
}

function globToRe(g) {
  return new RegExp(`^${g.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);
}

/**
 * @param {string} dir  folder of built HTML
 * @param {{base?:string, exclude?:string[], cleanUrls?:boolean, levels?:number[]}} opts
 */
export async function buildIndex(dir, opts = {}) {
  const base = opts.base || '/';
  const exclude = (opts.exclude || ['404.html', '**/404.html']).map((g) => globToRe(g.replace(/\*\*\//g, '*')));
  if (!(await stat(dir)).isDirectory()) throw new Error(`Not a directory: ${dir}`);
  const pages = [];
  for await (const file of walk(dir)) {
    const rel = relative(dir, file).split(sep).join('/');
    if (exclude.some((re) => re.test(rel))) continue;
    const data = extractPage(await readFile(file, 'utf8'), { levels: opts.levels });
    if (!data) continue;
    pages.push({ url: toUrl(file, dir, base, opts.cleanUrls), ...data });
  }
  pages.sort((a, b) => a.url.localeCompare(b.url));
  return { version: 1, generated: new Date().toISOString(), pages };
}
