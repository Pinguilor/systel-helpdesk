'use client';

import { useState, useTransition } from 'react';
import { Trash2, Loader2, Server } from 'lucide-react';
import type { RackSwitch, RackPuerto } from '../actions';
import { PortCell } from './PortCell';

export function SwitchPortGrid({
    sw,
    puertos,
    canEdit,
    onDelete,
    onPortClick,
    equipamientoNombres,
}: {
    sw: RackSwitch;
    puertos: RackPuerto[];
    canEdit: boolean;
    onDelete: (switchId: string) => Promise<void>;
    onPortClick?: (numero: number, puerto?: RackPuerto) => void;
    equipamientoNombres?: Map<string, string>;
}) {
    const [isPending, startTransition] = useTransition();

    // Lookup por número de puerto (modelo disperso: lo no presente es libre)
    const porNumero = new Map<number, RackPuerto>();
    puertos.forEach(p => porNumero.set(p.numero_puerto, p));

    // Columnas pareadas como un switch real: arriba impares, abajo pares.
    const columnas = Math.ceil(sw.num_puertos / 2);
    const ocupados = puertos.filter(p => p.proyecto_equipamiento_id || p.inventario_id || p.etiqueta_libre).length;

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            {/* Header del switch */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center shrink-0">
                        <Server className="w-4 h-4 text-white" strokeWidth={1.75} />
                    </div>
                    <div>
                        <p className="text-sm font-black text-slate-800">{sw.nombre}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            {sw.num_puertos} puertos · {ocupados} en uso
                        </p>
                    </div>
                </div>
                {canEdit && (
                    <button
                        onClick={() => {
                            if (!confirm(`¿Eliminar el switch "${sw.nombre}" y todos sus puertos?`)) return;
                            startTransition(() => onDelete(sw.id));
                        }}
                        disabled={isPending}
                        title="Eliminar switch"
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                        {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                )}
            </div>

            {/* Grilla de puertos */}
            <div className="flex gap-1 overflow-x-auto pb-1">
                {Array.from({ length: columnas }, (_, c) => {
                    const top = 2 * c + 1;
                    const bottom = 2 * c + 2;
                    const cell = (numero: number) => {
                        const p = porNumero.get(numero);
                        const nombre = p?.proyecto_equipamiento_id
                            ? equipamientoNombres?.get(p.proyecto_equipamiento_id)
                            : undefined;
                        return (
                            <PortCell
                                numero={numero}
                                puerto={p}
                                equipNombre={nombre}
                                onClick={onPortClick ? () => onPortClick(numero, p) : undefined}
                            />
                        );
                    };
                    return (
                        <div key={c} className="flex flex-col gap-1 shrink-0">
                            {cell(top)}
                            {bottom <= sw.num_puertos && cell(bottom)}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
