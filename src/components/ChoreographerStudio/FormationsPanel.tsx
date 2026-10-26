import React from 'react';
import { Formation, DockZone } from '../../types/choreo';
import { 
  PlusCircle, 
  Trash2, 
  Copy, 
  GripVertical, 
  Columns, 
  ArrowDownToLine, 
  ExternalLink 
} from 'lucide-react';

interface FormationsPanelProps {
  formations: Formation[];
  selectedFormationId: string;
  selectedFormationIds?: string[];
  currentDock?: DockZone;
  onSelectFormation: (formationId: string, isMulti?: boolean) => void;
  onAddFormation: () => void;
  onUpdateFormation: (formationId: string, updates: Partial<Formation>) => void;
  onDeleteFormation: (formationId: string) => void;
  onDeleteFormations?: (formationIds: string[]) => void;
  onDuplicateFormation?: (formationId: string) => void;
  onStartDragSnap: (e: React.PointerEvent) => void;
  onQuickDock?: (zone: DockZone) => void;
}

export const FormationsPanel: React.FC<FormationsPanelProps> = ({
  formations,
  selectedFormationId,
  selectedFormationIds = [],
  currentDock = 'left',
  onSelectFormation,
  onAddFormation,
  onUpdateFormation,
  onDeleteFormation,
  onDeleteFormations,
  onDuplicateFormation,
  onStartDragSnap,
  onQuickDock,
}) => {
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
          <span>Formaciones ({formations.length})</span>
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
            onClick={onAddFormation}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-semibold transition shadow-sm ml-1"
            title="Añadir nueva formación en el tiempo actual"
          >
            <PlusCircle className="w-3 h-3" />
            <span>+ Aquí</span>
          </button>
        </div>
      </div>

      {/* CABECERA DE COLUMNAS */}
      <div className="text-[10px] text-slate-500 px-3 py-1 border-b border-slate-800/60 flex justify-between bg-slate-950/40">
        <span>Nombre</span>
        <span>Hold ms · Trans ms</span>
      </div>

      {/* LISTA DE FORMACIONES */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2.5 flex flex-col gap-1.5">
        {formations.map((form) => {
          const isSelected = form.id === selectedFormationId || selectedFormationIds.includes(form.id);

          return (
            <div
              key={form.id}
              onClick={(e) => onSelectFormation(form.id, e.shiftKey || e.ctrlKey || e.metaKey)}
              className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-xs transition cursor-pointer ${
                isSelected
                  ? 'border-cyan-500 bg-slate-800 shadow-sm'
                  : 'border-slate-800 bg-slate-950/60 hover:bg-slate-800/50'
              }`}
            >
              <input
                type="text"
                value={form.name}
                onChange={(e) => onUpdateFormation(form.id, { name: e.target.value })}
                className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-white flex-1 min-w-0 outline-none focus:border-cyan-400"
              />

              <input
                type="number"
                step="100"
                min="0"
                value={form.holdDurationMs}
                onChange={(e) =>
                  onUpdateFormation(form.id, {
                    holdDurationMs: Math.max(0, Number(e.target.value) || 0),
                  })
                }
                className="w-14 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-[11px] text-center text-violet-300 outline-none"
                title="Duración Hold (estático) en ms"
              />

              <input
                type="number"
                step="100"
                min="0"
                value={form.transitionDurationMs}
                onChange={(e) =>
                  onUpdateFormation(form.id, {
                    transitionDurationMs: Math.max(0, Number(e.target.value) || 0),
                  })
                }
                className="w-14 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-[11px] text-center text-cyan-300 outline-none"
                title="Duración Transición (desplazamiento) en ms"
              />

              {onDuplicateFormation && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicateFormation(form.id);
                  }}
                  className="p-1 text-slate-500 hover:text-cyan-400 transition"
                  title="Duplicar formación"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              )}

              {formations.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteFormation(form.id);
                  }}
                  className="p-1 text-slate-500 hover:text-rose-400 transition"
                  title="Eliminar formación"
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
