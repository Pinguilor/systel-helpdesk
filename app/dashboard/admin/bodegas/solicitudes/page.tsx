import { createClient } from '@/lib/supabase/server';
import { redirect }     from 'next/navigation';
import { GestionSolicitudesClient } from './GestionSolicitudesClient';
import {
    getSolicitudesMaterialesAction,
    getSolicitudesDevolucionAction,
    getBodegasCentralesAction,
    getPendientesLogisticaInversaAction,
    getLotesPendientesLogisticaInversaAction,
} from './actions';

export const metadata = {
    title: 'Gestión de Solicitudes y Devoluciones — Systel Loop',
    description: 'Bandeja unificada de entregas y reingresos de materiales.',
};

export default async function SolicitudesPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect('/login');

    const { data: profile } = await supabase
        .from('profiles')
        .select('rol')
        .eq('id', user.id)
        .maybeSingle();

    const rol = profile?.rol?.toUpperCase() || '';

    if (!['ADMIN_BODEGA', 'ADMIN', 'COORDINADOR'].includes(rol)) {
        redirect('/dashboard');
    }

    const [solicitudesResult, devolucionesResult, bodegasResult, logisticaResult, lotesResult] = await Promise.all([
        getSolicitudesMaterialesAction(),
        getSolicitudesDevolucionAction(),
        getBodegasCentralesAction(),
        getPendientesLogisticaInversaAction(),
        getLotesPendientesLogisticaInversaAction(),
    ]);

    return (
        <GestionSolicitudesClient
            solicitudes={solicitudesResult.data ?? []}
            devoluciones={devolucionesResult.data ?? []}
            devolucionesLogistica={logisticaResult.data ?? []}
            lotesLogistica={lotesResult.data ?? []}
            bodegasCentrales={bodegasResult.data ?? []}
            totalSolicitudesAprobadas={(solicitudesResult as any).totalAprobadas ?? 0}
            totalSolicitudesRechazadas={(solicitudesResult as any).totalRechazadas ?? 0}
            totalDevolucionesAprobadas={(devolucionesResult as any).totalAprobadas ?? 0}
            totalDevolucionesRechazadas={(devolucionesResult as any).totalRechazadas ?? 0}
        />
    );
}
