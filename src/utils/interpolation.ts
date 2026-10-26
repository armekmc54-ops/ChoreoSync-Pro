import { DancerPosition, Formation, Dancer, StageZone } from '../types/choreo';

/**
 * Fórmula Cuadrática de Bézier para trayectorias curvas en el escenario:
 * Pos(t) = (1-t)² * P0 + 2(1-t)t * P_control + t² * P1
 */
export function quadraticBezier(p0: number, pControl: number, p1: number, t: number): number {
  const v = 1 - t;
  return v * v * p0 + 2 * v * t * pControl + t * t * p1;
}

/**
 * Función de aceleración suave Ease-in-out cúbica/cuadrática
 */
export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function clamp(val: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Calcula las coordenadas del punto de control Bézier para la transición
 */
export function getControlPoint(
  fromPos: DancerPosition,
  toPos: DancerPosition
): { x: number; y: number } {
  const offset = fromPos.curveOffset || { cx: 0, cy: 0 };
  const midX = (fromPos.x + toPos.x) / 2;
  const midY = (fromPos.y + toPos.y) / 2;
  return {
    x: clamp(midX + offset.cx, 0, 1),
    y: clamp(midY + offset.cy, 0, 1),
  };
}

/**
 * Encuentra el índice de la formación activa en un milisegundo dado
 */
export function getActiveFormationIndex(formations: Formation[], timeMs: number): number {
  if (!formations.length) return 0;
  let activeIndex = 0;
  for (let i = 0; i < formations.length; i++) {
    if (formations[i].startTimeMs <= timeMs) {
      activeIndex = i;
    } else {
      break;
    }
  }
  return activeIndex;
}

/**
 * Calcula la posición interpolada exacta (Hold vs Travel con Bézier) de todos los bailarines en timeMs
 */
export function calculateDancersPose(
  formations: Formation[],
  dancers: Dancer[],
  timeMs: number
): Record<string, { x: number; y: number; level: 'piso' | 'medio' | 'arriba'; isMoving: boolean; progress: number }> {
  const result: Record<string, { x: number; y: number; level: 'piso' | 'medio' | 'arriba'; isMoving: boolean; progress: number }> = {};
  if (!formations || formations.length === 0) return result;

  const currentIdx = getActiveFormationIndex(formations, timeMs);
  const currentF = formations[currentIdx];
  const nextF = formations[currentIdx + 1];

  dancers.forEach((dancer) => {
    const currentPos = currentF?.positions[dancer.id];
    if (!currentPos) return;

    // Si no hay siguiente formación o aún no alcanzamos la siguiente, posición base
    if (!nextF || !nextF.positions[dancer.id]) {
      result[dancer.id] = {
        x: currentPos.x,
        y: currentPos.y,
        level: currentPos.level,
        isMoving: false,
        progress: 0,
      };
      return;
    }

    const nextPos = nextF.positions[dancer.id];
    const holdEndMs = currentF.startTimeMs + currentF.holdDurationMs;
    const transitionEndMs = holdEndMs + currentF.transitionDurationMs;

    // FASE 1: HOLD (Estático en la posición de la formación actual)
    if (timeMs <= holdEndMs || currentF.transitionDurationMs <= 0) {
      result[dancer.id] = {
        x: currentPos.x,
        y: currentPos.y,
        level: currentPos.level,
        isMoving: false,
        progress: 0,
      };
    }
    // FASE 2: TRAVEL (Transición interpolada hacia la siguiente formación)
    else if (timeMs < transitionEndMs) {
      const rawProgress = clamp((timeMs - holdEndMs) / currentF.transitionDurationMs, 0, 1);
      const easedProgress = easeInOut(rawProgress);
      const ctrl = getControlPoint(currentPos, nextPos);
      const pathType = currentPos.pathType || 'curve';

      let x: number;
      let y: number;

      if (pathType === 'straight') {
        // Línea recta directa sin desvío
        x = (1 - easedProgress) * currentPos.x + easedProgress * nextPos.x;
        y = (1 - easedProgress) * currentPos.y + easedProgress * nextPos.y;
      } else if (pathType === 'corner') {
        // En escuadra / ángulo recto hacia el punto de quiebre
        if (easedProgress < 0.5) {
          const subP = easedProgress * 2;
          x = (1 - subP) * currentPos.x + subP * ctrl.x;
          y = (1 - subP) * currentPos.y + subP * ctrl.y;
        } else {
          const subP = (easedProgress - 0.5) * 2;
          x = (1 - subP) * ctrl.x + subP * nextPos.x;
          y = (1 - subP) * ctrl.y + subP * nextPos.y;
        }
      } else {
        // Curva cuadrática de Bézier ondulada
        x = quadraticBezier(currentPos.x, ctrl.x, nextPos.x, easedProgress);
        y = quadraticBezier(currentPos.y, ctrl.y, nextPos.y, easedProgress);
      }

      const level = rawProgress >= 0.5 ? nextPos.level : currentPos.level;

      result[dancer.id] = {
        x: clamp(x, 0, 1),
        y: clamp(y, 0, 1),
        level,
        isMoving: true,
        progress: rawProgress,
      };
    }
    // FASE 3: LLEGADA (Ya alcanzó la siguiente formación)
    else {
      result[dancer.id] = {
        x: nextPos.x,
        y: nextPos.y,
        level: nextPos.level,
        isMoving: false,
        progress: 1,
      };
    }
  });

  return result;
}

/**
 * 9 Zonas escénicas clásicas del teatro y la danza (Cuadrícula #)
 */
export const STAGE_ZONES_VERTICAL = ['Upstage', 'Center', 'Downstage'] as const;
export const STAGE_ZONES_HORIZONTAL = ['Der', 'Centro', 'Izq'] as const;

export function getStageZone(normX: number, normY: number): StageZone {
  const rowIdx = clamp(Math.floor(normY * 3), 0, 2);
  const colIdx = clamp(Math.floor(normX * 3), 0, 2);

  const vertical = STAGE_ZONES_VERTICAL[rowIdx];
  const horizontal = STAGE_ZONES_HORIZONTAL[colIdx];

  const zoneNames: Record<string, string> = {
    'Upstage-Der': 'Upstage Derecha (Fondo Der)',
    'Upstage-Centro': 'Upstage Centro (Fondo)',
    'Upstage-Izq': 'Upstage Izquierda (Fondo Izq)',
    'Center-Der': 'Center Derecha (Centro Der)',
    'Center-Centro': 'Center Centro (Centro)',
    'Center-Izq': 'Center Izquierda (Centro Izq)',
    'Downstage-Der': 'Downstage Derecha (Frente Der)',
    'Downstage-Centro': 'Downstage Centro (Frente)',
    'Downstage-Izq': 'Downstage Izquierda (Frente Izq)',
  };

  return {
    vertical,
    horizontal,
    label: zoneNames[`${vertical}-${horizontal}`] || `${vertical} ${horizontal}`,
  };
}

/**
 * Mapeo de coordenadas normales a rect del canvas manteniendo aspect ratio
 */
export interface StageRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function computeStageRect(
  canvasWidth: number, 
  canvasHeight: number,
  zoom = 1.0,
  pan = { x: 0, y: 0 }
): StageRect {
  const safeW = Math.max(20, canvasWidth);
  const safeH = Math.max(20, canvasHeight);
  const paddingX = Math.min(28, safeW * 0.08);
  const paddingY = Math.min(48, safeH * 0.12);
  let baseW = Math.max(10, safeW - paddingX * 2);
  let baseH = Math.max(10, safeH - paddingY * 2);
  const targetAspect = 1.45; // Relación ancho / alto típica de escenario

  if (baseW / baseH > targetAspect) {
    baseW = baseH * targetAspect;
  } else {
    baseH = baseW / targetAspect;
  }

  const w = baseW * zoom;
  const h = baseH * zoom;
  const centerX = safeW / 2 + pan.x;
  const centerY = safeH / 2 + pan.y;

  return {
    x: centerX - w / 2,
    y: centerY - h / 2,
    w,
    h,
  };
}

export function toScreenCoords(
  normX: number,
  normY: number,
  rect: StageRect,
  isMirror = false
): { x: number; y: number } {
  const px = isMirror ? 1 - normX : normX;
  const py = isMirror ? 1 - normY : normY;
  return {
    x: rect.x + px * rect.w,
    y: rect.y + py * rect.h,
  };
}

export function toNormCoords(
  screenX: number,
  screenY: number,
  rect: StageRect,
  isMirror = false
): { x: number; y: number } {
  let nx = (screenX - rect.x) / rect.w;
  let ny = (screenY - rect.y) / rect.h;
  if (isMirror) {
    nx = 1 - nx;
    ny = 1 - ny;
  }
  return {
    x: clamp(nx, 0, 1),
    y: clamp(ny, 0, 1),
  };
}
