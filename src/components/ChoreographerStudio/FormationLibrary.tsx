import { useMemo, useRef, useState } from 'react';
import { Shapes } from 'lucide-react';
import { distributePreset, formationPresets, type FormationPreset } from '../../utils/formationPresets';

const families = [...new Set(formationPresets.map(({ family }) => family))];
const searchKey = (value: string) => value.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

export function FormationLibrary({ castSize, onApply }: {
  castSize: number;
  onApply: (preset: FormationPreset) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [family, setFamily] = useState('');
  const [query, setQuery] = useState('');
  const choices = useMemo(() => formationPresets.filter((preset) =>
    (!family || preset.family === family) && searchKey(preset.name).includes(searchKey(query.trim()))
  ), [family, query]);

  return <>
    <button type="button" className="studio-button" onClick={() => dialog.current?.showModal()}>
      <Shapes size={15} /> Figuras
    </button>
    <dialog ref={dialog} className="studio-settings studio-library" aria-labelledby="figure-title">
      <div className="studio-tool-heading">
        <div>
          <h2 id="figure-title">Biblioteca de figuras</h2>
          <p>{formationPresets.length} figuras · {castSize} {castSize === 1 ? 'bailarín' : 'bailarines'}</p>
        </div>
        <button type="button" onClick={() => dialog.current?.close()}>Cerrar</button>
      </div>
      <div className="studio-settings-grid studio-library-filters">
        <label>Buscar figura <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <label>Familia <select value={family} onChange={(event) => setFamily(event.target.value)}>
          <option value="">Todas</option>
          {families.map((name) => <option key={name}>{name}</option>)}
        </select></label>
      </div>
      <p className="mb-3 text-slate-300">{castSize > 0
        ? 'Elige una figura para colocar al elenco en el tiempo actual.'
        : 'Añade bailarines al proyecto para aplicar una figura.'}</p>
      <div className="studio-figure-grid">
        {choices.map((preset) => (
          <button type="button" disabled={castSize === 0} key={preset.id} onClick={() => {
            onApply(preset);
            dialog.current?.close();
          }}>
            <div className="studio-figure-preview" aria-hidden="true">
              {distributePreset(preset, Math.min(castSize || 8, 40)).map((p, index) =>
                <i key={index} style={{ left: (p.x * 100) + '%', top: (p.y * 100) + '%' }} />)}
            </div>
            <span>{preset.name}</span>
          </button>
        ))}
      </div>
      {choices.length === 0 && <p role="status">No hay figuras para esta búsqueda.</p>}
    </dialog>
  </>;
}
