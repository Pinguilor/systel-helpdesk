'use client';

import { useState, useRef, useEffect, useTransition } from 'react';
import { Building2, ChevronDown, Check, Plus, Loader2, AlertTriangle } from 'lucide-react';
import { crearProveedorAction, type Proveedor } from '../actions';

interface Props {
    proveedores:  Proveedor[];
    value:        string | null;   // proveedor_id seleccionado
    displayValue: string;          // nombre para mostrar en trigger
    onChange:     (id: string, nombre: string) => void;
}

export function ProveedorCombobox({ proveedores: initialList, value, displayValue, onChange }: Props) {
    const [localList,  setLocalList]  = useState<Proveedor[]>(initialList);
    const [query,      setQuery]      = useState('');
    const [isOpen,     setIsOpen]     = useState(false);
    const [error,      setError]      = useState<string | null>(null);
    const [isPending,  startTransition] = useTransition();

    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef     = useRef<HTMLInputElement>(null);

    // Cierre al hacer clic fuera
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                close();
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    function open() {
        setIsOpen(true);
        setQuery('');
        setError(null);
        // Pequeño timeout para que el DOM renderice el input antes de hacer focus
        setTimeout(() => inputRef.current?.focus(), 40);
    }

    function close() {
        setIsOpen(false);
        setQuery('');
        setError(null);
    }

    function handleSelect(p: Proveedor) {
        onChange(p.id, p.nombre);
        close();
    }

    function handleCreate() {
        const trimmed = query.trim();
        if (!trimmed) return;

        startTransition(async () => {
            setError(null);
            const result = await crearProveedorAction(trimmed);
            if (result.error || !result.data) {
                setError(result.error ?? 'Error al crear el proveedor.');
                return;
            }
            const nuevo = result.data;
            setLocalList(prev =>
                [...prev, nuevo].sort((a, b) =>
                    a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
                )
            );
            onChange(nuevo.id, nuevo.nombre);
            close();
        });
    }

    const queryTrimmed = query.trim();
    const filtered = localList.filter(p =>
        p.nombre.toLowerCase().includes(queryTrimmed.toLowerCase())
    );
    const exactMatch = localList.some(
        p => p.nombre.toLowerCase() === queryTrimmed.toLowerCase()
    );
    const showCreate = queryTrimmed.length > 0 && !exactMatch;

    return (
        <div ref={containerRef} className="relative">
            {/* ── Trigger ───────────────────────────────────────────── */}
            <button
                type="button"
                onClick={isOpen ? close : open}
                className={[
                    'w-full flex items-center justify-between border rounded-xl px-3 py-2.5 text-sm text-left transition-colors bg-white',
                    value
                        ? 'border-emerald-300 bg-emerald-50/50'
                        : 'border-slate-200 hover:border-indigo-300',
                    isOpen ? 'ring-2 ring-emerald-200 border-emerald-400' : '',
                ].join(' ')}
            >
                <span className={`flex items-center gap-2 min-w-0 ${value ? 'text-slate-900' : 'text-slate-400'}`}>
                    {value ? (
                        <>
                            <Building2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span className="font-bold truncate">{displayValue}</span>
                        </>
                    ) : (
                        'Buscar o crear proveedor…'
                    )}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* ── Dropdown ─────────────────────────────────────────── */}
            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 border border-indigo-200 rounded-xl bg-white shadow-2xl overflow-hidden z-30">

                    {/* Input de búsqueda */}
                    <div className="p-2">
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Escape') { close(); return; }
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    if (filtered.length === 1 && !showCreate) {
                                        handleSelect(filtered[0]);
                                    } else if (showCreate) {
                                        handleCreate();
                                    }
                                }
                            }}
                            placeholder="Buscar proveedor…"
                            className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition-colors"
                        />
                    </div>

                    {/* Error de creación */}
                    {error && (
                        <div className="mx-2 mb-1 flex items-center gap-1.5 text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            {error}
                        </div>
                    )}

                    {/* Lista */}
                    <div className="max-h-52 overflow-y-auto">
                        {filtered.length === 0 && !showCreate && (
                            <p className="text-xs text-slate-400 text-center py-5 px-4">
                                Sin resultados. Escribe para crear uno nuevo.
                            </p>
                        )}

                        {filtered.map(p => (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => handleSelect(p)}
                                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-indigo-50 transition-colors text-left border-b border-slate-50 last:border-b-0"
                            >
                                <span className="text-xs font-semibold text-slate-800 truncate">
                                    {p.nombre}
                                </span>
                                {p.id === value && (
                                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 ml-2" />
                                )}
                            </button>
                        ))}

                        {/* Opción Crear */}
                        {showCreate && (
                            <button
                                type="button"
                                onClick={handleCreate}
                                disabled={isPending}
                                className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-emerald-50 transition-colors text-left border-t border-dashed border-emerald-200 disabled:opacity-60"
                            >
                                {isPending ? (
                                    <Loader2 className="w-3.5 h-3.5 text-emerald-500 animate-spin shrink-0" />
                                ) : (
                                    <div className="w-5 h-5 rounded-md bg-emerald-100 flex items-center justify-center shrink-0">
                                        <Plus className="w-3 h-3 text-emerald-600" />
                                    </div>
                                )}
                                <span className="text-xs text-emerald-700">
                                    {isPending
                                        ? 'Creando proveedor…'
                                        : <><span className="font-semibold">Crear</span> <span className="font-black">"{queryTrimmed}"</span></>
                                    }
                                </span>
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
