// Tiny static file server for local development and tests.
// Usage: node scripts/serve.js <folder> [port] [base]
// base mounts the folder under a URL prefix, e.g. /minimarker/ like GitHub Pages.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, extname, resolve } from 'node:path';

const root = resolve(process.argv[2] || 'docs');
const port = Number(process.argv[3] || 8080);
const base = (process.argv[4] || '/').replace(/\/?$/, '/');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.xml': 'application/xml', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (base !== '/') { if (!p.startsWith(base)) throw new Error('outside base'); p = p.slice(base.length - 1); }
    let file = normalize(join(root, p));
    if (!file.startsWith(root)) throw new Error('forbidden');
    if ((await stat(file).catch(() => null))?.isDirectory()) file = join(file, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not found');
  }
}).listen(port, () => console.log(`Serving ${root} on http://localhost:${port}${base}`));
