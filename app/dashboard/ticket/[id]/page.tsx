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
    const { data: profile } = await supabase.from('profiles').select('rol, cliente_id').eq('id', user.id).maybeSingle();
    const userRole = profile?.rol ?? 'usuario';
    const userClienteId = (profile as any)?.cliente_id ?? null;
    const isAgent = userRole.toUpperCase() === 'TECNICO';
    const isAdmin = userRole.toUpperCase() === 'ADMIN' || userRole.toUpperCase() === 'COORDINADOR';
    const isSystemelStaff = ['admin', 'tecnico', 'coordinador', 'admin_bodega'].includes(userRole);

    // Fetch the Ticket
    // We get the ticket itself, the requester's profile, and all messages with their respective sender profiles
    let query = supabase
        .from('tickets')
        .select(`
            *,
            profiles:creado_por (full_name, cliente_id),
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
    const ticketCreadorClienteId = (ticket.profiles as any)?.cliente_id ?? null;
    const mismaEmpresa = userClienteId !== null
        && ticketCreadorClienteId !== null
        && userClienteId === ticketCreadorClienteId;

    if (!isAgent && !isAdmin && ticket.creado_por !== user.id && !mismaEmpresa) {
        // A requester is trying to view a ticket they didn't create and is not from the same company
        redirect('/dashboard/usuario');
    }

    let agents: any[] = [];
    let inventarioCentral: any[] = [];

    // Agents needed by CloseTicketModal (técnico que cierra) y TicketSidebar (admin asigna)
    if (isAdmin || isAgent) {
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

    // Fetch packing list agrupada — solo para personal Systel (no clientes externos)
    // Muestra Solicitado a Bodega vs Insumido/Utilizado por producto.
    let packingList: { modelo: string; familia: string; solicitado: number; utilizado: number }[] = [];
    if (isSystemelStaff) {
        // 1. Ítems de solicitudes APROBADAS (intención)
        const { data: solicitudesRaw } = await supabase
            .from('solicitudes_materiales')
            .select('id')
            .eq('ticket_id', ticketId)
            .eq('estado', 'aprobada');

        const solicitudIds = (solicitudesRaw ?? []).map((s: any) => s.id);

        let solicitudItems: any[] = [];
        if (solicitudIds.length > 0) {
            const { data: siRaw } = await supabase
                .from('solicitud_items')
                .select('cantidad, inventario:inventario_id(modelo, familia)')
                .in('solicitud_id', solicitudIds);
            solicitudItems = siRaw ?? [];
        }

        // 2. Ítems realmente consumidos por el técnico desde la mochila.
        // Estado canónico: 'Operativo' (tanto durante el ticket abierto como después del cierre).
        // ticket_id se preserva en ambos casos para poder rastrearlos.
        const { data: consumidos } = await supabase
            .from('inventario')
            .select('modelo, familia, cantidad')
            .eq('ticket_id', ticketId)
            .eq('estado', 'Operativo');

        // 3. Agrupar por producto
        const map: Record<string, { modelo: string; familia: string; solicitado: number; utilizado: number }> = {};

        for (const si of solicitudItems) {
            const inv = (si as any).inventario;
            if (!inv) continue;
            const key = `${inv.modelo}|${inv.familia}`;
            if (!map[key]) map[key] = { modelo: inv.modelo, familia: inv.familia, solicitado: 0, utilizado: 0 };
            map[key].solicitado += (si as any).cantidad ?? 0;
        }

        for (const c of (consumidos ?? [])) {
            const key = `${(c as any).modelo}|${(c as any).familia}`;
            if (!map[key]) map[key] = { modelo: (c as any).modelo, familia: (c as any).familia, solicitado: 0, utilizado: 0 };
            map[key].utilizado += (c as any).cantidad ?? 0;
        }

        packingList = Object.values(map).sort((a, b) => a.modelo.localeCompare(b.modelo));
    }

    // Fetch nombres de técnicos ayudantes si el ticket los tiene
    let ayudantesInfo: { id: string; full_name: string }[] = [];
    const ayudantesIds: string[] = (ticket as any).ayudantes ?? [];
    if (ayudantesIds.length > 0) {
        const { data: ayudantesData } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', ayudantesIds);
        ayudantesInfo = ayudantesData ?? [];
    }

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

    // Fetch SOLO los materiales consumidos (estado 'Operativo' + ticket_id) — para preview del Acta de Cierre.
    // Los ítems aprobados pero no consumidos (sobrantes, estado Disponible) NO aparecen aquí.
    const { data: inventarioTicketRaw, error: invTicketErr } = await supabase
        .from('inventario')
        .select('*')
        .eq('ticket_id', ticketId)
        .eq('estado', 'Operativo');

    if (invTicketErr) {
        console.error('ERROR AL OBTENER INVENTARIO TICKET:', invTicketErr);
    }

    const inventarioTicket = inventarioTicketRaw || [];

    return (
        <div className="py-6 w-full">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

                {/* Main Two-Column Layout */}
                <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 lg:items-start">

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
                            ayudantesNombres={ayudantesInfo.map(a => a.full_name)}
                        />
                    </div>

                    {/* Right Column: Properties Sidebar */}
                    <div className="w-full lg:w-80 shrink-0 lg:sticky lg:top-6">
                        <TicketSidebar
                            ticket={ticket}
                            isAgent={isAgent}
                            isAdmin={isAdmin}
                            userRole={userRole}
                            currentUserId={user.id}
                            agents={agents}
                            ayudantesInfo={ayudantesInfo}
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
