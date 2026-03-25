'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Ticket } from '@/types/database.types';
import { FileText, Image as ImageIcon, FileSpreadsheet, File, MessageSquare, Search, ChevronLeft, ChevronRight, User, CornerDownRight } from 'lucide-react';
import Link from 'next/link';

const ITEMS_PER_PAGE = 25;

type FilterType = 'TODOS' | 'PENDIENTES' | 'RESUELTOS';

interface Props {
    initialTickets: Ticket[];
    currentAgentId: string;
    agentName?: string;
}

export function AdminTicketList({ initialTickets, currentAgentId, agentName }: Props) {
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

    const getPriorityBadge = (priority: Ticket['prioridad'], isCompound = false) => {
        const shape = isCompound ? 'rounded-l-md border-r-0 text-[10px]' : 'rounded text-[9px] sm:text-[10px] shadow-sm';
        switch (priority) {
            case 'alta': return <span className={`inline-flex items-center px-2 py-0.5 ${shape} uppercase tracking-wide font-black bg-white text-red-600 border border-red-200`}>Alta</span>;
            case 'crítica': return <span className={`inline-flex items-center px-2 py-0.5 ${shape} uppercase tracking-wide font-black bg-white text-purple-700 border border-purple-200`}>Crítica</span>;
            case 'media': return <span className={`inline-flex items-center px-2 py-0.5 ${shape} uppercase tracking-wide font-black bg-white text-amber-600 border border-amber-200`}>Media</span>;
            case 'baja': return <span className={`inline-flex items-center px-2 py-0.5 ${shape} uppercase tracking-wide font-black bg-white text-blue-600 border border-blue-200`}>Baja</span>;
            default: return <span className={`inline-flex items-center px-2 py-0.5 ${shape} uppercase tracking-wide font-black bg-gray-100 text-gray-700 border border-gray-200`}>{priority}</span>;
        }
    };

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

    const getFileIcon = (url: string) => {
        const ext = url.split('.').pop()?.toLowerCase() || '';
        if (ext.includes('pdf')) return <FileText className="w-4 h-4" />;
        if (ext.includes('jpg') || ext.includes('jpeg') || ext.includes('png')) return <ImageIcon className="w-4 h-4" />;
        if (ext.includes('xlsx') || ext.includes('csv')) return <FileSpreadsheet className="w-4 h-4" />;
        return <File className="w-4 h-4" />;
    };

    // Función extraída para calcular el SLA y renderizar la pastilla
    const renderSlaBadge = (ticket: Ticket, isCompound = false) => {
        const shape = isCompound ? 'rounded-r-md border border-l-0 text-[10px]' : 'rounded text-[9px] sm:text-[10px] shadow-sm border';
        const dbSlaStatus = (ticket as any).slaStatus;
        
        if (dbSlaStatus) {
            const statusStr = String(dbSlaStatus).toLowerCase();
            if (statusStr.includes('incumplido')) {
                return <span className={`inline-flex items-center px-2 py-0.5 ${shape} font-bold bg-red-100 text-red-700 border-red-200 tracking-wide uppercase whitespace-nowrap`}>{dbSlaStatus}</span>;
            } else if (statusStr.includes('cumplido')) {
                return <span className={`inline-flex items-center px-2 py-0.5 ${shape} font-bold bg-green-100 text-green-700 border-green-200 tracking-wide uppercase whitespace-nowrap`}>{dbSlaStatus}</span>;
            }
            return <span className={`inline-flex items-center px-2 py-0.5 ${shape} font-bold bg-gray-100 text-gray-700 border-gray-200 tracking-wide uppercase whitespace-nowrap`}>{dbSlaStatus}</span>;
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
                ? <span className={`inline-flex items-center px-2 py-0.5 ${shape} font-bold bg-green-100 text-green-700 border-green-200 tracking-wide uppercase whitespace-nowrap`}>SLA Cumplido</span>
                : <span className={`inline-flex items-center px-2 py-0.5 ${shape} font-bold bg-red-100 text-red-700 border-red-200 tracking-wide uppercase whitespace-nowrap`}>SLA Incumplido</span>;
        }

        const diffHours = (sla.getTime() - new Date().getTime()) / (1000 * 60 * 60);
        if (diffHours < 0) return <span className={`inline-flex items-center px-2 py-0.5 ${shape} font-bold bg-red-100 text-red-700 border-red-200 tracking-wide uppercase whitespace-nowrap`}>Vencido hace {Math.abs(Math.round(diffHours))}h</span>;
        if (diffHours <= 12) return <span className={`inline-flex items-center px-2 py-0.5 ${shape} font-bold bg-orange-100 text-orange-700 border-orange-200 tracking-wide uppercase whitespace-nowrap`}>Vence en {Math.round(diffHours)}h</span>;
        return <span className={`inline-flex items-center px-2 py-0.5 ${shape} font-bold bg-green-100 text-green-700 border-green-200 tracking-wide uppercase whitespace-nowrap`}>Vence en {Math.round(diffHours)}h</span>;
    };

    return (
        <div className="bg-transparent md:bg-white md:shadow-md md:rounded-xl overflow-hidden md:border border-transparent md:border-slate-200 w-full">
            
            {/* Header / Controles Principales (Visible Móvil y Desktop) */}
            <div className="p-4 sm:p-5 border-b border-gray-200 flex flex-col bg-white gap-4 w-full">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 w-full">
                    {/* Título y Badge */}
                    <div className="flex items-center gap-2">
                        <h3 className="text-xl font-black text-slate-800 flex items-center gap-2 whitespace-nowrap tracking-tight">
                            Todos los Tickets
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
                            placeholder="Buscar por ID (NC-XX), título o nombre..."
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

            {/* Paneles de Resumen (Top 3) */}
            <div className="grid grid-cols-3 gap-3 p-4 bg-slate-50 border-b border-gray-100">
                <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center">
                    <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-widest mb-0.5">Totales</span>
                    <span className="text-xl sm:text-2xl font-black text-brand-primary">{initialTickets.length}</span>
                </div>
                <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center">
                    <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-widest mb-0.5">Pendientes</span>
                    <span className="text-xl sm:text-2xl font-black text-amber-600">{initialTickets.filter(t => !['anulado', 'resuelto', 'cerrado'].includes(t.estado)).length}</span>
                </div>
                <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center">
                    <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-widest mb-0.5">Resueltos</span>
                    <span className="text-xl sm:text-2xl font-black text-emerald-600">{initialTickets.filter(t => ['anulado', 'resuelto', 'cerrado'].includes(t.estado)).length}</span>
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

            {/* VISTA MÓVIL (Tarjetas independientes) */}
            <div className="md:hidden flex flex-col p-4 md:bg-slate-50/50 gap-4 min-h-[50vh] bg-slate-50">
                {paginatedTickets.length === 0 ? (
                    <div className="px-6 py-12 text-center text-gray-500 bg-white rounded-2xl border border-slate-200 shadow-sm mt-4">
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
                            className="p-4 sm:p-5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md active:bg-slate-50 transition-all cursor-pointer flex flex-col gap-3"
                        >
                            {/* Fila 1: Header con ID y Usuario */}
                            <div className="flex justify-between items-start gap-2">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm shrink-0 shadow-sm border border-slate-200">
                                        {ticket.profiles?.full_name?.charAt(0).toUpperCase() || <User className="w-5 h-5" />}
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <div className="flex flex-wrap items-center gap-2 mb-0.5">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-800 text-white text-[10px] font-black tracking-widest shadow-sm">
                                                NC-{ticket.numero_ticket}
                                            </span>
                                            <span className="text-[12px] font-bold text-gray-900 truncate">
                                                {ticket.profiles?.full_name || 'Desconocido'}
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

                            {/* Fila 4: Badges Consolidados como un solo elemento visual */}
                            <div className="flex items-center justify-between gap-3 mt-1.5 pt-3.5 border-t border-slate-50">
                                <div className="flex items-center shadow-sm rounded-md hover:shadow transition-shadow">
                                    {getPriorityBadge(ticket.prioridad, true)}
                                    {renderSlaBadge(ticket, true)}
                                </div>
                                <div className="shrink-0 flex items-center justify-end">
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