'use server';

import { createClient }      from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath }    from 'next/cache';

async function requireBodegaRole() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: profile } = await supabase
        .from('profiles').select('rol').eq('id', user.id).single();
    const rol = profile?.rol?.toUpperCase();
    if (rol !== 'ADMIN' && rol !== 'ADMIN_BODEGA') return null;
    return user;
}

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface ProveedorDetalle {
    id:          string;
    nombre:      string;
    rut:         string | null;
    email:       string | null;
    telefono:    string | null;
    direccion:   string | null;
    created_at:  string;
    total_guias: number;
}

export interface ProveedorFormData {
    nombre:    string;
    rut:       string;
    email:     string;
    telefono:  string;
    direccion: string;
}

// ── Listar (paginado) ────────────────────────────────────────────────────────

export async function getProveedoresAdminAction(
    page     = 0,
    pageSize = 25,
): Promise<{ data: ProveedorDetalle[]; total: number; error?: string }> {
    const user = await requireBodegaRole();
    if (!user) return { data: [], total: 0, error: 'No autorizado.' };

    const db   = createAdminClient();
    const from = page * pageSize;
    const to   = from + pageSize - 1;

    const [provRes, countRes] = await Promise.all([
        db.from('proveedores')
            .select('id, nombre, rut, email, telefono, direccion, created_at')
            .order('nombre')
            .range(from, to),
        db.from('proveedores')
            .select('*', { count: 'exact', head: true }),
    ]);

    if (provRes.error) return { data: [], total: 0, error: provRes.error.message };

    const proveedores = provRes.data ?? [];
    if (!proveedores.length) return { data: [], total: (countRes as any).count ?? 0 };

    // Contar guías por proveedor
    const ids = proveedores.map(p => p.id as string);
    const { data: guiasData } = await db
        .from('guias_ingreso')
        .select('proveedor_id')
        .in('proveedor_id', ids);

    const guiasCount = new Map<string, number>();
    for (const g of guiasData ?? []) {
        const pid = g.proveedor_id as string;
        guiasCount.set(pid, (guiasCount.get(pid) ?? 0) + 1);
    }

    const data: ProveedorDetalle[] = proveedores.map(p => ({
        id:          p.id          as string,
        nombre:      p.nombre      as string,
        rut:         (p.rut        as string | null) ?? null,
        email:       (p.email      as string | null) ?? null,
        telefono:    (p.telefono   as string | null) ?? null,
        direccion:   (p.direccion  as string | null) ?? null,
        created_at:  p.created_at  as string,
        total_guias: guiasCount.get(p.id as string) ?? 0,
    }));

    return { data, total: (countRes as any).count ?? 0 };
}

// ── Crear ────────────────────────────────────────────────────────────────────

export async function crearProveedorAdminAction(
    formData: ProveedorFormData,
): Promise<{ error: string | null; id?: string }> {
    const user = await requireBodegaRole();
    if (!user) return { error: 'No autorizado.' };

    const nombre = formData.nombre.trim();
    if (!nombre) return { error: 'El nombre del proveedor es obligatorio.' };

    const db = createAdminClient();
    const { data, error } = await db
        .from('proveedores')
        .insert({
            nombre,
            rut:       formData.rut?.trim()       || null,
            email:     formData.email?.trim()     || null,
            telefono:  formData.telefono?.trim()  || null,
            direccion: formData.direccion?.trim() || null,
        })
        .select('id')
        .single();

    if (error) {
        if (error.code === '23505') return { error: 'Ya existe un proveedor con ese nombre.' };
        return { error: error.message };
    }

    revalidatePath('/dashboard/admin/inventario/proveedores');
    revalidatePath('/dashboard/admin/inventario/guias');
    return { error: null, id: data.id as string };
}

// ── Actualizar ───────────────────────────────────────────────────────────────

export async function actualizarProveedorAction(
    id:       string,
    formData: ProveedorFormData,
): Promise<{ error: string | null }> {
    const user = await requireBodegaRole();
    if (!user) return { error: 'No autorizado.' };

    const nombre = formData.nombre.trim();
    if (!nombre) return { error: 'El nombre del proveedor es obligatorio.' };

    const db = createAdminClient();
    const { error } = await db
        .from('proveedores')
        .update({
            nombre,
            rut:       formData.rut?.trim()       || null,
            email:     formData.email?.trim()     || null,
            telefono:  formData.telefono?.trim()  || null,
            direccion: formData.direccion?.trim() || null,
        })
        .eq('id', id);

    if (error) {
        if (error.code === '23505') return { error: 'Ya existe un proveedor con ese nombre.' };
        return { error: error.message };
    }

    revalidatePath('/dashboard/admin/inventario/proveedores');
    revalidatePath('/dashboard/admin/inventario/guias');
    return { error: null };
}

// ── Eliminar ─────────────────────────────────────────────────────────────────

export async function eliminarProveedorAction(
    id: string,
): Promise<{ error: string | null }> {
    const user = await requireBodegaRole();
    if (!user) return { error: 'No autorizado.' };

    const db = createAdminClient();

    // Regla de negocio: verificar guías asociadas antes de eliminar
    const { count, error: countError } = await db
        .from('guias_ingreso')
        .select('id', { count: 'exact', head: true })
        .eq('proveedor_id', id);

    if (countError) return { error: countError.message };

    if ((count ?? 0) > 0) {
        return {
            error: `No se puede eliminar: el proveedor tiene ${count} guía${count === 1 ? '' : 's'} de ingreso asociada${count === 1 ? '' : 's'}.`,
        };
    }

    const { error } = await db
        .from('proveedores')
        .delete()
        .eq('id', id);

    if (error) return { error: error.message };

    revalidatePath('/dashboard/admin/inventario/proveedores');
    revalidatePath('/dashboard/admin/inventario/guias');
    return { error: null };
}
