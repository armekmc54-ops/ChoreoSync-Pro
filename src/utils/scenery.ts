import type { StageRect } from './interpolation';

export const scenicKinds = ['wall', 'tower', 'platform', 'water', 'tree', 'door', 'curtain', 'camera', 'light', 'prop'] as const;
export type ScenicKind = typeof scenicKinds[number];

export const scenicLabels: Record<ScenicKind, string> = {
  wall: 'Muro', tower: 'Torre', platform: 'Plataforma', water: 'Agua',
  tree: 'Árbol', door: 'Puerta', curtain: 'Telón', camera: 'Cámara', light: 'Luz', prop: 'Utilería',
};

export interface ScenicObject {
  id: string;
  name: string;
  kind: ScenicKind;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
  startMs: number;
  endMs: number;
}

const object = (kind: ScenicKind, name: string, x: number, y: number, width: number, height: number, color: string) =>
  ({ kind, name, x, y, width, height, color });

export const sceneryPresets = [
  { name: 'Torre y bosque', objects: [
    object('tower', 'Torre del mirador', 0.49, 0.22, 0.22, 0.30, '#ba92ed'),
    object('tree', 'Bosque izquierdo', 0.16, 0.30, 0.22, 0.42, '#72cda0'),
    object('tree', 'Bosque derecho', 0.83, 0.29, 0.23, 0.42, '#96c57f'),
    object('platform', 'Sendero', 0.48, 0.67, 0.16, 0.48, '#e1b77e'),
  ] },
  { name: 'Lago de luna', objects: [
    object('water', 'Lago', 0.50, 0.36, 0.78, 0.54, '#52b6e1'),
    object('platform', 'Orilla', 0.50, 0.72, 0.78, 0.13, '#a9bc96'),
    object('light', 'Luz de luna', 0.72, 0.25, 0.31, 0.43, '#cbc5ff'),
  ] },
  { name: 'Salón de palacio', objects: [
    object('curtain', 'Telón de fondo', 0.50, 0.13, 0.88, 0.15, '#dc8dba'),
    object('door', 'Entrada central', 0.50, 0.26, 0.17, 0.23, '#edcb91'),
    object('platform', 'Estrado', 0.50, 0.40, 0.56, 0.18, '#bca6da'),
  ] },
  { name: 'Rodaje interior', objects: [
    object('wall', 'Pared del set', 0.50, 0.15, 0.82, 0.09, '#aaabb9'),
    object('door', 'Entrada', 0.75, 0.29, 0.20, 0.15, '#e4ab77'),
    object('prop', 'Mesa de escena', 0.41, 0.52, 0.22, 0.17, '#99c9b4'),
    object('camera', 'Cámara principal', 0.51, 0.82, 0.18, 0.24, '#f0bf68'),
    object('light', 'Luz lateral', 0.14, 0.54, 0.24, 0.40, '#eacb91'),
  ] },
];

export function createScenicObject(
  template: Omit<ScenicObject, 'id' | 'startMs' | 'endMs'>, startMs: number, endMs: number,
): ScenicObject {
  return { ...template, id: crypto.randomUUID?.() || Math.random().toString(36).slice(2), startMs, endMs };
}

export function normalizeScenery(raw: unknown): ScenicObject[] {
  if (!Array.isArray(raw)) return [];
  const isFraction = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
  return raw.filter((item): item is ScenicObject => item && typeof item.id === 'string' &&
    typeof item.name === 'string' && scenicKinds.includes(item.kind) && /^#[a-f0-9]{6}$/i.test(item.color) &&
    [item.x, item.y, item.width, item.height].every(isFraction) && item.width > 0 && item.height > 0 &&
    Number.isFinite(item.startMs) && Number.isFinite(item.endMs) && item.startMs >= 0 && item.endMs > item.startMs);
}

export function drawScenery(ctx: CanvasRenderingContext2D, rect: StageRect, objects: ScenicObject[], timeMs: number, mirror: boolean) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  for (const item of objects) {
    if (timeMs < item.startMs || timeMs >= item.endMs) continue;
    const x = rect.x + (mirror ? 1 - item.x : item.x) * rect.w;
    const y = rect.y + (mirror ? 1 - item.y : item.y) * rect.h;
    const w = item.width * rect.w;
    const h = item.height * rect.h;
    const direction = mirror ? -1 : 1;
    ctx.strokeStyle = item.color + 'bd';
    ctx.fillStyle = item.color + '46';
    ctx.lineWidth = 1.35;
    ctx.beginPath();
    switch (item.kind) {
      case 'tree':
      case 'water':
      case 'light':
        ctx.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2);
        break;
      case 'camera':
        ctx.moveTo(x, y + h / 2 * direction);
        ctx.lineTo(x - w / 2, y - h / 2 * direction);
        ctx.lineTo(x + w / 2, y - h / 2 * direction);
        ctx.closePath();
        break;
      case 'tower':
        ctx.moveTo(x - w / 2, y + direction * h / 2);
        ctx.lineTo(x - w / 2, y - direction * h / 6);
        ctx.lineTo(x, y - direction * h / 2);
        ctx.lineTo(x + w / 2, y - direction * h / 6);
        ctx.lineTo(x + w / 2, y + direction * h / 2);
        ctx.closePath();
        break;
      case 'door':
        ctx.roundRect(x - w / 2, y - h / 2, w, h, Math.min(w / 2, h / 3));
        break;
      default:
        ctx.rect(x - w / 2, y - h / 2, w, h);
    }
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f7f3ff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 10px system-ui';
    if (w >= 32) ctx.fillText(item.name, x, y, w - 6);
  }
  ctx.restore();
}
