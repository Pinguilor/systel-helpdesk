'use client';

import { useState, type ReactNode } from 'react';
import { BookOpen, Network } from 'lucide-react';

// Pestañas de nivel superior del proyecto. Ambos paneles quedan siempre montados
// y se togglean con `hidden` (sin refetch, cambio instantáneo) — mismo patrón que
// HardwareLogisticaTabs.
export function ProyectoTabs({
    bitacoraContent,
    rackContent,
    rackCount = 0,
}: {
    bitacoraContent: ReactNode;
    rackContent: ReactNode;
    rackCount?: number;
}) {
    const [tab, setTab] = useState<'bitacora' | 'rack'>('bitacora');

    const btn = (
        active: boolean,
        onClick: () => void,
        Icon: typeof BookOpen,
        label: string,
        badge?: number,
    ) => (
        <button
            type="button"
            onClick={onClick}
            className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors whitespace-nowrap ${
                active ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
        >
            <Icon className="w-4 h-4" strokeWidth={1.75} />
            <span>{label}</span>
            {badge ? (
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'}`}>
                    {badge}
                </span>
            ) : null}
        </button>
    );

    return (
        <div>
            <div className="inline-flex items-center p-1 bg-white/70 backdrop-blur-md border border-slate-200/40 rounded-2xl gap-1 shadow-sm mb-6">
                {btn(tab === 'bitacora', () => setTab('bitacora'), BookOpen, 'Bitácora')}
                {btn(tab === 'rack', () => setTab('rack'), Network, 'Mapa de Rack', rackCount || undefined)}
            </div>

            <div className={tab === 'bitacora' ? '' : 'hidden'}>{bitacoraContent}</div>
            <div className={tab === 'rack' ? '' : 'hidden'}>{rackContent}</div>
        </div>
    );
}
