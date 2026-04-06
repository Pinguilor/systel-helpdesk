import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import { ConsumoMaterialesClient } from './ConsumoMaterialesClient';
import type { ConsumoRow } from './types';

export const dynamic = 'force-dynamic';
export type { ConsumoRow };

const STAFF_ROLES = ['ADMIN', 'COORDINADOR', 'ADMIN_BODEGA'];

export default async function TrazabilidadMaterialesPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const { data: profile } = await supabase
        .from('profiles')
        .select('rol, cliente_id')
        .eq('id', user.id)
        .maybeSingle();

    const rol = profile?.rol?.toUpperCase() || '';
    const esCliente = rol === 'USUARIO';
    const esStaff   = STAFF_ROLES.includes(rol);

    if (!esStaff && !esCliente) {
        console.log('[TrazabilidadMateriales] Rol rechazado:', profile?.rol, '→ redirigiendo');
        redirect('/dashboard');
    }

    // ── Para clientes: filtro multi-tenant por empresa ──────────────────────
    //
    // La relación en BD es:
    //   profiles.cliente_id  (empresa del usuario logueado)
    //     → profiles.id      (todos los usuarios de la misma empresa)
    //       → tickets.creado_por
    //         → solicitudes_materiales.ticket_id
    //
    // Este es el mismo patrón que usa TicketList.tsx (scope 'equipo').
    // NOTA: restaurantes NO tiene columna cliente_id → no usar ese camino.
    //
    let clienteTicketIds: string[] | null = null;

    if (esCliente) {
        const clienteId = (profile as any)?.cliente_id ?? null;

        if (!clienteId) {
            // Usuario sin empresa asignada → solo sus propios tickets
            const { data: ownTickets } = await supabase
                .from('tickets')
                .select('id')
                .eq('creado_por', user.id);
            clienteTicketIds = (ownTickets ?? []).map((t: any) => t.id);
        } else {
            // 1. Todos los usuarios de la misma empresa
            const { data: companyProfiles } = await supabase
                .from('profiles')
                .select('id')
                .eq('cliente_id', clienteId);
            const userIds = (companyProfiles ?? []).map((p: any) => p.id);

            if (userIds.length === 0) {
                return <ConsumoMaterialesClient rows={[]} tecnicos={[]} locales={[]} esCliente={true} />;
            }

            // 2. Tickets creados por esos usuarios
            const { data: companyTickets } = await supabase
                .from('tickets')
                .select('id')
                .in('creado_por', userIds);
            clienteTicketIds = (companyTickets ?? []).map((t: any) => t.id);
        }

        if (clienteTicketIds !== null && clienteTicketIds.length === 0) {
            return <ConsumoMaterialesClient rows={[]} tecnicos={[]} locales={[]} esCliente={true} />;
        }
    }

    // ── Consulta principal ───────────────────────────────────────────────────
    // Usamos el admin client (service role) para bypassear RLS.
    // La seguridad multi-tenant se aplica en código: el filtro ticket_id garantiza
    // que cada rol solo ve sus propios datos.
    const supabaseAdmin = createAdminClient();

    try {
        let query = supabaseAdmin
            .from('solicitudes_materiales')
            .select(`
                id,
                estado,
                creado_en,
                tecnico:tecnico_id ( full_name ),
                ticket:ticket_id ( id, numero_ticket, titulo, estado, restaurantes ( sigla ) ),
                solicitud_items (
                    id,
                    cantidad,
                    inventario:inventario_id (
                        id, modelo, familia, numero_serie, es_serializado
                    )
                )
            `)
            .order('creado_en', { ascending: false })
            .limit(2000);

        // Filtro estricto: clientes solo ven solicitudes de sus tickets
        if (esCliente && clienteTicketIds !== null) {
            query = query.in('ticket_id', clienteTicketIds);
        }

        const { data: rawData, error } = await query;

        if (error) {
            console.error('[TrazabilidadMateriales] DB error:', error);
            return (
                <div className="max-w-xl mx-auto mt-20 p-6 bg-red-50 border border-red-200 rounded-2xl text-red-700">
                    <p className="font-black text-sm uppercase tracking-widest mb-2">Error al cargar datos</p>
                    <p className="text-sm font-mono">{error.message}</p>
                    <p className="text-xs text-red-500 mt-2">Revisa la consola del servidor para más detalles.</p>
                </div>
            );
        }

        const rows: ConsumoRow[] = [];
        for (const sol of (rawData ?? []) as any[]) {
            for (const item of sol.solicitud_items ?? []) {
                rows.push({
                    solicitudId: sol.id,
                    nc: sol.ticket?.numero_ticket ? String(sol.ticket.numero_ticket) : '—',
                    ticketId: sol.ticket?.id ?? null,
                    local: sol.ticket?.restaurantes?.sigla ?? sol.ticket?.titulo ?? '—',
                    localSigla: sol.ticket?.restaurantes?.sigla ?? '—',
                    localTitulo: sol.ticket?.titulo ?? '—',
                    fecha: sol.creado_en,
                    tecnico: sol.tecnico?.full_name ?? '—',
                    modelo: item.inventario?.modelo ?? '—',
                    familia: item.inventario?.familia ?? '—',
                    cantidad: item.cantidad ?? 1,
                    estadoSolicitud: sol.estado ?? '—',
                    estadoTicket: sol.ticket?.estado ?? '—',
                });
            }
        }

        const tecnicos = [...new Set(rows.map(r => r.tecnico).filter(t => t !== '—'))].sort();
        const locales = [...new Set(rows.map(r => r.local).filter(l => l !== '—'))].sort();

        return (
            <ConsumoMaterialesClient
                rows={rows}
                tecnicos={tecnicos}
                locales={locales}
                esCliente={esCliente}
            />
        );
    } catch (err: any) {
        console.error('[TrazabilidadMateriales] Error fatal:', err);
        return (
            <div className="max-w-xl mx-auto mt-20 p-6 bg-red-50 border border-red-200 rounded-2xl text-red-700">
                <p className="font-black text-sm uppercase tracking-widest mb-2">Error fatal al cargar la vista</p>
                <p className="text-sm font-mono">{err?.message ?? String(err)}</p>
                <p className="text-xs text-red-500 mt-2">Revisa la consola del servidor para más detalles.</p>
            </div>
        );
    }
}
