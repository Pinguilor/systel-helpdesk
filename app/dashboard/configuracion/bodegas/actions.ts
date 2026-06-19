'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

const REVALIDATE = '/dashboard/configuracion/bodegas';

async function getAdminUser() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { supabase, user: null };
    const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).maybeSingle();
    if (profile?.rol?.toUpperCase() !== 'ADMIN') return { supabase, user: null };
    return { supabase, user };
}

export async function crearBodegaAction(formData: FormData) {
    const { user } = await getAdminUser();
    if (!user) return { error: 'No autorizado.' };

    const nombre = (formData.get('nombre') as string)?.trim();
    const descripcion = (formData.get('descripcion') as string)?.trim() || null;
    const bodegaPadreId = (formData.get('bodega_padre_id') as string)?.trim() || null;

    if (!nombre) return { error: 'El nombre es obligatorio.' };

    const db = createAdminClient();
    const { error } = await db.from('bodegas').insert({
        nombre,
        tipo: 'INTERNA',
        descripcion,
        activo: true,
        bodega_padre_id: bodegaPadreId,
    });

    if (error) {
        console.error('[crearBodegaAction]', error.message);
        return { error: error.message || 'No se pudo crear la bodega.' };
    }

    revalidatePath(REVALIDATE);
    return { success: true };
}

export async function editarBodegaAction(formData: FormData) {
    const { user } = await getAdminUser();
    if (!user) return { error: 'No autorizado.' };

    const id = formData.get('id') as string;
    const nombre = (formData.get('nombre') as string)?.trim();
    const descripcion = (formData.get('descripcion') as string)?.trim() || null;
    const bodegaPadreId = (formData.get('bodega_padre_id') as string)?.trim() || null;

    if (!id || !nombre) return { error: 'Datos incompletos.' };

    const db = createAdminClient();
    const { error } = await db
        .from('bodegas')
        .update({ nombre, descripcion, bodega_padre_id: bodegaPadreId })
        .eq('id', id);

    if (error) {
        console.error('[editarBodegaAction]', error.message);
        return { error: error.message || 'No se pudo actualizar la bodega.' };
    }

    revalidatePath(REVALIDATE);
    return { success: true };
}

export async function toggleActivoBodegaAction(id: string, activo: boolean) {
    const { user } = await getAdminUser();
    if (!user) return { error: 'No autorizado.' };

    const db = createAdminClient();

    // Al desactivar, exigir que la bodega esté vacía (stock = 0) para forzar
    // a devolver los sobrantes a la bodega principal antes de archivarla.
    if (!activo) {
        const { data: stock, error: stockError } = await db
            .from('inventario')
            .select('id')
            .eq('bodega_id', id)
            .neq('estado', 'Inactivo')
            .gt('cantidad', 0)
            .limit(1);

        if (stockError) {
            console.error('[toggleActivoBodegaAction] stock check:', stockError.message);
            return { error: 'No se pudo verificar el stock de la bodega.' };
        }
        if (stock && stock.length > 0) {
            return { error: 'No se puede inactivar: la bodega aún tiene stock. Traspasa o devuelve los equipos restantes antes de inactivarla.' };
        }
    }

    const { error } = await db.from('bodegas').update({ activo }).eq('id', id);

    if (error) {
        console.error('[toggleActivoBodegaAction]', error.message);
        return { error: 'No se pudo cambiar el estado de la bodega.' };
    }

    revalidatePath(REVALIDATE);
    return { success: true };
}
