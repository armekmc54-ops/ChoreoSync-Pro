import { useEffect, useRef, useState } from 'react';
import { Layers3 } from 'lucide-react';
import { createScenicObject, drawScenery, scenicKinds, scenicLabels, sceneryPresets, type ScenicKind, type ScenicObject } from '../../utils/scenery';

export function SceneryEditor({ objects, timeMs, durationMs, visible, onVisibilityChange, onChange }: {
  objects: ScenicObject[];
  timeMs: number;
  durationMs: number;
  visible: boolean;
  onVisibilityChange: (visible: boolean) => void;
  onChange: (objects: ScenicObject[]) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const preview = useRef<HTMLCanvasElement>(null);
  const [draft, setDraft] = useState<ScenicObject | null>(null);
  const [previewTime, setPreviewTime] = useState(0);
  useEffect(() => {
    const ctx = preview.current?.getContext('2d');
    if (!ctx) return;
    const rect = { x: 8, y: 8, w: 344, h: 216 };
    ctx.clearRect(0, 0, 360, 232);
    ctx.fillStyle = '#17131e';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = '#635b70';
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    drawScenery(ctx, rect, objects, previewTime, false);
  }, [objects, previewTime, draft]);
  const [template, setTemplate] = useState('');
  const [error, setError] = useState('');
  const newObject = () => createScenicObject({
    kind: 'prop', name: 'Utilería', color: '#a9c3e5', x: .5, y: .5, width: .2, height: .18,
  }, Math.max(0, Math.min(Math.round(timeMs), durationMs - 1)), durationMs);

  return <>
    <button type="button" className="studio-button" onClick={() => {
      setDraft(null);
      setPreviewTime(timeMs);
      setError('');
      dialog.current?.showModal();
    }}><Layers3 size={15} /> Escenografía{objects.length > 0 && ' (' + objects.length + ')'}</button>
    <dialog ref={dialog} className="studio-settings studio-library" aria-labelledby="scenery-title">
      <div className="studio-tool-heading">
        <div><h2 id="scenery-title">Escenografía</h2><p>Capas y tiempos del plano de escena</p></div>
        <button type="button" onClick={() => dialog.current?.close()}>Cerrar</button>
      </div>
      <label className="studio-layer-toggle">
        <input type="checkbox" checked={visible} onChange={(event) => onVisibilityChange(event.target.checked)} />
        Mostrar escenografía en el estudio
      </label>
      <div className="studio-scenery-workbench">
        <section>
          <label>Plantilla de escena
            <select value={template} onChange={(event) => setTemplate(event.target.value)}>
              <option value="">Selecciona una plantilla</option>
              {sceneryPresets.map((preset) => <option key={preset.name}>{preset.name}</option>)}
            </select>
          </label>
          <div className="studio-tool-row">
            <button type="button" disabled={!template} onClick={() => {
              const preset = sceneryPresets.find((entry) => entry.name === template);
              if (!preset) return;
              const range = newObject();
              const added = preset.objects.map((item) => createScenicObject(item, range.startMs, range.endMs));
              onChange([...objects, ...added]);
              onVisibilityChange(true);
              setTemplate('');
            }}>Añadir plantilla</button>
            <button type="button" onClick={() => { setDraft(newObject()); setError(''); }}>Nuevo objeto</button>
          </div>
          <ul className="studio-contact-list">
            {objects.map((item) => <li key={item.id}>
              <span><strong>{item.name}</strong><br />{scenicLabels[item.kind]} · {item.startMs / 1000}–{item.endMs / 1000} s</span>
              <button type="button" onClick={() => { setDraft(item); setError(''); }}>Editar</button>
            </li>)}
          </ul>
          {!objects.length && <p className="text-slate-300">Añade una plantilla o empieza con un objeto.</p>}
        </section>
        {!draft && <section>
          <canvas ref={preview} width={360} height={232} className="studio-scenery-preview"
            aria-label="Vista previa en planta de la escenografía" />
          <label>Vista previa · {(previewTime / 1000).toFixed(2)} s
            <input type="range" min="0" max={durationMs} step="1" value={previewTime}
              onChange={(event) => setPreviewTime(Number(event.target.value))} />
          </label>
        </section>}
        {draft && <form key={draft.id} onSubmit={(event) => {
          event.preventDefault();
          const fields = new FormData(event.currentTarget);
          const values = {
            ...draft,
            name: String(fields.get('name')).trim(),
            kind: String(fields.get('kind')) as ScenicKind,
            color: String(fields.get('color')),
            x: Number(fields.get('x')) / 100, y: Number(fields.get('y')) / 100,
            width: Number(fields.get('width')) / 100, height: Number(fields.get('height')) / 100,
            startMs: Math.round(Number(fields.get('start')) * 1000), endMs: Math.round(Number(fields.get('end')) * 1000),
          };
          if (!values.name || values.endMs <= values.startMs) {
            setError('Escribe un nombre y fija un final posterior al inicio.');
            return;
          }
          onChange(objects.some((item) => item.id === draft.id)
            ? objects.map((item) => item.id === draft.id ? values : item) : [...objects, values]);
          onVisibilityChange(true);
          setDraft(null);
        }}>
          <label>Nombre <input name="name" defaultValue={draft.name} maxLength={70} required /></label>
          <div className="studio-settings-grid">
            <label>Tipo <select name="kind" defaultValue={draft.kind}>
              {scenicKinds.map((kind) => <option value={kind} key={kind}>{scenicLabels[kind]}</option>)}
            </select></label>
            <label>Color <input name="color" type="color" defaultValue={draft.color} /></label>
            {([['x', 'Centro X (%)'], ['y', 'Centro Y (%)'], ['width', 'Ancho (%)'], ['height', 'Fondo (%)']] as const)
              .map(([key, label]) => <label key={key}>{label}
                <input name={key} type="number" min={key === 'width' || key === 'height' ? 1 : 0} max={100}
                  step="0.1" defaultValue={Math.round(draft[key] * 1000) / 10} required />
              </label>)}
            <label>Desde (s) <input name="start" type="number" min="0" max={durationMs / 1000} step="0.001" defaultValue={draft.startMs / 1000} required /></label>
            <label>Hasta (s) <input name="end" type="number" min="0" max={durationMs / 1000} step="0.001" defaultValue={draft.endMs / 1000} required /></label>
          </div>
          {error && <p role="alert">{error}</p>}
          <footer>
            {objects.some((item) => item.id === draft.id) && <button type="button" onClick={() => {
              onChange(objects.filter((item) => item.id !== draft.id));
              setDraft(null);
            }}>Quitar objeto</button>}
            <button type="submit">Guardar objeto</button>
          </footer>
        </form>}
      </div>
    </dialog>
  </>;
}
