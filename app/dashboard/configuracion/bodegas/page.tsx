import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { GestionBodegasClient } from './GestionBodegasClient';

export const metadata = {
    title: 'Gestión de Bodegas — Systel Loop',
    description: 'Administra las bodegas y locaciones de almacenamiento del sistema.',
};

export default async function BodegasConfigPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const { data: profile } = await supabase
        .from('profiles')
        .select('rol')
        .eq('id', user.id)
        .maybeSingle();

    if (profile?.rol?.toUpperCase() !== 'ADMIN') redirect('/dashboard/configuracion');

    const { data: bodegas, error } = await supabase
        .from('bodegas')
        .select('id, nombre, tipo, descripcion, activo')
        .eq('tipo', 'INTERNA')
        .order('nombre', { ascending: true });

    if (error) console.error('[BodegasConfigPage]', error.message);

    return <GestionBodegasClient bodegas={bodegas ?? []} />;
}
