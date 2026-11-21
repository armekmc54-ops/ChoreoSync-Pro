import type { DockZone, FloatingWindowConfig, PanelId } from '../types/choreo';

export const panelTitles: Record<PanelId, string> = {
  dancers: 'Bailarines', formations: 'Formaciones', stage: 'Escenario', timeline: 'Línea de tiempo y audio',
};

export const dockLabels: Record<Exclude<DockZone, 'hidden'>, string> = {
  left: 'Izquierda', center: 'Centro', right: 'Derecha', top: 'Arriba', bottom: 'Abajo', floating: 'Flotante',
};

export const panelIds = Object.keys(panelTitles) as PanelId[];
export const dockZones = Object.keys(dockLabels) as (keyof typeof dockLabels)[];

export const minPanelWidth = 200;
export const minPanelHeight = 112;
export const panelInset = 8;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

export function fitFloatingPanel(
  bounds: FloatingWindowConfig, viewportWidth: number, viewportHeight: number,
): FloatingWindowConfig {
  const maxWidth = Math.max(1, viewportWidth - panelInset * 2);
  const maxHeight = Math.max(1, viewportHeight - panelInset * 2);
  const width = clamp(bounds.width, Math.min(minPanelWidth, maxWidth), maxWidth);
  const height = clamp(bounds.height, Math.min(minPanelHeight, maxHeight), maxHeight);
  return {
    ...bounds,
    x: clamp(bounds.x, panelInset, viewportWidth - width - panelInset),
    y: clamp(bounds.y, panelInset, viewportHeight - height - panelInset),
    width,
    height,
  };
}

export function defaultFloatingPanel(id: PanelId): FloatingWindowConfig {
  const index = panelIds.indexOf(id);
  const wide = id === 'stage' || id === 'timeline';
  return { x: 28 + index * 42, y: 122 + index * 32, width: wide ? 680 : 340, height: id === 'timeline' ? 320 : 360 };
}
