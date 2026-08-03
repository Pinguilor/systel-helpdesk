'use client';

import { useState, useMemo } from 'react';
import { Search, MessageSquare, Star, Users, TrendingUp } from 'lucide-react';
import type { RespuestaConDetalle } from '../../encuesta/actions';

// ── Helpers ───────────────────────────────────────────────────────────────────

const EMOJIS: Record<number, string> = { 1: '😡', 2: '😕', 3: '😐', 4: '🙂', 5: '🤩' };
const LABELS: Record<number, string> = {
    1: 'Muy mal', 2: 'Regular', 3: 'Neutral', 4: 'Bien', 5: '¡Excelente!',
};
const BADGE_CLS: Record<number, string> = {
    1: 'bg-red-100    text-red-700',
    2: 'bg-orange-100 text-orange-700',
    3: 'bg-slate-100  text-slate-600',
    4: 'bg-blue-100   text-blue-700',
    5: 'bg-emerald-100 text-emerald-700',
};

function formatFecha(iso: string) {
    return new Date(iso).toLocaleString('es-CL', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

function StarFill({ n }: { n: number }) {
    return (
        <div className="flex gap-0.5">
            {Array.from({ length: 5 }, (_, i) => (
                <Star
                    key={i}
                    className={`w-3.5 h-3.5 ${i < n ? 'fill-yellow-400 text-yellow-400' : 'text-slate-200'}`}
                />
            ))}
        </div>
    );
}

// ── Componente principal ──────────────────────────────────────────────────────

interface Props {
    encuestaLabel: string;
    respuestas:    RespuestaConDetalle[];
}

export function ModuloRespuestasEncuestas({ encuestaLabel, respuestas }: Props) {
    const [query, setQuery] = useState('');

    // Métricas
    const total   = respuestas.length;
    const promedio = total
        ? respuestas.reduce((acc, r) => acc + r.satisfaccion, 0) / total
        : 0;
    const distribucion = [1, 2, 3, 4, 5].map(v => ({
        valor: v,
        count: respuestas.filter(r => r.satisfaccion === v).length,
    }));

    // Filtro
    const filtradas = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return respuestas;
        return respuestas.filter(
            r =>
                r.usuario_nombre.toLowerCase().includes(q) ||
                r.empresa_nombre.toLowerCase().includes(q)
        );
    }, [respuestas, query]);

    return (
        <div className="space-y-6">

            {/* Header */}
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    Métricas · Encuesta de satisfacción
                </p>
                <h1 className="text-2xl font-black text-slate-900">{encuestaLabel}</h1>
            </div>

            {/* Metric cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

                {/* Total respuestas */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                        <Users className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                        <p className="text-3xl font-black text-slate-900">{total}</p>
                        <p className="text-xs font-semibold text-slate-500 mt-0.5">
                            Respuestas recibidas
                        </p>
                    </div>
                </div>

                {/* Promedio */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center shrink-0">
                        <TrendingUp className="w-5 h-5 text-yellow-600" />
                    </div>
                    <div>
                        <p className="text-3xl font-black text-slate-900">
                            {total ? promedio.toFixed(1) : '—'}
                            <span className="text-base font-bold text-slate-400 ml-1">/ 5.0</span>
                        </p>
                        <p className="text-xs font-semibold text-slate-500 mt-0.5">
                            Satisfacción promedio
                        </p>
                    </div>
                </div>

                {/* Distribución mini */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3">
                        Distribución
                    </p>
                    <div className="space-y-1.5">
                        {distribucion.map(({ valor, count }) => (
                            <div key={valor} className="flex items-center gap-2">
                                <span className="text-base w-5 text-center leading-none">
                                    {EMOJIS[valor]}
                                </span>
                                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-indigo-400 rounded-full transition-all"
                                        style={{ width: total ? `${(count / total) * 100}%` : '0%' }}
                                    />
                                </div>
                                <span className="text-[10px] font-black text-slate-500 w-4 text-right">
                                    {count}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Buscador */}
            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                    type="text"
                    placeholder="Buscar por usuario o empresa…"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 transition-colors bg-white"
                />
            </div>

            {/* Tabla */}
            {filtradas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                    <MessageSquare className="w-9 h-9 text-slate-300 mb-3" strokeWidth={1.4} />
                    <p className="text-slate-500 font-bold text-sm">
                        {total === 0 ? 'Sin respuestas aún' : 'Sin resultados para esa búsqueda'}
                    </p>
                    <p className="text-slate-400 text-xs mt-1">
                        {total === 0
                            ? 'Las respuestas aparecerán aquí en tiempo real.'
                            : 'Intenta con otro nombre o empresa.'}
                    </p>
                </div>
            ) : (
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto overflow-y-auto max-h-[560px]">
                        <table className="w-full text-sm border-collapse min-w-[640px]">
                            <thead className="sticky top-0 z-10 bg-slate-50 border-b-2 border-slate-200">
                                <tr>
                                    <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                        Fecha
                                    </th>
                                    <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                        Usuario
                                    </th>
                                    <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                        Empresa / Local
                                    </th>
                                    <th className="px-4 py-3 text-center text-[10px] font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                        Satisfacción
                                    </th>
                                    <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                        Comentario
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {filtradas.map(r => (
                                    <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">

                                        {/* Fecha */}
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <p className="text-xs font-semibold text-slate-700">
                                                {formatFecha(r.created_at)}
                                            </p>
                                        </td>

                                        {/* Usuario */}
                                        <td className="px-4 py-3">
                                            <p className="text-xs font-bold text-slate-900 truncate max-w-[140px]">
                                                {r.usuario_nombre}
                                            </p>
                                        </td>

                                        {/* Empresa */}
                                        <td className="px-4 py-3">
                                            <p className="text-xs font-semibold text-slate-600 truncate max-w-[140px]">
                                                {r.empresa_nombre}
                                            </p>
                                        </td>

                                        {/* Satisfacción */}
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col items-center gap-1">
                                                <span
                                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black ${BADGE_CLS[r.satisfaccion]}`}
                                                >
                                                    <span className="text-sm leading-none">{EMOJIS[r.satisfaccion]}</span>
                                                    {LABELS[r.satisfaccion]}
                                                </span>
                                                <StarFill n={r.satisfaccion} />
                                            </div>
                                        </td>

                                        {/* Comentario */}
                                        <td className="px-4 py-3 max-w-[260px]">
                                            {r.comentario ? (
                                                <p
                                                    className="text-xs text-slate-600 leading-relaxed line-clamp-2"
                                                    title={r.comentario}
                                                >
                                                    {r.comentario}
                                                </p>
                                            ) : (
                                                <span className="text-xs text-slate-300 italic">Sin comentario</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer de la tabla */}
                    <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                        <p className="text-xs text-slate-400">
                            Mostrando {filtradas.length} de {total} respuesta{total !== 1 ? 's' : ''}
                        </p>
                        {query && (
                            <button
                                onClick={() => setQuery('')}
                                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                            >
                                Limpiar filtro
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
