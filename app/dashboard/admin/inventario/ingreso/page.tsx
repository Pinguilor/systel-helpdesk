import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import { ModoRafaga } from './components/ModoRafaga';
import { ImportarExcel } from '../importar-excel/components/ImportarExcel';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Scan, FileSpreadsheet } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface PageProps {
    searchParams: Promise<{ mode?: string }>;
}

export default async function IngresoMasivoPage({ searchParams }: PageProps) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const { data: profile } = await supabase
        .from('profiles')
        .select('rol')
        .eq('id', user.id)
        .maybeSingle();

    const rol = profile?.rol?.toUpperCase();
    if (rol !== 'ADMIN' && rol !== 'ADMIN_BODEGA') redirect('/dashboard/usuario');

    const db = createAdminClient();

    const { data: bodegasRaw } = await db
        .from('bodegas')
        .select('id, nombre')
        .eq('tipo', 'INTERNA')
        .eq('activo', true)
        .order('nombre');
    const bodegas = (bodegasRaw ?? []) as { id: string; nombre: string }[];

    // Load serialized catalog items
    const { data: catData } = await db
        .from('catalogo_equipos')
        .select('id, modelo, es_serializado, bodega_id, familias_hardware(nombre)')
        .order('modelo');

    let catalogo = ((catData ?? []) as any[]).map(r => ({
        id:             r.id as string,
        familia:        (r.familias_hardware as any)?.nombre ?? 'Sin familia',
        modelo:         r.modelo as string,
        es_serializado: (r.es_serializado as boolean) ?? false,
        bodega_id:      (r.bodega_id as string) ?? '',
    }));

    // Fallback: unique models from inventario if catalog is empty
    if (catalogo.length === 0) {
        const { data: invData } = await db
            .from('inventario')
            .select('familia, modelo, es_serializado, bodega_id')
            .eq('es_serializado', true)
            .order('modelo');

        const seen = new Set<string>();
        catalogo = (invData ?? [])
            .filter(r => {
                const key = `${r.bodega_id ?? ''}::${r.familia}::${r.modelo}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            })
            .map(r => ({
                id:             `${r.bodega_id ?? ''}::${r.familia}::${r.modelo}`,
                familia:        r.familia,
                modelo:         r.modelo,
                es_serializado: true,
                bodega_id:      r.bodega_id ?? '',
            }));
    }

    const resolvedSearchParams = await searchParams;
    const isExcel = resolvedSearchParams.mode === 'excel';

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8 min-h-[calc(100vh-6rem)] relative select-none">
            {/* Glowing decorative background orbs */}
            <div className="absolute top-10 right-10 w-72 h-72 bg-indigo-200/20 rounded-full filter blur-3xl pointer-events-none -z-10" />
            <div className="absolute bottom-10 left-10 w-96 h-96 bg-violet-200/15 rounded-full filter blur-3xl pointer-events-none -z-10" />

            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 shrink-0">
                <Link
                    href="/dashboard/admin/bodegas"
                    className="inline-flex items-center gap-1.5 hover:text-indigo-600 transition-colors"
                >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Inventario Global
                </Link>
                <ChevronRight className="w-3 h-3 text-slate-300" />
                <span className="text-slate-600 font-bold">
                    {isExcel ? 'Importar desde Excel' : 'Ingreso por Escáner'}
                </span>
            </nav>

            {/* Segmented Tab Control */}
            <div className="flex justify-center shrink-0">
                <div className="bg-slate-100/90 backdrop-blur-md p-1.5 rounded-2xl flex gap-1 border border-slate-200/60 shadow-inner max-w-md w-full">
                    <Link
                        href="/dashboard/admin/inventario/ingreso"
                        className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black transition-all duration-350 cursor-pointer ${
                            !isExcel
                                ? 'bg-white text-slate-900 shadow-md scale-[1.02] border border-slate-200/40'
                                : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
                        }`}
                    >
                        <Scan className="w-3.5 h-3.5" />
                        Escáner (Modo Ráfaga)
                    </Link>
                    <Link
                        href="/dashboard/admin/inventario/ingreso?mode=excel"
                        className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black transition-all duration-350 cursor-pointer ${
                            isExcel
                                ? 'bg-white text-slate-900 shadow-md scale-[1.02] border border-slate-200/40'
                                : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
                        }`}
                    >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        Carga desde Excel
                    </Link>
                </div>
            </div>

            {isExcel ? (
                <ImportarExcel bodegas={bodegas} catalogo={catalogo} />
            ) : (
                <ModoRafaga bodegas={bodegas} catalogo={catalogo} />
            )}
        </div>
    );
}
