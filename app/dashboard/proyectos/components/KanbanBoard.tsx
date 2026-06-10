'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import {
    Calendar, ArrowRight, Clock, AlertCircle,
    MoreVertical, Pencil, PauseCircle, Trash2, Loader2
} from 'lucide-react';
import { type ProyectoEstado } from '@/types/proyectos.types';
import { actualizarEstadoProyecto } from '../actions';

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

interface Props {
    proyectos: ProyectoRow[];
    onEdit: (p: ProyectoRow) => void;
    onDelete: (p: ProyectoRow) => void;
}

const COLUMNS: { id: ProyectoEstado; label: string; dotClass: string; headerClass: string; bgClass: string }[] = [
    {
        id: 'planificacion',
        label: 'Planificación',
        dotClass: 'bg-slate-450',
        headerClass: 'text-slate-700 bg-slate-100/60 border-slate-200/50',
        bgClass: 'bg-slate-50/50 border-slate-100',
    },
    {
        id: 'en_progreso',
        label: 'En Progreso',
        dotClass: 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)] animate-pulse',
        headerClass: 'text-indigo-750 bg-indigo-50/60 border-indigo-100/40',
        bgClass: 'bg-indigo-50/[0.15] border-indigo-100/30',
    },
    {
        id: 'pausado',
        label: 'Pausado',
        dotClass: 'bg-amber-500',
        headerClass: 'text-amber-700 bg-amber-50/60 border-amber-100/40',
        bgClass: 'bg-amber-50/[0.15] border-amber-100/30',
    },
    {
        id: 'completado',
        label: 'Completado',
        dotClass: 'bg-emerald-500',
        headerClass: 'text-emerald-700 bg-emerald-50/60 border-emerald-100/40',
        bgClass: 'bg-emerald-50/[0.15] border-emerald-100/30',
    },
];

function getInitials(name: string) {
    return name
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
}

function formatDate(dateStr: string | null) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}

function isRetrasado(fechaFinStr: string | null, estado: string) {
    if (!fechaFinStr || estado === 'completado' || estado === 'cancelado') return false;
    const fin = new Date(fechaFinStr);
    const hoy = new Date();
    fin.setHours(0, 0, 0, 0);
    hoy.setHours(0, 0, 0, 0);
    return fin < hoy;
}

// ── Menú de 3 puntos en Tarjeta ───────────────────────────────────────────
function CardMenu({
    proyecto,
    onEdit,
    onPause,
    onDelete,
}: {
    proyecto: ProyectoRow;
    onEdit: () => void;
    onPause: () => void;
    onDelete: () => void;
}) {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (!open) return;
        const handler = () => setOpen(false);
        document.addEventListener('click', handler);
        return () => document.removeEventListener('click', handler);
    }, [open]);

    const isPausado = proyecto.estado === 'pausado';
    const isTerminal = proyecto.estado === 'completado' || proyecto.estado === 'cancelado';

    return (
        <div className="relative" onClick={e => e.stopPropagation()}>
            <button
                onClick={() => setOpen(!open)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-650 flex items-center justify-center transition-colors cursor-pointer"
            >
                <MoreVertical className="w-3.5 h-3.5" />
            </button>
            {open && (
                <div className="absolute right-0 mt-1 w-36 bg-white border border-slate-200/80 rounded-xl shadow-lg z-30 py-1 font-sans">
                    <button
                        onClick={() => { setOpen(false); onEdit(); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer text-left"
                    >
                        <Pencil className="w-3 h-3 text-slate-400" />
                        Editar
                    </button>
                    {!isPausado && !isTerminal && (
                        <button
                            onClick={() => { setOpen(false); onPause(); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 transition-colors cursor-pointer text-left"
                        >
                            <PauseCircle className="w-3 h-3 text-amber-400" />
                            Pausar
                        </button>
                    )}
                    <div className="border-t border-slate-100 my-1" />
                    <button
                        onClick={() => { setOpen(false); onDelete(); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors cursor-pointer text-left"
                    >
                        <Trash2 className="w-3 h-3 text-red-400" />
                        Eliminar
                    </button>
                </div>
            )}
        </div>
    );
}

export function KanbanBoard({ proyectos, onEdit, onDelete }: Props) {
    const [isMounted, setIsMounted] = useState(false);
    const [localProyectos, setLocalProyectos] = useState<ProyectoRow[]>(proyectos);
    const [movingId, setMovingId] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Keep local state in sync when server props update
    useEffect(() => {
        setLocalProyectos(proyectos);
    }, [proyectos]);

    if (!isMounted) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-pulse">
                {[1, 2, 3, 4].map(idx => (
                    <div key={idx} className="bg-slate-50 border border-slate-100 rounded-2xl p-4 h-96" />
                ))}
            </div>
        );
    }

    async function handleDragEnd(result: DropResult) {
        const { destination, source, draggableId } = result;
        if (!destination) return;

        // If dropped in the same position
        if (destination.droppableId === source.droppableId && destination.index === source.index) {
            return;
        }

        const targetEstado = destination.droppableId as ProyectoEstado;

        // Optimistic UI update
        const updated = localProyectos.map(p => {
            if (p.id === draggableId) {
                return { ...p, estado: targetEstado };
            }
            return p;
        });
        setLocalProyectos(updated);

        // Call Server Action
        setMovingId(draggableId);
        startTransition(async () => {
            const res = await actualizarEstadoProyecto(draggableId, targetEstado);
            setMovingId(null);
            if (res.error) {
                // Rollback if error
                setLocalProyectos(proyectos);
                alert(`Error al actualizar estado: ${res.error}`);
            }
        });
    }

    function handlePause(proyecto: ProyectoRow) {
        setMovingId(proyecto.id);
        startTransition(async () => {
            const res = await actualizarEstadoProyecto(proyecto.id, 'pausado');
            setMovingId(null);
            if (res.error) {
                alert(`Error: ${res.error}`);
            }
        });
    }

    return (
        <DragDropContext onDragEnd={handleDragEnd}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5 items-start">
                {COLUMNS.map(col => {
                    const colProyectos = localProyectos.filter(p => p.estado === col.id);

                    return (
                        <div
                            key={col.id}
                            className={`flex flex-col rounded-2xl border bg-slate-50/40 p-4 transition-all duration-300 ${col.bgClass}`}
                        >
                            {/* Column Header */}
                            <div className={`flex items-center justify-between mb-4 px-3 py-2 rounded-xl border ${col.headerClass}`}>
                                <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${col.dotClass}`} />
                                    <h3 className="text-xs font-black uppercase tracking-wider">{col.label}</h3>
                                </div>
                                <span className="bg-white/90 border border-slate-200/50 shadow-sm text-slate-650 text-[10px] font-black px-2 py-0.5 rounded-lg">
                                    {colProyectos.length}
                                </span>
                            </div>

                            {/* Droppable Area */}
                            <Droppable droppableId={col.id}>
                                {(provided, snapshot) => (
                                    <div
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        className={`flex flex-col gap-3 min-h-[450px] transition-colors rounded-xl duration-200 ${
                                            snapshot.isDraggingOver ? 'bg-slate-100/50 outline-2 outline-dashed outline-indigo-250/30' : ''
                                        }`}
                                    >
                                        {colProyectos.length === 0 ? (
                                            <div className="flex-1 flex flex-col items-center justify-center py-10 border border-dashed border-slate-200 rounded-xl bg-white/30 text-center">
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Columna vacía</p>
                                                <p className="text-[9px] text-slate-350 mt-0.5">Arrastra un proyecto aquí</p>
                                            </div>
                                        ) : (
                                            colProyectos.map((proyecto, index) => {
                                                const delayed = isRetrasado(proyecto.fecha_fin_estimada, proyecto.estado);
                                                const initials = proyecto.coordinador?.full_name
                                                    ? getInitials(proyecto.coordinador.full_name)
                                                    : '';

                                                return (
                                                    <Draggable
                                                        key={proyecto.id}
                                                        draggableId={proyecto.id}
                                                        index={index}
                                                    >
                                                        {(dragProvided, dragSnapshot) => (
                                                            <div
                                                                ref={dragProvided.innerRef}
                                                                {...dragProvided.draggableProps}
                                                                {...dragProvided.dragHandleProps}
                                                                className={`group relative bg-white border border-slate-200/80 rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200 ${
                                                                    dragSnapshot.isDragging ? 'shadow-xl rotate-1 scale-[1.02] border-indigo-400 ring-2 ring-indigo-100' : ''
                                                                } ${movingId === proyecto.id ? 'opacity-60 pointer-events-none' : ''}`}
                                                            >
                                                                {/* Loading Spinner Over Card */}
                                                                {movingId === proyecto.id && (
                                                                    <div className="absolute inset-0 bg-white/50 rounded-xl flex items-center justify-center z-10">
                                                                        <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                                                                    </div>
                                                                )}

                                                                {/* Client badge and Actions */}
                                                                <div className="flex items-center justify-between gap-2 mb-2.5">
                                                                    {proyecto.cliente ? (
                                                                        <div className="flex items-center gap-1.5 min-w-0">
                                                                            <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-black bg-indigo-50 border border-indigo-100 text-indigo-650 uppercase tracking-wider shrink-0">
                                                                                {proyecto.cliente.sigla}
                                                                            </span>
                                                                            <span className="text-[10px] font-bold text-slate-450 truncate">
                                                                                {proyecto.cliente.nombre_restaurante}
                                                                            </span>
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-[10px] text-slate-350">—</span>
                                                                    )}
                                                                    <CardMenu
                                                                        proyecto={proyecto}
                                                                        onEdit={() => onEdit(proyecto)}
                                                                        onPause={() => handlePause(proyecto)}
                                                                        onDelete={() => onDelete(proyecto)}
                                                                    />
                                                                </div>

                                                                {/* Title & Desc */}
                                                                <div>
                                                                    <h4 className="font-bold text-slate-800 text-sm leading-snug group-hover:text-indigo-600 transition-colors">
                                                                        {proyecto.nombre}
                                                                    </h4>
                                                                    {proyecto.descripcion && (
                                                                        <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                                                                            {proyecto.descripcion}
                                                                        </p>
                                                                    )}
                                                                </div>

                                                                {/* Delay Badge */}
                                                                {delayed && (
                                                                    <div className="mt-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 border border-rose-100 text-rose-600 text-[10px] font-bold tracking-wide animate-pulse">
                                                                        <AlertCircle className="w-3 h-3" />
                                                                        <span>Retrasado</span>
                                                                    </div>
                                                                )}

                                                                <div className="border-t border-slate-100 my-3" />

                                                                {/* Footer */}
                                                                <div className="flex items-center justify-between gap-2">
                                                                    {/* Coordinator */}
                                                                    {proyecto.coordinador?.full_name ? (
                                                                        <div className="flex items-center gap-1.5 min-w-0" title={proyecto.coordinador.full_name}>
                                                                            <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-slate-900 to-slate-800 border border-slate-750 text-[8px] font-black text-white flex items-center justify-center shrink-0 uppercase shadow-sm">
                                                                                {initials}
                                                                            </div>
                                                                            <span className="text-[10px] font-bold text-slate-600 truncate">
                                                                                {proyecto.coordinador.full_name.split(' ')[0]}
                                                                            </span>
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-[10px] text-slate-350 italic font-medium">Sin asignar</span>
                                                                    )}

                                                                    {/* End Date & Access Link */}
                                                                    <div className="flex items-center gap-2 shrink-0">
                                                                        {proyecto.fecha_fin_estimada && (
                                                                            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-450 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded-lg">
                                                                                <Calendar className="w-3 h-3 text-slate-400" />
                                                                                <span>{formatDate(proyecto.fecha_fin_estimada)}</span>
                                                                            </div>
                                                                        )}
                                                                        <Link
                                                                            href={`/dashboard/proyectos/${proyecto.id}`}
                                                                            className="w-6 h-6 rounded-lg bg-slate-50 border border-slate-200/60 hover:bg-slate-900 hover:text-white text-slate-400 hover:border-slate-900 flex items-center justify-center transition-all shadow-sm"
                                                                            title="Ver workspace"
                                                                        >
                                                                            <ArrowRight className="w-3.5 h-3.5" />
                                                                        </Link>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </Draggable>
                                                );
                                            })
                                        )}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </div>
                    );
                })}
            </div>
        </DragDropContext>
    );
}
