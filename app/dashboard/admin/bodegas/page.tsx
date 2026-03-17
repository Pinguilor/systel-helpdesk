import { createClient } from '@/lib/supabase/server';
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

    if (profile?.rol?.toUpperCase() !== 'ADMIN' && profile?.rol?.toUpperCase() !== 'ADMIN_BODEGA') redirect('/dashboard/usuario');

    // Fetch Bodegas
    const { data: bodegas } = await supabase
        .from('bodegas')
        .select('*')
        .order('tipo', { ascending: true });

    // Fetch Inventario + Catalog + Bodegas Data
    const { data: inventarioRaw, error: inventarioError } = await supabase
        .from('inventario')
        .select('*, catalogo_equipos(*), bodegas(*)');

    if (inventarioError) {
        console.error('Error fetching inventario:', inventarioError.message, inventarioError.details);
    }

    return (
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
                        <Box className="w-8 h-8 text-indigo-600" />
                        Inventario Global
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">Supervisa y filtra el equipamiento central, equipos en tránsito y bodega de locales.</p>
                </div>
                <div>
                    <AddStockModal bodegas={bodegas || []} catalogo={Array.from(new Map(inventarioRaw?.filter(i => i.catalogo_equipos).map(item => [item.catalogo_equipos.id, item.catalogo_equipos])).values()) || []} />
                </div>
            </div>

            <BodegasTable 
                inventario={inventarioRaw as any || []} 
                bodegasDisponibles={bodegas || []} 
            />
        </div>
    );
}
