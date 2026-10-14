'use client';

import { useState, useTransition } from 'react';
import {
    ArrowLeftRight, User, Package, Warehouse, AlertTriangle,
    CheckCircle2, Loader2, X, ExternalLink, Clock, FolderKanban,
    Layers, ChevronDown, ChevronUp, XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { CustomSelect } from '@/app/dashboard/components/CustomSelect';
import {
    recepcionarDevolucionBodegueroAction,
    recepcionarLoteDevolucionAction,
    rechazarLoteDevolucionAction,
    type DevolucionLogistica,
    type LoteDevolucion,
} from './actions';

interface Props {
    devoluciones: DevolucionLogistica[];
    lotes:        LoteDevolucion[];
    bodegas:      { id: string; nombre: string; tipo: string }[];
    onRefresh: () => void;
}

function timeAgo(dateStr: string) {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60)    return 'hace un momento';
    if (diff < 3600)  return `hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
    return `hace ${Math.floor(diff / 86400)} d`;
}

function ModalRecepcionar({
    dev,
    onClose,
    onSuccess,
}: {
    dev: DevolucionLogistica;
    onClose: () => void;
    onSuccess: () => void;
}) {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    function handleConfirmar() {
        setError(null);
        startTransition(async () => {
            const res = await recepcionarDevolucionBodegueroAction(dev.custodiaId);
            if (res.error) {
                setError(res.error);
            } else {
                onSuccess();
            }
        });
    }

    return (
        <div
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center px-4"
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 pt-6 pb-4 bg-gradient-to-br from-orange-50 to-white border-b border-slate-100">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-orange-100 flex items-center justify-center shrink-0">
                                <ArrowLeftRight className="w-5 h-5 text-orange-600" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    Reingresos de Proyectos
                                </p>
                                <h3 className="text-lg font-black text-slate-900 leading-tight">
                                    Confirmar Recepción
                                </h3>
                            </div>
                        </div>
                        <button onClick={onClose} disabled={isPending} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-40">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                    {/* Resumen */}
                    <div className="bg-slate-50 rounded-2xl border border-slate-100 divide-y divide-slate-100">
                        <div className="flex items-center gap-3 px-4 py-3">
                            <FolderKanban className="w-4 h-4 text-indigo-400 shrink-0" />
                            <div className="min-w-0">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Proyecto</p>
                                <Link
                                    href={`/dashboard/proyectos/${dev.proyectoId}`}
                                    target="_blank"
                                    className="text-sm font-black text-indigo-600 hover:text-indigo-800 hover:underline transition-colors truncate block"
                                >
                                    {dev.proyectoNombre}
                                </Link>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 px-4 py-3">
                            <User className="w-4 h-4 text-slate-400 shrink-0" />
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Técnico que devuelve</p>
                                <p className="text-sm font-bold text-slate-800">{dev.tecnicoNombre}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 px-4 py-3">
                            <Package className="w-4 h-4 text-slate-400 shrink-0" />
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Producto / Cantidad</p>
                                <p className="text-sm font-bold text-slate-800">
                                    {dev.modelo}
                                    <span className="ml-2 text-xs font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                                        {dev.cantidad} ud.
                                    </span>
                                </p>
                            </div>
                        </div>
                        {dev.motivoDevolucion && (
                            <div className="px-4 py-3">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Motivo</p>
                                <p className="text-xs text-amber-800 font-medium italic">"{dev.motivoDevolucion}"</p>
                            </div>
                        )}
                    </div>

                    {/* Aviso del efecto */}
                    <div className="flex items-start gap-2.5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-emerald-800 leading-relaxed">
                            Al confirmar, se certifica la recepción física del material en bodega y el ítem
                            queda <span className="font-black">reingresado al inventario del Proyecto</span> para
                            que pueda solicitarse nuevamente.
                        </p>
                    </div>

                    {error && (
                        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 border border-red-100">
                            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                            <p className="text-xs font-semibold text-red-700">{error}</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 pb-6 flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={isPending}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirmar}
                        disabled={isPending}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-600 text-white text-sm font-black rounded-xl hover:bg-orange-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                    >
                        {isPending
                            ? <><Loader2 className="w-4 h-4 animate-spin" />Procesando…</>
                            : <><CheckCircle2 className="w-4 h-4" />Confirmar Recepción</>
                        }
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Lote (paquete masivo): recepción / rechazo en un solo paso ───────────────

function ModalLote({
    lote,
    modo,
    bodegas,
    onClose,
    onSuccess,
}: {
    lote:      LoteDevolucion;
    modo:      'recibir' | 'rechazar';
    bodegas:   { id: string; nombre: string; tipo: string }[];
    onClose:   () => void;
    onSuccess: (msg: string) => void;
}) {
    const [isPending, startTransition] = useTransition();
    const [error, setError]       = useState<string | null>(null);
    const [bodegaId, setBodegaId] = useState(bodegas[0]?.id ?? '');
    const [texto, setTexto]       = useState('');

    const recibir = modo === 'recibir';

    function handleConfirmar() {
        setError(null);
        startTransition(async () => {
            const res = recibir
                ? await recepcionarLoteDevolucionAction(lote.loteId, bodegaId, texto.trim() || null)
                : await rechazarLoteDevolucionAction(lote.loteId, texto);
            if (res.error) setError(res.error);
            else onSuccess(recibir
                ? `Paquete recepcionado: ${lote.totalUnidades} unidad(es) reingresadas a bodega.`
                : 'Paquete rechazado. Las unidades volvieron a "sin declarar" en el proyecto.');
        });
    }

    const puede = recibir ? !!bodegaId : texto.trim().length > 0;

    return (
        <div
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center px-4"
            onClick={e => { if (e.target === e.currentTarget && !isPending) onClose(); }}
        >
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
                <div className={`px-6 pt-6 pb-4 border-b border-slate-100 bg-gradient-to-br ${recibir ? 'from-orange-50' : 'from-red-50'} to-white`}>
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Paquete · {lote.totalLineas} línea(s) · {lote.totalUnidades} u.
                            </p>
                            <h3 className="text-lg font-black text-slate-900 leading-tight">
                                {recibir ? 'Recepcionar paquete completo' : 'Rechazar paquete'}
                            </h3>
                        </div>
                        <button onClick={onClose} disabled={isPending} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-40">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="p-6 space-y-4">
                    <p className="text-xs text-slate-600 leading-relaxed">
                        {recibir
                            ? <>Se certifica la recepción física de <b>todo el paquete</b> en un solo paso: los seriales quedan
                                <b> Disponibles</b> en la bodega elegida, los genéricos se suman al stock y el proyecto los
                                registra como reingresados.</>
                            : <>Se rechaza el paquete completo. Las unidades vuelven a estado <b>sin declarar</b> en el proyecto y los seriales quedan libres.</>}
                    </p>

                    {recibir ? (
                        <>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Bodega de destino</label>
                                <CustomSelect
                                    id="bodega-destino-lote"
                                    value={bodegaId}
                                    onChange={setBodegaId}
                                    placeholder="Seleccionar bodega…"
                                    options={bodegas.map(b => ({ value: b.id, label: b.nombre }))}
                                />
                            </div>
                            <textarea
                                value={texto}
                                onChange={e => setTexto(e.target.value)}
                                placeholder="Comentario de recepción (opcional)…"
                                rows={2}
                                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 resize-none"
                            />
                        </>
                    ) : (
                        <textarea
                            value={texto}
                            onChange={e => setTexto(e.target.value)}
                            placeholder="Motivo del rechazo (obligatorio)…"
                            rows={3}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 resize-none"
                        />
                    )}

                    {error && (
                        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 border border-red-100">
                            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                            <p className="text-xs font-semibold text-red-700">{error}</p>
                        </div>
                    )}
                </div>

                <div className="px-6 pb-6 flex gap-3">
                    <button onClick={onClose} disabled={isPending}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                        Cancelar
                    </button>
                    <button onClick={handleConfirmar} disabled={isPending || !puede}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-white text-sm font-black rounded-xl shadow-md disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] ${recibir ? 'bg-orange-600 hover:bg-orange-700' : 'bg-red-600 hover:bg-red-700'}`}>
                        {isPending
                            ? <><Loader2 className="w-4 h-4 animate-spin" />Procesando…</>
                            : recibir ? <><CheckCircle2 className="w-4 h-4" />Confirmar recepción</> : <><XCircle className="w-4 h-4" />Rechazar paquete</>}
                    </button>
                </div>
            </div>
        </div>
    );
}

function LoteCard({
    lote,
    onRecibir,
    onRechazar,
}: {
    lote:       LoteDevolucion;
    onRecibir:  () => void;
    onRechazar: () => void;
}) {
    const [abierto, setAbierto] = useState(false);
    const totalSeriales = lote.lineas.reduce((a, l) => a + l.seriales.length, 0);

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-orange-400 to-amber-400" />
            <div className="p-5 space-y-3">
                <div className="flex items-center gap-2.5 flex-wrap">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                        <Layers className="w-4 h-4 text-amber-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-slate-900 leading-tight">
                            Paquete de {lote.totalUnidades} unidad{lote.totalUnidades !== 1 ? 'es' : ''}
                        </p>
                        <p className="text-[11px] text-slate-400 font-medium">
                            {lote.totalLineas} línea{lote.totalLineas !== 1 ? 's' : ''} de receta
                            {totalSeriales > 0 && ` · ${totalSeriales} serial${totalSeriales !== 1 ? 'es' : ''}`}
                        </p>
                    </div>
                    <span className="text-[10px] font-black px-2 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 shrink-0">
                        Lote en Tránsito
                    </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-semibold text-slate-700 truncate">{lote.tecnicoNombre}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Warehouse className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <Link
                            href={`/dashboard/proyectos/${lote.proyectoId}`}
                            target="_blank"
                            className="font-bold text-indigo-600 hover:text-indigo-800 hover:underline truncate"
                        >
                            {lote.proyectoNombre}
                        </Link>
                    </div>
                </div>

                <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-xl">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-800">
                        <p className="font-bold">{lote.motivo}</p>
                        {lote.observacion && <p className="italic font-medium mt-0.5">&ldquo;{lote.observacion}&rdquo;</p>}
                    </div>
                </div>

                {/* Detalle colapsable del paquete */}
                <button
                    type="button"
                    onClick={() => setAbierto(v => !v)}
                    className="flex items-center gap-1.5 text-[11px] font-black text-slate-500 hover:text-slate-700 transition-colors"
                >
                    {abierto ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    {abierto ? 'Ocultar detalle' : 'Ver detalle del paquete'}
                </button>
                {abierto && (
                    <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-100 divide-y divide-slate-100">
                        {lote.lineas.map(l => (
                            <div key={l.equipId} className="px-3 py-2.5">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-xs font-black text-slate-800 truncate">{l.modelo}</p>
                                    <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
                                        {l.cantidad} u. · {l.esSerializado ? 'Serializado' : 'Genérico'}
                                    </span>
                                </div>
                                <p className="text-[10px] text-slate-400">{l.familia}</p>
                                {l.seriales.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                        {l.seriales.map(sn => (
                                            <span key={sn} className="text-[10px] font-mono font-bold text-slate-600 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded">
                                                {sn}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                        <Clock className="w-3 h-3" />
                        {timeAgo(lote.createdAt)}
                    </span>
                    {lote.evidenciaUrl && (
                        <a href={lote.evidenciaUrl} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline">
                            <ExternalLink className="w-3 h-3" />Ver evidencia
                        </a>
                    )}
                    {lote.firmaUrl && (
                        <a href={lote.firmaUrl} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline">
                            <ExternalLink className="w-3 h-3" />Ver firma
                        </a>
                    )}
                </div>

                <div className="pt-1 border-t border-slate-100 flex gap-2">
                    <button
                        onClick={onRechazar}
                        className="px-4 py-2.5 border border-red-200 text-red-600 text-sm font-black rounded-xl hover:bg-red-50 transition-colors"
                    >
                        Rechazar
                    </button>
                    <button
                        onClick={onRecibir}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-600 text-white text-sm font-black rounded-xl hover:bg-orange-700 transition-all shadow-md active:scale-[0.98]"
                    >
                        <ArrowLeftRight className="w-4 h-4" />
                        Recepcionar paquete completo
                    </button>
                </div>
            </div>
        </div>
    );
}

export function BandejaLogisticaInversa({ devoluciones, lotes, bodegas, onRefresh }: Props) {
    const [modalDev, setModalDev] = useState<DevolucionLogistica | null>(null);
    const [modalLote, setModalLote] = useState<{ lote: LoteDevolucion; modo: 'recibir' | 'rechazar' } | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    function handleSuccess(msg = 'Material recepcionado y reingresado al proyecto exitosamente.') {
        setModalDev(null);
        setModalLote(null);
        setSuccessMsg(msg);
        onRefresh();
        setTimeout(() => setSuccessMsg(null), 5000);
    }

    return (
        <div className="space-y-4">
            {successMsg && (
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <p className="text-sm font-bold text-emerald-800">{successMsg}</p>
                </div>
            )}

            {lotes.length > 0 && (
                <div className="space-y-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Paquetes masivos ({lotes.length})
                    </p>
                    {lotes.map(l => (
                        <LoteCard
                            key={l.loteId}
                            lote={l}
                            onRecibir={() => setModalLote({ lote: l, modo: 'recibir' })}
                            onRechazar={() => setModalLote({ lote: l, modo: 'rechazar' })}
                        />
                    ))}
                </div>
            )}

            {devoluciones.length === 0 && lotes.length > 0 ? null : devoluciones.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-sm">
                    <div className="w-16 h-16 rounded-full bg-orange-50 flex items-center justify-center mx-auto mb-4">
                        <ArrowLeftRight className="w-8 h-8 text-orange-300" />
                    </div>
                    <h3 className="text-lg font-black text-slate-700 mb-1">
                        No hay devoluciones pendientes
                    </h3>
                    <p className="text-sm font-medium text-slate-400">
                        Cuando un técnico reporte material en tránsito desde un proyecto, aparecerá aquí.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {devoluciones.map(dev => (
                        <div key={dev.custodiaId}
                            className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                        >
                            {/* Top stripe */}
                            <div className="h-1 bg-gradient-to-r from-orange-400 to-amber-400" />

                            <div className="p-5 space-y-3">
                                {/* Producto + badge */}
                                <div className="flex items-center gap-2.5 flex-wrap">
                                    <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                                        <Package className="w-4 h-4 text-slate-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-black text-slate-900 leading-tight truncate">
                                            {dev.modelo}
                                        </p>
                                        <p className="text-[11px] text-slate-400 font-medium">
                                            {dev.cantidad} unidad{dev.cantidad !== 1 ? 'es' : ''} ·{' '}
                                            {dev.esSerializado ? 'Serializado' : 'Genérico'}
                                        </p>
                                    </div>
                                    <span className="text-[10px] font-black px-2 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 shrink-0">
                                        En Tránsito
                                    </span>
                                </div>

                                {/* Técnico + Proyecto */}
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                    <div className="flex items-center gap-2">
                                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                        <span className="font-semibold text-slate-700 truncate">{dev.tecnicoNombre}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Warehouse className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                        <Link
                                            href={`/dashboard/proyectos/${dev.proyectoId}`}
                                            target="_blank"
                                            className="font-bold text-indigo-600 hover:text-indigo-800 hover:underline truncate transition-colors"
                                        >
                                            {dev.proyectoNombre}
                                        </Link>
                                    </div>
                                </div>

                                {/* Motivo */}
                                {dev.motivoDevolucion && (
                                    <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-xl">
                                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                                        <p className="text-xs text-amber-800 font-medium italic">
                                            "{dev.motivoDevolucion}"
                                        </p>
                                    </div>
                                )}

                                {/* Timestamp + evidencia */}
                                <div className="flex items-center gap-3 flex-wrap">
                                    <span className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                                        <Clock className="w-3 h-3" />
                                        {timeAgo(dev.createdAt)}
                                    </span>
                                    {dev.evidenciaUrl && (
                                        <a
                                            href={dev.evidenciaUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline transition-colors"
                                        >
                                            <ExternalLink className="w-3 h-3" />
                                            Ver evidencia
                                        </a>
                                    )}
                                </div>

                                {/* Action */}
                                <div className="pt-1 border-t border-slate-100">
                                    <button
                                        onClick={() => setModalDev(dev)}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-600 text-white text-sm font-black rounded-xl hover:bg-orange-700 transition-all shadow-md active:scale-[0.98]"
                                    >
                                        <ArrowLeftRight className="w-4 h-4" />
                                        Recepcionar y Reingresar al Proyecto
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {modalDev && (
                <ModalRecepcionar
                    dev={modalDev}
                    onClose={() => setModalDev(null)}
                    onSuccess={() => handleSuccess()}
                />
            )}

            {modalLote && (
                <ModalLote
                    lote={modalLote.lote}
                    modo={modalLote.modo}
                    bodegas={bodegas}
                    onClose={() => setModalLote(null)}
                    onSuccess={handleSuccess}
                />
            )}
        </div>
    );
}
