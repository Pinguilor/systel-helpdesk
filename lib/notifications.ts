'use server';

/**
 * Utilidad centralizada para notificaciones internas.
 *
 * Usa el Service Role Client para bypassear RLS y poder insertar notificaciones
 * con user_id de otros usuarios (admins, técnicos, creadores de tickets).
 *
 * Esquema tabla `notifications`:
 *   user_id   UUID  — destinatario
 *   ticket_id UUID  — ticket de referencia
 *   mensaje   TEXT  — texto de la notificación
 *   leida     BOOL  — false por defecto
 *   creado_en TIMESTAMPTZ — auto
 */

import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';

function getAdminClient() {
    return createSupabaseAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

/**
 * Inserta UNA notificación para un destinatario.
 * Fallo silencioso: nunca bloquea la operación principal.
 */
export async function sendInternalNotification(
    userId: string,
    mensaje: string,
    ticketId: string
): Promise<void> {
    try {
        const admin = getAdminClient();
        const { error } = await admin.from('notifications').insert({
            user_id:   userId,
            ticket_id: ticketId,
            mensaje,
            leida:     false,
        });
        if (error) {
            console.error(`[notifications] Error insertando para user ${userId}:`, error.message);
        }
    } catch (e: any) {
        console.error('[notifications] Excepción inesperada:', e?.message ?? e);
    }
}

/**
 * Inserta notificaciones en lote para múltiples destinatarios.
 * Usa un solo INSERT para minimizar round-trips.
 */
export async function sendInternalNotificationBatch(
    userIds: string[],
    mensaje: string,
    ticketId: string
): Promise<void> {
    if (!userIds.length) return;
    try {
        const admin = getAdminClient();
        const rows = userIds.map(uid => ({
            user_id:   uid,
            ticket_id: ticketId,
            mensaje,
            leida:     false,
        }));
        const { error } = await admin.from('notifications').insert(rows);
        if (error) {
            console.error('[notifications] Error en batch insert:', error.message);
        }
    } catch (e: any) {
        console.error('[notifications] Excepción en batch insert:', e?.message ?? e);
    }
}
