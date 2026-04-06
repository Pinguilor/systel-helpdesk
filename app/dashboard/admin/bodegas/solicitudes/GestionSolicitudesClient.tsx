'use client';

import React, { useState, useTransition, useRef, useEffect, useCallback } from 'react';
import {
    CheckCircle2, XCircle, Clock, PackageCheck, Hash, Layers,
    Loader2, AlertCircle, ChevronRight, Warehouse, User,
    TicketIcon, AlertTriangle, Package, Undo2, PenLine,
    ExternalLink, X, ShieldCheck,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import {
    aprobarSolicitudAction, rechazarSolicitudAction,
    aprobarDevolucionAction, rechazarDevolucionAction,
    getStockEnBodegaAction,
    type ItemContexto, type StockCheckResult,
} from './actions';
import { CustomSelect } from '@/app/dashboard/components/CustomSelect';
import { useRouter } from 'next/navigation';

const SignatureCanvas = dynamic(() => import('react-signature-canvas'), { ssr: false }) as any;

// ── Tipos ────────────────────────────────────────────────────────────────────
interface Bodega { id: string; nombre: string; tipo: string; }

interface InvItem {
    id: string;
    modelo: string | null;
    familia: string | null;
    es_serializado: boolean;
    numero_serie: string | null;
    cantidad: number;
}

interface SolicitudItem { id: string; cantidad: number; inventario: InvItem | null; }

interface Solicitud {
    id: string;
    estado: 'pendiente' | 'aprobada' | 'rechazada';
    creado_en: string;
    gestionado_en: string | null;
    motivo_rechazo: string | null;
    url_firma: string | null;
    tecnico: { id: string; full_name: string | null } | null;
    bodeguero: { full_name: string | null } | null;
    ticket: { id: string; numero_ticket: number; titulo: string } | null;
    solicitud_items: SolicitudItem[];
}

interface Devolucion {
    id: string;
    estado: 'pendiente' | 'aprobada' | 'rechazada';
    creado_en: string;
    gestionado_en: string | null;
    motivo: string | null;
    motivo_rechazo: string | null;
    cantidad: number;
    url_firma: string | null;
    tecnico: { id: string; full_name: string | null } | null;
    bodeguero: { full_name: string | null } | null;
    ticket: { id: string; numero_ticket: number; titulo: string } | null;
    inventario: InvItem | null;
}

interface Props {
    solicitudes: Solicitud[];
    devoluciones: Devolucion[];
    bodegasCentrales: Bodega[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(dateStr: string) {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return 'hace un momento';
    if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
    return `hace ${Math.floor(diff / 86400)} días`;
}

const ESTADO_CONFIG = {
    pendiente: { label: 'Pendiente', bg: 'bg-amber-50',   border: 'border-amber-200',  dot: 'bg-amber-400',  text: 'text-amber-700'  },
    aprobada:  { label: 'Aprobada',  bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500', text: 'text-emerald-700' },
    rechazada: { label: 'Rechazada', bg: 'bg-red-50',     border: 'border-red-200',    dot: 'bg-red-400',    text: 'text-red-700'    },
};

// ── Visor de Firma Digital ────────────────────────────────────────────────────
function VisorFirmaModal({
    firmaUrl,
    tecnicoNombre,
    fechaGestion,
    tipo,
    onClose,
}: {
    firmaUrl: string;
    tecnicoNombre: string;
    fechaGestion: string | null;
    tipo: 'entrega' | 'reingreso';
    onClose: () => void;
}) {
    const fecha = fechaGestion
        ? new Date(fechaGestion).toLocaleString('es-CL', { dateStyle: 'long', timeStyle: 'short' })
        : '—';

    return (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden">

                {/* Header */}
                <div className="bg-slate-50 px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 text-slate-600 rounded-xl">
                            <ShieldCheck className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-slate-800">Firma de Recepción</h3>
                            <p className="text-xs text-slate-500 font-medium">
                                {tipo === 'entrega' ? 'Cadena de custodia · Entrega' : 'Cadena de custodia · Reingreso'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose}
                        className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors">
                        <X className="w-4 h-4 text-slate-500" />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    {/* Imagen de la firma */}
                    <div className="bg-white border-2 border-slate-200 rounded-xl flex items-center justify-center overflow-hidden"
                        style={{ minHeight: 120 }}>
                        <img
                            src={firmaUrl}
                            alt={`Firma de ${tecnicoNombre}`}
                            className="max-h-28 max-w-full object-contain mix-blend-multiply p-3"
                        />
                    </div>

                    {/* Contexto de seguridad */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
                        <div className="flex items-center gap-3 px-4 py-3">
                            <User className="w-4 h-4 text-slate-400 shrink-0" />
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Firmante</p>
                                <p className="text-sm font-bold text-slate-800">{tecnicoNombre}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 px-4 py-3">
                            <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fecha y hora de captura</p>
                                <p className="text-sm font-bold text-slate-800">{fecha}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 pb-6 flex gap-3">
                    <button onClick={onClose}
                        className="flex-1 px-4 py-2.5 text-sm font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                        Cerrar
                    </button>
                    <a href={firmaUrl} target="_blank" rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-indigo-600 border border-indigo-200 rounded-xl hover:bg-indigo-50 transition-colors">
                        <ExternalLink className="w-4 h-4" />
                        Ver original
                    </a>
                </div>
            </div>
        </div>
    );
}

// ── Selector de Bodega Central (reutilizable) ─────────────────────────────────
function BodegaSelector({
    bodegasCentrales,
    value,
    onChange,
    label = 'Destino Bodega Central',
}: {
    bodegasCentrales: Bodega[];
    value: string;
    onChange: (v: string) => void;
    label?: string;
}) {
    return (
        <div>
            <label className="flex items-center gap-2 text-xs font-black text-slate-700 uppercase tracking-widest mb-2">
                <Warehouse className="w-4 h-4 text-indigo-500" />
                {label}
            </label>
            {bodegasCentrales.length === 0 ? (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-medium text-red-600 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    No hay bodegas centrales configuradas.
                </div>
            ) : bodegasCentrales.length === 1 ? (
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-sm font-bold text-indigo-800 flex items-center gap-2">
                    <Warehouse className="w-4 h-4 text-indigo-500 shrink-0" />
                    {bodegasCentrales[0].nombre}
                </div>
            ) : (
                <CustomSelect
                    id="bodega-central"
                    value={value}
                    onChange={onChange}
                    placeholder="Seleccionar bodega central…"
                    options={bodegasCentrales.map(b => ({ value: b.id, label: b.nombre }))}
                />
            )}
        </div>
    );
}

// ── MODAL: Aprobar solicitud de Entrega ───────────────────────────────────────
function ModalAprobar({
    solicitud,
    bodegasCentrales,
    onClose,
    onSuccess,
}: {
    solicitud: Solicitud;
    bodegasCentrales: Bodega[];
    onClose: () => void;
    onSuccess: () => void;
}) {
    const [bodegaId, setBodegaId] = useState(bodegasCentrales[0]?.id || '');
    const [itemsAprobados, setItemsAprobados] = useState<Set<string>>(
        () => new Set(solicitud.solicitud_items.map(i => i.id))
    );
    const [comentario, setComentario] = useState('');
    const [error, setError] = useState('');
    const [isPending, startTransition] = useTransition();
    const sigRef = useRef<any>(null);
    const [renderTrigger, setRenderTrigger] = useState(0);

    // ── Stock en tiempo real ──────────────────────────────────────────────────
    const [stockPorItem, setStockPorItem] = useState<Record<string, StockCheckResult>>({});
    const [isCheckingStock, setIsCheckingStock] = useState(false);

    const checkStock = useCallback(async (bId: string) => {
        if (!bId || solicitud.solicitud_items.length === 0) return;
        setIsCheckingStock(true);
        const items = solicitud.solicitud_items.map(i => ({
            solicitudItemId: i.id,
            modelo:          i.inventario?.modelo ?? null,
            familia:         i.inventario?.familia ?? null,
            esSerializado:   i.inventario?.es_serializado ?? false,
            cantidad:        i.cantidad,
        }));
        const res = await getStockEnBodegaAction(bId, items);
        if (res.data) {
            const map: Record<string, StockCheckResult> = {};
            for (const r of res.data) map[r.solicitudItemId] = r;
            setStockPorItem(map);
        }
        setIsCheckingStock(false);
    }, [solicitud.solicitud_items]);

    // Verificar al montar y cada vez que cambie la bodega
    useEffect(() => { checkStock(bodegaId); }, [bodegaId, checkStock]);

    // ─────────────────────────────────────────────────────────────────────────

    const isFirmaVacia = !sigRef.current || sigRef.current.isEmpty();

    const toggleItem = (id: string) => {
        setItemsAprobados(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const aprobadosCount = itemsAprobados.size;
    const totalCount = solicitud.solicitud_items.length;
    const esAprobacionParcial = aprobadosCount > 0 && aprobadosCount < totalCount;
    const totalUnidadesAprobadas = solicitud.solicitud_items
        .filter(i => itemsAprobados.has(i.id))
        .reduce((s, i) => s + i.cantidad, 0);

    // Hay stock insuficiente si algún ítem aprobado no tiene stock suficiente
    const itemsConStockInsuficiente = solicitud.solicitud_items.filter(i =>
        itemsAprobados.has(i.id) &&
        stockPorItem[i.id] !== undefined &&
        !stockPorItem[i.id].suficiente
    );
    const hayStockInsuficiente = itemsConStockInsuficiente.length > 0;

    const handleConfirm = () => {
        if (!bodegaId) { setError('Debes seleccionar una bodega de origen.'); return; }
        if (aprobadosCount === 0) { setError('Debes aprobar al menos un ítem.'); return; }
        if (hayStockInsuficiente) { setError('Hay ítems sin stock suficiente en la bodega seleccionada.'); return; }
        if (!sigRef.current || sigRef.current.isEmpty()) { setError('La firma del técnico es obligatoria.'); return; }
        setError('');
        const firmaBase64 = sigRef.current.getTrimmedCanvas().toDataURL('image/png');
        const itemsContexto = solicitud.solicitud_items
            .filter(i => itemsAprobados.has(i.id))
            .map(i => ({
                cantidad:       i.cantidad,
                modelo:         i.inventario?.modelo ?? null,
                es_serializado: i.inventario?.es_serializado ?? false,
                numero_serie:   i.inventario?.numero_serie ?? null,
            }));
        startTransition(async () => {
            const res = await aprobarSolicitudAction(
                solicitud.id,
                bodegaId,
                Array.from(itemsAprobados),
                comentario.trim() || null,
                firmaBase64,
                solicitud.ticket?.id ?? null,
                solicitud.tecnico?.full_name ?? null,
                itemsContexto,
            );
            if (res.error) setError(res.error);
            else { onSuccess(); onClose(); }
        });
    };

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
                <div className="bg-emerald-50 px-6 py-4 border-b border-emerald-100 flex items-center gap-3 shrink-0">
                    <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                        <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-base font-black text-slate-800">Confirmar Aprobación</h3>
                        <p className="text-xs text-slate-500 font-medium">
                            {solicitud.tecnico?.full_name || 'Técnico'} · Ticket NC-{solicitud.ticket?.numero_ticket}
                            {esAprobacionParcial && <span className="ml-2 text-amber-600 font-black">· Parcial</span>}
                        </p>
                    </div>
                </div>

                <div className="overflow-y-auto flex-1 p-6 space-y-5">
                    {esAprobacionParcial && (
                        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-amber-700 text-xs font-medium">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>Aprobación parcial: {aprobadosCount} de {totalCount} ítems serán despachados.</span>
                        </div>
                    )}

                    {/* ── Lista de ítems con indicador de stock ── */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ítems a despachar</span>
                            <span className="text-[10px] font-black text-slate-500">{aprobadosCount}/{totalCount} · {totalUnidadesAprobadas} unid.</span>
                        </div>
                        <div className="bg-slate-50 rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                            {solicitud.solicitud_items.map(item => {
                                const checked = itemsAprobados.has(item.id);
                                const stock = stockPorItem[item.id];
                                const sinStock = checked && stock && !stock.suficiente;

                                return (
                                    <label key={item.id} className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                                        sinStock    ? 'bg-red-50/60' :
                                        checked     ? 'bg-emerald-50/60' : 'bg-white opacity-60'
                                    }`}>
                                        <input type="checkbox" checked={checked} onChange={() => toggleItem(item.id)}
                                            className="w-4 h-4 rounded border-slate-300 text-emerald-600 accent-emerald-600 shrink-0" />
                                        <div className="flex flex-col min-w-0 flex-1">
                                            <span className="text-sm font-bold text-slate-700 truncate">{item.inventario?.modelo ?? '—'}</span>
                                            <span className="text-[10px] text-slate-400 font-bold uppercase">{item.inventario?.familia ?? '—'}</span>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {item.inventario?.es_serializado && item.inventario.numero_serie && (
                                                <span className="font-mono text-[10px] bg-indigo-50 border border-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded">#{item.inventario.numero_serie}</span>
                                            )}
                                            <span className="text-sm font-black text-slate-800">x{item.cantidad}</span>
                                            {/* Indicador de stock en tiempo real */}
                                            {isCheckingStock ? (
                                                <Loader2 className="w-3.5 h-3.5 text-slate-300 animate-spin" />
                                            ) : stock ? (
                                                stock.suficiente ? (
                                                    <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                                                        {stock.disponible} disp.
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-black text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
                                                        {stock.disponible} disp.
                                                    </span>
                                                )
                                            ) : null}
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    {/* ── Selector de bodega con aviso de stock insuficiente ── */}
                    <div>
                        <BodegaSelector
                            bodegasCentrales={bodegasCentrales}
                            value={bodegaId}
                            onChange={(v) => { setBodegaId(v); setError(''); }}
                            label="Descontar desde Bodega"
                        />
                        {hayStockInsuficiente && !isCheckingStock && (
                            <div className="mt-2 flex items-start gap-2 bg-amber-50 border border-amber-300 rounded-xl px-3 py-2.5 text-amber-800 text-xs font-semibold">
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                                <span>
                                    Stock insuficiente en la bodega seleccionada para cubrir{' '}
                                    {itemsConStockInsuficiente.length === 1
                                        ? `"${itemsConStockInsuficiente[0].inventario?.modelo ?? 'un ítem'}"`
                                        : `${itemsConStockInsuficiente.length} ítems`}.
                                    Cambia la bodega de origen o desactiva los ítems sin stock.
                                </span>
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-2">
                            Comentario de Entrega <span className="text-slate-400 font-medium normal-case tracking-normal">(opcional)</span>
                        </label>
                        <textarea value={comentario} onChange={e => setComentario(e.target.value)}
                            placeholder="Ej: Se entrega displayport alternativo de 1.4 compatible…"
                            rows={3} className="w-full border-2 border-slate-200 rounded-xl p-3 text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none" />
                    </div>

                    {/* ── Firma del Técnico ── */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="flex items-center gap-2 text-xs font-black text-slate-700 uppercase tracking-widest">
                                <PenLine className="w-3.5 h-3.5 text-emerald-600" />
                                Firma del Técnico <span className="text-red-500">*</span>
                            </label>
                            <button type="button"
                                onClick={() => { sigRef.current?.clear(); setRenderTrigger(v => v + 1); }}
                                className="text-[10px] font-bold text-rose-500 hover:text-rose-700 uppercase tracking-wider transition-colors">
                                Borrar
                            </button>
                        </div>
                        <div className="bg-white border-2 border-dashed border-slate-300 rounded-xl overflow-hidden touch-none relative" style={{ height: 140 }}>
                            <SignatureCanvas
                                ref={sigRef}
                                penColor="black"
                                canvasProps={{ className: 'w-full h-full cursor-crosshair' }}
                                onEnd={() => setRenderTrigger(v => v + 1)}
                            />
                            {isFirmaVacia && (
                                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                    <p className="text-xs text-slate-300 font-bold uppercase tracking-widest">El técnico firma aquí</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {error && (
                        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm font-medium">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /><span>{error}</span>
                        </div>
                    )}
                </div>

                <div className="px-6 pb-6 pt-4 border-t border-slate-100 flex gap-3 shrink-0">
                    <button onClick={onClose} disabled={isPending}
                        className="flex-1 px-4 py-2.5 text-sm font-bold text-slate-600 border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50">
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isPending || isCheckingStock || !bodegaId || aprobadosCount === 0 || isFirmaVacia || hayStockInsuficiente}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-black rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-40 disabled:shadow-none ${
                            hayStockInsuficiente
                                ? 'bg-amber-500 text-white hover:bg-amber-600'
                                : 'bg-emerald-600 text-white hover:bg-emerald-700'
                        }`}>
                        {isPending || isCheckingStock
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : hayStockInsuficiente
                                ? <AlertTriangle className="w-4 h-4" />
                                : <CheckCircle2 className="w-4 h-4" />}
                        {isPending ? 'Procesando…' :
                         isCheckingStock ? 'Verificando stock…' :
                         hayStockInsuficiente ? 'Stock insuficiente' :
                         esAprobacionParcial ? `Aprobar ${aprobadosCount} ítem${aprobadosCount !== 1 ? 's' : ''}` :
                         'Aprobar Todo'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── MODAL: Rechazar (genérico, reutilizable) ──────────────────────────────────
function ModalRechazar({
    titulo,
    subtitulo,
    accentColor = 'red',
    onClose,
    onConfirm,
}: {
    titulo: string;
    subtitulo: string;
    accentColor?: 'red';
    onClose: () => void;
    onConfirm: (motivo: string) => Promise<{ error?: string }>;
}) {
    const [motivo, setMotivo] = useState('');
    const [error, setError] = useState('');
    const [isPending, startTransition] = useTransition();

    const handleConfirm = () => {
        if (!motivo.trim()) { setError('El motivo es obligatorio.'); return; }
        setError('');
        startTransition(async () => {
            const res = await onConfirm(motivo.trim());
            if (res.error) setError(res.error);
            else onClose();
        });
    };

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
                <div className="bg-red-50 px-6 py-4 border-b border-red-100 flex items-center gap-3">
                    <div className="p-2 bg-red-100 text-red-600 rounded-xl"><XCircle className="w-5 h-5" /></div>
                    <div>
                        <h3 className="text-base font-black text-slate-800">{titulo}</h3>
                        <p className="text-xs text-slate-500 font-medium">{subtitulo}</p>
                    </div>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-2">Motivo del Rechazo *</label>
                        <textarea value={motivo} onChange={e => setMotivo(e.target.value)}
                            placeholder="Explica al técnico por qué no se puede aprobar…"
                            rows={4} className="w-full border-2 border-slate-200 rounded-xl p-3 text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all resize-none" />
                    </div>
                    {error && (
                        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm font-medium">
                            <AlertCircle className="w-4 h-4 shrink-0" /><span>{error}</span>
                        </div>
                    )}
                </div>
                <div className="px-6 pb-6 flex gap-3">
                    <button onClick={onClose} disabled={isPending}
                        className="flex-1 px-4 py-2.5 text-sm font-bold text-slate-600 border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50">
                        Cancelar
                    </button>
                    <button onClick={handleConfirm} disabled={isPending || !motivo.trim()}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white text-sm font-black rounded-xl hover:bg-red-700 transition-all shadow-md active:scale-95 disabled:opacity-40 disabled:shadow-none">
                        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                        {isPending ? 'Rechazando…' : 'Rechazar'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── MODAL: Aprobar Devolución ─────────────────────────────────────────────────
function ModalAprobarDevolucion({
    devolucion,
    bodegasCentrales,
    onClose,
    onSuccess,
}: {
    devolucion: Devolucion;
    bodegasCentrales: Bodega[];
    onClose: () => void;
    onSuccess: () => void;
}) {
    const [bodegaId, setBodegaId] = useState(bodegasCentrales[0]?.id || '');
    const [comentario, setComentario] = useState('');
    const [error, setError] = useState('');
    const [isPending, startTransition] = useTransition();
    const sigRef = useRef<any>(null);
    const [renderTrigger, setRenderTrigger] = useState(0);
    const inv = devolucion.inventario;

    const isFirmaVacia = !sigRef.current || sigRef.current.isEmpty();

    const handleConfirm = () => {
        if (!bodegaId) { setError('Debes seleccionar una bodega central.'); return; }
        if (!sigRef.current || sigRef.current.isEmpty()) { setError('La firma del técnico es obligatoria.'); return; }
        setError('');
        const firmaBase64 = sigRef.current.getTrimmedCanvas().toDataURL('image/png');
        startTransition(async () => {
            const res = await aprobarDevolucionAction(devolucion.id, bodegaId, comentario.trim() || null, firmaBase64);
            if (res.error) setError(res.error);
            else { onSuccess(); onClose(); }
        });
    };

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
                <div className="bg-indigo-50 px-6 py-4 border-b border-indigo-100 flex items-center gap-3 shrink-0">
                    <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                        <Undo2 className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-base font-black text-slate-800">Confirmar Reingreso</h3>
                        <p className="text-xs text-slate-500 font-medium">
                            {devolucion.tecnico?.full_name || 'Técnico'} devuelve {devolucion.cantidad}x {inv?.modelo ?? '—'}
                        </p>
                    </div>
                </div>

                <div className="overflow-y-auto flex-1 p-6 space-y-5">
                    {/* Resumen del ítem */}
                    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl shrink-0 ${inv?.es_serializado ? 'bg-indigo-100 text-indigo-600' : 'bg-violet-100 text-violet-600'}`}>
                            {inv?.es_serializado ? <Hash className="w-4 h-4" /> : <Layers className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-black text-slate-800 truncate">{inv?.modelo ?? '—'}</p>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{inv?.familia ?? '—'}</p>
                            {inv?.es_serializado && inv.numero_serie && (
                                <p className="font-mono text-[10px] text-indigo-600 mt-0.5">S/N: {inv.numero_serie}</p>
                            )}
                        </div>
                        <span className="text-xl font-black text-indigo-700 shrink-0">x{devolucion.cantidad}</span>
                    </div>

                    {devolucion.motivo && (
                        <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Motivo del técnico</p>
                            <p className="text-sm text-slate-600 font-medium">{devolucion.motivo}</p>
                        </div>
                    )}

                    <BodegaSelector bodegasCentrales={bodegasCentrales} value={bodegaId} onChange={setBodegaId} label="Reingresar a Bodega Central" />

                    <div>
                        <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-2">
                            Observación <span className="text-slate-400 font-medium normal-case tracking-normal">(opcional)</span>
                        </label>
                        <textarea value={comentario} onChange={e => setComentario(e.target.value)}
                            placeholder="Ej: Material recibido en buen estado…"
                            rows={3} className="w-full border-2 border-slate-200 rounded-xl p-3 text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none" />
                    </div>

                    {/* ── Firma del Técnico ─────────────────────────────────── */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="flex items-center gap-2 text-xs font-black text-slate-700 uppercase tracking-widest">
                                <PenLine className="w-3.5 h-3.5 text-indigo-600" />
                                Firma del Técnico <span className="text-red-500">*</span>
                            </label>
                            <button type="button"
                                onClick={() => { sigRef.current?.clear(); setRenderTrigger(v => v + 1); }}
                                className="text-[10px] font-bold text-rose-500 hover:text-rose-700 uppercase tracking-wider transition-colors">
                                Borrar
                            </button>
                        </div>
                        <div className="bg-white border-2 border-dashed border-slate-300 rounded-xl overflow-hidden touch-none relative" style={{ height: 140 }}>
                            <SignatureCanvas
                                ref={sigRef}
                                penColor="black"
                                canvasProps={{ className: 'w-full h-full cursor-crosshair' }}
                                onEnd={() => setRenderTrigger(v => v + 1)}
                            />
                            {isFirmaVacia && (
                                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                    <p className="text-xs text-slate-300 font-bold uppercase tracking-widest">El técnico firma aquí</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {error && (
                        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm font-medium">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /><span>{error}</span>
                        </div>
                    )}
                </div>

                <div className="px-6 pb-6 pt-4 border-t border-slate-100 flex gap-3 shrink-0">
                    <button onClick={onClose} disabled={isPending}
                        className="flex-1 px-4 py-2.5 text-sm font-bold text-slate-600 border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50">
                        Cancelar
                    </button>
                    <button onClick={handleConfirm} disabled={isPending || !bodegaId || isFirmaVacia}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-black rounded-xl hover:bg-indigo-700 transition-all shadow-md active:scale-95 disabled:opacity-40 disabled:shadow-none">
                        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />}
                        {isPending ? 'Procesando…' : 'Confirmar Reingreso'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Tarjeta de Solicitud de ENTREGA ──────────────────────────────────────────
function SolicitudCard({
    solicitud,
    bodegasCentrales,
    onRefresh,
}: {
    solicitud: Solicitud;
    bodegasCentrales: Bodega[];
    onRefresh: () => void;
}) {
    const [modalAprobar, setModalAprobar] = useState(false);
    const [modalRechazar, setModalRechazar] = useState(false);
    const [modalFirma, setModalFirma] = useState(false);
    const cfg = ESTADO_CONFIG[solicitud.estado] ?? ESTADO_CONFIG.pendiente;
    const isPending = solicitud.estado === 'pendiente';
    const totalUnidades = solicitud.solicitud_items.reduce((s, i) => s + i.cantidad, 0);

    return (
        <>
            <div className={`bg-white rounded-2xl border ${cfg.border} shadow-sm overflow-hidden transition-all hover:shadow-md`}>
                <div className={`px-5 py-3.5 ${cfg.bg} border-b ${cfg.border} flex items-center justify-between`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${cfg.dot} shrink-0`} />
                        <span className={`text-xs font-black uppercase tracking-widest ${cfg.text}`}>{cfg.label}</span>
                        <span className="text-slate-300">·</span>
                        <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />{timeAgo(solicitud.creado_en)}
                        </span>
                    </div>
                    {solicitud.ticket && (
                        <a href={`/dashboard/ticket/${solicitud.ticket.id}`} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline transition-colors">
                            <TicketIcon className="w-3.5 h-3.5" />NC-{solicitud.ticket.numero_ticket}<ChevronRight className="w-3 h-3" />
                        </a>
                    )}
                </div>

                <div className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-3 mb-4">
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-sm shrink-0 border border-indigo-200">
                                {solicitud.tecnico?.full_name?.charAt(0).toUpperCase() ?? <User className="w-4 h-4" />}
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-black text-slate-800 truncate">{solicitud.tecnico?.full_name ?? 'Técnico desconocido'}</p>
                                <p className="text-xs text-slate-500 font-medium truncate">{solicitud.ticket?.titulo ?? '—'}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{solicitud.solicitud_items.length} línea{solicitud.solicitud_items.length !== 1 ? 's' : ''}</span>
                            <span className="text-slate-300">·</span>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{totalUnidades} unid.</span>
                        </div>
                    </div>

                    <div className="bg-slate-50 rounded-xl border border-slate-100 divide-y divide-slate-100 overflow-hidden mb-4">
                        {solicitud.solicitud_items.map(item => (
                            <div key={item.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                    <div className={`p-1 rounded-md shrink-0 ${item.inventario?.es_serializado ? 'bg-indigo-100 text-indigo-600' : 'bg-amber-100 text-amber-600'}`}>
                                        {item.inventario?.es_serializado ? <Hash className="w-3 h-3" /> : <Layers className="w-3 h-3" />}
                                    </div>
                                    <div className="min-w-0">
                                        <span className="text-sm font-bold text-slate-700 block truncate">{item.inventario?.modelo ?? '—'}</span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{item.inventario?.familia ?? '—'}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {item.inventario?.es_serializado && item.inventario.numero_serie && (
                                        <span className="font-mono text-[10px] bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-600 hidden sm:block">#{item.inventario.numero_serie}</span>
                                    )}
                                    <span className="text-sm font-black text-slate-800 min-w-[30px] text-right">x{item.cantidad}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {solicitud.estado === 'rechazada' && solicitud.motivo_rechazo && (
                        <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-xs text-red-700 font-medium">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <span><span className="font-black">Motivo:</span> {solicitud.motivo_rechazo}</span>
                        </div>
                    )}

                    {solicitud.estado !== 'pendiente' && solicitud.bodeguero?.full_name && (
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-[10px] text-slate-400 font-medium">
                                Gestionado por <span className="font-black text-slate-600">{solicitud.bodeguero.full_name}</span>
                                {solicitud.gestionado_en && <> · {timeAgo(solicitud.gestionado_en)}</>}
                            </p>
                            {solicitud.estado === 'aprobada' && solicitud.url_firma && (
                                <button onClick={() => setModalFirma(true)}
                                    className="inline-flex items-center gap-1.5 text-[10px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-wider transition-colors">
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                    Ver Firma
                                </button>
                            )}
                        </div>
                    )}

                    {isPending && (
                        <div className="flex gap-2.5 pt-1">
                            <button onClick={() => setModalRechazar(true)}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-all active:scale-95">
                                <XCircle className="w-4 h-4" />Rechazar
                            </button>
                            <button onClick={() => setModalAprobar(true)}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-sm font-black rounded-xl hover:bg-emerald-700 transition-all shadow-md active:scale-95">
                                <CheckCircle2 className="w-4 h-4" />Aprobar
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {modalAprobar && (
                <ModalAprobar solicitud={solicitud} bodegasCentrales={bodegasCentrales}
                    onClose={() => setModalAprobar(false)} onSuccess={onRefresh} />
            )}
            {modalRechazar && (
                <ModalRechazar
                    titulo="Rechazar Solicitud"
                    subtitulo={`De ${solicitud.tecnico?.full_name || 'Técnico'} · Ticket NC-${solicitud.ticket?.numero_ticket}`}
                    onClose={() => setModalRechazar(false)}
                    onConfirm={async (motivo) => rechazarSolicitudAction(solicitud.id, motivo)}
                />
            )}
            {modalFirma && solicitud.url_firma && (
                <VisorFirmaModal
                    firmaUrl={solicitud.url_firma}
                    tecnicoNombre={solicitud.tecnico?.full_name ?? 'Técnico'}
                    fechaGestion={solicitud.gestionado_en}
                    tipo="entrega"
                    onClose={() => setModalFirma(false)}
                />
            )}
        </>
    );
}

// ── Tarjeta de DEVOLUCIÓN ────────────────────────────────────────────────────
function DevolucionCard({
    devolucion,
    bodegasCentrales,
    onRefresh,
}: {
    devolucion: Devolucion;
    bodegasCentrales: Bodega[];
    onRefresh: () => void;
}) {
    const [modalAprobar, setModalAprobar] = useState(false);
    const [modalRechazar, setModalRechazar] = useState(false);
    const [modalFirma, setModalFirma] = useState(false);
    const cfg = ESTADO_CONFIG[devolucion.estado] ?? ESTADO_CONFIG.pendiente;
    const isPending = devolucion.estado === 'pendiente';
    const inv = devolucion.inventario;

    return (
        <>
            <div className={`bg-white rounded-2xl border-2 shadow-sm overflow-hidden transition-all hover:shadow-md ${isPending ? 'border-indigo-200' : cfg.border}`}>
                {/* Header con acento índigo */}
                <div className={`px-5 py-3.5 border-b flex items-center justify-between ${isPending ? 'bg-indigo-50 border-indigo-100' : `${cfg.bg} ${cfg.border}`}`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${cfg.dot} shrink-0`} />
                        <span className={`text-xs font-black uppercase tracking-widest ${isPending ? 'text-indigo-700' : cfg.text}`}>{cfg.label}</span>
                        <span className="text-slate-300">·</span>
                        <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />{timeAgo(devolucion.creado_en)}
                        </span>
                        {/* Badge tipo */}
                        <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-black rounded-full uppercase tracking-wider">
                            <Undo2 className="w-2.5 h-2.5" />Devolución
                        </span>
                    </div>
                    {devolucion.ticket && (
                        <a href={`/dashboard/ticket/${devolucion.ticket.id}`} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline transition-colors">
                            <TicketIcon className="w-3.5 h-3.5" />NC-{devolucion.ticket.numero_ticket}<ChevronRight className="w-3 h-3" />
                        </a>
                    )}
                </div>

                <div className="p-5">
                    {/* Descripción principal: "[Técnico] devuelve [N]x [Material] del Ticket #[ID]" */}
                    <div className="flex items-start gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-sm shrink-0 border-2 border-indigo-200">
                            {devolucion.tecnico?.full_name?.charAt(0).toUpperCase() ?? <User className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-black text-slate-800">
                                <span className="text-indigo-700">{devolucion.tecnico?.full_name ?? 'Técnico'}</span>
                                {' devuelve '}
                                <span className="text-slate-900">{devolucion.cantidad}x {inv?.modelo ?? '—'}</span>
                                {devolucion.ticket && (
                                    <> del Ticket <span className="text-indigo-600">NC-{devolucion.ticket.numero_ticket}</span></>
                                )}
                            </p>
                            {devolucion.ticket?.titulo && (
                                <p className="text-xs text-slate-400 font-medium mt-0.5 truncate">{devolucion.ticket.titulo}</p>
                            )}
                        </div>
                    </div>

                    {/* Detalle del material */}
                    <div className="bg-indigo-50/60 rounded-xl border border-indigo-100 px-4 py-3 mb-4 flex items-center gap-3">
                        <div className={`p-2 rounded-lg shrink-0 ${inv?.es_serializado ? 'bg-indigo-100 text-indigo-600' : 'bg-violet-100 text-violet-600'}`}>
                            {inv?.es_serializado ? <Hash className="w-4 h-4" /> : <Layers className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-slate-700 truncate">{inv?.modelo ?? '—'}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{inv?.familia ?? '—'}</p>
                            {inv?.es_serializado && inv.numero_serie && (
                                <p className="font-mono text-[10px] text-indigo-500 mt-0.5">S/N: {inv.numero_serie}</p>
                            )}
                        </div>
                        <span className="text-lg font-black text-indigo-700 shrink-0">x{devolucion.cantidad}</span>
                    </div>

                    {/* Motivo del técnico */}
                    {devolucion.motivo && (
                        <div className="mb-4 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-xs text-slate-600 font-medium">
                            <span className="font-black text-slate-700">Motivo: </span>{devolucion.motivo}
                        </div>
                    )}

                    {/* Motivo de rechazo */}
                    {devolucion.estado === 'rechazada' && devolucion.motivo_rechazo && (
                        <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-xs text-red-700 font-medium">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <span><span className="font-black">Rechazado:</span> {devolucion.motivo_rechazo}</span>
                        </div>
                    )}

                    {/* Gestionado por */}
                    {devolucion.estado !== 'pendiente' && devolucion.bodeguero?.full_name && (
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-[10px] text-slate-400 font-medium">
                                Gestionado por <span className="font-black text-slate-600">{devolucion.bodeguero.full_name}</span>
                                {devolucion.gestionado_en && <> · {timeAgo(devolucion.gestionado_en)}</>}
                            </p>
                            {devolucion.estado === 'aprobada' && devolucion.url_firma && (
                                <button onClick={() => setModalFirma(true)}
                                    className="inline-flex items-center gap-1.5 text-[10px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-wider transition-colors">
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                    Ver Firma
                                </button>
                            )}
                        </div>
                    )}

                    {/* Acciones */}
                    {isPending && (
                        <div className="flex gap-2.5 pt-1">
                            <button onClick={() => setModalRechazar(true)}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-all active:scale-95">
                                <XCircle className="w-4 h-4" />Rechazar
                            </button>
                            <button onClick={() => setModalAprobar(true)}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-black rounded-xl hover:bg-indigo-700 transition-all shadow-md active:scale-95">
                                <Undo2 className="w-4 h-4" />Revisar y Reingresar
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {modalAprobar && (
                <ModalAprobarDevolucion devolucion={devolucion} bodegasCentrales={bodegasCentrales}
                    onClose={() => setModalAprobar(false)} onSuccess={onRefresh} />
            )}
            {modalRechazar && (
                <ModalRechazar
                    titulo="Rechazar Devolución"
                    subtitulo={`De ${devolucion.tecnico?.full_name || 'Técnico'} · ${devolucion.cantidad}x ${inv?.modelo ?? '—'}`}
                    onClose={() => setModalRechazar(false)}
                    onConfirm={async (motivo) => rechazarDevolucionAction(devolucion.id, motivo)}
                />
            )}
            {modalFirma && devolucion.url_firma && (
                <VisorFirmaModal
                    firmaUrl={devolucion.url_firma}
                    tecnicoNombre={devolucion.tecnico?.full_name ?? 'Técnico'}
                    fechaGestion={devolucion.gestionado_en}
                    tipo="reingreso"
                    onClose={() => setModalFirma(false)}
                />
            )}
        </>
    );
}

// ── Componente Principal ──────────────────────────────────────────────────────
type BandejaTipo = 'entregas' | 'devoluciones';
type FiltroEstado = 'todas' | 'pendiente' | 'aprobada' | 'rechazada';

export function GestionSolicitudesClient({
    solicitudes: initialSolicitudes,
    devoluciones: initialDevoluciones,
    bodegasCentrales,
}: Props) {
    const router = useRouter();
    const [bandeja, setBandeja] = useState<BandejaTipo>('entregas');
    const [filtro, setFiltro] = useState<FiltroEstado>('pendiente');

    const handleRefresh = () => router.refresh();

    // ── Datos filtrados por bandeja activa ───────────────────────────────────
    const dataset = bandeja === 'entregas' ? initialSolicitudes : initialDevoluciones;

    const filtrados = dataset.filter(s =>
        filtro === 'todas' ? true : s.estado === filtro
    );

    const counts = {
        todas:     dataset.length,
        pendiente: dataset.filter(s => s.estado === 'pendiente').length,
        aprobada:  dataset.filter(s => s.estado === 'aprobada').length,
        rechazada: dataset.filter(s => s.estado === 'rechazada').length,
    };

    const filtros: { key: FiltroEstado; label: string; count: number; color: string }[] = [
        { key: 'pendiente', label: 'Pendientes', count: counts.pendiente, color: 'amber' },
        { key: 'aprobada',  label: 'Aprobadas',  count: counts.aprobada,  color: 'emerald' },
        { key: 'rechazada', label: 'Rechazadas', count: counts.rechazada, color: 'red' },
        { key: 'todas',     label: 'Todas',      count: counts.todas,     color: 'slate' },
    ];

    const pendientesEntregas    = initialSolicitudes.filter(s => s.estado === 'pendiente').length;
    const pendientesDevoluciones = initialDevoluciones.filter(s => s.estado === 'pendiente').length;

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

            {/* ── Page Header ─────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight flex items-center gap-3">
                        <div className="p-2.5 bg-slate-100 text-slate-700 rounded-xl">
                            <PackageCheck className="w-6 h-6" />
                        </div>
                        Gestión de Solicitudes y Devoluciones
                    </h1>
                    <p className="text-sm font-medium text-slate-500 mt-1">
                        Bandeja unificada de entregas y reingresos de materiales
                    </p>
                </div>
                <button onClick={handleRefresh}
                    className="self-start sm:self-auto flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors bg-white shadow-sm">
                    <Loader2 className="w-3.5 h-3.5" />Actualizar
                </button>
            </div>

            {/* ── Toggle Maestro: Entregas / Devoluciones ──────────────────── */}
            <div className="bg-slate-100 border border-slate-200 p-1.5 rounded-2xl flex gap-1.5 shadow-inner">
                <button
                    onClick={() => setBandeja('entregas')}
                    className={`flex-1 flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl text-sm font-black transition-all ${
                        bandeja === 'entregas'
                            ? 'bg-white text-emerald-700 shadow-md ring-1 ring-slate-200/60'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/60'
                    }`}
                >
                    <Package className="w-4 h-4" />
                    <span>Solicitudes (Entregas)</span>
                    {pendientesEntregas > 0 && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${bandeja === 'entregas' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600'}`}>
                            {pendientesEntregas}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setBandeja('devoluciones')}
                    className={`flex-1 flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl text-sm font-black transition-all ${
                        bandeja === 'devoluciones'
                            ? 'bg-white text-indigo-700 shadow-md ring-1 ring-slate-200/60'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/60'
                    }`}
                >
                    <Undo2 className="w-4 h-4" />
                    <span>Devoluciones (Reingresos)</span>
                    {pendientesDevoluciones > 0 && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${bandeja === 'devoluciones' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'}`}>
                            {pendientesDevoluciones}
                        </span>
                    )}
                </button>
            </div>

            {/* ── Filtros de Estado ────────────────────────────────────────── */}
            <div className="flex flex-wrap gap-2">
                {filtros.map(f => {
                    const isActive = filtro === f.key;
                    const colorMap: Record<string, string> = {
                        amber:   isActive ? 'bg-amber-500 text-white border-amber-500 shadow-md'   : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50',
                        emerald: isActive ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50',
                        red:     isActive ? 'bg-red-500 text-white border-red-500 shadow-md'       : 'bg-white text-red-600 border-red-200 hover:bg-red-50',
                        slate:   isActive ? 'bg-slate-800 text-white border-slate-800 shadow-md'   : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50',
                    };
                    return (
                        <button key={f.key} onClick={() => setFiltro(f.key)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-black transition-all ${colorMap[f.color]}`}>
                            {f.label}
                            <span className={`min-w-[20px] text-center px-1.5 py-0.5 rounded-full text-[10px] font-black ${isActive ? 'bg-white/20' : 'bg-slate-100 text-slate-600'}`}>
                                {f.count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* ── Grid de Tarjetas ─────────────────────────────────────────── */}
            {filtrados.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-sm">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${bandeja === 'devoluciones' ? 'bg-indigo-50' : 'bg-slate-100'}`}>
                        {bandeja === 'devoluciones'
                            ? <Undo2 className="w-8 h-8 text-indigo-300" />
                            : <PackageCheck className="w-8 h-8 text-slate-300" />
                        }
                    </div>
                    <h3 className="text-lg font-black text-slate-700 mb-1">
                        {filtro === 'pendiente'
                            ? `No hay ${bandeja === 'devoluciones' ? 'devoluciones' : 'solicitudes'} pendientes`
                            : `No hay ${bandeja === 'devoluciones' ? 'devoluciones' : 'solicitudes'} ${filtro === 'todas' ? '' : filtro + 's'}`
                        }
                    </h3>
                    <p className="text-sm font-medium text-slate-400">
                        {filtro === 'pendiente'
                            ? bandeja === 'devoluciones'
                                ? 'Cuando un técnico solicite devolver materiales, aparecerán aquí.'
                                : 'Cuando un técnico solicite materiales, aparecerán aquí.'
                            : 'Prueba cambiando el filtro superior.'
                        }
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {bandeja === 'entregas'
                        ? (filtrados as Solicitud[]).map(sol => (
                            <SolicitudCard key={sol.id} solicitud={sol} bodegasCentrales={bodegasCentrales} onRefresh={handleRefresh} />
                        ))
                        : (filtrados as Devolucion[]).map(dev => (
                            <DevolucionCard key={dev.id} devolucion={dev} bodegasCentrales={bodegasCentrales} onRefresh={handleRefresh} />
                        ))
                    }
                </div>
            )}
        </div>
    );
}
