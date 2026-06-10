'use client';

import { useState, useTransition } from 'react';
import { ChevronDown, User, Calendar, MapPin, Loader2 } from 'lucide-react';
import { PROYECTO_ESTADO_CONFIG, type ProyectoEstado } from '@/types/proyectos.types';
import { actualizarEstadoProyectoDesdeHub } from '../actions';

type Proyecto = {
    id: string;
    nombre: string;
    descripcion: string | null;
    estado: ProyectoEstado;
    fecha_inicio: string | null;
    fecha_fin_estimada: string | null;
    cliente: { nombre_restaurante: string; sigla: string; direccion?: string | null } | null;
    coordinador: { full_name: string | null } | null;
};

function formatDate(d: string | null) {
    if (!d) return null;
    return new Date(d).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ProyectoHeader({ proyecto, currentUserRol }: { proyecto: Proyecto, currentUserRol?: string }) {
    const cfg = PROYECTO_ESTADO_CONFIG[proyecto.estado];
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const ESTADOS_PERMITIDOS = Object.keys(PROYECTO_ESTADO_CONFIG).filter(
        e => e !== proyecto.estado
    ) as ProyectoEstado[];

    function handleCambiarEstado(nuevoEstado: ProyectoEstado) {
        setIsDropdownOpen(false);
        setError(null);
        startTransition(async () => {
            const result = await actualizarEstadoProyectoDesdeHub(proyecto.id, nuevoEstado);
            if (result.error) setError(result.error);
        });
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
                {/* Fila principal */}
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    <div className="flex-1 min-w-0">
                        <h1 className="text-xl font-black text-slate-900 leading-tight">{proyecto.nombre}</h1>
                        {proyecto.descripcion && (
                            <p className="text-sm text-slate-500 mt-1">{proyecto.descripcion}</p>
                        )}
                    </div>

                    {/* Badge de estado con dropdown */}
                    <div className="relative shrink-0">
                        {currentUserRol === 'tecnico' ? (
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border ${cfg.bgClass} ${cfg.textClass} ${cfg.borderClass}`}>
                                {cfg.label}
                            </div>
                        ) : (
                            <>
                                <button
                                    onClick={() => setIsDropdownOpen(v => !v)}
                                    disabled={isPending}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all hover:brightness-95 ${cfg.bgClass} ${cfg.textClass} ${cfg.borderClass}`}
                                >
                                    {isPending ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                        cfg.label
                                    )}
                                    <ChevronDown className="w-3 h-3" />
                                </button>

                                {isDropdownOpen && (
                                    <div className="absolute right-0 top-full mt-1.5 w-44 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1 overflow-hidden">
                                        <p className="px-3 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                            Cambiar a...
                                        </p>
                                        {ESTADOS_PERMITIDOS.map(estado => {
                                            const c = PROYECTO_ESTADO_CONFIG[estado];
                                            return (
                                                <button
                                                    key={estado}
                                                    onClick={() => handleCambiarEstado(estado)}
                                                    className={`w-full text-left px-3 py-2 text-xs font-bold hover:bg-slate-50 transition-colors ${c.textClass}`}
                                                >
                                                    {c.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {error && (
                    <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
                )}

                {/* Metadatos */}
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                    {proyecto.cliente && (
                        <span className="flex items-center gap-1.5 text-xs text-slate-500">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-semibold">[{proyecto.cliente.sigla}]</span>
                            {proyecto.cliente.nombre_restaurante}
                        </span>
                    )}
                    {proyecto.coordinador?.full_name && (
                        <span className="flex items-center gap-1.5 text-xs text-slate-500">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            {proyecto.coordinador.full_name}
                        </span>
                    )}
                    {proyecto.fecha_inicio && (
                        <span className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            Inicio: {formatDate(proyecto.fecha_inicio)}
                        </span>
                    )}
                    {proyecto.fecha_fin_estimada && (
                        <span className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            Fin est.: {formatDate(proyecto.fecha_fin_estimada)}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
