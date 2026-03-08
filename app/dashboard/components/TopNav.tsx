'use client';

import Image from 'next/image';
import { useState, useRef, useEffect } from 'react';
import { Bell, User, LogOut, Search, LayoutDashboard, Plus, X, PieChart, Infinity } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { searchTicketByNumberAction, markNotificationReadAction } from '../actions';
import { Notification } from '@/types/database.types';
import debounce from 'lodash.debounce';
import { TicketForm } from '../solicitante/components/TicketForm';

interface TopNavProps {
    userFullName: string | null;
    userRole: string | null;
}

export default function TopNav({ userFullName, userRole }: TopNavProps) {
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isNotifOpen, setIsNotifOpen] = useState(false);
    const [isStatusModalOpen, setIsStatusModalOpen] = useState(false); // Renamed to avoid exact conflict, but we'll use isTicketModalOpen
    const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);

    // Search State
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

    // 1. Initial Notification Fetch & Subscription
    useEffect(() => {
        const fetchNotifications = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user.id)
                .order('creado_en', { ascending: false })
                .limit(20);

            if (data) setNotifications(data);
        };

        fetchNotifications();

        // Real-time listener
        const channel = supabase
            .channel('realtime-notifications')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'notifications' },
                (payload) => {
                    // Prepend new notification
                    setNotifications(prev => [payload.new as Notification, ...prev]);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push('/');
        router.refresh();
    };

    // 2. Debounced Search Autocomplete
    const fetchSearchResults = useRef(
        debounce(async (query: string) => {
            if (!query.trim()) {
                setSearchResults([]);
                setIsSearching(false);
                return;
            }

            const isNumber = /^\d+$/.test(query.replace(/\D/g, ''));
            const numVal = isNumber ? parseInt(query.replace(/\D/g, '')) : null;

            type SearchQuery = ReturnType<typeof supabase.from>;
            let q = supabase
                .from('tickets')
                .select('id, numero_ticket, titulo')
                .limit(5);

            if (numVal !== null && !isNaN(numVal)) {
                // Si parece un número, priorizamos buscar por ID
                q = q.eq('numero_ticket', numVal);
            } else {
                // Búsqueda por texto en título
                q = q.ilike('titulo', `%${query}%`);
            }

            const { data, error } = await q;

            if (!error && data) {
                // Try fallback ilike if number search failed but they typed something like TKT-12
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
        // Fallback al comportamiento original si presionan Enter
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

    // 3. Mark Notification Read
    const handleNotificationClick = async (notif: Notification) => {
        // Optimistic UI update
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, leida: true } : n));
        setIsNotifOpen(false);

        await markNotificationReadAction(notif.id);
        router.push(`/dashboard/ticket/${notif.ticket_id}`);
    };

    // Close dropdowns when clicking outside
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

    const dashboardLink = userRole === 'AGENTE' ? '/dashboard/agente' : '/dashboard/solicitante';
    const displayInitial = userFullName ? userFullName.charAt(0).toUpperCase() : <User className="w-4 h-4" />;

    return (
        <header className="sticky top-0 z-40 w-full bg-gradient-to-r from-brand-secondary to-brand-primary shadow-sm transition-all">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">

                    {/* Left: Branding & Search */}
                    <div className="flex items-center gap-8 flex-1">
                        <Link href={dashboardLink} className="flex items-center gap-3 group flex-shrink-0">
                            {/* Contenedor blanco semitransparente para dar contraste al logo */}
                            <div className=" group-hover:scale-105 transition-all duration-300">
                                <Image
                                    src="/looplogo.png"
                                    alt="Logo Loop"
                                    width={150}
                                    height={50}
                                    className="w-auto max-w-[140px] sm:max-w-[180px] h-10 sm:h-12 object-contain drop-shadow-sm"
                                    priority
                                />
                            </div>
                        </Link>

                        {/* Search Bar with Autocomplete */}
                        <div ref={searchRef} className="max-w-md w-full relative hidden sm:block">
                            <form onSubmit={handleSearchSubmit}>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                        <Search className="h-4 w-4 text-emerald-100 group-focus-within:text-brand-primary transition-colors" />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Buscar por ID de ticket o título..."
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

                            {/* Dropdown Menu para Autocompletado */}
                            {showSearchDropdown && searchQuery.trim().length > 0 && (
                                <div className="absolute mt-2 w-full bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden py-1 z-50 ring-1 ring-black ring-opacity-5">
                                    {searchResults.length === 0 && !isSearching ? (
                                        <div className="px-4 py-3 text-sm text-gray-500 text-center">
                                            No se encontraron tickets.
                                        </div>
                                    ) : (
                                        searchResults.map(ticket => (
                                            <button
                                                key={ticket.id}
                                                onClick={() => handleResultClick(ticket.id)}
                                                className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors flex items-center gap-3 border-b border-gray-50 last:border-0"
                                            >
                                                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">
                                                    #{ticket.numero_ticket}
                                                </span>
                                                <span className="text-sm font-medium text-slate-700 truncate">
                                                    {ticket.titulo}
                                                </span>
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-4 ml-4">

                        {/* Quick Nav Options */}
                        <div className="flex items-center gap-2 mr-2">
                            {/* ESTA ES LA MAGIA: SOLO SE MUESTRA SI ES USUARIO */}
                            {userRole === 'SOLICITANTE' && (
                                <button
                                    onClick={() => setIsTicketModalOpen(true)}
                                    className="bg-white text-brand-primary hover:bg-slate-50 font-bold py-2 px-4 rounded-lg shadow-sm transition-all flex items-center gap-2"
                                >
                                    <Plus className="w-5 h-5" />
                                    <span className="hidden sm:inline">Nueva Solicitud</span>
                                </button>
                            )}

                            <Link
                                href="/dashboard/analiticas"
                                className={`p-2 rounded-full transition-colors flex items-center justify-center cursor-pointer ml-1 ${pathname === '/dashboard/analiticas'
                                    ? 'bg-white/20 text-white shadow-inner'
                                    : 'text-white/90 hover:text-white hover:bg-white/10'
                                    }`}
                                title="Analíticas"
                            >
                                <PieChart className="w-5 h-5" />
                            </Link>

                            <Link
                                href={dashboardLink}
                                className={`p-2 rounded-full transition-colors flex items-center justify-center cursor-pointer ml-1 ${pathname === dashboardLink || pathname?.startsWith('/dashboard/ticket/')
                                    ? 'bg-white/20 text-white shadow-inner'
                                    : 'text-white/90 hover:text-white hover:bg-white/10'
                                    }`}
                                title="Panel de Control"
                            >
                                <LayoutDashboard className="w-5 h-5" />
                            </Link>
                        </div>

                        {/* Notifications Bell */}
                        <div className="relative" ref={notifRef}>
                            <button
                                onClick={() => setIsNotifOpen(!isNotifOpen)}
                                className="relative p-2 text-white/90 hover:text-white hover:bg-white/10 rounded-full transition-colors focus:outline-none"
                            >
                                <span className="sr-only">Ver notificaciones</span>
                                <Bell className="w-5 h-5" />
                                {/* Red Dot indicator */}
                                {notifications.some(n => !n.leida) && (
                                    <span className="absolute top-1.5 right-1.5 block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white"></span>
                                )}
                            </button>

                            {/* Notifications Dropdown */}
                            {isNotifOpen && (
                                <div className="absolute right-0 mt-2 w-80 rounded-xl bg-white shadow-lg ring-1 ring-black ring-opacity-5 py-2 z-50 origin-top-right transition-all transform scale-100">
                                    <div className="px-4 py-2 border-b border-gray-100 flex justify-between items-center">
                                        <h3 className="text-sm font-bold text-gray-900">Notificaciones</h3>
                                        <span className="bg-indigo-100 text-indigo-800 text-xs font-semibold px-2 py-0.5 rounded-full">
                                            {notifications.filter(n => !n.leida).length} Nuevas
                                        </span>
                                    </div>
                                    <div className="max-h-80 overflow-y-auto">
                                        {notifications.length === 0 ? (
                                            <div className="px-4 py-6 text-sm text-center text-gray-500">
                                                No tienes notificaciones recientes.
                                            </div>
                                        ) : (
                                            notifications.map(notif => (
                                                <button
                                                    key={notif.id}
                                                    onClick={() => handleNotificationClick(notif)}
                                                    className={`w-full text-left px-4 py-3 border-b border-gray-50 transition-colors last:border-0 ${notif.leida ? 'bg-white hover:bg-gray-50 opacity-80' : 'bg-indigo-50/40 hover:bg-indigo-50/80'}`}
                                                >
                                                    <p className={`text-sm mb-1 leading-snug ${notif.leida ? 'font-medium text-slate-600' : 'font-bold text-slate-900'}`}>
                                                        {notif.mensaje}
                                                    </p>
                                                    <p className="text-xs text-slate-400 font-medium">
                                                        {new Date(notif.creado_en).toLocaleDateString()}
                                                    </p>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Divider */}
                        <div className="h-6 w-px bg-white/20 hidden sm:block"></div>

                        {/* Profile Dropdown */}
                        <div className="relative" ref={dropdownRef}>
                            <button
                                onClick={() => setIsProfileOpen(!isProfileOpen)}
                                className="flex items-center gap-2 focus:outline-none rounded-full ring-2 ring-transparent focus:ring-brand-accent hover:bg-white/10 p-1 transition-all"
                            >
                                <span className="hidden sm:block text-sm font-bold text-white max-w-[120px] truncate">
                                    {userFullName || 'Usuario'}
                                </span>
                                <div className="h-8 w-8 rounded-full bg-white/20 text-white flex items-center justify-center font-bold text-sm ring-1 ring-white/30">
                                    {displayInitial}
                                </div>
                            </button>

                            {/* Dropdown Menu */}
                            {isProfileOpen && (
                                <div className="absolute right-0 mt-2 w-48 rounded-xl bg-white shadow-lg ring-1 ring-black ring-opacity-5 py-1 z-50 origin-top-right transition-all">

                                    <div className="px-4 py-2 text-xs text-gray-500 border-b border-gray-100 mb-1">
                                        Conectado como <br />
                                        <span className="font-bold text-slate-800 uppercase tracking-wider">{userRole}</span>
                                    </div>

                                    <Link
                                        href="/dashboard/perfil"
                                        onClick={() => setIsProfileOpen(false)}
                                        className="w-full text-left px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-brand-primary transition-colors cursor-pointer flex items-center gap-2"
                                    >
                                        <User className="w-4 h-4" />
                                        <span>Mi Perfil</span>
                                    </Link>

                                    <button
                                        onClick={handleSignOut}
                                        className="w-full text-left px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2 border-t border-gray-100 mt-1 pt-2"
                                    >
                                        <LogOut className="w-4 h-4" />
                                        <span>Cerrar Sesión</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Global Creation Modal */}
            {isTicketModalOpen && (
                <div className="fixed inset-0 z-[100] overflow-y-auto">
                    <div className="flex min-h-screen items-center justify-center p-4 text-center sm:p-0">
                        {/* Backdrop with Glassmorphism */}
                        <div
                            className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 transition-opacity"
                            onClick={() => setIsTicketModalOpen(false)}
                            aria-hidden="true"
                        />

                        {/* Modal Panel */}
                        <div className="relative z-[60] transform overflow-hidden rounded-2xl bg-white text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-2xl border border-gray-100">
                            {/* Close Button top right */}
                            <div className="absolute right-0 top-0 pr-4 pt-4 z-10">
                                <button
                                    type="button"
                                    onClick={() => setIsTicketModalOpen(false)}
                                    className="rounded-full bg-white p-1 text-gray-400 hover:text-gray-500 focus:outline-none hover:bg-gray-100 transition-colors shadow-sm"
                                >
                                    <span className="sr-only">Close</span>
                                    <X className="h-6 w-6" aria-hidden="true" />
                                </button>
                            </div>

                            {/* Ticket Form */}
                            <div className="p-1">
                                <TicketForm onClose={() => setIsTicketModalOpen(false)} />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
}