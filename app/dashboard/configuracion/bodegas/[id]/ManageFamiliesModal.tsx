'use client';

import React, { useState, useTransition } from 'react';
import { Tag, Plus, Pencil, X, Loader2, AlertTriangle, CheckCircle2, Check } from 'lucide-react';
import { crearFamiliaAction, editarFamiliaAction } from './actions';
import type { FamiliaHardware } from './AddEquipoModal';

interface Props {
    familias: FamiliaHardware[];
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

export function ManageFamiliesModal({ familias }: Props) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [alert, setAlert] = useState<{ type: 'error' | 'success'; msg: string } | null>(null);

    // Create
    const [newNombre, setNewNombre] = useState('');

    // Edit
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editNombre, setEditNombre] = useState('');

    function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        setAlert(null);
        const n = newNombre.trim();
        if (!n) { setAlert({ type: 'error', msg: 'Escribe un nombre para la familia.' }); return; }

        startTransition(async () => {
            const result = await crearFamiliaAction(n);
            if (result.error) {
                setAlert({ type: 'error', msg: result.error });
            } else {
                setAlert({ type: 'success', msg: `Familia "${n}" creada.` });
                setNewNombre('');
            }
        });
    }

    function startEdit(f: FamiliaHardware) {
        setEditingId(f.id);
        setEditNombre(f.nombre);
        setAlert(null);
    }

    function cancelEdit() {
        setEditingId(null);
        setEditNombre('');
    }

    function handleEdit(id: string) {
        setAlert(null);
        const n = editNombre.trim();
        if (!n) { setAlert({ type: 'error', msg: 'El nombre no puede estar vacío.' }); return; }

        startTransition(async () => {
            const result = await editarFamiliaAction(id, n);
            if (result.error) {
                setAlert({ type: 'error', msg: result.error });
            } else {
                setAlert({ type: 'success', msg: 'Familia actualizada.' });
                setEditingId(null);
            }
        });
    }

    return (
        <>
            <button
                onClick={() => { setOpen(true); setAlert(null); setNewNombre(''); setEditingId(null); }}
                className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-sm font-bold rounded-xl border border-slate-200 shadow-sm transition-all shrink-0"
            >
                <Tag className="w-4 h-4 text-slate-500" />
                Gestionar Familias
            </button>

            {open && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="fixed inset-0" onClick={() => setOpen(false)} />
                    <div
                        className="relative z-10 bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm flex flex-col max-h-[85vh]"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-slate-100 rounded-xl">
                                    <Tag className="w-4 h-4 text-slate-600" />
                                </div>
                                <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                                    Familias de Hardware
                                </h2>
                            </div>
                            <button onClick={() => setOpen(false)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-2">
                            {alert && <Alert type={alert.type} msg={alert.msg} />}

                            {familias.length === 0 ? (
                                <p className="text-sm text-slate-400 text-center py-6">No hay familias registradas aún.</p>
                            ) : familias.map(f => (
                                <div key={f.id} className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 group transition-colors">
                                    {editingId === f.id ? (
                                        <>
                                            <input
                                                type="text"
                                                value={editNombre}
                                                onChange={e => setEditNombre(e.target.value)}
                                                autoFocus
                                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleEdit(f.id); } if (e.key === 'Escape') cancelEdit(); }}
                                                className="flex-1 rounded-lg border border-indigo-300 px-2.5 py-1.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                            />
                                            <button onClick={() => handleEdit(f.id)} disabled={isPending}
                                                className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-100 transition-colors disabled:opacity-50">
                                                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                            </button>
                                            <button onClick={cancelEdit}
                                                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 transition-colors">
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <div className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
                                            <span className="flex-1 text-sm font-bold text-slate-700">{f.nombre}</span>
                                            <button onClick={() => startEdit(f)}
                                                className="p-1.5 rounded-lg text-slate-300 hover:text-slate-600 hover:bg-slate-200 opacity-0 group-hover:opacity-100 transition-all">
                                                <Pencil className="w-3 h-3" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Create new */}
                        <div className="p-5 border-t border-slate-100 shrink-0">
                            <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Nueva Familia</p>
                            <form onSubmit={handleCreate} className="flex gap-2">
                                <input
                                    type="text"
                                    value={newNombre}
                                    onChange={e => setNewNombre(e.target.value)}
                                    placeholder="Ej: Routers, UPS, Tablets…"
                                    className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
                                />
                                <button type="submit" disabled={isPending || !newNombre.trim()}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-50 transition-colors">
                                    {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                                    Crear
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
