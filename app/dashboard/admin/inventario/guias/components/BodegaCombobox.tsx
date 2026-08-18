'use client';

import { useState, useRef, useEffect } from 'react';
import { Warehouse, ChevronDown, Check } from 'lucide-react';

interface Bodega {
    id:     string;
    nombre: string;
}

interface Props {
    bodegas:      Bodega[];
    value:        string | null;   // bodega_id seleccionada
    displayValue: string;          // nombre para mostrar en trigger
    onChange:     (id: string, nombre: string) => void;
}

export function BodegaCombobox({ bodegas, value, displayValue, onChange }: Props) {
    const [query,  setQuery]  = useState('');
    const [isOpen, setIsOpen] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef     = useRef<HTMLInputElement>(null);

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
        setTimeout(() => inputRef.current?.focus(), 40);
    }

    function close() {
        setIsOpen(false);
        setQuery('');
    }

    function handleSelect(b: Bodega) {
        onChange(b.id, b.nombre);
        close();
    }

    const filtered = bodegas.filter(b =>
        b.nombre.toLowerCase().includes(query.trim().toLowerCase())
    );

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
                            <Warehouse className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span className="font-bold truncate">{displayValue}</span>
                        </>
                    ) : (
                        'Seleccionar bodega…'
                    )}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* ── Dropdown ─────────────────────────────────────────── */}
            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 border border-indigo-200 rounded-xl bg-white shadow-2xl overflow-hidden z-30">

                    {bodegas.length > 5 && (
                        <div className="p-2">
                            <input
                                ref={inputRef}
                                type="text"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Escape') { close(); return; }
                                    if (e.key === 'Enter' && filtered.length === 1) {
                                        e.preventDefault();
                                        handleSelect(filtered[0]);
                                    }
                                }}
                                placeholder="Buscar bodega…"
                                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition-colors"
                            />
                        </div>
                    )}

                    <div className="max-h-52 overflow-y-auto">
                        {filtered.length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-5 px-4">
                                Sin resultados
                            </p>
                        ) : (
                            filtered.map(b => (
                                <button
                                    key={b.id}
                                    type="button"
                                    onClick={() => handleSelect(b)}
                                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-indigo-50 transition-colors text-left border-b border-slate-50 last:border-b-0"
                                >
                                    <span className="text-xs font-semibold text-slate-800 truncate">
                                        {b.nombre}
                                    </span>
                                    {b.id === value && (
                                        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 ml-2" />
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
