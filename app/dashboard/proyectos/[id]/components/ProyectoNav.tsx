'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Package, Users } from 'lucide-react';

const TABS = [
    { label: 'Bitácora', href: 'bitacora', icon: BookOpen },
    { label: 'Hardware y Logística', href: 'bom', icon: Package },
] as const;

export function ProyectoNav({ proyectoId }: { proyectoId: string }) {
    const pathname = usePathname();

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-2">
            <div className="inline-flex items-center p-1 bg-white/70 backdrop-blur-md border border-slate-200/40 rounded-2xl gap-1 shadow-sm">
                {TABS.map(({ label, href, icon: Icon }) => {
                    const fullPath = `/dashboard/proyectos/${proyectoId}/${href}`;
                    const isActive = pathname?.startsWith(fullPath);
                    return (
                        <Link
                            key={href}
                            href={fullPath}
                            className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors whitespace-nowrap ${
                                isActive
                                    ? 'bg-slate-900 text-white shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                            }`}
                        >
                            <Icon className="w-4 h-4" strokeWidth={1.75} />
                            <span className="hidden sm:inline">{label}</span>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
