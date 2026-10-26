import React, { useState } from 'react';
import { Dancer, Formation, DancerLevel } from '../../types/choreo';
import { 
  UserPlus, 
  Trash2, 
  GripVertical, 
  Columns, 
  ArrowDownToLine, 
  Maximize2, 
  Minus, 
  ChevronDown, 
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { DockZone } from '../../types/choreo';

interface DancersPanelProps {
  dancers: Dancer[];
  activeFormation?: Formation;
  selectedDancerId: string | null;
  currentDock?: DockZone;
  onSelectDancer: (dancerId: string) => void;
  onAddDancer: () => void;
  onUpdateDancer: (dancerId: string, updates: Partial<Dancer>) => void;
  onDeleteDancer: (dancerId: string) => void;
  onUpdateFormation: (formationId: string, updates: Partial<Formation>) => void;
  onStartDragSnap: (e: React.PointerEvent) => void;
  onQuickDock?: (zone: DockZone) => void;
}

export const DancersPanel: React.FC<DancersPanelProps> = ({
  dancers,
  activeFormation,
  selectedDancerId,
  currentDock = 'left',
  onSelectDancer,
  onAddDancer,
  onUpdateDancer,
  onDeleteDancer,
  onUpdateFormation,
  onStartDragSnap,
  onQuickDock,
}) => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="flex flex-col h-full bg-slate-900/95 border border-slate-800 rounded-xl overflow-hidden shadow-lg select-none">
      {/* BARRA SUPERIOR DE ARRASTRE CON LOS 6 PUNTOS (ESTILO AUDITION / WINDOWS SNAP) */}
      <div 
        onPointerDown={onStartDragSnap}
        className="flex items-center justify-between px-3 py-2 bg-slate-950/80 border-b border-slate-800 cursor-grab active:cursor-grabbing hover:bg-slate-800/60 transition group"
        title="Arrastra desde los 6 puntos para acoplar en cualquier zona (Izquierda, Derecha, Abajo, Arriba o Flotante)"
      >
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-cyan-400">
          <div className="p-1 rounded bg-slate-800 group-hover:bg-cyan-500/20 group-hover:text-cyan-300 transition">
            <GripVertical className="w-3.5 h-3.5 text-slate-400 group-hover:text-cyan-400" />
          </div>
          <span>Bailarines ({dancers.length})</span>
        </div>

        <div className="flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
          {onQuickDock && (
            <>
              <button
                type="button"
                onClick={() => onQuickDock(currentDock === 'left' ? 'right' : 'left')}
                className="p-1 rounded text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition"
                title={currentDock === 'left' ? 'Mover a la DERECHA' : 'Mover a la IZQUIERDA'}
              >
                <Columns className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onQuickDock('bottom')}
                className="p-1 rounded text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition"
                title="Mover panel ABAJO"
              >
                <ArrowDownToLine className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onQuickDock('floating')}
                className="p-1 rounded text-slate-400 hover:text-violet-300 hover:bg-slate-800 transition"
                title="Convertir en ventana flotante"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={onAddDancer}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-semibold transition shadow-sm ml-1"
            title="Añadir nuevo bailarín"
          >
            <UserPlus className="w-3 h-3" />
            <span>+ Añadir</span>
          </button>
        </div>
      </div>

      {/* LISTA DE BAILARINES */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2.5 flex flex-col gap-1.5">
        {dancers.map((dancer) => {
          const isSelected = dancer.id === selectedDancerId;
          const dancerPos = activeFormation?.positions[dancer.id];

          return (
            <div
              key={dancer.id}
              onClick={() => onSelectDancer(dancer.id)}
              className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-xs transition cursor-pointer ${
                isSelected
                  ? 'border-violet-500 bg-slate-800 shadow-sm'
                  : 'border-slate-800 bg-slate-950/60 hover:bg-slate-800/50'
              }`}
            >
              <input
                type="color"
                value={dancer.color}
                onChange={(e) => onUpdateDancer(dancer.id, { color: e.target.value })}
                className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0 shrink-0"
                title="Cambiar color del bailarín"
              />

              <input
                type="text"
                value={dancer.name}
                onChange={(e) => onUpdateDancer(dancer.id, { name: e.target.value })}
                className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-white flex-1 min-w-0 outline-none focus:border-cyan-400"
                placeholder="Nombre"
              />

              <select
                value={dancerPos?.level || dancer.defaultLevel}
                onChange={(e) => {
                  const newLevel = e.target.value as DancerLevel;
                  onUpdateDancer(dancer.id, { defaultLevel: newLevel });
                  if (activeFormation && dancerPos) {
                    const updatedPos = { ...activeFormation.positions };
                    updatedPos[dancer.id] = { ...dancerPos, level: newLevel };
                    onUpdateFormation(activeFormation.id, { positions: updatedPos });
                  }
                }}
                className="bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-[11px] text-cyan-300 outline-none cursor-pointer"
                title="Nivel de elevación (Piso / Medio / Arriba)"
              >
                <option value="piso">P</option>
                <option value="medio">M</option>
                <option value="arriba">A</option>
              </select>

              {dancers.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteDancer(dancer.id);
                  }}
                  className="p-1 text-slate-500 hover:text-rose-400 transition"
                  title="Eliminar bailarín"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
