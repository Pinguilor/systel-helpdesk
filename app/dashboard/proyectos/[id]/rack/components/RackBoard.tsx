'use client';

import { useState, useEffect, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Network, Plus, Loader2, X, LayoutTemplate, Save, PanelsTopLeft } from 'lucide-react';
import type { RackSwitch, RackPuerto, RackPatchPanel, RackBoca, RackRecetaItem, RackTemplate } from '../actions';
import { crearSwitchAction, eliminarSwitchAction, crearPatchPanelAction, eliminarPatchPanelAction } from '../actions';
import { SwitchPortGrid } from './SwitchPortGrid';
import { PortModal } from './PortModal';
import { PatchPanelGrid } from './PatchPanelGrid';
import { BocaModal } from './BocaModal';
import { AutogenerarBocasModal } from './AutogenerarBocasModal';
import { ApplyTemplateModal, SaveAsTemplateModal } from './TemplateModals';

const OPCIONES_PUERTOS = [8, 24, 48];
const OPCIONES_BOCAS = [24, 48];

export function RackBoard({
    proyectoId,
    initialSwitches,
    initialPuertos,
    initialPatchPanels,
    initialBocas,
    receta,
    plantillas,
    canEdit,
}: {
    proyectoId: string;
    initialSwitches: RackSwitch[];
    initialPuertos: RackPuerto[];
    initialPatchPanels: RackPatchPanel[];
    initialBocas: RackBoca[];
    receta: RackRecetaItem[];
    plantillas: RackTemplate[];
    canEdit: boolean;
}) {
    const router = useRouter();
    const [switches, setSwitches] = useState(initialSwitches);
    const [puertos, setPuertos] = useState(initialPuertos);
    const [patchPanels, setPatchPanels] = useState(initialPatchPanels);
    const [bocas, setBocas] = useState(initialBocas);

    // Re-sincroniza con datos frescos del servidor tras router.refresh().
    useEffect(() => { setSwitches(initialSwitches); }, [initialSwitches]);
    useEffect(() => { setPuertos(initialPuertos); }, [initialPuertos]);
    useEffect(() => { setPatchPanels(initialPatchPanels); }, [initialPatchPanels]);
    useEffect(() => { setBocas(initialBocas); }, [initialBocas]);

    // Mapa equipamiento.id → modelo, para tooltips de puertos/bocas asignados.
    const equipamientoNombres = useMemo(() => {
        const m = new Map<string, string>();
        receta.forEach(r => m.set(r.id, r.modelo));
        return m;
    }, [receta]);

    // Bocas cruzadas a algún puerto de switch (estado derivado, no almacenado).
    const bocasCruzadas = useMemo(
        () => new Set(puertos.filter(p => p.cruzado_boca_id).map(p => p.cruzado_boca_id as string)),
        [puertos],
    );

    // Puerto seleccionado para el modal de asignación.
    const [portModal, setPortModal] = useState<{ sw: RackSwitch; numero: number; puerto?: RackPuerto } | null>(null);
    const [bocaModal, setBocaModal] = useState<{ panel: RackPatchPanel; numero: number; boca?: RackBoca } | null>(null);
    const [autogenModal, setAutogenModal] = useState<RackPatchPanel | null>(null);
    const [showApply, setShowApply] = useState(false);
    const [showSave, setShowSave] = useState(false);

    const [showAdd, setShowAdd] = useState(false);
    const [nombre, setNombre] = useState('');
    const [numPuertos, setNumPuertos] = useState(24);

    const [showAddPanel, setShowAddPanel] = useState(false);
    const [nombrePanel, setNombrePanel] = useState('');
    const [numBocas, setNumBocas] = useState(24);

    const [error, setError] = useState('');
    const [isPending, startTransition] = useTransition();

    const puertosDe = (switchId: string) => puertos.filter(p => p.switch_id === switchId);
    const bocasDe = (patchPanelId: string) => bocas.filter(b => b.patch_panel_id === patchPanelId);

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

    const handleCrearPanel = () => {
        setError('');
        startTransition(async () => {
            const res = await crearPatchPanelAction(proyectoId, nombrePanel, numBocas);
            if (res.error) { setError(res.error); return; }
            setNombrePanel('');
            setNumBocas(24);
            setShowAddPanel(false);
            router.refresh();
        });
    };

    const handleEliminarPanel = async (patchPanelId: string) => {
        const res = await eliminarPatchPanelAction(patchPanelId, proyectoId);
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
                            onClick={() => setShowAddPanel(true)}
                            className="inline-flex items-center gap-2 px-4 py-2 border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 text-sm font-bold rounded-xl transition-all"
                        >
                            <PanelsTopLeft className="w-4 h-4" /> Agregar Patch Panel
                        </button>
                        <button
                            onClick={() => setShowAdd(true)}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-sm transition-all"
                        >
                            <Plus className="w-4 h-4" /> Agregar switch
                        </button>
                    </div>
                )}
            </div>

            {/* Form agregar patch panel */}
            {canEdit && showAddPanel && (
                <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-4 mb-4 flex flex-col sm:flex-row sm:items-end gap-3">
                    <div className="flex-1">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Nombre</label>
                        <input
                            value={nombrePanel}
                            onChange={e => setNombrePanel(e.target.value)}
                            placeholder="Ej: Patch Panel Piso 1"
                            autoFocus
                            className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Bocas</label>
                        <select
                            value={numBocas}
                            onChange={e => setNumBocas(Number(e.target.value))}
                            className="rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                        >
                            {OPCIONES_BOCAS.map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleCrearPanel}
                            disabled={isPending}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-xl disabled:opacity-50 transition-colors"
                        >
                            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            Crear
                        </button>
                        <button
                            onClick={() => { setShowAddPanel(false); setError(''); }}
                            disabled={isPending}
                            className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:bg-slate-50"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

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

            {/* Patch Panels (infraestructura pasiva, se documenta primero en terreno) */}
            {patchPanels.length > 0 && (
                <div className="space-y-4 mb-4">
                    {patchPanels.map(panel => (
                        <PatchPanelGrid
                            key={panel.id}
                            panel={panel}
                            bocas={bocasDe(panel.id)}
                            bocasCruzadas={bocasCruzadas}
                            canEdit={canEdit}
                            onDelete={handleEliminarPanel}
                            equipamientoNombres={equipamientoNombres}
                            onBocaClick={canEdit ? (numero, boca) => setBocaModal({ panel, numero, boca }) : undefined}
                            onAutogenerar={canEdit ? () => setAutogenModal(panel) : undefined}
                        />
                    ))}
                </div>
            )}

            {/* Switches */}
            {switches.length === 0 && patchPanels.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-10 text-center">
                    <Network className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                    <p className="text-sm font-semibold text-slate-500">No hay switches ni patch panels en este rack.</p>
                    {canEdit && <p className="text-xs text-slate-400 mt-1">Agregá infraestructura pasiva o un switch para empezar a mapear los puertos.</p>}
                </div>
            ) : switches.length === 0 ? null : (
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
                    patchPanels={patchPanels}
                    bocas={bocas}
                    bocasCruzadas={bocasCruzadas}
                    equipamientoNombres={equipamientoNombres}
                    onClose={() => setPortModal(null)}
                />
            )}

            {/* Modal de asignación de boca */}
            {bocaModal && (
                <BocaModal
                    proyectoId={proyectoId}
                    patchPanelId={bocaModal.panel.id}
                    panelNombre={bocaModal.panel.nombre}
                    numero={bocaModal.numero}
                    boca={bocaModal.boca}
                    receta={receta}
                    onClose={() => setBocaModal(null)}
                />
            )}

            {/* Modal de carga masiva de bocas */}
            {autogenModal && (
                <AutogenerarBocasModal
                    proyectoId={proyectoId}
                    patchPanelId={autogenModal.id}
                    panelNombre={autogenModal.nombre}
                    numBocas={autogenModal.num_bocas}
                    onClose={() => setAutogenModal(null)}
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
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-300" /> Boca pendiente de cruzada</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-violet-500" /> Boca cruzada</span>
            </div>
        </section>
    );
}
