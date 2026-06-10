'use client';

// REGLAS DE DISEÑO:
// - NUNCA usar <select> nativo → siempre CustomSelect
// - NUNCA usar window.confirm / window.alert / window.prompt → siempre modal React

import Link from 'next/link';
import { useState, useTransition, useRef, useEffect } from 'react';
import {
    ArrowRight, Calendar, User, MoreVertical,
    Pencil, PauseCircle, Trash2, Loader2,
    AlertTriangle, X,
} from 'lucide-react';
import { type ProyectoEstado } from '@/types/proyectos.types';
import { actualizarEstadoProyecto, eliminarProyecto } from '../actions';
import { ProyectoFormModal, type ProyectoParaEditar } from './ProyectoFormModal';

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
    onEdit:        (p: ProyectoRow) => void;
    onDelete:      (p: ProyectoRow) => void;
}

// Helper to get initials
function getInitials(name: string) {
    return name
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
}

// ── Badge de estado ────────────────────────────────────────────────────────
function EstadoBadge({ estado }: { estado: ProyectoEstado }) {
    const config: Record<ProyectoEstado, { label: string; badgeClass: string }> = {
        planificacion: {
            label: 'Planificación',
            badgeClass: 'bg-slate-500/10 text-slate-700 border-slate-500/20',
        },
        en_progreso: {
            label: 'En Progreso',
            badgeClass: 'bg-indigo-550/10 text-indigo-700 border-indigo-500/20',
        },
        pausado: {
            label: 'Pausado',
            badgeClass: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
        },
        completado: {
            label: 'Completado',
            badgeClass: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
        },
        cancelado: {
            label: 'Cancelado',
            badgeClass: 'bg-rose-500/10 text-rose-700 border-rose-500/20',
        },
    };
    const cfg = config[estado] ?? { label: estado, badgeClass: 'bg-slate-100 text-slate-700 border-slate-200' };
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-black whitespace-nowrap border ${cfg.badgeClass}`}>
            {cfg.label}
        </span>
    );
}

function formatDate(dateStr: string | null) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Modal de confirmación de eliminación ───────────────────────────────────
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
            <div className="relative w-full max-w-sm mx-4 bg-white rounded-3xl border border-slate-100 shadow-2xl p-6 flex flex-col gap-4">
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
                        <h3 className="text-base font-black text-slate-900 font-sans">Eliminar proyecto</h3>
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

// ── Menú de 3 puntos por fila ──────────────────────────────────────────────
function RowMenu({
    proyecto,
    onEdit,
    onPause,
    onDeleteRequest,
    isLoading,
}: {
    proyecto: ProyectoRow;
    onEdit: () => void;
    onPause: () => void;
    onDeleteRequest: () => void;
    isLoading: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuRef   = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (
                menuRef.current   && !menuRef.current.contains(e.target as Node) &&
                buttonRef.current && !buttonRef.current.contains(e.target as Node)
            ) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    function handleToggle() {
        if (!open && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setMenuPos({
                top:   rect.bottom + 4,
                right: window.innerWidth - rect.right,
            });
        }
        setOpen(v => !v);
    }

    const isPausado  = proyecto.estado === 'pausado';
    const isTerminal = proyecto.estado === 'completado' || proyecto.estado === 'cancelado';

    return (
        <div className="relative">
            <button
                ref={buttonRef}
                onClick={handleToggle}
                disabled={isLoading}
                className="flex items-center justify-center w-8 h-8 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-all disabled:opacity-40 cursor-pointer"
                title="Acciones"
            >
                {isLoading
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <MoreVertical className="w-3.5 h-3.5" />
                }
            </button>

            {open && (
                <div
                    ref={menuRef}
                    style={{ top: menuPos.top, right: menuPos.right }}
                    className="fixed w-44 bg-white border border-slate-200/80 rounded-xl shadow-xl z-50 py-1 overflow-hidden animate-in fade-in duration-100"
                >
                    <button
                        onClick={() => { setOpen(false); onEdit(); }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                        <Pencil className="w-3.5 h-3.5 text-slate-400" />
                        Editar
                    </button>

                    {!isPausado && !isTerminal && (
                        <button
                            onClick={() => { setOpen(false); onPause(); }}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-amber-700 hover:bg-amber-50 transition-colors cursor-pointer"
                        >
                            <PauseCircle className="w-3.5 h-3.5 text-amber-400" />
                            Pausar
                        </button>
                    )}

                    <div className="border-t border-slate-100 my-1" />
                    <button
                        onClick={() => { setOpen(false); onDeleteRequest(); }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-red-650 hover:bg-red-50 transition-colors cursor-pointer"
                    >
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        Eliminar
                    </button>
                </div>
            )}
        </div>
    );
}

export function ProyectosTable({ proyectos, empresas, sucursales, coordinadores, onEdit, onDelete }: Props) {
    const [actionError,       setActionError]       = useState<string | null>(null);
    const [loadingId,         setLoadingId]         = useState<string | null>(null);
    const [isPending,         startTransition]       = useTransition();

    function handlePause(proyecto: ProyectoRow) {
        setActionError(null);
        setLoadingId(proyecto.id);
        startTransition(async () => {
            const result = await actualizarEstadoProyecto(proyecto.id, 'pausado');
            if (result.error) setActionError(result.error);
            setLoadingId(null);
        });
    }

    if (proyectos.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-slate-200 rounded-2xl bg-white shadow-sm">
                <p className="text-slate-400 font-semibold text-sm">Sin proyectos aún</p>
                <p className="text-slate-300 text-xs mt-1">Crea el primero con el botón de arriba</p>
            </div>
        );
    }

    return (
        <>
            {/* Error global de acción */}
            {actionError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm font-medium px-4 py-3 rounded-xl flex items-center justify-between">
                    {actionError}
                    <button onClick={() => setActionError(null)} className="ml-3 shrink-0 cursor-pointer">
                        <X className="w-4 h-4 opacity-60 hover:opacity-100" />
                    </button>
                </div>
            )}

            <div className="border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm bg-white">
                {/* Desktop table */}
                <table className="hidden md:table w-full text-sm">
                    <thead className="bg-slate-50/70 border-b border-slate-200/80">
                        <tr>
                            <th className="text-left px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Proyecto</th>
                            <th className="text-left px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>
                            <th className="text-left px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
                            <th className="text-left px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Coordinador</th>
                            <th className="text-left px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fin Est.</th>
                            <th className="w-28 px-6 py-4" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {proyectos.map((p) => (
                            <tr
                                key={p.id}
                                className={`hover:bg-slate-50/40 transition-colors group ${loadingId === p.id ? 'opacity-50' : ''}`}
                            >
                                <td className="px-6 py-5">
                                    <p className="font-black text-slate-800 truncate max-w-[260px] text-sm">{p.nombre}</p>
                                    {p.descripcion && (
                                        <p className="text-[11px] text-slate-400 truncate max-w-[260px] mt-0.5">{p.descripcion}</p>
                                    )}
                                </td>
                                <td className="px-6 py-5 text-xs">
                                    {p.cliente ? (
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="inline-block px-1.5 py-0.5 rounded-md text-[9px] font-black bg-indigo-50 border border-indigo-150/40 text-indigo-650 uppercase tracking-wider shrink-0">
                                                {p.cliente.sigla}
                                            </span>
                                            <span className="font-bold text-slate-700">{p.cliente.nombre_restaurante}</span>
                                        </div>
                                    ) : <span className="text-slate-350">—</span>}
                                </td>
                                <td className="px-6 py-5">
                                    <EstadoBadge estado={p.estado} />
                                </td>
                                <td className="px-6 py-5 text-xs">
                                    {p.coordinador?.full_name ? (
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-slate-900 border border-slate-800 text-[9px] font-black text-white flex items-center justify-center shrink-0 uppercase">
                                                {getInitials(p.coordinador.full_name)}
                                            </div>
                                            <span className="font-bold text-slate-750">{p.coordinador.full_name}</span>
                                        </div>
                                    ) : <span className="text-slate-350 italic font-medium">No asignado</span>}
                                </td>
                                <td className="px-6 py-5 text-xs">
                                    {p.fecha_fin_estimada ? (
                                        <div className="flex items-center gap-1.5 text-slate-600 font-semibold">
                                            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                            <span>{formatDate(p.fecha_fin_estimada)}</span>
                                        </div>
                                    ) : <span className="text-slate-350">—</span>}
                                </td>
                                <td className="px-6 py-5">
                                    <div className="flex items-center justify-end gap-2.5">
                                        <Link
                                            href={`/dashboard/proyectos/${p.id}`}
                                            className="flex items-center justify-center w-8 h-8 rounded-xl bg-slate-50 border border-slate-200/60 hover:bg-slate-900 hover:text-white text-slate-400 hover:border-slate-900 transition-all opacity-60 group-hover:opacity-100 shadow-sm cursor-pointer"
                                            title="Ver workspace"
                                        >
                                            <ArrowRight className="w-4 h-4" />
                                        </Link>
                                        <RowMenu
                                            proyecto={p}
                                            onEdit={() => onEdit(p)}
                                            onPause={() => handlePause(p)}
                                            onDeleteRequest={() => onDelete(p)}
                                            isLoading={loadingId === p.id}
                                        />
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Mobile cards */}
                <div className="md:hidden divide-y divide-slate-100 bg-white">
                    {proyectos.map((p) => (
                        <div key={p.id} className={`px-5 py-5 transition-opacity hover:bg-slate-50/20 ${loadingId === p.id ? 'opacity-50' : ''}`}>
                            <div className="flex items-start justify-between gap-3">
                                <Link href={`/dashboard/proyectos/${p.id}`} className="flex-1 min-w-0">
                                    <p className="font-black text-slate-800 truncate text-sm">{p.nombre}</p>
                                    {p.cliente && (
                                        <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                                            <span className="inline-block px-1.5 py-0.5 rounded-md text-[9px] font-black bg-indigo-50 border border-indigo-150/40 text-indigo-650 uppercase tracking-wider shrink-0">
                                                {p.cliente.sigla}
                                            </span>
                                            <span className="text-xs font-bold text-slate-500 truncate">{p.cliente.nombre_restaurante}</span>
                                        </div>
                                    )}
                                </Link>
                                <div className="flex items-center gap-2 shrink-0">
                                    <EstadoBadge estado={p.estado} />
                                    <RowMenu
                                        proyecto={p}
                                        onEdit={() => onEdit(p)}
                                        onPause={() => handlePause(p)}
                                        onDeleteRequest={() => onDelete(p)}
                                        isLoading={loadingId === p.id}
                                    />
                                </div>
                            </div>
                            {p.fecha_fin_estimada && (
                                <div className="text-xs text-slate-400 mt-3.5 flex items-center gap-1.5 font-semibold">
                                    <Calendar className="w-3.5 h-3.5 shrink-0" /> 
                                    <span>Fin Est: {formatDate(p.fecha_fin_estimada)}</span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
}
