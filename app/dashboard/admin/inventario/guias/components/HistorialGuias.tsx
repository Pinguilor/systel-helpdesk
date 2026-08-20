'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import {
    ClipboardList, Search, X, ChevronLeft, ChevronRight, Paperclip,
    CalendarDays, ChevronDown, Loader2, TrendingUp, Package2, Store,
    ExternalLink,
} from 'lucide-react';
import { getGuiasConFiltrosAction, type GuiaResumen, type Proveedor, type KPIsGuias } from '../actions';
import { DetalleGuiaModal } from './DetalleGuiaModal';

const PAGE_SIZE = 10;

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
    const colors: Record<string, string> = {
        emerald: 'from-emerald-500 to-teal-500 shadow-emerald-500/25',
        indigo:  'from-indigo-500 to-violet-500 shadow-indigo-500/25',
        violet:  'from-violet-500 to-purple-500 shadow-violet-500/25',
    };
    return (
        <div className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200 px-4 py-3.5 shadow-sm">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${colors[color]} flex items-center justify-center shadow-lg shrink-0`}>
                <Icon className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 truncate">{label}</p>
                <p className="text-lg font-black text-slate-900 leading-tight">{value}</p>
            </div>
        </div>
    );
}

// ── Proveedor dropdown (no native select) ────────────────────────────────────

function ProveedorFilter({ proveedores, value, onChange }: { proveedores: Proveedor[]; value: string; onChange: (id: string) => void }) {
    const [open,  setOpen]  = useState(false);
    const [query, setQuery] = useState('');
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const filtered = query.trim()
        ? proveedores.filter(p => p.nombre.toLowerCase().includes(query.toLowerCase()))
        : proveedores;

    const selected = proveedores.find(p => p.id === value);

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                    value
                        ? 'bg-white border-indigo-300 text-indigo-700 shadow-sm'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
            >
                <Store className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                <span className="truncate max-w-[140px]">{selected?.nombre ?? 'Todos los proveedores'}</span>
                <ChevronDown className={`w-3.5 h-3.5 shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="absolute top-full left-0 mt-1.5 w-60 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 overflow-hidden">
                    <div className="p-2 border-b border-slate-100">
                        <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-50 rounded-lg">
                            <Search className="w-3 h-3 text-slate-400 shrink-0" />
                            <input
                                type="text"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder="Filtrar..."
                                autoFocus
                                className="flex-1 bg-transparent text-xs focus:outline-none text-slate-700 font-medium placeholder:text-slate-400"
                            />
                        </div>
                    </div>
                    <div className="max-h-52 overflow-y-auto py-1">
                        <button
                            type="button"
                            onClick={() => { onChange(''); setOpen(false); setQuery(''); }}
                            className={`w-full text-left px-3 py-2 text-xs font-bold transition-colors ${!value ? 'bg-slate-50 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            Todos los proveedores
                        </button>
                        {filtered.map(p => (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => { onChange(p.id); setOpen(false); setQuery(''); }}
                                className={`w-full text-left px-3 py-2 text-xs font-semibold transition-colors ${p.id === value ? 'bg-indigo-50 text-indigo-700 font-black' : 'text-slate-700 hover:bg-slate-50'}`}
                            >
                                {p.nombre}
                            </button>
                        ))}
                        {filtered.length === 0 && (
                            <p className="px-3 py-3 text-xs text-slate-400 text-center">Sin resultados</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
    guiasIniciales: GuiaResumen[];
    totalGuias:     number;
    proveedores:    Proveedor[];
    kpis:           KPIsGuias;
}

export function HistorialGuias({ guiasIniciales, totalGuias, proveedores, kpis }: Props) {
    const [guias,      setGuias]    = useState<GuiaResumen[]>(guiasIniciales);
    const [total,      setTotal]    = useState(totalGuias);
    const [page,       setPage]     = useState(0);
    const [search,     setSearch]   = useState('');
    const [debSearch,  setDebSearch] = useState('');
    const [desde,      setDesde]    = useState('');
    const [hasta,      setHasta]    = useState('');
    const [provFiltro, setProvFiltro] = useState('');
    const [tipoDocFiltro, setTipoDocFiltro] = useState<'GD' | 'FC' | ''>('');
    const [isPending,  startTransition] = useTransition();
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const isFirstMount = useRef(true);

    // Debounce de búsqueda
    useEffect(() => {
        const t = setTimeout(() => setDebSearch(search), 350);
        return () => clearTimeout(t);
    }, [search]);

    // Resetear página cuando cambian los filtros (no el page en sí)
    const prevFilters = useRef({ debSearch, desde, hasta, provFiltro, tipoDocFiltro });
    useEffect(() => {
        const p = prevFilters.current;
        if (p.debSearch !== debSearch || p.desde !== desde || p.hasta !== hasta || p.provFiltro !== provFiltro || p.tipoDocFiltro !== tipoDocFiltro) {
            prevFilters.current = { debSearch, desde, hasta, provFiltro, tipoDocFiltro };
            setPage(0);
        }
    }, [debSearch, desde, hasta, provFiltro, tipoDocFiltro]);

    // Fetch cuando cambia cualquier parámetro (excepto primera carga)
    useEffect(() => {
        if (isFirstMount.current) { isFirstMount.current = false; return; }
        startTransition(async () => {
            const r = await getGuiasConFiltrosAction({
                search:         debSearch,
                desde,
                hasta,
                proveedorId:    provFiltro,
                tipoDocumento:  tipoDocFiltro,
                page,
                pageSize:       PAGE_SIZE,
            });
            setGuias(r.data ?? []);
            setTotal(r.total ?? 0);
        });
    }, [debSearch, desde, hasta, provFiltro, tipoDocFiltro, page]);

    const hasFilters = !!(search || desde || hasta || provFiltro || tipoDocFiltro);
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    function clearFilters() {
        setSearch('');
        setDebSearch('');
        setDesde('');
        setHasta('');
        setProvFiltro('');
        setTipoDocFiltro('');
        setPage(0);
    }

    return (
        <>
            <div className="space-y-5">
                {/* ── KPIs ─────────────────────────────────────────────── */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <KpiCard icon={TrendingUp} label="Guías este mes"         value={kpis.guiasEsteMes}                   color="emerald" />
                    <KpiCard icon={Package2}   label="Unidades ingresadas/mes" value={kpis.unidadesEsteMes.toLocaleString()} color="indigo" />
                    <KpiCard icon={Store}      label="Último proveedor"        value={kpis.ultimoProveedor ?? '—'}          color="violet" />
                </div>

                {/* ── Barra de filtros ──────────────────────────────────── */}
                {/* relative z-10: crea un stacking context por encima del card de la tabla
                    para que el dropdown de ProveedorFilter no quede detrás de él. */}
                <div className="relative z-10 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
                    {/* Buscador principal */}
                    <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar por N° guía, proveedor, producto o número de serie…"
                            className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all"
                        />
                        {search && (
                            <button
                                type="button"
                                onClick={() => setSearch('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* Filtros secundarios */}
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-2">
                            <CalendarDays className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="text-xs font-bold text-slate-500">Desde</span>
                            <input
                                type="date"
                                value={desde}
                                onChange={e => setDesde(e.target.value)}
                                className="px-2.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-500">Hasta</span>
                            <input
                                type="date"
                                value={hasta}
                                onChange={e => setHasta(e.target.value)}
                                className="px-2.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all"
                            />
                        </div>

                        <ProveedorFilter
                            proveedores={proveedores}
                            value={provFiltro}
                            onChange={setProvFiltro}
                        />

                        {/* Filtro de tipo de documento — no native select */}
                        <div className="flex bg-slate-100 p-0.5 rounded-xl gap-0.5">
                            {([
                                { val: '' as const,   label: 'Todos' },
                                { val: 'GD' as const, label: 'GD — Guías' },
                                { val: 'FC' as const, label: 'FC — Facturas' },
                            ] as { val: 'GD' | 'FC' | ''; label: string }[]).map(opt => (
                                <button
                                    key={opt.val || 'all'}
                                    type="button"
                                    onClick={() => setTipoDocFiltro(opt.val)}
                                    className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                                        tipoDocFiltro === opt.val
                                            ? opt.val === 'GD'
                                                ? 'bg-white text-blue-700 shadow-sm'
                                                : opt.val === 'FC'
                                                    ? 'bg-white text-emerald-700 shadow-sm'
                                                    : 'bg-white text-slate-900 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>

                        {hasFilters && (
                            <button
                                type="button"
                                onClick={clearFilters}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
                            >
                                <X className="w-3.5 h-3.5" />
                                Limpiar
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Tabla ────────────────────────────────────────────── */}
                {/* min-h: garantiza espacio vertical para que el dropdown no quede cortado
                    cuando hay pocos resultados. overflow-hidden se mantiene para los bordes
                    redondeados de la tabla — no afecta al dropdown (no es descendiente de este div). */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[420px]">
                    {/* Cabecera de resultados */}
                    <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
                        <p className="text-xs font-bold text-slate-500">
                            {isPending ? (
                                <span className="flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando…</span>
                            ) : (
                                <>{total === 0 ? 'Sin resultados' : `${total} guía${total !== 1 ? 's' : ''} encontrada${total !== 1 ? 's' : ''}`}{hasFilters && ' (filtrado)'}</>
                            )}
                        </p>
                        <p className="text-xs font-bold text-slate-400">
                            Página {page + 1} / {totalPages}
                        </p>
                    </div>

                    {guias.length === 0 && !isPending ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                            <ClipboardList className="w-10 h-10 text-slate-200" />
                            <p className="text-sm font-semibold">
                                {hasFilters ? 'Ninguna guía coincide con los filtros.' : 'Aún no hay guías registradas.'}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[800px] text-xs">
                                <thead>
                                    <tr className="border-b border-slate-100">
                                        {['N° Guía', 'Proveedor', 'Bodega', 'Fecha', 'Ítems', 'Unidades', 'Receptor', 'Estado', 'Doc'].map(col => (
                                            <th key={col} className="px-4 py-2.5 text-left font-black text-[10px] uppercase tracking-wider text-slate-400">
                                                {col}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className={`divide-y divide-slate-50 ${isPending ? 'opacity-50' : ''} transition-opacity`}>
                                    {guias.map(g => (
                                        <tr
                                            key={g.id}
                                            onClick={() => setSelectedId(g.id)}
                                            className="hover:bg-indigo-50/60 cursor-pointer transition-colors group"
                                        >
                                            <td className="px-4 py-3">
                                                <span className="flex items-center gap-2">
                                                    <span className={`inline-flex items-center text-[11px] font-black px-2 py-0.5 rounded-full ${
                                                        g.tipo_documento === 'FC'
                                                            ? 'bg-emerald-50 text-emerald-700'
                                                            : 'bg-blue-50 text-blue-700'
                                                    }`}>
                                                        {g.tipo_documento}-{g.numero_guia}
                                                    </span>
                                                    <ExternalLink className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-60 transition-opacity" />
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 font-semibold text-slate-700 max-w-[160px] truncate">{g.proveedor}</td>
                                            <td className="px-4 py-3 text-slate-500 max-w-[130px] truncate">{g.bodega_nombre}</td>
                                            <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                                                {new Date(g.fecha_guia + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 font-semibold">{g.total_items}</td>
                                            <td className="px-4 py-3">
                                                <span className="font-black px-2 py-0.5 rounded-full text-[11px] bg-emerald-50 text-emerald-700">
                                                    {g.total_unidades}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-slate-500 max-w-[120px] truncate">{g.registrado_por}</td>
                                            <td className="px-4 py-3">
                                                <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
                                                    g.estado === 'completada'
                                                        ? 'bg-emerald-50 text-emerald-700'
                                                        : 'bg-red-50 text-red-700'
                                                }`}>
                                                    {g.estado}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {g.documento_url ? (
                                                    <a
                                                        href={g.documento_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={e => e.stopPropagation()}
                                                        className="inline-flex items-center gap-1 text-indigo-500 hover:text-indigo-700 transition-colors"
                                                    >
                                                        <Paperclip className="w-3.5 h-3.5" />
                                                    </a>
                                                ) : (
                                                    <span className="text-slate-300">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* ── Paginación ─────────────────────────────────────── */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50">
                            <button
                                type="button"
                                onClick={() => setPage(p => p - 1)}
                                disabled={page === 0 || isPending}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            >
                                <ChevronLeft className="w-3.5 h-3.5" />
                                Anterior
                            </button>

                            <div className="flex items-center gap-1">
                                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                                    let pageNum: number;
                                    if (totalPages <= 7) {
                                        pageNum = i;
                                    } else if (page < 4) {
                                        pageNum = i < 5 ? i : i === 5 ? totalPages - 2 : totalPages - 1;
                                    } else if (page > totalPages - 5) {
                                        pageNum = i < 2 ? i : i === 2 ? -1 : totalPages - (7 - i);
                                    } else {
                                        if (i === 0) pageNum = 0;
                                        else if (i === 1) pageNum = -1;
                                        else if (i >= 2 && i <= 4) pageNum = page + (i - 3);
                                        else if (i === 5) pageNum = -1;
                                        else pageNum = totalPages - 1;
                                    }

                                    if (pageNum === -1) return (
                                        <span key={i} className="w-8 text-center text-slate-400 text-xs font-bold">…</span>
                                    );
                                    return (
                                        <button
                                            key={i}
                                            type="button"
                                            onClick={() => setPage(pageNum)}
                                            disabled={isPending}
                                            className={`w-8 h-8 rounded-lg text-xs font-black transition-all ${
                                                pageNum === page
                                                    ? 'bg-slate-900 text-white shadow-sm'
                                                    : 'text-slate-500 hover:bg-white hover:text-slate-900 border border-transparent hover:border-slate-200'
                                            }`}
                                        >
                                            {pageNum + 1}
                                        </button>
                                    );
                                })}
                            </div>

                            <button
                                type="button"
                                onClick={() => setPage(p => p + 1)}
                                disabled={page >= totalPages - 1 || isPending}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            >
                                Siguiente
                                <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Modal de detalle ──────────────────────────────────────── */}
            {selectedId && (
                <DetalleGuiaModal
                    guiaId={selectedId}
                    onClose={() => setSelectedId(null)}
                />
            )}
        </>
    );
}
