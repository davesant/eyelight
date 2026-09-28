// Builds dist/ and copies the script into the docs site, then checks the size budget (NF5).
import { build } from 'esbuild';
import { copyFile, readFile, mkdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { writeFile } from 'node:fs/promises';
import { buildIndex } from '../lib/build-index.js';

const banner = { js: '/*! minisearch v0.1.0 | MIT | github.com/davesant/minisearch */' };
const common = { bundle: true, target: ['chrome105', 'firefox115', 'safari16'], banner, legalComments: 'none', charset: 'utf8' };

await mkdir('dist', { recursive: true });
await build({ ...common, entryPoints: ['src/auto.js'], format: 'iife', minify: true, outfile: 'dist/minisearch.min.js' });
await build({ ...common, entryPoints: ['src/auto.js'], format: 'iife', minify: false, outfile: 'dist/minisearch.js' });
await build({ ...common, entryPoints: ['src/esm.js'], format: 'esm', minify: true, outfile: 'dist/minisearch.esm.js' });
await copyFile('dist/minisearch.min.js', 'docs/minisearch.min.js');
// The docs site is served by GitHub Pages at /minisearch/ and dogfoods the index CLI.
const docsIndex = await buildIndex('docs', { base: '/minisearch/' });
await writeFile('docs/minisearch-index.json', JSON.stringify(docsIndex));
console.log(`docs/minisearch-index.json  ${docsIndex.pages.length} pages`);

const min = await readFile('dist/minisearch.min.js');
const gz = gzipSync(min, { level: 9 }).length;
const BUDGET = 12 * 1024;
console.log(`dist/minisearch.min.js  ${(min.length / 1024).toFixed(1)} KB  (${(gz / 1024).toFixed(1)} KB gzipped, budget 12 KB)`);
if (gz > BUDGET) { console.error('Size budget exceeded'); process.exit(1); }
