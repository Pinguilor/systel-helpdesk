'use client';

import React, { useState, useTransition, useCallback, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/lib/supabase/client';
import {
    BookOpen, Plus, Pencil, Trash2, Loader2, AlertTriangle,
    CheckCircle2, X, RefreshCw, ChevronRight, ArrowLeft,
    Layers, Tag, Wrench, Zap, ToggleLeft, ToggleRight,
    FolderOpen, Folder,
} from 'lucide-react';
import {
    crearTipoServicioAction, actualizarTipoServicioAction, toggleTipoServicioAction, eliminarTipoServicioAction,
    crearCategoriaAction, actualizarCategoriaAction, toggleCategoriaAction, eliminarCategoriaAction,
    crearSubcategoriaAction, actualizarSubcategoriaAction, toggleSubcategoriaAction, eliminarSubcategoriaAction,
    crearAccionAction, actualizarAccionAction, toggleAccionAction, eliminarAccionAction,
} from './actions';
import { useRouter } from 'next/navigation';

// ── Tipos ──────────────────────────────────────────────────────
interface CatNode { id: string; nombre: string; activo: boolean; }

// ── Config de niveles ──────────────────────────────────────────
const LEVELS = [
    {
        key: 'tipo',
        label: 'Tipo de Servicio',
        sublabel: 'NIVEL 1',
        icon: Layers,
        gradient: 'from-indigo-600 to-indigo-800',
        bgLight: 'bg-indigo-50',
        bgMedium: 'bg-indigo-100',
        textColor: 'text-indigo-700',
        borderColor: 'border-indigo-300',
        selBg: 'bg-indigo-700',
        dotActive: 'bg-indigo-400',
    },
    {
        key: 'categoria',
        label: 'Categoría Principal',
        sublabel: 'NIVEL 2',
        icon: Tag,
        gradient: 'from-emerald-500 to-teal-700',
        bgLight: 'bg-emerald-50',
        bgMedium: 'bg-emerald-100',
        textColor: 'text-emerald-700',
        borderColor: 'border-emerald-300',
        selBg: 'bg-emerald-600',
        dotActive: 'bg-emerald-400',
    },
    {
        key: 'subcategoria',
        label: 'Equipo',
        sublabel: 'NIVEL 3',
        icon: Wrench,
        gradient: 'from-amber-500 to-orange-600',
        bgLight: 'bg-amber-50',
        bgMedium: 'bg-amber-100',
        textColor: 'text-amber-700',
        borderColor: 'border-amber-300',
        selBg: 'bg-amber-600',
        dotActive: 'bg-amber-400',
    },
    {
        key: 'accion',
        label: 'Acción / Falla',
        sublabel: 'NIVEL 4',
        icon: Zap,
        gradient: 'from-slate-600 to-slate-800',
        bgLight: 'bg-slate-50',
        bgMedium: 'bg-slate-100',
        textColor: 'text-slate-700',
        borderColor: 'border-slate-300',
        selBg: 'bg-slate-700',
        dotActive: 'bg-slate-400',
    },
] as const;

// ── Modal Backdrop ─────────────────────────────────────────────
function Backdrop({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="fixed inset-0" onClick={onClose} />
            {children}
        </div>
    );
}

// ── Inline Input ───────────────────────────────────────────────
function TextInput({ value, onChange, placeholder, autoFocus }: {
    value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean;
}) {
    const ref = useRef<HTMLInputElement>(null);
    useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);
    return (
        <input ref={ref} type="text" value={value} onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white" />
    );
}

// ── Modal: Crear / Editar nodo ─────────────────────────────────
function ModalNodo({
    title, subtitle, headerBg, initialValue, placeholder, isPendingExternal,
    onClose, onSubmit,
}: {
    title: string; subtitle: string; headerBg: string; initialValue?: string;
    placeholder?: string; isPendingExternal?: boolean;
    onClose: () => void;
    onSubmit: (nombre: string) => Promise<string | null>; // returns error or null
}) {
    const [value, setValue] = useState(initialValue ?? '');
    const [error, setError] = useState('');
    const [isPending, start] = useTransition();
    const busy = isPending || isPendingExternal;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!value.trim()) { setError('El nombre no puede estar vacío.'); return; }
        setError('');
        start(async () => {
            const err = await onSubmit(value.trim());
            if (err) setError(err);
            else onClose();
        });
    };

    return (
        <Backdrop onClose={() => !busy && onClose()}>
            <div className="relative bg-white rounded-2xl w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden z-10">
                <div className={`${headerBg} px-6 py-4 flex items-center gap-3`}>
                    <div className="p-2 bg-white/20 rounded-xl">
                        {initialValue !== undefined ? <Pencil className="w-5 h-5 text-white" /> : <Plus className="w-5 h-5 text-white" />}
                    </div>
                    <div>
                        <h3 className="text-base font-black text-white">{title}</h3>
                        <p className="text-xs text-white/70 font-medium">{subtitle}</p>
                    </div>
                    <button onClick={onClose} disabled={busy} className="ml-auto p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <TextInput value={value} onChange={setValue} placeholder={placeholder} autoFocus />
                    {error && (
                        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-red-600 text-sm font-medium">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{error}
                        </div>
                    )}
                    <div className="flex gap-3 pt-1">
                        <button type="button" onClick={onClose} disabled={busy} className="flex-1 px-4 py-2.5 text-sm font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                            Cancelar
                        </button>
                        <button type="submit" disabled={busy} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 text-white text-sm font-black rounded-xl hover:bg-slate-700 transition-all shadow-md active:scale-95 disabled:opacity-40">
                            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            {busy ? 'Guardando…' : 'Guardar'}
                        </button>
                    </div>
                </form>
            </div>
        </Backdrop>
    );
}

// ── Modal: Eliminar ────────────────────────────────────────────
function ModalEliminar({ levelLabel, nombre, onClose, onConfirm }: {
    levelLabel: string; nombre: string; onClose: () => void; onConfirm: () => Promise<string | null>;
}) {
    const [error, setError] = useState('');
    const [isPending, start] = useTransition();

    const handleDelete = () => {
        setError('');
        start(async () => {
            const err = await onConfirm();
            if (err) setError(err);
            else onClose();
        });
    };

    return (
        <Backdrop onClose={() => !isPending && onClose()}>
            <div className="relative bg-white rounded-2xl w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden z-10 border-2 border-red-100">
                <div className="bg-red-600 px-6 py-4 flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-xl"><Trash2 className="w-5 h-5 text-white" /></div>
                    <div>
                        <h3 className="text-base font-black text-white">Eliminar {levelLabel}</h3>
                        <p className="text-xs text-red-200 font-medium">Esta acción es permanente</p>
                    </div>
                    <button onClick={onClose} disabled={isPending} className="ml-auto p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                        <p className="text-sm font-medium text-red-800">
                            Eliminarás permanentemente <span className="font-black">"{nombre}"</span> y todos sus elementos hijos en cascada.
                        </p>
                    </div>
                    {error && (
                        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-red-600 text-sm font-medium">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{error}
                        </div>
                    )}
                    <div className="flex gap-3">
                        <button type="button" onClick={onClose} disabled={isPending} className="flex-1 px-4 py-2.5 text-sm font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">Cancelar</button>
                        <button onClick={handleDelete} disabled={isPending} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white text-sm font-black rounded-xl hover:bg-red-700 transition-all shadow-md active:scale-95 disabled:opacity-40">
                            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            {isPending ? 'Eliminando…' : 'Eliminar'}
                        </button>
                    </div>
                </div>
            </div>
        </Backdrop>
    );
}

// ── NodeTooltip: tooltip via portal (escapa overflow-hidden/auto) ──
function NodeTooltip({ text, children }: { text: string; children: React.ReactNode }) {
    const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);
    const ref = useRef<HTMLDivElement>(null);

    return (
        <>
            <div
                ref={ref}
                className="flex-1 min-w-0"
                onMouseEnter={() => {
                    if (ref.current) {
                        const r = ref.current.getBoundingClientRect();
                        setCoords({ x: r.left + r.width / 2, y: r.top });
                    }
                }}
                onMouseLeave={() => setCoords(null)}
            >
                {children}
            </div>
            {coords && createPortal(
                <span
                    style={{ position: 'fixed', top: coords.y - 8, left: coords.x, transform: 'translate(-50%, -100%)', zIndex: 9999 }}
                    className="bg-slate-800 text-white text-xs font-semibold rounded-lg py-1.5 px-2.5 whitespace-nowrap pointer-events-none shadow-xl"
                >
                    {text}
                    {/* Flecha apuntando hacia abajo */}
                    <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                </span>,
                document.body
            )}
        </>
    );
}

// ── NodeItem: fila individual dentro de una columna ────────────
function NodeItem({
    node, isSelected, isLast, cfg, isAdmin,
    onSelect, onEdit, onDelete, onToggle, isToggling,
    childCount,
}: {
    node: CatNode;
    isSelected: boolean;
    isLast: boolean;
    cfg: typeof LEVELS[number];
    isAdmin: boolean;
    onSelect: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onToggle: () => void;
    isToggling: boolean;
    childCount?: number;
}) {
    const Icon = cfg.icon;
    return (
        <div
            onClick={onSelect}
            className={`group flex items-center gap-2.5 px-3 py-2.5 mx-2 my-0.5 rounded-xl cursor-pointer transition-all duration-150 ${
                isSelected
                    ? `${cfg.selBg} text-white shadow-sm`
                    : `hover:${cfg.bgLight} text-slate-700`
            }`}
        >
            {/* Icon */}
            {!isLast ? (
                isSelected
                    ? <FolderOpen className="w-4 h-4 shrink-0 text-white/80" />
                    : <Folder className="w-4 h-4 shrink-0 text-slate-400 group-hover:text-slate-600" />
            ) : (
                <div className={`w-2 h-2 rounded-full shrink-0 ${
                    isSelected ? 'bg-white' : node.activo ? cfg.dotActive : 'bg-slate-300'
                }`} />
            )}

            {/* Name */}
            <NodeTooltip text={node.nombre}>
                <span className={`block text-sm font-semibold truncate ${isSelected ? 'text-white' : 'text-slate-700'}`}>
                    {node.nombre}
                </span>
            </NodeTooltip>

            {/* Count or status badge */}
            {!isLast && childCount !== undefined && (
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full shrink-0 ${
                    isSelected ? 'bg-white/20 text-white' : `${cfg.bgMedium} ${cfg.textColor}`
                }`}>
                    {childCount}
                </span>
            )}

            {isLast && (
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full shrink-0 ${
                    isSelected
                        ? 'bg-white/20 text-white'
                        : node.activo
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                }`}>
                    {node.activo ? 'Activo' : 'Inactivo'}
                </span>
            )}

            {/* Chevron (non-last) */}
            {!isLast && (
                <ChevronRight className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                    isSelected ? 'text-white/70 translate-x-0.5' : 'text-slate-300 group-hover:text-slate-500'
                }`} />
            )}

            {/* Admin actions */}
            {isAdmin && (
                <div
                    className={`flex items-center gap-0.5 shrink-0 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                    onClick={e => e.stopPropagation()}
                >
                    {isLast && (
                        <button
                            onClick={onToggle}
                            disabled={isToggling}
                            title={node.activo ? 'Desactivar' : 'Activar'}
                            className={`p-1 rounded-lg transition-colors ${
                                isSelected
                                    ? 'text-white/70 hover:text-white hover:bg-white/20'
                                    : `${cfg.textColor} hover:${cfg.bgMedium}`
                            } disabled:opacity-50`}
                        >
                            {isToggling
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : node.activo ? <ToggleRight className="w-3 h-3" /> : <ToggleLeft className="w-3 h-3" />
                            }
                        </button>
                    )}
                    <button onClick={onEdit} title="Editar" className={`p-1 rounded-lg transition-colors ${
                        isSelected ? 'text-white/70 hover:text-white hover:bg-white/20' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'
                    }`}><Pencil className="w-3 h-3" /></button>
                    <button onClick={onDelete} title="Eliminar" className={`p-1 rounded-lg transition-colors ${
                        isSelected ? 'text-white/70 hover:text-white hover:bg-white/20' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                    }`}><Trash2 className="w-3 h-3" /></button>
                </div>
            )}
        </div>
    );
}

// ── Column header ──────────────────────────────────────────────
function ColumnHeader({ cfg, count, isLoading }: {
    cfg: typeof LEVELS[number]; count: number; isLoading?: boolean;
}) {
    const Icon = cfg.icon;
    return (
        <div className={`flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-gradient-to-r ${cfg.gradient}`}>
            <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-white/20 rounded-lg"><Icon className="w-4 h-4 text-white" /></div>
                <div>
                    <p className="text-[10px] font-black text-white/60 uppercase tracking-widest">{cfg.sublabel}</p>
                    <p className="text-sm font-black text-white leading-tight">{cfg.label}</p>
                </div>
            </div>
            <div className="flex items-center gap-1.5">
                {isLoading && <Loader2 className="w-3.5 h-3.5 text-white/60 animate-spin" />}
                <span className="text-[11px] font-black bg-white/20 text-white px-2 py-0.5 rounded-full">{count}</span>
            </div>
        </div>
    );
}

// ── Placeholder column ─────────────────────────────────────────
function PlaceholderColumn({ cfg, message }: { cfg: typeof LEVELS[number]; message: string }) {
    const Icon = cfg.icon;
    return (
        <div className="flex flex-col h-full">
            <ColumnHeader cfg={cfg} count={0} />
            <div className="flex flex-col items-center justify-center flex-1 py-12 px-6 text-center">
                <div className={`p-4 ${cfg.bgMedium} rounded-2xl mb-3`}><Icon className={`w-6 h-6 ${cfg.textColor}`} /></div>
                <p className="text-sm font-semibold text-slate-400">{message}</p>
                <p className="text-xs text-slate-300 mt-1">Selecciona un elemento del nivel anterior</p>
            </div>
        </div>
    );
}

// ── Componente Principal ──────────────────────────────────────
export function CatalogoServiciosClient({
    tiposServicio: initialTipos,
    isAdmin,
    clienteId,
}: {
    tiposServicio: CatNode[];
    isAdmin: boolean;
    clienteId?: string; // Si se pasa, el catálogo opera en modo "cliente específico"
}) {
    const router = useRouter();
    const supabase = useMemo(() => createClient(), []);

    // ── State de datos por nivel ────────────────────────────────
    const [tipos, setTipos] = useState<CatNode[]>(initialTipos);
    const [categorias, setCategorias] = useState<CatNode[]>([]);
    const [subcategorias, setSubcategorias] = useState<CatNode[]>([]);
    const [acciones, setAcciones] = useState<CatNode[]>([]);

    // ── Estado de selección ─────────────────────────────────────
    const [selTipo, setSelTipo] = useState<CatNode | null>(null);
    const [selCategoria, setSelCategoria] = useState<CatNode | null>(null);
    const [selSubcategoria, setSelSubcategoria] = useState<CatNode | null>(null);
    const [selAccion, setSelAccion] = useState<CatNode | null>(null);

    // ── Loading states ──────────────────────────────────────────
    const [loadingCat, setLoadingCat] = useState(false);
    const [loadingSub, setLoadingSub] = useState(false);
    const [loadingAcc, setLoadingAcc] = useState(false);

    // ── Toggle state ────────────────────────────────────────────
    const [togglingId, setTogglingId] = useState<string | null>(null);
    const [, startToggle] = useTransition();

    // ── Modal state ─────────────────────────────────────────────
    type ModalState = {
        type: 'crear' | 'editar' | 'eliminar';
        level: 'tipo' | 'categoria' | 'subcategoria' | 'accion';
        node?: CatNode;
    } | null;
    const [modal, setModal] = useState<ModalState>(null);

    const closeModal = useCallback(() => setModal(null), []);
    const handleRefresh = useCallback(() => router.refresh(), [router]);

    // ── Fetch nivel 2 cuando cambia selección nivel 1 ──────────
    useEffect(() => {
        if (!selTipo) { setCategorias([]); setSelCategoria(null); return; }
        setLoadingCat(true);
        supabase.from('ticket_categorias')
            .select('id, nombre, activo')
            .eq('tipo_servicio_id', selTipo.id)
            .order('nombre')
            .then(({ data }) => {
                setCategorias(data ?? []);
                setSelCategoria(null);
                setSubcategorias([]);
                setSelSubcategoria(null);
                setAcciones([]);
                setSelAccion(null);
                setLoadingCat(false);
            });
    }, [selTipo, supabase]);

    // ── Fetch nivel 3 cuando cambia selección nivel 2 ──────────
    useEffect(() => {
        if (!selCategoria) { setSubcategorias([]); setSelSubcategoria(null); return; }
        setLoadingSub(true);
        supabase.from('ticket_subcategorias')
            .select('id, nombre, activo')
            .eq('categoria_id', selCategoria.id)
            .order('nombre')
            .then(({ data }) => {
                setSubcategorias(data ?? []);
                setSelSubcategoria(null);
                setAcciones([]);
                setSelAccion(null);
                setLoadingSub(false);
            });
    }, [selCategoria, supabase]);

    // ── Fetch nivel 4 cuando cambia selección nivel 3 ──────────
    useEffect(() => {
        if (!selSubcategoria) { setAcciones([]); setSelAccion(null); return; }
        setLoadingAcc(true);
        supabase.from('ticket_acciones')
            .select('id, nombre, activo')
            .eq('subcategoria_id', selSubcategoria.id)
            .order('nombre')
            .then(({ data }) => {
                setAcciones(data ?? []);
                setSelAccion(null);
                setLoadingAcc(false);
            });
    }, [selSubcategoria, supabase]);

    // ── Refresh helpers que re-fetch el nivel correcto ──────────
    const refreshTipos = useCallback(async () => {
        const { data } = await supabase.from('ticket_tipos_servicio').select('id, nombre, activo').order('nombre');
        setTipos(data ?? []);
    }, [supabase]);

    const refreshCategorias = useCallback(async () => {
        if (!selTipo) return;
        const { data } = await supabase.from('ticket_categorias').select('id, nombre, activo')
            .eq('tipo_servicio_id', selTipo.id).order('nombre');
        setCategorias(data ?? []);
    }, [supabase, selTipo]);

    const refreshSubcategorias = useCallback(async () => {
        if (!selCategoria) return;
        const { data } = await supabase.from('ticket_subcategorias').select('id, nombre, activo')
            .eq('categoria_id', selCategoria.id).order('nombre');
        setSubcategorias(data ?? []);
    }, [supabase, selCategoria]);

    const refreshAcciones = useCallback(async () => {
        if (!selSubcategoria) return;
        const { data } = await supabase.from('ticket_acciones').select('id, nombre, activo')
            .eq('subcategoria_id', selSubcategoria.id).order('nombre');
        setAcciones(data ?? []);
    }, [supabase, selSubcategoria]);

    // ── Toggle handlers ─────────────────────────────────────────
    const handleToggle = (
        id: string, activo: boolean,
        action: (id: string, activo: boolean) => Promise<{ error?: string | null }>,
        refresh: () => Promise<void>
    ) => {
        setTogglingId(id);
        startToggle(async () => {
            await action(id, activo);
            await refresh();
            setTogglingId(null);
        });
    };

    // ── Stats ───────────────────────────────────────────────────
    const totalCats = useMemo(() => [...new Set(categorias.map(c => c.id))].length, [categorias]);
    const totalSubs = useMemo(() => [...new Set(subcategorias.map(s => s.id))].length, [subcategorias]);
    const totalAcc = useMemo(() => acciones.length, [acciones]);

    // Mobile step
    const mobileStep = selTipo ? (selCategoria ? (selSubcategoria ? 3 : 2) : 1) : 0;

    // ── CRUD modal submit handlers ──────────────────────────────
    const getSubmitHandler = (m: NonNullable<ModalState>): ((nombre: string) => Promise<string | null>) | null => {
        if (m.type === 'crear') {
            if (m.level === 'tipo') return async (n) => { const r = await crearTipoServicioAction(n, clienteId); await refreshTipos(); return r.error ?? null; };
            if (m.level === 'categoria') return async (n) => { const r = await crearCategoriaAction(n, selTipo!.id); await refreshCategorias(); return r.error ?? null; };
            if (m.level === 'subcategoria') return async (n) => { const r = await crearSubcategoriaAction(n, selCategoria!.id); await refreshSubcategorias(); return r.error ?? null; };
            if (m.level === 'accion') return async (n) => { const r = await crearAccionAction(n, selSubcategoria!.id); await refreshAcciones(); return r.error ?? null; };
        }
        if (m.type === 'editar' && m.node) {
            const node = m.node;
            if (m.level === 'tipo') return async (n) => { const r = await actualizarTipoServicioAction(node.id, n); await refreshTipos(); return r.error ?? null; };
            if (m.level === 'categoria') return async (n) => { const r = await actualizarCategoriaAction(node.id, n); await refreshCategorias(); return r.error ?? null; };
            if (m.level === 'subcategoria') return async (n) => { const r = await actualizarSubcategoriaAction(node.id, n); await refreshSubcategorias(); return r.error ?? null; };
            if (m.level === 'accion') return async (n) => { const r = await actualizarAccionAction(node.id, n); await refreshAcciones(); return r.error ?? null; };
        }
        return null;
    };

    const getDeleteHandler = (m: NonNullable<ModalState>): (() => Promise<string | null>) | null => {
        if (m.type === 'eliminar' && m.node) {
            const node = m.node;
            if (m.level === 'tipo') return async () => { const r = await eliminarTipoServicioAction(node.id); await refreshTipos(); return r.error ?? null; };
            if (m.level === 'categoria') return async () => { const r = await eliminarCategoriaAction(node.id); await refreshCategorias(); return r.error ?? null; };
            if (m.level === 'subcategoria') return async () => { const r = await eliminarSubcategoriaAction(node.id); await refreshSubcategorias(); return r.error ?? null; };
            if (m.level === 'accion') return async () => { const r = await eliminarAccionAction(node.id); await refreshAcciones(); return r.error ?? null; };
        }
        return null;
    };

    // ── Modal config ────────────────────────────────────────────
    const MODAL_CFG: Record<string, { title: string; subtitle: string; headerBg: string; placeholder: string }> = {
        tipo_crear:       { title: 'Nuevo Tipo de Servicio', subtitle: 'Nivel raíz del catálogo', headerBg: 'bg-gradient-to-r from-indigo-600 to-indigo-800', placeholder: 'Ej: Continuidad Operativa, Proyectos…' },
        tipo_editar:      { title: 'Editar Tipo de Servicio', subtitle: modal?.node?.nombre ?? '', headerBg: 'bg-slate-800', placeholder: '' },
        categoria_crear:  { title: 'Nueva Categoría', subtitle: `En: ${selTipo?.nombre ?? ''}`, headerBg: 'bg-gradient-to-r from-emerald-500 to-teal-700', placeholder: 'Ej: Hardware, Redes, Software…' },
        categoria_editar: { title: 'Editar Categoría', subtitle: modal?.node?.nombre ?? '', headerBg: 'bg-slate-800', placeholder: '' },
        subcategoria_crear:  { title: 'Nuevo Equipo', subtitle: `En: ${selCategoria?.nombre ?? ''}`, headerBg: 'bg-gradient-to-r from-amber-500 to-orange-600', placeholder: 'Ej: KVS, POS, Tablet…' },
        subcategoria_editar: { title: 'Editar Equipo', subtitle: modal?.node?.nombre ?? '', headerBg: 'bg-slate-800', placeholder: '' },
        accion_crear:  { title: 'Nueva Acción / Falla', subtitle: `En: ${selSubcategoria?.nombre ?? ''}`, headerBg: 'bg-gradient-to-r from-slate-600 to-slate-800', placeholder: 'Ej: No enciende, Cambiar botonera…' },
        accion_editar: { title: 'Editar Acción / Falla', subtitle: modal?.node?.nombre ?? '', headerBg: 'bg-slate-800', placeholder: '' },
    };

    const modalCfgKey = modal ? `${modal.level}_${modal.type}` : null;
    const currentModalCfg = modalCfgKey ? MODAL_CFG[modalCfgKey] : null;

    // ── Breadcrumb ──────────────────────────────────────────────
    const breadcrumbs = useMemo(() => {
        const crumbs = [];
        if (selTipo) crumbs.push({ label: selTipo.nombre, color: 'text-indigo-600', onClick: () => { setSelCategoria(null); setSelSubcategoria(null); setSelAccion(null); } });
        if (selCategoria) crumbs.push({ label: selCategoria.nombre, color: 'text-emerald-600', onClick: () => { setSelSubcategoria(null); setSelAccion(null); } });
        if (selSubcategoria) crumbs.push({ label: selSubcategoria.nombre, color: 'text-amber-600', onClick: () => setSelAccion(null) });
        if (selAccion) crumbs.push({ label: selAccion.nombre, color: 'text-slate-600', onClick: () => {} });
        return crumbs;
    }, [selTipo, selCategoria, selSubcategoria, selAccion]);

    // ── Render ──────────────────────────────────────────────────
    return (
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl"><BookOpen className="w-7 h-7" /></div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Catálogo de Servicios</h1>
                        <p className="text-sm font-medium text-slate-500 mt-0.5">
                            Clasificación jerárquica de 4 niveles · {tipos.length} tipos de servicio
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                    <button onClick={handleRefresh} title="Actualizar" className="p-2.5 text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors bg-white shadow-sm">
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    {isAdmin && (
                        <button
                            onClick={() => setModal({ type: 'crear', level: 'tipo' })}
                            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-black rounded-xl hover:bg-indigo-700 transition-all shadow-md active:scale-95"
                        >
                            <Plus className="w-4 h-4" /> Nuevo Tipo
                        </button>
                    )}
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Tipos de Servicio', value: tipos.length, Icon: Layers, bg: 'bg-indigo-100', color: 'text-indigo-600' },
                    { label: selTipo ? `Categorías en "${selTipo.nombre}"` : 'Categorías', value: selTipo ? categorias.length : '—', Icon: Tag, bg: 'bg-emerald-100', color: 'text-emerald-600' },
                    { label: selCategoria ? `Equipos en "${selCategoria.nombre}"` : 'Equipos', value: selCategoria ? subcategorias.length : '—', Icon: Wrench, bg: 'bg-amber-100', color: 'text-amber-600' },
                    { label: selSubcategoria ? `Acciones en "${selSubcategoria.nombre}"` : 'Acciones / Fallas', value: selSubcategoria ? acciones.length : '—', Icon: Zap, bg: 'bg-slate-100', color: 'text-slate-600' },
                ].map(k => (
                    <div key={k.label} className="bg-white border border-slate-200 rounded-2xl px-4 py-3 flex items-center gap-3 min-w-0">
                        <div className={`p-2 ${k.bg} ${k.color} rounded-xl shrink-0`}><k.Icon className="w-4 h-4" /></div>
                        <div className="min-w-0">
                            <p className="text-xl font-black text-slate-900">{k.value}</p>
                            <p className="text-[11px] font-medium text-slate-500 leading-tight truncate">{k.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Breadcrumb */}
            {breadcrumbs.length > 0 && (
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5 flex-wrap">
                    <button onClick={() => { setSelTipo(null); }} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <button onClick={() => setSelTipo(null)} className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors">
                        <BookOpen className="w-3 h-3" /> Catálogo
                    </button>
                    {breadcrumbs.map((crumb, i) => (
                        <React.Fragment key={i}>
                            <ChevronRight className="w-3 h-3 text-slate-300" />
                            <button onClick={crumb.onClick} className={`text-xs font-bold transition-colors ${i === breadcrumbs.length - 1 ? crumb.color : 'text-slate-500 hover:text-slate-700'}`}>
                                {crumb.label}
                            </button>
                        </React.Fragment>
                    ))}
                </div>
            )}

            {/* ── Grid 4 columnas ─────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Mobile back */}
                {mobileStep > 0 && (
                    <div className="sm:hidden px-4 py-2 border-b border-slate-100 bg-slate-50">
                        <button
                            onClick={() => {
                                if (mobileStep === 3) setSelSubcategoria(null);
                                else if (mobileStep === 2) setSelCategoria(null);
                                else setSelTipo(null);
                            }}
                            className="flex items-center gap-1 text-xs font-bold text-indigo-600"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" /> Volver
                        </button>
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100" style={{ minHeight: '520px' }}>

                    {/* ── NIVEL 1 — Tipos de Servicio ── */}
                    <div className={`flex flex-col ${mobileStep !== 0 ? 'hidden sm:flex' : 'flex'}`}>
                        <ColumnHeader cfg={LEVELS[0]} count={tipos.length} />
                        <div className="flex-1 overflow-y-auto py-2">
                            {tipos.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                                    <div className="p-3 bg-indigo-100 rounded-2xl mb-2"><Layers className="w-5 h-5 text-indigo-500" /></div>
                                    <p className="text-xs text-slate-400 font-medium">Sin tipos de servicio</p>
                                </div>
                            ) : tipos.map(node => (
                                <NodeItem key={node.id} node={node} isSelected={selTipo?.id === node.id}
                                    isLast={false} cfg={LEVELS[0]} isAdmin={isAdmin}
                                    childCount={undefined}
                                    onSelect={() => setSelTipo(selTipo?.id === node.id ? null : node)}
                                    onEdit={() => setModal({ type: 'editar', level: 'tipo', node })}
                                    onDelete={() => setModal({ type: 'eliminar', level: 'tipo', node })}
                                    onToggle={() => handleToggle(node.id, node.activo, toggleTipoServicioAction, refreshTipos)}
                                    isToggling={togglingId === node.id}
                                />
                            ))}
                        </div>
                        {isAdmin && (
                            <div className="p-2 border-t border-slate-100">
                                <button onClick={() => setModal({ type: 'crear', level: 'tipo' })}
                                    className={`w-full flex items-center justify-center gap-2 py-2 text-xs font-black rounded-xl border-2 border-dashed transition-all ${LEVELS[0].borderColor} ${LEVELS[0].textColor} ${LEVELS[0].bgLight} hover:opacity-80`}>
                                    <Plus className="w-3.5 h-3.5" /> Agregar
                                </button>
                            </div>
                        )}
                    </div>

                    {/* ── NIVEL 2 — Categorías ── */}
                    <div className={`flex flex-col ${mobileStep !== 1 ? 'hidden sm:flex' : 'flex'}`}>
                        {!selTipo ? (
                            <PlaceholderColumn cfg={LEVELS[1]} message="Selecciona un Tipo de Servicio" />
                        ) : (
                            <>
                                <ColumnHeader cfg={LEVELS[1]} count={categorias.length} isLoading={loadingCat} />
                                <div className="flex-1 overflow-y-auto py-2">
                                    {categorias.length === 0 && !loadingCat ? (
                                        <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                                            <div className="p-3 bg-emerald-100 rounded-2xl mb-2"><Tag className="w-5 h-5 text-emerald-500" /></div>
                                            <p className="text-xs text-slate-400 font-medium">Sin categorías</p>
                                        </div>
                                    ) : categorias.map(node => (
                                        <NodeItem key={node.id} node={node} isSelected={selCategoria?.id === node.id}
                                            isLast={false} cfg={LEVELS[1]} isAdmin={isAdmin}
                                            childCount={undefined}
                                            onSelect={() => setSelCategoria(selCategoria?.id === node.id ? null : node)}
                                            onEdit={() => setModal({ type: 'editar', level: 'categoria', node })}
                                            onDelete={() => setModal({ type: 'eliminar', level: 'categoria', node })}
                                            onToggle={() => handleToggle(node.id, node.activo, toggleCategoriaAction, refreshCategorias)}
                                            isToggling={togglingId === node.id}
                                        />
                                    ))}
                                </div>
                                {isAdmin && (
                                    <div className="p-2 border-t border-slate-100">
                                        <button onClick={() => setModal({ type: 'crear', level: 'categoria' })}
                                            className={`w-full flex items-center justify-center gap-2 py-2 text-xs font-black rounded-xl border-2 border-dashed transition-all ${LEVELS[1].borderColor} ${LEVELS[1].textColor} ${LEVELS[1].bgLight} hover:opacity-80`}>
                                            <Plus className="w-3.5 h-3.5" /> Agregar
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* ── NIVEL 3 — Subcategorías / Equipo ── */}
                    <div className={`flex flex-col ${mobileStep !== 2 ? 'hidden sm:flex' : 'flex'}`}>
                        {!selCategoria ? (
                            <PlaceholderColumn cfg={LEVELS[2]} message="Selecciona una Categoría" />
                        ) : (
                            <>
                                <ColumnHeader cfg={LEVELS[2]} count={subcategorias.length} isLoading={loadingSub} />
                                <div className="flex-1 overflow-y-auto py-2">
                                    {subcategorias.length === 0 && !loadingSub ? (
                                        <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                                            <div className="p-3 bg-amber-100 rounded-2xl mb-2"><Wrench className="w-5 h-5 text-amber-500" /></div>
                                            <p className="text-xs text-slate-400 font-medium">Sin equipos</p>
                                        </div>
                                    ) : subcategorias.map(node => (
                                        <NodeItem key={node.id} node={node} isSelected={selSubcategoria?.id === node.id}
                                            isLast={false} cfg={LEVELS[2]} isAdmin={isAdmin}
                                            childCount={undefined}
                                            onSelect={() => setSelSubcategoria(selSubcategoria?.id === node.id ? null : node)}
                                            onEdit={() => setModal({ type: 'editar', level: 'subcategoria', node })}
                                            onDelete={() => setModal({ type: 'eliminar', level: 'subcategoria', node })}
                                            onToggle={() => handleToggle(node.id, node.activo, toggleSubcategoriaAction, refreshSubcategorias)}
                                            isToggling={togglingId === node.id}
                                        />
                                    ))}
                                </div>
                                {isAdmin && (
                                    <div className="p-2 border-t border-slate-100">
                                        <button onClick={() => setModal({ type: 'crear', level: 'subcategoria' })}
                                            className={`w-full flex items-center justify-center gap-2 py-2 text-xs font-black rounded-xl border-2 border-dashed transition-all ${LEVELS[2].borderColor} ${LEVELS[2].textColor} ${LEVELS[2].bgLight} hover:opacity-80`}>
                                            <Plus className="w-3.5 h-3.5" /> Agregar
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* ── NIVEL 4 — Acciones / Fallas ── */}
                    <div className={`flex flex-col ${mobileStep !== 3 ? 'hidden sm:flex' : 'flex'}`}>
                        {!selSubcategoria ? (
                            <PlaceholderColumn cfg={LEVELS[3]} message="Selecciona un Equipo" />
                        ) : (
                            <>
                                <ColumnHeader cfg={LEVELS[3]} count={acciones.length} isLoading={loadingAcc} />
                                <div className="flex-1 overflow-y-auto py-2">
                                    {acciones.length === 0 && !loadingAcc ? (
                                        <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                                            <div className="p-3 bg-slate-100 rounded-2xl mb-2"><Zap className="w-5 h-5 text-slate-500" /></div>
                                            <p className="text-xs text-slate-400 font-medium">Sin acciones / fallas</p>
                                        </div>
                                    ) : acciones.map(node => (
                                        <NodeItem key={node.id} node={node} isSelected={selAccion?.id === node.id}
                                            isLast cfg={LEVELS[3]} isAdmin={isAdmin}
                                            onSelect={() => setSelAccion(selAccion?.id === node.id ? null : node)}
                                            onEdit={() => setModal({ type: 'editar', level: 'accion', node })}
                                            onDelete={() => setModal({ type: 'eliminar', level: 'accion', node })}
                                            onToggle={() => handleToggle(node.id, node.activo, toggleAccionAction, refreshAcciones)}
                                            isToggling={togglingId === node.id}
                                        />
                                    ))}
                                </div>
                                {isAdmin && (
                                    <div className="p-2 border-t border-slate-100">
                                        <button onClick={() => setModal({ type: 'crear', level: 'accion' })}
                                            className={`w-full flex items-center justify-center gap-2 py-2 text-xs font-black rounded-xl border-2 border-dashed transition-all ${LEVELS[3].borderColor} ${LEVELS[3].textColor} ${LEVELS[3].bgLight} hover:opacity-80`}>
                                            <Plus className="w-3.5 h-3.5" /> Agregar
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                </div>{/* /grid */}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-1">
                {LEVELS.map((cfg, i) => (
                    <div key={cfg.key} className="flex items-center gap-2">
                        <div className={`p-1 ${cfg.bgMedium} rounded-lg`}><cfg.icon className={`w-3 h-3 ${cfg.textColor}`} /></div>
                        <span className="text-xs font-semibold text-slate-500">{cfg.sublabel}: {cfg.label}</span>
                    </div>
                ))}
            </div>

            {/* ── Modales ── */}
            {modal && modal.type !== 'eliminar' && currentModalCfg && (() => {
                const submit = getSubmitHandler(modal);
                if (!submit) return null;
                return (
                    <ModalNodo
                        title={currentModalCfg.title}
                        subtitle={currentModalCfg.subtitle}
                        headerBg={currentModalCfg.headerBg}
                        placeholder={currentModalCfg.placeholder}
                        initialValue={modal.type === 'editar' ? modal.node?.nombre : undefined}
                        onClose={closeModal}
                        onSubmit={submit}
                    />
                );
            })()}

            {modal && modal.type === 'eliminar' && modal.node && (() => {
                const confirm = getDeleteHandler(modal);
                if (!confirm) return null;
                return (
                    <ModalEliminar
                        levelLabel={LEVELS.find(l => l.key === modal.level)?.label ?? ''}
                        nombre={modal.node.nombre}
                        onClose={closeModal}
                        onConfirm={confirm}
                    />
                );
            })()}
        </div>
    );
}
