'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, PenLine, Loader2, Paperclip, X } from 'lucide-react';
import { agregarEntradaGeneral } from '../actions';
import { FirmaCanvas } from './FirmaCanvas';

type Tab = 'entrada' | 'firma';

const TABS: { id: Tab; label: string; Icon: typeof FileText }[] = [
    { id: 'entrada', label: 'Entrada General', Icon: FileText },
    { id: 'firma',   label: 'Firma Digital',   Icon: PenLine  },
];

const INIT = { error: null as string | null };

export function NuevaEntradaForm({ proyectoId }: { proyectoId: string }) {
    const router  = useRouter();
    const [tab, setTab] = useState<Tab>('entrada');

    // Preview de imagen adjunta
    const fileRef    = useRef<HTMLInputElement>(null);
    const [preview, setPreview] = useState<string | null>(null);

    // Clave del form — incrementar para remontarlo (limpiar inputs) tras éxito
    const [formKey, setFormKey] = useState(0);
    const wasPending = useRef(false);

    const [entradaState, entradaAction, isPending] = useActionState(agregarEntradaGeneral, INIT);

    // Detectar transición pending → done sin error → resetear formulario
    useEffect(() => {
        if (wasPending.current && !isPending && entradaState.error === null) {
            setFormKey(k => k + 1);
            setPreview(null);
        }
        wasPending.current = isPending;
    }, [isPending, entradaState.error]);

    // Limpiar URL del preview al desmontar (evitar memory leak)
    useEffect(() => {
        return () => { if (preview) URL.revokeObjectURL(preview); };
    }, [preview]);

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (preview) URL.revokeObjectURL(preview);
        setPreview(file ? URL.createObjectURL(file) : null);
    }

    function handleRemovePhoto() {
        if (fileRef.current) fileRef.current.value = '';
        if (preview) URL.revokeObjectURL(preview);
        setPreview(null);
    }

    return (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">

            {/* ── Selector de tab ────────────────────────────────── */}
            <div className="flex border-b border-slate-100">
                {TABS.map(({ id, label, Icon }) => (
                    <button
                        key={id}
                        type="button"
                        onClick={() => setTab(id)}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold transition-all ${
                            tab === id
                                ? 'text-slate-900 border-b-2 border-slate-900 -mb-px bg-slate-50/60'
                                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50/30'
                        }`}
                    >
                        <Icon className="w-4 h-4" strokeWidth={1.75} />
                        <span className="hidden sm:inline">{label}</span>
                    </button>
                ))}
            </div>

            {/* ── Tab 1: Entrada General ─────────────────────────── */}
            {tab === 'entrada' && (
                <form key={formKey} action={entradaAction} className="p-4 space-y-3">
                    <input type="hidden" name="proyecto_id" value={proyectoId} />

                    {/* Textarea principal (obligatorio) */}
                    <textarea
                        name="contenido"
                        required
                        rows={3}
                        placeholder="Observaciones, avances o problemas detectados en terreno..."
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-400 transition-all"
                    />

                    {/* ── Input de foto — SIEMPRE montado en el DOM ────────
                        Un solo <input> que nunca se desmonta: el archivo
                        seleccionado se conserva aunque el preview cambie de
                        estado y React re-renderice el bloque visual.          */}
                    <input
                        ref={fileRef}
                        id="foto-adjunto"
                        type="file"
                        name="foto"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileChange}
                    />

                    {/* Presentación condicional: preview vs. botón adjuntar */}
                    {preview ? (
                        <div className="relative group rounded-xl overflow-hidden border border-slate-200">
                            <img
                                src={preview}
                                alt="Vista previa"
                                className="w-full max-h-52 object-cover block"
                            />
                            <button
                                type="button"
                                onClick={handleRemovePhoto}
                                className="absolute top-2 right-2 w-7 h-7 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-colors"
                                title="Quitar imagen"
                            >
                                <X className="w-3.5 h-3.5 text-white" />
                            </button>
                        </div>
                    ) : (
                        <label
                            htmlFor="foto-adjunto"
                            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-700 cursor-pointer transition-colors font-medium select-none"
                        >
                            <Paperclip className="w-4 h-4" strokeWidth={1.75} />
                            Adjuntar foto
                            <span className="text-xs font-normal text-slate-300">(opcional)</span>
                        </label>
                    )}

                    {/* Error */}
                    {entradaState.error && (
                        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                            {entradaState.error}
                        </p>
                    )}

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={isPending}
                        className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
                    >
                        {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                        {isPending ? 'Guardando...' : 'Agregar Entrada'}
                    </button>
                </form>
            )}

            {/* ── Tab 2: Firma Digital ───────────────────────────── */}
            {tab === 'firma' && (
                <div className="p-4">
                    <FirmaCanvas
                        proyectoId={proyectoId}
                        onSuccess={() => {
                            router.refresh();
                            setTab('entrada');
                        }}
                    />
                </div>
            )}
        </div>
    );
}
