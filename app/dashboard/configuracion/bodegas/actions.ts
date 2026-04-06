'use server';

import { createClient } from '@/lib/supabase/server';
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
    const { supabase, user } = await getAdminUser();
    if (!user) return { error: 'No autorizado.' };

    const nombre = (formData.get('nombre') as string)?.trim();
    const descripcion = (formData.get('descripcion') as string)?.trim() || null;

    if (!nombre) return { error: 'El nombre es obligatorio.' };

    const { error } = await supabase.from('bodegas').insert({
        nombre,
        tipo: 'INTERNA',
        descripcion,
        activo: true,
    });

    if (error) {
        console.error('[crearBodegaAction]', error.message);
        return { error: 'No se pudo crear la bodega.' };
    }

    revalidatePath(REVALIDATE);
    return { success: true };
}

export async function editarBodegaAction(formData: FormData) {
    const { supabase, user } = await getAdminUser();
    if (!user) return { error: 'No autorizado.' };

    const id = formData.get('id') as string;
    const nombre = (formData.get('nombre') as string)?.trim();
    const descripcion = (formData.get('descripcion') as string)?.trim() || null;

    if (!id || !nombre) return { error: 'Datos incompletos.' };

    const { error } = await supabase.from('bodegas').update({ nombre, descripcion }).eq('id', id);

    if (error) {
        console.error('[editarBodegaAction]', error.message);
        return { error: 'No se pudo actualizar la bodega.' };
    }

    revalidatePath(REVALIDATE);
    return { success: true };
}

export async function toggleActivoBodegaAction(id: string, activo: boolean) {
    const { supabase, user } = await getAdminUser();
    if (!user) return { error: 'No autorizado.' };

    const { error } = await supabase.from('bodegas').update({ activo }).eq('id', id);

    if (error) {
        console.error('[toggleActivoBodegaAction]', error.message);
        return { error: 'No se pudo cambiar el estado de la bodega.' };
    }

    revalidatePath(REVALIDATE);
    return { success: true };
}
