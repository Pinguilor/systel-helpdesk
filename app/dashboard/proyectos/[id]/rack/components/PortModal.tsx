'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { X, Loader2, Trash2, Zap, ArrowUpFromLine } from 'lucide-react';
import type { RackPuerto, RackRecetaItem } from '../actions';
import { asignarPuertoAction, liberarPuertoAction } from '../actions';

export function PortModal({
    proyectoId,
    switchId,
    switchNombre,
    numero,
    puerto,
    receta,
    onClose,
}: {
    proyectoId: string;
    switchId: string;
    switchNombre: string;
    numero: number;
    puerto?: RackPuerto;
    receta: RackRecetaItem[];
    onClose: () => void;
}) {
    const router = useRouter();
    const [rol, setRol] = useState<'acceso' | 'uplink'>(puerto?.rol ?? 'acceso');
    const [esPoe, setEsPoe] = useState(puerto?.es_poe ?? false);
    const [equipId, setEquipId] = useState(puerto?.proyecto_equipamiento_id ?? '');
    const [etiqueta, setEtiqueta] = useState(puerto?.etiqueta_libre ?? '');
    const [notas, setNotas] = useState(puerto?.notas ?? '');
    const [vlan, setVlan] = useState(puerto?.vlan != null ? String(puerto.vlan) : '');
    const [error, setError] = useState('');
    const [isPending, startTransition] = useTransition();

    // Al elegir un dispositivo, autocompleta la VLAN con el default de ese equipo
    // en la Receta (si tiene). El usuario puede sobreescribirla manualmente luego.
    const handleEquipChange = (id: string) => {
        setEquipId(id);
        const item = receta.find(r => r.id === id);
        if (item?.vlan_default != null) setVlan(String(item.vlan_default));
    };

    const guardar = () => {
        setError('');
        startTransition(async () => {
            const vlanNum = vlan.trim() === '' ? null : parseInt(vlan, 10);
            if (vlanNum != null && (Number.isNaN(vlanNum) || vlanNum < 1 || vlanNum > 4094)) {
                setError('La VLAN debe ser un número entre 1 y 4094.');
                return;
            }
            const res = await asignarPuertoAction({
                proyectoId, switchId, numeroPuerto: numero, rol, esPoe,
                proyectoEquipamientoId: equipId || null,
                etiquetaLibre: etiqueta || null,
                notas: notas || null,
                vlan: vlanNum,
            });
            if (res.error) { setError(res.error); return; }
            onClose();
            router.refresh();
        });
    };

    const liberar = () => {
        setError('');
        startTransition(async () => {
            const res = await liberarPuertoAction(switchId, numero, proyectoId);
            if (res.error) { setError(res.error); return; }
            onClose();
            router.refresh();
        });
    };

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="fixed inset-0" onClick={onClose} />
            <div className="relative z-10 bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-100">
                    <div>
                        <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide">Puerto {numero}</h2>
                        <p className="text-xs text-slate-400 mt-0.5">{switchNombre}</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-5 flex flex-col gap-4">
                    {error && (
                        <p className="text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>
                    )}

                    {/* Rol del puerto */}
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Rol del puerto</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button type="button" onClick={() => setRol('acceso')}
                                className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold border transition-colors ${rol === 'acceso' ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                                Acceso
                            </button>
                            <button type="button" onClick={() => setRol('uplink')}
                                className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold border transition-colors ${rol === 'uplink' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                                <ArrowUpFromLine className="w-3.5 h-3.5" /> Uplink
                            </button>
                        </div>
                    </div>

                    {/* PoE */}
                    <button type="button" onClick={() => setEsPoe(v => !v)}
                        className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-sm font-bold transition-colors ${esPoe ? 'bg-amber-50 border-amber-300 text-amber-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                        <span className="flex items-center gap-2"><Zap className="w-4 h-4" /> Puerto PoE</span>
                        <span className={`w-9 h-5 rounded-full relative transition-colors ${esPoe ? 'bg-amber-400' : 'bg-slate-300'}`}>
                            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${esPoe ? 'left-4' : 'left-0.5'}`} />
                        </span>
                    </button>

                    {/* Dispositivo de la Receta + VLAN */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Dispositivo (Receta Maestra)</label>
                            <select value={equipId} onChange={e => handleEquipChange(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent">
                                <option value="">— Ninguno —</option>
                                {receta.map(r => (
                                    <option key={r.id} value={r.id}>
                                        {r.modelo} · {r.familia}{r.es_serializado ? ' (serializado)' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">VLAN</label>
                            <input
                                type="number" min={1} max={4094} value={vlan}
                                onChange={e => setVlan(e.target.value)}
                                placeholder="ej: 410"
                                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                            />
                        </div>
                    </div>

                    {/* Etiqueta libre */}
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Etiqueta libre (opcional)</label>
                        <input value={etiqueta} onChange={e => setEtiqueta(e.target.value)}
                            placeholder="Ej: Cámara pasillo, Uplink ISP…"
                            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
                    </div>

                    {/* Notas */}
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Notas (opcional)</label>
                        <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
                            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
                    </div>

                    {/* Acciones */}
                    <div className="flex items-center justify-between gap-2 pt-1">
                        {puerto ? (
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
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors disabled:opacity-50">
                                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Guardar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
