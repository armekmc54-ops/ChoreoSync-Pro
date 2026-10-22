import React from 'react';
import { Dancer, Formation, Beat } from '../../types/choreo';
import { 
  getActiveFormationIndex, 
  calculateDancersPose, 
  getStageZone, 
  clamp 
} from '../../utils/interpolation';
import { UserCheck, Compass, ArrowRight, ShieldAlert, Sparkles, Volume2 } from 'lucide-react';

interface DancerViewProps {
  dancers: Dancer[];
  formations: Formation[];
  beats: Beat[];
  currentTimeMs: number;
  selectedDancerId: string | null;
  isMirror: boolean;
  onSelectDancer: (dancerId: string) => void;
  onToggleMirror: () => void;
}

export const DancerView: React.FC<DancerViewProps> = ({
  dancers,
  formations,
  beats,
  currentTimeMs,
  selectedDancerId,
  isMirror,
  onSelectDancer,
  onToggleMirror,
}) => {
  const currentDancer = dancers.find((d) => d.id === selectedDancerId) || dancers[0];
  const currentFormationIdx = getActiveFormationIndex(formations, currentTimeMs);
  const currentFormation = formations[currentFormationIdx];
  const nextFormation = formations[currentFormationIdx + 1];

  const currentPoses = calculateDancersPose(formations, dancers, currentTimeMs);
  const myPose = currentDancer ? currentPoses[currentDancer.id] : null;

  // Encontrar el conteo activo
  const activeBeat = beats.reduce<Beat | null>((acc, b) => {
    if (b.timestampMs <= currentTimeMs + 10) return b;
    return acc;
  }, null);

  // Generar instrucciones textuales automáticas
  let instruction = {
    currentZone: 'Escenario',
    level: 'medio',
    status: 'Estático (Hold)',
    statusColor: 'text-emerald-400 bg-emerald-950/60 border-emerald-500/30',
    detail: 'Mantente firme en tu posición inicial.',
    timeToMoveText: '',
    targetText: '',
  };

  if (myPose && currentFormation) {
    const zoneInfo = getStageZone(myPose.x, myPose.y);
    instruction.currentZone = zoneInfo.label;
    instruction.level = myPose.level;

    const holdEndMs = currentFormation.startTimeMs + currentFormation.holdDurationMs;
    const transEndMs = holdEndMs + currentFormation.transitionDurationMs;

    if (nextFormation && nextFormation.positions[currentDancer.id]) {
      const nextPos = nextFormation.positions[currentDancer.id];
      const nextZone = getStageZone(nextPos.x, nextPos.y);

      if (currentTimeMs < holdEndMs) {
        const remainingSec = ((holdEndMs - currentTimeMs) / 1000).toFixed(1);
        instruction.status = 'En Espera (Hold)';
        instruction.statusColor = 'text-cyan-400 bg-cyan-950/60 border-cyan-500/30';
        instruction.detail = `Mantén tu posición. Te desplazas hacia “${nextFormation.name}” en ${remainingSec}s.`;
        instruction.targetText = `Destino: ${nextZone.label} (Nivel ${nextPos.level})`;
      } else if (currentTimeMs < transEndMs) {
        const progressPct = Math.round(myPose.progress * 100);
        instruction.status = `En Movimiento (${progressPct}%)`;
        instruction.statusColor = 'text-amber-400 bg-amber-950/60 border-amber-500/30';
        instruction.detail = `Moviéndote hacia ${nextZone.label}. Llega a tiempo al nivel ${nextPos.level}.`;
        instruction.targetText = `Destino: ${nextZone.label} (Nivel ${nextPos.level})`;
      } else {
        instruction.status = 'Formación Alcanzada';
        instruction.statusColor = 'text-emerald-400 bg-emerald-950/60 border-emerald-500/30';
        instruction.detail = `¡Excelente! Ya estás en la formación “${nextFormation.name}”.`;
      }
    } else {
      instruction.status = 'Formación Final';
      instruction.statusColor = 'text-violet-400 bg-violet-950/60 border-violet-500/30';
      instruction.detail = 'Última formación de la coreografía. Mantén pose final.';
    }
  }

  return (
    <div className="w-full bg-slate-900 border-t border-slate-800 p-3 sm:p-4 text-slate-100 flex flex-col gap-3">
      {/* Barra superior de selección de identidad del bailarín */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-cyan-400" />
            <span>¿Quién eres?</span>
          </label>
          <select
            value={currentDancer?.id || ''}
            onChange={(e) => onSelectDancer(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-medium outline-none focus:border-cyan-400 cursor-pointer"
          >
            {dancers.map((d) => (
              <option key={d.id} value={d.id}>
                #{d.slotNumber} - {d.name} ({d.group})
              </option>
            ))}
          </select>
        </div>

        {/* Botón Modo Espejo 180° */}
        <button
          onClick={onToggleMirror}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition ${
            isMirror
              ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/30'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
          }`}
          title="Gira 180° el escenario para que tu izquierda y derecha coincidan con tu visión real sobre las tablas"
        >
          <Compass className="w-4 h-4" />
          <span>{isMirror ? 'Modo Espejo Activo (180°)' : 'Vista Público (Normal)'}</span>
        </button>
      </div>

      {/* TARJETA DE INSTRUCCIONES EN VIVO */}
      {currentDancer && (
        <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-start gap-3">
            {/* Avatar / Token del bailarín con su color */}
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-slate-950 text-sm shadow-md shrink-0 border-2 border-white"
              style={{ backgroundColor: currentDancer.color }}
            >
              {currentDancer.slotNumber}
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm text-white">{currentDancer.name}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${instruction.statusColor}`}>
                  {instruction.status}
                </span>
                <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700 uppercase font-mono">
                  NIVEL: {instruction.level}
                </span>
              </div>

              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Estás en <strong className="text-cyan-300">{instruction.currentZone}</strong>.{' '}
                {instruction.detail}
              </p>

              {instruction.targetText && (
                <div className="flex items-center gap-1.5 text-xs text-violet-300 font-medium mt-1">
                  <ArrowRight className="w-3.5 h-3.5 text-violet-400" />
                  <span>{instruction.targetText}</span>
                </div>
              )}
            </div>
          </div>

          {/* Mini monitor de conteo en la tarjeta del bailarín */}
          <div className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-lg text-center shrink-0">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest block font-bold">
              Conteo Sincronizado
            </span>
            <span className="text-base font-black text-emerald-400 font-mono">
              {activeBeat ? `O${activeBeat.phraseIndex} · T${activeBeat.countNumber}` : 'O1 · T1'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
