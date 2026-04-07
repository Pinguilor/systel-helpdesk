'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { TicketStatus } from '@/types/database.types';

// ─── Types for grouped mochila view ──────────────────────────────────────────
export interface ItemMochila {
    id: string;
    modelo: string;
    familia: string;
    es_serializado: boolean;
    numero_serie: string | null;
    cantidad: number;
    tiene_devolucion_pendiente: boolean;
    fecha_limite_devolucion: string | null; // ISO timestamp; null = sin plazo activo
}

export interface GrupoTicket {
    ticket_id: string | null;
    numero_ticket: string | null;
    titulo: string | null;
    items: ItemMochila[];
}

export async function updateTicketStatusAction(
    ticketId: string,
    newStatus: TicketStatus,
    agentResponse?: string
) {
    const supabase = await createClient();

    // Ensure user is authenticated and has tecnico rol before allowing update
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return { error: 'No estás autenticado.' };
    }

    // Double check authorization
    if (user.user_metadata?.rol !== 'tecnico') {
        return { error: 'No tienes permisos para realizar esta acción.' };
    }

    // Build the update payload
    const updatePayload: any = { estado: newStatus };

    if (newStatus === 'resuelto' && agentResponse) {
        updatePayload.respuesta_agente = agentResponse;
        updatePayload.fecha_resolucion = new Date().toISOString();
    }

    // Update the status
    const { data: updatedTicket, error: updateError } = await supabase
        .from('tickets')
        .update(updatePayload)
        .eq('id', ticketId)
        .select('numero_ticket, creado_por')
        .single();

    if (updateError) {
        console.error('Error actualizando estado:', updateError);
        return { error: `Error al actualizar: ${updateError.message}` };
    }

    // Notificar al creador por cambio de estado (excluir cerrado — tiene su propio evento)
    if (
        updatedTicket &&
        !['cerrado', 'esperando_agente'].includes(newStatus) &&
        updatedTicket.creado_por &&
        updatedTicket.creado_por !== user.id
    ) {
        const ESTADO_LABELS: Record<string, string> = {
            abierto:     'Abierto',
            pendiente:   'Pendiente',
            en_progreso: 'En Progreso',
            resuelto:    'Resuelto',
            programado:  'Programado',
            anulado:     'Anulado',
        };
        const estadoLabel = ESTADO_LABELS[newStatus] ?? newStatus.replace(/_/g, ' ');
        const { sendInternalNotification } = await import('@/lib/notifications');
        await sendInternalNotification(
            updatedTicket.creado_por,
            `🔄 Actualización de estado: Tu ticket NC-${updatedTicket.numero_ticket} ahora se encuentra en estado "${estadoLabel}".`,
            ticketId
        );
    }

    // Refresh the UI
    revalidatePath('/dashboard/tecnico');
    return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mochila agrupada por ticket (nueva vista)
// ─────────────────────────────────────────────────────────────────────────────
export async function getTechnicianMochilaGroupedAction(): Promise<
    { grupos: GrupoTicket[]; mochilaNombre: string; mochilaId: string } | { error: string }
> {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return { error: 'No estás autenticado.' };

        const { data: mochila, error: mochilaError } = await supabase
            .from('bodegas')
            .select('id, nombre')
            .eq('tecnico_id', user.id)
            .ilike('tipo', 'MOCHILA')
            .maybeSingle();

        if (mochilaError) throw new Error(mochilaError.message);
        if (!mochila) return { error: 'NO_MOCHILA' };

        // Leer ticket_id directamente desde el row de inventario (fuente primaria post-patch)
        const { data: inventario, error: invError } = await supabase
            .from('inventario')
            .select('id, modelo, familia, es_serializado, numero_serie, cantidad, ticket_id, fecha_limite_devolucion')
            .eq('bodega_id', mochila.id)
            .gt('cantidad', 0);

        if (invError) throw new Error(invError.message);

        if (!inventario || inventario.length === 0) {
            return { grupos: [], mochilaNombre: mochila.nombre, mochilaId: mochila.id };
        }

        const invIds = inventario.map(i => i.id);

        // Recopilar todos los ticket_id únicos (directos + vía movimientos)
        const directTicketIds = [
            ...new Set(inventario.map(i => (i as any).ticket_id).filter(Boolean) as string[]),
        ];

        // Movimientos → fallback para ítems cuyo row de inventario no tiene ticket_id
        // (stock previo al patch del RPC)
        const { data: movimientos } = await supabase
            .from('movimientos_inventario')
            .select('inventario_id, ticket_id, tickets:ticket_id ( numero_ticket, titulo )')
            .in('inventario_id', invIds)
            .eq('bodega_destino_id', mochila.id)
            .order('fecha_movimiento', { ascending: false });

        // Mapa ticket_id → info, construido desde movimientos
        const ticketInfoById: Record<string, { numero_ticket: string | null; titulo: string | null }> = {};
        const itemMovTicketMap: Record<string, { ticket_id: string | null; numero_ticket: string | null; titulo: string | null }> = {};

        for (const mov of movimientos || []) {
            const m = mov as any;
            if (m.ticket_id && !ticketInfoById[m.ticket_id]) {
                ticketInfoById[m.ticket_id] = {
                    numero_ticket: m.tickets?.numero_ticket?.toString() ?? null,
                    titulo:        m.tickets?.titulo ?? null,
                };
            }
            if (!itemMovTicketMap[m.inventario_id]) {
                itemMovTicketMap[m.inventario_id] = {
                    ticket_id:     m.ticket_id ?? null,
                    numero_ticket: m.tickets?.numero_ticket?.toString() ?? null,
                    titulo:        m.tickets?.titulo ?? null,
                };
            }
        }

        // Para ticket_ids directos que no aparecen en movimientos, consultar tickets
        const missingIds = directTicketIds.filter(id => !ticketInfoById[id]);
        if (missingIds.length > 0) {
            const { data: extraTickets } = await supabase
                .from('tickets')
                .select('id, numero_ticket, titulo')
                .in('id', missingIds);
            for (const t of extraTickets || []) {
                ticketInfoById[(t as any).id] = {
                    numero_ticket: (t as any).numero_ticket?.toString() ?? null,
                    titulo:        (t as any).titulo ?? null,
                };
            }
        }

        // Solicitudes de devolución pendientes del técnico
        const { data: devsPendientes } = await supabase
            .from('solicitudes_devoluciones')
            .select('inventario_id')
            .eq('tecnico_id', user.id)
            .eq('estado', 'pendiente');

        const pendingSet = new Set((devsPendientes || []).map((d: any) => d.inventario_id));

        // Agrupar por ticket_id
        // Prioridad: ticket_id en el row de inventario → movimientos → sin_ticket
        const gruposMap: Record<string, GrupoTicket> = {};
        for (const item of inventario) {
            const directTid = (item as any).ticket_id as string | null ?? null;

            let groupKey: string;
            let groupTicketId: string | null;
            let groupNumero: string | null;
            let groupTitulo: string | null;

            if (directTid) {
                // Post-patch: ticket_id viene directo del row de inventario
                const info = ticketInfoById[directTid];
                groupKey      = directTid;
                groupTicketId = directTid;
                groupNumero   = info?.numero_ticket ?? null;
                groupTitulo   = info?.titulo ?? null;
            } else {
                // Backwards-compat: buscar en movimientos
                const movInfo = itemMovTicketMap[item.id];
                groupKey      = movInfo?.ticket_id ?? 'sin_ticket';
                groupTicketId = movInfo?.ticket_id ?? null;
                groupNumero   = movInfo?.numero_ticket ?? null;
                groupTitulo   = movInfo?.titulo ?? null;
            }

            if (!gruposMap[groupKey]) {
                gruposMap[groupKey] = {
                    ticket_id:     groupTicketId,
                    numero_ticket: groupNumero,
                    titulo:        groupTitulo,
                    items: [],
                };
            }
            gruposMap[groupKey].items.push({
                id:                         item.id,
                modelo:                     item.modelo,
                familia:                    item.familia,
                es_serializado:             item.es_serializado,
                numero_serie:               item.numero_serie ?? null,
                cantidad:                   item.cantidad,
                tiene_devolucion_pendiente: pendingSet.has(item.id),
                fecha_limite_devolucion:    (item as any).fecha_limite_devolucion ?? null,
            });
        }

        // Tickets primero (ordenados), luego sin_ticket al final
        const grupos = Object.values(gruposMap).sort((a, b) => {
            if (a.ticket_id === null) return 1;
            if (b.ticket_id === null) return -1;
            return (b.numero_ticket ?? '').localeCompare(a.numero_ticket ?? '');
        });

        return { grupos, mochilaNombre: mochila.nombre, mochilaId: mochila.id };
    } catch (e: any) {
        return { error: e.message || 'Error interno al cargar la mochila.' };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Solicitar devolución de material (desde técnico)
// ─────────────────────────────────────────────────────────────────────────────
export async function solicitarDevolucionAction(
    ticketId: string | null,
    inventarioId: string,
    cantidad: number,
    motivo: string
): Promise<{ success: true } | { error: string }> {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return { error: 'No estás autenticado.' };

        // Verificar que no haya una solicitud pendiente para el mismo ítem
        const { data: existente } = await supabase
            .from('solicitudes_devoluciones')
            .select('id')
            .eq('tecnico_id', user.id)
            .eq('inventario_id', inventarioId)
            .eq('estado', 'pendiente')
            .maybeSingle();

        if (existente) return { error: 'Ya existe una solicitud pendiente para este material.' };

        // Validar stock
        const { data: inv } = await supabase
            .from('inventario')
            .select('cantidad, es_serializado')
            .eq('id', inventarioId)
            .maybeSingle();

        if (!inv) return { error: 'Material no encontrado.' };
        if (cantidad < 1) return { error: 'La cantidad debe ser al menos 1.' };
        if (!inv.es_serializado && cantidad > inv.cantidad) {
            return { error: `Stock insuficiente. Disponible: ${inv.cantidad}.` };
        }

        const { error: insertErr } = await supabase
            .from('solicitudes_devoluciones')
            .insert({
                tecnico_id:   user.id,
                ticket_id:    ticketId ?? null,
                inventario_id: inventarioId,
                cantidad,
                motivo:       motivo.trim() || null,
                estado:       'pendiente',
            });

        if (insertErr) throw new Error(insertErr.message);

        revalidatePath('/dashboard/tecnico/mochila');
        return { success: true };
    } catch (e: any) {
        return { error: e.message || 'Error al solicitar la devolución.' };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Verificar si el técnico tiene mora vencida (bloqueo para nuevas solicitudes)
// ─────────────────────────────────────────────────────────────────────────────
export async function checkTecnicoBlockedAction(): Promise<
    { blocked: false } | { blocked: true; motivo: string }
> {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return { blocked: false };

        const { data: mochila } = await supabase
            .from('bodegas')
            .select('id')
            .eq('tecnico_id', user.id)
            .ilike('tipo', 'MOCHILA')
            .maybeSingle();

        if (!mochila) return { blocked: false };

        const ahora = new Date().toISOString();
        const { data: vencidos } = await supabase
            .from('inventario')
            .select('id')
            .eq('bodega_id', mochila.id)
            .not('fecha_limite_devolucion', 'is', null)
            .lt('fecha_limite_devolucion', ahora)
            .gt('cantidad', 0)
            // Excluir ítems ya consumidos (En Tránsito) — no son sobrantes
            .not('estado', 'in', '("En Tránsito","en_transito","En Transito")')
            .limit(1);

        if (vencidos && vencidos.length > 0) {
            return {
                blocked: true,
                motivo: 'Tienes materiales sobrantes con más de 72 horas sin devolver. Por favor, regulariza tu mochila o contacta a bodega.',
            };
        }
        return { blocked: false };
    } catch {
        return { blocked: false };
    }
}

export async function getTechnicianMochilaAction() {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return { error: 'No estás autenticado.' };
        }

        // 1. Obtener la mochila del técnico
        const { data: mochila, error: mochilaError } = await supabase
            .from('bodegas')
            .select('id, nombre')
            .eq('tecnico_id', user.id)
            .ilike('tipo', 'MOCHILA')
            .maybeSingle();

        if (mochilaError) throw new Error(`Error al buscar mochila: ${mochilaError.message}`);
        if (!mochila) return { data: [], mochilaNombre: null };

        // 2. Obtener el inventario de la mochila
        const { data: inventario, error: invError } = await supabase
            .from('inventario')
            .select('*')
            .eq('bodega_id', mochila.id)
            .gt('cantidad', 0)
            .order('familia', { ascending: true })
            .order('modelo', { ascending: true });

        if (invError) throw new Error(`Error al cargar inventario: ${invError.message}`);

        return { data: inventario || [], mochilaNombre: mochila.nombre };
    } catch (e: any) {
        return { error: e.message || 'Error interno al cargar la mochila.' };
    }
}
