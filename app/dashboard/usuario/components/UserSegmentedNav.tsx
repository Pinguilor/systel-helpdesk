'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LoopLoader } from '@/components/LoopLoader';
import { LayoutGrid, ChartPie, ScanLine } from 'lucide-react';
import { motion } from 'framer-motion';

export function UserSegmentedNav() {
    const pathname = usePathname();
    const router = useRouter();
    const [isTransitioning, setIsTransitioning] = useState(false);

    // Desactivar loader al cambiar de página (cuando se completa la transición)
    useEffect(() => {
        setIsTransitioning(false);
    }, [pathname]);

    const handleNavigation = (path: string) => {
        if (pathname === path) return;
        setIsTransitioning(true);
        router.push(path);
    };

    const isPanelControl = pathname === '/dashboard/usuario';
    const isAnaliticas = pathname === '/dashboard/analiticas';
    const isMateriales = pathname === '/dashboard/trazabilidad-materiales';

    return (
        <div className="w-full flex justify-center py-4 px-4 md:px-0">
            {isTransitioning && <LoopLoader fullScreen={true} text="Systel × Loop" />}

            <div className="inline-flex items-center w-full md:w-auto p-1 bg-white/70 backdrop-blur-md border border-slate-200/40 rounded-2xl gap-1 relative shadow-sm shadow-slate-200/50">
                <button
                    onClick={() => handleNavigation('/dashboard/usuario')}
                    disabled={isTransitioning}
                    className={`relative flex-1 md:flex-none flex items-center justify-center gap-2 px-3 md:px-5 py-2 rounded-xl text-sm font-bold transition-colors duration-200 whitespace-nowrap focus:outline-none ${isPanelControl
                        ? 'text-white font-extrabold'
                        : 'text-slate-600 hover:text-slate-900'
                        }`}
                >
                    {isPanelControl && (
                        <motion.span
                            layoutId="active-user-nav-tab"
                            className="absolute inset-0 bg-slate-900 rounded-xl z-0"
                            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                        />
                    )}
                    <span className="relative z-10 flex items-center gap-2">
                        <LayoutGrid className="w-4 h-4" strokeWidth={1.75} />
                        <span className="hidden md:inline">Panel de Control</span>
                    </span>
                </button>

                <button
                    onClick={() => handleNavigation('/dashboard/analiticas')}
                    disabled={isTransitioning}
                    className={`relative flex-1 md:flex-none flex items-center justify-center gap-2 px-3 md:px-5 py-2 rounded-xl text-sm font-bold transition-colors duration-200 whitespace-nowrap focus:outline-none ${isAnaliticas
                        ? 'text-white font-extrabold'
                        : 'text-slate-600 hover:text-slate-900'
                        }`}
                >
                    {isAnaliticas && (
                        <motion.span
                            layoutId="active-user-nav-tab"
                            className="absolute inset-0 bg-slate-900 rounded-xl z-0"
                            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                        />
                    )}
                    <span className="relative z-10 flex items-center gap-2">
                        <ChartPie className="w-4 h-4" strokeWidth={1.75} />
                        <span className="hidden md:inline">Analíticas</span>
                    </span>
                </button>

                <button
                    onClick={() => handleNavigation('/dashboard/trazabilidad-materiales')}
                    disabled={isTransitioning}
                    className={`relative flex-1 md:flex-none flex items-center justify-center gap-2 px-3 md:px-5 py-2 rounded-xl text-sm font-bold transition-colors duration-200 whitespace-nowrap focus:outline-none ${isMateriales
                        ? 'text-white font-extrabold'
                        : 'text-slate-600 hover:text-slate-900'
                        }`}
                >
                    {isMateriales && (
                        <motion.span
                            layoutId="active-user-nav-tab"
                            className="absolute inset-0 bg-slate-900 rounded-xl z-0"
                            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                        />
                    )}
                    <span className="relative z-10 flex items-center gap-2">
                        <ScanLine className="w-4 h-4" strokeWidth={1.75} />
                        <span className="hidden md:inline">Materiales Insumidos</span>
                    </span>
                </button>
            </div>
        </div>
    );
}
