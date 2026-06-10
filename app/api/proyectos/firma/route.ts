import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

export async function POST(req: NextRequest) {
    try {
        // ── Auth ─────────────────────────────────────────────────────────
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        }

        // Removed role validation completely so technicians can sign
        // ── Payload ──────────────────────────────────────────────────────
        const formData       = await req.formData();
        const file           = formData.get('firma')         as File   | null;
        const proyectoId     = formData.get('proyectoId')    as string | null;
        const nombre         = formData.get('nombre')        as string | null;
        const cargo          = (formData.get('cargo')        as string) || null;
        const sha256Hash     = formData.get('hash')          as string | null;
        const observaciones  = (formData.get('observaciones') as string)?.trim() || null;

        if (!file || !proyectoId || !nombre?.trim() || !sha256Hash) {
            return NextResponse.json({ error: 'Faltan campos obligatorios.' }, { status: 400 });
        }

        const db = createAdminClient();

        // ── 1. Crear bitacora_entrada de tipo 'firma' ────────────────────
        const { data: entrada, error: entradaError } = await db
            .from('bitacora_entradas')
            .insert({
                proyecto_id: proyectoId,
                autor_id:    user.id,
                tipo:        'firma',
                contenido:   observaciones,   // null si no hay observaciones
                adjuntos:    [],
            })
            .select('id')
            .single();

        if (entradaError || !entrada) {
            throw new Error(entradaError?.message ?? 'Error al crear la entrada de bitácora');
        }

        // ── 2. Subir PNG al Storage ──────────────────────────────────────
        const storagePath = `firmas/${proyectoId}/${Date.now()}-firma.png`;
        const { error: uploadError } = await supabase.storage
            .from('proyectos-assets')
            .upload(storagePath, file, { contentType: 'image/png' });

        if (uploadError) {
            throw new Error(`Storage upload falló: ${uploadError.message}`);
        }

        const { data: { publicUrl } } = supabase.storage
            .from('proyectos-assets')
            .getPublicUrl(storagePath);

        // ── 3. Insertar en bitacora_firmas (inmutable — sin UPDATE policy) ─
        const { error: firmaError } = await db.from('bitacora_firmas').insert({
            proyecto_id:     proyectoId,
            entrada_id:      entrada.id,
            firmante_nombre: nombre.trim(),
            firmante_cargo:  cargo,
            storage_path:    storagePath,
            storage_url:     publicUrl,
            sha256_hash:     sha256Hash,
        });

        if (firmaError) {
            throw new Error(firmaError.message);
        }

        revalidatePath(`/dashboard/proyectos/${proyectoId}/bitacora`);
        return NextResponse.json({ ok: true, url: publicUrl, hash: sha256Hash });

    } catch (err) {
        const message = err instanceof Error ? err.message : 'Error interno del servidor';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
