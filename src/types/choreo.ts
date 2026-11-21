import type { ScenicObject } from '../utils/scenery';

export type DancerLevel = 'piso' | 'medio' | 'arriba';

export interface Dancer {
  id: string;
  slotNumber: number;
  name: string;
  color: string;
  group: string;
  defaultLevel: DancerLevel;
}

export interface Beat {
  id: string;
  timestampMs: number;
  phraseIndex: number; // Ocho #1, Ocho #2...
  countNumber: number; // 1 al 8
}

export type TrajectoryPathType = 'curve' | 'straight' | 'corner';

export interface DancerPosition {
  x: number; // Normalizado 0.0 a 1.0
  y: number; // Normalizado 0.0 a 1.0
  level: DancerLevel;
  curveOffset: {
    cx: number; // Desplazamiento del punto de control Bézier o punto de quiebre en X
    cy: number; // Desplazamiento del punto de control Bézier o punto de quiebre en Y
  };
  pathType?: TrajectoryPathType; // 'curve' (curva ondulada), 'straight' (recta), 'corner' (en escuadra/ángulo)
  notes?: string;
}

export interface LoopRange {
  startMs: number;
  endMs: number;
  enabled: boolean;
}

export interface Formation {
  id: string;
  name: string;
  startTimeMs: number;
  holdDurationMs: number;
  transitionDurationMs: number;
  positions: Record<string, DancerPosition>;
}

export interface PlannedContact {
  id: string;
  dancerIdA: string;
  dancerIdB: string;
  startMs: number;
  endMs: number;
  description: string;
}

export interface ChoreoProject {
  version: string;
  name: string;
  durationMs: number;
  bpm: number;
  dancers: Dancer[];
  formations: Formation[];
  beats: Beat[];
  audioFileName?: string;
  plannedContacts?: PlannedContact[];
  scenery?: ScenicObject[];
}

// Modelos de Espacio de Trabajo Modular (Adobe Audition / Windows Snap)
export type PanelId = 'dancers' | 'formations' | 'stage' | 'timeline';
export type DockZone = 'left' | 'center' | 'right' | 'bottom' | 'top' | 'floating' | 'hidden';

export interface FloatingWindowConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  isMinimized?: boolean;
}

export interface PanelConfig {
  dock: DockZone;
  previousDock?: Exclude<DockZone, 'hidden'>;
  floating?: FloatingWindowConfig;
  isCollapsed?: boolean;
  order?: number;
  customWidth?: number;
  customHeight?: number;
}

export interface WorkspaceLayout {
  version?: 2;
  panels: Record<PanelId, PanelConfig>;
}

export interface ChoreoSession {
  version: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  project: ChoreoProject;
  layout?: WorkspaceLayout;
  embeddedAudio?: string; // Data URI Base64 opcional para exportar un archivo .choreo todo-en-uno con música incrustada
}

export interface InterpolatedDancerState {
  dancerId: string;
  x: number;
  y: number;
  level: DancerLevel;
  isMoving: boolean;
  progress: number;
  sourceQuadrant: string;
  targetQuadrant: string;
  nextLevel?: DancerLevel;
  timeUntilMoveMs?: number;
}

export interface StageZone {
  vertical: 'Upstage' | 'Center' | 'Downstage';
  horizontal: 'Izq' | 'Centro' | 'Der';
  label: string;
}

export interface CollisionEvent {
  timeMs: number;
  dancerIdA: string;
  dancerIdB: string;
  nameA: string;
  nameB: string;
  distance: number;
}

export type ViewMode = 'choreographer' | 'dancer';

export type SpeedRate = 0.25 | 0.5 | 0.75 | 1 | 1.25 | 1.5;

export interface RealtimeSyncPayload {
  type: 'SYNC_TIME' | 'PLAY_STATE' | 'FULL_STATE' | 'FORMATION_SELECT' | 'DANCER_SELECT' | 'JOIN_ROOM' | 'REQUEST_SYNC';
  roomId: string;
  senderId: string;
  timestamp: number;
  currentTimeMs: number;
  isPlaying: boolean;
  playbackRate: number;
  activeFormationId?: string;
  selectedDancerId?: string;
  project?: ChoreoProject;
}
