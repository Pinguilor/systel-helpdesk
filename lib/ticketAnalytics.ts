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
