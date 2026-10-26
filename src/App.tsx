import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ChoreoProject, 
  Dancer, 
  Formation, 
  DancerPosition,
  Beat, 
  ViewMode, 
  SpeedRate, 
  CollisionEvent,
  PanelId,
  DockZone,
  WorkspaceLayout,
  ChoreoSession
} from './types/choreo';
import { 
  createDemoProject, 
  createBlankProject,
  saveProjectToLocalStorage, 
  loadProjectFromLocalStorage, 
  saveSessionToLocalStorage,
  loadSessionFromLocalStorage,
  exportSessionToFile,
  importSessionFromFile,
  exportProjectToJsonFile, 
  importProjectFromJsonFile, 
  getDefaultWorkspaceLayout,
  DANCER_COLORS 
} from './utils/storage';
import { globalAudioEngine, generateBeatsForDuration } from './utils/audioSynthesizer';
import { scanProjectCollisions } from './utils/collision';
import { calculateDancersPose } from './utils/interpolation';
import { realtimeManager } from './utils/realtime';

import { AppMenuBar } from './components/Header/AppMenuBar';
import { Header } from './components/Header/Header';
import { StageCanvas } from './components/StageCanvas/StageCanvas';
import { Timeline } from './components/Timeline/Timeline';
import { AudioControls } from './components/AudioEngine/AudioControls';
import { DancersPanel } from './components/ChoreographerStudio/DancersPanel';
import { FormationsPanel } from './components/ChoreographerStudio/FormationsPanel';
import { SnapLayoutOverlay } from './components/ChoreographerStudio/SnapLayoutOverlay';
import { FloatingPanel } from './components/ChoreographerStudio/FloatingPanel';
import { DancerView } from './components/DancerView/DancerView';
import { MobileDancerScreen } from './components/DancerView/MobileDancerScreen';
import { LiveRoomModal } from './components/RealtimeRoom/LiveRoomModal';
import { 
  Compass, 
  GitCommit, 
  AlertTriangle, 
  GripVertical, 
  ArrowUpDown, 
  ExternalLink, 
  HelpCircle, 
  X, 
  Keyboard, 
  ShieldCheck 
} from 'lucide-react';

export const App: React.FC = () => {
  // Inicialización de proyecto y sesión desde localStorage o demo
  const [project, setProject] = useState<ChoreoProject>(() => {
    const savedSession = loadSessionFromLocalStorage();
    if (savedSession?.project && Array.isArray(savedSession.project.formations)) {
      return savedSession.project;
    }
    const saved = loadProjectFromLocalStorage();
    return saved || createDemoProject();
  });

  const [sessionName, setSessionName] = useState<string>(() => {
    const saved = loadSessionFromLocalStorage();
    return saved?.name || 'Sesión Coreográfica Principal';
  });

  // Espacio de trabajo modular (Estilo Adobe Audition / Premiere & Windows 11 Snap)
  const [layout, setLayout] = useState<WorkspaceLayout>(() => {
    const saved = loadSessionFromLocalStorage();
    return saved?.layout || getDefaultWorkspaceLayout();
  });

  const [visiblePanels, setVisiblePanels] = useState<Record<PanelId, boolean>>({
    dancers: true,
    formations: true,
    stage: true,
    timeline: true,
  });

  // Estados de arrastre con Snap Layouts estilo Windows 11
  const [isDraggingSnap, setIsDraggingSnap] = useState<boolean>(false);
  const [activeDragPanel, setActiveDragPanel] = useState<PanelId | null>(null);
  const [hoveredZone, setHoveredZone] = useState<DockZone | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('mode') === 'dancer') return 'dancer';
    }
    return 'choreographer';
  });

  const [roomId, setRoomId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const r = params.get('room');
      if (r) return r.toUpperCase();
    }
    return 'SALA-CHOREO-1';
  });

  // Estado de reproducción y tiempo
  const [currentTimeMs, setCurrentTimeMs] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<SpeedRate>(1);
  const [isLoopPhrase, setIsLoopPhrase] = useState<boolean>(false);
  const [isMetronomeEnabled, setIsMetronomeEnabled] = useState<boolean>(true);
  const [isRecordCountsMode, setIsRecordCountsMode] = useState<boolean>(false);

  // Selecciones activas
  const [selectedFormationId, setSelectedFormationId] = useState<string>(() => project.formations[0]?.id || '');
  const [selectedFormationIds, setSelectedFormationIds] = useState<string[]>(() => 
    project.formations[0]?.id ? [project.formations[0].id] : []
  );
  const [selectedDancerId, setSelectedDancerId] = useState<string | null>(() => project.dancers[0]?.id || null);

  // Modos de visualización y Modales
  const [isMirror, setIsMirror] = useState<boolean>(false);
  const [showAllPaths, setShowAllPaths] = useState<boolean>(false);
  const [isLiveModalOpen, setIsLiveModalOpen] = useState<boolean>(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState<boolean>(false);
  const [showOfflineHelp, setShowOfflineHelp] = useState<boolean>(false);

  // Dimensiones de paneles resizables
  const [sidebarWidth, setSidebarWidth] = useState<number>(270);
  const [rightSidebarWidth, setRightSidebarWidth] = useState<number>(270);
  const [timelineHeight, setTimelineHeight] = useState<number>(190);

  // Redimensionamiento interactivo de paneles (Splitters)
  const isResizingSidebar = useRef(false);
  const isResizingRightSidebar = useRef(false);
  const isResizingTimeline = useRef(false);

  const startResizeSidebar = (e: React.PointerEvent) => {
    isResizingSidebar.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const startResizeRightSidebar = (e: React.PointerEvent) => {
    isResizingRightSidebar.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const startResizeTimeline = (e: React.PointerEvent) => {
    isResizingTimeline.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMoveGlobal = (e: React.PointerEvent) => {
    if (isResizingSidebar.current) {
      setSidebarWidth(Math.max(180, Math.min(500, e.clientX)));
    }
    if (isResizingRightSidebar.current) {
      setRightSidebarWidth(Math.max(180, Math.min(500, window.innerWidth - e.clientX)));
    }
    if (isResizingTimeline.current) {
      if (layout.panels.timeline.dock === 'top') {
        setTimelineHeight(Math.max(120, Math.min(400, e.clientY - 60)));
      } else {
        setTimelineHeight(Math.max(120, Math.min(400, window.innerHeight - e.clientY)));
      }
    }
  };

  const handlePointerUpGlobal = (e: React.PointerEvent) => {
    if (isResizingSidebar.current) {
      isResizingSidebar.current = false;
      try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    }
    if (isResizingRightSidebar.current) {
      isResizingRightSidebar.current = false;
      try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    }
    if (isResizingTimeline.current) {
      isResizingTimeline.current = false;
      try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    }
  };

  // Datos derivados
  const [peaks, setPeaks] = useState<number[]>([]);
  const [collisionTimes, setCollisionTimes] = useState<number[]>([]);
  const [activeCollisions, setActiveCollisions] = useState<CollisionEvent[]>([]);

  // Referencias mutables para animación a 60 FPS sin jitter
  const animTimeRef = useRef<{
    t0: number;
    c0: number;
    lastCur: number;
    resetNextCount: boolean;
  }>({
    t0: 0,
    c0: 0,
    lastCur: 0,
    resetNextCount: false,
  });

  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const currentTimeMsRef = useRef(currentTimeMs);
  currentTimeMsRef.current = currentTimeMs;
  const projectRef = useRef(project);
  projectRef.current = project;
  const isLoopPhraseRef = useRef(isLoopPhrase);
  isLoopPhraseRef.current = isLoopPhrase;
  const isMetronomeEnabledRef = useRef(isMetronomeEnabled);
  isMetronomeEnabledRef.current = isMetronomeEnabled;
  const playbackRateRef = useRef(playbackRate);
  playbackRateRef.current = playbackRate;

  // Sincronización en tiempo real inicial y manejo de REQUEST_SYNC
  useEffect(() => {
    realtimeManager.setRoomId(roomId);
    realtimeManager.connectWebSocket();

    const unsubscribe = realtimeManager.subscribe((payload) => {
      if (payload.type === 'SYNC_TIME' || payload.type === 'PLAY_STATE') {
        setCurrentTimeMs(payload.currentTimeMs);
        currentTimeMsRef.current = payload.currentTimeMs;
        setIsPlaying(payload.isPlaying);
        isPlayingRef.current = payload.isPlaying;
        if (payload.activeFormationId) {
          setSelectedFormationId(payload.activeFormationId);
        }
      } else if (payload.type === 'FULL_STATE' && payload.project) {
        setProject(payload.project);
        saveProjectToLocalStorage(payload.project);
        if (payload.currentTimeMs !== undefined) {
          setCurrentTimeMs(payload.currentTimeMs);
          currentTimeMsRef.current = payload.currentTimeMs;
        }
        if (payload.isPlaying !== undefined) {
          setIsPlaying(payload.isPlaying);
          isPlayingRef.current = payload.isPlaying;
        }
      } else if (payload.type === 'REQUEST_SYNC') {
        // Enviar el estado completo del proyecto al nuevo bailarín conectado
        realtimeManager.broadcast({
          type: 'FULL_STATE',
          roomId,
          senderId: realtimeManager.senderId,
          timestamp: Date.now(),
          currentTimeMs: currentTimeMsRef.current,
          isPlaying: isPlayingRef.current,
          playbackRate: playbackRateRef.current,
          project: projectRef.current,
          activeFormationId: selectedFormationId,
        });
      }
    });

    // Si estamos en modo bailarín, solicitar sincronización inmediatamente
    if (viewMode === 'dancer') {
      setTimeout(() => {
        realtimeManager.broadcast({
          type: 'REQUEST_SYNC',
          roomId,
          senderId: realtimeManager.senderId,
          timestamp: Date.now(),
          currentTimeMs: 0,
          isPlaying: false,
          playbackRate: 1,
        });
      }, 400);
    }

    return () => unsubscribe();
  }, [roomId, viewMode, selectedFormationId]);

  // Recalcular colisiones globales y picos sintéticos al cambiar el proyecto
  useEffect(() => {
    const colls = scanProjectCollisions(project.formations, project.dancers);
    setCollisionTimes(colls.map((c) => c.timeMs));

    if (globalAudioEngine.isUsingSyntheticAudio()) {
      const synPeaks = globalAudioEngine.generateSyntheticPeaks(
        project.durationMs,
        project.beats
      );
      setPeaks(synPeaks);
    }
  }, [project.formations, project.dancers, project.beats, project.durationMs]);

  // Auto-guardado de sesión y proyecto en localStorage
  useEffect(() => {
    saveProjectToLocalStorage(project);
    const session: ChoreoSession = {
      version: '1.0.0',
      name: sessionName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      project,
      layout,
    };
    saveSessionToLocalStorage(session);
  }, [project, layout, sessionName]);

  // Encontrar el conteo activo actual
  const currentBeat = project.beats.reduce<Beat | null>((acc, b) => {
    if (b.timestampMs <= currentTimeMs + 10) return b;
    return acc;
  }, null);

  // Transmisión en vivo instantánea hacia todos los celulares de los bailarines
  const broadcastFullState = useCallback((projToBroadcast?: ChoreoProject) => {
    const p = projToBroadcast || projectRef.current;
    realtimeManager.broadcast({
      type: 'FULL_STATE',
      roomId,
      senderId: realtimeManager.senderId,
      timestamp: Date.now(),
      currentTimeMs: currentTimeMsRef.current,
      isPlaying: isPlayingRef.current,
      playbackRate: playbackRateRef.current,
      project: p,
      activeFormationId: selectedFormationId,
    });
  }, [roomId, selectedFormationId]);

  // Función seek de tiempo precisa
  const handleSeek = useCallback(
    (timeMs: number, broadcast = true) => {
      const clamped = Math.max(0, Math.min(projectRef.current.durationMs, timeMs));
      setCurrentTimeMs(clamped);
      currentTimeMsRef.current = clamped;
      animTimeRef.current.t0 = performance.now();
      animTimeRef.current.c0 = clamped;
      animTimeRef.current.lastCur = clamped;

      const aud = globalAudioEngine.getAudioElement();
      if (aud && !globalAudioEngine.isUsingSyntheticAudio()) {
        aud.currentTime = clamped / 1000;
      }

      // Sincronizar selección de formación activa
      let activeFId = projectRef.current.formations[0]?.id;
      for (const f of projectRef.current.formations) {
        if (f.startTimeMs <= clamped) {
          activeFId = f.id;
        } else {
          break;
        }
      }
      if (activeFId) {
        setSelectedFormationId(activeFId);
      }

      if (broadcast) {
        realtimeManager.broadcast({
          type: 'SYNC_TIME',
          roomId,
          senderId: realtimeManager.senderId,
          timestamp: Date.now(),
          currentTimeMs: clamped,
          isPlaying: isPlayingRef.current,
          playbackRate: playbackRateRef.current,
          activeFormationId: activeFId,
        });
      }
    },
    [roomId]
  );

  // Control Play / Pausa
  const handleTogglePlay = useCallback(() => {
    const nextPlay = !isPlayingRef.current;
    setIsPlaying(nextPlay);
    isPlayingRef.current = nextPlay;

    const ctx = globalAudioEngine.getContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    if (nextPlay) {
      if (currentTimeMsRef.current >= projectRef.current.durationMs - 50) {
        handleSeek(0, false);
      }
      animTimeRef.current.t0 = performance.now();
      animTimeRef.current.c0 = currentTimeMsRef.current;
      animTimeRef.current.lastCur = currentTimeMsRef.current;

      const aud = globalAudioEngine.getAudioElement();
      if (aud && !globalAudioEngine.isUsingSyntheticAudio()) {
        aud.playbackRate = playbackRateRef.current;
        aud.currentTime = currentTimeMsRef.current / 1000;
        aud.play().catch(() => {});
      }
    } else {
      const aud = globalAudioEngine.getAudioElement();
      if (aud) {
        aud.pause();
      }
    }

    realtimeManager.broadcast({
      type: 'PLAY_STATE',
      roomId,
      senderId: realtimeManager.senderId,
      timestamp: Date.now(),
      currentTimeMs: currentTimeMsRef.current,
      isPlaying: nextPlay,
      playbackRate: playbackRateRef.current,
    });
  }, [handleSeek, roomId]);

  const handleStop = useCallback(() => {
    setIsPlaying(false);
    isPlayingRef.current = false;
    const aud = globalAudioEngine.getAudioElement();
    if (aud) aud.pause();
    handleSeek(0);
  }, [handleSeek]);

  // TAP-TO-BEAT (Marcar conteo en vivo de 1 a 8)
  const handleTapBeat = useCallback(() => {
    const cur = Math.round(currentTimeMsRef.current);
    const beats = [...projectRef.current.beats];
    const lastBeat = beats[beats.length - 1];

    let countNumber = 1;
    let phraseIndex = 1;

    if (lastBeat) {
      if (animTimeRef.current.resetNextCount) {
        phraseIndex = lastBeat.phraseIndex + 1;
        countNumber = 1;
        animTimeRef.current.resetNextCount = false;
      } else {
        if (lastBeat.countNumber >= 8) {
          phraseIndex = lastBeat.phraseIndex + 1;
          countNumber = 1;
        } else {
          phraseIndex = lastBeat.phraseIndex;
          countNumber = lastBeat.countNumber + 1;
        }
      }
    }

    const newBeat: Beat = {
      id: 'beat_' + Date.now(),
      timestampMs: cur,
      phraseIndex,
      countNumber,
    };

    const updated = [...beats, newBeat].sort((a, b) => a.timestampMs - b.timestampMs);
    const newProj = { ...projectRef.current, beats: updated };
    setProject(newProj);
    broadcastFullState(newProj);
  }, [broadcastFullState]);

  const handleResetCountToOne = () => {
    animTimeRef.current.resetNextCount = true;
  };

  const handleClearBeats = () => {
    if (window.confirm('¿Deseas borrar todos los conteos marcados?')) {
      const newProj = { ...projectRef.current, beats: [] };
      setProject(newProj);
      broadcastFullState(newProj);
    }
  };

  // Ciclo principal de animación a 60 FPS
  useEffect(() => {
    let animId: number;

    const tick = () => {
      if (isPlayingRef.current) {
        const now = performance.now();
        const delta = (now - animTimeRef.current.t0) * playbackRateRef.current;
        let nextTime = animTimeRef.current.c0 + delta;

        // Soporte bucle por Ocho
        if (isLoopPhraseRef.current && projectRef.current.beats.length > 0) {
          const activeB = projectRef.current.beats.reduce<Beat | null>((acc, b) => {
            if (b.timestampMs <= nextTime) return b;
            return acc;
          }, null);

          if (activeB) {
            const phraseBeats = projectRef.current.beats.filter(
              (b) => b.phraseIndex === activeB.phraseIndex
            );
            const pStart = phraseBeats[0]?.timestampMs || 0;
            const pEnd = (phraseBeats[phraseBeats.length - 1]?.timestampMs || 0) + 600;

            if (nextTime >= pEnd && pEnd > pStart) {
              nextTime = pStart;
              animTimeRef.current.t0 = now;
              animTimeRef.current.c0 = pStart;
              const aud = globalAudioEngine.getAudioElement();
              if (aud && !globalAudioEngine.isUsingSyntheticAudio()) {
                aud.currentTime = pStart / 1000;
              }
            }
          }
        }

        // Fin de canción
        if (nextTime >= projectRef.current.durationMs) {
          nextTime = projectRef.current.durationMs;
          setIsPlaying(false);
          isPlayingRef.current = false;
          const aud = globalAudioEngine.getAudioElement();
          if (aud) aud.pause();
        }

        // Metrónomo sintético con Web Audio API
        if (isMetronomeEnabledRef.current) {
          projectRef.current.beats.forEach((b) => {
            if (b.timestampMs > animTimeRef.current.lastCur && b.timestampMs <= nextTime) {
              globalAudioEngine.playBeatClick(b.countNumber);
            }
          });
        }

        animTimeRef.current.lastCur = nextTime;
        setCurrentTimeMs(nextTime);
        currentTimeMsRef.current = nextTime;
      }
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  // CRUD de Bailarines
  const handleAddDancer = () => {
    const nextSlot = project.dancers.length + 1;
    const color = DANCER_COLORS[(nextSlot - 1) % DANCER_COLORS.length];
    const newDancer: Dancer = {
      id: 'dancer_' + Date.now(),
      slotNumber: nextSlot,
      name: `Bailarín ${nextSlot}`,
      color,
      group: nextSlot <= 4 ? 'Grupo Alfa' : 'Grupo Beta',
      defaultLevel: 'medio',
    };

    const updatedFormations = project.formations.map((f) => ({
      ...f,
      positions: {
        ...f.positions,
        [newDancer.id]: {
          x: 0.5,
          y: 0.5,
          level: 'medio' as const,
          curveOffset: { cx: 0, cy: 0 },
          notes: '',
        },
      },
    }));

    const newProj = {
      ...project,
      dancers: [...project.dancers, newDancer],
      formations: updatedFormations,
    };
    setProject(newProj);
    setSelectedDancerId(newDancer.id);
    broadcastFullState(newProj);
  };

  const handleUpdateDancer = (dancerId: string, updates: Partial<Dancer>) => {
    setProject((prev) => {
      const newProj = {
        ...prev,
        dancers: prev.dancers.map((d) => (d.id === dancerId ? { ...d, ...updates } : d)),
      };
      broadcastFullState(newProj);
      return newProj;
    });
  };

  const handleDeleteDancer = (dancerId: string) => {
    if (project.dancers.length <= 1) return;
    const updatedFormations = project.formations.map((f) => {
      const pos = { ...f.positions };
      delete pos[dancerId];
      return { ...f, positions: pos };
    });

    setProject((prev) => {
      const newProj = {
        ...prev,
        dancers: prev.dancers.filter((d) => d.id !== dancerId),
        formations: updatedFormations,
      };
      broadcastFullState(newProj);
      return newProj;
    });

    if (selectedDancerId === dancerId) {
      setSelectedDancerId(project.dancers[0]?.id || null);
    }
  };

  // CRUD de Formaciones
  const handleAddFormationAtTime = (timeMs: number) => {
    const poses = calculateDancersPose(project.formations, project.dancers, timeMs);
    const newPositions: Record<string, DancerPosition> = {};

    project.dancers.forEach((d) => {
      const p = poses[d.id] || { x: 0.5, y: 0.5, level: 'medio' as const };
      newPositions[d.id] = {
        x: p.x,
        y: p.y,
        level: p.level,
        curveOffset: { cx: 0, cy: 0 },
        notes: '',
      };
    });

    const newFormation: Formation = {
      id: 'form_' + Date.now(),
      name: `Formación ${project.formations.length + 1}`,
      startTimeMs: Math.round(timeMs),
      holdDurationMs: 2500,
      transitionDurationMs: 2000,
      positions: newPositions,
    };

    const updated = [...project.formations, newFormation].sort(
      (a, b) => a.startTimeMs - b.startTimeMs
    );

    const newProj = {
      ...project,
      formations: updated,
    };
    setProject(newProj);
    setSelectedFormationId(newFormation.id);
    setSelectedFormationIds([newFormation.id]);
    broadcastFullState(newProj);
  };

  const handleUpdateFormation = (formationId: string, updates: Partial<Formation>) => {
    setProject((prev) => {
      const newProj = {
        ...prev,
        formations: prev.formations.map((f) =>
          f.id === formationId ? { ...f, ...updates } : f
        ),
      };
      broadcastFullState(newProj);
      return newProj;
    });
  };

  const handleDeleteFormation = (formationId: string) => {
    if (project.formations.length <= 1) return;
    const updated = project.formations.filter((f) => f.id !== formationId);
    const newProj = {
      ...project,
      formations: updated,
    };
    setProject(newProj);
    if (selectedFormationId === formationId) {
      setSelectedFormationId(updated[0].id);
      setSelectedFormationIds([updated[0].id]);
    }
    broadcastFullState(newProj);
  };

  const handleDeleteFormations = (formationIds: string[]) => {
    if (project.formations.length <= formationIds.length) {
      alert('Debe quedar al menos una formación en el proyecto.');
      return;
    }
    const updated = project.formations.filter((f) => !formationIds.includes(f.id));
    const newProj = {
      ...project,
      formations: updated,
    };
    setProject(newProj);
    setSelectedFormationId(updated[0].id);
    setSelectedFormationIds([updated[0].id]);
    broadcastFullState(newProj);
  };

  const handleDuplicateFormation = (fid?: string) => {
    const targetId = fid || selectedFormationId;
    const form = project.formations.find((f) => f.id === targetId);
    if (!form) return;

    const newStartTime = form.startTimeMs + form.holdDurationMs + form.transitionDurationMs + 500;
    const duplicated: Formation = {
      ...form,
      id: 'form_' + Date.now(),
      name: `${form.name} (Copia)`,
      startTimeMs: Math.min(project.durationMs - 2000, Math.round(newStartTime)),
      positions: JSON.parse(JSON.stringify(form.positions)),
    };

    const updated = [...project.formations, duplicated].sort((a, b) => a.startTimeMs - b.startTimeMs);
    const newProj = {
      ...project,
      formations: updated,
    };
    setProject(newProj);
    setSelectedFormationId(duplicated.id);
    setSelectedFormationIds([duplicated.id]);
    broadcastFullState(newProj);
  };

  const handleSelectAllFormations = () => {
    setSelectedFormationIds(project.formations.map((f) => f.id));
  };

  // Posicionamiento de bailarines en el canvas en tiempo real
  const lastDancerPosBroadcast = useRef<number>(0);
  const handleUpdateDancerPosition = (
    formationId: string,
    dancerId: string,
    normX: number,
    normY: number
  ) => {
    setProject((prev) => {
      const form = prev.formations.find((f) => f.id === formationId);
      if (!form || !form.positions[dancerId]) return prev;

      const updatedPos = {
        ...form.positions,
        [dancerId]: {
          ...form.positions[dancerId],
          x: normX,
          y: normY,
        },
      };

      const newProj = {
        ...prev,
        formations: prev.formations.map((f) =>
          f.id === formationId ? { ...f, positions: updatedPos } : f
        ),
      };

      // Transmisión en vivo continua throttled a 50ms para 60 FPS ultra fluido en celulares
      const now = performance.now();
      if (now - lastDancerPosBroadcast.current > 50) {
        lastDancerPosBroadcast.current = now;
        broadcastFullState(newProj);
      }

      return newProj;
    });
  };

  const handleEndUpdateDancerPosition = () => {
    broadcastFullState(projectRef.current);
  };

  const handleUpdateDancerCurveOffset = (
    formationId: string,
    dancerId: string,
    cx: number,
    cy: number
  ) => {
    setProject((prev) => {
      const form = prev.formations.find((f) => f.id === formationId);
      if (!form || !form.positions[dancerId]) return prev;

      const updatedPos = {
        ...form.positions,
        [dancerId]: {
          ...form.positions[dancerId],
          curveOffset: { cx, cy },
        },
      };

      const newProj = {
        ...prev,
        formations: prev.formations.map((f) =>
          f.id === formationId ? { ...f, positions: updatedPos } : f
        ),
      };

      broadcastFullState(newProj);
      return newProj;
    });
  };

  // Manejo de Sesiones y Archivos
  const handleNewSession = () => {
    if (window.confirm('¿Crear una nueva sesión en blanco?')) {
      handleStop();
      const blank = createBlankProject();
      const newLayout = getDefaultWorkspaceLayout();
      setProject(blank);
      setLayout(newLayout);
      setSessionName('Nueva Sesión Coreográfica');
      setSelectedFormationId(blank.formations[0]?.id || '');
      setSelectedFormationIds(blank.formations[0]?.id ? [blank.formations[0].id] : []);
      setSelectedDancerId(blank.dancers[0]?.id || null);
      handleSeek(0);
      broadcastFullState(blank);
    }
  };

  const handleOpenSession = async (file: File) => {
    try {
      handleStop();
      const loaded = await importSessionFromFile(file);
      setProject(loaded.project);
      if (loaded.layout) setLayout(loaded.layout);
      if (loaded.name) setSessionName(loaded.name);
      setSelectedFormationId(loaded.project.formations[0]?.id || '');
      setSelectedFormationIds(loaded.project.formations[0]?.id ? [loaded.project.formations[0].id] : []);
      setSelectedDancerId(loaded.project.dancers[0]?.id || null);
      handleSeek(0);
      broadcastFullState(loaded.project);
    } catch (err: any) {
      alert(err.message || 'Error abriendo archivo de sesión (.choreo).');
    }
  };

  const handleSaveSession = () => {
    const session: ChoreoSession = {
      version: '1.0.0',
      name: sessionName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      project,
      layout,
    };
    saveSessionToLocalStorage(session);
    exportSessionToFile(session, sessionName);
  };

  const handleSaveSessionAs = () => {
    const newName = window.prompt('Introduce el nombre para la sesión:', sessionName);
    if (newName && newName.trim()) {
      setSessionName(newName.trim());
      const session: ChoreoSession = {
        version: '1.0.0',
        name: newName.trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        project: { ...project, name: newName.trim() },
        layout,
      };
      saveSessionToLocalStorage(session);
      exportSessionToFile(session, newName.trim());
    }
  };

  // ATAJOS DE TECLADO GLOBALES
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      // Ctrl+S / Cmd+S -> Guardar sesión
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveSession();
        return;
      }

      // Ctrl+N -> Nueva sesión
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleNewSession();
        return;
      }

      // Ctrl+A -> Seleccionar todas las formaciones
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        handleSelectAllFormations();
        return;
      }

      // Ctrl+D -> Duplicar formación
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleDuplicateFormation();
        return;
      }

      // Espacio o Tecla S -> Play/Pausa o Tap Beat
      if (e.code === 'Space' || e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (isRecordCountsMode) {
          handleTapBeat();
        } else {
          handleTogglePlay();
        }
        return;
      }

      // Flechas -> Avanzar / retroceder entre conteos
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const nextB = project.beats.find((b) => b.timestampMs > currentTimeMs + 10);
        if (nextB) handleSeek(nextB.timestampMs);
        else handleSeek(currentTimeMs + 500);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const prevBeats = project.beats.filter((b) => b.timestampMs < currentTimeMs - 10);
        if (prevBeats.length > 0) {
          handleSeek(prevBeats[prevBeats.length - 1].timestampMs);
        } else {
          handleSeek(Math.max(0, currentTimeMs - 500));
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleSaveSession, isRecordCountsMode, handleTapBeat, handleTogglePlay, project.beats, currentTimeMs, handleSeek]);

  const handleResetDemo = () => {
    if (window.confirm('¿Restaurar la coreografía demo completa (8 bailarines, 3 formaciones)?')) {
      handleStop();
      globalAudioEngine.setSyntheticMode(true);
      const demo = createDemoProject();
      setProject(demo);
      setSelectedFormationId(demo.formations[0].id);
      setSelectedFormationIds([demo.formations[0].id]);
      setSelectedDancerId(demo.dancers[0].id);
      handleSeek(0);
      broadcastFullState(demo);
    }
  };

  const handleResetLayout = () => {
    setLayout(getDefaultWorkspaceLayout());
    setVisiblePanels({
      dancers: true,
      formations: true,
      stage: true,
      timeline: true,
    });
  };

  const handleTogglePanel = (panelId: PanelId) => {
    setVisiblePanels((prev) => ({
      ...prev,
      [panelId]: !prev[panelId],
    }));
  };

  // Manejo de Arrastre Snap Layouts estilo Windows 11
  const handleStartDragSnap = (panelId: PanelId) => {
    setActiveDragPanel(panelId);
    setIsDraggingSnap(true);
    setHoveredZone(null);
  };

  const handleDropZone = (zone: DockZone) => {
    if (!activeDragPanel) {
      setIsDraggingSnap(false);
      return;
    }
    setLayout((prev) => ({
      ...prev,
      panels: {
        ...prev.panels,
        [activeDragPanel]: {
          ...prev.panels[activeDragPanel],
          dock: zone,
        },
      },
    }));
    setIsDraggingSnap(false);
    setActiveDragPanel(null);
    setHoveredZone(null);
  };

  const handleQuickDock = (panelId: PanelId, zone: DockZone) => {
    setLayout((prev) => ({
      ...prev,
      panels: {
        ...prev.panels,
        [panelId]: {
          ...prev.panels[panelId],
          dock: zone,
        },
      },
    }));
  };

  // Carga de archivos de Audio
  const handleUploadAudio = async (file: File) => {
    try {
      handleStop();
      const loaded = await globalAudioEngine.loadAudioFile(file);
      setPeaks(loaded.peaks);
      setIsMetronomeEnabled(false);
      setIsRecordCountsMode(true);

      setProject((prev) => ({
        ...prev,
        durationMs: loaded.durationMs,
        audioFileName: file.name,
      }));
    } catch {
      alert('No se pudo decodificar el archivo de audio. Verifica que sea un archivo válido (.mp3, .wav, .m4a).');
    }
  };

  const handleSyntheticAudio = () => {
    handleStop();
    globalAudioEngine.setSyntheticMode(true);
    const durationMs = Math.max(16000, project.durationMs);
    const beats = generateBeatsForDuration(durationMs, 120);
    const synPeaks = globalAudioEngine.generateSyntheticPeaks(durationMs, beats);
    setPeaks(synPeaks);
    setIsMetronomeEnabled(true);

    setProject((prev) => ({
      ...prev,
      durationMs,
      bpm: 120,
      beats,
    }));
  };

  // Renderizadores de Paneles
  const renderDancersContent = () => (
    <DancersPanel
      dancers={project.dancers}
      activeFormation={project.formations.find((f) => f.id === selectedFormationId)}
      selectedDancerId={selectedDancerId}
      currentDock={layout.panels.dancers.dock}
      onSelectDancer={setSelectedDancerId}
      onAddDancer={handleAddDancer}
      onUpdateDancer={handleUpdateDancer}
      onDeleteDancer={handleDeleteDancer}
      onUpdateFormation={handleUpdateFormation}
      onStartDragSnap={() => handleStartDragSnap('dancers')}
      onQuickDock={(zone) => handleQuickDock('dancers', zone)}
    />
  );

  const renderFormationsContent = () => (
    <FormationsPanel
      formations={project.formations}
      selectedFormationId={selectedFormationId}
      selectedFormationIds={selectedFormationIds}
      currentDock={layout.panels.formations.dock}
      onSelectFormation={(fid, isMulti) => {
        setSelectedFormationId(fid);
        if (isMulti) {
          setSelectedFormationIds((prev) =>
            prev.includes(fid) ? prev.filter((id) => id !== fid) : [...prev, fid]
          );
        } else {
          setSelectedFormationIds([fid]);
        }
        const f = project.formations.find((item) => item.id === fid);
        if (f) handleSeek(f.startTimeMs);
      }}
      onAddFormation={() => handleAddFormationAtTime(currentTimeMs)}
      onUpdateFormation={handleUpdateFormation}
      onDeleteFormation={handleDeleteFormation}
      onDeleteFormations={handleDeleteFormations}
      onDuplicateFormation={handleDuplicateFormation}
      onStartDragSnap={() => handleStartDragSnap('formations')}
      onQuickDock={(zone) => handleQuickDock('formations', zone)}
    />
  );

  const renderTimelineContent = () => (
    <div className="flex flex-col w-full h-full bg-slate-900 border-slate-800">
      {/* Barra de título con 6 puntos para arrastre snap */}
      <div 
        onPointerDown={() => handleStartDragSnap('timeline')}
        className="flex items-center justify-between px-3 py-1 bg-slate-950/90 border-b border-slate-800 text-[11px] text-slate-400 cursor-grab active:cursor-grabbing hover:bg-slate-800/60 transition group select-none"
        title="Arrastra desde los 6 puntos para mover la línea de tiempo arriba, abajo o flotante"
      >
        <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-violet-400">
          <div className="p-0.5 rounded bg-slate-800 group-hover:bg-violet-500/20 group-hover:text-violet-300 transition">
            <GripVertical className="w-3.5 h-3.5 text-slate-500 group-hover:text-violet-400" />
          </div>
          <span>Línea de Tiempo y Audio</span>
        </div>
        <div className="flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => handleQuickDock('timeline', layout.panels.timeline.dock === 'bottom' ? 'top' : 'bottom')}
            className="p-1 rounded text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition"
            title={layout.panels.timeline.dock === 'bottom' ? 'Mover ARRIBA' : 'Mover ABAJO'}
          >
            <ArrowUpDown className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => handleQuickDock('timeline', 'floating')}
            className="p-1 rounded text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition"
            title="Convertir línea de tiempo en ventana flotante"
          >
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </div>

      <AudioControls
        isPlaying={isPlaying}
        currentTimeMs={currentTimeMs}
        durationMs={project.durationMs}
        playbackRate={playbackRate}
        isLoopPhrase={isLoopPhrase}
        isMetronomeEnabled={isMetronomeEnabled}
        isRecordCountsMode={isRecordCountsMode}
        onTogglePlay={handleTogglePlay}
        onStop={handleStop}
        onChangeRate={(rate) => {
          setPlaybackRate(rate);
          const aud = globalAudioEngine.getAudioElement();
          if (aud) aud.playbackRate = rate;
        }}
        onToggleLoop={() => setIsLoopPhrase((prev) => !prev)}
        onToggleMetronome={() => setIsMetronomeEnabled((prev) => !prev)}
        onToggleRecordCounts={() => setIsRecordCountsMode((prev) => !prev)}
        onTapBeat={handleTapBeat}
        onResetCountToOne={handleResetCountToOne}
        onClearBeats={handleClearBeats}
      />

      <div className="flex-1 min-h-0">
        <Timeline
          durationMs={project.durationMs}
          currentTimeMs={currentTimeMs}
          beats={project.beats}
          formations={project.formations}
          peaks={peaks}
          selectedFormationId={selectedFormationId}
          selectedFormationIds={selectedFormationIds}
          collisionTimes={collisionTimes}
          onSeek={(t) => handleSeek(t)}
          onSelectFormation={(fid, isMulti) => {
            setSelectedFormationId(fid);
            if (isMulti) {
              setSelectedFormationIds((prev) =>
                prev.includes(fid) ? prev.filter((id) => id !== fid) : [...prev, fid]
              );
            } else {
              setSelectedFormationIds([fid]);
            }
            const f = project.formations.find((item) => item.id === fid);
            if (f) handleSeek(f.startTimeMs);
          }}
          onSelectMultipleFormations={(fids) => {
            setSelectedFormationIds(fids);
            if (fids.length > 0) setSelectedFormationId(fids[0]);
          }}
          onDeleteFormations={handleDeleteFormations}
          onUpdateFormationTiming={(fid, s, h, t) => {
            handleUpdateFormation(fid, {
              startTimeMs: s,
              holdDurationMs: h,
              transitionDurationMs: t,
            });
          }}
          onUpdateBeatTimestamp={(bid, t) => {
            setProject((prev) => {
              const updated = prev.beats.map((b) =>
                b.id === bid ? { ...b, timestampMs: t } : b
              );
              return {
                ...prev,
                beats: updated.sort((a, b) => a.timestampMs - b.timestampMs),
              };
            });
          }}
          onAddFormationAtTime={handleAddFormationAtTime}
        />
      </div>
    </div>
  );

  // VISTA MÓVIL AISLADA PARA LOS BAILARINES (100% SOLO LECTURA, SIN MENÚS NI CONTROLES DE EDICIÓN)
  if (viewMode === 'dancer') {
    return (
      <MobileDancerScreen
        project={project}
        currentTimeMs={currentTimeMs}
        selectedDancerId={selectedDancerId}
        roomId={roomId}
        isRealtimeConnected={realtimeManager.isWsConnected()}
        onSelectDancer={setSelectedDancerId}
        onSwitchToDirector={() => setViewMode('choreographer')}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 font-sans select-none">
      {/* 1. BARRA SUPERIOR DE APLICACIÓN ESTILO ADOBE AUDITION / PREMIERE (.choreo) */}
      <AppMenuBar
        sessionName={sessionName}
        onNewSession={handleNewSession}
        onOpenSession={handleOpenSession}
        onSaveSession={handleSaveSession}
        onSaveSessionAs={handleSaveSessionAs}
        onResetDemo={handleResetDemo}
        onAddDancer={handleAddDancer}
        onAddFormation={() => handleAddFormationAtTime(currentTimeMs)}
        onDeleteSelected={() => handleDeleteFormations(selectedFormationIds)}
        onDuplicateFormation={() => handleDuplicateFormation(selectedFormationId)}
        onSelectAllFormations={handleSelectAllFormations}
        onResetLayout={handleResetLayout}
        onTogglePanel={handleTogglePanel}
        visiblePanels={visiblePanels}
        onOpenShortcutsHelp={() => setShowShortcutsHelp(true)}
        onOpenOfflineHelp={() => setShowOfflineHelp(true)}
      />

      {/* 2. CABECERA PRINCIPAL CON LOGO, MODOS Y CONTROLES CLAVE */}
      <Header
        viewMode={viewMode}
        setViewMode={setViewMode}
        currentBeat={currentBeat}
        onExportJson={handleSaveSession}
        onImportJson={handleOpenSession}
        onUploadAudio={handleUploadAudio}
        onResetDemo={handleResetDemo}
        onSyntheticAudio={handleSyntheticAudio}
        onOpenLiveModal={() => setIsLiveModalOpen(true)}
        isRealtimeConnected={realtimeManager.isWsConnected()}
      />

      {/* 3. LÍNEA DE TIEMPO ACOPLADA EN LA PARTE SUPERIOR (SI EL USUARIO LA ARRASTRÓ AHÍ) */}
      {viewMode === 'choreographer' && layout.panels.timeline.dock === 'top' && visiblePanels.timeline && (
        <>
          <div style={{ height: `${timelineHeight}px` }} className="shrink-0 flex flex-col z-20">
            {renderTimelineContent()}
          </div>
          <div
            onPointerDown={startResizeTimeline}
            className="h-1.5 hover:h-2 bg-slate-800 hover:bg-violet-500 cursor-row-resize transition-all z-30 shrink-0"
            title="Arrastra para cambiar la altura de la pista de música"
          />
        </>
      )}

      {/* 4. ÁREA CENTRAL (ESPACIO DE TRABAJO MODULAR ADOBE + SNAP LAYOUTS) */}
      <main 
        onPointerMove={handlePointerMoveGlobal}
        onPointerUp={handlePointerUpGlobal}
        className="flex flex-1 min-h-0 overflow-hidden relative select-none"
      >
        {/* PANEL LATERAL IZQUIERDO */}
        {viewMode === 'choreographer' && (layout.panels.dancers.dock === 'left' || layout.panels.formations.dock === 'left') && (
          <>
            <aside 
              style={{ width: `${sidebarWidth}px` }} 
              className="shrink-0 bg-slate-900 border-r border-slate-800 p-2.5 flex flex-col gap-2.5 overflow-hidden z-10"
            >
              {layout.panels.dancers.dock === 'left' && visiblePanels.dancers && (
                <div className="flex-1 min-h-0">
                  {renderDancersContent()}
                </div>
              )}
              {layout.panels.formations.dock === 'left' && visiblePanels.formations && (
                <div className="flex-1 min-h-0">
                  {renderFormationsContent()}
                </div>
              )}
            </aside>
            <div
              onPointerDown={startResizeSidebar}
              className="w-1.5 hover:w-2 bg-slate-800 hover:bg-cyan-500 cursor-col-resize transition-all z-20 shrink-0"
              title="Arrastra para cambiar el ancho del panel izquierdo"
            />
          </>
        )}

        {/* LIENZO DEL ESCENARIO CENTRAL */}
        <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-slate-950 relative">
          {/* Barra de herramientas sobre el escenario */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-slate-900 border-b border-slate-800 select-none z-10">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsMirror((prev) => !prev)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-semibold transition ${
                  isMirror
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-sm'
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                }`}
                title="Girar 180° la perspectiva (desde el escenario hacia el auditorio)"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>{isMirror ? 'Modo espejo 180° (Activo)' : 'Modo espejo 180°'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowAllPaths((prev) => !prev)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-semibold transition ${
                  showAllPaths
                    ? 'bg-violet-600 text-white border-violet-400 shadow-sm'
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                }`}
                title="Mostrar u ocultar todas las líneas de transición Bézier"
              >
                <GitCommit className="w-3.5 h-3.5" />
                <span>{showAllPaths ? 'Ocultar rutas' : 'Ver rutas'}</span>
              </button>
            </div>

            {/* ALERTA VISUAL DE COLISIONES EN CABECERA */}
            {activeCollisions.length > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-950/80 border border-rose-500 text-rose-300 text-xs font-bold animate-bounce shadow-md">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>
                  ⚠ COLISIÓN:{' '}
                  {activeCollisions
                    .map((c) => `${c.nameA} × ${c.nameB}`)
                    .join(', ')}
                </span>
              </div>
            )}
          </div>

          <div className="flex-1 min-h-0 relative">
            <StageCanvas
              formations={project.formations}
              dancers={project.dancers}
              currentTimeMs={currentTimeMs}
              selectedFormationId={selectedFormationId}
              selectedDancerId={selectedDancerId}
              viewMode={viewMode}
              isMirror={isMirror}
              showAllPaths={showAllPaths}
              onSelectDancer={setSelectedDancerId}
              onUpdateDancerPosition={handleUpdateDancerPosition}
              onUpdateDancerCurveOffset={handleUpdateDancerCurveOffset}
              onEndUpdateDancerPosition={handleEndUpdateDancerPosition}
              onCollisionChange={setActiveCollisions}
            />
          </div>
        </div>

        {/* PANEL LATERAL DERECHO */}
        {viewMode === 'choreographer' && (layout.panels.dancers.dock === 'right' || layout.panels.formations.dock === 'right') && (
          <>
            <div
              onPointerDown={startResizeRightSidebar}
              className="w-1.5 hover:w-2 bg-slate-800 hover:bg-cyan-500 cursor-col-resize transition-all z-20 shrink-0"
              title="Arrastra para cambiar el ancho del panel derecho"
            />
            <aside 
              style={{ width: `${rightSidebarWidth}px` }} 
              className="shrink-0 bg-slate-900 border-l border-slate-800 p-2.5 flex flex-col gap-2.5 overflow-hidden z-10"
            >
              {layout.panels.dancers.dock === 'right' && visiblePanels.dancers && (
                <div className="flex-1 min-h-0">
                  {renderDancersContent()}
                </div>
              )}
              {layout.panels.formations.dock === 'right' && visiblePanels.formations && (
                <div className="flex-1 min-h-0">
                  {renderFormationsContent()}
                </div>
              )}
            </aside>
          </>
        )}
      </main>

      {/* 5. SECCIONES ACOPLADAS EN LA PARTE INFERIOR (SI SE ARRASTRARON ABAJO) */}
      {viewMode === 'choreographer' && (layout.panels.dancers.dock === 'bottom' || layout.panels.formations.dock === 'bottom') && (
        <div className="h-56 shrink-0 bg-slate-900 border-t border-slate-800 p-2.5 flex gap-2.5 overflow-hidden z-10">
          {layout.panels.dancers.dock === 'bottom' && visiblePanels.dancers && (
            <div className="flex-1 min-w-0 h-full">
              {renderDancersContent()}
            </div>
          )}
          {layout.panels.formations.dock === 'bottom' && visiblePanels.formations && (
            <div className="flex-1 min-w-0 h-full">
              {renderFormationsContent()}
            </div>
          )}
        </div>
      )}

      {/* 6. LÍNEA DE TIEMPO ACOPLADA EN LA PARTE INFERIOR (POR DEFECTO) */}
      {viewMode === 'choreographer' && layout.panels.timeline.dock === 'bottom' && visiblePanels.timeline && (
        <>
          <div
            onPointerDown={startResizeTimeline}
            className="h-1.5 hover:h-2 bg-slate-800 hover:bg-violet-500 cursor-row-resize transition-all z-30 shrink-0"
            title="Arrastra verticalmente para cambiar la altura de la pista de música"
          />
          <footer 
            style={{ height: `${timelineHeight}px` }}
            onPointerMove={handlePointerMoveGlobal}
            onPointerUp={handlePointerUpGlobal}
            className="shrink-0 flex flex-col bg-slate-900 border-t border-slate-800 z-20"
          >
            {renderTimelineContent()}
          </footer>
        </>
      )}

      {/* 7. VENTANAS FLOTANTES (SI EL USUARIO ARRASTRÓ CUALQUIER SECCIÓN COMO FLOTANTE) */}
      {viewMode === 'choreographer' && layout.panels.dancers.dock === 'floating' && visiblePanels.dancers && (
        <FloatingPanel
          title="Bailarines"
          panelId="dancers"
          defaultPosition={{ x: 100, y: 130, width: 340, height: 460 }}
          onDock={(z) => handleQuickDock('dancers', z)}
          onClose={() => handleQuickDock('dancers', 'left')}
          onStartDragSnap={() => handleStartDragSnap('dancers')}
        >
          {renderDancersContent()}
        </FloatingPanel>
      )}

      {viewMode === 'choreographer' && layout.panels.formations.dock === 'floating' && visiblePanels.formations && (
        <FloatingPanel
          title="Formaciones"
          panelId="formations"
          defaultPosition={{ x: 460, y: 130, width: 360, height: 460 }}
          onDock={(z) => handleQuickDock('formations', z)}
          onClose={() => handleQuickDock('formations', 'right')}
          onStartDragSnap={() => handleStartDragSnap('formations')}
        >
          {renderFormationsContent()}
        </FloatingPanel>
      )}

      {viewMode === 'choreographer' && layout.panels.timeline.dock === 'floating' && visiblePanels.timeline && (
        <FloatingPanel
          title="Línea de Tiempo y Audio"
          panelId="timeline"
          defaultPosition={{ x: 80, y: 380, width: 780, height: 280 }}
          onDock={(z) => handleQuickDock('timeline', z)}
          onClose={() => handleQuickDock('timeline', 'bottom')}
          onStartDragSnap={() => handleStartDragSnap('timeline')}
        >
          {renderTimelineContent()}
        </FloatingPanel>
      )}

      {/* 8. OVERLAY DE SNAP LAYOUTS ESTILO WINDOWS 11 */}
      <SnapLayoutOverlay
        isDragging={isDraggingSnap}
        activePanelId={activeDragPanel}
        hoveredZone={hoveredZone}
        onHoverZone={setHoveredZone}
        onDropZone={handleDropZone}
      />

      {/* 9. MODAL SALA EN VIVO / QR (CON IP WI-FI LAN CORREGIDA Y SOPORTE OFFLINE) */}
      <LiveRoomModal
        isOpen={isLiveModalOpen}
        onClose={() => setIsLiveModalOpen(false)}
        roomId={roomId}
        onRoomIdChange={(newRoom) => {
          setRoomId(newRoom);
          realtimeManager.setRoomId(newRoom);
        }}
      />

      {/* 10. MODAL DE ATAJOS DE TECLADO */}
      {showShortcutsHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in select-none">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 text-slate-100 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2 font-bold text-sm text-cyan-300">
                <Keyboard className="w-4 h-4 text-cyan-400" />
                <span>Atajos de Teclado Profesionales</span>
              </div>
              <button
                type="button"
                onClick={() => setShowShortcutsHelp(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="text-slate-300">Play / Pausa</span>
                <span className="px-2 py-0.5 rounded bg-slate-800 font-mono text-cyan-300">Espacio o S</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="text-slate-300">Marcar Conteo 1 a 8 en vivo</span>
                <span className="px-2 py-0.5 rounded bg-slate-800 font-mono text-cyan-300">Espacio (Grabando)</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="text-slate-300">Guardar Sesión (.choreo)</span>
                <span className="px-2 py-0.5 rounded bg-slate-800 font-mono text-emerald-300">Ctrl + S</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="text-slate-300">Abrir Sesión (.choreo)</span>
                <span className="px-2 py-0.5 rounded bg-slate-800 font-mono text-violet-300">Ctrl + O</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="text-slate-300">Nueva Sesión en blanco</span>
                <span className="px-2 py-0.5 rounded bg-slate-800 font-mono text-slate-300">Ctrl + N</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="text-slate-300">Seleccionar todas las formaciones</span>
                <span className="px-2 py-0.5 rounded bg-slate-800 font-mono text-slate-300">Ctrl + A</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="text-slate-300">Duplicar formación</span>
                <span className="px-2 py-0.5 rounded bg-slate-800 font-mono text-slate-300">Ctrl + D</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="text-slate-300">Eliminar formación(es)</span>
                <span className="px-2 py-0.5 rounded bg-slate-800 font-mono text-rose-300">Supr / Backspace</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="text-slate-300">Moverse entre conteos</span>
                <span className="px-2 py-0.5 rounded bg-slate-800 font-mono text-slate-300">← Flechas →</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-300">Zoom en Escenario y Timeline</span>
                <span className="px-2 py-0.5 rounded bg-slate-800 font-mono text-cyan-300">Rueda del Ratón</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 11. MODAL DE GUÍA MODO ACADEMIA (OFFLINE) */}
      {showOfflineHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in select-none">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 text-slate-100 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2 font-bold text-sm text-cyan-300">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <span>Guía Modo Academia (100% Sin Internet)</span>
              </div>
              <button
                type="button"
                onClick={() => setShowOfflineHelp(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2.5 text-xs text-slate-300 leading-relaxed">
              <p>
                <strong>¿No hay conexión a internet en tu academia?</strong> No te preocupes: ChoreoSync Pro está diseñado para funcionar en red local independiente.
              </p>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <p>
                  <strong>Opción 1: Router Wi-Fi local sin internet:</strong> Enciende el router de la academia. Conecta la laptop y los teléfonos de los bailarines a esa red. Escanean el QR y se sincronizan al instante.
                </p>
                <p>
                  <strong>Opción 2: Zona Wi-Fi móvil (Hotspot):</strong> Activa "Compartir Internet" o "Punto de Acceso Wi-Fi" desde cualquier celular (no gasta datos). Conecta la laptop a esa red y todos los bailarines se conectan al hotspot.
                </p>
                <p>
                  <strong>Opción 3: Vercel Cloud:</strong> Cuando terminemos y creemos el repositorio en GitHub, con 1 clic en Vercel tendrás un enlace global permanente (ej. <code>choreosync.vercel.app</code>) para usar en cualquier lugar con datos móviles.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
