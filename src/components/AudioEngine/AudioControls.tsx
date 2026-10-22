import React from 'react';
import { Play, Pause, Square, Repeat, Volume2, Disc, RefreshCw, Trash2, Mic } from 'lucide-react';
import { SpeedRate } from '../../types/choreo';

interface AudioControlsProps {
  isPlaying: boolean;
  currentTimeMs: number;
  durationMs: number;
  playbackRate: SpeedRate;
  isLoopPhrase: boolean;
  isMetronomeEnabled: boolean;
  isRecordCountsMode: boolean;
  onTogglePlay: () => void;
  onStop: () => void;
  onChangeRate: (rate: SpeedRate) => void;
  onToggleLoop: () => void;
  onToggleMetronome: () => void;
  onToggleRecordCounts: () => void;
  onTapBeat: () => void;
  onResetCountToOne: () => void;
  onClearBeats: () => void;
}

export const AudioControls: React.FC<AudioControlsProps> = ({
  isPlaying,
  currentTimeMs,
  durationMs,
  playbackRate,
  isLoopPhrase,
  isMetronomeEnabled,
  isRecordCountsMode,
  onTogglePlay,
  onStop,
  onChangeRate,
  onToggleLoop,
  onToggleMetronome,
  onToggleRecordCounts,
  onTapBeat,
  onResetCountToOne,
  onClearBeats,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-900 border-t border-slate-800 text-xs select-none">
      {/* Controles de reproducción principales */}
      <div className="flex items-center gap-2">
        <button
          onClick={onTogglePlay}
          className={`flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg font-bold text-xs shadow-md transition-all ${
            isPlaying
              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/30'
              : 'bg-violet-600 hover:bg-violet-500 text-white shadow-violet-500/40'
          }`}
        >
          {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
          <span>{isPlaying ? 'Pausa' : 'Play'}</span>
        </button>

        <button
          onClick={onStop}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          title="Detener y volver al inicio"
        >
          <Square className="w-4 h-4 fill-current" />
        </button>

        {/* Contador de tiempo actual / duración */}
        <div className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 font-mono text-emerald-400 font-bold min-w-[105px] text-center">
          {(currentTimeMs / 1000).toFixed(2)}s / {(durationMs / 1000).toFixed(1)}s
        </div>

        {/* Selector de Velocidad */}
        <select
          value={playbackRate}
          onChange={(e) => onChangeRate(Number(e.target.value) as SpeedRate)}
          className="bg-slate-800 text-slate-200 border border-slate-700 rounded-lg px-2 py-1 text-xs outline-none cursor-pointer hover:bg-slate-700"
        >
          <option value={0.5}>0.5x</option>
          <option value={0.75}>0.75x</option>
          <option value={1}>1.0x</option>
        </select>

        {/* Bucle Ocho */}
        <button
          onClick={onToggleLoop}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border transition ${
            isLoopPhrase
              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
          }`}
          title="Repetir en bucle el Ocho actual"
        >
          <Repeat className="w-3.5 h-3.5" />
          <span>Bucle Ocho</span>
        </button>

        {/* Metrónomo */}
        <label className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-300 cursor-pointer hover:bg-slate-800">
          <input
            type="checkbox"
            checked={isMetronomeEnabled}
            onChange={onToggleMetronome}
            className="w-3.5 h-3.5 rounded text-violet-600 focus:ring-0 bg-slate-950 border-slate-600"
          />
          <Volume2 className="w-3.5 h-3.5 text-violet-400" />
          <span>Metrónomo</span>
        </label>
      </div>

      {/* SISTEMA TAP-TO-BEAT (Mapeo de conteos 1 al 8 en vivo) */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={onToggleRecordCounts}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border font-medium transition ${
            isRecordCountsMode
              ? 'bg-rose-500/20 border-rose-500 text-rose-300 animate-pulse'
              : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
          }`}
          title="Activar modo grabación: Espacio o botón marca los tiempos"
        >
          <Mic className="w-3.5 h-3.5 text-rose-400" />
          <span>{isRecordCountsMode ? '● Grabando conteos' : 'Grabar conteos'}</span>
        </button>

        <button
          onClick={onTapBeat}
          className="flex items-center gap-1 px-3 py-1 rounded-lg bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white font-bold shadow-md shadow-violet-500/30 transition active:scale-95"
          title="Marcar tiempo musical (Atajo: tecla T o Espacio en modo grabar)"
        >
          <Disc className="w-3.5 h-3.5" />
          <span>Marcar Tiempo [T]</span>
        </button>

        <button
          onClick={onResetCountToOne}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition"
          title="Forzar a que el próximo marcador sea el Tiempo 1 de un nuevo Ocho"
        >
          <RefreshCw className="w-3 h-3 text-cyan-400" />
          <span>Reiniciar en 1</span>
        </button>

        <button
          onClick={onClearBeats}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-700 transition"
          title="Borrar todos los conteos de la línea de tiempo"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
