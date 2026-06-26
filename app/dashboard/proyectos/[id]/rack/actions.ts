'use server';

// ════════════════════════════════════════════════════════════════════════════
// RACK MAPPER — Server Actions (Fase 2: lectura + CRUD básico de switches)
// Esquema: sql/rack_mapper.sql · Diseño: docs/superpowers/specs/rack-mapper-design.md
//
// Patrón de seguridad establecido: chequeo de rol con el cliente de sesión y
// mutación con service-role (bypass RLS) para evitar choques de políticas.
// ════════════════════════════════════════════════════════════════════════════

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

const PUERTOS_VALIDOS = [8, 24, 48];
const rutaProyecto = (proyectoId: string) => `/dashboard/proyectos/${proyectoId}`;

// ── Tipos ───────────────────────────────────────────────────────────────────
export interface RackSwitch {
    id: string;
    proyecto_id: string;
    nombre: string;
    num_puertos: number;
    orden: number;
    created_at: string;
}

export interface RackPuerto {
    id: string;
    switch_id: string;
    numero_puerto: number;
    rol: 'acceso' | 'uplink';
    es_poe: boolean;
    proyecto_equipamiento_id: string | null;
    inventario_id: string | null;
    etiqueta_libre: string | null;
    notas: string | null;
    vlan: number | null;
}

export interface RackRecetaItem {
    id: string;            // proyecto_equipamiento.id
    modelo: string;
    familia: string;
    es_serializado: boolean;
    vlan_default: number | null;
}

export interface RackTemplate {
    id: string;
    nombre: string;
    descripcion: string | null;
    payload: TemplatePayload;
}

interface TemplatePuerto {
    numero: number;
    rol: 'acceso' | 'uplink';
    es_poe: boolean;
    etiqueta_libre?: string | null;
}
interface TemplateSwitch {
    nombre: string;
    num_puertos: number;
    puertos: TemplatePuerto[];
}
interface TemplatePayload {
    switches: TemplateSwitch[];
}

// ── Guards ──────────────────────────────────────────────────────────────────
async function getUser() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return { supabase, user };
}

/** Solo admin/coordinador pueden mutar el rack. Devuelve el user o un error. */
async function requireGestor(): Promise<{ user: { id: string } } | { error: string }> {
    const { supabase, user } = await getUser();
    if (!user) return { error: 'No autenticado.' };
    const { data: profile } = await supabase
        .from('profiles').select('rol').eq('id', user.id).maybeSingle();
    const rol = profile?.rol?.toLowerCase();
    if (rol !== 'admin' && rol !== 'coordinador')
        return { error: 'Solo admin o coordinador pueden gestionar el rack.' };
    return { user: { id: user.id } };
}

// ── Lectura ─────────────────────────────────────────────────────────────────
export async function getRackData(
    proyectoId: string,
): Promise<{ switches: RackSwitch[]; puertos: RackPuerto[]; receta: RackRecetaItem[]; plantillas: RackTemplate[]; error?: string }> {
    const empty = { switches: [], puertos: [], receta: [], plantillas: [] };
    const { user } = await getUser();
    if (!user) return { ...empty, error: 'No autenticado.' };

    const db = createAdminClient();

    const { data: switches, error: sErr } = await db
        .from('proyecto_switches')
        .select('id, proyecto_id, nombre, num_puertos, orden, created_at')
        .eq('proyecto_id', proyectoId)
        .order('orden', { ascending: true })
        .order('created_at', { ascending: true });

    if (sErr) return { ...empty, error: sErr.message };

    const switchIds = (switches ?? []).map(s => s.id);
    let puertos: RackPuerto[] = [];

    if (switchIds.length > 0) {
        const { data: p, error: pErr } = await db
            .from('proyecto_puertos')
            .select('id, switch_id, numero_puerto, rol, es_poe, proyecto_equipamiento_id, inventario_id, etiqueta_libre, notas, vlan')
            .in('switch_id', switchIds);
        if (pErr) return { ...empty, switches: (switches ?? []) as RackSwitch[], error: pErr.message };
        puertos = (p ?? []) as RackPuerto[];
    }

    // Receta Maestra del proyecto: opciones de dispositivo para asignar a puertos.
    const { data: recetaRaw } = await db
        .from('proyecto_equipamiento')
        .select(`
            id, tipo_item, vlan_default,
            inventario:catalogo_equipos!inventario_id(
                modelo, es_serializado, familia_obj:familias_hardware(nombre)
            )
        `)
        .eq('proyecto_id', proyectoId)
        .order('created_at', { ascending: true });

    const receta: RackRecetaItem[] = (recetaRaw ?? []).map((item: any) => ({
        id: item.id,
        modelo: item.inventario?.modelo || item.tipo_item || 'Manual',
        familia: item.inventario?.familia_obj?.nombre || 'Sin familia',
        es_serializado: item.inventario?.es_serializado ?? false,
        vlan_default: item.vlan_default ?? null,
    }));

    // Biblioteca global de plantillas (para el modal "Aplicar plantilla").
    const { data: plantillasRaw } = await db
        .from('rack_templates')
        .select('id, nombre, descripcion, payload')
        .eq('activo', true)
        .order('created_at', { ascending: false });
    const plantillas = (plantillasRaw ?? []) as RackTemplate[];

    return { switches: (switches ?? []) as RackSwitch[], puertos, receta, plantillas };
}

// ── CRUD básico de switches ─────────────────────────────────────────────────
export async function crearSwitchAction(proyectoId: string, nombre: string, numPuertos: number) {
    const guard = await requireGestor();
    if ('error' in guard) return { error: guard.error };

    if (!proyectoId) return { error: 'Proyecto no identificado.' };
    if (!PUERTOS_VALIDOS.includes(numPuertos)) return { error: 'El conteo de puertos debe ser 8, 24 o 48.' };
    const nombreLimpio = nombre?.trim() || 'Switch';

    const db = createAdminClient();

    // Nuevo switch va al final del rack.
    const { count } = await db
        .from('proyecto_switches')
        .select('*', { count: 'exact', head: true })
        .eq('proyecto_id', proyectoId);

    const { error } = await db.from('proyecto_switches').insert({
        proyecto_id: proyectoId,
        nombre: nombreLimpio,
        num_puertos: numPuertos,
        orden: count ?? 0,
    });

    if (error) {
        console.error('[crearSwitchAction]', error.message);
        return { error: error.message || 'No se pudo crear el switch.' };
    }

    revalidatePath(rutaProyecto(proyectoId));
    return { success: true };
}

export async function renombrarSwitchAction(switchId: string, proyectoId: string, nombre: string) {
    const guard = await requireGestor();
    if ('error' in guard) return { error: guard.error };

    const nombreLimpio = nombre?.trim();
    if (!switchId) return { error: 'Switch no identificado.' };
    if (!nombreLimpio) return { error: 'El nombre es obligatorio.' };

    const db = createAdminClient();
    const { error } = await db
        .from('proyecto_switches')
        .update({ nombre: nombreLimpio })
        .eq('id', switchId);

    if (error) {
        console.error('[renombrarSwitchAction]', error.message);
        return { error: error.message || 'No se pudo renombrar el switch.' };
    }

    revalidatePath(rutaProyecto(proyectoId));
    return { success: true };
}

export async function eliminarSwitchAction(switchId: string, proyectoId: string) {
    const guard = await requireGestor();
    if ('error' in guard) return { error: guard.error };

    if (!switchId) return { error: 'Switch no identificado.' };

    const db = createAdminClient();
    // Los puertos se borran en cascada (FK ON DELETE CASCADE).
    const { error } = await db.from('proyecto_switches').delete().eq('id', switchId);

    if (error) {
        console.error('[eliminarSwitchAction]', error.message);
        return { error: error.message || 'No se pudo eliminar el switch.' };
    }

    revalidatePath(rutaProyecto(proyectoId));
    return { success: true };
}

// ── Asignación de puertos ───────────────────────────────────────────────────
export interface AsignarPuertoInput {
    proyectoId: string;
    switchId: string;
    numeroPuerto: number;
    rol: 'acceso' | 'uplink';
    esPoe: boolean;
    proyectoEquipamientoId?: string | null;
    etiquetaLibre?: string | null;
    notas?: string | null;
    vlan?: number | null;
}

export async function asignarPuertoAction(input: AsignarPuertoInput) {
    const guard = await requireGestor();
    if ('error' in guard) return { error: guard.error };

    const { proyectoId, switchId, numeroPuerto, rol, esPoe } = input;
    if (!switchId || !numeroPuerto) return { error: 'Puerto no identificado.' };
    if (rol !== 'acceso' && rol !== 'uplink') return { error: 'Rol de puerto inválido.' };

    const db = createAdminClient();

    // El switch debe pertenecer al proyecto (defensa).
    const { data: sw } = await db
        .from('proyecto_switches').select('id').eq('id', switchId).eq('proyecto_id', proyectoId).maybeSingle();
    if (!sw) return { error: 'El switch no pertenece a este proyecto.' };

    // Si se asigna equipo de la Receta, debe ser de este proyecto.
    const equipamientoId = input.proyectoEquipamientoId?.trim() || null;
    if (equipamientoId) {
        const { data: eq } = await db
            .from('proyecto_equipamiento').select('id').eq('id', equipamientoId).eq('proyecto_id', proyectoId).maybeSingle();
        if (!eq) return { error: 'El equipo seleccionado no pertenece a la Receta de este proyecto.' };
    }

    // VLAN: entero 1..4094 o null.
    let vlan: number | null = null;
    if (input.vlan != null && Number.isFinite(input.vlan)) {
        const v = Math.trunc(input.vlan);
        if (v < 1 || v > 4094) return { error: 'La VLAN debe estar entre 1 y 4094.' };
        vlan = v;
    }

    const { error } = await db
        .from('proyecto_puertos')
        .upsert(
            {
                switch_id: switchId,
                numero_puerto: numeroPuerto,
                rol,
                es_poe: esPoe,
                proyecto_equipamiento_id: equipamientoId,
                etiqueta_libre: input.etiquetaLibre?.trim() || null,
                notas: input.notas?.trim() || null,
                vlan,
                actualizado_por: guard.user.id,
            },
            { onConflict: 'switch_id,numero_puerto' },
        );

    if (error) {
        console.error('[asignarPuertoAction]', error.message);
        return { error: error.message || 'No se pudo guardar el puerto.' };
    }

    revalidatePath(rutaProyecto(proyectoId));
    return { success: true };
}

export async function liberarPuertoAction(switchId: string, numeroPuerto: number, proyectoId: string) {
    const guard = await requireGestor();
    if ('error' in guard) return { error: guard.error };

    if (!switchId || !numeroPuerto) return { error: 'Puerto no identificado.' };

    const db = createAdminClient();
    const { error } = await db
        .from('proyecto_puertos')
        .delete()
        .eq('switch_id', switchId)
        .eq('numero_puerto', numeroPuerto);

    if (error) {
        console.error('[liberarPuertoAction]', error.message);
        return { error: error.message || 'No se pudo liberar el puerto.' };
    }

    revalidatePath(rutaProyecto(proyectoId));
    return { success: true };
}

// ── Plantillas ──────────────────────────────────────────────────────────────
const PUERTOS_SET = new Set(PUERTOS_VALIDOS);

/**
 * Aplica una plantilla global al rack del proyecto. Las plantillas son
 * agnósticas de dispositivos: pre-pueblan estructura (switches, uplink, PoE,
 * etiquetas), no seriales. `modo` = 'reemplazar' borra el rack actual primero.
 */
export async function aplicarPlantillaAction(
    proyectoId: string,
    templateId: string,
    modo: 'reemplazar' | 'agregar',
) {
    const guard = await requireGestor();
    if ('error' in guard) return { error: guard.error };
    if (!proyectoId || !templateId) return { error: 'Datos incompletos.' };

    const db = createAdminClient();

    const { data: tpl } = await db
        .from('rack_templates').select('payload').eq('id', templateId).eq('activo', true).maybeSingle();
    if (!tpl) return { error: 'Plantilla no encontrada.' };

    const payload = (tpl.payload ?? {}) as TemplatePayload;
    const switchesDef = Array.isArray(payload.switches) ? payload.switches : [];
    if (switchesDef.length === 0) return { error: 'La plantilla no tiene switches definidos.' };

    if (modo === 'reemplazar') {
        // Cascade borra los puertos.
        const { error: delErr } = await db.from('proyecto_switches').delete().eq('proyecto_id', proyectoId);
        if (delErr) return { error: delErr.message };
    }

    // orden de partida (si se agrega al rack existente)
    const { count } = await db
        .from('proyecto_switches').select('*', { count: 'exact', head: true }).eq('proyecto_id', proyectoId);
    let orden = count ?? 0;

    for (const sw of switchesDef) {
        const numPuertos = PUERTOS_SET.has(sw.num_puertos) ? sw.num_puertos : 24;
        const { data: nuevoSwitch, error: swErr } = await db
            .from('proyecto_switches')
            .insert({ proyecto_id: proyectoId, nombre: sw.nombre || 'Switch', num_puertos: numPuertos, orden: orden++ })
            .select('id')
            .single();
        if (swErr || !nuevoSwitch) return { error: swErr?.message || 'No se pudo crear un switch de la plantilla.' };

        const puertosDef = Array.isArray(sw.puertos) ? sw.puertos : [];
        const filas = puertosDef
            .filter(p => p.numero >= 1 && p.numero <= numPuertos)
            .map(p => ({
                switch_id: nuevoSwitch.id,
                numero_puerto: p.numero,
                rol: p.rol === 'uplink' ? 'uplink' : 'acceso',
                es_poe: !!p.es_poe,
                etiqueta_libre: p.etiqueta_libre?.trim() || null,
            }));
        if (filas.length > 0) {
            const { error: pErr } = await db.from('proyecto_puertos').insert(filas);
            if (pErr) return { error: pErr.message };
        }
    }

    revalidatePath(rutaProyecto(proyectoId));
    return { success: true };
}

/**
 * Serializa el rack actual del proyecto como plantilla global. Omite los
 * vínculos a dispositivos/seriales: solo guarda estructura (rol, PoE, etiqueta).
 */
export async function guardarComoPlantillaAction(proyectoId: string, nombre: string, descripcion: string) {
    const guard = await requireGestor();
    if ('error' in guard) return { error: guard.error };

    const nombreLimpio = nombre?.trim();
    if (!nombreLimpio) return { error: 'El nombre de la plantilla es obligatorio.' };

    const db = createAdminClient();

    const { data: switches } = await db
        .from('proyecto_switches').select('id, nombre, num_puertos, orden').eq('proyecto_id', proyectoId)
        .order('orden', { ascending: true });
    if (!switches || switches.length === 0) return { error: 'El rack está vacío; no hay nada que guardar.' };

    const switchIds = switches.map(s => s.id);
    const { data: puertos } = await db
        .from('proyecto_puertos')
        .select('switch_id, numero_puerto, rol, es_poe, etiqueta_libre')
        .in('switch_id', switchIds);

    const payload: TemplatePayload = {
        switches: switches.map(sw => ({
            nombre: sw.nombre,
            num_puertos: sw.num_puertos,
            // Solo puertos con valor de plantilla: uplink, PoE o etiqueta (NO asignaciones de equipo)
            puertos: (puertos ?? [])
                .filter((p: any) => p.switch_id === sw.id && (p.rol === 'uplink' || p.es_poe || p.etiqueta_libre))
                .map((p: any) => ({
                    numero: p.numero_puerto,
                    rol: p.rol,
                    es_poe: p.es_poe,
                    etiqueta_libre: p.etiqueta_libre,
                })),
        })),
    };

    const { error } = await db.from('rack_templates').insert({
        nombre: nombreLimpio,
        descripcion: descripcion?.trim() || null,
        payload,
        creado_por: guard.user.id,
    });

    if (error) {
        console.error('[guardarComoPlantillaAction]', error.message);
        return { error: error.message || 'No se pudo guardar la plantilla.' };
    }

    return { success: true };
}
