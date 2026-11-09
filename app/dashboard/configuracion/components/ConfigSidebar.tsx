'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ArrowLeft, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sidebar, DesktopSidebar, MobileSidebar, SidebarLink, useSidebar } from '@/components/ui/sidebar';
import { MODULOS, RESUMEN, RESUMEN_HREF, agruparModulos, accesosRapidosPorRol } from '../modulos';

// ── Contenido del panel (se reutiliza en escritorio y móvil) ─────────────
function PanelContenido({ rol, nombre }: { rol: string; nombre: string | null }) {
    const { open, setOpen } = useSidebar();
    const pathname = usePathname();

    const grupos = useMemo(
        () => agruparModulos(MODULOS.filter(m => m.rolesAllow.includes(rol))),
        [rol]
    );

    const accesos = useMemo(() => accesosRapidosPorRol(rol), [rol]);

    // Al navegar, el overlay móvil se cierra
    useEffect(() => { setOpen(false); }, [pathname, setOpen]);

    const esActivo = (href: string) =>
        href === RESUMEN_HREF ? pathname === href : pathname === href || pathname.startsWith(href + '/');

    const iconClass = 'h-5 w-5 flex-shrink-0';
    const linkClass = (activo: boolean) =>
        cn(
            'rounded-lg px-3 transition-colors',
            activo ? 'bg-white text-indigo-600 shadow-sm' : 'text-white/85 hover:bg-white/10'
        );
    const labelClass = (activo: boolean) => (activo ? 'text-slate-900' : 'text-white/85');
    const iniciales = (nombre || 'U').trim().charAt(0).toUpperCase();

    return (
        <>
            <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
                {/* Título */}
                {open ? (
                    <div className="flex items-center gap-3 rounded-xl bg-white/10 border border-white/15 text-white px-3 py-3 shrink-0">
                        <SlidersHorizontal className="h-5 w-5 shrink-0" />
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-black leading-tight">Panel de control</p>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 capitalize">{rol}</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center shrink-0">
                        <div className="h-9 w-9 flex items-center justify-center rounded-xl bg-gradient-to-br from-[#0e3187] to-[#222727] text-white">
                            <SlidersHorizontal className="h-4 w-4" />
                        </div>
                    </div>
                )}

                <div className="mt-5 flex flex-col gap-0.5">
                    {open
                        ? <p className="px-3 mb-1 text-[10px] font-black uppercase tracking-widest text-white/50">General</p>
                        : <div className="mx-3 mb-1 h-px bg-white/20" />}
                    <SidebarLink
                        link={{ label: RESUMEN.title, href: RESUMEN_HREF, icon: <RESUMEN.icon className={iconClass} /> }}
                        className={linkClass(esActivo(RESUMEN_HREF))}
                        labelClassName={labelClass(esActivo(RESUMEN_HREF))}
                    />

                    {grupos.map(([grupo, items]) => (
                        <div key={grupo} className="mt-3 flex flex-col gap-0.5">
                            {open
                                ? <p className="px-3 mb-1 text-[10px] font-black uppercase tracking-widest text-white/50">{grupo}</p>
                                : <div className="mx-3 mb-1 h-px bg-white/20" />}
                            {items.map(m => {
                                const Icon = m.icon;
                                return (
                                    <SidebarLink
                                        key={m.href}
                                        link={{ label: m.title, href: m.href, icon: <Icon className={iconClass} /> }}
                                        className={linkClass(esActivo(m.href))}
                                        labelClassName={labelClass(esActivo(m.href))}
                                    />
                                );
                            })}
                        </div>
                    ))}

                    {accesos.length > 0 && (
                        <div className="mt-3 flex flex-col gap-0.5">
                            <p className="px-3 mb-1 text-[10px] font-black uppercase tracking-widest text-white/50">Acceso rápido</p>
                            {accesos.map(a => {
                                const Icon = a.icon;
                                return (
                                    <SidebarLink
                                        key={a.href}
                                        link={{ label: a.title, href: a.href, icon: <Icon className={iconClass} /> }}
                                        className={linkClass(false)}
                                        labelClassName={labelClass(false)}
                                    />
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Pie: volver + usuario */}
            <div className="flex flex-col gap-0.5 pt-2 border-t border-white/15 shrink-0">
                <SidebarLink
                    link={{ label: 'Volver al dashboard', href: '/dashboard', icon: <ArrowLeft className={iconClass} /> }}
                    className="rounded-lg px-3 text-white/85 hover:bg-white/10"
                    labelClassName="text-white/85"
                />
                <SidebarLink
                    link={{
                        label: nombre || 'Usuario',
                        href: '/dashboard/perfil',
                        icon: (
                            <span className="h-7 w-7 -ml-1 flex-shrink-0 rounded-full bg-white text-indigo-700 text-xs font-black flex items-center justify-center">
                                {iniciales}
                            </span>
                        ),
                    }}
                    className="rounded-lg px-3 text-white/85 hover:bg-white/10"
                    labelClassName="text-white/85"
                />
            </div>
        </>
    );
}

const noop = () => {};

export function ConfigSidebar({
    rol,
    nombre,
    children,
}: {
    rol: string;
    nombre: string | null;
    children: React.ReactNode;
}) {
    const [openMovil, setOpenMovil] = useState(false);
    return (
        // Pantalla completa: reemplaza la barra superior y el menú de pestañas del dashboard
        <div className="fixed inset-0 z-[60] flex flex-col md:flex-row bg-gradient-to-b from-[#0e3187] to-[#222727]">
            {/* Escritorio: panel siempre abierto, a toda la altura */}
            <Sidebar open animate={false} setOpen={noop}>
                <DesktopSidebar className="w-[260px] px-3 py-3 bg-transparent" onMouseEnter={noop} onMouseLeave={noop}>
                    <PanelContenido rol={rol} nombre={nombre} />
                </DesktopSidebar>
            </Sidebar>

            {/* Móvil: barra superior + overlay a pantalla completa */}
            <Sidebar open={openMovil} setOpen={setOpenMovil}>
                <MobileSidebar className="justify-between gap-10 bg-gradient-to-b from-[#0e3187] to-[#222727]">
                    <PanelContenido rol={rol} nombre={nombre} />
                </MobileSidebar>
            </Sidebar>

            {/* Hoja de contenido, curvada contra el panel */}
            <main className="flex-1 min-w-0 min-h-0 overflow-y-auto bg-brand-bg-base md:rounded-l-[2.5rem] md:border-l md:border-neutral-200">
                {children}
            </main>
        </div>
    );
}
