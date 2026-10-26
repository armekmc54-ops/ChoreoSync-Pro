import { WebSocketServer, WebSocket } from 'ws';

const WS_PORT = process.env.WS_PORT || 8080;
const wss = new WebSocketServer({ port: Number(WS_PORT), host: '0.0.0.0' });
const rooms = new Map();
const roomStates = new Map(); // roomId -> last FULL_STATE payload

wss.on('connection', (ws, req) => {
  let currentRoom = 'SALA-CHOREO-1';
  const remoteIp = req?.socket?.remoteAddress || 'desconocida';
  console.log(`[WS-Server] Nueva conexión desde ${remoteIp}`);

  if (!rooms.has(currentRoom)) {
    rooms.set(currentRoom, new Set());
  }
  rooms.get(currentRoom).add(ws);

  // Si ya tenemos el estado de la coreografía en memoria, enviarlo al cliente inmediatamente
  if (roomStates.has(currentRoom)) {
    try {
      ws.send(JSON.stringify(roomStates.get(currentRoom)));
    } catch (e) {}
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

      // Guardar el estado completo de la coreografía asegurando arrays
      if (data.type === 'FULL_STATE' && data.project && Array.isArray(data.project.dancers) && Array.isArray(data.project.formations)) {
        if (!Array.isArray(data.project.beats)) data.project.beats = [];
        roomStates.set(currentRoom, data);
      }

      // Si solicitan sincronización o se unen, responder de inmediato con el estado guardado
      if ((data.type === 'REQUEST_SYNC' || data.type === 'JOIN_ROOM') && roomStates.has(currentRoom)) {
        const cached = roomStates.get(currentRoom);
        try {
          ws.send(JSON.stringify({ ...cached, timestamp: Date.now() }));
        } catch (e) {}
      }

      // Difundir a todos los otros clientes de la misma sala
      const roomClients = rooms.get(currentRoom);
      if (roomClients) {
        for (const client of roomClients) {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(raw);
          }
        }
      }
    } catch (e) {
      console.error('[WS-Server] Error parseando mensaje:', e);
    }
  });

  ws.on('close', () => {
    rooms.get(currentRoom)?.delete(ws);
    console.log(`[WS-Server] Conexión cerrada (${remoteIp})`);
  });
});

console.log(`====================================================`);
console.log(`⚡ WebSocket Server activo en ws://0.0.0.0:${WS_PORT}`);
console.log(`====================================================`);
