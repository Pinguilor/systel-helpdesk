'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PackagePlus, ChevronDown, Package, Scan, FileSpreadsheet } from 'lucide-react';
import { AddStockModal, type AddStockModalHandle, type CatalogoItem } from './AddStockModal';

interface Props {
    bodegas:  { id: string; nombre: string; tipo: string; activo?: boolean }[];
    catalogo: CatalogoItem[];
    familias: { id: string; nombre: string; bodega_id: string }[];
}

export function IngresoDropdown({ bodegas, catalogo, familias }: Props) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const modalRef     = useRef<AddStockModalHandle>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handler(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div ref={containerRef} className="relative inline-block">
            {/* AddStockModal hidden — opened programmatically via ref */}
            <AddStockModal
                ref={modalRef}
                bodegas={bodegas}
                catalogo={catalogo}
                familias={familias}
                hideTriggerButton
            />

            {/* Split button */}
            <button
                onClick={() => setOpen(v => !v)}
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-5 rounded-xl transition-all shadow-sm"
            >
                <PackagePlus className="w-5 h-5" />
                Ingreso de Stock
                <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                    strokeWidth={2.5}
                />
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 overflow-hidden">
                    <p className="px-4 pt-3 pb-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Método de ingreso
                    </p>
                    <div className="p-1.5 space-y-0.5">

                        {/* Manual */}
                        <button
                            onClick={() => { setOpen(false); modalRef.current?.open(); }}
                            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-50 transition-colors text-left"
                        >
                            <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                                <Package className="w-4 h-4 text-indigo-600" strokeWidth={1.75} />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-800">Ingreso Manual</p>
                                <p className="text-xs text-slate-400">Un equipo a la vez</p>
                            </div>
                        </button>

                        {/* Ráfaga */}
                        <button
                            onClick={() => {
                                setOpen(false);
                                router.push('/dashboard/admin/inventario/ingreso');
                            }}
                            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-50 transition-colors text-left"
                        >
                            <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                                <Scan className="w-4 h-4 text-emerald-600" strokeWidth={1.75} />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-800">Modo Ráfaga</p>
                                <p className="text-xs text-slate-400">Escáner de código de barras</p>
                            </div>
                        </button>

                        {/* Excel */}
                        <button
                            onClick={() => {
                                setOpen(false);
                                router.push('/dashboard/admin/inventario/ingreso?mode=excel');
                            }}
                            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-50 transition-colors text-left"
                        >
                            <div className="w-9 h-9 rounded-xl bg-teal-100 flex items-center justify-center shrink-0">
                                <FileSpreadsheet className="w-4 h-4 text-teal-600" strokeWidth={1.75} />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-800">Importar Excel</p>
                                <p className="text-xs text-slate-400">Carga masiva desde archivo</p>
                            </div>
                        </button>

                    </div>
                </div>
            )}
        </div>
    );
}
