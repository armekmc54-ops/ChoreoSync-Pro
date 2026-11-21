import QRCode from 'qrcode';
import { RealtimeSyncPayload } from '../types/choreo';

export type RealtimeListener = (payload: RealtimeSyncPayload) => void;
export type DirectorStatus = 'idle' | 'connecting' | 'authorized' | 'invalid' | 'occupied';
export type ConnectionListener = (isConnected: boolean) => void;

class RealtimeSyncManager {
  private broadcastChannel: BroadcastChannel | null = null;
  private ws: WebSocket | null = null;
  private listeners: Set<RealtimeListener> = new Set();
  private connectionListeners: Set<ConnectionListener> = new Set();
  public roomId: string = 'SALA-CHOREO-1';
  public senderId: string = 'client_' + Math.random().toString(36).slice(2, 8);
  private directorKey = '';
  private directorStatus: DirectorStatus = 'idle';
  private directorListeners = new Set<(status: DirectorStatus) => void>();
  private isConnectedWs = false;
  private reconnectTimer: any = null;
  private pendingQueue: RealtimeSyncPayload[] = [];
  private currentUrlIdx = 0;
  private candidateUrls: string[] = [];

  constructor() {
    this.initBroadcastChannel();
    this.initCandidateUrls();
  }

  private initCandidateUrls() {
    if (typeof window !== 'undefined') {
      const isHttps = window.location.protocol === 'https:';
      const wsProtocol = isHttps ? 'wss:' : 'ws:';
      const host = window.location.host; // e.g. 192.168.1.2:5173 o localhost:5173
      const hostname = window.location.hostname || 'localhost';

      this.candidateUrls = [
        `${wsProtocol}//${host}/ws`,            // 1. Integrado en Vite/Express (mismo puerto 5173)
        ...(!isHttps ? [`ws://${hostname}:8080`] : []),
      ];
    } else {
      this.candidateUrls = ['ws://localhost:5173/ws', 'ws://localhost:8080'];
    }
  }

  private initBroadcastChannel() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('choreosync_live_channel');
        this.broadcastChannel.onmessage = (event) => {
          if (!this.isProtectedRoom() && event.data && event.data.roomId === this.roomId && event.data.senderId !== this.senderId) {
            this.notifyListeners(event.data);
          }
        };
      } catch (e) {
        console.warn('BroadcastChannel no disponible en este entorno:', e);
      }
    }
  }

  public connectWebSocket(wsUrl?: string) {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    const targetUrl = wsUrl || this.candidateUrls[this.currentUrlIdx % this.candidateUrls.length];

    try {
      this.ws = new WebSocket(targetUrl);

      this.ws.onopen = () => {
        this.isConnectedWs = true;
        this.notifyConnectionListeners(true);
        console.log(`[ChoreoSync Live] Conectado exitosamente a: ${targetUrl}`);

        // 1. Enviar entrada a la sala
        const joinPayload: RealtimeSyncPayload = {
          type: 'JOIN_ROOM',
          roomId: this.roomId,
          senderId: this.senderId,
          timestamp: Date.now(),
          currentTimeMs: 0,
          isPlaying: false,
          playbackRate: 1,
        };
        try {
          this.ws?.send(JSON.stringify(joinPayload));
        } catch {}

        this.authenticateDirector();

        // 2. Solicitar sincronización inmediata del estado actual
        const reqPayload: RealtimeSyncPayload = {
          type: 'REQUEST_SYNC',
          roomId: this.roomId,
          senderId: this.senderId,
          timestamp: Date.now(),
          currentTimeMs: 0,
          isPlaying: false,
          playbackRate: 1,
        };
        try {
          this.ws?.send(JSON.stringify(reqPayload));
        } catch {}

        // 3. Vaciar cola de mensajes pendientes
        if (this.pendingQueue.length > 0) {
          const queue = [...this.pendingQueue];
          this.pendingQueue = [];
          for (const item of queue) {
            this.broadcast(item);
          }
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'DIRECTOR_STATUS') {
            if (payload.roomId === this.roomId &&
                ['authorized', 'invalid', 'occupied'].includes(payload.status)) {
              if (payload.status !== 'authorized') this.directorKey = '';
              this.setDirectorStatus(payload.status);
            }
            return;
          }
          if (payload.roomId === this.roomId && payload.senderId !== this.senderId) {
            this.notifyListeners(payload);
          }
        } catch {
          // Mensaje no válido
        }
      };

      this.ws.onerror = () => {
        this.isConnectedWs = false;
        this.notifyConnectionListeners(false);
      };

      this.ws.onclose = () => {
        if (this.directorKey) this.setDirectorStatus('connecting');
        this.isConnectedWs = false;
        this.notifyConnectionListeners(false);

        // Rotar URL candidata para el siguiente intento si hay fallo
        this.currentUrlIdx++;
        this.scheduleReconnect();
      };
    } catch (e) {
      console.warn(`[ChoreoSync Live] Error intentando conectar a ${targetUrl}:`, e);
      this.currentUrlIdx++;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connectWebSocket();
    }, 1500);
  }

  public setRoomId(roomId: string) {
    const nextRoom = roomId.trim().toUpperCase();
    if (nextRoom === this.roomId) return;
    this.roomId = nextRoom;
    this.pendingQueue = [];
    if (this.directorKey) this.setDirectorStatus('connecting');
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.broadcast({
        type: 'JOIN_ROOM',
        roomId: this.roomId,
        senderId: this.senderId,
        timestamp: Date.now(),
        currentTimeMs: 0,
        isPlaying: false,
        playbackRate: 1,
      });
      this.authenticateDirector();
      this.broadcast({
        type: 'REQUEST_SYNC',
        roomId: this.roomId,
        senderId: this.senderId,
        timestamp: Date.now(),
        currentTimeMs: 0,
        isPlaying: false,
        playbackRate: 1,
      });
    }
  }

  public isProtectedRoom() {
    return /^PILOT-[A-F0-9]{32}$/.test(this.roomId);
  }

  public claimDirector(key: string) {
    this.directorKey = key;
    this.setDirectorStatus('connecting');
    this.connectWebSocket();
    this.authenticateDirector();
  }

  private authenticateDirector() {
    if (this.isProtectedRoom() && this.directorKey && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'DIRECTOR_AUTH', roomId: this.roomId, key: this.directorKey }));
    }
  }

  public onDirectorStatus(listener: (status: DirectorStatus) => void) {
    this.directorListeners.add(listener);
    listener(this.directorStatus);
    return () => { this.directorListeners.delete(listener); };
  }

  private setDirectorStatus(status: DirectorStatus) {
    this.directorStatus = status;
    this.directorListeners.forEach((listener) => listener(status));
  }

  public subscribe(listener: RealtimeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public onConnectionState(listener: ConnectionListener): () => void {
    this.connectionListeners.add(listener);
    listener(this.isConnectedWs);
    return () => {
      this.connectionListeners.delete(listener);
    };
  }

  private notifyConnectionListeners(connected: boolean) {
    this.connectionListeners.forEach((l) => {
      try {
        l(connected);
      } catch {}
    });
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
    if (this.isProtectedRoom() && this.directorStatus !== 'authorized' &&
        payload.type !== 'JOIN_ROOM' && payload.type !== 'REQUEST_SYNC') return;
    payload.senderId = this.senderId;
    payload.roomId = this.roomId;
    payload.timestamp = Date.now();

    // 1. BroadcastChannel en la misma máquina
    if (!this.isProtectedRoom() && this.broadcastChannel) {
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
    } else {
      // Guardar en cola si el socket aún se está conectando
      // Si ya hay un FULL_STATE en cola, reemplazarlo con el más reciente
      if (payload.type === 'FULL_STATE') {
        this.pendingQueue = this.pendingQueue.filter((p) => p.type !== 'FULL_STATE');
      }
      this.pendingQueue = [...this.pendingQueue.slice(-7), payload];
      // Asegurarse de que el socket intente conectarse
      this.connectWebSocket();
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
    return this.isConnectedWs || (this.ws?.readyState === WebSocket.OPEN);
  }
}

export const realtimeManager = new RealtimeSyncManager();
