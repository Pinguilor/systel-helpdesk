'use client';

import { BOM_ESTADO_CONFIG, type BomItemEstado } from '@/types/proyectos.types';

type BomItemMin = { estado: BomItemEstado };

export function BomResumen({ items }: { items: BomItemMin[] }) {
    const estados: BomItemEstado[] = ['requerido', 'asignado', 'instalado', 'pendiente'];

    const conteo = estados.reduce<Record<BomItemEstado, number>>(
        (acc, e) => ({ ...acc, [e]: items.filter(i => i.estado === e).length }),
        { requerido: 0, asignado: 0, instalado: 0, pendiente: 0 }
    );

    const total = items.length;

    return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {estados.map(estado => {
                const cfg   = BOM_ESTADO_CONFIG[estado];
                const count = conteo[estado];
                const pct   = total > 0 ? Math.round((count / total) * 100) : 0;

                return (
                    <div
                        key={estado}
                        className={`relative overflow-hidden rounded-2xl border px-4 py-4 ${cfg.bgClass} ${cfg.borderClass}`}
                    >
                        <p className={`text-2xl font-black ${cfg.textClass}`}>{count}</p>
                        <p className={`text-xs font-bold uppercase tracking-wide mt-0.5 ${cfg.textClass} opacity-80`}>
                            {cfg.label}
                        </p>
                        {total > 0 && (
                            <p className={`text-[10px] mt-1 ${cfg.textClass} opacity-60`}>
                                {pct}% del total
                            </p>
                        )}
                        {/* Barra de progreso */}
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/5">
                            <div
                                className={`h-full ${cfg.textClass.replace('text-', 'bg-')} opacity-40 transition-all duration-500`}
                                style={{ width: `${pct}%` }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
