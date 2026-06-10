import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import { ImportarExcel } from './components/ImportarExcel';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Importar Excel — Ingreso de Inventario',
};

export default async function ImportarExcelPage() {
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

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6 min-h-[calc(100vh-6rem)]">

            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm shrink-0">
                <Link
                    href="/dashboard/admin/bodegas"
                    className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-600 transition-colors font-medium"
                >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Inventario Global
                </Link>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                <span className="font-black text-slate-700">Importar desde Excel</span>
            </nav>

            <ImportarExcel bodegas={bodegas} catalogo={catalogo} />
        </div>
    );
}
