'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';
import React from 'react';

export interface SearchableOption {
    value: string;
    label: string;       // primary text — main search target
    sublabel?: string;   // secondary text shown below label
}

interface Props {
    id?: string;
    value: string;
    onChange: (value: string) => void;
    options: SearchableOption[];
    placeholder?: string;
    searchPlaceholder?: string;
    disabled?: boolean;
    strategy?: 'absolute' | 'fixed';
}

export function SearchableSelect({
    id = 'searchable-select',
    value,
    onChange,
    options,
    placeholder = 'Selecciona una opción…',
    searchPlaceholder = 'Buscar…',
    disabled = false,
    strategy = 'fixed',
}: Props) {
    const [isOpen,    setIsOpen]    = useState(false);
    const [query,     setQuery]     = useState('');
    const [dropStyle, setDropStyle] = useState<React.CSSProperties>({});

    const triggerRef  = useRef<HTMLButtonElement>(null);
    const searchRef   = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const selected = options.find(o => o.value === value) ?? null;

    const filtered = options.filter(o => {
        if (!query.trim()) return true;
        const q = query.toLowerCase();
        return (
            o.label.toLowerCase().includes(q) ||
            (o.sublabel?.toLowerCase().includes(q) ?? false)
        );
    });

    function computePosition() {
        if (!triggerRef.current) return;
        if (strategy === 'absolute') {
            setDropStyle({
                position: 'absolute',
                top: '100%',
                left: 0,
                width: '100%',
                marginTop: '4px',
                zIndex: 9999,
            });
            return;
        }
        const rect       = triggerRef.current.getBoundingClientRect();
        const dropH      = Math.min(filtered.length * 52 + 64, 320);
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;

        if (spaceBelow < dropH && spaceAbove > spaceBelow) {
            setDropStyle({
                position: 'fixed',
                bottom:   window.innerHeight - rect.top + 4,
                left:     rect.left,
                width:    rect.width,
                zIndex:   9999,
            });
        } else {
            setDropStyle({
                position: 'fixed',
                top:      rect.bottom + 4,
                left:     rect.left,
                width:    rect.width,
                zIndex:   9999,
            });
        }
    }

    function open() {
        if (disabled) return;
        computePosition();
        setIsOpen(true);
        setQuery('');
        setTimeout(() => searchRef.current?.focus(), 10);
    }

    function close() {
        setIsOpen(false);
        setQuery('');
    }

    function select(opt: SearchableOption) {
        onChange(opt.value);
        close();
    }

    // Close on outside click
    useEffect(() => {
        if (!isOpen) return;
        function handler(e: MouseEvent) {
            const t = e.target as Element | null;
            if (!t) return;
            if (triggerRef.current?.contains(t))  return;
            if (dropdownRef.current?.contains(t)) return;
            close();
        }
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isOpen]);

    // Close on Escape
    useEffect(() => {
        if (!isOpen) return;
        function handler(e: KeyboardEvent) {
            if (e.key === 'Escape') close();
        }
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [isOpen]);

    // Reposition on scroll / resize
    useEffect(() => {
        if (!isOpen) return;
        if (strategy === 'absolute') return;
        window.addEventListener('scroll', computePosition, true);
        window.addEventListener('resize',  computePosition);
        return () => {
            window.removeEventListener('scroll', computePosition, true);
            window.removeEventListener('resize',  computePosition);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, strategy]);

    return (
        <div className="relative" style={{ zIndex: isOpen ? 50 : undefined }}>
            <button
                ref={triggerRef}
                id={id}
                type="button"
                onClick={isOpen ? close : open}
                disabled={disabled}
                className={`
                    flex items-center justify-between w-full px-4 py-3 bg-white border rounded-lg shadow-sm
                    text-sm font-bold transition-all outline-none focus:outline-none
                    ${disabled
                        ? 'opacity-50 cursor-not-allowed bg-slate-50 border-gray-200 text-slate-400'
                        : isOpen
                            ? 'border-blue-500 ring-2 ring-blue-500 cursor-pointer'
                            : 'border-gray-300 hover:border-gray-400 cursor-pointer'
                    }
                `}
            >
                <span className={`truncate ${!selected ? 'text-slate-400 font-normal' : 'text-slate-800'}`}>
                    {selected ? selected.label : placeholder}
                </span>
                <ChevronDown
                    className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-blue-500' : 'text-slate-400'
                    }`}
                />
            </button>

            {isOpen && !disabled && (
                <div
                    ref={dropdownRef}
                    style={dropStyle}
                    className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
                >
                    {/* Search input */}
                    <div className="p-2 border-b border-slate-100">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                            <input
                                ref={searchRef}
                                type="text"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder={searchPlaceholder}
                                onMouseDown={e => e.stopPropagation()}
                                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg
                                           focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                            />
                        </div>
                    </div>

                    {/* Options list */}
                    <ul className="max-h-60 overflow-y-auto py-1">
                        {filtered.length === 0 ? (
                            <li className="px-4 py-3 text-sm text-slate-500 text-center italic">
                                Sin resultados para &quot;{query}&quot;
                            </li>
                        ) : (
                            filtered.map(opt => {
                                const isSelected = opt.value === value;
                                return (
                                    <li
                                        key={opt.value}
                                        onMouseDown={e => e.preventDefault()}
                                        onClick={() => select(opt)}
                                        className={`
                                            px-4 py-2.5 flex items-center justify-between gap-2
                                            border-b border-slate-100 last:border-0 cursor-pointer transition-colors
                                            ${isSelected ? 'bg-indigo-50' : 'hover:bg-slate-50'}
                                        `}
                                    >
                                        <div className="min-w-0">
                                            <p className={`text-sm font-bold truncate ${isSelected ? 'text-indigo-700' : 'text-slate-800'}`}>
                                                {opt.label}
                                            </p>
                                            {opt.sublabel && (
                                                <p className="text-xs text-slate-400 truncate mt-0.5">
                                                    {opt.sublabel}
                                                </p>
                                            )}
                                        </div>
                                        {isSelected && (
                                            <Check className="w-4 h-4 text-indigo-600 shrink-0" strokeWidth={2.5} />
                                        )}
                                    </li>
                                );
                            })
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
}
