'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, PenLine, Loader2, Camera, X } from 'lucide-react';
import { agregarEntradaGeneral, subirFotoBitacora, crearEntradaFotos } from '../actions';
import { FirmaCanvas } from './FirmaCanvas';

type Tab = 'entrada' | 'firma';

const TABS: { id: Tab; label: string; Icon: typeof FileText }[] = [
    { id: 'entrada', label: 'Entrada General', Icon: FileText },
    { id: 'firma',   label: 'Firma Digital',   Icon: PenLine  },
];

type PhotoItem = { id: string; file: File; previewUrl: string };

async function compressImage(file: File, maxWidth = 1920, quality = 0.75): Promise<File> {
    if (file.size < 300 * 1024) return file; // ya es pequeño, no comprimir

    return new Promise(resolve => {
        const img = new Image();
        const objUrl = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(objUrl);
            const scale = img.width > maxWidth ? maxWidth / img.width : 1;
            const canvas = document.createElement('canvas');
            canvas.width  = Math.round(img.width  * scale);
            canvas.height = Math.round(img.height * scale);
            canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(
                blob => {
                    if (!blob) { resolve(file); return; }
                    resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
                        type: 'image/jpeg',
                        lastModified: Date.now(),
                    }));
                },
                'image/jpeg',
                quality
            );
        };
        img.onerror = () => { URL.revokeObjectURL(objUrl); resolve(file); };
        img.src = objUrl;
    });
}

const MAX_PHOTOS = 10;

export function NuevaEntradaForm({ proyectoId }: { proyectoId: string }) {
    const router  = useRouter();
    const fileRef = useRef<HTMLInputElement>(null);
    const [tab, setTab] = useState<Tab>('entrada');

    const [contenido,     setContenido]     = useState('');
    const [photos,        setPhotos]        = useState<PhotoItem[]>([]);
    const [isCompressing, setIsCompressing] = useState(false);
    const [isSubmitting,  setIsSubmitting]  = useState(false);
    const [uploadProgress,setUploadProgress]= useState<{ current: number; total: number } | null>(null);
    const [error,         setError]         = useState<string | null>(null);
    const [formKey,       setFormKey]       = useState(0);

    async function handleFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
        const files = Array.from(e.target.files ?? []);
        if (!files.length) return;

        const slots = MAX_PHOTOS - photos.length;
        const toProcess = files.slice(0, slots);
        if (!toProcess.length) return;

        setIsCompressing(true);
        setError(null);
        const newPhotos: PhotoItem[] = [];

        for (const file of toProcess) {
            const compressed = await compressImage(file);
            newPhotos.push({
                id: crypto.randomUUID(),
                file: compressed,
                previewUrl: URL.createObjectURL(compressed),
            });
        }

        setPhotos(prev => [...prev, ...newPhotos]);
        setIsCompressing(false);
        if (fileRef.current) fileRef.current.value = '';
    }

    function removePhoto(id: string) {
        setPhotos(prev => {
            const p = prev.find(x => x.id === id);
            if (p) URL.revokeObjectURL(p.previewUrl);
            return prev.filter(x => x.id !== id);
        });
    }

    function reset() {
        photos.forEach(p => URL.revokeObjectURL(p.previewUrl));
        setPhotos([]);
        setContenido('');
        setUploadProgress(null);
        setError(null);
        setFormKey(k => k + 1);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!contenido.trim()) {
            setError('El texto de la entrada es obligatorio.');
            return;
        }
        setError(null);
        setIsSubmitting(true);

        try {
            if (photos.length === 0) {
                // Ruta: solo texto
                const fd = new FormData();
                fd.append('proyecto_id', proyectoId);
                fd.append('contenido', contenido);
                const res = await agregarEntradaGeneral({ error: null }, fd);
                if (res.error) { setError(res.error); return; }
            } else {
                // Ruta: fotos — subida secuencial con progreso
                const urls: string[] = [];
                for (let i = 0; i < photos.length; i++) {
                    setUploadProgress({ current: i + 1, total: photos.length });
                    const fd = new FormData();
                    fd.append('proyecto_id', proyectoId);
                    fd.append('foto', photos[i].file);
                    const res = await subirFotoBitacora(fd);
                    if (res.error) { setError(res.error); setUploadProgress(null); return; }
                    urls.push(res.url!);
                }
                setUploadProgress(null);
                const res = await crearEntradaFotos(proyectoId, contenido, urls);
                if (res.error) { setError(res.error); return; }
            }

            reset();
            router.refresh();
        } catch {
            setError('Error inesperado. Intenta nuevamente.');
            setUploadProgress(null);
        } finally {
            setIsSubmitting(false);
        }
    }

    const busy = isSubmitting || isCompressing;

    return (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">

            {/* ── Selector de tab ─────────────────────────────────── */}
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
                <form key={formKey} onSubmit={handleSubmit} className="p-4 space-y-3">

                    {/* Textarea */}
                    <textarea
                        value={contenido}
                        onChange={e => setContenido(e.target.value)}
                        required
                        rows={3}
                        placeholder="Observaciones, avances o problemas detectados en terreno..."
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-400 transition-all"
                    />

                    {/* Input oculto — múltiples archivos */}
                    <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleFilesChange}
                    />

                    {/* Galería de previews */}
                    {photos.length > 0 && (
                        <div className="grid grid-cols-3 gap-2">
                            {photos.map(p => (
                                <div
                                    key={p.id}
                                    className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-100"
                                >
                                    <img
                                        src={p.previewUrl}
                                        alt="Vista previa"
                                        className="w-full h-full object-cover"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removePhoto(p.id)}
                                        disabled={busy}
                                        className="absolute top-1 right-1 w-6 h-6 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-colors disabled:pointer-events-none"
                                    >
                                        <X className="w-3 h-3 text-white" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Botón adjuntar */}
                    {photos.length < MAX_PHOTOS && (
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => fileRef.current?.click()}
                            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-700 disabled:opacity-60 transition-colors font-medium select-none"
                        >
                            {isCompressing ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} />
                                    Procesando imágenes...
                                </>
                            ) : (
                                <>
                                    <Camera className="w-4 h-4" strokeWidth={1.75} />
                                    {photos.length > 0
                                        ? `Agregar más fotos (${photos.length}/${MAX_PHOTOS})`
                                        : 'Adjuntar fotos'}
                                    {photos.length === 0 && (
                                        <span className="text-xs font-normal text-slate-300">(opcional)</span>
                                    )}
                                </>
                            )}
                        </button>
                    )}

                    {/* Error */}
                    {error && (
                        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                            {error}
                        </p>
                    )}

                    {/* Submit / Barra de progreso */}
                    {uploadProgress ? (
                        <div className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Subiendo {uploadProgress.current} de {uploadProgress.total} foto{uploadProgress.total !== 1 ? 's' : ''}...
                        </div>
                    ) : (
                        <button
                            type="submit"
                            disabled={busy}
                            className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
                        >
                            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                            {isSubmitting ? 'Guardando...' : 'Agregar Entrada'}
                        </button>
                    )}
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
