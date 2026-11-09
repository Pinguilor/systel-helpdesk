'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, Search, X, UserMinus } from 'lucide-react';
import { PROYECTO_ESTADO_CONFIG, type ProyectoEstado } from '@/types/proyectos.types';
import type { ResumenLocal } from '../gestion-actions';
import { alertasLocal, diasDesde, pct, requiereAtencion, textoHace, DIAS_INACTIVO } from '../avance';

type Filtro = 'todos' | 'atencion' | 'pendientes' | 'inactivos' | 'sin_materiales' | 'completados';

const norm = (v: string | null | undefined) =>
    (v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function Barra({ valor, total, color }: { valor: number; total: number; color: string }) {
    return (
        <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct(valor, total)}%` }} />
        </div>
    );
}

interface Props {
    locales:    ResumenLocal[];
    seleccion:  Set<string>;
    onSeleccion: (s: Set<string>) => void;
    onQuitar:   () => void;
}

export function AvanceTab({ locales, seleccion, onSeleccion, onQuitar }: Props) {
    const [filtro, setFiltro] = useState<Filtro>('todos');
    const [busqueda, setBusqueda] = useState('');

    const filas = useMemo(
        () => locales.map(l => ({ l, a: alertasLocal(l), dias: diasDesde(l.ultima_actividad) })),
        [locales],
    );

    const conteo = useMemo(() => ({
        todos:          filas.length,
        atencion:       filas.filter(f => requiereAtencion(f.a)).length,
        pendientes:     filas.filter(f => f.a.pendientes).length,
        inactivos:      filas.filter(f => f.a.inactivo).length,
        sin_materiales: filas.filter(f => f.a.sinMateriales).length,
        completados:    filas.filter(f => f.a.completado).length,
    }), [filas]);

    const visibles = useMemo(() => {
        const q = norm(busqueda.trim());
        const lista = filas.filter(({ l, a }) => {
            if (filtro === 'atencion' && !requiereAtencion(a)) return false;
            if (filtro === 'pendientes' && !a.pendientes) return false;
            if (filtro === 'inactivos' && !a.inactivo) return false;
            if (filtro === 'sin_materiales' && !a.sinMateriales) return false;
            if (filtro === 'completados' && !a.completado) return false;
            if (!q) return true;
            return norm(l.sigla).includes(q) || norm(l.local_nombre).includes(q) || norm(l.nombre).includes(q);
        });
        // Lo que necesita atención primero; dentro de cada grupo, por sigla
        const peso = (a: ReturnType<typeof alertasLocal>) => (requiereAtencion(a) ? 0 : a.completado ? 2 : 1);
        return lista.sort((x, y) => peso(x.a) - peso(y.a) || (x.l.sigla ?? '').localeCompare(y.l.sigla ?? ''));
    }, [filas, filtro, busqueda]);

    const FILTROS: { id: Filtro; label: string }[] = [
        { id: 'todos',          label: 'Todos' },
        { id: 'atencion',       label: 'Requieren atención' },
        { id: 'pendientes',     label: 'Con pendientes' },
        { id: 'inactivos',      label: `Sin avance ${DIAS_INACTIVO} d` },
        { id: 'sin_materiales', label: 'Sin materiales' },
        { id: 'completados',    label: 'Completados' },
    ];

    const todosVisiblesMarcados = visibles.length > 0 && visibles.every(({ l }) => seleccion.has(l.proyecto_id));

    function alternarTodos() {
        const n = new Set(seleccion);
        if (todosVisiblesMarcados) visibles.forEach(({ l }) => n.delete(l.proyecto_id));
        else visibles.forEach(({ l }) => n.add(l.proyecto_id));
        onSeleccion(n);
    }

    function alternar(id: string) {
        const n = new Set(seleccion);
        if (n.has(id)) n.delete(id); else n.add(id);
        onSeleccion(n);
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                        value={busqueda}
                        onChange={e => setBusqueda(e.target.value)}
                        placeholder="Buscar por sigla o nombre del local..."
                        className="w-full pl-10 pr-9 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/10 placeholder:text-slate-400 bg-white"
                    />
                    {busqueda && (
                        <button type="button" onClick={() => setBusqueda('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
                {seleccion.size > 0 && (
                    <button type="button" onClick={onQuitar}
                        className="flex items-center justify-center gap-2 px-4 py-2 border border-red-200 bg-red-50 text-red-700 rounded-xl text-xs font-black hover:bg-red-100 transition-colors cursor-pointer">
                        <UserMinus className="w-3.5 h-3.5" />
                        Quitar del Rollout ({seleccion.size})
                    </button>
                )}
            </div>

            <div className="flex flex-wrap gap-2">
                {FILTROS.map(f => (
                    <button key={f.id} type="button" onClick={() => setFiltro(f.id)}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-black border transition-colors cursor-pointer ${
                            filtro === f.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                        }`}>
                        {f.label} ({conteo[f.id]})
                    </button>
                ))}
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-x-auto">
                <table className="w-full text-xs min-w-[860px]">
                    <thead>
                        <tr className="text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                            <th className="pl-4 py-3 w-8">
                                <button type="button" onClick={alternarTodos} aria-label="Seleccionar visibles"
                                    className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer ${
                                        todosVisiblesMarcados ? 'bg-slate-900 border-slate-900' : 'border-slate-300 bg-white'
                                    }`}>
                                    {todosVisiblesMarcados && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                                </button>
                            </th>
                            <th className="px-3 py-3">Local</th>
                            <th className="px-3 py-3">Estado</th>
                            <th className="px-3 py-3 w-40">Checklist</th>
                            <th className="px-3 py-3 w-44">Materiales</th>
                            <th className="px-3 py-3 text-center">Acta</th>
                            <th className="px-3 py-3">Actividad</th>
                            <th className="px-3 py-3">Alertas</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {visibles.length === 0 ? (
                            <tr><td colSpan={8} className="text-center py-10 font-bold text-slate-400">Ningún local coincide con el filtro</td></tr>
                        ) : visibles.map(({ l, a, dias }) => {
                            const cfg = PROYECTO_ESTADO_CONFIG[l.estado as ProyectoEstado];
                            const marcado = seleccion.has(l.proyecto_id);
                            return (
                                <tr key={l.proyecto_id} className={marcado ? 'bg-indigo-50/40' : 'hover:bg-slate-50/60'}>
                                    <td className="pl-4 py-3">
                                        <button type="button" onClick={() => alternar(l.proyecto_id)} aria-label="Seleccionar local"
                                            className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer ${
                                                marcado ? 'bg-slate-900 border-slate-900' : 'border-slate-300 bg-white'
                                            }`}>
                                            {marcado && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                                        </button>
                                    </td>
                                    <td className="px-3 py-3">
                                        <Link href={`/dashboard/proyectos/${l.proyecto_id}`} className="group block">
                                            <span className="font-black text-slate-800 group-hover:text-indigo-600">[{l.sigla ?? '—'}]</span>{' '}
                                            <span className="font-semibold text-slate-600">{l.local_nombre}</span>
                                        </Link>
                                    </td>
                                    <td className="px-3 py-3">
                                        {cfg && (
                                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black border ${cfg.bgClass} ${cfg.textClass} ${cfg.borderClass}`}>
                                                {cfg.label}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-3 py-3">
                                        {l.tareas_total > 0 ? (
                                            <div className="space-y-1">
                                                <p className="font-bold text-slate-700">{l.tareas_completadas}/{l.tareas_total} <span className="text-slate-400 font-semibold">· {pct(l.tareas_completadas, l.tareas_total)}%</span></p>
                                                <Barra valor={l.tareas_completadas} total={l.tareas_total} color="bg-indigo-500" />
                                            </div>
                                        ) : <span className="text-slate-300 font-semibold">Sin checklist</span>}
                                    </td>
                                    <td className="px-3 py-3">
                                        {l.mat_requerido > 0 ? (
                                            <div className="space-y-1">
                                                <p className="font-bold text-slate-700">
                                                    {l.mat_entregado}/{l.mat_requerido} <span className="text-slate-400 font-semibold">entregado · {l.mat_instalado} inst.</span>
                                                </p>
                                                <Barra valor={l.mat_entregado} total={l.mat_requerido} color="bg-emerald-500" />
                                            </div>
                                        ) : <span className="text-slate-300 font-semibold">Sin receta</span>}
                                    </td>
                                    <td className="px-3 py-3 text-center">
                                        {l.acta_firmada
                                            ? <Check className="w-4 h-4 text-emerald-600 inline" strokeWidth={3} />
                                            : <span className="text-slate-300">—</span>}
                                    </td>
                                    <td className="px-3 py-3 font-semibold text-slate-500 whitespace-nowrap">{textoHace(dias)}</td>
                                    <td className="px-3 py-3">
                                        <div className="flex flex-wrap gap-1">
                                            {a.pendientes && <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200">{l.tareas_pendientes} pendiente{l.tareas_pendientes === 1 ? '' : 's'}</span>}
                                            {a.inactivo && <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-50 text-red-700 border border-red-200">Sin avance {dias} d</span>}
                                            {a.sinMateriales && <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-600 border border-slate-200">Sin materiales</span>}
                                            {!a.pendientes && !a.inactivo && !a.sinMateriales && <span className="text-slate-300">—</span>}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
