'use client';

import { useState, type ReactNode } from 'react';
import { Package, History } from 'lucide-react';

interface Props {
    recetaContent: ReactNode;
    historialContent: ReactNode;
    totalDespachos?: number;
}

export function HardwareLogisticaTabs({ recetaContent, historialContent, totalDespachos = 0 }: Props) {
    const [activeTab, setActiveTab] = useState<'receta' | 'historial'>('receta');

    return (
        <div className="space-y-4">
            {/* Tabs */}
            <div className="flex items-center gap-2 bg-slate-200/50 p-1 rounded-xl w-fit">
                <button
                    type="button"
                    onClick={() => setActiveTab('receta')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                        activeTab === 'receta'
                            ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                    }`}
                >
                    <Package className="w-3.5 h-3.5" />
                    Receta Maestra
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('historial')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                        activeTab === 'historial'
                            ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                    }`}
                >
                    <History className="w-3.5 h-3.5" />
                    Historial de Despachos
                    {totalDespachos > 0 && (
                        <span
                            className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                                activeTab === 'historial'
                                    ? 'bg-emerald-100 text-emerald-600'
                                    : 'bg-slate-300/60 text-slate-600'
                            }`}
                        >
                            {totalDespachos}
                        </span>
                    )}
                </button>
            </div>

            {/* Contenido: ambos paneles se mantienen montados (datos ya cargados en el server)
               y se alternan con `hidden` para que el cambio de pestaña sea instantáneo. */}
            <div className={activeTab === 'receta' ? '' : 'hidden'}>
                {recetaContent}
            </div>
            <div className={activeTab === 'historial' ? '' : 'hidden'}>
                {historialContent}
            </div>
        </div>
    );
}
