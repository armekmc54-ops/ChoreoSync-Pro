import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Formation, Beat } from '../../types/choreo';
import { clamp } from '../../utils/interpolation';
import { ZoomIn, ZoomOut, Maximize2, Trash2, ArrowRight } from 'lucide-react';

interface TimelineProps {
  durationMs: number;
  currentTimeMs: number;
  beats: Beat[];
  formations: Formation[];
  peaks: number[];
  selectedFormationId: string;
  selectedFormationIds?: string[];
  collisionTimes: number[];
  onSeek: (timeMs: number) => void;
  onSelectFormation: (formationId: string, isMulti?: boolean) => void;
  onSelectMultipleFormations?: (formationIds: string[]) => void;
  onDeleteFormations?: (formationIds: string[]) => void;
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
  selectedFormationIds = [],
  collisionTimes,
  onSeek,
  onSelectFormation,
  onSelectMultipleFormations,
  onDeleteFormations,
  onUpdateFormationTiming,
  onUpdateBeatTimestamp,
  onAddFormationAtTime,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Zoom Horizontal y Paneo de Timeline
  const [zoom, setZoom] = useState<number>(1.0); // 1.0x hasta 16.0x
  const [scrollLeftMs, setScrollLeftMs] = useState<number>(0);

  // Caja de selección múltiple (Marquee)
  const [selectionBox, setSelectionBox] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  const dragRef = useRef<{
    type: 'scrub' | 'beat' | 'hold_handle' | 'trans_handle' | 'form_move' | 'minimap_scroll' | 'timeline_pan' | 'box_select';
    targetId?: string;
    targetIds?: string[];
    initialMs?: number;
    offsetMs?: number;
    offsets?: Record<string, number>;
    pointerId: number;
    startX?: number;
    startY?: number;
    initialScrollMs?: number;
    hasMoved?: boolean;
  } | null>(null);

  const visibleDurationMs = Math.max(500, durationMs / zoom);

  // Auto-scroll durante reproducción
  useEffect(() => {
    if (zoom > 1) {
      if (currentTimeMs < scrollLeftMs) {
        setScrollLeftMs(Math.max(0, currentTimeMs - 500));
      } else if (currentTimeMs > scrollLeftMs + visibleDurationMs) {
        setScrollLeftMs(Math.min(durationMs - visibleDurationMs, currentTimeMs - visibleDurationMs * 0.2));
      }
    }
  }, [currentTimeMs, zoom, visibleDurationMs, durationMs, scrollLeftMs]);

  // Conversión entre tiempo y posición X
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

  // PREVENCIÓN ESTRICTA DE ZOOM EN LA PESTAÑA DEL NAVEGADOR EN LAPTOPS
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const vis = Math.max(500, durationMs / zoom);

      if (e.ctrlKey || e.altKey) {
        // Zoom centrado en cursor
        const factor = e.deltaY < 0 ? 1.25 : 0.8;
        setZoom((prev) => {
          const next = clamp(Math.round(prev * factor * 10) / 10, 1.0, 16.0);
          if (next === 1.0) {
            setScrollLeftMs(0);
          } else {
            const newVis = durationMs / next;
            const mouseRatio = (e.clientX - canvas.getBoundingClientRect().left) / canvas.clientWidth;
            const mouseTime = scrollLeftMs + mouseRatio * vis;
            setScrollLeftMs(clamp(mouseTime - mouseRatio * newVis, 0, durationMs - newVis));
          }
          return next;
        });
      } else {
        // Desplazamiento horizontal
        const deltaMs = (e.deltaY / canvas.clientWidth) * vis * 0.85;
        setScrollLeftMs((prev) => clamp(prev + deltaMs, 0, Math.max(0, durationMs - vis)));
      }
    };

    canvas.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleNativeWheel);
  }, [zoom, scrollLeftMs, durationMs]);

  // TECLADO: ELIMINAR CON SUPR O BACKSPACE
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const toDelete = selectedFormationIds.length > 0 
          ? selectedFormationIds 
          : (selectedFormationId ? [selectedFormationId] : []);

        if (toDelete.length > 0 && onDeleteFormations) {
          e.preventDefault();
          onDeleteFormations(toDelete);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFormationId, selectedFormationIds, onDeleteFormations]);

  const handleZoomChange = (factor: number) => {
    setZoom((prev) => {
      const nextZoom = clamp(Math.round(prev * factor * 10) / 10, 1.0, 16.0);
      if (nextZoom === 1.0) {
        setScrollLeftMs(0);
      } else {
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

    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, clientW, clientH);

    // 0. MINIMAPA SUPERIOR
    const minimapH = zoom > 1.05 ? 13 : 0;
    if (minimapH > 0) {
      ctx.fillStyle = '#0b1220';
      ctx.fillRect(0, 0, clientW, minimapH);

      if (peaks.length > 0) {
        ctx.fillStyle = 'rgba(34, 211, 238, 0.4)';
        for (let mx = 0; mx < clientW; mx += 3) {
          const idx = Math.floor((mx / clientW) * peaks.length);
          const amp = peaks[idx] || 0;
          const bh = amp * (minimapH - 3);
          ctx.fillRect(mx, (minimapH - bh) / 2, 2, Math.max(1, bh));
        }
      }

      const winX = (scrollLeftMs / durationMs) * clientW;
      const winW = (visibleDurationMs / durationMs) * clientW;
      ctx.fillStyle = 'rgba(139, 92, 246, 0.28)';
      ctx.fillRect(winX, 0, winW, minimapH);
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(winX, 0.5, winW, minimapH - 1);
    }

    // 1. REGLA DE TIEMPO
    const rulerY = minimapH;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, rulerY, clientW, 18);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;

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
      ctx.moveTo(x, rulerY + (isMajor ? 4 : 9));
      ctx.lineTo(x, rulerY + 18);
      ctx.stroke();

      if (x >= 0 && x < clientW - 35) {
        ctx.fillText(`${s.toFixed(stepSec < 1 ? 1 : 0)}s`, x + 3, rulerY + 12);
      }
    }

    // 2. PISTA 1: ONDA DE AUDIO (Y: rulerY + 20 a rulerY + 66)
    const audioTrackY = rulerY + 43;
    const audioHeight = 21;

    ctx.fillStyle = 'rgba(30, 41, 59, 0.4)';
    ctx.fillRect(0, rulerY + 20, clientW, 46);

    ctx.fillStyle = '#475569';
    ctx.font = '9px system-ui';
    ctx.fillText('AUDIO', 4, rulerY + 30);

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

    // 3. PISTA 2: CONTEOS 1 AL 8 (Y: rulerY + 68 a rulerY + 104)
    const beatsY = rulerY + 68;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
    ctx.fillRect(0, beatsY, clientW, 36);

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
      ctx.lineTo(bx, beatsY + 34);
      ctx.stroke();

      ctx.font = isOne ? 'bold 10px monospace' : '9px monospace';
      ctx.fillStyle = isOne ? '#c084fc' : '#7dd3fc';
      ctx.textAlign = 'center';
      const label = isOne ? `O${b.phraseIndex}·1` : String(b.countNumber);
      ctx.fillText(label, bx + (isOne ? 10 : 0), isOne ? beatsY + 12 : beatsY + 23);
    });

    // 4. PISTA 3: FORMACIONES (HOLD - POSES FIJAS) (Y: rulerY + 106 a rulerY + 144)
    const formTrackY = rulerY + 106;
    ctx.fillStyle = 'rgba(2, 6, 23, 0.9)';
    ctx.fillRect(0, formTrackY, clientW, 38);

    ctx.fillStyle = '#a78bfa';
    ctx.font = 'bold 9px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText('FORMACIONES (HOLD)', 4, formTrackY + 11);

    const isSelectedF = (id: string) => id === selectedFormationId || selectedFormationIds.includes(id);

    formations.forEach((f) => {
      const isSel = isSelectedF(f.id);
      const xStart = timeToX(f.startTimeMs, clientW);
      const xHoldEnd = timeToX(f.startTimeMs + f.holdDurationMs, clientW);

      if (xHoldEnd < 0 || xStart > clientW) return;

      const holdW = Math.max(3, xHoldEnd - xStart);

      // Bloque HOLD sólido
      ctx.fillStyle = isSel ? '#7c3aed' : '#5b21b6';
      ctx.fillRect(xStart, formTrackY + 4, holdW, 30);

      // Borde de selección
      if (isSel) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(xStart, formTrackY + 4, holdW, 30);
      } else {
        ctx.strokeStyle = '#8b5cf6';
        ctx.lineWidth = 1;
        ctx.strokeRect(xStart, formTrackY + 4, holdW, 30);
      }

      // Handle Hold (ajuste de duración fija)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(xHoldEnd - 3, formTrackY + 6, 4, 26);

      // Etiqueta del nombre de la formación
      ctx.font = 'bold 11px system-ui';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(f.name, xStart + 6, formTrackY + 18);

      ctx.font = '9px system-ui';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.fillText(`${f.holdDurationMs}ms Hold`, xStart + 6, formTrackY + 29);
    });

    // 5. PISTA 4: TRANSICIONES SEPARADAS (TRASLACIÓN / TRAVEL) (Y: rulerY + 146 a rulerY + 180)
    const transTrackY = rulerY + 146;
    ctx.fillStyle = 'rgba(8, 20, 36, 0.75)';
    ctx.fillRect(0, transTrackY, clientW, 34);

    ctx.fillStyle = '#22d3ee';
    ctx.font = 'bold 9px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText('TRANSICIONES (TRASLACIÓN)', 4, transTrackY + 10);

    formations.forEach((f, idx) => {
      if (f.transitionDurationMs <= 0) return;

      const nextF = formations[idx + 1];
      const transStartMs = f.startTimeMs + f.holdDurationMs;
      const transEndMs = transStartMs + f.transitionDurationMs;

      const xTransStart = timeToX(transStartMs, clientW);
      const xTransEnd = timeToX(transEndMs, clientW);

      if (xTransEnd < 0 || xTransStart > clientW) return;

      const transW = Math.max(4, xTransEnd - xTransStart);
      const isSel = isSelectedF(f.id);

      // Bloque de transición en carril inferior
      ctx.fillStyle = isSel ? 'rgba(8, 145, 178, 0.95)' : 'rgba(14, 116, 144, 0.75)';
      ctx.fillRect(xTransStart, transTrackY + 4, transW, 26);

      // Patrón de flechas diagonales de desplazamiento
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      for (let diagX = xTransStart; diagX < xTransEnd; diagX += 10) {
        ctx.beginPath();
        ctx.moveTo(diagX, transTrackY + 28);
        ctx.lineTo(diagX + 7, transTrackY + 6);
        ctx.stroke();
      }

      ctx.strokeStyle = isSel ? '#22d3ee' : '#0891b2';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(xTransStart, transTrackY + 4, transW, 26);

      // Handle Transición
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(xTransEnd - 3, transTrackY + 6, 4, 22);

      // Nombre del destino
      ctx.font = '600 10px system-ui';
      ctx.fillStyle = '#ffffff';
      const destName = nextF ? `➔ ${nextF.name}` : '➔ Siguiente';
      ctx.fillText(`${destName} (${f.transitionDurationMs}ms)`, xTransStart + 5, transTrackY + 20);
    });

    // 6. ALERTAS DE COLISIÓN (PUNTOS ROJOS EN TRACK)
    if (collisionTimes.length > 0) {
      ctx.fillStyle = '#ef4444';
      collisionTimes.forEach((t) => {
        const cx = timeToX(t, clientW);
        if (cx >= 0 && cx <= clientW) {
          ctx.fillRect(cx - 1, formTrackY, 2.5, 6);
        }
      });
    }

    // 7. CAJA DE SELECCIÓN MÚLTIPLE (MARQUEE GHOST)
    if (selectionBox) {
      const minX = Math.min(selectionBox.startX, selectionBox.currentX);
      const maxX = Math.max(selectionBox.startX, selectionBox.currentX);
      const minY = Math.min(selectionBox.startY, selectionBox.currentY);
      const maxY = Math.max(selectionBox.startY, selectionBox.currentY);

      ctx.fillStyle = 'rgba(139, 92, 246, 0.2)';
      ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
    }

    // 8. AGUJA DE REPRODUCCIÓN (PLAYHEAD VERDE)
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
    selectedFormationIds,
    collisionTimes,
    timeToX,
    xToTime,
    scrollLeftMs,
    visibleDurationMs,
    zoom,
    selectionBox,
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

  // MANEJO DE POINTER (SELECCIÓN SIMPLE, MÚLTIPLE, CAJA, SCRUB Y ARRASTRE SIN EMPALMES)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const w = canvas.clientWidth;

    canvas.setPointerCapture(e.pointerId);

    const minimapH = zoom > 1.05 ? 13 : 0;
    const rulerY = minimapH;

    // Clic en el Mini-mapa superior
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

    // Paneo con botón secundario o botón central
    if (e.button === 1 || e.button === 2) {
      dragRef.current = {
        type: 'timeline_pan',
        pointerId: e.pointerId,
        startX: e.clientX,
        initialScrollMs: scrollLeftMs,
      };
      return;
    }

    const clickedTime = xToTime(x, w);

    // 1. Pista de Conteos (Y: rulerY + 68 a rulerY + 104)
    if (y >= rulerY + 68 && y <= rulerY + 104) {
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

    // 2. Pista de Formaciones (Hold) (Y: rulerY + 106 a rulerY + 144)
    if (y >= rulerY + 106 && y <= rulerY + 144) {
      for (const f of formations) {
        const xStart = timeToX(f.startTimeMs, w);
        const xHoldEnd = timeToX(f.startTimeMs + f.holdDurationMs, w);

        // Handle Hold (ajuste de duración estática)
        if (Math.abs(x - xHoldEnd) < 8) {
          dragRef.current = {
            type: 'hold_handle',
            targetId: f.id,
            pointerId: e.pointerId,
          };
          return;
        }

        // Clic en bloque Hold de la formación
        if (x >= xStart && x <= xHoldEnd) {
          const isMulti = e.shiftKey || e.ctrlKey || e.metaKey;
          onSelectFormation(f.id, isMulti);
          onSeek(f.startTimeMs);

          // Si hay varias formaciones seleccionadas, calcular offsets de cada una para moverlas en conjunto
          const targets = selectedFormationIds.includes(f.id) ? selectedFormationIds : [f.id];
          const offsets: Record<string, number> = {};
          targets.forEach((id) => {
            const item = formations.find((form) => form.id === id);
            if (item) offsets[id] = clickedTime - item.startTimeMs;
          });

          dragRef.current = {
            type: 'form_move',
            targetId: f.id,
            targetIds: targets,
            offsets,
            pointerId: e.pointerId,
            hasMoved: false,
          };
          return;
        }
      }
    }

    // 3. Pista de Transiciones (Traslación) (Y: rulerY + 146 a rulerY + 180)
    if (y >= rulerY + 146 && y <= rulerY + 180) {
      for (const f of formations) {
        if (f.transitionDurationMs <= 0) continue;
        const transStartMs = f.startTimeMs + f.holdDurationMs;
        const transEndMs = transStartMs + f.transitionDurationMs;
        const xTransStart = timeToX(transStartMs, w);
        const xTransEnd = timeToX(transEndMs, w);

        // Handle Transición
        if (Math.abs(x - xTransEnd) < 8) {
          dragRef.current = {
            type: 'trans_handle',
            targetId: f.id,
            pointerId: e.pointerId,
          };
          return;
        }

        if (x >= xTransStart && x <= xTransEnd) {
          onSelectFormation(f.id, e.shiftKey || e.ctrlKey);
          onSeek(transStartMs);
          return;
        }
      }
    }

    // 4. Si se presiona Shift o se arrastra en espacio vacío: Caja de selección múltiple (Marquee)
    if (e.shiftKey || (y >= rulerY + 106 && y <= rulerY + 180)) {
      dragRef.current = {
        type: 'box_select',
        startX: x,
        startY: y,
        pointerId: e.pointerId,
      };
      setSelectionBox({ startX: x, startY: y, currentX: x, currentY: y });
      return;
    }

    // 5. Scrubbing regular de la aguja
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
    const y = e.clientY - rect.top;
    const w = canvas.clientWidth;

    // Caja de selección múltiple
    if (dragRef.current.type === 'box_select' && dragRef.current.startX !== undefined && dragRef.current.startY !== undefined) {
      setSelectionBox({
        startX: dragRef.current.startX,
        startY: dragRef.current.startY,
        currentX: x,
        currentY: y,
      });

      // Seleccionar formaciones en el rango de tiempo
      const tA = xToTime(Math.min(dragRef.current.startX, x), w);
      const tB = xToTime(Math.max(dragRef.current.startX, x), w);

      const matchedIds = formations
        .filter((f) => {
          const fEnd = f.startTimeMs + f.holdDurationMs + f.transitionDurationMs;
          return f.startTimeMs <= tB && fEnd >= tA;
        })
        .map((f) => f.id);

      if (onSelectMultipleFormations) {
        onSelectMultipleFormations(matchedIds);
      }
      return;
    }

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
        const newHold = Math.max(300, Math.round(currentTime - f.startTimeMs));
        onUpdateFormationTiming(f.id, f.startTimeMs, newHold, f.transitionDurationMs);
      } else if (dragRef.current.type === 'trans_handle') {
        const newTrans = Math.max(
          0,
          Math.round(currentTime - (f.startTimeMs + f.holdDurationMs))
        );
        onUpdateFormationTiming(f.id, f.startTimeMs, f.holdDurationMs, newTrans);
      } else if (dragRef.current.type === 'form_move' && dragRef.current.offsets) {
        dragRef.current.hasMoved = true;
        // REGLA CRÍTICA: NO EMPALMAR FORMACIÓN CON FORMACIÓN
        const targetIds = dragRef.current.targetIds || [f.id];

        targetIds.forEach((id) => {
          const form = formations.find((item) => item.id === id);
          if (!form) return;
          const off = dragRef.current?.offsets?.[id] || 0;
          let newStart = Math.max(0, Math.round(currentTime - off));

          // Validación de no solapamiento con formaciones previas o siguientes que no estén seleccionadas
          const idx = formations.indexOf(form);
          const prevF = formations[idx - 1];
          const nextF = formations[idx + 1];

          if (prevF && !targetIds.includes(prevF.id)) {
            newStart = Math.max(newStart, prevF.startTimeMs + prevF.holdDurationMs);
          }
          if (nextF && !targetIds.includes(nextF.id)) {
            newStart = Math.min(newStart, nextF.startTimeMs - form.holdDurationMs);
          }

          onUpdateFormationTiming(form.id, newStart, form.holdDurationMs, form.transitionDurationMs);
        });
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current) {
      const canvas = canvasRef.current;
      if (canvas && canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }

      if (dragRef.current.type === 'box_select') {
        setSelectionBox(null);
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
      {/* BARRA DE ZOOM FLOTANTE DEL TIMELINE */}
      <div className="absolute top-2 right-3 z-20 flex items-center gap-1.5 p-1 rounded-lg bg-slate-950/85 backdrop-blur-md border border-slate-800 shadow-md text-xs">
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
          title="Restablecer Zoom a 1x"
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
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
        className="w-full block cursor-ew-resize touch-none"
        style={{ height: zoom > 1.05 ? '202px' : '190px' }}
      />
    </div>
  );
};
