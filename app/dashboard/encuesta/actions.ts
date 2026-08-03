'use server';

import { createClient }      from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const ENCUESTA_ID = 'encuesta_1100_tickets_030826' as const;

// ── Tipos públicos ────────────────────────────────────────────────────────────

export interface RespuestaConDetalle {
    id:             string;
    created_at:     string;
    satisfaccion:   number;
    comentario:     string | null;
    usuario_nombre: string;
    empresa_nombre: string;
}

// ── Guardar respuesta (usuario final) ────────────────────────────────────────
/**
 * Inserta la respuesta del usuario autenticado en `encuestas_respuestas`.
 * Si el usuario ya respondió (violación de UNIQUE) se trata como éxito silencioso.
 */
export async function guardarRespuestaEncuesta(
    satisfaccion: number,
    comentario: string,
): Promise<{ error: string | null }> {
    if (satisfaccion < 1 || satisfaccion > 5) {
        return { error: 'La valoración debe estar entre 1 y 5.' };
    }
    const trimmed = comentario?.trim() ?? '';
    if (trimmed.length < 10) {
        return { error: 'El comentario debe tener al menos 10 caracteres.' };
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'No autenticado.' };

    const { error } = await supabase
        .from('encuestas_respuestas')
        .insert({
            encuesta_id:  ENCUESTA_ID,
            usuario_id:   user.id,
            satisfaccion,
            comentario:   trimmed,
        });

    if (error) {
        // Código 23505 = unique_violation → ya respondió → éxito silencioso
        if (error.code === '23505') return { error: null };
        return { error: error.message };
    }

    return { error: null };
}

// ── Obtener respuestas (admin) ────────────────────────────────────────────────
/**
 * Devuelve todas las respuestas de una encuesta con nombre de usuario y empresa.
 * Solo accesible para usuarios con rol 'admin'.
 */
export async function getRespuestasEncuestaAdmin(
    encuestaId: string
): Promise<{ data: RespuestaConDetalle[]; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: [], error: 'No autenticado.' };

    // Verificar rol antes de usar el admin client
    const { data: profile } = await supabase
        .from('profiles')
        .select('rol')
        .eq('id', user.id)
        .single();

    if (profile?.rol?.toUpperCase() !== 'ADMIN') {
        return { data: [], error: 'Acceso no autorizado.' };
    }

    const db = createAdminClient();

    // 1. Respuestas
    const { data: respuestas, error } = await db
        .from('encuestas_respuestas')
        .select('id, created_at, satisfaccion, comentario, usuario_id')
        .eq('encuesta_id', encuestaId)
        .order('created_at', { ascending: false });

    if (error)          return { data: [], error: error.message };
    if (!respuestas?.length) return { data: [] };

    // 2. Perfiles de los respondientes
    const userIds = [...new Set(respuestas.map(r => r.usuario_id as string))];
    const { data: perfiles } = await db
        .from('profiles')
        .select('id, full_name, cliente_id')
        .in('id', userIds);

    // 3. Empresas/clientes asociadas
    const clienteIds = [
        ...new Set(
            (perfiles ?? [])
                .map(p => p.cliente_id as string | null)
                .filter((id): id is string => !!id)
        ),
    ];
    const { data: empresas } = clienteIds.length
        ? await db.from('clientes').select('id, nombre_fantasia').in('id', clienteIds)
        : { data: [] as { id: string; nombre_fantasia: string }[] };

    // 4. Mapas para lookup O(1)
    const perfilMap  = Object.fromEntries((perfiles  ?? []).map(p => [p.id as string, p]));
    const empresaMap = Object.fromEntries((empresas  ?? []).map(e => [e.id as string, e]));

    // 5. Combinar
    const data: RespuestaConDetalle[] = respuestas.map(r => {
        const perfil  = perfilMap[r.usuario_id as string];
        const empresa = perfil?.cliente_id
            ? empresaMap[perfil.cliente_id as string]
            : null;
        return {
            id:             r.id             as string,
            created_at:     r.created_at     as string,
            satisfaccion:   r.satisfaccion   as number,
            comentario:     r.comentario     as string | null,
            usuario_nombre: perfil?.full_name          ?? 'Desconocido',
            empresa_nombre: empresa?.nombre_fantasia   ?? '—',
        };
    });

    return { data };
}
