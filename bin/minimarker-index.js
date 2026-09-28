#!/usr/bin/env node
// Usage: minimarker-index <built-site-folder> [--out file] [--base /prefix/] [--exclude glob]... [--clean-urls]
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildIndex } from '../lib/build-index.js';

const args = process.argv.slice(2);
const opts = { exclude: [] };
let dir = null;
let out = null;
let helpRequested = false;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--out' || a === '-o') out = args[++i];
  else if (a === '--base') opts.base = args[++i];
  else if (a === '--exclude') opts.exclude.push(args[++i]);
  else if (a === '--clean-urls') opts.cleanUrls = true;
  else if (a === '--levels') opts.levels = args[++i].split(',').map(Number);
  else if (a === '--help' || a === '-h') helpRequested = true;
  else if (!a.startsWith('-')) dir = a;
}
if (!dir || helpRequested) {
  console.log(`minimarker-index - build a search index from a folder of HTML

Usage: minimarker-index <folder> [options]

  --out, -o <file>   output file (default: <folder>/minimarker-index.json)
  --base <path>      URL prefix the folder is served from (default: /)
  --exclude <glob>   skip matching files, relative to folder (repeatable; default 404.html)
  --clean-urls       write /about instead of /about.html
  --levels 1,2,3     heading levels to index (default 1,2,3)`);
  process.exit(helpRequested ? 0 : 1);
}
if (!opts.exclude.length) delete opts.exclude;
try {
  const index = await buildIndex(dir, opts);
  const file = out || join(dir, 'minimarker-index.json');
  await writeFile(file, JSON.stringify(index));
  console.log(`minimarker-index: ${index.pages.length} pages -> ${file}`);
} catch (e) {
  console.error(`minimarker-index: ${e.message}`);
  process.exit(1);
}
