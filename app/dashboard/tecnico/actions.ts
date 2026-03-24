'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { TicketStatus } from '@/types/database.types';

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
    const { error: updateError } = await supabase
        .from('tickets')
        .update(updatePayload)
        .eq('id', ticketId);

    if (updateError) {
        console.error('Error actualizando estado:', updateError);
        return { error: `Error al actualizar: ${updateError.message}` };
    }

    // Refresh the UI
    revalidatePath('/dashboard/tecnico');
    return { success: true };
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
