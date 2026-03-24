import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface Option {
    value: string;
    label: string;
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
}

export function CustomSelect({
    id,
    value,
    onChange,
    options,
    placeholder,
    disabled = false,
    required = false,
    name
}: CustomSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(opt => opt.value === value);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Native hidden select for standard form submission validation */}
            {name && (
                <select name={name} title={placeholder || 'Select option'} value={value} onChange={() => { }} required={required} className="hidden">
                    <option value="" disabled></option>
                    {options.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                </select>
            )}

            <button
                type="button"
                id={id}
                disabled={disabled}
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`flex items-center justify-between w-full px-4 py-3 bg-white border border-gray-300 rounded-lg shadow-sm appearance-none transition-all outline-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:rounded-lg ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50 border-gray-200' : 'cursor-pointer hover:border-gray-400'} ${isOpen ? 'ring-2 ring-blue-500 border-blue-500' : ''}`}
            >
                <span className={`block truncate text-sm font-bold ${!selectedOption ? 'text-slate-400' : 'text-slate-800'}`}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-500' : ''}`} />
            </button>

            {isOpen && !disabled && (
                <div className="absolute z-20 w-full mt-2 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <ul className="max-h-60 overflow-y-auto py-1 custom-scrollbar">
                        {options.map((option) => {
                            const isSelected = option.value === value;
                            return (
                                <li
                                    key={option.value}
                                    onClick={() => {
                                        onChange(option.value);
                                        setIsOpen(false);
                                    }}
                                    className={`
                                        px-4 py-3 text-sm font-bold cursor-pointer transition-colors border-b border-slate-100 last:border-0
                                        ${isSelected ? 'bg-indigo-50 text-indigo-700' : 'text-slate-800 hover:bg-slate-50'}
                                    `}
                                >
                                    {option.label}
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
