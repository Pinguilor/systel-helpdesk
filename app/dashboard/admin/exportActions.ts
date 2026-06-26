'use server';

import { createClient } from '@/lib/supabase/server';

const VIATICO_REGEX = /Viático de \$(\d+) asignado\. Comentario: (.*)/;

/** Elimina etiquetas HTML y decodifica entidades básicas para texto plano */
function stripHtml(html: string): string {
    return html
        .replace(/<[^>]*>/g, ' ')          // elimina tags
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s{2,}/g, ' ')           // colapsa espacios múltiples
        .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Tipos públicos
// ─────────────────────────────────────────────────────────────────────────────

export interface ExportFiltros {
    fechaDesde: string;   // YYYY-MM-DD o ''
    fechaHasta: string;   // YYYY-MM-DD o ''
    clienteId: string;    // UUID o ''
    usuarioId: string;    // UUID o ''
    estado: string;       // valor de estado o ''
    prioridad: string;    // valor de prioridad o ''
}

export interface ColumnasVisibles {
    idTicket: boolean;
    fecha: boolean;
    estado: boolean;
    prioridad: boolean;
    cliente: boolean;
    restaurante: boolean;
    tipoServicio: boolean;
    categoria: boolean;
    falla: boolean;
    descripcion: boolean;
    resolucion: boolean;
    comentarios: boolean;
    materiales: boolean;
    viaticos: boolean;
}


export interface TicketMaestroRow {
    'N° Ticket': string;
    'Título': string;
    'Estado': string;
    'Prioridad': string;
    'Cliente': string;
    'Creado Por': string;
    'Técnico Asignado': string;
    'Restaurante': string;
    'Categoría': string;
    'Subcategoría': string;
    'Elemento': string;
    'Acción': string;
    'Fecha Creación': string;
    'Fecha Resolución': string;
    'Descripción': string;
    'Resolución / Trabajo Realizado': string;
    'Materiales Usados': string;
    'Viáticos Total': string;
    'Detalle Viáticos': string;
    'Último Comentario': string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Metadata para selectores del panel
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchExportMetadataAction(): Promise<{
    clientes: { id: string; nombre_fantasia: string }[];
    profiles: { id: string; full_name: string; cliente_id: string | null }[];
} | { error: string }> {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { error: 'No estás autenticado.' };

    const { data: profile } = await supabase
        .from('profiles').select('rol').eq('id', user.id).maybeSingle();
    const rol = profile?.rol?.toLowerCase() ?? '';
    if (!['admin', 'coordinador'].includes(rol)) return { error: 'Sin permisos.' };

    const [clientesRes, profilesRes] = await Promise.all([
        supabase
            .from('clientes')
            .select('id, nombre_fantasia')
            .eq('activo', true)
            .order('nombre_fantasia'),
        supabase
            .from('profiles')
            .select('id, full_name, cliente_id')
            .not('full_name', 'is', null)
            .order('full_name'),
    ]);

    return {
        clientes: (clientesRes.data ?? []) as { id: string; nombre_fantasia: string }[],
        profiles: (profilesRes.data ?? []) as { id: string; full_name: string; cliente_id: string | null }[],
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Acción principal de exportación
// ─────────────────────────────────────────────────────────────────────────────

export async function exportTicketsMaestroAction(
    filtros: ExportFiltros = {
        fechaDesde: '', fechaHasta: '', clienteId: '',
        usuarioId: '', estado: '', prioridad: '',
    }
): Promise<{ data: TicketMaestroRow[] } | { error: string }> {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { error: 'No estás autenticado.' };

    const { data: profile } = await supabase
        .from('profiles')
        .select('rol')
        .eq('id', user.id)
        .maybeSingle();

    const rol = profile?.rol?.toLowerCase() ?? '';
    if (!['admin', 'coordinador'].includes(rol)) {
        return { error: 'Sin permisos para exportar el reporte maestro.' };
    }

    // ── 1. Query base con todos los JOINs ────────────────────────────────────
    let query = supabase
        .from('tickets')
        .select(`
            id,
            numero_ticket,
            titulo,
            descripcion,
            notas_cierre,
            estado,
            prioridad,
            fecha_creacion,
            fecha_resolucion,
            profiles:creado_por(full_name),
            agente:agente_asignado_id(full_name),
            restaurantes(nombre_restaurante),
            clientes(nombre_fantasia),
            tipo_servicio:ticket_tipos_servicio(nombre),
            categoria:ticket_categorias(nombre),
            subcategoria:ticket_subcategorias(nombre),
            accion:ticket_acciones(nombre),
            ticket_messages(
                id,
                mensaje,
                es_sistema,
                es_interno,
                creado_en
            )
        `)
        .order('fecha_creacion', { ascending: false });

    // ── 2. Aplicar filtros dinámicamente ──────────────────────────────────────
    // Los tickets adicionales/derivados pueden tener fecha_creacion = NULL (bug pre-fix).
    // Los incluimos siempre en el OR para que no queden excluidos por el filtro de fechas.
    // Una vez ejecutado el backfill en Supabase, todos tendrán fecha_creacion seteada y
    // este fallback ya no afecta el resultado.
    const _desde = filtros.fechaDesde;
    const _hasta = filtros.fechaHasta ? `${filtros.fechaHasta}T23:59:59.999Z` : '';
    if (_desde || _hasta) {
        const parts: string[] = [];
        if (_desde && _hasta) parts.push(`and(fecha_creacion.gte.${_desde},fecha_creacion.lte.${_hasta})`);
        else if (_desde)      parts.push(`fecha_creacion.gte.${_desde}`);
        else                  parts.push(`fecha_creacion.lte.${_hasta}`);
        parts.push('fecha_creacion.is.null');
        query = (query as any).or(parts.join(','));
    }
    if (filtros.clienteId)   query = (query as any).eq('cliente_id', filtros.clienteId);
    if (filtros.usuarioId)   query = query.eq('creado_por', filtros.usuarioId);
    if (filtros.estado)      query = query.eq('estado', filtros.estado);
    if (filtros.prioridad)   query = query.eq('prioridad', filtros.prioridad);

    const { data: tickets, error: ticketsError } = await query;

    if (ticketsError || !tickets) {
        return { error: `Error obteniendo tickets: ${ticketsError?.message ?? 'Sin datos'}` };
    }

    // ── 3. Materiales insumidos (estado Operativo + ticket_id vinculado) ────────
    // Fuente: inventario con estado='Operativo' y ticket_id vinculado.
    // Equivale exactamente a lo que aparece en el PDF del Acta de Cierre.
    // No usa movimientos_inventario para evitar contar material pedido pero devuelto.
    const ticketIds = tickets.map(t => t.id);

    const { data: insumidos } = ticketIds.length > 0
        ? await supabase
            .from('inventario')
            .select('ticket_id, modelo, cantidad, es_serializado')
            .in('ticket_id', ticketIds)
            .eq('estado', 'Operativo')
        : { data: [] };

    const movimientosByTicket: Record<string, string[]> = {};
    for (const item of insumidos ?? []) {
        if (!item.ticket_id) continue;
        const label = item.es_serializado
            ? `1x ${item.modelo}`
            : `${item.cantidad}x ${item.modelo}`;
        if (!movimientosByTicket[item.ticket_id]) movimientosByTicket[item.ticket_id] = [];
        movimientosByTicket[item.ticket_id].push(label);
    }

    // ── 4. Mapear a filas planas ───────────────────────────────────────────────
    const rows: TicketMaestroRow[] = tickets.map(ticket => {
        const materialesArr = movimientosByTicket[ticket.id];
        const materiales = materialesArr?.length ? materialesArr.join(', ') : 'Sin materiales';

        const msgs = (ticket.ticket_messages as any[]) ?? [];

        const viaticoMsgs = msgs.filter(
            m => m.es_sistema && m.es_interno && VIATICO_REGEX.test(m.mensaje ?? '')
        );
        let totalViaticos = 0;
        const viaticoItems: string[] = [];
        for (const msg of viaticoMsgs) {
            const match = VIATICO_REGEX.exec(msg.mensaje ?? '');
            if (match) {
                const monto = parseInt(match[1], 10);
                totalViaticos += monto;
                const comentario = match[2]?.trim();
                viaticoItems.push(`$${monto.toLocaleString('es-CL')}${comentario ? ` (${comentario})` : ''}`);
            }
        }

        const comentariosPublicos = msgs
            .filter(m => !m.es_sistema && !m.es_interno && m.mensaje)
            .sort((a: any, b: any) =>
                new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime()
            );
        const rawComentario = comentariosPublicos[0]?.mensaje ?? '';
        const ultimoComentario = rawComentario
            ? stripHtml(rawComentario).slice(0, 300) || 'Sin comentarios'
            : 'Sin comentarios';

        return {
            'N° Ticket':        `NC-${ticket.numero_ticket}`,
            'Título':           ticket.titulo ?? '—',
            'Estado':           ticket.estado ?? '—',
            'Prioridad':        ticket.prioridad ?? '—',
            'Cliente':          (ticket.clientes as any)?.nombre_fantasia ?? '—',
            'Creado Por':       (ticket.profiles as any)?.full_name ?? '—',
            'Técnico Asignado': (ticket.agente as any)?.full_name ?? 'Sin asignar',
            'Restaurante':      (ticket.restaurantes as any)?.nombre_restaurante ?? '—',
            'Categoría':        (ticket.tipo_servicio as any)?.nombre ?? '—',
            'Subcategoría':     (ticket.categoria as any)?.nombre ?? '—',
            'Elemento':         (ticket.subcategoria as any)?.nombre ?? '—',
            'Acción':           (ticket.accion as any)?.nombre ?? '—',
            'Fecha Creación':   ticket.fecha_creacion
                ? new Date(ticket.fecha_creacion).toLocaleDateString('es-CL') : '—',
            'Fecha Resolución': ticket.fecha_resolucion
                ? new Date(ticket.fecha_resolucion).toLocaleDateString('es-CL') : '—',
            'Descripción':      ticket.descripcion
                ? stripHtml(ticket.descripcion).slice(0, 500) : '—',
            'Resolución / Trabajo Realizado': (ticket as any).notas_cierre
                ? ((ticket as any).notas_cierre as string).slice(0, 1000) : '—',
            'Materiales Usados': materiales,
            'Viáticos Total':   totalViaticos > 0
                ? `$${totalViaticos.toLocaleString('es-CL')}` : '$0',
            'Detalle Viáticos': viaticoItems.length > 0
                ? viaticoItems.join(' + ') : 'Sin viáticos',
            'Último Comentario': ultimoComentario,
        };
    });

    return { data: rows };
}
