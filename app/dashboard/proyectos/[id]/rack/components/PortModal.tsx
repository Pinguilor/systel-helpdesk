'use client';

import { useState, useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { X, Loader2, Trash2, Zap, ArrowUpFromLine } from 'lucide-react';
import type { RackPuerto, RackRecetaItem, RackPatchPanel, RackBoca, RackDispositivoPlantilla } from '../actions';
import { asignarPuertoAction, liberarPuertoAction } from '../actions';
import { SearchableCombobox } from './SearchableCombobox';
import { opcionesDispositivos } from './dispositivoOpciones';

export function PortModal({
    proyectoId,
    switchId,
    switchNombre,
    numero,
    puerto,
    receta,
    dispositivos,
    patchPanels,
    bocas,
    bocasCruzadas,
    dispositivoNombres,
    onClose,
}: {
    proyectoId: string;
    switchId: string;
    switchNombre: string;
    numero: number;
    puerto?: RackPuerto;
    receta: RackRecetaItem[];
    dispositivos: RackDispositivoPlantilla[];
    patchPanels: RackPatchPanel[];
    bocas: RackBoca[];
    bocasCruzadas: Set<string>;
    dispositivoNombres: Map<string, string>;
    onClose: () => void;
}) {
    const router = useRouter();
    const [rol, setRol] = useState<'acceso' | 'uplink'>(puerto?.rol ?? 'acceso');
    const [esPoe, setEsPoe] = useState(puerto?.es_poe ?? false);
    const [plantillaId, setPlantillaId] = useState(puerto?.dispositivo_plantilla_id ?? '');
    const [etiqueta, setEtiqueta] = useState(puerto?.etiqueta_libre ?? '');
    const [notas, setNotas] = useState(puerto?.notas ?? '');
    const [vlan, setVlan] = useState(puerto?.vlan != null ? String(puerto.vlan) : '');
    const [error, setError] = useState('');
    const [isPending, startTransition] = useTransition();

    // Origen del dispositivo: conexión directa (plantilla de dispositivo), o cruzada
    // a una boca de Patch Panel (que hereda su dispositivo/ubicación documentado).
    const bocaActual = bocas.find(b => b.id === puerto?.cruzado_boca_id);
    const [modo, setModo] = useState<'directo' | 'cruzada'>(puerto?.cruzado_boca_id ? 'cruzada' : 'directo');
    const [panelId, setPanelId] = useState(bocaActual?.patch_panel_id ?? '');
    const [bocaId, setBocaId] = useState(puerto?.cruzado_boca_id ?? '');

    // Bocas del panel elegido, ocultando las ya cruzadas a OTRO puerto de switch.
    const bocasDelPanel = bocas.filter(b =>
        b.patch_panel_id === panelId && (!bocasCruzadas.has(b.id) || b.id === puerto?.cruzado_boca_id),
    );
    const bocaSeleccionada = bocasDelPanel.find(b => b.id === bocaId);
    const nombreHeredado = bocaSeleccionada?.dispositivo_plantilla_id
        ? dispositivoNombres.get(bocaSeleccionada.dispositivo_plantilla_id)
        : undefined;

    // VLAN por defecto de cada plantilla de dispositivo (id → vlan).
    const vlanDefaultDe = useMemo(() => {
        const m = new Map<string, number>();
        dispositivos.forEach(d => { if (d.vlan_default != null) m.set(d.id, d.vlan_default); });
        return m;
    }, [dispositivos]);

    const vlanHeredadaDeBoca = bocaSeleccionada?.dispositivo_plantilla_id
        ? vlanDefaultDe.get(bocaSeleccionada.dispositivo_plantilla_id)
        : undefined;

    // Equipo de la Receta que tenía el puerto antes de migrar a plantillas (solo informativo).
    const equipoLegacy = puerto?.proyecto_equipamiento_id
        ? receta.find(r => r.id === puerto.proyecto_equipamiento_id)?.modelo ?? 'equipo de la Receta'
        : null;

    const opcionesDisp = useMemo(
        () => opcionesDispositivos(dispositivos, puerto?.dispositivo_plantilla_id),
        [dispositivos, puerto?.dispositivo_plantilla_id],
    );
    const opcionesPaneles = useMemo(
        () => patchPanels.map(p => ({ value: p.id, label: p.nombre })),
        [patchPanels],
    );
    const opcionesBocas = bocasDelPanel
        .slice()
        .sort((x, y) => x.numero_boca - y.numero_boca)
        .map(b => ({
            value: b.id,
            label: `Boca ${b.numero_boca}`,
            hint: [b.etiqueta_libre, b.dispositivo_plantilla_id ? dispositivoNombres.get(b.dispositivo_plantilla_id) : null]
                .filter(Boolean).join(' · ') || undefined,
        }));

    // Al elegir un dispositivo (o una boca), autocompleta la VLAN con la VLAN por defecto
    // de su plantilla (si tiene). El usuario puede sobreescribirla manualmente luego.
    const handleDispositivoChange = (id: string) => {
        setPlantillaId(id);
        const v = vlanDefaultDe.get(id);
        if (v != null) setVlan(String(v));
    };

    const handleBocaChange = (id: string) => {
        setBocaId(id);
        const pid = bocas.find(b => b.id === id)?.dispositivo_plantilla_id;
        const v = pid ? vlanDefaultDe.get(pid) : undefined;
        if (v != null) setVlan(String(v));
    };

    const guardar = () => {
        setError('');
        startTransition(async () => {
            const vlanNum = vlan.trim() === '' ? null : parseInt(vlan, 10);
            if (vlanNum != null && (Number.isNaN(vlanNum) || vlanNum < 1 || vlanNum > 4094)) {
                setError('La VLAN debe ser un número entre 1 y 4094.');
                return;
            }
            if (modo === 'cruzada' && !bocaId) {
                setError('Selecciona un Patch Panel y una boca de origen.');
                return;
            }
            const res = await asignarPuertoAction({
                proyectoId, switchId, numeroPuerto: numero, rol, esPoe,
                dispositivoPlantillaId: modo === 'directo' ? (plantillaId || null) : null,
                cruzadoBocaId: modo === 'cruzada' ? (bocaId || null) : null,
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

                    {/* Origen del dispositivo: conexión directa o cruzada a Patch Panel */}
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Origen del dispositivo</label>
                        <div className="grid grid-cols-2 gap-2 mb-3">
                            <button type="button" onClick={() => setModo('directo')}
                                className={`px-3 py-2 rounded-xl text-sm font-bold border transition-colors ${modo === 'directo' ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                                Conexión directa
                            </button>
                            <button type="button" onClick={() => setModo('cruzada')}
                                className={`px-3 py-2 rounded-xl text-sm font-bold border transition-colors ${modo === 'cruzada' ? 'bg-violet-50 border-violet-300 text-violet-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                                Cruzada a Patch Panel
                            </button>
                        </div>

                        {modo === 'directo' ? (
                            <div className="grid grid-cols-3 gap-3">
                                {equipoLegacy && !plantillaId && (
                                    <p className="col-span-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                                        Este puerto tenía asignado <b>{equipoLegacy}</b> (Receta). Elige un dispositivo de las plantillas; al guardar, el equipo anterior se reemplaza.
                                    </p>
                                )}
                                <div className="col-span-2">
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Dispositivo</label>
                                    <SearchableCombobox
                                        options={opcionesDisp}
                                        value={plantillaId}
                                        onChange={handleDispositivoChange}
                                        placeholder="Seleccionar dispositivo…"
                                        searchPlaceholder="Buscar zona o dispositivo…"
                                        emptyLabel="— Ninguno —"
                                    />
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
                        ) : (
                            <div className="flex flex-col gap-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Patch Panel</label>
                                        <SearchableCombobox
                                            options={opcionesPaneles}
                                            value={panelId}
                                            onChange={v => { setPanelId(v); setBocaId(''); }}
                                            placeholder="Seleccionar…"
                                            searchPlaceholder="Buscar panel…"
                                            accent="violet"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Boca de origen</label>
                                        <SearchableCombobox
                                            options={opcionesBocas}
                                            value={bocaId}
                                            onChange={handleBocaChange}
                                            placeholder="Seleccionar…"
                                            searchPlaceholder="Buscar boca o ubicación…"
                                            disabled={!panelId}
                                            accent="violet"
                                        />
                                    </div>
                                </div>
                                {bocaSeleccionada && (
                                    <div className="text-xs text-violet-700 bg-violet-50 border border-violet-200 rounded-xl px-3 py-2">
                                        Hereda: <b>{[nombreHeredado, bocaSeleccionada.etiqueta_libre].filter(Boolean).join(' · ') || 'Sin documentar aún'}</b>
                                        {vlanHeredadaDeBoca != null && <> · VLAN por defecto <b>{vlanHeredadaDeBoca}</b></>}
                                    </div>
                                )}
                                <div className="w-1/3">
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">VLAN</label>
                                    <input
                                        type="number" min={1} max={4094} value={vlan}
                                        onChange={e => setVlan(e.target.value)}
                                        placeholder="ej: 410"
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
                                    />
                                </div>
                            </div>
                        )}
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
