'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, MapPin, Search, X } from 'lucide-react';

interface Sucursal { id: string; nombre_restaurante: string; sigla: string; }

interface Props {
    sucursales: Sucursal[];   // ya filtradas por empresa
    value:      string;
    onChange:   (id: string) => void;
    disabled?:  boolean;
}

export function SucursalCombobox({ sucursales, value, onChange, disabled }: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const [query,  setQuery]  = useState('');
    const [style,  setStyle]  = useState<React.CSSProperties>({});

    const triggerRef  = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const inputRef    = useRef<HTMLInputElement>(null);

    const selected = value ? (sucursales.find(s => s.id === value) ?? null) : null;

    const filtered = query.trim()
        ? sucursales.filter(s => {
              const q = query.toLowerCase();
              return s.sigla.toLowerCase().includes(q) ||
                     s.nombre_restaurante.toLowerCase().includes(q);
          })
        : sucursales;

    function openDropdown() {
        if (disabled || !triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        setStyle({ top: rect.bottom + 4, left: rect.left, width: rect.width });
        setIsOpen(true);
    }

    function closeDropdown() {
        setIsOpen(false);
        setQuery('');
    }

    function handleSelect(s: Sucursal) {
        onChange(s.id);
        closeDropdown();
    }

    function handleClear(e: React.MouseEvent) {
        e.stopPropagation();
        onChange('');
    }

    // Auto-foco en buscador al abrir
    useEffect(() => {
        if (isOpen) setTimeout(() => inputRef.current?.focus(), 0);
    }, [isOpen]);

    // Cerrar al hacer clic fuera (tanto del trigger como del portal)
    useEffect(() => {
        if (!isOpen) return;
        function handler(e: MouseEvent) {
            const t = e.target as Node;
            if (triggerRef.current?.contains(t)) return;
            if (dropdownRef.current?.contains(t)) return;
            closeDropdown();
        }
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isOpen]);

    return (
        <div className="relative">
            {/* Campo oculto para el form action */}
            <input type="hidden" name="cliente_id" value={value} />

            {/* Trigger */}
            <button
                ref={triggerRef}
                type="button"
                onClick={openDropdown}
                disabled={disabled}
                className={`w-full text-left border rounded-xl px-4 py-3 text-xs font-semibold flex items-center justify-between transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 ${
                    disabled
                        ? 'bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed'
                        : isOpen
                        ? 'bg-white border-slate-400 ring-2 ring-slate-900/10 cursor-pointer'
                        : 'bg-white border-slate-200 hover:border-slate-300 cursor-pointer'
                }`}
            >
                <div className="flex items-center gap-2 min-w-0">
                    <MapPin className={`w-3.5 h-3.5 shrink-0 ${disabled ? 'text-slate-300' : 'text-slate-400'}`} />
                    {disabled ? (
                        <span className="text-slate-300 font-medium">— Esperando empresa... —</span>
                    ) : selected ? (
                        <span className="text-slate-800 truncate">
                            <span className="font-black text-slate-500">[{selected.sigla}]</span>
                            {' '}{selected.nombre_restaurante}
                        </span>
                    ) : sucursales.length === 0 ? (
                        <span className="text-slate-400 font-medium">— Sin sucursales registradas —</span>
                    ) : (
                        <span className="text-slate-400 font-medium">— Selecciona una sucursal —</span>
                    )}
                </div>

                <div className="flex items-center gap-1 shrink-0 ml-2">
                    {!disabled && selected && (
                        <span
                            role="button"
                            onClick={handleClear}
                            className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <X className="w-3 h-3" />
                        </span>
                    )}
                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${disabled ? 'text-slate-300' : 'text-slate-400'} ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </button>

            {/*
             * Dropdown con position:fixed + getBoundingClientRect.
             * NO usa portal: renderiza dentro del <dialog> (que está en el top layer),
             * así queda sobre el modal. position:fixed escapa el overflow:auto del dialog
             * según la CSS spec — los elementos fixed no son clippeados por overflow.
             */}
            {isOpen && (
                <div
                    ref={dropdownRef}
                    style={{ ...style, position: 'fixed', zIndex: 99999 }}
                    className="bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden"
                >
                    {/* Buscador */}
                    <div className="p-2 border-b border-slate-100">
                        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg">
                            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder="Buscar por sigla o nombre..."
                                className="flex-1 text-xs bg-transparent focus:outline-none text-slate-700 placeholder:text-slate-400 font-medium"
                            />
                            {query && (
                                <button type="button" onClick={() => setQuery('')}>
                                    <X className="w-3 h-3 text-slate-400 hover:text-slate-600" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Lista */}
                    <div className="max-h-56 overflow-y-auto py-1">
                        {filtered.length === 0 ? (
                            <p className="px-4 py-4 text-xs text-slate-400 text-center">
                                Sin resultados para &ldquo;{query}&rdquo;
                            </p>
                        ) : (
                            filtered.map(s => (
                                <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => handleSelect(s)}
                                    className={`w-full text-left px-4 py-2.5 text-xs transition-colors flex items-center gap-3 ${
                                        s.id === value
                                            ? 'bg-slate-50 text-slate-900 font-black'
                                            : 'text-slate-700 font-medium hover:bg-slate-50'
                                    }`}
                                >
                                    <span className="font-black text-[11px] text-slate-500 shrink-0 w-12 truncate">
                                        [{s.sigla}]
                                    </span>
                                    <span className="truncate">{s.nombre_restaurante}</span>
                                </button>
                            ))
                        )}
                    </div>

                    {/* Hint: cantidad */}
                    {!query && sucursales.length > 8 && (
                        <div className="px-4 py-1.5 border-t border-slate-100 text-[10px] text-slate-400 text-center font-medium">
                            {sucursales.length} sucursal{sucursales.length !== 1 ? 'es' : ''} · escribe para filtrar
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
