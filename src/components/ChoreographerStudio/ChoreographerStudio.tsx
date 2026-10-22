import React, { useState } from 'react';
import { Dancer, Formation, DancerLevel, CollisionEvent } from '../../types/choreo';
import { 
  UserPlus, 
  PlusCircle, 
  Trash2, 
  Compass, 
  GitCommit, 
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ArrowUpDown,
  PanelLeftClose,
  PanelRightClose,
  Columns,
  GripVertical
} from 'lucide-react';

interface ChoreographerStudioProps {
  dancers: Dancer[];
  formations: Formation[];
  selectedFormationId: string;
  selectedDancerId: string | null;
  isMirror: boolean;
  showAllPaths: boolean;
  activeCollisions: CollisionEvent[];
  sidebarDock: 'left' | 'right';
  sidebarWidth: number;
  isSidebarCollapsed: boolean;
  onToggleSidebarCollapse: () => void;
  onToggleSidebarDock: () => void;
  onSelectDancer: (dancerId: string) => void;
  onSelectFormation: (formationId: string) => void;
  onAddDancer: () => void;
  onUpdateDancer: (dancerId: string, updates: Partial<Dancer>) => void;
  onDeleteDancer: (dancerId: string) => void;
  onAddFormation: () => void;
  onUpdateFormation: (formationId: string, updates: Partial<Formation>) => void;
  onDeleteFormation: (formationId: string) => void;
  onToggleMirror: () => void;
  onToggleShowPaths: () => void;
}

export const ChoreographerStudio: React.FC<ChoreographerStudioProps> = ({
  dancers,
  formations,
  selectedFormationId,
  selectedDancerId,
  isMirror,
  showAllPaths,
  activeCollisions,
  sidebarDock,
  sidebarWidth,
  isSidebarCollapsed,
  onToggleSidebarCollapse,
  onToggleSidebarDock,
  onSelectDancer,
  onSelectFormation,
  onAddDancer,
  onUpdateDancer,
  onDeleteDancer,
  onAddFormation,
  onUpdateFormation,
  onDeleteFormation,
  onToggleMirror,
  onToggleShowPaths,
}) => {
  const activeFormation = formations.find((f) => f.id === selectedFormationId);

  // Estados de reordenamiento y colapsado de secciones (Estilo Adobe Audition)
  const [sectionOrder, setSectionOrder] = useState<('dancers' | 'formations')[]>(['dancers', 'formations']);
  const [dancersOpen, setDancersOpen] = useState(true);
  const [formationsOpen, setFormationsOpen] = useState(true);

  const swapSectionOrder = () => {
    setSectionOrder((prev) => [prev[1], prev[0]]);
  };

  const renderDancersSection = () => (
    <div className="bg-slate-950/40 rounded-xl border border-slate-800/80 p-2.5">
      <div className="flex items-center justify-between mb-2">
        <div 
          onClick={() => setDancersOpen(!dancersOpen)}
          className="flex items-center gap-1.5 cursor-pointer text-xs font-bold uppercase tracking-wider text-cyan-400 hover:text-cyan-300 transition"
        >
          {dancersOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          <span>Bailarines ({dancers.length})</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={swapSectionOrder}
            className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition"
            title="Cambiar orden de sección (arriba/abajo)"
          >
            <ArrowUpDown className="w-3 h-3" />
          </button>
          <button
            onClick={onAddDancer}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-semibold transition shadow-sm"
            title="Añadir nuevo bailarín"
          >
            <UserPlus className="w-3 h-3" />
            <span>+ Añadir</span>
          </button>
        </div>
      </div>

      {dancersOpen && (
        <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1">
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
      )}
    </div>
  );

  const renderFormationsSection = () => (
    <div className="bg-slate-950/40 rounded-xl border border-slate-800/80 p-2.5">
      <div className="flex items-center justify-between mb-1.5">
        <div 
          onClick={() => setFormationsOpen(!formationsOpen)}
          className="flex items-center gap-1.5 cursor-pointer text-xs font-bold uppercase tracking-wider text-cyan-400 hover:text-cyan-300 transition"
        >
          {formationsOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          <span>Formaciones ({formations.length})</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={swapSectionOrder}
            className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition"
            title="Cambiar orden de sección (arriba/abajo)"
          >
            <ArrowUpDown className="w-3 h-3" />
          </button>
          <button
            onClick={onAddFormation}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-semibold transition shadow-sm"
            title="Añadir nueva formación en el tiempo actual"
          >
            <PlusCircle className="w-3 h-3" />
            <span>+ Aquí</span>
          </button>
        </div>
      </div>

      {formationsOpen && (
        <>
          <div className="text-[10px] text-slate-500 mb-1.5 flex justify-between px-1">
            <span>Nombre</span>
            <span>Hold ms · Trans ms</span>
          </div>

          <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1">
            {formations.map((form) => {
              const isSelected = form.id === selectedFormationId;

              return (
                <div
                  key={form.id}
                  onClick={() => onSelectFormation(form.id)}
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

                  {formations.length > 1 && (
                    <button
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
        </>
      )}
    </div>
  );

  if (isSidebarCollapsed) {
    return (
      <div className="w-10 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-3 gap-3 z-10">
        <button
          onClick={onToggleSidebarCollapse}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 shadow-sm"
          title="Expandir panel de herramientas"
        >
          <Columns className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <aside 
      style={{ width: `${sidebarWidth}px` }} 
      className={`shrink-0 bg-slate-900 p-3 flex flex-col gap-3 overflow-y-auto select-none z-10 ${
        sidebarDock === 'left' ? 'border-r border-slate-800' : 'border-l border-slate-800 order-last'
      }`}
    >
      {/* CABECERA DEL PANEL LATERAL: CONTROLES DE DOCK Y COLAPSO */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <GripVertical className="w-3.5 h-3.5 text-slate-500" />
          <span>Espacio de Trabajo</span>
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleSidebarDock}
            className="p-1 rounded text-slate-400 hover:text-cyan-400 hover:bg-slate-800 transition"
            title={sidebarDock === 'left' ? 'Mover panel a la DERECHA' : 'Mover panel a la IZQUIERDA'}
          >
            <Columns className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onToggleSidebarCollapse}
            className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
            title="Minimizar panel lateral"
          >
            {sidebarDock === 'left' ? <PanelLeftClose className="w-3.5 h-3.5" /> : <PanelRightClose className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* RENDERIZADO DINÁMICO DE SECCIONES EN EL ORDEN ELEGIDO */}
      {sectionOrder.map((sec) => (
        <React.Fragment key={sec}>
          {sec === 'dancers' ? renderDancersSection() : renderFormationsSection()}
        </React.Fragment>
      ))}

      {/* Tips de Coreografía */}
      <div className="mt-auto p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-400 leading-relaxed">
        <p className="font-semibold text-slate-300 mb-1 flex items-center gap-1">
          <span>Tips de Coreógrafo:</span>
        </p>
        <ul className="list-disc list-inside space-y-1 text-[10px]">
          <li>Arrastra fichas en el escenario para mover bailarines.</li>
          <li>Rueda del ratón = Zoom en figuras y escenario.</li>
          <li>Arrastra el fondo para mover la vista (Paneo).</li>
          <li>Doble clic en un conteo = crear formación.</li>
        </ul>
      </div>
    </aside>
  );
};
