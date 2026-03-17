import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AdminTicketList } from '../tecnico/components/AdminTicketList';

export default async function AdminDashboard() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('rol')
        .eq('id', user.id)
        .maybeSingle();

    if (profile?.rol?.toUpperCase() !== 'ADMIN' && profile?.rol?.toUpperCase() !== 'COORDINADOR') {
        redirect(profile?.rol?.toUpperCase() === 'TECNICO' ? '/dashboard/tecnico' : '/dashboard/usuario');
    }

    // Fetch ALL tickets for Admin
    const { data: tickets, error } = await supabase
        .from('tickets')
        .select('*, profiles:creado_por(full_name), restaurantes(nombre_restaurante), catalogo_servicios(categoria, subcategoria, elemento)')
        .order('fecha_creacion', { ascending: false });

    if (error) {
        console.error("Error al cargar todos los tickets para admin:", error.message);
    }

    return (
        <div className="max-w-7xl mx-auto py-8 sm:px-6 lg:px-8 space-y-8">
            <h1 className="text-3xl font-black text-slate-900 px-4 sm:px-0">Panel del Administrador</h1>
            <div className="w-full">
                <AdminTicketList initialTickets={tickets || []} currentAgentId={user.id} />
            </div>
        </div>
    )
}
