'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { TicketStatus } from '@/types/database.types';
import { sendTicketResolvedEmail } from '@/lib/sendEmail';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const BUCKET_NAME = 'ticket-attachments';

export async function addTicketMessageAction(formData: FormData) {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return { error: 'No estás autenticado.' };
    }

    const ticketId = formData.get('ticketId') as string;
    const message = formData.get('message') as string;
    const resolveTicket = formData.get('resolveTicket') === 'true';
    const esInterno = formData.get('esInterno') === 'true';
    const rawMessyText = message.replace(/(<([^>]+)>)/gi, "").trim();
    const adjuntos = formData.getAll('adjuntos') as File[];

    if (!ticketId || (!rawMessyText && adjuntos.length === 0)) {
        return { error: 'El mensaje no puede estar vacío si no hay adjuntos.' };
    }

    if (adjuntos.length > 5) {
        return { error: 'Puedes subir un máximo de 5 adjuntos por mensaje.' };
    }

    const fileUrls: string[] = [];

    // Process and upload files
    for (const file of adjuntos) {
        if (file.size > MAX_FILE_SIZE) {
            return { error: `El archivo ${file.name} supera el límite de 5MB.` };
        }
        if (!ALLOWED_TYPES.includes(file.type)) {
            return { error: `El archivo ${file.name} tiene un tipo no permitido.` };
        }

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

        const { data: { publicUrl } } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(filePath);

        fileUrls.push(publicUrl);
    }

    const { error } = await supabase
        .from('ticket_messages')
        .insert({
            ticket_id: ticketId,
            sender_id: user.id,
            mensaje: message,
            adjuntos: fileUrls.length > 0 ? fileUrls : null,
            es_interno: esInterno,
        });

    if (error) {
        console.error('Error adding message:', error);
        return { error: 'Error interno al enviar el mensaje.' };
    }

    if (resolveTicket) {
        const { error: updateError } = await supabase
            .from('tickets')
            .update({ estado: 'resuelto', fecha_resolucion: new Date().toISOString() })
            .eq('id', ticketId)
            .select() // Ensures execution completion
            .single();

        if (updateError) {
            console.error('Error auto-resolving ticket:', updateError);
            return { error: `Mensaje enviado, pero falló la reasignación de estado a Resuelto: ${updateError.message}` };
        }
    }

    // --- NOTIFICATION LOGIC ---
    // Fetch the ticket to see who created it
    const { data: ticket } = await supabase
        .from('tickets')
        .select('creado_por, numero_ticket')
        .eq('id', ticketId)
        .single();

    if (ticket && ticket.creado_por !== user.id) {
        // If the sender is not the creator, they are an agent answering the requester.
        // Insert a notification for the requester.
        await supabase.from('notifications').insert({
            user_id: ticket.creado_por,
            ticket_id: ticketId,
            mensaje: `El agente ha respondido a tu solicitud NC-${ticket.numero_ticket}`,
            leida: false
        });
    }
    // -------------------------

    revalidatePath(`/dashboard/ticket/${ticketId}`);
    revalidatePath('/dashboard/ticket/[id]', 'page');
    revalidatePath('/dashboard/solicitante');
    revalidatePath('/dashboard/agente');
    return { success: true };
}

export async function updateTicketPropertiesAction(ticketId: string, updates: { estado?: TicketStatus, prioridad?: string, agente_asignado_id?: string | null, vencimiento_sla?: string | null }) {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return { error: 'No estás autenticado.' };
    }

    // Agents and Admins can update properties
    const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).maybeSingle();

    if (profile?.rol?.toUpperCase() !== 'TECNICO' && profile?.rol?.toUpperCase() !== 'ADMIN' && profile?.rol?.toUpperCase() !== 'COORDINADOR') {
        return { error: 'No tienes permisos para realizar esta acción.' };
    }

    if (Object.keys(updates).length === 0) return { success: true };

    if (updates.estado === 'esperando_agente') {
        updates.agente_asignado_id = null;
    }

    if (updates.prioridad) {
        const { data: ticketData } = await supabase.from('tickets').select('fecha_creacion').eq('id', ticketId).single();
        if (ticketData) {
            const creacion = new Date(ticketData.fecha_creacion);
            let horasSla = 72; // Baja Default
            switch (updates.prioridad) {
                case 'crítica': horasSla = 4; break;
                case 'alta': horasSla = 24; break;
                case 'media': horasSla = 48; break;
            }
            creacion.setHours(creacion.getHours() + horasSla);
            updates.vencimiento_sla = creacion.toISOString();
        }
    }

    const { data: updatedTicket, error } = await supabase
        .from('tickets')
        .update(updates)
        .eq('id', ticketId)
        .select()
        .single();

    if (error || !updatedTicket) {
        console.error('Error updating ticket properties:', error);
        return { error: 'Error interno: La base de datos denegó la actualización de las propiedades (Posible bloqueo de RLS o fila nula).' };
    }

    let systemMessage = '';
    if (updates.estado === 'esperando_agente') {
        systemMessage = 'El ticket ha sido liberado y está esperando asignación.';
    } else if (updates.agente_asignado_id) {
        const { data: assignedAgent } = await supabase.from('profiles').select('full_name').eq('id', updates.agente_asignado_id).single();
        if (assignedAgent) {
            systemMessage = `Se ha asignado el agente: ${assignedAgent.full_name}`;
        }
    } else if (updates.estado) {
        const estadoLabel = updates.estado.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
        systemMessage = `Estado cambiado a ${estadoLabel}.`;
    } else if (updates.prioridad) {
        const prioridadLabel = updates.prioridad.replace(/\b\w/g, l => l.toUpperCase());
        systemMessage = `Prioridad cambiada a ${prioridadLabel}.`;
    }

    if (systemMessage) {
        await supabase.from('ticket_messages').insert({
            ticket_id: ticketId,
            sender_id: user.id,
            mensaje: systemMessage,
            es_sistema: true
        });
    }

    revalidatePath(`/dashboard/ticket/${ticketId}`);
    // Also revalidate the agente table just in case
    revalidatePath('/dashboard/agente');
    return { success: true };
}

export async function assignTicketToMeAction(ticketId: string) {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return { error: 'No estás autenticado.' };
    }

    // Only agents can self-assign
    const { data: profile } = await supabase.from('profiles').select('rol, full_name').eq('id', user.id).maybeSingle();

    if (profile?.rol?.toUpperCase() !== 'TECNICO') {
        return { error: 'Solo los agentes pueden asignarse tickets.' };
    }

    // Update the ticket to assign the agent and change state to abierto
    const { error } = await supabase
        .from('tickets')
        .update({
            agente_asignado_id: user.id,
            estado: 'abierto'
        })
        .eq('id', ticketId);

    if (error) {
        console.error('Error assigning ticket:', error);
        return { error: 'Fallo al intentar asignarte el ticket.' };
    }

    // Record Audit Trail Message
    await supabase.from('ticket_messages').insert({
        ticket_id: ticketId,
        sender_id: user.id,
        mensaje: `El agente ${profile.full_name || 'Desconocido'} se ha asignado este ticket.`,
        es_sistema: true
    });

    revalidatePath(`/dashboard/ticket/${ticketId}`);
    revalidatePath('/dashboard/agente');
    return { success: true };
}

export async function approveResolutionAction(ticketId: string, calificacion: number, feedback: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'No autorizado' };

    const { error } = await supabase
        .from('tickets')
        .update({
            estado: 'cerrado',
            calificacion,
            feedback_cliente: feedback || null
        })
        .eq('id', ticketId);

    if (error) return { error: 'Fallo al procesar la aprobación.' };

    // --- NOTIFY ALL AGENTS ---
    const { data: ticket } = await supabase.from('tickets').select('numero_ticket').eq('id', ticketId).single();
    if (ticket) {
        const { data: agents } = await supabase.from('profiles').select('id').ilike('rol', 'tecnico');
        if (agents && agents.length > 0) {
            const notifications = agents.map(agent => ({
                user_id: agent.id,
                ticket_id: ticketId,
                mensaje: `El ticket NC-${ticket.numero_ticket} ha sido aprobado y cerrado por el cliente.`,
                leida: false
            }));
            await supabase.from('notifications').insert(notifications);
        }
    }
    // -------------------------

    revalidatePath(`/dashboard/ticket/${ticketId}`);
    revalidatePath('/dashboard/ticket/[id]', 'page');
    revalidatePath('/dashboard/solicitante');
    return { success: true };
}

export async function rejectResolutionAction(ticketId: string, motivo: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'No autorizado' };

    // 1. Return to open
    const { error: updateError } = await supabase
        .from('tickets')
        .update({ estado: 'abierto' })
        .eq('id', ticketId);

    if (updateError) return { error: 'Fallo al reabrir el ticket.' };

    // 2. Insert message specifying rejection reason
    const { error: msgError } = await supabase
        .from('ticket_messages')
        .insert({
            ticket_id: ticketId,
            sender_id: user.id,
            mensaje: `[Resolución Rechazada] Motivo: ${motivo}`
        });

    if (msgError) return { error: 'Se reabrió pero falló al enviar el motivo al chat.' };

    // --- NOTIFY ALL AGENTS ---
    const { data: ticket } = await supabase.from('tickets').select('numero_ticket').eq('id', ticketId).single();
    if (ticket) {
        const { data: agents } = await supabase.from('profiles').select('id').ilike('rol', 'tecnico');
        if (agents && agents.length > 0) {
            const notifications = agents.map(agent => ({
                user_id: agent.id,
                ticket_id: ticketId,
                mensaje: `El cliente ha rechazado la resolución del ticket NC-${ticket.numero_ticket}.`,
                leida: false
            }));
            await supabase.from('notifications').insert(notifications);
        }
    }
    // -------------------------

    revalidatePath(`/dashboard/ticket/${ticketId}`);
    revalidatePath('/dashboard/ticket/[id]', 'page');
    revalidatePath('/dashboard/solicitante');
    return { success: true };
}

export async function scheduleVisitAction(ticketId: string, fecha: string, nota: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'No autorizado' };

    // 1. Actualizar el ticket a "programado" (Quitamos la línea conflictiva)
    const { error: updateError } = await supabase
        .from('tickets')
        .update({
            estado: 'programado',
            fecha_programada: fecha
        })
        .eq('id', ticketId);

    if (updateError) {
        console.error('Error scheduling visit:', updateError);
        return { error: 'Fallo al intentar programar la visita técnica.' };
    }

    // Transformar la fecha (ej: de "2026-03-12" a "12/03/2026")
    const [year, month, day] = fecha.split('-');
    const fechaFormateada = `${day}/${month}/${year}`;

    // Limpiar texto vacío o basura del editor Quill
    const cleanNota = nota.replace(/(<([^>]+)>)/gi, "").trim();
    const htmlNota = cleanNota ? nota : '<p>Se ha programado una visita técnica en terreno.</p>';

    // Crear el mensaje del agente inyectando una etiqueta con la fecha arriba del texto
    const mensajeAgente = `<div class="mb-3"><span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-purple-50 text-purple-700 text-[11px] font-bold border border-purple-100 uppercase tracking-widest">📅 Visita Agendada: ${fechaFormateada}</span></div>${htmlNota}`;

    // 2. PRIMERO: Guardamos el mensaje del Agente (quedará "abajo" por ser más antiguo)
    await supabase
        .from('ticket_messages')
        .insert({
            ticket_id: ticketId,
            sender_id: user.id,
            mensaje: mensajeAgente,
            es_sistema: false
        });

    // 3. PAUSA TÁCTICA: Obligamos al servidor a esperar 1 segundo (1000ms)
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 4. SEGUNDO: Guardamos el mensaje del sistema (quedará "arriba" por ser 1 segundo más nuevo)
    await supabase
        .from('ticket_messages')
        .insert({
            ticket_id: ticketId,
            sender_id: user.id,
            mensaje: 'Estado cambiado a Programado.',
            es_sistema: true
        });

    // Notificaciones
    const { data: ticket } = await supabase.from('tickets').select('creado_por, numero_ticket').eq('id', ticketId).single();
    if (ticket && ticket.creado_por !== user.id) {
        await supabase.from('notifications').insert({
            user_id: ticket.creado_por,
            ticket_id: ticketId,
            mensaje: `Se ha programado una visita técnica para tu ticket NC-${ticket.numero_ticket}`,
            leida: false
        });
    }

    revalidatePath(`/dashboard/ticket/${ticketId}`);
    revalidatePath('/dashboard/ticket/[id]', 'page');
    revalidatePath('/dashboard/solicitante');
    revalidatePath('/dashboard/agente');
    return { success: true };
}

export async function assignMaterialAction(ticketId: string, inventarioId: string, cantidad: number) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'No autorizado' };

    // Validar rol
    const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).maybeSingle();
    const isAllowed = ['ADMIN', 'COORDINADOR', 'TECNICO'].includes(profile?.rol?.toUpperCase() || '');
    if (!isAllowed) return { error: 'No tienes permisos para asignar materiales.' };

    // Get item inventario
    const { data: originalItem, error: invError } = await supabase
        .from('inventario')
        .select('*')
        .eq('id', inventarioId)
        .single();

    if (invError || !originalItem) return { error: 'Item de inventario no encontrado.' };

    if (originalItem.cantidad < cantidad) return { error: 'Cantidad superior al stock disponible.' };

    let newInventarioId = originalItem.id;

    if (originalItem.es_serializado || originalItem.cantidad === cantidad) {
        // Mover todo
        const { error: moveError } = await supabase.from('inventario')
            .update({ estado: 'En Tránsito', ticket_id: ticketId })
            .eq('id', originalItem.id)
            .select().single();

        if (moveError) return { error: 'Error moviendo inventario: ' + moveError.message };
    } else {
        // Split genéricos (Cables, etc)
        const { error: updateError } = await supabase.from('inventario')
            .update({ cantidad: originalItem.cantidad - cantidad })
            .eq('id', originalItem.id);

        if (updateError) return { error: 'Error descontando inventario origen: ' + updateError.message };

        const cloneData: any = {
            bodega_id: originalItem.bodega_id,
            modelo: originalItem.modelo,
            familia: originalItem.familia,
            es_serializado: false,
            numero_serie: null,
            estado: 'En Tránsito',
            cantidad: cantidad,
            ticket_id: ticketId
        };

        if (originalItem.tipo !== undefined) cloneData.tipo = originalItem.tipo;
        if (originalItem.descripcion !== undefined) cloneData.descripcion = originalItem.descripcion;

        const { data: newItem, error: insertError } = await supabase.from('inventario').insert(cloneData).select().single();

        if (insertError || !newItem) return { error: 'Error creando nuevo lote asignado: ' + insertError?.message };
        newInventarioId = (newItem as any).id;
    }

    // Create movimiento record
    await supabase.from('movimientos_inventario').insert({
        inventario_id: newInventarioId,
        ticket_id: ticketId,
        bodega_origen_id: originalItem.bodega_id,
        bodega_destino_id: originalItem.bodega_id, // Aún no llega al local, sigue en origen virtualmente en tránsito
        cantidad: cantidad,
        fecha_movimiento: new Date().toISOString(),
        realizado_por: user.id
    });

    const msgHtml = `
        <div class="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-start gap-4 mt-2 max-w-sm">
            <div class="p-2.5 bg-indigo-100 text-indigo-600 rounded-lg shrink-0 shadow-sm border border-indigo-200">
                📦
            </div>
            <div class="flex flex-col">
                <span class="text-[10px] font-black uppercase text-indigo-500 tracking-widest mb-1">Equipo Reservado</span>
                <span class="text-sm font-black text-slate-800">${cantidad}x ${originalItem.modelo}</span>
                <span class="text-[11px] font-medium text-slate-500 capitalize mt-0.5">${originalItem.familia}</span>
                ${originalItem.es_serializado ? `<span class="mt-2 inline-block bg-white border border-indigo-200 text-indigo-700 text-[10px] font-black px-2 py-0.5 rounded shadow-sm">SN: ${originalItem.numero_serie || 'N/A'}</span>` : ''}
            </div>
        </div>
    `;

    await supabase.from('ticket_messages').insert({
        ticket_id: ticketId,
        sender_id: user.id,
        mensaje: msgHtml,
        es_sistema: false,
        es_interno: true
    });

    revalidatePath(`/dashboard/ticket/${ticketId}`);
    return { success: true };
}

export async function closeTicketWithActaAction(
    ticketId: string,
    notas: string,
    firmaCliente: string,
    firmaTecnico: string,
    receptorNombre: string,
    latitud: number,
    longitud: number
) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'No autorizado' };

    try {
        // 1. Actualización Principal (Tickets)
        const { error: ticketError, data: updatedTicket } = await supabase.from('tickets').update({
            estado: 'resuelto',
            notas_cierre: notas,
            firma_cliente: firmaCliente,
            firma_tecnico: firmaTecnico,
            receptor_nombre: receptorNombre,
            latitud_cierre: latitud,
            longitud_cierre: longitud,
            fecha_resolucion: new Date().toISOString()
        }).eq('id', ticketId).select().single();

        if (ticketError || !updatedTicket) {
            throw new Error(`Error actualizando el ticket: ${ticketError?.message || 'Ticket no encontrado o sin permisos'}`);
        }

        // Obtener bodega_id
        const { data: ticketData, error: fetchError } = await supabase
            .from('tickets')
            .select('restaurante_id, restaurantes(bodega_id)')
            .eq('id', ticketId)
            .single();

        if (fetchError) {
            console.warn('No se pudo obtener el restaurante para logística:', fetchError);
        }

        // @ts-ignore
        const restaurante = Array.isArray(ticketData?.restaurantes) ? ticketData?.restaurantes[0] : ticketData?.restaurantes;
        const bodegaId = restaurante?.bodega_id;

        // 2. Actualización Logística (Inventario)
        if (bodegaId) {
            const { error: invError } = await supabase.from('inventario')
                .update({
                    estado: 'operativo' as any,
                    bodega_id: bodegaId,
                    ticket_id: ticketId // Garantizando persistencia férrea
                })
                .eq('ticket_id', ticketId)
                .in('estado', ['en_transito', 'En Tránsito'])
                .select();

            if (invError) {
                throw new Error(`Error en actualización logística: ${invError.message}`);
            }
        }

        // 3. Historial (Timeline)
        const { error: msgError } = await supabase.from('ticket_messages').insert({
            ticket_id: ticketId,
            sender_id: user.id,
            mensaje: 'Se ha cerrado el ticket y firmado la Orden de Servicio Digital.',
            es_sistema: true
        });

        if (msgError) {
            throw new Error(`Error insertando mensaje en el historial: ${msgError.message}`);
        }

        // 4. Send Transactional Email
        const { data: fetchTicketInfo } = await supabase.from('tickets').select('numero_ticket, titulo').eq('id', ticketId).single();
        if (fetchTicketInfo) {
            const adminEmail = process.env.ADMIN_EMAIL || 'no-reply@loopdeskapp.com';
            sendTicketResolvedEmail(ticketId, fetchTicketInfo.numero_ticket, fetchTicketInfo.titulo, adminEmail)
                .catch(err => console.error('Fallo disparando email de resolución:', err));
        }

        // 5. Revalidación
        revalidatePath(`/dashboard/ticket/${ticketId}`);
        return { success: true };

    } catch (error: any) {
        console.error('Error crítico en closeTicketWithActaAction:', error);
        return { error: error.message || 'Ocurrió un error inesperado al cerrar el ticket.' };
    }
}

export async function smartCloseAction(formData: FormData) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { error: 'No autorizado' };

        const ticketId = formData.get('ticketId') as string;
        const notas = formData.get('notas') as string;
        const nombreRecepcionista = formData.get('nombreRecepcionista') as string;
        const firmaBase64 = formData.get('firma') as string;
        const materialInstaladoRaw = formData.get('materialInstalado') as string;
        const equiposDañadosRaw = formData.get('equiposDañados') as string;
        const adjuntos = formData.getAll('adjuntos') as File[];

        let materialInstaladoIds: string[] = [];
        let equiposDañados: { catalogo_id: string; numero_serie: string }[] = [];

        try { materialInstaladoIds = JSON.parse(materialInstaladoRaw); } catch (e) { }
        try { equiposDañados = JSON.parse(equiposDañadosRaw); } catch (e) { }

        const fileUrls: string[] = [];

        // Subir Adjuntos Evidencia
        for (const file of adjuntos) {
            if (file.size > 5 * 1024 * 1024) return { error: `Archivo ${file.name} > 5MB` };
            const path = `${ticketId}/evidencia_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '')}`;
            const { error: uploadError } = await supabase.storage.from('ticket-attachments').upload(path, file);
            if (!uploadError) {
                const { data: { publicUrl } } = supabase.storage.from('ticket-attachments').getPublicUrl(path);
                fileUrls.push(publicUrl);
            }
        }

        // Procesar Firma Digital Base64
        let firmaUrl = '';
        if (firmaBase64 && firmaBase64.startsWith('data:image/png;base64,')) {
            const base64Data = firmaBase64.replace(/^data:image\/png;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            const signaturePath = `${ticketId}/firma_${Date.now()}.png`;
            const { error: sigError } = await supabase.storage.from('ticket-attachments').upload(signaturePath, buffer, {
                contentType: 'image/png'
            });
            if (!sigError) {
                firmaUrl = supabase.storage.from('ticket-attachments').getPublicUrl(signaturePath).data.publicUrl;
            }
        }

        console.log('--- EMPEZANDO CIERRE DE TICKET Y LOGÍSTICA INVERSA ---');

        // 1. Obtener Ticket y el bodega_id del restaurante mediante JOIN
        const { data: ticketData, error: ticketErr } = await supabase
            .from('tickets')
            .select(`
                numero_ticket, 
                creado_por, 
                restaurantes ( bodega_id )
            `)
            .eq('id', ticketId)
            .single();

        if (ticketErr || !ticketData) {
            console.error('Error obteniendo ticket:', ticketErr);
            throw new Error(`Error BD al buscar el ticket: ${ticketErr?.message}`);
        }

        const bodegaLocalId = (ticketData.restaurantes as any)?.bodega_id;

        if (!bodegaLocalId) {
            console.error('El restaurante asociado a este ticket no tiene un bodega_id configurado.');
            throw new Error('El Restaurante del ticket no tiene una Bodega asignada en la base de datos (bodega_id es nulo).');
        }

        console.log('✅ Bodega Local Encontrada:', bodegaLocalId);

        // 2. Transferencia de Equipos Nuevos vinculados directamente al ticket_id (En Tránsito -> Operativo)
        console.log(`Buscando equipos en_transito asociados al ticket_id ${ticketId} en tabla inventario...`);
        let equiposActualizados = 0;

        // Filtramos directamente en inventario los equipos asignados a este ticket
        const { data: equiposEnTransito, error: invErr } = await supabase
            .from('inventario')
            .select('id, cantidad, bodega_id, estado, ticket_id')
            .eq('ticket_id', ticketId)
            .in('estado', ['En Tránsito', 'en_transito', 'En transito', 'en_Transito']);

        if (invErr) throw new Error(`Error al buscar inventario en tránsito mediante ticket_id: ${invErr.message}`);

        if (equiposEnTransito && equiposEnTransito.length > 0) {
            const idsAActualizar = equiposEnTransito.map(eq => eq.id);
            console.log(`Equipos en tránsito encontrados: ${idsAActualizar.length}. Ejecutando UPDATE explícito...`);

            // 2.A: UPDATE EXPLÍCITO A INVENTARIO USANDO ticket_id
            const { error: updErr } = await supabase
                .from('inventario')
                .update({
                    estado: 'Operativo',
                    bodega_id: bodegaLocalId,
                    ticket_id: null // Liberar el ticket_id
                })
                .in('id', idsAActualizar);

            if (updErr) {
                console.error('Error en el UPDATE del inventario:', updErr);
                throw new Error(`Error crítico ejecutando UPDATE en inventario: ${updErr.message}`);
            }

            equiposActualizados = idsAActualizar.length;

            // 2.B: Registrar los movimientos de entrada a la bodega del local
            for (const eq of equiposEnTransito) {
                await supabase.from('movimientos_inventario').insert({
                    inventario_id: eq.id,
                    ticket_id: ticketId,
                    bodega_origen_id: eq.bodega_id,
                    bodega_destino_id: bodegaLocalId,
                    cantidad: eq.cantidad,
                    fecha_movimiento: new Date().toISOString(),
                    realizado_por: user.id
                });
            }
        } else {
            console.log('No se encontraron equipos con ticket_id asociado y en estado en_transito.');
        }

        console.log(`✅ ${equiposActualizados} equipos transferidos exitosamente a 'Operativo' en la Bodega ${bodegaLocalId}.`);

        // 3. Logística Inversa (Equipos Dañados)
        if (equiposDañados.length > 0) {
            console.log(`Verificando ${equiposDañados.length} equipos dañados reportados...`);
            const { data: bodegaDanados } = await supabase.from('bodegas').select('id').eq('tipo', 'Dañados').limit(1).maybeSingle();

            if (!bodegaDanados) {
                console.error('No existe una bodega tipo Dañados.');
            } else {
                for (const eq of equiposDañados) {
                    const { data: existingEq } = await supabase.from('inventario').select('id, bodega_id').eq('numero_serie', eq.numero_serie).maybeSingle();

                    if (existingEq) {
                        const { error: dmgUpdErr } = await supabase.from('inventario').update({
                            estado: 'Dañado',
                            bodega_id: bodegaDanados.id
                        }).eq('id', existingEq.id);

                        if (dmgUpdErr) throw new Error(`Error al mover equipo dañado: ${dmgUpdErr.message}`);

                        await supabase.from('movimientos_inventario').insert({
                            inventario_id: existingEq.id,
                            ticket_id: ticketId,
                            bodega_origen_id: existingEq.bodega_id,
                            bodega_destino_id: bodegaDanados.id,
                            cantidad: 1,
                            fecha_movimiento: new Date().toISOString(),
                            realizado_por: user.id
                        });
                    } else {
                        const { data: newPhantom, error: phanErr } = await supabase.from('inventario').insert({
                            bodega_id: bodegaDanados.id,
                            catalogo_id: eq.catalogo_id,
                            numero_serie: eq.numero_serie,
                            estado: 'Dañado',
                            cantidad: 1
                        }).select().single();

                        if (phanErr) throw new Error(`Error al crear registro de equipo dañado: ${phanErr.message}`);

                        if (newPhantom) {
                            await supabase.from('movimientos_inventario').insert({
                                inventario_id: (newPhantom as any).id,
                                ticket_id: ticketId,
                                bodega_origen_id: bodegaLocalId,
                                bodega_destino_id: bodegaDanados.id,
                                cantidad: 1,
                                fecha_movimiento: new Date().toISOString(),
                                realizado_por: user.id
                            });
                        }
                    }
                }
                console.log(`✅ Equipos dañados procesados enviándolos a la Bodega ${bodegaDanados.id}.`);
            }
        }

        // Crear Mensaje HTML
        const mensajeHtml = `
            <div class="space-y-4">
                <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                    <h4 class="text-sm font-black text-emerald-800 uppercase tracking-widest mb-2 border-b border-emerald-200/50 pb-2">Resolución Técnica en Terreno</h4>
                    <div class="prose prose-sm prose-emerald text-emerald-900 font-medium">
                        ${notas}
                    </div>
                </div>
                
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <div class="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center gap-3">
                        <div class="h-10 w-10 shrink-0 bg-white rounded-lg shadow-sm border border-gray-100 flex items-center justify-center font-bold text-gray-400">👤</div>
                        <div class="flex flex-col">
                            <span class="text-[10px] text-gray-500 font-black uppercase tracking-widest">Recibe Conforme</span>
                            <span class="text-sm font-black text-gray-900">${nombreRecepcionista}</span>
                        </div>
                    </div>
                    ${firmaUrl ? `
                    <div class="bg-white border border-gray-200 rounded-xl h-16 flex items-center justify-center overflow-hidden">
                        <img src="${firmaUrl}" alt="Firma ${nombreRecepcionista}" class="h-full object-contain mix-blend-multiply" />
                    </div>
                    ` : ''}
                </div>
                ${equiposActualizados > 0 ? `
                <div class="mt-3 text-[11px] font-bold text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200 inline-block uppercase tracking-wider">
                    📦 Logística Inversa ejecutada (${equiposActualizados} ítem${equiposActualizados > 1 ? 's' : ''} instalado${equiposActualizados > 1 ? 's' : ''})
                </div>
                ` : ''}
            </div>
        `;

        // Guardar mensaje
        await supabase.from('ticket_messages').insert({
            ticket_id: ticketId,
            sender_id: user.id,
            mensaje: mensajeHtml,
            adjuntos: fileUrls.length > 0 ? fileUrls : null,
            es_sistema: false
        });

        // Actualizar Ticket a Resuelto
        await supabase.from('tickets').update({ estado: 'resuelto', fecha_resolucion: new Date().toISOString() }).eq('id', ticketId);

        // Notify user
        if (ticketData && ticketData.creado_por !== user.id) {
            await supabase.from('notifications').insert({
                user_id: ticketData.creado_por,
                ticket_id: ticketId,
                mensaje: `El agente ha resuelto tu solicitud NC-${ticketData.numero_ticket} en terreno. Por favor revisa y confirma.`,
                leida: false
            });
        }

        revalidatePath(`/dashboard/ticket/${ticketId}`);
        revalidatePath('/dashboard/ticket/[id]', 'page');
        revalidatePath('/dashboard/solicitante');
        revalidatePath('/dashboard/agente');

        return { success: true };

    } catch (error: any) {
        console.error('--- ERROR CRÍTICO EN LOGÍSTICA INVERSA ---');
        console.error(error);
        return { error: error.message || 'Error interno durante la transacción de logística inversa.' };
    }
}

export async function createChildTicketAction(formData: FormData) {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return { error: 'No estás autenticado.' };
    }

    // Role check - Solo los agentes / admins pueden sumar ticket adicional desde el dashboard del agente?
    // Aunque si el botón solo sale a los técnicos, esto está bien
    const ticketPadreId = formData.get('ticketPadreId') as string;
    const titulo = formData.get('titulo') as string;
    const descripcion = formData.get('descripcion') as string;
    const prioridad = formData.get('prioridad') as 'baja' | 'media' | 'alta' | 'crítica';
    const catalogo_servicio_id = formData.get('catalogo_servicio_id') as string;

    if (!ticketPadreId || !titulo || !descripcion || !prioridad || !catalogo_servicio_id) {
        return { error: 'Por favor completa todos los campos requeridos.' };
    }

    // Get parent ticket info
    const { data: parentTicket, error: parentError } = await supabase
        .from('tickets')
        .select('restaurante_id, catalogo_servicio_id, zona_id, creado_por, numero_ticket')
        .eq('id', ticketPadreId)
        .single();

    if (parentError || !parentTicket) {
        return { error: 'El ticket padre no existe o no tienes permisos.' };
    }

    const getSLAHours = (p: string) => {
        switch (p) {
            case 'crítica': return 4;
            case 'alta': return 24;
            case 'media': return 48;
            case 'baja': return 72;
            default: return 72;
        }
    };
    const vencimiento_sla = new Date(Date.now() + getSLAHours(prioridad) * 60 * 60 * 1000).toISOString();

    const newTicketId = crypto.randomUUID();

    const { error: insertError } = await supabase
        .from('tickets')
        .insert({
            id: newTicketId,
            ticket_padre_id: ticketPadreId,
            titulo: titulo,
            descripcion: descripcion,
            prioridad: prioridad,
            restaurante_id: parentTicket.restaurante_id,
            catalogo_servicio_id: catalogo_servicio_id,
            zona_id: parentTicket.zona_id,
            estado: 'abierto',
            agente_asignado_id: user.id,
            creado_por: parentTicket.creado_por,
            vencimiento_sla: vencimiento_sla,
        });

    if (insertError) {
        console.error('Error creating child ticket:', insertError);
        return { error: `Error creando ticket hijo: ${insertError.message}` };
    }

    // We extract the generated numero_ticket
    const { data: insertedTicket } = await supabase.from('tickets').select('numero_ticket').eq('id', newTicketId).single();

    await supabase.from('ticket_messages').insert({
        ticket_id: ticketPadreId,
        sender_id: user.id,
        mensaje: JSON.stringify({ childId: newTicketId, childNum: insertedTicket?.numero_ticket || '...' }),
        tipo_evento: 'ticket_hijo',
        es_sistema: true
    });

    const { data: agents } = await supabase.from('profiles').select('id').eq('rol', 'tecnico');
    if (agents && agents.length > 0) {
        const notifications = agents.map(agent => ({
            user_id: agent.id,
            ticket_id: newTicketId,
            mensaje: `Nuevo ticket adicional ingresado desprendido de NC-${parentTicket.numero_ticket}`,
            leida: false
        }));
        await supabase.from('notifications').insert(notifications);
    }

    revalidatePath(`/dashboard/ticket/${ticketPadreId}`);
    revalidatePath(`/dashboard/ticket/${newTicketId}`);
    revalidatePath('/dashboard/agente');
    return { success: true, newTicketId };
}

export async function anularTicketAction(ticketId: string, motivo: string) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return { error: 'No estás autenticado.' };
        }

        // Role check
        const { data: profile } = await supabase.from('profiles').select('rol, full_name').eq('id', user.id).maybeSingle();
        const userRole = profile?.rol?.toLowerCase() || 'usuario';
        const isSuperUser = userRole === 'admin' || userRole === 'coordinador' || userRole === 'supervisor';

        // Obtener info del ticket
        const { data: ticket, error: ticketError } = await supabase
            .from('tickets')
            .select('estado, creado_por, fecha_creacion, id, numero_ticket')
            .eq('id', ticketId)
            .single();

        if (ticketError || !ticket) {
            console.error('Error detallado buscando ticket:', ticketError);
            return { error: `Ticket no encontrado (Error BD: ${ticketError?.message})` };
        }

        if (ticket.estado === 'anulado' || ticket.estado === 'cerrado' || ticket.estado === 'resuelto') {
            return { error: `Este ticket no puede ser anulado en su estado actual: ${ticket.estado}` };
        }

        if (!isSuperUser) {
            // Validar propiedad de ticket
            if (ticket.creado_por !== user.id) {
                return { error: 'Solo el creador original o un administrador puede anular este ticket.' };
            }

            // Validar regla de 2 horas
            const createdAt = new Date(ticket.fecha_creacion).getTime();
            const now = new Date().getTime();
            const diffHours = (now - createdAt) / (1000 * 60 * 60);

            if (diffHours > 2) {
                return { error: 'El ticket solo puede ser anulado dentro de las primeras 2 horas desde su creación.' };
            }
        }

        console.log('--- EMPEZANDO ANULACIÓN DE TICKET ---');

        // 1. Cambiar estado a Anulado
        const { error: updateError } = await supabase
            .from('tickets')
            .update({ estado: 'anulado' as any })
            .eq('id', ticketId);

        if (updateError) {
            console.error('Error detallado anulando ticket:', updateError);
            return { error: `Error BD al actualizar estado a anulado: ${updateError.message}` };
        }

        // 2. Efecto Dominó: liberar inventario reservado (estado 'En Tránsito') a 'Disponible'
        const { data: inventarioTransito, error: invTransitoError } = await supabase
            .from('inventario')
            .select('id, bodega_id, estado, cantidad')
            .eq('ticket_id', ticketId)
            .in('estado', ['En Tránsito', 'en_transito', 'En transito']);

        if (invTransitoError) {
            console.error('Error detallado buscando inventario en tránsito:', invTransitoError);
            throw new Error(`Error BD buscando inventario: ${invTransitoError.message}`);
        }

        if (inventarioTransito && inventarioTransito.length > 0) {
            const idsALiberar = inventarioTransito.map(inv => inv.id);
            const { error: invUpdateError } = await supabase
                .from('inventario')
                .update({
                    estado: 'Disponible',
                    ticket_id: null
                })
                .in('id', idsALiberar);

            if (invUpdateError) {
                console.error('Error detallado al liberar inventario del ticket anulado:', invUpdateError);
                throw new Error(`Error BD liberando inventario: ${invUpdateError.message}`);
            } else {
                // crear movimientos_inventario para reflejar devolución
                for (const item of inventarioTransito) {
                    const { error: movError } = await supabase.from('movimientos_inventario').insert({
                        inventario_id: item.id,
                        ticket_id: ticketId,
                        bodega_origen_id: item.bodega_id,
                        bodega_destino_id: item.bodega_id,
                        cantidad: item.cantidad,
                        fecha_movimiento: new Date().toISOString(),
                        realizado_por: user.id
                    });
                    if (movError) {
                        console.error('Error detallado insertando movimiento inventario en anulación:', movError);
                    }
                }
            }
        }

        // 3. Inserción en ticket_messages
        const { error: msgError } = await supabase.from('ticket_messages').insert({
            ticket_id: ticketId,
            sender_id: user.id,
            mensaje: motivo,
            es_sistema: false,
            tipo_evento: 'anulacion'
        });

        if (msgError) {
            console.error('Error detallado insertando mensaje de anulación:', msgError);
            throw new Error(`Error BD insertando mensaje de anulación: ${msgError.message}`);
        }

        revalidatePath(`/dashboard/ticket/${ticketId}`);
        revalidatePath('/dashboard/ticket/[id]', 'page');
        revalidatePath('/dashboard/solicitante');
        revalidatePath('/dashboard/agente');

        console.log('✅ Ticket anulado exitosamente.');
        return { success: true };

    } catch (error: any) {
        console.error('--- ERROR CRÍTICO EN ANULACIÓN DE TICKET ---');
        console.error('Error detallado:', error);
        return { success: false, error: error.message || 'Error interno inesperado al anular.' };
    }
}

export async function updateChildTicketDescription(childTicketId: string, nuevaDescripcion: string) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return { error: 'No estás autenticado.' };
        }

        const { data: profile } = await supabase.from('profiles').select('rol, full_name').eq('id', user.id).maybeSingle();
        const userRole = profile?.rol?.toLowerCase() || 'usuario';

        if (userRole !== 'tecnico' && userRole !== 'admin' && userRole !== 'supervisor' && userRole !== 'coordinador') {
            return { error: 'No tienes permisos para editar la descripción de un ticket.' };
        }

        const { error: updateError } = await supabase
            .from('tickets')
            .update({
                descripcion: nuevaDescripcion,
                descripcion_editada: true,
                modificado_por: profile?.full_name || 'Técnico',
                fecha_modificacion: new Date().toISOString()
            })
            .eq('id', childTicketId);

        if (updateError) {
            console.error('Error detallado actualizando descripción:', updateError);
            return { error: `Error de BD: ${updateError.message}` };
        }

        revalidatePath(`/dashboard/ticket/[id]`, 'page');

        return { success: true };

    } catch (error: any) {
        console.error('--- ERROR CRÍTICO ACTUALIZANDO DESCRIPCIÓN ---');
        console.error(error);
        return { success: false, error: error.message || 'Error interno al actualizar.' };
    }
}
