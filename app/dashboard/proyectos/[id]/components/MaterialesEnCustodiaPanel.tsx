'use client';

import { useState, useTransition, useCallback } from 'react';
import { Loader2, Truck, MapPin, CheckCircle2, AlertTriangle, PackageSearch, RefreshCw, Clock } from 'lucide-react';
import { getMaterialesEnCustodia, aceptarDevolucionLogistica, type MaterialEnCustodia } from '../actions';

interface MaterialesEnCustodiaPanelProps {
    proyectoId:     string;
    currentUserRol: string;
    /** Pre-cargados desde el servidor (SSR o cliente) */
    initialData?:   MaterialEnCustodia[];
}

const ESTADO_CONFIG = {
    Estacionado_Obra: {
        label:       'En Obra',
        icon:        MapPin,
        chipClass:   'bg-orange-50 text-orange-700 border-orange-200',
        dotClass:    'bg-orange-400',
    },
    En_Transito_Devolucion: {
        label:       'En Tránsito',
        icon:        Truck,
        chipClass:   'bg-blue-50 text-blue-700 border-blue-200',
        dotClass:    'bg-blue-400',
    },
    Reingresado_Logistica: {
        label:       'Reingresado',
        icon:        CheckCircle2,
        chipClass:   'bg-green-50 text-green-700 border-green-200',
        dotClass:    'bg-green-400',
    },
} as const;

function formatFecha(iso: string) {
    return new Date(iso).toLocaleDateString('es-CL', {
        day:    'numeric',
        month:  'short',
        hour:   '2-digit',
        minute: '2-digit',
    });
}

interface ConfirmarRecepcionModalProps {
    item:       MaterialEnCustodia;
    proyectoId: string;
    onClose:    () => void;
    onSuccess:  () => void;
}

function ConfirmarRecepcionModal({ item, proyectoId, onClose, onSuccess }: ConfirmarRecepcionModalProps) {
    const [error,    setError]    = useState<string | null>(null);
    const [exito,    setExito]    = useState(false);
    const [isPending, startTransition] = useTransition();

    function handleConfirmar() {
        setError(null);
        startTransition(async () => {
            const result = await aceptarDevolucionLogistica(item.custodiaId, proyectoId);
            if (result.error) {
                setError(result.error);
            } else {
                setExito(true);
                setTimeout(onSuccess, 1200);
            }
        });
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                <div className="p-5">
                    {exito ? (
                        <div className="flex flex-col items-center text-center gap-3 py-4">
                            <div className="w-14 h-14 rounded-2xl bg-green-50 border border-green-200 flex items-center justify-center">
                                <CheckCircle2 className="w-7 h-7 text-green-600" />
                            </div>
                            <p className="text-base font-black text-slate-900">¡Handshake completado!</p>
                            <p className="text-sm text-slate-500">
                                {item.cantidad} u. de <strong>{item.modelo}</strong> reingresadas a Logística.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-xl bg-green-50 border border-green-200 flex items-center justify-center shrink-0">
                                    <Truck className="w-5 h-5 text-green-600" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Confirmar Recepción</p>
                                    <p className="text-sm font-black text-slate-900 leading-tight">{item.modelo}</p>
                                </div>
                            </div>

                            <div className="bg-slate-50 rounded-xl p-3 mb-4 space-y-1.5 text-xs text-slate-600">
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Unidades</span>
                                    <span className="font-bold">{item.cantidad}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Motivo</span>
                                    <span className="font-bold text-right max-w-[160px]">{item.motivoIncidencia}</span>
                                </div>
                                {item.responsableNombre && (
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Responsable</span>
                                        <span className="font-bold">{item.responsableNombre}</span>
                                    </div>
                                )}
                            </div>

                            <p className="text-xs text-slate-500 mb-4">
                                Al confirmar, el técnico quedará liberado de la responsabilidad de este material
                                y las unidades se contabilizarán como <strong>Reingresadas a Logística</strong>.
                            </p>

                            {error && (
                                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 mb-3">
                                    <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                                    <p className="text-xs text-red-700">{error}</p>
                                </div>
                            )}

                            <div className="flex gap-2">
                                <button
                                    onClick={onClose}
                                    disabled={isPending}
                                    className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleConfirmar}
                                    disabled={isPending}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 rounded-xl text-sm font-black text-white transition-all shadow-sm"
                                >
                                    {isPending ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" /> Confirmando…</>
                                    ) : (
                                        <>
                                            <CheckCircle2 className="w-4 h-4" />
                                            Confirmar Recepción
                                        </>
                                    )}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export function MaterialesEnCustodiaPanel({
    proyectoId,
    currentUserRol,
    initialData = [],
}: MaterialesEnCustodiaPanelProps) {
    const [items,       setItems]       = useState<MaterialEnCustodia[]>(initialData);
    const [isLoading,   setIsLoading]   = useState(false);
    const [fetchError,  setFetchError]  = useState<string | null>(null);
    const [confirmarItem, setConfirmarItem] = useState<MaterialEnCustodia | null>(null);
    const [, startTransition] = useTransition();

    const rol        = (currentUserRol ?? '').toLowerCase();
    const puedeAceptar = rol === 'admin' || rol === 'coordinador' || rol === 'bodeguero';

    const recargar = useCallback(() => {
        setIsLoading(true);
        setFetchError(null);
        startTransition(async () => {
            const result = await getMaterialesEnCustodia(proyectoId);
            if (result.error) {
                setFetchError(result.error);
            } else {
                setItems(result.data);
            }
            setIsLoading(false);
        });
    }, [proyectoId]);

    const enTransito   = items.filter(i => i.estado === 'En_Transito_Devolucion');
    const estacionados = items.filter(i => i.estado === 'Estacionado_Obra');

    if (items.length === 0 && !isLoading) {
        return (
            <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
                <PackageSearch className="w-8 h-8 text-slate-300" />
                <p className="text-xs text-slate-400 font-semibold">Sin materiales en custodia activa</p>
                <button
                    onClick={recargar}
                    className="text-[10px] text-slate-400 hover:text-slate-600 underline transition-colors"
                >
                    Actualizar
                </button>
            </div>
        );
    }

    return (
        <>
            {/* Header del panel */}
            <div className="flex items-center justify-between mb-3">
                <div>
                    <h3 className="text-xs font-black text-slate-900">Custodia de Materiales</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                        {enTransito.length > 0 && `${enTransito.length} en tránsito`}
                        {enTransito.length > 0 && estacionados.length > 0 && ' · '}
                        {estacionados.length > 0 && `${estacionados.length} estacionado${estacionados.length !== 1 ? 's' : ''} en obra`}
                    </p>
                </div>
                <button
                    onClick={recargar}
                    disabled={isLoading}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
                    title="Actualizar"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {fetchError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-3">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700">{fetchError}</p>
                </div>
            )}

            {/* Lista de ítems */}
            <div className="space-y-2">
                {isLoading && items.length === 0 ? (
                    <div className="flex items-center justify-center py-6">
                        <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                    </div>
                ) : (
                    items.map(item => {
                        const cfg   = ESTADO_CONFIG[item.estado];
                        const Icon  = cfg.icon;
                        const enTransitoItem = item.estado === 'En_Transito_Devolucion';

                        return (
                            <div
                                key={item.custodiaId}
                                className="bg-slate-50 border border-slate-200/70 rounded-xl p-3 space-y-2"
                            >
                                {/* Cabecera ítem */}
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs font-black text-slate-900 truncate">{item.modelo}</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5 truncate">{item.motivoIncidencia}</p>
                                    </div>
                                    <div className={`flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-full border text-[10px] font-bold ${cfg.chipClass}`}>
                                        <Icon className="w-3 h-3" />
                                        {cfg.label}
                                    </div>
                                </div>

                                {/* Metadatos */}
                                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-400">
                                    <span className="font-bold text-slate-600">{item.cantidad} u.</span>
                                    {item.responsableNombre && (
                                        <span>Resp: <span className="text-slate-600 font-semibold">{item.responsableNombre}</span></span>
                                    )}
                                    <span className="flex items-center gap-0.5">
                                        <Clock className="w-3 h-3" />
                                        {formatFecha(item.createdAt)}
                                    </span>
                                </div>

                                {/* Botón handshake (solo para En_Transito y gestores) */}
                                {enTransitoItem && puedeAceptar && (
                                    <button
                                        onClick={() => setConfirmarItem(item)}
                                        className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-black transition-all shadow-sm"
                                    >
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        Confirmar Recepción
                                    </button>
                                )}

                                {enTransitoItem && !puedeAceptar && (
                                    <p className="text-[10px] text-blue-600 font-semibold">
                                        Pendiente de confirmación por Logística
                                    </p>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Modal de confirmación */}
            {confirmarItem && (
                <ConfirmarRecepcionModal
                    item={confirmarItem}
                    proyectoId={proyectoId}
                    onClose={() => setConfirmarItem(null)}
                    onSuccess={() => {
                        setConfirmarItem(null);
                        recargar();
                    }}
                />
            )}
        </>
    );
}
