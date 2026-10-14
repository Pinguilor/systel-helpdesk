'use client';

import { useState, useRef, useEffect, useMemo, Fragment } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';

export interface ComboOption {
    value: string;
    label: string;
    hint?: string;
    /** Encabezado bajo el que se agrupa la opción. Las opciones de un mismo grupo deben ir contiguas. */
    group?: string;
    /** Texto del botón cuando la opción está seleccionada (por defecto, label). */
    selectedLabel?: string;
}

type Accent = 'amber' | 'violet' | 'indigo';

const ACCENT: Record<Accent, { ring: string; border: string; focusBorder: string; active: string; check: string }> = {
    amber:  { ring: 'ring-amber-200',  border: 'border-amber-400',  focusBorder: 'focus:border-amber-400',  active: 'bg-amber-50',  check: 'text-amber-600' },
    violet: { ring: 'ring-violet-200', border: 'border-violet-400', focusBorder: 'focus:border-violet-400', active: 'bg-violet-50', check: 'text-violet-600' },
    indigo: { ring: 'ring-indigo-200', border: 'border-indigo-400', focusBorder: 'focus:border-indigo-400', active: 'bg-indigo-50', check: 'text-indigo-600' },
};

const normalizar = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function SearchableCombobox({
    options,
    value,
    onChange,
    placeholder = 'Seleccionar…',
    searchPlaceholder = 'Buscar…',
    emptyLabel,
    searchable = true,
    disabled = false,
    accent = 'indigo',
}: {
    options: ComboOption[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    /** Si se define, agrega una opción al inicio para limpiar la selección (ej: "— Ninguno —"). */
    emptyLabel?: string;
    searchable?: boolean;
    disabled?: boolean;
    accent?: Accent;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [cursor, setCursor] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const a = ACCENT[accent];

    const seleccionada = options.find(o => o.value === value);

    const filtradas = useMemo(() => {
        const q = normalizar(query.trim());
        if (!q) return options;
        return options.filter(o =>
            normalizar(o.label).includes(q) ||
            (o.hint && normalizar(o.hint).includes(q)) ||
            (o.group && normalizar(o.group).includes(q)));
    }, [options, query]);

    // Lista navegable: opción "limpiar" (si aplica) + resultados filtrados.
    const items: ComboOption[] = useMemo(
        () => (emptyLabel ? [{ value: '', label: emptyLabel }, ...filtradas] : filtradas),
        [emptyLabel, filtradas],
    );

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) cerrar();
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    useEffect(() => { setCursor(0); }, [query, isOpen]);

    // Mantiene visible el ítem activo al navegar con teclado.
    useEffect(() => {
        if (!isOpen) return;
        listRef.current?.querySelector<HTMLElement>(`[data-idx="${cursor}"]`)?.scrollIntoView({ block: 'nearest' });
    }, [cursor, isOpen]);

    function abrir() {
        if (disabled) return;
        setIsOpen(true);
        setQuery('');
        if (searchable) setTimeout(() => inputRef.current?.focus(), 40);
    }

    function cerrar() {
        setIsOpen(false);
        setQuery('');
    }

    function elegir(v: string) {
        onChange(v);
        cerrar();
    }

    function onKeyDown(e: React.KeyboardEvent) {
        if (e.key === 'Escape') { e.preventDefault(); cerrar(); return; }
        if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, items.length - 1)); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); return; }
        if (e.key === 'Enter') {
            e.preventDefault();
            if (items[cursor]) elegir(items[cursor].value);
        }
    }

    return (
        <div ref={containerRef} className="relative" onKeyDown={isOpen ? onKeyDown : undefined}>
            <button
                type="button"
                onClick={isOpen ? cerrar : abrir}
                disabled={disabled}
                className={[
                    'w-full flex items-center justify-between gap-2 border rounded-xl px-3.5 py-2.5 text-sm text-left transition-colors bg-white disabled:opacity-50 disabled:cursor-not-allowed',
                    isOpen ? `ring-2 ${a.ring} ${a.border}` : 'border-slate-200 hover:border-slate-300',
                ].join(' ')}
            >
                <span className={`truncate ${seleccionada ? 'text-slate-800 font-semibold' : 'text-slate-400'}`}>
                    {seleccionada ? (seleccionada.selectedLabel ?? seleccionada.label) : placeholder}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 border border-slate-200 rounded-xl bg-white shadow-2xl overflow-hidden z-30">
                    {searchable && (
                        <div className="p-2 border-b border-slate-100 relative">
                            <input
                                ref={inputRef}
                                type="text"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder={searchPlaceholder}
                                className={`w-full border border-slate-200 rounded-lg px-3 py-1.5 pr-7 text-xs focus:outline-none focus:ring-2 ${a.ring} ${a.focusBorder}`}
                            />
                            {query && (
                                <button
                                    type="button"
                                    onClick={() => { setQuery(''); inputRef.current?.focus(); }}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    aria-label="Limpiar búsqueda"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    )}

                    <div ref={listRef} className="max-h-52 overflow-y-auto" role="listbox">
                        {items.length === 0 && (
                            <p className="text-xs text-slate-400 text-center py-5 px-4">Sin resultados.</p>
                        )}
                        {items.length > 0 && filtradas.length === 0 && emptyLabel && (
                            <p className="text-xs text-slate-400 text-center py-3 px-4">Sin resultados para &quot;{query.trim()}&quot;.</p>
                        )}
                        {items.map((o, idx) => (
                            <Fragment key={o.value || '__empty__'}>
                            {o.group && o.group !== items[idx - 1]?.group && (
                                <div className="px-4 pt-2.5 pb-1 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 border-b border-slate-100 sticky top-0">
                                    {o.group}
                                </div>
                            )}
                            <button
                                type="button"
                                role="option"
                                aria-selected={o.value === value}
                                data-idx={idx}
                                onClick={() => elegir(o.value)}
                                onMouseEnter={() => setCursor(idx)}
                                className={`w-full flex items-center justify-between gap-2 py-2.5 text-left border-b border-slate-50 last:border-b-0 transition-colors ${o.group ? 'pl-7 pr-4' : 'px-4'} ${idx === cursor ? a.active : ''}`}
                            >
                                <span className="min-w-0">
                                    <span className={`block text-xs truncate ${o.value === '' ? 'text-slate-400 italic' : 'font-semibold text-slate-800'}`}>{o.label}</span>
                                    {o.hint && <span className="block text-[10px] text-slate-400 truncate">{o.hint}</span>}
                                </span>
                                {o.value !== '' && o.value === value && <Check className={`w-3.5 h-3.5 shrink-0 ${a.check}`} />}
                            </button>
                            </Fragment>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
