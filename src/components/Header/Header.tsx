import React, { useRef } from 'react';
import { ViewMode, Beat } from '../../types/choreo';
import { 
  Play, 
  Pause, 
  Download, 
  Upload, 
  Music, 
  Radio, 
  RotateCcw, 
  Users, 
  Sliders, 
  Wifi, 
  WifiOff 
} from 'lucide-react';

interface HeaderProps {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  currentBeat: Beat | null;
  audioFileName?: string;
  isSyntheticAudio?: boolean;
  onExportJson: () => void;
  onImportJson: (file: File) => void;
  onUploadAudio: (file: File) => void;
  onResetDemo: () => void;
  onSyntheticAudio: () => void;
  onOpenLiveModal: () => void;
  isRealtimeConnected: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  viewMode,
  setViewMode,
  currentBeat,
  audioFileName,
  isSyntheticAudio = true,
  onExportJson,
  onImportJson,
  onUploadAudio,
  onResetDemo,
  onSyntheticAudio,
  onOpenLiveModal,
  isRealtimeConnected,
}) => {
  const audioInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadAudio(file);
      e.target.value = '';
    }
  };

  const handleJsonChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportJson(file);
      e.target.value = '';
    }
  };

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-slate-900 border-b border-slate-800 select-none z-20">
      {/* Logo & Modo de Vista */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-violet-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Radio className="w-4 h-4 text-white animate-pulse" />
          </div>
          <span className="font-black text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-violet-400 via-cyan-300 to-emerald-400">
            ChoreoSync <span className="text-white font-extrabold text-sm px-1.5 py-0.5 rounded bg-violet-600/30 border border-violet-500/40">PRO</span>
          </span>
        </div>

        {/* Selector de Modo */}
        <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800">
          <button
            onClick={() => setViewMode('choreographer')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
              viewMode === 'choreographer'
                ? 'bg-violet-600 text-white shadow-sm shadow-violet-500/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Coreógrafo
          </button>
          <button
            onClick={() => setViewMode('dancer')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
              viewMode === 'dancer'
                ? 'bg-cyan-500 text-slate-950 shadow-sm shadow-cyan-500/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Bailarín
          </button>
        </div>
      </div>

      {/* CONTADOR GIGANTE EN PANTALLA */}
      <div className="flex items-center justify-center flex-1 min-w-[220px]">
        <div className="px-5 py-1 rounded-xl bg-slate-950/80 border border-slate-800/80 shadow-inner flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-lg sm:text-2xl md:text-3xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-400 font-mono">
            {currentBeat
              ? `OCHO #${currentBeat.phraseIndex} | TIEMPO ${currentBeat.countNumber}`
              : 'OCHO #1 | TIEMPO 1'}
          </span>
        </div>
      </div>

      {/* Controles y Acciones */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* Sala en Vivo / QR Sync */}
        <button
          onClick={onOpenLiveModal}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
            isRealtimeConnected
              ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/60'
              : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
          }`}
          title="Sincronizar celulares en vivo vía QR o Wi-Fi"
        >
          {isRealtimeConnected ? (
            <Wifi className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          ) : (
            <WifiOff className="w-3.5 h-3.5 text-slate-400" />
          )}
          <span>Sala en Vivo</span>
        </button>

        {viewMode === 'choreographer' && (
          <>
            <button
              onClick={onExportJson}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 font-medium transition"
              title="Exportar archivo de proyecto .json"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Exportar .json</span>
            </button>

            <button
              onClick={() => jsonInputRef.current?.click()}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 font-medium transition"
              title="Importar archivo de proyecto .json"
            >
              <Upload className="w-3.5 h-3.5 text-violet-400" />
              <span className="hidden sm:inline">Importar .json</span>
            </button>

            <button
              onClick={() => audioInputRef.current?.click()}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-violet-950/60 hover:bg-violet-900/60 border border-violet-500/40 text-xs text-violet-200 font-medium transition"
              title="Subir archivo .mp3, .wav o .m4a"
            >
              <Music className="w-3.5 h-3.5 text-violet-400" />
              <span>Subir audio</span>
            </button>

            {audioFileName && (
              <button
                type="button"
                onClick={() => audioInputRef.current?.click()}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition ${
                  isSyntheticAudio
                    ? 'bg-amber-950/60 border-amber-500/50 text-amber-300 hover:bg-amber-900/60 animate-pulse'
                    : 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/40'
                }`}
                title={
                  isSyntheticAudio 
                    ? `Haz clic para reconectar el archivo de audio: "${audioFileName}"` 
                    : `Audio vinculado y listo: ${audioFileName}`
                }
              >
                <Music className="w-3 h-3 text-cyan-400" />
                <span className="max-w-[120px] truncate">{audioFileName}</span>
                <span className={`w-2 h-2 rounded-full ${isSyntheticAudio ? 'bg-amber-400' : 'bg-emerald-400'}`} />
              </button>
            )}

            <button
              onClick={onSyntheticAudio}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 font-medium transition"
              title="Generar ritmo de conteos sintéticos a 120 BPM"
            >
              <span>Sintético 120 BPM</span>
            </button>

            <button
              onClick={onResetDemo}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/50 hover:border-rose-700 border border-slate-700 text-xs text-slate-400 hover:text-rose-300 transition"
              title="Restaurar coreografía de demostración (8 bailarines, 3 formaciones)"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Demo</span>
            </button>
          </>
        )}

        {/* Inputs ocultos */}
        <input
          ref={audioInputRef}
          type="file"
          accept="audio/*,.mp3,.wav,.m4a"
          className="hidden"
          onChange={handleAudioChange}
        />
        <input
          ref={jsonInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleJsonChange}
        />
      </div>
    </header>
  );
};
