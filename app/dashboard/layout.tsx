import { createClient } from '@/lib/supabase/server';
import TopNav from './components/TopNav';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createClient();

    // Auth Check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        redirect('/login');
    }

    // Get User Profile for the Navbar
    const { data: profile } = await supabase.from('profiles').select('full_name, rol').eq('id', user.id).maybeSingle();

    return (
        <div className="min-h-screen bg-brand-bg-base text-slate-900 font-sans">
            <TopNav
                userFullName={profile?.full_name || null}
                userRole={profile?.rol || null}
            />
            {/* The main container limits width globally to match the navbar */}
            <main>
                {children}
            </main>
        </div>
    );
}
