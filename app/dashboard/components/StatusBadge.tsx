'use client';

import React from 'react';

// Fuente única de verdad para los badges de estado de tickets.
// Importar desde aquí en cualquier componente que necesite mostrar estado.

const BASE = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] uppercase tracking-wider font-bold whitespace-nowrap shadow-sm';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
    abierto:          { label: 'Abierto',      className: `${BASE} bg-sky-100 text-sky-700 border border-sky-200` },
    en_progreso:      { label: 'En Progreso',  className: `${BASE} bg-indigo-100 text-indigo-700 border border-indigo-200` },
    pendiente:        { label: 'Pendiente',    className: `${BASE} bg-orange-100 text-orange-700 border border-orange-200` },
    programado:       { label: 'Programado',   className: `${BASE} bg-purple-100 text-purple-700 border border-purple-200` },
    esperando_agente: { label: 'Sin Asignar',  className: `${BASE} bg-slate-100 text-slate-600 border border-slate-200` },
    cerrado:          { label: 'Cerrado',      className: `${BASE} bg-emerald-100 text-emerald-700 border border-emerald-200` },
    anulado:          { label: 'Anulado',      className: `${BASE} bg-red-100 text-red-700 border border-red-200 ring-1 ring-red-300` },
    // 'resuelto' eliminado del flujo — se mantiene solo como fallback legacy
    resuelto:         { label: 'Resuelto',     className: `${BASE} bg-emerald-100 text-emerald-700 border border-emerald-200` },
};

export function getStatusBadge(status: string): React.ReactElement {
    const cfg = STATUS_CONFIG[status?.toLowerCase()] ?? {
        label: status ?? '—',
        className: `${BASE} bg-gray-100 text-gray-600 border border-gray-200`,
    };
    return <span className={cfg.className}>{cfg.label}</span>;
}
