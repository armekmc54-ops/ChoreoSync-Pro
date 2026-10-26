import React, { useRef, useState, useEffect } from 'react';
import { X, Minus, Square, GripVertical, Columns, ArrowDownToLine } from 'lucide-react';
import { PanelId, DockZone } from '../../types/choreo';

interface FloatingPanelProps {
  title: string;
  panelId: PanelId;
  defaultPosition?: { x: number; y: number; width: number; height: number };
  children: React.ReactNode;
  onDock: (zone: DockZone) => void;
  onClose: () => void;
  onStartDragSnap: (panelId: PanelId) => void;
}

export const FloatingPanel: React.FC<FloatingPanelProps> = ({
  title,
  panelId,
  defaultPosition = { x: 120, y: 120, width: 340, height: 460 },
  children,
  onDock,
  onClose,
  onStartDragSnap,
}) => {
  const [pos, setPos] = useState({ x: defaultPosition.x, y: defaultPosition.y });
  const [size, setSize] = useState({ width: defaultPosition.width, height: defaultPosition.height });
  const [isMinimized, setIsMinimized] = useState(false);

  const dragRef = useRef<{
    startX: number;
    startY: number;
    initX: number;
    initY: number;
  } | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: pos.x,
      initY: pos.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    onStartDragSnap(panelId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPos({
      x: Math.max(10, Math.min(window.innerWidth - size.width - 10, dragRef.current.initX + dx)),
      y: Math.max(35, Math.min(window.innerHeight - 80, dragRef.current.initY + dy)),
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragRef.current) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      dragRef.current = null;
    }
  };

  return (
    <div
      style={{
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        width: `${size.width}px`,
        height: isMinimized ? 'auto' : `${size.height}px`,
      }}
      className="fixed z-40 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-fade-in select-none"
    >
      {/* Barra de Título de la Ventana Flotante */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="flex items-center justify-between px-3 py-2 bg-slate-950/80 border-b border-slate-800 cursor-move select-none"
      >
        <div className="flex items-center gap-1.5 text-xs font-bold text-white">
          <GripVertical className="w-4 h-4 text-cyan-400" />
          <span>{title}</span>
          <span className="text-[10px] text-cyan-400 font-mono px-1.5 py-0.2 rounded bg-cyan-950/80 border border-cyan-500/30">
            Flotante
          </span>
        </div>

        <div className="flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
          {/* Botones de acoplar rápido */}
          <button
            onClick={() => onDock('left')}
            className="p-1 rounded text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition"
            title="Acoplar a la Izquierda"
          >
            <Columns className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDock('bottom')}
            className="p-1 rounded text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition"
            title="Acoplar Abajo"
          >
            <ArrowDownToLine className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title={isMinimized ? 'Restaurar' : 'Minimizar'}
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
            title="Cerrar ventana"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Contenido de la ventana */}
      {!isMinimized && (
        <div className="flex-1 min-h-0 overflow-y-auto p-2.5">
          {children}
        </div>
      )}
    </div>
  );
};
