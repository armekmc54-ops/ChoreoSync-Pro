import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { createRoomHandler } from './live-rooms.js';

const port = Number(process.env.PORT || 5173);
const directorKey = process.env.CHOREO_DIRECTOR_KEY?.trim();
const publicMode = Boolean(process.env.RENDER || directorKey);
if (publicMode && (!directorKey || directorKey.length < 24 || directorKey.length > 256)) {
  throw new Error('CHOREO_DIRECTOR_KEY debe tener entre 24 y 256 caracteres.');
}

const dist = fileURLToPath(new URL('./dist/', import.meta.url));
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }

  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400).end(); return; }

  if (pathname === '/health') {
    res.writeHead(200).end('ok');
    return;
  }
  if (pathname === '/api/live-config') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ requiresDirectorKey: publicMode }));
    return;
  }
  if (pathname === '/api/live-hosts') {
    const addresses = publicMode ? [] : Object.entries(os.networkInterfaces()).flatMap(([name, entries]) =>
      (entries ?? []).filter(({ family, internal }) => family === 'IPv4' && !internal)
        .map(({ address }) => ({ name, address })));
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(addresses));
    return;
  }

  const file = path.resolve(dist, '.' + pathname);
  const relative = path.relative(dist, file);
  if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative) || pathname.includes('\x00')) {
    res.writeHead(404).end();
    return;
  }
  const ext = path.extname(file);
  const isPage = !ext;
  const resolved = isPage ? path.join(dist, 'index.html') : file;
  fs.readFile(resolved, (error, data) => {
    if (error) { res.writeHead(404).end(isPage ? 'Ejecuta npm run build.' : ''); return; }
    res.writeHead(200, {
      'Content-Type': mime[isPage ? '.html' : ext] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
    }).end(req.method === 'HEAD' ? undefined : data);
  });
});

const rooms = createRoomHandler({ directorKey });
const sockets = new WebSocketServer({ noServer: true, maxPayload: 2 * 1024 * 1024 });
sockets.on('connection', (client) => {
  client.alive = true;
  client.on('pong', () => { client.alive = true; });
  rooms(client);
});
const heartbeat = setInterval(() => {
  for (const client of sockets.clients) {
    if (!client.alive) client.terminate();
    else {
      client.alive = false;
      client.ping();
    }
  }
}, 25000);
heartbeat.unref();
sockets.on('close', () => clearInterval(heartbeat));
server.on('upgrade', (request, socket, head) => {
  if (request.url !== '/ws') { socket.destroy(); return; }
  sockets.handleUpgrade(request, socket, head, (client) => sockets.emit('connection', client));
});
if (!publicMode && process.env.WS_PORT) {
  new WebSocketServer({ port: Number(process.env.WS_PORT), host: '0.0.0.0', maxPayload: 2 * 1024 * 1024 })
    .on('connection', rooms);
}
server.listen(port, '0.0.0.0', () => console.log('ChoreoSync Pro: HTTP y /ws disponibles en el puerto ' + port));
