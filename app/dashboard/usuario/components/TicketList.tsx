'use client';

import { createClient } from '@/lib/supabase/client';
import { Ticket } from '@/types/database.types';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MessageSquare, Search, ChevronLeft, ChevronRight, CornerDownRight, Users, User } from 'lucide-react';
import { getStatusBadge } from '@/app/dashboard/components/StatusBadge';
import { LoopLoader } from '@/components/LoopLoader';
import { motion, AnimatePresence } from 'framer-motion';

const ITEMS_PER_PAGE = 25;

type FilterType = 'TODOS' | 'PENDIENTES' | 'RESUELTOS';
type ScopeType = 'propios' | 'equipo';

const containerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.03
        }
    }
} as const;

const itemVariants = {
    hidden: { y: 12, opacity: 0 },
    show: { 
        y: 0, 
        opacity: 1,
        transition: {
            type: "spring",
            stiffness: 110,
            damping: 16
        }
    }
} as const;

export default function TicketList({ limit }: { limit?: number }) {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState<FilterType>('TODOS');
    const [scope, setScope] = useState<ScopeType>('propios');
    const [currentPage, setCurrentPage] = useState(1);
    const [isMounted, setIsMounted] = useState(false);
    const router = useRouter();

    useEffect(() => {
        setIsMounted(true);
        setCurrentPage(1);
    }, [searchTerm, filter, scope]);

    const fetchTickets = async (currentScope: ScopeType) => {
        const supabase = createClient();

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setLoading(false);
                return;
            }

            if (currentScope === 'propios') {
                const { data, error } = await supabase
                    .from('tickets')
                    .select(`
                        *,
                        restaurantes(nombre_restaurante, sigla),
                        catalogo_servicios!catalogo_servicio_id(categoria, subcategoria, elemento),
                        padre:ticket_padre_id(numero_ticket)
                    `)
                    .eq('creado_por', user.id)
                    .order('fecha_creacion', { ascending: false });

                if (error) {
                    console.error('Error al cargar tickets:', error);
                } else {
                    setTickets(data || []);
                }
            } else {
                // scope === 'equipo': buscar todos los usuarios del mismo cliente
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('cliente_id')
                    .eq('id', user.id)
                    .maybeSingle();

                const clienteId = (profile as any)?.cliente_id ?? null;

                if (!clienteId) {
                    // Sin empresa asignada, mostrar solo los propios
                    const { data, error } = await supabase
                        .from('tickets')
                        .select(`
                            *,
                            restaurantes(nombre_restaurante, sigla),
                            catalogo_servicios!catalogo_servicio_id(categoria, subcategoria, elemento),
                            padre:ticket_padre_id(numero_ticket),
                            profiles:creado_por(full_name)
                        `)
                        .eq('creado_por', user.id)
                        .order('fecha_creacion', { ascending: false });

                    if (!error) setTickets(data || []);
                    return;
                }

                // Obtener todos los usuarios del mismo cliente
                const { data: companyProfiles } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('cliente_id', clienteId);

                const userIds = (companyProfiles || []).map((p: any) => p.id);

                if (userIds.length === 0) {
                    setTickets([]);
                    return;
                }

                const { data, error } = await supabase
                    .from('tickets')
                    .select(`
                        *,
                        restaurantes(nombre_restaurante, sigla),
                        catalogo_servicios!catalogo_servicio_id(categoria, subcategoria, elemento),
                        padre:ticket_padre_id(numero_ticket),
                        profiles:creado_por(full_name)
                    `)
                    .in('creado_por', userIds)
                    .order('fecha_creacion', { ascending: false });

                if (error) {
                    console.error('Error al cargar tickets del equipo:', error);
                } else {
                    setTickets(data || []);
                }
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setLoading(true);
        fetchTickets(scope);

        const supabase = createClient();
        const channel = supabase
            .channel(`custom-all-channel-user-list-${scope}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'tickets' },
                () => { fetchTickets(scope); }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [scope]);

    const getPriorityBadge = (priority: Ticket['prioridad']) => {
        const p = priority?.toLowerCase() || 'baja';
        const dotClass = (pr: string) => {
            if (pr === 'alta') return 'bg-orange-500';
            if (pr === 'crítica') return 'bg-red-500';
            if (pr === 'media') return 'bg-blue-500';
            return 'bg-emerald-500';
        };
        const bgClass = (pr: string) => {
            if (pr === 'alta') return 'bg-orange-50/70 border-orange-200/50 text-orange-700';
            if (pr === 'crítica') return 'bg-red-50/70 border-red-200/50 text-red-700';
            if (pr === 'media') return 'bg-blue-50/70 border-blue-200/50 text-blue-700';
            return 'bg-emerald-50/70 border-emerald-200/50 text-emerald-700';
        };
        const label = p.charAt(0).toUpperCase() + p.slice(1);
        return (
            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-extrabold tracking-wider uppercase shadow-sm ${bgClass(p)}`}>
                <span className="relative flex h-2 w-2">
                    {p === 'crítica' && (
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    )}
                    {p === 'alta' && (
                        <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                    )}
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${dotClass(p)}`} />
                </span>
                {label}
            </span>
        );
    };

    const processedTickets = useMemo(() => {
        let filtered = tickets.filter(ticket => {
            if (filter === 'TODOS') return true;
            if (filter === 'PENDIENTES') return !['anulado', 'resuelto', 'cerrado'].includes(ticket.estado);
            if (filter === 'RESUELTOS') return ['anulado', 'resuelto', 'cerrado'].includes(ticket.estado);
            return true;
        });

        if (searchTerm.trim()) {
            const lowerSearch = searchTerm.toLowerCase();
            filtered = filtered.filter(ticket => {
                const matchId = ticket.id.toLowerCase().includes(lowerSearch) || `nc-${ticket.numero_ticket}`.includes(lowerSearch) || String(ticket.numero_ticket).includes(lowerSearch);
                const matchTitle = (ticket.titulo || '').toLowerCase().includes(lowerSearch);
                const matchDesc = (ticket.descripcion || '').toLowerCase().includes(lowerSearch);
                const matchRestaurante = (ticket.restaurantes?.nombre_restaurante || '').toLowerCase().includes(lowerSearch);
                const matchSigla = (ticket.restaurantes?.sigla || '').toLowerCase().includes(lowerSearch);
                const matchCreador = ((ticket.profiles as any)?.full_name || '').toLowerCase().includes(lowerSearch);
                return matchId || matchTitle || matchDesc || matchRestaurante || matchSigla || matchCreador;
            });
        }

        return filtered;
    }, [tickets, searchTerm, filter]);

    const totalPages = Math.ceil(processedTickets.length / ITEMS_PER_PAGE);

    const paginatedTickets = useMemo(() => {
        const effectiveList = limit && !searchTerm ? processedTickets.slice(0, limit) : processedTickets;
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return effectiveList.slice(start, start + ITEMS_PER_PAGE);
    }, [processedTickets, currentPage, limit, searchTerm]);

    if (!isMounted) return null;

    if (loading) {
        return <LoopLoader text="Cargando Tickets..." />;
    }

    return (
        <div className="bg-white/70 backdrop-blur-md shadow-lg rounded-3xl overflow-hidden border border-slate-200/40 w-full mt-4">
            {/* Header / Controles Principales */}
            <div className="p-5 border-b border-slate-100 flex flex-col bg-white/40 gap-4 w-full">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 w-full">
                    {/* Título + Segmented Control de Alcance */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-2 whitespace-nowrap tracking-tight">
                            {scope === 'propios' ? 'Mis Tickets' : 'Tickets del Equipo'}
                            <span className="bg-[#0e3187]/10 text-[#0e3187] text-xs font-black px-2.5 py-0.5 rounded-full border border-[#0e3187]/15">
                                {processedTickets.length}
                            </span>
                        </h3>

                        {/* Segmented Control */}
                        <div className="flex p-1.5 rounded-2xl bg-slate-100/80 border border-slate-200/50 shadow-inner w-fit relative overflow-hidden">
                            <button
                                onClick={() => setScope('propios')}
                                className="relative flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-black focus:outline-none cursor-pointer"
                            >
                                <span className={`relative z-10 flex items-center gap-1.5 transition-colors ${scope === 'propios' ? 'text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
                                    <User className="w-3.5 h-3.5" strokeWidth={2} />
                                    Mis Tickets
                                </span>
                                {scope === 'propios' && (
                                    <motion.div
                                        layoutId="activeScopePill"
                                        className="absolute inset-0 bg-white rounded-xl shadow-sm border border-slate-200/60"
                                        transition={{ type: "spring", stiffness: 350, damping: 25 }}
                                    />
                                )}
                            </button>
                            <button
                                onClick={() => setScope('equipo')}
                                className="relative flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-black focus:outline-none cursor-pointer"
                            >
                                <span className={`relative z-10 flex items-center gap-1.5 transition-colors ${scope === 'equipo' ? 'text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
                                    <Users className="w-3.5 h-3.5" strokeWidth={2} />
                                    Mi Equipo
                                </span>
                                {scope === 'equipo' && (
                                    <motion.div
                                        layoutId="activeScopePill"
                                        className="absolute inset-0 bg-white rounded-xl shadow-sm border border-slate-200/60"
                                        transition={{ type: "spring", stiffness: 350, damping: 25 }}
                                    />
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Barra de Búsqueda */}
                    <div className="relative w-full lg:max-w-md group">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#0e3187] transition-colors">
                            <Search className="h-4 w-4" strokeWidth={2} />
                        </div>
                        <input
                            type="text"
                            placeholder={scope === 'equipo' ? 'Buscar por ID, título, descripción, restaurante o creador…' : 'Buscar por ID (NC-XX), título, descripción o restaurante…'}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-2xl leading-5 bg-slate-50/50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-4 focus:ring-[#0e3187]/10 focus:border-[#0e3187] text-[15px] sm:text-sm transition-all font-semibold shadow-inner"
                        />
                    </div>
                </div>

                {/* Filtros de Estado (Tabs) */}
                <div className="flex p-1.5 rounded-2xl bg-slate-100/80 border border-slate-200/50 shadow-inner mt-1 sm:mt-0 relative overflow-hidden">
                    <div className="flex space-x-1 min-w-max w-full">
                        <button 
                            onClick={() => setFilter('TODOS')} 
                            className="relative flex-1 px-6 py-2 rounded-xl text-xs font-black focus:outline-none cursor-pointer"
                        >
                            <span className={`relative z-10 transition-colors ${filter === 'TODOS' ? 'text-[#0e3187]' : 'text-slate-500 hover:text-slate-800'}`}>
                                Todos
                            </span>
                            {filter === 'TODOS' && (
                                <motion.div
                                    layoutId="activeFilterPill"
                                    className="absolute inset-0 bg-white rounded-xl shadow-sm border border-slate-200/60"
                                    transition={{ type: "spring", stiffness: 350, damping: 25 }}
                                />
                            )}
                        </button>
                        <button 
                            onClick={() => setFilter('PENDIENTES')} 
                            className="relative flex-1 px-6 py-2 rounded-xl text-xs font-black focus:outline-none cursor-pointer"
                        >
                            <span className={`relative z-10 transition-colors ${filter === 'PENDIENTES' ? 'text-amber-700' : 'text-slate-500 hover:text-slate-800'}`}>
                                Pendientes
                            </span>
                            {filter === 'PENDIENTES' && (
                                <motion.div
                                    layoutId="activeFilterPill"
                                    className="absolute inset-0 bg-white rounded-xl shadow-sm border border-slate-200/60"
                                    transition={{ type: "spring", stiffness: 350, damping: 25 }}
                                />
                            )}
                        </button>
                        <button 
                            onClick={() => setFilter('RESUELTOS')} 
                            className="relative flex-1 px-6 py-2 rounded-xl text-xs font-black focus:outline-none cursor-pointer"
                        >
                            <span className={`relative z-10 transition-colors ${filter === 'RESUELTOS' ? 'text-emerald-700' : 'text-slate-500 hover:text-slate-800'}`}>
                                Resueltos
                            </span>
                            {filter === 'RESUELTOS' && (
                                <motion.div
                                    layoutId="activeFilterPill"
                                    className="absolute inset-0 bg-white rounded-xl shadow-sm border border-slate-200/60"
                                    transition={{ type: "spring", stiffness: 350, damping: 25 }}
                                />
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* VISTA DE ESCRITORIO (Tabla) */}
            <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100/50 table-fixed">
                    <thead className="bg-slate-50/70 border-b border-slate-200/50">
                        <tr>
                            <th scope="col" className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest w-[16%]">ID / Fecha</th>
                            <th scope="col" className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest w-[38%]">Asunto / Clasificación</th>
                            {scope === 'equipo' && (
                                <th scope="col" className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest w-[16%]">Usuario</th>
                            )}
                            <th scope="col" className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest w-[14%]">Restaurante</th>
                            <th scope="col" className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest w-[14%]">Prioridad</th>
                            <th scope="col" className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Estado</th>
                        </tr>
                    </thead>
                    <motion.tbody 
                        key={`${filter}-${scope}-${searchTerm}-${currentPage}`}
                        variants={containerVariants}
                        initial="hidden"
                        animate="show"
                        className="bg-white/40 divide-y divide-slate-100/60"
                    >
                        {paginatedTickets.length === 0 ? (
                            <tr>
                                <td colSpan={scope === 'equipo' ? 6 : 5} className="px-6 py-12 text-center text-slate-400">
                                    <div className="flex flex-col items-center justify-center py-6">
                                        <MessageSquare className="w-12 h-12 text-slate-400 mb-3" strokeWidth={1.5} />
                                        <p className="text-slate-500 font-bold text-sm">No hay tickets en esta vista.</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            paginatedTickets.map((ticket) => (
                                <motion.tr
                                    key={ticket.id}
                                    layout="position"
                                    variants={itemVariants}
                                    onClick={() => router.push(`/dashboard/ticket/${ticket.id}`)}
                                    className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                                >
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex flex-col">
                                            <div className="text-xs font-bold tracking-wider mb-1">
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-xl bg-[#0e3187] text-white text-xs font-black tracking-wide shadow-sm group-hover:scale-105 transition-transform duration-200 ease-out">
                                                    NC-{ticket.numero_ticket}
                                                </span>
                                            </div>
                                            {ticket.ticket_padre_id && ticket.padre && (
                                                <Link
                                                    href={`/dashboard/ticket/${ticket.ticket_padre_id}`}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-[#0e3187] transition-colors font-bold mb-1 w-max"
                                                >
                                                    <CornerDownRight className="w-3.5 h-3.5 text-slate-400" />
                                                    ↳ Adicional de NC-{ticket.padre.numero_ticket}
                                                </Link>
                                            )}
                                            <div className="text-[11px] text-slate-400 font-bold mt-1">
                                                {new Date(ticket.fecha_creacion).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                            </div>
                                        </div>
                                    </td>

                                    <td className="px-6 py-4 max-w-0">
                                        <div className="relative group/titulo mb-1.5">
                                            <div className="font-extrabold text-slate-900 group-hover:text-[#0e3187] transition-colors truncate text-sm" title={ticket.titulo}>
                                                {ticket.titulo}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold whitespace-nowrap overflow-hidden text-ellipsis">
                                            {ticket.catalogo_servicios && (
                                                <>
                                                    <span className="truncate max-w-[120px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg border border-slate-200/40" title={ticket.catalogo_servicios.categoria}>
                                                        {ticket.catalogo_servicios.categoria}
                                                    </span>
                                                    <ChevronRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                                    <span className="truncate max-w-[120px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-lg border border-slate-200/40 font-bold" title={ticket.catalogo_servicios.subcategoria}>
                                                        {ticket.catalogo_servicios.subcategoria}
                                                    </span>
                                                    <ChevronRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                                    <span className="truncate max-w-[140px] text-slate-500 font-medium" title={ticket.catalogo_servicios.elemento}>
                                                        {ticket.catalogo_servicios.elemento}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </td>

                                    {scope === 'equipo' && (
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {(ticket.profiles as any)?.full_name ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="h-7 w-7 rounded-full bg-[#0e3187]/10 text-[#0e3187] flex items-center justify-center font-black text-xs shrink-0 ring-1 ring-[#0e3187]/20">
                                                        {(ticket.profiles as any).full_name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className="text-xs font-bold text-slate-700 truncate max-w-[130px]" title={(ticket.profiles as any).full_name}>
                                                        {(ticket.profiles as any).full_name}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400 font-bold">—</span>
                                            )}
                                        </td>
                                    )}

                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {ticket.restaurantes?.sigla ? (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-black tracking-widest bg-slate-50 text-slate-700 border border-slate-200">
                                                📍 {ticket.restaurantes.sigla}
                                            </span>
                                        ) : ticket.restaurantes?.nombre_restaurante ? (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-black tracking-widest bg-slate-50 text-slate-700 border border-slate-200" title={ticket.restaurantes.nombre_restaurante}>
                                                📍 {ticket.restaurantes.nombre_restaurante.substring(0, 4).toUpperCase()}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-slate-400 font-bold">-</span>
                                        )}
                                    </td>

                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {getPriorityBadge(ticket.prioridad)}
                                    </td>

                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {getStatusBadge(ticket.estado)}
                                    </td>
                                </motion.tr>
                            ))
                        )}
                    </motion.tbody>
                </table>
            </div>

            {/* VISTA MÓVIL (Tarjetas) */}
            <motion.div 
                key={`${filter}-${scope}-${searchTerm}-${currentPage}-mobile`}
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="md:hidden flex flex-col p-4 bg-slate-50/50 border-t border-slate-200/50 gap-4"
            >
                {paginatedTickets.length === 0 ? (
                    <div className="px-6 py-12 text-center text-slate-400 bg-white rounded-3xl border border-slate-200 shadow-sm">
                        <div className="flex flex-col items-center justify-center py-6">
                            <MessageSquare className="w-12 h-12 text-slate-400 mb-3" strokeWidth={1.5} />
                            <p className="text-slate-500 font-bold text-sm">No hay tickets en esta vista.</p>
                        </div>
                    </div>
                ) : (
                    paginatedTickets.map((ticket) => (
                        <motion.div
                            key={ticket.id}
                            layout="position"
                            variants={itemVariants}
                            onClick={() => router.push(`/dashboard/ticket/${ticket.id}`)}
                            className={`p-5 bg-white border border-slate-150 border-l-4 rounded-3xl shadow-sm hover:shadow-md hover:border-slate-200 active:bg-slate-50 transition-all duration-300 cursor-pointer flex flex-col gap-3.5 relative overflow-hidden ${
                                ticket.prioridad === 'crítica' ? 'border-l-red-500' :
                                ticket.prioridad === 'alta' ? 'border-l-orange-500' :
                                ticket.prioridad === 'media' ? 'border-l-blue-500' :
                                'border-l-emerald-500'
                            }`}
                        >
                            {/* Fila 1: Header con ID */}
                            <div className="flex justify-between items-start gap-2">
                                <div className="flex flex-col min-w-0">
                                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-xl bg-slate-800 text-white text-[10px] font-black tracking-widest shadow-sm">
                                            NC-{ticket.numero_ticket}
                                        </span>
                                        {scope === 'equipo' && (ticket.profiles as any)?.full_name && (
                                            <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200/50">
                                                <User className="w-3 h-3 text-[#0e3187]" />
                                                {(ticket.profiles as any).full_name}
                                            </span>
                                        )}
                                    </div>
                                    {ticket.ticket_padre_id && ticket.padre && (
                                        <Link
                                            href={`/dashboard/ticket/${ticket.ticket_padre_id}`}
                                            onClick={(e) => e.stopPropagation()}
                                            className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-[#0e3187] transition-colors font-bold w-max bg-slate-50 px-2 py-0.5 rounded"
                                        >
                                            <CornerDownRight className="w-3 h-3 text-slate-400" />
                                            ↳ Adicional de NC-{ticket.padre.numero_ticket}
                                        </Link>
                                    )}
                                </div>
                                <div className="text-[10px] sm:text-[11px] text-slate-400 font-bold whitespace-nowrap pt-1">
                                    {new Date(ticket.fecha_creacion).toLocaleDateString()}
                                </div>
                            </div>

                            {/* Fila 2: Título */}
                            <div className="font-extrabold text-sm sm:text-base text-slate-900 leading-snug break-words">
                                {ticket.titulo}
                            </div>

                            {/* Fila 3: Ubicación y Categoría */}
                            <div className="flex flex-col gap-2 text-[11px] text-slate-550">
                                {ticket.restaurantes?.nombre_restaurante && (
                                    <span className="font-extrabold text-slate-700 flex items-center gap-1.5 bg-slate-50 border border-slate-200/60 px-2.5 py-1 w-max rounded-xl text-[10px] tracking-wider uppercase">
                                        📍 {ticket.restaurantes.nombre_restaurante}
                                    </span>
                                )}
                                {ticket.catalogo_servicios && (
                                    <span className="font-semibold text-slate-500 flex items-center gap-1.5 mt-0.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-400" /> {ticket.catalogo_servicios.categoria} &rsaquo; <span className="text-slate-800 font-extrabold">{ticket.catalogo_servicios.subcategoria}</span>
                                    </span>
                                )}
                            </div>

                            {/* Fila 4: Badges */}
                            <div className="flex flex-wrap items-center justify-between gap-3 mt-1.5 pt-3.5 border-t border-slate-100">
                                <div className="flex flex-wrap gap-2 items-center">
                                    {getPriorityBadge(ticket.prioridad)}
                                </div>
                                <div className="shrink-0 flex items-center justify-end">
                                    {getStatusBadge(ticket.estado)}
                                </div>
                            </div>
                        </motion.div>
                    ))
                )}
            </motion.div>

            {/* Pagination */}
            {(!limit || searchTerm) && totalPages > 1 && (
                <div className="px-6 py-4.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <button
                        onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        disabled={currentPage === 1}
                        className="inline-flex items-center px-4 py-2 border border-slate-200 shadow-sm text-xs font-bold rounded-xl text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                    >
                        <ChevronLeft className="h-4 w-4 mr-1.5" />
                        Anterior
                    </button>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                        Página {currentPage} de {totalPages}
                    </span>
                    <button
                        onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        disabled={currentPage === totalPages}
                        className="inline-flex items-center px-4 py-2 border border-slate-200 shadow-sm text-xs font-bold rounded-xl text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                    >
                        Siguiente
                        <ChevronRight className="h-4 w-4 ml-1.5" />
                    </button>
                </div>
            )}

            {limit && tickets.length > limit && !searchTerm && (
                <div className="p-4 border-t border-slate-100 bg-slate-50/30 text-center">
                    <button onClick={() => router.push('/dashboard/usuario/tickets')} className="text-sm font-extrabold text-[#0e3187] hover:text-[#1846b9] transition-colors focus:outline-none cursor-pointer">
                        Ver todos los tickets &rarr;
                    </button>
                </div>
            )}
        </div>
    );
}
