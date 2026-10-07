import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { generateActaProyectoPDF } from '@/lib/generateActaProyectoPDF.server';

export const runtime = 'nodejs';
export const maxDuration = 60; // generación de PDF con hasta 5 fotos

export async function POST(req: NextRequest) {
    // Si algo falla después de crear la entrada de bitácora, se elimina para no dejar
    // una entrada de tipo 'firma' vacía (sin firma asociada) en el timeline.
    let entradaCreadaId: string | null = null;
    let firmaGuardada = false;
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
        const latRaw         = parseFloat(formData.get('latitud')  as string);
        const lngRaw         = parseFloat(formData.get('longitud') as string);
        const latitud        = Number.isFinite(latRaw) ? latRaw : null;
        const longitud       = Number.isFinite(lngRaw) ? lngRaw : null;

        if (!file || !proyectoId || !nombre?.trim() || !sha256Hash) {
            return NextResponse.json({ error: 'Faltan campos obligatorios.' }, { status: 400 });
        }

        // Evidencias: URLs ya subidas por el browser. Solo se aceptan URLs de NUESTRO
        // bucket para este proyecto (evita que el server haga fetch a URLs arbitrarias).
        let evidencias: string[] = [];
        try {
            const parsed = JSON.parse((formData.get('evidencias') as string) || '[]');
            if (Array.isArray(parsed)) evidencias = parsed.filter((u): u is string => typeof u === 'string');
        } catch { /* sin evidencias */ }
        const evidenciaPrefix =
            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/proyectos-assets/firmas/${proyectoId}/evidencia/`;
        if (evidencias.length > 5 || evidencias.some(u => !u.startsWith(evidenciaPrefix))) {
            return NextResponse.json({ error: 'Evidencias inválidas (máximo 5 fotos).' }, { status: 400 });
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
        entradaCreadaId = entrada.id;

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

        // ── 3. Generar Acta PDF ──────────────────────────────────────────
        const [{ data: proyecto }, { data: perfil }] = await Promise.all([
            db.from('proyectos')
                .select(`
                    nombre, descripcion,
                    cliente:restaurantes(razon_social, cliente, compania, nombre_restaurante, direccion),
                    coordinador:profiles!coordinador_id(full_name),
                    participantes:proyecto_participantes(
                        rol_en_proyecto, activo,
                        perfil:profiles(full_name)
                    )
                `)
                .eq('id', proyectoId)
                .single(),
            db.from('profiles').select('full_name').eq('id', user.id).single(),
        ]);
        if (!proyecto) throw new Error('Proyecto no encontrado');

        const p: any = proyecto;
        const tecnicos: { nombre: string; rol: string }[] = [];
        if (p.coordinador?.full_name) {
            tecnicos.push({ nombre: p.coordinador.full_name, rol: 'Coordinador' });
        }
        for (const part of p.participantes ?? []) {
            const n = part.perfil?.full_name;
            if (part.activo && n && !tecnicos.some(t => t.nombre === n)) {
                tecnicos.push({ nombre: n, rol: part.rol_en_proyecto === 'tecnico' ? 'Técnico' : part.rol_en_proyecto });
            }
        }

        const evidenciasData = await Promise.all(evidencias.map(async (url) => {
            const r = await fetch(url);
            if (!r.ok) throw new Error(`No se pudo leer una evidencia (${r.status})`);
            const mime = r.headers.get('content-type') ?? 'image/jpeg';
            return `data:${mime};base64,${Buffer.from(await r.arrayBuffer()).toString('base64')}`;
        }));

        const signedAt  = new Date();
        const firmaB64  = Buffer.from(await file.arrayBuffer()).toString('base64');
        const pdfBuffer = await generateActaProyectoPDF({
            proyectoNombre:        p.nombre,
            cliente:               p.cliente?.razon_social || p.cliente?.cliente || p.cliente?.compania || '',
            ubicacion:             [p.cliente?.nombre_restaurante, p.cliente?.direccion].filter(Boolean).join(' – '),
            receptorNombre:        nombre.trim(),
            receptorCargo:         cargo,
            descripcion:           observaciones ?? 'Sin observaciones registradas.',
            tecnicos,
            tecnicoFirmanteNombre: perfil?.full_name ?? '',
            firmaReceptorUrl:      `data:image/png;base64,${firmaB64}`,
            sha256:                sha256Hash,
            latitud,
            longitud,
            signedAt,
            evidencias: evidenciasData,
        });

        const pdfPath = `actas/${proyectoId}/${Date.now()}-acta.pdf`;
        const { error: pdfUploadError } = await supabase.storage
            .from('proyectos-assets')
            .upload(pdfPath, pdfBuffer, { contentType: 'application/pdf' });
        if (pdfUploadError) {
            throw new Error(`Upload del PDF falló: ${pdfUploadError.message}`);
        }
        const { data: { publicUrl: pdfUrl } } = supabase.storage
            .from('proyectos-assets')
            .getPublicUrl(pdfPath);

        // ── 4. Insertar en bitacora_firmas (inmutable — sin UPDATE policy) ─
        const { error: firmaError } = await db.from('bitacora_firmas').insert({
            proyecto_id:     proyectoId,
            entrada_id:      entrada.id,
            firmante_nombre: nombre.trim(),
            firmante_cargo:  cargo,
            storage_path:    storagePath,
            storage_url:     publicUrl,
            sha256_hash:     sha256Hash,
            pdf_path:        pdfPath,
            pdf_url:         pdfUrl,
            latitud,
            longitud,
            evidencia_fotos: evidencias,
            signed_at:       signedAt.toISOString(),
        });

        if (firmaError) {
            throw new Error(firmaError.message);
        }
        firmaGuardada = true;

        revalidatePath(`/dashboard/proyectos/${proyectoId}/bitacora`);
        return NextResponse.json({ ok: true, url: publicUrl, pdfUrl, hash: sha256Hash });

    } catch (err) {
        if (entradaCreadaId && !firmaGuardada) {
            await createAdminClient().from('bitacora_entradas').delete().eq('id', entradaCreadaId);
        }
        const message = err instanceof Error ? err.message : 'Error interno del servidor';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
