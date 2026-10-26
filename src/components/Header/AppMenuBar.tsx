import React, { useState, useRef, useEffect } from 'react';
import { 
  FileText, 
  FolderOpen, 
  Save, 
  RotateCcw, 
  PlusCircle, 
  Layout, 
  HelpCircle, 
  Sliders, 
  Trash2, 
  Copy, 
  Check, 
  Sparkles,
  Laptop
} from 'lucide-react';
import { ChoreoSession, WorkspaceLayout, PanelId } from '../../types/choreo';

interface AppMenuBarProps {
  sessionName: string;
  onNewSession: () => void;
  onOpenSession: (file: File) => void;
  onSaveSession: () => void;
  onSaveSessionAs: () => void;
  onResetDemo: () => void;
  onAddDancer: () => void;
  onAddFormation: () => void;
  onDeleteSelected: () => void;
  onDuplicateFormation: () => void;
  onSelectAllFormations: () => void;
  onResetLayout: () => void;
  onTogglePanel: (panelId: PanelId) => void;
  visiblePanels: Record<PanelId, boolean>;
  onOpenShortcutsHelp: () => void;
  onOpenOfflineHelp: () => void;
}

export const AppMenuBar: React.FC<AppMenuBarProps> = ({
  sessionName,
  onNewSession,
  onOpenSession,
  onSaveSession,
  onSaveSessionAs,
  onResetDemo,
  onAddDancer,
  onAddFormation,
  onDeleteSelected,
  onDuplicateFormation,
  onSelectAllFormations,
  onResetLayout,
  onTogglePanel,
  visiblePanels,
  onOpenShortcutsHelp,
  onOpenOfflineHelp,
}) => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cerrar menús al hacer clic fuera
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.app-menu-dropdown')) {
        setActiveMenu(null);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onOpenSession(file);
      e.target.value = '';
    }
  };

  const toggleMenu = (menuName: string) => {
    setActiveMenu((prev) => (prev === menuName ? null : menuName));
  };

  const handleMouseEnterMenu = (menuName: string) => {
    if (activeMenu !== null) {
      setActiveMenu(menuName);
    }
  };

  return (
    <div className="w-full bg-slate-950 border-b border-slate-800/90 text-xs text-slate-300 flex items-center justify-between px-3 h-7 select-none z-50">
      {/* Menús desplegables estilo Adobe Premiere / Audition */}
      <div className="flex items-center gap-0.5">
        {/* MENÚ: ARCHIVO / SESIÓN */}
        <div className="relative app-menu-dropdown">
          <button
            onClick={() => toggleMenu('file')}
            onMouseEnter={() => handleMouseEnterMenu('file')}
            className={`px-2 py-0.5 rounded text-xs transition ${
              activeMenu === 'file' ? 'bg-violet-600 text-white font-semibold' : 'hover:bg-slate-800 text-slate-300'
            }`}
          >
            Sesión
          </button>
          {activeMenu === 'file' && (
            <div className="absolute left-0 top-full mt-1 w-56 bg-slate-900 border border-slate-800 rounded-lg shadow-2xl py-1 z-50 text-xs">
              <button
                onClick={() => { onNewSession(); setActiveMenu(null); }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-violet-600/30 hover:text-white transition"
              >
                <span className="flex items-center gap-2"><FileText className="w-3.5 h-3.5 text-cyan-400" /> Nueva Sesión</span>
                <span className="text-[10px] text-slate-500 font-mono">Ctrl+N</span>
              </button>
              <button
                onClick={() => { fileInputRef.current?.click(); setActiveMenu(null); }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-violet-600/30 hover:text-white transition"
              >
                <span className="flex items-center gap-2"><FolderOpen className="w-3.5 h-3.5 text-violet-400" /> Abrir Sesión (.choreo)...</span>
                <span className="text-[10px] text-slate-500 font-mono">Ctrl+O</span>
              </button>
              <div className="h-px bg-slate-800 my-1" />
              <button
                onClick={() => { onSaveSession(); setActiveMenu(null); }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-violet-600/30 hover:text-white transition"
              >
                <span className="flex items-center gap-2"><Save className="w-3.5 h-3.5 text-emerald-400" /> Guardar Sesión (.choreo)</span>
                <span className="text-[10px] text-slate-500 font-mono">Ctrl+S</span>
              </button>
              <button
                onClick={() => { onSaveSessionAs(); setActiveMenu(null); }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-violet-600/30 hover:text-white transition"
              >
                <span className="flex items-center gap-2"><Save className="w-3.5 h-3.5 text-slate-400" /> Guardar Sesión Como...</span>
                <span className="text-[10px] text-slate-500 font-mono">Ctrl+Shift+S</span>
              </button>
              <div className="h-px bg-slate-800 my-1" />
              <button
                onClick={() => { onResetDemo(); setActiveMenu(null); }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 transition"
              >
                <span className="flex items-center gap-2"><RotateCcw className="w-3.5 h-3.5" /> Restaurar Sesión Demo</span>
              </button>
            </div>
          )}
        </div>

        {/* MENÚ: EDICIÓN */}
        <div className="relative app-menu-dropdown">
          <button
            onClick={() => toggleMenu('edit')}
            onMouseEnter={() => handleMouseEnterMenu('edit')}
            className={`px-2 py-0.5 rounded text-xs transition ${
              activeMenu === 'edit' ? 'bg-violet-600 text-white font-semibold' : 'hover:bg-slate-800 text-slate-300'
            }`}
          >
            Edición
          </button>
          {activeMenu === 'edit' && (
            <div className="absolute left-0 top-full mt-1 w-60 bg-slate-900 border border-slate-800 rounded-lg shadow-2xl py-1 z-50 text-xs">
              <button
                onClick={() => { onSelectAllFormations(); setActiveMenu(null); }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-violet-600/30 hover:text-white transition"
              >
                <span>Seleccionar Todas las Formaciones</span>
                <span className="text-[10px] text-slate-500 font-mono">Ctrl+A</span>
              </button>
              <button
                onClick={() => { onDuplicateFormation(); setActiveMenu(null); }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-violet-600/30 hover:text-white transition"
              >
                <span className="flex items-center gap-2"><Copy className="w-3.5 h-3.5 text-cyan-400" /> Duplicar Formación</span>
                <span className="text-[10px] text-slate-500 font-mono">Ctrl+D</span>
              </button>
              <div className="h-px bg-slate-800 my-1" />
              <button
                onClick={() => { onDeleteSelected(); setActiveMenu(null); }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-rose-950/40 text-rose-300 transition"
              >
                <span className="flex items-center gap-2"><Trash2 className="w-3.5 h-3.5 text-rose-400" /> Eliminar Formaciones Seleccionadas</span>
                <span className="text-[10px] text-rose-400 font-mono">Supr / Backspace</span>
              </button>
            </div>
          )}
        </div>

        {/* MENÚ: VENTANAS / ESPACIO DE TRABAJO */}
        <div className="relative app-menu-dropdown">
          <button
            onClick={() => toggleMenu('workspace')}
            onMouseEnter={() => handleMouseEnterMenu('workspace')}
            className={`px-2 py-0.5 rounded text-xs transition ${
              activeMenu === 'workspace' ? 'bg-violet-600 text-white font-semibold' : 'hover:bg-slate-800 text-slate-300'
            }`}
          >
            Ventanas
          </button>
          {activeMenu === 'workspace' && (
            <div className="absolute left-0 top-full mt-1 w-64 bg-slate-900 border border-slate-800 rounded-lg shadow-2xl py-1 z-50 text-xs">
              <button
                onClick={() => { onResetLayout(); setActiveMenu(null); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-violet-600/30 hover:text-white transition text-cyan-300 font-medium"
              >
                <Layout className="w-3.5 h-3.5" />
                <span>Restablecer Diseño de Paneles</span>
              </button>
              <div className="h-px bg-slate-800 my-1" />
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Paneles Visibles
              </div>
              <button
                onClick={() => onTogglePanel('dancers')}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-slate-800 text-slate-300 transition"
              >
                <span>Panel de Bailarines</span>
                {visiblePanels.dancers && <Check className="w-3.5 h-3.5 text-cyan-400" />}
              </button>
              <button
                onClick={() => onTogglePanel('formations')}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-slate-800 text-slate-300 transition"
              >
                <span>Panel de Formaciones</span>
                {visiblePanels.formations && <Check className="w-3.5 h-3.5 text-cyan-400" />}
              </button>
              <button
                onClick={() => onTogglePanel('stage')}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-slate-800 text-slate-300 transition"
              >
                <span>Lienzo del Escenario (#)</span>
                {visiblePanels.stage && <Check className="w-3.5 h-3.5 text-cyan-400" />}
              </button>
              <button
                onClick={() => onTogglePanel('timeline')}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-slate-800 text-slate-300 transition"
              >
                <span>Línea de Tiempo y Audio</span>
                {visiblePanels.timeline && <Check className="w-3.5 h-3.5 text-cyan-400" />}
              </button>
            </div>
          )}
        </div>

        {/* MENÚ: COREOGRAFÍA */}
        <div className="relative app-menu-dropdown">
          <button
            onClick={() => toggleMenu('choreo')}
            onMouseEnter={() => handleMouseEnterMenu('choreo')}
            className={`px-2 py-0.5 rounded text-xs transition ${
              activeMenu === 'choreo' ? 'bg-violet-600 text-white font-semibold' : 'hover:bg-slate-800 text-slate-300'
            }`}
          >
            Coreografía
          </button>
          {activeMenu === 'choreo' && (
            <div className="absolute left-0 top-full mt-1 w-56 bg-slate-900 border border-slate-800 rounded-lg shadow-2xl py-1 z-50 text-xs">
              <button
                onClick={() => { onAddDancer(); setActiveMenu(null); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-violet-600/30 hover:text-white transition"
              >
                <PlusCircle className="w-3.5 h-3.5 text-cyan-400" />
                <span>+ Añadir Bailarín</span>
              </button>
              <button
                onClick={() => { onAddFormation(); setActiveMenu(null); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-violet-600/30 hover:text-white transition"
              >
                <PlusCircle className="w-3.5 h-3.5 text-violet-400" />
                <span>+ Añadir Formación en Tiempo Actual</span>
              </button>
            </div>
          )}
        </div>

        {/* MENÚ: AYUDA */}
        <div className="relative app-menu-dropdown">
          <button
            onClick={() => toggleMenu('help')}
            onMouseEnter={() => handleMouseEnterMenu('help')}
            className={`px-2 py-0.5 rounded text-xs transition ${
              activeMenu === 'help' ? 'bg-violet-600 text-white font-semibold' : 'hover:bg-slate-800 text-slate-300'
            }`}
          >
            Ayuda
          </button>
          {activeMenu === 'help' && (
            <div className="absolute left-0 top-full mt-1 w-56 bg-slate-900 border border-slate-800 rounded-lg shadow-2xl py-1 z-50 text-xs">
              <button
                onClick={() => { onOpenShortcutsHelp(); setActiveMenu(null); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-violet-600/30 hover:text-white transition"
              >
                <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
                <span>Atajos de Teclado</span>
              </button>
              <button
                onClick={() => { onOpenOfflineHelp(); setActiveMenu(null); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-violet-600/30 hover:text-white transition"
              >
                <Laptop className="w-3.5 h-3.5 text-emerald-400" />
                <span>Guía Modo Academia (Offline)</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Nombre de la Sesión Activa */}
      <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5 truncate max-w-xs sm:max-w-md">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
        <span className="text-slate-200 font-semibold truncate">{sessionName}</span>
        <span className="text-[10px] text-slate-500 font-mono">(.choreo)</span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".choreo,.json,application/json"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
};
