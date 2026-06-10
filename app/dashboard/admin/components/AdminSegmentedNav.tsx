'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LoopLoader } from '@/components/LoopLoader';
import { LayoutGrid, Warehouse, PackageCheck, ScanLine, FolderKanban } from 'lucide-react';
import { motion } from 'framer-motion';

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
    const isProyectos = pathname?.startsWith('/dashboard/proyectos');

    if (rol !== 'ADMIN' && rol !== 'COORDINADOR' && rol !== 'ADMIN_BODEGA') {
        return null;
    }

    return (
        <div className="w-full flex justify-center py-4 px-4 md:px-0">
            {isTransitioning && <LoopLoader fullScreen={true} text="Systel × Loop" />}

            <div className="inline-flex items-center w-full md:w-auto p-1 bg-white/70 backdrop-blur-md border border-slate-200/40 rounded-2xl gap-1 relative shadow-sm shadow-slate-200/50">
                {(rol === 'ADMIN' || rol === 'COORDINADOR') && (
                    <button
                        onClick={() => handleNavigation('/dashboard/admin')}
                        disabled={isTransitioning}
                        className={`relative flex-1 md:flex-none flex items-center justify-center gap-2 px-3 md:px-5 py-2 rounded-xl text-sm font-bold transition-colors duration-200 whitespace-nowrap focus:outline-none ${isVistaGeneral
                            ? 'text-white font-extrabold'
                            : 'text-slate-600 hover:text-slate-900'
                            }`}
                    >
                        {isVistaGeneral && (
                            <motion.span
                                layoutId="active-admin-nav-tab"
                                className="absolute inset-0 bg-slate-900 rounded-xl z-0"
                                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                            />
                        )}
                        <span className="relative z-10 flex items-center gap-2">
                            <LayoutGrid className="w-4 h-4" strokeWidth={1.75} />
                            <span className="hidden md:inline">Vista General</span>
                        </span>
                    </button>
                )}

                {(rol === 'ADMIN' || rol === 'ADMIN_BODEGA') && (
                    <button
                        onClick={() => handleNavigation('/dashboard/admin/bodegas')}
                        disabled={isTransitioning}
                        className={`relative flex-1 md:flex-none flex items-center justify-center gap-2 px-3 md:px-5 py-2 rounded-xl text-sm font-bold transition-colors duration-200 whitespace-nowrap focus:outline-none ${isBodegas
                            ? 'text-white font-extrabold'
                            : 'text-slate-600 hover:text-slate-900'
                            }`}
                    >
                        {isBodegas && (
                            <motion.span
                                layoutId="active-admin-nav-tab"
                                className="absolute inset-0 bg-slate-900 rounded-xl z-0"
                                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                            />
                        )}
                        <span className="relative z-10 flex items-center gap-2">
                            <Warehouse className="w-4 h-4" strokeWidth={1.75} />
                            <span className="hidden md:inline">Bodegas (Inventario)</span>
                        </span>
                    </button>
                )}

                {(rol === 'ADMIN' || rol === 'ADMIN_BODEGA') && (
                    <button
                        onClick={() => handleNavigation('/dashboard/admin/bodegas/solicitudes')}
                        disabled={isTransitioning}
                        className={`relative flex-1 md:flex-none flex items-center justify-center gap-2 px-3 md:px-5 py-2 rounded-xl text-sm font-bold transition-colors duration-200 whitespace-nowrap focus:outline-none ${isSolicitudes
                            ? 'text-white font-extrabold'
                            : 'text-slate-600 hover:text-slate-900'
                            }`}
                    >
                        {isSolicitudes && (
                            <motion.span
                                layoutId="active-admin-nav-tab"
                                className="absolute inset-0 bg-slate-900 rounded-xl z-0"
                                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                            />
                        )}
                        <span className="relative z-10 flex items-center gap-2">
                            <PackageCheck className="w-4 h-4" strokeWidth={1.75} />
                            <span className="hidden md:inline">Solicitudes</span>
                        </span>
                    </button>
                )}

                {(rol === 'ADMIN' || rol === 'COORDINADOR') && (
                    <button
                        onClick={() => handleNavigation('/dashboard/proyectos')}
                        disabled={isTransitioning}
                        className={`relative flex-1 md:flex-none flex items-center justify-center gap-2 px-3 md:px-5 py-2 rounded-xl text-sm font-bold transition-colors duration-200 whitespace-nowrap focus:outline-none ${isProyectos
                            ? 'text-white font-extrabold'
                            : 'text-slate-600 hover:text-slate-900'
                            }`}
                    >
                        {isProyectos && (
                            <motion.span
                                layoutId="active-admin-nav-tab"
                                className="absolute inset-0 bg-slate-900 rounded-xl z-0"
                                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                            />
                        )}
                        <span className="relative z-10 flex items-center gap-2">
                            <FolderKanban className="w-4 h-4" strokeWidth={1.75} />
                            <span className="hidden md:inline">Proyectos</span>
                        </span>
                    </button>
                )}

                {(rol === 'ADMIN' || rol === 'ADMIN_BODEGA') && (
                    <button
                        onClick={() => handleNavigation('/dashboard/trazabilidad-materiales')}
                        disabled={isTransitioning}
                        className={`relative flex-1 md:flex-none flex items-center justify-center gap-2 px-3 md:px-5 py-2 rounded-xl text-sm font-bold transition-colors duration-200 whitespace-nowrap focus:outline-none ${isSerializados
                            ? 'text-white font-extrabold'
                            : 'text-slate-600 hover:text-slate-900'
                            }`}
                    >
                        {isSerializados && (
                            <motion.span
                                layoutId="active-admin-nav-tab"
                                className="absolute inset-0 bg-slate-900 rounded-xl z-0"
                                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                            />
                        )}
                        <span className="relative z-10 flex items-center gap-2">
                            <ScanLine className="w-4 h-4" strokeWidth={1.75} />
                            <span className="hidden md:inline">Trazabilidad</span>
                        </span>
                    </button>
                )}
            </div>
        </div>
    );
}

