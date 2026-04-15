'use client';

import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle, FileText, User as UserIcon, LayoutTemplate, Briefcase, Users, ChevronDown, Search } from 'lucide-react';
import dynamic from 'next/dynamic';

const SignatureCanvas = dynamic(() => import('react-signature-canvas'), { ssr: false }) as any;

interface Props {
    isOpen: boolean;
    onClose: () => void;
    ticket: any;
    materiales?: any[];
    agents?: { id: string; full_name: string }[];
    currentUserId?: string;
    onConfirm: (notas: string, firmaClienteUrl: string, firmaTecnicoUrl: string, receptorNombre: string, latitud: number, longitud: number, ayudantes: string[]) => Promise<void>;
}

export function CloseTicketModal({ isOpen, onClose, ticket, materiales = [], agents = [], currentUserId, onConfirm }: Props) {
    const [notas, setNotas] = useState('');
    const [receptorNombre, setReceptorNombre] = useState('');
    const [ayudantes, setAyudantes] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLocating, setIsLocating] = useState(false);
    const [gpsError, setGpsError] = useState('');
    const [renderTrigger, setRenderTrigger] = useState(0);

    const [dropOpen, setDropOpen] = useState(false);
    const [search, setSearch] = useState('');
    const dropTriggerRef = useRef<HTMLButtonElement>(null);
    const [dropRect, setDropRect] = useState<{ top: number; left: number; width: number } | null>(null);

    // Técnicos disponibles = todos excepto el usuario actual y los ya seleccionados
    const disponibles = agents.filter(a => a.id !== currentUserId && !ayudantes.includes(a.id));
    const filtrados = disponibles.filter(a =>
        a.full_name.toLowerCase().includes(search.toLowerCase())
    );

    const addAyudante = (id: string) => { setAyudantes(prev => [...prev, id]); setSearch(''); };
    const removeAyudante = (id: string) => setAyudantes(prev => prev.filter(a => a !== id));

    const openDrop = () => {
        if (dropTriggerRef.current) {
            const r = dropTriggerRef.current.getBoundingClientRect();
            setDropRect({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 260) });
        }
        setSearch('');
        setDropOpen(true);
    };

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
                    timeout: 10000,
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

        let lat = 0;
        let lng = 0;

        try {
            const position = await obtenerUbicacion();
            lat = position.coords.latitude;
            lng = position.coords.longitude;
        } catch (err: any) {
            setGpsError('Ubicación requerida para generar el acta. Activa el GPS o los permisos de ubicación e intenta de nuevo.');
            setIsSubmitting(false);
            setIsLocating(false);
            return;
        }

        setIsLocating(false);

        const firmaCliente = sigCanvasCliente.current.getTrimmedCanvas().toDataURL('image/png');
        const firmaTecnico = sigCanvasTecnico.current.getTrimmedCanvas().toDataURL('image/png');
        
        try {
            await onConfirm(notas, firmaCliente, firmaTecnico, receptorNombre, lat, lng, ayudantes);
        } catch (error) {
            console.error('Error al confirmar acta:', error);
            setGpsError('Error al guardar el acta: Verifique su conexión y contacte a soporte si el problema persiste.');
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
        <div className="fixed inset-0 z-[9999] flex items-start justify-center p-4 pt-24 pb-12">
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity animate-in fade-in" onClick={!isSubmitting ? onClose : undefined} />

            <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[calc(100vh-8rem)] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
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
                                <ul className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
                                    {materiales.map((item: any, i: number) => (
                                        <li key={i} className="text-xs font-medium text-slate-700 flex justify-between bg-white px-3 py-2 rounded-lg border border-slate-100">
                                            <span className="truncate pr-2">
                                                ➔ {item.es_serializado
                                                    ? `1x ${item.modelo || item.descripcion || '-'} (SN: ${item.numero_serie || 'N/A'})`
                                                    : `${item.cantidad || 1}x ${item.modelo || item.descripcion || '-'} (${item.familia || 'Genérico'})`}
                                            </span>
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

                    {/* Técnicos Ayudantes */}
                    {agents.length > 1 && (
                        <div>
                            <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <Users className="w-4 h-4 text-violet-500" />
                                Técnicos Ayudantes
                                <span className="text-slate-400 font-medium normal-case tracking-normal">(Opcional)</span>
                            </label>

                            {/* Badges de los ya seleccionados */}
                            {ayudantes.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {ayudantes.map(id => {
                                        const a = agents.find(ag => ag.id === id);
                                        return (
                                            <span
                                                key={id}
                                                className="inline-flex items-center gap-1.5 bg-violet-100 text-violet-800 border border-violet-200 px-3 py-1.5 rounded-full text-sm font-semibold"
                                            >
                                                <span className="w-5 h-5 rounded-full bg-violet-300 text-violet-900 flex items-center justify-center text-[10px] font-black shrink-0">
                                                    {a?.full_name.charAt(0).toUpperCase()}
                                                </span>
                                                {a?.full_name}
                                                <button
                                                    type="button"
                                                    onClick={() => removeAyudante(id)}
                                                    className="ml-0.5 hover:text-red-500 transition-colors rounded-full"
                                                    aria-label={`Quitar a ${a?.full_name}`}
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </span>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Botón trigger del dropdown */}
                            {disponibles.length > 0 && (
                                <button
                                    ref={dropTriggerRef}
                                    type="button"
                                    onClick={openDrop}
                                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-violet-300 bg-violet-50 text-violet-700 text-sm font-bold hover:bg-violet-100 hover:border-violet-400 transition-all active:scale-95 touch-manipulation"
                                >
                                    <span className="text-lg leading-none font-black">+</span>
                                    Añadir Ayudante
                                    <ChevronDown className={`w-4 h-4 transition-transform duration-150 ${dropOpen ? 'rotate-180' : ''}`} />
                                </button>
                            )}

                            {/* Dropdown portal */}
                            {dropOpen && dropRect && createPortal(
                                <>
                                    <div className="fixed inset-0 z-[10000]" onClick={() => setDropOpen(false)} />
                                    <div
                                        className="fixed z-[10001] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
                                        style={{ top: dropRect.top, left: dropRect.left, width: dropRect.width, maxHeight: 280 }}
                                    >
                                        {/* Buscador */}
                                        <div className="p-2 border-b border-slate-100">
                                            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200">
                                                <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                <input
                                                    autoFocus
                                                    type="text"
                                                    value={search}
                                                    onChange={e => setSearch(e.target.value)}
                                                    placeholder="Buscar técnico..."
                                                    className="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none font-medium"
                                                />
                                                {search && (
                                                    <button type="button" onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600">
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Lista */}
                                        <div className="overflow-y-auto flex-1 py-1.5">
                                            {filtrados.length === 0 ? (
                                                <p className="text-center text-sm text-slate-400 font-medium py-4">Sin resultados</p>
                                            ) : filtrados.map(a => (
                                                <button
                                                    key={a.id}
                                                    type="button"
                                                    onClick={() => { addAyudante(a.id); setDropOpen(false); }}
                                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-violet-50 hover:text-violet-800 transition-colors touch-manipulation"
                                                >
                                                    <span className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-black shrink-0">
                                                        {a.full_name.charAt(0).toUpperCase()}
                                                    </span>
                                                    <span className="truncate text-left">{a.full_name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </>,
                                document.body
                            )}
                        </div>
                    )}

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