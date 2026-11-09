'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Search, X } from 'lucide-react';
import type { ExcepcionMasivo } from '../gestion-actions';

const norm = (v: string | null | undefined) =>
    (v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const fecha = (iso: string) =>
    new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });

/** Todas las tareas marcadas como "pendiente" (con observación) de los locales, en una sola lista. */
export function ExcepcionesTab({ excepciones }: { excepciones: ExcepcionMasivo[] }) {
    const [busqueda, setBusqueda] = useState('');

    const visibles = useMemo(() => {
        const q = norm(busqueda.trim());
        if (!q) return excepciones;
        return excepciones.filter(e =>
            [e.sigla, e.local_nombre, e.tarea, e.grupo, e.observacion].some(c => norm(c).includes(q)));
    }, [excepciones, busqueda]);

    if (excepciones.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 font-sans">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-3" strokeWidth={1.5} />
                <p className="text-slate-600 font-bold text-sm">Sin tareas pendientes</p>
                <p className="text-xs text-slate-400 mt-0.5">Ningún local tiene tareas marcadas como pendientes.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="relative max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                    placeholder="Buscar por local, tarea u observación..."
                    className="w-full pl-10 pr-9 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/10 placeholder:text-slate-400 bg-white"
                />
                {busqueda && (
                    <button type="button" onClick={() => setBusqueda('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer">
                        <X className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-x-auto">
                <table className="w-full text-xs min-w-[720px]">
                    <thead>
                        <tr className="text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                            <th className="px-4 py-3">Local</th>
                            <th className="px-3 py-3">Tarea</th>
                            <th className="px-3 py-3">Observación</th>
                            <th className="px-3 py-3">Marcada</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {visibles.length === 0 ? (
                            <tr><td colSpan={4} className="text-center py-10 font-bold text-slate-400">Nada coincide con la búsqueda</td></tr>
                        ) : visibles.map(e => (
                            <tr key={e.id} className="hover:bg-slate-50/60 align-top">
                                <td className="px-4 py-3 whitespace-nowrap">
                                    <Link href={`/dashboard/proyectos/${e.proyecto_id}`} className="group">
                                        <span className="font-black text-slate-800 group-hover:text-indigo-600">[{e.sigla ?? '—'}]</span>{' '}
                                        <span className="font-semibold text-slate-600">{e.local_nombre}</span>
                                    </Link>
                                </td>
                                <td className="px-3 py-3">
                                    <p className="font-bold text-slate-800">{e.tarea}</p>
                                    {e.grupo && <p className="text-[10px] font-semibold text-slate-400 mt-0.5">{e.grupo}</p>}
                                </td>
                                <td className="px-3 py-3 font-medium text-slate-600 max-w-sm">{e.observacion || <span className="text-slate-300">—</span>}</td>
                                <td className="px-3 py-3 font-semibold text-slate-500 whitespace-nowrap">{fecha(e.created_at)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
