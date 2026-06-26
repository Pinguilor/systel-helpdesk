'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { X, Loader2, LayoutTemplate, Save } from 'lucide-react';
import type { RackTemplate } from '../actions';
import { aplicarPlantillaAction, guardarComoPlantillaAction } from '../actions';

function contar(tpl: RackTemplate) {
    const switches = tpl.payload?.switches ?? [];
    const puertos = switches.reduce((acc, s) => acc + (s.puertos?.length ?? 0), 0);
    return { switches: switches.length, puertos };
}

export function ApplyTemplateModal({
    proyectoId,
    plantillas,
    haySwitches,
    onClose,
}: {
    proyectoId: string;
    plantillas: RackTemplate[];
    haySwitches: boolean;
    onClose: () => void;
}) {
    const router = useRouter();
    const [templateId, setTemplateId] = useState(plantillas[0]?.id ?? '');
    const [modo, setModo] = useState<'reemplazar' | 'agregar'>('agregar');
    const [error, setError] = useState('');
    const [isPending, startTransition] = useTransition();

    const seleccionada = plantillas.find(p => p.id === templateId);
    const stats = seleccionada ? contar(seleccionada) : null;

    const aplicar = () => {
        if (!templateId) { setError('Selecciona una plantilla.'); return; }
        setError('');
        startTransition(async () => {
            const res = await aplicarPlantillaAction(proyectoId, templateId, haySwitches ? modo : 'agregar');
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
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-indigo-100 rounded-xl"><LayoutTemplate className="w-4 h-4 text-indigo-600" /></div>
                        <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide">Aplicar plantilla</h2>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"><X className="w-4 h-4" /></button>
                </div>

                <div className="p-5 flex flex-col gap-4">
                    {error && <p className="text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}

                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Plantilla</label>
                        <select value={templateId} onChange={e => setTemplateId(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400">
                            {plantillas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                        </select>
                        {seleccionada && (
                            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                                {seleccionada.descripcion ? `${seleccionada.descripcion} · ` : ''}
                                {stats?.switches} switch(es) · {stats?.puertos} puertos pre-configurados
                            </p>
                        )}
                    </div>

                    {haySwitches && (
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">El rack ya tiene switches</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button type="button" onClick={() => setModo('agregar')}
                                    className={`px-3 py-2 rounded-xl text-sm font-bold border transition-colors ${modo === 'agregar' ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                                    Agregar
                                </button>
                                <button type="button" onClick={() => setModo('reemplazar')}
                                    className={`px-3 py-2 rounded-xl text-sm font-bold border transition-colors ${modo === 'reemplazar' ? 'bg-red-50 border-red-300 text-red-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                                    Reemplazar
                                </button>
                            </div>
                            {modo === 'reemplazar' && (
                                <p className="text-xs text-red-500 mt-1.5">Se borrarán los switches y puertos actuales del rack.</p>
                            )}
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-1">
                        <button onClick={onClose} disabled={isPending} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancelar</button>
                        <button onClick={aplicar} disabled={isPending} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold disabled:opacity-50">
                            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Aplicar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function SaveAsTemplateModal({ proyectoId, onClose }: { proyectoId: string; onClose: () => void }) {
    const router = useRouter();
    const [nombre, setNombre] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [error, setError] = useState('');
    const [ok, setOk] = useState(false);
    const [isPending, startTransition] = useTransition();

    const guardar = () => {
        if (!nombre.trim()) { setError('El nombre es obligatorio.'); return; }
        setError('');
        startTransition(async () => {
            const res = await guardarComoPlantillaAction(proyectoId, nombre, descripcion);
            if (res.error) { setError(res.error); return; }
            setOk(true);
            setTimeout(() => { onClose(); router.refresh(); }, 800);
        });
    };

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="fixed inset-0" onClick={onClose} />
            <div className="relative z-10 bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-emerald-100 rounded-xl"><Save className="w-4 h-4 text-emerald-600" /></div>
                        <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide">Guardar como plantilla</h2>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"><X className="w-4 h-4" /></button>
                </div>

                <div className="p-5 flex flex-col gap-4">
                    {error && <p className="text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}
                    {ok && <p className="text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">Plantilla guardada.</p>}

                    <p className="text-xs text-slate-400 leading-relaxed">
                        Se guarda la <b>estructura</b> del rack (switches, uplink, PoE, etiquetas). No se incluyen los dispositivos/seriales asignados.
                    </p>

                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Nombre</label>
                        <input value={nombre} onChange={e => setNombre(e.target.value)} autoFocus
                            placeholder="Ej: Topología Estándar Restaurante"
                            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Descripción (opcional)</label>
                        <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={2}
                            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                        <button onClick={onClose} disabled={isPending} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancelar</button>
                        <button onClick={guardar} disabled={isPending || ok} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-50">
                            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Guardar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
