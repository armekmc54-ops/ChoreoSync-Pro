import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Formation, Beat } from '../../types/choreo';
import { clamp } from '../../utils/interpolation';
import { ZoomIn, ZoomOut, Maximize2, MoveHorizontal } from 'lucide-react';

interface TimelineProps {
  durationMs: number;
  currentTimeMs: number;
  beats: Beat[];
  formations: Formation[];
  peaks: number[];
  selectedFormationId: string;
  collisionTimes: number[];
  onSeek: (timeMs: number) => void;
  onSelectFormation: (formationId: string) => void;
  onUpdateFormationTiming: (
    formationId: string,
    startTimeMs: number,
    holdDurationMs: number,
    transitionDurationMs: number
  ) => void;
  onUpdateBeatTimestamp: (beatId: string, timestampMs: number) => void;
  onAddFormationAtTime: (timeMs: number) => void;
}

export const Timeline: React.FC<TimelineProps> = ({
  durationMs,
  currentTimeMs,
  beats,
  formations,
  peaks,
  selectedFormationId,
  collisionTimes,
  onSeek,
  onSelectFormation,
  onUpdateFormationTiming,
  onUpdateBeatTimestamp,
  onAddFormationAtTime,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Estados de Zoom Horizontal y Scroll de Timeline (Estilo Adobe Audition)
  const [zoom, setZoom] = useState<number>(1.0); // 1.0x hasta 16.0x
  const [scrollLeftMs, setScrollLeftMs] = useState<number>(0);

  const dragRef = useRef<{
    type: 'scrub' | 'beat' | 'hold_handle' | 'trans_handle' | 'form_move' | 'minimap_scroll' | 'timeline_pan';
    targetId?: string;
    initialMs?: number;
    offsetMs?: number;
    pointerId: number;
    startX?: number;
    initialScrollMs?: number;
    hasMoved?: boolean;
  } | null>(null);

  const visibleDurationMs = Math.max(500, durationMs / zoom);

  // Auto-scroll durante reproducción si la aguja sale de la vista
  useEffect(() => {
    if (zoom > 1) {
      if (currentTimeMs < scrollLeftMs) {
        setScrollLeftMs(Math.max(0, currentTimeMs - 500));
      } else if (currentTimeMs > scrollLeftMs + visibleDurationMs) {
        setScrollLeftMs(Math.min(durationMs - visibleDurationMs, currentTimeMs - visibleDurationMs * 0.2));
      }
    }
  }, [currentTimeMs, zoom, visibleDurationMs, durationMs, scrollLeftMs]);

  // Conversión precisa entre milisegundos y coordenadas X de pantalla
  const timeToX = useCallback(
    (t: number, width: number) => {
      return ((t - scrollLeftMs) / visibleDurationMs) * width;
    },
    [scrollLeftMs, visibleDurationMs]
  );

  const xToTime = useCallback(
    (x: number, width: number) => {
      const t = scrollLeftMs + (x / width) * visibleDurationMs;
      return clamp(t, 0, durationMs);
    },
    [scrollLeftMs, visibleDurationMs, durationMs]
  );

  const handleZoomChange = (factor: number) => {
    setZoom((prev) => {
      const nextZoom = clamp(Math.round(prev * factor * 10) / 10, 1.0, 16.0);
      if (nextZoom === 1.0) {
        setScrollLeftMs(0);
      } else {
        // Centrar zoom alrededor del tiempo actual
        const newVisible = durationMs / nextZoom;
        const newScroll = clamp(currentTimeMs - newVisible / 2, 0, durationMs - newVisible);
        setScrollLeftMs(newScroll);
      }
      return nextZoom;
    });
  };

  const handleResetZoom = () => {
    setZoom(1.0);
    setScrollLeftMs(0);
  };

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const clientW = canvas.clientWidth;
    const clientH = canvas.clientHeight;

    if (canvas.width !== clientW * dpr || canvas.height !== clientH * dpr) {
      canvas.width = clientW * dpr;
      canvas.height = clientH * dpr;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, clientW, clientH);

    // Fondo del timeline
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, clientW, clientH);

    // 0. MINI-MAPA DE NAVEGACIÓN SUPERIOR (Estilo DAW / Audition)
    const minimapH = zoom > 1.05 ? 14 : 0;
    if (minimapH > 0) {
      ctx.fillStyle = '#0b1220';
      ctx.fillRect(0, 0, clientW, minimapH);

      // Mini-picos de onda en el minimapa
      if (peaks.length > 0) {
        ctx.fillStyle = 'rgba(34, 211, 238, 0.4)';
        for (let mx = 0; mx < clientW; mx += 3) {
          const idx = Math.floor((mx / clientW) * peaks.length);
          const amp = peaks[idx] || 0;
          const bh = amp * (minimapH - 4);
          ctx.fillRect(mx, (minimapH - bh) / 2, 2, Math.max(1, bh));
        }
      }

      // Ventana visible en el minimapa
      const winX = (scrollLeftMs / durationMs) * clientW;
      const winW = (visibleDurationMs / durationMs) * clientW;
      ctx.fillStyle = 'rgba(139, 92, 246, 0.25)';
      ctx.fillRect(winX, 0, winW, minimapH);
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(winX, 0.5, winW, minimapH - 1);
    }

    // 1. REGLA DE TIEMPO (SEGUNDOS CON INTERVALO DINÁMICO)
    const rulerY = minimapH;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, rulerY, clientW, 20);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;

    // Calcular paso de marcas según nivel de zoom
    let stepSec = 5;
    if (zoom >= 8) stepSec = 0.5;
    else if (zoom >= 4) stepSec = 1;
    else if (zoom >= 2) stepSec = 2;

    const startSec = Math.floor(scrollLeftMs / 1000);
    const endSec = Math.ceil((scrollLeftMs + visibleDurationMs) / 1000);

    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748b';

    for (let s = startSec; s <= endSec; s += stepSec) {
      const x = timeToX(s * 1000, clientW);
      if (x < -20 || x > clientW + 20) continue;

      const isMajor = s % (stepSec * 2) === 0 || s === 0;
      ctx.beginPath();
      ctx.moveTo(x, rulerY + (isMajor ? 4 : 10));
      ctx.lineTo(x, rulerY + 20);
      ctx.stroke();

      if (x >= 0 && x < clientW - 35) {
        ctx.fillText(`${s.toFixed(stepSec < 1 ? 1 : 0)}s`, x + 3, rulerY + 14);
      }
    }

    // 2. PISTA 1: ONDA DE AUDIO (Y: rulerY + 22 a rulerY + 72)
    const audioTrackY = rulerY + 47;
    const audioHeight = 24;

    ctx.fillStyle = 'rgba(30, 41, 59, 0.4)';
    ctx.fillRect(0, rulerY + 22, clientW, 50);

    ctx.fillStyle = '#475569';
    ctx.font = '9px system-ui';
    ctx.fillText('AUDIO', 4, rulerY + 32);

    if (peaks.length > 0) {
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.85)';
      ctx.lineWidth = 1.2;

      for (let x = 0; x < clientW; x += 2) {
        const timeAtX = xToTime(x, clientW);
        const peakIdx = Math.floor((timeAtX / durationMs) * peaks.length);
        const amp = peaks[Math.min(peaks.length - 1, Math.max(0, peakIdx))] || 0;
        const barH = Math.max(1, amp * audioHeight);

        ctx.beginPath();
        ctx.moveTo(x + 0.5, audioTrackY - barH);
        ctx.lineTo(x + 0.5, audioTrackY + barH);
        ctx.stroke();
      }
    } else {
      ctx.strokeStyle = '#334155';
      ctx.beginPath();
      ctx.moveTo(0, audioTrackY);
      ctx.lineTo(clientW, audioTrackY);
      ctx.stroke();
    }

    // 3. PISTA 2: CONTEOS DE 8 TIEMPOS (Y: rulerY + 74 a rulerY + 112)
    const beatsY = rulerY + 74;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
    ctx.fillRect(0, beatsY, clientW, 38);

    ctx.fillStyle = '#64748b';
    ctx.font = '9px system-ui';
    ctx.fillText('CONTEOS 1-8', 4, beatsY + 10);

    beats.forEach((b) => {
      const bx = timeToX(b.timestampMs, clientW);
      if (bx < -20 || bx > clientW + 20) return;

      const isOne = b.countNumber === 1;

      ctx.strokeStyle = isOne ? '#a855f7' : '#38bdf8';
      ctx.lineWidth = isOne ? 2.5 : 1.2;
      ctx.beginPath();
      ctx.moveTo(bx, isOne ? beatsY + 2 : beatsY + 10);
      ctx.lineTo(bx, beatsY + 36);
      ctx.stroke();

      ctx.font = isOne ? 'bold 10px monospace' : '9px monospace';
      ctx.fillStyle = isOne ? '#c084fc' : '#7dd3fc';
      ctx.textAlign = 'center';
      const label = isOne ? `O${b.phraseIndex}·1` : String(b.countNumber);
      ctx.fillText(label, bx + (isOne ? 10 : 0), isOne ? beatsY + 12 : beatsY + 24);
    });

    // 4. PISTA 3: BLOQUES DE FORMACIONES (Y: rulerY + 114 a rulerY + 160)
    const formY = rulerY + 114;
    ctx.fillStyle = 'rgba(2, 6, 23, 0.8)';
    ctx.fillRect(0, formY, clientW, 46);

    ctx.fillStyle = '#64748b';
    ctx.font = '9px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText('FORMACIONES', 4, formY + 10);

    formations.forEach((f) => {
      const isSelected = f.id === selectedFormationId;
      const xStart = timeToX(f.startTimeMs, clientW);
      const xHoldEnd = timeToX(f.startTimeMs + f.holdDurationMs, clientW);
      const xTransEnd = timeToX(
        f.startTimeMs + f.holdDurationMs + f.transitionDurationMs,
        clientW
      );

      if (xTransEnd < 0 || xStart > clientW) return;

      // Bloque HOLD (Púrpura)
      const holdW = Math.max(2, xHoldEnd - xStart);
      ctx.fillStyle = isSelected ? '#7c3aed' : '#5b21b6';
      ctx.fillRect(xStart, formY + 4, holdW, 40);

      // Bloque TRANSICIÓN (Cian con patrón)
      if (f.transitionDurationMs > 0) {
        const transW = Math.max(2, xTransEnd - xHoldEnd);
        ctx.fillStyle = isSelected ? '#0891b2' : '#0e7490';
        ctx.fillRect(xHoldEnd, formY + 8, transW, 32);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        for (let diagX = xHoldEnd; diagX < xTransEnd; diagX += 8) {
          ctx.beginPath();
          ctx.moveTo(diagX, formY + 40);
          ctx.lineTo(diagX + 6, formY + 8);
          ctx.stroke();
        }

        // Handle Transición
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(xTransEnd - 2, formY + 10, 4, 28);
      }

      // Handle Hold
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(xHoldEnd - 2, formY + 6, 4, 36);

      // Borde de selección
      if (isSelected) {
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(xStart, formY + 4, Math.max(4, xTransEnd - xStart), 40);
      }

      // Título de la formación
      ctx.font = 'bold 11px system-ui';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.fillText(f.name, xStart + 6, formY + 22);

      ctx.font = '9px system-ui';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fillText(`${f.holdDurationMs}ms H | ${f.transitionDurationMs}ms T`, xStart + 6, formY + 36);
    });

    // 5. ALERTAS DE COLISIÓN (PUNTOS ROJOS)
    if (collisionTimes.length > 0) {
      ctx.fillStyle = '#ef4444';
      collisionTimes.forEach((t) => {
        const cx = timeToX(t, clientW);
        if (cx >= 0 && cx <= clientW) {
          ctx.fillRect(cx - 1, formY, 2.5, 6);
        }
      });
    }

    // 6. AGUJA DE REPRODUCCIÓN (PLAYHEAD)
    const playheadX = timeToX(currentTimeMs, clientW);
    if (playheadX >= -5 && playheadX <= clientW + 5) {
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, rulerY);
      ctx.lineTo(playheadX, clientH);
      ctx.stroke();

      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.moveTo(playheadX - 6, rulerY);
      ctx.lineTo(playheadX + 6, rulerY);
      ctx.lineTo(playheadX, rulerY + 8);
      ctx.closePath();
      ctx.fill();
    }
  }, [
    durationMs,
    currentTimeMs,
    beats,
    formations,
    peaks,
    selectedFormationId,
    collisionTimes,
    timeToX,
    xToTime,
    scrollLeftMs,
    visibleDurationMs,
    zoom,
  ]);

  useEffect(() => {
    let animId: number;
    const loop = () => {
      render();
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [render]);

  // ZOOM CON RUEDA DEL RATÓN (Ctrl + Wheel o Alt + Wheel) O SCROLL HORIZONTAL (Shift + Wheel o Wheel normal si zoomed)
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (e.ctrlKey || e.altKey) {
      // Zoom centrado en la posición del ratón
      const factor = e.deltaY < 0 ? 1.2 : 0.83;
      handleZoomChange(factor);
    } else {
      // Paneo horizontal suave
      const deltaMs = (e.deltaY / canvas.clientWidth) * visibleDurationMs * 0.8;
      setScrollLeftMs((prev) => clamp(prev + deltaMs, 0, Math.max(0, durationMs - visibleDurationMs)));
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const w = canvas.clientWidth;

    canvas.setPointerCapture(e.pointerId);

    // Clic en el Mini-mapa superior
    const minimapH = zoom > 1.05 ? 14 : 0;
    if (minimapH > 0 && y <= minimapH) {
      const clickRatio = x / w;
      const targetTime = clickRatio * durationMs;
      setScrollLeftMs(clamp(targetTime - visibleDurationMs / 2, 0, durationMs - visibleDurationMs));
      dragRef.current = {
        type: 'minimap_scroll',
        pointerId: e.pointerId,
      };
      return;
    }

    // Paneo con botón central o secundario o Alt
    if (e.button === 1 || e.button === 2 || e.altKey) {
      dragRef.current = {
        type: 'timeline_pan',
        pointerId: e.pointerId,
        startX: e.clientX,
        initialScrollMs: scrollLeftMs,
      };
      return;
    }

    const clickedTime = xToTime(x, w);
    const rulerY = minimapH;

    // Detección en Pista de Conteos
    if (y >= rulerY + 74 && y <= rulerY + 112) {
      const hitBeat = beats.find((b) => Math.abs(timeToX(b.timestampMs, w) - x) < 8);
      if (hitBeat) {
        dragRef.current = {
          type: 'beat',
          targetId: hitBeat.id,
          pointerId: e.pointerId,
          hasMoved: false,
        };
        return;
      }
    }

    // Detección en Pista de Formaciones
    if (y >= rulerY + 114) {
      for (const f of formations) {
        const xStart = timeToX(f.startTimeMs, w);
        const xHoldEnd = timeToX(f.startTimeMs + f.holdDurationMs, w);
        const xTransEnd = timeToX(
          f.startTimeMs + f.holdDurationMs + f.transitionDurationMs,
          w
        );

        if (f.transitionDurationMs > 0 && Math.abs(x - xTransEnd) < 8) {
          dragRef.current = {
            type: 'trans_handle',
            targetId: f.id,
            pointerId: e.pointerId,
          };
          return;
        }

        if (Math.abs(x - xHoldEnd) < 8) {
          dragRef.current = {
            type: 'hold_handle',
            targetId: f.id,
            pointerId: e.pointerId,
          };
          return;
        }

        if (x >= xStart && x <= xTransEnd) {
          onSelectFormation(f.id);
          onSeek(f.startTimeMs);
          dragRef.current = {
            type: 'form_move',
            targetId: f.id,
            offsetMs: clickedTime - f.startTimeMs,
            pointerId: e.pointerId,
          };
          return;
        }
      }
    }

    // Scrubbing regular
    dragRef.current = {
      type: 'scrub',
      pointerId: e.pointerId,
    };
    onSeek(clickedTime);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const w = canvas.clientWidth;

    if (dragRef.current.type === 'minimap_scroll') {
      const clickRatio = x / w;
      const targetTime = clickRatio * durationMs;
      setScrollLeftMs(clamp(targetTime - visibleDurationMs / 2, 0, durationMs - visibleDurationMs));
      return;
    }

    if (dragRef.current.type === 'timeline_pan' && dragRef.current.startX !== undefined && dragRef.current.initialScrollMs !== undefined) {
      const dx = e.clientX - dragRef.current.startX;
      const deltaMs = (dx / w) * visibleDurationMs;
      setScrollLeftMs(clamp(dragRef.current.initialScrollMs - deltaMs, 0, durationMs - visibleDurationMs));
      return;
    }

    const currentTime = xToTime(x, w);

    if (dragRef.current.type === 'scrub') {
      onSeek(currentTime);
    } else if (dragRef.current.type === 'beat' && dragRef.current.targetId) {
      dragRef.current.hasMoved = true;
      onUpdateBeatTimestamp(dragRef.current.targetId, Math.round(currentTime));
    } else if (dragRef.current.targetId) {
      const f = formations.find((item) => item.id === dragRef.current?.targetId);
      if (!f) return;

      if (dragRef.current.type === 'hold_handle') {
        const newHold = Math.max(200, Math.round(currentTime - f.startTimeMs));
        onUpdateFormationTiming(f.id, f.startTimeMs, newHold, f.transitionDurationMs);
      } else if (dragRef.current.type === 'trans_handle') {
        const newTrans = Math.max(
          0,
          Math.round(currentTime - (f.startTimeMs + f.holdDurationMs))
        );
        onUpdateFormationTiming(f.id, f.startTimeMs, f.holdDurationMs, newTrans);
      } else if (dragRef.current.type === 'form_move' && dragRef.current.offsetMs !== undefined) {
        const newStart = Math.max(
          0,
          Math.round(currentTime - dragRef.current.offsetMs)
        );
        onUpdateFormationTiming(f.id, newStart, f.holdDurationMs, f.transitionDurationMs);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current) {
      const canvas = canvasRef.current;
      if (canvas && canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
      if (dragRef.current.type === 'beat' && !dragRef.current.hasMoved && dragRef.current.targetId) {
        const b = beats.find((item) => item.id === dragRef.current?.targetId);
        if (b) onSeek(b.timestampMs);
      }
      dragRef.current = null;
    }
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const w = canvas.clientWidth;

    const clickedTime = xToTime(x, w);
    const snapBeat = beats.find((b) => Math.abs(timeToX(b.timestampMs, w) - x) < 12);
    const finalTime = snapBeat ? snapBeat.timestampMs : Math.round(clickedTime);
    onSeek(finalTime);
    onAddFormationAtTime(finalTime);
  };

  return (
    <div className="relative w-full bg-slate-900 border-t border-slate-800 select-none">
      {/* BARRA DE ZOOM FLOTANTE DEL TIMELINE (ESTILO ADOBE AUDITION) */}
      <div className="absolute top-2 right-3 z-20 flex items-center gap-1.5 p-1 rounded-lg bg-slate-950/80 backdrop-blur-md border border-slate-800 shadow-md text-xs">
        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider pl-1 hidden sm:inline">
          Zoom Pista
        </span>
        <button
          onClick={() => handleZoomChange(0.7)}
          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
          title="Alejar Zoom de Audio (-)"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleResetZoom}
          className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-cyan-400 font-bold hover:bg-slate-800 transition"
          title="Restablecer Zoom a 1x (Mostrar toda la canción)"
        >
          {zoom.toFixed(1)}x
        </button>

        <button
          onClick={() => handleZoomChange(1.4)}
          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
          title="Acercar Zoom de Audio (+)"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleResetZoom}
          className="p-1 rounded text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition"
          title="Ajustar a 100%"
        >
          <Maximize2 className="w-3 h-3" />
        </button>
      </div>

      <canvas
        ref={canvasRef}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
        className="w-full block cursor-ew-resize touch-none"
        style={{ height: zoom > 1.05 ? '180px' : '168px' }}
      />
    </div>
  );
};
