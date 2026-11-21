import { StudioBrandSettings, type StudioBrand } from './StudioBrandSettings';
import { useRef, useState } from 'react';
import { AudioLines, Download, Music2, Radio, Users } from 'lucide-react';
import { Beat } from '../../types/choreo';

interface HeaderProps {
  sessionName: string;
  brand: StudioBrand;
  onBrandChange: (brand: StudioBrand) => void;
  currentBeat: Beat | null;
  bpm: number;
  fileSaveStatus: string;
  audioFileName?: string;
  isSyntheticAudio: boolean;
  onTempoChange: (bpm: number) => void;
  onUploadAudio: (file: File) => void;
  onSave: () => void;
  onPreviewDancer: () => void;
  onOpenLiveModal: () => void;
  isRealtimeConnected: boolean;
}

export function Header({
  sessionName, brand, onBrandChange, fileSaveStatus, currentBeat, bpm, audioFileName, isSyntheticAudio, onTempoChange,
  onUploadAudio, onSave, onPreviewDancer, onOpenLiveModal, isRealtimeConnected,
}: HeaderProps) {
  const audioInput = useRef<HTMLInputElement>(null);
  const [tempo, setTempo] = useState(String(bpm));

  return (
    <header className="studio-header">
      <div className="studio-identity">
        <div className="studio-mark">{brand.logo ? <img src={brand.logo} alt={brand.name || 'Logo de la academia'} /> : <AudioLines size={21} />}</div>
        <div className="min-w-0">
          <div className="studio-brand">ChoreoSync <span>Pro</span></div>
          <div className="studio-session" title={sessionName}>{brand.name ? brand.name + ' · ' + sessionName : sessionName}</div>
          {fileSaveStatus && <div className="studio-save-status" role="status">{fileSaveStatus}</div>}
        </div>
      </div>

      <div className="studio-count" aria-label={currentBeat
        ? 'Ocho ' + currentBeat.phraseIndex + ', tiempo ' + currentBeat.countNumber
        : 'Sin conteo activo'}>
        <span className="studio-phrase">Ocho <strong>{currentBeat ? String(currentBeat.phraseIndex).padStart(2, '0') : '—'}</strong></span>
        <div className="studio-count-steps" aria-hidden="true">
          {Array.from({ length: 8 }, (_, index) => (
            <span key={index} data-active={currentBeat?.countNumber === index + 1}>{index + 1}</span>
          ))}
        </div>
      </div>

      <div className="studio-actions">
        <StudioBrandSettings brand={brand} onChange={onBrandChange} />
        <form className="studio-tempo" onSubmit={(event) => {
          event.preventDefault();
          onTempoChange(Number(tempo));
        }}>
          <input aria-label="Tempo en BPM" type="number" min={30} max={300} step={1}
            required value={tempo} onChange={(event) => setTempo(event.target.value)} />
          <button type="submit" title="Generar conteos al tempo indicado">BPM</button>
        </form>
        <button type="button" className="studio-button studio-track"
          onClick={() => audioInput.current?.click()}
          title={audioFileName ? (isSyntheticAudio ? 'Reconectar ' : 'Cambiar ') + audioFileName : 'Cargar pista de audio'}>
          <Music2 size={16} /><span>{audioFileName && !isSyntheticAudio ? audioFileName : 'Cargar pista'}</span>
        </button>
        <input ref={audioInput} type="file" accept="audio/*,.mp3,.wav,.m4a" hidden
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) onUploadAudio(file);
            event.currentTarget.value = '';
          }} />
        <button type="button" className="studio-button" onClick={onSave} aria-label="Guardar sesión" title="Guardar sesión"><Download size={16} /></button>
        <button type="button" className="studio-button" onClick={onPreviewDancer} title="Vista del bailarín"><Users size={16} /><span>Bailarín</span></button>
        <button type="button" className="studio-button studio-live" onClick={onOpenLiveModal}
          title={isRealtimeConnected ? 'Servidor de sala conectado' : 'Configurar conexión de la sala'}>
          <Radio size={16} /><span>Sala en vivo</span><i data-connected={isRealtimeConnected} />
        </button>
      </div>
    </header>
  );
}
