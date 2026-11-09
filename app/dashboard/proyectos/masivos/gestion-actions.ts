'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { getDatosNuevoMasivo } from './actions';
import { traducirErrorRpc } from './errores';

async function requireProyectosRole() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: profile } = await supabase
        .from('profiles').select('rol').eq('id', user.id).single();
    const rol = profile?.rol?.toUpperCase();
    if (rol !== 'ADMIN' && rol !== 'COORDINADOR') return null;
    return user;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Tipos del panel ─────────────────────────────────────────────────────────

export interface ResumenLocal {
    proyecto_id: string;
    nombre: string;
    estado: string;
    fecha_fin_estimada: string | null;
    sigla: string | null;
    local_nombre: string | null;
    tareas_total: number;
    tareas_completadas: number;
    tareas_pendientes: number;
    mat_requerido: number;
    mat_entregado: number;
    mat_instalado: number;
    ultima_actividad: string | null;
    acta_firmada: boolean;
}

export interface MaterialMasivo {
    inventario_id: string | null;
    familia: string;
    modelo: string;
    requerido: number;
    entregado: number;
    instalado: number;
    por_retirar: number;
    locales_pendientes: number;
    /** null en ítems manuales sin catálogo */
    stock_disponible: number | null;
}

export interface ExcepcionMasivo {
    id: string;
    proyecto_id: string;
    sigla: string | null;
    local_nombre: string | null;
    tarea: string;
    grupo: string | null;
    observacion: string | null;
    created_at: string;
}

export interface PanelMasivo {
    padre: {
        id: string;
        nombre: string;
        descripcion: string | null;
        estado: string;
        fecha_inicio: string | null;
        fecha_fin_estimada: string | null;
        coordinador: string | null;
    };
    locales: ResumenLocal[];
    excepciones: ExcepcionMasivo[];
    materiales: MaterialMasivo[];
}

/** Datos del panel de un Rollout: avance por local, tareas pendientes y materiales vs stock. */
export async function getPanelMasivo(padreId: string): Promise<PanelMasivo | null> {
    const user = await requireProyectosRole();
    if (!user) throw new Error('Acceso denegado: Permisos insuficientes');
    if (!UUID_RE.test(padreId)) return null;

    const db = createAdminClient();
    const { data: padre, error: padreErr } = await db
        .from('proyectos')
        .select('id, nombre, descripcion, estado, fecha_inicio, fecha_fin_estimada, coordinador:profiles!coordinador_id(full_name)')
        .eq('id', padreId)
        .eq('es_campana_masiva', true)
        .eq('oculto', false)
        .maybeSingle();
    if (padreErr) throw padreErr;
    if (!padre) return null;

    const [resumen, materiales] = await Promise.all([
        db.rpc('resumen_proyecto_masivo', { p_padre_id: padreId }),
        db.rpc('materiales_proyecto_masivo', { p_padre_id: padreId }),
    ]);
    if (resumen.error) throw resumen.error;
    if (materiales.error) throw materiales.error;

    const locales = (resumen.data ?? []) as ResumenLocal[];
    const porProyecto = new Map(locales.map(l => [l.proyecto_id, l]));

    let excepciones: ExcepcionMasivo[] = [];
    if (locales.length > 0) {
        const { data, error } = await db
            .from('bitacora_entradas')
            .select('id, proyecto_id, contenido, grupo, observacion, created_at')
            .in('proyecto_id', locales.map(l => l.proyecto_id))
            .eq('estado_revision', 'pendiente')
            .like('contenido', '[CHECKLIST]%')
            .order('created_at', { ascending: false })
            .limit(500);
        if (error) throw error;
        excepciones = (data ?? []).map(e => {
            const l = porProyecto.get(e.proyecto_id);
            return {
                id: e.id,
                proyecto_id: e.proyecto_id,
                sigla: l?.sigla ?? null,
                local_nombre: l?.local_nombre ?? null,
                tarea: String(e.contenido ?? '').replace(/^\[CHECKLIST\]\s*/, ''),
                grupo: e.grupo ?? null,
                observacion: e.observacion ?? null,
                created_at: e.created_at,
            };
        });
    }

    return {
        padre: {
            id: padre.id,
            nombre: padre.nombre,
            descripcion: padre.descripcion,
            estado: padre.estado,
            fecha_inicio: padre.fecha_inicio,
            fecha_fin_estimada: padre.fecha_fin_estimada,
            coordinador: (padre as any).coordinador?.full_name ?? null,
        },
        locales,
        excepciones,
        materiales: (materiales.data ?? []) as MaterialMasivo[],
    };
}

/** Datos para el modal "Agregar locales": locales que aún no están en este Rollout + plantillas. */
export async function getDatosAgregarMasivo(padreId: string) {
    const user = await requireProyectosRole();
    if (!user) throw new Error('Acceso denegado: Permisos insuficientes');
    if (!UUID_RE.test(padreId)) throw new Error('Rollout no válido');

    const [datos, yaEnMasivo] = await Promise.all([
        getDatosNuevoMasivo(),
        createAdminClient()
            .from('proyectos')
            .select('cliente_id')
            .eq('proyecto_padre_id', padreId)
            .eq('oculto', false),
    ]);
    if (yaEnMasivo.error) throw yaEnMasivo.error;

    const ocupados = new Set((yaEnMasivo.data ?? []).map(h => h.cliente_id).filter(Boolean));
    return {
        empresas: datos.empresas,
        locales: datos.locales.filter(l => !ocupados.has(l.id)),
        plantillasChecklist: datos.plantillasChecklist.map((p: any) => ({ id: p.id as string, nombre: p.nombre as string })),
        recetasBOM: datos.recetasBOM.map((r: any) => ({ id: r.id as string, nombre: r.nombre as string })),
    };
}

// ── Escritura ───────────────────────────────────────────────────────────────

export interface AgregarLocalesInput {
    padreId: string;
    localIds: string[];
    plantillaChecklistId?: string | null;
    recetaBomId?: string | null;
}

/** Suma locales nuevos a un Rollout existente (una transacción, misma lógica que la creación). */
export async function agregarLocalesMasivoAction(
    input: AgregarLocalesInput
): Promise<{ error: string | null; creados?: number }> {
    const user = await requireProyectosRole();
    if (!user) return { error: 'No autorizado.' };

    if (!UUID_RE.test(input.padreId)) return { error: 'Rollout no válido.' };
    const localIds = [...new Set(input.localIds ?? [])];
    if (localIds.length === 0) return { error: 'Selecciona al menos un local.' };
    if (localIds.some(id => !UUID_RE.test(id))) return { error: 'La selección de locales no es válida.' };

    const { data, error } = await createAdminClient().rpc('agregar_locales_proyecto_masivo', {
        p_padre_id:               input.padreId,
        p_local_ids:              localIds,
        p_plantilla_checklist_id: input.plantillaChecklistId || null,
        p_receta_bom_id:          input.recetaBomId || null,
        p_creado_por:             user.id,
    });
    if (error) return { error: traducirErrorRpc(error.message) };

    revalidatePath('/dashboard/proyectos');
    revalidatePath(`/dashboard/proyectos/masivos/${input.padreId}`);
    return { error: null, creados: (data as { creados: number }).creados };
}

/**
 * Quita locales de un Rollout SIN borrar nada: el proyecto se desvincula del padre y
 * sigue existiendo como proyecto normal, con su bitácora, materiales e historial intactos.
 */
export async function quitarLocalesMasivoAction(
    padreId: string,
    proyectoIds: string[]
): Promise<{ error: string | null; quitados?: number }> {
    const user = await requireProyectosRole();
    if (!user) return { error: 'No autorizado.' };

    if (!UUID_RE.test(padreId)) return { error: 'Rollout no válido.' };
    const ids = [...new Set(proyectoIds ?? [])];
    if (ids.length === 0) return { error: 'Selecciona al menos un local.' };
    if (ids.some(id => !UUID_RE.test(id))) return { error: 'La selección no es válida.' };

    const { data, error } = await createAdminClient()
        .from('proyectos')
        .update({ proyecto_padre_id: null, updated_at: new Date().toISOString() })
        .in('id', ids)
        .eq('proyecto_padre_id', padreId)
        .select('id');
    if (error) return { error: error.message };

    revalidatePath('/dashboard/proyectos');
    revalidatePath(`/dashboard/proyectos/masivos/${padreId}`);
    return { error: null, quitados: data?.length ?? 0 };
}
