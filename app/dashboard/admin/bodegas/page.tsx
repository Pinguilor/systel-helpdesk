import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import { BodegasTable } from './components/BodegasTable';
import { AddStockModal } from './components/AddStockModal';
import { Box, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';

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

    // Familias for the modal — include bodega_id so the modal can filter per bodega
    const { data: familiasRaw } = await db
        .from('familias_hardware')
        .select('id, nombre, bodega_id')
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
    let catalogo: { modelo: string; familia: string; es_serializado: boolean; bodega_id: string }[] = [];

    const { data: catalogoRaw, error: catalogoErr } = await db
        .from('catalogo_equipos')
        .select('modelo, es_serializado, bodega_id, familias_hardware(nombre)')
        .order('modelo', { ascending: true });

    if (!catalogoErr && catalogoRaw) {
        const seen = new Set<string>();
        for (const r of catalogoRaw as any[]) {
            const familia = r.familias_hardware?.nombre ?? '';
            const key = `${r.modelo}|${familia}|${r.bodega_id}`;
            if (!seen.has(key)) {
                seen.add(key);
                catalogo.push({ modelo: r.modelo, familia, es_serializado: !!r.es_serializado, bodega_id: r.bodega_id ?? '' });
            }
        }
    }

    // Fallback: build from inventario if catalogo_equipos is empty or doesn't exist
    if (catalogo.length === 0) {
        const seen = new Map<string, typeof catalogo[0]>();
        for (const item of inventarioGlobal as any[]) {
            if (!item.modelo || !item.familia) continue;
            const key = `${item.modelo}|${item.familia}|${item.bodega_id}`;
            if (!seen.has(key)) {
                seen.set(key, {
                    modelo: item.modelo,
                    familia: item.familia,
                    es_serializado: !!item.es_serializado,
                    bodega_id: item.bodega_id ?? '',
                });
            }
        }
        catalogo = Array.from(seen.values());
    }

    return (
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">

            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm">
                <Link href="/dashboard/admin" className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-600 transition-colors font-medium">
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Inicio
                </Link>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                <span className="font-black text-slate-700">Bodegas (Inventario)</span>
            </nav>

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-100 rounded-2xl">
                        <Box className="w-7 h-7 text-indigo-600" />
                    </div>
                    <div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Inventario</p>
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                            Inventario Global
                        </h1>
                        <p className="text-sm text-slate-500 mt-0.5">
                            Supervisa y administra el inventario de las bodegas internas.
                        </p>
                    </div>
                </div>
                <AddStockModal bodegas={bodegas} catalogo={catalogo} familias={familias} />
            </div>

            <BodegasTable inventario={inventarioGlobal as any} bodegasDisponibles={bodegas} />
        </div>
    );
}
