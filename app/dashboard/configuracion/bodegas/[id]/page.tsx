import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Warehouse, Package, PackageOpen } from 'lucide-react';
import { AddEquipoModal, CatalogoItem, FamiliaHardware } from './AddEquipoModal';
import { CatalogoGlobalModal, ModeloCatalogo } from './CatalogoGlobalModal';
import { BodegaStockTable, StockGroup, StockRow } from './BodegaStockTable';

export const dynamic = 'force-dynamic';

export default async function BodegaDetallePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const { data: profile } = await supabase
        .from('profiles')
        .select('rol')
        .eq('id', user.id)
        .maybeSingle();

    if (profile?.rol?.toUpperCase() !== 'ADMIN') redirect('/dashboard/configuracion');

    // Fetch this bodega (must be INTERNA)
    const { data: bodega } = await supabase
        .from('bodegas')
        .select('id, nombre, tipo, descripcion, activo')
        .eq('id', id)
        .eq('tipo', 'INTERNA')
        .maybeSingle();

    if (!bodega) notFound();

    // Use admin client for inventory reads (bypasses RLS consistently)
    const db = createAdminClient();

    // Fetch inventory and families in parallel.
    // Families must load first: their UUIDs scope every catalogo_equipos query.
    // Root cause of the "0 models" bug: old catalogo_equipos rows have bodega_id=NULL
    // but DO have familia_id pointing to old global families. New bodega-specific families
    // have different UUIDs. Filtering by bodega_id on catalogo_equipos returns nothing.
    // Fix: filter catalogo_equipos by familia_id IN (this bodega's family UUIDs).
    const [{ data: inventarioRaw }, { data: familiasRaw }] = await Promise.all([
        db
            .from('inventario')
            .select('id, modelo, familia, es_serializado, cantidad, estado, numero_serie, bodega_id')
            .eq('bodega_id', id)
            .is('ticket_id', null)
            .neq('estado', 'Inactivo')
            .order('familia', { ascending: true }),
        db
            .from('familias_hardware')
            .select('id, nombre')
            .eq('bodega_id', id)
            .order('nombre', { ascending: true }),
    ]);

    const inventario = (inventarioRaw ?? []) as StockRow[];
    const familias: FamiliaHardware[] = familiasRaw ?? [];
    const familiaIds = familias.map(f => f.id);

    // Build grouped view: per (familia, modelo) aggregate
    const groupMap = new Map<string, StockGroup>();
    for (const item of inventario) {
        const key = `${item.familia ?? ''}|${item.modelo ?? ''}`;
        if (!groupMap.has(key)) {
            groupMap.set(key, {
                key,
                familia: item.familia ?? '—',
                modelo: item.modelo ?? '—',
                es_serializado: !!item.es_serializado,
                totalUnidades: 0,
                rows: [],
                bodegaId: id,
            });
        }
        const g = groupMap.get(key)!;
        g.rows.push(item);
        g.totalUnidades += item.cantidad ?? 0;
    }
    // grupos built after supplementing with catalog entries below

    // All catalog queries use familia_id IN — correct for both old rows (bodega_id=NULL)
    // and new rows, because the family UUID is the real scope boundary.
    const emptyResult = { data: [] as any[], error: null };
    const [catalogoEquiposRes, catalogoInventarioRes, modelosRes] = await Promise.all([
        familiaIds.length > 0
            ? db
                .from('catalogo_equipos')
                .select('modelo, es_serializado, familias_hardware(nombre)')
                .in('familia_id', familiaIds)
                .not('modelo', 'is', null)
            : Promise.resolve(emptyResult),
        db
            .from('inventario')
            .select('modelo, familia, es_serializado')
            .eq('bodega_id', id)
            .not('modelo', 'is', null)
            .not('familia', 'is', null),
        familiaIds.length > 0
            ? db
                .from('catalogo_equipos')
                .select('id, familia_id, modelo, es_serializado')
                .in('familia_id', familiaIds)
                .order('modelo', { ascending: true })
            : Promise.resolve(emptyResult),
    ]);

    const catalogoEquiposRaw  = catalogoEquiposRes.data  ?? [];
    const catalogoInventarioRaw = catalogoInventarioRes.data ?? [];
    const modelosRaw = modelosRes.data;

    const catalogoMap = new Map<string, CatalogoItem>();
    // 1. Catalog entries for this bodega's families (source of truth)
    for (const r of (catalogoEquiposRaw) as any[]) {
        if (!catalogoMap.has(r.modelo)) {
            catalogoMap.set(r.modelo, {
                modelo: r.modelo,
                familia: (r.familias_hardware as any)?.nombre ?? '',
                es_serializado: !!r.es_serializado,
            });
        }
    }
    // 2. Existing inventory of this bodega (backward compatibility — items added before catalog)
    for (const r of catalogoInventarioRaw) {
        if (!catalogoMap.has(r.modelo)) {
            catalogoMap.set(r.modelo, {
                modelo: r.modelo,
                familia: r.familia,
                es_serializado: !!r.es_serializado,
            });
        }
    }
    const catalogo: CatalogoItem[] = Array.from(catalogoMap.values());

    const modelosPorFamilia: Record<string, ModeloCatalogo[]> = {};
    for (const m of (modelosRaw ?? []) as ModeloCatalogo[]) {
        if (!modelosPorFamilia[m.familia_id]) modelosPorFamilia[m.familia_id] = [];
        modelosPorFamilia[m.familia_id].push(m);
    }

    // Supplement groupMap with catalog entries that have no physical stock yet (show as 0)
    const familiaById = new Map(familias.map(f => [f.id, f.nombre]));
    for (const m of (modelosRaw ?? []) as ModeloCatalogo[]) {
        const famNombre = familiaById.get(m.familia_id) ?? '—';
        const key = `${famNombre}|${m.modelo}`;
        if (!groupMap.has(key)) {
            groupMap.set(key, {
                key,
                familia: famNombre,
                modelo: m.modelo,
                es_serializado: !!m.es_serializado,
                totalUnidades: 0,
                rows: [],
                bodegaId: id,
            });
        }
    }

    const grupos = Array.from(groupMap.values());
    const totalUnidades = grupos.reduce((s, g) => s + g.totalUnidades, 0);

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <Link
                        href="/dashboard/configuracion/bodegas"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors mb-3"
                    >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        Bodegas del Sistema
                    </Link>
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-emerald-100 rounded-2xl">
                            <Warehouse className="w-7 h-7 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Inventario</p>
                            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                                {bodega.nombre}
                            </h1>
                            {bodega.descripcion && (
                                <p className="text-sm text-slate-500 mt-0.5">{bodega.descripcion}</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <CatalogoGlobalModal familias={familias} modelosPorFamilia={modelosPorFamilia} bodegaId={id} bodegaNombre={bodega.nombre} />
                    <AddEquipoModal bodegaId={id} catalogo={catalogo} familias={familias} />
                </div>
            </div>

            {/* Stats bar */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex flex-col gap-0.5 shadow-sm">
                    <span className="text-xl font-black text-slate-700">{grupos.length}</span>
                    <span className="text-xs font-medium text-slate-500">Modelos distintos</span>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex flex-col gap-0.5 shadow-sm">
                    <span className="text-xl font-black text-emerald-600">{totalUnidades}</span>
                    <span className="text-xs font-medium text-slate-500">Unidades en stock</span>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex flex-col gap-0.5 shadow-sm col-span-2 sm:col-span-1">
                    <span className={`text-xl font-black ${bodega.activo ? 'text-emerald-600' : 'text-red-500'}`}>
                        {bodega.activo ? 'Activa' : 'Inactiva'}
                    </span>
                    <span className="text-xs font-medium text-slate-500">Estado de la bodega</span>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                    <Package className="w-4 h-4 text-slate-400" />
                    <h2 className="text-sm font-black text-slate-700 uppercase tracking-wide">Catálogo de Stock</h2>
                </div>

                {grupos.length === 0 ? (
                    <div className="text-center py-16 text-slate-400">
                        <PackageOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="font-semibold text-sm">Esta bodega no tiene modelos en su catálogo</p>
                        <p className="text-xs mt-1">Crea modelos en "Catálogo de Equipos" y luego ingresa stock</p>
                    </div>
                ) : (
                    <BodegaStockTable grupos={grupos} />
                )}

                {grupos.length > 0 && (
                    <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-400 font-medium">
                        {grupos.length} modelos · {totalUnidades} unidades totales
                    </div>
                )}
            </div>
        </div>
    );
}
