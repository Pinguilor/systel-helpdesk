'use client';

import { useState, useTransition, useEffect } from 'react';
import {
    X, Settings, Plus, Trash2, ClipboardList, Loader2, Edit2, Check,
    FolderPlus, ChevronDown, AlertTriangle,
} from 'lucide-react';
import {
    crearPlantillaChecklistAction,
    editarPlantillaChecklistAction,
    eliminarPlantillaChecklistAction,
    type GrupoPlantilla,
} from '../actions';

interface Plantilla {
    id: string;
    nombre: string;
    tareas: string[];
    grupos: GrupoPlantilla[] | null;
    created_at: string;
}

interface Props {
    plantillas: Plantilla[];
}

export function GestorPlantillasModal({ plantillas }: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const [isPending, startTransition] = useTransition();

    // Form states
    const [nombre, setNombre] = useState('');
    const [tempGrupos, setTempGrupos] = useState<GrupoPlantilla[]>([{ nombre: 'General', tareas: [] }]);
    const [activeGrupoIdx, setActiveGrupoIdx] = useState(0);
    const [taskInput, setTaskInput] = useState('');
    const [grupoInput, setGrupoInput] = useState('');
    const [showGrupoInput, setShowGrupoInput] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [isOpen]);

    function handleClose() {
        setIsOpen(false);
        resetForm();
    }

    function resetForm() {
        setNombre('');
        setTempGrupos([{ nombre: 'General', tareas: [] }]);
        setActiveGrupoIdx(0);
        setTaskInput('');
        setGrupoInput('');
        setShowGrupoInput(false);
        setEditingId(null);
        setError(null);
    }

    // --- Group management ---

    function handleAddGrupo(e?: React.FormEvent) {
        if (e) e.preventDefault();
        const g = grupoInput.trim();
        if (!g) return;
        if (tempGrupos.some(gr => gr.nombre.toLowerCase() === g.toLowerCase())) {
            setError('Ya existe un grupo con ese nombre.');
            return;
        }
        setError(null);
        const newGrupos = [...tempGrupos, { nombre: g, tareas: [] }];
        setTempGrupos(newGrupos);
        setActiveGrupoIdx(newGrupos.length - 1);
        setGrupoInput('');
        setShowGrupoInput(false);
    }

    function handleRemoveGrupo(idx: number) {
        if (tempGrupos.length === 1) {
            setError('Debe existir al menos un grupo en la plantilla.');
            return;
        }
        const newGrupos = tempGrupos.filter((_, i) => i !== idx);
        setTempGrupos(newGrupos);
        setActiveGrupoIdx(Math.min(activeGrupoIdx, newGrupos.length - 1));
    }

    // --- Task management (within active group) ---

    function handleAddTask(e?: React.FormEvent) {
        if (e) e.preventDefault();
        const task = taskInput.trim();
        if (!task) return;
        const activeGrupo = tempGrupos[activeGrupoIdx];
        if (activeGrupo.tareas.includes(task)) {
            setError('Esta tarea ya está en el grupo.');
            return;
        }
        setError(null);
        setTempGrupos(tempGrupos.map((g, i) =>
            i === activeGrupoIdx ? { ...g, tareas: [...g.tareas, task] } : g
        ));
        setTaskInput('');
    }

    function handleRemoveTask(taskIdx: number) {
        setTempGrupos(tempGrupos.map((g, i) =>
            i === activeGrupoIdx ? { ...g, tareas: g.tareas.filter((_, ti) => ti !== taskIdx) } : g
        ));
    }

    // --- Load template for editing ---

    function handleLoadEdit(p: Plantilla) {
        setEditingId(p.id);
        setNombre(p.nombre);
        if (p.grupos && Array.isArray(p.grupos) && p.grupos.length > 0) {
            setTempGrupos(p.grupos);
        } else {
            // Legacy flat template: wrap in a single "General" group
            setTempGrupos([{ nombre: 'General', tareas: p.tareas || [] }]);
        }
        setActiveGrupoIdx(0);
        setTaskInput('');
        setGrupoInput('');
        setShowGrupoInput(false);
        setError(null);
    }

    // --- Save ---

    function handleSave(e: React.FormEvent) {
        e.preventDefault();
        if (!nombre.trim()) {
            setError('El nombre de la plantilla es obligatorio.');
            return;
        }
        const totalTareas = tempGrupos.reduce((acc, g) => acc + g.tareas.length, 0);
        if (totalTareas === 0) {
            setError('Debes agregar al menos una tarea a la plantilla.');
            return;
        }
        setError(null);
        const allTareas = tempGrupos.flatMap(g => g.tareas);

        startTransition(async () => {
            let res;
            if (editingId) {
                res = await editarPlantillaChecklistAction(editingId, nombre.trim(), allTareas, tempGrupos);
            } else {
                res = await crearPlantillaChecklistAction(nombre.trim(), allTareas, tempGrupos);
            }

            if (res.error) {
                setError(res.error);
            } else {
                resetForm();
            }
        });
    }

    // --- Delete (custom modal) ---

    function handleDelete(id: string) {
        setConfirmDeleteId(id);
    }

    function handleConfirmDelete() {
        const id = confirmDeleteId;
        if (!id) return;
        setConfirmDeleteId(null);
        setError(null);
        startTransition(async () => {
            const res = await eliminarPlantillaChecklistAction(id);
            if (res.error) setError(res.error);
        });
    }

    const activeGrupo = tempGrupos[activeGrupoIdx] ?? tempGrupos[0];
    const totalTareas = tempGrupos.reduce((acc, g) => acc + g.tareas.length, 0);

    return (
        <>
            {/* Trigger button */}
            <button
                onClick={() => setIsOpen(true)}
                className="w-10 h-10 rounded-xl bg-white border border-slate-200/80 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-all flex items-center justify-center cursor-pointer shadow-sm"
                title="Gestionar Plantillas de Checklist"
            >
                <Settings className="w-4 h-4" />
            </button>

            {/* Confirm delete modal */}
            {confirmDeleteId && (
                <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center px-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                                <AlertTriangle className="w-5 h-5 text-red-600" />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-slate-900">Eliminar plantilla</h3>
                                <p className="text-xs text-slate-500 mt-0.5">Esta acción no se puede deshacer.</p>
                            </div>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmDelete}
                                disabled={isPending}
                                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-black hover:bg-red-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm font-sans select-none">
                    <div
                        className="relative w-full max-w-4xl mx-4 bg-white rounded-3xl border border-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-slate-950 flex items-center justify-center shrink-0 shadow-md">
                                    <ClipboardList className="w-5 h-5 text-white" strokeWidth={1.75} />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-slate-900">Plantillas de Checklist</h3>
                                    <p className="text-xs text-slate-400 mt-0.5">Estandarización y carga masiva de tareas para proyectos</p>
                                </div>
                            </div>
                            <button
                                onClick={handleClose}
                                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors cursor-pointer"
                            >
                                <X className="w-4 h-4 text-slate-500" />
                            </button>
                        </div>

                        {/* Body - Grid Layout */}
                        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6 min-h-0">

                            {/* Left Panel: Form */}
                            <div className="flex flex-col gap-4 border-r border-slate-100 pr-0 md:pr-6">
                                <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">
                                    {editingId ? 'Editar Plantilla Maestra' : 'Crear Nueva Plantilla'}
                                </h4>

                                <form onSubmit={handleSave} className="space-y-4 flex flex-col flex-1">
                                    {/* Template Name */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Nombre de Plantilla</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="Ej: Apertura de Local Standard"
                                            value={nombre}
                                            onChange={e => setNombre(e.target.value)}
                                            className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/10 placeholder:text-slate-400 bg-slate-50"
                                        />
                                    </div>

                                    {/* Groups tabs */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Grupos</label>
                                        <div className="flex flex-wrap gap-1.5 items-center">
                                            {tempGrupos.map((g, idx) => (
                                                <div key={idx} className="flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => setActiveGrupoIdx(idx)}
                                                        className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${
                                                            activeGrupoIdx === idx
                                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                                                : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                                                        }`}
                                                    >
                                                        {g.nombre}
                                                        {g.tareas.length > 0 && (
                                                            <span className={`ml-1.5 text-[9px] px-1 py-0.5 rounded ${activeGrupoIdx === idx ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                                                {g.tareas.length}
                                                            </span>
                                                        )}
                                                    </button>
                                                    {tempGrupos.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveGrupo(idx)}
                                                            className="w-4 h-4 rounded-full text-slate-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors"
                                                            title="Eliminar grupo"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                            {showGrupoInput ? (
                                                <div className="flex items-center gap-1">
                                                    <input
                                                        autoFocus
                                                        type="text"
                                                        value={grupoInput}
                                                        onChange={e => setGrupoInput(e.target.value)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') { e.preventDefault(); handleAddGrupo(); }
                                                            if (e.key === 'Escape') { setShowGrupoInput(false); setGrupoInput(''); }
                                                        }}
                                                        placeholder="Nombre del grupo..."
                                                        className="px-2 py-1 border border-indigo-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 w-32 bg-indigo-50"
                                                    />
                                                    <button type="button" onClick={() => handleAddGrupo()} className="w-5 h-5 rounded bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700">
                                                        <Check className="w-3 h-3" />
                                                    </button>
                                                    <button type="button" onClick={() => { setShowGrupoInput(false); setGrupoInput(''); }} className="w-5 h-5 rounded bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200">
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => setShowGrupoInput(true)}
                                                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-dashed border-emerald-300 text-emerald-700 hover:bg-emerald-50 text-xs font-bold transition-all"
                                                >
                                                    <FolderPlus className="w-3 h-3" />
                                                    Nuevo
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Task input for active group */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                                            Tareas de &ldquo;{activeGrupo?.nombre}&rdquo;
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="Ej: Montar Rack de Telecomunicaciones"
                                                value={taskInput}
                                                onChange={e => setTaskInput(e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTask(); } }}
                                                className="flex-1 px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/10 placeholder:text-slate-400 bg-slate-50"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleAddTask()}
                                                className="px-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black transition-colors flex items-center justify-center cursor-pointer shrink-0 shadow-sm"
                                            >
                                                <Plus className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Task list for active group */}
                                    <div className="flex-1 border border-slate-200/80 rounded-2xl bg-slate-50/40 p-4 min-h-[140px] max-h-[220px] overflow-y-auto flex flex-col gap-2">
                                        {activeGrupo?.tareas.length === 0 ? (
                                            <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
                                                <ClipboardList className="w-7 h-7 text-slate-200 mb-2" />
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sin tareas aún</p>
                                                <p className="text-[9px] text-slate-350 mt-0.5">Agrega tareas al grupo &ldquo;{activeGrupo?.nombre}&rdquo;</p>
                                            </div>
                                        ) : (
                                            activeGrupo?.tareas.map((task, idx) => (
                                                <div key={idx} className="flex justify-between items-center gap-2 bg-white border border-slate-150/40 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 shadow-sm group">
                                                    <span className="truncate flex-1">{task}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveTask(idx)}
                                                        className="text-slate-300 hover:text-red-500 transition-colors p-1"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex gap-3 pt-2">
                                        {editingId && (
                                            <button
                                                type="button"
                                                onClick={resetForm}
                                                className="flex-1 py-2.5 border border-slate-200 text-slate-500 rounded-xl text-xs font-bold hover:bg-slate-50 cursor-pointer"
                                            >
                                                Cancelar
                                            </button>
                                        )}
                                        <button
                                            type="submit"
                                            disabled={isPending || !nombre.trim() || totalTareas === 0}
                                            className="flex-1 py-2.5 bg-slate-950 text-white rounded-xl text-xs font-bold hover:bg-slate-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md"
                                        >
                                            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                            {editingId ? 'Guardar Cambios' : 'Guardar Plantilla'}
                                        </button>
                                    </div>
                                </form>
                            </div>

                            {/* Right Panel: Saved templates list */}
                            <div className="flex flex-col gap-4">
                                <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">
                                    Plantillas Guardadas ({plantillas.length})
                                </h4>

                                <div className="flex-1 border border-slate-200/80 rounded-3xl bg-slate-50/20 p-4 overflow-y-auto max-h-[460px] flex flex-col gap-3 min-h-[220px]">
                                    {plantillas.length === 0 ? (
                                        <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
                                            <ClipboardList className="w-10 h-10 text-slate-200 mb-3" />
                                            <p className="text-slate-400 font-bold text-sm">Sin plantillas aún</p>
                                            <p className="text-slate-350 text-xs mt-1">Crea la primera completando el formulario de la izquierda</p>
                                        </div>
                                    ) : (
                                        plantillas.map(p => {
                                            const grupos = (p.grupos && p.grupos.length > 0) ? p.grupos : null;
                                            const tareasCount = grupos
                                                ? grupos.reduce((acc, g) => acc + g.tareas.length, 0)
                                                : (p.tareas?.length || 0);

                                            return (
                                                <div
                                                    key={p.id}
                                                    className={`bg-white border p-4 rounded-2xl flex flex-col justify-between gap-3 shadow-sm hover:shadow-md transition-all duration-200 ${
                                                        editingId === p.id ? 'border-indigo-400 ring-2 ring-indigo-50' : 'border-slate-200/80'
                                                    }`}
                                                >
                                                    <div className="flex justify-between items-start gap-3">
                                                        <div className="min-w-0">
                                                            <h5 className="font-bold text-slate-800 text-sm leading-snug">{p.nombre}</h5>
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 tracking-wider">
                                                                {grupos ? `${grupos.length} grupo${grupos.length !== 1 ? 's' : ''} · ` : ''}{tareasCount} tarea{tareasCount !== 1 ? 's' : ''}
                                                            </p>
                                                        </div>

                                                        <div className="flex gap-1.5 shrink-0">
                                                            <button
                                                                onClick={() => handleLoadEdit(p)}
                                                                className="w-7 h-7 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                                                                title="Editar plantilla"
                                                            >
                                                                <Edit2 className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(p.id)}
                                                                className="w-7 h-7 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 flex items-center justify-center transition-colors cursor-pointer"
                                                                title="Eliminar plantilla"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Groups preview */}
                                                    {grupos ? (
                                                        <div className="space-y-1">
                                                            {grupos.slice(0, 3).map((g, gi) => (
                                                                <div key={gi} className="flex items-center gap-2">
                                                                    <ChevronDown className="w-3 h-3 text-slate-300 shrink-0" />
                                                                    <span className="text-[10px] font-bold text-slate-600 truncate">{g.nombre}</span>
                                                                    <span className="text-[9px] text-slate-400 shrink-0">{g.tareas.length} tareas</span>
                                                                </div>
                                                            ))}
                                                            {grupos.length > 3 && (
                                                                <p className="text-[9px] text-slate-400 pl-5">+{grupos.length - 3} grupos más</p>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-wrap gap-1 max-h-14 overflow-y-auto pb-1">
                                                            {(p.tareas || []).slice(0, 5).map((t, idx) => (
                                                                <span key={idx} className="inline-block px-2 py-0.5 rounded-lg bg-slate-50 border border-slate-100 text-[10px] text-slate-500 font-semibold max-w-[150px] truncate">
                                                                    {t}
                                                                </span>
                                                            ))}
                                                            {(p.tareas?.length || 0) > 5 && (
                                                                <span className="inline-block px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-150 text-[10px] text-slate-450 font-black">
                                                                    +{p.tareas!.length - 5}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Error display */}
                        {error && (
                            <div className="bg-red-50 border-t border-red-200 px-6 py-3 text-red-700 text-xs font-semibold flex items-center justify-between shrink-0 font-sans">
                                <span>{error}</span>
                                <button onClick={() => setError(null)} className="shrink-0 cursor-pointer">
                                    <X className="w-3.5 h-3.5 opacity-60 hover:opacity-100" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
