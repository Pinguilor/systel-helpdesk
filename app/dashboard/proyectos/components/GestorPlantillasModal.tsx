'use client';

import { useState, useTransition, useEffect } from 'react';
import { X, Settings, Plus, Trash2, ClipboardList, Loader2, Edit2, Check } from 'lucide-react';
import { crearPlantillaChecklistAction, editarPlantillaChecklistAction, eliminarPlantillaChecklistAction } from '../actions';

interface Plantilla {
    id: string;
    nombre: string;
    tareas: string[];
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
    const [tempTareas, setTempTareas] = useState<string[]>([]);
    const [taskInput, setTaskInput] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [isOpen]);

    function handleClose() {
        setIsOpen(false);
        setNombre('');
        setTempTareas([]);
        setTaskInput('');
        setEditingId(null);
        setError(null);
    }

    function handleAddTask(e?: React.FormEvent) {
        if (e) e.preventDefault();
        const task = taskInput.trim();
        if (!task) return;
        if (tempTareas.includes(task)) {
            setError('Esta tarea ya está en la lista.');
            return;
        }
        setError(null);
        setTempTareas([...tempTareas, task]);
        setTaskInput('');
    }

    function handleRemoveTask(index: number) {
        setTempTareas(tempTareas.filter((_, i) => i !== index));
    }

    function handleLoadEdit(p: Plantilla) {
        setEditingId(p.id);
        setNombre(p.nombre);
        setTempTareas(p.tareas || []);
        setTaskInput('');
        setError(null);
    }

    function handleSave(e: React.FormEvent) {
        e.preventDefault();
        if (!nombre.trim()) {
            setError('El nombre de la plantilla es obligatorio.');
            return;
        }
        if (tempTareas.length === 0) {
            setError('Debes agregar al menos una tarea a la plantilla.');
            return;
        }

        setError(null);
        startTransition(async () => {
            let res;
            if (editingId) {
                res = await editarPlantillaChecklistAction(editingId, nombre.trim(), tempTareas);
            } else {
                res = await crearPlantillaChecklistAction(nombre.trim(), tempTareas);
            }

            if (res.error) {
                setError(res.error);
            } else {
                setNombre('');
                setTempTareas([]);
                setEditingId(null);
            }
        });
    }

    function handleDelete(id: string) {
        if (!confirm('¿Estás seguro de que deseas eliminar esta plantilla?')) return;
        setError(null);
        startTransition(async () => {
            const res = await eliminarPlantillaChecklistAction(id);
            if (res.error) {
                setError(res.error);
            }
        });
    }

    return (
        <>
            {/* Botón de Ajustes / Plantillas en la cabecera */}
            <button
                onClick={() => setIsOpen(true)}
                className="w-10 h-10 rounded-xl bg-white border border-slate-200/80 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-all flex items-center justify-center cursor-pointer shadow-sm"
                title="Gestionar Plantillas de Checklist"
            >
                <Settings className="w-4 h-4" />
            </button>

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
                            
                            {/* Left Panel: Form to Create/Edit */}
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

                                    {/* Task Inline Adder */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Tareas del Checklist</label>
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

                                    {/* Added Tasks List container */}
                                    <div className="flex-1 border border-slate-200/80 rounded-2xl bg-slate-50/40 p-4 min-h-[180px] max-h-[260px] overflow-y-auto flex flex-col gap-2">
                                        {tempTareas.length === 0 ? (
                                            <div className="flex-1 flex flex-col items-center justify-center py-10 text-center">
                                                <ClipboardList className="w-7 h-7 text-slate-200 mb-2" />
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lista vacía</p>
                                                <p className="text-[9px] text-slate-350 mt-0.5">Agrega tareas arriba para conformar la plantilla</p>
                                            </div>
                                        ) : (
                                            tempTareas.map((task, idx) => (
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
                                                onClick={() => {
                                                    setEditingId(null);
                                                    setNombre('');
                                                    setTempTareas([]);
                                                }}
                                                className="flex-1 py-2.5 border border-slate-200 text-slate-500 rounded-xl text-xs font-bold hover:bg-slate-50 cursor-pointer"
                                            >
                                                Cancelar
                                            </button>
                                        )}
                                        <button
                                            type="submit"
                                            disabled={isPending || !nombre.trim() || tempTareas.length === 0}
                                            className="flex-1 py-2.5 bg-slate-950 text-white rounded-xl text-xs font-bold hover:bg-slate-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md"
                                        >
                                            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                            {editingId ? 'Guardar Cambios' : 'Guardar Plantilla'}
                                        </button>
                                    </div>
                                </form>
                            </div>

                            {/* Right Panel: List of Saved Templates */}
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
                                        plantillas.map(p => (
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
                                                            {p.tareas?.length || 0} Tareas definidas
                                                        </p>
                                                    </div>
                                                    
                                                    {/* Row controls */}
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
                                                            className="w-7 h-7 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-red-650 flex items-center justify-center transition-colors cursor-pointer"
                                                            title="Eliminar plantilla"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Mini Tareas list preview */}
                                                <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto pb-1">
                                                    {(p.tareas || []).slice(0, 5).map((t, idx) => (
                                                        <span
                                                            key={idx}
                                                            className="inline-block px-2 py-0.5 rounded-lg bg-slate-50 border border-slate-100 text-[10px] text-slate-500 font-semibold max-w-[150px] truncate"
                                                        >
                                                            {t}
                                                        </span>
                                                    ))}
                                                    {p.tareas?.length > 5 && (
                                                        <span className="inline-block px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-150 text-[10px] text-slate-450 font-black">
                                                            +{p.tareas.length - 5}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Error and Alert display */}
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
