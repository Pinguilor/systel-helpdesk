'use client';

import { useEffect, useState, useTransition } from 'react';
import {
    CheckCircle2, RotateCcw, ClockIcon, Loader2,
    AlertTriangle, X, Boxes, Package2, ShieldAlert,
} from 'lucide-react';
import {
    cambiarEstadoBomItem,
    eliminarItemBom,
    getInventarioDisponible,
} from '../actions';
import { BOM_ESTADO_CONFIG, type BomItemEstado } from '@/types/proyectos.types';

// ── Tipos locales ──────────────────────────────────────────────────────────

type BomItemRow = {
    id: string;
    proyecto_id: string;
    familia: string;
    modelo: string;
    es_serializado: boolean;
    cantidad_requerida: number;
    estado: BomItemEstado;
    notas: string | null;
    numero_serie: string | null;
    bodega_origen_id: string | null;
    inventario_id: string | null;
    bodega: { nombre: string } | null;
};

type InventarioRow = {
    id: string;
    numero_serie: string | null;
    cantidad: number;
    bodega_id: string;
    bodegas: { nombre: string }[] | null;   // PostgREST retorna array en joins
};

interface Props {
    items: BomItemRow[];
    proyectoId: string;
}

// ── Modal de Confirmación de Eliminación ──────────────────────────────────

function DeleteItemModal({
    item,
    onConfirm,
    onCancel,
    isPending,
}: {
    item: BomItemRow;
    onConfirm: () => void;
    onCancel: () => void;
    isPending: boolean;
}) {
    useEffect(() => {
        const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
        document.addEventListener('keydown', h);
        return () => document.removeEventListener('keydown', h);
    }, [onCancel]);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
        >
            <div className="relative w-full max-w-sm mx-4 bg-white rounded-2xl shadow-2xl p-6 space-y-4">
                <button
                    onClick={onCancel}
                    className="absolute top-4 right-4 w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
                >
                    <X className="w-3.5 h-3.5 text-slate-500" />
                </button>
                <div className="flex items-start gap-3 pr-6">
                    <div className="shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                        <AlertTriangle className="w-5 h-5 text-red-600" strokeWidth={2} />
                    </div>
                    <div>
                        <h3 className="text-base font-black text-slate-900">Eliminar ítem</h3>
                        <p className="text-sm text-slate-500 mt-0.5">Esta acción es irreversible.</p>
                    </div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-0.5">Ítem</p>
                    <p className="text-sm font-bold text-slate-900">{item.modelo}</p>
                    <p className="text-xs text-slate-400">{item.familia}</p>
                </div>
                <div className="flex gap-3 pt-1">
                    <button
                        onClick={onCancel}
                        disabled={isPending}
                        className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isPending}
                        className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
                    >
                        {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                        Sí, eliminar
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Modal de Asignación de Inventario ─────────────────────────────────────

function AsignarModal({
    item,
    proyectoId,
    onClose,
}: {
    item: BomItemRow;
    proyectoId: string;
    onClose: () => void;
}) {
    const [inventario, setInventario]   = useState<InventarioRow[]>([]);
    const [loadingInv, setLoadingInv]   = useState(true);
    const [selectedId, setSelectedId]   = useState<string | null>(null);
    const [isPending,  startTransition] = useTransition();
    const [error, setError]             = useState<string | null>(null);

    useEffect(() => {
        getInventarioDisponible(item.familia, item.modelo)
            .then(data => setInventario(data as InventarioRow[]))
            .finally(() => setLoadingInv(false));

        const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', h);
        return () => document.removeEventListener('keydown', h);
    }, [item.familia, item.modelo, onClose]);

    function handleConfirm() {
        setError(null);
        startTransition(async () => {
            const inv = inventario.find(i => i.id === selectedId);
            const result = await cambiarEstadoBomItem(
                item.id,
                'asignado',
                proyectoId,
                inv ? { inventarioId: inv.id, bodegaId: inv.bodega_id } : undefined
            );
            if (result.error) { setError(result.error); return; }
            onClose();
        });
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="relative w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <div>
                        <h3 className="text-sm font-black text-slate-900">Asignar ítem de bodega</h3>
                        <p className="text-xs text-slate-400 mt-0.5">{item.modelo} · {item.familia}</p>
                    </div>
                    <button onClick={onClose} className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
                        <X className="w-3.5 h-3.5 text-slate-500" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-4 space-y-3 max-h-72 overflow-y-auto">
                    {loadingInv ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                        </div>
                    ) : inventario.length === 0 ? (
                        <div className="text-center py-6 space-y-2">
                            <ShieldAlert className="w-8 h-8 text-amber-400 mx-auto" strokeWidth={1.5} />
                            <p className="text-sm font-bold text-slate-700">Sin stock disponible</p>
                            <p className="text-xs text-slate-400">
                                No hay unidades de <strong>{item.modelo}</strong> en estado Disponible.
                                Puedes asignar sin vincular inventario.
                            </p>
                        </div>
                    ) : (
                        inventario.map(inv => (
                            <label
                                key={inv.id}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors ${
                                    selectedId === inv.id
                                        ? 'border-slate-900 bg-slate-50'
                                        : 'border-slate-200 hover:border-slate-300'
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="inventario"
                                    value={inv.id}
                                    checked={selectedId === inv.id}
                                    onChange={() => setSelectedId(inv.id)}
                                    className="shrink-0"
                                />
                                <div className="flex-1 min-w-0">
                                    {inv.numero_serie ? (
                                        <p className="text-sm font-bold text-slate-800 font-mono">{inv.numero_serie}</p>
                                    ) : (
                                        <p className="text-sm font-bold text-slate-800">x{inv.cantidad} unidades</p>
                                    )}
                                    <p className="text-xs text-slate-400">{inv.bodegas?.[0]?.nombre ?? 'Bodega desconocida'}</p>
                                </div>
                            </label>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 pb-4 pt-2 space-y-2 border-t border-slate-100">
                    {error && (
                        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                            {error}
                        </p>
                    )}
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={isPending}
                            className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
                        >
                            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                            {isPending ? 'Asignando...' : (selectedId ? 'Asignar seleccionado' : 'Asignar sin stock')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Fila individual de BOM item ───────────────────────────────────────────

function BomItemRow({
    item,
    proyectoId,
    isLoading,
    onAsignar,
    onEliminar,
    onTransition,
}: {
    item: BomItemRow;
    proyectoId: string;
    isLoading: boolean;
    onAsignar: () => void;
    onEliminar: () => void;
    onTransition: (nuevoEstado: BomItemEstado) => void;
}) {
    const cfg        = BOM_ESTADO_CONFIG[item.estado];
    const nextStates = cfg?.nextStates ?? [];
    const isTerminal = item.estado === 'instalado';

    return (
        <tr className={`border-b border-slate-100 last:border-0 transition-opacity ${isLoading ? 'opacity-40' : ''}`}>
            {/* Modelo / Familia */}
            <td className="px-4 py-3">
                <p className="font-bold text-slate-900 text-sm">{item.modelo}</p>
                <p className="text-xs text-slate-400">{item.familia}</p>
                {item.numero_serie && (
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">S/N: {item.numero_serie}</p>
                )}
            </td>

            {/* Cantidad */}
            <td className="px-4 py-3 text-center">
                <span className="text-sm font-black text-slate-700">{item.cantidad_requerida}</span>
            </td>

            {/* Estado */}
            <td className="px-4 py-3">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-bold border ${cfg.bgClass} ${cfg.textClass} ${cfg.borderClass}`}>
                    {cfg.label}
                </span>
            </td>

            {/* Bodega asignada */}
            <td className="px-4 py-3 text-xs text-slate-500">
                {item.bodega?.nombre ?? <span className="text-slate-300">—</span>}
            </td>

            {/* Acciones */}
            <td className="px-4 py-3">
                <div className="flex items-center gap-1.5 justify-end">
                    {isLoading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}

                    {!isLoading && nextStates.includes('asignado') && (
                        <button
                            onClick={onAsignar}
                            title="Asignar inventario"
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                            <Package2 className="w-3.5 h-3.5" />
                            Asignar
                        </button>
                    )}

                    {!isLoading && nextStates.includes('instalado') && (
                        <button
                            onClick={() => onTransition('instalado')}
                            title="Marcar como instalado"
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                        >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Instalar
                        </button>
                    )}

                    {!isLoading && nextStates.includes('requerido') && (
                        <button
                            onClick={() => onTransition('requerido')}
                            title="Revertir a requerido"
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200 transition-colors"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Revertir
                        </button>
                    )}

                    {!isLoading && nextStates.includes('pendiente') && (
                        <button
                            onClick={() => onTransition('pendiente')}
                            title="Marcar como pendiente"
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
                        >
                            <ClockIcon className="w-3.5 h-3.5" />
                            Pendiente
                        </button>
                    )}

                    {!isLoading && !isTerminal && (
                        <button
                            onClick={onEliminar}
                            title="Eliminar ítem"
                            className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </td>
        </tr>
    );
}

// ── BomTable principal ────────────────────────────────────────────────────

export function BomTable({ items, proyectoId }: Props) {
    const [asignandoItem,  setAsignandoItem]  = useState<BomItemRow | null>(null);
    const [eliminandoItem, setEliminandoItem] = useState<BomItemRow | null>(null);
    const [loadingIds,     setLoadingIds]     = useState<Set<string>>(new Set());
    const [actionError,    setActionError]    = useState<string | null>(null);
    const [isPending,      startTransition]   = useTransition();

    function setLoading(id: string, loading: boolean) {
        setLoadingIds(prev => {
            const next = new Set(prev);
            if (loading) next.add(id); else next.delete(id);
            return next;
        });
    }

    function handleTransition(item: BomItemRow, nuevoEstado: BomItemEstado) {
        setActionError(null);
        setLoading(item.id, true);
        startTransition(async () => {
            const result = await cambiarEstadoBomItem(item.id, nuevoEstado, proyectoId);
            if (result.error) setActionError(result.error);
            setLoading(item.id, false);
        });
    }

    function handleEliminar() {
        if (!eliminandoItem) return;
        setActionError(null);
        setLoading(eliminandoItem.id, true);
        startTransition(async () => {
            const result = await eliminarItemBom(eliminandoItem.id, proyectoId);
            if (result.error) setActionError(result.error);
            setLoading(eliminandoItem.id, false);
            setEliminandoItem(null);
        });
    }

    if (items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-slate-200 rounded-2xl">
                <Boxes className="w-8 h-8 text-slate-200 mb-3" strokeWidth={1.5} />
                <p className="text-slate-400 font-semibold text-sm">Inventario de Hardware vacío</p>
                <p className="text-slate-300 text-xs mt-1">Agrega ítems desde el catálogo de equipos</p>
            </div>
        );
    }

    // Agrupar por estado en el orden visual deseado
    const ORDEN: BomItemEstado[] = ['requerido', 'pendiente', 'asignado', 'instalado'];
    const grupos = ORDEN.map(estado => ({
        estado,
        items: items.filter(i => i.estado === estado),
    })).filter(g => g.items.length > 0);

    return (
        <>
            {/* Modales globales */}
            {asignandoItem && (
                <AsignarModal
                    item={asignandoItem}
                    proyectoId={proyectoId}
                    onClose={() => setAsignandoItem(null)}
                />
            )}
            {eliminandoItem && (
                <DeleteItemModal
                    item={eliminandoItem}
                    onConfirm={handleEliminar}
                    onCancel={() => setEliminandoItem(null)}
                    isPending={isPending}
                />
            )}

            {/* Error global */}
            {actionError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm font-medium px-4 py-3 rounded-xl flex items-center justify-between">
                    {actionError}
                    <button onClick={() => setActionError(null)} className="ml-3 shrink-0">
                        <X className="w-4 h-4 opacity-60 hover:opacity-100" />
                    </button>
                </div>
            )}

            {/* Tablas agrupadas por estado */}
            <div className="space-y-4">
                {grupos.map(({ estado, items: grupoItems }) => {
                    const cfg = BOM_ESTADO_CONFIG[estado];
                    return (
                        <div key={estado} className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                            {/* Cabecera del grupo */}
                            <div className={`flex items-center gap-2 px-5 py-3 border-b border-slate-100 ${cfg.bgClass}`}>
                                <span className={`text-xs font-black uppercase tracking-wider ${cfg.textClass}`}>
                                    {cfg.label}
                                </span>
                                <span className={`text-xs font-black px-2 py-0.5 rounded-full border ${cfg.bgClass} ${cfg.textClass} ${cfg.borderClass}`}>
                                    {grupoItems.length}
                                </span>
                            </div>

                            {/* Tabla */}
                            <table className="w-full text-sm">
                                <thead className="bg-white border-b border-slate-100">
                                    <tr>
                                        <th className="text-left px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider">Modelo / Familia</th>
                                        <th className="text-center px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider">Cant.</th>
                                        <th className="text-left px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider">Estado</th>
                                        <th className="text-left px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider">Bodega</th>
                                        <th className="w-48 px-4 py-2" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {grupoItems.map(item => (
                                        <BomItemRow
                                            key={item.id}
                                            item={item}
                                            proyectoId={proyectoId}
                                            isLoading={loadingIds.has(item.id)}
                                            onAsignar={() => setAsignandoItem(item)}
                                            onEliminar={() => setEliminandoItem(item)}
                                            onTransition={nuevoEstado => handleTransition(item, nuevoEstado)}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    );
                })}
            </div>
        </>
    );
}
