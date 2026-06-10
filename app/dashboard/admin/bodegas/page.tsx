import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import { BodegasTable } from './components/BodegasTable';
import { IngresoDropdown } from './components/IngresoDropdown';
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

    // ── Step 1: bodegas (needed to derive bodegaIds for filtered queries) ──────
    const { data: bodegasRaw } = await db
        .from('bodegas')
        .select('id, nombre, tipo, activo')
        .eq('tipo', 'INTERNA')
        .order('nombre', { ascending: true });
    const bodegas   = bodegasRaw ?? [];
    const bodegaIds = bodegas.map(b => b.id);

    // ── Step 2: all remaining queries in parallel ────────────────────────────
    const [
        familiasResult,
        inventarioResult,
        totalCountResult,
        criticoResult,
        bajoResult,
        catDataResult,
    ] = await Promise.all([
        // familias for AddStockModal
        db.from('familias_hardware')
            .select('id, nombre, bodega_id')
            .order('nombre', { ascending: true }),

        // inventario — first 30 rows (no count meta)
        bodegaIds.length > 0
            ? db.from('inventario')
                .select('*, bodegas(id, nombre, tipo)')
                .in('bodega_id', bodegaIds)
                .neq('estado', 'Inactivo')
                .order('modelo', { ascending: true })
                .range(0, 29)
            : Promise.resolve({ data: [], error: null }),

        // total count of active inventario items
        bodegaIds.length > 0
            ? db.from('inventario')
                .select('*', { count: 'exact', head: true })
                .in('bodega_id', bodegaIds)
                .neq('estado', 'Inactivo')
            : Promise.resolve({ count: 0, error: null }),

        // count of generic items with stock ≤ 3 (crítico)
        bodegaIds.length > 0
            ? db.from('inventario')
                .select('*', { count: 'exact', head: true })
                .in('bodega_id', bodegaIds)
                .eq('es_serializado', false)
                .lte('cantidad', 3)
                .neq('estado', 'Inactivo')
            : Promise.resolve({ count: 0, error: null }),

        // count of generic items with stock 4–10 (bajo)
        bodegaIds.length > 0
            ? db.from('inventario')
                .select('*', { count: 'exact', head: true })
                .in('bodega_id', bodegaIds)
                .eq('es_serializado', false)
                .gt('cantidad', 3)
                .lte('cantidad', 10)
                .neq('estado', 'Inactivo')
            : Promise.resolve({ count: 0, error: null }),

        // catalog for dropdown modal
        db.from('catalogo_equipos')
            .select('modelo, es_serializado, bodega_id, familias_hardware(nombre)')
            .order('modelo', { ascending: true }),
    ]);

    const familias    = familiasResult.data ?? [];
    const totalCount  = (totalCountResult as any).count ?? 0;
    const countCritico = (criticoResult as any).count ?? 0;
    const countBajo    = (bajoResult as any).count ?? 0;

    // Ya filtramos por bodega_id IN (bodegaIds) — todos son INTERNA, no se necesita re-filtrar
    const inventarioGlobal = (inventarioResult.data ?? []) as any[];

    // ── Build catalogo for dropdown modal (with fallback) ────────────────────
    let catalogo: { modelo: string; familia: string; es_serializado: boolean; bodega_id: string }[] = [];

    if (!catDataResult.error && catDataResult.data?.length) {
        const seen = new Set<string>();
        for (const r of catDataResult.data as any[]) {
            const familia = r.familias_hardware?.nombre ?? '';
            const key     = `${r.modelo}|${familia}|${r.bodega_id}`;
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
    }

    if (catalogo.length === 0) {
        const { data: invFallbackData } = await db
            .from('inventario')
            .select('familia, modelo, es_serializado, bodega_id')
            .order('modelo', { ascending: true });

        const seen = new Map<string, typeof catalogo[0]>();
        for (const item of (invFallbackData ?? []) as any[]) {
            if (!item.modelo || !item.familia) continue;
            const key = `${item.modelo}|${item.familia}|${item.bodega_id ?? ''}`;
            if (!seen.has(key)) {
                seen.set(key, {
                    modelo:         item.modelo,
                    familia:        item.familia,
                    es_serializado: !!item.es_serializado,
                    bodega_id:      item.bodega_id ?? '',
                });
            }
        }
        catalogo = Array.from(seen.values());
    }

    return (
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8 relative select-none">
            {/* Glowing decorative background orbs */}
            <div className="absolute top-10 right-20 w-96 h-96 bg-indigo-200/20 rounded-full filter blur-3xl pointer-events-none -z-10" />
            <div className="absolute bottom-20 left-20 w-96 h-96 bg-violet-200/15 rounded-full filter blur-3xl pointer-events-none -z-10" />

            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-slate-400 shrink-0">
                <Link
                    href="/dashboard/admin"
                    className="inline-flex items-center gap-1 hover:text-indigo-600 active:scale-95 transition-all"
                >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Inicio
                </Link>
                <ChevronRight className="w-3 h-3 text-slate-300" />
                <span className="text-indigo-950 font-black">Bodegas (Inventario)</span>
            </nav>

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-600/20 active:scale-95 transition-transform duration-200">
                        <Box className="w-8 h-8 text-white" strokeWidth={1.5} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ERP Loop × Systel</p>
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-0.5">
                            Inventario Global
                        </h1>
                        <p className="text-sm text-slate-500 leading-relaxed max-w-xl">
                            Supervisa y administra en tiempo real el stock, familias de hardware y números de serie de las bodegas internas.
                        </p>
                    </div>
                </div>

                <div className="shrink-0">
                    <IngresoDropdown
                        bodegas={bodegas}
                        catalogo={catalogo}
                        familias={familias}
                    />
                </div>
            </div>

            <BodegasTable
                inventario={inventarioGlobal as any}
                bodegasDisponibles={bodegas}
                totalCount={totalCount}
                countCritico={countCritico}
                countBajo={countBajo}
                bodegaIds={bodegaIds}
            />
        </div>
    );
}
