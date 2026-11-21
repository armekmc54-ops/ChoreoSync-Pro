import React, { useState } from 'react';
import { Dancer, Formation, DancerLevel } from '../../types/choreo';
import { 
  UserPlus, 
  Trash2, 
  Maximize2, 
  Minus, 
  ChevronDown, 
  ChevronRight,
} from 'lucide-react';

interface DancersPanelProps {
  dancers: Dancer[];
  activeFormation?: Formation;
  selectedDancerId: string | null;
  onSelectDancer: (dancerId: string) => void;
  onAddDancer: () => void;
  onUpdateDancer: (dancerId: string, updates: Partial<Dancer>) => void;
  onDeleteDancer: (dancerId: string) => void;
  onUpdateFormation: (formationId: string, updates: Partial<Formation>) => void;
}

export const DancersPanel: React.FC<DancersPanelProps> = ({
  dancers,
  activeFormation,
  selectedDancerId,
  onSelectDancer,
  onAddDancer,
  onUpdateDancer,
  onDeleteDancer,
  onUpdateFormation,
}) => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="flex flex-col h-full bg-slate-900/95 overflow-hidden select-none">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-800 px-2 py-1 text-xs text-slate-300">
        <span>{dancers.length} bailarines</span>
          <button
            type="button"
            onClick={onAddDancer}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-semibold transition shadow-sm ml-1"
            title="Añadir nuevo bailarín"
          >
            <UserPlus className="w-3 h-3" />
            <span>Añadir</span>
          </button>
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
