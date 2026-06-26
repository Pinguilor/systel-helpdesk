'use client';

import { useState, useEffect, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Network, Plus, Loader2, X, LayoutTemplate, Save } from 'lucide-react';
import type { RackSwitch, RackPuerto, RackRecetaItem, RackTemplate } from '../actions';
import { crearSwitchAction, eliminarSwitchAction } from '../actions';
import { SwitchPortGrid } from './SwitchPortGrid';
import { PortModal } from './PortModal';
import { ApplyTemplateModal, SaveAsTemplateModal } from './TemplateModals';

const OPCIONES_PUERTOS = [8, 24, 48];

export function RackBoard({
    proyectoId,
    initialSwitches,
    initialPuertos,
    receta,
    plantillas,
    canEdit,
}: {
    proyectoId: string;
    initialSwitches: RackSwitch[];
    initialPuertos: RackPuerto[];
    receta: RackRecetaItem[];
    plantillas: RackTemplate[];
    canEdit: boolean;
}) {
    const router = useRouter();
    const [switches, setSwitches] = useState(initialSwitches);
    const [puertos, setPuertos] = useState(initialPuertos);

    // Re-sincroniza con datos frescos del servidor tras router.refresh().
    useEffect(() => { setSwitches(initialSwitches); }, [initialSwitches]);
    useEffect(() => { setPuertos(initialPuertos); }, [initialPuertos]);

    // Mapa equipamiento.id → modelo, para tooltips de puertos asignados.
    const equipamientoNombres = useMemo(() => {
        const m = new Map<string, string>();
        receta.forEach(r => m.set(r.id, r.modelo));
        return m;
    }, [receta]);

    // Puerto seleccionado para el modal de asignación.
    const [portModal, setPortModal] = useState<{ sw: RackSwitch; numero: number; puerto?: RackPuerto } | null>(null);
    const [showApply, setShowApply] = useState(false);
    const [showSave, setShowSave] = useState(false);

    const [showAdd, setShowAdd] = useState(false);
    const [nombre, setNombre] = useState('');
    const [numPuertos, setNumPuertos] = useState(24);
    const [error, setError] = useState('');
    const [isPending, startTransition] = useTransition();

    const puertosDe = (switchId: string) => puertos.filter(p => p.switch_id === switchId);

    const handleCrear = () => {
        setError('');
        startTransition(async () => {
            const res = await crearSwitchAction(proyectoId, nombre, numPuertos);
            if (res.error) { setError(res.error); return; }
            setNombre('');
            setNumPuertos(24);
            setShowAdd(false);
            router.refresh();
        });
    };

    const handleEliminar = async (switchId: string) => {
        const res = await eliminarSwitchAction(switchId, proyectoId);
        if (res.error) { setError(res.error); return; }
        router.refresh();
    };

    return (
        <section>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0 shadow-sm">
                        <Network className="w-4.5 h-4.5 text-white" strokeWidth={1.75} />
                    </div>
                    <div>
                        <h2 className="text-base font-black text-slate-900">Mapa de Switch / Rack</h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                            {switches.length === 0
                                ? 'Sin switches configurados aún'
                                : `${switches.length} switch${switches.length !== 1 ? 'es' : ''} en el rack`}
                        </p>
                    </div>
                </div>
                {canEdit && !showAdd && (
                    <div className="flex items-center gap-2 shrink-0">
                        {plantillas.length > 0 && (
                            <button
                                onClick={() => setShowApply(true)}
                                className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 text-sm font-bold rounded-xl hover:bg-slate-50 transition-all"
                            >
                                <LayoutTemplate className="w-4 h-4" /> Plantilla
                            </button>
                        )}
                        {switches.length > 0 && (
                            <button
                                onClick={() => setShowSave(true)}
                                className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 text-sm font-bold rounded-xl hover:bg-slate-50 transition-all"
                                title="Guardar este layout como plantilla"
                            >
                                <Save className="w-4 h-4" />
                            </button>
                        )}
                        <button
                            onClick={() => setShowAdd(true)}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-sm transition-all"
                        >
                            <Plus className="w-4 h-4" /> Agregar switch
                        </button>
                    </div>
                )}
            </div>

            {/* Form agregar switch */}
            {canEdit && showAdd && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-4 flex flex-col sm:flex-row sm:items-end gap-3">
                    <div className="flex-1">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Nombre</label>
                        <input
                            value={nombre}
                            onChange={e => setNombre(e.target.value)}
                            placeholder="Ej: Switch Principal"
                            autoFocus
                            className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Puertos</label>
                        <select
                            value={numPuertos}
                            onChange={e => setNumPuertos(Number(e.target.value))}
                            className="rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        >
                            {OPCIONES_PUERTOS.map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleCrear}
                            disabled={isPending}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl disabled:opacity-50 transition-colors"
                        >
                            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            Crear
                        </button>
                        <button
                            onClick={() => { setShowAdd(false); setError(''); }}
                            disabled={isPending}
                            className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:bg-slate-50"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {error && (
                <p className="text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 mb-4">{error}</p>
            )}

            {/* Switches */}
            {switches.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-10 text-center">
                    <Network className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                    <p className="text-sm font-semibold text-slate-500">No hay switches en este rack.</p>
                    {canEdit && <p className="text-xs text-slate-400 mt-1">Agregá uno para empezar a mapear los puertos.</p>}
                </div>
            ) : (
                <div className="space-y-4">
                    {switches.map(sw => (
                        <SwitchPortGrid
                            key={sw.id}
                            sw={sw}
                            puertos={puertosDe(sw.id)}
                            canEdit={canEdit}
                            onDelete={handleEliminar}
                            equipamientoNombres={equipamientoNombres}
                            onPortClick={canEdit ? (numero, puerto) => setPortModal({ sw, numero, puerto }) : undefined}
                        />
                    ))}
                </div>
            )}

            {/* Modal de asignación de puerto */}
            {portModal && (
                <PortModal
                    proyectoId={proyectoId}
                    switchId={portModal.sw.id}
                    switchNombre={portModal.sw.nombre}
                    numero={portModal.numero}
                    puerto={portModal.puerto}
                    receta={receta}
                    onClose={() => setPortModal(null)}
                />
            )}

            {/* Plantillas */}
            {showApply && (
                <ApplyTemplateModal
                    proyectoId={proyectoId}
                    plantillas={plantillas}
                    haySwitches={switches.length > 0}
                    onClose={() => setShowApply(false)}
                />
            )}
            {showSave && (
                <SaveAsTemplateModal proyectoId={proyectoId} onClose={() => setShowSave(false)} />
            )}

            {/* Leyenda */}
            <div className="flex flex-wrap items-center gap-4 mt-4 text-[10px] font-bold text-slate-500">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-100 border border-slate-200" /> Libre</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500" /> Ocupado</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-500" /> Uplink</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-indigo-200 border border-indigo-300" /> Reservado</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400 ring-1 ring-white" /> PoE</span>
            </div>
        </section>
    );
}
