'use client';

import { useState, useTransition, useEffect } from 'react';
import { List, LayoutGrid, FolderKanban, Clock, UserCheck, AlertTriangle, X, Loader2 } from 'lucide-react';
import { type ProyectoEstado } from '@/types/proyectos.types';
import { ProyectosTable } from './ProyectosTable';
import { KanbanBoard } from './KanbanBoard';
import { ProyectoFormModal, type ProyectoParaEditar } from './ProyectoFormModal';
import { eliminarProyecto } from '../actions';

type ProyectoRow = {
    id: string;
    nombre: string;
    descripcion: string | null;
    estado: ProyectoEstado;
    cliente_id: string | null;
    coordinador_id: string | null;
    fecha_inicio: string | null;
    fecha_fin_estimada: string | null;
    cliente: { nombre_restaurante: string; sigla: string } | null;
    coordinador: { full_name: string | null } | null;
};

interface Empresa     { id: string; nombre_fantasia: string }
interface Sucursal    { id: string; nombre_restaurante: string; sigla: string; cliente_id: string | null }
interface Coordinador { id: string; full_name: string | null }

interface Props {
    proyectos:     ProyectoRow[];
    empresas:      Empresa[];
    sucursales:    Sucursal[];
    coordinadores: Coordinador[];
}

// ── Modal de confirmación de eliminación unificado ─────────────────────────
function DeleteConfirmModal({
    proyecto,
    onConfirm,
    onCancel,
    isPending,
}: {
    proyecto: ProyectoRow;
    onConfirm: () => void;
    onCancel: () => void;
    isPending: boolean;
}) {
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onCancel]);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
        >
            <div className="relative w-full max-w-sm mx-4 bg-white rounded-3xl border border-slate-100 shadow-2xl p-6 flex flex-col gap-4 font-sans">
                <button
                    onClick={onCancel}
                    className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors cursor-pointer"
                >
                    <X className="w-4 h-4 text-slate-500" />
                </button>

                <div className="flex items-start gap-3 pr-6">
                    <div className="shrink-0 w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center mt-0.5">
                        <AlertTriangle className="w-5 h-5 text-red-650" strokeWidth={2} />
                    </div>
                    <div>
                        <h3 className="text-base font-black text-slate-900">Eliminar proyecto</h3>
                        <p className="text-xs text-slate-400 mt-0.5">Esta acción no se puede deshacer.</p>
                    </div>
                </div>

                <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-3">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Proyecto</p>
                    <p className="text-sm font-bold text-slate-800 truncate">{proyecto.nombre}</p>
                    {proyecto.cliente && (
                        <p className="text-xs text-slate-500 mt-0.5 font-semibold">
                            [{proyecto.cliente.sigla}] {proyecto.cliente.nombre_restaurante}
                        </p>
                    )}
                </div>

                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                    Se eliminarán permanentemente el proyecto y todos sus datos asociados
                    (bitácora, firmas, BOM e historial de movimientos).
                </p>

                <div className="flex gap-3 pt-1">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={isPending}
                        className="flex-1 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isPending}
                        className="flex-1 py-2.5 bg-red-650 text-white rounded-xl text-xs font-bold hover:bg-red-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                    >
                        {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        {isPending ? 'Eliminando...' : 'Sí, eliminar'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export function ProyectosDashboardView({ proyectos, empresas, sucursales, coordinadores }: Props) {
    const [vista, setVista] = useState<'list' | 'board'>('list');
    const [editingProyecto, setEditingProyecto] = useState<ProyectoParaEditar | null>(null);
    const [proyectoToDelete, setProyectoToDelete] = useState<ProyectoRow | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [isDeletePending, startDeleteTransition] = useTransition();

    // Persist active view preference in localStorage
    useEffect(() => {
        const savedVista = localStorage.getItem('proyectos-dashboard-vista');
        if (savedVista === 'list' || savedVista === 'board') {
            setVista(savedVista);
        }
    }, []);

    function handleSetVista(newVista: 'list' | 'board') {
        setVista(newVista);
        localStorage.setItem('proyectos-dashboard-vista', newVista);
    }

    function handleEdit(p: ProyectoRow) {
        setEditingProyecto({
            id:                 p.id,
            nombre:             p.nombre,
            descripcion:        p.descripcion,
            cliente_id:         p.cliente_id,
            coordinador_id:     p.coordinador_id,
            fecha_inicio:       p.fecha_inicio,
            fecha_fin_estimada: p.fecha_fin_estimada,
        });
    }

    function handleDeleteConfirm() {
        if (!proyectoToDelete) return;
        setActionError(null);
        startDeleteTransition(async () => {
            const result = await eliminarProyecto(proyectoToDelete.id);
            if (result.error) {
                setActionError(result.error);
            } else {
                setProyectoToDelete(null);
            }
        });
    }

    // Dynamic metrics calculation
    const totales = {
        total:       proyectos.length,
        en_progreso: proyectos.filter(p => p.estado === 'en_progreso').length,
        completados: proyectos.filter(p => p.estado === 'completado').length,
    };

    return (
        <div className="space-y-6">
            {/* ── Switcher de Vista y Métricas ──────────────────────────────── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Métricas rápidas (Glassmorphic Redesign) */}
                {totales.total > 0 && (
                    <div className="grid grid-cols-3 gap-3 md:gap-5 flex-1 max-w-3xl">
                        {/* Total Projects */}
                        <div className="relative group bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm transition-all duration-300 hover:shadow-md">
                            <div className="flex items-center justify-between">
                                <div className="min-w-0">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">Total</p>
                                    <p className="text-xl md:text-2xl font-black text-slate-800 mt-1">{totales.total}</p>
                                </div>
                                <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 hidden sm:flex">
                                    <FolderKanban className="w-4 h-4 text-slate-505" />
                                </div>
                            </div>
                        </div>

                        {/* In Progress */}
                        <div className="relative group bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm transition-all duration-300 hover:shadow-md">
                            <div className="flex items-center justify-between">
                                <div className="min-w-0">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">En Progreso</p>
                                    <p className="text-xl md:text-2xl font-black text-indigo-650 mt-1">{totales.en_progreso}</p>
                                </div>
                                <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100/50 flex items-center justify-center shrink-0 hidden sm:flex">
                                    <Clock className="w-4 h-4 text-indigo-500" />
                                </div>
                            </div>
                        </div>

                        {/* Completed */}
                        <div className="relative group bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm transition-all duration-300 hover:shadow-md">
                            <div className="flex items-center justify-between">
                                <div className="min-w-0">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">Completados</p>
                                    <p className="text-xl md:text-2xl font-black text-emerald-700 mt-1">{totales.completados}</p>
                                </div>
                                <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100/50 flex items-center justify-center shrink-0 hidden sm:flex">
                                    <UserCheck className="w-4 h-4 text-emerald-600" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Vista Switcher */}
                <div className="flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/50 self-end md:self-center shrink-0 font-sans shadow-inner">
                    <button
                        onClick={() => handleSetVista('list')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                            vista === 'list'
                                ? 'bg-white text-slate-800 shadow-sm border border-slate-200/20'
                                : 'text-slate-400 hover:text-slate-650'
                        }`}
                    >
                        <List className="w-3.5 h-3.5" />
                        Lista
                    </button>
                    <button
                        onClick={() => handleSetVista('board')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                            vista === 'board'
                                ? 'bg-white text-slate-800 shadow-sm border border-slate-200/20'
                                : 'text-slate-400 hover:text-slate-650'
                        }`}
                    >
                        <LayoutGrid className="w-3.5 h-3.5" />
                        Tablero
                    </button>
                </div>
            </div>

            {/* Error global de acción */}
            {actionError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm font-medium px-4 py-3 rounded-xl flex items-center justify-between font-sans">
                    {actionError}
                    <button onClick={() => setActionError(null)} className="ml-3 shrink-0 cursor-pointer">
                        <X className="w-4 h-4 opacity-60 hover:opacity-100" />
                    </button>
                </div>
            )}

            {/* ── Renderizado Condicional de Vistas ─────────────────────────── */}
            {vista === 'list' ? (
                <ProyectosTable
                    proyectos={proyectos}
                    empresas={empresas}
                    sucursales={sucursales}
                    coordinadores={coordinadores}
                    onEdit={handleEdit}
                    onDelete={setProyectoToDelete}
                />
            ) : (
                <KanbanBoard
                    proyectos={proyectos}
                    onEdit={handleEdit}
                    onDelete={setProyectoToDelete}
                />
            )}

            {/* Modal de Edición Unificado */}
            <ProyectoFormModal
                empresas={empresas}
                sucursales={sucursales}
                coordinadores={coordinadores}
                proyectoToEdit={editingProyecto}
                isOpen={!!editingProyecto}
                onClose={() => setEditingProyecto(null)}
            />

            {/* Modal de Confirmación de Eliminación Unificado */}
            {proyectoToDelete && (
                <DeleteConfirmModal
                    proyecto={proyectoToDelete}
                    onConfirm={handleDeleteConfirm}
                    onCancel={() => setProyectoToDelete(null)}
                    isPending={isDeletePending}
                />
            )}
        </div>
    );
}
