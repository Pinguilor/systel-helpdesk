'use client';

import { useState, useTransition, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { X, Cpu, Plus, Pencil, Check, Trash2, Loader2, Power, MapPin, Search } from 'lucide-react';
import {
    crearZonaAction, renombrarZonaAction, toggleZonaAction, eliminarZonaAction,
    crearDispositivoAction, actualizarDispositivoAction, toggleDispositivoAction, eliminarDispositivoAction,
    type DispositivosData, type DispositivoItem,
} from '../dispositivos/actions';
import { SearchableCombobox } from '../[id]/rack/components/SearchableCombobox';

const SIN_ZONA = '__sin_zona__';

export function GestorDispositivosModal({ data }: { data: DispositivosData }) {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState('');

    const [selectedId, setSelectedId] = useState<string>('');
    const [nuevaZona, setNuevaZona] = useState('');
    const [nuevoDisp, setNuevoDisp] = useState('');
    const [nuevaVlan, setNuevaVlan] = useState('');
    const [filtro, setFiltro] = useState('');

    // Edición inline: una sola a la vez. key = 'z:<id>' | 'd:<id>'
    const [editKey, setEditKey] = useState<string | null>(null);
    const [editNombre, setEditNombre] = useState('');
    const [editZona, setEditZona] = useState('');
    const [editVlan, setEditVlan] = useState('');
    const [confirmKey, setConfirmKey] = useState<string | null>(null);

    const haySinZona = data.sinZona.length > 0;

    // '' → null (sin VLAN). El rango 1..4094 lo valida el servidor.
    const aVlan = (t: string) => (t.trim() === '' ? null : Number(t));

    // Mantiene una selección válida cuando cambian los datos (zona eliminada, primera carga).
    useEffect(() => {
        const existe = selectedId === SIN_ZONA ? haySinZona : data.zonas.some(z => z.id === selectedId);
        if (!existe) setSelectedId(data.zonas[0]?.id ?? (haySinZona ? SIN_ZONA : ''));
    }, [data, selectedId, haySinZona]);

    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !editKey) cerrar(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [isOpen, editKey]);

    const zonaActual = data.zonas.find(z => z.id === selectedId);
    const dispositivos: DispositivoItem[] = selectedId === SIN_ZONA ? data.sinZona : (zonaActual?.dispositivos ?? []);
    const visibles = useMemo(
        () => dispositivos.filter(d => d.nombre.toLowerCase().includes(filtro.trim().toLowerCase())),
        [dispositivos, filtro],
    );
    const opcionesZona = useMemo(
        () => data.zonas.map(z => ({ value: z.id, label: z.nombre, hint: z.activo ? undefined : 'Desactivada' })),
        [data.zonas],
    );

    function cerrar() {
        setIsOpen(false);
        setError(''); setEditKey(null); setConfirmKey(null);
        setNuevaZona(''); setNuevoDisp(''); setNuevaVlan(''); setFiltro('');
    }

    function ejecutar(fn: () => Promise<{ error?: string; success?: boolean; id?: string }>, alOk?: (r: { id?: string }) => void) {
        setError('');
        startTransition(async () => {
            const res = await fn();
            if (res.error) { setError(res.error); return; }
            alOk?.(res);
            router.refresh();
        });
    }

    const crearZona = () => ejecutar(() => crearZonaAction(nuevaZona), r => { setNuevaZona(''); if (r.id) setSelectedId(r.id); });
    const crearDispositivo = () =>
        ejecutar(() => crearDispositivoAction(selectedId, nuevoDisp, aVlan(nuevaVlan)), () => { setNuevoDisp(''); setNuevaVlan(''); });

    const iniciarEdicion = (key: string, nombre: string, zona = '', vlan: number | null = null) => {
        setEditKey(key); setEditNombre(nombre); setEditZona(zona); setEditVlan(vlan != null ? String(vlan) : '');
        setConfirmKey(null); setError('');
    };

    const guardarEdicionZona = (id: string) =>
        ejecutar(() => renombrarZonaAction(id, editNombre), () => setEditKey(null));
    const guardarEdicionDisp = (id: string) =>
        ejecutar(() => actualizarDispositivoAction(id, editNombre, editZona, aVlan(editVlan)), () => setEditKey(null));

    const btnIcon = 'p-1.5 rounded-lg border border-slate-200 text-slate-400 transition-colors disabled:opacity-50';

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="h-10 px-3.5 rounded-xl bg-white border border-slate-200/80 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-all flex items-center justify-center gap-2 text-sm font-bold cursor-pointer shadow-sm"
                title="Gestionar zonas y dispositivos del patch panel"
            >
                <Cpu className="w-4 h-4" />
                Dispositivos
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm font-sans" onClick={cerrar}>
                    <div
                        className="relative w-full max-w-4xl mx-4 bg-white rounded-3xl border border-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-slate-950 flex items-center justify-center shrink-0 shadow-md">
                                    <Cpu className="w-5 h-5 text-white" strokeWidth={1.75} />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-slate-900">Zonas y Dispositivos</h3>
                                    <p className="text-xs text-slate-400 mt-0.5">Maestro del &quot;Dispositivo final&quot; de las bocas de patch panel</p>
                                </div>
                            </div>
                            <button onClick={cerrar} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors cursor-pointer">
                                <X className="w-4 h-4 text-slate-500" />
                            </button>
                        </div>

                        {error && (
                            <p className="mx-6 mt-4 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 shrink-0">{error}</p>
                        )}

                        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-5 gap-6 min-h-0">
                            {/* ── Zonas ── */}
                            <div className="md:col-span-2 flex flex-col gap-3 md:border-r md:border-slate-100 md:pr-6">
                                <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Zonas ({data.zonas.length})</h4>
                                <div className="flex gap-2">
                                    <input
                                        value={nuevaZona}
                                        onChange={e => setNuevaZona(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); crearZona(); } }}
                                        placeholder="Nueva zona (ej: Zona Lobby)"
                                        maxLength={80}
                                        className="flex-1 min-w-0 rounded-xl border border-slate-200 px-3 py-2 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-transparent"
                                    />
                                    <button onClick={crearZona} disabled={isPending || !nuevaZona.trim()}
                                        className="inline-flex items-center px-3 bg-sky-600 hover:bg-sky-700 text-white rounded-xl disabled:opacity-50 transition-colors" title="Agregar zona">
                                        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                    </button>
                                </div>

                                <ul className="flex flex-col gap-1.5">
                                    {data.zonas.map(z => {
                                        const key = `z:${z.id}`;
                                        const activaSel = selectedId === z.id;
                                        return (
                                            <li key={z.id}
                                                className={`rounded-xl border px-3 py-2 flex items-center gap-2 transition-colors ${activaSel ? 'border-sky-300 bg-sky-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                                                {editKey === key ? (
                                                    <>
                                                        <input value={editNombre} onChange={e => setEditNombre(e.target.value)} autoFocus maxLength={80}
                                                            onKeyDown={e => { if (e.key === 'Enter') guardarEdicionZona(z.id); if (e.key === 'Escape') setEditKey(null); }}
                                                            className="flex-1 min-w-0 rounded-lg border border-sky-300 px-2.5 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200" />
                                                        <button onClick={() => guardarEdicionZona(z.id)} disabled={isPending} className="p-1.5 rounded-lg bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50"><Check className="w-3.5 h-3.5" /></button>
                                                        <button onClick={() => setEditKey(null)} className={`${btnIcon} hover:bg-slate-50`}><X className="w-3.5 h-3.5" /></button>
                                                    </>
                                                ) : confirmKey === key ? (
                                                    <>
                                                        <span className="flex-1 text-xs font-bold text-red-600 truncate">¿Eliminar &quot;{z.nombre}&quot;?</span>
                                                        <button onClick={() => ejecutar(() => eliminarZonaAction(z.id), () => setConfirmKey(null))} disabled={isPending}
                                                            className="px-2.5 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-50">Sí</button>
                                                        <button onClick={() => setConfirmKey(null)} className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-500 text-xs font-bold hover:bg-slate-50">No</button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button onClick={() => { setSelectedId(z.id); setFiltro(''); setEditKey(null); }} className="flex-1 min-w-0 text-left">
                                                            <p className={`text-sm font-bold truncate ${z.activo ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{z.nombre}</p>
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                                {z.dispositivos.length} dispositivo{z.dispositivos.length !== 1 ? 's' : ''}{z.activo ? '' : ' · Desactivada'}
                                                            </p>
                                                        </button>
                                                        <button onClick={() => iniciarEdicion(key, z.nombre)} title="Renombrar" className={`${btnIcon} hover:text-sky-600 hover:border-sky-200 hover:bg-sky-50`}><Pencil className="w-3.5 h-3.5" /></button>
                                                        <button onClick={() => ejecutar(() => toggleZonaAction(z.id, !z.activo))} disabled={isPending} title={z.activo ? 'Desactivar' : 'Activar'}
                                                            className={`${btnIcon} ${z.activo ? '!border-emerald-200 !text-emerald-600 bg-emerald-50 hover:bg-emerald-100' : 'hover:bg-slate-50'}`}><Power className="w-3.5 h-3.5" /></button>
                                                        <button onClick={() => { setConfirmKey(key); setError(''); }} title="Eliminar" className={`${btnIcon} hover:text-red-500 hover:border-red-200 hover:bg-red-50`}><Trash2 className="w-3.5 h-3.5" /></button>
                                                    </>
                                                )}
                                            </li>
                                        );
                                    })}

                                    {haySinZona && (
                                        <li>
                                            <button onClick={() => { setSelectedId(SIN_ZONA); setFiltro(''); setEditKey(null); }}
                                                className={`w-full text-left rounded-xl border border-dashed px-3 py-2 transition-colors ${selectedId === SIN_ZONA ? 'border-amber-300 bg-amber-50' : 'border-slate-300 hover:bg-slate-50'}`}>
                                                <p className="text-sm font-bold text-slate-600">Sin zona</p>
                                                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">{data.sinZona.length} por clasificar</p>
                                            </button>
                                        </li>
                                    )}

                                    {data.zonas.length === 0 && !haySinZona && (
                                        <li className="text-xs text-slate-400 text-center py-6">Crea la primera zona para empezar.</li>
                                    )}
                                </ul>
                            </div>

                            {/* ── Dispositivos de la zona ── */}
                            <div className="md:col-span-3 flex flex-col gap-3">
                                <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-1.5">
                                    <MapPin className="w-3.5 h-3.5 text-sky-500" />
                                    {selectedId === SIN_ZONA ? 'Sin zona' : zonaActual ? `Dispositivos · ${zonaActual.nombre}` : 'Dispositivos'}
                                </h4>

                                {!selectedId ? (
                                    <p className="text-sm text-slate-400 text-center py-10">Selecciona o crea una zona.</p>
                                ) : (
                                    <>
                                        {selectedId !== SIN_ZONA ? (
                                            <div className="flex gap-2">
                                                <input
                                                    value={nuevoDisp}
                                                    onChange={e => setNuevoDisp(e.target.value)}
                                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); crearDispositivo(); } }}
                                                    placeholder="Nuevo dispositivo (ej: POS, NGK)"
                                                    maxLength={80}
                                                    className="flex-1 min-w-0 rounded-xl border border-slate-200 px-3 py-2 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-transparent"
                                                />
                                                <input
                                                    type="number" min={1} max={4094}
                                                    value={nuevaVlan}
                                                    onChange={e => setNuevaVlan(e.target.value)}
                                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); crearDispositivo(); } }}
                                                    placeholder="VLAN"
                                                    title="VLAN por defecto (opcional)"
                                                    className="w-24 rounded-xl border border-slate-200 px-3 py-2 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-transparent"
                                                />
                                                <button onClick={crearDispositivo} disabled={isPending || !nuevoDisp.trim()}
                                                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold rounded-xl disabled:opacity-50 transition-colors">
                                                    <Plus className="w-4 h-4" /> Agregar
                                                </button>
                                            </div>
                                        ) : (
                                            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                                                Estos dispositivos se crearon antes de existir las zonas. Edítalos (lápiz) para asignarles una zona.
                                            </p>
                                        )}

                                        {dispositivos.length > 6 && (
                                            <div className="relative">
                                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                                <input value={filtro} onChange={e => setFiltro(e.target.value)} placeholder="Buscar dispositivo…"
                                                    className="w-full rounded-lg border border-slate-200 pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-200" />
                                            </div>
                                        )}

                                        <ul className="flex flex-col gap-1.5">
                                            {visibles.length === 0 && (
                                                <li className="text-xs text-slate-400 text-center py-8">
                                                    {dispositivos.length === 0 ? 'Esta zona aún no tiene dispositivos.' : 'Sin resultados.'}
                                                </li>
                                            )}
                                            {visibles.map(d => {
                                                const key = `d:${d.id}`;
                                                return (
                                                    <li key={d.id} className="rounded-xl border border-slate-200 px-3 py-2">
                                                        {editKey === key ? (
                                                            <div className="flex flex-col gap-2">
                                                                <input value={editNombre} onChange={e => setEditNombre(e.target.value)} autoFocus maxLength={80}
                                                                    onKeyDown={e => { if (e.key === 'Enter') guardarEdicionDisp(d.id); if (e.key === 'Escape') setEditKey(null); }}
                                                                    className="w-full rounded-lg border border-sky-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200" />
                                                                <div className="grid grid-cols-3 gap-2">
                                                                    <div className="col-span-2">
                                                                        <SearchableCombobox options={opcionesZona} value={editZona} onChange={setEditZona}
                                                                            placeholder="Zona…" searchPlaceholder="Buscar zona…" />
                                                                    </div>
                                                                    <input type="number" min={1} max={4094} value={editVlan}
                                                                        onChange={e => setEditVlan(e.target.value)}
                                                                        placeholder="VLAN" title="VLAN por defecto (opcional)"
                                                                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-200" />
                                                                </div>
                                                                <div className="flex justify-end gap-1.5">
                                                                    <button onClick={() => setEditKey(null)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 text-xs font-bold hover:bg-slate-50">Cancelar</button>
                                                                    <button onClick={() => guardarEdicionDisp(d.id)} disabled={isPending || !editZona}
                                                                        className="px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-bold hover:bg-sky-700 disabled:opacity-50">Guardar</button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-2">
                                                                <div className="flex-1 min-w-0">
                                                                    <p className={`text-sm font-bold truncate ${d.activo ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{d.nombre}</p>
                                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                                        {d.en_uso} uso{d.en_uso !== 1 ? 's' : ''}{d.vlan_default != null ? ` · VLAN ${d.vlan_default}` : ''}{d.activo ? '' : ' · Desactivado'}
                                                                    </p>
                                                                </div>
                                                                {confirmKey === key ? (
                                                                    <>
                                                                        <button onClick={() => ejecutar(() => eliminarDispositivoAction(d.id), () => setConfirmKey(null))} disabled={isPending}
                                                                            className="px-2.5 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-50">Eliminar</button>
                                                                        <button onClick={() => setConfirmKey(null)} className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-500 text-xs font-bold hover:bg-slate-50">Cancelar</button>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <button onClick={() => iniciarEdicion(key, d.nombre, d.zona_id ?? '', d.vlan_default)} title="Editar" className={`${btnIcon} hover:text-sky-600 hover:border-sky-200 hover:bg-sky-50`}><Pencil className="w-3.5 h-3.5" /></button>
                                                                        <button onClick={() => ejecutar(() => toggleDispositivoAction(d.id, !d.activo))} disabled={isPending} title={d.activo ? 'Desactivar' : 'Activar'}
                                                                            className={`${btnIcon} ${d.activo ? '!border-emerald-200 !text-emerald-600 bg-emerald-50 hover:bg-emerald-100' : 'hover:bg-slate-50'}`}><Power className="w-3.5 h-3.5" /></button>
                                                                        <button onClick={() => { setConfirmKey(key); setError(''); }} title="Eliminar" className={`${btnIcon} hover:text-red-500 hover:border-red-200 hover:bg-red-50`}><Trash2 className="w-3.5 h-3.5" /></button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        )}
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
