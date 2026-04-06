'use client';

import React, { useState, useTransition, useRef, useEffect, useMemo } from 'react';
import { Plus, X, Loader2, AlertTriangle, CheckCircle2, Package, ChevronDown, Hash } from 'lucide-react';
import { addStockToBodegaAction } from './actions';

export interface CatalogoItem {
    modelo: string;
    familia: string;
    es_serializado: boolean;
}

export interface FamiliaHardware {
    id: string;
    nombre: string;
}

interface Props {
    bodegaId: string;
    catalogo: CatalogoItem[];
    familias: FamiliaHardware[];
}

function Alert({ type, msg }: { type: 'error' | 'success'; msg: string }) {
    return (
        <div className={`flex items-center gap-2 text-sm font-medium px-4 py-3 rounded-xl border ${
            type === 'error'
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
        }`}>
            {type === 'error'
                ? <AlertTriangle className="w-4 h-4 shrink-0" />
                : <CheckCircle2 className="w-4 h-4 shrink-0" />}
            {msg}
        </div>
    );
}

// Parse serials from a textarea: splits on commas and newlines, trims, deduplicates
function parseSerials(raw: string): string[] {
    return [...new Set(
        raw.split(/[\n,]+/)
            .map(s => s.trim())
            .filter(Boolean)
    )];
}

export function AddEquipoModal({ bodegaId, catalogo, familias }: Props) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [alert, setAlert] = useState<{ type: 'error' | 'success'; msg: string } | null>(null);

    // Combobox state
    const [query, setQuery] = useState('');
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [selected, setSelected] = useState<CatalogoItem | null>(null);
    const [isNew, setIsNew] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // New-item extra fields
    const [familiaId, setFamiliaId] = useState('');
    const [esSerializado, setEsSerializado] = useState(false);

    // Input per type
    const [cantidad, setCantidad] = useState(1);
    const [serialesRaw, setSerialesRaw] = useState('');

    // Derived
    const esSerializadoFinal = isNew ? esSerializado : (selected?.es_serializado ?? false);
    const serialesParsed = useMemo(() => parseSerials(serialesRaw), [serialesRaw]);

    const uniqueModelos = useMemo(() =>
        catalogo.filter((item, idx, arr) => arr.findIndex(i => i.modelo === item.modelo) === idx),
        [catalogo]
    );

    const filtered = query.length === 0
        ? uniqueModelos
        : uniqueModelos.filter(i => i.modelo.toLowerCase().includes(query.toLowerCase()));

    const exactMatch = uniqueModelos.some(i => i.modelo.toLowerCase() === query.toLowerCase());

    useEffect(() => {
        function handler(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setDropdownOpen(false);
            }
        }
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    function resetForm() {
        setQuery(''); setSelected(null); setIsNew(false);
        setFamiliaId(''); setEsSerializado(false);
        setCantidad(1); setSerialesRaw('');
        setAlert(null); setDropdownOpen(false);
    }

    function handleClose() { resetForm(); setOpen(false); }

    function selectExisting(item: CatalogoItem) {
        setSelected(item);
        setQuery(item.modelo);
        setIsNew(false);
        setSerialesRaw('');
        setCantidad(1);
        setDropdownOpen(false);
    }

    function selectNew() {
        setSelected(null);
        setIsNew(true);
        setFamiliaId('');
        setEsSerializado(false);
        setSerialesRaw('');
        setCantidad(1);
        setDropdownOpen(false);
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setAlert(null);

        const modelo = query.trim();
        if (!modelo) { setAlert({ type: 'error', msg: 'Debes indicar un modelo.' }); return; }

        let familiaFinal = '';
        if (isNew) {
            const fam = familias.find(f => f.id === familiaId);
            if (!fam) { setAlert({ type: 'error', msg: 'Selecciona una familia.' }); return; }
            familiaFinal = fam.nombre;
        } else if (selected) {
            familiaFinal = selected.familia;
        } else {
            setAlert({ type: 'error', msg: 'Selecciona un modelo de la lista o crea uno nuevo.' }); return;
        }

        if (esSerializadoFinal) {
            if (serialesParsed.length === 0) {
                setAlert({ type: 'error', msg: 'Ingresa al menos un número de serie.' }); return;
            }
        } else {
            if (isNaN(cantidad) || cantidad < 1) {
                setAlert({ type: 'error', msg: 'La cantidad debe ser al menos 1.' }); return;
            }
        }

        const fd = new FormData();
        fd.set('bodega_id', bodegaId);
        fd.set('modelo', modelo);
        fd.set('familia', familiaFinal);
        fd.set('es_serializado', String(esSerializadoFinal));

        if (esSerializadoFinal) {
            fd.set('seriales', JSON.stringify(serialesParsed));
        } else {
            fd.set('cantidad', String(cantidad));
        }

        startTransition(async () => {
            const result = await addStockToBodegaAction(fd);
            if (result.error) {
                setAlert({ type: 'error', msg: result.error });
            } else {
                setAlert({ type: 'success', msg: 'Stock registrado exitosamente.' });
                setTimeout(handleClose, 900);
            }
        });
    }

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-sm transition-all shrink-0"
            >
                <Plus className="w-4 h-4" />
                Añadir Equipo / Stock
            </button>

            {open && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="fixed inset-0" onClick={handleClose} />
                    <div
                        className="relative z-10 bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-emerald-100 rounded-xl">
                                    <Package className="w-4 h-4 text-emerald-600" />
                                </div>
                                <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                                    Añadir Equipo / Stock
                                </h2>
                            </div>
                            <button onClick={handleClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
                            {alert && <Alert type={alert.type} msg={alert.msg} />}

                            {/* ── Combobox ── */}
                            <div ref={dropdownRef} className="relative">
                                <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-1.5">
                                    Equipo / Modelo <span className="text-red-500 ml-1">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        autoComplete="off"
                                        value={query}
                                        onChange={e => {
                                            setQuery(e.target.value);
                                            setSelected(null);
                                            setIsNew(false);
                                            setDropdownOpen(true);
                                        }}
                                        onFocus={() => setDropdownOpen(true)}
                                        placeholder="Buscar o escribir nuevo modelo…"
                                        className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 pr-9 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
                                    />
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                </div>

                                {dropdownOpen && query.length > 0 && (
                                    <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                        {filtered.map((item, idx) => (
                                            <button key={idx} type="button" onMouseDown={() => selectExisting(item)}
                                                className="w-full text-left px-4 py-2.5 hover:bg-emerald-50 flex flex-col gap-0.5 border-b border-slate-50 last:border-0">
                                                <span className="text-sm font-bold text-slate-800">{item.modelo}</span>
                                                <span className="text-xs text-slate-400">
                                                    {item.familia} · {item.es_serializado ? 'Serializado' : 'Genérico'}
                                                </span>
                                            </button>
                                        ))}
                                        {!exactMatch && query.trim().length > 0 && (
                                            <button type="button" onMouseDown={selectNew}
                                                className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 flex items-center gap-2 text-indigo-700">
                                                <Plus className="w-3.5 h-3.5 shrink-0" />
                                                <span className="text-sm font-bold">
                                                    Crear nuevo: <span className="italic">"{query.trim()}"</span>
                                                </span>
                                            </button>
                                        )}
                                    </div>
                                )}

                                {selected && (
                                    <p className="mt-1 text-xs text-emerald-600 font-semibold">
                                        ✓ Modelo existente — {selected.familia} · {selected.es_serializado ? 'Serializado' : 'Genérico'}
                                    </p>
                                )}
                                {isNew && (
                                    <p className="mt-1 text-xs text-indigo-600 font-semibold">
                                        + Nuevo modelo — completa familia y tipo de manejo
                                    </p>
                                )}
                            </div>

                            {/* ── Extra fields for NEW equipment ── */}
                            {isNew && (
                                <div className="flex flex-col gap-4 pl-4 border-l-2 border-indigo-200">
                                    {/* Familia SELECT */}
                                    <div>
                                        <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-1.5">
                                            Familia <span className="text-red-500 ml-1">*</span>
                                        </label>
                                        <select
                                            value={familiaId}
                                            onChange={e => setFamiliaId(e.target.value)}
                                            autoFocus
                                            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                                        >
                                            <option value="" disabled>Selecciona una familia…</option>
                                            {familias.map(f => (
                                                <option key={f.id} value={f.id}>{f.nombre}</option>
                                            ))}
                                        </select>
                                        <p className="mt-1 text-[11px] text-slate-400">
                                            ¿No ves la familia? Usa el botón <span className="font-bold">Gestionar Familias</span> del encabezado.
                                        </p>
                                    </div>

                                    {/* Tipo de manejo */}
                                    <div>
                                        <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-2">
                                            Tipo de Manejo <span className="text-red-500 ml-1">*</span>
                                        </label>
                                        <div className="flex gap-3">
                                            <button type="button" onClick={() => { setEsSerializado(false); setSerialesRaw(''); }}
                                                className={`flex-1 py-2 rounded-xl border text-xs font-bold transition-colors ${
                                                    !esSerializado ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                                }`}>
                                                Genérico
                                            </button>
                                            <button type="button" onClick={() => { setEsSerializado(true); setCantidad(1); }}
                                                className={`flex-1 py-2 rounded-xl border text-xs font-bold transition-colors ${
                                                    esSerializado ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                                }`}>
                                                Serializado
                                            </button>
                                        </div>
                                        <p className="mt-1.5 text-[11px] text-slate-400">
                                            {esSerializado
                                                ? 'Trackea cada unidad por número de serie.'
                                                : 'Trackea por cantidad (cables, accesorios, etc.).'}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* ── Input reactivo: seriales o cantidad ── */}
                            {(selected || isNew) && (
                                esSerializadoFinal ? (
                                    /* SERIALIZED: textarea for serial numbers */
                                    <div>
                                        <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-1.5">
                                            Números de Serie <span className="text-red-500 ml-1">*</span>
                                        </label>
                                        <textarea
                                            rows={5}
                                            value={serialesRaw}
                                            onChange={e => setSerialesRaw(e.target.value)}
                                            placeholder={"Pega o escribe un serial por línea, o separados por comas:\n\nSN00123456\nSN00123457\nSN00123458"}
                                            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-mono text-slate-800 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                                        />
                                        <div className="mt-1.5 flex items-center gap-2">
                                            <Hash className="w-3.5 h-3.5 text-amber-500" />
                                            <span className={`text-xs font-bold ${serialesParsed.length > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                                                {serialesParsed.length > 0
                                                    ? `${serialesParsed.length} serie${serialesParsed.length > 1 ? 's' : ''} única${serialesParsed.length > 1 ? 's' : ''} detectada${serialesParsed.length > 1 ? 's' : ''}`
                                                    : 'Sin series ingresadas aún'}
                                            </span>
                                        </div>
                                        {serialesParsed.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                                                {serialesParsed.map(s => (
                                                    <span key={s} className="inline-flex items-center text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-700">
                                                        {s}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    /* GENERIC: numeric quantity */
                                    <div>
                                        <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-1.5">
                                            Cantidad a ingresar <span className="text-red-500 ml-1">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            min={1}
                                            value={cantidad}
                                            onChange={e => setCantidad(parseInt(e.target.value, 10) || 1)}
                                            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
                                        />
                                        {selected && (
                                            <p className="mt-1 text-[11px] text-slate-400">
                                                Si ya hay stock de este modelo en esta bodega, la cantidad se sumará al existente.
                                            </p>
                                        )}
                                    </div>
                                )
                            )}

                            <div className="flex justify-end gap-2 pt-1">
                                <button type="button" onClick={handleClose} disabled={isPending}
                                    className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
                                    Cancelar
                                </button>
                                <button type="submit" disabled={isPending || (!selected && !isNew)}
                                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-colors disabled:opacity-50 flex items-center gap-2">
                                    {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                    Registrar Stock
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
