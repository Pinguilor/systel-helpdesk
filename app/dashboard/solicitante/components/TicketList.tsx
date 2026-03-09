'use client';

import { createClient } from '@/lib/supabase/client';
import { Ticket } from '@/types/database.types';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, Search, ChevronLeft, ChevronRight } from 'lucide-react';

const ITEMS_PER_PAGE = 25;

export default function TicketList({ limit }: { limit?: number }) {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [isMounted, setIsMounted] = useState(false);
    const router = useRouter();

    // Reset pagination when search term changes
    useEffect(() => {
        setIsMounted(true);
        setCurrentPage(1);
    }, [searchTerm]);

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
                .select('*, restaurantes(nombre_restaurante), catalogo_servicios(categoria, subcategoria, elemento)')
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
            case 'abierto': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-700 border border-sky-200 shadow-sm">Abierto</span>;
            case 'en_progreso': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 border border-indigo-200 shadow-sm">En Progreso</span>;
            case 'resuelto': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200 shadow-sm">Resuelto</span>;
            case 'cerrado': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200 shadow-sm">Cerrado</span>;
            default: return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">{status}</span>;
        }
    };

    const getPriorityBadge = (priority: Ticket['prioridad']) => {
        switch (priority) {
            case 'alta': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200 shadow-sm">Alta</span>;
            case 'media': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200 shadow-sm">Media</span>;
            case 'baja': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200 shadow-sm">Baja</span>;
            case 'crítica': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700 border border-rose-200 shadow-sm">Crítica</span>;
            default: return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200 shadow-sm">{priority}</span>;
        }
    };

    const processedTickets = useMemo(() => {
        let filtered = tickets;

        // Filter by Search Term
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
    }, [tickets, searchTerm]);

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
        return (
            <div className="flex justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="bg-white shadow-md rounded-xl overflow-hidden border border-slate-200 w-full mt-2">
            <div className="p-5 border-b border-gray-200 flex flex-col justify-between items-start md:flex-row md:items-center bg-white gap-4">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 whitespace-nowrap">
                    Mis Tickets
                    <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-0.5 rounded-full">
                        {processedTickets.length}
                    </span>
                </h3>

                {/* Search Bar */}
                <div className="relative w-full md:w-80">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Buscar por ID (NC-XX), título o descripción..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-xl leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-primary focus:border-brand-primary sm:text-sm transition-all shadow-sm"
                    />
                </div>
            </div>

            {/* VISTA DE ESCRITORIO (Tabla clásica) */}
            <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50/50">
                        <tr>
                            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-[15%]">ID / Fecha</th>
                            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-[50%]">Asunto</th>
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
                                        <div className="text-xs font-bold tracking-wider mb-1">
                                            <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-700 text-white text-xs font-semibold tracking-wide">NC-{ticket.numero_ticket}</span>
                                        </div>
                                        <div className="text-sm text-gray-500 font-medium">
                                            {new Date(ticket.fecha_creacion).toLocaleDateString()}
                                        </div>
                                    </td>

                                    <td className="px-6 py-4">
                                        <div className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors line-clamp-1 mb-1.5">
                                            {ticket.titulo}
                                        </div>
                                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                                            {ticket.restaurantes?.nombre_restaurante && (
                                                <span className="truncate max-w-[120px]" title={ticket.restaurantes.nombre_restaurante}>
                                                    {ticket.restaurantes.nombre_restaurante}
                                                </span>
                                            )}

                                            {ticket.catalogo_servicios && (
                                                <>
                                                    <ChevronRight className="w-3 h-3 text-slate-300 flex-shrink-0" />
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

            {/* VISTA MÓVIL (Tarjetas apilables sin scroll horizontal) */}
            <div className="md:hidden flex flex-col divide-y divide-gray-100 border-t border-gray-100">
                {paginatedTickets.length === 0 ? (
                    <div className="px-6 py-12 text-center text-gray-500">
                        <div className="flex flex-col items-center justify-center">
                            <MessageSquare className="w-12 h-12 text-gray-300 mb-3" />
                            <p className="text-gray-500">No hay tickets en esta vista.</p>
                        </div>
                    </div>
                ) : (
                    paginatedTickets.map((ticket) => (
                        <div
                            key={ticket.id}
                            onClick={() => router.push(`/dashboard/ticket/${ticket.id}`)}
                            className="p-4 hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer flex flex-col gap-3"
                        >
                            {/* Fila 1: ID, Fecha y Prioridad */}
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-700 text-white text-xs font-bold tracking-wide">
                                        NC-{ticket.numero_ticket}
                                    </span>
                                    <span className="text-xs text-slate-500 font-medium">
                                        {new Date(ticket.fecha_creacion).toLocaleDateString()}
                                    </span>
                                </div>
                                {getPriorityBadge(ticket.prioridad)}
                            </div>

                            {/* Fila 2: Título */}
                            <div className="font-bold text-slate-900 leading-tight">
                                {ticket.titulo}
                            </div>

                            {/* Fila 3: Ubicación y Estado */}
                            <div className="flex justify-between items-end gap-2">
                                <div className="flex flex-col gap-1 text-xs text-slate-500 overflow-hidden pr-2">
                                    {ticket.restaurantes?.nombre_restaurante && (
                                        <span className="font-medium text-slate-600 flex items-center gap-1 truncate">
                                            📍 {ticket.restaurantes.nombre_restaurante}
                                        </span>
                                    )}
                                    {ticket.catalogo_servicios && (
                                        <span className="truncate text-slate-700">
                                            {ticket.catalogo_servicios.categoria} &rsaquo; <span className="font-semibold">{ticket.catalogo_servicios.elemento}</span>
                                        </span>
                                    )}
                                </div>
                                <div className="flex-shrink-0">
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
                    <button onClick={() => router.push('/dashboard/solicitante/tickets')} className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors">
                        Ver todos los tickets &rarr;
                    </button>
                </div>
            )}
        </div>
    );
}
