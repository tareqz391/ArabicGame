// Serves dist/page.html wrapped like the Artifact host does, under a strict CSP,
// to reproduce sandbox restrictions locally. Usage: node tools/test/csp_server.mjs [port]
import http from 'http';
import fs from 'fs';
import path from 'path';
const port = +(process.argv[2] || 4300);
const dist = path.resolve('dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.ttf': 'font/ttf', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json' };
const CSP = "default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' blob: data:; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; media-src 'self' blob:";
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') {
    const body = fs.readFileSync(path.join(dist, 'page.html'), 'utf8');
    res.writeHead(200, { 'content-type': 'text/html', 'content-security-policy': CSP });
    return res.end(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}body{margin:0}</style></head><body>${body}</body></html>`);
  }
  const f = path.join(dist, p);
  if (!f.startsWith(dist) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream', 'content-security-policy': CSP });
  fs.createReadStream(f).pipe(res);
}).listen(port, () => console.log('csp server on', port));
