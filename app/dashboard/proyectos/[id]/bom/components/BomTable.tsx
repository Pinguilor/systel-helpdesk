'use client';

import React, { useState } from 'react';
import { Package, ShoppingCart } from 'lucide-react';
import { ModalSolicitudRetiroProyecto, type RecetaItem } from '../../equipamiento/components/ModalSolicitudRetiroProyecto';

interface Props {
    items: RecetaItem[];
    proyectoId: string;
}

export function BomTable({ items, proyectoId }: Props) {
    const [isModalOpen, setIsModalOpen] = useState(false);

    // En caso de que la receta venga vacía o nula
    if (!items || items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                <Package className="w-8 h-8 text-slate-300 mb-3" strokeWidth={1.5} />
                <p className="text-slate-500 font-bold text-sm">Receta Maestra Vacía</p>
                <p className="text-slate-400 text-xs mt-1">Aún no se ha definido el equipamiento para este proyecto.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-in fade-in duration-500">
            {/* Cabecera de la tabla con el botón principal */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-4 border border-slate-200 rounded-2xl shadow-sm gap-4">
                <div>
                    <h3 className="text-base font-black text-slate-900">Receta Maestra del Proyecto</h3>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mt-0.5">
                        Listado de equipos y control de retiros
                    </p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-500/30 transition-all duration-300 active:scale-[0.98]"
                >
                    <ShoppingCart className="w-4 h-4" />
                    Solicitar Retiro a Bodega
                </button>
            </div>

            {/* Tabla limpia */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="text-left px-5 py-3.5 text-xs font-black text-slate-500 uppercase tracking-wider">Modelo / Familia</th>
                                <th className="text-center px-5 py-3.5 text-xs font-black text-slate-500 uppercase tracking-wider">Cant. Total</th>
                                <th className="text-center px-5 py-3.5 text-xs font-black text-slate-500 uppercase tracking-wider">Entregados</th>
                                <th className="text-center px-5 py-3.5 text-xs font-black text-slate-500 uppercase tracking-wider">Saldo</th>
                                <th className="text-left px-5 py-3.5 text-xs font-black text-slate-500 uppercase tracking-wider">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {items.map((item) => {
                                const saldo = item.cantidad_total - item.cantidad_entregada;
                                const isCompletado = saldo <= 0;

                                return (
                                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                                        <td className="px-5 py-4">
                                            <p className="font-bold text-slate-900">{item.inventario?.modelo || 'Modelo no especificado'}</p>
                                            <p className="text-xs text-slate-500 mt-0.5">{item.inventario?.familia || 'Sin familia'}</p>
                                        </td>
                                        <td className="px-5 py-4 text-center">
                                            <span className="font-semibold text-slate-600">{item.cantidad_total}</span>
                                        </td>
                                        <td className="px-5 py-4 text-center">
                                            <span className="font-bold text-emerald-600">{item.cantidad_entregada}</span>
                                        </td>
                                        <td className="px-5 py-4 text-center">
                                            <span className={`font-black text-lg ${saldo > 0 ? 'text-indigo-600' : 'text-slate-300'}`}>
                                                {saldo}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4">
                                            {isCompletado ? (
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] uppercase tracking-wider font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                    Completado
                                                </span>
                                            ) : item.cantidad_entregada > 0 ? (
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] uppercase tracking-wider font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                                    En Proceso
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] uppercase tracking-wider font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                                    Pendiente
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Carrito */}
            <ModalSolicitudRetiroProyecto
                proyectoId={proyectoId}
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                receta={items}
            />
        </div>
    );
}
