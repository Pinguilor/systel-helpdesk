'use client';

import { useMemo, useState } from 'react';
import { Download, Package, AlertTriangle } from 'lucide-react';
import type { MaterialMasivo } from '../gestion-actions';
import { faltante } from '../avance';

function descargarCsv(filas: MaterialMasivo[], nombre: string) {
    const esc = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lineas = [
        ['Familia', 'Modelo', 'Requerido', 'Entregado', 'Instalado', 'Por retirar', 'Locales pendientes', 'Stock disponible', 'Faltante'],
        ...filas.map(m => [m.familia, m.modelo, m.requerido, m.entregado, m.instalado, m.por_retirar,
            m.locales_pendientes, m.stock_disponible, faltante(m.por_retirar, m.stock_disponible)]),
    ].map(r => r.map(esc).join(';'));
    // BOM para que Excel respete las tildes
    const blob = new Blob(['﻿' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `materiales-${nombre.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

/** Materiales de todos los locales sumados y comparados con el stock disponible en bodega. */
export function MaterialesTab({ materiales, nombreProyecto }: { materiales: MaterialMasivo[]; nombreProyecto: string }) {
    const [soloFaltantes, setSoloFaltantes] = useState(false);

    const filas = useMemo(
        () => materiales.map(m => ({ m, falta: faltante(m.por_retirar, m.stock_disponible) })),
        [materiales],
    );
    const conFaltante = filas.filter(f => (f.falta ?? 0) > 0);
    const visibles = soloFaltantes ? conFaltante : filas;

    const totalPorRetirar = materiales.reduce((s, m) => s + m.por_retirar, 0);
    const totalFaltante = conFaltante.reduce((s, f) => s + (f.falta ?? 0), 0);

    if (materiales.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 font-sans">
                <Package className="w-8 h-8 text-slate-300 mb-3" strokeWidth={1.5} />
                <p className="text-slate-500 font-bold text-sm">Los locales aún no tienen materiales</p>
                <p className="text-xs text-slate-400 mt-0.5">Aplica una receta a los proyectos para ver el consolidado.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Por retirar de bodega</p>
                    <p className="text-2xl font-black text-slate-800 mt-1">{totalPorRetirar}</p>
                    <p className="text-[11px] font-semibold text-slate-400">{materiales.length} modelos</p>
                </div>
                <div className={`border rounded-2xl p-4 shadow-sm ${conFaltante.length > 0 ? 'bg-red-50/60 border-red-200' : 'bg-emerald-50/60 border-emerald-200'}`}>
                    <p className={`text-[9px] font-black uppercase tracking-widest ${conFaltante.length > 0 ? 'text-red-600' : 'text-emerald-700'}`}>Modelos con faltante</p>
                    <p className={`text-2xl font-black mt-1 ${conFaltante.length > 0 ? 'text-red-700' : 'text-emerald-700'}`}>{conFaltante.length}</p>
                    <p className="text-[11px] font-semibold text-slate-500">
                        {conFaltante.length > 0 ? `${totalFaltante} unidades por conseguir` : 'El stock alcanza para todo'}
                    </p>
                </div>
                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cómo se calcula</p>
                    <p className="text-[11px] font-semibold text-slate-500 mt-1 leading-relaxed">
                        Por retirar = requerido − entregado en cada local. Stock = unidades <em>Disponibles</em> en todas las bodegas.
                    </p>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setSoloFaltantes(false)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-black border transition-colors cursor-pointer ${
                        !soloFaltantes ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                    Todos ({filas.length})
                </button>
                <button type="button" onClick={() => setSoloFaltantes(true)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-black border transition-colors cursor-pointer ${
                        soloFaltantes ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                    Solo faltantes ({conFaltante.length})
                </button>
                <button type="button" onClick={() => descargarCsv(visibles.map(f => f.m), nombreProyecto)}
                    className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black border bg-white text-slate-600 border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer">
                    <Download className="w-3.5 h-3.5" />
                    Exportar CSV
                </button>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-x-auto">
                <table className="w-full text-xs min-w-[780px]">
                    <thead>
                        <tr className="text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                            <th className="px-4 py-3">Equipo</th>
                            <th className="px-3 py-3 text-right">Requerido</th>
                            <th className="px-3 py-3 text-right">Entregado</th>
                            <th className="px-3 py-3 text-right">Instalado</th>
                            <th className="px-3 py-3 text-right">Por retirar</th>
                            <th className="px-3 py-3 text-right">Locales</th>
                            <th className="px-3 py-3 text-right">Stock</th>
                            <th className="px-4 py-3 text-right">Faltante</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {visibles.length === 0 ? (
                            <tr><td colSpan={8} className="text-center py-10 font-bold text-slate-400">No hay faltantes</td></tr>
                        ) : visibles.map(({ m, falta }) => (
                            <tr key={`${m.inventario_id ?? 'manual'}-${m.modelo}`} className={(falta ?? 0) > 0 ? 'bg-red-50/30' : 'hover:bg-slate-50/60'}>
                                <td className="px-4 py-3">
                                    <p className="font-bold text-slate-800">{m.modelo}</p>
                                    <p className="text-[10px] font-semibold text-slate-400">{m.familia}</p>
                                </td>
                                <td className="px-3 py-3 text-right font-semibold text-slate-600">{m.requerido}</td>
                                <td className="px-3 py-3 text-right font-semibold text-slate-600">{m.entregado}</td>
                                <td className="px-3 py-3 text-right font-semibold text-slate-600">{m.instalado}</td>
                                <td className="px-3 py-3 text-right font-black text-slate-800">{m.por_retirar}</td>
                                <td className="px-3 py-3 text-right font-semibold text-slate-500">{m.locales_pendientes}</td>
                                <td className="px-3 py-3 text-right font-semibold text-slate-600">
                                    {m.stock_disponible === null ? <span className="text-slate-300">manual</span> : m.stock_disponible}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    {falta === null ? <span className="text-slate-300">—</span> : falta > 0 ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-red-50 text-red-700 border border-red-200">
                                            <AlertTriangle className="w-3 h-3" /> {falta}
                                        </span>
                                    ) : <span className="text-emerald-600 font-black">OK</span>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
