'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

async function assertAdmin() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'No autenticado.' };

    const { data: profile } = await supabase
        .from('profiles').select('rol').eq('id', user.id).maybeSingle();

    if (profile?.rol?.toUpperCase() !== 'ADMIN')
        return { error: 'Solo el administrador puede gestionar restaurantes.' };

    return { supabase, user };
}

const rutaCliente = (clienteId: string) =>
    `/dashboard/configuracion/clientes/${clienteId}`;

// ─────────────────────────────────────────────────────────────
// CREAR restaurante
// ─────────────────────────────────────────────────────────────
export async function crearRestauranteAction(formData: FormData, clienteId: string) {
    try {
        const guard = await assertAdmin();
        if (guard.error) return { error: guard.error };

        const nombre_restaurante = (formData.get('nombre_restaurante') as string)?.trim();
        const sigla              = (formData.get('sigla')              as string)?.trim();
        const ip                 = (formData.get('ip')                 as string)?.trim() || null;
        const correo             = (formData.get('correo')             as string)?.trim() || null;
        const direccion          = (formData.get('direccion')          as string)?.trim() || null;

        if (!nombre_restaurante) return { error: 'El nombre del restaurante es obligatorio.' };
        if (!sigla)              return { error: 'La sigla es obligatoria.' };
        if (!clienteId)          return { error: 'Cliente no identificado.' };

        // Service-role: el INSERT en restaurantes dispara un trigger que auto-crea
        // la bodega local del restaurante. Con el cliente de sesión, ese INSERT en
        // bodegas viola el RLS. createAdminClient hace bypass del RLS (la autorización
        // ya está garantizada por assertAdmin arriba).
        const db = createAdminClient();
        const { error } = await db
            .from('restaurantes')
            .insert({ nombre_restaurante, sigla, ip, correo, direccion, cliente_id: clienteId });

        if (error) {
            if (error.code === '23505') return { error: 'Ya existe un restaurante con esa sigla para este cliente.' };
            throw new Error(error.message);
        }

        revalidatePath(rutaCliente(clienteId));
        return { success: true };
    } catch (e: any) {
        return { error: e.message || 'Error al crear el restaurante.' };
    }
}

// ─────────────────────────────────────────────────────────────
// ACTUALIZAR restaurante
// ─────────────────────────────────────────────────────────────
export async function actualizarRestauranteAction(formData: FormData, clienteId: string) {
    try {
        const guard = await assertAdmin();
        if (guard.error) return { error: guard.error };

        const id                 = (formData.get('id')                 as string)?.trim();
        const nombre_restaurante = (formData.get('nombre_restaurante') as string)?.trim();
        const sigla              = (formData.get('sigla')              as string)?.trim();
        const ip                 = (formData.get('ip')                 as string)?.trim() || null;
        const correo             = (formData.get('correo')             as string)?.trim() || null;
        const direccion          = (formData.get('direccion')          as string)?.trim() || null;

        if (!id)                 return { error: 'ID del restaurante es requerido.' };
        if (!nombre_restaurante) return { error: 'El nombre del restaurante es obligatorio.' };
        if (!sigla)              return { error: 'La sigla es obligatoria.' };

        const db = createAdminClient();
        const { error } = await db
            .from('restaurantes')
            .update({ nombre_restaurante, sigla, ip, correo, direccion })
            .eq('id', id);

        if (error) {
            if (error.code === '23505') return { error: 'Ya existe un restaurante con esa sigla para este cliente.' };
            throw new Error(error.message);
        }

        revalidatePath(rutaCliente(clienteId));
        return { success: true };
    } catch (e: any) {
        return { error: e.message || 'Error al actualizar el restaurante.' };
    }
}

// ─────────────────────────────────────────────────────────────
// ELIMINAR restaurante
// ─────────────────────────────────────────────────────────────
export async function eliminarRestauranteAction(restauranteId: string, clienteId: string) {
    try {
        const guard = await assertAdmin();
        if (guard.error) return { error: guard.error };

        const db = createAdminClient();
        const { error } = await db
            .from('restaurantes')
            .delete()
            .eq('id', restauranteId);

        if (error) {
            if (error.code === '23503')
                return { error: 'No se puede eliminar: este restaurante tiene tickets asociados.' };
            throw new Error(error.message);
        }

        revalidatePath(rutaCliente(clienteId));
        return { success: true };
    } catch (e: any) {
        return { error: e.message || 'Error al eliminar el restaurante.' };
    }
}
