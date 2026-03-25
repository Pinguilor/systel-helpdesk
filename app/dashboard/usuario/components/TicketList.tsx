'use client';

import { createClient } from '@/lib/supabase/client';
import { Ticket } from '@/types/database.types';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MessageSquare, Search, ChevronLeft, ChevronRight, CornerDownRight } from 'lucide-react';
import { LoopLoader } from '@/components/LoopLoader';

const ITEMS_PER_PAGE = 25;

type FilterType = 'TODOS' | 'PENDIENTES' | 'RESUELTOS';

export default function TicketList({ limit }: { limit?: number }) {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState<FilterType>('TODOS');
    const [currentPage, setCurrentPage] = useState(1);
    const [isMounted, setIsMounted] = useState(false);
    const router = useRouter();

    // Reset pagination when search term or filter changes
    useEffect(() => {
        setIsMounted(true);
        setCurrentPage(1);
    }, [searchTerm, filter]);

    const fetchTickets = async () => {
        const supabase = createClient();

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setLoading(false);
                return;
            }

            const { data, error } = await supabase
                .from('tickets')
                .select(`
                    *, 
                    restaurantes(nombre_restaurante, sigla), 
                    catalogo_servicios(categoria, subcategoria, elemento),
                    padre:ticket_padre_id(numero_ticket)
                `)
                .eq('creado_por', user.id)
                .order('fecha_creacion', { ascending: false });

            if (error) {
                console.error('Error al cargar tickets:', error);
            } else {
                setTickets(data || []);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTickets();

        const supabase = createClient();
        const channel = supabase
            .channel('custom-all-channel-user-list')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'tickets' },
                () => {
                    fetchTickets();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const getStatusBadge = (status: Ticket['estado']) => {
        switch (status) {
            case 'abierto': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] uppercase tracking-wider font-bold bg-sky-100 text-sky-700 border border-sky-200 shadow-sm whitespace-nowrap">Abierto</span>;
            case 'en_progreso': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] uppercase tracking-wider font-bold bg-indigo-100 text-indigo-700 border border-indigo-200 shadow-sm whitespace-nowrap">En Progreso</span>;
            case 'resuelto': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] uppercase tracking-wider font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 shadow-sm whitespace-nowrap">Resuelto</span>;
            case 'cerrado': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] uppercase tracking-wider font-bold bg-gray-100 text-gray-600 border border-gray-200 shadow-sm whitespace-nowrap">Cerrado</span>;
            case 'anulado': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] uppercase tracking-wider font-bold bg-red-100 text-red-700 border border-red-200 shadow-sm whitespace-nowrap ring-1 ring-red-300">Anulado</span>;
            case 'pendiente': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] uppercase tracking-wider font-bold bg-orange-100 text-orange-700 border border-orange-200 shadow-sm whitespace-nowrap">Pendiente</span>;
            case 'programado': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] uppercase tracking-wider font-bold bg-purple-100 text-purple-700 border border-purple-200 shadow-sm whitespace-nowrap">Programado</span>;
            case 'esperando_agente': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] uppercase tracking-wider font-bold bg-slate-100 text-slate-600 border border-slate-200 shadow-sm whitespace-nowrap">Sin Asignar</span>;
            default: return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] uppercase tracking-wider font-bold bg-gray-100 text-gray-600 whitespace-nowrap">{status}</span>;
        }
    }

    const getPriorityBadge = (priority: Ticket['prioridad']) => {
        switch (priority) {
            case 'alta': return <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] sm:text-[10px] uppercase tracking-wide font-black bg-white text-red-600 border border-red-200 shadow-sm">Alta</span>;
            case 'crítica': return <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] sm:text-[10px] uppercase tracking-wide font-black bg-white text-purple-700 border border-purple-200 shadow-sm">Crítica</span>;
            case 'media': return <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] sm:text-[10px] uppercase tracking-wide font-black bg-white text-amber-600 border border-amber-200 shadow-sm">Media</span>;
            case 'baja': return <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] sm:text-[10px] uppercase tracking-wide font-black bg-white text-blue-600 border border-blue-200 shadow-sm">Baja</span>;
            default: return <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] sm:text-[10px] uppercase tracking-wide font-black bg-gray-100 text-gray-700 border border-gray-200 shadow-sm">{priority}</span>;
        }
    };

    const renderSlaBadge = (ticket: Ticket) => {
        const dbSlaStatus = (ticket as any).slaStatus;
        if (dbSlaStatus) {
            const statusStr = String(dbSlaStatus).toLowerCase();
            if (statusStr.includes('incumplido')) {
                return <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold bg-red-100 text-red-700 tracking-wide uppercase whitespace-nowrap">{dbSlaStatus}</span>;
            } else if (statusStr.includes('cumplido')) {
                return <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold bg-green-100 text-green-700 tracking-wide uppercase whitespace-nowrap">{dbSlaStatus}</span>;
            }
            return <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold bg-gray-100 text-gray-700 tracking-wide uppercase whitespace-nowrap">{dbSlaStatus}</span>;
        }

        if (!ticket.vencimiento_sla) return null;

        const isResolved = ticket.estado === 'resuelto' || ticket.estado === 'cerrado' || ticket.estado === 'anulado';
        const sla = new Date(ticket.vencimiento_sla);

        if (isResolved) {
            let resolutionDate = new Date(ticket.actualizado_en);
            if (ticket.fecha_resolucion) {
                resolutionDate = new Date(ticket.fecha_resolucion);
            }
            return resolutionDate <= sla
                ? <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold bg-green-100 text-green-700 tracking-wide uppercase whitespace-nowrap">SLA Cumplido</span>
                : <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold bg-red-100 text-red-700 tracking-wide uppercase whitespace-nowrap">SLA Incumplido</span>;
        }

        const diffHours = (sla.getTime() - new Date().getTime()) / (1000 * 60 * 60);
        if (diffHours < 0) return <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold bg-red-100 text-red-700 tracking-wide uppercase whitespace-nowrap">Vencido hace {Math.abs(Math.round(diffHours))}h</span>;
        if (diffHours <= 12) return <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold bg-orange-100 text-orange-700 tracking-wide uppercase whitespace-nowrap">Vence en {Math.round(diffHours)}h</span>;
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold bg-green-100 text-green-700 tracking-wide uppercase whitespace-nowrap">Vence en {Math.round(diffHours)}h</span>;
    };

    const processedTickets = useMemo(() => {
        // 1. Filter by Status Tab
        let filtered = tickets.filter(ticket => {
            if (filter === 'TODOS') return true;
            if (filter === 'PENDIENTES') return !['anulado', 'resuelto', 'cerrado'].includes(ticket.estado);
            if (filter === 'RESUELTOS') return ['anulado', 'resuelto', 'cerrado'].includes(ticket.estado);
            return true;
        });

        // 2. Filter by Search Term
        if (searchTerm.trim()) {
            const lowerSearch = searchTerm.toLowerCase();
            filtered = filtered.filter(ticket => {
                const matchId = ticket.id.toLowerCase().includes(lowerSearch) || `nc-${ticket.numero_ticket}`.includes(lowerSearch) || String(ticket.numero_ticket).includes(lowerSearch);
                const matchTitle = (ticket.titulo || '').toLowerCase().includes(lowerSearch);
                const matchDesc = (ticket.descripcion || '').toLowerCase().includes(lowerSearch);
                const matchRestaurante = (ticket.restaurantes?.nombre_restaurante || '').toLowerCase().includes(lowerSearch);
                return matchId || matchTitle || matchDesc || matchRestaurante;
            });
        }

        return filtered;
    }, [tickets, searchTerm, filter]);

    const totalPages = Math.ceil(processedTickets.length / ITEMS_PER_PAGE);

    // Instead of completely slicing limit (which was for the mini-widget version), now we prioritize full Pagination view.
    const paginatedTickets = useMemo(() => {
        // If "limit" is passed, it means it's a very constrained widget. 
        // But the user requested generic paginated view with 40 globally.
        const effectiveList = limit && !searchTerm ? processedTickets.slice(0, limit) : processedTickets;
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return effectiveList.slice(start, start + ITEMS_PER_PAGE);
    }, [processedTickets, currentPage, limit, searchTerm]);

    if (!isMounted) return null;

    if (loading) {
        return <LoopLoader text="Cargando Tickets..." />;
    }

    return (
        <div className="bg-white shadow-md rounded-xl overflow-hidden border border-slate-200 w-full mt-2">
            {/* Header / Controles Principales (Visible Móvil y Desktop) */}
            <div className="p-4 sm:p-5 border-b border-gray-200 flex flex-col bg-white gap-4 w-full">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 w-full">
                    {/* Título y Badge */}
                    <div className="flex items-center gap-2">
                        <h3 className="text-xl font-black text-slate-800 flex items-center gap-2 whitespace-nowrap tracking-tight">
                            Mis Tickets
                            <span className="bg-brand-primary/10 text-brand-primary text-xs font-bold px-2.5 py-1 rounded-full border border-brand-primary/20">
                                {processedTickets.length}
                            </span>
                        </h3>
                    </div>

                    {/* Barra de Búsqueda de Ancho Completo */}
                    <div className="relative w-full lg:max-w-md">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar por ID (NC-XX), título o descripción"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="block w-full pl-10 pr-3 py-2.5 sm:py-2 border border-slate-300 rounded-xl leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-primary focus:border-brand-primary text-[15px] sm:text-sm transition-all shadow-sm"
                        />
                    </div>
                </div>

                {/* Filtros Estrictos (Tabs) */}
                <div className="flex overflow-x-auto w-full p-1 sm:p-1.5 rounded-xl bg-slate-100 border border-slate-200 shadow-inner mt-1 sm:mt-0">
                    <div className="flex space-x-1 min-w-max w-full">
                        <button onClick={() => setFilter('TODOS')} className={`flex-1 px-4 sm:px-6 py-2 rounded-lg text-sm font-bold transition-all ${filter === 'TODOS' ? 'bg-white text-brand-primary shadow-sm ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'}`}>Todos</button>
                        <button onClick={() => setFilter('PENDIENTES')} className={`flex-1 px-4 sm:px-6 py-2 rounded-lg text-sm font-bold transition-all ${filter === 'PENDIENTES' ? 'bg-white text-amber-600 shadow-sm ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'}`}>Pendientes</button>
                        <button onClick={() => setFilter('RESUELTOS')} className={`flex-1 px-4 sm:px-6 py-2 rounded-lg text-sm font-bold transition-all ${filter === 'RESUELTOS' ? 'bg-white text-emerald-600 shadow-sm ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'}`}>Resueltos</button>
                    </div>
                </div>
            </div>

            {/* VISTA DE ESCRITORIO (Tabla clásica) */}
            <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50/50">
                        <tr>
                            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-[15%]">ID / Fecha</th>
                            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-[40%]">Asunto</th>
                            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-[15%]">Restaurante</th>
                            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-[15%]">Prioridad</th>
                            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                        {paginatedTickets.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                    <div className="flex flex-col items-center justify-center">
                                        <MessageSquare className="w-12 h-12 text-gray-300 mb-3" />
                                        <p className="text-gray-500">No hay tickets en esta vista.</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            paginatedTickets.map((ticket) => (
                                <tr
                                    key={ticket.id}
                                    onClick={() => router.push(`/dashboard/ticket/${ticket.id}`)}
                                    className="hover:bg-slate-50 transition-colors cursor-pointer group"
                                >
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex flex-col">
                                            <div className="text-xs font-bold tracking-wider mb-1">
                                                <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-700 text-white text-xs font-semibold tracking-wide shadow-sm">
                                                    NC-{ticket.numero_ticket}
                                                </span>
                                            </div>
                                            {ticket.ticket_padre_id && ticket.padre && (
                                                <Link 
                                                    href={`/dashboard/ticket/${ticket.ticket_padre_id}`}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="inline-flex items-center gap-1.5 text-[10px] text-slate-500 hover:text-indigo-600 transition-colors font-medium mb-1 w-max"
                                                >
                                                    <CornerDownRight className="w-3 h-3 text-slate-400" />
                                                    ↳ Adicional de NC-{ticket.padre.numero_ticket}
                                                </Link>
                                            )}
                                            <div className="text-[11px] text-gray-500 font-medium">
                                                {new Date(ticket.fecha_creacion).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </td>

                                    <td className="px-6 py-4">
                                        <div className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors line-clamp-1 mb-1.5">
                                            {ticket.titulo}
                                        </div>
                                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                                            {ticket.catalogo_servicios && (
                                                <>
                                                    <span className="truncate max-w-[100px]" title={ticket.catalogo_servicios.categoria}>
                                                        {ticket.catalogo_servicios.categoria}
                                                    </span>
                                                    <ChevronRight className="w-3 h-3 text-slate-300 flex-shrink-0" />
                                                    <span className="truncate max-w-[100px]" title={ticket.catalogo_servicios.subcategoria}>
                                                        {ticket.catalogo_servicios.subcategoria}
                                                    </span>
                                                    <ChevronRight className="w-3 h-3 text-slate-300 flex-shrink-0" />
                                                    <span className="truncate max-w-[120px] text-slate-700 font-semibold" title={ticket.catalogo_servicios.elemento}>
                                                        {ticket.catalogo_servicios.elemento}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </td>

                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {ticket.restaurantes?.sigla ? (
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black tracking-widest bg-slate-100 text-slate-700 border border-slate-200">
                                                {ticket.restaurantes.sigla}
                                            </span>
                                        ) : ticket.restaurantes?.nombre_restaurante ? (
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black tracking-widest bg-slate-100 text-slate-700 border border-slate-200" title={ticket.restaurantes.nombre_restaurante}>
                                                {ticket.restaurantes.nombre_restaurante.substring(0, 4).toUpperCase()}
                                            </span>
                                        ) : (
                                            <span className="text-sm text-slate-400 font-medium">-</span>
                                        )}
                                    </td>

                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {getPriorityBadge(ticket.prioridad)}
                                    </td>

                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {getStatusBadge(ticket.estado)}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* VISTA MÓVIL (Tarjetas independientes) */}
            <div className="md:hidden flex flex-col p-4 bg-slate-50/50 border-t border-slate-200 gap-4">
                {paginatedTickets.length === 0 ? (
                    <div className="px-6 py-12 text-center text-gray-500 bg-white rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex flex-col items-center justify-center">
                            <MessageSquare className="w-12 h-12 text-gray-300 mb-3" />
                            <p className="text-gray-500 font-medium">No hay tickets en esta vista.</p>
                        </div>
                    </div>
                ) : (
                    paginatedTickets.map((ticket) => (
                        <div
                            key={ticket.id}
                            onClick={() => router.push(`/dashboard/ticket/${ticket.id}`)}
                            className="p-4 sm:p-5 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md active:bg-slate-50 transition-all cursor-pointer flex flex-col gap-3"
                        >
                            {/* Fila 1: Header con ID */}
                            <div className="flex justify-between items-start gap-2">
                                <div className="flex flex-col min-w-0">
                                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-800 text-white text-[10px] font-black tracking-widest shadow-sm">
                                            NC-{ticket.numero_ticket}
                                        </span>
                                    </div>
                                    {ticket.ticket_padre_id && ticket.padre && (
                                        <Link 
                                            href={`/dashboard/ticket/${ticket.ticket_padre_id}`}
                                            onClick={(e) => e.stopPropagation()}
                                            className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-indigo-600 transition-colors font-bold w-max bg-slate-50 px-1.5 py-0.5 rounded"
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
                            <div className="font-extrabold text-sm sm:text-base text-slate-900 leading-snug break-words mt-1">
                                {ticket.titulo}
                            </div>

                            {/* Fila 3: Ubicación y Categoría */}
                            <div className="flex flex-col gap-1.5 text-[11px] text-slate-500">
                                {ticket.restaurantes?.nombre_restaurante && (
                                    <span className="font-bold text-slate-700 flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 w-max rounded-lg border border-slate-100">
                                        📍 {ticket.restaurantes.nombre_restaurante}
                                    </span>
                                )}
                                {ticket.catalogo_servicios && (
                                    <span className="font-medium text-slate-600 flex items-center gap-1.5 mt-0.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div> {ticket.catalogo_servicios.categoria} &rsaquo; <span className="text-slate-800 font-bold">{ticket.catalogo_servicios.subcategoria}</span>
                                    </span>
                                )}
                            </div>

                            {/* Fila 4: Badges Consolidados */}
                            <div className="flex flex-wrap items-center justify-between gap-3 mt-1.5 pt-3 border-t border-slate-100">
                                <div className="flex flex-wrap gap-2 items-center">
                                    {getPriorityBadge(ticket.prioridad)}
                                    {renderSlaBadge(ticket)}
                                </div>
                                <div className="shrink-0 flex items-center justify-end">
                                    {getStatusBadge(ticket.estado)}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Pagination Controls / View All Switch */}
            {(!limit || searchTerm) && totalPages > 1 && (
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                    <button
                        onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        disabled={currentPage === 1}
                        className="inline-flex items-center px-4 py-2 border border-slate-300 shadow-sm text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        <ChevronLeft className="h-4 w-4 mr-1.5" />
                        Anterior
                    </button>
                    <span className="text-sm text-slate-600 font-medium">
                        Página {currentPage} de {totalPages}
                    </span>
                    <button
                        onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        disabled={currentPage === totalPages}
                        className="inline-flex items-center px-4 py-2 border border-slate-300 shadow-sm text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        Siguiente
                        <ChevronRight className="h-4 w-4 ml-1.5" />
                    </button>
                </div>
            )}

            {limit && tickets.length > limit && !searchTerm && (
                <div className="p-4 border-t border-gray-100 bg-gray-50/50 text-center">
                    <button onClick={() => router.push('/dashboard/usuario/tickets')} className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors">
                        Ver todos los tickets &rarr;
                    </button>
                </div>
            )}
        </div>
    );
}
