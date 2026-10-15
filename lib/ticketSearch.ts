// Lógica de búsqueda de tickets compartida entre Admin y Usuario, para que ambos
// perfiles respondan idéntico al buscar. Sin 'use server': se importa desde las
// server actions con el cliente Supabase ya autenticado.

/** Tope de coincidencias al buscar (ignora la paginación de 30). */
export const SEARCH_LIMIT = 200;

export type ResolvedTicketSearch =
    | { kind: 'empty' }
    | { kind: 'sigla'; restIds: string[] }
    | { kind: 'text'; orFilter: string };

/** Quita caracteres que rompen la sintaxis de filtros PostgREST y los comodines ilike. */
export function sanitizeSearchTerm(term: string): string {
    return term.trim().replace(/[(),%*_]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Interpreta el término:
 *  - Si coincide EXACTAMENTE con la sigla de un restaurante (ej. "LIN"), el resultado
 *    se restringe únicamente a los tickets de ese local (sin subcadenas de otros campos).
 *  - Si no, búsqueda parcial por número, título, descripción, y restaurante (sigla o nombre).
 */
export async function resolveTicketSearch(supabase: any, term: string): Promise<ResolvedTicketSearch> {
    const q = sanitizeSearchTerm(term);
    if (!q) return { kind: 'empty' };

    // ilike sin comodines = igualdad sin distinguir mayúsculas
    const { data: exact } = await supabase.from('restaurantes').select('id').ilike('sigla', q);
    if (exact?.length) return { kind: 'sigla', restIds: exact.map((r: any) => r.id) };

    const { data: rests } = await supabase
        .from('restaurantes')
        .select('id')
        .or(`sigla.ilike.%${q}%,nombre_restaurante.ilike.%${q}%`);
    const restIds = (rests ?? []).map((r: any) => r.id);

    const orParts = [`titulo.ilike.%${q}%`, `descripcion.ilike.%${q}%`];
    const asNum = Number.parseInt(q, 10);
    if (!Number.isNaN(asNum)) orParts.push(`numero_ticket.eq.${asNum}`);
    if (restIds.length) orParts.push(`restaurante_id.in.(${restIds.join(',')})`);
    return { kind: 'text', orFilter: orParts.join(',') };
}

/** Aplica la búsqueda resuelta a una query de `tickets`. */
export function applyTicketSearch<T extends { in: any; or: any }>(query: T, resolved: ResolvedTicketSearch): T {
    if (resolved.kind === 'sigla') return query.in('restaurante_id', resolved.restIds);
    if (resolved.kind === 'text') return query.or(resolved.orFilter);
    return query;
}

/** Misma regla en cliente: ¿el término es exactamente la sigla de este ticket? */
export function isExactSigla(sigla: string | null | undefined, term: string): boolean {
    return !!sigla && sigla.toLowerCase() === term.trim().toLowerCase();
}
