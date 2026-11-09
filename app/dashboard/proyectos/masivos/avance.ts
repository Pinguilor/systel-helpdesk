import type { ResumenLocal } from './gestion-actions';

/** Días sin actividad a partir de los cuales un local se considera "sin avance". */
export const DIAS_INACTIVO = 7;

export function diasDesde(iso: string | null): number | null {
    if (!iso) return null;
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return null;
    return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

export function textoHace(dias: number | null): string {
    if (dias === null) return '—';
    if (dias === 0) return 'hoy';
    if (dias === 1) return 'ayer';
    return `hace ${dias} d`;
}

export const pct = (parte: number, total: number) => (total > 0 ? Math.round((parte / total) * 100) : 0);

export interface Alertas {
    completado: boolean;
    pendientes: boolean;
    inactivo: boolean;
    sinMateriales: boolean;
}

/** Banderas de atención de un local. Los proyectos completados o cancelados no generan alertas. */
export function alertasLocal(l: ResumenLocal): Alertas {
    const cerrado = l.estado === 'completado' || l.estado === 'cancelado';
    const dias = diasDesde(l.ultima_actividad);
    return {
        completado: l.estado === 'completado',
        pendientes: !cerrado && l.tareas_pendientes > 0,
        inactivo: !cerrado && dias !== null && dias >= DIAS_INACTIVO,
        sinMateriales: !cerrado && l.mat_requerido > 0 && l.mat_entregado === 0,
    };
}

export const requiereAtencion = (a: Alertas) => a.pendientes || a.inactivo;

/** Faltante frente al stock disponible; null cuando el ítem no tiene catálogo (no hay stock que comparar). */
export function faltante(porRetirar: number, stock: number | null): number | null {
    if (stock === null) return null;
    return Math.max(0, porRetirar - stock);
}
