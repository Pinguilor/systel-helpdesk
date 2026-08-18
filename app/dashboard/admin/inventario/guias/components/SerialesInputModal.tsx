'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { X, Scan, Clipboard, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface Props {
    modelo:       string;
    familia:      string;
    cantidad:     number;
    initialSeriales: string[];
    onConfirm:    (seriales: string[]) => void;
    onClose:      () => void;
}

export function SerialesInputModal({ modelo, familia, cantidad, initialSeriales, onConfirm, onClose }: Props) {
    const [seriales, setSeriales]   = useState<string[]>(initialSeriales.length ? [...initialSeriales] : []);
    const [input,    setInput]      = useState('');
    const [error,    setError]      = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { inputRef.current?.focus(); }, []);

    const duplicados = useMemo(() => {
        const seen = new Set<string>();
        const dupes = new Set<string>();
        for (const s of seriales) {
            if (seen.has(s)) dupes.add(s);
            seen.add(s);
        }
        return dupes;
    }, [seriales]);

    const progreso    = seriales.length;
    const completo    = progreso === cantidad && duplicados.size === 0;
    const porcentaje  = Math.min(100, Math.round((progreso / cantidad) * 100));

    function addSerial(raw: string) {
        const s = raw.trim();
        if (!s) return;
        if (seriales.includes(s)) {
            setError(`Serial "${s}" ya está en la lista.`);
            return;
        }
        if (seriales.length >= cantidad) {
            setError(`Ya alcanzaste el máximo de ${cantidad} seriales.`);
            return;
        }
        setError(null);
        setSeriales(prev => [...prev, s]);
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            if (input.trim()) {
                addSerial(input);
                setInput('');
            }
        }
    }

    function handlePaste(e: React.ClipboardEvent) {
        e.preventDefault();
        const text = e.clipboardData.getData('text');
        const lines = text.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
        if (!lines.length) return;

        setError(null);
        const current = new Set(seriales);
        const toAdd: string[] = [];
        const dupes: string[] = [];

        for (const line of lines) {
            if (current.has(line) || toAdd.includes(line)) {
                dupes.push(line);
            } else if (seriales.length + toAdd.length < cantidad) {
                toAdd.push(line);
                current.add(line);
            }
        }

        if (toAdd.length) setSeriales(prev => [...prev, ...toAdd]);
        if (dupes.length) setError(`${dupes.length} serial(es) duplicado(s) omitido(s).`);
        setInput('');
    }

    function removeSerial(idx: number) {
        setSeriales(prev => prev.filter((_, i) => i !== idx));
        setError(null);
    }

    function clearAll() {
        setSeriales([]);
        setError(null);
        inputRef.current?.focus();
    }

    return (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 max-h-[90vh] flex flex-col">

                <div className="h-1.5 w-full bg-gradient-to-r from-violet-500 to-indigo-500" />

                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-5 pb-3">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Seriales · {familia}
                        </p>
                        <h3 className="text-base font-black text-slate-900">{modelo}</h3>
                    </div>
                    <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Barra de progreso */}
                <div className="px-6 pb-3">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-[10px] font-black ${completo ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {progreso} / {cantidad} seriales
                        </span>
                        <span className={`text-[10px] font-bold ${completo ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {porcentaje}%
                        </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-300 ${
                                completo ? 'bg-emerald-500' : 'bg-indigo-400'
                            }`}
                            style={{ width: `${porcentaje}%` }}
                        />
                    </div>
                </div>

                {/* Input de pistoleo */}
                <div className="px-6 pb-3">
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <Scan className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                onPaste={handlePaste}
                                placeholder={progreso >= cantidad ? 'Todos los seriales cargados' : 'Escanear o escribir serial…'}
                                disabled={progreso >= cantidad}
                                className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 disabled:bg-slate-50 disabled:text-slate-400 transition-colors"
                            />
                        </div>
                        {seriales.length > 0 && (
                            <button
                                type="button"
                                onClick={clearAll}
                                className="text-xs font-bold text-red-500 hover:text-red-700 transition-colors whitespace-nowrap"
                            >
                                Limpiar
                            </button>
                        )}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
                        <Clipboard className="w-3 h-3" />
                        Enter/Tab para agregar · Pega lista separada por saltos de línea o comas
                    </p>
                </div>

                {/* Error */}
                {error && (
                    <div className="mx-6 mb-3 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        {error}
                    </div>
                )}

                {/* Lista de seriales */}
                <div className="flex-1 overflow-y-auto px-6 pb-3 min-h-0">
                    {seriales.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <Scan className="w-8 h-8 text-slate-200 mb-2" strokeWidth={1.4} />
                            <p className="text-xs text-slate-400">
                                Escanea o pega los números de serie
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {seriales.map((s, i) => {
                                const isDupe = duplicados.has(s) && seriales.indexOf(s) !== i;
                                return (
                                    <div
                                        key={`${s}-${i}`}
                                        className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs ${
                                            isDupe
                                                ? 'bg-red-50 border border-red-200'
                                                : 'bg-slate-50 border border-slate-100'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="text-[10px] font-black text-slate-300 w-5 text-right shrink-0">
                                                {i + 1}
                                            </span>
                                            <span className={`font-mono font-bold truncate ${isDupe ? 'text-red-600' : 'text-slate-800'}`}>
                                                {s}
                                            </span>
                                            {isDupe && (
                                                <span className="text-[9px] font-black text-red-500 bg-red-100 px-1.5 py-0.5 rounded-full shrink-0">
                                                    DUPLICADO
                                                </span>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeSerial(i)}
                                            className="text-slate-300 hover:text-red-500 transition-colors shrink-0 ml-2"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={() => onConfirm(seriales)}
                        disabled={!completo}
                        className={`inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-black text-white transition-all ${
                            completo
                                ? 'bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 shadow-sm'
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                    >
                        <CheckCircle2 className="w-4 h-4" />
                        Confirmar {progreso}/{cantidad}
                    </button>
                </div>
            </div>
        </div>
    );
}
