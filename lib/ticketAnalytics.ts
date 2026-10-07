// Fuente única de verdad para cálculos y paleta de estados de tickets.

export const ACTIVE_STATES = [
    'abierto',
    'en_progreso',
    'pendiente',
    'programado',
    'esperando_agente',
] as const;

export const TERMINAL_STATES = ['cerrado', 'anulado'] as const;

// Orden canónico + colores para el donut y leyendas.
// Pre-inicializar desde este array garantiza que todos los estados
// aparezcan en el gráfico aunque su conteo sea 0.
export const STATUS_META_ORDERED: {
    key: string;
    label: string;
    color: string;
}[] = [
    { key: 'cerrado',          label: 'Cerrado',      color: '#10b981' }, // emerald-500
    { key: 'abierto',          label: 'Abierto',      color: '#3b82f6' }, // blue-500
    { key: 'en_progreso',      label: 'En Progreso',  color: '#8b5cf6' }, // violet-500
    { key: 'pendiente',        label: 'Pendiente',    color: '#fb923c' }, // orange-400
    { key: 'programado',       label: 'Programado',   color: '#a855f7' }, // purple-500
    { key: 'esperando_agente', label: 'Sin Asignar',  color: '#94a3b8' }, // slate-400
    { key: 'anulado',          label: 'Anulado',      color: '#f43f5e' }, // rose-500
];

/** Cuenta tickets por estado, garantizando que todos los estados del
 *  sistema aparezcan con valor 0 si no hay tickets en ese estado. */
export function buildStatusData(tickets: { estado: string }[]) {
    const counts: Record<string, number> = Object.fromEntries(
        STATUS_META_ORDERED.map(s => [s.key, 0])
    );

    for (const t of tickets) {
        if (t.estado === 'resuelto') continue; // estado eliminado del flujo
        if (t.estado in counts) {
            counts[t.estado]++;
        }
    }

    return STATUS_META_ORDERED.map(s => ({
        name:  s.label,
        value: counts[s.key],
        color: s.color,
    }));
}

/** Tickets activos = todos los estados no terminales (excluye cerrado y anulado). */
export function countActive(tickets: { estado: string }[]): number {
    return tickets.filter(t => (ACTIVE_STATES as readonly string[]).includes(t.estado)).length;
}

/** Tickets terminados = cerrado + anulado. */
export function countTerminal(tickets: { estado: string }[]): number {
    return tickets.filter(t => (TERMINAL_STATES as readonly string[]).includes(t.estado)).length;
}

// ─── Resumen agregado para /dashboard/analiticas ───────────────────────────────
// Forma que devuelve la RPC `analiticas_resumen` (sql/analiticas_resumen.sql).
export interface AnalyticsResumen {
    total: number;
    por_estado: Record<string, number>;
    por_prioridad: Record<string, number>;
    criticos_activos: number;
    mensual: { anio: number; mes: number; creados: number; resueltos: number }[];
    categorias: { name: string; value: number }[];
    agentes: { name: string; total: number; resueltos: number }[];
    restaurantes: { name: string; sigla: string; value: number }[];
}

/** Donut de estados a partir de conteos ya agregados (todos los estados, aunque sean 0). */
export function statusDataFromCounts(porEstado: Record<string, number>) {
    return STATUS_META_ORDERED.map(s => ({
        name:  s.label,
        value: porEstado[s.key] ?? 0,
        color: s.color,
    }));
}

/** Fila mínima de ticket para el fallback cliente-side (sin la RPC). */
export interface TicketResumenRow {
    estado: string;
    prioridad: string;
    fecha_creacion: string;
    fecha_resolucion?: string | null;
    agente_asignado_id?: string | null;
    restaurante_id?: string | null;
    agente?: { full_name: string | null } | null;
    restaurantes?: { nombre_restaurante: string; sigla: string } | null;
    categoria?: { nombre: string } | null;
    tipo_servicio?: { nombre: string } | null;
}

/** Misma agregación que la RPC, pero en JS. Solo se usa si la RPC aún no existe. */
export function aggregateTickets(tickets: TicketResumenRow[]): AnalyticsResumen {
    const por_estado: Record<string, number> = {};
    const por_prioridad: Record<string, number> = {};
    const cats: Record<string, number> = {};
    const ags: Record<string, { name: string; total: number; resueltos: number }> = {};
    const rests: Record<string, { name: string; sigla: string; value: number }> = {};
    let criticos_activos = 0;

    const mensual = Array.from({ length: 6 }, (_, i) => {
        const d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() - (5 - i));
        return { anio: d.getFullYear(), mes: d.getMonth() + 1, creados: 0, resueltos: 0 };
    });

    for (const t of tickets) {
        por_estado[t.estado] = (por_estado[t.estado] || 0) + 1;
        por_prioridad[t.prioridad] = (por_prioridad[t.prioridad] || 0) + 1;
        if (t.prioridad === 'crítica' && (ACTIVE_STATES as readonly string[]).includes(t.estado)) criticos_activos++;

        const cat = t.categoria?.nombre || t.tipo_servicio?.nombre || 'Sin Clasificar';
        cats[cat] = (cats[cat] || 0) + 1;

        const dc = new Date(t.fecha_creacion);
        const mc = mensual.find(x => x.mes === dc.getMonth() + 1 && x.anio === dc.getFullYear());
        if (mc) mc.creados++;
        if (t.fecha_resolucion) {
            const dr = new Date(t.fecha_resolucion);
            const mr = mensual.find(x => x.mes === dr.getMonth() + 1 && x.anio === dr.getFullYear());
            if (mr) mr.resueltos++;
        }

        const aid = t.agente_asignado_id;
        if (aid) {
            ags[aid] ??= { name: t.agente?.full_name || 'Técnico', total: 0, resueltos: 0 };
            ags[aid].total++;
            if (['resuelto', 'cerrado'].includes(t.estado)) ags[aid].resueltos++;
        }

        const rid = t.restaurante_id;
        if (rid) {
            rests[rid] ??= {
                name: t.restaurantes?.nombre_restaurante || 'Restaurante',
                sigla: t.restaurantes?.sigla || '—',
                value: 0,
            };
            rests[rid].value++;
        }
    }

    return {
        total: tickets.length,
        por_estado,
        por_prioridad,
        criticos_activos,
        mensual,
        categorias: Object.entries(cats).map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value).slice(0, 6),
        agentes: Object.values(ags).sort((a, b) => b.resueltos - a.resueltos).slice(0, 5),
        restaurantes: Object.values(rests).sort((a, b) => b.value - a.value).slice(0, 8),
    };
}
