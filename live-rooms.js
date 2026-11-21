import { createHash, timingSafeEqual } from 'node:crypto';
import { WebSocket } from 'ws';

const roomPattern = /^[A-Z0-9_-]{1,64}$/;
const invitationPattern = /^PILOT-[A-F0-9]{32}$/;
const publishedTypes = new Set(['FULL_STATE', 'PLAY_STATE', 'SYNC_TIME']);
const speeds = new Set([0.25, 0.5, 0.75, 1, 1.25, 1.5]);
const digest = (value) => createHash('sha256').update(value).digest();

export function createRoomHandler({ directorKey = '' } = {}) {
  const rooms = new Map();
  const keyHash = directorKey ? digest(directorKey) : null;

  return (socket) => {
    let room;
    let roomId;
    let attempts = 0;

    const send = (client, payload) => {
      if (client.readyState === WebSocket.OPEN && client.bufferedAmount < 4 * 1024 * 1024) {
        client.send(JSON.stringify(payload));
      }
    };

    const relay = (payload) => {
      for (const client of room.clients) {
        if (client !== socket) send(client, payload);
      }
    };

    const leave = () => {
      if (!room) return;
      room.clients.delete(socket);
      if (room.director === socket) {
        room.director = null;
        if (room.state) {
          room.state = { ...room.state, isPlaying: false, timestamp: Date.now() };
          relay(room.state);
        }
      }
      if (room.clients.size === 0) rooms.delete(roomId);
      room = undefined;
    };

    socket.on('error', leave);
    socket.on('close', leave);
    socket.on('message', (raw) => {
      let payload;
      try { payload = JSON.parse(raw.toString()); } catch { return; }
      if (!payload || typeof payload.roomId !== 'string' || !roomPattern.test(payload.roomId)) return;
      if (keyHash && !invitationPattern.test(payload.roomId)) return;
      if (payload.type === 'JOIN_ROOM') {
        if (roomId !== payload.roomId || !room) {
          const target = rooms.get(payload.roomId);
          if ((!target && rooms.size >= 200) || (target && target.clients.size >= 150)) return;
          leave();
          roomId = payload.roomId;
          room = target ?? { clients: new Set(), director: null, state: null };
          rooms.set(roomId, room);
          room.clients.add(socket);
        }
        if (room.director !== socket && room.state) send(socket, room.state);
        if (!keyHash) relay(payload);
        return;
      }
      if (!room || payload.roomId !== roomId) return;

      if (payload.type === 'DIRECTOR_AUTH' && keyHash) {
        if (attempts++ >= 5) { socket.close(1008, 'Intentos agotados'); return; }
        const valid = typeof payload.key === 'string' && payload.key.length <= 256 &&
          timingSafeEqual(digest(payload.key), keyHash);
        const status = !valid ? 'invalid' : room.director && room.director !== socket ? 'occupied' : 'authorized';
        if (status === 'authorized') room.director = socket;
        send(socket, { type: 'DIRECTOR_STATUS', roomId, status });
        return;
      }

      if (payload.type === 'REQUEST_SYNC') {
        if (room.state && room.director !== socket) send(socket, room.state);
        if (!keyHash) relay(payload);
        return;
      }
      if (!publishedTypes.has(payload.type) || (keyHash && room.director !== socket)) return;
      if (!Number.isFinite(payload.currentTimeMs) || payload.currentTimeMs < 0 ||
          typeof payload.isPlaying !== 'boolean' || !speeds.has(payload.playbackRate)) return;
      if (payload.type === 'FULL_STATE' && (!payload.project ||
          !Array.isArray(payload.project.dancers) || !Array.isArray(payload.project.formations) ||
          !Array.isArray(payload.project.beats))) return;

      const packet = {
        type: payload.type, roomId, senderId: payload.senderId, timestamp: Date.now(),
        currentTimeMs: payload.currentTimeMs, playbackRate: payload.playbackRate,
        isPlaying: payload.isPlaying, activeFormationId: payload.activeFormationId,
      };
      if (payload.type === 'FULL_STATE') {
        packet.project = payload.project;
        room.state = packet;
      } else if (room.state) {
        room.state = { ...room.state, ...packet, type: 'FULL_STATE' };
      }
      relay(packet);
    });
  };
}
