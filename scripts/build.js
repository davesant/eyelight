// Builds dist/ and copies the script into the docs site, then checks the size budget (NF5).
import { build } from 'esbuild';
import { copyFile, readFile, mkdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { writeFile } from 'node:fs/promises';
import { buildIndex } from '../lib/build-index.js';

const banner = { js: '/*! minimarker v0.1.0 | MIT | github.com/davesant/minimarker */' };
const common = { bundle: true, target: ['chrome105', 'firefox115', 'safari16'], banner, legalComments: 'none', charset: 'utf8' };

await mkdir('dist', { recursive: true });
await build({ ...common, entryPoints: ['src/auto.js'], format: 'iife', minify: true, outfile: 'dist/minimarker.min.js' });
await build({ ...common, entryPoints: ['src/auto.js'], format: 'iife', minify: false, outfile: 'dist/minimarker.js' });
await build({ ...common, entryPoints: ['src/esm.js'], format: 'esm', minify: true, outfile: 'dist/minimarker.esm.js' });
await copyFile('dist/minimarker.min.js', 'docs/minimarker.min.js');
// The docs site is served by GitHub Pages at /minimarker/ and dogfoods the index CLI.
const docsIndex = await buildIndex('docs', { base: '/minimarker/' });
await writeFile('docs/minimarker-index.json', JSON.stringify(docsIndex));
console.log(`docs/minimarker-index.json  ${docsIndex.pages.length} pages`);

const min = await readFile('dist/minimarker.min.js');
const gz = gzipSync(min, { level: 9 }).length;
const BUDGET = 13 * 1024;
console.log(`dist/minimarker.min.js  ${(min.length / 1024).toFixed(1)} KB  (${(gz / 1024).toFixed(1)} KB gzipped, budget 13 KB)`);
if (gz > BUDGET) { console.error('Size budget exceeded'); process.exit(1); }
