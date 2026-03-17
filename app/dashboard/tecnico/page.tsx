import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AdminTicketList } from './components/AdminTicketList';
import AgentAnalytics from './components/AgentAnalytics';

export default async function tecnicoDashboard() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    // Get true rol from database to avoid stale metadata
    const { data: profile } = await supabase
        .from('profiles')
        .select('rol')
        .eq('id', user.id)
        .maybeSingle();

    if (profile?.rol?.toUpperCase() !== 'TECNICO') {
        redirect('/dashboard/usuario');
    }

    // Fetch ONLY tickets assigned to this agent
    const { data: tickets, error } = await supabase
        .from('tickets')
        .select('*, profiles:creado_por(full_name), restaurantes(nombre_restaurante), catalogo_servicios(categoria, subcategoria, elemento)')
        .eq('agente_asignado_id', user.id)
        .order('fecha_creacion', { ascending: false });

    if (error) {
        console.error("Error al cargar todos los tickets para tecnico:", error.message);
    }

    return (
        <div className="max-w-7xl mx-auto py-8 sm:px-6 lg:px-8 space-y-8">
            {/* Agent Analytics Dashboard */}
            <AgentAnalytics tickets={tickets || []} />

            <div className="w-full">
                <AdminTicketList initialTickets={tickets || []} currentAgentId={user.id} />
            </div>
        </div>
    )
}
