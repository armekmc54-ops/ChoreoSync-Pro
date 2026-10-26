import { WebSocketServer } from 'ws';

const WS_PORT = process.env.WS_PORT || 8080;
const wss = new WebSocketServer({ port: Number(WS_PORT) });
const rooms = new Map();

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
        rooms.get(currentRoom)?.delete(ws);
        currentRoom = data.roomId;
        if (!rooms.has(currentRoom)) {
          rooms.set(currentRoom, new Set());
        }
        rooms.get(currentRoom).add(ws);
      }

      const roomClients = rooms.get(currentRoom);
      if (roomClients) {
        for (const client of roomClients) {
          if (client !== ws && client.readyState === 1) {
            client.send(message.toString());
          }
        }
      }
    } catch (e) {}
  });

  ws.on('close', () => {
    rooms.get(currentRoom)?.delete(ws);
  });
});

console.log(`WebSocket Server activo en ws://localhost:${WS_PORT}`);
