'use client';

import { useEffect, useState } from 'react';
import { X, FileText, Paperclip, Package, Tag, CheckCircle2, Loader2, AlertCircle, Copy, Check, Hash } from 'lucide-react';
import { getDetalleGuiaAction, type DetalleGuia, type DetalleItem } from '../actions';

interface Props {
    guiaId: string;
    onClose: () => void;
}

function estadoBadge(estado: string) {
    const e = estado.toLowerCase();
    if (e === 'disponible' || e === 'operativo') {
        return <span className="inline-block px-2 py-0.5 text-[10px] font-black rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">{estado}</span>;
    }
    if (e === 'en proyecto') {
        return <span className="inline-block px-2 py-0.5 text-[10px] font-black rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">{estado}</span>;
    }
    if (e === 'dañado' || e === 'baja') {
        return <span className="inline-block px-2 py-0.5 text-[10px] font-black rounded-full bg-red-50 text-red-700 border border-red-200">{estado}</span>;
    }
    return <span className="inline-block px-2 py-0.5 text-[10px] font-black rounded-full bg-slate-100 text-slate-600">{estado}</span>;
}

function ItemRow({ item }: { item: DetalleItem }) {
    const [copiedSerial, setCopiedSerial] = useState<string | null>(null);

    const copySerial = (serial: string) => {
        navigator.clipboard.writeText(serial).catch(() => {});
        setCopiedSerial(serial);
        setTimeout(() => setCopiedSerial(null), 1600);
    };

    const enBodega   = item.seriales.filter(s => s.estado.toLowerCase() === 'disponible' || s.estado.toLowerCase() === 'operativo').length;
    const enProyecto = item.seriales.filter(s => s.estado.toLowerCase() === 'en proyecto').length;

    return (
        <div className="rounded-2xl border border-slate-200 overflow-hidden">
            {/* Cabecera del producto */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center shrink-0">
                        <Package className="w-4 h-4 text-slate-500" />
                    </div>
                    <div>
                        <p className="text-sm font-black text-slate-900">{item.modelo}</p>
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{item.familia}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-slate-200 text-slate-700">
                        {item.cantidad} ud.
                    </span>
                    {!item.es_serializado && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
                            Genérico
                        </span>
                    )}
                </div>
            </div>

            {/* Seriales */}
            {item.es_serializado && item.seriales.length > 0 && (
                <div className="p-4 space-y-3">
                    {/* Mini resumen de stock */}
                    {enBodega > 0 || enProyecto > 0 ? (
                        <div className="flex items-center gap-3 text-[11px] font-bold">
                            {enBodega > 0 && (
                                <span className="flex items-center gap-1 text-emerald-600">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                                    {enBodega} en bodega
                                </span>
                            )}
                            {enProyecto > 0 && (
                                <span className="flex items-center gap-1 text-indigo-600">
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block" />
                                    {enProyecto} en proyecto
                                </span>
                            )}
                            {item.seriales.length - enBodega - enProyecto > 0 && (
                                <span className="flex items-center gap-1 text-slate-500">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />
                                    {item.seriales.length - enBodega - enProyecto} otro estado
                                </span>
                            )}
                        </div>
                    ) : null}

                    {/* Lista de chips */}
                    <div className="flex flex-wrap gap-2">
                        {item.seriales.map(({ serial, estado, bodega }) => (
                            <button
                                key={serial}
                                type="button"
                                onClick={() => copySerial(serial)}
                                title={`${estado}${bodega ? ` · ${bodega}` : ''} — clic para copiar`}
                                className="group inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50 transition-all text-[11px] font-mono font-bold text-slate-700"
                            >
                                <Hash className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>{serial}</span>
                                {copiedSerial === serial ? (
                                    <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                                ) : (
                                    <Copy className="w-3 h-3 text-slate-300 group-hover:text-slate-500 shrink-0 transition-colors" />
                                )}
                                <span className="ml-0.5">{estadoBadge(estado)}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {!item.es_serializado && (
                <p className="px-4 py-3 text-xs text-slate-400 font-medium">
                    Material genérico — {item.cantidad} unidade{item.cantidad !== 1 ? 's' : ''} ingresada{item.cantidad !== 1 ? 's' : ''}.
                </p>
            )}
        </div>
    );
}

export function DetalleGuiaModal({ guiaId, onClose }: Props) {
    const [detalle, setDetalle] = useState<DetalleGuia | null>(null);
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        getDetalleGuiaAction(guiaId).then(res => {
            if (cancelled) return;
            if (res.error || !res.data) setError(res.error ?? 'No se pudo cargar la guía.');
            else setDetalle(res.data);
            setLoading(false);
        });
        return () => { cancelled = true; };
    }, [guiaId]);

    const totalUnidades = detalle?.items.reduce((s, i) => s + i.cantidad, 0) ?? 0;
    const totalSeriales = detalle?.items.reduce((s, i) => s + i.seriales.length, 0) ?? 0;

    return (
        <div
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-6 px-4"
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden">
                {/* Header */}
                <div className="px-6 pt-6 pb-5 border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/25 shrink-0">
                                <FileText className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    {!loading && detalle
                                        ? detalle.tipo_documento === 'FC' ? 'Factura' : 'Guía de Despacho'
                                        : 'Documento de Ingreso'}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                    {!loading && detalle && (
                                        <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
                                            detalle.tipo_documento === 'FC'
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : 'bg-blue-100 text-blue-700'
                                        }`}>
                                            {detalle.tipo_documento}
                                        </span>
                                    )}
                                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                                        {loading ? '—' : detalle ? `${detalle.tipo_documento}-${detalle.numero_guia}` : '—'}
                                    </h2>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {!loading && detalle && (
                        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {[
                                { label: 'Proveedor',  value: detalle.proveedor_nombre },
                                { label: 'Bodega',     value: detalle.bodega_nombre },
                                { label: 'Fecha',      value: new Date(detalle.fecha_guia + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) },
                                { label: 'Receptor',   value: detalle.registrado_por_nombre },
                            ].map(({ label, value }) => (
                                <div key={label} className="bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
                                    <p className="text-xs font-black text-slate-900 mt-0.5 truncate">{value}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {!loading && detalle && (
                        <div className="mt-3 flex items-center gap-3 flex-wrap">
                            <span className={`text-xs font-black px-2.5 py-1 rounded-full ${
                                detalle.estado === 'completada'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-red-100 text-red-700'
                            }`}>
                                {detalle.estado === 'completada' ? '✓ Completada' : '✕ Anulada'}
                            </span>
                            {detalle.observaciones && (
                                <span className="text-xs text-slate-500 italic">"{detalle.observaciones}"</span>
                            )}
                            {detalle.documento_url && (
                                <a
                                    href={detalle.documento_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline transition-colors"
                                >
                                    <Paperclip className="w-3.5 h-3.5" />
                                    Ver adjunto
                                </a>
                            )}
                        </div>
                    )}
                </div>

                {/* Body */}
                <div className="p-6 flex-1 overflow-y-auto space-y-4">
                    {loading && (
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                            <Loader2 className="w-8 h-8 text-slate-300 animate-spin" />
                            <p className="text-sm font-semibold text-slate-400">Cargando detalle…</p>
                        </div>
                    )}

                    {error && !loading && (
                        <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 border border-red-100">
                            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                            <p className="text-sm font-semibold text-red-700">{error}</p>
                        </div>
                    )}

                    {!loading && !error && detalle && (
                        <>
                            {/* Totales */}
                            <div className="flex items-center gap-4 px-1 text-xs font-bold text-slate-500">
                                <span className="flex items-center gap-1.5">
                                    <Tag className="w-3.5 h-3.5" />
                                    {detalle.items.length} producto{detalle.items.length !== 1 ? 's' : ''}
                                </span>
                                <span className="text-slate-300">·</span>
                                <span>{totalUnidades} unidad{totalUnidades !== 1 ? 'es' : ''} totales</span>
                                {totalSeriales > 0 && (
                                    <>
                                        <span className="text-slate-300">·</span>
                                        <span>{totalSeriales} serial{totalSeriales !== 1 ? 'es' : ''}</span>
                                    </>
                                )}
                            </div>

                            {/* Items */}
                            <div className="space-y-3">
                                {detalle.items.map((item, i) => (
                                    <ItemRow key={i} item={item} />
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors text-sm"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}
