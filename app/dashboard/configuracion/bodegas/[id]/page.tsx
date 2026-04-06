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

    // Fetch real inventory for this bodega (exclude soft-deleted: estado=Inactivo)
    const { data: inventarioRaw } = await db
        .from('inventario')
        .select('id, modelo, familia, es_serializado, cantidad, estado, numero_serie, bodega_id')
        .eq('bodega_id', id)
        .is('ticket_id', null)
        .neq('estado', 'Inactivo')
        .order('familia', { ascending: true });

    const inventario = (inventarioRaw ?? []) as StockRow[];

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
    const grupos = Array.from(groupMap.values());

    // Catalog: distinct models across ALL inventario for the AddEquipo combobox
    const { data: catalogoRaw } = await db
        .from('inventario')
        .select('modelo, familia, es_serializado')
        .not('modelo', 'is', null)
        .not('familia', 'is', null);

    const catalogoMap = new Map<string, CatalogoItem>();
    for (const r of catalogoRaw ?? []) {
        const k = `${r.modelo}|${r.familia}`;
        if (!catalogoMap.has(k)) {
            catalogoMap.set(k, {
                modelo: r.modelo,
                familia: r.familia,
                es_serializado: !!r.es_serializado,
            });
        }
    }
    const catalogo: CatalogoItem[] = Array.from(catalogoMap.values());

    // Fetch approved families
    const { data: familiasRaw } = await db
        .from('familias_hardware')
        .select('id, nombre')
        .order('nombre', { ascending: true });

    const familias: FamiliaHardware[] = familiasRaw ?? [];

    // Fetch catalogo_equipos for the Catálogo Global modal (graceful if table doesn't exist)
    const { data: modelosRaw } = await db
        .from('catalogo_equipos')
        .select('id, familia_id, modelo, es_serializado')
        .order('modelo', { ascending: true });

    const modelosPorFamilia: Record<string, ModeloCatalogo[]> = {};
    for (const m of (modelosRaw ?? []) as ModeloCatalogo[]) {
        if (!modelosPorFamilia[m.familia_id]) modelosPorFamilia[m.familia_id] = [];
        modelosPorFamilia[m.familia_id].push(m);
    }

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
                    <CatalogoGlobalModal familias={familias} modelosPorFamilia={modelosPorFamilia} />
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
                        <p className="font-semibold text-sm">Esta bodega no tiene stock registrado</p>
                        <p className="text-xs mt-1">Usa "Añadir Equipo / Stock" para comenzar</p>
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
