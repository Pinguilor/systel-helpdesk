'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import type { ProyectoEstado } from '@/types/proyectos.types';

export async function getProyectoById(id: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('proyectos')
        .select(`
            *,
            cliente:restaurantes(id, nombre_restaurante, sigla, direccion),
            coordinador:profiles!coordinador_id(id, full_name),
            participantes:proyecto_participantes(
                id, rol_en_proyecto, activo,
                perfil:profiles(id, full_name, rol)
            )
        `)
        .eq('id', id)
        .single();
    if (error) throw error;
    return data;
}

export async function actualizarEstadoProyectoDesdeHub(
    id: string,
    estado: ProyectoEstado
): Promise<{ error: string | null }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'No autorizado.' };

    const db = createAdminClient();
    const { error } = await db
        .from('proyectos')
        .update({ estado, updated_at: new Date().toISOString() })
        .eq('id', id);

    if (error) return { error: error.message };
    revalidatePath(`/dashboard/proyectos/${id}`);
    revalidatePath('/dashboard/proyectos');
    return { error: null };
}

// ── Centralized System Audit Logs ───────────────────────────────────────
export async function registrarEntradaAuditoria(
    proyectoId: string,
    autorId: string,
    contenido: string,
    tipo: 'nota' | 'foto' | 'firma' | 'hito' = 'hito',
    adjuntos: any[] = []
) {
    const db = createAdminClient();
    const { error } = await db.from('bitacora_entradas').insert({
        proyecto_id: proyectoId,
        autor_id: autorId,
        tipo,
        contenido,
        adjuntos,
    });
    if (error) {
        console.error('Error insertando entrada de auditoría:', error.message);
    }
}

// ── Técnico Options Fetching ──────────────────────────────────────────
export async function getTecnicosDisponibles() {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, rol')
        .eq('rol', 'tecnico')
        .order('full_name');
    if (error) throw error;
    return data ?? [];
}

// ── Participant Actions ────────────────────────────────────────────────
export async function agregarParticipanteAction(
    proyectoId: string,
    perfilId: string,
    perfilNombre: string
): Promise<{ error: string | null }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'No autorizado.' };

    const db = createAdminClient();
    const { error } = await db.from('proyecto_participantes').insert({
        proyecto_id: proyectoId,
        perfil_id: perfilId,
        rol_en_proyecto: 'tecnico',
        activo: true,
    });

    if (error) return { error: error.message };

    // Register system log
    await registrarEntradaAuditoria(
        proyectoId,
        user.id,
        `[SISTEMA] Técnico ${perfilNombre} fue agregado al proyecto.`,
        'hito'
    );

    revalidatePath(`/dashboard/proyectos/${proyectoId}`);
    return { error: null };
}

export async function eliminarParticipanteAction(
    participanteId: string,
    proyectoId: string,
    perfilNombre: string
): Promise<{ error: string | null }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'No authorized.' };

    const db = createAdminClient();
    const { error } = await db
        .from('proyecto_participantes')
        .delete()
        .eq('id', participanteId);

    if (error) return { error: error.message };

    // Register system log
    await registrarEntradaAuditoria(
        proyectoId,
        user.id,
        `[SISTEMA] Técnico ${perfilNombre} fue removido del proyecto.`,
        'hito'
    );

    revalidatePath(`/dashboard/proyectos/${proyectoId}`);
    return { error: null };
}

// ── Viáticos Expense Logging ───────────────────────────────────────────
export async function registrarViaticoAction(
    proyectoId: string,
    monto: number,
    concepto: string,
    perfilId: string,
    perfilNombre: string
): Promise<{ error: string | null }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'No authorized.' };

    const formattedMonto = monto.toLocaleString('es-CL');
    const contenido = `[VIATICO] ${concepto} - $${formattedMonto} (Asociado a: ${perfilNombre})`;
    const adjuntos = [{ monto, concepto, tecnico_id: perfilId, tecnico_nombre: perfilNombre }];

    // Register expense directly in bitacora_entradas as hito
    const db = createAdminClient();
    const { error } = await db.from('bitacora_entradas').insert({
        proyecto_id: proyectoId,
        autor_id: user.id,
        tipo: 'hito',
        contenido,
        adjuntos,
    });

    if (error) return { error: error.message };

    revalidatePath(`/dashboard/proyectos/${proyectoId}`);
    return { error: null };
}

// ── Upload Planimetría (Blueprint / Reference Document) ─────────────────
export async function subirPlanimetriaAction(
    _prevState: { error: string | null },
    formData: FormData
): Promise<{ error: string | null }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'No autorizado.' };

    const proyectoId = (formData.get('proyecto_id') as string)?.trim();
    const titulo = (formData.get('titulo') as string)?.trim();
    const file = formData.get('archivo') as File | null;

    if (!proyectoId || !titulo || !file || file.size === 0) {
        return { error: 'El título y el archivo son obligatorios.' };
    }

    // Upload to Supabase Storage
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'pdf';
    const path = `planos/${proyectoId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
        .from('proyectos-assets')
        .upload(path, file, { contentType: file.type });

    if (uploadError) return { error: `Error al subir archivo: ${uploadError.message}` };

    const { data: { publicUrl } } = supabase.storage
        .from('proyectos-assets')
        .getPublicUrl(path);

    // Create a single log entry of type 'foto' with [PLANO] prefix (serves both timeline and sidebar list)
    const db = createAdminClient();
    const { error: dbError } = await db.from('bitacora_entradas').insert({
        proyecto_id: proyectoId,
        autor_id: user.id,
        tipo: 'foto',
        contenido: `[PLANO] ${titulo}`,
        adjuntos: [publicUrl],
    });

    if (dbError) return { error: dbError.message };

    revalidatePath(`/dashboard/proyectos/${proyectoId}`);
    return { error: null };
}

// ── Checklist Actions ──────────────────────────────────────────────────
export async function crearChecklistItemAction(
    proyectoId: string,
    titulo: string
): Promise<{ error: string | null }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'No autorizado.' };

    const db = createAdminClient();
    const { error } = await db.from('bitacora_entradas').insert({
        proyecto_id: proyectoId,
        autor_id: user.id,
        tipo: 'hito',
        contenido: `[CHECKLIST] ${titulo}`,
        adjuntos: [{ completado: false, asignado_a: null }],
    });

    if (error) return { error: error.message };

    revalidatePath(`/dashboard/proyectos/${proyectoId}`);
    return { error: null };
}

export async function toggleChecklistItemAction(
    proyectoId: string,
    itemId: string,
    completado: boolean,
    titulo: string
): Promise<{ error: string | null }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'No autorizado.' };

    const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();
    const autorNombre = profile?.full_name ?? 'Usuario';

    const db = createAdminClient();
    const { error } = await db
        .from('bitacora_entradas')
        .update({
            adjuntos: [{
                completado,
                completado_por: completado ? autorNombre : null,
                completado_en: completado ? new Date().toISOString() : null,
            }],
        })
        .eq('id', itemId);

    if (error) return { error: error.message };

    // Solo si pasa de false a true (se completa), inyectamos log en la bitácora
    if (completado) {
        await registrarEntradaAuditoria(
            proyectoId,
            user.id,
            `[SISTEMA] Se completó la tarea: ${titulo}`,
            'hito'
        );
    }

    revalidatePath(`/dashboard/proyectos/${proyectoId}`);
    return { error: null };
}

export async function eliminarChecklistItemAction(
    proyectoId: string,
    itemId: string
): Promise<{ error: string | null }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'No autorizado.' };

    const db = createAdminClient();
    const { error } = await db.from('bitacora_entradas').delete().eq('id', itemId);

    if (error) return { error: error.message };

    revalidatePath(`/dashboard/proyectos/${proyectoId}`);
    return { error: null };
}

export async function aplicarPlantillaChecklistAction(
    proyectoId: string,
    plantillaId: string
): Promise<{ error: string | null }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'No autorizado.' };

    const db = createAdminClient();

    // 1. Obtener la plantilla
    const { data: plantilla, error: fetchError } = await db
        .from('proyecto_plantillas_checklist')
        .select('*')
        .eq('id', plantillaId)
        .single();
    if (fetchError) return { error: `Error al cargar la plantilla: ${fetchError.message}` };
    if (!plantilla) return { error: 'Plantilla no encontrada.' };

    const tareas = (plantilla.tareas || []) as string[];
    if (tareas.length === 0) return { error: 'La plantilla no tiene tareas definidas.' };

    // 2. Inserción masiva en bitacora_entradas
    const inserts = tareas.map(t => ({
        proyecto_id: proyectoId,
        autor_id: user.id,
        tipo: 'hito',
        contenido: `[CHECKLIST] ${t}`,
        adjuntos: [{ completado: false, asignado_a: null }],
    }));

    const { error: insertError } = await db.from('bitacora_entradas').insert(inserts);
    if (insertError) return { error: `Error al inyectar tareas: ${insertError.message}` };

    // 3. Registrar un único log de auditoría
    await registrarEntradaAuditoria(
        proyectoId,
        user.id,
        `[SISTEMA] Se aplicó la plantilla de checklist: ${plantilla.nombre}`,
        'hito'
    );

    revalidatePath(`/dashboard/proyectos/${proyectoId}`);
    return { error: null };
}

export async function asignarResponsableChecklistAction(
    proyectoId: string,
    itemId: string,
    tecnicoId: string | null,
    tecnicoNombre: string | null,
    tecnicoIniciales: string | null,
    tituloTarea: string
): Promise<{ error: string | null }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'No autorizado.' };

    const { data: profile } = await supabase
        .from('profiles')
        .select('rol')
        .eq('id', user.id)
        .single();

    if (profile?.rol === 'tecnico') {
        return { error: 'No tienes permisos para asignar tareas.' };
    }

    const db = createAdminClient();
    
    // Get the current entry to preserve 'completado' state
    const { data: entrada, error: fetchError } = await db
        .from('bitacora_entradas')
        .select('adjuntos')
        .eq('id', itemId)
        .single();
        
    if (fetchError || !entrada) return { error: 'No se encontró la tarea.' };
    
    const currentPayload = entrada.adjuntos?.[0] || { completado: false };

    const asignado_a = tecnicoId ? {
        id: tecnicoId,
        nombre: tecnicoNombre,
        iniciales: tecnicoIniciales
    } : null;

    const newPayload = { ...currentPayload, asignado_a };

    const { error } = await db
        .from('bitacora_entradas')
        .update({
            adjuntos: [newPayload],
        })
        .eq('id', itemId);

    if (error) return { error: error.message };

    const mensajeAuditoria = asignado_a 
        ? `[SISTEMA] Se asignó la tarea "${tituloTarea}" a ${tecnicoNombre}`
        : `[SISTEMA] Se dejó sin asignar la tarea "${tituloTarea}"`;

    await registrarEntradaAuditoria(
        proyectoId,
        user.id,
        mensajeAuditoria,
        'hito'
    );

    revalidatePath(`/dashboard/proyectos/${proyectoId}`);
    return { error: null };
}
