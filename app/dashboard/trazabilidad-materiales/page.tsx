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

    const rol       = profile?.rol?.toUpperCase() || '';
    const esCliente = rol === 'USUARIO';
    const esStaff   = STAFF_ROLES.includes(rol);

    if (!esStaff && !esCliente) {
        console.log('[TrazabilidadMateriales] Rol rechazado:', profile?.rol, '→ redirigiendo');
        redirect('/dashboard');
    }

    // Multi-tenant: para el rol USUARIO limitamos vía filtro en el join de ticket,
    // no con un array de IDs en la URL (evita HTTP 400 por URL demasiado larga).
    const clienteId: string | null = esCliente ? ((profile as any)?.cliente_id ?? null) : null;

    const supabaseAdmin = createAdminClient();

    try {
        // !inner: solo devuelve filas de inventario que tengan un ticket asociado.
        // El filtro de cliente (si aplica) se inyecta sobre el recurso embebido,
        // lo que genera un WHERE en SQL en lugar de un IN(...) en la URL.
        let query = supabaseAdmin
            .from('inventario')
            .select(`
                id,
                modelo,
                familia,
                cantidad,
                ticket:ticket_id!inner (
                    id,
                    numero_ticket,
                    titulo,
                    estado,
                    fecha_resolucion,
                    cliente_id,
                    creado_por,
                    agente:agente_asignado_id ( full_name ),
                    restaurantes ( sigla )
                )
            `)
            .eq('estado', 'Operativo')
            .not('ticket_id', 'is', null)
            .limit(2000);

        // Filtro multi-tenant estricto para USUARIO
        if (esCliente) {
            if (clienteId) {
                // Empresa asignada → todos los tickets de la empresa
                query = query.eq('ticket.cliente_id', clienteId);
            } else {
                // Sin empresa → solo los tickets propios del usuario
                query = query.eq('ticket.creado_por', user.id);
            }
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

        if (!rawData || rawData.length === 0) {
            return <ConsumoMaterialesClient rows={[]} tecnicos={[]} locales={[]} esCliente={esCliente} />;
        }

        const rows: ConsumoRow[] = [];
        for (const item of rawData as any[]) {
            const ticket = item.ticket;
            rows.push({
                inventarioId: item.id,
                nc:           ticket?.numero_ticket ? String(ticket.numero_ticket) : '—',
                ticketId:     ticket?.id ?? null,
                local:        ticket?.restaurantes?.sigla ?? ticket?.titulo ?? '—',
                localSigla:   ticket?.restaurantes?.sigla ?? '—',
                localTitulo:  ticket?.titulo ?? '—',
                fecha:        ticket?.fecha_resolucion ?? '',
                tecnico:      ticket?.agente?.full_name ?? '—',
                modelo:       item.modelo ?? '—',
                familia:      item.familia ?? '—',
                cantidad:     item.cantidad ?? 1,
                estadoTicket: ticket?.estado ?? '—',
            });
        }

        const tecnicos = [...new Set(rows.map(r => r.tecnico).filter(t => t !== '—'))].sort();
        const locales  = [...new Set(rows.map(r => r.local).filter(l => l !== '—'))].sort();

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
