'use client';

import { useState, useTransition } from 'react';
import { Loader2, ClipboardList, ChevronDown, FileText, Paperclip, ExternalLink } from 'lucide-react';
import { getGuiasIngresoAction, type GuiaResumen } from '../actions';

interface Props {
    guiasIniciales: GuiaResumen[];
    totalGuias:     number;
}

function formatFecha(iso: string) {
    return new Date(iso).toLocaleDateString('es-CL', {
        day: '2-digit', month: 'short', year: 'numeric',
    });
}

function formatFechaHora(iso: string) {
    return new Date(iso).toLocaleString('es-CL', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

export function HistorialGuias({ guiasIniciales, totalGuias }: Props) {
    const [guias,     setGuias]     = useState(guiasIniciales);
    const [total,     setTotal]     = useState(totalGuias);
    const [page,      setPage]      = useState(0);
    const [isPending, startTransition] = useTransition();

    function loadMore() {
        const nextPage = page + 1;
        startTransition(async () => {
            const result = await getGuiasIngresoAction(nextPage, 20);
            if (!result.error) {
                setGuias(prev => [...prev, ...result.data]);
                setTotal(result.total);
                setPage(nextPage);
            }
        });
    }

    if (guias.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                <ClipboardList className="w-10 h-10 text-slate-300 mb-3" strokeWidth={1.4} />
                <p className="text-slate-500 font-bold text-sm">Sin guías registradas</p>
                <p className="text-slate-400 text-xs mt-1">
                    Las guías de ingreso procesadas aparecerán aquí.
                </p>
            </div>
        );
    }

    return (
        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
            <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
                <table className="w-full text-sm border-collapse min-w-[800px]">
                    <thead className="sticky top-0 z-10 bg-slate-50 border-b-2 border-slate-200">
                        <tr>
                            <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                N° Guía
                            </th>
                            <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                Proveedor
                            </th>
                            <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                Bodega
                            </th>
                            <th className="px-4 py-3 text-center text-[10px] font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                Fecha Guía
                            </th>
                            <th className="px-4 py-3 text-center text-[10px] font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                Ítems
                            </th>
                            <th className="px-4 py-3 text-center text-[10px] font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                Unidades
                            </th>
                            <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                Registrado por
                            </th>
                            <th className="px-4 py-3 text-center text-[10px] font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                Estado
                            </th>
                            <th className="px-4 py-3 text-center text-[10px] font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                Doc
                            </th>
                            <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                Procesada
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {guias.map(g => (
                            <tr key={g.id} className="hover:bg-slate-50/70 transition-colors">
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <FileText className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                        <span className="text-xs font-black text-slate-900">{g.numero_guia}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <span className="text-xs font-semibold text-slate-700 truncate max-w-[160px] block">
                                        {g.proveedor}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <span className="text-xs font-semibold text-slate-600 truncate max-w-[140px] block">
                                        {g.bodega_nombre}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <span className="text-xs font-semibold text-slate-700">
                                        {formatFecha(g.fecha_guia)}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <span className="text-xs font-black text-slate-900">{g.total_items}</span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-700">
                                        {g.total_unidades} ud.
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <span className="text-xs font-semibold text-slate-600 truncate max-w-[120px] block">
                                        {g.registrado_por}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black ${
                                        g.estado === 'completada'
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : 'bg-red-100 text-red-700'
                                    }`}>
                                        {g.estado === 'completada' ? 'Completada' : 'Anulada'}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                    {g.documento_url ? (
                                        <a
                                            href={g.documento_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
                                        >
                                            <Paperclip className="w-3 h-3" />
                                            Ver
                                            <ExternalLink className="w-2.5 h-2.5" />
                                        </a>
                                    ) : (
                                        <span className="text-[10px] text-slate-300">—</span>
                                    )}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                    <span className="text-[10px] font-semibold text-slate-500">
                                        {formatFechaHora(g.created_at)}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <p className="text-xs text-slate-400">
                    Mostrando {guias.length} de {total} guía{total !== 1 ? 's' : ''}
                </p>
                {guias.length < total && (
                    <button
                        onClick={loadMore}
                        disabled={isPending}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-800 transition-colors disabled:opacity-50"
                    >
                        {isPending ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                        )}
                        Cargar más
                    </button>
                )}
            </div>
        </div>
    );
}
