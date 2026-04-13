'use client';

import React, { useState, useTransition, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    BookOpen, Plus, Pencil, X,
    Loader2, AlertTriangle, CheckCircle2, Check, Package, Trash2, ChevronRight,
} from 'lucide-react';
import {
    crearFamiliaAction, editarFamiliaAction, crearModeloCatalogoAction, eliminarFamiliaAction,
    editarModeloCatalogoAction, eliminarModeloCatalogoAction,
} from './actions';
import type { FamiliaHardware } from './AddEquipoModal';

export interface ModeloCatalogo {
    id: string;
    familia_id: string;
    modelo: string;
    es_serializado: boolean;
}

interface Props {
    familias: FamiliaHardware[];
    modelosPorFamilia: Record<string, ModeloCatalogo[]>;
    bodegaId: string;
    bodegaNombre: string;
}

// ── ModeloTooltip: tooltip via portal (escapa overflow-hidden del modal) ──
function ModeloTooltip({ text, children }: { text: string; children: React.ReactNode }) {
    const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);
    const ref = useRef<HTMLDivElement>(null);

    return (
        <>
            <div
                ref={ref}
                className="flex-1 min-w-0"
                onMouseEnter={() => {
                    if (ref.current) {
                        const r = ref.current.getBoundingClientRect();
                        setCoords({ x: r.left + r.width / 2, y: r.top });
                    }
                }}
                onMouseLeave={() => setCoords(null)}
            >
                {children}
            </div>
            {coords && createPortal(
                <span
                    style={{ position: 'fixed', top: coords.y - 8, left: coords.x, transform: 'translate(-50%, -100%)', zIndex: 9999 }}
                    className="bg-slate-800 text-white text-xs font-semibold rounded-lg py-1.5 px-2.5 whitespace-nowrap pointer-events-none shadow-xl"
                >
                    {text}
                    <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                </span>,
                document.body
            )}
        </>
    );
}

function Alert({ type, msg }: { type: 'error' | 'success'; msg: string }) {
    return (
        <div className={`flex items-center gap-2 text-sm font-medium px-3 py-2.5 rounded-xl border ${
            type === 'error'
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
        }`}>
            {type === 'error'
                ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                : <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
            {msg}
        </div>
    );
}

export function CatalogoGlobalModal({ familias, modelosPorFamilia, bodegaId, bodegaNombre }: Props) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [alert, setAlert] = useState<{ type: 'error' | 'success'; msg: string } | null>(null);

    // Selected family in left column
    const [selectedFamilia, setSelectedFamilia] = useState<FamiliaHardware | null>(null);

    // Familia inline edit
    const [editingFamiliaId, setEditingFamiliaId] = useState<string | null>(null);
    const [editFamiliaNombre, setEditFamiliaNombre] = useState('');

    // Create familia
    const [newFamilia, setNewFamilia] = useState('');

    // Create modelo
    const [newModelo, setNewModelo] = useState('');
    const [newModeloSerial, setNewModeloSerial] = useState(false);

    // Modelo inline edit
    const [editingModeloId, setEditingModeloId] = useState<string | null>(null);
    const [editModeloNombre, setEditModeloNombre] = useState('');

    function resetAll() {
        setSelectedFamilia(null);
        setAlert(null);
        setEditingFamiliaId(null);
        setEditFamiliaNombre('');
        setNewFamilia('');
        setNewModelo('');
        setNewModeloSerial(false);
        setEditingModeloId(null);
        setEditModeloNombre('');
    }

    // ── Familia actions ──────────────────────────────────────────

    function handleCreateFamilia(e: React.FormEvent) {
        e.preventDefault();
        setAlert(null);
        const n = newFamilia.trim();
        if (!n) { setAlert({ type: 'error', msg: 'Escribe un nombre.' }); return; }
        startTransition(async () => {
            const result = await crearFamiliaAction(n, bodegaId);
            if (result.error) { setAlert({ type: 'error', msg: result.error }); }
            else { setAlert({ type: 'success', msg: `Familia "${n}" creada.` }); setNewFamilia(''); }
        });
    }

    function startEditFamilia(f: FamiliaHardware) {
        setEditingFamiliaId(f.id);
        setEditFamiliaNombre(f.nombre);
        setAlert(null);
    }

    function handleEditFamilia(id: string) {
        setAlert(null);
        const n = editFamiliaNombre.trim();
        if (!n) { setAlert({ type: 'error', msg: 'El nombre no puede estar vacío.' }); return; }
        startTransition(async () => {
            const result = await editarFamiliaAction(id, n);
            if (result.error) { setAlert({ type: 'error', msg: result.error }); }
            else {
                setAlert({ type: 'success', msg: 'Familia actualizada.' });
                setEditingFamiliaId(null);
            }
        });
    }

    function handleDeleteFamilia(f: FamiliaHardware) {
        setAlert(null);
        startTransition(async () => {
            const result = await eliminarFamiliaAction(f.id);
            if (result.error) { setAlert({ type: 'error', msg: result.error }); }
            else {
                setAlert({ type: 'success', msg: `Familia "${f.nombre}" eliminada.` });
                if (selectedFamilia?.id === f.id) setSelectedFamilia(null);
            }
        });
    }

    // ── Modelo actions ───────────────────────────────────────────

    function handleCreateModelo(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedFamilia) return;
        setAlert(null);
        const m = newModelo.trim();
        if (!m) { setAlert({ type: 'error', msg: 'Escribe un nombre de modelo.' }); return; }
        startTransition(async () => {
            const result = await crearModeloCatalogoAction(selectedFamilia.id, m, newModeloSerial, bodegaId);
            if (result.error) { setAlert({ type: 'error', msg: result.error }); }
            else {
                setAlert({ type: 'success', msg: `Modelo "${m}" creado.` });
                setNewModelo('');
                setNewModeloSerial(false);
            }
        });
    }

    // ── Modelo edit/delete ───────────────────────────────────────

    function startEditModelo(m: ModeloCatalogo) {
        setEditingModeloId(m.id);
        setEditModeloNombre(m.modelo);
        setAlert(null);
    }

    function handleEditModelo(id: string) {
        setAlert(null);
        const n = editModeloNombre.trim();
        if (!n) { setAlert({ type: 'error', msg: 'El nombre no puede estar vacío.' }); return; }
        startTransition(async () => {
            const result = await editarModeloCatalogoAction(id, n, bodegaId);
            if (result.error) { setAlert({ type: 'error', msg: result.error }); }
            else {
                setAlert({ type: 'success', msg: 'Modelo actualizado.' });
                setEditingModeloId(null);
            }
        });
    }

    function handleDeleteModelo(m: ModeloCatalogo) {
        setAlert(null);
        startTransition(async () => {
            const result = await eliminarModeloCatalogoAction(m.id, bodegaId);
            if (result.error) { setAlert({ type: 'error', msg: result.error }); }
            else {
                setAlert({ type: 'success', msg: `Modelo "${m.modelo}" eliminado.` });
                if (editingModeloId === m.id) setEditingModeloId(null);
            }
        });
    }

    const modelosActivos = selectedFamilia ? (modelosPorFamilia[selectedFamilia.id] ?? []) : [];

    return (
        <>
            <button
                onClick={() => { resetAll(); setOpen(true); }}
                className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-sm font-bold rounded-xl border border-slate-200 shadow-sm transition-all shrink-0"
            >
                <BookOpen className="w-4 h-4 text-slate-500" />
                Catálogo de Equipos
            </button>

            {open && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="fixed inset-0" onClick={() => setOpen(false)} />
                    <div
                        className="relative z-10 bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl flex flex-col"
                        style={{ maxHeight: 'calc(100vh - 2rem)' }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* ── Header ───────────────────────────── */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-100 rounded-xl">
                                    <BookOpen className="w-4 h-4 text-slate-600" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide">Catálogo de Equipos — {bodegaNombre}</h2>
                                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">
                                        {familias.length} familia{familias.length !== 1 ? 's' : ''} · {Object.values(modelosPorFamilia).flat().length} modelo{Object.values(modelosPorFamilia).flat().length !== 1 ? 's' : ''}
                                    </p>
                                </div>
                            </div>
                            {alert && (
                                <div className="flex-1 mx-6">
                                    <Alert type={alert.type} msg={alert.msg} />
                                </div>
                            )}
                            <button onClick={() => setOpen(false)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* ── Two-column body ───────────────────── */}
                        <div className="flex flex-1 min-h-0 overflow-hidden">

                            {/* ── LEFT: Familias ─────────────────── */}
                            <div className="w-72 shrink-0 border-r border-slate-100 flex flex-col bg-slate-50/40">
                                <div className="px-4 py-3 border-b border-slate-100">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Familias</p>
                                </div>

                                {/* List */}
                                <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1">
                                    {familias.length === 0 && (
                                        <p className="text-xs text-slate-400 text-center py-6">Sin familias aún.</p>
                                    )}
                                    {familias.map(f => (
                                        <div
                                            key={f.id}
                                            className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all cursor-pointer ${
                                                selectedFamilia?.id === f.id
                                                    ? 'bg-indigo-50 border-indigo-200 shadow-sm'
                                                    : 'bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                                            }`}
                                            onClick={() => {
                                                if (editingFamiliaId !== f.id) {
                                                    setSelectedFamilia(f);
                                                    setAlert(null);
                                                    setNewModelo('');
                                                    setNewModeloSerial(false);
                                                }
                                            }}
                                        >
                                            {editingFamiliaId === f.id ? (
                                                <>
                                                    <input
                                                        type="text"
                                                        value={editFamiliaNombre}
                                                        onChange={e => setEditFamiliaNombre(e.target.value)}
                                                        autoFocus
                                                        onClick={e => e.stopPropagation()}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') { e.preventDefault(); handleEditFamilia(f.id); }
                                                            if (e.key === 'Escape') setEditingFamiliaId(null);
                                                        }}
                                                        className="flex-1 min-w-0 rounded-lg border border-indigo-300 px-2 py-1 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                                    />
                                                    <button
                                                        onClick={e => { e.stopPropagation(); handleEditFamilia(f.id); }}
                                                        disabled={isPending}
                                                        className="p-1 rounded-lg text-emerald-600 hover:bg-emerald-100 disabled:opacity-50 shrink-0">
                                                        {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                                    </button>
                                                    <button
                                                        onClick={e => { e.stopPropagation(); setEditingFamiliaId(null); }}
                                                        className="p-1 rounded-lg text-slate-400 hover:bg-slate-200 shrink-0">
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <ChevronRight className={`w-3.5 h-3.5 shrink-0 transition-colors ${selectedFamilia?.id === f.id ? 'text-indigo-500' : 'text-slate-300'}`} />
                                                    <span className={`flex-1 min-w-0 text-sm font-bold truncate ${selectedFamilia?.id === f.id ? 'text-indigo-700' : 'text-slate-700'}`}>
                                                        {f.nombre}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 font-medium shrink-0">
                                                        {(modelosPorFamilia[f.id] ?? []).length}
                                                    </span>
                                                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                        <button
                                                            onClick={e => { e.stopPropagation(); startEditFamilia(f); }}
                                                            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors">
                                                            <Pencil className="w-3 h-3" />
                                                        </button>
                                                        <button
                                                            onClick={e => { e.stopPropagation(); handleDeleteFamilia(f); }}
                                                            disabled={isPending}
                                                            className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 transition-colors">
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {/* Create familia */}
                                <div className="p-3 border-t border-slate-100 shrink-0">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nueva Familia</p>
                                    <form onSubmit={handleCreateFamilia} className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newFamilia}
                                            onChange={e => setNewFamilia(e.target.value)}
                                            placeholder="Ej: Routers, UPS…"
                                            className="flex-1 min-w-0 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
                                        />
                                        <button type="submit" disabled={isPending || !newFamilia.trim()}
                                            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50 transition-colors shrink-0">
                                            {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                                            Crear
                                        </button>
                                    </form>
                                </div>
                            </div>

                            {/* ── RIGHT: Modelos ─────────────────── */}
                            <div className="flex-1 flex flex-col min-w-0">
                                {!selectedFamilia ? (
                                    <div className="flex-1 flex items-center justify-center text-center p-12">
                                        <div>
                                            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                                                <Package className="w-7 h-7 text-slate-300" />
                                            </div>
                                            <p className="text-sm font-bold text-slate-400">Selecciona una familia</p>
                                            <p className="text-xs text-slate-400 mt-1">para ver y gestionar sus modelos</p>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {/* Right header */}
                                        <div className="px-6 py-3 border-b border-slate-100 shrink-0 flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-black text-slate-800">{selectedFamilia.nombre}</p>
                                                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">
                                                    {modelosActivos.length} modelo{modelosActivos.length !== 1 ? 's' : ''}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Models list */}
                                        <div className="flex-1 overflow-y-auto p-5">
                                            {modelosActivos.length === 0 ? (
                                                <div className="text-center py-10 text-slate-400">
                                                    <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                                    <p className="text-sm font-semibold">Sin modelos en esta familia</p>
                                                    <p className="text-xs mt-1">Crea el primero con el formulario de abajo.</p>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                                    {modelosActivos.map(m => (
                                                        <div key={m.id}
                                                            className="group flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-100 bg-white hover:border-slate-200 hover:shadow-sm transition-all">
                                                            {editingModeloId === m.id ? (
                                                                <>
                                                                    <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                                                                        <Package className="w-4 h-4 text-indigo-600" />
                                                                    </div>
                                                                    <input
                                                                        type="text"
                                                                        value={editModeloNombre}
                                                                        onChange={e => setEditModeloNombre(e.target.value)}
                                                                        autoFocus
                                                                        onKeyDown={e => {
                                                                            if (e.key === 'Enter') { e.preventDefault(); handleEditModelo(m.id); }
                                                                            if (e.key === 'Escape') setEditingModeloId(null);
                                                                        }}
                                                                        className="flex-1 min-w-0 rounded-lg border border-indigo-300 px-2 py-1 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                                                    />
                                                                    <button
                                                                        onClick={() => handleEditModelo(m.id)}
                                                                        disabled={isPending}
                                                                        className="p-1 rounded-lg text-emerald-600 hover:bg-emerald-100 disabled:opacity-50 shrink-0">
                                                                        {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setEditingModeloId(null)}
                                                                        className="p-1 rounded-lg text-slate-400 hover:bg-slate-200 shrink-0">
                                                                        <X className="w-3 h-3" />
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                                                                        <Package className="w-4 h-4 text-indigo-600" />
                                                                    </div>
                                                                    <ModeloTooltip text={m.modelo}>
                                                                        <span className="text-sm font-bold text-slate-700 truncate block">{m.modelo}</span>
                                                                    </ModeloTooltip>
                                                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border shrink-0 ${
                                                                        m.es_serializado
                                                                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                                    }`}>
                                                                        {m.es_serializado ? 'Serial' : 'Genérico'}
                                                                    </span>
                                                                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                                        <button
                                                                            onClick={() => startEditModelo(m)}
                                                                            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors">
                                                                            <Pencil className="w-3 h-3" />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleDeleteModelo(m)}
                                                                            disabled={isPending}
                                                                            className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 transition-colors">
                                                                            <Trash2 className="w-3 h-3" />
                                                                        </button>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Create modelo footer */}
                                        <div className="p-5 border-t border-slate-100 shrink-0 bg-slate-50/40">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                                                + Nuevo Modelo en &quot;{selectedFamilia.nombre}&quot;
                                            </p>
                                            <form onSubmit={handleCreateModelo} className="flex items-end gap-3">
                                                <div className="flex-1">
                                                    <input
                                                        type="text"
                                                        value={newModelo}
                                                        onChange={e => setNewModelo(e.target.value)}
                                                        placeholder="Ej: POS CX7, Monitor 27''…"
                                                        className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent bg-white"
                                                    />
                                                </div>
                                                <div className="flex gap-1.5 shrink-0">
                                                    <button type="button" onClick={() => setNewModeloSerial(false)}
                                                        className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition-colors ${
                                                            !newModeloSerial
                                                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                                        }`}>
                                                        Genérico
                                                    </button>
                                                    <button type="button" onClick={() => setNewModeloSerial(true)}
                                                        className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition-colors ${
                                                            newModeloSerial
                                                                ? 'bg-amber-500 border-amber-500 text-white'
                                                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                                        }`}>
                                                        Serializado
                                                    </button>
                                                </div>
                                                <button type="submit" disabled={isPending || !newModelo.trim()}
                                                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold disabled:opacity-50 transition-colors shrink-0">
                                                    {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                                                    Crear Modelo
                                                </button>
                                            </form>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
