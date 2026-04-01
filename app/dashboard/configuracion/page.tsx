import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
    Settings, Users, Backpack,
    ChevronRight, ShieldCheck, Eye,
    Layers, Wrench, Building2
} from 'lucide-react';

export const metadata = {
    title: 'Configuración — Systel Loop',
    description: 'Panel de administración y configuración del sistema Loop.',
};

// ── Definición de módulos ──────────────────────────────────────
const MODULOS = [
    {
        href:        '/dashboard/configuracion/usuarios',
        icon:        Users,
        title:       'Gestión de Personal',
        description: 'Crea, edita y elimina usuarios del sistema. Administra roles y permisos de acceso para cada miembro del equipo.',
        badge:       'Admin Only',
        badgeColor:  'bg-indigo-100 text-indigo-700 border-indigo-200',
        gradient:    'from-indigo-500 to-indigo-700',
        iconBg:      'bg-indigo-100 text-indigo-600',
        rolesAllow:  ['admin'],
        items:       ['Crear cuentas', 'Asignar roles', 'Eliminar usuarios'],
    },
    {
        href:        '/dashboard/admin/mochilas',
        icon:        Backpack,
        title:       'Auditoría de Mochilas',
        description: 'Supervisa el inventario que cada técnico lleva consigo en campo. Visualiza stock asignado y movimientos.',
        badge:       'Solo lectura',
        badgeColor:  'bg-amber-100 text-amber-700 border-amber-200',
        gradient:    'from-amber-500 to-orange-600',
        iconBg:      'bg-amber-100 text-amber-600',
        rolesAllow:  ['admin', 'coordinador'],
        items:       ['Inventario por técnico', 'Historial de movimientos', 'Stock en campo'],
    },
    {
        href:        '/dashboard/configuracion/clientes',
        icon:        Building2,
        title:       'Gestión de Clientes',
        description: 'Registra y administra las empresas clientes de Systel. Cada cliente tiene su catálogo, usuarios y tickets aislados.',
        badge:       'Multi-Tenant',
        badgeColor:  'bg-violet-100 text-violet-700 border-violet-200',
        gradient:    'from-violet-500 to-indigo-600',
        iconBg:      'bg-violet-100 text-violet-600',
        rolesAllow:  ['admin'],
        items:       ['Gestión de empresas', 'Activar / Desactivar', 'Catálogo por cliente'],
    },
];

export default async function ConfiguracionPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const { data: profile } = await supabase
        .from('profiles')
        .select('rol, full_name')
        .eq('id', user.id)
        .maybeSingle();

    const rol = profile?.rol?.toLowerCase() ?? '';

    // Solo admin y coordinador acceden a configuración
    if (rol !== 'admin' && rol !== 'coordinador') redirect('/dashboard');

    const modulosVisibles = MODULOS.filter(m => m.rolesAllow.includes(rol));

    return (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

            {/* Header section */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-3 bg-slate-100 text-slate-600 rounded-2xl">
                            <Settings className="w-7 h-7" />
                        </div>
                        <div>
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Systel Loop</p>
                            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Configuración</h1>
                        </div>
                    </div>
                    <p className="text-sm font-medium text-slate-500 ml-[60px]">
                        Panel de administración del sistema · Rol: <span className="font-black text-slate-700 capitalize">{rol}</span>
                    </p>
                </div>

                {rol === 'admin' && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-xl self-start sm:self-auto">
                        <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span className="text-xs font-black text-indigo-700">Acceso completo de administrador</span>
                    </div>
                )}
                {rol === 'coordinador' && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl self-start sm:self-auto">
                        <Eye className="w-4 h-4 text-slate-500 shrink-0" />
                        <span className="text-xs font-black text-slate-600">Acceso de supervisión</span>
                    </div>
                )}
            </div>

            {/* Divisor */}
            <div className="h-px bg-gradient-to-r from-slate-200 via-indigo-100 to-transparent" />

            {/* Grid de módulos */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {modulosVisibles.map((modulo) => {
                    const Icon = modulo.icon;
                    return (
                        <Link
                            key={modulo.href}
                            href={modulo.href}
                            className="group relative bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:border-slate-300 transition-all duration-300 overflow-hidden flex flex-col"
                        >
                            {/* Gradient bar top */}
                            <div className={`h-1.5 w-full bg-gradient-to-r ${modulo.gradient}`} />

                            <div className="p-6 flex flex-col flex-1">
                                {/* Icon + Badge */}
                                <div className="flex items-start justify-between mb-4">
                                    <div className={`p-3 rounded-2xl ${modulo.iconBg} group-hover:scale-110 transition-transform duration-300`}>
                                        <Icon className="w-6 h-6" />
                                    </div>
                                    <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border ${modulo.badgeColor}`}>
                                        {modulo.badge}
                                    </span>
                                </div>

                                {/* Title + Description */}
                                <h2 className="text-base font-black text-slate-900 mb-2 group-hover:text-indigo-700 transition-colors">
                                    {modulo.title}
                                </h2>
                                <p className="text-sm font-medium text-slate-500 leading-relaxed mb-4 flex-1">
                                    {modulo.description}
                                </p>

                                {/* Feature list */}
                                <ul className="space-y-1.5 mb-5">
                                    {modulo.items.map(item => (
                                        <li key={item} className="flex items-center gap-2 text-xs font-medium text-slate-500">
                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                                            {item}
                                        </li>
                                    ))}
                                </ul>

                                {/* CTA */}
                                <div className="flex items-center gap-1.5 text-xs font-black text-indigo-600 group-hover:gap-2.5 transition-all">
                                    <span>Acceder al módulo</span>
                                    <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                                </div>
                            </div>
                        </Link>
                    );
                })}
            </div>

            {/* Footer info */}
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                    <Layers className="w-3.5 h-3.5" />
                    <span>{modulosVisibles.length} módulo{modulosVisibles.length !== 1 ? 's' : ''} disponible{modulosVisibles.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                    <Wrench className="w-3.5 h-3.5" />
                    <span>Systel Loop · Sistema de Gestión Integral</span>
                </div>
            </div>
        </div>
    );
}
