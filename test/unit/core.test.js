import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { foldQuery, words } from '../../src/fold.js';
import { suggest } from '../../src/suggest.js';
import { extractPage, buildIndex, decode } from '../../lib/build-index.js';

test('F2.2 folding ignores case, accents and whitespace runs', () => {
  assert.equal(foldQuery('  Café  AU   Lait '), 'cafe au lait');
  assert.equal(foldQuery('ÅNGSTRÖM'), 'angstrom');
  assert.deepEqual(words('Tuning: your-harmonica!'), ['tuning', 'your', 'harmonica']);
});

// Minimal entries in the shape produced by data.js prepare()
const entry = (title, extra = {}) => ({ url: `http://x/${title}`, title, sub: '', fields: [[10, words(title)], [3, words(extra.h || '')]], ...extra });

test('F3.2 every query word must prefix-match; title matches rank first', () => {
  const es = [entry('Bending notes', { h: 'harmonica' }), entry('Harmonica tuning'), entry('Unrelated')];
  const r = suggest(es, 'harm', 8).map((e) => e.title);
  assert.deepEqual(r, ['Harmonica tuning', 'Bending notes']);
  assert.deepEqual(suggest(es, 'harm tun', 8).map((e) => e.title), ['Harmonica tuning']);
  assert.deepEqual(suggest(es, 'zzz', 8), []);
});

test('F3.1 respects the maximum number of suggestions', () => {
  const es = Array.from({ length: 20 }, (_, i) => entry(`Page ${i}`));
  assert.equal(suggest(es, 'page', 8).length, 8);
});

test('F3.3 sections only appear when their own heading matches', () => {
  const sec = { url: 'http://x/p#a', title: 'Flattening a reed', sub: 'Tuning', section: true, page: 'http://x/p', fields: [[8, words('Flattening a reed')], [2, words('Tuning')]] };
  assert.equal(suggest([sec], 'flat', 8).length, 1);
  assert.equal(suggest([sec], 'tuning', 8).length, 0);
});

test('CLI extractPage reads title, meta, headings with ids and skips nav', () => {
  const html = `<html><head><title>A &amp; B</title><meta name="description" content="Desc &quot;x&quot;">
  <meta name="keywords" content="one, two"></head><body><nav><h2 id="n">Nav</h2></nav>
  <main><h1>A &amp; B</h1><h2 id="s1">Section <em>one</em></h2><h3><a id="s2"></a>Two</h3><h2>No id</h2>
  <div data-minisearch-ignore><h2 id="skip">Skip</h2></div><script>"<h2>x</h2>"</script></main></body></html>`;
  const p = extractPage(html);
  assert.equal(p.title, 'A & B');
  assert.equal(p.description, 'Desc "x"');
  assert.deepEqual(p.keywords, ['one', 'two']);
  assert.deepEqual(p.headings, [
    { text: 'Section one', level: 2, id: 's1' },
    { text: 'Two', level: 3, id: 's2' },
    { text: 'No id', level: 2 },
  ]);
});

test('CLI honours noindex', () => {
  assert.equal(extractPage('<meta name="robots" content="noindex"><title>x</title>'), null);
  assert.equal(extractPage('<meta name="minisearch" content="noindex"><title>x</title>'), null);
});

test('CLI decodes numeric entities', () => {
  assert.equal(decode('&#8217;&#x2014;&amp;'), '’—&');
});

test('CLI buildIndex walks a folder, maps index.html to folder URLs, skips 404', async () => {
  const idx = await buildIndex('test/fixtures/site', { base: '/site/' });
  const urls = idx.pages.map((p) => p.url);
  assert.ok(urls.includes('/site/'));
  assert.ok(urls.includes('/site/guide/'));
  assert.ok(urls.includes('/site/guide/tuning.html'));
  assert.ok(!urls.some((u) => u.includes('404')));
  assert.ok(!urls.some((u) => u.includes('secret')));
  const clean = await buildIndex('test/fixtures/site', { cleanUrls: true });
  assert.ok(clean.pages.some((p) => p.url === '/guide/tuning'));
});

// NF6.1 contrast of default theme colours (WCAG 1.4.3 text 4.5:1, 1.4.11 UI 3:1)
function lum(hex) {
  const n = hex.replace('#', '');
  const full = n.length === 3 ? [...n].map((c) => c + c).join('') : n;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

test('NF6.1 default light and dark themes meet WCAG AA contrast', async () => {
  const css = await readFile('src/styles.js', 'utf8');
  for (const name of ['LIGHT', 'DARK']) {
    const block = css.match(new RegExp(`const ${name} = \`([\\s\\S]*?)\``))[1];
    const v = Object.fromEntries([...block.matchAll(/--ms-([\w-]+):(#[0-9a-f]{3,6})/gi)].map((m) => [m[1], m[2]]));
    assert.ok(ratio(v.fg, v.bg) >= 4.5, `${name} fg`);
    assert.ok(ratio(v.muted, v.bg) >= 4.5, `${name} muted`);
    assert.ok(ratio(v.accent, v.bg) >= 3, `${name} accent (focus ring / selected outline)`);
    assert.ok(ratio(v.border, v.bg) >= 3, `${name} border`);
    assert.ok(ratio(v['accent-fg'], v.accent) >= 4.5, `${name} accent-fg`);
    assert.ok(ratio(v['mark-fg'], v.mark) >= 4.5, `${name} mark`);
    assert.ok(ratio(v.fg, v.active) >= 4.5, `${name} active option text`);
    assert.ok(ratio(v.muted, v.active) >= 4.5, `${name} active option secondary text`);
  }
  assert.ok(ratio('#111111', '#ffe36e') >= 4.5, 'page highlight');
  assert.ok(ratio('#000000', '#ff9632') >= 4.5, 'current highlight');
});
