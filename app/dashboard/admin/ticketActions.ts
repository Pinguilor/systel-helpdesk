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
