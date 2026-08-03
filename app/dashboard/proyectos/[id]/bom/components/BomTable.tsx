'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Package, ShoppingCart, AlertTriangle,
    Wrench, MapPin, X, Minus, Plus, Loader2,
} from 'lucide-react';
import { ModalSolicitudRetiroProyecto, type RecetaItem } from '../../equipamiento/components/ModalSolicitudRetiroProyecto';
import { ReportarIncidenciaModal } from '../../components/ReportarIncidenciaModal';
import { instalarMaterial, instalarMaterialEstacionado } from '../actions';

interface Props {
    items:           RecetaItem[];
    proyectoId:      string;
    currentUserRol?: string;
}

// ── Estado / Custodia: badges compactos solo cuando > 0 ──────────────────────

function CustodiaCell({
    estacionada,
    enTransito,
    reingresada,
    libres,
}: {
    estacionada: number;
    enTransito:  number;
    reingresada: number;
    libres:      number;
}) {
    const badges: { label: string; cls: string }[] = [];
    if (enTransito  > 0) badges.push({ label: `${enTransito} en tránsito`,   cls: 'text-blue-700   bg-blue-50   border-blue-200'   });
    if (estacionada > 0) badges.push({ label: `${estacionada} en obra`,      cls: 'text-orange-700 bg-orange-50 border-orange-200' });
    if (reingresada > 0) badges.push({ label: `${reingresada} reingresadas`, cls: 'text-violet-700 bg-violet-50 border-violet-200' });
    if (libres      > 0) badges.push({ label: `${libres} sin declarar`,      cls: 'text-amber-700  bg-amber-50  border-amber-200'  });

    if (badges.length === 0) {
        return <span className="text-slate-300 text-xs font-semibold">—</span>;
    }
    return (
        <div className="flex flex-wrap gap-1 justify-center">
            {badges.map((b) => (
                <span
                    key={b.label}
                    className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${b.cls}`}
                >
                    {b.label}
                </span>
            ))}
        </div>
    );
}

// ── Modal de instalación (Acción A: libres → instaladas) ─────────────────────
// ── y (Acción B: estacionadas → instaladas)             ─────────────────────

type InstallMode = 'normal' | 'desde_obra';

function InstalarModal({
    item,
    mode,
    max,
    proyectoId,
    onClose,
    onSuccess,
}: {
    item:       RecetaItem;
    mode:       InstallMode;
    max:        number;
    proyectoId: string;
    onClose:    () => void;
    onSuccess:  () => void;
}) {
    const [cantidad, setCantidad] = useState(1);
    const [loading,  setLoading]  = useState(false);
    const [error,    setError]    = useState<string | null>(null);

    const handleSubmit = async () => {
        setLoading(true);
        setError(null);
        const fn     = mode === 'desde_obra' ? instalarMaterialEstacionado : instalarMaterial;
        const result = await fn(item.id, cantidad, proyectoId);
        setLoading(false);
        if (result.error) {
            setError(result.error);
        } else {
            onSuccess();
        }
    };

    const isDesdeObra = mode === 'desde_obra';
    const titulo      = isDesdeObra ? 'Instalar desde Obra' : 'Instalar Material';
    const subtitulo   = isDesdeObra
        ? 'Mover unidades estacionadas en obra → instaladas'
        : 'Marcar unidades entregadas como instaladas en el sitio';
    const btnClass    = isDesdeObra
        ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30'
        : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/30';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-2xl">
                    <div>
                        <h2 className="text-lg font-black text-slate-900">{titulo}</h2>
                        <p className="text-xs text-slate-500 mt-0.5">{subtitulo}</p>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-4">
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                        <p className="text-sm font-bold text-slate-900 leading-tight">
                            {item.inventario?.modelo || 'Material'}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                            {item.inventario?.familia || ''}
                        </p>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                            <p className="text-xs font-semibold text-red-700">{error}</p>
                        </div>
                    )}

                    <div>
                        <label className="text-xs font-black text-slate-500 uppercase tracking-wider block mb-2">
                            Cantidad a instalar (máx. {max})
                        </label>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setCantidad(c => Math.max(1, c - 1))}
                                disabled={loading || cantidad <= 1}
                                className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-colors"
                            >
                                <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-14 text-center font-black text-2xl text-slate-900">
                                {cantidad}
                            </span>
                            <button
                                onClick={() => setCantidad(c => Math.min(max, c + 1))}
                                disabled={loading || cantidad >= max}
                                className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                            {max > 1 && (
                                <button
                                    onClick={() => setCantidad(max)}
                                    disabled={loading}
                                    className="text-xs font-bold text-indigo-500 hover:text-indigo-700 underline underline-offset-2 transition-colors"
                                >
                                    Todo ({max})
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 pb-6 flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="flex-1 px-4 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors border border-slate-200"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className={`flex-1 px-4 py-2.5 rounded-xl font-bold text-white ${btnClass} shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2`}
                    >
                        {loading
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Wrench   className="w-4 h-4" />
                        }
                        {loading ? 'Guardando…' : 'Confirmar'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export function BomTable({ items, proyectoId, currentUserRol = 'tecnico' }: Props) {
    const router = useRouter();

    const [isCartOpen,     setIsCartOpen]     = useState(false);
    const [incidenciaItem, setIncidenciaItem] = useState<RecetaItem | null>(null);
    const [installState,   setInstallState]   = useState<{
        item: RecetaItem;
        mode: InstallMode;
        max:  number;
    } | null>(null);

    const totals = items.reduce(
        (acc, item) => ({
            presupuestada: acc.presupuestada + (item.cantidad_total     ?? 0),
            entregada:     acc.entregada     + (item.cantidad_entregada ?? 0),
            instalada:     acc.instalada     + (item.cantidad_instalada ?? 0),
        }),
        { presupuestada: 0, entregada: 0, instalada: 0 }
    );

    const handleInstallSuccess = () => {
        setInstallState(null);
        router.refresh();
    };

    if (!items || items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                <Package className="w-8 h-8 text-slate-300 mb-3" strokeWidth={1.5} />
                <p className="text-slate-500 font-bold text-sm">Receta Maestra Vacía</p>
                <p className="text-slate-400 text-xs mt-1">Aún no se ha definido el equipamiento para este proyecto.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-in fade-in duration-500">

            {/* Cabecera con CTA */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-4 border border-slate-200 rounded-2xl shadow-sm gap-4">
                <div>
                    <h3 className="text-base font-black text-slate-900">Receta Maestra del Proyecto</h3>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mt-0.5">
                        Ciclo de vida del hardware
                    </p>
                </div>
                <button
                    onClick={() => setIsCartOpen(true)}
                    className="flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-500/30 transition-all duration-300 active:scale-[0.98]"
                >
                    <ShoppingCart className="w-4 h-4" />
                    Solicitar Retiro a Bodega
                </button>
            </div>

            {/* Tabla principal */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-y-auto max-h-[560px]">
                    <table className="w-full text-sm border-collapse">
                        <thead className="sticky top-0 z-10">
                            <tr className="border-b-2 border-slate-200 bg-slate-50">
                                <th className="text-left px-5 py-3 text-xs font-black text-slate-500 uppercase tracking-wider border-r border-slate-100">
                                    Material / Categoría
                                </th>
                                <th className="text-center px-4 py-3 text-xs font-black text-slate-400 uppercase tracking-wider border-r border-slate-100 whitespace-nowrap">
                                    Presupuestado
                                </th>
                                <th className="text-center px-4 py-3 text-xs font-black text-slate-400 uppercase tracking-wider border-r border-slate-100 whitespace-nowrap">
                                    Entregado
                                </th>
                                <th className="text-center px-4 py-3 text-xs font-black text-emerald-600 uppercase tracking-wider border-r border-slate-100 whitespace-nowrap">
                                    Instalado
                                </th>
                                <th className="text-center px-4 py-3 text-xs font-black text-slate-400 uppercase tracking-wider border-r border-slate-100">
                                    Estado / Custodia
                                </th>
                                <th className="text-center px-3 py-3 text-xs font-black text-slate-400 uppercase tracking-wider bg-slate-50 w-36">
                                    Acciones
                                </th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100">
                            {items.map((item) => {
                                const instalada   = item.cantidad_instalada   ?? 0;
                                const estacionada = item.cantidad_estacionada ?? 0;
                                const enTransito  = item.cantidad_en_transito ?? 0;
                                const reingresada = item.cantidad_reingresada ?? 0;
                                const entregada   = item.cantidad_entregada   ?? 0;
                                const total       = item.cantidad_total        ?? 0;

                                const libres = Math.max(
                                    0,
                                    entregada - instalada - estacionada - enTransito - reingresada
                                );

                                // Condiciones para cada botón
                                const puedeInstalar    = libres > 0;
                                const puedeDesdeObra   = estacionada > 0;
                                const puedeReportar    = libres > 0;
                                const tieneAcciones    = puedeInstalar || puedeDesdeObra || puedeReportar;

                                const rowClass = enTransito > 0
                                    ? 'bg-blue-50/20 hover:bg-blue-50/40'
                                    : libres > 0 && entregada > 0
                                    ? 'bg-amber-50/10 hover:bg-amber-50/30'
                                    : 'hover:bg-slate-50/70';

                                return (
                                    <tr key={item.id} className={`transition-colors ${rowClass}`}>

                                        {/* Modelo */}
                                        <td className="px-5 py-3.5 border-r border-slate-100">
                                            <p className="font-bold text-slate-900 text-sm leading-tight">
                                                {item.inventario?.modelo || 'Modelo no especificado'}
                                            </p>
                                            <p className="text-[10px] text-slate-400 mt-0.5">
                                                {item.inventario?.familia || 'Sin familia'}
                                            </p>
                                        </td>

                                        {/* Presupuestado */}
                                        <td className="px-4 py-3.5 text-center border-r border-slate-100">
                                            <span className="text-sm font-black text-slate-700">{total}</span>
                                            {total > entregada && entregada > 0 && (
                                                <p className="text-[9px] text-slate-400 mt-0.5">
                                                    {total - entregada} sin despachar
                                                </p>
                                            )}
                                        </td>

                                        {/* Entregado */}
                                        <td className="px-4 py-3.5 text-center border-r border-slate-100">
                                            {entregada > 0 ? (
                                                <span className="text-sm font-black text-slate-700">{entregada}</span>
                                            ) : (
                                                <span className="text-slate-300 text-xs font-semibold">—</span>
                                            )}
                                        </td>

                                        {/* Instalado */}
                                        <td className="px-4 py-3.5 text-center border-r border-slate-100">
                                            {instalada > 0 ? (
                                                <span className="inline-flex items-center justify-center font-black text-xs px-2 py-0.5 rounded-full text-emerald-700 bg-emerald-50 border border-emerald-200">
                                                    {instalada}
                                                </span>
                                            ) : (
                                                <span className="text-slate-300 text-xs font-semibold">—</span>
                                            )}
                                        </td>

                                        {/* Estado / Custodia */}
                                        <td className="px-4 py-3.5 text-center border-r border-slate-100">
                                            <CustodiaCell
                                                estacionada={estacionada}
                                                enTransito={enTransito}
                                                reingresada={reingresada}
                                                libres={libres}
                                            />
                                        </td>

                                        {/* Acciones */}
                                        <td className="px-3 py-3 text-center">
                                            {tieneAcciones && (
                                                <div className="flex flex-col gap-1.5 items-stretch">
                                                    {/* A: Instalar unidades libres */}
                                                    {puedeInstalar && (
                                                        <button
                                                            onClick={() => setInstallState({ item, mode: 'normal', max: libres })}
                                                            title={`Marcar ${libres} unidad(es) como instaladas`}
                                                            className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[10px] font-black uppercase tracking-wider transition-colors"
                                                        >
                                                            <Wrench className="w-3 h-3 shrink-0" />
                                                            Instalar
                                                        </button>
                                                    )}

                                                    {/* B: Instalar desde Obra (estacionadas) */}
                                                    {puedeDesdeObra && (
                                                        <button
                                                            onClick={() => setInstallState({ item, mode: 'desde_obra', max: estacionada })}
                                                            title={`Instalar ${estacionada} unidad(es) estacionadas en obra`}
                                                            className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 text-[10px] font-black uppercase tracking-wider transition-colors"
                                                        >
                                                            <MapPin className="w-3 h-3 shrink-0" />
                                                            Desde Obra
                                                        </button>
                                                    )}

                                                    {/* C: Reportar incidencia (unidades libres) */}
                                                    {puedeReportar && (
                                                        <button
                                                            onClick={() => setIncidenciaItem(item)}
                                                            title="Declarar destino de unidades sin estado"
                                                            className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 text-[10px] font-black uppercase tracking-wider transition-colors"
                                                        >
                                                            <AlertTriangle className="w-3 h-3 shrink-0" />
                                                            Incidencia
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>

                        {/* Footer de totales */}
                        {items.length > 1 && (
                            <tfoot>
                                <tr className="border-t-2 border-slate-200 bg-slate-50">
                                    <td className="px-5 py-3 border-r border-slate-200">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                            Total ({items.length} ítems)
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center border-r border-slate-200">
                                        <span className="text-xs font-black text-slate-700">{totals.presupuestada}</span>
                                    </td>
                                    <td className="px-4 py-3 text-center border-r border-slate-200">
                                        <span className="text-xs font-black text-slate-700">{totals.entregada}</span>
                                    </td>
                                    <td className="px-4 py-3 text-center border-r border-slate-200">
                                        <span className={`text-xs font-black ${totals.instalada > 0 ? 'text-emerald-700' : 'text-slate-300'}`}>
                                            {totals.instalada || '—'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 border-r border-slate-200" />
                                    <td className="px-3 py-3" />
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            {/* Modal de Carrito */}
            <ModalSolicitudRetiroProyecto
                proyectoId={proyectoId}
                isOpen={isCartOpen}
                onClose={() => setIsCartOpen(false)}
                receta={items}
            />

            {/* Modal de Instalación (Acciones A y B) */}
            {installState && (
                <InstalarModal
                    item={installState.item}
                    mode={installState.mode}
                    max={installState.max}
                    proyectoId={proyectoId}
                    onClose={() => setInstallState(null)}
                    onSuccess={handleInstallSuccess}
                />
            )}

            {/* Modal de Incidencia (Acción C) */}
            {incidenciaItem && (
                <ReportarIncidenciaModal
                    proyectoId={proyectoId}
                    proyectoEquipamientoId={incidenciaItem.id}
                    modeloMaterial={incidenciaItem.inventario?.modelo ?? 'Material'}
                    unidadesLibres={Math.max(
                        0,
                        (incidenciaItem.cantidad_entregada   ?? 0) -
                        (incidenciaItem.cantidad_instalada   ?? 0) -
                        (incidenciaItem.cantidad_estacionada ?? 0) -
                        (incidenciaItem.cantidad_en_transito ?? 0) -
                        (incidenciaItem.cantidad_reingresada ?? 0)
                    )}
                    onClose={() => setIncidenciaItem(null)}
                    onSuccess={() => { setIncidenciaItem(null); router.refresh(); }}
                />
            )}
        </div>
    );
}
