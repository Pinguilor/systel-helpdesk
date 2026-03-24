'use client';

import { useState } from 'react';
import { Ticket } from '@/types/database.types';
import { LayoutDashboard, CheckCircle2, Clock, X, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface Props {
    tickets: Ticket[];
}

export function DashboardKPIs({ tickets }: Props) {
    const [activeModal, setActiveModal] = useState<'total' | 'activos' | 'resueltos' | null>(null);

    const totalTickets = tickets;
    const resolvedTickets = tickets.filter(t => t.estado === 'resuelto' || t.estado === 'cerrado');
    const openTickets = tickets.filter(t => t.estado !== 'resuelto' && t.estado !== 'cerrado');

    const getModalData = () => {
        if (activeModal === 'total') return { title: 'Total Solicitudes', data: totalTickets };
        if (activeModal === 'activos') return { title: 'Tickets Activos', data: openTickets };
        if (activeModal === 'resueltos') return { title: 'Tickets Resueltos', data: resolvedTickets };
        return { title: '', data: [] };
    };

    const modalData = getModalData();

    return (
        <>
            <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-2">

                {/* TARJETA 1: TOTAL */}
                <button
                    onClick={() => setActiveModal('total')}
                    className="group relative bg-white overflow-hidden rounded-xl sm:rounded-2xl shadow-sm hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] border border-slate-200 hover:border-indigo-300 hover:ring-2 hover:ring-indigo-100 p-3 sm:p-4 flex flex-col justify-center transition-all duration-300 active:scale-[0.98] outline-none text-left"
                >
                    <div className="absolute -top-3 -right-3 sm:top-0 sm:right-0 p-3 opacity-0 group-hover:opacity-[0.03] transition-all duration-500 scale-75 group-hover:scale-150 transform origin-top-right pointer-events-none">
                        <LayoutDashboard className="w-16 h-16 sm:w-20 sm:h-20 text-indigo-900" />
                    </div>
                    
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2.5 relative z-10 w-full">
                        <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-md sm:rounded-lg bg-slate-50 text-slate-500 flex items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300 border border-slate-200 group-hover:border-indigo-500">
                            <LayoutDashboard className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        </div>
                        <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-indigo-500 transition-colors truncate">Totales</span>
                    </div>
                    
                    <div className="relative z-10 w-full">
                        <span className="text-xl sm:text-3xl font-black text-slate-800 group-hover:text-indigo-600 transition-colors tracking-tight block leading-none">{totalTickets.length}</span>
                    </div>
                </button>

                {/* TARJETA 2: ACTIVOS */}
                <button
                    onClick={() => setActiveModal('activos')}
                    className="group relative bg-white overflow-hidden rounded-xl sm:rounded-2xl shadow-sm hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] border border-slate-200 hover:border-amber-300 hover:ring-2 hover:ring-amber-100 p-3 sm:p-4 flex flex-col justify-center transition-all duration-300 active:scale-[0.98] outline-none text-left"
                >
                    <div className="absolute -top-3 -right-3 sm:top-0 sm:right-0 p-3 opacity-0 group-hover:opacity-[0.03] transition-all duration-500 scale-75 group-hover:scale-150 transform origin-top-right pointer-events-none">
                        <Clock className="w-16 h-16 sm:w-20 sm:h-20 text-amber-900" />
                    </div>
                    
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2.5 relative z-10 w-full">
                        <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-md sm:rounded-lg bg-slate-50 text-slate-500 flex items-center justify-center shrink-0 group-hover:bg-amber-500 group-hover:text-white transition-colors duration-300 border border-slate-200 group-hover:border-amber-400">
                            <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        </div>
                        <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-amber-500 transition-colors truncate">Activos</span>
                    </div>
                    
                    <div className="relative z-10 w-full">
                        <span className="text-xl sm:text-3xl font-black text-slate-800 group-hover:text-amber-500 transition-colors tracking-tight block leading-none">{openTickets.length}</span>
                    </div>
                </button>

                {/* TARJETA 3: RESUELTOS */}
                <button
                    onClick={() => setActiveModal('resueltos')}
                    className="group relative bg-white overflow-hidden rounded-xl sm:rounded-2xl shadow-sm hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] border border-slate-200 hover:border-emerald-300 hover:ring-2 hover:ring-emerald-100 p-3 sm:p-4 flex flex-col justify-center transition-all duration-300 active:scale-[0.98] outline-none text-left"
                >
                    <div className="absolute -top-3 -right-3 sm:top-0 sm:right-0 p-3 opacity-0 group-hover:opacity-[0.03] transition-all duration-500 scale-75 group-hover:scale-150 transform origin-top-right pointer-events-none">
                        <CheckCircle2 className="w-16 h-16 sm:w-20 sm:h-20 text-emerald-900" />
                    </div>
                    
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2.5 relative z-10 w-full">
                        <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-md sm:rounded-lg bg-slate-50 text-slate-500 flex items-center justify-center shrink-0 group-hover:bg-emerald-500 group-hover:text-white transition-colors duration-300 border border-slate-200 group-hover:border-emerald-400">
                            <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        </div>
                        <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-emerald-500 transition-colors truncate">Resueltos</span>
                    </div>
                    
                    <div className="relative z-10 w-full">
                        <span className="text-xl sm:text-3xl font-black text-slate-800 group-hover:text-emerald-500 transition-colors tracking-tight block leading-none">{resolvedTickets.length}</span>
                    </div>
                </button>
            </div>

            {/* KPI Data Modal (Se mantiene idéntico, solo ajustado para móviles) */}
            {activeModal && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-4xl h-[85vh] sm:max-h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-50 shrink-0 rounded-t-3xl sm:rounded-t-none">
                            <h3 className="text-lg sm:text-xl font-extrabold text-slate-800 flex items-center gap-2">
                                {activeModal === 'total' && <LayoutDashboard className="w-5 h-5 text-indigo-500" />}
                                {activeModal === 'activos' && <Clock className="w-5 h-5 text-amber-500" />}
                                {activeModal === 'resueltos' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                                {modalData.title}
                                <span className="ml-2 bg-white px-2.5 py-0.5 rounded-full text-xs sm:text-sm font-bold border border-slate-200">
                                    {modalData.data.length}
                                </span>
                            </h3>
                            <button
                                onClick={() => setActiveModal(null)}
                                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                                aria-label="Cerrar modal"
                                title="Cerrar"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-white custom-scrollbar">
                            {modalData.data.length === 0 ? (
                                <div className="text-center py-12 text-slate-500">
                                    No hay tickets para mostrar en esta categoría.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                                    {modalData.data.map(ticket => (
                                        <Link
                                            key={ticket.id}
                                            href={`/dashboard/ticket/${ticket.id}`}
                                            className="group block border border-gray-200 rounded-xl p-4 hover:border-indigo-300 hover:shadow-md transition-all bg-white"
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-100">
                                                    #{ticket.numero_ticket}
                                                </span>
                                            </div>
                                            <h4 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1 mb-1">
                                                {ticket.titulo}
                                            </h4>
                                            <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-50">
                                                <span className="text-[11px] sm:text-xs text-slate-500 font-medium">
                                                    {new Date(ticket.fecha_creacion).toLocaleDateString()}
                                                </span>
                                                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}