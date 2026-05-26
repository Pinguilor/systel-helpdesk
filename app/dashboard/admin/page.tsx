import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AdminTicketList } from '../tecnico/components/AdminTicketList';
import { TicketsRealtimeListener } from '../components/TicketsRealtimeListener';
import { LayoutGrid, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default async function AdminDashboard() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('rol, full_name')
        .eq('id', user.id)
        .maybeSingle();

    if (profile?.rol?.toUpperCase() !== 'ADMIN' && profile?.rol?.toUpperCase() !== 'COORDINADOR') {
        redirect(profile?.rol?.toUpperCase() === 'TECNICO' ? '/dashboard/tecnico' : '/dashboard/usuario');
    }

    // Fetch ALL tickets for Admin — clientes viene anidado a través de profiles.cliente_id
    const { data: tickets, error } = await supabase
        .from('tickets')
        .select(`
            *,
            profiles:creado_por(full_name, clientes:cliente_id(nombre_fantasia, razon_social)),
            restaurantes(nombre_restaurante, sigla),
            catalogo_servicios!catalogo_servicio_id(categoria, subcategoria, elemento),
            padre:ticket_padre_id(numero_ticket)
        `)
        .order('fecha_creacion', { ascending: false });


    if (error) {
        console.error("Error al cargar todos los tickets para admin:", error.message);
    }

    return (
        <div className="relative">
            <div className="relative z-[1] max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">

                {/* Breadcrumb */}
                <nav className="flex items-center gap-2 text-sm">
                    <Link href="/dashboard/admin" className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-600 transition-colors font-medium">
                        <ChevronLeft className="w-3.5 h-3.5" />
                        Inicio
                    </Link>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                    <span className="font-black text-slate-700">Vista General</span>
                </nav>

                {/* Header */}
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-100 rounded-2xl">
                        <LayoutGrid className="w-7 h-7 text-indigo-600" />
                    </div>
                    <div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Panel de Control</p>
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                            Vista General
                        </h1>
                        <p className="text-sm text-slate-500 mt-0.5">
                            Hola, {profile?.full_name?.split(' ')[0] ?? 'Administrador'} — todas las solicitudes activas.
                        </p>
                    </div>
                </div>

                <div className="w-full">
                    <TicketsRealtimeListener />
                    <AdminTicketList initialTickets={tickets || []} currentAgentId={user.id} />
                </div>
            </div>
        </div>
    )
}
