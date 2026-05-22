import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AnalyticsCharts from './components/AnalyticsCharts';
import { AreaChart, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default async function AnaliticasPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect('/login');

    const { data: profile } = await supabase
        .from('profiles')
        .select('rol, full_name')
        .eq('id', user.id)
        .maybeSingle();

    if (!profile) redirect('/login');

    const userRole = profile?.rol?.toUpperCase() || '';

    let ticketQuery = supabase.from('tickets').select(`
        *,
        agente:agente_asignado_id(full_name),
        restaurantes(nombre_restaurante, sigla),
        categoria:ticket_categorias!categoria_id(nombre),
        tipo_servicio:ticket_tipos_servicio!tipo_servicio_id(nombre)
    `);

    if (userRole === 'USUARIO') {
        ticketQuery = ticketQuery.eq('creado_por', user.id);
    }

    const { data: tickets, error } = await ticketQuery.order('fecha_creacion', { ascending: false });

    if (error) console.error('Error cargando tickets para analíticas:', error);

    return (
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">

            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm">
                <Link
                    href={userRole === 'USUARIO' ? '/dashboard/usuario' : '/dashboard/admin'}
                    className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-600 transition-colors font-medium"
                >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Inicio
                </Link>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                <span className="font-black text-slate-700">Análisis y Reportes</span>
            </nav>

            {/* Header — mismo patrón que Trazabilidad */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-100 rounded-2xl">
                        <AreaChart className="w-7 h-7 text-indigo-600" />
                    </div>
                    <div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Reportería</p>
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                            Análisis y Reportes
                        </h1>
                        <p className="text-sm text-slate-500 mt-0.5">
                            {userRole !== 'USUARIO'
                                ? 'Visión global de todas las solicitudes en la plataforma.'
                                : 'Métricas y estadísticas sobre tus solicitudes.'}
                        </p>
                    </div>
                </div>
            </div>

            <AnalyticsCharts tickets={tickets || []} isStaff={userRole !== 'USUARIO'} />
        </div>
    );
}
