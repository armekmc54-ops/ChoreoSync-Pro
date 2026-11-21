import { useRef, useState } from 'react';
import type { Dancer, PlannedContact } from '../../types/choreo';

export function PlannedContacts({ dancers, contacts, timeMs, durationMs, onChange }: {
  dancers: Dancer[];
  contacts: PlannedContact[];
  timeMs: number;
  durationMs: number;
  onChange: (contacts: PlannedContact[]) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [start, setStart] = useState(0);
  const [error, setError] = useState('');
  const name = (id: string) => dancers.find((dancer) => dancer.id === id)?.name || 'Bailarín retirado';

  return <>
    <button type="button" className="studio-button" onClick={() => {
      setStart(Math.min(Math.floor(timeMs / 100) / 10, Math.max(0, (durationMs - 100) / 1000)));
      setError('');
      dialog.current?.showModal();
    }}>Apoyos previstos{contacts.length ? ' (' + contacts.length + ')' : ''}</button>
    <dialog ref={dialog} className="studio-settings" aria-labelledby="contacts-title">
      <form key={start} onSubmit={(event) => {
        event.preventDefault();
        const fields = new FormData(event.currentTarget);
        const dancerIdA = String(fields.get('a'));
        const dancerIdB = String(fields.get('b'));
        const startMs = Math.round(Number(fields.get('start')) * 1000);
        const endMs = Math.round(Number(fields.get('end')) * 1000);
        const description = String(fields.get('description')).trim();
        if (dancerIdA === dancerIdB || startMs < 0 || endMs <= startMs || endMs > durationMs || !description) {
          setError('Selecciona dos bailarines distintos, un intervalo válido y una indicación.');
          return;
        }
        onChange([...contacts, { id: crypto.randomUUID?.() || String(Date.now()), dancerIdA, dancerIdB, startMs, endMs, description }]);
        dialog.current?.close();
      }}>
        <h2 id="contacts-title">Apoyos previstos</h2>
        <p>Indica quiénes hacen contacto y durante qué intervalo. La indicación aparecerá en sus vistas.</p>
        {contacts.length > 0 && <ul className="studio-contact-list">
          {contacts.map((item) => <li key={item.id}>
            <span><strong>{name(item.dancerIdA)} + {name(item.dancerIdB)}</strong> · {item.startMs / 1000}–{item.endMs / 1000} s<br />{item.description}</span>
            <button type="button" onClick={() => onChange(contacts.filter((entry) => entry.id !== item.id))}>Quitar</button>
          </li>)}
        </ul>}
        <div className="studio-settings-grid">
          {['a', 'b'].map((id, index) => <label key={id}>Bailarín {index + 1}
            <select name={id} defaultValue={dancers[index]?.id} required>
              {dancers.map((dancer) => <option key={dancer.id} value={dancer.id}>{dancer.name}</option>)}
            </select>
          </label>)}
          <label>Inicio (s)<input name="start" type="number" step="0.001" min="0" max={durationMs / 1000} defaultValue={start} required /></label>
          <label>Fin (s)<input name="end" type="number" step="0.001" min="0" max={durationMs / 1000} defaultValue={Math.min(start + 1, durationMs / 1000)} required /></label>
        </div>
        <label>Indicación <textarea name="description" placeholder="Ej. Mortal apoyada" maxLength={240} required /></label>
        {error && <p role="alert">{error}</p>}
        <footer>
          <button type="button" onClick={() => dialog.current?.close()}>Cerrar</button>
          <button type="submit" disabled={dancers.length < 2}>Registrar apoyo</button>
        </footer>
      </form>
    </dialog>
  </>;
}
