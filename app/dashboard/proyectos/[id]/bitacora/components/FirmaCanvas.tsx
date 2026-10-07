'use client';

import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { compressImage } from '@/lib/compressImage';
import SignatureCanvas from 'react-signature-canvas';
import { computeSHA256 } from '@/lib/sha256';
import { Loader2, Eraser, CheckCircle2, PenLine, Camera, X } from 'lucide-react';

interface Props {
    proyectoId: string;
    onSuccess: () => void;
}

const MAX_EVIDENCIAS = 5;

type Evidencia = { id: string; file: File; previewUrl: string };

export function FirmaCanvas({ proyectoId, onSuccess }: Props) {
    const sigRef = useRef<SignatureCanvas>(null);
    const [nombre,         setNombre]         = useState('');
    const [cargo,          setCargo]          = useState('');
    const [observaciones,  setObservaciones]  = useState('');
    const [saving,         setSaving]         = useState(false);
    const [error,          setError]          = useState<string | null>(null);
    const [isEmpty,        setIsEmpty]        = useState(true);
    const fileRef = useRef<HTMLInputElement>(null);
    const [evidencias,      setEvidencias]      = useState<Evidencia[]>([]);
    const [isCompressing,   setIsCompressing]   = useState(false);
    const [progress,        setProgress]        = useState<{ current: number; total: number } | null>(null);

    async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
        const files = Array.from(e.target.files ?? []).filter(f => f.type.startsWith('image/'));
        const toProcess = files.slice(0, MAX_EVIDENCIAS - evidencias.length);
        if (fileRef.current) fileRef.current.value = '';
        if (!toProcess.length) return;

        setIsCompressing(true);
        setError(null);
        const nuevas: Evidencia[] = [];
        for (const file of toProcess) {
            const compressed = await compressImage(file);
            nuevas.push({ id: crypto.randomUUID(), file: compressed, previewUrl: URL.createObjectURL(compressed) });
        }
        setEvidencias(prev => [...prev, ...nuevas]);
        setIsCompressing(false);
    }

    function removeEvidencia(id: string) {
        setEvidencias(prev => {
            const ev = prev.find(x => x.id === id);
            if (ev) URL.revokeObjectURL(ev.previewUrl);
            return prev.filter(x => x.id !== id);
        });
    }

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

            // 3. Subir evidencias directo browser→Storage (evita el límite de body del server)
            const evidenciaUrls: string[] = [];
            if (evidencias.length) {
                const supabase = createClient();
                for (let i = 0; i < evidencias.length; i++) {
                    setProgress({ current: i + 1, total: evidencias.length });
                    const file = evidencias[i].file;
                    const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
                    const path = `firmas/${proyectoId}/evidencia/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
                    const { error: upErr } = await supabase.storage
                        .from('proyectos-assets')
                        .upload(path, file, { contentType: file.type });
                    if (upErr) throw new Error(`Error al subir evidencia ${i + 1}: ${upErr.message}`);
                    evidenciaUrls.push(supabase.storage.from('proyectos-assets').getPublicUrl(path).data.publicUrl);
                }
                setProgress(null);
            }

            // 4. POST al API route
            const fd = new FormData();
            fd.append('firma',          blob, 'firma.png');
            fd.append('proyectoId',     proyectoId);
            fd.append('nombre',         nombre.trim());
            fd.append('cargo',          cargo.trim());
            fd.append('hash',           hash);
            fd.append('observaciones',  observaciones.trim());
            fd.append('evidencias',     JSON.stringify(evidenciaUrls));

            // 5. Geolocalización opcional (no bloquea la firma si se rechaza)
            const pos = await new Promise<GeolocationPosition | null>(resolve => {
                if (!navigator.geolocation) return resolve(null);
                navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), {
                    enableHighAccuracy: true, timeout: 8000, maximumAge: 0,
                });
            });
            if (pos) {
                fd.append('latitud',  String(pos.coords.latitude));
                fd.append('longitud', String(pos.coords.longitude));
            }

            const apiRes = await fetch('/api/proyectos/firma', { method: 'POST', body: fd });

            // La API siempre devuelve JSON (gracias al try/catch en route.ts)
            const json = await apiRes.json();
            if (!apiRes.ok) throw new Error(json.error ?? 'Error al guardar la firma');

            onSuccess();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error inesperado');
        } finally {
            setProgress(null);
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

            {/* Evidencia fotográfica (máx. 5) */}
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                    Evidencia fotográfica{' '}
                    <span className="font-normal text-slate-400">(opcional · máx. {MAX_EVIDENCIAS})</span>
                </label>

                {evidencias.length > 0 && (
                    <div className="grid grid-cols-5 gap-2 mb-2">
                        {evidencias.map(ev => (
                            <div key={ev.id} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                                <img src={ev.previewUrl} alt="Evidencia" className="w-full h-full object-cover" />
                                <button
                                    type="button"
                                    onClick={() => removeEvidencia(ev.id)}
                                    disabled={saving}
                                    className="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center disabled:pointer-events-none"
                                >
                                    <X className="w-3 h-3 text-white" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {evidencias.length < MAX_EVIDENCIAS && (
                    <button
                        type="button"
                        disabled={saving || isCompressing}
                        onClick={() => fileRef.current?.click()}
                        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-700 disabled:opacity-60 transition-colors font-medium select-none"
                    >
                        {isCompressing ? (
                            <><Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} />Procesando imágenes...</>
                        ) : (
                            <><Camera className="w-4 h-4" strokeWidth={1.75} />
                                {evidencias.length > 0 ? `Agregar más fotos (${evidencias.length}/${MAX_EVIDENCIAS})` : 'Adjuntar fotos'}</>
                        )}
                    </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
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
                disabled={saving || isEmpty || isCompressing}
                className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
                {saving ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {progress ? `Subiendo foto ${progress.current} de ${progress.total}...` : 'Generando acta...'}
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
