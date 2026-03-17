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
