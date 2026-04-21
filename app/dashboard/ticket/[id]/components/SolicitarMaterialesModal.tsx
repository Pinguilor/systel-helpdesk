'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    X, ClipboardList, PackageSearch, Hash, Search, Plus, Minus,
    Trash2, SendHorizonal, AlertCircle, Loader2, CheckCircle2,
    ChevronDown, Layers
} from 'lucide-react';
import { crearSolicitudMaterialAction, getCatalogoInventarioCentralAction } from '../actions';
import { useRouter } from 'next/navigation';

// ── Tipos ──────────────────────────────────────────────────
interface InventarioItem {
    id: string;
    modelo: string;
    familia: string;
    es_serializado: boolean;
    numero_serie: string | null;
    cantidad: number;
    estado: string;
}

interface CarritoItem {
    inventario_id: string;
    modelo: string;
    familia: string;
    es_serializado: boolean;
    numero_serie: string | null;
    cantidad: number; // siempre 1 para serializados
}

interface Props {
    ticketId: string;
    onClose: () => void;
}

// ── Helpers ────────────────────────────────────────────────
function groupGenericos(items: InventarioItem[]): InventarioItem[] {
    const map = new Map<string, InventarioItem>();
    items.forEach(item => {
        if (item.es_serializado) return; // serializados no se agrupan
        const key = `${item.familia}__${item.modelo}`;
        if (map.has(key)) {
            map.get(key)!.cantidad += item.cantidad;
        } else {
            map.set(key, { ...item });
        }
    });
    return Array.from(map.values());
}

// ── Componente ─────────────────────────────────────────────
export function SolicitarMaterialesModal({ ticketId, onClose }: Props) {
    const router = useRouter();

    // Estado de carga del catálogo
    const [catalogo, setCatalogo] = useState<InventarioItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    // Estado UI
    const [search, setSearch] = useState('');
    const [familiaFiltro, setFamiliaFiltro] = useState('Todos');
    const [carrito, setCarrito] = useState<CarritoItem[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [success, setSuccess] = useState(false);

    // ── Cargar catálogo de Bodega Central ──
    useEffect(() => {
        async function fetchCatalogo() {
            setIsLoading(true);
            setLoadError('');
            try {
                const result = await getCatalogoInventarioCentralAction();
                if (result.error) throw new Error(result.error);
                setCatalogo(result.data || []);
            } catch (e: any) {
                setLoadError(e.message || 'Error desconocido al cargar inventario.');
            } finally {
                setIsLoading(false);
            }
        }
        fetchCatalogo();
    }, []);

    // ── Familias disponibles para filtro ──
    const familias = useMemo(() => {
        const set = new Set(catalogo.map(i => i.familia));
        return ['Todos', ...Array.from(set).sort()];
    }, [catalogo]);

    // ── Catálogo filtrado y agrupado ──
    const { genericosFiltrados, serializadosFiltrados } = useMemo(() => {
        const todos = catalogo.filter(item => {
            const matchSearch =
                (item.modelo ?? '').toLowerCase().includes(search.toLowerCase()) ||
                (item.familia ?? '').toLowerCase().includes(search.toLowerCase()) ||
                (item.numero_serie || '').toLowerCase().includes(search.toLowerCase());
            const matchFamilia = familiaFiltro === 'Todos' || item.familia === familiaFiltro;
            return matchSearch && matchFamilia;
        });

        const serializados = todos.filter(i => i.es_serializado);
        const genericos = groupGenericos(todos.filter(i => !i.es_serializado));
        return { genericosFiltrados: genericos, serializadosFiltrados: serializados };
    }, [catalogo, search, familiaFiltro]);

    // ── Helpers de carrito ──
    const cantidadEnCarrito = (inventarioId: string) =>
        carrito.find(c => c.inventario_id === inventarioId)?.cantidad ?? 0;

    const yaEnCarrito = (inventarioId: string) =>
        carrito.some(c => c.inventario_id === inventarioId);

    /** Para genérico: suma 1 (usando el ID de la primera fila de esa familia+modelo) */
    const agregarGenerico = (item: InventarioItem) => {
        const stockReal = catalogo
            .filter(i => !i.es_serializado && i.familia === item.familia && i.modelo === item.modelo)
            .reduce((sum, i) => sum + i.cantidad, 0);

        setCarrito(prev => {
            const existing = prev.find(c => c.inventario_id === item.id);
            if (existing) {
                if (existing.cantidad >= stockReal) return prev; // no superar stock
                return prev.map(c =>
                    c.inventario_id === item.id ? { ...c, cantidad: c.cantidad + 1 } : c
                );
            }
            return [...prev, {
                inventario_id: item.id,
                modelo: item.modelo,
                familia: item.familia,
                es_serializado: false,
                numero_serie: null,
                cantidad: 1,
            }];
        });
    };

    const reducirGenerico = (inventarioId: string) => {
        setCarrito(prev =>
            prev.flatMap(c => {
                if (c.inventario_id !== inventarioId) return [c];
                if (c.cantidad <= 1) return []; // eliminar si llega a 0
                return [{ ...c, cantidad: c.cantidad - 1 }];
            })
        );
    };

    /** Para serializado: toggle (add/remove) */
    const toggleSerializado = (item: InventarioItem) => {
        setCarrito(prev => {
            if (prev.some(c => c.inventario_id === item.id)) {
                return prev.filter(c => c.inventario_id !== item.id);
            }
            return [...prev, {
                inventario_id: item.id,
                modelo: item.modelo,
                familia: item.familia,
                es_serializado: true,
                numero_serie: item.numero_serie,
                cantidad: 1,
            }];
        });
    };

    const eliminarDelCarrito = (inventarioId: string) =>
        setCarrito(prev => prev.filter(c => c.inventario_id !== inventarioId));

    const totalItems = carrito.reduce((s, c) => s + c.cantidad, 0);

    // ── Enviar solicitud ──
    const handleEnviar = async () => {
        if (carrito.length === 0) return;
        setIsSubmitting(true);
        setSubmitError('');

        const items = carrito.map(c => ({
            inventario_id: c.inventario_id,
            cantidad: c.cantidad,
        }));

        const result = await crearSolicitudMaterialAction(ticketId, items);
        setIsSubmitting(false);

        if (result.error) {
            setSubmitError(result.error);
        } else {
            setSuccess(true);
            setTimeout(() => {
                onClose();
                router.refresh();
            }, 1800);
        }
    };

    // ── Render ──────────────────────────────────────────────
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[calc(100dvh-2rem)] overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* ── HEADER ── */}
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-900 text-white rounded-xl shadow-sm">
                            <ClipboardList className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-black text-slate-800 tracking-tight">
                                Solicitar Materiales a Bodega
                            </h2>
                            <p className="text-xs text-slate-500 font-medium">
                                Selecciona los materiales que necesitas para este ticket
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        title="Cerrar modal"
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-40"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* ── BODY ── */}
                <div className="flex flex-col lg:flex-row flex-1 overflow-hidden min-h-0">

                    {/* ════════════════════════════════
                        COLUMNA IZQUIERDA: CATÁLOGO
                    ════════════════════════════════ */}
                    <div className="flex-1 flex flex-col overflow-hidden border-b lg:border-b-0 lg:border-r border-slate-100 min-h-0">

                        {/* Filtros */}
                        <div className="p-4 space-y-3 border-b border-slate-100 bg-white shrink-0">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                <input
                                    type="text"
                                    placeholder="Buscar por modelo, familia o N° serie…"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2.5 text-sm font-medium border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-slate-50 focus:bg-white transition-all placeholder:text-slate-400"
                                />
                            </div>
                            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                                {familias.map(f => (
                                    <button
                                        key={f}
                                        onClick={() => setFamiliaFiltro(f)}
                                        className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                            familiaFiltro === f
                                                ? 'bg-indigo-600 text-white shadow-sm'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        {f}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Lista de ítems */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-4">
                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                                    <Loader2 className="w-8 h-8 animate-spin" />
                                    <p className="text-sm font-medium">Cargando inventario central…</p>
                                </div>
                            ) : loadError ? (
                                <div className="m-4 p-4 bg-red-50 text-red-600 rounded-xl border border-red-200 text-sm font-medium flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    {loadError}
                                </div>
                            ) : (
                                <>
                                    {/* ── GENÉRICOS ── */}
                                    {genericosFiltrados.length > 0 && (
                                        <div>
                                            <div className="flex items-center gap-2 mb-2 px-1">
                                                <div className="p-1 bg-amber-100 text-amber-600 rounded-md">
                                                    <Layers className="w-3.5 h-3.5" />
                                                </div>
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                                    Repuestos y Consumibles
                                                </span>
                                            </div>
                                            <div className="space-y-1.5">
                                                {genericosFiltrados.map(item => {
                                                    const enCarrito = cantidadEnCarrito(item.id);
                                                    const stockTotal = catalogo
                                                        .filter(i => !i.es_serializado && i.familia === item.familia && i.modelo === item.modelo)
                                                        .reduce((s, i) => s + i.cantidad, 0);

                                                    return (
                                                        <div
                                                            key={item.id}
                                                            className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                                                                enCarrito > 0
                                                                    ? 'bg-indigo-50 border-indigo-200 shadow-sm'
                                                                    : 'bg-white border-slate-200 hover:border-slate-300'
                                                            }`}
                                                        >
                                                            <div className="flex flex-col min-w-0 flex-1 pr-3">
                                                                <span className="text-sm font-bold text-slate-800 truncate">{item.modelo}</span>
                                                                <div className="flex items-center gap-2 mt-0.5">
                                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{item.familia}</span>
                                                                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${stockTotal <= 3 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                                        Stock: {stockTotal}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-1 shrink-0">
                                                                {enCarrito > 0 ? (
                                                                    <>
                                                                        <button
                                                                            onClick={() => reducirGenerico(item.id)}
                                                                            title="Reducir cantidad"
                                                                            className="w-7 h-7 flex items-center justify-center bg-white border border-slate-300 text-slate-600 rounded-lg hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-colors shadow-sm"
                                                                        >
                                                                            <Minus className="w-3.5 h-3.5" />
                                                                        </button>
                                                                        <span className="w-8 text-center text-sm font-black text-indigo-700">{enCarrito}</span>
                                                                        <button
                                                                            onClick={() => agregarGenerico(item)}
                                                                            disabled={enCarrito >= stockTotal}
                                                                            title="Aumentar cantidad"
                                                                            className="w-7 h-7 flex items-center justify-center bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                                                                        >
                                                                            <Plus className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => agregarGenerico(item)}
                                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm active:scale-95"
                                                                    >
                                                                        <Plus className="w-3.5 h-3.5" />
                                                                        Agregar
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* ── SERIALIZADOS ── */}
                                    {serializadosFiltrados.length > 0 && (
                                        <div>
                                            <div className="flex items-center gap-2 mb-2 px-1">
                                                <div className="p-1 bg-indigo-100 text-indigo-600 rounded-md">
                                                    <Hash className="w-3.5 h-3.5" />
                                                </div>
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                                    Equipos Serializados
                                                </span>
                                            </div>
                                            <div className="space-y-1.5">
                                                {serializadosFiltrados.map(item => {
                                                    const seleccionado = yaEnCarrito(item.id);
                                                    return (
                                                        <button
                                                            key={item.id}
                                                            type="button"
                                                            onClick={() => toggleSerializado(item)}
                                                            className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left active:scale-[0.99] ${
                                                                seleccionado
                                                                    ? 'bg-indigo-50 border-indigo-300 shadow-sm ring-1 ring-indigo-200'
                                                                    : 'bg-white border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/30'
                                                            }`}
                                                        >
                                                            <div className="flex flex-col min-w-0 flex-1">
                                                                <span className="text-sm font-bold text-slate-800 truncate">{item.modelo}</span>
                                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{item.familia}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 shrink-0 ml-3">
                                                                <span className="font-mono text-xs bg-slate-100 text-slate-600 border border-slate-200 px-2 py-1 rounded-lg">
                                                                    #{item.numero_serie || 'S/N'}
                                                                </span>
                                                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                                                    seleccionado
                                                                        ? 'bg-indigo-600 border-indigo-600'
                                                                        : 'border-slate-300 bg-white'
                                                                }`}>
                                                                    {seleccionado && <CheckCircle2 className="w-3 h-3 text-white" />}
                                                                </div>
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {genericosFiltrados.length === 0 && serializadosFiltrados.length === 0 && (
                                        <div className="py-16 text-center">
                                            <PackageSearch className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                                            <p className="text-sm font-medium text-slate-400">
                                                {search || familiaFiltro !== 'Todos'
                                                    ? 'Sin resultados para tu búsqueda.'
                                                    : 'No hay stock disponible en la Bodega Central.'}
                                            </p>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* ════════════════════════════════
                        COLUMNA DERECHA: CARRITO
                    ════════════════════════════════ */}
                    <div className="w-full lg:w-72 flex flex-col shrink-0 max-h-[40dvh] lg:max-h-none bg-slate-50/70">
                        {/* Header solicitud */}
                        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2">
                                <ClipboardList className="w-4 h-4 text-slate-500" />
                                <span className="text-xs font-black text-slate-700 uppercase tracking-widest">
                                    Mi Solicitud
                                </span>
                            </div>
                            {totalItems > 0 && (
                                <span className="bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full min-w-[20px] text-center">
                                    {totalItems}
                                </span>
                            )}
                        </div>

                        {/* Ítems del carrito */}
                        <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar p-3 space-y-2">
                            {carrito.length === 0 ? (
                                <div className="py-10 text-center px-4">
                                    <ClipboardList className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                                    <p className="text-xs text-slate-400 font-medium leading-relaxed">
                                        Agrega ítems del catálogo para armar tu solicitud.
                                    </p>
                                </div>
                            ) : (
                                carrito.map(item => (
                                    <div
                                        key={item.inventario_id}
                                        className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex flex-col min-w-0 flex-1">
                                                <span className="text-xs font-bold text-slate-800 truncate">{item.modelo}</span>
                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{item.familia}</span>
                                                {item.es_serializado && item.numero_serie && (
                                                    <span className="mt-1 inline-flex items-center gap-1 font-mono text-[10px] bg-indigo-50 border border-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">
                                                        <Hash className="w-2.5 h-2.5" />
                                                        {item.numero_serie}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                {!item.es_serializado && (
                                                    <span className="text-sm font-black text-indigo-700 min-w-[24px] text-center">
                                                        x{item.cantidad}
                                                    </span>
                                                )}
                                                <button
                                                    onClick={() => eliminarDelCarrito(item.inventario_id)}
                                                    title="Eliminar del carrito"
                                                    className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Footer carrito */}
                        <div className="p-4 border-t border-slate-200 space-y-3 shrink-0">
                            {/* Resumen */}
                            {carrito.length > 0 && (
                                <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 flex justify-between items-center">
                                    <span className="text-xs text-slate-500 font-medium">Total ítems</span>
                                    <span className="text-sm font-black text-slate-800">
                                        {carrito.length} línea{carrito.length !== 1 ? 's' : ''} · {totalItems} unidad{totalItems !== 1 ? 'es' : ''}
                                    </span>
                                </div>
                            )}

                            {/* Mensaje de éxito */}
                            {success && (
                                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 text-emerald-700 text-xs font-bold">
                                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                                    ¡Solicitud enviada correctamente!
                                </div>
                            )}

                            {/* Mensaje de error */}
                            {submitError && (
                                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-red-600 text-xs font-medium">
                                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                    <span>{submitError}</span>
                                </div>
                            )}

                            {/* Botones */}
                            <div className="flex gap-2">
                                <button
                                    onClick={onClose}
                                    disabled={isSubmitting}
                                    className="flex-1 px-4 py-2.5 text-xs font-bold text-slate-600 border border-slate-300 rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleEnviar}
                                    disabled={carrito.length === 0 || isSubmitting || success}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-xs font-black rounded-xl hover:bg-indigo-700 transition-all shadow-md active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            Enviando…
                                        </>
                                    ) : (
                                        <>
                                            <SendHorizonal className="w-3.5 h-3.5" />
                                            Enviar Solicitud
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
