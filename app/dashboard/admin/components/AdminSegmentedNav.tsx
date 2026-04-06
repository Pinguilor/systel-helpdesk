'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LoopLoader } from '@/components/LoopLoader';
import { LayoutGrid, Warehouse, PackageCheck, ScanLine } from 'lucide-react';

export function AdminSegmentedNav({ rol }: { rol: string }) {
    const pathname = usePathname();
    const router = useRouter();
    const [isTransitioning, setIsTransitioning] = useState(false);

    // Turn off loader when pathname changes (meaning transition is complete)
    useEffect(() => {
        setIsTransitioning(false);
    }, [pathname]);

    const handleNavigation = (path: string) => {
        if (pathname === path) return;
        setIsTransitioning(true);
        router.push(path);
    };

    const isVistaGeneral = pathname === '/dashboard/admin';
    const isBodegas = pathname?.startsWith('/dashboard/admin/bodegas') && !pathname?.startsWith('/dashboard/admin/bodegas/solicitudes') && !pathname?.startsWith('/dashboard/admin/bodegas/serializados');
    const isSolicitudes = pathname?.startsWith('/dashboard/admin/bodegas/solicitudes');
    const isSerializados = pathname?.startsWith('/dashboard/trazabilidad-materiales');

    // Default: Bodegas (Inventario) is selected if nothing exactly matches, 
    // but the task states "Maintain the second cell... as selected by default".
    // It's naturally selected when on /bodegas. 

    if (rol !== 'ADMIN' && rol !== 'COORDINADOR' && rol !== 'ADMIN_BODEGA') {
        return null;
    }

    return (
        <div className="w-full flex justify-center py-6 gap-2 md:gap-4 px-4 md:px-0">
            {isTransitioning && <LoopLoader fullScreen={true} text="Systel × Loop" />}

            {(rol === 'ADMIN' || rol === 'COORDINADOR') && (
                <button
                    onClick={() => handleNavigation('/dashboard/admin')}
                    disabled={isTransitioning}
                    className={`flex items-center justify-center flex-1 md:flex-none gap-2 px-3 md:px-5 py-2.5 rounded-xl border text-sm font-bold transition-all duration-200 whitespace-nowrap shadow-sm ${isVistaGeneral
                        ? 'bg-zinc-900 border-zinc-900 text-white'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                >
                    <LayoutGrid className="w-4 h-4" />
                    <span className="hidden md:inline">Vista General</span>
                </button>
            )}

            {(rol === 'ADMIN' || rol === 'ADMIN_BODEGA') && (
                <button
                    onClick={() => handleNavigation('/dashboard/admin/bodegas')}
                    disabled={isTransitioning}
                    className={`flex items-center justify-center flex-1 md:flex-none gap-2 px-3 md:px-5 py-2.5 rounded-xl border text-sm font-bold transition-all duration-200 whitespace-nowrap shadow-sm ${isBodegas
                        ? 'bg-zinc-900 border-zinc-900 text-white'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                >
                    <Warehouse className="w-4 h-4" />
                    <span className="hidden md:inline">Bodegas (Inventario)</span>
                </button>
            )}

            {(rol === 'ADMIN' || rol === 'ADMIN_BODEGA') && (
                <button
                    onClick={() => handleNavigation('/dashboard/admin/bodegas/solicitudes')}
                    disabled={isTransitioning}
                    className={`relative flex items-center justify-center flex-1 md:flex-none gap-2 px-3 md:px-5 py-2.5 rounded-xl border text-sm font-bold transition-all duration-200 whitespace-nowrap shadow-sm ${isSolicitudes
                        ? 'bg-slate-950 border-slate-950 text-white'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                >
                    <PackageCheck className="w-4 h-4" />
                    <span className="hidden md:inline">Solicitudes</span>
                </button>
            )}

            {(rol === 'ADMIN' || rol === 'ADMIN_BODEGA') && (
                <button
                    onClick={() => handleNavigation('/dashboard/trazabilidad-materiales')}
                    disabled={isTransitioning}
                    className={`flex items-center justify-center flex-1 md:flex-none gap-2 px-3 md:px-5 py-2.5 rounded-xl border text-sm font-bold transition-all duration-200 whitespace-nowrap shadow-sm ${isSerializados
                        ? 'bg-slate-950 border-slate-950 text-white'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                >
                    <ScanLine className="w-4 h-4" />
                    <span className="hidden md:inline">Trazabilidad</span>
                </button>
            )}
        </div>
    );
}
