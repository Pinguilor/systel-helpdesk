'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, History, Building2 } from 'lucide-react';
import { NuevaGuiaForm }   from './NuevaGuiaForm';
import { HistorialGuias }  from './HistorialGuias';
import type { GuiaResumen, Proveedor, KPIsGuias } from '../actions';

type Tab = 'nueva' | 'historial';

interface Props {
    guiasIniciales: GuiaResumen[];
    totalGuias:     number;
    bodegas:        { id: string; nombre: string }[];
    catalogo:       { modelo: string; familia: string; es_serializado: boolean; bodega_id: string }[];
    proveedores:    Proveedor[];
    kpis:           KPIsGuias;
}

export function GuiasClient({ guiasIniciales, totalGuias, bodegas, catalogo, proveedores, kpis }: Props) {
    const [tab, setTab] = useState<Tab>('nueva');

    const tabs: { key: Tab; label: string; icon: typeof Plus }[] = [
        { key: 'nueva',     label: 'Nuevo Ingreso',      icon: Plus },
        { key: 'historial', label: 'Historial de Guías',  icon: History },
    ];

    return (
        <div className="space-y-6">
            {/* Tabs + accesos rápidos */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
                {tabs.map(t => {
                    const Icon = t.icon;
                    const active = tab === t.key;
                    return (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                                active
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <Icon className="w-4 h-4" />
                            {t.label}
                            {t.key === 'historial' && totalGuias > 0 && (
                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                                    active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'
                                }`}>
                                    {totalGuias}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            <Link
                href="/dashboard/admin/inventario/proveedores"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 transition-colors"
            >
                <Building2 className="w-3.5 h-3.5" />
                Proveedores
            </Link>
            </div>

            {/* Content */}
            <div className={tab === 'nueva' ? '' : 'hidden'}>
                <NuevaGuiaForm
                    bodegas={bodegas}
                    catalogo={catalogo}
                    proveedores={proveedores}
                    onSuccess={() => setTab('historial')}
                />
            </div>
            <div className={tab === 'historial' ? '' : 'hidden'}>
                <HistorialGuias
                    guiasIniciales={guiasIniciales}
                    totalGuias={totalGuias}
                    proveedores={proveedores}
                    kpis={kpis}
                />
            </div>
        </div>
    );
}
