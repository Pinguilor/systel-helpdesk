'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { X, Loader2, ListPlus } from 'lucide-react';
import { autogenerarBocasAction } from '../actions';

export function AutogenerarBocasModal({
    proyectoId,
    patchPanelId,
    panelNombre,
    numBocas,
    onClose,
}: {
    proyectoId: string;
    patchPanelId: string;
    panelNombre: string;
    numBocas: number;
    onClose: () => void;
}) {
    const router = useRouter();
    const [prefijo, setPrefijo] = useState('');
    const [desde, setDesde] = useState(1);
    const [hasta, setHasta] = useState(numBocas);
    const [error, setError] = useState('');
    const [isPending, startTransition] = useTransition();

    const rango = Math.max(0, hasta - desde + 1);
    const previewLabel = (n: number) => prefijo.trim() ? `${prefijo.trim()} ${n}` : `Boca ${n} (sin etiqueta)`;

    const generar = () => {
        setError('');
        if (desde < 1 || hasta < desde || hasta > numBocas) { setError(`El rango debe estar entre 1 y ${numBocas}.`); return; }
        startTransition(async () => {
            const res = await autogenerarBocasAction(proyectoId, patchPanelId, prefijo, desde, hasta);
            if (res.error) { setError(res.error); return; }
            onClose();
            router.refresh();
        });
    };

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="fixed inset-0" onClick={onClose} />
            <div className="relative z-10 bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b border-slate-100">
                    <div>
                        <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
                            <ListPlus className="w-4 h-4 text-amber-500" /> Autogenerar bocas
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5">{panelNombre}</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-5 flex flex-col gap-4">
                    {error && (
                        <p className="text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>
                    )}

                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Prefijo de etiqueta (opcional)</label>
                        <input value={prefijo} onChange={e => setPrefijo(e.target.value)}
                            placeholder="Ej: Jack piso 1 -"
                            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Desde</label>
                            <input type="number" min={1} max={numBocas} value={desde}
                                onChange={e => setDesde(Number(e.target.value))}
                                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Hasta</label>
                            <input type="number" min={1} max={numBocas} value={hasta}
                                onChange={e => setHasta(Number(e.target.value))}
                                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400" />
                        </div>
                    </div>

                    {rango > 0 && (
                        <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                            Se crearán <b>{rango}</b> bocas: <span className="font-mono">&quot;{previewLabel(desde)}&quot;</span> … <span className="font-mono">&quot;{previewLabel(hasta)}&quot;</span>.
                            Las bocas ya configuradas no se modifican.
                        </p>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-1">
                        <button onClick={onClose} disabled={isPending}
                            className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
                            Cancelar
                        </button>
                        <button onClick={generar} disabled={isPending || rango === 0}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold transition-colors disabled:opacity-50">
                            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Generar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
