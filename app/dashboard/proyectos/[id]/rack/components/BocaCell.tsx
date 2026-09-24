'use client';

import type { RackBoca } from '../actions';

// Estado visual DERIVADO (no almacenado): "cruzada" se calcula en RackBoard
// a partir de proyecto_puertos.cruzado_boca_id, igual que "ocupado" en PortCell.
function colorClasses(b?: RackBoca, cruzada?: boolean): string {
    if (!b) return 'bg-slate-100 text-slate-400 border-slate-200';           // sin rematar
    if (cruzada) return 'bg-violet-500 text-white border-violet-600';        // cruzada
    return 'bg-amber-100 text-amber-700 border-amber-300';                   // pendiente de cruzada
}

function tooltip(numero: number, b?: RackBoca, cruzada?: boolean, equipNombre?: string): string {
    if (!b) return `Boca ${numero} · Sin rematar`;
    const partes = [`Boca ${numero}`, cruzada ? 'Cruzada' : 'Pendiente de cruzada'];
    if (b.etiqueta_libre) partes.push(b.etiqueta_libre);
    else if (equipNombre) partes.push(equipNombre);
    return partes.join(' · ');
}

export function BocaCell({
    numero,
    boca,
    cruzada,
    equipNombre,
    onClick,
}: {
    numero: number;
    boca?: RackBoca;
    cruzada?: boolean;
    equipNombre?: string;
    onClick?: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={!onClick}
            title={tooltip(numero, boca, cruzada, equipNombre)}
            className={`w-7 h-7 rounded-md border flex items-center justify-center text-[9px] font-black select-none ${colorClasses(boca, cruzada)} ${onClick ? 'cursor-pointer hover:ring-2 hover:ring-amber-400 hover:ring-offset-1 transition-all' : 'cursor-default'}`}
        >
            {numero}
        </button>
    );
}
