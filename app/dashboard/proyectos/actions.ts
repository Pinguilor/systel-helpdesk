'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import type { ProyectoEstado } from '@/types/proyectos.types';

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

export async function getProyectos() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No autorizado');

    const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single();
    const rol = profile?.rol?.toUpperCase() || '';

    if (rol === 'TECNICO') {
        const { data, error } = await supabase
            .from('proyectos')
            .select(`
                *,
                cliente:restaurantes(nombre_restaurante, sigla),
                coordinador:profiles!coordinador_id(full_name),
                proyecto_participantes!inner(perfil_id)
            `)
            .eq('proyecto_participantes.perfil_id', user.id)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data ?? [];
    } else {
        const { data, error } = await supabase
            .from('proyectos')
            .select(`
                *,
                cliente:restaurantes(nombre_restaurante, sigla),
                coordinador:profiles!coordinador_id(full_name)
            `)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data ?? [];
    }
}

export async function crearProyecto(
    _prevState: { error: string | null },
    formData: FormData
): Promise<{ error: string | null }> {
    const user = await requireProyectosRole();
    if (!user) throw new Error('Acceso denegado: Permisos insuficientes');

    const nombre = (formData.get('nombre') as string)?.trim();
    if (!nombre) return { error: 'El nombre del proyecto es obligatorio.' };

    const db = createAdminClient();
    const { error } = await db.from('proyectos').insert({
        nombre,
        descripcion: (formData.get('descripcion') as string)?.trim() || null,
        cliente_id: (formData.get('cliente_id') as string) || null,
        coordinador_id: (formData.get('coordinador_id') as string) || null,
        fecha_inicio: (formData.get('fecha_inicio') as string) || null,
        fecha_fin_estimada: (formData.get('fecha_fin_estimada') as string) || null,
        creado_por: user.id,
    });

    if (error) return { error: error.message };
    revalidatePath('/dashboard/proyectos');
    return { error: null };
}

export async function editarProyecto(
    _prevState: { error: string | null },
    formData: FormData
): Promise<{ error: string | null }> {
    const user = await requireProyectosRole();
    if (!user) return { error: 'No autorizado.' };

    const id = (formData.get('proyecto_id') as string)?.trim();
    if (!id) return { error: 'ID del proyecto no encontrado.' };

    const nombre = (formData.get('nombre') as string)?.trim();
    if (!nombre) return { error: 'El nombre del proyecto es obligatorio.' };

    const db = createAdminClient();
    const { error } = await db
        .from('proyectos')
        .update({
            nombre,
            descripcion:        (formData.get('descripcion')        as string)?.trim() || null,
            cliente_id:         (formData.get('cliente_id')         as string) || null,
            coordinador_id:     (formData.get('coordinador_id')     as string) || null,
            fecha_inicio:       (formData.get('fecha_inicio')       as string) || null,
            fecha_fin_estimada: (formData.get('fecha_fin_estimada') as string) || null,
            updated_at: new Date().toISOString(),
        })
        .eq('id', id);

    if (error) return { error: error.message };
    revalidatePath('/dashboard/proyectos');
    return { error: null };
}

export async function eliminarProyecto(id: string): Promise<{ error: string | null }> {
    const user = await requireProyectosRole();
    if (!user) return { error: 'No autorizado.' };

    const db = createAdminClient();
    const { error } = await db.from('proyectos').delete().eq('id', id);
    if (error) return { error: error.message };

    revalidatePath('/dashboard/proyectos');
    return { error: null };
}

export async function actualizarEstadoProyecto(
    id: string,
    estado: ProyectoEstado
): Promise<{ error: string | null }> {
    const user = await requireProyectosRole();
    if (!user) return { error: 'No autorizado.' };

    const db = createAdminClient();
    const { error } = await db
        .from('proyectos')
        .update({ estado, updated_at: new Date().toISOString() })
        .eq('id', id);

    if (error) return { error: error.message };
    revalidatePath('/dashboard/proyectos');
    revalidatePath(`/dashboard/proyectos/${id}`);
    return { error: null };
}

export async function getFormData() {
    const supabase = await createClient();
    const [empresasRes, sucursalesRes, coordsRes] = await Promise.all([
        // Empresas padre (tabla clientes)
        supabase
            .from('clientes')
            .select('id, nombre_fantasia')
            .eq('activo', true)
            .order('nombre_fantasia'),
        // Sucursales (tabla restaurantes) — incluye cliente_id para el filtro
        supabase
            .from('restaurantes')
            .select('id, nombre_restaurante, sigla, cliente_id')
            .order('nombre_restaurante'),
        // Coordinadores
        supabase
            .from('profiles')
            .select('id, full_name')
            .in('rol', ['admin', 'coordinador'])
            .order('full_name'),
    ]);

    // Deduplicar por ID (por si hay RLS duplicating rows)
    const empresas  = Array.from(new Map((empresasRes.data  ?? []).map(e => [e.id, e])).values());
    const sucursales = Array.from(new Map((sucursalesRes.data ?? []).map(s => [s.id, s])).values());

    return {
        empresas,
        sucursales,
        coordinadores: coordsRes.data ?? [],
    };
}

// ── Checklist Templates CRUD ───────────────────────────────────────────
export async function getPlantillasChecklist() {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('proyecto_plantillas_checklist')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
}

export async function crearPlantillaChecklistAction(
    nombre: string,
    tareas: string[]
): Promise<{ error: string | null }> {
    const user = await requireProyectosRole();
    if (!user) throw new Error('Acceso denegado: Permisos insuficientes');

    const db = createAdminClient();
    const { error } = await db.from('proyecto_plantillas_checklist').insert({
        nombre,
        tareas,
        creado_por: user.id,
    });

    if (error) return { error: error.message };
    revalidatePath('/dashboard/proyectos');
    return { error: null };
}

export async function editarPlantillaChecklistAction(
    id: string,
    nombre: string,
    tareas: string[]
): Promise<{ error: string | null }> {
    const user = await requireProyectosRole();
    if (!user) throw new Error('Acceso denegado: Permisos insuficientes');

    const db = createAdminClient();
    const { error } = await db
        .from('proyecto_plantillas_checklist')
        .update({ nombre, tareas })
        .eq('id', id);

    if (error) return { error: error.message };
    revalidatePath('/dashboard/proyectos');
    return { error: null };
}

export async function eliminarPlantillaChecklistAction(
    id: string
): Promise<{ error: string | null }> {
    const user = await requireProyectosRole();
    if (!user) throw new Error('Acceso denegado: Permisos insuficientes');

    const db = createAdminClient();
    const { error } = await db
        .from('proyecto_plantillas_checklist')
        .delete()
        .eq('id', id);

    if (error) return { error: error.message };
    revalidatePath('/dashboard/proyectos');
    return { error: null };
}

// ── BOM Recipes CRUD ───────────────────────────────────────────────────
export async function getPlantillasBOM() {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('proyecto_plantillas_bom')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
}

export async function crearPlantillaBOMAction(
    nombre: string,
    items: any[]
): Promise<{ error: string | null }> {
    const user = await requireProyectosRole();
    if (!user) throw new Error('Acceso denegado: Permisos insuficientes');

    const db = createAdminClient();
    const { error } = await db.from('proyecto_plantillas_bom').insert({
        nombre,
        items,
        creado_por: user.id,
    });

    if (error) return { error: error.message };
    revalidatePath('/dashboard/proyectos');
    return { error: null };
}

export async function editarPlantillaBOMAction(
    id: string,
    nombre: string,
    items: any[]
): Promise<{ error: string | null }> {
    const user = await requireProyectosRole();
    if (!user) throw new Error('Acceso denegado: Permisos insuficientes');

    const db = createAdminClient();
    const { error } = await db
        .from('proyecto_plantillas_bom')
        .update({ nombre, items })
        .eq('id', id);

    if (error) return { error: error.message };
    revalidatePath('/dashboard/proyectos');
    return { error: null };
}

export async function eliminarPlantillaBOMAction(
    id: string
): Promise<{ error: string | null }> {
    const user = await requireProyectosRole();
    if (!user) throw new Error('Acceso denegado: Permisos insuficientes');

    const db = createAdminClient();
    const { error } = await db
        .from('proyecto_plantillas_bom')
        .delete()
        .eq('id', id);

    if (error) return { error: error.message };
    revalidatePath('/dashboard/proyectos');
    return { error: null };
}
