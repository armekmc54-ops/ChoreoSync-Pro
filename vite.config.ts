import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { WebSocketServer, WebSocket } from 'ws';

function liveSyncPlugin(): Plugin {
  return {
    name: 'choreosync-live-ws',
    configureServer(server) {
      if (!server.httpServer) return;
      const wss = new WebSocketServer({ noServer: true });
      const rooms = new Map<string, Set<WebSocket>>();
      const roomStates = new Map<string, any>();

      server.httpServer.on('upgrade', (request, socket, head) => {
        try {
          const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
          if (url.pathname === '/ws') {
            wss.handleUpgrade(request, socket, head, (ws) => {
              wss.emit('connection', ws, request);
            });
          }
        } catch (e) {
          console.error('Error upgrading websocket in Vite:', e);
        }
      });

      wss.on('connection', (ws) => {
        let currentRoom = 'SALA-CHOREO-1';
        if (!rooms.has(currentRoom)) rooms.set(currentRoom, new Set());
        rooms.get(currentRoom)!.add(ws);

        // Si ya hay un estado guardado en caché para esta sala, enviarlo de inmediato
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
              if (!rooms.has(currentRoom)) rooms.set(currentRoom, new Set());
              rooms.get(currentRoom)!.add(ws);
            }

            // Si es un FULL_STATE con proyecto, asegurar formato y guardarlo en caché del servidor
            if (data.type === 'FULL_STATE' && data.project && Array.isArray(data.project.dancers) && Array.isArray(data.project.formations)) {
              if (!Array.isArray(data.project.beats)) data.project.beats = [];
              roomStates.set(currentRoom, data);
            }

            // Responder directamente al cliente si pide sync o se une y hay caché
            if ((data.type === 'REQUEST_SYNC' || data.type === 'JOIN_ROOM') && roomStates.has(currentRoom)) {
              const cached = roomStates.get(currentRoom);
              try {
                ws.send(JSON.stringify({ ...cached, timestamp: Date.now() }));
              } catch (e) {}
            }

            // Retransmitir a los demás clientes de la sala
            const roomClients = rooms.get(currentRoom);
            if (roomClients) {
              for (const client of roomClients) {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                  client.send(raw);
                }
              }
            }
          } catch (err) {
            console.error('Error procesando mensaje WebSocket:', err);
          }
        });

        ws.on('close', () => {
          rooms.get(currentRoom)?.delete(ws);
        });
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), liveSyncPlugin()],
  server: {
    port: 5173,
    host: true
  }
});
