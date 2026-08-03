'use client';

import { useState, useRef, useEffect, useTransition } from 'react';
import {
    X, Loader2, AlertTriangle, MapPin, Truck,
    CheckCircle2, PackageOpen, Camera, PenLine, Trash2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { reportarIncidenciaMaterial, type AccionCustodia } from '../actions';

interface ReportarIncidenciaModalProps {
    proyectoId:             string;
    proyectoEquipamientoId: string;
    modeloMaterial:         string;
    unidadesLibres:         number;
    onClose:                () => void;
    onSuccess:              () => void;
}

const MOTIVOS_PRESET = [
    'Cliente solicita instalación posterior',
    'Espacio físico no disponible',
    'Incompatibilidad con infraestructura existente',
    'Material dañado en terreno',
    'Cambio de alcance del proyecto',
    'Otro motivo',
];

export function ReportarIncidenciaModal({
    proyectoId,
    proyectoEquipamientoId,
    modeloMaterial,
    unidadesLibres,
    onClose,
    onSuccess,
}: ReportarIncidenciaModalProps) {
    const [accion,       setAccion]       = useState<AccionCustodia | null>(null);
    const [cantidad,     setCantidad]     = useState(1);
    const [motivo,       setMotivo]       = useState('');
    const [motivoCustom, setMotivoCustom] = useState('');
    const [photoFile,    setPhotoFile]    = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [hasDrawn,     setHasDrawn]     = useState(false);
    const [uploadStep,   setUploadStep]   = useState<string | null>(null);
    const [error,        setError]        = useState<string | null>(null);
    const [exito,        setExito]        = useState(false);
    const [isPending, startTransition] = useTransition();

    const fileInputRef  = useRef<HTMLInputElement>(null);
    const sigCanvasRef  = useRef<HTMLCanvasElement>(null);
    const isDrawingRef  = useRef(false);
    const previewUrlRef = useRef<string | null>(null);

    // ── Canvas de firma ───────────────────────────────────────────────────────
    useEffect(() => {
        const canvas = sigCanvasRef.current;
        if (!canvas) return;

        canvas.width  = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;

        const ctx = canvas.getContext('2d')!;
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth   = 2;
        ctx.lineCap     = 'round';
        ctx.lineJoin    = 'round';

        function getPos(e: MouseEvent | TouchEvent) {
            const r      = canvas!.getBoundingClientRect();
            const scaleX = canvas!.width  / r.width;
            const scaleY = canvas!.height / r.height;
            if ('touches' in e) {
                return {
                    x: (e.touches[0].clientX - r.left) * scaleX,
                    y: (e.touches[0].clientY - r.top)  * scaleY,
                };
            }
            return {
                x: (e.clientX - r.left) * scaleX,
                y: (e.clientY - r.top)  * scaleY,
            };
        }

        function onStart(e: MouseEvent | TouchEvent) {
            e.preventDefault();
            isDrawingRef.current = true;
            const pos = getPos(e);
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
        }

        function onMove(e: MouseEvent | TouchEvent) {
            e.preventDefault();
            if (!isDrawingRef.current) return;
            const pos = getPos(e);
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
            setHasDrawn(true);
        }

        function onEnd() { isDrawingRef.current = false; }

        canvas.addEventListener('mousedown',  onStart);
        canvas.addEventListener('mousemove',  onMove);
        canvas.addEventListener('mouseup',    onEnd);
        canvas.addEventListener('mouseleave', onEnd);
        canvas.addEventListener('touchstart', onStart as EventListener, { passive: false });
        canvas.addEventListener('touchmove',  onMove  as EventListener, { passive: false });
        canvas.addEventListener('touchend',   onEnd);

        return () => {
            canvas.removeEventListener('mousedown',  onStart);
            canvas.removeEventListener('mousemove',  onMove);
            canvas.removeEventListener('mouseup',    onEnd);
            canvas.removeEventListener('mouseleave', onEnd);
            canvas.removeEventListener('touchstart', onStart as EventListener);
            canvas.removeEventListener('touchmove',  onMove  as EventListener);
            canvas.removeEventListener('touchend',   onEnd);
        };
    }, []);

    // Liberar ObjectURL al desmontar
    useEffect(() => {
        return () => { if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current); };
    }, []);

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        const url = URL.createObjectURL(file);
        previewUrlRef.current = url;
        setPhotoFile(file);
        setPhotoPreview(url);
    }

    function clearSignature() {
        const canvas = sigCanvasRef.current;
        if (!canvas) return;
        canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
        setHasDrawn(false);
    }

    const motivoFinal = motivo === 'Otro motivo' ? motivoCustom.trim() : motivo;

    const puedeEnviar = (
        !!accion
        && cantidad >= 1
        && cantidad <= unidadesLibres
        && !!motivoFinal
        && photoFile !== null
        && hasDrawn
    );

    function handleSubmit() {
        if (!puedeEnviar || !accion || !photoFile) return;
        setError(null);

        startTransition(async () => {
            const supabase = createClient();
            const ts       = Date.now();

            // ── Subir fotografía ──────────────────────────────────────────────
            setUploadStep('Subiendo fotografía…');
            const ext       = photoFile.type.split('/')[1] || 'jpg';
            const photoPath = `${proyectoId}/${proyectoEquipamientoId}_${ts}_foto.${ext}`;
            const { error: photoErr } = await supabase.storage
                .from('evidencias_logistica')
                .upload(photoPath, photoFile, { upsert: true });
            if (photoErr) {
                setError(`Error al subir la fotografía: ${photoErr.message}`);
                setUploadStep(null);
                return;
            }
            const { data: { publicUrl: fotoUrl } } = supabase.storage
                .from('evidencias_logistica')
                .getPublicUrl(photoPath);

            // ── Subir firma desde canvas ──────────────────────────────────────
            setUploadStep('Subiendo firma…');
            const canvas = sigCanvasRef.current!;
            let sigBlob: Blob;
            try {
                sigBlob = await new Promise<Blob>((resolve, reject) => {
                    canvas.toBlob(
                        blob => (blob ? resolve(blob) : reject(new Error('toBlob returned null'))),
                        'image/png'
                    );
                });
            } catch {
                setError('Error al procesar la firma digital.');
                setUploadStep(null);
                return;
            }
            const sigPath = `${proyectoId}/${proyectoEquipamientoId}_${ts}_firma.png`;
            const { error: sigErr } = await supabase.storage
                .from('evidencias_logistica')
                .upload(sigPath, sigBlob, { contentType: 'image/png', upsert: true });
            if (sigErr) {
                setError(`Error al subir la firma: ${sigErr.message}`);
                setUploadStep(null);
                return;
            }
            const { data: { publicUrl: firmaUrl } } = supabase.storage
                .from('evidencias_logistica')
                .getPublicUrl(sigPath);

            // ── Registrar incidencia ──────────────────────────────────────────
            setUploadStep('Registrando incidencia…');
            const result = await reportarIncidenciaMaterial({
                proyectoId,
                proyectoEquipamientoId,
                accion,
                cantidad,
                motivo: motivoFinal,
                evidenciaFotoUrl: fotoUrl,
                firmaCustodiaUrl: firmaUrl,
            });

            setUploadStep(null);
            if (result.error) {
                setError(result.error);
            } else {
                setExito(true);
                setTimeout(onSuccess, 1400);
            }
        });
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">

                {/* Header — fijo */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center">
                            <PackageOpen className="w-4 h-4 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Incidencia de Material</p>
                            <h2 className="text-sm font-black text-slate-900 leading-tight truncate max-w-[280px]">
                                {modeloMaterial}
                            </h2>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isPending}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Pantalla de éxito */}
                {exito ? (
                    <div className="p-8 flex flex-col items-center text-center gap-3">
                        <div className="w-14 h-14 rounded-2xl bg-green-50 border border-green-200 flex items-center justify-center">
                            <CheckCircle2 className="w-7 h-7 text-green-600" />
                        </div>
                        <p className="text-base font-black text-slate-900">Incidencia Registrada</p>
                        <p className="text-sm text-slate-500">
                            {accion === 'Estacionado_Obra'
                                ? 'El material quedó registrado como estacionado en obra.'
                                : 'Se inició el protocolo de devolución. El encargado debe confirmar la recepción.'}
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Cuerpo scrolleable */}
                        <div className="overflow-y-auto flex-1 p-5 space-y-5">

                            {/* 1. Acción */}
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
                                    ¿Qué ocurre con este material?
                                </p>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setAccion('Estacionado_Obra')}
                                        className={`flex flex-col items-center gap-2 p-3.5 rounded-xl border-2 text-xs font-bold transition-all ${
                                            accion === 'Estacionado_Obra'
                                                ? 'border-orange-400 bg-orange-50 text-orange-700'
                                                : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                        }`}
                                    >
                                        <MapPin className={`w-5 h-5 ${accion === 'Estacionado_Obra' ? 'text-orange-500' : 'text-slate-400'}`} />
                                        <span>Estacionar en Obra</span>
                                        <span className="font-normal text-[10px] text-center leading-tight opacity-75">
                                            Queda en el sitio, sin retorno
                                        </span>
                                    </button>

                                    <button
                                        onClick={() => setAccion('En_Transito_Devolucion')}
                                        className={`flex flex-col items-center gap-2 p-3.5 rounded-xl border-2 text-xs font-bold transition-all ${
                                            accion === 'En_Transito_Devolucion'
                                                ? 'border-blue-400 bg-blue-50 text-blue-700'
                                                : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                        }`}
                                    >
                                        <Truck className={`w-5 h-5 ${accion === 'En_Transito_Devolucion' ? 'text-blue-500' : 'text-slate-400'}`} />
                                        <span>Devolver a Logística</span>
                                        <span className="font-normal text-[10px] text-center leading-tight opacity-75">
                                            Lo traes de vuelta tú
                                        </span>
                                    </button>
                                </div>
                            </div>

                            {/* 2. Cantidad */}
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                                    Cantidad de unidades
                                    <span className="ml-1 normal-case font-normal text-slate-400">
                                        (máx. {unidadesLibres} disponibles)
                                    </span>
                                </label>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setCantidad(v => Math.max(1, v - 1))}
                                        className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 font-black text-base transition-colors"
                                    >−</button>
                                    <input
                                        type="number"
                                        min={1}
                                        max={unidadesLibres}
                                        value={cantidad}
                                        onChange={e => {
                                            const v = parseInt(e.target.value);
                                            if (!isNaN(v)) setCantidad(Math.min(unidadesLibres, Math.max(1, v)));
                                        }}
                                        className="w-16 text-center border border-slate-200 rounded-lg py-1.5 text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
                                    />
                                    <button
                                        onClick={() => setCantidad(v => Math.min(unidadesLibres, v + 1))}
                                        className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 font-black text-base transition-colors"
                                    >+</button>
                                    {unidadesLibres > 1 && (
                                        <button
                                            onClick={() => setCantidad(unidadesLibres)}
                                            className="ml-1 text-[10px] text-slate-400 hover:text-slate-600 underline transition-colors"
                                        >
                                            Todo ({unidadesLibres})
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* 3. Motivo */}
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                                    Motivo de la incidencia
                                </label>
                                <select
                                    value={motivo}
                                    onChange={e => setMotivo(e.target.value)}
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white"
                                >
                                    <option value="">Seleccionar motivo…</option>
                                    {MOTIVOS_PRESET.map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>

                                {motivo === 'Otro motivo' && (
                                    <textarea
                                        value={motivoCustom}
                                        onChange={e => setMotivoCustom(e.target.value)}
                                        placeholder="Describe el motivo..."
                                        rows={2}
                                        maxLength={300}
                                        className="mt-2 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300 resize-none"
                                    />
                                )}
                            </div>

                            {/* 4. Fotografía de evidencia */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                        Fotografía de Evidencia
                                    </span>
                                    <span className={`text-[10px] font-bold uppercase ${photoFile ? 'text-emerald-600' : 'text-red-400'}`}>
                                        {photoFile ? '✓ Cargada' : 'Obligatoria'}
                                    </span>
                                </div>

                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="hidden"
                                    onChange={handleFileChange}
                                />

                                {photoPreview ? (
                                    <div className="relative rounded-xl overflow-hidden border border-slate-200">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={photoPreview}
                                            alt="Vista previa de evidencia"
                                            className="w-full h-40 object-cover"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="absolute bottom-2 right-2 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-lg px-2.5 py-1 text-[10px] font-bold text-slate-600 hover:bg-white transition-colors shadow-sm"
                                        >
                                            Cambiar foto
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-full border-2 border-dashed border-slate-300 rounded-xl h-32 flex flex-col items-center justify-center gap-2 hover:border-amber-400 hover:bg-amber-50/40 transition-all"
                                    >
                                        <Camera className="w-7 h-7 text-slate-400" />
                                        <span className="text-xs font-bold text-slate-500">
                                            Tomar foto o seleccionar imagen
                                        </span>
                                        <span className="text-[10px] text-slate-400">
                                            Muestra dónde quedó el equipo
                                        </span>
                                    </button>
                                )}
                            </div>

                            {/* 5. Firma digital */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                        Firma de Custodia
                                    </span>
                                    <div className="flex items-center gap-3">
                                        <span className={`text-[10px] font-bold uppercase ${hasDrawn ? 'text-emerald-600' : 'text-red-400'}`}>
                                            {hasDrawn ? '✓ Firmado' : 'Obligatoria'}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={clearSignature}
                                            className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-red-500 transition-colors"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                            Limpiar
                                        </button>
                                    </div>
                                </div>

                                <div className={`rounded-xl border-2 transition-colors overflow-hidden ${
                                    hasDrawn
                                        ? 'border-slate-300 bg-white'
                                        : 'border-dashed border-slate-300 bg-slate-50'
                                }`}>
                                    <canvas
                                        ref={sigCanvasRef}
                                        className="w-full h-28 cursor-crosshair block touch-none"
                                    />
                                </div>

                                {!hasDrawn && (
                                    <p className="mt-1.5 text-[10px] text-slate-400 text-center flex items-center justify-center gap-1">
                                        <PenLine className="w-3 h-3" />
                                        Firma con tu dedo o cursor en el recuadro
                                    </p>
                                )}
                            </div>

                            {/* Alerta handshake */}
                            {accion === 'En_Transito_Devolucion' && (
                                <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5">
                                    <AlertTriangle className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                                    <p className="text-xs text-blue-700">
                                        <strong>Handshake requerido:</strong> quedarás como responsable de estas
                                        unidades hasta que el encargado de Logística confirme la recepción.
                                    </p>
                                </div>
                            )}

                            {error && (
                                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                                    <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                                    <p className="text-xs text-red-700">{error}</p>
                                </div>
                            )}
                        </div>

                        {/* Footer — fijo */}
                        <div className="flex gap-2 px-5 py-4 border-t border-slate-100 shrink-0">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isPending}
                                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={!puedeEnviar || isPending}
                                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-black text-white transition-all ${
                                    puedeEnviar && !isPending
                                        ? 'bg-slate-900 hover:bg-slate-800 shadow-sm'
                                        : 'bg-slate-300 cursor-not-allowed'
                                }`}
                            >
                                {isPending ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" />{uploadStep ?? 'Procesando…'}</>
                                ) : (
                                    'Confirmar Incidencia'
                                )}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
