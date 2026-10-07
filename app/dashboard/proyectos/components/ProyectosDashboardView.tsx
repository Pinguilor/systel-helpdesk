'use client';

import { useState, useTransition, useEffect, useMemo, useRef } from 'react';
import { List, LayoutGrid, FolderKanban, Clock, UserCheck, AlertTriangle, X, Loader2, Search, ChevronDown, Check } from 'lucide-react';
import { type ProyectoEstado, PROYECTO_ESTADO_CONFIG } from '@/types/proyectos.types';
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

// ── Normalización para búsqueda sin tildes ni mayúsculas ──────────────────
const norm = (v: string | null | undefined) =>
    (v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// ── Combobox de coordinador ────────────────────────────────────────────────
function CoordinadorCombobox({
    options, value, onChange,
}: {
    options: { id: string; nombre: string }[];
    value: string | null;
    onChange: (id: string | null) => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const actual = options.find(o => o.id === value);

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className={`flex items-center gap-2 px-3.5 py-2 border rounded-xl text-xs font-bold transition-colors cursor-pointer bg-white ${
                    actual ? 'border-slate-900 text-slate-900' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
            >
                <UserCheck className="w-3.5 h-3.5" />
                <span className="max-w-[140px] truncate">{actual ? actual.nombre : 'Coordinador'}</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-60" />
            </button>
            {open && (
                <div className="absolute left-0 top-full mt-1 w-56 bg-white border border-slate-200 rounded-xl shadow-lg z-30 max-h-60 overflow-y-auto py-1">
                    <button
                        type="button"
                        onClick={() => { onChange(null); setOpen(false); }}
                        className="w-full text-left px-3.5 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 flex items-center justify-between cursor-pointer"
                    >
                        Todos los coordinadores
                        {!value && <Check className="w-3.5 h-3.5 text-slate-900" />}
                    </button>
                    {options.map(o => (
                        <button
                            key={o.id}
                            type="button"
                            onClick={() => { onChange(o.id); setOpen(false); }}
                            className="w-full text-left px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center justify-between gap-2 cursor-pointer"
                        >
                            <span className="truncate">{o.nombre}</span>
                            {value === o.id && <Check className="w-3.5 h-3.5 text-slate-900 shrink-0" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export function ProyectosDashboardView({ proyectos, empresas, sucursales, coordinadores }: Props) {
    const [vista, setVista] = useState<'list' | 'board'>('list');
    const [editingProyecto, setEditingProyecto] = useState<ProyectoParaEditar | null>(null);
    const [proyectoToDelete, setProyectoToDelete] = useState<ProyectoRow | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [isDeletePending, startDeleteTransition] = useTransition();

    // Búsqueda y filtros
    const [busqueda, setBusqueda] = useState('');
    const [estadoFiltro, setEstadoFiltro] = useState<ProyectoEstado | null>(null);
    const [coordFiltro, setCoordFiltro] = useState<string | null>(null);

    const coordinadoresOpts = useMemo(() => {
        const m = new Map<string, string>();
        proyectos.forEach(p => {
            if (p.coordinador_id) m.set(p.coordinador_id, p.coordinador?.full_name ?? 'Sin nombre');
        });
        return [...m.entries()]
            .map(([id, nombre]) => ({ id, nombre }))
            .sort((a, b) => a.nombre.localeCompare(b.nombre));
    }, [proyectos]);

    const conteoEstados = useMemo(() => {
        const c: Partial<Record<ProyectoEstado, number>> = {};
        proyectos.forEach(p => { c[p.estado] = (c[p.estado] ?? 0) + 1; });
        return c;
    }, [proyectos]);

    // Búsqueda de texto + estado + coordinador (se combinan con AND)
    const proyectosFiltrados = useMemo(() => {
        const q = norm(busqueda.trim());
        return proyectos.filter(p => {
            if (estadoFiltro && p.estado !== estadoFiltro) return false;
            if (coordFiltro && p.coordinador_id !== coordFiltro) return false;
            if (!q) return true;
            return [
                p.nombre, p.descripcion,
                p.cliente?.sigla, p.cliente?.nombre_restaurante,
                p.coordinador?.full_name,
            ].some(campo => norm(campo).includes(q));
        });
    }, [proyectos, busqueda, estadoFiltro, coordFiltro]);

    const hayFiltros = !!(busqueda.trim() || estadoFiltro || coordFiltro);
    function limpiarFiltros() { setBusqueda(''); setEstadoFiltro(null); setCoordFiltro(null); }

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

            {/* ── Buscador y filtros ───────────────────────────────────────── */}
            {proyectos.length > 0 && (
                <div className="space-y-3 font-sans">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={busqueda}
                                onChange={e => setBusqueda(e.target.value)}
                                placeholder="Buscar por proyecto, local, sigla o coordinador..."
                                className="w-full pl-10 pr-9 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/10 placeholder:text-slate-400 bg-white"
                            />
                            {busqueda && (
                                <button
                                    type="button"
                                    onClick={() => setBusqueda('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                                    title="Limpiar búsqueda"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                        {coordinadoresOpts.length > 1 && (
                            <CoordinadorCombobox options={coordinadoresOpts} value={coordFiltro} onChange={setCoordFiltro} />
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setEstadoFiltro(null)}
                            className={`px-3 py-1.5 rounded-full text-[11px] font-black border transition-colors cursor-pointer ${
                                !estadoFiltro ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                            }`}
                        >
                            Todos ({proyectos.length})
                        </button>
                        {(Object.keys(PROYECTO_ESTADO_CONFIG) as ProyectoEstado[]).map(est => {
                            const cnt = conteoEstados[est] ?? 0;
                            if (cnt === 0 && estadoFiltro !== est) return null;
                            const activo = estadoFiltro === est;
                            return (
                                <button
                                    key={est}
                                    type="button"
                                    onClick={() => setEstadoFiltro(activo ? null : est)}
                                    className={`px-3 py-1.5 rounded-full text-[11px] font-black border transition-colors cursor-pointer ${
                                        activo ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                    }`}
                                >
                                    {PROYECTO_ESTADO_CONFIG[est].label} ({cnt})
                                </button>
                            );
                        })}
                        {hayFiltros && (
                            <>
                                <span className="text-[11px] font-semibold text-slate-400 ml-1">
                                    {proyectosFiltrados.length} de {proyectos.length} proyectos
                                </span>
                                <button
                                    type="button"
                                    onClick={limpiarFiltros}
                                    className="text-[11px] font-black text-indigo-600 hover:text-indigo-800 underline underline-offset-2 cursor-pointer"
                                >
                                    Limpiar filtros
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

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
            {hayFiltros && proyectosFiltrados.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 font-sans">
                    <Search className="w-8 h-8 text-slate-300 mb-3" strokeWidth={1.5} />
                    <p className="text-slate-500 font-bold text-sm">Ningún proyecto coincide con los filtros</p>
                    <button
                        type="button"
                        onClick={limpiarFiltros}
                        className="mt-2 text-xs font-black text-indigo-600 hover:text-indigo-800 underline underline-offset-2 cursor-pointer"
                    >
                        Limpiar filtros
                    </button>
                </div>
            ) : vista === 'list' ? (
                <ProyectosTable
                    proyectos={proyectosFiltrados}
                    empresas={empresas}
                    sucursales={sucursales}
                    coordinadores={coordinadores}
                    onEdit={handleEdit}
                    onDelete={setProyectoToDelete}
                />
            ) : (
                <KanbanBoard
                    proyectos={proyectosFiltrados}
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
