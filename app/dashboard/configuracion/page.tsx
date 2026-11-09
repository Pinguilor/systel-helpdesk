import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, ShieldCheck, Eye, Users, Building2, Warehouse, Backpack, type LucideIcon } from 'lucide-react';
import { StickyHeader } from './components/StickyHeader';
import { agruparModulos, modulosPorRol, accesosRapidosPorRol } from './modulos';

export const metadata = {
    title: 'Panel de control — Systel Loop',
    description: 'Panel de administración y configuración del sistema Loop.',
};

type Kpi = { label: string; value: number | null; hint: string; icon: LucideIcon; tone: string };

export default async function ConfiguracionPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const { data: profile } = await supabase
        .from('profiles')
        .select('rol')
        .eq('id', user.id)
        .maybeSingle();

    const rol = profile?.rol?.toLowerCase() ?? '';
    if (rol !== 'admin' && rol !== 'coordinador') redirect('/dashboard');

    const esAdmin = rol === 'admin';
    const modulos = modulosPorRol(rol);
    const accesos = accesosRapidosPorRol(rol);

    // Indicadores (solo los que el rol puede ver)
    const [usuarios, clientes, bodegas, mochilas] = await Promise.all([
        esAdmin ? supabase.from('profiles').select('id', { count: 'exact', head: true }).is('cliente_id', null) : null,
        esAdmin ? supabase.from('clientes').select('id', { count: 'exact', head: true }).eq('activo', true) : null,
        esAdmin ? supabase.from('bodegas').select('id', { count: 'exact', head: true }).eq('tipo', 'INTERNA').eq('activo', true) : null,
        supabase.from('bodegas').select('id', { count: 'exact', head: true }).eq('tipo', 'MOCHILA'),
    ]);

    const kpis: Kpi[] = [
        ...(esAdmin ? [
            { label: 'Personal interno', value: usuarios?.count ?? null, hint: 'cuentas Systel', icon: Users, tone: 'bg-indigo-100 text-indigo-600' },
            { label: 'Clientes activos', value: clientes?.count ?? null, hint: 'empresas', icon: Building2, tone: 'bg-violet-100 text-violet-600' },
            { label: 'Bodegas activas', value: bodegas?.count ?? null, hint: 'locaciones internas', icon: Warehouse, tone: 'bg-emerald-100 text-emerald-600' },
        ] : []),
        { label: 'Mochilas', value: mochilas?.count ?? null, hint: 'técnicos con stock en campo', icon: Backpack, tone: 'bg-amber-100 text-amber-600' },
    ];

    return (
        <>
            <StickyHeader maxW="max-w-6xl">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Panel de control</p>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Resumen del sistema</h1>
                    <p className="text-sm font-medium text-slate-500 mt-1">
                        Rol: <span className="font-black text-slate-700 capitalize">{rol}</span>
                    </p>
                </div>
                {esAdmin ? (
                    <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-xl self-start">
                        <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span className="text-xs font-black text-indigo-700">Acceso completo de administrador</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl self-start">
                        <Eye className="w-4 h-4 text-slate-500 shrink-0" />
                        <span className="text-xs font-black text-slate-600">Acceso de supervisión</span>
                    </div>
                )}
            </div>
            </StickyHeader>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

            {/* Indicadores */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                {kpis.map(k => {
                    const Icon = k.icon;
                    return (
                        <div key={k.label} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">{k.label}</p>
                                <span className={`p-1.5 rounded-lg ${k.tone}`}><Icon className="w-4 h-4" /></span>
                            </div>
                            <p className="text-3xl font-black text-slate-900 leading-none">{k.value ?? '—'}</p>
                            <p className="text-xs font-medium text-slate-400 mt-1.5">{k.hint}</p>
                        </div>
                    );
                })}
            </div>

            {/* Acceso rápido al resto del sistema */}
            {accesos.length > 0 && (
                <div>
                    <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Acceso rápido</h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
                        {accesos.map(a => {
                            const Icon = a.icon;
                            return (
                                <Link
                                    key={a.href}
                                    href={a.href}
                                    className="group flex flex-col items-start gap-3 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all"
                                >
                                    <span className="p-2.5 rounded-xl bg-slate-100 text-slate-600 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                                        <Icon className="w-5 h-5" />
                                    </span>
                                    <span className="text-sm font-black text-slate-800">{a.title}</span>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Módulos por grupo */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60">
                    <h2 className="text-xs font-black uppercase tracking-widest text-slate-500">Módulos disponibles</h2>
                </div>
                {agruparModulos(modulos).map(([grupo, items]) => (
                    <div key={grupo}>
                        <p className="px-5 pt-3 pb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">{grupo}</p>
                        {items.map(m => {
                            const Icon = m.icon;
                            return (
                                <Link
                                    key={m.href}
                                    href={m.href}
                                    className="group flex items-center gap-3 px-5 py-3 border-t border-slate-100 first:border-t-0 hover:bg-slate-50 transition-colors"
                                >
                                    <span className="p-2 rounded-lg bg-slate-100 text-slate-600 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                                        <Icon className="w-4 h-4" />
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-black text-slate-900">{m.title}</p>
                                        <p className="text-xs font-medium text-slate-500 truncate">{m.description}</p>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
                                </Link>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
        </>
    );
}
