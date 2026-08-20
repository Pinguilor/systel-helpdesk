import { createClient }      from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect }          from 'next/navigation';
import Link                  from 'next/link';
import { ChevronLeft, ChevronRight, ClipboardList } from 'lucide-react';
import { getGuiasIngresoAction, getKPIsGuiasAction } from './actions';
import { GuiasClient }                              from './components/GuiasClient';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Guías de Ingreso — Systel Loop',
};

export default async function GuiasIngresoPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const { data: profile } = await supabase
        .from('profiles').select('rol').eq('id', user.id).maybeSingle();
    const rol = profile?.rol?.toUpperCase();
    if (rol !== 'ADMIN' && rol !== 'ADMIN_BODEGA') redirect('/dashboard');

    const db = createAdminClient();

    const [guiasResult, bodegasResult, catalogoResult, proveedoresResult, kpis] = await Promise.all([
        getGuiasIngresoAction(0, 10),
        db.from('bodegas')
            .select('id, nombre')
            .eq('tipo', 'INTERNA')
            .eq('activo', true)
            .order('nombre'),
        db.from('catalogo_equipos')
            .select('modelo, es_serializado, bodega_id, familias_hardware(nombre)')
            .order('modelo'),
        db.from('proveedores')
            .select('id, nombre')
            .order('nombre'),
        getKPIsGuiasAction(),
    ]);

    const bodegas     = (bodegasResult.data     ?? []) as { id: string; nombre: string }[];
    const proveedores = (proveedoresResult.data ?? []) as { id: string; nombre: string }[];

    const catalogo: { modelo: string; familia: string; es_serializado: boolean; bodega_id: string }[] = [];
    const seen = new Set<string>();
    for (const r of (catalogoResult.data ?? []) as any[]) {
        const familia = r.familias_hardware?.nombre ?? '';
        const key = `${r.modelo}|${familia}|${r.bodega_id}`;
        if (!seen.has(key)) {
            seen.add(key);
            catalogo.push({
                modelo:         r.modelo,
                familia,
                es_serializado: !!r.es_serializado,
                bodega_id:      r.bodega_id ?? '',
            });
        }
    }

    return (
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8 relative select-none">
            <div className="absolute top-10 right-20 w-96 h-96 bg-indigo-200/20 rounded-full filter blur-3xl pointer-events-none -z-10" />

            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-slate-400">
                <Link
                    href="/dashboard/admin/bodegas"
                    className="inline-flex items-center gap-1 hover:text-indigo-600 active:scale-95 transition-all"
                >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Inventario
                </Link>
                <ChevronRight className="w-3 h-3 text-slate-300" />
                <span className="text-indigo-950 font-black">Guías de Ingreso</span>
            </nav>

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-600/20">
                        <ClipboardList className="w-8 h-8 text-white" strokeWidth={1.5} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ERP Loop × Systel</p>
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-0.5">
                            Guías de Ingreso
                        </h1>
                        <p className="text-sm text-slate-500 leading-relaxed max-w-xl">
                            Registra el ingreso de stock respaldado por guías de despacho del proveedor. Trazabilidad documental completa.
                        </p>
                    </div>
                </div>
            </div>

            <GuiasClient
                guiasIniciales={guiasResult.data}
                totalGuias={guiasResult.total}
                bodegas={bodegas}
                catalogo={catalogo}
                proveedores={proveedores}
                kpis={kpis}
            />
        </div>
    );
}
