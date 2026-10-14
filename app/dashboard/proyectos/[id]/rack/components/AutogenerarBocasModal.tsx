'use client';

import { useState, useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { X, Loader2, ListPlus } from 'lucide-react';
import { autogenerarBocasAction } from '../actions';
import type { RackDispositivoPlantilla, RackSwitch } from '../actions';
import { SearchableCombobox } from './SearchableCombobox';
import { opcionesDispositivos } from './dispositivoOpciones';

function Toggle({
    activo, onClick, titulo, detalle, disabled,
}: { activo: boolean; onClick: () => void; titulo: string; detalle?: string; disabled?: boolean }) {
    return (
        <button type="button" onClick={onClick} disabled={disabled}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-sm font-bold text-left transition-colors disabled:opacity-50 ${activo ? 'bg-amber-50 border-amber-300 text-amber-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
            <span>
                {titulo}
                {detalle && <span className="block text-[10px] font-medium opacity-80">{detalle}</span>}
            </span>
            <span className={`w-9 h-5 rounded-full relative shrink-0 ml-3 transition-colors ${activo ? 'bg-amber-400' : 'bg-slate-300'}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${activo ? 'left-4' : 'left-0.5'}`} />
            </span>
        </button>
    );
}

const labelCls = 'block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5';
const inputCls = 'w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent';

export function AutogenerarBocasModal({
    proyectoId,
    patchPanelId,
    panelNombre,
    numBocas,
    dispositivos,
    switches,
    onClose,
}: {
    proyectoId: string;
    patchPanelId: string;
    panelNombre: string;
    numBocas: number;
    dispositivos: RackDispositivoPlantilla[];
    switches: RackSwitch[];
    onClose: () => void;
}) {
    const router = useRouter();
    const [desde, setDesde] = useState(1);
    const [hasta, setHasta] = useState(numBocas);

    const [etiquetar, setEtiquetar] = useState(true);
    const [prefijo, setPrefijo] = useState('');
    const [inicioEtiqueta, setInicioEtiqueta] = useState(1);

    const [plantillaId, setPlantillaId] = useState('');
    const [actualizar, setActualizar] = useState(false);

    const [cruzar, setCruzar] = useState(false);
    const [switchId, setSwitchId] = useState('');
    const [puertoInicial, setPuertoInicial] = useState(1);
    const [vlan, setVlan] = useState('');

    const [error, setError] = useState('');
    const [isPending, startTransition] = useTransition();

    const opcionesDisp = useMemo(() => opcionesDispositivos(dispositivos.filter(d => d.activo)), [dispositivos]);
    const opcionesSwitch = useMemo(
        () => switches.map(s => ({ value: s.id, label: s.nombre, hint: `${s.num_puertos} puertos` })),
        [switches],
    );

    const sw = switches.find(s => s.id === switchId);
    const vlanDefault = plantillaId ? dispositivos.find(d => d.id === plantillaId)?.vlan_default ?? null : null;

    const rango = Math.max(0, hasta - desde + 1);
    const etiquetaDe = (n: number) => {
        const correlativo = inicioEtiqueta + (n - desde);
        return prefijo.trim() ? `${prefijo.trim()} ${correlativo}` : String(correlativo);
    };
    const ultimoPuerto = puertoInicial + Math.max(0, rango - 1);

    const generar = () => {
        setError('');
        if (!Number.isInteger(desde) || !Number.isInteger(hasta) || desde < 1 || hasta < desde || hasta > numBocas) {
            setError(`El rango debe estar entre 1 y ${numBocas}.`);
            return;
        }
        if (cruzar) {
            if (!sw) { setError('Selecciona el switch para la cruzada.'); return; }
            if (!Number.isInteger(puertoInicial) || puertoInicial < 1) { setError('Puerto inicial inválido.'); return; }
            if (ultimoPuerto > sw.num_puertos) {
                setError(`Las ${rango} bocas llegarían hasta el puerto ${ultimoPuerto}, pero "${sw.nombre}" tiene ${sw.num_puertos}.`);
                return;
            }
        }
        const vlanNum = vlan.trim() === '' ? null : parseInt(vlan, 10);
        if (cruzar && vlanNum != null && (Number.isNaN(vlanNum) || vlanNum < 1 || vlanNum > 4094)) {
            setError('La VLAN debe ser un número entre 1 y 4094.');
            return;
        }

        startTransition(async () => {
            const res = await autogenerarBocasAction({
                proyectoId, patchPanelId, desde, hasta,
                etiqueta: etiquetar ? { prefijo, inicio: inicioEtiqueta } : null,
                dispositivoPlantillaId: plantillaId || null,
                actualizarExistentes: actualizar,
                cruzada: cruzar ? { switchId, puertoInicial, vlan: vlanNum } : null,
            });
            if (res.error) { setError(res.error); return; }
            onClose();
            router.refresh();
        });
    };

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="fixed inset-0" onClick={onClose} />
            <div className="relative z-10 bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
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

                <div className="p-5 flex flex-col gap-4 overflow-y-auto">
                    {error && (
                        <p className="text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>
                    )}

                    {/* Rango */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls}>Desde la boca</label>
                            <input type="number" min={1} max={numBocas} value={desde}
                                onChange={e => setDesde(Number(e.target.value))} className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Hasta la boca</label>
                            <input type="number" min={1} max={numBocas} value={hasta}
                                onChange={e => setHasta(Number(e.target.value))} className={inputCls} />
                        </div>
                    </div>

                    {/* Etiquetas correlativas */}
                    <Toggle activo={etiquetar} onClick={() => setEtiquetar(v => !v)}
                        titulo="Etiquetas correlativas" detalle="Completa la columna Etiqueta / Ubicación de todo el rango" />
                    {etiquetar && (
                        <div className="grid grid-cols-3 gap-3">
                            <div className="col-span-2">
                                <label className={labelCls}>Prefijo (opcional)</label>
                                <input value={prefijo} onChange={e => setPrefijo(e.target.value)} placeholder="Ej: Jack" className={inputCls} />
                            </div>
                            <div>
                                <label className={labelCls}>Numerar desde</label>
                                <input type="number" min={0} value={inicioEtiqueta}
                                    onChange={e => setInicioEtiqueta(Number(e.target.value))} className={inputCls} />
                            </div>
                        </div>
                    )}

                    {/* Dispositivo final */}
                    <div>
                        <label className={labelCls}>Dispositivo final (opcional)</label>
                        <SearchableCombobox
                            options={opcionesDisp}
                            value={plantillaId}
                            onChange={setPlantillaId}
                            placeholder="Aplicar un dispositivo a todo el rango…"
                            searchPlaceholder="Buscar zona o dispositivo…"
                            emptyLabel="— Ninguno —"
                            accent="amber"
                        />
                    </div>

                    {/* Cruzada masiva */}
                    <Toggle activo={cruzar} onClick={() => setCruzar(v => !v)} disabled={switches.length === 0}
                        titulo="Cruzar automáticamente con Switch"
                        detalle={switches.length === 0 ? 'Primero agrega un switch al rack' : 'Boca 1 → Puerto 1, Boca 2 → Puerto 2…'} />
                    {cruzar && (
                        <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-3.5 flex flex-col gap-3">
                            <div className="grid grid-cols-3 gap-3">
                                <div className="col-span-2">
                                    <label className={labelCls}>Switch</label>
                                    <SearchableCombobox
                                        options={opcionesSwitch}
                                        value={switchId}
                                        onChange={setSwitchId}
                                        placeholder="Seleccionar…"
                                        searchPlaceholder="Buscar switch…"
                                        searchable={switches.length > 6}
                                        accent="violet"
                                    />
                                </div>
                                <div>
                                    <label className={labelCls}>Puerto inicial</label>
                                    <input type="number" min={1} value={puertoInicial}
                                        onChange={e => setPuertoInicial(Number(e.target.value))} className={inputCls} />
                                </div>
                            </div>
                            <div>
                                <label className={labelCls}>VLAN (opcional)</label>
                                <input type="number" min={1} max={4094} value={vlan}
                                    onChange={e => setVlan(e.target.value)}
                                    placeholder={vlanDefault != null ? `${vlanDefault} (por defecto del dispositivo)` : 'Vacía = la VLAN por defecto de cada dispositivo'}
                                    className={inputCls} />
                            </div>
                            {sw && rango > 0 && (
                                <p className={`text-xs ${ultimoPuerto > sw.num_puertos ? 'text-red-600 font-bold' : 'text-violet-700'}`}>
                                    Boca {desde} → Puerto {puertoInicial} … Boca {hasta} → Puerto {ultimoPuerto}
                                    {ultimoPuerto > sw.num_puertos ? ` (el switch solo tiene ${sw.num_puertos})` : ''}
                                </p>
                            )}
                        </div>
                    )}

                    <Toggle activo={actualizar} onClick={() => setActualizar(v => !v)}
                        titulo="Actualizar también bocas ya creadas del rango"
                        detalle="Sobrescribe etiqueta y dispositivo solo si los indicaste arriba" />

                    {rango > 0 && (
                        <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                            Se procesarán <b>{rango}</b> bocas
                            {etiquetar && <>: <span className="font-mono">&quot;{etiquetaDe(desde)}&quot;</span> … <span className="font-mono">&quot;{etiquetaDe(hasta)}&quot;</span></>}.{' '}
                            {actualizar ? 'Las bocas ya creadas del rango se actualizarán.' : 'Las bocas ya configuradas no se modifican.'}
                        </p>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-1">
                        <button onClick={onClose} disabled={isPending}
                            className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
                            Cancelar
                        </button>
                        <button onClick={generar} disabled={isPending || rango === 0}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold transition-colors disabled:opacity-50">
                            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} {cruzar ? 'Generar y cruzar' : 'Generar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
