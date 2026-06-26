'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

async function requireAccess() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    return user;
}

// ── Lectura ───────────────────────────────────────────────────────────────

export async function getBitacoraEntradas(proyectoId: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('bitacora_entradas')
        .select(`
            id, tipo, contenido, adjuntos, created_at,
            autor:profiles(full_name),
            firma:bitacora_firmas(
                id, firmante_nombre, firmante_cargo,
                storage_url, sha256_hash, signed_at
            )
        `)
        .eq('proyecto_id', proyectoId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
}

// ── Entrada General (nota + foto unificados) ──────────────────────────────
//
// Lógica:  si formData incluye archivo 'foto' con size > 0 → tipo 'foto'
//          en caso contrario → tipo 'nota'
// El campo 'contenido' (textarea) es obligatorio en ambos casos.

export async function agregarEntradaGeneral(
    _prevState: { error: string | null },
    formData: FormData
): Promise<{ error: string | null }> {
    const user = await requireAccess();
    if (!user) return { error: 'No autorizado.' };

    const proyectoId = (formData.get('proyecto_id') as string)?.trim();
    const contenido  = (formData.get('contenido')   as string)?.trim();
    if (!contenido) return { error: 'El texto de la entrada es obligatorio.' };

    const file    = formData.get('foto') as File | null;
    const hasFoto = file && file.size > 0;
    const db      = createAdminClient();

    if (hasFoto) {
        // ── Con foto: subir a Storage y crear entrada tipo 'foto' ──────
        const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
        const path = `bitacora/${proyectoId}/${Date.now()}.${ext}`;

        const supabase = await createClient();
        const { error: uploadError } = await supabase.storage
            .from('proyectos-assets')
            .upload(path, file, { contentType: file.type });
        if (uploadError) return { error: `Error al subir imagen: ${uploadError.message}` };

        const { data: { publicUrl } } = supabase.storage
            .from('proyectos-assets')
            .getPublicUrl(path);

        const { error: dbError } = await db.from('bitacora_entradas').insert({
            proyecto_id: proyectoId,
            autor_id:    user.id,
            tipo:        'foto',
            contenido,          // texto obligatorio guardado junto a la imagen
            adjuntos:    [publicUrl],
        });
        if (dbError) return { error: dbError.message };
    } else {
        // ── Sin foto: crear entrada tipo 'nota' ────────────────────────
        const { error } = await db.from('bitacora_entradas').insert({
            proyecto_id: proyectoId,
            autor_id:    user.id,
            tipo:        'nota',
            contenido,
            adjuntos:    [],
        });
        if (error) return { error: error.message };
    }

    revalidatePath(`/dashboard/proyectos/${proyectoId}/bitacora`);
    return { error: null };
}

// ── agregarFoto (actualizado — acepta contenido requerido) ─────────────────
// Mantenida para compatibilidad; la UI principal usa agregarEntradaGeneral.

export async function agregarFoto(
    _prevState: { error: string | null },
    formData: FormData
): Promise<{ error: string | null }> {
    const user = await requireAccess();
    if (!user) return { error: 'No autorizado.' };

    const proyectoId = (formData.get('proyecto_id') as string)?.trim();
    const contenido  = (formData.get('contenido')   as string)?.trim() || null;
    const file       = formData.get('foto') as File | null;
    if (!file || file.size === 0) return { error: 'Selecciona una imagen.' };

    const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const path = `bitacora/${proyectoId}/${Date.now()}.${ext}`;

    const supabase = await createClient();
    const { error: uploadError } = await supabase.storage
        .from('proyectos-assets')
        .upload(path, file, { contentType: file.type });
    if (uploadError) return { error: uploadError.message };

    const { data: { publicUrl } } = supabase.storage
        .from('proyectos-assets')
        .getPublicUrl(path);

    const db = createAdminClient();
    const { error: dbError } = await db.from('bitacora_entradas').insert({
        proyecto_id: proyectoId,
        autor_id:    user.id,
        tipo:        'foto',
        contenido,                  // ahora guarda el texto
        adjuntos:    [publicUrl],
    });
    if (dbError) return { error: dbError.message };

    revalidatePath(`/dashboard/proyectos/${proyectoId}/bitacora`);
    return { error: null };
}

// ── subirFotoBitacora: sube UN archivo y devuelve la URL pública ───────────
// Llamada N veces en secuencia desde el cliente para mostrar progreso.

export async function subirFotoBitacora(
    formData: FormData
): Promise<{ url: string | null; error: string | null }> {
    const user = await requireAccess();
    if (!user) return { url: null, error: 'No autorizado.' };

    const proyectoId = (formData.get('proyecto_id') as string)?.trim();
    const file = formData.get('foto') as File | null;
    if (!file || file.size === 0) return { url: null, error: 'Archivo vacío.' };

    const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const path = `bitacora/${proyectoId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const supabase = await createClient();
    const { error: uploadError } = await supabase.storage
        .from('proyectos-assets')
        .upload(path, file, { contentType: file.type });
    if (uploadError) return { url: null, error: `Error al subir imagen: ${uploadError.message}` };

    const { data: { publicUrl } } = supabase.storage
        .from('proyectos-assets')
        .getPublicUrl(path);

    return { url: publicUrl, error: null };
}

// ── crearEntradaFotos: inserta UNA entrada con todas las URLs ──────────────
// Llamada una sola vez después de que todas las fotos subieron.

export async function crearEntradaFotos(
    proyectoId: string,
    contenido: string,
    urls: string[]
): Promise<{ error: string | null }> {
    const user = await requireAccess();
    if (!user) return { error: 'No autorizado.' };
    if (!contenido.trim()) return { error: 'El texto de la entrada es obligatorio.' };
    if (!urls.length) return { error: 'Sin fotos para guardar.' };

    const db = createAdminClient();
    const { error } = await db.from('bitacora_entradas').insert({
        proyecto_id: proyectoId,
        autor_id:    user.id,
        tipo:        'foto',
        contenido:   contenido.trim(),
        adjuntos:    urls,
    });
    if (error) return { error: error.message };

    revalidatePath(`/dashboard/proyectos/${proyectoId}/bitacora`);
    revalidatePath(`/dashboard/proyectos/${proyectoId}`);
    return { error: null };
}

// ── agregarNota (sin cambios — sigue disponible) ───────────────────────────

export async function agregarNota(
    _prevState: { error: string | null },
    formData: FormData
): Promise<{ error: string | null }> {
    const user = await requireAccess();
    if (!user) return { error: 'No autorizado.' };

    const proyectoId = (formData.get('proyecto_id') as string)?.trim();
    const contenido  = (formData.get('contenido')   as string)?.trim();
    if (!contenido) return { error: 'El contenido no puede estar vacío.' };

    const db = createAdminClient();
    const { error } = await db.from('bitacora_entradas').insert({
        proyecto_id: proyectoId,
        autor_id:    user.id,
        tipo:        'nota',
        contenido,
        adjuntos:    [],
    });
    if (error) return { error: error.message };

    revalidatePath(`/dashboard/proyectos/${proyectoId}/bitacora`);
    return { error: null };
}
