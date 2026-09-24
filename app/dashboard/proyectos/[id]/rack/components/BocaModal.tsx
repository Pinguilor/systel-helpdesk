'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { X, Loader2, Trash2 } from 'lucide-react';
import type { RackBoca, RackRecetaItem } from '../actions';
import { asignarBocaAction, liberarBocaAction } from '../actions';

export function BocaModal({
    proyectoId,
    patchPanelId,
    panelNombre,
    numero,
    boca,
    receta,
    onClose,
}: {
    proyectoId: string;
    patchPanelId: string;
    panelNombre: string;
    numero: number;
    boca?: RackBoca;
    receta: RackRecetaItem[];
    onClose: () => void;
}) {
    const router = useRouter();
    const [equipId, setEquipId] = useState(boca?.proyecto_equipamiento_id ?? '');
    const [etiqueta, setEtiqueta] = useState(boca?.etiqueta_libre ?? '');
    const [notas, setNotas] = useState(boca?.notas ?? '');
    const [error, setError] = useState('');
    const [isPending, startTransition] = useTransition();

    const guardar = () => {
        setError('');
        startTransition(async () => {
            const res = await asignarBocaAction({
                proyectoId, patchPanelId, numeroBoca: numero,
                proyectoEquipamientoId: equipId || null,
                etiquetaLibre: etiqueta || null,
                notas: notas || null,
            });
            if (res.error) { setError(res.error); return; }
            onClose();
            router.refresh();
        });
    };

    const liberar = () => {
        setError('');
        startTransition(async () => {
            const res = await liberarBocaAction(patchPanelId, numero, proyectoId);
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
                        <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide">Boca {numero}</h2>
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
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Dispositivo final (Receta Maestra)</label>
                        <select value={equipId} onChange={e => setEquipId(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent">
                            <option value="">— Ninguno —</option>
                            {receta.map(r => (
                                <option key={r.id} value={r.id}>
                                    {r.modelo} · {r.familia}{r.es_serializado ? ' (serializado)' : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Etiqueta / Ubicación</label>
                        <input value={etiqueta} onChange={e => setEtiqueta(e.target.value)}
                            placeholder="Ej: Cámara pasillo, Jack sala 204…"
                            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent" />
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Notas (opcional)</label>
                        <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
                            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent" />
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                        {boca ? (
                            <button onClick={liberar} disabled={isPending}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 text-red-600 text-sm font-bold hover:bg-red-50 transition-colors disabled:opacity-50">
                                <Trash2 className="w-3.5 h-3.5" /> Liberar
                            </button>
                        ) : <span />}
                        <div className="flex items-center gap-2">
                            <button onClick={onClose} disabled={isPending}
                                className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
                                Cancelar
                            </button>
                            <button onClick={guardar} disabled={isPending}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold transition-colors disabled:opacity-50">
                                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Guardar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
