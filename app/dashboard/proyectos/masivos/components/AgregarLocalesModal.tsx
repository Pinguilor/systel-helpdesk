'use client';

// REGLA DE DISEÑO: NUNCA usar <select> nativo ni alert/confirm/prompt nativos.

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { CustomSelect } from '@/app/dashboard/components/CustomSelect';
import type { LocalMasivo } from '../actions';
import { agregarLocalesMasivoAction, getDatosAgregarMasivo } from '../gestion-actions';
import { LocalesPicker } from './LocalesPicker';

interface Datos {
    empresas: { id: string; nombre_fantasia: string }[];
    locales: LocalMasivo[];
    plantillasChecklist: { id: string; nombre: string }[];
    recetasBOM: { id: string; nombre: string }[];
}

interface Props {
    padreId: string;
    nombreProyecto: string;
    onClose: () => void;
}

export function AgregarLocalesModal({ padreId, nombreProyecto, onClose }: Props) {
    const router = useRouter();
    const [datos, setDatos] = useState<Datos | null>(null);
    const [cargaError, setCargaError] = useState<string | null>(null);
    const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
    const [plantillaId, setPlantillaId] = useState('');
    const [recetaId, setRecetaId] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const enviandoRef = useRef(false);
    const [listo, setListo] = useState(false);
    const bloqueado = isPending || listo;

    useEffect(() => {
        getDatosAgregarMasivo(padreId)
            .then(setDatos)
            .catch(() => setCargaError('No se pudieron cargar los locales. Cierra e inténtalo de nuevo.'));
    }, [padreId]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !bloqueado) onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose, bloqueado]);

    function confirmar() {
        if (enviandoRef.current || bloqueado || seleccion.size === 0) return;
        enviandoRef.current = true;
        setError(null);
        startTransition(async () => {
            try {
                const res = await agregarLocalesMasivoAction({
                    padreId,
                    localIds: [...seleccion],
                    plantillaChecklistId: plantillaId || null,
                    recetaBomId: recetaId || null,
                });
                if (res.error) {
                    setError(res.error);
                    enviandoRef.current = false;
                    return;
                }
                setListo(true);
                router.refresh();
                onClose();
            } catch {
                setError('No se pudo completar la operación. Revisa tu conexión e inténtalo de nuevo.');
                enviandoRef.current = false;
            }
        });
    }

    const n = seleccion.size;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === e.currentTarget && !bloqueado) onClose(); }}
        >
            <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl border border-slate-100 shadow-2xl p-6 space-y-5 font-sans">
                <button onClick={onClose} disabled={bloqueado}
                    className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 disabled:opacity-50 transition-colors cursor-pointer">
                    <X className="w-4 h-4 text-slate-500" />
                </button>

                <div className="pr-8">
                    <h3 className="text-base font-black text-slate-900">Agregar locales</h3>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">A «{nombreProyecto}». Se crea un proyecto por cada local.</p>
                </div>

                {cargaError ? (
                    <p className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{cargaError}</p>
                ) : !datos ? (
                    <div className="flex items-center justify-center gap-2 py-16 text-slate-400 text-xs font-bold">
                        <Loader2 className="w-4 h-4 animate-spin" /> Cargando locales...
                    </div>
                ) : (
                    <>
                        <LocalesPicker locales={datos.locales} empresas={datos.empresas}
                            seleccion={seleccion} onChange={setSeleccion} alturaLista="max-h-[300px]" />

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest">
                                    Plantilla de Checklist <span className="normal-case font-normal text-[10px] text-slate-400 tracking-normal">(opcional)</span>
                                </label>
                                <CustomSelect id="agregar-checklist" value={plantillaId} onChange={setPlantillaId}
                                    options={[{ value: '', label: '— Sin plantilla —' }, ...datos.plantillasChecklist.map(p => ({ value: p.id, label: p.nombre }))]}
                                    placeholder="— Sin plantilla —" strategy="fixed" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest">
                                    Receta Maestra <span className="normal-case font-normal text-[10px] text-slate-400 tracking-normal">(opcional)</span>
                                </label>
                                <CustomSelect id="agregar-receta" value={recetaId} onChange={setRecetaId}
                                    options={[{ value: '', label: '— Sin receta —' }, ...datos.recetasBOM.map(r => ({ value: r.id, label: r.nombre }))]}
                                    placeholder="— Sin receta —" strategy="fixed" />
                            </div>
                        </div>
                        <p className="text-[11px] text-slate-400 font-medium -mt-2">
                            Usa la misma plantilla y receta que el resto del proyecto si quieres que los nuevos locales queden iguales.
                        </p>
                    </>
                )}

                {error && (
                    <div className="flex items-start gap-2 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
                        <span>{error}</span>
                    </div>
                )}

                <div className="flex gap-3 pt-2 border-t border-slate-100">
                    <button type="button" onClick={onClose} disabled={bloqueado}
                        className="flex-1 py-3 border border-slate-200 text-slate-500 rounded-xl text-xs font-bold hover:bg-slate-50 disabled:opacity-50 transition-all uppercase tracking-wider cursor-pointer">
                        Cancelar
                    </button>
                    <button type="button" onClick={confirmar} disabled={bloqueado || n === 0 || !datos}
                        className="flex-[2] py-3 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed transition-all uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer">
                        {bloqueado && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        {bloqueado
                            ? `Creando ${n} proyecto${n === 1 ? '' : 's'}, por favor espera...`
                            : n === 0 ? 'Selecciona locales' : `Agregar ${n} local${n === 1 ? '' : 'es'}`}
                    </button>
                </div>
            </div>
        </div>
    );
}
