import { useEffect, useRef, useState } from 'react';
import { Copy, ExternalLink, Radio, Smartphone, X } from 'lucide-react';
import { realtimeManager, type DirectorStatus } from '../../utils/realtime';

interface LiveRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  onRoomIdChange: (roomId: string) => void;
}

interface NetworkAddress {
  name: string;
  address: string;
}

export function LiveRoomModal({ isOpen, onClose, roomId, onRoomIdChange }: LiveRoomModalProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [addresses, setAddresses] = useState<NetworkAddress[]>([]);
  const [room, setRoom] = useState(roomId);
  const [host, setHost] = useState('');
  const [qr, setQr] = useState('');
  const [feedback, setFeedback] = useState('');
  const [publicMode, setPublicMode] = useState(false);
  const [directorStatus, setDirectorStatus] = useState<DirectorStatus>('idle');
  const [key, setKey] = useState('');
  useEffect(() => realtimeManager.onDirectorStatus(setDirectorStatus), []);
  const { hostname, protocol, port } = window.location;
  const isLoopback = ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
  const withPort = (address: string) => address + (port ? ':' + port : '');
  const defaultAddress = addresses.find(({ name }) => /wi.?fi|wlan|wireless/i.test(name))
    ?? addresses.find(({ name }) => !/virtual|vethernet|hyper-v|vmware|wsl|docker/i.test(name))
    ?? addresses[0];
  const effectiveHost = host.trim() || (isLoopback && defaultAddress ? withPort(defaultAddress.address) : !isLoopback ? window.location.host : '');
  let liveUrl = '';
  if (effectiveHost && (!publicMode || directorStatus === 'authorized')) {
    try {
      const url = new URL(protocol + '//' + effectiveHost);
      if (!url.username && !url.password && url.pathname === '/' && !url.search && !url.hash &&
          !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
        url.searchParams.set('room', roomId);
        url.searchParams.set('mode', 'dancer');
        liveUrl = url.href;
      }
    } catch {
      // Wait for the user to finish entering an address.
    }
  }

  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    dialog.current?.showModal();
    fetch('/api/live-hosts', { signal: controller.signal })
      .then((response) => response.ok ? response.json() : [])
      .then((result) => { if (Array.isArray(result)) setAddresses(result); })
      .catch(() => {});
    fetch('/api/live-config', { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((config) => setPublicMode(config?.requiresDirectorKey === true))
      .catch(() => {});
    realtimeManager.connectWebSocket();
    return () => controller.abort();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !liveUrl) return;
    let current = true;
    realtimeManager.generateRoomQR(liveUrl).then((image) => {
      if (current) setQr(image);
    });
    return () => {
      current = false;
      setQr('');
    };
  }, [isOpen, liveUrl]);

  if (!isOpen) return null;

  const field = 'min-w-0 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm';
  const button = 'inline-flex items-center gap-2 rounded-md bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700';

  return (
    <dialog ref={dialog} onCancel={onClose} aria-labelledby="live-title"
      className="w-[min(92vw,30rem)] max-h-[90dvh] overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-5 text-slate-100 backdrop:bg-black/70">
      <div className="flex items-center justify-between gap-3">
        <h2 id="live-title" className="flex items-center gap-2 text-lg font-semibold"><Radio size={19} /> Sala en vivo</h2>
        <button type="button" onClick={onClose} aria-label="Cerrar sala" className={button}><X size={17} /></button>
      </div>
      {publicMode ? <>
        <p className="mt-2 text-sm text-slate-300">Los bailarines pueden entrar con Wi-Fi o datos móviles. Conserva el enlace para reutilizarlo en el siguiente ensayo.</p>
        <form className="mt-4 flex items-end gap-2" onSubmit={(event) => {
          event.preventDefault();
          if (!realtimeManager.isProtectedRoom()) {
            const bytes = crypto.getRandomValues(new Uint8Array(16));
            const id = 'PILOT-' + Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
            onRoomIdChange(id);
          }
          realtimeManager.claimDirector(key.trim());
          setKey('');
        }}>
          <label className="min-w-0 flex-1 text-xs text-slate-300">Clave de director
            <input type="password" value={key} onChange={(event) => setKey(event.target.value)}
              autoComplete="off" required minLength={24} maxLength={256} className={field} />
          </label>
          <button className={button}>Dirigir ensayo</button>
        </form>
        <p className="mt-2 text-xs text-slate-300" role="status">
          {{ idle: 'Introduce la clave del servidor para mostrar el QR.', connecting: 'Conectando con el servidor…',
            authorized: 'Tienes el control del ensayo.', invalid: 'La clave no es válida.', occupied: 'Ya hay un director en esta sala.' }[directorStatus]}
        </p>
      </> : <>
      <p className="mt-2 text-sm text-slate-300">Conecta los teléfonos a la misma red Wi-Fi. Cada bailarín escanea el QR y elige su nombre para seguir sus posiciones y conteos.</p>
      <form className="mt-4 flex items-end gap-2" onSubmit={(event) => {
        event.preventDefault();
        if (room.trim()) onRoomIdChange(room.trim().toUpperCase());
      }}>
        <label className="min-w-0 flex-1 text-xs text-slate-300">Nombre de sala
          <input className={field} value={room} onChange={(event) => setRoom(event.target.value)} required />
        </label>
        <button className={button}>Aplicar</button>
      </form>
      <label className="mt-3 block text-xs text-slate-300">Dirección accesible para los teléfonos
        <input value={host} placeholder={effectiveHost || 'IP o dominio:puerto'} list="live-network-addresses"
          onChange={(event) => { setHost(event.target.value); setFeedback(''); }} className={field} />
        <datalist id="live-network-addresses">
          {addresses.map(({ name, address }) => <option key={address} value={withPort(address)}>{name}</option>)}
        </datalist>
      </label>
      </>}
      <div className="mt-4 grid justify-items-center gap-2 rounded-lg bg-slate-950 p-3 text-center">
        {qr && liveUrl ? <img src={qr} alt="Código QR para entrar como bailarín" className="w-48 rounded-md" />
          : <p className="py-6 text-sm text-slate-300">{liveUrl ? 'Generando QR…' : publicMode ? 'El QR aparecerá al iniciar el ensayo.' : 'Introduce la dirección de red de esta computadora para generar el QR.'}</p>}
        <span className="flex items-center gap-2 text-xs text-slate-300"><Smartphone size={15} /> Escanea con la cámara</span>
      </div>
      {liveUrl && (
        <div className="mt-3 flex flex-wrap gap-2">
          <input readOnly value={liveUrl} aria-label="Enlace para bailarines" className={field} onFocus={(event) => event.target.select()} />
          <button type="button" className={button} onClick={async () => {
            try {
              await navigator.clipboard.writeText(liveUrl);
              setFeedback('Enlace copiado');
            } catch {
              setFeedback('Selecciona el enlace y cópialo manualmente.');
            }
          }}><Copy size={15} /> Copiar</button>
          <a className={button} href={liveUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Abrir invitación</a>
        </div>
      )}
      <p className="mt-2 text-xs text-slate-300" role="status">{feedback}</p>
    </dialog>
  );
}
