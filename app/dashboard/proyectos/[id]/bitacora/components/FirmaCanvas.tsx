'use client';

import { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { computeSHA256 } from '@/lib/sha256';
import { Loader2, Eraser, CheckCircle2, PenLine } from 'lucide-react';

interface Props {
    proyectoId: string;
    onSuccess: () => void;
}

export function FirmaCanvas({ proyectoId, onSuccess }: Props) {
    const sigRef = useRef<SignatureCanvas>(null);
    const [nombre,         setNombre]         = useState('');
    const [cargo,          setCargo]          = useState('');
    const [observaciones,  setObservaciones]  = useState('');
    const [saving,         setSaving]         = useState(false);
    const [error,          setError]          = useState<string | null>(null);
    const [isEmpty,        setIsEmpty]        = useState(true);

    async function handleGuardar() {
        if (isEmpty) {
            setError('Dibuja la firma en el recuadro antes de confirmar.');
            return;
        }
        if (!nombre.trim()) {
            setError('El nombre del firmante es obligatorio.');
            return;
        }
        setSaving(true);
        setError(null);

        try {
            // 1. Exportar canvas como PNG
            const dataUrl  = sigRef.current!.getTrimmedCanvas().toDataURL('image/png');
            const response = await fetch(dataUrl);
            const blob     = await response.blob();

            // 2. SHA-256 nativo via Web Crypto API
            const hash = await computeSHA256(blob);

            // 3. POST al API route
            const fd = new FormData();
            fd.append('firma',          blob, 'firma.png');
            fd.append('proyectoId',     proyectoId);
            fd.append('nombre',         nombre.trim());
            fd.append('cargo',          cargo.trim());
            fd.append('hash',           hash);
            fd.append('observaciones',  observaciones.trim());

            const apiRes = await fetch('/api/proyectos/firma', { method: 'POST', body: fd });

            // La API siempre devuelve JSON (gracias al try/catch en route.ts)
            const json = await apiRes.json();
            if (!apiRes.ok) throw new Error(json.error ?? 'Error al guardar la firma');

            onSuccess();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error inesperado');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="space-y-4">

            {/* Nombre y cargo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                        Nombre del firmante *
                    </label>
                    <input
                        value={nombre}
                        onChange={e => setNombre(e.target.value)}
                        placeholder="Ej: Carlos Pérez"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-400 transition-all"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                        Cargo <span className="font-normal text-slate-400">(opcional)</span>
                    </label>
                    <input
                        value={cargo}
                        onChange={e => setCargo(e.target.value)}
                        placeholder="Ej: Gerente de Local"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-400 transition-all"
                    />
                </div>
            </div>

            {/* Observaciones del documento */}
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                    Observaciones del documento{' '}
                    <span className="font-normal text-slate-400">(opcional)</span>
                </label>
                <textarea
                    value={observaciones}
                    onChange={e => setObservaciones(e.target.value)}
                    rows={2}
                    placeholder="Ej: Conforme con la instalación del sistema de caja en piso 2..."
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-400 transition-all"
                />
            </div>

            {/* Canvas de firma */}
            <div>
                <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                        <PenLine className="w-3.5 h-3.5" />
                        Firma digital *
                    </label>
                    <button
                        type="button"
                        onClick={() => { sigRef.current?.clear(); setIsEmpty(true); }}
                        className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 transition-colors font-medium"
                    >
                        <Eraser className="w-3 h-3" />
                        Limpiar
                    </button>
                </div>

                <div className={`border-2 rounded-xl overflow-hidden transition-colors touch-none ${
                    isEmpty ? 'border-dashed border-slate-300 bg-slate-50' : 'border-slate-300 bg-white'
                }`}>
                    <SignatureCanvas
                        ref={sigRef}
                        penColor="#0f172a"
                        canvasProps={{
                            className: 'w-full block',
                            style: { height: '180px', display: 'block', width: '100%' },
                        }}
                        backgroundColor="transparent"
                        onBegin={() => setIsEmpty(false)}
                    />
                </div>

                <p className="text-[10px] text-slate-400 mt-1.5">
                    SHA-256 del trazo calculado al confirmar — garantiza inmutabilidad del documento
                </p>
            </div>

            {/* Error */}
            {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                    {error}
                </p>
            )}

            {/* Submit */}
            <button
                type="button"
                onClick={handleGuardar}
                disabled={saving || isEmpty}
                className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
                {saving ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Guardando firma...
                    </>
                ) : (
                    <>
                        <CheckCircle2 className="w-4 h-4" strokeWidth={2.5} />
                        Confirmar Firma
                    </>
                )}
            </button>
        </div>
    );
}
