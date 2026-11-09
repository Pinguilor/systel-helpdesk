'use client';

import Link from 'next/link';
import { Layers, ChevronDown, Building2, UserCheck, LayoutDashboard } from 'lucide-react';

interface Props {
    nombre: string;
    descripcion: string | null;
    coordinador: string | null;
    total: number;
    completados: number;
    expandida: boolean;
    onToggle: () => void;
    /** Panel de gestión (admin/coordinador). Sin él, la tarjeta ofrece desplegar las sucursales. */
    hrefPanel?: string;
}

export function CampanaCard({ nombre, descripcion, coordinador, total, completados, expandida, onToggle, hrefPanel }: Props) {
    const pct = total > 0 ? Math.round((completados / total) * 100) : 0;

    return (
        <div
            className={`bg-white rounded-2xl border shadow-sm transition-all duration-300 font-sans ${
                expandida ? 'border-indigo-300 ring-2 ring-indigo-500/10' : 'border-slate-200/80 hover:shadow-md'
            }`}
        >
            <div className="p-5 flex flex-col gap-4">
                <div className="flex items-start gap-3">
                    <div className="shrink-0 w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100/60 flex items-center justify-center">
                        <Layers className="w-5 h-5 text-indigo-600" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Rollout</p>
                        <h3 className="text-base font-black text-slate-900 truncate">{nombre}</h3>
                        {descripcion && <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{descripcion}</p>}
                    </div>
                </div>

                <div>
                    <div className="flex items-end justify-between mb-1.5">
                        <p className="text-sm font-black text-slate-800">
                            {completados} <span className="text-slate-400 font-semibold">de {total} locales completados</span>
                        </p>
                        <p className="text-xs font-black text-indigo-600">{pct}%</p>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                            className="h-full rounded-full bg-indigo-500 transition-all"
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
                    {hrefPanel ? (
                        <Link
                            href={hrefPanel}
                            className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-700 transition-colors shadow-sm cursor-pointer"
                        >
                            <LayoutDashboard className="w-3.5 h-3.5" />
                            Abrir panel
                        </Link>
                    ) : (
                        // Sin acceso al panel (técnicos): ven sus sucursales desplegadas aquí mismo
                        <button
                            type="button"
                            onClick={onToggle}
                            aria-expanded={expandida}
                            className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-700 transition-colors shadow-sm cursor-pointer"
                        >
                            {expandida ? 'Ocultar sucursales' : 'Ver sucursales'}
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expandida ? 'rotate-180' : ''}`} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
