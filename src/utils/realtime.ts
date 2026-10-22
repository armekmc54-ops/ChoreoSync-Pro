import QRCode from 'qrcode';
import { RealtimeSyncPayload } from '../types/choreo';

export type RealtimeListener = (payload: RealtimeSyncPayload) => void;

class RealtimeSyncManager {
  private broadcastChannel: BroadcastChannel | null = null;
  private ws: WebSocket | null = null;
  private listeners: Set<RealtimeListener> = new Set();
  public roomId: string = 'SALA-CHOREO-1';
  public senderId: string = 'client_' + Math.random().toString(36).slice(2, 8);
  private isConnectedWs = false;

  constructor() {
    this.initBroadcastChannel();
  }

  private initBroadcastChannel() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('choreosync_live_channel');
        this.broadcastChannel.onmessage = (event) => {
          if (event.data && event.data.roomId === this.roomId && event.data.senderId !== this.senderId) {
            this.notifyListeners(event.data);
          }
        };
      } catch (e) {
        console.warn('BroadcastChannel no soportado o restringido:', e);
      }
    }
  }

  public connectWebSocket(wsUrl?: string) {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const host = window.location.hostname || 'localhost';
    const targetUrl = wsUrl || `ws://${host}:8080`;

    try {
      this.ws = new WebSocket(targetUrl);

      this.ws.onopen = () => {
        this.isConnectedWs = true;
        console.log('Conectado al servidor WebSocket en vivo:', targetUrl);
        // Anunciar entrada a la sala
        this.broadcast({
          type: 'JOIN_ROOM',
          roomId: this.roomId,
          senderId: this.senderId,
          timestamp: Date.now(),
          currentTimeMs: 0,
          isPlaying: false,
          playbackRate: 1,
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const payload: RealtimeSyncPayload = JSON.parse(event.data);
          if (payload.roomId === this.roomId && payload.senderId !== this.senderId) {
            this.notifyListeners(payload);
          }
        } catch {
          // Mensaje no JSON
        }
      };

      this.ws.onerror = () => {
        this.isConnectedWs = false;
      };

      this.ws.onclose = () => {
        this.isConnectedWs = false;
      };
    } catch (e) {
      console.warn('No se pudo conectar WebSocket:', e);
    }
  }

  public setRoomId(roomId: string) {
    this.roomId = roomId.trim().toUpperCase();
  }

  public subscribe(listener: RealtimeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(payload: RealtimeSyncPayload) {
    this.listeners.forEach((listener) => {
      try {
        listener(payload);
      } catch (err) {
        console.error('Error en listener de realtime:', err);
      }
    });
  }

  public broadcast(payload: RealtimeSyncPayload) {
    payload.senderId = this.senderId;
    payload.roomId = this.roomId;
    payload.timestamp = Date.now();

    // 1. BroadcastChannel local
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(payload);
      } catch (e) {
        console.warn('Error enviando por BroadcastChannel:', e);
      }
    }

    // 2. WebSocket remoto
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(payload));
      } catch (e) {
        console.warn('Error enviando por WebSocket:', e);
      }
    }
  }

  public async generateRoomQR(urlToEncode: string): Promise<string> {
    try {
      return await QRCode.toDataURL(urlToEncode, {
        width: 280,
        margin: 2,
        color: {
          dark: '#020617',
          light: '#38bdf8',
        },
      });
    } catch (err) {
      console.error('Error generando QR:', err);
      return '';
    }
  }

  public isWsConnected(): boolean {
    return this.isConnectedWs;
  }
}

export const realtimeManager = new RealtimeSyncManager();
