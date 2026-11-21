import { useRef, useState } from 'react';
import { Settings2 } from 'lucide-react';

export interface StudioBrand {
  name: string;
  accent: string;
  logo: string;
}

const key = 'choreosync.studio-brand';
const defaults: StudioBrand = { name: '', accent: '#d9f788', logo: '' };

export function getAccentText(color: string): string {
  const channels = [1, 3, 5].map((offset) => {
    const value = parseInt(color.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return luminance > 0.179 ? '#000000' : '#ffffff';
}

export function readStudioBrand(): StudioBrand {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null');
    if (saved && /^#[0-9a-f]{6}$/i.test(saved.accent)) return { ...defaults, ...saved };
  } catch {}
  return defaults;
}

export function StudioBrandSettings({ brand, onChange }: {
  brand: StudioBrand;
  onChange: (brand: StudioBrand) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(brand);
  const [error, setError] = useState('');

  return <>
    <button type="button" className="studio-button" title="Identidad de la academia"
      aria-label="Identidad de la academia" onClick={() => {
        setDraft(brand);
        setError('');
        dialog.current?.showModal();
      }}><Settings2 size={16} /></button>
    <dialog ref={dialog} className="studio-settings" aria-labelledby="brand-title">
      <form onSubmit={(event) => {
        event.preventDefault();
        try {
          localStorage.setItem(key, JSON.stringify(draft));
          onChange(draft);
          dialog.current?.close();
        } catch {
          setError('No se pudo guardar la identidad en este navegador.');
        }
      }}>
        <h2 id="brand-title">Identidad de la academia</h2>
        <label>Nombre <input value={draft.name} maxLength={70}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
        <label>Color de acento <input type="color" value={draft.accent}
          onChange={(event) => setDraft({ ...draft, accent: event.target.value })} /></label>
        <label>Logo PNG, JPEG o WebP · hasta 512 KB
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            if (file.size > 512 * 1024 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
              setError('Usa una imagen PNG, JPEG o WebP de hasta 512 KB.');
              return;
            }
            const reader = new FileReader();
            reader.onload = () => {
              setDraft((previous) => ({ ...previous, logo: String(reader.result) }));
              setError('');
            };
            reader.onerror = () => setError('No se pudo leer la imagen.');
            reader.readAsDataURL(file);
          }} />
        </label>
        {draft.logo && <button type="button" onClick={() => setDraft({ ...draft, logo: '' })}>Quitar logo</button>}
        {error && <p role="alert">{error}</p>}
        <footer>
          <button type="button" onClick={() => dialog.current?.close()}>Cancelar</button>
          <button type="submit">Guardar identidad</button>
        </footer>
      </form>
    </dialog>
  </>;
}
