import { Formation, Dancer, CollisionEvent } from '../types/choreo';
import { calculateDancersPose } from './interpolation';

export const COLLISION_RADIUS = 0.058; // Radio umbral de distancia normalizada

/**
 * Calcula distancia euclídea ponderada (el escenario suele ser más ancho que profundo)
 */
export function getDistance(
  posA: { x: number; y: number },
  posB: { x: number; y: number }
): number {
  const dx = (posA.x - posB.x) * 1.4;
  const dy = posA.y - posB.y;
  return Math.hypot(dx, dy);
}

/**
 * Detecta colisiones instantáneas entre bailarines en un momento específico
 */
export function detectInstantCollisions(
  formations: Formation[],
  dancers: Dancer[],
  timeMs: number
): CollisionEvent[] {
  const poses = calculateDancersPose(formations, dancers, timeMs);
  const collisions: CollisionEvent[] = [];
  const dancerList = dancers.filter((d) => poses[d.id]);

  for (let i = 0; i < dancerList.length; i++) {
    for (let j = i + 1; j < dancerList.length; j++) {
      const dA = dancerList[i];
      const dB = dancerList[j];
      const pA = poses[dA.id];
      const pB = poses[dB.id];

      // Si están en diferentes niveles verticales (ej. piso vs arriba), no hay colisión física directa
      if (
        (pA.level === 'piso' && pB.level === 'arriba') ||
        (pA.level === 'arriba' && pB.level === 'piso')
      ) {
        continue;
      }

      const dist = getDistance(pA, pB);
      if (dist < COLLISION_RADIUS) {
        collisions.push({
          timeMs,
          dancerIdA: dA.id,
          dancerIdB: dB.id,
          nameA: dA.name,
          nameB: dB.name,
          distance: dist,
        });
      }
    }
  }

  return collisions;
}

/**
 * Escanea todas las transiciones para detectar puntos de colisión y marcarlos en la línea de tiempo
 */
export function scanProjectCollisions(
  formations: Formation[],
  dancers: Dancer[]
): { timeMs: number; dancerNames: string[] }[] {
  const collisionPoints: { timeMs: number; dancerNames: string[] }[] = [];
  if (!formations || formations.length < 2) return collisionPoints;

  for (let i = 0; i < formations.length - 1; i++) {
    const f = formations[i];
    if (f.transitionDurationMs <= 0) continue;

    const transitionStart = f.startTimeMs + f.holdDurationMs;
    const transitionEnd = transitionStart + f.transitionDurationMs;
    const steps = 30; // 30 muestras por transición

    for (let step = 0; step <= steps; step++) {
      const t = transitionStart + (f.transitionDurationMs * step) / steps;
      const colls = detectInstantCollisions(formations, dancers, t);
      if (colls.length > 0) {
        const names = Array.from(
          new Set(colls.flatMap((c) => [c.nameA, c.nameB]))
        );
        collisionPoints.push({
          timeMs: Math.round(t),
          dancerNames: names,
        });
      }
    }
  }

  return collisionPoints;
}
