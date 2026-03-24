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

    // Fetch Bodegas (Solo Central y Dañados)
    const { data: bodegasRaw } = await supabase
        .from('bodegas')
        .select('*')
        .order('tipo', { ascending: true });
        
    const bodegas = (bodegasRaw || []).filter(b => 
        ['CENTRAL', 'DAÑADOS'].includes(b.tipo?.toUpperCase() || '')
    );

    // Fetch Familias de Hardware
    const { data: familiasRaw } = await supabase
        .from('familias_hardware')
        .select('*')
        .order('nombre', { ascending: true });

    // Fetch Inventario + Bodegas Data
    const { data: inventarioRaw, error: inventarioError } = await supabase
        .from('inventario')
        .select('*, bodegas(*)');

    if (inventarioError) {
        console.error('Error fetching inventario:', inventarioError.message, inventarioError.details);
    }
    
    // Filtrar estrictamente el inventario para que NO incluya Mochilas ni Locales (Restaurantes)
    const inventarioGlobal = (inventarioRaw || []).filter(item => {
        const tipoBodega = item.bodegas?.tipo?.toUpperCase() || '';
        return ['CENTRAL', 'DAÑADOS'].includes(tipoBodega);
    });

    // Extraer nombres de equipos únicos para el combobox
    const equiposUnicosMap = new Map();
    (inventarioRaw || []).forEach(item => {
        if (item.modelo && item.familia) {
            const key = `${item.modelo}|${item.familia}`;
            if (!equiposUnicosMap.has(key)) {
                equiposUnicosMap.set(key, {
                    modelo: item.modelo,
                    familia: item.familia,
                    es_serializado: !!item.es_serializado
                });
            }
        }
    });
    const equiposUnicos = Array.from(equiposUnicosMap.values());

    return (
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
                        <Box className="w-8 h-8 text-indigo-600" />
                        Inventario Global
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">Supervisa y administra el inventario de la Bodega Central y Equipos Dañados.</p>
                </div>
                <div>
                    <AddStockModal 
                        bodegas={bodegas || []} 
                        inventario={inventarioGlobal as any || []} 
                        familias={familiasRaw || []}
                    />
                </div>
            </div>

            <BodegasTable 
                inventario={inventarioGlobal as any || []} 
                bodegasDisponibles={bodegas || []} 
            />
        </div>
    );
}
