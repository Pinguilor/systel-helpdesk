'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { getFormData, getPlantillasChecklist, getPlantillasBOM } from '../actions';
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

export interface LocalMasivo {
    id: string;
    nombre_restaurante: string;
    sigla: string;
    cliente_id: string | null;
    /** Nombres de sus proyectos activos (informativo: un local puede tener proyectos en paralelo). */
    proyectos_activos: string[];
}

/**
 * Datos para la página "Nuevo Rollout": locales (con su proyecto activo, si lo hay),
 * empresas, coordinadores y las plantillas disponibles.
 */
export async function getDatosNuevoMasivo() {
    const user = await requireProyectosRole();
    if (!user) throw new Error('Acceso denegado: Permisos insuficientes');

    const db = createAdminClient();
    const [form, plantillasChecklist, recetasBOM, activos] = await Promise.all([
        getFormData(),
        getPlantillasChecklist(),
        getPlantillasBOM(),
        // Proyectos activos por local (solo informativo)
        db.from('proyectos')
            .select('nombre, cliente_id')
            .not('cliente_id', 'is', null)
            .eq('es_campana_masiva', false)
            .eq('oculto', false)
            .not('estado', 'in', '(completado,cancelado)'),
    ]);
    if (activos.error) throw activos.error;

    const activosPorLocal = new Map<string, string[]>();
    for (const p of activos.data ?? []) {
        if (p.cliente_id) activosPorLocal.set(p.cliente_id, [...(activosPorLocal.get(p.cliente_id) ?? []), p.nombre]);
    }

    const locales: LocalMasivo[] = form.sucursales.map(s => ({
        ...s,
        proyectos_activos: activosPorLocal.get(s.id) ?? [],
    }));

    return {
        empresas: form.empresas,
        coordinadores: form.coordinadores,
        locales,
        plantillasChecklist,
        recetasBOM,
    };
}

export interface CrearProyectoMasivoInput {
    nombre: string;
    descripcion?: string | null;
    coordinadorId?: string | null;
    fechaInicio?: string | null;
    fechaFinEstimada?: string | null;
    localIds: string[];
    plantillaChecklistId?: string | null;
    recetaBomId?: string | null;
}

export type CrearProyectoMasivoResult =
    | { error: string; proyectoPadreId?: undefined; creados?: undefined }
    | { error: null; proyectoPadreId: string; creados: number };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Crea el Rollout (padre) y un proyecto hijo por local en una sola transacción
 * (RPC crear_proyecto_masivo). Si algo falla no queda nada creado.
 */
export async function crearProyectoMasivoAction(
    input: CrearProyectoMasivoInput
): Promise<CrearProyectoMasivoResult> {
    const user = await requireProyectosRole();
    if (!user) return { error: 'No autorizado.' };

    const nombre = input.nombre?.trim();
    if (!nombre) return { error: 'El nombre del Rollout es obligatorio.' };

    const localIds = [...new Set(input.localIds ?? [])];
    if (localIds.length === 0) return { error: 'Selecciona al menos un local.' };
    if (localIds.some(id => !UUID_RE.test(id))) return { error: 'La selección de locales no es válida.' };

    if (input.fechaInicio && input.fechaFinEstimada && input.fechaFinEstimada < input.fechaInicio) {
        return { error: 'La fecha de término estimada no puede ser anterior a la de inicio.' };
    }

    const db = createAdminClient();
    const { data, error } = await db.rpc('crear_proyecto_masivo', {
        p_nombre:                 nombre,
        p_descripcion:            input.descripcion?.trim() || null,
        p_coordinador_id:         input.coordinadorId || null,
        p_fecha_inicio:           input.fechaInicio || null,
        p_fecha_fin_estimada:     input.fechaFinEstimada || null,
        p_local_ids:              localIds,
        p_plantilla_checklist_id: input.plantillaChecklistId || null,
        p_receta_bom_id:          input.recetaBomId || null,
        p_creado_por:             user.id,
    });

    if (error) return { error: traducirErrorRpc(error.message) };

    const resultado = data as { proyecto_padre_id: string; creados: number };
    revalidatePath('/dashboard/proyectos');
    return { error: null, proyectoPadreId: resultado.proyecto_padre_id, creados: resultado.creados };
}
