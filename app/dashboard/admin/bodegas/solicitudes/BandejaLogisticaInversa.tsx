'use client';

import { useState, useTransition } from 'react';
import {
    ArrowLeftRight, User, Package, Warehouse, AlertTriangle,
    CheckCircle2, Loader2, X, ExternalLink, Clock, FolderKanban,
} from 'lucide-react';
import Link from 'next/link';
import {
    recepcionarDevolucionBodegueroAction,
    type DevolucionLogistica,
} from './actions';

interface Props {
    devoluciones: DevolucionLogistica[];
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

export function BandejaLogisticaInversa({ devoluciones, onRefresh }: Props) {
    const [modalDev, setModalDev] = useState<DevolucionLogistica | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    function handleSuccess() {
        setModalDev(null);
        setSuccessMsg('Material recepcionado y reingresado al proyecto exitosamente.');
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

            {devoluciones.length === 0 ? (
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
                    onSuccess={handleSuccess}
                />
            )}
        </div>
    );
}
