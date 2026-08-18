'use client';

import { useState, useTransition } from 'react';
import { X, Loader2, Building2, AlertTriangle, Save, Plus } from 'lucide-react';
import {
    crearProveedorAdminAction,
    actualizarProveedorAction,
    type ProveedorDetalle,
    type ProveedorFormData,
} from '../actions';

interface Props {
    proveedor: ProveedorDetalle | null;   // null = modo creación
    onClose:   () => void;
    onSaved:   (p: ProveedorDetalle) => void;
}

export function ProveedorFormModal({ proveedor, onClose, onSaved }: Props) {
    const isEdit = !!proveedor;
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const [nombre,    setNombre]    = useState(proveedor?.nombre    ?? '');
    const [rut,       setRut]       = useState(proveedor?.rut       ?? '');
    const [email,     setEmail]     = useState(proveedor?.email     ?? '');
    const [telefono,  setTelefono]  = useState(proveedor?.telefono  ?? '');
    const [direccion, setDireccion] = useState(proveedor?.direccion ?? '');

    function handleSubmit() {
        const formData: ProveedorFormData = { nombre, rut, email, telefono, direccion };

        startTransition(async () => {
            setError(null);

            if (isEdit) {
                const result = await actualizarProveedorAction(proveedor!.id, formData);
                if (result.error) { setError(result.error); return; }
                onSaved({
                    ...proveedor!,
                    nombre:    nombre.trim(),
                    rut:       rut.trim()       || null,
                    email:     email.trim()     || null,
                    telefono:  telefono.trim()  || null,
                    direccion: direccion.trim() || null,
                });
            } else {
                const result = await crearProveedorAdminAction(formData);
                if (result.error || !result.id) { setError(result.error ?? 'Error desconocido.'); return; }
                onSaved({
                    id:          result.id,
                    nombre:      nombre.trim(),
                    rut:         rut.trim()       || null,
                    email:       email.trim()     || null,
                    telefono:    telefono.trim()  || null,
                    direccion:   direccion.trim() || null,
                    created_at:  new Date().toISOString(),
                    total_guias: 0,
                });
            }
        });
    }

    const gradiente = isEdit
        ? 'from-indigo-500 to-violet-600'
        : 'from-emerald-500 to-teal-500';

    return (
        <div
            className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100">
                <div className={`h-1.5 w-full bg-gradient-to-r ${gradiente}`} />

                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-5 pb-4">
                    <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                            isEdit ? 'bg-indigo-50 border-indigo-200' : 'bg-emerald-50 border-emerald-200'
                        }`}>
                            {isEdit
                                ? <Building2 className="w-4 h-4 text-indigo-500" />
                                : <Plus      className="w-4 h-4 text-emerald-500" />
                            }
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Proveedores
                            </p>
                            <h2 className="text-sm font-black text-slate-900">
                                {isEdit ? 'Editar Proveedor' : 'Nuevo Proveedor'}
                            </h2>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="px-6 pb-6 space-y-4">
                    {/* Nombre */}
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                            Nombre <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            value={nombre}
                            onChange={e => setNombre(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
                            placeholder="Ej: Ingram Micro Chile S.A."
                            autoFocus
                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 transition-colors"
                        />
                    </div>

                    {/* RUT + Teléfono */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                                RUT
                            </label>
                            <input
                                type="text"
                                value={rut}
                                onChange={e => setRut(e.target.value)}
                                placeholder="76.123.456-7"
                                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                                Teléfono
                            </label>
                            <input
                                type="text"
                                value={telefono}
                                onChange={e => setTelefono(e.target.value)}
                                placeholder="+56 9 1234 5678"
                                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 transition-colors"
                            />
                        </div>
                    </div>

                    {/* Email */}
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                            Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="contacto@proveedor.cl"
                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 transition-colors"
                        />
                    </div>

                    {/* Dirección */}
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                            Dirección
                        </label>
                        <textarea
                            value={direccion}
                            onChange={e => setDireccion(e.target.value)}
                            placeholder="Av. Providencia 1234, Santiago"
                            rows={2}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 transition-colors resize-none"
                        />
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                            {error}
                        </div>
                    )}

                    {/* Acciones */}
                    <div className="flex gap-3 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={isPending || !nombre.trim()}
                            className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-black text-white transition-all ${
                                isPending || !nombre.trim()
                                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                    : `bg-gradient-to-r ${gradiente} hover:opacity-90 shadow-sm hover:scale-[1.01] active:scale-[0.99]`
                            }`}
                        >
                            {isPending ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</>
                            ) : (
                                <><Save className="w-4 h-4" /> {isEdit ? 'Guardar cambios' : 'Crear proveedor'}</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
