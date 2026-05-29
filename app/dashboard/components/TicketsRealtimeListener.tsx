'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function TicketsRealtimeListener() {
    const router = useRouter();
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const supabase = createClient();

        // Debounce de 800ms: consolida múltiples cambios rápidos en un solo router.refresh().
        // Sin esto, cada INSERT/UPDATE dispara un re-fetch completo del Server Component (costoso).
        const scheduleRefresh = () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => router.refresh(), 800);
        };

        const channel = supabase
            .channel('tickets-realtime')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tickets' }, scheduleRefresh)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tickets' }, scheduleRefresh)
            .subscribe();

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            supabase.removeChannel(channel);
        };
    }, []); // [] — router es estable en App Router, no necesita ser dependencia

    return null;
}
