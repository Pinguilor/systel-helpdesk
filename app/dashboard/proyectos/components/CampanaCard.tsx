'use client';

import { FolderOpen, ChevronDown, Building2, UserCheck } from 'lucide-react';

interface Props {
    nombre: string;
    descripcion: string | null;
    coordinador: string | null;
    total: number;
    completados: number;
    expandida: boolean;
    onToggle: () => void;
}

export function CampanaCard({ nombre, descripcion, coordinador, total, completados, expandida, onToggle }: Props) {
    const pct = total > 0 ? Math.round((completados / total) * 100) : 0;

    return (
        <div
            className={`relative overflow-hidden rounded-2xl border bg-slate-900 text-white shadow-md transition-all font-sans ${
                expandida ? 'border-indigo-400/60 ring-2 ring-indigo-500/20' : 'border-slate-800 hover:shadow-lg'
            }`}
        >
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

            <div className="relative p-5 flex flex-col gap-4">
                <div className="flex items-start gap-3">
                    <div className="shrink-0 w-10 h-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center">
                        <FolderOpen className="w-5 h-5 text-indigo-300" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-[9px] font-black text-indigo-300 uppercase tracking-widest">Campaña masiva</p>
                        <h3 className="text-base font-black truncate">{nombre}</h3>
                        {descripcion && <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{descripcion}</p>}
                    </div>
                </div>

                <div>
                    <div className="flex items-end justify-between mb-1.5">
                        <p className="text-sm font-black">
                            {completados} <span className="text-slate-400 font-semibold">de {total} locales completados</span>
                        </p>
                        <p className="text-xs font-black text-indigo-300">{pct}%</p>
                    </div>
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-emerald-400 transition-all"
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-400 min-w-0">
                        <span className="flex items-center gap-1 shrink-0">
                            <Building2 className="w-3.5 h-3.5" /> {total} sucursales
                        </span>
                        {coordinador && (
                            <span className="flex items-center gap-1 truncate">
                                <UserCheck className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{coordinador}</span>
                            </span>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={onToggle}
                        aria-expanded={expandida}
                        className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-slate-900 text-xs font-black hover:bg-indigo-50 transition-colors cursor-pointer"
                    >
                        {expandida ? 'Ocultar sucursales' : 'Ver sucursales'}
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expandida ? 'rotate-180' : ''}`} />
                    </button>
                </div>
            </div>
        </div>
    );
}
