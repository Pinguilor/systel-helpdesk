'use client';

import React, { useState, useRef } from 'react';
import { X, CheckCircle, FileText, User as UserIcon, LayoutTemplate, Briefcase } from 'lucide-react';
import dynamic from 'next/dynamic';

const SignatureCanvas = dynamic(() => import('react-signature-canvas'), { ssr: false });

interface Props {
    isOpen: boolean;
    onClose: () => void;
    ticket: any;
    materiales?: any[];
    onConfirm: (notas: string, firmaClienteUrl: string, firmaTecnicoUrl: string, receptorNombre: string, latitud: number, longitud: number) => Promise<void>;
}

export function CloseTicketModal({ isOpen, onClose, ticket, materiales = [], onConfirm }: Props) {
    const [notas, setNotas] = useState('');
    const [receptorNombre, setReceptorNombre] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLocating, setIsLocating] = useState(false);
    const [gpsError, setGpsError] = useState('');
    const [renderTrigger, setRenderTrigger] = useState(0);

    const sigCanvasCliente = useRef<any>(null);
    const sigCanvasTecnico = useRef<any>(null);

    if (!isOpen) return null;

    const pullTrigger = () => setRenderTrigger(v => v + 1);

    const clearCliente = () => {
        sigCanvasCliente.current?.clear();
        pullTrigger();
    };

    const clearTecnico = () => {
        sigCanvasTecnico.current?.clear();
        pullTrigger();
    };

    const checkEnabled = () => {
        if (!notas.trim() || !receptorNombre.trim()) return false;
        if (!sigCanvasCliente.current || sigCanvasCliente.current.isEmpty()) return false;
        if (!sigCanvasTecnico.current || sigCanvasTecnico.current.isEmpty()) return false;
        return true;
    };

    const obtenerUbicacion = (): Promise<GeolocationPosition> => {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject({ code: 0, message: 'Geolocalización no soportada por el navegador.' });
            } else {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 15000,
                    maximumAge: 0
                });
            }
        });
    };

    const handleConfirm = async () => {
        if (!checkEnabled()) return;
        setIsSubmitting(true);
        setIsLocating(true);
        setGpsError('');

        try {
            const position = await obtenerUbicacion();
            setIsLocating(false);

            const firmaCliente = sigCanvasCliente.current.getTrimmedCanvas().toDataURL('image/png');
            const firmaTecnico = sigCanvasTecnico.current.getTrimmedCanvas().toDataURL('image/png');
            await onConfirm(notas, firmaCliente, firmaTecnico, receptorNombre, position.coords.latitude, position.coords.longitude);
        } catch (error: any) {
            console.error('GPS Error:', error);
            setIsLocating(false);

            let mensajeError = 'Error desconocido al obtener la ubicación.';
            switch (error.code) {
                case 1:
                    mensajeError = 'Permiso de ubicación denegado.';
                    break;
                case 2:
                    mensajeError = 'Posición no disponible (comprueba tu señal o Wi-Fi).';
                    break;
                case 3:
                    mensajeError = 'Tiempo de espera agotado al buscar el GPS.';
                    break;
            }

            setGpsError(mensajeError);
            setIsSubmitting(false);
        }
    };

    // Filter used materials from packing list (salida and not pendiente)
    const usedMaterials = materiales.filter(item =>
        item.tipo_movimiento === 'salida' &&
        item.estado !== 'pendiente' &&
        item.estado !== 'devuelto'
    );

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity animate-in fade-in" onClick={!isSubmitting ? onClose : undefined} />

            <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center shrink-0 bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                            <FileText className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Generar acta y cerrar</h2>
                            <p className="text-xs text-slate-500 font-medium">Revisa los datos y recolecta firmas antes de generar el acta para NC-{ticket.numero_ticket}</p>
                        </div>
                    </div>
                    <button disabled={isSubmitting} onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors disabled:opacity-50">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body - Scrollable */}
                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    {/* Previsualización PDF Data */}
                    <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 shadow-sm">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <LayoutTemplate className="w-4 h-4" /> Resumen de la Orden (Preview)
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <span className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Cliente / Ubicación</span>
                                <div className="text-sm font-bold text-slate-800">{ticket.restaurantes?.razon_social || 'Arcos Dorados de Chile'}</div>
                                <div className="text-xs text-slate-600 mt-0.5">📍 {ticket.restaurantes?.nombre_restaurante}</div>
                            </div>
                            <div>
                                <span className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Tipo de Servicio</span>
                                <div className="text-sm font-bold text-slate-800">{ticket.catalogo_servicios?.categoria || 'Mantenimiento / Reparación'}</div>
                                <div className="text-xs text-slate-600 mt-0.5">{ticket.catalogo_servicios?.elemento}</div>
                            </div>
                        </div>

                        {materiales.length > 0 && (
                            <div className="mt-5 pt-4 border-t border-slate-200">
                                <span className="block text-[10px] uppercase font-bold text-slate-500 mb-2.5">Materiales Insumidos</span>
                                <ul className="space-y-1.5">
                                    {materiales.map((item: any, i: number) => (
                                        <li key={i} className="text-xs font-medium text-slate-700 flex justify-between bg-white px-3 py-2 rounded-lg border border-slate-100">
                                            <span className="truncate pr-2">➔ {item.equipos?.modelo || item.modelo || item.descripcion || '-'}</span>
                                            <span className="font-bold shrink-0">{item.cantidad || 1} UND</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    {/* Receptor de Conformidad */}
                    <div>
                        <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <UserIcon className="w-4 h-4 text-emerald-500" /> Nombre del Receptor *
                        </label>
                        <input
                            type="text"
                            value={receptorNombre}
                            onChange={(e) => setReceptorNombre(e.target.value)}
                            placeholder="Ej. Juan Pérez (Administrador local)"
                            required
                            className="w-full border-2 border-slate-200 rounded-xl p-4 text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all shadow-sm"
                        />
                    </div>

                    {/* Notas de Cierre */}
                    <div>
                        <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <Briefcase className="w-4 h-4 text-indigo-500" /> Descripción del Trabajo (Notas de Cierre) *
                        </label>
                        <textarea
                            value={notas}
                            onChange={(e) => setNotas(e.target.value)}
                            placeholder="Ej. Se realizó limpieza preventiva y ajustes de conectores. Todo quedando operativo..."
                            required
                            rows={4}
                            className="w-full border-2 border-slate-200 rounded-xl p-4 text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-sm"
                        />
                    </div>

                    {/* Firmas */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-5 rounded-xl border border-slate-100">
                        {/* Firma Cliente */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                                    <UserIcon className="w-4 h-4 text-emerald-500" /> Firma del Cliente *
                                </label>
                                <button type="button" onClick={clearCliente} className="text-[10px] font-bold text-rose-500 hover:text-rose-700 uppercase tracking-wider transition-colors">
                                    Borrar
                                </button>
                            </div>
                            <div className="bg-white border-2 border-dashed border-slate-300 rounded-xl overflow-hidden touch-none relative" style={{ height: 160 }}>
                                {/* @ts-ignore */}
                                <SignatureCanvas
                                    ref={sigCanvasCliente}
                                    penColor="black"
                                    canvasProps={{ className: 'w-full h-full cursor-crosshair' }}
                                    onEnd={pullTrigger}
                                />
                                {!sigCanvasCliente.current || sigCanvasCliente.current.isEmpty() ? (
                                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                        <p className="text-xs text-slate-300 font-bold uppercase tracking-widest">Dibujar Firma</p>
                                    </div>
                                ) : null}
                            </div>
                        </div>

                        {/* Firma Técnico */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                                    <UserIcon className="w-4 h-4 text-blue-500" /> Firma del Técnico *
                                </label>
                                <button type="button" onClick={clearTecnico} className="text-[10px] font-bold text-rose-500 hover:text-rose-700 uppercase tracking-wider transition-colors">
                                    Borrar
                                </button>
                            </div>
                            <div className="bg-white border-2 border-dashed border-slate-300 rounded-xl overflow-hidden touch-none relative" style={{ height: 160 }}>
                                {/* @ts-expect-error Ignorando el tipado estricto de Vercel para el ref de esta librería */}
                                <SignatureCanvas
                                    ref={sigCanvasTecnico}
                                    penColor="black"
                                    canvasProps={{ className: 'w-full h-full cursor-crosshair' }}
                                    onEnd={pullTrigger}
                                />
                                {!sigCanvasTecnico.current || sigCanvasTecnico.current.isEmpty() ? (
                                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                        <p className="text-xs text-slate-300 font-bold uppercase tracking-widest">Dibujar Firma</p>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 bg-white flex flex-col gap-3 shrink-0">
                    {gpsError && (
                        <div className="bg-rose-50 text-rose-600 border border-rose-200 p-3 rounded-lg text-sm font-medium flex items-center justify-center">
                            ⚠️ {gpsError}
                        </div>
                    )}
                    <div className="flex justify-end gap-3 w-full">
                        <button
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-sm font-bold hover:bg-slate-50 transition-colors disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={!checkEnabled() || isSubmitting || isLocating}
                            className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-all shadow-md disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isLocating ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    📍 Obteniendo ubicación...
                                </div>
                            ) : isSubmitting ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Procesando...
                                </div>
                            ) : (
                                <>
                                    <CheckCircle className="w-4 h-4" /> Proceder al Cierre y Generar Acta
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}