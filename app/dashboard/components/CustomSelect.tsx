import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface Option {
    value: string;
    label: string;
    disabled?: boolean;
}

interface CustomSelectProps {
    id: string;
    value: string;
    onChange: (value: string) => void;
    options: Option[];
    placeholder: string;
    disabled?: boolean;
    required?: boolean;
    name?: string;
    renderOption?: (option: Option) => React.ReactNode;
}

export function CustomSelect({
    id,
    value,
    onChange,
    options,
    placeholder,
    disabled = false,
    required = false,
    name,
    renderOption,
}: CustomSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
    const buttonRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(opt => opt.value === value);

    // Cierra al hacer click fuera
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
                buttonRef.current && !buttonRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Cierra al hacer scroll fuera del dropdown o al hacer resize
    useEffect(() => {
        if (!isOpen) return;
        const handleScroll = (e: Event) => {
            // Ignorar scroll interno del propio dropdown (arrastrar scrollbar)
            if (dropdownRef.current?.contains(e.target as Node)) return;
            setIsOpen(false);
        };
        const handleResize = () => setIsOpen(false);
        window.addEventListener('scroll', handleScroll, true);
        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('resize', handleResize);
        };
    }, [isOpen]);

    const handleOpen = () => {
        if (disabled) return;
        if (!isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            const dropdownH = Math.min(options.length * 48 + 8, 240);

            // Abre hacia arriba si no hay espacio abajo
            if (spaceBelow < dropdownH && spaceAbove > spaceBelow) {
                setDropdownStyle({
                    position: 'fixed',
                    bottom: window.innerHeight - rect.top + 4,
                    left: rect.left,
                    width: rect.width,
                    zIndex: 9999,
                });
            } else {
                setDropdownStyle({
                    position: 'fixed',
                    top: rect.bottom + 4,
                    left: rect.left,
                    width: rect.width,
                    zIndex: 9999,
                });
            }
        }
        setIsOpen(v => !v);
    };

    return (
        <div className="relative">
            {/* Select nativo oculto para validación de formulario */}
            {name && (
                <select name={name} title={placeholder || 'Select option'} value={value} onChange={() => { }} required={required} className="hidden">
                    <option value="" disabled></option>
                    {options.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                </select>
            )}

            <button
                ref={buttonRef}
                type="button"
                id={id}
                disabled={disabled}
                onClick={handleOpen}
                className={`flex items-center justify-between w-full px-4 py-3 bg-white border border-gray-300 rounded-lg shadow-sm appearance-none transition-all outline-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:rounded-lg ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50 border-gray-200' : 'cursor-pointer hover:border-gray-400'} ${isOpen ? 'ring-2 ring-blue-500 border-blue-500' : ''}`}
            >
                <span className={`block truncate text-sm font-bold ${!selectedOption ? 'text-slate-400' : 'text-slate-800'}`}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-500' : ''}`} />
            </button>

            {isOpen && !disabled && (
                <div
                    ref={dropdownRef}
                    style={dropdownStyle}
                    onMouseDown={(e) => e.preventDefault()}
                    className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
                >
                    <ul className="max-h-60 overflow-y-auto py-1 custom-scrollbar">
                        {options.map((option) => {
                            const isSelected = option.value === value;
                            const isItemDisabled = !!option.disabled;
                            return (
                                <li
                                    key={option.value}
                                    onClick={() => {
                                        if (isItemDisabled) return;
                                        onChange(option.value);
                                        setIsOpen(false);
                                    }}
                                    className={`
                                        px-4 py-3 text-sm font-bold border-b border-slate-100 last:border-0 transition-colors
                                        ${isItemDisabled
                                            ? 'opacity-45 cursor-not-allowed text-slate-400'
                                            : isSelected
                                                ? 'bg-indigo-50 text-indigo-700 cursor-pointer'
                                                : 'text-slate-800 hover:bg-slate-50 cursor-pointer'}
                                    `}
                                >
                                    {renderOption ? renderOption(option) : option.label}
                                </li>
                            );
                        })}
                        {options.length === 0 && (
                            <li className="px-4 py-3 text-sm text-slate-500 text-center italic">No hay opciones disponibles</li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
}
