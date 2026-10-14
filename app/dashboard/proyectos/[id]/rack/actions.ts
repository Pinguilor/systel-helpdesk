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
    dispositivo_plantilla_id: string | null;
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
    dispositivo_plantilla_id: string | null;
    etiqueta_libre: string | null;
    notas: string | null;
}

export interface RackDispositivoPlantilla {
    id: string;
    nombre: string;          // texto completo a mostrar: "Zona · Dispositivo"
    dispositivo: string;
    zona: string | null;
    vlan_default: number | null;
    activo: boolean;
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

/** VLAN opcional: entero 1..4094 o null. */
function parseVlan(raw: number | null | undefined): { vlan: number | null } | { error: string } {
    if (raw == null || !Number.isFinite(raw)) return { vlan: null };
    const v = Math.trunc(raw);
    if (v < 1 || v > 4094) return { error: 'La VLAN debe estar entre 1 y 4094.' };
    return { vlan: v };
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
    dispositivos: RackDispositivoPlantilla[];
    receta: RackRecetaItem[];
    plantillas: RackTemplate[];
    error?: string;
}> {
    const empty = { switches: [], puertos: [], patchPanels: [], bocas: [], dispositivos: [], receta: [], plantillas: [] };
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
            .select('id, switch_id, numero_puerto, rol, es_poe, proyecto_equipamiento_id, inventario_id, dispositivo_plantilla_id, cruzado_boca_id, etiqueta_libre, notas, vlan')
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
            .select('id, patch_panel_id, numero_boca, dispositivo_plantilla_id, etiqueta_libre, notas')
            .in('patch_panel_id', panelIds);
        if (bErr) return { ...empty, switches: (switches ?? []) as RackSwitch[], puertos, patchPanels: (patchPanels ?? []) as RackPatchPanel[], error: bErr.message };
        bocas = (b ?? []) as RackBoca[];
    }

    // Maestro global de plantillas de dispositivo (incluye inactivas: una boca
    // puede seguir referenciando una plantilla que luego se desactivó).
    // `nombre` es el texto a mostrar: "Zona · Dispositivo". Un dispositivo se
    // considera inactivo si él o su zona están desactivados.
    const { data: dispositivosRaw } = await db
        .from('dispositivo_plantillas')
        .select('id, nombre, activo, vlan_default, zona:dispositivo_zonas(nombre, activo)')
        .order('nombre', { ascending: true });
    const dispositivos: RackDispositivoPlantilla[] = (dispositivosRaw ?? []).map((d: any) => ({
        id: d.id,
        nombre: d.zona?.nombre ? `${d.zona.nombre} · ${d.nombre}` : d.nombre,
        dispositivo: d.nombre,
        zona: d.zona?.nombre ?? null,
        vlan_default: d.vlan_default ?? null,
        activo: !!d.activo && (d.zona?.activo ?? true),
    }));

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
        dispositivos,
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
    dispositivoPlantillaId?: string | null;
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

    // Cruzada a Patch Panel y conexión directa son mutuamente excluyentes.
    const cruzadoBocaId = input.cruzadoBocaId?.trim() || null;
    const plantillaId = cruzadoBocaId ? null : (input.dispositivoPlantillaId?.trim() || null);

    const { data: puertoActual } = await db
        .from('proyecto_puertos').select('id, dispositivo_plantilla_id')
        .eq('switch_id', switchId).eq('numero_puerto', numeroPuerto).maybeSingle();

    // VLAN heredada del dispositivo (directo) o del dispositivo de la boca (cruzada).
    let vlanHeredada: number | null = null;

    if (plantillaId) {
        const { data: pl } = await db
            .from('dispositivo_plantillas').select('id, activo, vlan_default').eq('id', plantillaId).maybeSingle();
        if (!pl) return { error: 'La plantilla de dispositivo no existe.' };
        // Una plantilla desactivada solo puede mantenerse si el puerto ya la usaba.
        if (!pl.activo && puertoActual?.dispositivo_plantilla_id !== plantillaId) {
            return { error: 'La plantilla seleccionada está desactivada.' };
        }
        vlanHeredada = pl.vlan_default ?? null;
    }

    // Si se cruza a una boca, debe pertenecer al mismo proyecto y no estar ya cruzada.
    if (cruzadoBocaId) {
        const { data: boca } = await db
            .from('proyecto_bocas')
            .select('id, proyecto_patch_panels!inner(proyecto_id), plantilla:dispositivo_plantillas(vlan_default)')
            .eq('id', cruzadoBocaId)
            .maybeSingle();
        const proyectoBoca = (boca as any)?.proyecto_patch_panels?.proyecto_id;
        if (!boca || proyectoBoca !== proyectoId) {
            return { error: 'La boca seleccionada no pertenece a este proyecto.' };
        }

        const { data: yaCruzada } = await db
            .from('proyecto_puertos').select('id').eq('cruzado_boca_id', cruzadoBocaId).maybeSingle();
        if (yaCruzada && yaCruzada.id !== puertoActual?.id) {
            return { error: 'Esa boca ya está cruzada a otro puerto de switch.' };
        }
        vlanHeredada = (boca as any).plantilla?.vlan_default ?? null;
    }

    const v = parseVlan(input.vlan);
    if ('error' in v) return { error: v.error };
    const vlan = v.vlan ?? vlanHeredada;

    const { error } = await db
        .from('proyecto_puertos')
        .upsert(
            {
                switch_id: switchId,
                numero_puerto: numeroPuerto,
                rol,
                es_poe: esPoe,
                // El equipo de la Receta quedó en desuso: se limpia al guardar.
                proyecto_equipamiento_id: null,
                dispositivo_plantilla_id: plantillaId,
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

// ── Autogenerar bocas (carga masiva + cruzada masiva opcional) ──────────────
export interface AutogenerarBocasInput {
    proyectoId: string;
    patchPanelId: string;
    desde: number;
    hasta: number;
    /** Etiquetas correlativas: "<prefijo> <inicio>", "<prefijo> <inicio+1>"… (sin prefijo, solo el número). */
    etiqueta?: { prefijo: string; inicio: number } | null;
    dispositivoPlantillaId?: string | null;
    /** false: solo crea las bocas que faltan. true: también actualiza las existentes del rango. */
    actualizarExistentes?: boolean;
    /** Cruza Boca `desde` → Puerto `puertoInicial`, y así en secuencia. */
    cruzada?: { switchId: string; puertoInicial: number; vlan?: number | null } | null;
}

const puertoOcupado = (p: { proyecto_equipamiento_id: string | null; dispositivo_plantilla_id: string | null; inventario_id: string | null }) =>
    !!(p.proyecto_equipamiento_id || p.dispositivo_plantilla_id || p.inventario_id);

export async function autogenerarBocasAction(input: AutogenerarBocasInput) {
    const guard = await requireGestor();
    if ('error' in guard) return { error: guard.error };

    const { proyectoId, patchPanelId, desde, hasta } = input;
    if (!patchPanelId) return { error: 'Patch panel no identificado.' };
    if (!Number.isInteger(desde) || !Number.isInteger(hasta) || desde < 1 || hasta < desde) {
        return { error: 'Rango de bocas inválido.' };
    }

    const db = createAdminClient();
    const { data: panel } = await db
        .from('proyecto_patch_panels').select('num_bocas').eq('id', patchPanelId).eq('proyecto_id', proyectoId).maybeSingle();
    if (!panel) return { error: 'El patch panel no pertenece a este proyecto.' };
    if (hasta > panel.num_bocas) return { error: `El rango no puede superar ${panel.num_bocas} bocas.` };

    const plantillaId = input.dispositivoPlantillaId?.trim() || null;
    if (plantillaId) {
        const { data: pl } = await db
            .from('dispositivo_plantillas').select('id, activo').eq('id', plantillaId).maybeSingle();
        if (!pl) return { error: 'La plantilla de dispositivo no existe.' };
        if (!pl.activo) return { error: 'La plantilla seleccionada está desactivada.' };
    }

    const prefijo = input.etiqueta?.prefijo?.trim() ?? '';
    const inicioEtiqueta = input.etiqueta ? Math.trunc(input.etiqueta.inicio) : 0;
    if (input.etiqueta && (!Number.isFinite(inicioEtiqueta) || inicioEtiqueta < 0)) {
        return { error: 'El número inicial de la etiqueta es inválido.' };
    }

    // ── Validación previa de la cruzada masiva (antes de escribir nada) ──────
    const cruz = input.cruzada ?? null;
    let vlanExplicita: number | null = null;
    if (cruz) {
        if (!cruz.switchId) return { error: 'Selecciona el switch para la cruzada.' };
        if (!Number.isInteger(cruz.puertoInicial) || cruz.puertoInicial < 1) return { error: 'Puerto inicial inválido.' };
        const v = parseVlan(cruz.vlan);
        if ('error' in v) return { error: v.error };
        vlanExplicita = v.vlan;

        const { data: sw } = await db
            .from('proyecto_switches').select('id, num_puertos')
            .eq('id', cruz.switchId).eq('proyecto_id', proyectoId).maybeSingle();
        if (!sw) return { error: 'El switch no pertenece a este proyecto.' };

        const ultimo = cruz.puertoInicial + (hasta - desde);
        if (ultimo > sw.num_puertos) {
            return { error: `Las ${hasta - desde + 1} bocas llegarían hasta el puerto ${ultimo}, pero el switch tiene ${sw.num_puertos}.` };
        }

        const [{ data: bocasExist }, { data: puertosObj }] = await Promise.all([
            db.from('proyecto_bocas').select('id, numero_boca')
                .eq('patch_panel_id', patchPanelId).gte('numero_boca', desde).lte('numero_boca', hasta),
            db.from('proyecto_puertos')
                .select('id, numero_puerto, cruzado_boca_id, proyecto_equipamiento_id, dispositivo_plantilla_id, inventario_id')
                .eq('switch_id', cruz.switchId).gte('numero_puerto', cruz.puertoInicial).lte('numero_puerto', ultimo),
        ]);

        const bocaExistente = new Map((bocasExist ?? []).map(b => [b.numero_boca, b.id as string]));
        const cruzadasDeBocas = (bocasExist ?? []).length
            ? (await db.from('proyecto_puertos').select('id, cruzado_boca_id')
                .in('cruzado_boca_id', (bocasExist ?? []).map(b => b.id))).data ?? []
            : [];
        const puertoDeBoca = new Map(cruzadasDeBocas.map(c => [c.cruzado_boca_id as string, c.id as string]));
        const puertoPorNumero = new Map((puertosObj ?? []).map(p => [p.numero_puerto, p]));

        const conflictos: string[] = [];
        for (let n = desde; n <= hasta; n++) {
            const pn = cruz.puertoInicial + (n - desde);
            const destino = puertoPorNumero.get(pn);
            const bocaId = bocaExistente.get(n);
            if (destino && puertoOcupado(destino as any)) {
                conflictos.push(`Puerto ${pn} ya tiene un dispositivo asignado`);
            } else if (destino?.cruzado_boca_id && destino.cruzado_boca_id !== bocaId) {
                conflictos.push(`Puerto ${pn} ya está cruzado a otra boca`);
            } else if (bocaId && puertoDeBoca.get(bocaId) && puertoDeBoca.get(bocaId) !== destino?.id) {
                conflictos.push(`Boca ${n} ya está cruzada a otro puerto`);
            }
        }
        if (conflictos.length > 0) {
            const resto = conflictos.length > 4 ? ` (+${conflictos.length - 4} más)` : '';
            return { error: `No se pudo cruzar: ${conflictos.slice(0, 4).join('; ')}${resto}. No se hizo ningún cambio.` };
        }
    }

    // ── Bocas ───────────────────────────────────────────────────────────────
    const filas: Record<string, unknown>[] = [];
    for (let n = desde; n <= hasta; n++) {
        const fila: Record<string, unknown> = { patch_panel_id: patchPanelId, numero_boca: n };
        // Solo se incluyen las columnas pedidas: en un upsert con actualización, las
        // columnas omitidas conservan su valor actual (no se pisan con null).
        if (input.etiqueta) {
            const correlativo = inicioEtiqueta + (n - desde);
            fila.etiqueta_libre = prefijo ? `${prefijo} ${correlativo}` : String(correlativo);
        }
        if (plantillaId) fila.dispositivo_plantilla_id = plantillaId;
        filas.push(fila);
    }

    const { error } = await db
        .from('proyecto_bocas')
        .upsert(filas, { onConflict: 'patch_panel_id,numero_boca', ignoreDuplicates: !input.actualizarExistentes });

    if (error) {
        console.error('[autogenerarBocasAction]', error.message);
        return { error: error.message || 'No se pudieron autogenerar las bocas.' };
    }

    // ── Cruzada masiva ──────────────────────────────────────────────────────
    let cruzadas = 0;
    if (cruz) {
        const { data: bocas } = await db
            .from('proyecto_bocas').select('id, numero_boca, dispositivo_plantilla_id')
            .eq('patch_panel_id', patchPanelId).gte('numero_boca', desde).lte('numero_boca', hasta);

        const plantillaIds = [...new Set((bocas ?? []).map(b => b.dispositivo_plantilla_id).filter(Boolean))] as string[];
        const vlanPorPlantilla = new Map<string, number | null>();
        if (plantillaIds.length) {
            const { data: pls } = await db.from('dispositivo_plantillas').select('id, vlan_default').in('id', plantillaIds);
            (pls ?? []).forEach(p => vlanPorPlantilla.set(p.id, p.vlan_default ?? null));
        }

        const ultimo = cruz.puertoInicial + (hasta - desde);
        const { data: existentes } = await db
            .from('proyecto_puertos').select('numero_puerto, vlan')
            .eq('switch_id', cruz.switchId).gte('numero_puerto', cruz.puertoInicial).lte('numero_puerto', ultimo);
        const vlanExistente = new Map((existentes ?? []).map(p => [p.numero_puerto, p.vlan as number | null]));

        const filasPuertos = (bocas ?? []).map(b => {
            const pn = cruz.puertoInicial + (b.numero_boca - desde);
            return {
                switch_id: cruz.switchId,
                numero_puerto: pn,
                cruzado_boca_id: b.id,
                vlan: vlanExplicita
                    ?? (b.dispositivo_plantilla_id ? vlanPorPlantilla.get(b.dispositivo_plantilla_id) ?? null : null)
                    ?? vlanExistente.get(pn)
                    ?? null,
                actualizado_por: guard.user.id,
            };
        });

        // Solo se envían estas columnas: rol/PoE/etiqueta/notas de puertos existentes se conservan.
        const { error: cErr } = await db
            .from('proyecto_puertos').upsert(filasPuertos, { onConflict: 'switch_id,numero_puerto' });
        if (cErr) {
            console.error('[autogenerarBocasAction:cruzada]', cErr.message);
            return { error: `Las bocas se crearon, pero no se pudo cruzar: ${cErr.message}` };
        }
        cruzadas = filasPuertos.length;
    }

    revalidatePath(rutaProyecto(proyectoId));
    return { success: true, cruzadas };
}

// ── Asignación de bocas ──────────────────────────────────────────────────────
export interface AsignarBocaInput {
    proyectoId: string;
    patchPanelId: string;
    numeroBoca: number;
    dispositivoPlantillaId?: string | null;
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

    const plantillaId = input.dispositivoPlantillaId?.trim() || null;
    if (plantillaId) {
        const { data: pl } = await db
            .from('dispositivo_plantillas').select('id, activo').eq('id', plantillaId).maybeSingle();
        if (!pl) return { error: 'La plantilla de dispositivo no existe.' };

        // Una plantilla desactivada solo puede mantenerse si la boca ya la usaba.
        if (!pl.activo) {
            const { data: actual } = await db
                .from('proyecto_bocas').select('dispositivo_plantilla_id')
                .eq('patch_panel_id', patchPanelId).eq('numero_boca', numeroBoca).maybeSingle();
            if (actual?.dispositivo_plantilla_id !== plantillaId) {
                return { error: 'La plantilla seleccionada está desactivada.' };
            }
        }
    }

    const { data: guardada, error } = await db
        .from('proyecto_bocas')
        .upsert(
            {
                patch_panel_id: patchPanelId,
                numero_boca: numeroBoca,
                dispositivo_plantilla_id: plantillaId,
                etiqueta_libre: input.etiquetaLibre?.trim() || null,
                notas: input.notas?.trim() || null,
                actualizado_por: guard.user.id,
            },
            { onConflict: 'patch_panel_id,numero_boca' },
        )
        .select('id')
        .single();

    if (error) {
        console.error('[asignarBocaAction]', error.message);
        return { error: error.message || 'No se pudo guardar la boca.' };
    }

    revalidatePath(rutaProyecto(proyectoId));
    return { success: true, bocaId: guardada.id as string };
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

// ── Cruzar / descruzar una boca desde el modal de la boca ───────────────────
export async function cruzarBocaAction(input: {
    proyectoId: string;
    bocaId: string;
    /** null = dejar la boca sin cruzar. */
    switchId: string | null;
    numeroPuerto: number | null;
    vlan?: number | null;
}) {
    const guard = await requireGestor();
    if ('error' in guard) return { error: guard.error };

    const { proyectoId, bocaId } = input;
    if (!bocaId) return { error: 'Boca no identificada.' };

    const db = createAdminClient();
    const { data: boca } = await db
        .from('proyecto_bocas')
        .select('id, proyecto_patch_panels!inner(proyecto_id), plantilla:dispositivo_plantillas(vlan_default)')
        .eq('id', bocaId).maybeSingle();
    if (!boca || (boca as any).proyecto_patch_panels?.proyecto_id !== proyectoId) {
        return { error: 'La boca no pertenece a este proyecto.' };
    }

    const { data: actual } = await db
        .from('proyecto_puertos').select('id').eq('cruzado_boca_id', bocaId).maybeSingle();

    // Descruzar: se conserva el puerto (rol, PoE, VLAN…), solo pierde el vínculo.
    if (!input.switchId || !input.numeroPuerto) {
        if (actual) {
            const { error } = await db.from('proyecto_puertos').update({ cruzado_boca_id: null }).eq('id', actual.id);
            if (error) return { error: error.message || 'No se pudo quitar la cruzada.' };
        }
        revalidatePath(rutaProyecto(proyectoId));
        return { success: true };
    }

    const { data: sw } = await db
        .from('proyecto_switches').select('id, num_puertos')
        .eq('id', input.switchId).eq('proyecto_id', proyectoId).maybeSingle();
    if (!sw) return { error: 'El switch no pertenece a este proyecto.' };
    if (!Number.isInteger(input.numeroPuerto) || input.numeroPuerto < 1 || input.numeroPuerto > sw.num_puertos) {
        return { error: `El puerto debe estar entre 1 y ${sw.num_puertos}.` };
    }

    const { data: destino } = await db
        .from('proyecto_puertos')
        .select('id, cruzado_boca_id, proyecto_equipamiento_id, dispositivo_plantilla_id, inventario_id, vlan')
        .eq('switch_id', input.switchId).eq('numero_puerto', input.numeroPuerto).maybeSingle();
    if (destino && puertoOcupado(destino as any)) {
        return { error: `El puerto ${input.numeroPuerto} ya tiene un dispositivo asignado directamente.` };
    }
    if (destino?.cruzado_boca_id && destino.cruzado_boca_id !== bocaId) {
        return { error: `El puerto ${input.numeroPuerto} ya está cruzado a otra boca.` };
    }

    const v = parseVlan(input.vlan);
    if ('error' in v) return { error: v.error };
    const vlan = v.vlan ?? (boca as any).plantilla?.vlan_default ?? destino?.vlan ?? null;

    // Si estaba cruzada a otro puerto, se suelta primero (índice único 1:1).
    if (actual && actual.id !== destino?.id) {
        const { error } = await db.from('proyecto_puertos').update({ cruzado_boca_id: null }).eq('id', actual.id);
        if (error) return { error: error.message || 'No se pudo mover la cruzada.' };
    }

    const { error } = await db
        .from('proyecto_puertos')
        .upsert(
            {
                switch_id: input.switchId,
                numero_puerto: input.numeroPuerto,
                cruzado_boca_id: bocaId,
                vlan,
                actualizado_por: guard.user.id,
            },
            { onConflict: 'switch_id,numero_puerto' },
        );
    if (error) {
        console.error('[cruzarBocaAction]', error.message);
        return { error: error.message || 'No se pudo cruzar la boca.' };
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
