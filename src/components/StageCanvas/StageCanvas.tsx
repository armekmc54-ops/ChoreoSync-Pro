import React, { useRef, useState, useEffect, useCallback } from 'react';
import { 
  Formation, 
  Dancer, 
  ViewMode, 
  CollisionEvent,
  TrajectoryPathType 
} from '../../types/choreo';
import { 
  computeStageRect, 
  toScreenCoords, 
  toNormCoords, 
  calculateDancersPose, 
  getControlPoint, 
  clamp, 
  STAGE_ZONES_VERTICAL, 
  STAGE_ZONES_HORIZONTAL 
} from '../../utils/interpolation';
import { detectInstantCollisions } from '../../utils/collision';
import { ZoomIn, ZoomOut, RotateCcw, Maximize2, Grid, Focus } from 'lucide-react';

interface StageCanvasProps {
  formations: Formation[];
  dancers: Dancer[];
  currentTimeMs: number;
  selectedFormationId: string;
  selectedDancerId: string | null;
  viewMode: ViewMode;
  isMirror: boolean;
  showAllPaths: boolean;
  onSelectDancer: (dancerId: string | null) => void;
  onUpdateDancerPosition: (formationId: string, dancerId: string, normX: number, normY: number) => void;
  onUpdateDancerCurveOffset: (formationId: string, dancerId: string, cx: number, cy: number) => void;
  onUpdateDancerPathType?: (formationId: string, dancerId: string, pathType: TrajectoryPathType) => void;
  onEndUpdateDancerPosition?: () => void;
  onCollisionChange?: (collisions: CollisionEvent[]) => void;
}

export const StageCanvas: React.FC<StageCanvasProps> = ({
  formations,
  dancers,
  currentTimeMs,
  selectedFormationId,
  selectedDancerId,
  viewMode,
  isMirror,
  showAllPaths,
  onSelectDancer,
  onUpdateDancerPosition,
  onUpdateDancerCurveOffset,
  onUpdateDancerPathType,
  onEndUpdateDancerPosition,
  onCollisionChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Estados de Zoom y Paneo
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [selectedQuadrant, setSelectedQuadrant] = useState<string>('all');

  const dragRef = useRef<{
    type: 'dancer' | 'curve_control' | 'pan';
    dancerId?: string;
    pointerId: number;
    startX: number;
    startY: number;
    initialPanX: number;
    initialPanY: number;
  } | null>(null);

  const activeFormation = formations.find((f) => f.id === selectedFormationId) || formations[0];
  const activeFormationIdx = formations.findIndex((f) => f.id === selectedFormationId);
  const nextFormation = activeFormationIdx >= 0 ? formations[activeFormationIdx + 1] : undefined;

  // Enfocar cuadrante específico (Zoom inteligente hacia ese cuadrante)
  const handleFocusQuadrant = (quadrantKey: string) => {
    setSelectedQuadrant(quadrantKey);
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (quadrantKey === 'all') {
      setZoom(1.0);
      setPan({ x: 0, y: 0 });
      return;
    }

    const [vKey, hKey] = quadrantKey.split('-');
    const rIdx = STAGE_ZONES_VERTICAL.indexOf(vKey as any);
    const cIdx = STAGE_ZONES_HORIZONTAL.indexOf(hKey as any);

    if (rIdx >= 0 && cIdx >= 0) {
      const targetNormX = (cIdx + 0.5) / 3;
      const targetNormY = (rIdx + 0.5) / 3;

      const targetZoom = 2.4;
      const clientW = canvas.clientWidth;
      const clientH = canvas.clientHeight;

      const baseRect = computeStageRect(clientW, clientH, 1.0, { x: 0, y: 0 });
      const targetPanX = (0.5 - targetNormX) * baseRect.w * targetZoom;
      const targetPanY = (0.5 - targetNormY) * baseRect.h * targetZoom;

      setZoom(targetZoom);
      setPan({ x: targetPanX, y: targetPanY });
    }
  };

  const handleResetZoom = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
    setSelectedQuadrant('all');
  };

  const handleZoomChange = (delta: number) => {
    setZoom((prev) => clamp(Math.round((prev + delta) * 10) / 10, 0.6, 4.5));
  };

  // Dibuja una flecha curva cuadrática de Bézier con punta
  const drawArrow = (
    ctx: CanvasRenderingContext2D,
    from: { x: number; y: number },
    to: { x: number; y: number },
    ctrl: { x: number; y: number },
    color: string,
    pathType: TrajectoryPathType = 'curve'
  ) => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = Math.max(2, 2.5 * Math.min(1.5, zoom));
    ctx.setLineDash([6 * zoom, 5 * zoom]);

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);

    let endAngle = 0;

    if (pathType === 'straight') {
      // Línea recta directa
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      endAngle = Math.atan2(to.y - from.y, to.x - from.x);
    } else if (pathType === 'corner') {
      // En escuadra / quiebre a 90 grados
      ctx.lineTo(ctrl.x, ctrl.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      endAngle = Math.atan2(to.y - ctrl.y, to.x - ctrl.x);
    } else {
      // Curva ondulada cuadrática de Bézier
      ctx.quadraticCurveTo(ctrl.x, ctrl.y, to.x, to.y);
      ctx.stroke();
      endAngle = Math.atan2(to.y - ctrl.y, to.x - ctrl.x);
    }

    ctx.setLineDash([]);

    // Dibujar punta de flecha en el destino
    const arrowLen = Math.max(10, 12 * Math.min(1.4, zoom));
    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(
      to.x - arrowLen * Math.cos(endAngle - Math.PI / 7),
      to.y - arrowLen * Math.sin(endAngle - Math.PI / 7)
    );
    ctx.lineTo(
      to.x - arrowLen * Math.cos(endAngle + Math.PI / 7),
      to.y - arrowLen * Math.sin(endAngle + Math.PI / 7)
    );
    ctx.closePath();
    ctx.fill();

    ctx.restore();
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

    const rect = computeStageRect(clientW, clientH, zoom, pan);
    const dancerRadius = Math.max(13, Math.min(rect.w, rect.h) * 0.046);

    // 1. FONDO DEL ESCENARIO
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

    // Borde exterior
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = Math.max(1.5, 2 * Math.min(1.5, zoom));
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);

    // 2. CUADRÍCULA "#" (9 ZONAS ESCÉNICAS)
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = Math.max(1.2, 1.8 * Math.min(1.5, zoom));
    ctx.setLineDash([]);

    // Líneas verticales de la división #
    for (let c = 1; c < 3; c++) {
      const lineX = rect.x + (rect.w * c) / 3;
      ctx.beginPath();
      ctx.moveTo(lineX, rect.y - 8 * zoom);
      ctx.lineTo(lineX, rect.y + rect.h + 8 * zoom);
      ctx.stroke();
    }

    // Líneas horizontales de la división #
    for (let r = 1; r < 3; r++) {
      const lineY = rect.y + (rect.h * r) / 3;
      ctx.beginPath();
      ctx.moveTo(rect.x - 8 * zoom, lineY);
      ctx.lineTo(rect.x + rect.w + 8 * zoom, lineY);
      ctx.stroke();
    }

    // Etiquetas sutiles de fondo para cada una de las 9 zonas
    const labelFontSize = Math.max(10, Math.min(18, 11 * Math.sqrt(zoom)));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `500 ${labelFontSize}px system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(148, 163, 184, 0.35)';

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const normCenter = {
          x: (c + 0.5) / 3,
          y: (r + 0.5) / 3,
        };
        const s = toScreenCoords(normCenter.x, normCenter.y, rect, isMirror);

        const verticalLabel = isMirror
          ? STAGE_ZONES_VERTICAL[2 - r]
          : STAGE_ZONES_VERTICAL[r];
        const horizontalLabel = isMirror
          ? STAGE_ZONES_HORIZONTAL[2 - c]
          : STAGE_ZONES_HORIZONTAL[c];

        ctx.fillText(`${verticalLabel} ${horizontalLabel}`, s.x, s.y);
      }
    }

    // 3. INDICADOR "FRENTE / PÚBLICO"
    const bannerFontSize = Math.max(11, Math.min(16, 12 * Math.sqrt(zoom)));
    ctx.font = `bold ${bannerFontSize}px system-ui, sans-serif`;
    ctx.fillStyle = '#22d3ee';
    ctx.textAlign = 'center';

    if (isMirror) {
      ctx.fillText(
        '▲ FRENTE / PÚBLICO (VISTA DESDE EL ESCENARIO) ▲',
        rect.x + rect.w / 2,
        rect.y - 14 * Math.min(1.5, zoom)
      );
    } else {
      ctx.fillText(
        '▼ FRENTE / PÚBLICO (VISTA DIRECCIÓN / AUDITORIO) ▼',
        rect.x + rect.w / 2,
        rect.y + rect.h + 20 * Math.min(1.5, zoom)
      );
    }

    // 4. POSICIONES INTERPOLADAS Y COLISIONES
    const currentPoses = calculateDancersPose(formations, dancers, currentTimeMs);
    const activeCollisions = detectInstantCollisions(formations, dancers, currentTimeMs);
    if (onCollisionChange) {
      onCollisionChange(activeCollisions);
    }
    const collidingDancerIds = new Set(
      activeCollisions.flatMap((c) => [c.dancerIdA, c.dancerIdB])
    );

    // 5. RUTAS Y TRAYECTORIAS CURVAS BÉZIER
    if (activeFormation && nextFormation) {
      dancers.forEach((dancer) => {
        const isSelected = dancer.id === selectedDancerId;
        if (!showAllPaths && !isSelected) return;

        const posFrom = activeFormation.positions[dancer.id];
        const posTo = nextFormation.positions[dancer.id];
        if (!posFrom || !posTo) return;

        const sFrom = toScreenCoords(posFrom.x, posFrom.y, rect, isMirror);
        const sTo = toScreenCoords(posTo.x, posTo.y, rect, isMirror);
        const ctrlNorm = getControlPoint(posFrom, posTo);
        const sCtrl = toScreenCoords(ctrlNorm.x, ctrlNorm.y, rect, isMirror);

        const pathType = posFrom.pathType || 'curve';

        // Flecha Bézier / Recta / En Escuadra
        drawArrow(ctx, sFrom, sTo, sCtrl, dancer.color + 'aa', pathType);

        // Punto de control para curvar o punto de quiebre en escuadra (Cyan o Ámbar con borde blanco)
        if (isSelected && viewMode === 'choreographer' && pathType !== 'straight') {
          const ctrlR = Math.max(6, 8 * Math.min(1.5, zoom));
          ctx.beginPath();
          ctx.arc(sCtrl.x, sCtrl.y, ctrlR, 0, Math.PI * 2);
          ctx.fillStyle = pathType === 'corner' ? '#f59e0b' : '#22d3ee';
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.save();
          ctx.setLineDash([2 * zoom, 2 * zoom]);
          ctx.strokeStyle = pathType === 'corner' ? 'rgba(245, 158, 11, 0.45)' : 'rgba(34, 211, 238, 0.4)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(sFrom.x, sFrom.y);
          ctx.lineTo(sCtrl.x, sCtrl.y);
          ctx.lineTo(sTo.x, sTo.y);
          ctx.stroke();
          ctx.restore();
        }
      });
    }

    // 6. RENDERIZADO DE FICHAS DE BAILARINES
    dancers.forEach((dancer) => {
      const pose = currentPoses[dancer.id];
      if (!pose) return;

      const screenPos = toScreenCoords(pose.x, pose.y, rect, isMirror);
      const isSelected = dancer.id === selectedDancerId;
      const isMeInDancerMode = viewMode === 'dancer' && isSelected;
      const isColliding = collidingDancerIds.has(dancer.id);

      let scale = 1.0;
      let alpha = 1.0;

      if (viewMode === 'dancer') {
        if (selectedDancerId) {
          if (isMeInDancerMode) {
            scale = 1.45;
            alpha = 1.0;
          } else {
            scale = 0.9;
            alpha = 0.35;
          }
        }
      }

      ctx.save();
      ctx.globalAlpha = alpha;

      const r = dancerRadius * scale;

      if (isSelected) {
        // Halo de resplandor exterior vibrante estilo neón (como en la captura del usuario)
        ctx.save();
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, r + 4, 0, Math.PI * 2);
        ctx.shadowColor = isColliding ? '#ef4444' : '#c084fc';
        ctx.shadowBlur = 32 * Math.min(1.5, zoom);
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
      }

      if (isColliding) {
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, r + 9 * Math.min(1.5, zoom), 0, Math.PI * 2);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = Math.max(2, 3 * Math.min(1.5, zoom));
        ctx.stroke();
      }

      // Ficha circular
      ctx.beginPath();
      ctx.arc(screenPos.x, screenPos.y, r, 0, Math.PI * 2);
      ctx.fillStyle = dancer.color;
      ctx.fill();

      // Borde blanco nítido y grueso para el bailarín activo
      ctx.lineWidth = isSelected ? Math.max(3.5, 4.5 * Math.min(1.5, zoom)) : 1.5;
      ctx.strokeStyle = isColliding ? '#ef4444' : isSelected ? '#ffffff' : '#0f172a';
      ctx.stroke();

      ctx.shadowBlur = 0;

      // Número central
      ctx.fillStyle = '#0f172a';
      ctx.font = `bold ${Math.round(r * 0.95)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(dancer.slotNumber), screenPos.x, screenPos.y + 1);

      // Badge de nivel ('P', 'M', 'A')
      const badgeR = r * 0.42;
      const badgeX = screenPos.x + r * 0.82;
      const badgeY = screenPos.y - r * 0.82;

      ctx.beginPath();
      ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2);
      ctx.fillStyle = '#0f172a';
      ctx.fill();
      ctx.strokeStyle = isSelected ? '#ffffff' : '#475569';
      ctx.lineWidth = isSelected ? 1.5 : 1;
      ctx.stroke();

      const levelInitial = pose.level ? pose.level[0].toUpperCase() : 'M';
      ctx.fillStyle = levelInitial === 'A' ? '#38bdf8' : levelInitial === 'P' ? '#fbbf24' : '#ffffff';
      ctx.font = `bold ${Math.round(badgeR * 1.1)}px system-ui, sans-serif`;
      ctx.fillText(levelInitial, badgeX, badgeY + 1);

      // Nombre del bailarín (Grande y destacado en blanco como en la captura)
      const nameFontSize = isSelected ? Math.max(13, Math.round(r * 0.72)) : Math.max(10, Math.round(r * 0.58));
      ctx.font = isSelected ? `bold ${nameFontSize}px system-ui, sans-serif` : `600 ${nameFontSize}px system-ui, sans-serif`;
      ctx.fillStyle = isSelected ? '#ffffff' : '#94a3b8';
      ctx.fillText(dancer.name, screenPos.x, screenPos.y + r + (isSelected ? 16 : 13) * Math.min(1.4, zoom));

      ctx.restore();
    });
  }, [
    formations,
    dancers,
    currentTimeMs,
    selectedFormationId,
    selectedDancerId,
    viewMode,
    isMirror,
    showAllPaths,
    zoom,
    pan,
    onCollisionChange,
  ]);

  // Loop continuo a 60 FPS
  useEffect(() => {
    let animId: number;
    const loop = () => {
      render();
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [render]);

  // PREVENCIÓN ESTRICTA DE ZOOM EN LA PESTAÑA DEL NAVEGADOR EN LAPTOPS
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
      setZoom((prev) => clamp(Math.round(prev * zoomFactor * 100) / 100, 0.6, 4.5));
    };

    canvas.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleNativeWheel);
  }, []);

  // MANEJO DE POINTER (DRAG & DROP, PANEO Y CURVAS)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const bcr = canvas.getBoundingClientRect();
    const px = e.clientX - bcr.left;
    const py = e.clientY - bcr.top;

    const rect = computeStageRect(canvas.clientWidth, canvas.clientHeight, zoom, pan);
    const dancerRadius = Math.max(14, Math.min(rect.w, rect.h) * 0.046);

    // 1. Clic secundario o botón central o con Alt/Espacio = Paneo directo
    if (e.button === 1 || e.button === 2 || e.altKey) {
      dragRef.current = {
        type: 'pan',
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        initialPanX: pan.x,
        initialPanY: pan.y,
      };
      canvas.setPointerCapture(e.pointerId);
      return;
    }

    if (viewMode === 'dancer') {
      // MODO BAILARÍN: 100% SOLO LECTURA (READ-ONLY)
      // Tocar sobre un bailarín selecciona "¿Quién eres?" sin alterar la posición
      const currentPoses = calculateDancersPose(formations, dancers, currentTimeMs);
      let hitDancer: Dancer | null = null;

      for (const dancer of dancers) {
        const pose = currentPoses[dancer.id];
        if (!pose) continue;
        const s = toScreenCoords(pose.x, pose.y, rect, isMirror);
        if (Math.hypot(s.x - px, s.y - py) <= dancerRadius * 1.5 + 8) {
          hitDancer = dancer;
          break;
        }
      }

      if (hitDancer) {
        onSelectDancer(hitDancer.id);
        try {
          localStorage.setItem('choreosync_my_dancer_id', hitDancer.id);
        } catch {}
        return;
      }

      // Si tocó fondo vacío en móvil: permitir Paneo de la vista
      dragRef.current = {
        type: 'pan',
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        initialPanX: pan.x,
        initialPanY: pan.y,
      };
      canvas.setPointerCapture(e.pointerId);
      return;
    }

    if (viewMode === 'choreographer') {
      // 2. Clic en punto de control Bézier / punto de quiebre en escuadra
      if (activeFormation && nextFormation) {
        for (const d of dancers) {
          if (!showAllPaths && d.id !== selectedDancerId) continue;
          const posFrom = activeFormation.positions[d.id];
          const posTo = nextFormation.positions[d.id];
          if (!posFrom || !posTo) continue;
          const ctrlNorm = getControlPoint(posFrom, posTo);
          const sCtrl = toScreenCoords(ctrlNorm.x, ctrlNorm.y, rect, isMirror);
          const distCtrl = Math.hypot(sCtrl.x - px, sCtrl.y - py);
          if (distCtrl <= 16) {
            onSelectDancer(d.id);
            dragRef.current = {
              type: 'curve_control',
              dancerId: d.id,
              pointerId: e.pointerId,
              startX: e.clientX,
              startY: e.clientY,
              initialPanX: pan.x,
              initialPanY: pan.y,
            };
            canvas.setPointerCapture(e.pointerId);
            return;
          }
        }
      }

      // 3. Clic sobre un bailarín
      const currentPoses = calculateDancersPose(formations, dancers, currentTimeMs);
      let hitDancer: Dancer | null = null;

      for (const dancer of dancers) {
        const pose = currentPoses[dancer.id];
        if (!pose) continue;
        const s = toScreenCoords(pose.x, pose.y, rect, isMirror);
        if (Math.hypot(s.x - px, s.y - py) <= dancerRadius + 6) {
          hitDancer = dancer;
          break;
        }
      }

      if (hitDancer) {
        onSelectDancer(hitDancer.id);
        dragRef.current = {
          type: 'dancer',
          dancerId: hitDancer.id,
          pointerId: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          initialPanX: pan.x,
          initialPanY: pan.y,
        };
        canvas.setPointerCapture(e.pointerId);
        return;
      }
    }

    // 4. Si hizo clic en espacio vacío: Paneo de escenario
    onSelectDancer(null);
    dragRef.current = {
      type: 'pan',
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      initialPanX: pan.x,
      initialPanY: pan.y,
    };
    canvas.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (dragRef.current.type === 'pan') {
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setPan({
        x: dragRef.current.initialPanX + dx,
        y: dragRef.current.initialPanY + dy,
      });
      return;
    }

    const bcr = canvas.getBoundingClientRect();
    const px = e.clientX - bcr.left;
    const py = e.clientY - bcr.top;

    const rect = computeStageRect(canvas.clientWidth, canvas.clientHeight, zoom, pan);
    const norm = toNormCoords(px, py, rect, isMirror);

    if (dragRef.current.type === 'dancer' && dragRef.current.dancerId) {
      onUpdateDancerPosition(
        selectedFormationId,
        dragRef.current.dancerId,
        norm.x,
        norm.y
      );
    } else if (dragRef.current.type === 'curve_control' && dragRef.current.dancerId) {
      if (activeFormation && nextFormation) {
        const posFrom = activeFormation.positions[dragRef.current.dancerId];
        const posTo = nextFormation.positions[dragRef.current.dancerId];
        if (posFrom && posTo) {
          const midX = (posFrom.x + posTo.x) / 2;
          const midY = (posFrom.y + posTo.y) / 2;
          const cx = norm.x - midX;
          const cy = norm.y - midY;
          onUpdateDancerCurveOffset(selectedFormationId, dragRef.current.dancerId, cx, cy);
        }
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current) {
      const wasDancerDrag = dragRef.current.type === 'dancer' || dragRef.current.type === 'curve_control';
      const canvas = canvasRef.current;
      if (canvas && canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
      dragRef.current = null;
      if (wasDancerDrag) {
        onEndUpdateDancerPosition?.();
      }
    }
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-slate-950 overflow-hidden select-none">
      {/* BARRA FLOTANTE DE CONTROLES DE ZOOM Y CUADRANTES ESTILO ADOBE / FIGMA */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-800 shadow-xl text-xs">
        {/* Selector de cuadrante rápido */}
        <div className="flex items-center gap-1 px-1.5 border-r border-slate-800">
          <Focus className="w-3.5 h-3.5 text-cyan-400" />
          <select
            value={selectedQuadrant}
            onChange={(e) => handleFocusQuadrant(e.target.value)}
            className="bg-transparent text-[11px] text-slate-300 font-medium outline-none cursor-pointer pr-1"
            title="Enfocar cuadrante escénico específico"
          >
            <option value="all" className="bg-slate-900 text-white">Escenario Completo</option>
            <option value="Upstage-Der" className="bg-slate-900 text-white">Upstage Der (Fondo Der)</option>
            <option value="Upstage-Centro" className="bg-slate-900 text-white">Upstage Centro (Fondo)</option>
            <option value="Upstage-Izq" className="bg-slate-900 text-white">Upstage Izq (Fondo Izq)</option>
            <option value="Center-Der" className="bg-slate-900 text-white">Center Der (Centro Der)</option>
            <option value="Center-Centro" className="bg-slate-900 text-white">Center Centro (Centro)</option>
            <option value="Center-Izq" className="bg-slate-900 text-white">Center Izq (Centro Izq)</option>
            <option value="Downstage-Der" className="bg-slate-900 text-white">Downstage Der (Frente Der)</option>
            <option value="Downstage-Centro" className="bg-slate-900 text-white">Downstage Centro (Frente)</option>
            <option value="Downstage-Izq" className="bg-slate-900 text-white">Downstage Izq (Frente Izq)</option>
          </select>
        </div>

        {/* Botones Zoom */}
        <button
          onClick={() => handleZoomChange(-0.2)}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          title="Alejar Zoom (-)"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleResetZoom}
          className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono text-cyan-400 font-bold hover:bg-slate-800 transition"
          title="Restablecer Zoom a 100%"
        >
          {Math.round(zoom * 100)}%
        </button>

        <button
          onClick={() => handleZoomChange(0.2)}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          title="Acercar Zoom (+)"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleResetZoom}
          className="p-1 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition"
          title="Ajustar escenario a ventana"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* SELECTOR DE ESTILO DE RUTA (CURVA, RECTA O EN ESCUADRA) */}
      {selectedDancerId && viewMode === 'choreographer' && activeFormation && nextFormation && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/95 backdrop-blur-md border border-slate-700/80 shadow-2xl text-xs">
          <span className="text-[11px] text-cyan-400 font-bold uppercase tracking-wider pr-1">
            Ruta #{dancers.find((d) => d.id === selectedDancerId)?.slotNumber || ''}:
          </span>
          <button
            type="button"
            onClick={() => onUpdateDancerPathType?.(selectedFormationId, selectedDancerId, 'curve')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition flex items-center gap-1 ${
              (activeFormation.positions[selectedDancerId]?.pathType || 'curve') === 'curve'
                ? 'bg-cyan-500 text-slate-950 shadow-sm shadow-cyan-500/40'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Trayectoria curva suave (Bézier)"
          >
            <span>∿</span> Curva
          </button>
          <button
            type="button"
            onClick={() => onUpdateDancerPathType?.(selectedFormationId, selectedDancerId, 'straight')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition flex items-center gap-1 ${
              activeFormation.positions[selectedDancerId]?.pathType === 'straight'
                ? 'bg-cyan-500 text-slate-950 shadow-sm shadow-cyan-500/40'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Línea recta directa sin desvío"
          >
            <span>—</span> Recta
          </button>
          <button
            type="button"
            onClick={() => onUpdateDancerPathType?.(selectedFormationId, selectedDancerId, 'corner')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition flex items-center gap-1 ${
              activeFormation.positions[selectedDancerId]?.pathType === 'corner'
                ? 'bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/40'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="En escuadra / quiebre a 90° con punto de esquina arrastrable"
          >
            <span>⌐</span> En Escuadra
          </button>
        </div>
      )}

      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onContextMenu={(e) => e.preventDefault()}
        className="w-full h-full block cursor-grab active:cursor-grabbing touch-none"
      />
    </div>
  );
};
