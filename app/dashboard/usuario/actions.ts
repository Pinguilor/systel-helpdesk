'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { sendTicketCreatedEmail } from '@/lib/sendEmail';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const BUCKET_NAME = 'ticket-attachments';

export async function createTicketAction(formData: FormData) {
    const supabase = await createClient();

    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return { error: 'No estás autenticado.' };
    }

    // 2. Extract and validate textual data
    const titulo = formData.get('titulo') as string;
    const descripcion = formData.get('descripcion') as string;
    const prioridad = formData.get('prioridad') as 'baja' | 'media' | 'alta' | 'crítica';
    const restaurante_id = formData.get('restaurante_id') as string;
    const tipo_servicio_id = formData.get('tipo_servicio_id') as string;
    const categoria_id = formData.get('categoria_id') as string;
    const subcategoria_id = formData.get('subcategoria_id') as string;
    const accion_id = formData.get('accion_id') as string;
    const zona_id = formData.get('zona_id') as string | null;

    const adjuntos = formData.getAll('adjuntos') as File[];

    if (!titulo || !descripcion || !prioridad || !restaurante_id || !tipo_servicio_id || !categoria_id || !subcategoria_id || !accion_id) {
        return { error: 'Por favor completa todos los campos requeridos, incluyendo la clasificación completa de 4 niveles.' };
    }

    // Zone validation is optional now
    if (zona_id) {
        const { data: zonaExists } = await supabase.from('zonas').select('id').eq('id', zona_id).single();
        if (!zonaExists) return { error: 'La zona seleccionada no existe o no es válida.' };
    }

    if (adjuntos.length > 5) {
        return { error: 'Puedes subir un máximo de 5 adjuntos.' };
    }

    // Generate unique ticket uuid early so we can upload files to its specific folder
    const ticketId = crypto.randomUUID();
    const fileUrls: string[] = [];

    // 3. Process and upload files to Supabase Storage
    for (const file of adjuntos) {
        // Validate on the server as well
        if (file.size > MAX_FILE_SIZE) {
            return { error: `El archivo ${file.name} supera el límite de 5MB.` };
        }
        if (!ALLOWED_TYPES.includes(file.type)) {
            return { error: `El archivo ${file.name} tiene un tipo no permitido.` };
        }

        // Sanitize filename to prevent issues
        const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '');
        const timestamp = Date.now();
        const filePath = `${ticketId}/${timestamp}_${sanitizedFileName}`;

        const { error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(filePath, file);

        if (uploadError) {
            console.error('Storage upload error:', uploadError);
            return { error: `Error subiendo ${file.name}: ${uploadError.message}` };
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(filePath);

        fileUrls.push(publicUrl);
    }

    // 4. Insert database record (tickets table)
    const { error: insertError } = await supabase
        .from('tickets')
        .insert({
            id: ticketId,
            titulo,
            descripcion,
            prioridad,
            restaurante_id,
            tipo_servicio_id,
            categoria_id,
            subcategoria_id,
            accion_id,
            zona_id: zona_id || null,

            estado: 'esperando_agente', // Setting correct status as defined earlier
            creado_por: user.id, // Maps to user's profile ID
            adjuntos: fileUrls.length > 0 ? fileUrls : null,
        });

    if (insertError) {
        console.error('Database insert error:', insertError);
        return { error: `Error creando ticket: ${insertError.message}` };
    }

    // --- NOTIFICACIONES + EMAIL post-creación ---
    const [{ data: newTicket }, { data: profile }] = await Promise.all([
        supabase.from('tickets').select('numero_ticket').eq('id', ticketId).single(),
        supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
    ]);
    const creatorName = profile?.full_name || 'Usuario del Sistema';

    if (newTicket) {
        // Evento A: notificar a todos los ADMIN y COORDINADORES
        const { data: adminProfiles } = await supabase
            .from('profiles')
            .select('id')
            .in('rol', ['admin', 'coordinador']);

        const adminIds = [...new Set((adminProfiles ?? []).map((p: any) => p.id))];
        if (adminIds.length > 0) {
            const { sendInternalNotificationBatch } = await import('@/lib/notifications');
            await sendInternalNotificationBatch(
                adminIds,
                `🎟️ Nuevo Ticket: Se ha generado el ticket NC-${newTicket.numero_ticket}. Prioridad: ${prioridad}.`,
                ticketId
            );
        }

        // Correo transaccional (fire and forget)
        const adminEmail = process.env.ADMIN_EMAIL || 'no-reply@systelltda-helpdesk.cl';
        sendTicketCreatedEmail(ticketId, newTicket.numero_ticket, titulo, prioridad, creatorName, adminEmail)
            .catch(err => console.error('Fallo disparando email de creación:', err));
    }
    // -------------------------

    // Revalidate dashboard so the new ticket appears in the list and TopNav refreshes
    revalidatePath('/dashboard', 'layout');
    revalidatePath(`/dashboard/ticket/${ticketId}`);
    revalidatePath('/dashboard/usuario');
    return { success: true, id: ticketId };
}
export async function scheduleVisitAction(ticketId: string, visitDate: string, noteContent: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { error: 'No autorizado' };
    }

    // 1. Update the ticket status and date
    const { error: ticketError } = await supabase
        .from('tickets')
        .update({
            estado: 'programado',
            fecha_programada: visitDate,
            actualizado_en: new Date().toISOString()
        })
        .eq('id', ticketId);

    if (ticketError) {
        console.error('Error actualizando ticket:', ticketError);
        return { error: 'No se pudo actualizar el estado del ticket.' };
    }

    // 2. Insert the system message into the timeline with the "tipo_evento" label
    const { error: msgError } = await supabase
        .from('ticket_messages')
        .insert({
            ticket_id: ticketId,
            sender_id: user.id,
            mensaje: noteContent || 'El tecnico ha programado una visita técnica.',
            es_sistema: false, // Lo dejamos en false para que tu diseño azul lo tome
            tipo_evento: 'visita_programada' // <--- ESTA ES LA MAGIA
        });

    if (msgError) {
        console.error('Error insertando mensaje de visita:', msgError);
        return { error: 'Se programó la visita pero falló el registro en el historial.' };
    }

    revalidatePath(`/dashboard/ticket/${ticketId}`);
    return { success: true };
}
