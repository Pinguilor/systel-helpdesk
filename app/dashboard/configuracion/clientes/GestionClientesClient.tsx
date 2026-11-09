'use client';

import { StickyHeader } from '@/app/dashboard/configuracion/components/StickyHeader';
import React, { useState, useTransition, useCallback, useMemo } from 'react';
import {
    Building2, Plus, Pencil, Loader2, AlertTriangle, CheckCircle2,
    X, RefreshCw, Search, ToggleLeft, ToggleRight,
    ShieldCheck, Hash, FileText, Globe, ChevronDown, ChevronUp,
} from 'lucide-react';
import {
    crearClienteAction,
    toggleActivoClienteAction,
} from './actions';
import { useRouter } from 'next/navigation';

// ── Tipos ──────────────────────────────────────────────────────
interface Cliente {
    id: string;
    nombre_fantasia: string;
    razon_social: string | null;
    rut: string | null;
    logo_url: string | null;
    activo: boolean;
    creado_en: string;
}

// ── Helpers ────────────────────────────────────────────────────
function formatDate(dateStr: string | null) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('es-CL', {
        day: '2-digit', month: 'short', year: 'numeric'
    });
}

function getInitials(nombre: string) {
    return nombre.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

// Colores avatar por posición (para identidad visual de cada cliente)
const AVATAR_COLORS = [
    'bg-indigo-100 text-indigo-700',
    'bg-emerald-100 text-emerald-700',
    'bg-amber-100 text-amber-700',
    'bg-violet-100 text-violet-700',
    'bg-rose-100 text-rose-700',
    'bg-teal-100 text-teal-700',
    'bg-orange-100 text-orange-700',
    'bg-cyan-100 text-cyan-700',
];

// ── Backdrop modal ─────────────────────────────────────────────
function ModalBackdrop({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="fixed inset-0" onClick={onClose} />
            {children}
        </div>
    );
}

// ── Campo de formulario reutilizable ───────────────────────────
function FormField({
    label, name, type = 'text', required, defaultValue, placeholder, hint, icon: Icon, autoFocus,
}: {
    label: string; name: string; type?: string; required?: boolean;
    defaultValue?: string; placeholder?: string; hint?: string;
    icon?: React.ElementType; autoFocus?: boolean;
}) {
    return (
        <div>
            <label className="flex items-center gap-1.5 text-xs font-black text-slate-600 uppercase tracking-widest mb-1.5">
                {Icon && <Icon className="w-3 h-3 text-slate-400" />}
                {label}{required && ' *'}
            </label>
            <input
                name={name}
                type={type}
                required={required}
                defaultValue={defaultValue ?? ''}
                placeholder={placeholder}
                autoFocus={autoFocus}
                className="w-full border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white"
            />
            {hint && <p className="mt-1 text-[11px] text-slate-400 font-medium">{hint}</p>}
        </div>
    );
}

// ── Modal: Crear Cliente ───────────────────────────────────────
function ModalCrear({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError('');
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
            const res = await crearClienteAction(fd);
            if (res.error) setError(res.error);
            else { onSuccess(); onClose(); }
        });
    };

    return (
        <ModalBackdrop onClose={() => !isPending && onClose()}>
            <div className="relative bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden z-10">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-4 flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-xl"><Building2 className="w-5 h-5 text-white" /></div>
                    <div>
                        <h3 className="text-base font-black text-white">Nuevo Cliente</h3>
                        <p className="text-xs text-white/70 font-medium">Registrar empresa en el sistema</p>
                    </div>
                    <button onClick={onClose} disabled={isPending} title="Cerrar" className="ml-auto p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-40">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <FormField
                        label="Área / Nombre de Fantasía" name="nombre_fantasia" required autoFocus
                        placeholder="Ej: McDonald's - Continuidad"
                        hint="Diferenciador del área o contrato dentro de la empresa. Ej: Arcos Dorados - RRHH."
                        icon={Building2}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField
                            label="Razón Social" name="razon_social" required
                            placeholder="Ej: Arcos Dorados Chile SpA"
                            hint="Nombre legal de la empresa (obligatorio)."
                            icon={FileText}
                        />
                        <FormField
                            label="RUT Empresa" name="rut"
                            placeholder="Ej: 76.123.456-7"
                            hint="Varias áreas pueden compartir el mismo RUT tributario."
                            icon={Hash}
                        />
                    </div>
                    <FormField
                        label="URL Logo (opcional)" name="logo_url" type="url"
                        placeholder="https://cdn.empresa.cl/logo.png"
                        hint="URL pública del logo para mostrar en reportes."
                        icon={Globe}
                    />

                    {error && (
                        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-red-600 text-sm font-medium">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{error}
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} disabled={isPending}
                            className="flex-1 px-4 py-2.5 text-sm font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50">
                            Cancelar
                        </button>
                        <button type="submit" disabled={isPending}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-black rounded-xl hover:bg-indigo-700 transition-all shadow-md active:scale-95 disabled:opacity-40">
                            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            {isPending ? 'Creando…' : 'Crear Cliente'}
                        </button>
                    </div>
                </form>
            </div>
        </ModalBackdrop>
    );
}

// (El modal de Editar fue movido al Client Hub /clientes/[id])

// ── Componente Principal ──────────────────────────────────────
export function GestionClientesClient({ clientes: initialClientes }: { clientes: Cliente[] }) {
    const router = useRouter();

    const [search, setSearch]     = useState('');
    const [filtroEstado, setFiltroEstado] = useState<'todos' | 'activos' | 'inactivos'>('todos');
    const [sortField, setSortField] = useState<'nombre_fantasia' | 'creado_en'>('nombre_fantasia');
    const [sortAsc, setSortAsc]   = useState(true);
    const [modalCrear, setModalCrear]   = useState(false);
    const [togglingId, setTogglingId]   = useState<string | null>(null);
    const [, startToggle]               = useTransition();

    const handleRefresh = useCallback(() => router.refresh(), [router]);

    const clientesFiltrados = useMemo(() => {
        return initialClientes
            .filter(c => {
                const q = search.toLowerCase();
                const matchSearch = search === '' ||
                    c.nombre_fantasia.toLowerCase().includes(q) ||
                    (c.razon_social ?? '').toLowerCase().includes(q) ||
                    (c.rut ?? '').toLowerCase().includes(q);
                const matchEstado = filtroEstado === 'todos'
                    ? true
                    : filtroEstado === 'activos' ? c.activo : !c.activo;
                return matchSearch && matchEstado;
            })
            .sort((a, b) => {
                const va = sortField === 'nombre_fantasia'
                    ? a.nombre_fantasia.toLowerCase()
                    : (a.creado_en ?? '');
                const vb = sortField === 'nombre_fantasia'
                    ? b.nombre_fantasia.toLowerCase()
                    : (b.creado_en ?? '');
                return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
            });
    }, [initialClientes, search, filtroEstado, sortField, sortAsc]);

    const handleToggleActivo = (id: string, activo: boolean) => {
        setTogglingId(id);
        startToggle(async () => {
            await toggleActivoClienteAction(id, activo);
            setTogglingId(null);
            router.refresh();
        });
    };

    const handleSort = (field: typeof sortField) => {
        if (sortField === field) setSortAsc(v => !v);
        else { setSortField(field); setSortAsc(true); }
    };

    const SortIcon = ({ field }: { field: typeof sortField }) => {
        if (sortField !== field) return <ChevronDown className="w-3 h-3 text-slate-300" />;
        return sortAsc
            ? <ChevronDown className="w-3 h-3 text-indigo-500" />
            : <ChevronUp className="w-3 h-3 text-indigo-500" />;
    };

    const activos   = initialClientes.filter(c => c.activo).length;
    const inactivos = initialClientes.filter(c => !c.activo).length;

    return (
        <>
            <StickyHeader maxW="max-w-7xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
                        <Building2 className="w-7 h-7" />
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Gestión de Clientes</h1>
                        <p className="text-sm font-medium text-slate-500 mt-0.5">
                            {initialClientes.length} empresa{initialClientes.length !== 1 ? 's' : ''} registrada{initialClientes.length !== 1 ? 's' : ''} · {activos} activa{activos !== 1 ? 's' : ''}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                    <button onClick={handleRefresh} title="Actualizar"
                        className="p-2.5 text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors bg-white shadow-sm">
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setModalCrear(true)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-black rounded-xl hover:bg-indigo-700 transition-all shadow-md active:scale-95"
                    >
                        <Plus className="w-4 h-4" /> Nuevo Cliente
                    </button>
                </div>
            </div>
            </StickyHeader>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

            {/* KPIs */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: 'Total', value: initialClientes.length, bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700' },
                    { label: 'Activos', value: activos, bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
                    { label: 'Inactivos', value: inactivos, bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
                ].map(k => (
                    <div key={k.label} className={`${k.bg} border ${k.border} rounded-2xl px-4 py-3`}>
                        <p className="text-xs font-bold text-slate-500 mb-1">{k.label}</p>
                        <p className={`text-2xl font-black ${k.text}`}>{k.value}</p>
                    </div>
                ))}
            </div>

            {/* Filtros */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                        type="text" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar por nombre, razón social o RUT…"
                        className="w-full border-2 border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white"
                    />
                </div>
                <div className="flex gap-1.5">
                    {(['todos', 'activos', 'inactivos'] as const).map(f => (
                        <button key={f} onClick={() => setFiltroEstado(f)}
                            className={`px-3 py-2 rounded-xl text-xs font-black border transition-all capitalize ${
                                filtroEstado === f
                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                            }`}>
                            {f}
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
                                <th
                                    className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer select-none hover:text-slate-600 transition-colors"
                                    onClick={() => handleSort('nombre_fantasia')}
                                >
                                    <div className="flex items-center gap-1.5">
                                        Empresa <SortIcon field="nombre_fantasia" />
                                    </div>
                                </th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest hidden md:table-cell">
                                    RUT
                                </th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest hidden lg:table-cell">
                                    Razón Social
                                </th>
                                <th
                                    className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer select-none hover:text-slate-600 transition-colors hidden xl:table-cell"
                                    onClick={() => handleSort('creado_en')}
                                >
                                    <div className="flex items-center gap-1.5">
                                        Registrado <SortIcon field="creado_en" />
                                    </div>
                                </th>
                                <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    Estado
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 bg-white">
                            {clientesFiltrados.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-16 text-slate-400">
                                        <Building2 className="w-8 h-8 mx-auto mb-3 text-slate-200" />
                                        <p className="text-sm font-medium">
                                            {search || filtroEstado !== 'todos'
                                                ? 'No hay clientes que coincidan con el filtro.'
                                                : 'Aún no hay clientes registrados.'}
                                        </p>
                                    </td>
                                </tr>
                            ) : clientesFiltrados.map((cliente, idx) => {
                                const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                                const isToggling = togglingId === cliente.id;

                                return (
                                    <tr
                                        key={cliente.id}
                                        onClick={() => router.push(`/dashboard/configuracion/clientes/${cliente.id}`)}
                                        title="Abrir panel del cliente"
                                        className="hover:bg-slate-50/70 transition-colors group cursor-pointer"
                                    >
                                        {/* Empresa */}
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                {/* Avatar / Logo */}
                                                {cliente.logo_url ? (
                                                    <img
                                                        src={cliente.logo_url} alt={cliente.nombre_fantasia}
                                                        className="w-9 h-9 rounded-xl object-contain border border-slate-200 bg-white shrink-0"
                                                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                    />
                                                ) : (
                                                    <div className={`w-9 h-9 rounded-xl ${avatarColor} flex items-center justify-center font-black text-sm shrink-0 border border-white shadow-sm`}>
                                                        {getInitials(cliente.nombre_fantasia)}
                                                    </div>
                                                )}
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-slate-800 truncate">{cliente.nombre_fantasia}</p>
                                                    <p className="text-xs text-slate-500 font-medium truncate">{cliente.razon_social || '—'}</p>
                                                </div>
                                            </div>
                                        </td>

                                        {/* RUT */}
                                        <td className="px-6 py-4 hidden md:table-cell">
                                            <div className="flex items-center gap-1.5">
                                                {cliente.rut ? (
                                                    <>
                                                        <Hash className="w-3 h-3 text-slate-300 shrink-0" />
                                                        <span className="text-sm font-mono font-medium text-slate-600">{cliente.rut}</span>
                                                    </>
                                                ) : (
                                                    <span className="text-sm text-slate-300">—</span>
                                                )}
                                            </div>
                                        </td>

                                        {/* Razón Social */}
                                        <td className="px-6 py-4 hidden lg:table-cell">
                                            <span className="text-sm font-medium text-slate-500 truncate max-w-[200px] block">
                                                {cliente.razon_social || '—'}
                                            </span>
                                        </td>

                                        {/* Registrado */}
                                        <td className="px-6 py-4 hidden xl:table-cell">
                                            <span className="text-xs font-medium text-slate-500">{formatDate(cliente.creado_en)}</span>
                                        </td>

                                        {/* Estado (toggle) */}
                                        <td className="px-6 py-4 text-center">
                                            <button
                                                onClick={e => { e.stopPropagation(); handleToggleActivo(cliente.id, cliente.activo); }}
                                                disabled={isToggling}
                                                title={cliente.activo ? 'Desactivar cliente' : 'Activar cliente'}
                                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-black uppercase tracking-wider transition-all ${
                                                    cliente.activo
                                                        ? 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200'
                                                        : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                                                } disabled:opacity-50`}
                                            >
                                                {isToggling
                                                    ? <Loader2 className="w-3 h-3 animate-spin" />
                                                    : cliente.activo
                                                        ? <ToggleRight className="w-3 h-3" />
                                                        : <ToggleLeft className="w-3 h-3" />
                                                }
                                                {cliente.activo ? 'Activo' : 'Inactivo'}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Footer tabla */}
                {clientesFiltrados.length > 0 && (
                    <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-400">
                            Mostrando {clientesFiltrados.length} de {initialClientes.length} clientes
                        </span>
                        <div className="flex items-center gap-1.5">
                            <ShieldCheck className="w-3 h-3 text-slate-400" />
                            <span className="text-xs font-medium text-slate-400">
                                Solo admins pueden crear o modificar clientes
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {modalCrear && <ModalCrear onClose={() => setModalCrear(false)} onSuccess={handleRefresh} />}
        </div>
        </>
    );
}
