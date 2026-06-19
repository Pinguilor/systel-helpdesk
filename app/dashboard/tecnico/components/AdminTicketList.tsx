'use client';

import { useState, useMemo, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Ticket } from '@/types/database.types';
import { loadMoreTicketsAction, searchTicketsAction } from '@/app/dashboard/admin/ticketActions';
import { FileText, Image as ImageIcon, FileSpreadsheet, File, MessageSquare, Search, ChevronLeft, ChevronRight, User, CornerDownRight, Building2 } from 'lucide-react';
import Link from 'next/link';
import { ExportarMaestroButton } from '@/app/dashboard/admin/components/ExportarMaestroButton';
import { getStatusBadge } from '@/app/dashboard/components/StatusBadge';
import { motion } from 'framer-motion';
import { GlobeInteractive } from '@/components/ui/cobe-globe-interactive';

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
    hidden: { y: 10, opacity: 0 },
    show: { 
        y: 0, 
        opacity: 1,
        transition: {
            type: "spring",
            stiffness: 100,
            damping: 15
        }
    }
} as const;

const ITEMS_PER_PAGE = 25;

type FilterType = 'TODOS' | 'PENDIENTES' | 'RESUELTOS';

interface Props {
    initialTickets: Ticket[];
    currentAgentId: string;
    agentName?: string;
    totalCount?: number;
    pendingCount?: number;
    resolvedCount?: number;
    hasMore?: boolean;
}

export function AdminTicketList({ initialTickets, currentAgentId, agentName, totalCount, pendingCount, resolvedCount, hasMore = false }: Props) {
    const [filter, setFilter] = useState<FilterType>('TODOS');
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [allTickets, setAllTickets] = useState<Ticket[]>(initialTickets);
    const [loadedPage, setLoadedPage] = useState(1);
    const [reachedEnd, setReachedEnd] = useState(!hasMore);
    const [isPending, startTransition] = useTransition();

    // Búsqueda server-side: cuando hay término activo, traemos TODAS las
    // coincidencias (no solo las páginas ya cargadas en allTickets).
    const [serverSearchResults, setServerSearchResults] = useState<Ticket[] | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [searchCapped, setSearchCapped] = useState(false);
    const isSearchActive = searchTerm.trim().length > 0;

    // Si el servidor provee los conteos exactos los usamos; si no, calculamos desde el array cargado
    const displayTotal   = totalCount   ?? allTickets.length;
    const displayPending = pendingCount ?? allTickets.filter(t => !['anulado', 'resuelto', 'cerrado'].includes(t.estado)).length;
    const displayResolved = resolvedCount ?? allTickets.filter(t => ['anulado', 'resuelto', 'cerrado'].includes(t.estado)).length;
    const router = useRouter();

    const loadMore = () => {
        startTransition(async () => {
            const result = await loadMoreTicketsAction(loadedPage);
            if (result.data && result.data.length > 0) {
                setAllTickets(prev => [...prev, ...(result.data as Ticket[])]);
                setLoadedPage(p => p + 1);
                if (result.data.length < 30) setReachedEnd(true);
            } else {
                setReachedEnd(true);
            }
        });
    };

    const globeMarkers = useMemo(() => {
        const counts: Record<string, number> = {};

        // Filter only active tickets
        const activeTickets = (allTickets || []).filter(
            t => !['anulado', 'resuelto', 'cerrado'].includes(t.estado)
        );

        activeTickets.forEach(t => {
            const sigla = t.restaurantes?.sigla;
            if (sigla) {
                counts[sigla] = (counts[sigla] || 0) + 1;
            }
        });

        const baselineSiglas = [
            // Norte
            'IQS', 'CMA', 'ANT', 'COP', 'LAS', 'LIS', 'LCR', 'MCQ', 'OVA',
            // Centro
            'MMA', 'REI', 'KNN', 'CHA', 'DEH', 'EKI', 'EYZ', 'IDE', 'LBO', 
            'SRB', 'MPE', 'GVE', 'G18', 'FLC', 'ECT', 'ESB', 'EKV', 'ANP', 
            'MPN', 'LFD', 'LLR', 'LMP', 'MA1', 'MAQ', 'MMI', 'MPS', 'MTO', 
            'PA2', 'PCT', 'PDH', 'PFC', 'PFV', 'POE',
            // Sur
            'LIN', 'CLA', 'LAN', 'PTR', 'TEMU', 'PM1'
        ];
        baselineSiglas.forEach(sigla => {
            if (counts[sigla] === undefined) {
                counts[sigla] = 0;
            }
        });

        const coordinates: Record<string, [number, number]> = {
            // Norteamérica
            IQS: [40.71, -74.00],      // New York
            CMA: [34.05, -118.24],     // Los Angeles
            ANT: [43.65, -79.38],      // Toronto
            COP: [19.43, -99.13],      // Mexico City
            LAS: [25.76, -80.19],      // Miami
            LIS: [21.30, -157.85],     // Honolulu
            LCR: [45.50, -73.56],      // Montreal
            MCQ: [37.77, -122.41],     // San Francisco
            OVA: [47.60, -122.33],     // Seattle
            
            // Europa
            MMA: [51.50, -0.12],       // London
            REI: [48.85, 2.35],        // Paris
            KNN: [52.52, 13.40],       // Berlin
            "4PS": [41.90, 12.49],     // Rome
            CHA: [40.41, -3.70],       // Madrid
            DEH: [50.11, 8.68],        // Frankfurt
            EKI: [59.32, 18.06],       // Stockholm
            EYZ: [59.91, 10.75],       // Oslo
            IDE: [60.16, 24.93],       // Helsinki
            LBO: [55.75, 37.61],       // Moscow
            SRB: [41.00, 28.97],       // Istanbul
            MPE: [37.98, 23.72],       // Athens
            GVE: [48.20, 16.37],       // Vienna
            G18: [50.85, 4.35],        // Brussels
            FLC: [52.36, 4.90],        // Amsterdam
            ECT: [47.37, 8.54],        // Zurich
            ESB: [38.72, -9.13],       // Lisbon
            
            // Asia & Medio Oriente
            EKV: [39.90, 116.40],      // Beijing
            ANP: [35.67, 139.65],      // Tokyo
            MPN: [37.56, 126.97],      // Seoul
            LFD: [22.39, 114.10],      // Hong Kong
            LLR: [1.35, 103.81],       // Singapore
            LMP: [13.75, 100.50],      // Bangkok
            MA1: [-6.20, 106.81],      // Jakarta
            MAQ: [14.59, 120.98],      // Manila
            MMI: [19.07, 72.87],       // Mumbai
            MPS: [28.61, 77.20],       // Delhi
            MTO: [25.20, 55.27],       // Dubai
            PA2: [24.71, 46.67],       // Riyadh
            
            // África & Oceanía & Sudamérica
            PCT: [30.04, 31.23],       // Cairo
            PDH: [-1.29, 36.82],       // Nairobi
            PFC: [6.52, 3.37],         // Lagos
            PFV: [-33.92, 18.42],      // Cape Town
            POE: [33.57, -7.58],       // Casablanca
            LIN: [-33.86, 151.20],     // Sydney
            CLA: [-36.84, 174.76],     // Auckland
            LAN: [-34.60, -58.38],     // Buenos Aires
            PTR: [-22.90, -43.17],     // Rio de Janeiro
            TEMU: [-12.04, -77.04],    // Lima
            PM1: [4.71, -74.07]        // Bogota
        };

        return Object.entries(counts).map(([sigla, count]) => {
            const loc = coordinates[sigla] || [-33.45 - (Math.random() - 0.5) * 1.5, -70.66 - (Math.random() - 0.5) * 1.5];
            return {
                id: sigla,
                location: loc,
                name: sigla,
                users: count
            };
        });
    }, [allTickets]);

    // Reset pagination when search term changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filter]);

    // Búsqueda server-side debounced: si hay término, consulta toda la tabla;
    // si se limpia, volvemos al flujo paginado normal sobre allTickets.
    useEffect(() => {
        const q = searchTerm.trim();
        if (!q) {
            setServerSearchResults(null);
            setIsSearching(false);
            setSearchCapped(false);
            return;
        }
        let active = true;
        setIsSearching(true);
        const handle = setTimeout(async () => {
            const res = await searchTicketsAction(q);
            if (!active) return;
            setServerSearchResults((res.data as Ticket[]) ?? []);
            setSearchCapped(res.capped);
            setIsSearching(false);
        }, 300);
        return () => { active = false; clearTimeout(handle); };
    }, [searchTerm]);

    const processedTickets = useMemo(() => {
        // Fuente: si hay búsqueda activa, usamos los resultados server-side (toda la
        // tabla); si no, el set paginado en memoria. El filtro de texto de abajo es
        // redundante sobre los resultados del servidor (ya filtrados) pero inofensivo.
        const source = isSearchActive && serverSearchResults !== null ? serverSearchResults : allTickets;

        // 1. Filter by Status/Role Tab
        let filtered = source.filter(ticket => {
            if (filter === 'TODOS') return true;
            if (filter === 'PENDIENTES') return !['anulado', 'resuelto', 'cerrado'].includes(ticket.estado);
            if (filter === 'RESUELTOS') return ['anulado', 'resuelto', 'cerrado'].includes(ticket.estado);
            return true;
        });

        // 2. Filter by Search Term — solo campos visibles/semánticos, sin UUIDs ni relaciones de empresa
        if (searchTerm.trim()) {
            const lowerSearch = searchTerm.toLowerCase();

            const matchesSearch = (ticket: (typeof initialTickets)[0]) => {
                const matchId         = `nc-${ticket.numero_ticket}`.includes(lowerSearch) || String(ticket.numero_ticket).includes(lowerSearch);
                const matchTitle      = (ticket.titulo || '').toLowerCase().includes(lowerSearch);
                const matchDesc       = (ticket.descripcion || '').toLowerCase().includes(lowerSearch);
                const matchRestaurante = (ticket.restaurantes?.nombre_restaurante || '').toLowerCase().includes(lowerSearch);
                const matchSigla      = ((ticket.restaurantes as any)?.sigla || '').toLowerCase().includes(lowerSearch);
                return matchId || matchTitle || matchDesc || matchRestaurante || matchSigla;
            };

            filtered = filtered.filter(matchesSearch);

            // Priorizar coincidencia exacta de sigla (ej. "KNN" sube al tope)
            const exactSiglaMatch = (t: (typeof initialTickets)[0]) =>
                ((t.restaurantes as any)?.sigla || '').toLowerCase() === lowerSearch;
            filtered = [
                ...filtered.filter(exactSiglaMatch),
                ...filtered.filter(t => !exactSiglaMatch(t)),
            ];
        }

        return filtered;
    }, [allTickets, filter, currentAgentId, searchTerm, isSearchActive, serverSearchResults]);

    // 3. Paginate
    const totalPages = Math.ceil(processedTickets.length / ITEMS_PER_PAGE);
    const paginatedTickets = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return processedTickets.slice(start, start + ITEMS_PER_PAGE);
    }, [processedTickets, currentPage]);    const getPriorityBadge = (priority: Ticket['prioridad']) => {
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

    const getFileIcon = (url: string) => {
        const ext = url.split('.').pop()?.toLowerCase() || '';
        if (ext.includes('pdf')) return <FileText className="w-4 h-4" />;
        if (ext.includes('jpg') || ext.includes('jpeg') || ext.includes('png')) return <ImageIcon className="w-4 h-4" />;
        if (ext.includes('xlsx') || ext.includes('csv')) return <FileSpreadsheet className="w-4 h-4" />;
        return <File className="w-4 h-4" />;
    };

    return (
        <div className="relative w-full mt-4">
            {/* Background 3D Globe - non-interactive watermark */}
            {globeMarkers.length > 0 && (
                <div className="absolute right-[-180px] top-[-260px] w-[500px] h-[500px] sm:w-[650px] sm:h-[650px] md:w-[750px] md:h-[750px] pointer-events-none z-0 select-none">
                    <GlobeInteractive markers={globeMarkers} className="w-full h-full" speed={0.0015} backgroundMode={true} />
                </div>
            )}

            {/* Main Ticket List Card */}
            <div className="relative z-10 bg-white/70 backdrop-blur-md shadow-lg rounded-3xl overflow-hidden border border-slate-200/40 w-full">
            
                {/* Header / Controles Principales (Visible Móvil y Desktop) */}
            <div className="p-5 border-b border-slate-100 flex flex-col bg-white/40 gap-4 w-full">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 w-full">
                    {/* Título y Badge */}
                    <div className="flex items-center gap-2">
                        <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-2 whitespace-nowrap tracking-tight">
                            Todos los Tickets
                            <span className="bg-[#0e3187]/10 text-[#0e3187] text-xs font-black px-2.5 py-0.5 rounded-full border border-[#0e3187]/15">
                                {processedTickets.length}
                            </span>
                        </h3>
                    </div>

                    <ExportarMaestroButton />

                    {/* Barra de Búsqueda de Ancho Completo */}
                    <div className="relative w-full lg:max-w-md group">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#0e3187] transition-colors">
                            <Search className="h-4 w-4" strokeWidth={2} />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar por ID (NC-XX), título, descripción o restaurante..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-2xl leading-5 bg-slate-50/50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-4 focus:ring-[#0e3187]/10 focus:border-[#0e3187] text-[15px] sm:text-sm transition-all font-semibold shadow-inner"
                        />
                    </div>
                </div>

                {/* Filtros Estrictos (Tabs) */}
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
                                    layoutId="activeAdminFilterPill"
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
                                    layoutId="activeAdminFilterPill"
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
                                    layoutId="activeAdminFilterPill"
                                    className="absolute inset-0 bg-white rounded-xl shadow-sm border border-slate-200/60"
                                    transition={{ type: "spring", stiffness: 350, damping: 25 }}
                                />
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Paneles de Resumen (Top 3) */}
            <div className="grid grid-cols-3 gap-4 p-5 bg-slate-50/30 border-b border-slate-100/85">
                <div className="bg-white/60 backdrop-blur-sm p-4 rounded-2xl border border-slate-200/50 shadow-sm flex flex-col items-center justify-center transition-all hover:shadow-md hover:scale-[1.02] duration-200">
                    <span className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">Totales</span>
                    <motion.span
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                        className="text-xl sm:text-3xl font-black text-[#0e3187] tracking-tight"
                    >
                        {displayTotal}
                    </motion.span>
                </div>
                <div className="bg-white/60 backdrop-blur-sm p-4 rounded-2xl border border-slate-200/50 shadow-sm flex flex-col items-center justify-center transition-all hover:shadow-md hover:scale-[1.02] duration-200">
                    <span className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">Pendientes</span>
                    <motion.span
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                        className="text-xl sm:text-3xl font-black text-amber-500 tracking-tight"
                    >
                        {displayPending}
                    </motion.span>
                </div>
                <div className="bg-white/60 backdrop-blur-sm p-4 rounded-2xl border border-slate-200/50 shadow-sm flex flex-col items-center justify-center transition-all hover:shadow-md hover:scale-[1.02] duration-200">
                    <span className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">Resueltos</span>
                    <motion.span
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                        className="text-xl sm:text-3xl font-black text-emerald-500 tracking-tight"
                    >
                        {displayResolved}
                    </motion.span>
                </div>
            </div>

            {/* VISTA DE ESCRITORIO (Tabla) */}
            <div className="hidden md:block overflow-hidden">
                <table className="w-full table-fixed divide-y divide-slate-100/50">
                    <thead className="bg-slate-50/70 border-b border-slate-200/50">
                        <tr>
                            <th scope="col" className="pl-6 pr-3 py-4 w-36 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">ID / Fecha</th>
                            <th scope="col" className="pl-3 pr-6 py-4 w-56 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Usuario</th>
                            <th scope="col" className="px-6 py-4 w-44 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Cliente</th>
                            <th scope="col" className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Asunto</th>
                            <th scope="col" className="px-6 py-4 w-36 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Prioridad</th>
                            <th scope="col" className="px-6 py-4 w-36 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Estado</th>
                        </tr>
                    </thead>
                    <motion.tbody 
                        key={`${filter}-${searchTerm}-${currentPage}`}
                        variants={containerVariants}
                        initial="hidden"
                        animate="show"
                        className="bg-white/40 divide-y divide-slate-100/60"
                    >
                        {isSearching ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-16 text-center text-slate-400">
                                    <div className="flex flex-col items-center justify-center gap-3">
                                        <span className="w-6 h-6 border-2 border-slate-200 border-t-[#0e3187] rounded-full animate-spin" />
                                        <p className="text-slate-500 font-bold text-sm">Buscando coincidencias…</p>
                                    </div>
                                </td>
                            </tr>
                        ) : paginatedTickets.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                                    <div className="flex flex-col items-center justify-center">
                                        <MessageSquare className="w-12 h-12 text-slate-450 mb-3" />
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
                                    className="hover:bg-slate-50/70 transition-colors duration-200 cursor-pointer group"
                                >
                                    <td className="pl-6 pr-3 py-4 whitespace-nowrap">
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
                                                    className="inline-flex items-center gap-1.5 text-[10px] text-slate-400 hover:text-[#0e3187] transition-colors font-bold mb-1 w-max"
                                                >
                                                    <CornerDownRight className="w-3.5 h-3.5 text-slate-400" />
                                                    ↳ Adicional de NC-{ticket.padre.numero_ticket}
                                                </Link>
                                            )}
                                            <div className="text-[11px] text-slate-400 font-bold">
                                                {new Date(ticket.fecha_creacion).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                            </div>
                                        </div>
                                    </td>

                                    <td className="pl-3 pr-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center min-w-0">
                                            <div className="h-8 w-8 rounded-full bg-[#0e3187]/10 text-[#0e3187] flex items-center justify-center font-black text-xs shrink-0 ring-2 ring-white">
                                                {ticket.profiles?.full_name?.charAt(0).toUpperCase() || 'U'}
                                            </div>
                                            <div className="ml-3 min-w-0">
                                                <div className="text-sm font-bold text-slate-700 truncate" title={ticket.profiles?.full_name || 'Desconocido'}>
                                                    {ticket.profiles?.full_name || 'Desconocido'}
                                                </div>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Cliente */}
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {(ticket.profiles as any)?.clientes?.nombre_fantasia ? (
                                            <div className="flex items-center gap-2">
                                                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-sm font-bold text-slate-700 truncate max-w-[160px]" title={(ticket.profiles as any)?.clientes?.nombre_fantasia}>
                                                        {(ticket.profiles as any)?.clientes?.nombre_fantasia?.replace(/\s*\[.*?\]/g, '').trim()}
                                                    </span>
                                                    {(ticket.profiles as any)?.clientes?.razon_social && (
                                                        <span className="text-xs text-slate-400 truncate max-w-[160px]" title={(ticket.profiles as any)?.clientes?.razon_social}>
                                                            {(ticket.profiles as any)?.clientes?.razon_social}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-slate-400 font-bold">—</span>
                                        )}
                                    </td>

                                    <td className="px-6 py-4 overflow-hidden">
                                        <div className="text-sm font-extrabold text-slate-900 mb-1.5 truncate group-hover:text-[#0e3187] transition-colors" title={ticket.titulo}>
                                            {ticket.titulo}
                                        </div>
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold whitespace-nowrap overflow-hidden text-ellipsis">
                                            {(ticket.restaurantes?.sigla || ticket.restaurantes?.nombre_restaurante) && (
                                                <span
                                                    title={ticket.restaurantes?.nombre_restaurante ?? undefined}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-black tracking-widest bg-slate-50 text-slate-700 border border-slate-200 mr-1.5"
                                                >
                                                    {/* Prioriza la sigla oficial (ej. CMH); solo si está vacía recorta el nombre */}
                                                    📍 {ticket.restaurantes?.sigla?.trim() || ticket.restaurantes.nombre_restaurante.substring(0, 4).toUpperCase()}
                                                </span>
                                            )}

                                            {ticket.catalogo_servicios && (
                                                <>
                                                    <span className="truncate max-w-[120px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg border border-slate-200/40" title={ticket.catalogo_servicios.categoria}>
                                                        {ticket.catalogo_servicios.categoria}
                                                    </span>
                                                    <ChevronRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                                    <span className="truncate max-w-[120px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-lg border border-slate-200/40 font-bold" title={ticket.catalogo_servicios.subcategoria}>
                                                        {ticket.catalogo_servicios.subcategoria}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                        {ticket.adjuntos && ticket.adjuntos.length > 0 && (
                                            <div className="flex space-x-1 mt-2">
                                                {ticket.adjuntos.map((url, i) => (
                                                    <span key={i} className="text-slate-400 p-0.5 bg-slate-100 rounded-sm">
                                                        {getFileIcon(url)}
                                                    </span>
                                                ))}
                                            </div>
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

            {/* VISTA MÓVIL (Tarjetas independientes) */}
            <motion.div 
                key={`${filter}-${searchTerm}-${currentPage}-mobile`}
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="md:hidden flex flex-col p-4 gap-4 min-h-[50vh] bg-slate-50"
            >
                {isSearching ? (
                    <div className="px-6 py-16 text-center bg-white rounded-2xl border border-slate-200 shadow-sm mt-4">
                        <div className="flex flex-col items-center justify-center gap-3">
                            <span className="w-6 h-6 border-2 border-slate-200 border-t-[#0e3187] rounded-full animate-spin" />
                            <p className="text-slate-500 font-bold text-sm">Buscando coincidencias…</p>
                        </div>
                    </div>
                ) : paginatedTickets.length === 0 ? (
                    <div className="px-6 py-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 shadow-sm mt-4">
                        <div className="flex flex-col items-center justify-center">
                            <MessageSquare className="w-12 h-12 text-slate-400 mb-3" />
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
                            {/* Fila 1: Header con ID y Usuario */}
                            <div className="flex justify-between items-start gap-2">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm shrink-0 shadow-sm border border-slate-200">
                                        {ticket.profiles?.full_name?.charAt(0).toUpperCase() || <User className="w-5 h-5" />}
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <div className="flex flex-wrap items-center gap-2 mb-0.5">
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-xl bg-slate-800 text-white text-[10px] font-black tracking-widest shadow-sm">
                                                NC-{ticket.numero_ticket}
                                            </span>
                                            <span className="text-[12px] font-bold text-slate-700 truncate">
                                                {ticket.profiles?.full_name || 'Desconocido'}
                                            </span>
                                        </div>
                                        {ticket.ticket_padre_id && ticket.padre && (
                                            <Link 
                                                href={`/dashboard/ticket/${ticket.ticket_padre_id}`}
                                                onClick={(e) => e.stopPropagation()}
                                                className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-[#0e3187] transition-colors font-bold w-max bg-slate-50 px-1.5 py-0.5 rounded"
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
                            <div className="font-extrabold text-sm sm:text-base text-slate-900 leading-snug break-words">
                                {ticket.titulo}
                            </div>

                            {/* Fila 3: Ubicación, Cliente y Categoría */}
                            <div className="flex flex-col gap-2 text-[11px] text-slate-500">
                                {(ticket.profiles as any)?.clientes?.nombre_fantasia && (
                                    <span className="font-bold text-[#0e3187] flex items-center gap-1.5 bg-[#0e3187]/5 px-2.5 py-1 w-max rounded-xl border border-[#0e3187]/10 text-[10px] tracking-wider uppercase">
                                        <Building2 className="w-3 h-3 text-[#0e3187]/70 shrink-0" />
                                        {(ticket.profiles as any)?.clientes?.nombre_fantasia?.replace(/\s*\[.*?\]/g, '').trim()}
                                    </span>
                                )}
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
                            <div className="flex items-center justify-between gap-3 mt-1.5 pt-3.5 border-t border-slate-100">
                                <div className="flex items-center">
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
            {totalPages > 1 && (
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

            {/* Cargar más desde el servidor — oculto durante búsqueda (ya se trajeron
                todas las coincidencias server-side, la paginación de 30 no aplica) */}
            {!isSearchActive && !reachedEnd && currentPage === totalPages && (
                <div className="px-6 py-5 border-t border-slate-100 bg-slate-50/30 flex justify-center">
                    <button
                        onClick={loadMore}
                        disabled={isPending}
                        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-[#0e3187] text-white text-xs font-black tracking-wide hover:bg-[#1846b9] disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-sm"
                    >
                        {isPending ? (
                            <>
                                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Cargando...
                            </>
                        ) : (
                            <>
                                Cargar más tickets
                                <span className="bg-white/20 px-1.5 py-0.5 rounded-lg text-[10px]">
                                    {Math.min(30, displayTotal - allTickets.length)} restantes
                                </span>
                            </>
                        )}
                    </button>
                </div>
            )}

            </div>
        </div>
    );
}