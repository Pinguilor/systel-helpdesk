import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { User as UserIcon, Mail, Shield, Calendar } from 'lucide-react';

export default async function PerfilDashboard() {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        redirect('/login');
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

    if (!profile) {
        return <div className="p-8 text-center text-red-500">Error: Perfil no encontrado</div>;
    }

    const formattedDate = new Date(profile.created_at).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    return (
        <div className="max-w-4xl mx-auto py-8 sm:px-6 lg:px-8 space-y-8">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Mi Perfil</h1>
                    <p className="mt-1 text-sm text-slate-500">Administra tu cuenta e información personal.</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="bg-slate-50 border-b border-gray-100 px-8 py-6 flex items-center gap-6">
                    <div className="h-24 w-24 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-4xl font-bold border-4 border-white shadow-sm">
                        {profile.full_name ? profile.full_name.charAt(0).toUpperCase() : <UserIcon className="w-10 h-10" />}
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900">{profile.full_name || 'Desconocido'}</h2>
                        <div className="mt-2 flex items-center gap-2">
                            <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider border border-indigo-100 flex items-center gap-1">
                                <Shield className="w-3 h-3" />
                                {profile.rol}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="p-8">
                    <h3 className="text-lg font-bold text-slate-900 mb-6 border-b border-gray-100 pb-2">Detalles de la Cuenta</h3>

                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-8">
                        <div className="sm:col-span-1">
                            <dt className="text-sm font-medium text-slate-500 flex items-center gap-2">
                                <UserIcon className="w-4 h-4" />
                                Nombre Completo
                            </dt>
                            <dd className="mt-1 text-base font-semibold text-slate-900">{profile.full_name || 'No especificado'}</dd>
                        </div>

                        <div className="sm:col-span-1">
                            <dt className="text-sm font-medium text-slate-500 flex items-center gap-2">
                                <Mail className="w-4 h-4" />
                                Correo Electrónico
                            </dt>
                            <dd className="mt-1 text-base font-semibold text-slate-900">{user.email}</dd>
                        </div>

                        <div className="sm:col-span-1">
                            <dt className="text-sm font-medium text-slate-500 flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                Miembro Desde
                            </dt>
                            <dd className="mt-1 text-base font-semibold text-slate-900">{formattedDate}</dd>
                        </div>

                        <div className="sm:col-span-1">
                            <dt className="text-sm font-medium text-slate-500">
                                Identificador de Cuenta (ID)
                            </dt>
                            <dd className="mt-1 text-xs font-mono text-slate-400 break-all">{user.id}</dd>
                        </div>
                    </dl>
                </div>
            </div>
        </div>
    );
}
