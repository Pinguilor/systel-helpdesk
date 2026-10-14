'use client';

import { useState, useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { X, Loader2, Trash2, Cable } from 'lucide-react';
import type { RackBoca, RackDispositivoPlantilla, RackSwitch, RackPuerto } from '../actions';
import { asignarBocaAction, liberarBocaAction, cruzarBocaAction } from '../actions';
import { SearchableCombobox } from './SearchableCombobox';
import { opcionesDispositivos } from './dispositivoOpciones';

export function BocaModal({
    proyectoId,
    patchPanelId,
    panelNombre,
    numero,
    boca,
    dispositivos,
    switches,
    puertos,
    onClose,
}: {
    proyectoId: string;
    patchPanelId: string;
    panelNombre: string;
    numero: number;
    boca?: RackBoca;
    dispositivos: RackDispositivoPlantilla[];
    switches: RackSwitch[];
    puertos: RackPuerto[];
    onClose: () => void;
}) {
    const router = useRouter();

    // Cruzada actual de esta boca (si existe): el puerto de switch que la referencia.
    const cruzadaActual = boca ? puertos.find(p => p.cruzado_boca_id === boca.id) : undefined;

    const [plantillaId, setPlantillaId] = useState(boca?.dispositivo_plantilla_id ?? '');
    const [etiqueta, setEtiqueta] = useState(boca?.etiqueta_libre ?? '');
    const [notas, setNotas] = useState(boca?.notas ?? '');
    const [switchId, setSwitchId] = useState(cruzadaActual?.switch_id ?? '');
    const [puertoNum, setPuertoNum] = useState(cruzadaActual ? String(cruzadaActual.numero_puerto) : '');
    const [vlan, setVlan] = useState(cruzadaActual?.vlan != null ? String(cruzadaActual.vlan) : '');
    const [error, setError] = useState('');
    const [isPending, startTransition] = useTransition();

    const opciones = useMemo(
        () => opcionesDispositivos(dispositivos, boca?.dispositivo_plantilla_id),
        [dispositivos, boca?.dispositivo_plantilla_id],
    );

    const vlanDefault = plantillaId ? dispositivos.find(d => d.id === plantillaId)?.vlan_default ?? null : null;

    const opcionesSwitch = useMemo(
        () => switches.map(s => ({ value: s.id, label: s.nombre, hint: `${s.num_puertos} puertos` })),
        [switches],
    );

    // Puertos del switch elegido: libres, o con atributos pero sin dispositivo, o el que ya
    // cruza esta boca. Se excluyen los que tienen dispositivo directo u otra boca cruzada.
    const opcionesPuerto = useMemo(() => {
        const sw = switches.find(s => s.id === switchId);
        if (!sw) return [];
        const porNumero = new Map(puertos.filter(p => p.switch_id === sw.id).map(p => [p.numero_puerto, p]));
        const out: { value: string; label: string; hint?: string }[] = [];
        for (let n = 1; n <= sw.num_puertos; n++) {
            const p = porNumero.get(n);
            const propio = !!p && p.id === cruzadaActual?.id;
            if (p && !propio) {
                const ocupado = p.proyecto_equipamiento_id || p.inventario_id || p.dispositivo_plantilla_id || p.cruzado_boca_id;
                if (ocupado) continue;
            }
            out.push({
                value: String(n),
                label: `Puerto ${n}`,
                hint: propio ? 'Cruzada actual' : p ? [p.rol === 'uplink' ? 'Uplink' : null, p.etiqueta_libre].filter(Boolean).join(' · ') || 'Reservado' : 'Libre',
            });
        }
        return out;
    }, [switches, puertos, switchId, cruzadaActual?.id]);

    const guardar = () => {
        setError('');
        startTransition(async () => {
            const vlanNum = vlan.trim() === '' ? null : parseInt(vlan, 10);
            if (vlanNum != null && (Number.isNaN(vlanNum) || vlanNum < 1 || vlanNum > 4094)) {
                setError('La VLAN debe ser un número entre 1 y 4094.');
                return;
            }
            if (switchId && !puertoNum) {
                setError('Selecciona el puerto del switch para la cruzada.');
                return;
            }

            const res = await asignarBocaAction({
                proyectoId, patchPanelId, numeroBoca: numero,
                dispositivoPlantillaId: plantillaId || null,
                etiquetaLibre: etiqueta || null,
                notas: notas || null,
            });
            if (res.error || !res.bocaId) { setError(res.error ?? 'No se pudo guardar la boca.'); return; }

            const cambioCruzada =
                switchId !== (cruzadaActual?.switch_id ?? '') ||
                puertoNum !== (cruzadaActual ? String(cruzadaActual.numero_puerto) : '') ||
                (switchId !== '' && vlanNum !== (cruzadaActual?.vlan ?? null));

            if (cambioCruzada) {
                const cr = await cruzarBocaAction({
                    proyectoId,
                    bocaId: res.bocaId,
                    switchId: switchId || null,
                    numeroPuerto: switchId && puertoNum ? Number(puertoNum) : null,
                    vlan: vlanNum,
                });
                if (cr.error) { setError(`La boca se guardó, pero la cruzada falló: ${cr.error}`); router.refresh(); return; }
            }

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
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Dispositivo final</label>
                        <SearchableCombobox
                            options={opciones}
                            value={plantillaId}
                            onChange={setPlantillaId}
                            placeholder="Seleccionar plantilla…"
                            searchPlaceholder="Buscar zona o dispositivo…"
                            emptyLabel="— Ninguno —"
                            accent="amber"
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Etiqueta / Ubicación</label>
                        <input value={etiqueta} onChange={e => setEtiqueta(e.target.value)}
                            placeholder="Ej: Cámara pasillo, Jack sala 204…"
                            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent" />
                    </div>

                    {/* Cruzada a Switch */}
                    <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-3.5 flex flex-col gap-3">
                        <p className="flex items-center gap-1.5 text-[10px] font-black text-violet-700 uppercase tracking-widest">
                            <Cable className="w-3.5 h-3.5" /> Cruzada a Switch
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Switch</label>
                                <SearchableCombobox
                                    options={opcionesSwitch}
                                    value={switchId}
                                    onChange={v => { setSwitchId(v); setPuertoNum(''); }}
                                    placeholder="Sin cruzar"
                                    searchPlaceholder="Buscar switch…"
                                    emptyLabel="— No cruzada —"
                                    searchable={switches.length > 6}
                                    accent="violet"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Puerto</label>
                                <SearchableCombobox
                                    options={opcionesPuerto}
                                    value={puertoNum}
                                    onChange={setPuertoNum}
                                    placeholder="Seleccionar…"
                                    searchPlaceholder="Buscar puerto…"
                                    disabled={!switchId}
                                    accent="violet"
                                />
                            </div>
                        </div>
                        {switchId && (
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">VLAN del puerto</label>
                                <input
                                    type="number" min={1} max={4094} value={vlan}
                                    onChange={e => setVlan(e.target.value)}
                                    placeholder={vlanDefault != null ? `${vlanDefault} (por defecto del dispositivo)` : 'ej: 410'}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
                                />
                                {vlanDefault != null && vlan.trim() === '' && (
                                    <p className="text-[10px] text-violet-700 mt-1">Vacío = se usará la VLAN {vlanDefault} del dispositivo.</p>
                                )}
                            </div>
                        )}
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
