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

export interface DancerPosition {
  x: number; // Normalizado 0.0 a 1.0
  y: number; // Normalizado 0.0 a 1.0
  level: DancerLevel;
  curveOffset: {
    cx: number; // Desplazamiento del punto de control Bézier en X
    cy: number; // Desplazamiento del punto de control Bézier en Y
  };
  notes?: string;
}

export interface Formation {
  id: string;
  name: string;
  startTimeMs: number;
  holdDurationMs: number;
  transitionDurationMs: number;
  positions: Record<string, DancerPosition>;
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

export type SpeedRate = 0.5 | 0.75 | 1;

export interface RealtimeSyncPayload {
  type: 'SYNC_TIME' | 'PLAY_STATE' | 'FULL_STATE' | 'FORMATION_SELECT' | 'DANCER_SELECT' | 'JOIN_ROOM';
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
