'use client';

import { useState } from 'react';
import {
    AlertTriangle, Camera, PenLine, X,
    PackageSearch, Clock, User,
} from 'lucide-react';
import type { IncidenciaCustodia } from '../actions';

interface Props {
    incidencias: IncidenciaCustodia[];
}

// ── Badges de acción ─────────────────────────────────────────────────────────

const ACCION: Record<string, { label: string; cls: string }> = {
    Estacionado_Obra:       { label: 'Estacionado en Obra', cls: 'bg-orange-100 text-orange-700' },
    En_Transito_Devolucion: { label: 'En Tránsito',         cls: 'bg-blue-100   text-blue-700'   },
    Reingresado_Logistica:  { label: 'Reingresado',         cls: 'bg-violet-100 text-violet-700' },
};

function AccionBadge({ estado }: { estado: string }) {
    const cfg = ACCION[estado] ?? { label: estado, cls: 'bg-slate-100 text-slate-600' };
    return (
        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${cfg.cls}`}>
            {cfg.label}
        </span>
    );
}

// ── Formateador de fecha ─────────────────────────────────────────────────────

function formatFecha(iso: string) {
    const d = new Date(iso);
    return {
        fecha: d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }),
        hora:  d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
    };
}

// ── Visor de imagen (modal) ──────────────────────────────────────────────────

function ImageViewer({
    url,
    titulo,
    onClose,
}: { url: string; titulo: string; onClose: () => void }) {
    return (
        <div
            className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-xl"
                onClick={e => e.stopPropagation()}
            >
                {/* Cabecera del visor */}
                <div className="flex items-center justify-between mb-3">
                    <span className="text-white/90 text-sm font-bold">{titulo}</span>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                    >
                        <X className="w-4 h-4 text-white" />
                    </button>
                </div>
                {/* Imagen */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={url}
                    alt={titulo}
                    className="w-full max-h-[75vh] object-contain rounded-xl shadow-2xl bg-slate-900"
                />
            </div>
        </div>
    );
}

// ── Componente principal ─────────────────────────────────────────────────────

export function HistorialIncidenciasTab({ incidencias }: Props) {
    const [viewer, setViewer] = useState<{ url: string; titulo: string } | null>(null);

    const totalUnidades = incidencias.reduce((acc, i) => acc + i.cantidad, 0);

    return (
        <>
            {/* Cabecera */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-4 border border-slate-200 rounded-2xl shadow-sm gap-3 mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-4.5 h-4.5 text-amber-600" strokeWidth={1.75} />
                    </div>
                    <div>
                        <h3 className="text-base font-black text-slate-900">Historial de Incidencias</h3>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mt-0.5">
                            Custodia inversa · Protocolo de evidencia
                        </p>
                    </div>
                </div>
                {incidencias.length > 0 && (
                    <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-bold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md">
                            {incidencias.length} incidencia{incidencias.length !== 1 ? 's' : ''}
                        </span>
                        <span className="text-xs font-bold px-2.5 py-1 bg-amber-50 text-amber-600 rounded-md">
                            {totalUnidades} unidad{totalUnidades !== 1 ? 'es' : ''}
                        </span>
                    </div>
                )}
            </div>

            {/* Estado vacío */}
            {incidencias.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                    <PackageSearch className="w-9 h-9 text-slate-300 mb-3" strokeWidth={1.4} />
                    <p className="text-slate-500 font-bold text-sm">Sin incidencias registradas</p>
                    <p className="text-slate-400 text-xs mt-1 max-w-xs">
                        Aquí aparecerán los materiales que no pudieron instalarse y
                        quedaron estacionados en obra o en tránsito de devolución.
                    </p>
                </div>
            ) : (
                /* Tabla con sticky header */
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto overflow-y-auto max-h-[520px]">
                        <table className="w-full text-sm border-collapse min-w-[720px]">
                            <thead className="sticky top-0 z-10 bg-slate-50 border-b-2 border-slate-200">
                                <tr>
                                    <th className="px-4 py-2.5 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                        Fecha
                                    </th>
                                    <th className="px-4 py-2.5 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                        Material
                                    </th>
                                    <th className="px-4 py-2.5 text-center text-[10px] font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                        Uds.
                                    </th>
                                    <th className="px-4 py-2.5 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                        Acción
                                    </th>
                                    <th className="px-4 py-2.5 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                        Motivo
                                    </th>
                                    <th className="px-4 py-2.5 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                        Registrado Por
                                    </th>
                                    <th className="px-4 py-2.5 text-center text-[10px] font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                        Evidencia
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {incidencias.map((inc) => {
                                    const { fecha, hora } = formatFecha(inc.createdAt);
                                    return (
                                        <tr key={inc.id} className="hover:bg-slate-50/70 transition-colors">

                                            {/* Fecha */}
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5">
                                                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                    <div>
                                                        <p className="text-xs font-bold text-slate-800">{fecha}</p>
                                                        <p className="text-[10px] text-slate-400">{hora}</p>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Material */}
                                            <td className="px-4 py-3 max-w-[160px]">
                                                <p className="text-xs font-bold text-slate-900 truncate">
                                                    {inc.materialNombre}
                                                </p>
                                            </td>

                                            {/* Cantidad */}
                                            <td className="px-4 py-3 text-center">
                                                <span className="text-sm font-black text-slate-800">
                                                    {inc.cantidad}
                                                </span>
                                            </td>

                                            {/* Acción */}
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <AccionBadge estado={inc.estado} />
                                            </td>

                                            {/* Motivo */}
                                            <td className="px-4 py-3 max-w-[180px]">
                                                <p
                                                    className="text-xs text-slate-600 truncate"
                                                    title={inc.motivoIncidencia ?? '—'}
                                                >
                                                    {inc.motivoIncidencia ?? <span className="text-slate-400">—</span>}
                                                </p>
                                            </td>

                                            {/* Registrado por */}
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5">
                                                    <User className="w-3 h-3 text-slate-400 shrink-0" />
                                                    <span className="text-xs font-semibold text-slate-700 truncate max-w-[90px]">
                                                        {inc.registradoPorNombre ?? '—'}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Evidencia */}
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    {inc.evidenciaFotograficaUrl ? (
                                                        <button
                                                            onClick={() => setViewer({
                                                                url: inc.evidenciaFotograficaUrl!,
                                                                titulo: 'Fotografía de evidencia',
                                                            })}
                                                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold transition-colors"
                                                            title="Ver fotografía"
                                                        >
                                                            <Camera className="w-3 h-3" />
                                                            Foto
                                                        </button>
                                                    ) : (
                                                        <span className="text-[10px] text-slate-300 px-2">Sin foto</span>
                                                    )}

                                                    {inc.firmaCustodiaUrl ? (
                                                        <button
                                                            onClick={() => setViewer({
                                                                url: inc.firmaCustodiaUrl!,
                                                                titulo: 'Firma de custodia',
                                                            })}
                                                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold transition-colors"
                                                            title="Ver firma"
                                                        >
                                                            <PenLine className="w-3 h-3" />
                                                            Firma
                                                        </button>
                                                    ) : (
                                                        <span className="text-[10px] text-slate-300 px-2">Sin firma</span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Visor de imagen */}
            {viewer && (
                <ImageViewer
                    url={viewer.url}
                    titulo={viewer.titulo}
                    onClose={() => setViewer(null)}
                />
            )}
        </>
    );
}
