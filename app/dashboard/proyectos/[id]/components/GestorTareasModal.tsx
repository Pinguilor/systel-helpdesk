'use client';

import React, { useState, useMemo, useTransition, useOptimistic, useRef } from 'react';
import {
    X, CheckSquare, Search, Plus, Trash2, Check, Zap, UserPlus, Loader2,
    ChevronDown, FolderPlus, AlertTriangle, Pencil, Folder,
} from 'lucide-react';
import {
    crearChecklistItemAction,
    toggleChecklistItemAction,
    eliminarChecklistItemAction,
    aplicarPlantillaChecklistAction,
    asignarResponsableChecklistAction,
    actualizarNombreGrupoAction,
    eliminarGrupoCompletoAction,
} from '../actions';

interface ChecklistEntry {
    id: string;
    titulo: string;
    grupo: string;
    completado: boolean;
    completado_por: string | null;
    completado_en: string | null;
    asignado_a: { id: string; nombre: string; iniciales: string } | null;
}

type OptimisticAction =
    | { type: 'toggle'; id: string; completado: boolean }
    | { type: 'add'; titulo: string; grupo: string }
    | { type: 'delete'; id: string }
    | { type: 'delete_group'; grupo: string }
    | { type: 'rename_group'; oldName: string; newName: string }
    | { type: 'bulk_add'; tareas: { titulo: string; grupo: string }[] }
    | { type: 'assign'; id: string; asignado_a: ChecklistEntry['asignado_a'] };

interface GestorTareasModalProps {
    proyectoId: string;
    entradas: any[];
    plantillas: any[];
    currentUserRol: string;
    currentUserId: string;
    canManage?: boolean;
    isReadOnly?: boolean;
    participantes: any[];
    onClose: () => void;
}

export function GestorTareasModal({
    proyectoId,
    entradas,
    plantillas,
    currentUserRol,
    currentUserId,
    canManage,
    isReadOnly = false,
    participantes,
    onClose,
}: GestorTareasModalProps) {
    const [isPending, startTransition] = useTransition();
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'todas' | 'pendientes' | 'completadas' | 'mis_tareas'>('todas');
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [selectedGroup, setSelectedGroup] = useState<string>('General');
    const [showNewGroupInput, setShowNewGroupInput] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [showTemplateSelector, setShowTemplateSelector] = useState(false);
    const [selectedTemplateToApply, setSelectedTemplateToApply] = useState<any | null>(null);
    const [showAssignFor, setShowAssignFor] = useState<string | null>(null);
    const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
        // Auto-open all groups that have tasks on initial render
        const gs = entradas
            .filter(e => e.tipo === 'hito' && e.contenido?.startsWith('[CHECKLIST]'))
            .map(e => e.grupo || 'General');
        return new Set(gs);
    });
    const [renamingGroup, setRenamingGroup] = useState<string | null>(null);
    const [renameInput, setRenameInput] = useState('');
    const [confirmDeleteGroup, setConfirmDeleteGroup] = useState<string | null>(null);
    const [inlineError, setInlineError] = useState<string | null>(null);
    const renameInputRef = useRef<HTMLInputElement>(null);

    // ── 1. Parse entries ─────────────────────────────────────────────────
    const allEntries: ChecklistEntry[] = useMemo(() => {
        return entradas
            .filter(e => e.tipo === 'hito' && e.contenido?.startsWith('[CHECKLIST]'))
            .map(e => {
                const titulo = e.contenido.replace('[CHECKLIST]', '').trim();
                const payload = e.adjuntos?.[0] || {};
                return {
                    id: e.id,
                    titulo,
                    grupo: e.grupo || 'General',
                    completado: !!payload.completado,
                    completado_por: payload.completado_por || null,
                    completado_en: payload.completado_en
                        ? new Date(payload.completado_en).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
                        : null,
                    asignado_a: payload.asignado_a || null,
                };
            });
    }, [entradas]);

    // ── 2. Optimistic state ──────────────────────────────────────────────
    const [optimisticEntries, setOptimisticEntries] = useOptimistic(
        allEntries,
        (state: ChecklistEntry[], action: OptimisticAction) => {
            switch (action.type) {
                case 'toggle':
                    return state.map(e =>
                        e.id === action.id
                            ? { ...e, completado: action.completado, completado_por: action.completado ? 'Tú' : null, completado_en: action.completado ? 'ahora' : null }
                            : e
                    );
                case 'add':
                    return [...state, {
                        id: 'temp-' + Date.now(),
                        titulo: action.titulo,
                        grupo: action.grupo,
                        completado: false,
                        completado_por: null,
                        completado_en: null,
                        asignado_a: null,
                    }];
                case 'delete':
                    return state.filter(e => e.id !== action.id);
                case 'delete_group':
                    return state.filter(e => e.grupo !== action.grupo);
                case 'rename_group':
                    return state.map(e => e.grupo === action.oldName ? { ...e, grupo: action.newName } : e);
                case 'bulk_add': {
                    const newEntries = action.tareas.map((t, i) => ({
                        id: 'temp-bulk-' + Date.now() + i,
                        titulo: t.titulo,
                        grupo: t.grupo,
                        completado: false,
                        completado_por: null,
                        completado_en: null,
                        asignado_a: null,
                    }));
                    return [...state, ...newEntries];
                }
                case 'assign':
                    return state.map(e => e.id === action.id ? { ...e, asignado_a: action.asignado_a } : e);
                default:
                    return state;
            }
        }
    );

    const isManager = canManage ?? (currentUserRol !== 'tecnico');

    // ── 3. Progress ──────────────────────────────────────────────────────
    const baseLeafs = (!isManager && currentUserRol === 'tecnico')
        ? optimisticEntries.filter(t => t.asignado_a?.id === currentUserId)
        : optimisticEntries;
    const total = baseLeafs.length;
    const completedCount = baseLeafs.filter(t => t.completado).length;
    const progress = total > 0 ? Math.round((completedCount / total) * 100) : 0;

    // ── 4. Group by grupo ────────────────────────────────────────────────
    const { tareasPorGrupo, gruposUnicos } = useMemo(() => {
        let leafs = [...optimisticEntries];

        if (!isManager && currentUserRol === 'tecnico') leafs = leafs.filter(t => t.asignado_a?.id === currentUserId);
        if (activeTab === 'pendientes')   leafs = leafs.filter(t => !t.completado);
        if (activeTab === 'completadas')  leafs = leafs.filter(t => t.completado);
        if (activeTab === 'mis_tareas')   leafs = leafs.filter(t => t.asignado_a?.id === currentUserId);
        if (searchTerm.trim()) {
            const lower = searchTerm.toLowerCase();
            leafs = leafs.filter(t => t.titulo.toLowerCase().includes(lower));
        }

        const tareasPorGrupo = leafs.reduce((acc, tarea) => {
            const g = tarea.grupo || 'General';
            if (!acc[g]) acc[g] = [];
            acc[g].push(tarea);
            return acc;
        }, {} as Record<string, ChecklistEntry[]>);

        // All distinct group names (unfiltered, for selectors)
        const gruposUnicos = [...new Set(optimisticEntries.map(e => e.grupo || 'General'))];

        return { tareasPorGrupo, gruposUnicos };
    }, [optimisticEntries, activeTab, searchTerm, isManager, currentUserRol, currentUserId]);

    // ── 5. Handlers ──────────────────────────────────────────────────────

    function handleToggle(id: string, completado: boolean, titulo: string) {
        startTransition(async () => {
            setOptimisticEntries({ type: 'toggle', id, completado });
            const res = await toggleChecklistItemAction(proyectoId, id, completado, titulo);
            if (res.error) setInlineError(`Error al actualizar tarea: ${res.error}`);
        });
    }

    function handleAddTask(e: React.FormEvent) {
        e.preventDefault();
        const title = newTaskTitle.trim();
        if (!title) return;

        // Resolve target group: if creating a new group, use that name
        const targetGroup = (showNewGroupInput && newGroupName.trim())
            ? newGroupName.trim()
            : selectedGroup;

        setNewTaskTitle('');
        if (showNewGroupInput && newGroupName.trim()) {
            const newGrupo = newGroupName.trim();
            setNewGroupName('');
            setShowNewGroupInput(false);
            setSelectedGroup(newGrupo);
            setOpenGroups(prev => new Set([...prev, newGrupo]));
        }

        startTransition(async () => {
            setOptimisticEntries({ type: 'add', titulo: title, grupo: targetGroup });
            const res = await crearChecklistItemAction(proyectoId, title, targetGroup);
            if (res.error) setInlineError(`Error al crear tarea: ${res.error}`);
        });
    }

    function handleDeleteTask(id: string) {
        startTransition(async () => {
            setOptimisticEntries({ type: 'delete', id });
            const res = await eliminarChecklistItemAction(proyectoId, id);
            if (res.error) setInlineError(`Error al eliminar tarea: ${res.error}`);
        });
    }

    function handleDeleteGroupConfirmed() {
        const grupo = confirmDeleteGroup;
        if (!grupo) return;
        setConfirmDeleteGroup(null);
        if (selectedGroup === grupo) setSelectedGroup('General');
        setOpenGroups(prev => { const next = new Set(prev); next.delete(grupo); return next; });
        startTransition(async () => {
            setOptimisticEntries({ type: 'delete_group', grupo });
            const res = await eliminarGrupoCompletoAction(proyectoId, grupo);
            if (res.error) setInlineError(`Error al eliminar grupo: ${res.error}`);
        });
    }

    function handleStartRename(grupoNombre: string) {
        setRenamingGroup(grupoNombre);
        setRenameInput(grupoNombre);
        setTimeout(() => renameInputRef.current?.select(), 50);
    }

    function handleRenameGroup(oldName: string) {
        const newName = renameInput.trim();
        setRenamingGroup(null);
        if (!newName || newName === oldName) return;
        if (selectedGroup === oldName) setSelectedGroup(newName);
        setOpenGroups(prev => {
            const next = new Set(prev);
            if (next.has(oldName)) { next.delete(oldName); next.add(newName); }
            return next;
        });
        startTransition(async () => {
            setOptimisticEntries({ type: 'rename_group', oldName, newName });
            const res = await actualizarNombreGrupoAction(proyectoId, oldName, newName);
            if (res.error) setInlineError(`Error al renombrar grupo: ${res.error}`);
        });
    }

    function handleAssignTask(id: string, titulo: string, tecnico: ChecklistEntry['asignado_a']) {
        startTransition(async () => {
            setOptimisticEntries({ type: 'assign', id, asignado_a: tecnico });
            const res = await asignarResponsableChecklistAction(
                proyectoId, id, tecnico?.id || null, tecnico?.nombre || null, tecnico?.iniciales || null, titulo
            );
            if (res.error) setInlineError(`Error al asignar tarea: ${res.error}`);
            setShowAssignFor(null);
        });
    }

    function handleApplyTemplate() {
        if (!selectedTemplateToApply) return;
        const plantilla = selectedTemplateToApply;

        const grupos: { nombre: string; tareas: string[] }[] =
            (plantilla.grupos && Array.isArray(plantilla.grupos) && plantilla.grupos.length > 0)
                ? plantilla.grupos
                : [{ nombre: plantilla.nombre, tareas: plantilla.tareas || [] }];

        const todasLasTareas = grupos.flatMap(g => g.tareas.map(t => ({ titulo: t, grupo: g.nombre })));
        const newGroupNames = grupos.map(g => g.nombre);

        setOpenGroups(prev => new Set([...prev, ...newGroupNames]));

        startTransition(async () => {
            setOptimisticEntries({ type: 'bulk_add', tareas: todasLasTareas });
            const res = await aplicarPlantillaChecklistAction(proyectoId, plantilla.id);
            if (res.error) {
                setInlineError(`Error al aplicar plantilla: ${res.error}`);
            } else {
                setShowTemplateSelector(false);
                setSelectedTemplateToApply(null);
            }
        });
    }

    // ── 6. Task row ──────────────────────────────────────────────────────
    function renderTaskRow(task: ChecklistEntry) {
        return (
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
                        {isManager && !isReadOnly && (
                            <button
                                type="button"
                                onClick={() => handleDeleteTask(task.id)}
                                disabled={isPending}
                                className="text-slate-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                                title="Eliminar tarea"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    <div className="mt-2 flex items-center flex-wrap gap-y-2 gap-x-4">
                        {task.completado && task.completado_por && (
                            <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                                <Check className="w-3.5 h-3.5" />
                                Completado por {task.completado_por} {task.completado_en ? `(${task.completado_en})` : ''}
                            </span>
                        )}

                        {!task.completado && (
                            <div className="relative">
                                {task.asignado_a ? (
                                    <div className="flex items-center gap-2 bg-indigo-50/50 border border-indigo-100 px-2 py-1 rounded-lg">
                                        <div className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center text-[9px] font-black uppercase">
                                            {task.asignado_a.iniciales}
                                        </div>
                                        <span className="text-xs font-semibold text-slate-600">{task.asignado_a.nombre}</span>
                                        {isManager && !isReadOnly && (
                                            <button
                                                onClick={() => handleAssignTask(task.id, task.titulo, null)}
                                                disabled={isPending}
                                                className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors ml-1"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                ) : isManager && !isReadOnly && (
                                    <button
                                        onClick={() => setShowAssignFor(showAssignFor === task.id ? null : task.id)}
                                        className="text-xs font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1.5 border border-dashed border-slate-300 hover:border-indigo-300 px-3 py-1.5 rounded-lg transition-all bg-white"
                                    >
                                        <UserPlus className="w-3.5 h-3.5" />
                                        Asignar
                                    </button>
                                )}

                                {showAssignFor === task.id && (
                                    <div className="absolute left-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 p-2 overflow-hidden">
                                        {participantes.length === 0 ? (
                                            <p className="text-xs text-slate-400 text-center py-3">No hay técnicos en el proyecto.</p>
                                        ) : (
                                            <div className="max-h-48 overflow-y-auto pr-1 flex flex-col gap-1">
                                                {participantes.map((p: any) => {
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
        );
    }

    const hasContent = Object.keys(tareasPorGrupo).length > 0;
    const totalTasksInTemplate = (p: any) => {
        if (p.grupos && Array.isArray(p.grupos) && p.grupos.length > 0)
            return (p.grupos as { tareas: string[] }[]).reduce((acc, g) => acc + g.tareas.length, 0);
        return p.tareas?.length || 0;
    };

    return (
        <>
            {/* ── Confirm delete group modal ── */}
            {confirmDeleteGroup && (
                <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center px-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                                <AlertTriangle className="w-5 h-5 text-red-600" />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-slate-900">Eliminar grupo</h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    ¿Eliminar el grupo <span className="font-black text-slate-800">&ldquo;{confirmDeleteGroup}&rdquo;</span> y todas sus tareas? Esta acción no se puede deshacer.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmDeleteGroup(null)}
                                className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDeleteGroupConfirmed}
                                disabled={isPending}
                                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-black hover:bg-red-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                                Eliminar Grupo
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl border border-slate-200/50 shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col relative overflow-hidden animate-in zoom-in-95 duration-200">

                    {/* ── HEADER ── */}
                    <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${isReadOnly ? 'bg-emerald-50 border border-emerald-200' : 'bg-indigo-50 border border-indigo-100'}`}>
                                <CheckSquare className={`w-6 h-6 ${isReadOnly ? 'text-emerald-500' : 'text-indigo-600'}`} />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-900">Centro de Tareas</h2>
                                <p className="text-sm text-slate-500 font-medium">
                                    {isReadOnly ? 'Proyecto completado — vista de solo lectura' : 'Gestiona y asigna las actividades del checklist'}
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose} className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center hover:bg-slate-100 transition-colors border border-slate-200">
                            <X className="w-5 h-5 text-slate-500" />
                        </button>
                    </div>

                    {/* ── TOOLBAR ── */}
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0 space-y-4">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                            <div className="flex items-center gap-2 bg-slate-200/50 p-1 rounded-xl">
                                {(['todas', 'pendientes', 'completadas', 'mis_tareas'] as const).map(tab => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
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

                                {isManager && !isReadOnly && (
                                    <div className="relative shrink-0">
                                        <button
                                            onClick={() => { setShowTemplateSelector(!showTemplateSelector); setSelectedTemplateToApply(null); }}
                                            disabled={isPending}
                                            className="px-4 py-2 bg-indigo-50 border border-indigo-200/80 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
                                        >
                                            <Zap className="w-4 h-4 text-indigo-600" />
                                            <span>Plantillas</span>
                                        </button>

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
                                                            ¿Aplicar <span className="font-black text-slate-800">{totalTasksInTemplate(selectedTemplateToApply)}</span> tareas de &ldquo;{selectedTemplateToApply.nombre}&rdquo;?
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
                                                            plantillas.map((p: any) => (
                                                                <button
                                                                    key={p.id}
                                                                    onClick={() => setSelectedTemplateToApply(p)}
                                                                    className="text-left px-3 py-2 text-xs hover:bg-slate-50 font-bold text-slate-700 rounded-xl flex items-center justify-between border border-transparent hover:border-slate-200 transition-colors"
                                                                >
                                                                    <div className="min-w-0">
                                                                        <span className="block truncate">{p.nombre}</span>
                                                                        {p.grupos?.length > 0 && (
                                                                            <span className="text-[10px] font-medium text-slate-400">{p.grupos.length} grupos</span>
                                                                        )}
                                                                    </div>
                                                                    <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 shrink-0 ml-2">{totalTasksInTemplate(p)}</span>
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
                                <span>Progreso General</span>
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

                    {/* ── LISTA DE TAREAS (grouped by grupo) ── */}
                    <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
                        {!hasContent ? (
                            <div className="text-center py-12">
                                <CheckSquare className="w-12 h-12 text-slate-200 mx-auto mb-4" strokeWidth={1} />
                                <p className="text-sm font-semibold text-slate-500">No hay tareas que coincidan con la vista actual.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {Object.entries(tareasPorGrupo).map(([grupoNombre, tareas]) => {
                                    const isOpen = openGroups.has(grupoNombre);
                                    const doneInGroup = tareas.filter(t => t.completado).length;
                                    const groupPct = tareas.length > 0 ? Math.round((doneInGroup / tareas.length) * 100) : 0;
                                    const isRenaming = renamingGroup === grupoNombre;

                                    return (
                                        <div key={grupoNombre} className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                                            {/* Accordion header */}
                                            <div className="flex items-center gap-2 px-4 py-3 hover:bg-slate-50/60 transition-colors">
                                                {/* Collapse toggle */}
                                                <button
                                                    type="button"
                                                    onClick={() => setOpenGroups(prev => {
                                                        const next = new Set(prev);
                                                        next.has(grupoNombre) ? next.delete(grupoNombre) : next.add(grupoNombre);
                                                        return next;
                                                    })}
                                                    className="flex items-center gap-2 flex-1 min-w-0 text-left"
                                                >
                                                    <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`} />
                                                    <Folder className="w-4 h-4 text-indigo-400 shrink-0" />

                                                    {isRenaming ? (
                                                        <input
                                                            ref={renameInputRef}
                                                            value={renameInput}
                                                            onClick={e => e.stopPropagation()}
                                                            onChange={e => setRenameInput(e.target.value)}
                                                            onKeyDown={e => {
                                                                e.stopPropagation();
                                                                if (e.key === 'Enter') handleRenameGroup(grupoNombre);
                                                                if (e.key === 'Escape') setRenamingGroup(null);
                                                            }}
                                                            className="flex-1 min-w-0 text-sm font-black text-slate-800 bg-white border border-indigo-300 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                                        />
                                                    ) : (
                                                        <div className="min-w-0 flex-1">
                                                            <span className="text-sm font-black text-slate-800 block truncate">{grupoNombre}</span>
                                                            <span className="text-xs text-slate-400 font-medium">{doneInGroup}/{tareas.length} completadas · {groupPct}%</span>
                                                        </div>
                                                    )}
                                                </button>

                                                {/* Action buttons */}
                                                <div className="flex items-center gap-2 shrink-0 ml-2">
                                                    {/* Progress bar */}
                                                    <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden hidden sm:block">
                                                        <div
                                                            className="bg-gradient-to-r from-indigo-500 to-emerald-500 h-full rounded-full transition-all duration-500"
                                                            style={{ width: `${groupPct}%` }}
                                                        />
                                                    </div>

                                                    {isManager && !isReadOnly && (
                                                        <>
                                                            {isRenaming ? (
                                                                <>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleRenameGroup(grupoNombre)}
                                                                        className="text-emerald-600 hover:text-emerald-700 p-1.5 rounded-lg hover:bg-emerald-50 transition-all"
                                                                        title="Confirmar renombrar"
                                                                    >
                                                                        <Check className="w-4 h-4" />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setRenamingGroup(null)}
                                                                        className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-all"
                                                                        title="Cancelar"
                                                                    >
                                                                        <X className="w-4 h-4" />
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => { e.stopPropagation(); handleStartRename(grupoNombre); }}
                                                                        disabled={isPending}
                                                                        title="Renombrar grupo"
                                                                        className="text-slate-300 hover:text-indigo-500 p-1.5 rounded-lg hover:bg-indigo-50 transition-all"
                                                                    >
                                                                        <Pencil className="w-3.5 h-3.5" />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteGroup(grupoNombre); }}
                                                                        disabled={isPending}
                                                                        title="Eliminar grupo completo"
                                                                        className="text-slate-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-all"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                </>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Accordion body */}
                                            {isOpen && (
                                                <div className="border-t border-slate-100 p-3 space-y-2 bg-slate-50/40">
                                                    {tareas.map(task => renderTaskRow(task))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* ── FOOTER ── */}
                    {isManager && !isReadOnly && (
                        <div className="border-t border-slate-100 bg-white shrink-0">
                            {/* Inline error */}
                            {inlineError && (
                                <div className="flex items-center gap-2 px-6 py-2.5 text-xs text-red-700 bg-red-50 border-b border-red-100">
                                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                                    <span className="flex-1 font-semibold">{inlineError}</span>
                                    <button onClick={() => setInlineError(null)} className="text-red-400 hover:text-red-600 shrink-0">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            )}

                            <div className="p-5 space-y-3">
                                {/* Group selector pills */}
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">Agregar en:</span>

                                    {/* Existing groups + always show General if no groups */}
                                    {(gruposUnicos.length > 0 ? gruposUnicos : ['General']).map(g => (
                                        <button
                                            key={g}
                                            type="button"
                                            onClick={() => { setSelectedGroup(g); setShowNewGroupInput(false); }}
                                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border truncate max-w-[160px] ${
                                                selectedGroup === g && !showNewGroupInput
                                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                                    : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                                            }`}
                                        >
                                            {g}
                                        </button>
                                    ))}

                                    {/* New group button/input */}
                                    {showNewGroupInput ? (
                                        <div className="flex items-center gap-1.5">
                                            <input
                                                autoFocus
                                                type="text"
                                                value={newGroupName}
                                                onChange={e => setNewGroupName(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Escape') { setShowNewGroupInput(false); setNewGroupName(''); }
                                                }}
                                                placeholder="Nombre del grupo..."
                                                className="px-2.5 py-1 border border-emerald-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 w-36 bg-emerald-50 placeholder:text-emerald-400"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => { setShowNewGroupInput(false); setNewGroupName(''); }}
                                                className="text-slate-400 hover:text-slate-600 w-5 h-5 flex items-center justify-center rounded hover:bg-slate-100"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => { setShowNewGroupInput(true); setNewGroupName(''); }}
                                            className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold border transition-all border-dashed border-emerald-300 text-emerald-700 hover:bg-emerald-50 ${showNewGroupInput ? 'bg-emerald-50 border-emerald-400' : ''}`}
                                        >
                                            <FolderPlus className="w-3.5 h-3.5" />
                                            Nuevo Grupo
                                        </button>
                                    )}
                                </div>

                                {/* Task input */}
                                <form onSubmit={handleAddTask} className="flex items-center gap-2">
                                    <div className="flex-1 relative">
                                        <input
                                            type="text"
                                            required
                                            placeholder={
                                                showNewGroupInput && newGroupName.trim()
                                                    ? `Nueva tarea en nuevo grupo "${newGroupName}"...`
                                                    : `Nueva tarea en "${selectedGroup}"...`
                                            }
                                            value={newTaskTitle}
                                            onChange={e => setNewTaskTitle(e.target.value)}
                                            disabled={isPending}
                                            className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-indigo-500 focus:bg-white transition-all disabled:opacity-50"
                                        />
                                        <button
                                            type="submit"
                                            disabled={isPending || !newTaskTitle.trim()}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center transition-colors disabled:opacity-50 shadow-sm"
                                        >
                                            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
