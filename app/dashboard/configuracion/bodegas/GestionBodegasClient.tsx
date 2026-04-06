'use client';

import React, { useState, useTransition } from 'react';
import {
    Warehouse, Plus, Pencil, Loader2, AlertTriangle, CheckCircle2,
    X, Search, ToggleLeft, ToggleRight, ChevronLeft, PackageSearch,
} from 'lucide-react';
import { crearBodegaAction, editarBodegaAction, toggleActivoBodegaAction } from './actions';
import Link from 'next/link';

// ── Types ──────────────────────────────────────────────────────
interface Bodega {
    id: string;
    nombre: string;
    tipo: string;
    descripcion: string | null;
    activo: boolean | null;
}

// ── Constants ──────────────────────────────────────────────────
const TIPO_COLORS: Record<string, string> = {
    interna: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    mochila: 'bg-amber-100 text-amber-700 border-amber-200',
    virtual: 'bg-slate-100 text-slate-500 border-slate-200',
};

function tipoBadgeClass(tipo: string) {
    return TIPO_COLORS[tipo?.toLowerCase()] ?? 'bg-slate-100 text-slate-600 border-slate-200';
}

// ── Backdrop ───────────────────────────────────────────────────
function ModalBackdrop({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="fixed inset-0" onClick={onClose} />
            {children}
        </div>
    );
}

// ── Inline alert ───────────────────────────────────────────────
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

// ── FormField ──────────────────────────────────────────────────
function FormField({ label, name, type = 'text', required, defaultValue, placeholder, autoFocus }: {
    label: string; name: string; type?: string;
    required?: boolean; defaultValue?: string; placeholder?: string; autoFocus?: boolean;
}) {
    return (
        <div>
            <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-1.5">
                {label}{required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
                name={name}
                type={type}
                required={required}
                defaultValue={defaultValue ?? ''}
                placeholder={placeholder}
                autoFocus={autoFocus}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
            />
        </div>
    );
}

// ── TextareaField ──────────────────────────────────────────────
function TextareaField({ label, name, defaultValue, placeholder }: {
    label: string; name: string; defaultValue?: string; placeholder?: string;
}) {
    return (
        <div>
            <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-1.5">
                {label}
            </label>
            <textarea
                name={name}
                rows={3}
                defaultValue={defaultValue ?? ''}
                placeholder={placeholder}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
            />
        </div>
    );
}

// ── BodegaFormModal ────────────────────────────────────────────
function BodegaFormModal({
    mode, bodega, onClose,
}: {
    mode: 'create' | 'edit';
    bodega?: Bodega;
    onClose: () => void;
}) {
    const [isPending, startTransition] = useTransition();
    const [alert, setAlert] = useState<{ type: 'error' | 'success'; msg: string } | null>(null);

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        if (bodega) fd.append('id', bodega.id);

        startTransition(async () => {
            const result = mode === 'create'
                ? await crearBodegaAction(fd)
                : await editarBodegaAction(fd);

            if (result.error) {
                setAlert({ type: 'error', msg: result.error });
            } else {
                setAlert({ type: 'success', msg: mode === 'create' ? 'Bodega creada exitosamente.' : 'Bodega actualizada.' });
                setTimeout(onClose, 900);
            }
        });
    };

    return (
        <ModalBackdrop onClose={onClose}>
            <div
                className="relative z-10 bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-emerald-100 rounded-xl">
                            <Warehouse className="w-4 h-4 text-emerald-600" />
                        </div>
                        <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                            {mode === 'create' ? 'Nueva Bodega' : 'Editar Bodega'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
                    {alert && <Alert type={alert.type} msg={alert.msg} />}

                    <FormField
                        label="Nombre de Bodega"
                        name="nombre"
                        required
                        defaultValue={bodega?.nombre}
                        placeholder="Ej: Bodega Central Santiago"
                        autoFocus
                    />
                    <TextareaField
                        label="Descripción (opcional)"
                        name="descripcion"
                        defaultValue={bodega?.descripcion ?? ''}
                        placeholder="Descripción breve de la bodega o su ubicación física…"
                    />

                    <div className="flex justify-end gap-2 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isPending}
                            className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isPending}
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            {mode === 'create' ? 'Crear Bodega' : 'Guardar Cambios'}
                        </button>
                    </div>
                </form>
            </div>
        </ModalBackdrop>
    );
}

// ── ToggleConfirmModal ─────────────────────────────────────────
function ToggleConfirmModal({
    bodega, onClose,
}: {
    bodega: Bodega;
    onClose: () => void;
}) {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState('');
    const nextActivo = !bodega.activo;

    const handleConfirm = () => {
        startTransition(async () => {
            const result = await toggleActivoBodegaAction(bodega.id, nextActivo);
            if (result.error) {
                setError(result.error);
            } else {
                onClose();
            }
        });
    };

    return (
        <ModalBackdrop onClose={onClose}>
            <div
                className="relative z-10 bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm p-6 flex flex-col gap-4"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${nextActivo ? 'bg-emerald-100' : 'bg-red-100'}`}>
                        {nextActivo
                            ? <ToggleRight className="w-5 h-5 text-emerald-600" />
                            : <ToggleLeft className="w-5 h-5 text-red-500" />}
                    </div>
                    <div>
                        <p className="text-sm font-black text-slate-800">
                            {nextActivo ? 'Activar bodega' : 'Desactivar bodega'}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">{bodega.nombre}</p>
                    </div>
                </div>

                <p className="text-sm text-slate-600">
                    {nextActivo
                        ? 'La bodega volverá a estar disponible para recibir inventario.'
                        : 'La bodega quedará inactiva y no podrá recibir inventario hasta ser reactivada.'}
                </p>

                {error && <Alert type="error" msg={error} />}

                <div className="flex justify-end gap-2">
                    <button onClick={onClose} disabled={isPending}
                        className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
                        Cancelar
                    </button>
                    <button onClick={handleConfirm} disabled={isPending}
                        className={`px-4 py-2 rounded-xl text-white text-sm font-bold transition-colors disabled:opacity-50 flex items-center gap-2 ${nextActivo ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-500 hover:bg-red-600'}`}>
                        {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        {nextActivo ? 'Activar' : 'Desactivar'}
                    </button>
                </div>
            </div>
        </ModalBackdrop>
    );
}

// ── Main Component ─────────────────────────────────────────────
export function GestionBodegasClient({ bodegas }: { bodegas: Bodega[] }) {
    const [search, setSearch] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [editBodega, setEditBodega] = useState<Bodega | null>(null);
    const [toggleBodega, setToggleBodega] = useState<Bodega | null>(null);

    const filtered = bodegas.filter(b =>
        b.nombre.toLowerCase().includes(search.toLowerCase()) ||
        b.tipo?.toLowerCase().includes(search.toLowerCase())
    );

    const activas = bodegas.filter(b => b.activo !== false).length;

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <Link
                        href="/dashboard/configuracion"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors mb-3"
                    >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        Configuración
                    </Link>
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-emerald-100 rounded-2xl">
                            <Warehouse className="w-7 h-7 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Inventario</p>
                            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Bodegas del Sistema</h1>
                        </div>
                    </div>
                </div>

                <button
                    onClick={() => setShowCreate(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-sm transition-all shrink-0"
                >
                    <Plus className="w-4 h-4" />
                    Nueva Bodega
                </button>
            </div>

            {/* Stats bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Total bodegas', value: bodegas.length, color: 'text-slate-700' },
                    { label: 'Activas', value: activas, color: 'text-emerald-600' },
                    { label: 'Inactivas', value: bodegas.length - activas, color: 'text-red-500' },
                    { label: 'Tipos distintos', value: new Set(bodegas.map(b => b.tipo)).size, color: 'text-indigo-600' },
                ].map(stat => (
                    <div key={stat.label} className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex flex-col gap-0.5 shadow-sm">
                        <span className={`text-xl font-black ${stat.color}`}>{stat.value}</span>
                        <span className="text-xs font-medium text-slate-500">{stat.label}</span>
                    </div>
                ))}
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                    type="text"
                    placeholder="Buscar por nombre o tipo…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent bg-white shadow-sm"
                />
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="text-left px-5 py-3.5 text-xs font-black text-slate-500 uppercase tracking-widest">Nombre de Bodega</th>
                            <th className="text-left px-5 py-3.5 text-xs font-black text-slate-500 uppercase tracking-widest">Tipo / Locación</th>
                            <th className="text-left px-5 py-3.5 text-xs font-black text-slate-500 uppercase tracking-widest">Descripción</th>
                            <th className="text-center px-5 py-3.5 text-xs font-black text-slate-500 uppercase tracking-widest">Estado</th>
                            <th className="text-right px-5 py-3.5 text-xs font-black text-slate-500 uppercase tracking-widest">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="text-center py-16 text-slate-400">
                                    <Warehouse className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                    <p className="font-semibold text-sm">
                                        {search ? 'Sin resultados para tu búsqueda' : 'No hay bodegas registradas'}
                                    </p>
                                    {!search && (
                                        <p className="text-xs mt-1">Haz clic en "Nueva Bodega" para comenzar</p>
                                    )}
                                </td>
                            </tr>
                        ) : filtered.map((b, idx) => (
                            <tr key={b.id} className={`hover:bg-slate-50/60 transition-colors ${idx % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                                {/* Nombre */}
                                <td className="px-5 py-4">
                                    <div className="flex items-center gap-2.5">
                                        <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                                            <Warehouse className="w-4 h-4 text-emerald-600" />
                                        </div>
                                        <span className="font-bold text-slate-800">{b.nombre}</span>
                                    </div>
                                </td>

                                {/* Tipo */}
                                <td className="px-5 py-4">
                                    <span className={`inline-flex items-center text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border ${tipoBadgeClass(b.tipo)}`}>
                                        {b.tipo}
                                    </span>
                                </td>

                                {/* Descripción */}
                                <td className="px-5 py-4 max-w-[220px]">
                                    <span className="text-xs text-slate-500 truncate block">
                                        {b.descripcion || <span className="italic text-slate-300">Sin descripción</span>}
                                    </span>
                                </td>

                                {/* Estado */}
                                <td className="px-5 py-4 text-center">
                                    {b.activo !== false ? (
                                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                                            Activa
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full">
                                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />
                                            Inactiva
                                        </span>
                                    )}
                                </td>

                                {/* Acciones */}
                                <td className="px-5 py-4">
                                    <div className="flex items-center justify-end gap-2">
                                        <Link
                                            href={`/dashboard/configuracion/bodegas/${b.id}`}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 text-xs font-bold text-emerald-700 hover:bg-emerald-50 transition-colors"
                                        >
                                            <PackageSearch className="w-3 h-3" />
                                            Gestionar
                                        </Link>
                                        <button
                                            onClick={() => setEditBodega(b)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                                        >
                                            <Pencil className="w-3 h-3" />
                                            Editar
                                        </button>
                                        <button
                                            onClick={() => setToggleBodega(b)}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors ${
                                                b.activo !== false
                                                    ? 'border-red-200 text-red-600 hover:bg-red-50'
                                                    : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                                            }`}
                                        >
                                            {b.activo !== false
                                                ? <><ToggleLeft className="w-3 h-3" /> Desactivar</>
                                                : <><ToggleRight className="w-3 h-3" /> Activar</>}
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {filtered.length > 0 && (
                    <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-400 font-medium">
                        Mostrando {filtered.length} de {bodegas.length} bodegas
                    </div>
                )}
            </div>

            {/* Modals */}
            {showCreate && (
                <BodegaFormModal mode="create" onClose={() => setShowCreate(false)} />
            )}
            {editBodega && (
                <BodegaFormModal mode="edit" bodega={editBodega} onClose={() => setEditBodega(null)} />
            )}
            {toggleBodega && (
                <ToggleConfirmModal bodega={toggleBodega} onClose={() => setToggleBodega(null)} />
            )}
        </div>
    );
}
