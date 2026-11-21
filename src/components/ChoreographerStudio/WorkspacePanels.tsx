import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { GripVertical, PanelTop, Scaling, X } from 'lucide-react';
import type { DockZone, FloatingWindowConfig, PanelConfig, PanelId, WorkspaceLayout } from '../../types/choreo';
import { clamp, defaultFloatingPanel, dockLabels, dockZones, fitFloatingPanel,
  minPanelHeight, minPanelWidth, panelIds, panelTitles } from '../../utils/workspaceLayout';

interface Props {
  layout: WorkspaceLayout;
  contents: Record<PanelId, ReactNode>;
  onChange: (id: PanelId, patch: Partial<PanelConfig>) => void;
}

type Zone = Exclude<DockZone, 'hidden'>;
type Draft = { id: PanelId; width?: number; height?: number; floating?: FloatingWindowConfig };

export function WorkspacePanels({ layout, contents, onChange }: Props) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dragged, setDragged] = useState<PanelId | null>(null);
  const [target, setTarget] = useState<Zone | null>(null);
  const [front, setFront] = useState<PanelId | null>(null);
  const [, refreshViewport] = useState(0);
  const gesture = useRef<(() => void) | null>(null);
  const targets = useRef<Partial<Record<Zone, HTMLSpanElement | null>>>({});

  useEffect(() => {
    const refresh = () => refreshViewport((value) => value + 1);
    window.addEventListener('resize', refresh);
    return () => {
      window.removeEventListener('resize', refresh);
      gesture.current?.();
    };
  }, []);

  const fit = (bounds: FloatingWindowConfig) => fitFloatingPanel(bounds, window.innerWidth, window.innerHeight);

  const getDropTarget = (event: PointerEvent) => dockZones.find((zone) => {
    const rect = targets.current[zone]?.getBoundingClientRect();
    return rect && event.clientX >= rect.left && event.clientX <= rect.right &&
      event.clientY >= rect.top && event.clientY <= rect.bottom;
  });

  const dock = (id: PanelId, zone: DockZone) => {
    if (zone === 'floating') setFront(id);
    onChange(id, { dock: zone });
  };

  const startGesture = (event: ReactPointerEvent<HTMLButtonElement>, id: PanelId, mode: 'move' | 'size') => {
    if (gesture.current || event.button !== 0 || !event.isPrimary) return;
    const handle = event.currentTarget;
    const panel = handle.closest<HTMLElement>('[data-workspace-panel]');
    if (!panel) return;
    event.preventDefault();
    const config = layout.panels[id];
    const bounds = panel.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const pointerId = event.pointerId;
    const floating = config.dock === 'floating';
    const original = fit(config.floating ?? defaultFloatingPanel(id));
    let moved = false;
    if (floating) setFront(id);

    const nextBounds = (point: PointerEvent, resize: boolean) => {
      const dx = point.clientX - startX;
      const dy = point.clientY - startY;
      if (resize) {
        return fit({
          ...original,
          width: clamp(bounds.width + dx, minPanelWidth, window.innerWidth - original.x - 8),
          height: clamp(bounds.height + dy, minPanelHeight, window.innerHeight - original.y - 8),
        });
      }
      return fit({ ...original, x: original.x + dx, y: original.y + dy });
    };

    const dockedSize = (point: PointerEvent) => ({
      width: clamp(bounds.width + point.clientX - startX, minPanelWidth, window.innerWidth - 20),
      height: clamp(bounds.height + point.clientY - startY, minPanelHeight, window.innerHeight - 70),
    });

    const move = (point: PointerEvent) => {
      if (point.pointerId !== pointerId) return;
      if (!moved && Math.hypot(point.clientX - startX, point.clientY - startY) < 5) return;
      moved = true;
      if (mode === 'move') {
        setDragged(id);
        setTarget(getDropTarget(point) ?? null);
        if (floating) setDraft({ id, floating: nextBounds(point, false) });
      } else {
        setDraft(floating ? { id, floating: nextBounds(point, true) } : { id, ...dockedSize(point) });
      }
    };

    const cleanup = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', finish);
      handle.removeEventListener('pointercancel', cancel);
      handle.removeEventListener('lostpointercapture', cancel);
      window.removeEventListener('blur', cleanup);
      window.removeEventListener('keydown', keydown);
      if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
      gesture.current = null;
      setDraft(null);
      setDragged(null);
      setTarget(null);
    };

    const finish = (point: PointerEvent) => {
      if (point.pointerId !== pointerId) return;
      const zone = getDropTarget(point);
      cleanup();
      if (!moved) return;
      if (mode === 'size') {
        if (floating) onChange(id, { floating: nextBounds(point, true) });
        else {
          const size = dockedSize(point);
          onChange(id, { customWidth: size.width, customHeight: size.height });
        }
        return;
      }
      if (zone && zone !== 'floating') {
        onChange(id, { dock: zone, ...(floating ? { floating: nextBounds(point, false) } : {}) });
        return;
      }
      if (floating || zone === 'floating') {
        const placement = floating ? nextBounds(point, false) : fit({
          ...original, x: point.clientX - Math.min(70, original.width / 2), y: point.clientY - 18,
        });
        setFront(id);
        onChange(id, { dock: 'floating', floating: placement });
      }
    };

    const cancel = (point: PointerEvent) => { if (point.pointerId === pointerId) cleanup(); };
    const keydown = (key: KeyboardEvent) => { if (key.key === 'Escape') cleanup(); };

    gesture.current = cleanup;
    handle.setPointerCapture(pointerId);
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', finish);
    handle.addEventListener('pointercancel', cancel);
    handle.addEventListener('lostpointercapture', cancel);
    window.addEventListener('blur', cleanup);
    window.addEventListener('keydown', keydown);
  };

  const renderPanel = (id: PanelId) => {
    const config = layout.panels[id];
    const isFloating = config.dock === 'floating';
    const preview = draft?.id === id ? draft : null;
    const rect = isFloating ? fit(preview?.floating ?? config.floating ?? defaultFloatingPanel(id)) : null;
    const style: CSSProperties = rect
      ? { left: rect.x, top: rect.y, width: rect.width, height: rect.height, zIndex: front === id ? 46 : 42 + panelIds.indexOf(id) }
      : { width: preview?.width ?? config.customWidth, height: preview?.height ?? config.customHeight };

    return (
      <section key={id} data-workspace-panel={id} data-dragged={dragged === id} className="workspace-panel"
        aria-label={panelTitles[id]} style={style}
        onPointerDown={isFloating && front !== id ? () => setFront(id) : undefined}>
        <header className="workspace-panel-bar">
          <button type="button" className="workspace-grip" aria-label={'Arrastrar ' + panelTitles[id]}
            title="Arrastra hacia un destino" onPointerDown={(event) => startGesture(event, id, 'move')}>
            <GripVertical size={15} />
          </button>
          <h2>{panelTitles[id]}</h2>
          <label className="workspace-dock-select">
            <PanelTop size={14} aria-hidden="true" />
            <select aria-label={'Ubicación de ' + panelTitles[id]} value={config.dock}
              onChange={(event) => dock(id, event.currentTarget.value as Zone)}>
              {dockZones.map((zone) => <option key={zone} value={zone}>{dockLabels[zone]}</option>)}
            </select>
          </label>
          {isFloating && <button type="button" title="Ocultar ventana" aria-label={'Ocultar ' + panelTitles[id]}
            onClick={() => onChange(id, { dock: 'hidden', previousDock: 'floating' })}><X size={15} /></button>}
        </header>
        <div className="workspace-panel-content">{contents[id]}</div>
        <button type="button" className="workspace-resize" title="Arrastra para cambiar ancho y alto; usa las flechas con el teclado"
          aria-label={'Redimensionar ' + panelTitles[id]}
          onPointerDown={(event) => startGesture(event, id, 'size')}
          onKeyDown={(event) => {
            const dx = event.key === 'ArrowLeft' ? -20 : event.key === 'ArrowRight' ? 20 : 0;
            const dy = event.key === 'ArrowUp' ? -20 : event.key === 'ArrowDown' ? 20 : 0;
            if (!dx && !dy) return;
            event.preventDefault();
            event.stopPropagation();
            if (rect) onChange(id, { floating: fit({ ...rect, width: rect.width + dx, height: rect.height + dy }) });
            else {
              const size = event.currentTarget.closest('[data-workspace-panel]')?.getBoundingClientRect();
              if (size) onChange(id, {
                ...(dx ? { customWidth: clamp(size.width + dx, minPanelWidth, window.innerWidth - 20) } : {}),
                ...(dy ? { customHeight: clamp(size.height + dy, minPanelHeight, window.innerHeight - 70) } : {}),
              });
            }
          }}><Scaling size={13} /></button>
      </section>
    );
  };

  const renderZone = (zone: Zone) => {
    const panels = panelIds.filter((id) => layout.panels[id].dock === zone)
      .sort((a, b) => (layout.panels[a].order ?? 0) - (layout.panels[b].order ?? 0));
    return panels.length ? <div className={'workspace-zone workspace-' + zone}>{panels.map(renderPanel)}</div> : null;
  };

  return (
    <>
      <main className="workspace-docks">
        {renderZone('top')}
        <div className="workspace-middle">
          {renderZone('left')}{renderZone('center')}{renderZone('right')}
        </div>
        {renderZone('bottom')}
      </main>
      {renderZone('floating')}
      {dragged && <div className="workspace-drop-targets" aria-hidden="true">
        {dockZones.map((zone) => <span key={zone} ref={(node) => { targets.current[zone] = node; }}
          data-target={target === zone}>{dockLabels[zone]}</span>)}
      </div>}
    </>
  );
}
