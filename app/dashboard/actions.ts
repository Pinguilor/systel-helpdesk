'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function searchTicketByNumberAction(ticketNumber: number) {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return { error: 'No estás autenticado.' };
    }

    // Try to find the ticket by numero_ticket
    const { data: ticket, error } = await supabase
        .from('tickets')
        .select('id')
        .eq('numero_ticket', ticketNumber)
        .maybeSingle();

    if (error) {
        console.error('Error searching ticket', error);
        return { error: 'Error del servidor al buscar.' };
    }

    if (!ticket) {
        return { error: `No se encontró el ticket NC-${ticketNumber}` };
    }

    return { id: ticket.id };
}

export async function markNotificationReadAction(notificationId: string, shouldRevalidate: boolean = true) {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return { error: 'No estás autenticado.' };
    }

    const { error } = await supabase
        .from('notifications')
        .update({ leida: true })
        .eq('id', notificationId)
        .eq('user_id', user.id); // Security: only mark own notifications

    if (error) {
        console.error('Error marking notification read', error);
        return { error: 'Error al marcar la notificación como leída.' };
    }

    if (shouldRevalidate) {
        revalidatePath('/dashboard', 'layout'); // Revalidate the layout where the TopNav lives
    }

    return { success: true };
}

export async function markAllNotificationsReadAction() {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { error: 'No estás autenticado.' };

    await supabase
        .from('notifications')
        .update({ leida: true })
        .eq('user_id', user.id)
        .eq('leida', false);

    revalidatePath('/dashboard', 'layout');
    return { success: true };
}
