'use client';

import React from 'react';
import Link from 'next/link';
import { Briefcase, ArrowRight, FolderKanban, Sparkles } from 'lucide-react';

interface Proyecto {
    id: string;
    nombre: string;
    estado: string;
    clientes: { sigla: string } | null;
}

interface ProyectosAsignadosProps {
    proyectos: Proyecto[];
}

export function ProyectosAsignados({ proyectos }: ProyectosAsignadosProps) {
    if (!proyectos || proyectos.length === 0) {
        return null;
    }

    const estadoConfig: Record<string, { bg: string, text: string, border: string, glow: string, label: string }> = {
        'planificacion': { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200/60', glow: 'group-hover:shadow-slate-200/50', label: 'Planificación' },
        'en_progreso': { bg: 'bg-indigo-50/50', text: 'text-indigo-600', border: 'border-indigo-100', glow: 'group-hover:shadow-indigo-500/20', label: 'En Progreso' },
        'completado': { bg: 'bg-emerald-50/50', text: 'text-emerald-600', border: 'border-emerald-100', glow: 'group-hover:shadow-emerald-500/20', label: 'Completado' },
        'cancelado': { bg: 'bg-rose-50/50', text: 'text-rose-600', border: 'border-rose-100', glow: 'group-hover:shadow-rose-500/20', label: 'Cancelado' },
        'pausado': { bg: 'bg-amber-50/50', text: 'text-amber-600', border: 'border-amber-100', glow: 'group-hover:shadow-amber-500/20', label: 'Pausado' },
    };

    return (
        <div className="px-4 sm:px-0 space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Cabecera Premium */}
            <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
                    <Briefcase className="w-5 h-5 text-white" strokeWidth={2} />
                </div>
                <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                        Mis Proyectos Asignados
                        <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                    </h2>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mt-0.5">
                        Tienes {proyectos.length} {proyectos.length === 1 ? 'proyecto activo' : 'proyectos activos'}
                    </p>
                </div>
            </div>
            
            {/* Grid de Tarjetas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {proyectos.map((proyecto) => {
                    const cfg = estadoConfig[proyecto.estado] || estadoConfig['planificacion'];

                    return (
                        <div 
                            key={proyecto.id} 
                            className={`group relative bg-white rounded-3xl border border-slate-200/70 p-5 flex flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl ${cfg.glow}`}
                        >
                            {/* Accent Gradient Glow Background (very subtle) */}
                            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full opacity-20 blur-3xl transition-all duration-500 group-hover:opacity-40 group-hover:scale-150" 
                                 style={{ backgroundColor: proyecto.estado === 'en_progreso' ? '#6366f1' : proyecto.estado === 'completado' ? '#10b981' : '#94a3b8' }} 
                            />

                            {/* Top Section: Badges */}
                            <div className="relative z-10 flex justify-between items-start mb-4">
                                {proyecto.clientes?.sigla ? (
                                    <div className="flex items-center gap-1.5 bg-slate-900 px-2.5 py-1 rounded-lg shadow-sm">
                                        <FolderKanban className="w-3.5 h-3.5 text-slate-300" />
                                        <span className="text-[10px] font-black text-white tracking-widest uppercase">
                                            {proyecto.clientes.sigla}
                                        </span>
                                    </div>
                                ) : (
                                    <div />
                                )}
                                <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black tracking-widest uppercase border backdrop-blur-sm shadow-sm ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                                    {cfg.label}
                                </span>
                            </div>

                            {/* Center Section: Title */}
                            <div className="relative z-10 flex-1 mb-6">
                                <h3 className="text-lg font-black text-slate-800 leading-tight group-hover:text-slate-950 transition-colors line-clamp-2">
                                    {proyecto.nombre}
                                </h3>
                            </div>

                            {/* Bottom Section: Action Button */}
                            <div className="relative z-10 mt-auto">
                                <Link 
                                    href={`/dashboard/proyectos/${proyecto.id}`}
                                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-900 border border-slate-100 hover:border-slate-800 rounded-2xl transition-all duration-300 group/btn"
                                >
                                    <span className="text-xs font-black text-slate-600 group-hover/btn:text-white transition-colors">
                                        Ingresar al Espacio
                                    </span>
                                    <div className="w-7 h-7 rounded-full bg-white group-hover/btn:bg-slate-800 flex items-center justify-center shadow-sm border border-slate-200/50 group-hover/btn:border-slate-700 transition-colors">
                                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover/btn:text-white group-hover/btn:translate-x-0.5 transition-all duration-300" />
                                    </div>
                                </Link>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
