'use client';

import { useState } from 'react';
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { eliminarRecetaProyectoAction, type RecetaAplicada } from '../actions';

// ── Confirmación de eliminación (modal propio, sin confirm() nativo) ─────────

export function EliminarRecetaModal({
    proyectoId, totalItems, hayRetiros, aplicaciones, onClose, onSuccess,
}: {
    proyectoId:   string;
    totalItems:   number;
    hayRetiros:   boolean;
    aplicaciones: RecetaAplicada[];
    onClose:      () => void;
    onSuccess:    () => void;
}) {
    // sel: id de la receta aplicada | 'todo'
    const [sel,     setSel]     = useState<string | null>(aplicaciones.length === 0 && !hayRetiros ? 'todo' : null);
    const [loading, setLoading] = useState(false);
    const [error,   setError]   = useState<string | null>(null);

    const handleDelete = async () => {
        if (!sel) return;
        setLoading(true);
        setError(null);
        const res = await eliminarRecetaProyectoAction(proyectoId, sel === 'todo' ? undefined : sel);
        setLoading(false);
        if (res.error) setError(res.error);
        else onSuccess();
    };

    const opcion = (id: string, activa: boolean, titulo: string, sub: string, motivo?: string) => (
        <label
            key={id}
            className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                !activa ? 'border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed'
                : sel === id ? 'border-red-300 bg-red-50 cursor-pointer'
                : 'border-slate-200 hover:bg-slate-50 cursor-pointer'
            }`}
        >
            <input
                type="radio" name="receta-eliminar" disabled={!activa}
                checked={sel === id} onChange={() => setSel(id)}
                className="mt-1 accent-red-600"
            />
            <span className="min-w-0">
                <span className="block text-sm font-bold text-slate-800 leading-tight">{titulo}</span>
                <span className="block text-[11px] text-slate-400 mt-0.5">{sub}</span>
                {motivo && <span className="block text-[11px] font-semibold text-amber-600 mt-1">{motivo}</span>}
            </span>
        </label>
    );

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
                <div className="px-6 py-5 space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                        <Trash2 className="w-5 h-5 text-red-500" />
                    </div>
                    <h2 className="text-lg font-black text-slate-900">Eliminar receta cargada</h2>
                    <p className="text-sm text-slate-500">
                        {aplicaciones.length > 0
                            ? '¿Qué receta deseas eliminar del proyecto? Solo se restarán los ítems de la receta elegida. Esta acción no se puede deshacer.'
                            : `Se eliminarán los ${totalItems} ítems de la receta del proyecto. Esta acción no se puede deshacer.`}
                    </p>
                    <div className="space-y-2 max-h-56 overflow-y-auto">
                        {aplicaciones.map(a => opcion(
                            a.id, !a.bloqueada, a.nombre,
                            `${a.items_count} modelos · cargada el ${new Date(a.created_at).toLocaleDateString('es-CL')}`,
                            a.bloqueada ? 'Ya se solicitaron ítems de esta receta a bodega' : undefined,
                        ))}
                        {(aplicaciones.length > 0 || hayRetiros) && opcion(
                            'todo', !hayRetiros, 'Toda la receta del proyecto',
                            `${totalItems} ítems, incluidos los de cargas anteriores sin registro`,
                            hayRetiros ? 'El proyecto ya tiene retiros solicitados' : undefined,
                        )}
                    </div>
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                            <p className="text-xs font-semibold text-red-700">{error}</p>
                        </div>
                    )}
                </div>
                <div className="px-6 pb-6 flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="flex-1 px-4 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors border border-slate-200"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleDelete}
                        disabled={loading || !sel}
                        className="flex-1 px-4 py-2.5 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        {loading ? 'Eliminando…' : 'Eliminar'}
                    </button>
                </div>
            </div>
        </div>
    );
}
