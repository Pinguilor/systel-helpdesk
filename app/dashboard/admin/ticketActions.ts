'use server'

import { createClient } from '@/lib/supabase/server';

const PAGE_SIZE = 30;

const TICKET_SELECT = `
    *,
    profiles:creado_por(full_name, clientes:cliente_id(nombre_fantasia, razon_social)),
    restaurantes(nombre_restaurante, sigla),
    catalogo_servicios!catalogo_servicio_id(categoria, subcategoria, elemento),
    padre:ticket_padre_id(numero_ticket)
` as const;

export async function loadMoreTicketsAction(page: number): Promise<{ data: any[] | null; error: string | null }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: 'No autorizado' };

    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
        .from('tickets')
        .select(TICKET_SELECT)
        .order('fecha_creacion', { ascending: false })
        .range(from, to);

    return { data: data ?? null, error: error?.message ?? null };
}

// Límite alto para búsqueda: al filtrar, se ignora la paginación de 30 y se
// traen todas las coincidencias de un solo viaje (hasta este tope).
const SEARCH_LIMIT = 200;

/**
 * Búsqueda server-side de tickets. A diferencia del filtrado en cliente (que solo
 * ve los ~30 tickets ya cargados), esto consulta TODA la tabla, así un término
 * como "VDI" encuentra coincidencias aunque estén en páginas antiguas no cargadas.
 *
 * Busca por: número de ticket, título, descripción y restaurante (sigla o nombre).
 * `capped` indica si se alcanzó el tope (hay más coincidencias que SEARCH_LIMIT).
 */
export async function searchTicketsAction(
    term: string,
): Promise<{ data: any[] | null; capped: boolean; error: string | null }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, capped: false, error: 'No autorizado' };

    // Sanitizar: quitar caracteres que rompen la sintaxis de filtros PostgREST
    // (comas, paréntesis) y los comodines ilike (% _). Tras esto, term es seguro.
    const q = term.trim().replace(/[(),%*_]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!q) return { data: [], capped: false, error: null };

    // 1) Restaurantes que matchean por sigla o nombre → para buscar por ubicación.
    const { data: rests } = await supabase
        .from('restaurantes')
        .select('id')
        .or(`sigla.ilike.%${q}%,nombre_restaurante.ilike.%${q}%`);
    const restIds = (rests ?? []).map((r: any) => r.id);

    // 2) Filtro OR sobre tickets: título, descripción, número exacto y restaurante.
    const orParts = [`titulo.ilike.%${q}%`, `descripcion.ilike.%${q}%`];
    const asNum = Number.parseInt(q, 10);
    if (!Number.isNaN(asNum)) orParts.push(`numero_ticket.eq.${asNum}`);
    if (restIds.length) orParts.push(`restaurante_id.in.(${restIds.join(',')})`);

    const { data, error } = await supabase
        .from('tickets')
        .select(TICKET_SELECT)
        .or(orParts.join(','))
        .order('fecha_creacion', { ascending: false })
        .limit(SEARCH_LIMIT);

    if (error) return { data: null, capped: false, error: error.message };
    return { data: data ?? [], capped: (data?.length ?? 0) >= SEARCH_LIMIT, error: null };
}
