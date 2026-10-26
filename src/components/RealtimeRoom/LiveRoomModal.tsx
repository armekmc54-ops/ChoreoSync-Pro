import React, { useState, useEffect } from 'react';
import { X, QrCode, Copy, Check, Wifi, Smartphone, Radio, ExternalLink, HelpCircle, Globe, ShieldCheck } from 'lucide-react';
import { realtimeManager } from '../../utils/realtime';

interface LiveRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  onRoomIdChange: (newRoomId: string) => void;
}

export const LiveRoomModal: React.FC<LiveRoomModalProps> = ({
  isOpen,
  onClose,
  roomId,
  onRoomIdChange,
}) => {
  const [copied, setCopied] = useState(false);
  const [customRoom, setCustomRoom] = useState(roomId);
  const [customHost, setCustomHost] = useState(() => {
    if (typeof window !== 'undefined') {
      const h = window.location.host;
      if (h.includes('localhost') || h.includes('127.0.0.1')) {
        return '192.168.1.2:5173'; // IP activa de la red Wi-Fi de esta máquina
      }
      return h;
    }
    return '192.168.1.2:5173';
  });

  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [showOfflineHelp, setShowOfflineHelp] = useState(false);

  const protocol = typeof window !== 'undefined' ? window.location.protocol : 'http:';
  const liveUrl = `${protocol}//${customHost}/?room=${encodeURIComponent(roomId)}&mode=dancer`;

  useEffect(() => {
    if (isOpen) {
      realtimeManager.generateRoomQR(liveUrl).then((url) => {
        setQrDataUrl(url);
      });
      realtimeManager.connectWebSocket();
    }
  }, [isOpen, liveUrl, roomId, customHost]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(liveUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApplyRoom = () => {
    if (customRoom.trim()) {
      onRoomIdChange(customRoom.trim().toUpperCase());
      realtimeManager.setRoomId(customRoom.trim().toUpperCase());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in select-none">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 text-slate-100 flex flex-col gap-3.5 max-h-[90vh] overflow-y-auto">
        {/* Cabecera del modal */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-violet-600/20 text-violet-400 border border-violet-500/30">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Sala en Vivo para Bailarines</h3>
              <p className="text-xs text-slate-400">Sincronización en tiempo real por Wi-Fi o Vercel</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ALERTA DE MODO ACADEMIA (OFFLINE) */}
        <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-xs text-cyan-200">
          <div className="flex items-center justify-between font-bold text-cyan-300 mb-1">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <span>Modo Academia (Sin Internet): 100% Funcional</span>
            </span>
            <button
              onClick={() => setShowOfflineHelp(!showOfflineHelp)}
              className="text-[11px] underline text-cyan-400 hover:text-cyan-200"
            >
              {showOfflineHelp ? 'Ocultar guía' : '¿Cómo conectar?'}
            </button>
          </div>
          <p className="text-[11px] text-cyan-300/80 leading-relaxed">
            ChoreoSync Pro no requiere internet para funcionar. Funciona con cualquier router Wi-Fi local o compartiendo zona Wi-Fi (Hotspot) desde un teléfono.
          </p>

          {showOfflineHelp && (
            <div className="mt-2.5 pt-2 border-t border-cyan-500/20 text-[11px] text-slate-300 space-y-1.5">
              <p><strong>1. Red Wi-Fi Local:</strong> Conecta tu laptop y los celulares al mismo router (no importa que diga "Sin acceso a internet").</p>
              <p><strong>2. Punto de acceso móvil:</strong> Puedes encender el "Hotspot" de cualquier teléfono y conectar tu laptop a él.</p>
              <p><strong>3. Vercel Cloud:</strong> En cuanto subamos el proyecto a Vercel con GitHub, tendrás un link público (ej. <code>choreosync.vercel.app</code>) para usar en cualquier academia con datos móviles.</p>
            </div>
          )}
        </div>

        {/* Input de Sala y Dirección IP */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-2 flex items-center gap-2">
            <span className="text-xs text-slate-500 font-bold uppercase pl-1">SALA:</span>
            <input
              type="text"
              value={customRoom}
              onChange={(e) => setCustomRoom(e.target.value.toUpperCase())}
              className="bg-transparent text-sm font-mono text-cyan-400 font-bold flex-1 outline-none uppercase"
            />
            <button
              onClick={handleApplyRoom}
              className="px-2 py-0.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-[11px] font-semibold"
            >
              Fijar
            </button>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-2 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-bold uppercase pl-1">HOST:</span>
              <input
                type="text"
                value={customHost}
                onChange={(e) => setCustomHost(e.target.value)}
                className="bg-transparent text-xs font-mono text-emerald-400 font-bold flex-1 outline-none"
                placeholder="IP o dominio:puerto"
                title="Dirección IP de tu laptop en la red local"
              />
            </div>
            <div className="flex items-center gap-1.5 pt-1 border-t border-slate-800/60 text-[10px]">
              <span className="text-slate-500">Atajos:</span>
              <button
                type="button"
                onClick={() => setCustomHost('192.168.1.2:5173')}
                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 font-mono transition"
                title="Usar IP de la red Wi-Fi actual"
              >
                192.168.1.2:5173 (Wi-Fi)
              </button>
              <button
                type="button"
                onClick={() => setCustomHost('localhost:5173')}
                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 font-mono transition"
                title="Usar localhost para pruebas en esta laptop"
              >
                localhost
              </button>
            </div>
          </div>
        </div>

        {/* CÓDIGO QR GENERADO */}
        <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-950 border border-slate-800 gap-2">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="QR Sala en Vivo"
              className="w-48 h-48 rounded-lg border-2 border-cyan-500/50 shadow-lg shadow-cyan-500/20"
            />
          ) : (
            <div className="w-48 h-48 flex items-center justify-center text-slate-600">
              Generando QR...
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
            <Smartphone className="w-4 h-4 text-cyan-400" />
            <span>Escanea con la cámara del celular para ingresar</span>
          </div>
        </div>

        {/* Enlace copiable */}
        <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800">
          <input
            type="text"
            readOnly
            value={liveUrl}
            className="bg-transparent text-xs text-slate-300 flex-1 outline-none font-mono truncate"
          />
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-white font-medium transition"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copiado</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar</span>
              </>
            )}
          </button>
        </div>

        {/* Abrir en nueva pestaña */}
        <div className="flex justify-between items-center text-xs text-slate-400 pt-1">
          <a
            href={liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-medium underline"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Abrir simulador en otra pestaña (Mismo equipo)</span>
          </a>
          <span className="text-emerald-400 font-medium flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            Sincronización activa
          </span>
        </div>
      </div>
    </div>
  );
};
