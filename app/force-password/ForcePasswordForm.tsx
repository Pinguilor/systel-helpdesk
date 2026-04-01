'use client';

import { useState, useTransition } from 'react';
import { Eye, EyeOff, Loader2, KeyRound, AlertTriangle } from 'lucide-react';
import { cambiarPasswordAction } from './actions';

export default function ForcePasswordForm() {
    const [isPending, startTransition] = useTransition();
    const [error, setError]            = useState('');
    const [showActual, setShowActual]  = useState(false);
    const [showNueva, setShowNueva]    = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError('');
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
            const res = await cambiarPasswordAction(fd);
            if (res?.error) setError(res.error);
            // Si no hay error, la action hace redirect('/dashboard')
        });
    };

    const inputClass = "w-full border-2 border-slate-200 rounded-xl px-3 py-2.5 pr-10 text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white";
    const labelClass = "block text-xs font-black text-slate-600 uppercase tracking-widest mb-1.5";

    return (
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            {/* Header de advertencia */}
            <div className="bg-amber-50 border-b border-amber-200 px-6 py-4 flex items-start gap-3">
                <KeyRound className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                    <p className="text-sm font-black text-amber-900">Contraseña temporal activa</p>
                    <p className="text-xs text-amber-700 mt-0.5">
                        Valida tu identidad ingresando la contraseña temporal que te fue asignada y establece una nueva clave segura.
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {/* Contraseña actual */}
                <div>
                    <label className={labelClass}>Contraseña Actual</label>
                    <div className="relative">
                        <input
                            name="password_actual"
                            type={showActual ? 'text' : 'password'}
                            required
                            placeholder="••••••••"
                            className={inputClass}
                        />
                        <button type="button" onClick={() => setShowActual(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            {showActual ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                {/* Divider */}
                <div className="border-t border-slate-100" />

                {/* Nueva contraseña */}
                <div>
                    <label className={labelClass}>Nueva Contraseña</label>
                    <div className="relative">
                        <input
                            name="password_nueva"
                            type={showNueva ? 'text' : 'password'}
                            required
                            minLength={8}
                            placeholder="Mínimo 8 caracteres"
                            className={inputClass}
                        />
                        <button type="button" onClick={() => setShowNueva(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            {showNueva ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                {/* Confirmar contraseña */}
                <div>
                    <label className={labelClass}>Confirmar Nueva Contraseña</label>
                    <div className="relative">
                        <input
                            name="password_confirm"
                            type={showConfirm ? 'text' : 'password'}
                            required
                            minLength={8}
                            placeholder="Repite la nueva contraseña"
                            className={inputClass}
                        />
                        <button type="button" onClick={() => setShowConfirm(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-red-700 text-sm font-medium">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={isPending}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white text-sm font-black rounded-xl hover:bg-indigo-700 transition-all shadow-md active:scale-95 disabled:opacity-40 mt-2"
                >
                    {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                    {isPending ? 'Guardando…' : 'Establecer nueva contraseña'}
                </button>
            </form>

            {/* Vía de escape: cerrar sesión */}
            <div className="px-6 pb-5">
                <button
                    type="button"
                    onClick={async () => {
                        // El fetch deja que el servidor limpie las cookies en su respuesta
                        // antes de que window.location fuerce una recarga limpia
                        await fetch('/auth/signout', { method: 'POST' });
                        window.location.href = '/login';
                    }}
                    className="w-full py-2 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors"
                >
                    Cancelar y cerrar sesión
                </button>
            </div>
        </div>
    );
}
