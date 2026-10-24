import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve('dist');
const types = {'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.jpg':'image/jpeg'};
http.createServer(async (req, res) => {
  try {
    const path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname === '/' ? '/index.html' : new URL(req.url, 'http://localhost').pathname));
    if (!path.startsWith(root + sep)) {res.writeHead(403).end(); return;}
    res.writeHead(200, {'Content-Type':types[extname(path)] || 'application/octet-stream','Cache-Control':'no-store'}).end(await readFile(path));
  } catch {if (!res.headersSent) res.writeHead(404); res.end('No encontrado');}
}).listen(4173, '127.0.0.1', () => console.log('Tu Vitrina: http://localhost:4173'));
