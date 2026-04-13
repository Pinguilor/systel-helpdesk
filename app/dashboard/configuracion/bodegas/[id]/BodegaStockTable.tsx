'use client';

import React, { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
    Wrench, Loader2, AlertTriangle, CheckCircle2,
    X, Package, Hash, Plus, MinusCircle, PlusCircle,
} from 'lucide-react';
import {
    ajustarStockAction, darBajaSeriesAction,
    addStockToBodegaAction,
} from './actions';

// ── Types ─────────────────────────────────────────────────────

export interface StockRow {
    id: string;
    modelo: string | null;
    familia: string | null;
    es_serializado: boolean;
    cantidad: number;
    estado: string | null;
    numero_serie: string | null;
    bodega_id: string;
}

export interface StockGroup {
    key: string;
    familia: string;
    modelo: string;
    es_serializado: boolean;
    totalUnidades: number;
    rows: StockRow[];
    bodegaId: string;
}

// ── Shared Alert ──────────────────────────────────────────────

function Alert({ type, msg }: { type: 'error' | 'success' | 'warning'; msg: string }) {
    const styles = {
        error: 'bg-red-50 border-red-200 text-red-700',
        success: 'bg-emerald-50 border-emerald-200 text-emerald-700',
        warning: 'bg-amber-50 border-amber-200 text-amber-700',
    };
    const Icon = type === 'error' ? AlertTriangle : type === 'warning' ? AlertTriangle : CheckCircle2;
    return (
        <div className={`flex items-center gap-2 text-sm font-medium px-4 py-3 rounded-xl border ${styles[type]}`}>
            <Icon className="w-4 h-4 shrink-0" />
            {msg}
        </div>
    );
}

function parseSerials(raw: string): string[] {
    return [...new Set(
        raw.split(/[\n,]+/).map(s => s.trim()).filter(Boolean)
    )];
}

// ── AjustarGenéricoModal ──────────────────────────────────────

function AjustarGenericoModal({ grupo, onClose }: { grupo: StockGroup; onClose: () => void }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [value, setValue] = useState(grupo.totalUnidades);
    const [alert, setAlert] = useState<{ type: 'error' | 'success'; msg: string } | null>(null);
    const row = grupo.rows[0];

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (value < 0) { setAlert({ type: 'error', msg: 'La cantidad no puede ser negativa.' }); return; }
        startTransition(async () => {
            const result = await ajustarStockAction(row.id, value);
            if (result.error) {
                setAlert({ type: 'error', msg: result.error });
            } else {
                setAlert({ type: 'success', msg: 'Stock actualizado.' });
                setTimeout(() => { onClose(); router.refresh(); }, 700);
            }
        });
    }

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="fixed inset-0" onClick={onClose} />
            <div className="relative z-10 bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm p-6 flex flex-col gap-4"
                onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-indigo-100 rounded-xl"><Wrench className="w-4 h-4 text-indigo-600" /></div>
                        <div>
                            <p className="text-sm font-black text-slate-800">Ajustar Stock</p>
                            <p className="text-xs text-slate-500 truncate max-w-[200px]">{grupo.modelo}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                {alert && <Alert type={alert.type} msg={alert.msg} />}
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div>
                        <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-1.5">Nueva Cantidad</label>
                        <input type="number" min={0} value={value} autoFocus
                            onChange={e => setValue(parseInt(e.target.value, 10) || 0)}
                            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                        />
                        <p className="mt-1 text-[11px] text-slate-400">Stock actual: {grupo.totalUnidades} uds</p>
                    </div>
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={onClose} disabled={isPending}
                            className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                            Cancelar
                        </button>
                        <button type="submit" disabled={isPending}
                            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold flex items-center gap-2 disabled:opacity-50">
                            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            Guardar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ── AjustarSerializadoModal ───────────────────────────────────

function AjustarSerializadoModal({ grupo, onClose }: { grupo: StockGroup; onClose: () => void }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [tab, setTab] = useState<'baja' | 'agregar'>('baja');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [serialesRaw, setSerialesRaw] = useState('');
    const [alert, setAlert] = useState<{ type: 'error' | 'success' | 'warning'; msg: string } | null>(null);

    const serialesParsed = useMemo(() => parseSerials(serialesRaw), [serialesRaw]);

    function toggleSerial(id: string) {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }

    function handleDarDeBaja() {
        if (selected.size === 0) { setAlert({ type: 'error', msg: 'Selecciona al menos un serial.' }); return; }
        setAlert(null);
        startTransition(async () => {
            const result = await darBajaSeriesAction(grupo.bodegaId, [...selected]);
            if (result.error) {
                setAlert({ type: 'error', msg: result.error });
            } else if ('softDeleted' in result && result.softDeleted) {
                setAlert({ type: 'warning', msg: 'Los ítems tienen historial en tickets y no pueden borrarse. Su stock se ha vaciado y se han ocultado del catálogo activo.' });
                setTimeout(() => { onClose(); router.refresh(); }, 2500);
            } else {
                setAlert({ type: 'success', msg: `${selected.size} serial(es) dados de baja.` });
                setTimeout(() => { onClose(); router.refresh(); }, 700);
            }
        });
    }

    function handleAgregar() {
        if (serialesParsed.length === 0) { setAlert({ type: 'error', msg: 'Ingresa al menos un número de serie.' }); return; }
        setAlert(null);
        const fd = new FormData();
        fd.set('bodega_id', grupo.bodegaId);
        fd.set('modelo', grupo.modelo);
        fd.set('familia', grupo.familia);
        fd.set('es_serializado', 'true');
        fd.set('seriales', JSON.stringify(serialesParsed));
        startTransition(async () => {
            const result = await addStockToBodegaAction(fd);
            if (result.error) {
                setAlert({ type: 'error', msg: result.error });
            } else {
                setAlert({ type: 'success', msg: `${serialesParsed.length} serial(es) ingresados.` });
                setTimeout(() => { onClose(); router.refresh(); }, 700);
            }
        });
    }

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="fixed inset-0" onClick={onClose} />
            <div className="relative z-10 bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md max-h-[85vh] flex flex-col"
                onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-amber-100 rounded-xl"><Hash className="w-4 h-4 text-amber-600" /></div>
                        <div>
                            <p className="text-sm font-black text-slate-800">Gestionar Seriales</p>
                            <p className="text-xs text-slate-500 truncate max-w-[220px]">{grupo.modelo} · {grupo.totalUnidades} unidades</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-100 shrink-0">
                    <button onClick={() => { setTab('baja'); setAlert(null); }}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-black uppercase tracking-wide transition-colors ${
                            tab === 'baja'
                                ? 'text-red-600 border-b-2 border-red-500 bg-red-50/50'
                                : 'text-slate-400 hover:text-slate-600'
                        }`}>
                        <MinusCircle className="w-3.5 h-3.5" />
                        Dar de baja
                    </button>
                    <button onClick={() => { setTab('agregar'); setAlert(null); }}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-black uppercase tracking-wide transition-colors ${
                            tab === 'agregar'
                                ? 'text-emerald-600 border-b-2 border-emerald-500 bg-emerald-50/50'
                                : 'text-slate-400 hover:text-slate-600'
                        }`}>
                        <PlusCircle className="w-3.5 h-3.5" />
                        Agregar más
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5">
                    {alert && <div className="mb-4"><Alert type={alert.type} msg={alert.msg} /></div>}

                    {tab === 'baja' ? (
                        <div className="flex flex-col gap-2">
                            <p className="text-xs text-slate-500 mb-2">
                                Selecciona los seriales que se retiran físicamente de esta bodega.
                            </p>
                            {grupo.rows.map(row => (
                                <label key={row.id}
                                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                                        selected.has(row.id)
                                            ? 'bg-red-50 border-red-200'
                                            : 'bg-white border-slate-200 hover:bg-slate-50'
                                    }`}>
                                    <input type="checkbox" checked={selected.has(row.id)}
                                        onChange={() => toggleSerial(row.id)}
                                        className="w-4 h-4 accent-red-500 shrink-0" />
                                    <span className="font-mono text-sm font-bold text-slate-700">
                                        {row.numero_serie ?? '(sin serie)'}
                                    </span>
                                    <span className={`ml-auto text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${
                                        row.estado === 'Disponible'
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : 'bg-red-100 text-red-700'
                                    }`}>
                                        {row.estado}
                                    </span>
                                </label>
                            ))}
                            {grupo.rows.length === 0 && (
                                <p className="text-sm text-slate-400 text-center py-4">Sin seriales registrados.</p>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            <p className="text-xs text-slate-500">
                                Ingresa los nuevos números de serie, uno por línea o separados por comas.
                            </p>
                            <textarea rows={6} value={serialesRaw} onChange={e => setSerialesRaw(e.target.value)}
                                placeholder={"SN00123456\nSN00123457\nSN00123458"}
                                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-mono text-slate-800 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
                            />
                            {serialesParsed.length > 0 && (
                                <div>
                                    <p className="text-xs font-bold text-emerald-600 mb-1.5">
                                        {serialesParsed.length} serie(s) detectada(s):
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {serialesParsed.map(s => (
                                            <span key={s} className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-700">
                                                {s}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-slate-100 shrink-0 flex justify-end gap-2">
                    <button onClick={onClose} disabled={isPending}
                        className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                        Cancelar
                    </button>
                    {tab === 'baja' ? (
                        <button onClick={handleDarDeBaja} disabled={isPending || selected.size === 0}
                            className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold flex items-center gap-2 disabled:opacity-50">
                            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            Dar de baja ({selected.size})
                        </button>
                    ) : (
                        <button onClick={handleAgregar} disabled={isPending || serialesParsed.length === 0}
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center gap-2 disabled:opacity-50">
                            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            <Plus className="w-3.5 h-3.5" />
                            Registrar ({serialesParsed.length})
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Main Table ────────────────────────────────────────────────

export function BodegaStockTable({ grupos }: { grupos: StockGroup[] }) {
    const [ajustarGrupo, setAjustarGrupo] = useState<StockGroup | null>(null);

    return (
        <>
            <table className="w-full text-sm">
                <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left px-5 py-3.5 text-xs font-black text-slate-500 uppercase tracking-widest">Familia</th>
                        <th className="text-left px-5 py-3.5 text-xs font-black text-slate-500 uppercase tracking-widest">Equipo / Modelo</th>
                        <th className="text-center px-5 py-3.5 text-xs font-black text-slate-500 uppercase tracking-widest">Tipo</th>
                        <th className="text-center px-5 py-3.5 text-xs font-black text-slate-500 uppercase tracking-widest">Stock Actual</th>
                        <th className="text-right px-5 py-3.5 text-xs font-black text-slate-500 uppercase tracking-widest">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {grupos.map((g, idx) => (
                        <tr key={g.key} className={`hover:bg-slate-50/60 transition-colors ${idx % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                            <td className="px-5 py-4">
                                <span className="inline-flex items-center text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border bg-slate-100 text-slate-600 border-slate-200">
                                    {g.familia}
                                </span>
                            </td>
                            <td className="px-5 py-4">
                                <div className="flex items-center gap-2.5">
                                    <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                                        <Package className="w-4 h-4 text-indigo-600" />
                                    </div>
                                    <span className="font-bold text-slate-800">{g.modelo}</span>
                                </div>
                            </td>
                            <td className="px-5 py-4 text-center">
                                {g.es_serializado ? (
                                    <span className="inline-flex items-center text-[11px] font-bold px-2.5 py-1 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                                        Serializado
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center text-[11px] font-bold px-2.5 py-1 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                                        Genérico
                                    </span>
                                )}
                            </td>
                            <td className="px-5 py-4 text-center">
                                {g.rows.length === 0 ? (
                                    <span className="text-xs font-bold text-slate-400 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg">
                                        Sin ingresos
                                    </span>
                                ) : g.totalUnidades === 0 ? (
                                    <span className="text-sm font-black text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded-lg">
                                        🔴 0 uds
                                    </span>
                                ) : g.totalUnidades <= 3 ? (
                                    <span className="text-sm font-black text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded-lg">
                                        🔴 {g.totalUnidades} uds
                                    </span>
                                ) : g.totalUnidades <= 10 ? (
                                    <span className="text-sm font-black text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                                        🟡 {g.totalUnidades} uds
                                    </span>
                                ) : (
                                    <span className="text-sm font-black text-slate-700">
                                        {g.totalUnidades} <span className="text-xs text-slate-400 font-medium">uds</span>
                                    </span>
                                )}
                            </td>
                            <td className="px-5 py-4">
                                <div className="flex items-center justify-end gap-2">
                                    {g.rows.length === 0 ? (
                                        <span className="text-[11px] text-slate-400 font-medium italic px-3 py-1.5">
                                            Usa &ldquo;Añadir Equipo&rdquo;
                                        </span>
                                    ) : (
                                        <button onClick={() => setAjustarGrupo(g)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors">
                                            <Wrench className="w-3 h-3" />
                                            Ajustar
                                        </button>
                                    )}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {ajustarGrupo && (
                ajustarGrupo.es_serializado
                    ? <AjustarSerializadoModal grupo={ajustarGrupo} onClose={() => setAjustarGrupo(null)} />
                    : <AjustarGenericoModal grupo={ajustarGrupo} onClose={() => setAjustarGrupo(null)} />
            )}
        </>
    );
}
