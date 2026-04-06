import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import { BodegasTable } from './components/BodegasTable';
import { AddStockModal } from './components/AddStockModal';
import { Box } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function BodegasPage() {
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

    // Bodegas internas
    const { data: bodegasRaw } = await db
        .from('bodegas')
        .select('id, nombre, tipo, activo')
        .eq('tipo', 'INTERNA')
        .order('nombre', { ascending: true });
    const bodegas = bodegasRaw ?? [];

    // Familias for the modal
    const { data: familiasRaw } = await db
        .from('familias_hardware')
        .select('id, nombre')
        .order('nombre', { ascending: true });
    const familias = familiasRaw ?? [];

    // Inventario global: INTERNA bodegas only, exclude soft-deleted
    const { data: inventarioRaw, error: inventarioError } = await db
        .from('inventario')
        .select('*, bodegas(id, nombre, tipo)')
        .eq('bodegas.tipo', 'INTERNA')
        .neq('estado', 'Inactivo');

    if (inventarioError) {
        console.error('Error fetching inventario:', inventarioError.message);
    }

    // JS-filter in case PostgREST returns nulls for joined filter
    const inventarioGlobal = (inventarioRaw ?? []).filter(
        (item: any) => item.bodegas?.tipo?.toUpperCase() === 'INTERNA'
    );

    // Catalogo from catalogo_equipos (authoritative) — graceful fallback to inventario
    let catalogo: { modelo: string; familia: string; es_serializado: boolean }[] = [];

    const { data: catalogoRaw, error: catalogoErr } = await db
        .from('catalogo_equipos')
        .select('modelo, es_serializado, familias_hardware(nombre)')
        .order('modelo', { ascending: true });

    if (!catalogoErr && catalogoRaw) {
        const seen = new Set<string>();
        for (const r of catalogoRaw as any[]) {
            const familia = r.familias_hardware?.nombre ?? '';
            const key = `${r.modelo}|${familia}`;
            if (!seen.has(key)) {
                seen.add(key);
                catalogo.push({ modelo: r.modelo, familia, es_serializado: !!r.es_serializado });
            }
        }
    }

    // Fallback: build from inventario if catalogo_equipos is empty or doesn't exist
    if (catalogo.length === 0) {
        const seen = new Map<string, typeof catalogo[0]>();
        for (const item of inventarioGlobal as any[]) {
            if (!item.modelo || !item.familia) continue;
            const key = `${item.modelo}|${item.familia}`;
            if (!seen.has(key)) {
                seen.set(key, {
                    modelo: item.modelo,
                    familia: item.familia,
                    es_serializado: !!item.es_serializado,
                });
            }
        }
        catalogo = Array.from(seen.values());
    }

    return (
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
                        <Box className="w-8 h-8 text-indigo-600" />
                        Inventario Global
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">
                        Supervisa y administra el inventario de las bodegas internas.
                    </p>
                </div>
                <AddStockModal bodegas={bodegas} catalogo={catalogo} familias={familias} />
            </div>

            <BodegasTable inventario={inventarioGlobal as any} bodegasDisponibles={bodegas} />
        </div>
    );
}
