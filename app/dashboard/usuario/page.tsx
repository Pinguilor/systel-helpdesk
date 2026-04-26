import TicketList from './components/TicketList';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import TicketDashboardLayout from './components/TicketDashboardLayout';
import { TicketsRealtimeListener } from '../components/TicketsRealtimeListener';

export default async function usuarioDashboard() {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        redirect('/login');
    }

    // Role verification against the database to prevent cross-dashboard access
    const { data: profile } = await supabase.from('profiles').select('rol, full_name').eq('id', user.id).maybeSingle();

    if (profile?.rol?.toUpperCase() === 'tecnico') {
        redirect('/dashboard/tecnico');
    }

    const firstName = profile?.full_name?.split(' ')[0] ?? 'Usuario';

    return (
        <>
        <TicketsRealtimeListener />
        <TicketDashboardLayout
            greeting={
                <div className="px-4 sm:px-0">
                    <p className="text-sm font-semibold text-slate-400 tracking-wide uppercase">Panel de Control</p>
                    <h1 className="text-3xl font-extrabold text-slate-950 tracking-tight">
                        Hola, {firstName} 👋
                    </h1>
                </div>
            }
            dataTable={<TicketList />}
        />
        </>
    );
}
