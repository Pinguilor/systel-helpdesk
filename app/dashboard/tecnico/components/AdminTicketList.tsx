'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Ticket } from '@/types/database.types';
import { FileText, Image as ImageIcon, FileSpreadsheet, File, MessageSquare, Search, ChevronLeft, ChevronRight, User } from 'lucide-react';

const ITEMS_PER_PAGE = 25;

type FilterType = 'TODOS' | 'PENDIENTES' | 'RESUELTOS' | 'MIS_TICKETS' | 'COLA';

interface Props {
    initialTickets: Ticket[];
    currentAgentId: string;
}

export function AdminTicketList({ initialTickets, currentAgentId }: Props) {
    const [filter, setFilter] = useState<FilterType>('TODOS');
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const router = useRouter();

    // Reset pagination when search term changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filter]);

    const processedTickets = useMemo(() => {
        // 1. Filter by Status/Role Tab
        let filtered = initialTickets.filter(ticket => {
            if (filter === 'TODOS') return true;
            if (filter === 'PENDIENTES') return ticket.estado !== 'resuelto' && ticket.estado !== 'cerrado';
            if (filter === 'RESUELTOS') return ticket.estado === 'resuelto' || ticket.estado === 'cerrado';
            if (filter === 'MIS_TICKETS') return ticket.agente_asignado_id === currentAgentId;
            if (filter === 'COLA') return !ticket.agente_asignado_id || ticket.estado === 'esperando_agente';
            return true;
        });

        // 2. Filter by Search Term
        if (searchTerm.trim()) {
            const lowerSearch = searchTerm.toLowerCase();
            filtered = filtered.filter(ticket => {
                const matchId = ticket.id.toLowerCase().includes(lowerSearch) || `nc-${ticket.numero_ticket}`.includes(lowerSearch) || String(ticket.numero_ticket).includes(lowerSearch);
                const matchTitle = (ticket.titulo || '').toLowerCase().includes(lowerSearch);
                const matchDesc = (ticket.descripcion || '').toLowerCase().includes(lowerSearch);
                const matchName = (ticket.profiles?.full_name || '').toLowerCase().includes(lowerSearch);
                const matchRestaurante = (ticket.restaurantes?.nombre_restaurante || '').toLowerCase().includes(lowerSearch);
                return matchId || matchTitle || matchDesc || matchName || matchRestaurante;
            });
        }

        return filtered;
    }, [initialTickets, filter, currentAgentId, searchTerm]);

    // 3. Paginate
    const totalPages = Math.ceil(processedTickets.length / ITEMS_PER_PAGE);
    const paginatedTickets = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return processedTickets.slice(start, start + ITEMS_PER_PAGE);
    }, [processedTickets, currentPage]);

    const getPriorityBadge = (priority: Ticket['prioridad']) => {
        switch (priority) {
            case 'alta': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-red-100 text-red-700 border border-red-200 shadow-sm">Alta</span>;
            case 'media': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200 shadow-sm">Media</span>;
            case 'baja': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200 shadow-sm">Baja</span>;
            default: return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200 shadow-sm">{priority}</span>;
        }
    };

    const getStatusBadge = (status: Ticket['estado']) => {
        switch (status) {
            case 'abierto': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-sky-100 text-sky-700 border border-sky-200 shadow-sm whitespace-nowrap">Abierto</span>;
            case 'en_progreso': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-indigo-100 text-indigo-700 border border-indigo-200 shadow-sm whitespace-nowrap">En Progreso</span>;
            case 'resuelto': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200 shadow-sm whitespace-nowrap">Resuelto</span>;
            case 'cerrado': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200 shadow-sm whitespace-nowrap">Cerrado</span>;
            default: return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-gray-100 text-gray-700 whitespace-nowrap">{status}</span>;
        }
    }

    const getFileIcon = (url: string) => {
        const ext = url.split('.').pop()?.toLowerCase() || '';
        if (ext.includes('pdf')) return <FileText className="w-4 h-4" />;
        if (ext.includes('jpg') || ext.includes('jpeg') || ext.includes('png')) return <ImageIcon className="w-4 h-4" />;
        if (ext.includes('xlsx') || ext.includes('csv')) return <FileSpreadsheet className="w-4 h-4" />;
        return <File className="w-4 h-4" />;
    };

    // Función extraída para calcular el SLA y renderizar la pastilla
    const renderSlaBadge = (ticket: Ticket) => {
        if (!ticket.vencimiento_sla) return null;

        const isResolved = ticket.estado === 'resuelto' || ticket.estado === 'cerrado';
        const sla = new Date(ticket.vencimiento_sla);

        if (isResolved) {
            const resolvedAt = new Date(ticket.actualizado_en);
            return resolvedAt <= sla
                ? <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold bg-green-100 text-green-700 tracking-wide uppercase whitespace-nowrap">SLA Cumplido</span>
                : <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold bg-red-100 text-red-700 tracking-wide uppercase whitespace-nowrap">SLA Incumplido</span>;
        }

        const diffHours = (sla.getTime() - new Date().getTime()) / (1000 * 60 * 60);
        if (diffHours < 0) return <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold bg-red-100 text-red-700 tracking-wide uppercase whitespace-nowrap">Vencido hace {Math.abs(Math.round(diffHours))}h</span>;
        if (diffHours <= 12) return <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold bg-orange-100 text-orange-700 tracking-wide uppercase whitespace-nowrap">Vence en {Math.round(diffHours)}h</span>;
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold bg-green-100 text-green-700 tracking-wide uppercase whitespace-nowrap">Vence en {Math.round(diffHours)}h</span>;
    };

    return (
        <div className="bg-white shadow-md rounded-xl overflow-hidden border border-slate-200">
            {/* Header / Search Controls */}
            <div className="p-4 sm:p-5 border-b border-gray-200 flex flex-col justify-between items-start lg:flex-row lg:items-center bg-white gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full lg:w-auto">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 whitespace-nowrap">
                        Todos los Tickets
                        <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-0.5 rounded-full">
                            {processedTickets.length}
                        </span>
                    </h3>

                    {/* Search Bar */}
                    <div className="relative w-full sm:w-80">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar por ID (NC-XX), título o nombre..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-xl leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-primary focus:border-brand-primary text-sm transition-all shadow-sm"
                        />
                    </div>
                </div>

                <div className="flex overflow-x-auto w-full lg:w-auto bg-gray-100 p-1 rounded-lg custom-scrollbar">
                    <div className="flex space-x-1 min-w-max">
                        <button onClick={() => setFilter('TODOS')} className={`px-4 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all ${filter === 'TODOS' ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'}`}>Todos</button>
                        <button onClick={() => setFilter('PENDIENTES')} className={`px-4 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all ${filter === 'PENDIENTES' ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'}`}>Pendientes</button>
                        <button onClick={() => setFilter('COLA')} className={`px-4 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all ${filter === 'COLA' ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'}`}>Cola de Trabajo</button>
                        <button onClick={() => setFilter('MIS_TICKETS')} className={`px-4 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all ${filter === 'MIS_TICKETS' ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'}`}>Mis Tickets</button>
                        <button onClick={() => setFilter('RESUELTOS')} className={`px-4 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all ${filter === 'RESUELTOS' ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'}`}>Resueltos</button>
                    </div>
                </div>
            </div>

            {/* VISTA DE ESCRITORIO (Tabla) */}
            <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50/50">
                        <tr>
                            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">ID / Fecha</th>
                            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Usuario</th>
                            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Asunto</th>
                            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Prioridad / SLA</th>
                            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                            <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Acción</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                        {paginatedTickets.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
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
                                    className="hover:bg-gray-50 transition-colors cursor-pointer group"
                                >
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-xs font-bold tracking-wider">
                                            <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-700 text-white text-xs font-semibold tracking-wide">NC-{ticket.numero_ticket}</span>
                                        </div>
                                        <div className="text-sm text-gray-500 mt-1 font-medium">
                                            {new Date(ticket.fecha_creacion).toLocaleDateString()}
                                        </div>
                                    </td>

                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs ring-2 ring-white">
                                                {ticket.profiles?.full_name?.charAt(0).toUpperCase() || 'U'}
                                            </div>
                                            <div className="ml-3">
                                                <div className="text-sm font-medium text-gray-900">
                                                    {ticket.profiles?.full_name || 'Desconocido'}
                                                </div>
                                            </div>
                                        </div>
                                    </td>

                                    <td className="px-6 py-4 max-w-xs">
                                        <div className="text-sm font-bold text-gray-900 mb-1.5 truncate group-hover:text-emerald-600 transition-colors">
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
                                                </>
                                            )}
                                        </div>
                                        {ticket.adjuntos && ticket.adjuntos.length > 0 && (
                                            <div className="flex space-x-1 mt-2">
                                                {ticket.adjuntos.map((url, i) => (
                                                    <span key={i} className="text-gray-400 p-0.5 bg-gray-100 rounded-sm">
                                                        {getFileIcon(url)}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </td>

                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex flex-col gap-2 items-start">
                                            {getPriorityBadge(ticket.prioridad)}
                                            {renderSlaBadge(ticket)}
                                        </div>
                                    </td>

                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {getStatusBadge(ticket.estado)}
                                    </td>

                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <span className="text-emerald-600 hover:text-emerald-900 bg-emerald-50 px-3 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                                            Ver detalle &rarr;
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* VISTA MÓVIL (Tarjetas apilables) */}
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
                            {/* Fila 1: Header con ID y Usuario */}
                            <div className="flex justify-between items-start gap-2">
                                <div className="flex items-center gap-2">
                                    <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                                        {ticket.profiles?.full_name?.charAt(0).toUpperCase() || <User className="w-4 h-4" />}
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-700 text-white text-[10px] font-bold tracking-widest w-max mb-0.5">
                                            NC-{ticket.numero_ticket}
                                        </span>
                                        <span className="text-xs font-bold text-gray-900 truncate">
                                            {ticket.profiles?.full_name || 'Desconocido'}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-[10px] text-gray-400 font-medium whitespace-nowrap pt-1">
                                    {new Date(ticket.fecha_creacion).toLocaleDateString()}
                                </div>
                            </div>

                            {/* Fila 2: Título */}
                            <div className="font-bold text-sm text-slate-800 leading-tight">
                                {ticket.titulo}
                            </div>

                            {/* Fila 3: Ubicación y Categoría */}
                            <div className="flex flex-col gap-1 text-[11px] text-slate-500">
                                {ticket.restaurantes?.nombre_restaurante && (
                                    <span className="font-semibold text-slate-600 flex items-center gap-1">
                                        📍 {ticket.restaurantes.nombre_restaurante}
                                    </span>
                                )}
                                {ticket.catalogo_servicios && (
                                    <span className="truncate">
                                        {ticket.catalogo_servicios.categoria} &rsaquo; {ticket.catalogo_servicios.subcategoria}
                                    </span>
                                )}
                            </div>

                            {/* Fila 4: Badges (Prioridad, SLA y Estado) */}
                            <div className="flex flex-wrap items-center justify-between gap-2 mt-1 pt-3 border-t border-gray-50">
                                <div className="flex gap-2 items-center">
                                    {getPriorityBadge(ticket.prioridad)}
                                    {renderSlaBadge(ticket)}
                                </div>
                                <div>
                                    {getStatusBadge(ticket.estado)}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Pagination Footer */}
            {totalPages > 1 && (
                <div className="px-4 sm:px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                    <button
                        onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        disabled={currentPage === 1}
                        className="inline-flex items-center px-3 py-1.5 sm:px-4 sm:py-2 border border-slate-300 shadow-sm text-xs sm:text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        <ChevronLeft className="h-4 w-4 mr-1 sm:mr-1.5" />
                        <span className="hidden sm:inline">Anterior</span>
                    </button>
                    <span className="text-xs sm:text-sm text-slate-600 font-medium">
                        Página {currentPage} de {totalPages}
                    </span>
                    <button
                        onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        disabled={currentPage === totalPages}
                        className="inline-flex items-center px-3 py-1.5 sm:px-4 sm:py-2 border border-slate-300 shadow-sm text-xs sm:text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        <span className="hidden sm:inline">Siguiente</span>
                        <ChevronRight className="h-4 w-4 ml-1 sm:ml-1.5" />
                    </button>
                </div>
            )}
        </div>
    );
}