'use client';

import { useState, useTransition, useEffect } from 'react';
import {
    PackageOpen, Hash, Layers, Undo2, Loader2, X, Clock,
    Ticket, Package, ChevronDown, ChevronUp, AlertTriangle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { solicitarDevolucionAction, type GrupoTicket, type ItemMochila } from '../actions';

// ─────────────────────────────────────────────────────────────────────────────
// Helper: calcular texto del countdown dado un ISO timestamp de vencimiento
// ─────────────────────────────────────────────────────────────────────────────
function useCuentaRegresiva(fechaLimite: string | null): { texto: string; vencido: boolean } | null {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (!fechaLimite) return;
        const id = setInterval(() => setNow(Date.now()), 60_000); // actualiza cada minuto
        return () => clearInterval(id);
    }, [fechaLimite]);

    if (!fechaLimite) return null;
    const diff = new Date(fechaLimite).getTime() - now;
    if (diff <= 0) return { texto: 'VENCIDO', vencido: true };
    const horas = Math.floor(diff / 3_600_000);
    const mins  = Math.floor((diff % 3_600_000) / 60_000);
    return { texto: horas > 0 ? `${horas}h ${mins}m restantes` : `${mins}m restantes`, vencido: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal Solicitar Devolución
// ─────────────────────────────────────────────────────────────────────────────
interface ModalDevolucionProps {
    item: ItemMochila;
    ticketId: string | null;
    onClose: () => void;
    onSuccess: () => void;
}

function ModalSolicitarDevolucion({ item, ticketId, onClose, onSuccess }: ModalDevolucionProps) {
    const [cantidad, setCantidad] = useState(1);
    const [motivo, setMotivo] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const handleSubmit = () => {
        setError(null);
        startTransition(async () => {
            const result = await solicitarDevolucionAction(ticketId, item.id, cantidad, motivo);
            if ('error' in result) {
                setError(result.error);
            } else {
                onSuccess();
                onClose();
            }
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">

                {/* Header */}
                <div className="bg-indigo-600 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-lg">
                            <Undo2 className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-white">Solicitar Devolución</h2>
                            <p className="text-xs text-indigo-200">El bodeguero revisará y procesará el reingreso</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-5">

                    {/* Material info */}
                    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-start gap-3">
                        <div className="p-2 bg-indigo-100 rounded-lg shrink-0">
                            {item.es_serializado
                                ? <Hash className="w-4 h-4 text-indigo-600" />
                                : <Layers className="w-4 h-4 text-indigo-600" />
                            }
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-indigo-900 truncate">{item.modelo}</p>
                            <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide">{item.familia}</p>
                            {item.es_serializado && item.numero_serie && (
                                <p className="text-xs font-mono text-indigo-400 mt-0.5">SN: {item.numero_serie}</p>
                            )}
                            {!item.es_serializado && (
                                <p className="text-xs text-indigo-500 mt-0.5">Disponible en mochila: <span className="font-bold">{item.cantidad}</span> ud.</p>
                            )}
                        </div>
                    </div>

                    {/* Cantidad (solo genéricos) */}
                    {!item.es_serializado && (
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1.5">
                                Cantidad a devolver
                            </label>
                            <input
                                type="number"
                                min={1}
                                max={item.cantidad}
                                value={cantidad}
                                onChange={e => setCantidad(Math.min(item.cantidad, Math.max(1, parseInt(e.target.value) || 1)))}
                                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>
                    )}

                    {/* Motivo */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">
                            Motivo <span className="text-slate-400 font-normal">(opcional)</span>
                        </label>
                        <textarea
                            rows={3}
                            value={motivo}
                            onChange={e => setMotivo(e.target.value)}
                            placeholder="Ej: Ticket cerrado, material no utilizado..."
                            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>

                    {error && (
                        <p className="text-sm text-red-600 font-medium bg-red-50 border border-red-100 px-4 py-2.5 rounded-xl">
                            {error}
                        </p>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 pb-6 flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={isPending}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isPending}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        {isPending ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                        ) : (
                            <><Undo2 className="w-4 h-4" /> Enviar Solicitud</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Item row dentro de una tarjeta de ticket
// ─────────────────────────────────────────────────────────────────────────────
interface ItemRowProps {
    item: ItemMochila;
    ticketId: string | null;
    onDevolver: (item: ItemMochila) => void;
}

function ItemRow({ item, ticketId, onDevolver }: ItemRowProps) {
    const countdown = useCuentaRegresiva(item.fecha_limite_devolucion);

    return (
        <div className={`flex items-center justify-between gap-3 px-4 py-3 transition-colors ${countdown?.vencido ? 'bg-red-50/60' : 'hover:bg-slate-50/60'}`}>
            <div className="flex items-center gap-3 min-w-0">
                <div className={`p-1.5 rounded-lg shrink-0 ${item.es_serializado ? 'bg-indigo-50 text-indigo-500' : 'bg-amber-50 text-amber-500'}`}>
                    {item.es_serializado
                        ? <Hash className="w-3.5 h-3.5" />
                        : <Layers className="w-3.5 h-3.5" />
                    }
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-700 truncate">{item.modelo}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{item.familia}</span>
                        {item.es_serializado && item.numero_serie && (
                            <span className="font-mono text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                {item.numero_serie}
                            </span>
                        )}
                        {!item.es_serializado && (
                            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                {item.cantidad} ud.
                            </span>
                        )}
                        {countdown && (
                            <span className={`inline-flex items-center gap-1 text-[10px] font-black px-1.5 py-0.5 rounded border ${
                                countdown.vencido
                                    ? 'bg-red-100 text-red-700 border-red-200'
                                    : 'bg-orange-50 text-orange-600 border-orange-200'
                            }`}>
                                <Clock className="w-2.5 h-2.5" />
                                {countdown.vencido ? 'VENCIDO' : `Quedan ${countdown.texto}`}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="shrink-0">
                {item.tiene_devolucion_pendiente ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-lg">
                        <Clock className="w-3 h-3" />
                        En proceso
                    </span>
                ) : (
                    <button
                        onClick={() => onDevolver(item)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2.5 py-1.5 rounded-lg hover:bg-indigo-100 hover:border-indigo-300 active:bg-indigo-200 transition-all"
                    >
                        <Undo2 className="w-3 h-3" />
                        Devolver
                    </button>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tarjeta de grupo (por ticket o stock general)
// ─────────────────────────────────────────────────────────────────────────────
interface GrupoCardProps {
    grupo: GrupoTicket;
    onDevolver: (item: ItemMochila, ticketId: string | null) => void;
}

function GrupoCard({ grupo, onDevolver }: GrupoCardProps) {
    const [expandido, setExpandido] = useState(true);
    const esStockGeneral = grupo.ticket_id === null;
    const pendientes = grupo.items.filter(i => i.tiene_devolucion_pendiente).length;

    return (
        <div className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${esStockGeneral ? 'border-slate-200' : 'border-indigo-100'}`}>

            {/* Header de la tarjeta */}
            <button
                onClick={() => setExpandido(v => !v)}
                className={`w-full flex items-center justify-between gap-3 px-5 py-4 text-left transition-colors ${esStockGeneral ? 'bg-slate-50/80 hover:bg-slate-100/60' : 'bg-indigo-50/60 hover:bg-indigo-50/80'}`}
            >
                <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-1.5 rounded-lg shrink-0 ${esStockGeneral ? 'bg-slate-200 text-slate-500' : 'bg-indigo-100 text-indigo-600'}`}>
                        {esStockGeneral
                            ? <Package className="w-4 h-4" />
                            : <Ticket className="w-4 h-4" />
                        }
                    </div>
                    <div className="min-w-0">
                        {esStockGeneral ? (
                            <p className="text-sm font-black text-slate-700">Stock General / Sin Ticket</p>
                        ) : (
                            <>
                                <p className="text-sm font-black text-indigo-800">
                                    Ticket NC-{grupo.numero_ticket}
                                </p>
                                {grupo.titulo && (
                                    <p className="text-xs font-medium text-indigo-500 truncate max-w-[200px] sm:max-w-none">
                                        {grupo.titulo}
                                    </p>
                                )}
                            </>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${esStockGeneral ? 'bg-slate-200 text-slate-600' : 'bg-indigo-100 text-indigo-700'}`}>
                        {grupo.items.length} ítem{grupo.items.length !== 1 ? 's' : ''}
                    </span>
                    {pendientes > 0 && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                            {pendientes} en proceso
                        </span>
                    )}
                    {expandido
                        ? <ChevronUp className="w-4 h-4 text-slate-400" />
                        : <ChevronDown className="w-4 h-4 text-slate-400" />
                    }
                </div>
            </button>

            {/* Items */}
            {expandido && (
                <div className="divide-y divide-slate-100">
                    {grupo.items.map(item => (
                        <ItemRow
                            key={item.id}
                            item={item}
                            ticketId={grupo.ticket_id}
                            onDevolver={(i) => onDevolver(i, grupo.ticket_id)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────
interface MochilaClientProps {
    grupos: GrupoTicket[];
    mochilaNombre: string;
}

export function MochilaClient({ grupos, mochilaNombre }: MochilaClientProps) {
    const router = useRouter();
    const [modalItem, setModalItem] = useState<{ item: ItemMochila; ticketId: string | null } | null>(null);

    const totalItems = grupos.reduce((acc, g) => acc + g.items.length, 0);
    const totalPendientes = grupos.reduce((acc, g) => acc + g.items.filter(i => i.tiene_devolucion_pendiente).length, 0);

    const ahora = Date.now();
    const itemsVencidos = grupos
        .flatMap(g => g.items)
        .filter(i => i.fecha_limite_devolucion && new Date(i.fecha_limite_devolucion).getTime() < ahora);
    const tieneBloqueo = itemsVencidos.length > 0;

    const handleSuccess = () => {
        router.refresh();
    };

    return (
        <>
            <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">

                {/* Page header */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                            <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl">
                                <PackageOpen className="w-6 h-6" />
                            </div>
                            {mochilaNombre}
                        </h1>
                        <p className="text-sm font-medium text-slate-500 mt-1">
                            Materiales en campo, agrupados por ticket de origen.
                        </p>
                    </div>

                    {/* KPIs rápidos */}
                    <div className="flex gap-3 shrink-0">
                        <div className="text-center bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm">
                            <p className="text-xl font-black text-slate-800">{totalItems}</p>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Ítems</p>
                        </div>
                        {totalPendientes > 0 && (
                            <div className="text-center bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 shadow-sm">
                                <p className="text-xl font-black text-amber-700">{totalPendientes}</p>
                                <p className="text-xs font-bold text-amber-500 uppercase tracking-wide">En proceso</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Banner bloqueo 72hr */}
                {tieneBloqueo && (
                    <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl">
                        <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                            <p className="text-sm font-black text-red-800">Tienes {itemsVencidos.length} material(es) vencido(s)</p>
                            <p className="text-xs font-medium text-red-600 mt-0.5">
                                Tienes materiales sobrantes con más de 72 horas sin devolver. Por favor, regulariza tu mochila o contacta a bodega. No podrás solicitar nuevos materiales hasta regularizar.
                            </p>
                        </div>
                    </div>
                )}

                {/* Content */}
                {grupos.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <PackageOpen className="w-8 h-8 text-slate-400" />
                        </div>
                        <p className="text-slate-500 font-medium text-lg">Tu mochila virtual está vacía.</p>
                        <p className="text-slate-400 text-sm mt-1">Cuando el bodeguero te asigne materiales, aparecerán aquí agrupados por ticket.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {grupos.map((grupo, idx) => (
                            <GrupoCard
                                key={grupo.ticket_id ?? `sg-${idx}`}
                                grupo={grupo}
                                onDevolver={(item, ticketId) => setModalItem({ item, ticketId })}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Modal */}
            {modalItem && (
                <ModalSolicitarDevolucion
                    item={modalItem.item}
                    ticketId={modalItem.ticketId}
                    onClose={() => setModalItem(null)}
                    onSuccess={handleSuccess}
                />
            )}
        </>
    );
}
