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
const BOCAS_VALIDAS = [24, 48];
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
    cruzado_boca_id: string | null;
    etiqueta_libre: string | null;
    notas: string | null;
    vlan: number | null;
}

export interface RackPatchPanel {
    id: string;
    proyecto_id: string;
    nombre: string;
    num_bocas: number;
    orden: number;
    created_at: string;
}

export interface RackBoca {
    id: string;
    patch_panel_id: string;
    numero_boca: number;
    proyecto_equipamiento_id: string | null;
    etiqueta_libre: string | null;
    notas: string | null;
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
): Promise<{
    switches: RackSwitch[];
    puertos: RackPuerto[];
    patchPanels: RackPatchPanel[];
    bocas: RackBoca[];
    receta: RackRecetaItem[];
    plantillas: RackTemplate[];
    error?: string;
}> {
    const empty = { switches: [], puertos: [], patchPanels: [], bocas: [], receta: [], plantillas: [] };
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
            .select('id, switch_id, numero_puerto, rol, es_poe, proyecto_equipamiento_id, inventario_id, cruzado_boca_id, etiqueta_libre, notas, vlan')
            .in('switch_id', switchIds);
        if (pErr) return { ...empty, switches: (switches ?? []) as RackSwitch[], error: pErr.message };
        puertos = (p ?? []) as RackPuerto[];
    }

    // Patch panels (infraestructura pasiva) + sus bocas.
    const { data: patchPanels, error: ppErr } = await db
        .from('proyecto_patch_panels')
        .select('id, proyecto_id, nombre, num_bocas, orden, created_at')
        .eq('proyecto_id', proyectoId)
        .order('orden', { ascending: true })
        .order('created_at', { ascending: true });

    if (ppErr) return { ...empty, switches: (switches ?? []) as RackSwitch[], puertos, error: ppErr.message };

    const panelIds = (patchPanels ?? []).map(p => p.id);
    let bocas: RackBoca[] = [];
    if (panelIds.length > 0) {
        const { data: b, error: bErr } = await db
            .from('proyecto_bocas')
            .select('id, patch_panel_id, numero_boca, proyecto_equipamiento_id, etiqueta_libre, notas')
            .in('patch_panel_id', panelIds);
        if (bErr) return { ...empty, switches: (switches ?? []) as RackSwitch[], puertos, patchPanels: (patchPanels ?? []) as RackPatchPanel[], error: bErr.message };
        bocas = (b ?? []) as RackBoca[];
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

    return {
        switches: (switches ?? []) as RackSwitch[],
        puertos,
        patchPanels: (patchPanels ?? []) as RackPatchPanel[],
        bocas,
        receta,
        plantillas,
    };
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
    cruzadoBocaId?: string | null;
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

    // Cruzada a Patch Panel y dispositivo directo son mutuamente excluyentes.
    const cruzadoBocaId = input.cruzadoBocaId?.trim() || null;
    const equipamientoId = cruzadoBocaId ? null : (input.proyectoEquipamientoId?.trim() || null);

    // Si se asigna equipo de la Receta, debe ser de este proyecto.
    if (equipamientoId) {
        const { data: eq } = await db
            .from('proyecto_equipamiento').select('id').eq('id', equipamientoId).eq('proyecto_id', proyectoId).maybeSingle();
        if (!eq) return { error: 'El equipo seleccionado no pertenece a la Receta de este proyecto.' };
    }

    // Si se cruza a una boca, debe pertenecer al mismo proyecto y no estar ya cruzada.
    if (cruzadoBocaId) {
        const { data: boca } = await db
            .from('proyecto_bocas')
            .select('id, proyecto_patch_panels!inner(proyecto_id)')
            .eq('id', cruzadoBocaId)
            .maybeSingle();
        const proyectoBoca = (boca as any)?.proyecto_patch_panels?.proyecto_id;
        if (!boca || proyectoBoca !== proyectoId) {
            return { error: 'La boca seleccionada no pertenece a este proyecto.' };
        }

        const { data: puertoActual } = await db
            .from('proyecto_puertos').select('id').eq('switch_id', switchId).eq('numero_puerto', numeroPuerto).maybeSingle();

        const { data: yaCruzada } = await db
            .from('proyecto_puertos').select('id').eq('cruzado_boca_id', cruzadoBocaId).maybeSingle();
        if (yaCruzada && yaCruzada.id !== puertoActual?.id) {
            return { error: 'Esa boca ya está cruzada a otro puerto de switch.' };
        }
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
                cruzado_boca_id: cruzadoBocaId,
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

// ── CRUD básico de patch panels (infraestructura pasiva) ───────────────────
export async function crearPatchPanelAction(proyectoId: string, nombre: string, numBocas: number) {
    const guard = await requireGestor();
    if ('error' in guard) return { error: guard.error };

    if (!proyectoId) return { error: 'Proyecto no identificado.' };
    if (!BOCAS_VALIDAS.includes(numBocas)) return { error: 'El conteo de bocas debe ser 24 o 48.' };
    const nombreLimpio = nombre?.trim() || 'Patch Panel';

    const db = createAdminClient();

    const { count } = await db
        .from('proyecto_patch_panels')
        .select('*', { count: 'exact', head: true })
        .eq('proyecto_id', proyectoId);

    const { error } = await db.from('proyecto_patch_panels').insert({
        proyecto_id: proyectoId,
        nombre: nombreLimpio,
        num_bocas: numBocas,
        orden: count ?? 0,
    });

    if (error) {
        console.error('[crearPatchPanelAction]', error.message);
        return { error: error.message || 'No se pudo crear el patch panel.' };
    }

    revalidatePath(rutaProyecto(proyectoId));
    return { success: true };
}

export async function eliminarPatchPanelAction(patchPanelId: string, proyectoId: string) {
    const guard = await requireGestor();
    if ('error' in guard) return { error: guard.error };

    if (!patchPanelId) return { error: 'Patch panel no identificado.' };

    const db = createAdminClient();
    const { error } = await db.from('proyecto_patch_panels').delete().eq('id', patchPanelId);

    if (error) {
        console.error('[eliminarPatchPanelAction]', error.message);
        if (error.message.includes('violates foreign key constraint')) {
            return { error: 'Hay bocas de este panel cruzadas a un switch. Libera esas cruzadas antes de eliminar el panel.' };
        }
        return { error: error.message || 'No se pudo eliminar el patch panel.' };
    }

    revalidatePath(rutaProyecto(proyectoId));
    return { success: true };
}

// ── Autogenerar bocas (carga masiva) ────────────────────────────────────────
export async function autogenerarBocasAction(
    proyectoId: string,
    patchPanelId: string,
    prefijo: string,
    desde: number,
    hasta: number,
) {
    const guard = await requireGestor();
    if ('error' in guard) return { error: guard.error };
    if (!patchPanelId) return { error: 'Patch panel no identificado.' };
    if (!Number.isFinite(desde) || !Number.isFinite(hasta) || desde < 1 || hasta < desde) {
        return { error: 'Rango de bocas inválido.' };
    }

    const db = createAdminClient();
    const { data: panel } = await db
        .from('proyecto_patch_panels').select('num_bocas').eq('id', patchPanelId).eq('proyecto_id', proyectoId).maybeSingle();
    if (!panel) return { error: 'El patch panel no pertenece a este proyecto.' };
    if (hasta > panel.num_bocas) return { error: `El rango no puede superar ${panel.num_bocas} bocas.` };

    const prefijoLimpio = prefijo?.trim();
    const filas = [];
    for (let n = desde; n <= hasta; n++) {
        filas.push({
            patch_panel_id: patchPanelId,
            numero_boca: n,
            etiqueta_libre: prefijoLimpio ? `${prefijoLimpio} ${n}` : null,
        });
    }

    // No pisa bocas ya configuradas: solo inserta las que faltan.
    const { error } = await db
        .from('proyecto_bocas')
        .upsert(filas, { onConflict: 'patch_panel_id,numero_boca', ignoreDuplicates: true });

    if (error) {
        console.error('[autogenerarBocasAction]', error.message);
        return { error: error.message || 'No se pudieron autogenerar las bocas.' };
    }

    revalidatePath(rutaProyecto(proyectoId));
    return { success: true };
}

// ── Asignación de bocas ──────────────────────────────────────────────────────
export interface AsignarBocaInput {
    proyectoId: string;
    patchPanelId: string;
    numeroBoca: number;
    proyectoEquipamientoId?: string | null;
    etiquetaLibre?: string | null;
    notas?: string | null;
}

export async function asignarBocaAction(input: AsignarBocaInput) {
    const guard = await requireGestor();
    if ('error' in guard) return { error: guard.error };

    const { proyectoId, patchPanelId, numeroBoca } = input;
    if (!patchPanelId || !numeroBoca) return { error: 'Boca no identificada.' };

    const db = createAdminClient();
    const { data: panel } = await db
        .from('proyecto_patch_panels').select('id').eq('id', patchPanelId).eq('proyecto_id', proyectoId).maybeSingle();
    if (!panel) return { error: 'El patch panel no pertenece a este proyecto.' };

    const equipamientoId = input.proyectoEquipamientoId?.trim() || null;
    if (equipamientoId) {
        const { data: eq } = await db
            .from('proyecto_equipamiento').select('id').eq('id', equipamientoId).eq('proyecto_id', proyectoId).maybeSingle();
        if (!eq) return { error: 'El equipo seleccionado no pertenece a la Receta de este proyecto.' };
    }

    const { error } = await db
        .from('proyecto_bocas')
        .upsert(
            {
                patch_panel_id: patchPanelId,
                numero_boca: numeroBoca,
                proyecto_equipamiento_id: equipamientoId,
                etiqueta_libre: input.etiquetaLibre?.trim() || null,
                notas: input.notas?.trim() || null,
                actualizado_por: guard.user.id,
            },
            { onConflict: 'patch_panel_id,numero_boca' },
        );

    if (error) {
        console.error('[asignarBocaAction]', error.message);
        return { error: error.message || 'No se pudo guardar la boca.' };
    }

    revalidatePath(rutaProyecto(proyectoId));
    return { success: true };
}

export async function liberarBocaAction(patchPanelId: string, numeroBoca: number, proyectoId: string) {
    const guard = await requireGestor();
    if ('error' in guard) return { error: guard.error };

    if (!patchPanelId || !numeroBoca) return { error: 'Boca no identificada.' };

    const db = createAdminClient();

    const { data: boca } = await db
        .from('proyecto_bocas').select('id').eq('patch_panel_id', patchPanelId).eq('numero_boca', numeroBoca).maybeSingle();
    if (boca) {
        const { data: cruzada } = await db
            .from('proyecto_puertos').select('id').eq('cruzado_boca_id', boca.id).maybeSingle();
        if (cruzada) return { error: 'Esta boca está cruzada a un switch. Libera la cruzada desde el puerto del switch primero.' };
    }

    const { error } = await db
        .from('proyecto_bocas')
        .delete()
        .eq('patch_panel_id', patchPanelId)
        .eq('numero_boca', numeroBoca);

    if (error) {
        console.error('[liberarBocaAction]', error.message);
        return { error: error.message || 'No se pudo liberar la boca.' };
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
