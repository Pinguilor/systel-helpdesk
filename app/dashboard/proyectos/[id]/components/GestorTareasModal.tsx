'use client';

import React, { useState, useMemo, useTransition, useOptimistic } from 'react';
import { 
    X, CheckSquare, Search, Plus, Trash2, Check, Zap, UserPlus, Loader2
} from 'lucide-react';
import { 
    crearChecklistItemAction,
    toggleChecklistItemAction,
    eliminarChecklistItemAction,
    aplicarPlantillaChecklistAction,
    asignarResponsableChecklistAction
} from '../actions';

interface ChecklistTask {
    id: string;
    titulo: string;
    completado: boolean;
    completado_por: string | null;
    completado_en: string | null;
    asignado_a: { id: string; nombre: string; iniciales: string } | null;
}

interface GestorTareasModalProps {
    proyectoId: string;
    entradas: any[];
    plantillas: any[];
    currentUserRol: string;
    currentUserId: string;
    participantes: any[];
    onClose: () => void;
}

export function GestorTareasModal({
    proyectoId,
    entradas,
    plantillas,
    currentUserRol,
    currentUserId,
    participantes,
    onClose
}: GestorTareasModalProps) {
    const [isPending, startTransition] = useTransition();
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'todas' | 'pendientes' | 'completadas' | 'mis_tareas'>('todas');
    
    // Formularios locales
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [showTemplateSelector, setShowTemplateSelector] = useState(false);
    const [selectedTemplateToApply, setSelectedTemplateToApply] = useState<any | null>(null);
    const [showAssignFor, setShowAssignFor] = useState<string | null>(null);

    // 1. Parse checklist items
    const tasks: ChecklistTask[] = useMemo(() => {
        return entradas
            .filter(e => e.tipo === 'hito' && e.contenido?.startsWith('[CHECKLIST]'))
            .map(e => {
                const titulo = e.contenido.replace('[CHECKLIST]', '').trim();
                const payload = e.adjuntos?.[0] || {};
                return {
                    id: e.id,
                    titulo,
                    completado: !!payload.completado,
                    completado_por: payload.completado_por || null,
                    completado_en: payload.completado_en ? new Date(payload.completado_en).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }) : null,
                    asignado_a: payload.asignado_a || null,
                };
            });
    }, [entradas]);

    // 2. Setup optimistic updates
    const [optimisticTasks, setOptimisticTasks] = useOptimistic(
        tasks,
        (state, action: 
            | { type: 'toggle'; id: string; completado: boolean } 
            | { type: 'add'; titulo: string } 
            | { type: 'delete'; id: string }
            | { type: 'bulk_add'; tasks: ChecklistTask[] }
            | { type: 'assign'; id: string; asignado_a: { id: string; nombre: string; iniciales: string } | null }
        ) => {
            if (action.type === 'toggle') {
                return state.map(t =>
                    t.id === action.id ? { ...t, completado: action.completado, completado_por: action.completado ? 'Tú' : null, completado_en: action.completado ? 'ahora' : null } : t
                );
            }
            if (action.type === 'add') {
                return [
                    ...state,
                    {
                        id: 'temp-id-' + Date.now(),
                        titulo: action.titulo,
                        completado: false,
                        completado_por: null,
                        completado_en: null,
                        asignado_a: null,
                    },
                ];
            }
            if (action.type === 'delete') {
                return state.filter(t => t.id !== action.id);
            }
            if (action.type === 'bulk_add') {
                return [...state, ...action.tasks];
            }
            if (action.type === 'assign') {
                return state.map(t =>
                    t.id === action.id ? { ...t, asignado_a: action.asignado_a } : t
                );
            }
            return state;
        }
    );

    // 3. Handlers
    function handleToggle(id: string, completado: boolean, titulo: string) {
        startTransition(async () => {
            setOptimisticTasks({ type: 'toggle', id, completado });
            const res = await toggleChecklistItemAction(proyectoId, id, completado, titulo);
            if (res.error) alert(`Error al actualizar tarea: ${res.error}`);
        });
    }

    function handleAddTask(e: React.FormEvent) {
        e.preventDefault();
        const title = newTaskTitle.trim();
        if (!title) return;

        setNewTaskTitle('');
        startTransition(async () => {
            setOptimisticTasks({ type: 'add', titulo: title });
            const res = await crearChecklistItemAction(proyectoId, title);
            if (res.error) alert(`Error al crear tarea: ${res.error}`);
        });
    }

    function handleDelete(id: string) {
        startTransition(async () => {
            setOptimisticTasks({ type: 'delete', id });
            const res = await eliminarChecklistItemAction(proyectoId, id);
            if (res.error) alert(`Error al eliminar tarea: ${res.error}`);
        });
    }

    function handleAssignTask(id: string, titulo: string, tecnico: { id: string; nombre: string; iniciales: string } | null) {
        startTransition(async () => {
            setOptimisticTasks({ type: 'assign', id, asignado_a: tecnico });
            const res = await asignarResponsableChecklistAction(
                proyectoId, id, tecnico?.id || null, tecnico?.nombre || null, tecnico?.iniciales || null, titulo
            );
            if (res.error) alert(`Error al asignar tarea: ${res.error}`);
            setShowAssignFor(null);
        });
    }

    function handleApplyTemplate() {
        if (!selectedTemplateToApply) return;
        const plantilla = selectedTemplateToApply;

        startTransition(async () => {
            const tempInserts = (plantilla.tareas || []).map((t: string) => ({
                id: 'temp-id-' + Math.random(),
                titulo: t,
                completado: false,
                completado_por: null,
                completado_en: null,
                asignado_a: null,
            }));

            setOptimisticTasks({ type: 'bulk_add', tasks: tempInserts });
            const res = await aplicarPlantillaChecklistAction(proyectoId, plantilla.id);
            
            if (res.error) {
                alert(`Error al aplicar plantilla: ${res.error}`);
            } else {
                setShowTemplateSelector(false);
                setSelectedTemplateToApply(null);
            }
        });
    }

    // 4. Filtrado (Role, Tab, Search)
    const tareasVisiblesBase = useMemo(() => {
        return currentUserRol === 'tecnico' 
            ? optimisticTasks.filter(t => t.asignado_a?.id === currentUserId) 
            : optimisticTasks;
    }, [optimisticTasks, currentUserRol, currentUserId]);

    const filteredTasks = useMemo(() => {
        let result = tareasVisiblesBase;

        // Búsqueda de texto
        if (searchTerm.trim()) {
            const lowerSearch = searchTerm.toLowerCase();
            result = result.filter(t => t.titulo.toLowerCase().includes(lowerSearch));
        }

        // Tabs
        if (activeTab === 'pendientes') result = result.filter(t => !t.completado);
        if (activeTab === 'completadas') result = result.filter(t => t.completado);
        if (activeTab === 'mis_tareas') result = result.filter(t => t.asignado_a?.id === currentUserId);

        return result;
    }, [tareasVisiblesBase, currentUserId, searchTerm, activeTab]);

    const total = tareasVisiblesBase.length;
    const completedCount = tareasVisiblesBase.filter(t => t.completado).length;
    const progress = total > 0 ? Math.round((completedCount / total) * 100) : 0;

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl border border-slate-200/50 shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col relative overflow-hidden animate-in zoom-in-95 duration-200">
                
                {/* ── HEADER ── */}
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                            <CheckSquare className="w-6 h-6 text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-900">Centro de Tareas</h2>
                            <p className="text-sm text-slate-500 font-medium">Gestiona y asigna las actividades del checklist</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center hover:bg-slate-100 transition-colors border border-slate-200"
                    >
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* ── TOOLBAR (Progreso, Tabs, Búsqueda, Plantillas) ── */}
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0 space-y-4">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        
                        {/* Tabs */}
                        <div className="flex items-center gap-2 bg-slate-200/50 p-1 rounded-xl">
                            {['todas', 'pendientes', 'completadas', 'mis_tareas'].map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab as any)}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all capitalize ${
                                        activeTab === tab 
                                            ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60' 
                                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                                    }`}
                                >
                                    {tab.replace('_', ' ')}
                                </button>
                            ))}
                        </div>

                        {/* Search & Actions */}
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <div className="relative flex-1 md:w-64">
                                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Buscar tarea..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                                />
                            </div>

                            {/* Template Selector Button */}
                            {currentUserRol !== 'tecnico' && (
                                <div className="relative shrink-0">
                                    <button
                                        onClick={() => {
                                            setShowTemplateSelector(!showTemplateSelector);
                                            setSelectedTemplateToApply(null);
                                        }}
                                        disabled={isPending}
                                        className="px-4 py-2 bg-indigo-50 border border-indigo-200/80 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
                                        title="Cargar Plantilla"
                                    >
                                        <Zap className="w-4 h-4 text-indigo-600" />
                                        <span>Plantillas</span>
                                    </button>

                                    {/* Template Popover */}
                                    {showTemplateSelector && (
                                        <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-3 max-h-80 overflow-y-auto flex flex-col gap-2">
                                            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Plantillas Globales</span>
                                                <button onClick={() => setShowTemplateSelector(false)} className="text-slate-400 hover:text-slate-600">
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                            {selectedTemplateToApply ? (
                                                <div className="space-y-3 py-1">
                                                    <p className="text-xs text-slate-600 font-semibold leading-relaxed">
                                                        ¿Inyectar <span className="font-black text-slate-800">{selectedTemplateToApply.tareas?.length || 0}</span> tareas de "{selectedTemplateToApply.nombre}"?
                                                    </p>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => setSelectedTemplateToApply(null)} className="flex-1 py-1.5 border border-slate-200 text-slate-500 rounded-lg text-xs font-bold hover:bg-slate-50">Cancelar</button>
                                                        <button onClick={handleApplyTemplate} disabled={isPending} className="flex-1 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 flex justify-center items-center gap-1">
                                                            {isPending && <Loader2 className="w-3 h-3 animate-spin" />} Confirmar
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col gap-1">
                                                    {plantillas.length === 0 ? (
                                                        <p className="text-xs text-slate-400 text-center py-4">No hay plantillas disponibles.</p>
                                                    ) : (
                                                        plantillas.map(p => (
                                                            <button
                                                                key={p.id}
                                                                onClick={() => setSelectedTemplateToApply(p)}
                                                                className="text-left px-3 py-2 text-xs hover:bg-slate-50 font-bold text-slate-700 rounded-xl flex items-center justify-between border border-transparent hover:border-slate-200 transition-colors"
                                                            >
                                                                <span className="truncate">{p.nombre}</span>
                                                                <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{p.tareas?.length || 0}</span>
                                                            </button>
                                                        ))
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <span>Progreso General del Checklist</span>
                            <span>{completedCount} de {total} ({progress}%)</span>
                        </div>
                        <div className="w-full bg-slate-200/60 rounded-full h-2 overflow-hidden">
                            <div
                                className="bg-gradient-to-r from-indigo-500 to-emerald-500 h-full rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* ── LISTA DE TAREAS ── */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
                    <div className="space-y-3">
                        {filteredTasks.length === 0 ? (
                            <div className="text-center py-12">
                                <CheckSquare className="w-12 h-12 text-slate-200 mx-auto mb-4" strokeWidth={1} />
                                <p className="text-sm font-semibold text-slate-500">No hay tareas que coincidan con la vista actual.</p>
                            </div>
                        ) : (
                            filteredTasks.map(task => (
                                <div key={task.id} className="bg-white border border-slate-200 rounded-2xl p-4 flex items-start gap-4 hover:border-slate-300 transition-colors shadow-sm group">
                                    <button
                                        type="button"
                                        onClick={() => handleToggle(task.id, !task.completado, task.titulo)}
                                        disabled={isPending}
                                        className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all duration-200 ${
                                            task.completado
                                                ? 'bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-100'
                                                : 'border-slate-300 hover:border-slate-400 bg-slate-50'
                                        }`}
                                    >
                                        {task.completado && <Check className="w-4 h-4 stroke-[3]" />}
                                    </button>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-4">
                                            <p className={`text-sm font-semibold leading-relaxed transition-all ${
                                                task.completado ? 'line-through text-slate-400' : 'text-slate-800'
                                            }`}>
                                                {task.titulo}
                                            </p>
                                            
                                            {/* Acciones de Tarea */}
                                            {currentUserRol !== 'tecnico' && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(task.id)}
                                                    disabled={isPending}
                                                    className="text-slate-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                                                    title="Eliminar tarea"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>

                                        <div className="mt-2 flex items-center flex-wrap gap-y-2 gap-x-4">
                                            {/* Metadatos de completado */}
                                            {task.completado && task.completado_por && (
                                                <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                                                    <Check className="w-3.5 h-3.5" />
                                                    Completado por {task.completado_por} {task.completado_en ? `(${task.completado_en})` : ''}
                                                </span>
                                            )}

                                            {/* UI de Asignación */}
                                            {!task.completado && (
                                                <div className="relative">
                                                    {task.asignado_a ? (
                                                        <div className="flex items-center gap-2 bg-indigo-50/50 border border-indigo-100 px-2 py-1 rounded-lg">
                                                            <div className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center text-[9px] font-black uppercase">
                                                                {task.asignado_a.iniciales}
                                                            </div>
                                                            <span className="text-xs font-semibold text-slate-600">{task.asignado_a.nombre}</span>
                                                            {currentUserRol !== 'tecnico' && (
                                                                <button 
                                                                    onClick={() => handleAssignTask(task.id, task.titulo, null)}
                                                                    disabled={isPending}
                                                                    className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors ml-1"
                                                                >
                                                                    <X className="w-3.5 h-3.5" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        currentUserRol !== 'tecnico' && (
                                                            <button
                                                                onClick={() => setShowAssignFor(showAssignFor === task.id ? null : task.id)}
                                                                className="text-xs font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1.5 border border-dashed border-slate-300 hover:border-indigo-300 px-3 py-1.5 rounded-lg transition-all bg-white"
                                                            >
                                                                <UserPlus className="w-3.5 h-3.5" />
                                                                Asignar
                                                            </button>
                                                        )
                                                    )}

                                                    {/* Popover de asignación */}
                                                    {showAssignFor === task.id && (
                                                        <div className="absolute left-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 p-2 overflow-hidden">
                                                            {participantes.length === 0 ? (
                                                                <p className="text-xs text-slate-400 text-center py-3">No hay técnicos asignados al proyecto.</p>
                                                            ) : (
                                                                <div className="max-h-48 overflow-y-auto pr-1 flex flex-col gap-1">
                                                                    {participantes.map(p => {
                                                                        const nombre = p.perfil?.full_name || 'Sin nombre';
                                                                        const iniciales = nombre.slice(0, 2);
                                                                        return (
                                                                            <button
                                                                                key={p.id}
                                                                                onClick={() => handleAssignTask(task.id, task.titulo, { id: p.perfil?.id || '', nombre, iniciales })}
                                                                                className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 font-bold text-slate-700 flex items-center gap-3 transition-colors rounded-xl border border-transparent hover:border-slate-200"
                                                                            >
                                                                                <div className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center text-[10px] font-black uppercase text-slate-500 shrink-0">
                                                                                    {iniciales}
                                                                                </div>
                                                                                <span className="truncate">{nombre}</span>
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* ── FOOTER (Añadir Nueva Tarea) ── */}
                {currentUserRol !== 'tecnico' && (
                    <div className="p-6 border-t border-slate-100 bg-white shrink-0">
                        <form onSubmit={handleAddTask} className="flex items-center gap-3">
                            <div className="flex-1 relative">
                                <input
                                    type="text"
                                    required
                                    placeholder="Escribe una nueva tarea..."
                                    value={newTaskTitle}
                                    onChange={e => setNewTaskTitle(e.target.value)}
                                    disabled={isPending}
                                    className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-indigo-500 focus:bg-white transition-all disabled:opacity-50"
                                />
                                <button
                                    type="submit"
                                    disabled={isPending || !newTaskTitle.trim()}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center transition-colors disabled:opacity-50 disabled:hover:bg-indigo-600 shadow-sm"
                                >
                                    {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}
