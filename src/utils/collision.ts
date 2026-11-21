import { Formation, Dancer, CollisionEvent, PlannedContact } from '../types/choreo';
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
  timeMs: number,
  plannedContacts: PlannedContact[] = []
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
      if (dist < COLLISION_RADIUS && !plannedContacts.some((contact) =>
        timeMs >= contact.startMs && timeMs < contact.endMs &&
        ((contact.dancerIdA === dA.id && contact.dancerIdB === dB.id) ||
         (contact.dancerIdA === dB.id && contact.dancerIdB === dA.id))
      )) {
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
  dancers: Dancer[],
  plannedContacts: PlannedContact[] = []
): { timeMs: number; dancerNames: string[] }[] {
  const collisionPoints: { timeMs: number; dancerNames: string[] }[] = [];
  const sampleTimes = new Set<number>();
  for (const formation of formations) {
    sampleTimes.add(formation.startTimeMs);
    if (formation.transitionDurationMs <= 0) continue;
    const transitionStart = formation.startTimeMs + formation.holdDurationMs;
    for (let step = 0; step <= 30; step++) {
      sampleTimes.add(Math.round(transitionStart + formation.transitionDurationMs * step / 30));
    }
  }

  for (const contact of plannedContacts) sampleTimes.add(contact.endMs);

  for (const timeMs of [...sampleTimes].sort((a, b) => a - b)) {
    const collisions = detectInstantCollisions(formations, dancers, timeMs, plannedContacts);
    if (collisions.length === 0) continue;
    collisionPoints.push({
      timeMs,
      dancerNames: [...new Set(collisions.flatMap((event) => [event.nameA, event.nameB]))],
    });
  }
  return collisionPoints;
}
