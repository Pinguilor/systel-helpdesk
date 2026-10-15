'use server'

import { createClient } from '@/lib/supabase/server';
import { SEARCH_LIMIT, resolveTicketSearch, applyTicketSearch } from '@/lib/ticketSearch';

const PAGE_SIZE = 30;
const CLOSED_STATES = '(anulado,resuelto,cerrado)';

export type UserTicketScope = 'propios' | 'equipo';
export type UserTicketFilter = 'TODOS' | 'PENDIENTES' | 'RESUELTOS';

const BASE_SELECT = `
    *,
    restaurantes(nombre_restaurante, sigla),
    catalogo_servicios!catalogo_servicio_id(categoria, subcategoria, elemento),
    padre:ticket_padre_id(numero_ticket)
`;

/**
 * Arma la query base según el alcance (devuelta dentro de un objeto: un builder de
 * Supabase es "thenable" y un `await` sobre él lo ejecutaría en vez de encadenarlo). En "equipo" filtra sobre el creador embebido
 * (`!inner` → WHERE en SQL, no un IN(...) gigante en la URL). Sin empresa asignada,
 * "equipo" cae a los tickets propios.
 */
async function buildScopedQuery(
    supabase: any,
    userId: string,
    scope: UserTicketScope,
    opts: { head?: boolean } = {},
) {
    let clienteId: string | null = null;
    if (scope === 'equipo') {
        const { data: profile } = await supabase.from('profiles').select('cliente_id').eq('id', userId).maybeSingle();
        clienteId = profile?.cliente_id ?? null;
    }

    const countOpts = opts.head ? { count: 'exact' as const, head: true } : undefined;

    if (scope === 'equipo' && clienteId) {
        const select = opts.head
            ? 'id, profiles:creado_por!inner(cliente_id)'
            : `${BASE_SELECT}, profiles:creado_por!inner(full_name, cliente_id)`;
        return { query: supabase.from('tickets').select(select, countOpts).eq('profiles.cliente_id', clienteId) };
    }

    const select = opts.head
        ? 'id'
        : scope === 'equipo' ? `${BASE_SELECT}, profiles:creado_por(full_name)` : BASE_SELECT;
    return { query: supabase.from('tickets').select(select, countOpts).eq('creado_por', userId) };
}

function applyStateFilter(query: any, filter: UserTicketFilter) {
    if (filter === 'PENDIENTES') return query.not('estado', 'in', CLOSED_STATES);
    if (filter === 'RESUELTOS') return query.in('estado', ['anulado', 'resuelto', 'cerrado']);
    return query;
}

/**
 * Carga paginada de 30 en 30 (`range`). `pages` permite refrescar de una vez los
 * bloques ya cargados (Realtime) sin descargar el historial completo.
 */
export async function loadUserTicketsAction(
    scope: UserTicketScope,
    filter: UserTicketFilter,
    page: number,
    pages = 1,
): Promise<{ data: any[] | null; error: string | null }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: 'No autorizado' };

    const from = page * PAGE_SIZE;
    const to = from + pages * PAGE_SIZE - 1;

    const { query: base } = await buildScopedQuery(supabase, user.id, scope);
    const { data, error } = await applyStateFilter(base, filter)
        .order('fecha_creacion', { ascending: false })
        .range(from, to);

    return { data: data ?? null, error: error?.message ?? null };
}

/** Búsqueda server-side con la misma lógica que Admin (sigla exacta → solo ese local). */
export async function searchUserTicketsAction(
    scope: UserTicketScope,
    filter: UserTicketFilter,
    term: string,
): Promise<{ data: any[] | null; capped: boolean; error: string | null }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, capped: false, error: 'No autorizado' };

    const resolved = await resolveTicketSearch(supabase, term);
    if (resolved.kind === 'empty') return { data: [], capped: false, error: null };

    const { query: base } = await buildScopedQuery(supabase, user.id, scope);
    const { data, error } = await applyStateFilter(applyTicketSearch(base, resolved), filter)
        .order('fecha_creacion', { ascending: false })
        .limit(SEARCH_LIMIT);

    if (error) return { data: null, capped: false, error: error.message };
    return { data: data ?? [], capped: (data?.length ?? 0) >= SEARCH_LIMIT, error: null };
}

/** Conteos exactos sin descargar filas (`head: true`). */
export async function getUserTicketCountsAction(
    scope: UserTicketScope,
): Promise<{ total: number; pending: number; resolved: number }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { total: 0, pending: 0, resolved: 0 };

    const count = async (filter: UserTicketFilter) => {
        const { query: base } = await buildScopedQuery(supabase, user.id, scope, { head: true });
        const { count } = await applyStateFilter(base, filter);
        return count ?? 0;
    };
    const [total, pending, resolved] = await Promise.all([count('TODOS'), count('PENDIENTES'), count('RESUELTOS')]);
    return { total, pending, resolved };
}
