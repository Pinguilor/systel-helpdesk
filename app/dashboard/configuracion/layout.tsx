import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ConfigSidebar } from './components/ConfigSidebar';

export default async function ConfiguracionLayout({ children }: { children: React.ReactNode }) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const { data: profile } = await supabase
        .from('profiles')
        .select('rol, full_name')
        .eq('id', user.id)
        .maybeSingle();

    const rol = profile?.rol?.toLowerCase() ?? '';
    if (rol !== 'admin' && rol !== 'coordinador') redirect('/dashboard');

    return (
        <ConfigSidebar
            rol={rol}
            nombre={profile?.full_name ?? null}
        >
            {children}
        </ConfigSidebar>
    );
}
