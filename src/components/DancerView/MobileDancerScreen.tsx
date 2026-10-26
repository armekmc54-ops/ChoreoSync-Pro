import React, { useState, useEffect } from 'react';
import { ChoreoProject, Dancer, Formation, Beat } from '../../types/choreo';
import { StageCanvas } from '../StageCanvas/StageCanvas';
import { 
  getActiveFormationIndex, 
  calculateDancersPose, 
  getStageZone 
} from '../../utils/interpolation';
import { 
  Radio, 
  Compass, 
  UserCheck, 
  ArrowRight, 
  ShieldCheck, 
  Sliders, 
  Maximize2 
} from 'lucide-react';

interface MobileDancerScreenProps {
  project: ChoreoProject;
  currentTimeMs: number;
  selectedDancerId: string | null;
  roomId: string;
  isRealtimeConnected: boolean;
  onSelectDancer: (dancerId: string) => void;
  onSwitchToDirector?: () => void;
}

export const MobileDancerScreen: React.FC<MobileDancerScreenProps> = ({
  project,
  currentTimeMs,
  selectedDancerId,
  roomId,
  isRealtimeConnected,
  onSelectDancer,
  onSwitchToDirector,
}) => {
  const [isMirror, setIsMirror] = useState(false);

  // Intentar restaurar el bailarín guardado localmente o asignar el primero del proyecto recibido
  useEffect(() => {
    if (project.dancers.length > 0) {
      const isValidCurrent = selectedDancerId && project.dancers.some((d) => d.id === selectedDancerId);
      if (!isValidCurrent) {
        try {
          const savedId = localStorage.getItem('choreosync_my_dancer_id');
          if (savedId && project.dancers.some((d) => d.id === savedId)) {
            onSelectDancer(savedId);
            return;
          }
        } catch {}
        onSelectDancer(project.dancers[0].id);
      }
    }
  }, [selectedDancerId, project.dancers, onSelectDancer]);

  const currentDancer = project.dancers.find((d) => d.id === selectedDancerId) || project.dancers[0];
  const currentFormationIdx = getActiveFormationIndex(project.formations, currentTimeMs);
  const currentFormation = project.formations[currentFormationIdx];
  const nextFormation = project.formations[currentFormationIdx + 1];

  const currentPoses = calculateDancersPose(project.formations, project.dancers, currentTimeMs);
  const myPose = currentDancer ? currentPoses[currentDancer.id] : null;

  // Encontrar el conteo activo actual
  const activeBeat = (project.beats || []).reduce<Beat | null>((acc, b) => {
    if (b.timestampMs <= currentTimeMs + 10) return b;
    return acc;
  }, null);

  // Instrucciones dinámicas en vivo
  let instruction = {
    currentZone: 'Escenario',
    level: 'medio',
    status: 'Estático (Hold)',
    statusColor: 'text-emerald-400 bg-emerald-950/70 border-emerald-500/40',
    detail: 'Mantente firme en tu posición inicial.',
    targetText: '',
  };

  if (myPose && currentFormation && currentDancer) {
    const zoneInfo = getStageZone(myPose.x, myPose.y);
    instruction.currentZone = zoneInfo.label;
    instruction.level = myPose.level;

    const holdEndMs = currentFormation.startTimeMs + currentFormation.holdDurationMs;
    const transEndMs = holdEndMs + currentFormation.transitionDurationMs;

    if (nextFormation && nextFormation.positions && currentDancer && nextFormation.positions[currentDancer.id]) {
      const nextPos = nextFormation.positions[currentDancer.id];
      const nextZone = getStageZone(nextPos.x, nextPos.y);

      if (currentTimeMs < holdEndMs) {
        const remainingSec = ((holdEndMs - currentTimeMs) / 1000).toFixed(1);
        instruction.status = 'En Espera (Hold)';
        instruction.statusColor = 'text-cyan-400 bg-cyan-950/70 border-cyan-500/40';
        instruction.detail = `Mantén tu posición. Te desplazas hacia “${nextFormation.name}” en ${remainingSec}s.`;
        instruction.targetText = `Destino: ${nextZone.label} (Nivel ${nextPos.level})`;
      } else if (currentTimeMs < transEndMs) {
        const progressPct = Math.round(myPose.progress * 100);
        instruction.status = `En Movimiento (${progressPct}%)`;
        instruction.statusColor = 'text-amber-400 bg-amber-950/70 border-amber-500/40';
        instruction.detail = `Moviéndote hacia ${nextZone.label}. Llega a tiempo al nivel ${nextPos.level}.`;
        instruction.targetText = `Destino: ${nextZone.label} (Nivel ${nextPos.level})`;
      } else {
        instruction.status = 'Formación Alcanzada';
        instruction.statusColor = 'text-emerald-400 bg-emerald-950/70 border-emerald-500/40';
        instruction.detail = `¡Excelente! Ya estás en la formación “${nextFormation.name}”.`;
      }
    } else {
      instruction.status = 'Formación Final';
      instruction.statusColor = 'text-violet-400 bg-violet-950/70 border-violet-500/40';
      instruction.detail = 'Última formación de la coreografía. Mantén pose final.';
    }
  }

  const handleSelectMyDancer = (dancerId: string | null) => {
    if (!dancerId) return;
    onSelectDancer(dancerId);
    try {
      localStorage.setItem('choreosync_my_dancer_id', dancerId);
    } catch {}
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 select-none">
      {/* 1. CABECERA DEDICADA PARA EL CELULAR DEL BAILARÍN */}
      <header className="shrink-0 flex items-center justify-between px-3 py-2 bg-slate-900 border-b border-slate-800 z-30">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-violet-600/20 text-violet-400 border border-violet-500/30">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-black text-sm tracking-tight text-white">ChoreoSync</span>
              <span className="text-[10px] px-1 py-0.2 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-mono font-bold">
                EN VIVO
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              <span>SALA: {roomId}</span>
            </div>
          </div>
        </div>

        {/* Controles del Bailarín: ¿Quién eres? y Modo Espejo 180° */}
        <div className="flex items-center gap-1.5">
          {/* Selector ¿Quién eres? */}
          <div className="relative flex items-center bg-slate-950 border border-slate-700/80 rounded-lg px-2 py-1">
            {currentDancer && (
              <span
                className="w-3 h-3 rounded-full mr-1.5 shrink-0 border border-white"
                style={{ backgroundColor: currentDancer.color }}
              />
            )}
            <select
              value={currentDancer?.id || ''}
              onChange={(e) => handleSelectMyDancer(e.target.value)}
              className="bg-transparent text-xs text-white font-medium outline-none cursor-pointer pr-1"
              title="Selecciona cuál de los bailarines eres tú"
            >
              {project.dancers.length === 0 ? (
                <option value="">Conectando con director...</option>
              ) : (
                project.dancers.map((d) => (
                  <option key={d.id} value={d.id} className="bg-slate-900 text-white">
                    #{d.slotNumber} - {d.name}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Botón Modo Espejo 180° */}
          <button
            type="button"
            onClick={() => setIsMirror(!isMirror)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition ${
              isMirror
                ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
            title="Girar 180° para ver el escenario desde tu perspectiva real mirando al público"
          >
            <Compass className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isMirror ? 'Modo Espejo' : 'Vista Público'}</span>
          </button>
        </div>
      </header>

      {/* 2. LIENZO DEL ESCENARIO (SOLO LECTURA, ALTA VISUALIZACIÓN) */}
      <main className="flex-1 min-h-0 relative bg-slate-950 overflow-hidden">
        <StageCanvas
          formations={project.formations}
          dancers={project.dancers}
          currentTimeMs={currentTimeMs}
          selectedFormationId={currentFormation?.id || project.formations[0]?.id || ''}
          selectedDancerId={selectedDancerId}
          viewMode="dancer"
          isMirror={isMirror}
          showAllPaths={true}
          onSelectDancer={handleSelectMyDancer}
          onUpdateDancerPosition={() => {}}
          onUpdateDancerCurveOffset={() => {}}
        />
      </main>

      {/* 3. DASHBOARD INFERIOR DEL BAILARÍN (CONTEO GIGANTE E INSTRUCCIONES) */}
      <footer className="shrink-0 bg-slate-900 border-t border-slate-800 p-3 sm:p-4 flex flex-col gap-2.5 z-30 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Avatar del Bailarín e Instrucciones */}
          <div className="flex items-center gap-3">
            {currentDancer && (
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center font-extrabold text-slate-950 text-base shadow-lg shadow-violet-500/20 shrink-0 border-2 border-white ring-4 ring-violet-500/30"
                style={{ backgroundColor: currentDancer.color }}
              >
                {currentDancer.slotNumber}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-base text-white truncate">
                  {currentDancer?.name || 'Bailarín'}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${instruction.statusColor}`}>
                  {instruction.status}
                </span>
                <span className="text-[10px] bg-slate-800 text-cyan-300 font-bold px-2 py-0.5 rounded border border-slate-700 uppercase font-mono">
                  NIVEL: {instruction.level}
                </span>
              </div>

              <p className="text-xs text-slate-300 mt-0.5 leading-snug">
                Estás en <strong className="text-cyan-300">{instruction.currentZone}</strong>.{' '}
                {instruction.detail}
              </p>

              {instruction.targetText && (
                <div className="flex items-center gap-1.5 text-xs text-violet-300 font-semibold mt-0.5">
                  <ArrowRight className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                  <span className="truncate">{instruction.targetText}</span>
                </div>
              )}
            </div>
          </div>

          {/* MONITOR GIGANTE DE CONTEO EN VIVO */}
          <div className="bg-slate-950 border border-slate-800 px-4 py-2 rounded-xl text-center shrink-0 flex flex-col items-center justify-center min-w-[140px] shadow-inner">
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
              Conteo Musical
            </span>
            <span className="text-xl sm:text-2xl font-black text-emerald-400 font-mono tracking-tight animate-pulse">
              {activeBeat ? `OCHO ${activeBeat.phraseIndex} · T${activeBeat.countNumber}` : 'OCHO 1 · T1'}
            </span>
          </div>
        </div>

        {/* Nota de Seguridad: Solo Lectura y Modo Director Opcional */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-800/80 pt-2">
          <div className="flex items-center gap-1 text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Modo Solo Lectura · Sincronizado en tiempo real</span>
          </div>

          {onSwitchToDirector && (
            <button
              type="button"
              onClick={onSwitchToDirector}
              className="text-slate-500 hover:text-slate-300 underline transition"
            >
              Cambiar a Modo Estudio
            </button>
          )}
        </div>
      </footer>
    </div>
  );
};
