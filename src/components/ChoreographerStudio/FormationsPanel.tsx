import React from 'react';
import { Formation } from '../../types/choreo';
import { 
  PlusCircle, 
  Trash2, 
  Copy, 
} from 'lucide-react';

interface FormationsPanelProps {
  formations: Formation[];
  selectedFormationId: string;
  selectedFormationIds?: string[];
  onSelectFormation: (formationId: string, isMulti?: boolean) => void;
  onAddFormation: () => void;
  onUpdateFormation: (formationId: string, updates: Partial<Formation>) => void;
  onDeleteFormation: (formationId: string) => void;
  onDeleteFormations?: (formationIds: string[]) => void;
  onDuplicateFormation?: (formationId: string) => void;
}

export const FormationsPanel: React.FC<FormationsPanelProps> = ({
  formations,
  selectedFormationId,
  selectedFormationIds = [],
  onSelectFormation,
  onAddFormation,
  onUpdateFormation,
  onDeleteFormation,
  onDeleteFormations,
  onDuplicateFormation,
}) => {
  return (
    <div className="flex flex-col h-full bg-slate-900/95 overflow-hidden select-none">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-800 px-2 py-1 text-xs text-slate-300">
        <span>{formations.length} formaciones</span>
          <button
            type="button"
            onClick={onAddFormation}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-semibold transition shadow-sm ml-1"
            title="Añadir nueva formación en el tiempo actual"
          >
            <PlusCircle className="w-3 h-3" />
            <span>Aquí</span>
          </button>
      </div>


      {/* CABECERA DE COLUMNAS */}
      <div className="text-[10px] text-slate-500 px-3 py-1 border-b border-slate-800/60 flex justify-between bg-slate-950/40">
        <span>Nombre</span>
        <span>Pausa · Traslado (ms)</span>
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
                className="w-11 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-[11px] text-center text-violet-300 outline-none"
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
                className="w-11 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-[11px] text-center text-cyan-300 outline-none"
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
