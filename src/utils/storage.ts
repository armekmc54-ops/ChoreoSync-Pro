import { ChoreoProject, Dancer, Formation, DancerPosition, DancerLevel } from '../types/choreo';
import { generateBeatsForDuration } from './audioSynthesizer';

export const DANCER_COLORS = [
  '#8b5cf6', // Violet
  '#22d3ee', // Cyan
  '#34d399', // Emerald
  '#f472b6', // Pink
  '#fbbf24', // Amber
  '#fb7185', // Rose
  '#60a5fa', // Blue
  '#a3e635', // Lime
];

export const DANCER_LEVELS: DancerLevel[] = ['piso', 'medio', 'arriba'];

export function createDemoProject(): ChoreoProject {
  const dancerNames = ['Ana', 'Beto', 'Carla', 'Dani', 'Eli', 'Fer', 'Gabo', 'Hugo'];
  const dancers: Dancer[] = dancerNames.map((name, i) => ({
    id: `dancer_${i + 1}`,
    slotNumber: i + 1,
    name,
    color: DANCER_COLORS[i % DANCER_COLORS.length],
    group: i < 4 ? 'Grupo Alfa' : 'Grupo Beta',
    defaultLevel: 'medio',
  }));

  // Formación 1: Línea frontal (Proscenio / Downstage)
  const f1Positions: Record<string, DancerPosition> = {};
  dancers.forEach((d, i) => {
    f1Positions[d.id] = {
      x: 0.12 + (i * 0.76) / 7,
      y: 0.82,
      level: 'medio',
      curveOffset: { cx: 0, cy: 0 },
      notes: 'Línea de impacto frontal hacia el público',
    };
  });

  // Formación 2: Círculo dinámico en el centro
  const f2Positions: Record<string, DancerPosition> = {};
  dancers.forEach((d, i) => {
    const angle = (i * Math.PI * 2) / dancers.length;
    f2Positions[d.id] = {
      x: 0.5 + 0.28 * Math.cos(angle),
      y: 0.5 + 0.28 * Math.sin(angle),
      level: i % 2 === 0 ? 'arriba' : 'medio',
      curveOffset: i % 2 === 0 ? { cx: 0.08, cy: -0.1 } : { cx: -0.08, cy: 0.1 },
      notes: 'Rotación circular concéntrica',
    };
  });

  // Formación 3: Dos Columnas de impacto escénico
  const f3Positions: Record<string, DancerPosition> = {};
  dancers.forEach((d, i) => {
    const isLeft = i < 4;
    const row = i % 4;
    f3Positions[d.id] = {
      x: isLeft ? 0.28 : 0.72,
      y: 0.22 + row * 0.2,
      level: isLeft ? 'arriba' : 'piso',
      curveOffset: { cx: 0, cy: 0 },
      notes: 'Columnas simétricas en profundidad',
    };
  });

  const formations: Formation[] = [
    {
      id: 'form_1',
      name: 'Línea frontal',
      startTimeMs: 0,
      holdDurationMs: 4000,
      transitionDurationMs: 2000,
      positions: f1Positions,
    },
    {
      id: 'form_2',
      name: 'Círculo dinámico',
      startTimeMs: 6000,
      holdDurationMs: 3000,
      transitionDurationMs: 3000,
      positions: f2Positions,
    },
    {
      id: 'form_3',
      name: 'Dos columnas',
      startTimeMs: 12000,
      holdDurationMs: 4000,
      transitionDurationMs: 0,
      positions: f3Positions,
    },
  ];

  const durationMs = 16000;
  const beats = generateBeatsForDuration(durationMs, 120);

  return {
    version: '1.0.0',
    name: 'Coreografía Demo - ChoreoSync Pro',
    durationMs,
    bpm: 120,
    dancers,
    formations,
    beats,
  };
}

const STORAGE_KEY = 'choreosync_pro_project_v1';

export function saveProjectToLocalStorage(project: ChoreoProject): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  } catch (err) {
    console.error('Error guardando en localStorage:', err);
  }
}

export function loadProjectFromLocalStorage(): ChoreoProject | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.dancers) && Array.isArray(parsed.formations)) {
      return parsed as ChoreoProject;
    }
  } catch (err) {
    console.error('Error cargando de localStorage:', err);
  }
  return null;
}

export function exportProjectToJsonFile(project: ChoreoProject): void {
  const jsonStr = JSON.stringify(project, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.name.toLowerCase().replace(/[^a-z0-9]/gi, '_')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importProjectFromJsonFile(file: File): Promise<ChoreoProject> {
  const text = await file.text();
  const parsed = JSON.parse(text);
  if (!parsed.dancers || !parsed.formations || !Array.isArray(parsed.formations)) {
    throw new Error('El archivo JSON no tiene una estructura válida de ChoreoSync Pro.');
  }
  return parsed as ChoreoProject;
}
