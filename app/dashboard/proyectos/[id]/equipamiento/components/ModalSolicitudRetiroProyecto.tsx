'use client';

import React, { useState } from 'react';
import { X, ShoppingCart, Minus, Plus, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { crearSolicitudProyectoAction, SolicitudProyectoItem } from '../actions';
import { useRouter } from 'next/navigation';

export interface RecetaItem {
    id: string;
    inventario_id: string;
    cantidad_total: number;
    cantidad_entregada: number;
    inventario?: {
        modelo: string;
        familia: string;
    } | null;
}

interface ModalSolicitudRetiroProyectoProps {
    proyectoId: string;
    isOpen: boolean;
    onClose: () => void;
    receta: RecetaItem[];
}

export function ModalSolicitudRetiroProyecto({ proyectoId, isOpen, onClose, receta }: ModalSolicitudRetiroProyectoProps) {
    // Estado del carrito: Map<proyecto_equipamiento_id, cantidad_a_solicitar>
    const [carrito, setCarrito] = useState<Record<string, number>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const router = useRouter();

    if (!isOpen) return null;

    const handleIncrement = (item: RecetaItem) => {
        const saldo = item.cantidad_total - item.cantidad_entregada;
        const current = carrito[item.id] || 0;
        if (current < saldo) {
            setCarrito(prev => ({ ...prev, [item.id]: current + 1 }));
        }
    };

    const handleDecrement = (itemId: string) => {
        const current = carrito[itemId] || 0;
        if (current > 0) {
            setCarrito(prev => {
                const next = { ...prev };
                next[itemId] = current - 1;
                if (next[itemId] === 0) delete next[itemId];
                return next;
            });
        }
    };

    const handleSubmit = async () => {
        setError(null);
        
        // Formatear payload
        const payload: SolicitudProyectoItem[] = Object.entries(carrito).map(([equipamientoId, cantidad]) => {
            const recetaItem = receta.find(r => r.id === equipamientoId);
            return {
                proyectoEquipamientoId: equipamientoId,
                inventarioId: recetaItem!.inventario_id,
                cantidad
            };
        });

        if (payload.length === 0) {
            setError('Debes agregar al menos un equipo al carrito para solicitar.');
            return;
        }

        setIsSubmitting(true);

        const res = await crearSolicitudProyectoAction(proyectoId, payload);
        
        setIsSubmitting(false);

        if (res.error) {
            setError(res.error);
        } else {
            setSuccess(true);
            setTimeout(() => {
                onClose();
                setSuccess(false);
                setCarrito({});
                router.refresh();
            }, 2000);
        }
    };

    const totalItemsCarrito = Object.values(carrito).reduce((a, b) => a + b, 0);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                            <ShoppingCart className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-900">Retiro de Equipamiento</h2>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mt-0.5">Receta Maestra del Proyecto</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        disabled={isSubmitting || success}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 flex-1 overflow-y-auto custom-scrollbar bg-slate-50/50">
                    {success ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center animate-in fade-in zoom-in">
                            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
                                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                            </div>
                            <h3 className="text-2xl font-black text-slate-900 mb-2">¡Solicitud Generada!</h3>
                            <p className="text-slate-500 max-w-sm">
                                Tu solicitud de retiro ha sido enviada a bodega exitosamente.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {error && (
                                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                    <p className="text-sm font-semibold text-red-700">{error}</p>
                                </div>
                            )}

                            {receta.length === 0 ? (
                                <div className="text-center py-12">
                                    <p className="text-slate-500 font-medium">Este proyecto aún no tiene equipamiento definido en su Receta Maestra.</p>
                                </div>
                            ) : (
                                <div className="grid gap-4">
                                    {receta.map((item) => {
                                        const saldo = item.cantidad_total - item.cantidad_entregada;
                                        const current = carrito[item.id] || 0;
                                        const agotado = saldo === 0;

                                        return (
                                            <div 
                                                key={item.id} 
                                                className={`p-4 rounded-2xl border transition-colors ${
                                                    agotado ? 'bg-slate-100 border-slate-200 opacity-60' : 'bg-white border-slate-200 shadow-sm hover:border-indigo-200'
                                                } flex flex-col sm:flex-row sm:items-center justify-between gap-4`}
                                            >
                                                {/* Info del Item */}
                                                <div className="flex-1">
                                                    <h4 className="font-bold text-slate-900">
                                                        {item.inventario?.modelo || 'Modelo Desconocido'}
                                                    </h4>
                                                    <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mt-1">
                                                        Familia: {item.inventario?.familia || 'N/A'}
                                                    </p>
                                                    <div className="flex items-center gap-3 mt-3">
                                                        <span className="text-xs font-bold px-2 py-1 bg-slate-100 text-slate-600 rounded-md">
                                                            Total: {item.cantidad_total}
                                                        </span>
                                                        <span className="text-xs font-bold px-2 py-1 bg-emerald-50 text-emerald-600 rounded-md">
                                                            Entregado: {item.cantidad_entregada}
                                                        </span>
                                                        <span className={`text-xs font-bold px-2 py-1 rounded-md ${agotado ? 'bg-rose-50 text-rose-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                                            Saldo: {saldo}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Controles de Cantidad */}
                                                <div className="flex items-center justify-between sm:justify-end gap-4 min-w-[140px]">
                                                    {agotado ? (
                                                        <span className="text-xs font-black text-rose-500 uppercase tracking-widest px-3 py-1.5 bg-rose-50 rounded-lg">
                                                            Completado
                                                        </span>
                                                    ) : (
                                                        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1">
                                                            <button
                                                                onClick={() => handleDecrement(item.id)}
                                                                disabled={current === 0}
                                                                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-white hover:text-slate-900 hover:shadow-sm disabled:opacity-50 disabled:hover:bg-transparent transition-all"
                                                            >
                                                                <Minus className="w-4 h-4" />
                                                            </button>
                                                            <span className="w-10 text-center font-black text-slate-900">
                                                                {current}
                                                            </span>
                                                            <button
                                                                onClick={() => handleIncrement(item)}
                                                                disabled={current >= saldo}
                                                                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-white hover:text-slate-900 hover:shadow-sm disabled:opacity-50 disabled:hover:bg-transparent transition-all"
                                                            >
                                                                <Plus className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {!success && (
                    <div className="p-5 border-t border-slate-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-sm font-semibold text-slate-500">
                            Equipos en el carrito: <span className="font-black text-indigo-600 text-lg ml-1">{totalItemsCarrito}</span>
                        </div>
                        <div className="flex gap-3 w-full sm:w-auto">
                            <button
                                onClick={onClose}
                                disabled={isSubmitting}
                                className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting || totalItemsCarrito === 0}
                                className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/30"
                            >
                                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
                                Solicitar a Bodega
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
