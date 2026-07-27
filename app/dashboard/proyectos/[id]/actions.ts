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

    // Obtener el perfil del participante antes de eliminarlo
    const { data: participante } = await db
        .from('proyecto_participantes')
        .select('perfil_id')
        .eq('id', participanteId)
        .single();

    const { error } = await db
        .from('proyecto_participantes')
        .delete()
        .eq('id', participanteId);

    if (error) return { error: error.message };

    // Si el participante eliminado era el responsable, limpiar responsable_id
    if (participante?.perfil_id) {
        const { data: proyecto } = await db
            .from('proyectos')
            .select('responsable_id')
            .eq('id', proyectoId)
            .single();
        if (proyecto?.responsable_id === participante.perfil_id) {
            await db
                .from('proyectos')
                .update({ responsable_id: null, updated_at: new Date().toISOString() })
                .eq('id', proyectoId);
        }
    }

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

// ── Responsable del Proyecto ──────────────────────────────────────────
export async function asignarResponsableAction(
    proyectoId: string,
    tecnicoId: string | null
): Promise<{ error: string | null }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'No autorizado.' };

    const { data: profile } = await supabase
        .from('profiles')
        .select('rol')
        .eq('id', user.id)
        .single();

    if (profile?.rol !== 'admin') {
        return { error: 'Solo un Administrador puede designar al Responsable del proyecto.' };
    }

    const db = createAdminClient();
    const { error } = await db
        .from('proyectos')
        .update({ responsable_id: tecnicoId, updated_at: new Date().toISOString() })
        .eq('id', proyectoId);

    if (error) return { error: error.message };

    if (tecnicoId) {
        const { data: tec } = await db
            .from('profiles')
            .select('full_name')
            .eq('id', tecnicoId)
            .single();
        await registrarEntradaAuditoria(
            proyectoId, user.id,
            `[SISTEMA] ${tec?.full_name ?? 'Técnico'} fue designado Responsable del proyecto.`,
            'hito'
        );
    } else {
        await registrarEntradaAuditoria(
            proyectoId, user.id,
            '[SISTEMA] Se removió la designación de Responsable del proyecto.',
            'hito'
        );
    }

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

    // Verificar permisos: admin/coordinador o responsable del proyecto
    const { data: callerProfile } = await supabase
        .from('profiles')
        .select('rol')
        .eq('id', user.id)
        .single();

    if (callerProfile?.rol === 'tecnico') {
        const dbCheck = createAdminClient();
        const { data: proyecto } = await dbCheck
            .from('proyectos')
            .select('responsable_id')
            .eq('id', proyectoId)
            .single();
        if (proyecto?.responsable_id !== user.id) {
            return { error: 'No tienes permisos para aplicar plantillas.' };
        }
    }

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

    // 2. Insertar entrada de grupo padre
    const { data: grupo, error: grupoError } = await db
        .from('bitacora_entradas')
        .insert({
            proyecto_id: proyectoId,
            autor_id: user.id,
            tipo: 'hito',
            contenido: `[CHECKLIST_GRUPO] ${plantilla.nombre}`,
            adjuntos: [],
        })
        .select('id')
        .single();
    if (grupoError || !grupo) return { error: `Error al crear grupo: ${grupoError?.message}` };

    // 3. Insertar tareas hijas referenciando el grupo
    const inserts = tareas.map(t => ({
        proyecto_id: proyectoId,
        autor_id: user.id,
        tipo: 'hito',
        contenido: `[CHECKLIST] ${t}`,
        adjuntos: [{ completado: false, asignado_a: null }],
        parent_id: grupo.id,
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
        // Verificar si es el responsable del proyecto
        const db2 = createAdminClient();
        const { data: proyecto } = await db2
            .from('proyectos')
            .select('responsable_id')
            .eq('id', proyectoId)
            .single();
        if (proyecto?.responsable_id !== user.id) {
            return { error: 'No tienes permisos para asignar tareas.' };
        }
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

// ── Cierre de Proyecto ────────────────────────────────────────────────────

export interface ValidacionCierre {
    puedesCerrar: boolean;
    tareasPendientes:     { id: string; titulo: string }[];
    materialesPendientes: { id: string; modelo: string; cantidad_entregada: number; cantidad_instalada: number; saldo: number }[];
    resumen: {
        diasProyecto:    number | null;
        fechaInicioStr:  string | null;
        pctChecklist:    number;
        totalTareas:     number;
        completadas:     number;
        totalEntregado:  number;
        totalRequerido:  number;
        totalViaticos:   number;
    };
    error: string | null;
}

const RESUMEN_VACIO: ValidacionCierre['resumen'] = {
    diasProyecto: null, fechaInicioStr: null,
    pctChecklist: 100, totalTareas: 0, completadas: 0,
    totalEntregado: 0, totalRequerido: 0, totalViaticos: 0,
};

export async function validarYPrepararCierreProyecto(
    proyectoId: string
): Promise<ValidacionCierre> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { puedesCerrar: false, tareasPendientes: [], materialesPendientes: [], resumen: RESUMEN_VACIO, error: 'No autorizado.' };

    const db = createAdminClient();

    // Ejecutar RPC de validación + queries de resumen en paralelo
    const [
        { data: validation, error: rpcError },
        { data: proyectoRow },
        { data: checklistRows },
        { data: equipRows },
        { data: viaticoRows },
    ] = await Promise.all([
        db.rpc('verificar_cierre_proyecto', { p_proyecto_id: proyectoId }),
        db.from('proyectos').select('fecha_inicio').eq('id', proyectoId).single(),
        db.from('bitacora_entradas').select('adjuntos').eq('proyecto_id', proyectoId).eq('tipo', 'hito').like('contenido', '[CHECKLIST]%'),
        db.from('proyecto_equipamiento').select('cantidad_total, cantidad_entregada').eq('proyecto_id', proyectoId),
        db.from('bitacora_entradas').select('adjuntos').eq('proyecto_id', proyectoId).eq('tipo', 'hito').like('contenido', '[VIATICO]%'),
    ]);

    if (rpcError) return { puedesCerrar: false, tareasPendientes: [], materialesPendientes: [], resumen: RESUMEN_VACIO, error: rpcError.message };

    // Calcular resumen
    const fechaInicio    = proyectoRow?.fecha_inicio ?? null;
    const diasProyecto   = fechaInicio ? Math.max(1, Math.ceil((Date.now() - new Date(fechaInicio).getTime()) / 86_400_000)) : null;
    const fechaInicioStr = fechaInicio ? new Date(fechaInicio).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }) : null;

    const totalTareas  = checklistRows?.length ?? 0;
    const completadas  = checklistRows?.filter(e => e.adjuntos?.[0]?.completado === true).length ?? 0;
    const pctChecklist = totalTareas > 0 ? Math.round((completadas / totalTareas) * 100) : 100;

    const totalEntregado = equipRows?.reduce((s, i) => s + ((i as any).cantidad_entregada ?? 0), 0) ?? 0;
    const totalRequerido = equipRows?.reduce((s, i) => s + ((i as any).cantidad_total      ?? 0), 0) ?? 0;

    const totalViaticos = viaticoRows?.reduce((s, e) => s + (e.adjuntos?.[0]?.monto ?? 0), 0) ?? 0;

    return {
        puedesCerrar:         validation?.puede_cerrar         ?? false,
        tareasPendientes:     validation?.tareas_pendientes     ?? [],
        materialesPendientes: validation?.materiales_pendientes ?? [],
        resumen: { diasProyecto, fechaInicioStr, pctChecklist, totalTareas, completadas, totalEntregado, totalRequerido, totalViaticos },
        error: null,
    };
}

export async function completarYFirmarProyecto(
    formData: FormData
): Promise<{ error: string | null }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'No autorizado.' };

    const proyectoId     = (formData.get('proyecto_id')     as string)?.trim();
    const firmaBlob      = formData.get('firma')            as File | null;
    const firmanteNombre = (formData.get('firmante_nombre') as string)?.trim();
    const firmanteCargo  = (formData.get('firmante_cargo')  as string)?.trim() || null;
    const sha256Hash     = (formData.get('sha256_hash')     as string)?.trim();

    if (!proyectoId || !firmaBlob || !firmanteNombre || !sha256Hash) {
        return { error: 'Faltan campos obligatorios en el acta de cierre.' };
    }

    const db = createAdminClient();

    const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single();
    const { data: proyecto } = await db.from('proyectos').select('estado, responsable_id').eq('id', proyectoId).single();

    if (proyecto?.estado === 'completado') return { error: 'El proyecto ya está Completado.' };

    const esAdmin      = profile?.rol === 'admin' || profile?.rol === 'coordinador';
    const esResponsable = proyecto?.responsable_id === user.id;
    if (!esAdmin && !esResponsable) {
        return { error: 'Solo un Administrador o el Responsable del proyecto pueden cerrarlo.' };
    }

    // Re-validación de seguridad en el servidor
    const { data: validation } = await db.rpc('verificar_cierre_proyecto', { p_proyecto_id: proyectoId });
    if (!validation?.puede_cerrar) {
        return { error: 'El proyecto aún tiene tareas o materiales pendientes. Ciérrelos antes de continuar.' };
    }

    // Subir firma a Storage
    const storagePath = `cierres/${proyectoId}/${Date.now()}-cierre.png`;
    const { error: uploadError } = await supabase.storage
        .from('proyectos-assets')
        .upload(storagePath, firmaBlob, { contentType: 'image/png' });
    if (uploadError) return { error: `Error al subir firma: ${uploadError.message}` };

    const { data: { publicUrl } } = supabase.storage.from('proyectos-assets').getPublicUrl(storagePath);

    // Log de auditoría ANTES de cambiar el estado (el trigger bloquea inserts cuando estado=completado)
    await registrarEntradaAuditoria(
        proyectoId, user.id,
        `[SISTEMA] Proyecto cerrado oficialmente. Acta firmada por ${firmanteNombre}${firmanteCargo ? ` (${firmanteCargo})` : ''}.`,
        'hito'
    );

    const { error: updateError } = await db.from('proyectos').update({
        estado:                'completado',
        fecha_fin_real:        new Date().toISOString().split('T')[0],
        fecha_cierre:          new Date().toISOString(),
        cerrado_por:           user.id,
        firma_cierre_url:      publicUrl,
        firma_cierre_hash:     sha256Hash,
        firma_cierre_firmante: firmanteNombre,
        firma_cierre_cargo:    firmanteCargo,
        updated_at:            new Date().toISOString(),
    }).eq('id', proyectoId);

    if (updateError) return { error: updateError.message };

    revalidatePath(`/dashboard/proyectos/${proyectoId}`);
    revalidatePath('/dashboard/proyectos');
    return { error: null };
}

// ── Devolución Masiva por Cierre ──────────────────────────────────────────────
export async function generarDevolucionMasivaCierre(
    proyectoId: string,
    materialesPendientes: { id: string; modelo: string; cantidad_instalada: number; saldo: number }[]
): Promise<{ error: string | null; ajustados: number; solicitudesCreadas: number }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'No autorizado.', ajustados: 0, solicitudesCreadas: 0 };

    if (!materialesPendientes.length) return { error: null, ajustados: 0, solicitudesCreadas: 0 };

    const db = createAdminClient();

    // Verificar permisos y estado del proyecto
    const [{ data: proyecto }, { data: profile }] = await Promise.all([
        db.from('proyectos').select('estado, responsable_id').eq('id', proyectoId).single(),
        db.from('profiles').select('rol').eq('id', user.id).single(),
    ]);

    if (!proyecto) return { error: 'Proyecto no encontrado.', ajustados: 0, solicitudesCreadas: 0 };
    if (proyecto.estado === 'completado') return { error: 'El proyecto ya está completado.', ajustados: 0, solicitudesCreadas: 0 };

    const rol      = profile?.rol ?? '';
    const esGestor = rol === 'admin' || rol === 'coordinador' || user.id === proyecto.responsable_id;
    if (!esGestor) return { error: 'Sin permisos para esta operación.', ajustados: 0, solicitudesCreadas: 0 };

    // Buscar primera bodega INTERNA activa como destino de las devoluciones
    const { data: bodegaDestino } = await db
        .from('bodegas')
        .select('id')
        .ilike('tipo', 'INTERNA')
        .eq('activo', true)
        .limit(1)
        .single();

    // Técnico responsable para las solicitudes (responsable del proyecto o el usuario que ejecuta la acción)
    const tecnicoId = proyecto.responsable_id ?? user.id;

    let ajustados       = 0;
    let solicitudesCreadas = 0;

    for (const mat of materialesPendientes) {
        // 1. Ajuste directo del BOM → desbloquea inmediatamente la validación de cierre
        const { error: updError } = await db
            .from('proyecto_equipamiento')
            .update({ cantidad_entregada: mat.cantidad_instalada })
            .eq('id', mat.id)
            .eq('proyecto_id', proyectoId);

        if (!updError) ajustados++;

        // 2. Intentar crear solicitud_devoluciones si tenemos inventario_id físico rastreable
        if (bodegaDestino && mat.saldo > 0) {
            const { data: siRows } = await db
                .from('solicitud_items')
                .select('inventario_id')
                .eq('proyecto_equipamiento_id', mat.id)
                .not('inventario_id', 'is', null)
                .limit(1);

            const inventarioId = siRows?.[0]?.inventario_id ?? null;

            if (inventarioId) {
                const { error: devErr } = await db
                    .from('solicitudes_devoluciones')
                    .insert({
                        tecnico_id:       tecnicoId,
                        inventario_id:    inventarioId,
                        cantidad:         mat.saldo,
                        motivo:           `Devolución por cierre de proyecto — ${mat.modelo}`,
                        estado:           'pendiente',
                        bodega_destino_id: bodegaDestino.id,
                    });

                if (!devErr) solicitudesCreadas++;
            }
        }
    }

    // 3. Registrar entrada de auditoría
    const lineas = materialesPendientes
        .map(m => `• ${m.modelo}: ${m.saldo} u. devueltas (quedaron ${m.cantidad_instalada} instaladas)`)
        .join('\n');

    await registrarEntradaAuditoria(
        proyectoId, user.id,
        `[DEVOLUCION_MASIVA] Ajuste de cierre: ${ajustados} ítem(s) reconciliados.\n${lineas}`,
        'nota'
    );

    revalidatePath(`/dashboard/proyectos/${proyectoId}`);
    return { error: null, ajustados, solicitudesCreadas };
}
