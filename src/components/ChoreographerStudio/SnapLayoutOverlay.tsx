import React, { useEffect } from 'react';
import { DockZone, PanelId } from '../../types/choreo';
import { Columns, LayoutGrid, Rows, Maximize2, Move, Sparkles } from 'lucide-react';

interface SnapLayoutOverlayProps {
  isDragging: boolean;
  activePanelId: PanelId | null;
  hoveredZone: DockZone | null;
  onHoverZone: (zone: DockZone | null) => void;
  onDropZone: (zone: DockZone) => void;
}

export const SnapLayoutOverlay: React.FC<SnapLayoutOverlayProps> = ({
  isDragging,
  activePanelId,
  hoveredZone,
  onHoverZone,
  onDropZone,
}) => {
  // Detección automática en bordes de pantalla estilo Windows 11 Snap
  useEffect(() => {
    if (!isDragging) return;

    const handleWindowPointerMove = (e: PointerEvent) => {
      const topBarEl = document.getElementById('snap-layout-top-bar');
      if (topBarEl && topBarEl.contains(e.target as Node)) {
        return;
      }

      const w = window.innerWidth;
      const h = window.innerHeight;
      const x = e.clientX;
      const y = e.clientY;

      if (x < 110) {
        onHoverZone('left');
      } else if (x > w - 110) {
        onHoverZone('right');
      } else if (y > h - 110) {
        onHoverZone('bottom');
      } else if (y < 70) {
        onHoverZone('top');
      } else {
        onHoverZone('floating');
      }
    };

    const handleWindowPointerUp = () => {
      if (hoveredZone) {
        onDropZone(hoveredZone);
      } else {
        onDropZone('floating');
      }
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);
    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
    };
  }, [isDragging, hoveredZone, onHoverZone, onDropZone]);

  if (!isDragging) return null;

  const panelName = activePanelId === 'dancers' 
    ? 'Bailarines' 
    : activePanelId === 'formations' 
    ? 'Formaciones' 
    : activePanelId === 'timeline' 
    ? 'Línea de Tiempo' 
    : 'Sección';

  return (
    <>
      {/* BARRA SUPERIOR DE SNAP LAYOUTS ESTILO WINDOWS 11 (COMO EN LAS CAPTURAS) */}
      <div 
        id="snap-layout-top-bar"
        className="fixed top-9 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 p-2 rounded-2xl bg-slate-900/95 backdrop-blur-xl border-2 border-violet-500/70 shadow-2xl animate-fade-in select-none"
      >
        <div className="flex items-center gap-1.5 pl-2 pr-3 border-r border-slate-800 text-[11px] font-bold text-slate-300 uppercase tracking-wider">
          <Move className="w-4 h-4 text-cyan-400 animate-pulse" />
          <span>Alinear {panelName}</span>
        </div>

        {/* Plantilla 1: Lateral Izquierdo */}
        <button
          type="button"
          onPointerEnter={() => onHoverZone('left')}
          onPointerLeave={() => onHoverZone(null)}
          onPointerUp={() => onDropZone('left')}
          className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all cursor-pointer ${
            hoveredZone === 'left'
              ? 'bg-violet-600/40 border-cyan-400 scale-105 shadow-lg shadow-cyan-500/30'
              : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
          }`}
          title="Acoplar al panel lateral izquierdo"
        >
          <div className="w-12 h-8 rounded border border-slate-700 flex overflow-hidden">
            <div className="w-5 h-full bg-cyan-400/80"></div>
            <div className="flex-1 h-full bg-slate-800"></div>
          </div>
          <span className="text-[10px] font-semibold text-slate-300">Izquierda</span>
        </button>

        {/* Plantilla 2: Lateral Derecho */}
        <button
          type="button"
          onPointerEnter={() => onHoverZone('right')}
          onPointerLeave={() => onHoverZone(null)}
          onPointerUp={() => onDropZone('right')}
          className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all cursor-pointer ${
            hoveredZone === 'right'
              ? 'bg-violet-600/40 border-cyan-400 scale-105 shadow-lg shadow-cyan-500/30'
              : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
          }`}
          title="Acoplar al panel lateral derecho"
        >
          <div className="w-12 h-8 rounded border border-slate-700 flex overflow-hidden">
            <div className="flex-1 h-full bg-slate-800"></div>
            <div className="w-5 h-full bg-cyan-400/80"></div>
          </div>
          <span className="text-[10px] font-semibold text-slate-300">Derecha</span>
        </button>

        {/* Plantilla 3: Inferior */}
        <button
          type="button"
          onPointerEnter={() => onHoverZone('bottom')}
          onPointerLeave={() => onHoverZone(null)}
          onPointerUp={() => onDropZone('bottom')}
          className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all cursor-pointer ${
            hoveredZone === 'bottom'
              ? 'bg-violet-600/40 border-cyan-400 scale-105 shadow-lg shadow-cyan-500/30'
              : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
          }`}
          title="Acoplar en la parte inferior de la pantalla"
        >
          <div className="w-12 h-8 rounded border border-slate-700 flex flex-col overflow-hidden">
            <div className="flex-1 w-full bg-slate-800"></div>
            <div className="h-3 w-full bg-cyan-400/80"></div>
          </div>
          <span className="text-[10px] font-semibold text-slate-300">Inferior</span>
        </button>

        {/* Plantilla 4: Superior */}
        <button
          type="button"
          onPointerEnter={() => onHoverZone('top')}
          onPointerLeave={() => onHoverZone(null)}
          onPointerUp={() => onDropZone('top')}
          className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all cursor-pointer ${
            hoveredZone === 'top'
              ? 'bg-violet-600/40 border-cyan-400 scale-105 shadow-lg shadow-cyan-500/30'
              : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
          }`}
          title="Acoplar en la barra superior"
        >
          <div className="w-12 h-8 rounded border border-slate-700 flex flex-col overflow-hidden">
            <div className="h-3 w-full bg-cyan-400/80"></div>
            <div className="flex-1 w-full bg-slate-800"></div>
          </div>
          <span className="text-[10px] font-semibold text-slate-300">Superior</span>
        </button>

        {/* Plantilla 5: Ventana Flotante Libre */}
        <button
          type="button"
          onPointerEnter={() => onHoverZone('floating')}
          onPointerLeave={() => onHoverZone(null)}
          onPointerUp={() => onDropZone('floating')}
          className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all cursor-pointer ${
            hoveredZone === 'floating'
              ? 'bg-violet-600/40 border-cyan-400 scale-105 shadow-lg shadow-cyan-500/30'
              : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
          }`}
          title="Soltar como ventana flotante independiente"
        >
          <div className="w-12 h-8 rounded border border-slate-700 relative bg-slate-800 flex items-center justify-center">
            <div className="w-7 h-5 rounded bg-cyan-400/80 border border-white/60 shadow"></div>
          </div>
          <span className="text-[10px] font-semibold text-slate-300">Flotante</span>
        </button>
      </div>

      {/* FANTASMA VISUAL (PREVIEW GHOST EN LA PANTALLA) */}
      {hoveredZone === 'left' && (
        <div className="fixed top-16 left-0 bottom-0 w-80 bg-cyan-500/15 border-4 border-dashed border-cyan-400 z-40 pointer-events-none animate-pulse rounded-r-2xl" />
      )}
      {hoveredZone === 'right' && (
        <div className="fixed top-16 right-0 bottom-0 w-80 bg-cyan-500/15 border-4 border-dashed border-cyan-400 z-40 pointer-events-none animate-pulse rounded-l-2xl" />
      )}
      {hoveredZone === 'bottom' && (
        <div className="fixed bottom-0 left-0 right-0 h-64 bg-cyan-500/15 border-4 border-dashed border-cyan-400 z-40 pointer-events-none animate-pulse rounded-t-2xl" />
      )}
      {hoveredZone === 'top' && (
        <div className="fixed top-16 left-0 right-0 h-52 bg-cyan-500/15 border-4 border-dashed border-cyan-400 z-40 pointer-events-none animate-pulse rounded-b-2xl" />
      )}
      {hoveredZone === 'floating' && (
        <div className="fixed top-1/3 left-1/3 w-96 h-80 bg-violet-500/15 border-4 border-dashed border-violet-400 z-40 pointer-events-none animate-pulse rounded-2xl shadow-2xl" />
      )}
    </>
  );
};
