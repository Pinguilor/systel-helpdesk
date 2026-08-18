'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
    Plus, Pencil, Trash2, ChevronDown, Loader2,
    Building2, AlertTriangle, Mail, Phone, MapPin,
} from 'lucide-react';
import {
    eliminarProveedorAction,
    getProveedoresAdminAction,
    type ProveedorDetalle,
} from '../actions';
import { ProveedorFormModal } from './ProveedorFormModal';

interface Props {
    proveedoresIniciales: ProveedorDetalle[];
    total:                number;
}

export function ProveedoresClient({ proveedoresIniciales, total: totalInicial }: Props) {
    const router = useRouter();
    const [proveedores, setProveedores] = useState(proveedoresIniciales);
    const [total,       setTotal]       = useState(totalInicial);
    const [page,        setPage]        = useState(0);
    const [loadPending, startLoad]      = useTransition();

    // ── Modal crear / editar ─────────────────────────────────────
    const [modalMode,  setModalMode]  = useState<'create' | 'edit' | null>(null);
    const [editTarget, setEditTarget] = useState<ProveedorDetalle | null>(null);

    // ── Modal eliminar ───────────────────────────────────────────
    const [deleteTarget,  setDeleteTarget]  = useState<ProveedorDetalle | null>(null);
    const [deleteError,   setDeleteError]   = useState<string | null>(null);
    const [deletePending, startDelete]      = useTransition();

    // ── Handlers ─────────────────────────────────────────────────

    function openCreate() {
        setEditTarget(null);
        setModalMode('create');
    }

    function openEdit(p: ProveedorDetalle) {
        setEditTarget(p);
        setModalMode('edit');
    }

    function handleSaved(saved: ProveedorDetalle) {
        if (modalMode === 'create') {
            setProveedores(prev =>
                [...prev, saved].sort((a, b) =>
                    a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
                )
            );
            setTotal(t => t + 1);
        } else {
            setProveedores(prev => prev.map(p => p.id === saved.id ? saved : p));
        }
        setModalMode(null);
        router.refresh();
    }

    function confirmDelete(p: ProveedorDetalle) {
        setDeleteTarget(p);
        setDeleteError(null);
    }

    function closeDeleteModal() {
        setDeleteTarget(null);
        setDeleteError(null);
    }

    function executeDelete() {
        if (!deleteTarget) return;
        startDelete(async () => {
            const result = await eliminarProveedorAction(deleteTarget.id);
            if (result.error) {
                setDeleteError(result.error);
                return;
            }
            setProveedores(prev => prev.filter(p => p.id !== deleteTarget.id));
            setTotal(t => t - 1);
            closeDeleteModal();
            router.refresh();
        });
    }

    function loadMore() {
        const nextPage = page + 1;
        startLoad(async () => {
            const result = await getProveedoresAdminAction(nextPage, 25);
            if (!result.error) {
                setProveedores(prev => [...prev, ...result.data]);
                setTotal(result.total);
                setPage(nextPage);
            }
        });
    }

    // ── Render ───────────────────────────────────────────────────

    return (
        <>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="h-1.5 w-full bg-gradient-to-r from-violet-500 to-indigo-600" />

            {/* Barra superior */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <p className="text-xs font-black text-slate-500">
                    {total} proveedor{total !== 1 ? 'es' : ''} registrado{total !== 1 ? 's' : ''}
                </p>
                <button
                    type="button"
                    onClick={openCreate}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black text-white bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                    <Plus className="w-4 h-4" />
                    Nuevo Proveedor
                </button>
            </div>

            {/* Empty state */}
            {proveedores.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <div className="w-16 h-16 rounded-2xl bg-violet-50 border border-violet-200 flex items-center justify-center">
                        <Building2 className="w-8 h-8 text-violet-300" strokeWidth={1.4} />
                    </div>
                    <p className="text-sm font-bold text-slate-500">Sin proveedores registrados</p>
                    <p className="text-xs text-slate-400">Crea el primero con el botón de arriba.</p>
                </div>
            ) : (
                <>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse min-w-[720px]">
                        <thead className="sticky top-0 z-10 bg-slate-50 border-b-2 border-slate-200">
                            <tr>
                                <th className="px-5 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                    Proveedor
                                </th>
                                <th className="px-5 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                    RUT
                                </th>
                                <th className="px-5 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                    Contacto
                                </th>
                                <th className="px-5 py-3 text-center text-[10px] font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                    Guías
                                </th>
                                <th className="px-5 py-3 text-center text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                    Acciones
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {proveedores.map(p => (
                                <tr key={p.id} className="hover:bg-slate-50/70 transition-colors group">

                                    {/* Nombre + dirección */}
                                    <td className="px-5 py-3.5">
                                        <div className="flex items-start gap-3">
                                            <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center shrink-0 mt-0.5">
                                                <Building2 className="w-4 h-4 text-violet-500" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-black text-slate-900 truncate max-w-[220px]">
                                                    {p.nombre}
                                                </p>
                                                {p.direccion && (
                                                    <p className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5 truncate max-w-[220px]">
                                                        <MapPin className="w-2.5 h-2.5 shrink-0" />
                                                        {p.direccion}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </td>

                                    {/* RUT */}
                                    <td className="px-5 py-3.5">
                                        {p.rut
                                            ? <span className="font-mono text-xs font-semibold text-slate-700">{p.rut}</span>
                                            : <span className="text-[10px] text-slate-300">—</span>
                                        }
                                    </td>

                                    {/* Email + teléfono */}
                                    <td className="px-5 py-3.5">
                                        <div className="space-y-0.5">
                                            {p.email && (
                                                <a
                                                    href={`mailto:${p.email}`}
                                                    className="flex items-center gap-1.5 text-[11px] text-indigo-600 hover:underline"
                                                >
                                                    <Mail className="w-3 h-3 shrink-0" />
                                                    {p.email}
                                                </a>
                                            )}
                                            {p.telefono && (
                                                <p className="flex items-center gap-1.5 text-[11px] text-slate-600">
                                                    <Phone className="w-3 h-3 shrink-0 text-slate-400" />
                                                    {p.telefono}
                                                </p>
                                            )}
                                            {!p.email && !p.telefono && (
                                                <span className="text-[10px] text-slate-300">Sin contacto</span>
                                            )}
                                        </div>
                                    </td>

                                    {/* Contador guías */}
                                    <td className="px-5 py-3.5 text-center">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                                            p.total_guias > 0
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : 'bg-slate-100 text-slate-400'
                                        }`}>
                                            {p.total_guias} guía{p.total_guias !== 1 ? 's' : ''}
                                        </span>
                                    </td>

                                    {/* Acciones — visibles solo en hover */}
                                    <td className="px-5 py-3.5">
                                        <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                type="button"
                                                onClick={() => openEdit(p)}
                                                title="Editar"
                                                className="p-1.5 rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-colors"
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => confirmDelete(p)}
                                                title="Eliminar"
                                                className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Footer paginación */}
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                    <p className="text-xs text-slate-400">
                        Mostrando {proveedores.length} de {total}
                    </p>
                    {proveedores.length < total && (
                        <button
                            type="button"
                            onClick={loadMore}
                            disabled={loadPending}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-600 hover:text-violet-800 transition-colors disabled:opacity-50"
                        >
                            {loadPending
                                ? <Loader2    className="w-3.5 h-3.5 animate-spin" />
                                : <ChevronDown className="w-3.5 h-3.5" />
                            }
                            Cargar más
                        </button>
                    )}
                </div>
                </>
            )}
        </div>

        {/* ── Modal crear / editar ───────────────────────────────── */}
        {modalMode && (
            <ProveedorFormModal
                proveedor={editTarget}
                onClose={() => setModalMode(null)}
                onSaved={handleSaved}
            />
        )}

        {/* ── Modal confirmar eliminación ────────────────────────── */}
        {deleteTarget && (
            <div
                className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                onClick={e => { if (e.target === e.currentTarget && !deleteError) closeDeleteModal(); }}
            >
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-100">
                    <div className="h-1.5 w-full bg-gradient-to-r from-red-400 to-rose-500" />

                    <div className="p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-11 h-11 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
                                <Trash2 className="w-5 h-5 text-red-500" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
                                    Confirmar eliminación
                                </p>
                                <h3 className="text-sm font-black text-slate-900 leading-tight line-clamp-1">
                                    {deleteTarget.nombre}
                                </h3>
                            </div>
                        </div>

                        {/* Error bloqueante de negocio */}
                        {deleteError ? (
                            <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 mb-4">
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                {deleteError}
                            </div>
                        ) : (
                            <p className="text-sm text-slate-600 leading-relaxed mb-5">
                                Esta acción es permanente e irreversible.
                                {deleteTarget.total_guias > 0 && (
                                    <span className="block mt-1 text-amber-600 font-bold">
                                        Atención: tiene {deleteTarget.total_guias} guía{deleteTarget.total_guias !== 1 ? 's' : ''} asociada{deleteTarget.total_guias !== 1 ? 's' : ''} — la eliminación será bloqueada.
                                    </span>
                                )}
                            </p>
                        )}

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={closeDeleteModal}
                                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                            >
                                {deleteError ? 'Cerrar' : 'Cancelar'}
                            </button>
                            {!deleteError && (
                                <button
                                    type="button"
                                    onClick={executeDelete}
                                    disabled={deletePending}
                                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-black text-white bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 transition-all disabled:opacity-60"
                                >
                                    {deletePending
                                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Eliminando…</>
                                        : <><Trash2  className="w-4 h-4" /> Sí, eliminar</>
                                    }
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )}
        </>
    );
}
