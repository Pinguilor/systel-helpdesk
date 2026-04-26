import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AdminTicketList } from './components/AdminTicketList';
import AgentAnalytics from './components/AgentAnalytics';
import { TicketsRealtimeListener } from '../components/TicketsRealtimeListener';

export default async function tecnicoDashboard() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    // Get true rol from database to avoid stale metadata
    const { data: profile } = await supabase
        .from('profiles')
        .select('rol, full_name')
        .eq('id', user.id)
        .maybeSingle();

    if (profile?.rol?.toUpperCase() !== 'TECNICO') {
        redirect('/dashboard/usuario');
    }

    // Fetch ONLY tickets assigned to this agent — clientes viene anidado a través de profiles.cliente_id
    const { data: tickets, error } = await supabase
        .from('tickets')
        .select(`
            *,
            profiles:creado_por(full_name, clientes:cliente_id(nombre_fantasia, razon_social)),
            restaurantes(nombre_restaurante, sigla),
            catalogo_servicios!catalogo_servicio_id(categoria, subcategoria, elemento),
            padre:ticket_padre_id(numero_ticket)
        `)
        .eq('agente_asignado_id', user.id)
        .order('fecha_creacion', { ascending: false });

    if (error) {
        console.error("Error al cargar todos los tickets para tecnico:", error.message);
    }

    return (
        <div className="max-w-7xl mx-auto py-4 md:py-8 px-0 sm:px-6 lg:px-8 space-y-4 md:space-y-8 min-h-screen">
            {/* Greeting */}
            <div className="px-4 sm:px-0">
                <p className="text-sm font-semibold text-slate-400 tracking-wide uppercase">Panel de Control</p>
                <h1 className="text-3xl font-extrabold text-slate-950 tracking-tight">
                    Hola, {profile?.full_name?.split(' ')[0] ?? 'Técnico'} 👋
                </h1>
            </div>

            {/* Agent Analytics Dashboard */}
            <div className="hidden md:block px-4 sm:px-0">
                <AgentAnalytics tickets={tickets || []} />
            </div>

            <div className="w-full">
                <TicketsRealtimeListener />
                <AdminTicketList initialTickets={tickets || []} currentAgentId={user.id} agentName={profile?.full_name} />
            </div>
        </div>
    )
}
