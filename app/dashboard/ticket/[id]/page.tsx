import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import TicketTimeline from './components/TicketTimeline';
import TicketSidebar from './components/TicketSidebar';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const supabase = await createClient();

    // Auth Check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        redirect('/login');
    }

    // Unwrap params in Next.js 15+ 
    const unwrappedParams = await params;
    const ticketId = unwrappedParams.id;

    // Get User Role to handle permissions
    const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).maybeSingle();
    const isAgent = profile?.rol?.toUpperCase() === 'TECNICO';
    const isAdmin = profile?.rol?.toUpperCase() === 'ADMIN' || profile?.rol?.toUpperCase() === 'COORDINADOR';

    // Fetch the Ticket
    // We get the ticket itself, the requester's profile, and all messages with their respective sender profiles
    let query = supabase
        .from('tickets')
        .select(`
            *,
            profiles:creado_por (full_name),
            agente:agente_asignado_id (full_name),
            restaurantes (*),
            tipo_servicio:ticket_tipos_servicio (nombre),
            categoria:ticket_categorias (nombre),
            subcategoria:ticket_subcategorias (nombre),
            accion:ticket_acciones (nombre),
            ticket_messages (
                id,
                mensaje,
                creado_en,
                sender_id,
                adjuntos,
                es_sistema,
                es_interno,
                tipo_evento,
                profiles:sender_id (full_name, rol)
            )
        `)
        .eq('id', ticketId);

    if (!isAgent && !isAdmin) {
        query = query.neq('ticket_messages.es_interno', true);
    }

    const { data: ticket, error: ticketError } = await query.maybeSingle();

    if (ticketError) {
        console.error('--------------------------------');
        console.error('ERROR AL OBTENER TICKET:', ticketError);
        console.error('--------------------------------');
    }

    if (ticketError || !ticket) {
        // If ticket doesn't exist or RLS hides it
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-md w-full space-y-8 text-center bg-white p-10 rounded-xl shadow-sm border border-gray-200">
                    <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Ticket no encontrado</h2>
                    <p className="mt-2 text-sm text-gray-600">El ticket que buscas no existe o no tienes permiso para verlo.</p>
                    <Link href={isAgent ? '/dashboard/agente' : '/dashboard/solicitante'} className="mt-4 font-medium text-indigo-600 hover:text-indigo-500 inline-flex items-center">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Volver al Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    // Strict Security Check for Solicitante
    if (!isAgent && !isAdmin && ticket.creado_por !== user.id) {
        // A requester is trying to view a ticket they didn't create
        redirect('/dashboard/usuario');
    }

    let agents: any[] = [];
    let inventarioCentral: any[] = [];

    if (isAdmin) {
        const { data: agentsData } = await supabase.from('profiles').select('id, full_name').eq('rol', 'tecnico');
        if (agentsData) agents = agentsData;

        const { data: invData, error: invError } = await supabase
            .from('inventario')
            .select('*, catalogo_equipos(*), bodegas(*)');
            
        if (invError) {
            console.error('--------------------------------');
            console.error('ERROR AL OBTENER INVENTARIO CENTRAL:', invError);
            console.error('--------------------------------');
        }
            
        if (invData) {
            inventarioCentral = invData.filter(item => item.bodegas?.tipo?.toLowerCase() === 'central');
        }
    }

    // Sort messages chronologically (Supabase returns them usually unordered or by id if not specified)
    const sortedMessages = (ticket.ticket_messages || []).sort((a: any, b: any) =>
        new Date(a.creado_en).getTime() - new Date(b.creado_en).getTime()
    );

    // Fetch packing list (movimientos de inventario para este ticket)
    const { data: packingListRaw } = await supabase
        .from('movimientos_inventario')
        .select(`
            *,
            inventario (*)
        `)
        .eq('ticket_id', ticketId)
        .order('fecha_movimiento', { ascending: false });
    
    const packingList = packingListRaw || [];

    // Fetch child tickets
    const { data: childTicketsRaw } = await supabase
        .from('tickets')
        .select('id, numero_ticket, titulo, estado, descripcion, descripcion_editada')
        .eq('ticket_padre_id', ticketId)
        .order('fecha_creacion', { ascending: true });

    const childTickets = childTicketsRaw || [];

    // Fetch parent ticket if this is a child
    let parentTicket = null;
    if (ticket.ticket_padre_id) {
        const { data: pt } = await supabase
            .from('tickets')
            .select('id, numero_ticket, titulo')
            .eq('id', ticket.ticket_padre_id)
            .maybeSingle();
        parentTicket = pt || null;
    }

    // Fetch materiales asignados directamente (para PDF de cierre)
    const { data: inventarioTicketRaw, error: invTicketErr } = await supabase
        .from('inventario')
        .select('*')
        .eq('ticket_id', ticketId);
    
    if (invTicketErr) {
        console.error('ERROR AL OBTENER INVENTARIO TICKET:', invTicketErr);
    }
    
    const inventarioTicket = inventarioTicketRaw || [];

    return (
        <div className="py-6 w-full">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

                {/* Main Two-Column Layout */}
                <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">

                    {/* Left Column: Timeline & Chat */}
                    <div className="flex-1 min-w-0">
                        <TicketTimeline
                            ticket={ticket}
                            parentTicket={parentTicket}
                            messages={sortedMessages}
                            currentUserId={user.id}
                            isAgent={isAgent}
                            isAdmin={isAdmin}
                            packingList={packingList}
                            inventarioTicket={inventarioTicket}
                        />
                    </div>

                    {/* Right Column: Properties Sidebar */}
                    <div className="w-full lg:w-80 shrink-0">
                        <TicketSidebar
                            ticket={ticket}
                            isAgent={isAgent}
                            isAdmin={isAdmin}
                            agents={agents}
                            inventarioCentral={inventarioCentral}
                            packingList={packingList}
                            inventarioTicket={inventarioTicket}
                            childTickets={childTickets}
                        />
                    </div>

                </div>
            </div>
        </div>
    );
}
