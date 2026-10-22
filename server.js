import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 5173;
const WS_PORT = process.env.WS_PORT || 8080;

// Obtener la IP local de la máquina en la red Wi-Fi / Ethernet
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const localIp = getLocalIpAddress();

// 1. Servidor HTTP estático para producción (carpeta dist) o fallback
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};

const distDir = path.join(__dirname, 'dist');

const server = http.createServer((req, res) => {
  let filePath = path.join(distDir, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  const ext = path.extname(filePath);
  let contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // Fallback SPA index.html
        fs.readFile(path.join(distDir, 'index.html'), (err2, indexContent) => {
          if (err2) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
              <!DOCTYPE html>
              <html>
              <head><title>ChoreoSync Pro Server</title></head>
              <body style="background:#020617;color:#f8fafc;font-family:sans-serif;padding:40px;text-align:center;">
                <h1 style="color:#22d3ee">ChoreoSync Pro - Servidor en Vivo</h1>
                <p>Para servir la interfaz web compilada, ejecuta <code>npm run build</code> primero, o inicia el modo desarrollo con <code>npm run dev</code>.</p>
                <p>El WebSocket de sincronización en tiempo real está activo en <strong>ws://${localIp}:${WS_PORT}</strong>.</p>
              </body>
              </html>
            `);
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(indexContent, 'utf-8');
          }
        });
      } else {
        res.writeHead(500);
        res.end(`Error de servidor: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n==================================================`);
  console.log(`🎵 CHOREOSYNC PRO - SERVIDOR EN TIEMPO REAL ACTIVO`);
  console.log(`==================================================`);
  console.log(`▶ Web Local:      http://localhost:${PORT}`);
  console.log(`▶ Enlace Móvil:   http://${localIp}:${PORT}/?mode=dancer`);
  console.log(`▶ WebSocket Sync: ws://${localIp}:${WS_PORT}`);
  console.log(`==================================================\n`);
});

// 2. Servidor WebSocket para salas y sincronización de bailarines en vivo
const wss = new WebSocketServer({ port: WS_PORT });

const rooms = new Map(); // roomId -> Set<WebSocket>

wss.on('connection', (ws) => {
  let currentRoom = 'SALA-CHOREO-1';

  if (!rooms.has(currentRoom)) {
    rooms.set(currentRoom, new Set());
  }
  rooms.get(currentRoom).add(ws);

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.roomId && data.roomId !== currentRoom) {
        // Cambiar de sala
        rooms.get(currentRoom)?.delete(ws);
        currentRoom = data.roomId;
        if (!rooms.has(currentRoom)) {
          rooms.set(currentRoom, new Set());
        }
        rooms.get(currentRoom).add(ws);
      }

      // Reenviar a todos los clientes de la misma sala
      const roomClients = rooms.get(currentRoom);
      if (roomClients) {
        for (const client of roomClients) {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(message.toString());
          }
        }
      }
    } catch (e) {
      // Ignorar mensajes no parseables
    }
  });

  ws.on('close', () => {
    rooms.get(currentRoom)?.delete(ws);
  });
});
