'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    PackageSearch, X, Loader2, AlertTriangle,
    Hash, Layers, ShoppingCart, Minus, Plus, Ticket, Package,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { assignMaterialsBatchAction } from '../actions';
import { useRouter } from 'next/navigation';

// ─── Types ────────────────────────────────────────────────────────────────────
interface StockItem {
    id: string;
    modelo: string;
    familia: string;
    es_serializado: boolean;
    numero_serie: string | null;
    cantidad: number;
    cantidadDisponible: number;
    ticket_id: string | null;
    consumido: boolean;
}

interface AssignMaterialModalProps {
    ticketId: string;
    onClose: () => void;
}

// ─── Stepper ─────────────────────────────────────────────────────────────────
function Stepper({
    value, max, onChange, bloqueado, consumido,
}: {
    value: number; max: number; onChange: (n: number) => void; bloqueado: boolean; consumido?: boolean;
}) {
    if (consumido) {
        return (
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-lg whitespace-nowrap">
                Asignado
            </span>
        );
    }
    if (bloqueado) {
        return (
            <span className="text-xs font-semibold text-red-400 bg-red-50 border border-red-100 px-2 py-1 rounded-lg whitespace-nowrap">
                Bloqueado por devolución
            </span>
        );
    }

    return (
        <div className="flex items-center gap-1 shrink-0">
            <button
                type="button"
                onClick={() => onChange(Math.max(0, value - 1))}
                disabled={value === 0}
                className="w-7 h-7 rounded-lg flex items-center justify-center border transition-all
                    disabled:opacity-25 disabled:cursor-not-allowed
                    border-slate-200 text-slate-500
                    hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600
                    active:scale-90"
            >
                <Minus className="w-3 h-3" />
            </button>

            <span className={`w-8 text-center text-sm font-black tabular-nums select-none transition-colors ${
                value > 0 ? 'text-indigo-700' : 'text-slate-300'
            }`}>
                {value}
            </span>

            <button
                type="button"
                onClick={() => onChange(Math.min(max, value + 1))}
                disabled={value >= max}
                className="w-7 h-7 rounded-lg flex items-center justify-center border transition-all
                    disabled:opacity-25 disabled:cursor-not-allowed
                    border-slate-200 text-slate-500
                    hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600
                    active:scale-90"
            >
                <Plus className="w-3 h-3" />
            </button>
        </div>
    );
}

// ─── Item Row ─────────────────────────────────────────────────────────────────
function ItemRow({ item, value, onChange }: { item: StockItem; value: number; onChange: (n: number) => void }) {
    const isSelected  = value > 0;
    const consumido   = item.consumido;
    const bloqueado   = !consumido && item.cantidadDisponible <= 0;
    const max         = item.es_serializado ? 1 : item.cantidadDisponible;

    return (
        <div className={`flex items-center justify-between gap-3 px-4 py-3 transition-colors ${
            consumido   ? 'opacity-60 bg-emerald-50/30' :
            bloqueado   ? 'opacity-60 bg-slate-50/40' :
            isSelected  ? 'bg-indigo-50/60' : 'hover:bg-slate-50/60'
        }`}>
            {/* Left: icon + info */}
            <div className="flex items-center gap-3 min-w-0">
                <div className={`p-1.5 rounded-lg shrink-0 ${
                    item.es_serializado ? 'bg-indigo-50 text-indigo-500' : 'bg-amber-50 text-amber-500'
                }`}>
                    {item.es_serializado ? <Hash className="w-3.5 h-3.5" /> : <Layers className="w-3.5 h-3.5" />}
                </div>

                <div className="min-w-0">
                    <p className={`text-sm font-bold truncate transition-colors ${
                        isSelected ? 'text-indigo-900' : 'text-slate-700'
                    }`}>
                        {item.modelo}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                            {item.familia}
                        </span>
                        {item.es_serializado && item.numero_serie && (
                            <span className="font-mono text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                {item.numero_serie}
                            </span>
                        )}
                        {!item.es_serializado && !bloqueado && !consumido && (
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded transition-colors ${
                                isSelected ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'
                            }`}>
                                {item.cantidadDisponible} disp.
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Right: stepper o badge bloqueado/consumido */}
            <Stepper value={value} max={max} onChange={onChange} bloqueado={bloqueado} consumido={consumido} />
        </div>
    );
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ icon, label, count }: { icon: React.ReactNode; label: string; count: number }) {
    return (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
            {icon}
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
            <span className="ml-auto text-[11px] font-bold text-slate-400">{count} ítem{count !== 1 ? 's' : ''}</span>
        </div>
    );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
export function AssignMaterialModal({ ticketId, onClose }: AssignMaterialModalProps) {
    const [stockMochila, setStockMochila] = useState<StockItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [mochilaNotFound, setMochilaNotFound] = useState(false);
    const [consumo, setConsumo] = useState<Record<string, number>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);

    const router = useRouter();

    useEffect(() => {
        setMounted(true);
        async function fetchMochilaStock() {
            try {
                setLoading(true);
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                // 1. Traer bodegas activas de este usuario
                const { data: bodegas, error: errBodegas } = await supabase
                    .from('bodegas')
                    .select('id, tipo')
                    .eq('tecnico_id', user.id)
                    .eq('activo', true);

                if (errBodegas) throw errBodegas;

                // 2. Buscar la mochila usando JS puro para evitar problemas de Case Sensitivity
                const miMochila = bodegas?.find(b => b.tipo?.toUpperCase() === 'MOCHILA');
                if (!miMochila) {
                    setMochilaNotFound(true);
                    return;
                }

                // 3. Traer el inventario físico > 0
                //    inventario mantiene modelo/familia como columnas directas
                const { data: inventory, error: errInv } = await supabase
                    .from('inventario')
                    .select('id, modelo, familia, es_serializado, numero_serie, cantidad, ticket_id')
                    .eq('bodega_id', miMochila.id)
                    .gt('cantidad', 0);

                if (errInv) throw errInv;
                if (!inventory || inventory.length === 0) return;

                // 4. Buscar devoluciones pendientes para calcular el bloqueo
                const invIds = inventory.map((i: any) => i.id);
                const { data: devolsPendientes } = await supabase
                    .from('solicitudes_devoluciones')
                    .select('inventario_id, cantidad')
                    .in('inventario_id', invIds)
                    .eq('estado', 'pendiente');

                const blockedMap: Record<string, number> = {};
                for (const d of devolsPendientes || []) {
                    blockedMap[d.inventario_id] = (blockedMap[d.inventario_id] || 0) + (d.cantidad || 0);
                }

                // 5. Enriquecer los datos
                const enriched: StockItem[] = (inventory as any[]).map(item => {
                    const yaConsumido = item.ticket_id === ticketId;
                    return {
                        id: item.id,
                        modelo:  item.modelo  ?? '—',
                        familia: item.familia ?? '—',
                        es_serializado: item.es_serializado,
                        numero_serie: item.numero_serie || null,
                        cantidad: item.cantidad,
                        cantidadDisponible: yaConsumido
                            ? 0
                            : Math.max(0, item.cantidad - (blockedMap[item.id] || 0)),
                        ticket_id: item.ticket_id || null,
                        consumido: yaConsumido,
                    };
                }).sort((a, b) => {
                    const modeloA = a.modelo || '';
                    const modeloB = b.modelo || '';
                    return modeloA.localeCompare(modeloB);
                });

                setStockMochila(enriched);
            } catch (e) {
                console.error('🚨 ERROR CRÍTICO CARGANDO MOCHILA:', e);
            } finally {
                setLoading(false);
            }
        }
        fetchMochilaStock();
    }, []);

    // Split into two sections
    const itemsDeEsteTicket = stockMochila.filter(i => i.ticket_id === ticketId);
    const itemsOtros        = stockMochila.filter(i => i.ticket_id !== ticketId);

    const setItemConsumo = (id: string, n: number) => {
        setConsumo(prev => {
            if (n <= 0) {
                const { [id]: _, ...rest } = prev;
                return rest;
            }
            return { ...prev, [id]: n };
        });
    };

    const totalUnidades = Object.values(consumo).reduce((a, b) => a + b, 0);
    const totalItems    = Object.keys(consumo).length;

    const handleConfirm = async () => {
        if (totalUnidades === 0) return;
        setSubmitError(null);
        setIsSubmitting(true);

        const payload = Object.entries(consumo).map(([inventarioId, cantidad]) => ({ inventarioId, cantidad }));
        const res = await assignMaterialsBatchAction(ticketId, payload);

        setIsSubmitting(false);
        if ('error' in res) {
            setSubmitError(res.error ?? 'Error desconocido.');
        } else {
            router.refresh();
            onClose();
        }
    };

    if (!mounted) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex justify-end bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white w-full max-w-md h-full shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col">

                {/* ── Header ── */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 rounded-xl shrink-0">
                            <PackageSearch className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-slate-900">Consumo de Mochila</h3>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mt-0.5">
                                Selecciona los materiales a registrar
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* ── Body ── */}
                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 opacity-60">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
                        <span className="text-sm font-bold text-slate-600">Escaneando tu mochila virtual...</span>
                    </div>

                ) : mochilaNotFound ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
                        <div className="p-5 bg-red-50 rounded-full">
                            <AlertTriangle className="w-8 h-8 text-red-400" />
                        </div>
                        <div>
                            <h4 className="text-base font-black text-slate-900 mb-1">Mochila no configurada</h4>
                            <p className="text-sm text-slate-500 font-medium">
                                Tu cuenta no tiene una mochila virtual asignada. Contacta con coordinación.
                            </p>
                        </div>
                    </div>

                ) : stockMochila.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
                        <div className="p-5 bg-slate-100 rounded-full">
                            <PackageSearch className="w-8 h-8 text-slate-400" />
                        </div>
                        <div>
                            <h4 className="text-base font-black text-slate-900 mb-1">Mochila vacía</h4>
                            <p className="text-sm text-slate-500 font-medium">
                                No tienes materiales disponibles. Solicita despacho al bodeguero.
                            </p>
                        </div>
                    </div>

                ) : (
                    <div className="flex-1 overflow-y-auto custom-scrollbar">

                        {/* Section: Asignados a este ticket */}
                        {itemsDeEsteTicket.length > 0 && (
                            <div>
                                <SectionHeader
                                    icon={<Ticket className="w-3.5 h-3.5 text-indigo-500" />}
                                    label="Asignados a este Ticket"
                                    count={itemsDeEsteTicket.length}
                                />
                                <div className="divide-y divide-slate-100">
                                    {itemsDeEsteTicket.map(item => (
                                        <ItemRow
                                            key={item.id}
                                            item={item}
                                            value={consumo[item.id] || 0}
                                            onChange={n => setItemConsumo(item.id, n)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Section: Stock general / Otros */}
                        {itemsOtros.length > 0 && (
                            <div>
                                <SectionHeader
                                    icon={<Package className="w-3.5 h-3.5 text-slate-400" />}
                                    label={itemsDeEsteTicket.length > 0 ? 'Stock General / Otros' : 'Stock en Mochila'}
                                    count={itemsOtros.length}
                                />
                                <div className="divide-y divide-slate-100">
                                    {itemsOtros.map(item => (
                                        <ItemRow
                                            key={item.id}
                                            item={item}
                                            value={consumo[item.id] || 0}
                                            onChange={n => setItemConsumo(item.id, n)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Footer ── */}
                {!loading && !mochilaNotFound && (
                    <div className="px-5 py-4 border-t border-slate-100 bg-white shrink-0 space-y-3">

                        {submitError && (
                            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                                <p className="text-xs font-semibold text-red-700">{submitError}</p>
                            </div>
                        )}

                        {totalUnidades > 0 && (
                            <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2">
                                <ShoppingCart className="w-4 h-4 text-indigo-600 shrink-0" />
                                <span className="text-xs font-bold text-indigo-700">
                                    {totalItems} ítem{totalItems !== 1 ? 's' : ''}
                                    {' · '}
                                    {totalUnidades} unidad{totalUnidades !== 1 ? 'es' : ''} seleccionada{totalUnidades !== 1 ? 's' : ''}
                                </span>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isSubmitting}
                                className="flex-1 px-4 py-2.5 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-all active:scale-95 disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirm}
                                disabled={isSubmitting || totalUnidades === 0}
                                className="flex-1 px-4 py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all flex justify-center items-center gap-2 active:scale-95 shadow-md shadow-indigo-600/20 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {isSubmitting
                                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Registrando...</>
                                    : <><ShoppingCart className="w-4 h-4" /> Confirmar Consumo</>
                                }
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}
