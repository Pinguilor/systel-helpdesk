'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { Plus, X, Search, Minus, Loader2, Package, PenLine } from 'lucide-react';
import { agregarItemsBom } from '../actions';

type CatalogoItem = {
    id: string;
    familia: string;
    modelo: string;
    es_serializado: boolean;
};

type CarritoItem = CatalogoItem & { cantidad: number };

interface Props {
    proyectoId: string;
    catalogo: CatalogoItem[];
}

const INIT = { error: null as string | null };

export function AgregarItemModal({ proyectoId, catalogo }: Props) {
    const dialogRef  = useRef<HTMLDialogElement>(null);
    const [query,    setQuery]    = useState('');
    const [carrito,  setCarrito]  = useState<CarritoItem[]>([]);
    const wasPending = useRef(false);

    // Modo entrada manual
    const [showManual,  setShowManual]  = useState(false);
    const [manFamilia,  setManFamilia]  = useState('');
    const [manModelo,   setManModelo]   = useState('');
    const [manSerie,    setManSerie]    = useState(false);

    const [state, action, isPending] = useActionState(agregarItemsBom, INIT);

    // Cerrar y limpiar al guardar con éxito
    useEffect(() => {
        if (wasPending.current && !isPending && state.error === null) {
            dialogRef.current?.close();
            resetModal();
        }
        wasPending.current = isPending;
    }, [isPending, state.error]);

    function resetModal() {
        setCarrito([]);
        setQuery('');
        setShowManual(false);
        setManFamilia('');
        setManModelo('');
        setManSerie(false);
    }

    function handleClose() {
        dialogRef.current?.close();
        resetModal();
    }

    // Filtrar catálogo según búsqueda
    const resultados = catalogo.filter(item => {
        const q = query.toLowerCase();
        return !q || item.familia.toLowerCase().includes(q) || item.modelo.toLowerCase().includes(q);
    });

    // Agregar ítem del catálogo al carrito
    function addToCarrito(item: CatalogoItem) {
        setCarrito(prev => {
            const idx = prev.findIndex(c => c.id === item.id);
            if (idx >= 0) {
                return prev.map((c, i) => i === idx ? { ...c, cantidad: c.cantidad + 1 } : c);
            }
            return [...prev, { ...item, cantidad: 1 }];
        });
    }

    // Agregar ítem manual al carrito
    function addManual() {
        if (!manFamilia.trim() || !manModelo.trim()) return;
        const id = `manual::${manFamilia.trim()}::${manModelo.trim()}`;
        setCarrito(prev => {
            const idx = prev.findIndex(c => c.id === id);
            if (idx >= 0) {
                return prev.map((c, i) => i === idx ? { ...c, cantidad: c.cantidad + 1 } : c);
            }
            return [...prev, { id, familia: manFamilia.trim(), modelo: manModelo.trim(), es_serializado: manSerie, cantidad: 1 }];
        });
        setManFamilia('');
        setManModelo('');
        setManSerie(false);
        setShowManual(false);
    }

    function updateCantidad(id: string, delta: number) {
        setCarrito(prev =>
            prev.map(c => c.id === id ? { ...c, cantidad: Math.max(1, c.cantidad + delta) } : c)
        );
    }

    function removeFromCarrito(id: string) {
        setCarrito(prev => prev.filter(c => c.id !== id));
    }

    const totalItems = carrito.reduce((s, c) => s + c.cantidad, 0);

    return (
        <>
            <button
                onClick={() => dialogRef.current?.showModal()}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-700 transition-colors"
            >
                <Plus className="w-4 h-4" strokeWidth={2} />
                Agregar Ítems
            </button>

            <dialog
                ref={dialogRef}
                className="fixed inset-0 m-auto w-full max-w-xl max-h-[90vh] rounded-2xl p-0 shadow-2xl backdrop:bg-slate-900/60 backdrop:backdrop-blur-sm overflow-hidden"
                onClose={handleClose}
            >
                <div className="flex flex-col h-full max-h-[90vh]">

                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
                        <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-slate-500" strokeWidth={1.75} />
                            <h2 className="text-base font-black text-slate-900">Agregar Ítems de Hardware</h2>
                        </div>
                        <button
                            type="button"
                            onClick={handleClose}
                            className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
                        >
                            <X className="w-4 h-4 text-slate-500" />
                        </button>
                    </div>

                    {/* Búsqueda + lista */}
                    <div className="flex flex-col flex-1 overflow-hidden min-h-0">
                        <div className="px-6 pt-4 pb-2 shrink-0">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" strokeWidth={1.75} />
                                <input
                                    value={query}
                                    onChange={e => setQuery(e.target.value)}
                                    placeholder="Buscar por familia o modelo..."
                                    className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-400 transition-all"
                                />
                            </div>
                        </div>

                        {/* Lista del catálogo */}
                        <div className="flex-1 overflow-y-auto px-6 py-2 space-y-1 min-h-0">
                            {catalogo.length === 0 ? (
                                /* Catálogo completamente vacío → mostrar solo manual */
                                <div className="text-center py-6 space-y-2">
                                    <p className="text-sm text-slate-400">El catálogo de equipos está vacío.</p>
                                    <p className="text-xs text-slate-300">Agrega un ítem manualmente usando el botón de abajo.</p>
                                </div>
                            ) : resultados.length === 0 ? (
                                <p className="text-sm text-slate-400 text-center py-6">Sin resultados para &quot;{query}&quot;</p>
                            ) : (
                                resultados.map(item => {
                                    const enCarrito = carrito.find(c => c.id === item.id);
                                    return (
                                        <div
                                            key={item.id}
                                            className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-colors cursor-pointer ${
                                                enCarrito
                                                    ? 'bg-slate-50 border-slate-300'
                                                    : 'border-transparent hover:bg-slate-50 hover:border-slate-200'
                                            }`}
                                            onClick={() => addToCarrito(item)}
                                        >
                                            <div>
                                                <p className="text-sm font-bold text-slate-800">{item.modelo}</p>
                                                <p className="text-xs text-slate-400">{item.familia}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {item.es_serializado && (
                                                    <span className="text-[10px] text-blue-600 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5 font-bold uppercase tracking-wide">
                                                        Serie
                                                    </span>
                                                )}
                                                {enCarrito ? (
                                                    <span className="text-xs font-black text-slate-900 bg-slate-200 rounded-full w-6 h-6 flex items-center justify-center">
                                                        {enCarrito.cantidad}
                                                    </span>
                                                ) : (
                                                    <Plus className="w-4 h-4 text-slate-400" strokeWidth={2} />
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}

                            {/* Botón / Formulario de entrada manual */}
                            {!showManual ? (
                                <button
                                    type="button"
                                    onClick={() => setShowManual(true)}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 text-sm text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-xl border border-dashed border-slate-200 transition-colors mt-2"
                                >
                                    <PenLine className="w-3.5 h-3.5" />
                                    Agregar ítem manualmente
                                </button>
                            ) : (
                                <div className="border border-slate-200 rounded-xl p-3 space-y-2 mt-2 bg-slate-50/60">
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Nuevo ítem</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <input
                                            value={manFamilia}
                                            onChange={e => setManFamilia(e.target.value)}
                                            placeholder="Familia (ej: POS)"
                                            className="border border-slate-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                                        />
                                        <input
                                            value={manModelo}
                                            onChange={e => setManModelo(e.target.value)}
                                            placeholder="Modelo (ej: Verifone P400)"
                                            className="border border-slate-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                                        />
                                    </div>
                                    <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={manSerie}
                                            onChange={e => setManSerie(e.target.checked)}
                                            className="rounded"
                                        />
                                        Ítem serializado (con número de serie)
                                    </label>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowManual(false)}
                                            className="flex-1 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={addManual}
                                            disabled={!manFamilia.trim() || !manModelo.trim()}
                                            className="flex-1 py-1.5 text-xs font-bold bg-slate-900 text-white rounded-lg disabled:opacity-40 hover:bg-slate-700 transition-colors"
                                        >
                                            Agregar
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Carrito */}
                        {carrito.length > 0 && (
                            <div className="border-t border-slate-100 px-6 py-3 space-y-2 shrink-0 bg-slate-50/60 max-h-44 overflow-y-auto">
                                <p className="text-xs font-black text-slate-500 uppercase tracking-wide">
                                    Seleccionados ({carrito.length})
                                </p>
                                {carrito.map(item => (
                                    <div key={item.id} className="flex items-center gap-3">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-slate-800 truncate">{item.modelo}</p>
                                            <p className="text-[10px] text-slate-400">{item.familia}</p>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => updateCantidad(item.id, -1)}
                                                className="w-6 h-6 border border-slate-300 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors"
                                            >
                                                <Minus className="w-3 h-3" />
                                            </button>
                                            <span className="w-8 text-center text-sm font-black">{item.cantidad}</span>
                                            <button
                                                type="button"
                                                onClick={() => updateCantidad(item.id, +1)}
                                                className="w-6 h-6 border border-slate-300 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors"
                                            >
                                                <Plus className="w-3 h-3" />
                                            </button>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeFromCarrito(item.id)}
                                            className="text-slate-300 hover:text-red-500 transition-colors shrink-0"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Footer */}
                        <form action={action} className="px-6 py-4 border-t border-slate-100 space-y-3 shrink-0">
                            <input type="hidden" name="proyecto_id" value={proyectoId} />
                            <input
                                type="hidden"
                                name="items"
                                value={JSON.stringify(carrito.map(c => ({
                                    id:             c.id,   // catalogo_equipos.id → se persiste como inventario_id (ref. al catálogo)
                                    familia:        c.familia,
                                    modelo:         c.modelo,
                                    cantidad:       c.cantidad,
                                    es_serializado: c.es_serializado,
                                })))}
                            />

                            {state.error && (
                                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                                    {state.error}
                                </p>
                            )}

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isPending || carrito.length === 0}
                                    className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                                >
                                    {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {isPending ? 'Agregando...' : totalItems > 0 ? `Agregar ${totalItems} ítem(s)` : 'Agregar ítems'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </dialog>
        </>
    );
}
