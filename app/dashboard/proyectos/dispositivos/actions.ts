'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

export interface DispositivoItem {
    id: string;
    nombre: string;
    activo: boolean;
    zona_id: string | null;
    vlan_default: number | null;
    en_uso: number;
}

export interface ZonaDispositivos {
    id: string;
    nombre: string;
    activo: boolean;
    dispositivos: DispositivoItem[];
}

export interface DispositivosData {
    zonas: ZonaDispositivos[];
    sinZona: DispositivoItem[];
}

const MAX_NOMBRE = 80;

// Solo ADMIN. Rol verificado con la sesión; mutación con service-role (patrón del rack).
async function assertAdmin(): Promise<{ userId: string } | { error: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'No autenticado.' };

    const { data: profile } = await supabase
        .from('profiles').select('rol').eq('id', user.id).maybeSingle();
    if (profile?.rol?.toUpperCase() !== 'ADMIN')
        return { error: 'Solo el administrador puede gestionar zonas y dispositivos.' };

    return { userId: user.id };
}

function refrescar() {
    revalidatePath('/dashboard/proyectos');
    revalidatePath('/dashboard/proyectos', 'layout');
}

function validarVlan(raw: number | null | undefined): { vlan: number | null } | { error: string } {
    if (raw == null || !Number.isFinite(raw)) return { vlan: null };
    const v = Math.trunc(raw);
    if (v < 1 || v > 4094) return { error: 'La VLAN debe estar entre 1 y 4094.' };
    return { vlan: v };
}

function validarNombre(nombre: string): { nombre: string } | { error: string } {
    const limpio = nombre?.trim();
    if (!limpio) return { error: 'El nombre es obligatorio.' };
    if (limpio.length > MAX_NOMBRE) return { error: `El nombre no puede superar ${MAX_NOMBRE} caracteres.` };
    return { nombre: limpio };
}

export async function getZonasConDispositivos(): Promise<DispositivosData> {
    const db = createAdminClient();
    const [{ data: zonas }, { data: dispositivos }, { data: usosBocas }, { data: usosPuertos }] = await Promise.all([
        db.from('dispositivo_zonas').select('id, nombre, activo').order('nombre', { ascending: true }),
        db.from('dispositivo_plantillas').select('id, nombre, activo, zona_id, vlan_default').order('nombre', { ascending: true }),
        db.from('proyecto_bocas').select('dispositivo_plantilla_id').not('dispositivo_plantilla_id', 'is', null),
        db.from('proyecto_puertos').select('dispositivo_plantilla_id').not('dispositivo_plantilla_id', 'is', null),
    ]);

    // Usos = bocas de patch panel + puertos de switch (conexión directa).
    const conteo = new Map<string, number>();
    [...(usosBocas ?? []), ...(usosPuertos ?? [])].forEach((u: any) => {
        conteo.set(u.dispositivo_plantilla_id, (conteo.get(u.dispositivo_plantilla_id) ?? 0) + 1);
    });

    const items: DispositivoItem[] = (dispositivos ?? []).map((d: any) => ({ ...d, en_uso: conteo.get(d.id) ?? 0 }));

    return {
        zonas: (zonas ?? []).map((z: any) => ({ ...z, dispositivos: items.filter(d => d.zona_id === z.id) })),
        sinZona: items.filter(d => !d.zona_id),
    };
}

// ── Zonas ───────────────────────────────────────────────────────────────────
export async function crearZonaAction(nombre: string) {
    const guard = await assertAdmin();
    if ('error' in guard) return { error: guard.error };
    const v = validarNombre(nombre);
    if ('error' in v) return { error: v.error };

    const db = createAdminClient();
    const { data, error } = await db
        .from('dispositivo_zonas').insert({ nombre: v.nombre, creado_por: guard.userId }).select('id').single();
    if (error) {
        if (error.code === '23505') return { error: 'Ya existe una zona con ese nombre.' };
        return { error: error.message || 'No se pudo crear la zona.' };
    }

    refrescar();
    return { success: true, id: data.id as string };
}

export async function renombrarZonaAction(id: string, nombre: string) {
    const guard = await assertAdmin();
    if ('error' in guard) return { error: guard.error };
    if (!id) return { error: 'Zona no identificada.' };
    const v = validarNombre(nombre);
    if ('error' in v) return { error: v.error };

    const db = createAdminClient();
    const { error } = await db.from('dispositivo_zonas').update({ nombre: v.nombre }).eq('id', id);
    if (error) {
        if (error.code === '23505') return { error: 'Ya existe una zona con ese nombre.' };
        return { error: error.message || 'No se pudo renombrar la zona.' };
    }

    refrescar();
    return { success: true };
}

export async function toggleZonaAction(id: string, activo: boolean) {
    const guard = await assertAdmin();
    if ('error' in guard) return { error: guard.error };
    if (!id) return { error: 'Zona no identificada.' };

    const db = createAdminClient();
    const { error } = await db.from('dispositivo_zonas').update({ activo }).eq('id', id);
    if (error) return { error: error.message || 'No se pudo actualizar la zona.' };

    refrescar();
    return { success: true };
}

export async function eliminarZonaAction(id: string) {
    const guard = await assertAdmin();
    if ('error' in guard) return { error: guard.error };
    if (!id) return { error: 'Zona no identificada.' };

    const db = createAdminClient();
    const { error } = await db.from('dispositivo_zonas').delete().eq('id', id);
    if (error) {
        // FK RESTRICT desde dispositivo_plantillas.zona_id
        if (error.code === '23503') return { error: 'La zona tiene dispositivos. Elimínalos o muévelos primero (o desactiva la zona).' };
        return { error: error.message || 'No se pudo eliminar la zona.' };
    }

    refrescar();
    return { success: true };
}

// ── Dispositivos ────────────────────────────────────────────────────────────
export async function crearDispositivoAction(zonaId: string, nombre: string, vlanDefault?: number | null) {
    const guard = await assertAdmin();
    if ('error' in guard) return { error: guard.error };
    if (!zonaId) return { error: 'Selecciona una zona.' };
    const v = validarNombre(nombre);
    if ('error' in v) return { error: v.error };
    const vl = validarVlan(vlanDefault);
    if ('error' in vl) return { error: vl.error };

    const db = createAdminClient();
    const { error } = await db
        .from('dispositivo_plantillas')
        .insert({ nombre: v.nombre, zona_id: zonaId, vlan_default: vl.vlan, creado_por: guard.userId });
    if (error) {
        if (error.code === '23505') return { error: 'Ya existe un dispositivo con ese nombre en esta zona.' };
        return { error: error.message || 'No se pudo crear el dispositivo.' };
    }

    refrescar();
    return { success: true };
}

export async function actualizarDispositivoAction(id: string, nombre: string, zonaId: string, vlanDefault?: number | null) {
    const guard = await assertAdmin();
    if ('error' in guard) return { error: guard.error };
    if (!id) return { error: 'Dispositivo no identificado.' };
    if (!zonaId) return { error: 'Selecciona una zona.' };
    const v = validarNombre(nombre);
    if ('error' in v) return { error: v.error };
    const vl = validarVlan(vlanDefault);
    if ('error' in vl) return { error: vl.error };

    const db = createAdminClient();
    const { error } = await db
        .from('dispositivo_plantillas')
        .update({ nombre: v.nombre, zona_id: zonaId, vlan_default: vl.vlan }).eq('id', id);
    if (error) {
        if (error.code === '23505') return { error: 'Ya existe un dispositivo con ese nombre en esa zona.' };
        return { error: error.message || 'No se pudo actualizar el dispositivo.' };
    }

    refrescar();
    return { success: true };
}

export async function toggleDispositivoAction(id: string, activo: boolean) {
    const guard = await assertAdmin();
    if ('error' in guard) return { error: guard.error };
    if (!id) return { error: 'Dispositivo no identificado.' };

    const db = createAdminClient();
    const { error } = await db.from('dispositivo_plantillas').update({ activo }).eq('id', id);
    if (error) return { error: error.message || 'No se pudo actualizar el dispositivo.' };

    refrescar();
    return { success: true };
}

export async function eliminarDispositivoAction(id: string) {
    const guard = await assertAdmin();
    if ('error' in guard) return { error: guard.error };
    if (!id) return { error: 'Dispositivo no identificado.' };

    const db = createAdminClient();
    const { error } = await db.from('dispositivo_plantillas').delete().eq('id', id);
    if (error) {
        // FK RESTRICT desde proyecto_bocas / proyecto_puertos .dispositivo_plantilla_id
        if (error.code === '23503') return { error: 'El dispositivo está asignado a bocas o puertos. Desactívalo en vez de eliminarlo.' };
        return { error: error.message || 'No se pudo eliminar el dispositivo.' };
    }

    refrescar();
    return { success: true };
}
