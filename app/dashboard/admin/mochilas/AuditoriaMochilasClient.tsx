'use client';

import { useState, useTransition } from 'react';
import {
    Backpack, User, Package, Hash, Layers, ChevronDown, ChevronRight,
    Loader2, AlertTriangle, PackagePlus, X, CheckCircle2, Search,
    RefreshCw, Inbox, Shield, Unlock,
} from 'lucide-react';
import { inicializarMochilaAction, forzarDesbloqueoAction } from './actions';
import { useRouter } from 'next/navigation';

// ── Tipos ─────────────────────────────────────────────────────
interface InventarioItem {
    id: string;
    modelo: string | null;
    familia: string | null;
    es_serializado: boolean;
    numero_serie: string | null;
    cantidad: number;
    estado: string | null;
}

interface MochilaTecnico {
    tecnico_id: string;
    tecnico_nombre: string | null;
    tecnico_email: string | null;
    mochila_id: string | null;
    mochila_nombre: string | null;
    items: InventarioItem[];
    total_items: number;
    total_unidades: number;
    tiene_mora: boolean;
}

// ── Modal: Confirmar Inicializar Mochila ──────────────────────
function ModalInicializar({
    tecnico,
    onClose,
    onSuccess,
}: {
    tecnico: MochilaTecnico;
    onClose: () => void;
    onSuccess: () => void;
}) {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState('');

    const handleConfirm = () => {
        setError('');
        startTransition(async () => {
            const res = await inicializarMochilaAction(
                tecnico.tecnico_id,
                tecnico.tecnico_nombre || 'Técnico'
            );
            if (res.error) setError(res.error);
            else { onSuccess(); onClose(); }
        });
    };

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="fixed inset-0" onClick={onClose} />
            <div className="relative bg-white rounded-2xl w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden z-10">
                <div className="bg-indigo-600 px-6 py-4 flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-xl"><PackagePlus className="w-5 h-5 text-white" /></div>
                    <div>
                        <h3 className="text-base font-black text-white">Inicializar Mochila</h3>
                        <p className="text-xs text-indigo-200 font-medium">Crear registro de inventario en campo</p>
                    </div>
                    <button onClick={onClose} disabled={isPending} title="Cerrar" className="ml-auto p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                        <p className="text-sm font-medium text-slate-700">
                            Se creará el registro de mochila virtual para{' '}
                            <span className="font-black text-slate-900">{tecnico.tecnico_nombre}</span>.
                            El técnico podrá recibir materiales vía el flujo de Solicitudes al Bodeguero.
                        </p>
                    </div>
                    {error && (
                        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-red-600 text-sm font-medium">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{error}
                        </div>
                    )}
                    <div className="flex gap-3 pt-1">
                        <button onClick={onClose} disabled={isPending} className="flex-1 px-4 py-2.5 text-sm font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                            Cancelar
                        </button>
                        <button onClick={handleConfirm} disabled={isPending} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-black rounded-xl hover:bg-indigo-700 transition-all shadow-md active:scale-95 disabled:opacity-40">
                            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            {isPending ? 'Inicializando…' : 'Confirmar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Modal: Confirmar Forzar Desbloqueo ────────────────────────
function ModalForzarDesbloqueo({
    tecnico,
    onClose,
    onSuccess,
}: {
    tecnico: MochilaTecnico;
    onClose: () => void;
    onSuccess: () => void;
}) {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState('');

    const handleConfirm = () => {
        setError('');
        startTransition(async () => {
            const res = await forzarDesbloqueoAction(tecnico.tecnico_id);
            if (res.error) setError(res.error);
            else { onSuccess(); onClose(); }
        });
    };

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="fixed inset-0" onClick={onClose} />
            <div className="relative bg-white rounded-2xl w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden z-10">
                <div className="bg-orange-500 px-6 py-4 flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-xl"><Unlock className="w-5 h-5 text-white" /></div>
                    <div>
                        <h3 className="text-base font-black text-white">Forzar Desbloqueo</h3>
                        <p className="text-xs text-orange-100 font-medium">Limpiar mora de materiales vencidos</p>
                    </div>
                    <button onClick={onClose} disabled={isPending} title="Cerrar" className="ml-auto p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                        <p className="text-sm font-medium text-orange-800">
                            Se eliminará el plazo de devolución vencido de{' '}
                            <span className="font-black">{tecnico.tecnico_nombre}</span>,
                            permitiéndole solicitar nuevos materiales. Esta acción queda registrada en auditoría.
                        </p>
                    </div>
                    {error && (
                        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-red-600 text-sm font-medium">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{error}
                        </div>
                    )}
                    <div className="flex gap-3 pt-1">
                        <button onClick={onClose} disabled={isPending} className="flex-1 px-4 py-2.5 text-sm font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                            Cancelar
                        </button>
                        <button onClick={handleConfirm} disabled={isPending} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-500 text-white text-sm font-black rounded-xl hover:bg-orange-600 transition-all shadow-md active:scale-95 disabled:opacity-40">
                            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                            {isPending ? 'Desbloqueando…' : 'Forzar Desbloqueo'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Fila de Técnico ───────────────────────────────────────────
function TecnicoRow({ mochila, onInicializar, onForzarDesbloqueo }: { mochila: MochilaTecnico; onInicializar: () => void; onForzarDesbloqueo: () => void }) {
    const [expanded, setExpanded] = useState(false);
    const tieneMochila = mochila.mochila_id !== null;
    const initials = (mochila.tecnico_nombre ?? '?').charAt(0).toUpperCase();

    return (
        <>
            <tr className={`hover:bg-slate-50/70 transition-colors ${expanded ? 'bg-indigo-50/40' : ''}`}>
                {/* Técnico */}
                <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-sm shrink-0">
                            {initials}
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-800 truncate">{mochila.tecnico_nombre || '—'}</p>
                            <p className="text-xs text-slate-400 font-medium truncate hidden md:block">{mochila.tecnico_email}</p>
                        </div>
                    </div>
                </td>

                {/* Estado Mochila */}
                <td className="px-6 py-4">
                    <div className="flex flex-col gap-1.5">
                        {tieneMochila ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 border-emerald-200">
                                <Backpack className="w-3 h-3" /> Asignada
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-black uppercase tracking-wider bg-slate-100 text-slate-500 border-slate-200">
                                Sin mochila
                            </span>
                        )}
                        {mochila.tiene_mora && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-black uppercase tracking-wider bg-red-100 text-red-700 border-red-200">
                                <AlertTriangle className="w-3 h-3" /> Mora vencida
                            </span>
                        )}
                    </div>
                </td>

                {/* Totales */}
                <td className="px-6 py-4 hidden lg:table-cell">
                    {tieneMochila ? (
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-black text-slate-700">{mochila.total_items}</span>
                            <span className="text-xs text-slate-400 font-medium">líneas</span>
                            <span className="text-slate-200">·</span>
                            <span className="text-sm font-black text-slate-700">{mochila.total_unidades}</span>
                            <span className="text-xs text-slate-400 font-medium">unid.</span>
                        </div>
                    ) : (
                        <span className="text-xs text-slate-400 font-medium">—</span>
                    )}
                </td>

                {/* Acciones */}
                <td className="px-6 py-4 text-right">
                    <div className="flex flex-col items-end gap-2">
                        {tieneMochila ? (
                            <button
                                onClick={() => setExpanded(v => !v)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                                    expanded
                                        ? 'bg-indigo-600 text-white border-indigo-600'
                                        : 'text-indigo-600 border-indigo-200 hover:bg-indigo-50'
                                }`}
                            >
                                {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                {expanded ? 'Ocultar' : 'Ver detalle'}
                            </button>
                        ) : (
                            <button
                                onClick={onInicializar}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 border border-indigo-200 rounded-xl hover:bg-indigo-50 transition-all"
                            >
                                <PackagePlus className="w-3.5 h-3.5" />
                                Inicializar
                            </button>
                        )}
                        {mochila.tiene_mora && (
                            <button
                                onClick={onForzarDesbloqueo}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-orange-600 border border-orange-200 rounded-xl hover:bg-orange-50 transition-all"
                            >
                                <Unlock className="w-3.5 h-3.5" />
                                Forzar Desbloqueo
                            </button>
                        )}
                    </div>
                </td>
            </tr>

            {/* Detalle expandido */}
            {expanded && tieneMochila && (
                <tr>
                    <td colSpan={4} className="px-6 py-0">
                        <div className="mb-4 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                            {/* Sub-header */}
                            <div className="bg-indigo-50 px-4 py-3 border-b border-indigo-100 flex items-center gap-2">
                                <Backpack className="w-4 h-4 text-indigo-600" />
                                <span className="text-xs font-black text-indigo-700 uppercase tracking-widest">
                                    {mochila.mochila_nombre}
                                </span>
                                <span className="ml-auto text-[10px] font-bold text-indigo-500 flex items-center gap-1">
                                    <Shield className="w-3 h-3" /> Solo lectura · Flujo Pull activo
                                </span>
                            </div>

                            {mochila.items.length === 0 ? (
                                <div className="py-10 text-center">
                                    <Inbox className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                                    <p className="text-sm font-medium text-slate-400">Mochila vacía — sin materiales en campo</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-50">
                                    {mochila.items.map(item => (
                                        <div key={item.id} className="px-4 py-3 flex items-center gap-3">
                                            <div className={`p-1.5 rounded-lg shrink-0 ${item.es_serializado ? 'bg-indigo-100 text-indigo-600' : 'bg-amber-100 text-amber-600'}`}>
                                                {item.es_serializado ? <Hash className="w-3.5 h-3.5" /> : <Layers className="w-3.5 h-3.5" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-slate-700 truncate">{item.modelo ?? '—'}</p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{item.familia ?? '—'}</p>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                {item.es_serializado && item.numero_serie && (
                                                    <span className="font-mono text-[10px] bg-indigo-50 border border-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded hidden sm:inline">
                                                        #{item.numero_serie}
                                                    </span>
                                                )}
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border ${
                                                    item.estado === 'Disponible'
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                        : 'bg-slate-50 text-slate-500 border-slate-200'
                                                }`}>
                                                    {item.estado}
                                                </span>
                                                <span className="text-sm font-black text-slate-800 min-w-[30px] text-right">
                                                    ×{item.cantidad}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}

// ── Componente Principal ──────────────────────────────────────
export function AuditoriaMochilasClient({ mochilas }: { mochilas: MochilaTecnico[] }) {
    const router = useRouter();
    const [search, setSearch] = useState('');
    const [filtro, setFiltro] = useState<'todos' | 'con' | 'sin'>('todos');
    const [modalInicializar, setModalInicializar] = useState<MochilaTecnico | null>(null);
    const [modalDesbloqueo, setModalDesbloqueo] = useState<MochilaTecnico | null>(null);

    const handleRefresh = () => router.refresh();

    const mochilasVisibles = mochilas.filter(m => {
        const matchSearch = search === '' ||
            (m.tecnico_nombre ?? '').toLowerCase().includes(search.toLowerCase()) ||
            (m.tecnico_email ?? '').toLowerCase().includes(search.toLowerCase());
        const matchFiltro = filtro === 'todos'
            ? true
            : filtro === 'con' ? m.mochila_id !== null : m.mochila_id === null;
        return matchSearch && matchFiltro;
    });

    const conMochila = mochilas.filter(m => m.mochila_id !== null).length;
    const sinMochila = mochilas.filter(m => m.mochila_id === null).length;
    const totalUnidades = mochilas.reduce((s, m) => s + m.total_unidades, 0);

    return (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-amber-100 text-amber-600 rounded-2xl">
                        <Backpack className="w-7 h-7" />
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Auditoría de Mochilas</h1>
                        <p className="text-sm font-medium text-slate-500 mt-0.5">Inventario en campo por técnico · Solo lectura</p>
                    </div>
                </div>
                <button onClick={handleRefresh} title="Actualizar" className="p-2.5 text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors bg-white shadow-sm self-start sm:self-auto">
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Técnicos totales',  value: mochilas.length,  color: 'text-slate-700',   bg: 'bg-slate-50',   border: 'border-slate-200' },
                    { label: 'Con mochila',        value: conMochila,        color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
                    { label: 'Sin mochila',        value: sinMochila,        color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200' },
                    { label: 'Unidades en campo',  value: totalUnidades,     color: 'text-indigo-700',  bg: 'bg-indigo-50',  border: 'border-indigo-200' },
                ].map(kpi => (
                    <div key={kpi.label} className={`${kpi.bg} border ${kpi.border} rounded-2xl px-4 py-3`}>
                        <p className="text-xs font-bold text-slate-500 mb-1">{kpi.label}</p>
                        <p className={`text-2xl font-black ${kpi.color}`}>{kpi.value}</p>
                    </div>
                ))}
            </div>

            {/* Filtros */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar técnico por nombre o email…"
                        className="w-full border-2 border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white"
                    />
                </div>
                <div className="flex gap-2">
                    {[
                        { key: 'todos', label: 'Todos' },
                        { key: 'con',   label: `Con mochila (${conMochila})` },
                        { key: 'sin',   label: `Sin mochila (${sinMochila})` },
                    ].map(f => (
                        <button
                            key={f.key}
                            onClick={() => setFiltro(f.key as typeof filtro)}
                            className={`px-3 py-2 rounded-xl text-xs font-black border transition-all whitespace-nowrap ${
                                filtro === f.key
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                            }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tabla */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-100">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Técnico</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Mochila</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest hidden lg:table-cell">Stock en Campo</th>
                                <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 bg-white">
                            {mochilasVisibles.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="text-center py-16 text-slate-400">
                                        <User className="w-8 h-8 mx-auto mb-3 text-slate-200" />
                                        <p className="text-sm font-medium">No hay técnicos que coincidan.</p>
                                    </td>
                                </tr>
                            ) : (
                                mochilasVisibles.map(m => (
                                    <TecnicoRow
                                        key={m.tecnico_id}
                                        mochila={m}
                                        onInicializar={() => setModalInicializar(m)}
                                        onForzarDesbloqueo={() => setModalDesbloqueo(m)}
                                    />
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                {mochilasVisibles.length > 0 && (
                    <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-400">
                            Mostrando {mochilasVisibles.length} de {mochilas.length} técnicos
                        </span>
                        <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400">
                            <Shield className="w-3 h-3" />
                            Vista de auditoría · Sin permisos de escritura
                        </div>
                    </div>
                )}
            </div>

            {/* Modal Inicializar */}
            {modalInicializar && (
                <ModalInicializar
                    tecnico={modalInicializar}
                    onClose={() => setModalInicializar(null)}
                    onSuccess={handleRefresh}
                />
            )}

            {/* Modal Forzar Desbloqueo */}
            {modalDesbloqueo && (
                <ModalForzarDesbloqueo
                    tecnico={modalDesbloqueo}
                    onClose={() => setModalDesbloqueo(null)}
                    onSuccess={handleRefresh}
                />
            )}
        </div>
    );
}
