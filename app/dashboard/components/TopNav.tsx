'use client';

import Image from 'next/image';
import { useState, useRef, useEffect } from 'react';
import { Bell, User, LogOut, Search, LayoutDashboard, Plus, X, PieChart, Settings, Briefcase, CheckCheck, Ticket, MessageSquare, Calendar, XCircle, UserPlus, CheckCircle2, ScanLine } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { searchTicketByNumberAction, markNotificationReadAction, markAllNotificationsReadAction } from '../actions';
import { Notification } from '@/types/database.types';
import debounce from 'lodash.debounce';
import { TicketForm } from '../usuario/components/TicketForm';
import { CatalogConfigModal } from './CatalogConfigModal';

interface TopNavProps {
    userFullName: string | null;
    userRole: string | null;
}

export default function TopNav({ userFullName, userRole }: TopNavProps) {
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isNotifOpen, setIsNotifOpen] = useState(false);
    const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
    const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [hasMore, setHasMore]             = useState(false);
    const [loadingMore, setLoadingMore]     = useState(false);

    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<{ id: string, numero_ticket: number, titulo: string }[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showSearchDropdown, setShowSearchDropdown] = useState(false);

    const dropdownRef = useRef<HTMLDivElement>(null);
    const notifRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLDivElement>(null);
    const router = useRouter();
    const pathname = usePathname();
    const supabase = createClient();

    const isGlobalViewer = userRole === 'admin' || userRole === 'coordinador';
    const NOTIF_PAGE_SIZE = 20;

    const fetchMoreNotifications = async () => {
        setLoadingMore(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoadingMore(false); return; }

        let query = supabase
            .from('notifications')
            .select('*, tickets(numero_ticket)')
            .order('creado_en', { ascending: false })
            .range(notifications.length, notifications.length + NOTIF_PAGE_SIZE - 1);

        if (!isGlobalViewer) query = query.eq('user_id', user.id);

        const { data } = await query;
        if (data) {
            setNotifications(prev => [...prev, ...data]);
            setHasMore(data.length === NOTIF_PAGE_SIZE);
        }
        setLoadingMore(false);
    };

    useEffect(() => {
        let userId: string | null = null;

        const fetchNotifications = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            userId = user.id;

            let query = supabase
                .from('notifications')
                .select('*, tickets(numero_ticket)')
                .order('creado_en', { ascending: false })
                .limit(NOTIF_PAGE_SIZE);

            if (!isGlobalViewer) {
                query = query.eq('user_id', user.id);
            }

            const { data } = await query;
            if (data) {
                setNotifications(data);
                setHasMore(data.length === NOTIF_PAGE_SIZE);
            }
        };

        fetchNotifications();

        const setupChannel = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const onInsert = (payload: { new: unknown }) => {
                setNotifications(prev => [payload.new, ...prev.slice(0, 49)]);
            };

            let channel;
            if (isGlobalViewer) {
                // Admin/coordinador escuchan todos los inserts sin filtro
                channel = supabase
                    .channel('realtime-notifications')
                    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, onInsert)
                    .subscribe();
            } else {
                // Técnicos y usuarios solo reciben sus propias notificaciones
                channel = supabase
                    .channel('realtime-notifications')
                    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, onInsert)
                    .subscribe();
            }

            return channel;
        };

        const channelPromise = setupChannel();

        return () => {
            channelPromise.then(ch => { if (ch) supabase.removeChannel(ch); });
        };
    }, []);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push('/');
        router.refresh();
    };

    const fetchSearchResults = useRef(
        debounce(async (query: string) => {
            if (!query.trim()) {
                setSearchResults([]);
                setIsSearching(false);
                return;
            }

            const isNumber = /^\d+$/.test(query.replace(/\D/g, ''));
            const numVal = isNumber ? parseInt(query.replace(/\D/g, '')) : null;

            let q = supabase
                .from('tickets')
                .select('id, numero_ticket, titulo')
                .limit(5);

            if (numVal !== null && !isNaN(numVal)) {
                q = q.eq('numero_ticket', numVal);
            } else {
                q = q.ilike('titulo', `%${query}%`);
            }

            const { data, error } = await q;

            if (!error && data) {
                if (data.length === 0 && query.length > 2 && numVal === null) {
                    const fallback = await supabase
                        .from('tickets')
                        .select('id, numero_ticket, titulo')
                        .ilike('titulo', `%${query}%`)
                        .limit(5);
                    setSearchResults(fallback.data || []);
                } else {
                    setSearchResults(data);
                }
            } else {
                setSearchResults([]);
            }

            setIsSearching(false);
        }, 300)
    ).current;

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setSearchQuery(val);
        setShowSearchDropdown(true);
        setIsSearching(true);
        fetchSearchResults(val);
    };

    const handleSearchSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (searchResults.length > 0) {
            handleResultClick(searchResults[0].id);
        } else if (searchQuery.trim() && !isSearching) {
            const numMatch = searchQuery.match(/\d+/);
            if (numMatch) {
                const res = await searchTicketByNumberAction(parseInt(numMatch[0]));
                if (res.id) handleResultClick(res.id);
            }
        }
    };

    const handleResultClick = (id: string) => {
        setShowSearchDropdown(false);
        setSearchQuery('');
        setSearchResults([]);
        router.push(`/dashboard/ticket/${id}`);
    };

    const handleNotificationClick = async (notif: Notification) => {
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, leida: true } : n));
        setIsNotifOpen(false);
        await markNotificationReadAction(notif.id);
        router.push(`/dashboard/ticket/${notif.ticket_id}`);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsProfileOpen(false);
            }
            if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
                setIsNotifOpen(false);
            }
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowSearchDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleMarkAllRead = async () => {
        setNotifications(prev => prev.map(n => ({ ...n, leida: true })));
        await markAllNotificationsReadAction();
    };

    // --- Notification helpers ---
    const timeAgo = (dateStr: string): string => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'ahora mismo';
        if (mins < 60) return `hace ${mins} min`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `hace ${hrs}h`;
        const days = Math.floor(hrs / 24);
        if (days < 7) return `hace ${days}d`;
        return new Date(dateStr).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
    };

    const getNotifType = (mensaje: string, tipo?: string) => {
        if (tipo && tipo !== 'general') return tipo;
        const m = mensaje.toLowerCase();
        if (m.includes('asignado') || m.includes('asignación') || m.includes('asignarte')) return 'asignacion';
        if (m.includes('resuelto') || m.includes('aprobado') || m.includes('cerrado')) return 'resolucion';
        if (m.includes('rechazado')) return 'rechazo';
        if (m.includes('visita') || m.includes('programad')) return 'visita';
        if (m.includes('respondido') || m.includes('respondió')) return 'mensaje';
        return 'nuevo_ticket';
    };

    const getNotifConfig = (tipo: string) => {
        switch (tipo) {
            case 'asignacion':  return { Icon: UserPlus,     color: 'text-orange-600', bg: 'bg-orange-50',  border: 'border-orange-100' };
            case 'resolucion':  return { Icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' };
            case 'rechazo':     return { Icon: XCircle,      color: 'text-red-500',    bg: 'bg-red-50',     border: 'border-red-100' };
            case 'visita':      return { Icon: Calendar,     color: 'text-purple-600', bg: 'bg-purple-50',  border: 'border-purple-100' };
            case 'mensaje':     return { Icon: MessageSquare,color: 'text-sky-600',    bg: 'bg-sky-50',     border: 'border-sky-100' };
            default:            return { Icon: Ticket,       color: 'text-indigo-600', bg: 'bg-indigo-50',  border: 'border-indigo-100' };
        }
    };

    const unreadCount = notifications.filter(n => !n.leida).length;

    const dashboardLink = userRole === 'tecnico' ? '/dashboard/tecnico' : userRole === 'ADMIN' ? '/dashboard/admin' : '/dashboard/usuario';
    const displayInitial = userFullName ? userFullName.charAt(0).toUpperCase() : <User className="w-4 h-4" />;

    return (
        <header className="sticky top-0 z-40 w-full bg-gradient-to-r from-[#0e3187] to-[#222727] shadow-sm transition-all">
            {/* Contenedor relativo para poder clavar el logo en el centro absoluto */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
                <div className="flex justify-between items-center h-16">

                    {/* IZQUIERDA: Logo (Oculto en móvil si es tecnico) */}
                    <div className={`flex items-center flex-shrink-0 ${userRole === 'tecnico' ? 'hidden md:flex' : 'flex'}`}>
                        <Link href={dashboardLink} className="flex items-center group">
                            <div className="group-hover:opacity-80 transition-opacity duration-300">
                                <Image
                                    src="/systeltldablanco.png"
                                    alt="Logo Systel Principal"
                                    width={160}
                                    height={50}
                                    className="h-8 sm:h-10 w-auto object-contain drop-shadow-sm"
                                    priority
                                />
                            </div>
                        </Link>
                    </div>

                    {/* LOGO CENTRADO ABSOLUTO: La magia para el tecnico en Móvil */}
                    {userRole === 'tecnico' && (
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 md:hidden pointer-events-auto">
                            <Link href={dashboardLink} className="flex items-center">
                                <Image
                                    src="/systeltldablanco.png"
                                    alt="Logo Systel Principal"
                                    width={130}
                                    height={40}
                                    className="h-7 sm:h-9 w-auto object-contain drop-shadow-sm"
                                    priority
                                />
                            </Link>
                        </div>
                    )}

                    {/* CENTRO: Búsqueda (PC) o Botón Crear (Móvil usuario) */}
                    <div className="flex-1 flex justify-center items-center px-4">

                        {/* BARRA DE BÚSQUEDA: Visible solo en PC (md:block) */}
                        <div ref={searchRef} className="hidden md:block max-w-md w-full relative">
                            <form onSubmit={handleSearchSubmit}>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                        <Search className="h-4 w-4 text-emerald-100 group-focus-within:text-brand-primary transition-colors" />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Buscar por ID o título..."
                                        value={searchQuery}
                                        onChange={handleSearchChange}
                                        onFocus={() => { if (searchQuery.trim()) setShowSearchDropdown(true); }}
                                        className="block w-full pl-10 pr-4 py-2 border border-white/20 rounded-full leading-5 bg-white/10 hover:bg-white/15 placeholder-emerald-50 text-white focus:outline-none focus:bg-white focus:text-slate-900 focus:placeholder-slate-400 focus:ring-4 focus:ring-white/30 transition-all font-medium sm:text-sm shadow-inner"
                                    />
                                    {isSearching && (
                                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                                            <div className="w-4 h-4 border-2 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
                                        </div>
                                    )}
                                </div>
                            </form>

                            {/* Dropdown de Búsqueda */}
                            {showSearchDropdown && searchQuery.trim().length > 0 && (
                                <div className="absolute mt-2 w-full bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden py-1 z-50 ring-1 ring-black ring-opacity-5">
                                    {searchResults.length === 0 && !isSearching ? (
                                        <div className="px-4 py-3 text-sm text-gray-500 text-center">No se encontraron tickets.</div>
                                    ) : (
                                        searchResults.map(ticket => (
                                            <button
                                                key={ticket.id}
                                                onClick={() => handleResultClick(ticket.id)}
                                                className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors flex items-center gap-3 border-b border-gray-50 last:border-0"
                                            >
                                                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">NC-{ticket.numero_ticket}</span>
                                                <span className="text-sm font-medium text-slate-700 truncate">{ticket.titulo}</span>
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>

                        {/* BOTÓN CREAR MÓVIL: Visible solo en móviles (md:hidden) y si es usuario */}
                        {userRole === 'usuario' && (
                            <button
                                onClick={() => setIsTicketModalOpen(true)}
                                className="md:hidden w-full max-w-[200px] bg-white text-brand-primary hover:bg-slate-50 font-black py-2 px-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-1 active:scale-95 mx-2"
                            >
                                <Plus className="w-4 h-4 shrink-0" />
                                <span className="text-xs uppercase tracking-tight truncate">Solicitud</span>
                            </button>
                        )}
                    </div>

                    {/* DERECHA: Acciones y Perfil */}
                    <div className="flex items-center gap-1 sm:gap-4 flex-shrink-0">

                        {/* BOTÓN CREAR PC: Visible solo en PC y si es usuario */}
                        {userRole === 'usuario' && (
                            <button
                                onClick={() => setIsTicketModalOpen(true)}
                                className="hidden md:flex bg-white text-brand-primary hover:bg-slate-50 font-bold py-2 px-4 rounded-lg shadow-sm transition-all items-center gap-2 mr-2"
                            >
                                <Plus className="w-5 h-5" />
                                <span>Nueva Solicitud</span>
                            </button>
                        )}

                        <Link
                            href="/dashboard/analiticas"
                            className={`hidden sm:flex p-2 rounded-full transition-colors items-center justify-center cursor-pointer ml-1 ${pathname === '/dashboard/analiticas' ? 'bg-white/20 text-white shadow-inner' : 'text-white/90 hover:text-white hover:bg-white/10'}`}
                            title="Analíticas"
                        >
                            <PieChart className="w-5 h-5" />
                        </Link>

                        {/* Trazabilidad de Materiales — solo para clientes (usuario) */}
                        {userRole === 'usuario' && (
                            <Link
                                href="/dashboard/trazabilidad-materiales"
                                className={`hidden sm:flex p-2 rounded-full transition-colors items-center justify-center cursor-pointer ml-1 ${pathname === '/dashboard/trazabilidad-materiales' ? 'bg-white/20 text-white shadow-inner' : 'text-white/90 hover:text-white hover:bg-white/10'}`}
                                title="Materiales Insumidos"
                            >
                                <ScanLine className="w-5 h-5" />
                            </Link>
                        )}

                        <Link
                            href={dashboardLink}
                            className={`hidden sm:flex p-2 rounded-full transition-colors items-center justify-center cursor-pointer ml-1 ${pathname === dashboardLink || pathname?.startsWith('/dashboard/ticket/') ? 'bg-white/20 text-white shadow-inner' : 'text-white/90 hover:text-white hover:bg-white/10'}`}
                            title="Panel de Control"
                        >
                            <LayoutDashboard className="w-5 h-5" />
                        </Link>

                        {/* Notifications Bell */}
                        <div className="relative" ref={notifRef}>
                            <button
                                onClick={() => setIsNotifOpen(!isNotifOpen)}
                                className="relative p-2 text-white/90 hover:text-white hover:bg-white/10 rounded-full transition-colors focus:outline-none"
                                title="Notificaciones"
                            >
                                <Bell className="w-5 h-5" />
                                {unreadCount > 0 && (
                                    <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white ring-2 ring-[#0e3187] px-1 tabular-nums">
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </span>
                                )}
                            </button>

                            {/* Centro de Notificaciones */}
                            {isNotifOpen && (
                                <div className="absolute right-0 mt-3 w-[340px] sm:w-[380px] rounded-2xl bg-white shadow-2xl ring-1 ring-black/[0.06] z-50 overflow-hidden flex flex-col">

                                    {/* Header */}
                                    <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-white">
                                        <div className="flex items-center gap-2.5">
                                            <h3 className="text-sm font-black text-slate-900 tracking-tight">Notificaciones</h3>
                                            {unreadCount > 0 && (
                                                <span className="bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full tabular-nums leading-none">
                                                    {unreadCount}
                                                </span>
                                            )}
                                        </div>
                                        {unreadCount > 0 && (
                                            <button
                                                onClick={handleMarkAllRead}
                                                className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors py-1 px-2 rounded-lg hover:bg-indigo-50"
                                            >
                                                <CheckCheck className="w-3.5 h-3.5" />
                                                Marcar todas
                                            </button>
                                        )}
                                    </div>

                                    {/* Lista */}
                                    <div className="max-h-[460px] overflow-y-auto divide-y divide-slate-50/80">
                                        {notifications.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center py-14 gap-3">
                                                <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center">
                                                    <Bell className="w-5 h-5 text-slate-300" />
                                                </div>
                                                <p className="text-sm font-semibold text-slate-400">Sin notificaciones</p>
                                                <p className="text-xs text-slate-300">Estás al día con todo</p>
                                            </div>
                                        ) : (
                                            notifications.map(notif => {
                                                const tipo = getNotifType(notif.mensaje, notif.tipo);
                                                const { Icon, color, bg, border } = getNotifConfig(tipo);
                                                const clienteName = notif.tickets?.clientes?.nombre_fantasia;
                                                return (
                                                    <button
                                                        key={notif.id}
                                                        onClick={() => handleNotificationClick(notif)}
                                                        className={`w-full text-left px-4 py-3.5 transition-colors flex gap-3 items-start group ${!notif.leida ? 'bg-indigo-50/40 hover:bg-indigo-50/70' : 'bg-white hover:bg-slate-50'}`}
                                                    >
                                                        {/* Icono dinámico */}
                                                        <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${bg} border ${border} mt-0.5`}>
                                                            <Icon className={`w-[15px] h-[15px] ${color}`} />
                                                        </div>

                                                        {/* Contenido */}
                                                        <div className="flex-1 min-w-0">
                                                            <p className={`text-[13px] leading-snug line-clamp-2 ${!notif.leida ? 'font-semibold text-slate-900' : 'font-medium text-slate-500'}`}>
                                                                {notif.mensaje}
                                                            </p>
                                                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                                                {clienteName && (
                                                                    <span className="inline-flex items-center text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full uppercase tracking-wide max-w-[120px] truncate">
                                                                        {clienteName}
                                                                    </span>
                                                                )}
                                                                <span className="text-[11px] text-slate-400 font-medium">
                                                                    {timeAgo(notif.creado_en)}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Indicador no leída */}
                                                        {!notif.leida && (
                                                            <div className="shrink-0 w-2 h-2 rounded-full bg-indigo-500 mt-2 shadow-[0_0_6px_rgba(99,102,241,0.6)]" />
                                                        )}
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>

                                    {/* Footer */}
                                    {notifications.length > 0 && (
                                        <div className="border-t border-slate-100 px-4 py-2.5 bg-slate-50/50 flex flex-col items-center gap-1">
                                            {hasMore ? (
                                                <button
                                                    onClick={fetchMoreNotifications}
                                                    disabled={loadingMore}
                                                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors disabled:opacity-50 flex items-center gap-1.5 py-1"
                                                >
                                                    {loadingMore
                                                        ? <><span className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin inline-block" /> Cargando…</>
                                                        : '↓ Ver más notificaciones'}
                                                </button>
                                            ) : (
                                                <p className="text-[11px] text-slate-400 font-medium text-center">
                                                    {notifications.length} notificación{notifications.length !== 1 ? 'es' : ''} · estás al día
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Divider PC */}
                        <div className="h-6 w-px bg-white/20 hidden sm:block mx-1"></div>

                        {/* Profile Dropdown */}
                        <div className="relative" ref={dropdownRef}>
                            <button
                                onClick={() => setIsProfileOpen(!isProfileOpen)}
                                className="flex items-center gap-2 focus:outline-none rounded-full hover:bg-white/10 p-1 transition-all"
                            >
                                <span className="hidden sm:block text-sm font-bold text-white max-w-[120px] truncate">
                                    {userFullName || 'usuario'}
                                </span>
                                <div className="h-8 w-8 rounded-full bg-white/20 text-white flex items-center justify-center font-bold text-sm ring-1 ring-white/30">
                                    {displayInitial}
                                </div>
                            </button>

                            {isProfileOpen && (
                                <div className="absolute right-0 mt-3 w-48 rounded-xl bg-white shadow-xl ring-1 ring-black/5 py-1 z-50 origin-top-right">
                                    <div className="px-4 py-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest border-b border-slate-50 mb-1">
                                        {userRole}
                                    </div>
                                    <Link
                                        href="/dashboard/perfil"
                                        onClick={() => setIsProfileOpen(false)}
                                        className="w-full text-left px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                    >
                                        <User className="w-4 h-4" /> Mi Perfil
                                    </Link>
                                    {(userRole === 'admin' || userRole === 'coordinador') && (
                                        <Link
                                            href="/dashboard/configuracion"
                                            onClick={() => setIsProfileOpen(false)}
                                            className="hidden md:flex w-full text-left px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 items-center gap-2"
                                        >
                                            <Settings className="w-4 h-4" /> Configuración
                                        </Link>
                                    )}
                                    {userRole === 'tecnico' && (
                                        <Link
                                            href="/dashboard/tecnico/mochila"
                                            onClick={() => setIsProfileOpen(false)}
                                            className="w-full text-left px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                        >
                                            <Briefcase className="w-4 h-4" /> Mi Mochila
                                        </Link>
                                    )}
                                    <button
                                        onClick={handleSignOut}
                                        className="w-full text-left px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 flex items-center gap-2 border-t border-slate-50 mt-1"
                                    >
                                        <LogOut className="w-4 h-4" /> Salir
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal de Creación Global */}
            {isTicketModalOpen && (
                <div className="fixed inset-0 z-[100] overflow-y-auto">
                    <div className="flex min-h-screen items-center justify-center p-4 text-center">
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50" onClick={() => setIsTicketModalOpen(false)} />
                        <div className="relative z-[60] transform overflow-hidden rounded-3xl bg-white text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-2xl border border-white/20">
                            <div className="absolute right-0 top-0 pr-6 pt-6 z-10">
                                <button onClick={() => setIsTicketModalOpen(false)} className="rounded-full bg-slate-100 p-2 text-slate-400 hover:text-slate-600 transition-colors" title="Cerrar" aria-label="Cerrar modal">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                            <div className="p-2">
                                <TicketForm onClose={() => setIsTicketModalOpen(false)} />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Configuración de Catálogos */}
            {isCatalogModalOpen && (
                <CatalogConfigModal onClose={() => setIsCatalogModalOpen(false)} />
            )}
        </header>
    );
}