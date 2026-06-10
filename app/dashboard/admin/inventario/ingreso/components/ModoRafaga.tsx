'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import {
    Scan, CheckCircle2, AlertCircle, ArrowLeft,
    PackageCheck, Loader2, RotateCcw, ChevronDown,
} from 'lucide-react';
import { CustomSelect } from '@/app/dashboard/components/CustomSelect';
import { SearchableSelect } from '@/app/dashboard/components/SearchableSelect';
import { ingresoLoteAction } from '../actions';

type Bodega      = { id: string; nombre: string };
type CatalogoItem = { id: string; familia: string; modelo: string; es_serializado: boolean; bodega_id: string };
type EstadoSerial = 'pendiente' | 'valido' | 'dup_lote' | 'dup_bd';
type SerialEntry  = { id: string; value: string; estado: EstadoSerial };
type Fase         = 'config' | 'rafaga' | 'exito';

interface Props {
    bodegas:  Bodega[];
    catalogo: CatalogoItem[];
}

// ── Chip visual styles ────────────────────────────────────────────────────────

const CHIP_STYLES: Record<EstadoSerial, { container: string; icon: 'loading' | 'check' | 'alert' }> = {
    pendiente: { container: 'bg-slate-50 border-slate-200 text-slate-400',    icon: 'loading' },
    valido:    { container: 'bg-emerald-50 border-emerald-200 text-emerald-700', icon: 'check' },
    dup_lote:  { container: 'bg-red-50 border-red-200 text-red-600',           icon: 'alert' },
    dup_bd:    { container: 'bg-red-50 border-red-200 text-red-600',           icon: 'alert' },
};

function SerialChip({ entry }: { entry: SerialEntry }) {
    const s = CHIP_STYLES[entry.estado];
    return (
        <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono font-bold transition-colors ${s.container}`}>
            {s.icon === 'loading' && <Loader2 className="w-3 h-3 animate-spin shrink-0" />}
            {s.icon === 'check'   && <CheckCircle2 className="w-3 h-3 shrink-0" />}
            {s.icon === 'alert'   && <AlertCircle  className="w-3 h-3 shrink-0" />}
            {entry.value}
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ModoRafaga({ bodegas, catalogo }: Props) {
    const [fase,       setFase]       = useState<Fase>('config');
    const [bodegaId,   setBodegaId]   = useState('');
    const [catalogoId, setCatalogoId] = useState('');
    const [inputValue, setInputValue] = useState('');
    const [seriales,   setSeriales]   = useState<SerialEntry[]>([]);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [insertedCount, setInsertedCount] = useState(0);
    const [isPending, startTransition] = useTransition();

    const [comboQuery, setComboQuery] = useState('');
    const [comboDropdownOpen, setComboDropdownOpen] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);
    const comboInputRef = useRef<HTMLInputElement>(null);
    const comboDropdownRef = useRef<HTMLDivElement>(null);

    // Reset modelo when bodega changes
    useEffect(() => {
        setCatalogoId('');
        setComboQuery('');
        setComboDropdownOpen(false);
    }, [bodegaId]);

    // Only serialized items for the selected bodega
    const catalogoSerie = bodegaId
        ? catalogo.filter(c => c.es_serializado && c.bodega_id === bodegaId)
        : [];

    const filteredCatalogo = catalogoSerie.filter(item => {
        if (!comboQuery.trim()) return true;
        const q = comboQuery.toLowerCase();
        return (
            item.modelo.toLowerCase().includes(q) ||
            item.familia.toLowerCase().includes(q)
        );
    });

    useEffect(() => {
        function handler(e: MouseEvent) {
            const t = e.target as Node;
            if (
                comboDropdownRef.current && !comboDropdownRef.current.contains(t) &&
                comboInputRef.current && !comboInputRef.current.contains(t)
            ) {
                setComboDropdownOpen(false);
            }
        }
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    useEffect(() => {
        function handler(e: KeyboardEvent) {
            if (e.key === 'Escape') setComboDropdownOpen(false);
        }
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, []);

    const bodegaOptions   = bodegas.map(b => ({ value: b.id, label: b.nombre }));
    const catalogoOptions = catalogoSerie.map(c => ({
        value:    c.id,
        label:    c.modelo,
        sublabel: c.familia,
    }));

    const selectedBodega   = bodegas.find(b => b.id === bodegaId);
    const selectedCatalogo = catalogoSerie.find(c => c.id === catalogoId);

    const validos    = seriales.filter(s => s.estado === 'valido').length;
    const duplicados = seriales.filter(s => s.estado === 'dup_bd' || s.estado === 'dup_lote').length;
    const pendientes = seriales.filter(s => s.estado === 'pendiente').length;

    // Focus the scanner input when entering ráfaga phase
    useEffect(() => {
        if (fase === 'rafaga') {
            inputRef.current?.focus();
        }
    }, [fase]);

    // Async DB check — runs in background, never blocks focus
    const checkSerialAsync = useCallback(async (value: string, entryId: string) => {
        try {
            const res = await fetch(`/api/inventario/check-serial?serial=${encodeURIComponent(value)}`);
            if (!res.ok) throw new Error('check failed');
            const { exists } = await res.json();
            setSeriales(prev => prev.map(s =>
                s.id === entryId ? { ...s, estado: exists ? 'dup_bd' : 'valido' } : s
            ));
        } catch {
            // Fail-open: mark valid if network fails; server action does a final duplicate check
            setSeriales(prev => prev.map(s =>
                s.id === entryId ? { ...s, estado: 'valido' } : s
            ));
        }
    }, []);

    // Called once the scanner fires its Enter keystroke
    function handleScan(raw: string) {
        const trimmed = raw.trim();
        setInputValue('');
        inputRef.current?.focus(); // always re-assert focus

        if (trimmed.length < 3) return;

        // Silently ignore duplicates already in this lote
        if (seriales.some(s => s.value === trimmed)) return;

        const id = crypto.randomUUID();
        setSeriales(prev => [{ id, value: trimmed, estado: 'pendiente' }, ...prev]);
        checkSerialAsync(trimmed, id);
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Enter') {
            // Capture Enter from the scanner pistol — never let it bubble to a form
            e.preventDefault();
            e.stopPropagation();
            handleScan(inputValue);
        }
    }

    // Sticky focus: if the operator accidentally clicks outside the input,
    // re-focus after a small delay so button clicks can still register
    function handleBlur() {
        setTimeout(() => {
            if (fase === 'rafaga' && !isPending) {
                inputRef.current?.focus();
            }
        }, 200);
    }

    function iniciarRafaga() {
        if (!bodegaId || !catalogoId) return;
        setSeriales([]);
        setInputValue('');
        setSubmitError(null);
        setFase('rafaga');
    }

    function nuevoLote() {
        setSeriales([]);
        setInputValue('');
        setSubmitError(null);
        setBodegaId('');
        setCatalogoId('');
        setComboQuery('');
        setComboDropdownOpen(false);
        setFase('config');
    }

    function handleSubmit() {
        if (!selectedBodega || !selectedCatalogo) return;
        const validSeriales = seriales.filter(s => s.estado === 'valido').map(s => s.value);
        if (!validSeriales.length) return;

        setSubmitError(null);
        startTransition(async () => {
            const result = await ingresoLoteAction({
                bodegaId: selectedBodega.id,
                modelo:   selectedCatalogo.modelo,
                familia:  selectedCatalogo.familia,
                seriales: validSeriales,
            });

            if (result.error) {
                setSubmitError(result.error);
                inputRef.current?.focus();
            } else {
                setInsertedCount(result.inserted);
                setFase('exito');
            }
        });
    }

    // ── CONFIG PHASE ─────────────────────────────────────────────────────────

    if (fase === 'config') {
        return (
            <div className="flex-1 flex items-center justify-center py-4">
                <div className="w-full max-w-xl bg-white/80 backdrop-blur-xl rounded-3xl border border-slate-200/80 shadow-2xl p-8 flex flex-col gap-6 transition-all duration-300">
                    
                    {/* Header: Centered & Modern */}
                    <div className="flex flex-col items-center text-center gap-3">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-slate-900 to-slate-800 flex items-center justify-center shadow-lg shadow-slate-900/10">
                            <Scan className="w-6 h-6 text-white" strokeWidth={1.5} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800 tracking-tight">Ingreso por Escáner</h2>
                            <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-widest">
                                Modo Ráfaga · Equipos Serializados
                            </p>
                        </div>
                    </div>

                    <div className="h-px bg-slate-100 w-full" />

                    <div className="space-y-6">
                        {bodegaId && catalogoSerie.length === 0 && (
                            <div className="bg-amber-50/70 backdrop-blur-sm border border-amber-200/60 rounded-2xl px-4 py-3 text-xs font-semibold text-amber-700 leading-relaxed shadow-sm">
                                Esta bodega no tiene modelos serializados en el catálogo. Agrégalos en{' '}
                                <a href="/dashboard/admin/bodegas" className="font-bold underline text-amber-800 hover:text-amber-950">
                                    Inventario Global
                                </a>.
                            </div>
                        )}

                        {/* Bodega select */}
                        <div className="space-y-2">
                            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                Bodega Destino
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500" />
                            </label>
                            <CustomSelect
                                id="bodega-select"
                                value={bodegaId}
                                onChange={setBodegaId}
                                options={bodegaOptions}
                                placeholder="Selecciona una bodega destino…"
                                strategy="absolute"
                            />
                        </div>

                        {/* Modelo select */}
                        <div className="space-y-2">
                            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                Equipo / Modelo
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500" />
                            </label>
                            <div className="relative">
                                <div className="relative">
                                    <input
                                        ref={comboInputRef}
                                        type="text"
                                        id="modelo-select"
                                        autoComplete="off"
                                        disabled={!bodegaId || catalogoSerie.length === 0}
                                        value={comboQuery}
                                        onChange={e => {
                                            setComboQuery(e.target.value);
                                            setCatalogoId('');
                                            setComboDropdownOpen(true);
                                        }}
                                        onFocus={() => {
                                            if (bodegaId && catalogoSerie.length > 0) {
                                                setComboDropdownOpen(true);
                                            }
                                        }}
                                        placeholder={
                                            !bodegaId
                                                ? 'Selecciona una bodega primero…'
                                                : catalogoSerie.length === 0
                                                ? 'Sin modelos serializados en esta bodega…'
                                                : 'Escribe para buscar un modelo serializado…'
                                        }
                                        className={`w-full rounded-xl border px-4 py-3 pr-10 text-sm placeholder-slate-300 focus:outline-none focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 transition-all font-bold ${
                                            !bodegaId || catalogoSerie.length === 0
                                                ? 'bg-slate-50/50 border-slate-100 text-slate-400 cursor-not-allowed'
                                                : comboDropdownOpen
                                                ? 'bg-white border-slate-900 text-slate-800'
                                                : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300'
                                        }`}
                                    />
                                    <ChevronDown
                                        className={`absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none transition-transform duration-300 ${
                                            comboDropdownOpen ? 'rotate-180 text-slate-700' : ''
                                        }`}
                                    />
                                </div>

                                {comboDropdownOpen && (
                                    <div
                                        ref={comboDropdownRef}
                                        className="absolute left-0 top-full mt-1.5 w-full bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto z-50 animate-in fade-in slide-in-from-top-2 duration-200"
                                    >
                                        <ul className="py-1">
                                            {filteredCatalogo.map(item => {
                                                const isSelected = item.id === catalogoId;
                                                return (
                                                    <li
                                                        key={item.id}
                                                        onClick={() => {
                                                            setCatalogoId(item.id);
                                                            setComboQuery(item.modelo);
                                                            setComboDropdownOpen(false);
                                                        }}
                                                        className={`w-full text-left px-4 py-3 hover:bg-slate-50/80 flex flex-col gap-0.5 border-b border-slate-100 last:border-0 cursor-pointer ${
                                                            isSelected ? 'bg-indigo-50/80 text-indigo-700 font-bold' : 'text-slate-800'
                                                        }`}
                                                    >
                                                        <span className="text-sm font-bold">{item.modelo}</span>
                                                        <span className="text-xs text-slate-400 font-medium">{item.familia}</span>
                                                    </li>
                                                );
                                            })}
                                            {filteredCatalogo.length === 0 && (
                                                <li className="px-4 py-4 text-sm text-slate-400 text-center italic font-medium">
                                                    Sin resultados para &quot;{comboQuery}&quot;
                                                </li>
                                            )}
                                        </ul>
                                    </div>
                                )}
                            </div>
                            <p className="mt-1.5 text-[10px] text-slate-400 font-semibold tracking-wide">
                                {bodegaId
                                    ? 'Solo se muestran modelos serializados de esta bodega.'
                                    : 'Debes seleccionar una bodega primero.'}
                            </p>
                        </div>

                        {/* Submit Button */}
                        <button
                            onClick={iniciarRafaga}
                            disabled={!bodegaId || !catalogoId}
                            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-slate-900 to-slate-800 hover:from-indigo-600 hover:to-indigo-500 text-white font-black py-4 rounded-2xl hover:scale-[1.01] hover:shadow-lg hover:shadow-indigo-600/10 disabled:opacity-40 disabled:hover:scale-100 disabled:hover:shadow-none transition-all duration-300 text-sm cursor-pointer shadow-md shadow-slate-950/5"
                        >
                            <Scan className="w-4 h-4" strokeWidth={2} />
                            Iniciar Ráfaga de Escaneo →
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── ÉXITO PHASE ──────────────────────────────────────────────────────────

    if (fase === 'exito') {
        return (
            <div className="flex-1 flex items-center justify-center p-6">
                <div className="w-full max-w-sm text-center space-y-6">
                    <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                        <PackageCheck className="w-8 h-8 text-emerald-600" strokeWidth={1.75} />
                    </div>
                    <div>
                        <p className="text-4xl font-black text-slate-900">{insertedCount}</p>
                        <p className="text-base font-bold text-slate-600 mt-1">
                            {insertedCount === 1 ? 'equipo registrado' : 'equipos registrados'}
                        </p>
                        <p className="text-sm text-slate-400 mt-2">
                            {selectedCatalogo?.modelo} → {selectedBodega?.nombre}
                        </p>
                    </div>
                    <button
                        onClick={nuevoLote}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white font-black rounded-xl hover:bg-slate-700 transition-colors text-sm"
                    >
                        <RotateCcw className="w-4 h-4" />
                        Ingresar Nuevo Lote
                    </button>
                </div>
            </div>
        );
    }

    // ── RÁFAGA PHASE ─────────────────────────────────────────────────────────

    return (
        <div className="flex flex-col flex-1 gap-4 min-h-0">

            {/* Locked config header */}
            <div className="flex items-center justify-between gap-4 shrink-0">
                <button
                    type="button"
                    onClick={nuevoLote}
                    disabled={isPending}
                    className="flex items-center gap-1.5 text-sm font-bold text-slate-400 hover:text-slate-800 disabled:opacity-40 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Nuevo lote
                </button>

                <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-black text-slate-800 truncate">
                        {selectedCatalogo?.modelo}
                    </span>
                    <span className="text-slate-300 shrink-0">→</span>
                    <span className="text-sm text-slate-500 truncate">
                        {selectedBodega?.nombre}
                    </span>
                </div>

                {/* Status counters */}
                <div className="flex items-center gap-1.5 shrink-0 text-xs font-bold">
                    {validos > 0 && (
                        <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full">
                            {validos} ok
                        </span>
                    )}
                    {duplicados > 0 && (
                        <span className="px-2 py-0.5 bg-red-50 border border-red-200 text-red-600 rounded-full">
                            {duplicados} dup
                        </span>
                    )}
                    {pendientes > 0 && (
                        <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-500 rounded-full flex items-center gap-1">
                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            {pendientes}
                        </span>
                    )}
                </div>
            </div>

            {/* Scanner input — always focused, always listening */}
            <div className="relative shrink-0">
                <Scan
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none"
                    strokeWidth={1.75}
                />
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={handleBlur}
                    placeholder="Apunta el escáner aquí y dispara…"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    className="w-full pl-12 pr-4 py-4 text-base font-mono border-2 border-slate-900 rounded-2xl focus:outline-none focus:ring-4 focus:ring-slate-900/10 bg-white text-slate-900 placeholder-slate-300 shadow-sm"
                />
            </div>

            {/* Serial chips list */}
            <div className="flex-1 overflow-y-auto min-h-0 rounded-xl">
                {seriales.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <Scan className="w-10 h-10 text-slate-200 mb-3" strokeWidth={1} />
                        <p className="text-sm text-slate-400">Escanea el primer equipo para comenzar</p>
                        <p className="text-xs text-slate-300 mt-1">El foco está en el campo — dispara la pistola</p>
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-2 content-start p-1">
                        {seriales.map(entry => (
                            <SerialChip key={entry.id} entry={entry} />
                        ))}
                    </div>
                )}
            </div>

            {/* Error banner */}
            {submitError && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 shrink-0">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {submitError}
                </div>
            )}

            {/* Submit — requires explicit manual click, not triggered by Enter */}
            <button
                type="button"
                onClick={handleSubmit}
                disabled={isPending || validos === 0 || pendientes > 0}
                className="w-full shrink-0 flex items-center justify-center gap-2 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl disabled:opacity-40 transition-colors text-sm"
            >
                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {isPending
                    ? 'Registrando…'
                    : pendientes > 0
                    ? `Verificando ${pendientes} serial${pendientes !== 1 ? 'es' : ''}…`
                    : validos > 0
                    ? `Ingresar ${validos} serial${validos !== 1 ? 'es' : ''} →`
                    : 'Sin seriales válidos'}
            </button>
        </div>
    );
}
