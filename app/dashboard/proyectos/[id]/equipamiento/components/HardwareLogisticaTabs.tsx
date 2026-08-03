'use client';

import { useState, type ReactNode } from 'react';
import { Package, History, AlertTriangle } from 'lucide-react';

type Tab = 'receta' | 'historial' | 'incidencias';

interface Props {
    recetaContent:      ReactNode;
    historialContent:   ReactNode;
    incidenciasContent: ReactNode;
    totalDespachos?:    number;
    totalIncidencias?:  number;
}

export function HardwareLogisticaTabs({
    recetaContent,
    historialContent,
    incidenciasContent,
    totalDespachos  = 0,
    totalIncidencias = 0,
}: Props) {
    const [activeTab, setActiveTab] = useState<Tab>('receta');

    function tabCls(tab: Tab) {
        const base = 'px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap';
        return activeTab === tab
            ? `${base} bg-white text-slate-900 shadow-sm border border-slate-200/60`
            : `${base} text-slate-500 hover:text-slate-700 hover:bg-slate-200/50`;
    }

    function Badge({ count, tab }: { count: number; tab: Tab }) {
        if (count === 0) return null;
        const active = activeTab === tab;
        const colorMap: Record<Tab, string> = {
            receta:      active ? 'bg-slate-200 text-slate-700'   : 'bg-slate-300/60 text-slate-600',
            historial:   active ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-300/60 text-slate-600',
            incidencias: active ? 'bg-amber-100 text-amber-600'   : 'bg-slate-300/60 text-slate-600',
        };
        return (
            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${colorMap[tab]}`}>
                {count}
            </span>
        );
    }

    return (
        <div className="space-y-4">
            {/* Pestañas */}
            <div className="flex items-center gap-1 bg-slate-200/50 p-1 rounded-xl w-fit flex-wrap">
                <button type="button" onClick={() => setActiveTab('receta')} className={tabCls('receta')}>
                    <Package className="w-3.5 h-3.5" />
                    Receta Maestra
                </button>

                <button type="button" onClick={() => setActiveTab('historial')} className={tabCls('historial')}>
                    <History className="w-3.5 h-3.5" />
                    Historial de Despachos
                    <Badge count={totalDespachos} tab="historial" />
                </button>

                <button type="button" onClick={() => setActiveTab('incidencias')} className={tabCls('incidencias')}>
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Incidencias
                    <Badge count={totalIncidencias} tab="incidencias" />
                </button>
            </div>

            {/* Contenido — todos montados, toggle con hidden para cambio instantáneo */}
            <div className={activeTab === 'receta'      ? '' : 'hidden'}>{recetaContent}</div>
            <div className={activeTab === 'historial'   ? '' : 'hidden'}>{historialContent}</div>
            <div className={activeTab === 'incidencias' ? '' : 'hidden'}>{incidenciasContent}</div>
        </div>
    );
}
