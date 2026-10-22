import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ChoreoProject, 
  Dancer, 
  Formation, 
  DancerPosition,
  Beat, 
  ViewMode, 
  SpeedRate, 
  CollisionEvent 
} from './types/choreo';
import { 
  createDemoProject, 
  saveProjectToLocalStorage, 
  loadProjectFromLocalStorage, 
  exportProjectToJsonFile, 
  importProjectFromJsonFile, 
  DANCER_COLORS 
} from './utils/storage';
import { globalAudioEngine, generateBeatsForDuration } from './utils/audioSynthesizer';
import { scanProjectCollisions } from './utils/collision';
import { calculateDancersPose } from './utils/interpolation';
import { realtimeManager } from './utils/realtime';

import { Header } from './components/Header/Header';
import { StageCanvas } from './components/StageCanvas/StageCanvas';
import { Timeline } from './components/Timeline/Timeline';
import { AudioControls } from './components/AudioEngine/AudioControls';
import { ChoreographerStudio } from './components/ChoreographerStudio/ChoreographerStudio';
import { DancerView } from './components/DancerView/DancerView';
import { LiveRoomModal } from './components/RealtimeRoom/LiveRoomModal';
import { Compass, GitCommit, AlertTriangle } from 'lucide-react';

export const App: React.FC = () => {
  // Inicialización de proyecto desde localStorage o demo
  const [project, setProject] = useState<ChoreoProject>(() => {
    const saved = loadProjectFromLocalStorage();
    return saved || createDemoProject();
  });

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
  const [selectedDancerId, setSelectedDancerId] = useState<string | null>(() => project.dancers[0]?.id || null);

  // Modos de visualización y Espacio de Trabajo Adobe Audition Style
  const [isMirror, setIsMirror] = useState<boolean>(false);
  const [showAllPaths, setShowAllPaths] = useState<boolean>(false);
  const [isLiveModalOpen, setIsLiveModalOpen] = useState<boolean>(false);
  const [sidebarWidth, setSidebarWidth] = useState<number>(260);
  const [sidebarDock, setSidebarDock] = useState<'left' | 'right'>('left');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [timelineHeight, setTimelineHeight] = useState<number>(180);

  // Redimensionamiento interactivo de paneles (Splitters)
  const isResizingSidebar = useRef(false);
  const isResizingTimeline = useRef(false);

  const startResizeSidebar = (e: React.PointerEvent) => {
    isResizingSidebar.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const startResizeTimeline = (e: React.PointerEvent) => {
    isResizingTimeline.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMoveGlobal = (e: React.PointerEvent) => {
    if (isResizingSidebar.current) {
      if (sidebarDock === 'left') {
        setSidebarWidth(Math.max(180, Math.min(500, e.clientX)));
      } else {
        setSidebarWidth(Math.max(180, Math.min(500, window.innerWidth - e.clientX)));
      }
    }
    if (isResizingTimeline.current) {
      setTimelineHeight(Math.max(110, Math.min(380, window.innerHeight - e.clientY)));
    }
  };

  const handlePointerUpGlobal = (e: React.PointerEvent) => {
    if (isResizingSidebar.current) {
      isResizingSidebar.current = false;
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

  // Sincronización en tiempo real inicial
  useEffect(() => {
    realtimeManager.setRoomId(roomId);
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
      }
    });

    return () => unsubscribe();
  }, [roomId]);

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

  // Auto-guardado en localStorage
  useEffect(() => {
    saveProjectToLocalStorage(project);
  }, [project]);

  // Encontrar el conteo activo actual
  const currentBeat = project.beats.reduce<Beat | null>((acc, b) => {
    if (b.timestampMs <= currentTimeMs + 10) return b;
    return acc;
  }, null);

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
      } else {
        countNumber = (lastBeat.countNumber % 8) + 1;
        phraseIndex = lastBeat.phraseIndex + (countNumber === 1 ? 1 : 0);
      }
    }

    animTimeRef.current.resetNextCount = false;

    const newBeat: Beat = {
      id: 'beat_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      timestampMs: cur,
      phraseIndex,
      countNumber,
    };

    beats.push(newBeat);
    beats.sort((a, b) => a.timestampMs - b.timestampMs);

    // Reproducir feedback sonoro inmediato
    globalAudioEngine.playBeatClick(countNumber, 0.45);

    setProject((prev) => ({
      ...prev,
      beats,
    }));
  }, []);

  const handleResetCountToOne = () => {
    animTimeRef.current.resetNextCount = true;
  };

  const handleClearBeats = () => {
    if (window.confirm('¿Seguro que deseas borrar todos los conteos de 8 tiempos?')) {
      setProject((prev) => ({ ...prev, beats: [] }));
    }
  };

  // Paso conteo por conteo (Flechas teclado)
  const handleStepCount = useCallback(
    (direction: 1 | -1) => {
      const beats = projectRef.current.beats;
      if (beats.length === 0) return;

      const cur = currentTimeMsRef.current;
      if (direction > 0) {
        const next = beats.find((b) => b.timestampMs > cur + 10);
        if (next) handleSeek(next.timestampMs);
      } else {
        const prevs = beats.filter((b) => b.timestampMs < cur - 10);
        if (prevs.length > 0) {
          handleSeek(prevs[prevs.length - 1].timestampMs);
        } else {
          handleSeek(0);
        }
      }
    },
    [handleSeek]
  );

  // Loop a 60 FPS con Web Audio API y requestAnimationFrame
  useEffect(() => {
    let animId: number;

    const frame = () => {
      if (isPlayingRef.current) {
        const aud = globalAudioEngine.getAudioElement();
        let nextCur: number;

        if (aud && !globalAudioEngine.isUsingSyntheticAudio() && !aud.paused) {
          nextCur = aud.currentTime * 1000;
        } else {
          const now = performance.now();
          const delta = (now - animTimeRef.current.t0) * playbackRateRef.current;
          nextCur = animTimeRef.current.c0 + delta;
        }

        // Bucle Ocho
        if (isLoopPhraseRef.current && currentBeat) {
          const currentPhrase = currentBeat.phraseIndex;
          const beatsInPhrase = projectRef.current.beats.filter(
            (b) => b.phraseIndex === currentPhrase
          );
          if (beatsInPhrase.length > 0) {
            const nextPhraseBeat = projectRef.current.beats.find(
              (b) => b.phraseIndex === currentPhrase + 1
            );
            const loopEnd = nextPhraseBeat
              ? nextPhraseBeat.timestampMs
              : projectRef.current.durationMs;

            if (nextCur >= loopEnd) {
              handleSeek(beatsInPhrase[0].timestampMs, false);
              nextCur = beatsInPhrase[0].timestampMs;
            }
          }
        }

        // Fin de la pista
        if (nextCur >= projectRef.current.durationMs) {
          nextCur = projectRef.current.durationMs;
          setIsPlaying(false);
          isPlayingRef.current = false;
        }

        // Metrónomo en tiempo real
        if (isMetronomeEnabledRef.current) {
          const last = animTimeRef.current.lastCur;
          projectRef.current.beats.forEach((b) => {
            if (b.timestampMs > last && b.timestampMs <= nextCur) {
              globalAudioEngine.playBeatClick(b.countNumber);
            }
          });
        }

        animTimeRef.current.lastCur = nextCur;
        setCurrentTimeMs(nextCur);
        currentTimeMsRef.current = nextCur;
      }

      animId = requestAnimationFrame(frame);
    };

    animId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animId);
  }, [handleSeek, currentBeat]);

  // Atajos de teclado activos
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      const key = e.key.toLowerCase();

      if (e.code === 'Space' || key === 's') {
        e.preventDefault();
        if (isRecordCountsMode) {
          handleTapBeat();
        } else {
          handleTogglePlay();
        }
      } else if (key === 't') {
        e.preventDefault();
        handleTapBeat();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleStepCount(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleStepCount(-1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTogglePlay, handleTapBeat, handleStepCount, isRecordCountsMode]);

  // CRUD de Bailarines
  const handleAddDancer = () => {
    const nextSlot = project.dancers.length + 1;
    const color = DANCER_COLORS[(nextSlot - 1) % DANCER_COLORS.length];
    const newDancer: Dancer = {
      id: 'dancer_' + Date.now(),
      slotNumber: nextSlot,
      name: `Bailarín ${nextSlot}`,
      color,
      group: nextSlot <= 4 ? 'Alfa' : 'Beta',
      defaultLevel: 'medio',
    };

    const newPosition: DancerPosition = {
      x: 0.5,
      y: 0.5,
      level: 'medio',
      curveOffset: { cx: 0, cy: 0 },
      notes: '',
    };

    const updatedFormations: Formation[] = project.formations.map((f) => ({
      ...f,
      positions: {
        ...f.positions,
        [newDancer.id]: newPosition,
      },
    }));

    setProject((prev) => ({
      ...prev,
      dancers: [...prev.dancers, newDancer],
      formations: updatedFormations,
    }));
    setSelectedDancerId(newDancer.id);
  };

  const handleUpdateDancer = (dancerId: string, updates: Partial<Dancer>) => {
    setProject((prev) => ({
      ...prev,
      dancers: prev.dancers.map((d) => (d.id === dancerId ? { ...d, ...updates } : d)),
    }));
  };

  const handleDeleteDancer = (dancerId: string) => {
    if (project.dancers.length <= 1) return;
    const updatedFormations = project.formations.map((f) => {
      const pos = { ...f.positions };
      delete pos[dancerId];
      return { ...f, positions: pos };
    });

    setProject((prev) => ({
      ...prev,
      dancers: prev.dancers.filter((d) => d.id !== dancerId),
      formations: updatedFormations,
    }));

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

    setProject((prev) => ({
      ...prev,
      formations: updated,
    }));
    setSelectedFormationId(newFormation.id);
  };

  const handleUpdateFormation = (formationId: string, updates: Partial<Formation>) => {
    setProject((prev) => ({
      ...prev,
      formations: prev.formations.map((f) =>
        f.id === formationId ? { ...f, ...updates } : f
      ),
    }));
  };

  const handleDeleteFormation = (formationId: string) => {
    if (project.formations.length <= 1) return;
    const updated = project.formations.filter((f) => f.id !== formationId);
    setProject((prev) => ({
      ...prev,
      formations: updated,
    }));
    if (selectedFormationId === formationId) {
      setSelectedFormationId(updated[0].id);
    }
  };

  // Posicionamiento de bailarines en el canvas
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

      return {
        ...prev,
        formations: prev.formations.map((f) =>
          f.id === formationId ? { ...f, positions: updatedPos } : f
        ),
      };
    });
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

      return {
        ...prev,
        formations: prev.formations.map((f) =>
          f.id === formationId ? { ...f, positions: updatedPos } : f
        ),
      };
    });
  };

  // Manejo de Archivos Audio y Proyecto
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

  const handleResetDemo = () => {
    if (window.confirm('¿Restaurar la coreografía demo completa (8 bailarines, 3 formaciones)?')) {
      handleStop();
      globalAudioEngine.setSyntheticMode(true);
      const demo = createDemoProject();
      setProject(demo);
      setSelectedFormationId(demo.formations[0].id);
      setSelectedDancerId(demo.dancers[0].id);
      handleSeek(0);
    }
  };

  const handleExportJson = () => {
    exportProjectToJsonFile(project);
  };

  const handleImportJson = async (file: File) => {
    try {
      const imported = await importProjectFromJsonFile(file);
      handleStop();
      setProject(imported);
      setSelectedFormationId(imported.formations[0]?.id || '');
      setSelectedDancerId(imported.dancers[0]?.id || null);
      handleSeek(0);
    } catch (err: any) {
      alert(err.message || 'Error importando el archivo JSON.');
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 font-sans select-none">
      {/* 1. CABECERA PRINCIPAL */}
      <Header
        viewMode={viewMode}
        setViewMode={setViewMode}
        currentBeat={currentBeat}
        onExportJson={handleExportJson}
        onImportJson={handleImportJson}
        onUploadAudio={handleUploadAudio}
        onResetDemo={handleResetDemo}
        onSyntheticAudio={handleSyntheticAudio}
        onOpenLiveModal={() => setIsLiveModalOpen(true)}
        isRealtimeConnected={realtimeManager.isWsConnected()}
      />

      {/* 2. ÁREA CENTRAL (ADOBE AUDITION STYLE: RESIZABLE & REORDERABLE PANELS) */}
      <main 
        onPointerMove={handlePointerMoveGlobal}
        onPointerUp={handlePointerUpGlobal}
        className="flex flex-1 min-h-0 overflow-hidden relative select-none"
      >
        {/* Panel lateral en Modo Coreógrafo (Dock Izquierdo) */}
        {viewMode === 'choreographer' && sidebarDock === 'left' && (
          <>
            <ChoreographerStudio
              dancers={project.dancers}
              formations={project.formations}
              selectedFormationId={selectedFormationId}
              selectedDancerId={selectedDancerId}
              isMirror={isMirror}
              showAllPaths={showAllPaths}
              activeCollisions={activeCollisions}
              sidebarDock={sidebarDock}
              sidebarWidth={sidebarWidth}
              isSidebarCollapsed={isSidebarCollapsed}
              onToggleSidebarCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
              onToggleSidebarDock={() => setSidebarDock('right')}
              onSelectDancer={setSelectedDancerId}
              onSelectFormation={(fid) => {
                setSelectedFormationId(fid);
                const f = project.formations.find((item) => item.id === fid);
                if (f) handleSeek(f.startTimeMs);
              }}
              onAddDancer={handleAddDancer}
              onUpdateDancer={handleUpdateDancer}
              onDeleteDancer={handleDeleteDancer}
              onAddFormation={() => handleAddFormationAtTime(currentTimeMs)}
              onUpdateFormation={handleUpdateFormation}
              onDeleteFormation={handleDeleteFormation}
              onToggleMirror={() => setIsMirror((prev) => !prev)}
              onToggleShowPaths={() => setShowAllPaths((prev) => !prev)}
            />
            {/* Splitter vertical izquierdo para redimensionar */}
            {!isSidebarCollapsed && (
              <div
                onPointerDown={startResizeSidebar}
                className="w-1.5 hover:w-2 bg-slate-800 hover:bg-cyan-500 cursor-col-resize transition-all z-20 shrink-0"
                title="Arrastra para cambiar el ancho del panel lateral"
              />
            )}
          </>
        )}

        {/* Lienzo del Escenario Central */}
        <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-slate-950 relative">
          {/* Barra de herramientas sobre el escenario */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-slate-900 border-b border-slate-800 select-none z-10">
            <div className="flex items-center gap-2">
              <button
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
              onCollisionChange={setActiveCollisions}
            />
          </div>

          {/* Tarjeta de Simulador en Modo Bailarín */}
          {viewMode === 'dancer' && (
            <DancerView
              dancers={project.dancers}
              formations={project.formations}
              beats={project.beats}
              currentTimeMs={currentTimeMs}
              selectedDancerId={selectedDancerId}
              isMirror={isMirror}
              onSelectDancer={setSelectedDancerId}
              onToggleMirror={() => setIsMirror((prev) => !prev)}
            />
          )}
        </div>

        {/* Panel lateral en Modo Coreógrafo (Dock Derecho) */}
        {viewMode === 'choreographer' && sidebarDock === 'right' && (
          <>
            {!isSidebarCollapsed && (
              <div
                onPointerDown={startResizeSidebar}
                className="w-1.5 hover:w-2 bg-slate-800 hover:bg-cyan-500 cursor-col-resize transition-all z-20 shrink-0"
                title="Arrastra para cambiar el ancho del panel lateral"
              />
            )}
            <ChoreographerStudio
              dancers={project.dancers}
              formations={project.formations}
              selectedFormationId={selectedFormationId}
              selectedDancerId={selectedDancerId}
              isMirror={isMirror}
              showAllPaths={showAllPaths}
              activeCollisions={activeCollisions}
              sidebarDock={sidebarDock}
              sidebarWidth={sidebarWidth}
              isSidebarCollapsed={isSidebarCollapsed}
              onToggleSidebarCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
              onToggleSidebarDock={() => setSidebarDock('left')}
              onSelectDancer={setSelectedDancerId}
              onSelectFormation={(fid) => {
                setSelectedFormationId(fid);
                const f = project.formations.find((item) => item.id === fid);
                if (f) handleSeek(f.startTimeMs);
              }}
              onAddDancer={handleAddDancer}
              onUpdateDancer={handleUpdateDancer}
              onDeleteDancer={handleDeleteDancer}
              onAddFormation={() => handleAddFormationAtTime(currentTimeMs)}
              onUpdateFormation={handleUpdateFormation}
              onDeleteFormation={handleDeleteFormation}
              onToggleMirror={() => setIsMirror((prev) => !prev)}
              onToggleShowPaths={() => setShowAllPaths((prev) => !prev)}
            />
          </>
        )}
      </main>

      {/* 3. LÍNEA DE TIEMPO Y CONTROLES DE AUDIO (REDIMENSIONABLE VERTICALMENTE) */}
      {viewMode === 'choreographer' && (
        <>
          {/* Splitter horizontal para redimensionar la altura del timeline */}
          <div
            onPointerDown={startResizeTimeline}
            className="h-1.5 hover:h-2 bg-slate-800 hover:bg-violet-500 cursor-row-resize transition-all z-30 shrink-0"
            title="Arrastra verticalmente para cambiar la altura de la pista de música"
          />

          <footer 
            onPointerMove={handlePointerMoveGlobal}
            onPointerUp={handlePointerUpGlobal}
            className="shrink-0 flex flex-col bg-slate-900 border-t border-slate-800 z-10"
          >
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

            <Timeline
              durationMs={project.durationMs}
              currentTimeMs={currentTimeMs}
              beats={project.beats}
              formations={project.formations}
              peaks={peaks}
              selectedFormationId={selectedFormationId}
              collisionTimes={collisionTimes}
              onSeek={(t) => handleSeek(t)}
              onSelectFormation={(fid) => {
                setSelectedFormationId(fid);
                const f = project.formations.find((item) => item.id === fid);
                if (f) handleSeek(f.startTimeMs);
              }}
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
          </footer>
        </>
      )}

      {/* 4. MODAL SALA EN VIVO / QR */}
      <LiveRoomModal
        isOpen={isLiveModalOpen}
        onClose={() => setIsLiveModalOpen(false)}
        roomId={roomId}
        onRoomIdChange={(newRoom) => {
          setRoomId(newRoom);
          realtimeManager.setRoomId(newRoom);
        }}
      />
    </div>
  );
};
export default App;
