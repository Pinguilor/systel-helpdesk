'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LoopLoader } from '@/components/LoopLoader';
import { LayoutGrid, FolderKanban } from 'lucide-react';
import { motion } from 'framer-motion';

export function TecnicoSegmentedNav() {
    const pathname = usePathname();
    const router = useRouter();
    const [isTransitioning, setIsTransitioning] = useState(false);

    useEffect(() => {
        setIsTransitioning(false);
    }, [pathname]);

    const handleNavigation = (path: string) => {
        if (pathname === path) return;
        setIsTransitioning(true);
        router.push(path);
    };

    const isVistaGeneral = pathname === '/dashboard/tecnico';
    const isProyectos = pathname?.startsWith('/dashboard/proyectos');

    return (
        <div className="w-full flex justify-center py-4 px-4 md:px-0">
            {isTransitioning && <LoopLoader fullScreen={true} text="Systel × Loop" />}

            <div className="inline-flex items-center w-full md:w-auto p-1 bg-white/70 backdrop-blur-md border border-slate-200/40 rounded-2xl gap-1 relative shadow-sm shadow-slate-200/50">
                <button
                    onClick={() => handleNavigation('/dashboard/tecnico')}
                    disabled={isTransitioning}
                    className={`relative flex-1 md:flex-none flex items-center justify-center gap-2 px-3 md:px-5 py-2 rounded-xl text-sm font-bold transition-colors duration-200 whitespace-nowrap focus:outline-none ${isVistaGeneral
                        ? 'text-white font-extrabold'
                        : 'text-slate-600 hover:text-slate-900'
                        }`}
                >
                    {isVistaGeneral && (
                        <motion.span
                            layoutId="active-tecnico-nav-tab"
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
                    onClick={() => handleNavigation('/dashboard/proyectos')}
                    disabled={isTransitioning}
                    className={`relative flex-1 md:flex-none flex items-center justify-center gap-2 px-3 md:px-5 py-2 rounded-xl text-sm font-bold transition-colors duration-200 whitespace-nowrap focus:outline-none ${isProyectos
                        ? 'text-white font-extrabold'
                        : 'text-slate-600 hover:text-slate-900'
                        }`}
                >
                    {isProyectos && (
                        <motion.span
                            layoutId="active-tecnico-nav-tab"
                            className="absolute inset-0 bg-slate-900 rounded-xl z-0"
                            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                        />
                    )}
                    <span className="relative z-10 flex items-center gap-2">
                        <FolderKanban className="w-4 h-4" strokeWidth={1.75} />
                        <span className="hidden md:inline">Proyectos</span>
                    </span>
                </button>
            </div>
        </div>
    );
}
