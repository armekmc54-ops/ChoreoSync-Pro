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
                <p>El WebSocket de sincronización en tiempo real está activo en <strong>ws://${localIp}:${PORT}/ws</strong> y <strong>ws://${localIp}:${WS_PORT}</strong>.</p>
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

// 2. Servidores WebSocket con memoria de estado (Caché de coreografía en vivo)
const rooms = new Map(); // roomId -> Set<WebSocket>
const roomStates = new Map(); // roomId -> last FULL_STATE payload

function handleWsConnection(ws, req) {
  let currentRoom = 'SALA-CHOREO-1';
  const remoteIp = req?.socket?.remoteAddress || 'desconocida';
  console.log(`[ChoreoSync Live WS] Conexión establecida desde ${remoteIp}`);

  if (!rooms.has(currentRoom)) {
    rooms.set(currentRoom, new Set());
  }
  rooms.get(currentRoom).add(ws);

  // Enviar estado en memoria inmediatamente al conectar
  if (roomStates.has(currentRoom)) {
    try {
      ws.send(JSON.stringify(roomStates.get(currentRoom)));
    } catch {}
  }

  ws.on('message', (message) => {
    try {
      const raw = message.toString();
      const data = JSON.parse(raw);
      const roomId = data.roomId || currentRoom;

      if (roomId !== currentRoom) {
        rooms.get(currentRoom)?.delete(ws);
        currentRoom = roomId;
        if (!rooms.has(currentRoom)) {
          rooms.set(currentRoom, new Set());
        }
        rooms.get(currentRoom).add(ws);
      }

      // Guardar el estado completo de la coreografía
      if (data.type === 'FULL_STATE' && data.project) {
        roomStates.set(currentRoom, data);
      }

      // Responder a solicitudes de sincronización o uniones
      if ((data.type === 'REQUEST_SYNC' || data.type === 'JOIN_ROOM') && roomStates.has(currentRoom)) {
        const cached = roomStates.get(currentRoom);
        try {
          ws.send(JSON.stringify({ ...cached, timestamp: Date.now() }));
        } catch {}
      }

      // Retransmitir a los demás clientes de la misma sala
      const roomClients = rooms.get(currentRoom);
      if (roomClients) {
        for (const client of roomClients) {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(raw);
          }
        }
      }
    } catch (e) {
      console.error('[ChoreoSync Live WS] Error procesando mensaje:', e);
    }
  });

  ws.on('close', () => {
    rooms.get(currentRoom)?.delete(ws);
  });
}

// Servidor WebSocket acoplado en el mismo puerto HTTP (/ws)
const wssEmbedded = new WebSocketServer({ noServer: true });
wssEmbedded.on('connection', handleWsConnection);

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
  if (url.pathname === '/ws') {
    wssEmbedded.handleUpgrade(request, socket, head, (ws) => {
      wssEmbedded.emit('connection', ws, request);
    });
  }
});

// Servidor WebSocket independiente en puerto 8080 (fallback)
const wssStandalone = new WebSocketServer({ port: Number(WS_PORT), host: '0.0.0.0' });
wssStandalone.on('connection', handleWsConnection);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n==================================================`);
  console.log(`🎵 CHOREOSYNC PRO - SERVIDOR EN TIEMPO REAL ACTIVO`);
  console.log(`==================================================`);
  console.log(`▶ Director Web:   http://localhost:${PORT}`);
  console.log(`▶ Móvil Bailarín: http://${localIp}:${PORT}/?room=SALA-CHOREO-1&mode=dancer`);
  console.log(`▶ WebSocket /ws:  ws://${localIp}:${PORT}/ws (Principal)`);
  console.log(`▶ WebSocket 8080: ws://${localIp}:${WS_PORT} (Fallback)`);
  console.log(`==================================================\n`);
});
