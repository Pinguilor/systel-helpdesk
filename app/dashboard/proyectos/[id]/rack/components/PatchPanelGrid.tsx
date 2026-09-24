'use client';

import { useState, useTransition } from 'react';
import { Trash2, Loader2, PanelsTopLeft, ListPlus } from 'lucide-react';
import type { RackPatchPanel, RackBoca } from '../actions';
import { BocaCell } from './BocaCell';

export function PatchPanelGrid({
    panel,
    bocas,
    bocasCruzadas,
    canEdit,
    onDelete,
    onBocaClick,
    onAutogenerar,
    equipamientoNombres,
}: {
    panel: RackPatchPanel;
    bocas: RackBoca[];
    bocasCruzadas: Set<string>;
    canEdit: boolean;
    onDelete: (patchPanelId: string) => Promise<void>;
    onBocaClick?: (numero: number, boca?: RackBoca) => void;
    onAutogenerar?: () => void;
    equipamientoNombres?: Map<string, string>;
}) {
    const [isPending, startTransition] = useTransition();
    const [confirmDelete, setConfirmDelete] = useState(false);

    // Lookup por número de boca (modelo disperso: lo no presente no está rematado)
    const porNumero = new Map<number, RackBoca>();
    bocas.forEach(b => porNumero.set(b.numero_boca, b));

    // Columnas pareadas como un panel real: arriba impares, abajo pares.
    const columnas = Math.ceil(panel.num_bocas / 2);
    const rematadas = bocas.length;
    const cruzadas = bocas.filter(b => bocasCruzadas.has(b.id)).length;

    return (
        <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-4">
            {/* Header del panel */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center shrink-0">
                        <PanelsTopLeft className="w-4 h-4 text-white" strokeWidth={1.75} />
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5">
                            <p className="text-sm font-black text-slate-800">{panel.nombre}</p>
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-amber-100 text-amber-700">Pasivo</span>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            {panel.num_bocas} bocas · {rematadas} rematadas · {cruzadas} cruzadas
                        </p>
                    </div>
                </div>
                {canEdit && (
                    <div className="flex items-center gap-1.5">
                        {onAutogenerar && (
                            <button
                                onClick={onAutogenerar}
                                title="Autogenerar bocas"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-500 text-xs font-bold hover:bg-slate-50 transition-colors"
                            >
                                <ListPlus className="w-3.5 h-3.5" /> Autogenerar
                            </button>
                        )}
                        {confirmDelete ? (
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => startTransition(async () => { await onDelete(panel.id); setConfirmDelete(false); })}
                                    disabled={isPending}
                                    className="px-2.5 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-50"
                                >
                                    {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirmar'}
                                </button>
                                <button
                                    onClick={() => setConfirmDelete(false)}
                                    disabled={isPending}
                                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-500 text-xs font-bold hover:bg-slate-50"
                                >
                                    Cancelar
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setConfirmDelete(true)}
                                title="Eliminar patch panel"
                                className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-colors"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Grilla de bocas */}
            <div className="flex gap-1 overflow-x-auto pb-1">
                {Array.from({ length: columnas }, (_, c) => {
                    const top = 2 * c + 1;
                    const bottom = 2 * c + 2;
                    const cell = (numero: number) => {
                        const b = porNumero.get(numero);
                        const nombre = b?.proyecto_equipamiento_id
                            ? equipamientoNombres?.get(b.proyecto_equipamiento_id)
                            : undefined;
                        return (
                            <BocaCell
                                numero={numero}
                                boca={b}
                                cruzada={!!b && bocasCruzadas.has(b.id)}
                                equipNombre={nombre}
                                onClick={onBocaClick ? () => onBocaClick(numero, b) : undefined}
                            />
                        );
                    };
                    return (
                        <div key={c} className="flex flex-col gap-1 shrink-0">
                            {cell(top)}
                            {bottom <= panel.num_bocas && cell(bottom)}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
