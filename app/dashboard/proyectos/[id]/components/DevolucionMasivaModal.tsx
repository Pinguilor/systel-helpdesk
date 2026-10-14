'use client';

import { useState, useRef, useEffect, useMemo, useTransition } from 'react';
import {
    X, Loader2, AlertTriangle, MapPin, Truck, CheckCircle2, PackageOpen,
    Camera, PenLine, Trash2, Search, Check, Layers,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { CustomSelect } from '@/app/dashboard/components/CustomSelect';
import {
    getItemsDevolucionMasivaAction,
    crearDevolucionMasivaAction,
    type AccionCustodia,
    type LineaDevolucionMasiva,
    type ItemLoteInput,
} from '../actions';

interface Props {
    proyectoId: string;
    onClose:    () => void;
    onSuccess:  () => void;
}

const MOTIVOS_PRESET = [
    'Sobrante por cierre de obra',
    'Equipos con daño en tránsito',
    'Cliente solicita instalación posterior',
    'Espacio físico no disponible',
    'Incompatibilidad con infraestructura existente',
    'Cambio de alcance del proyecto',
    'Otro motivo',
];

/** Filas visibles por página: la lista puede tener 300+ ítems. */
const PAGE_SIZE = 120;

type Fila =
    | { kind: 'generico'; key: string; linea: LineaDevolucionMasiva }
    | { kind: 'serial';   key: string; linea: LineaDevolucionMasiva; inventarioId: string; numeroSerie: string };

export function DevolucionMasivaModal({ proyectoId, onClose, onSuccess }: Props) {
    const [lineas,  setLineas]  = useState<LineaDevolucionMasiva[]>([]);
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState<string | null>(null);

    const [busqueda, setBusqueda] = useState('');
    const [visibles, setVisibles] = useState(PAGE_SIZE);
    // Genéricos: equipId → cantidad a reportar (ausente = no seleccionado)
    const [selGen, setSelGen] = useState<Record<string, number>>({});
    // Seriales: set de inventario_id
    const [selSer, setSelSer] = useState<Set<string>>(new Set());

    const [accion,       setAccion]       = useState<AccionCustodia>('En_Transito_Devolucion');
    const [motivo,       setMotivo]       = useState('');
    const [observacion,  setObservacion]  = useState('');
    const [photoFile,    setPhotoFile]    = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [hasDrawn,     setHasDrawn]     = useState(false);
    const [uploadStep,   setUploadStep]   = useState<string | null>(null);
    const [exito,        setExito]        = useState<number | null>(null);
    const [isPending, startTransition] = useTransition();

    const fileInputRef  = useRef<HTMLInputElement>(null);
    const sigCanvasRef  = useRef<HTMLCanvasElement>(null);
    const isDrawingRef  = useRef(false);
    const previewUrlRef = useRef<string | null>(null);

    // ── Carga de ítems devolvibles ────────────────────────────────────────────
    useEffect(() => {
        let alive = true;
        getItemsDevolucionMasivaAction(proyectoId).then(res => {
            if (!alive) return;
            if (res.error) setError(res.error);
            else setLineas(res.data);
            setLoading(false);
        });
        return () => { alive = false; };
    }, [proyectoId]);

    // ── Canvas de firma ───────────────────────────────────────────────────────
    useEffect(() => {
        if (loading || exito !== null) return;
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
            const r = canvas!.getBoundingClientRect();
            const sx = canvas!.width  / r.width;
            const sy = canvas!.height / r.height;
            if ('touches' in e) {
                return { x: (e.touches[0].clientX - r.left) * sx, y: (e.touches[0].clientY - r.top) * sy };
            }
            return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
        }
        function onStart(e: MouseEvent | TouchEvent) {
            e.preventDefault();
            isDrawingRef.current = true;
            const p = getPos(e);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
        }
        function onMove(e: MouseEvent | TouchEvent) {
            e.preventDefault();
            if (!isDrawingRef.current) return;
            const p = getPos(e);
            ctx.lineTo(p.x, p.y);
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
    }, [loading, exito]);

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

    // ── Filas filtradas (modelo, familia o N° de serie) ──────────────────────
    const filas: Fila[] = useMemo(() => {
        const q = busqueda.trim().toLowerCase();
        const out: Fila[] = [];
        for (const l of lineas) {
            const matchLinea = !q
                || l.modelo.toLowerCase().includes(q)
                || l.familia.toLowerCase().includes(q);
            if (!l.esSerializado) {
                if (matchLinea) out.push({ kind: 'generico', key: l.equipId, linea: l });
                continue;
            }
            for (const s of l.seriales) {
                if (matchLinea || s.numeroSerie.toLowerCase().includes(q)) {
                    out.push({ kind: 'serial', key: s.inventarioId, linea: l, ...s });
                }
            }
        }
        return out;
    }, [lineas, busqueda]);

    const serialEquip  = useMemo(() => {
        const m = new Map<string, string>();
        for (const l of lineas) for (const s of l.seriales) m.set(s.inventarioId, l.equipId);
        return m;
    }, [lineas]);

    /** Seriales seleccionados por línea (para respetar el tope `libres`). */
    const serPorEquip = useMemo(() => {
        const m = new Map<string, number>();
        selSer.forEach(id => {
            const eq = serialEquip.get(id);
            if (eq) m.set(eq, (m.get(eq) ?? 0) + 1);
        });
        return m;
    }, [selSer, serialEquip]);

    const nGenericos   = Object.keys(selGen).length;
    const unidadesGen  = Object.values(selGen).reduce((a, b) => a + b, 0);
    const totalItems   = nGenericos + selSer.size;
    const totalUnidades = unidadesGen + selSer.size;

    // ── Selección ────────────────────────────────────────────────────────────
    function toggleGenerico(l: LineaDevolucionMasiva) {
        setSelGen(prev => {
            const next = { ...prev };
            if (next[l.equipId]) delete next[l.equipId];
            else next[l.equipId] = l.libres;
            return next;
        });
    }

    function setCantidadGen(l: LineaDevolucionMasiva, raw: string) {
        const v = parseInt(raw, 10);
        setSelGen(prev => {
            if (isNaN(v)) return prev;
            return { ...prev, [l.equipId]: Math.min(l.libres, Math.max(1, v)) };
        });
    }

    function toggleSerial(f: Extract<Fila, { kind: 'serial' }>) {
        setSelSer(prev => {
            const next = new Set(prev);
            if (next.has(f.inventarioId)) { next.delete(f.inventarioId); return next; }
            if ((serPorEquip.get(f.linea.equipId) ?? 0) >= f.linea.libres) return prev; // tope de la línea
            next.add(f.inventarioId);
            return next;
        });
    }

    const todosFiltradosSel = filas.length > 0 && filas.every(f =>
        f.kind === 'generico' ? !!selGen[f.linea.equipId] : selSer.has(f.inventarioId)
    );

    function toggleTodosFiltrados() {
        if (todosFiltradosSel) {
            setSelGen(prev => {
                const next = { ...prev };
                filas.forEach(f => { if (f.kind === 'generico') delete next[f.linea.equipId]; });
                return next;
            });
            setSelSer(prev => {
                const next = new Set(prev);
                filas.forEach(f => { if (f.kind === 'serial') next.delete(f.inventarioId); });
                return next;
            });
            return;
        }
        const gen: Record<string, number> = {};
        const ser = new Set(selSer);
        const cnt = new Map(serPorEquip);
        for (const f of filas) {
            if (f.kind === 'generico') {
                gen[f.linea.equipId] = selGen[f.linea.equipId] ?? f.linea.libres;
            } else if (!ser.has(f.inventarioId)) {
                const c = cnt.get(f.linea.equipId) ?? 0;
                if (c < f.linea.libres) { ser.add(f.inventarioId); cnt.set(f.linea.equipId, c + 1); }
            }
        }
        setSelGen(prev => ({ ...prev, ...gen }));
        setSelSer(ser);
    }

    // ── Envío ────────────────────────────────────────────────────────────────
    const motivoFinal = motivo;
    const requiereDescripcion = motivo === 'Otro motivo';
    const puedeEnviar =
        totalItems > 0
        && !!motivoFinal
        && (!requiereDescripcion || observacion.trim().length > 0)
        && photoFile !== null
        && hasDrawn;

    function handleSubmit() {
        if (!puedeEnviar || !photoFile) return;
        setError(null);

        startTransition(async () => {
            const supabase = createClient();
            const ts = Date.now();

            setUploadStep('Subiendo fotografía…');
            const ext = photoFile.type.split('/')[1] || 'jpg';
            const photoPath = `${proyectoId}/lote_${ts}_foto.${ext}`;
            const { error: photoErr } = await supabase.storage
                .from('evidencias_logistica').upload(photoPath, photoFile, { upsert: true });
            if (photoErr) { setError(`Error al subir la fotografía: ${photoErr.message}`); setUploadStep(null); return; }
            const { data: { publicUrl: fotoUrl } } = supabase.storage
                .from('evidencias_logistica').getPublicUrl(photoPath);

            setUploadStep('Subiendo firma…');
            const canvas = sigCanvasRef.current!;
            let sigBlob: Blob;
            try {
                sigBlob = await new Promise<Blob>((resolve, reject) => {
                    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob null'))), 'image/png');
                });
            } catch {
                setError('Error al procesar la firma digital.'); setUploadStep(null); return;
            }
            const sigPath = `${proyectoId}/lote_${ts}_firma.png`;
            const { error: sigErr } = await supabase.storage
                .from('evidencias_logistica').upload(sigPath, sigBlob, { contentType: 'image/png', upsert: true });
            if (sigErr) { setError(`Error al subir la firma: ${sigErr.message}`); setUploadStep(null); return; }
            const { data: { publicUrl: firmaUrl } } = supabase.storage
                .from('evidencias_logistica').getPublicUrl(sigPath);

            // Armar payload: genéricos con cantidad + seriales agrupados por línea
            const items: ItemLoteInput[] = [];
            for (const [equipId, cantidad] of Object.entries(selGen)) items.push({ equipId, cantidad });
            const porEquip = new Map<string, string[]>();
            selSer.forEach(id => {
                const eq = serialEquip.get(id);
                if (!eq) return;
                const arr = porEquip.get(eq) ?? [];
                arr.push(id);
                porEquip.set(eq, arr);
            });
            porEquip.forEach((inventarioIds, equipId) => items.push({ equipId, inventarioIds }));

            setUploadStep('Registrando paquete…');
            const result = await crearDevolucionMasivaAction({
                proyectoId,
                accion,
                motivo: motivoFinal,
                observacion,
                evidenciaFotoUrl: fotoUrl,
                firmaCustodiaUrl: firmaUrl,
                items,
            });

            setUploadStep(null);
            if (result.error) {
                setError(result.error);
            } else {
                setExito(result.totalUnidades ?? totalUnidades);
                setTimeout(onSuccess, 1600);
            }
        });
    }

    const filasPagina = filas.slice(0, visibles);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget && !isPending) onClose(); }}
        >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[92vh]">

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center">
                            <Layers className="w-4 h-4 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Paquete por lote</p>
                            <h2 className="text-sm font-black text-slate-900 leading-tight">Devolución / Incidencia Masiva</h2>
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

                {exito !== null ? (
                    <div className="p-10 flex flex-col items-center text-center gap-3">
                        <div className="w-14 h-14 rounded-2xl bg-green-50 border border-green-200 flex items-center justify-center">
                            <CheckCircle2 className="w-7 h-7 text-green-600" />
                        </div>
                        <p className="text-base font-black text-slate-900">Paquete Registrado</p>
                        <p className="text-sm text-slate-500 max-w-sm">
                            {accion === 'Estacionado_Obra'
                                ? `${exito} unidad(es) quedaron registradas como estacionadas en obra.`
                                : `${exito} unidad(es) en tránsito. Bodega confirmará la recepción del paquete completo en un solo paso.`}
                        </p>
                    </div>
                ) : loading ? (
                    <div className="p-16 flex items-center justify-center gap-2 text-slate-400 text-sm font-semibold">
                        <Loader2 className="w-4 h-4 animate-spin" /> Cargando material en terreno…
                    </div>
                ) : lineas.length === 0 ? (
                    <div className="p-14 flex flex-col items-center text-center gap-2">
                        <PackageOpen className="w-8 h-8 text-slate-300" />
                        <p className="text-sm font-black text-slate-600">No hay material en terreno para reportar</p>
                        <p className="text-xs text-slate-400">Todo lo entregado ya está instalado o declarado.</p>
                        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
                    </div>
                ) : (
                    <>
                        <div className="overflow-y-auto flex-1 p-5 space-y-5">

                            {/* 1. Acción */}
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setAccion('En_Transito_Devolucion')}
                                    className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                                        accion === 'En_Transito_Devolucion'
                                            ? 'border-blue-400 bg-blue-50 text-blue-700'
                                            : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                    }`}
                                >
                                    <Truck className="w-5 h-5 shrink-0" />
                                    <span className="text-xs font-bold leading-tight">
                                        Devolver a Bodega
                                        <span className="block font-normal opacity-75 text-[10px]">Requiere recepción de bodega</span>
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAccion('Estacionado_Obra')}
                                    className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                                        accion === 'Estacionado_Obra'
                                            ? 'border-orange-400 bg-orange-50 text-orange-700'
                                            : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                    }`}
                                >
                                    <MapPin className="w-5 h-5 shrink-0" />
                                    <span className="text-xs font-bold leading-tight">
                                        Estacionar en Obra
                                        <span className="block font-normal opacity-75 text-[10px]">Queda en el sitio, sin retorno</span>
                                    </span>
                                </button>
                            </div>

                            {/* 2. Selector de ítems */}
                            <div className="border border-slate-200 rounded-xl overflow-hidden">
                                <div className="flex flex-col sm:flex-row gap-2 p-3 bg-slate-50 border-b border-slate-200">
                                    <div className="relative flex-1">
                                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <input
                                            type="text"
                                            value={busqueda}
                                            onChange={e => { setBusqueda(e.target.value); setVisibles(PAGE_SIZE); }}
                                            placeholder="Buscar por modelo, familia o N° de serie…"
                                            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={toggleTodosFiltrados}
                                        disabled={filas.length === 0}
                                        className="px-3 py-2 text-xs font-black rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition-colors whitespace-nowrap"
                                    >
                                        {todosFiltradosSel ? 'Deseleccionar todo' : 'Seleccionar todo'}
                                        <span className="ml-1 font-semibold text-slate-400">({filas.length})</span>
                                    </button>
                                </div>

                                <div className="max-h-[320px] overflow-y-auto divide-y divide-slate-100">
                                    {filas.length === 0 && (
                                        <p className="p-6 text-center text-xs text-slate-400 font-semibold">
                                            Sin resultados para “{busqueda}”.
                                        </p>
                                    )}

                                    {filasPagina.map(f => {
                                        if (f.kind === 'generico') {
                                            const cant = selGen[f.linea.equipId];
                                            const sel  = !!cant;
                                            return (
                                                <div
                                                    key={f.key}
                                                    className={`flex items-center gap-3 px-3 py-2.5 ${sel ? 'bg-amber-50/50' : 'hover:bg-slate-50'}`}
                                                >
                                                    <CheckBox checked={sel} onClick={() => toggleGenerico(f.linea)} />
                                                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleGenerico(f.linea)}>
                                                        <p className="text-sm font-bold text-slate-900 truncate">{f.linea.modelo}</p>
                                                        <p className="text-[10px] text-slate-400">
                                                            {f.linea.familia} · Genérico · en terreno: <b>{f.linea.libres}</b>
                                                        </p>
                                                    </div>
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        max={f.linea.libres}
                                                        value={sel ? cant : ''}
                                                        disabled={!sel}
                                                        onChange={e => setCantidadGen(f.linea, e.target.value)}
                                                        placeholder="0"
                                                        className="w-16 text-center border border-slate-200 rounded-lg py-1 text-sm font-black text-slate-900 disabled:bg-slate-50 disabled:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-300"
                                                    />
                                                </div>
                                            );
                                        }
                                        const sel = selSer.has(f.inventarioId);
                                        const topeAlcanzado = !sel && (serPorEquip.get(f.linea.equipId) ?? 0) >= f.linea.libres;
                                        return (
                                            <div
                                                key={f.key}
                                                onClick={() => !topeAlcanzado && toggleSerial(f)}
                                                className={`flex items-center gap-3 px-3 py-2.5 ${
                                                    topeAlcanzado ? 'opacity-40 cursor-not-allowed'
                                                    : sel ? 'bg-amber-50/50 cursor-pointer' : 'hover:bg-slate-50 cursor-pointer'
                                                }`}
                                            >
                                                <CheckBox checked={sel} />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-slate-900 truncate">{f.linea.modelo}</p>
                                                    <p className="text-[10px] text-slate-400">{f.linea.familia} · Serializado</p>
                                                </div>
                                                <span className="text-[11px] font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                                                    {f.numeroSerie}
                                                </span>
                                            </div>
                                        );
                                    })}

                                    {filas.length > visibles && (
                                        <button
                                            type="button"
                                            onClick={() => setVisibles(v => v + PAGE_SIZE)}
                                            className="w-full py-2.5 text-xs font-black text-indigo-600 hover:bg-indigo-50 transition-colors"
                                        >
                                            Mostrar más ({filas.length - visibles} restantes)
                                        </button>
                                    )}
                                </div>

                                {/* Badge resumen */}
                                <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-t border-slate-200">
                                    <span className={`text-xs font-black px-2.5 py-1 rounded-full border ${
                                        totalItems > 0
                                            ? 'bg-amber-100 text-amber-800 border-amber-200'
                                            : 'bg-white text-slate-400 border-slate-200'
                                    }`}>
                                        {totalItems} ítem{totalItems !== 1 ? 's' : ''} seleccionado{totalItems !== 1 ? 's' : ''} en este paquete
                                    </span>
                                    <span className="text-[11px] font-semibold text-slate-500">
                                        {totalUnidades} unidad{totalUnidades !== 1 ? 'es' : ''}
                                    </span>
                                </div>
                            </div>

                            {/* 3. Motivo + descripción */}
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                    Motivo del paquete
                                </label>
                                <CustomSelect
                                    id="motivo-lote"
                                    value={motivo}
                                    onChange={setMotivo}
                                    placeholder="Seleccionar motivo…"
                                    options={MOTIVOS_PRESET.map(m => ({ value: m, label: m }))}
                                />
                                <textarea
                                    value={observacion}
                                    onChange={e => setObservacion(e.target.value)}
                                    placeholder={requiereDescripcion
                                        ? 'Describe el motivo (obligatorio)…'
                                        : 'Observación general del paquete (opcional)…'}
                                    rows={2}
                                    maxLength={400}
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300 resize-none"
                                />
                            </div>

                            {/* 4. Evidencia única */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Fotografía (todo el lote)</span>
                                        <span className={`text-[10px] font-bold uppercase ${photoFile ? 'text-emerald-600' : 'text-red-400'}`}>
                                            {photoFile ? '✓ Cargada' : 'Obligatoria'}
                                        </span>
                                    </div>
                                    <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
                                    {photoPreview ? (
                                        <div className="relative rounded-xl overflow-hidden border border-slate-200">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={photoPreview} alt="Evidencia" className="w-full h-28 object-cover" />
                                            <button
                                                type="button"
                                                onClick={() => fileInputRef.current?.click()}
                                                className="absolute bottom-2 right-2 bg-white/90 border border-slate-200 rounded-lg px-2.5 py-1 text-[10px] font-bold text-slate-600 hover:bg-white shadow-sm"
                                            >
                                                Cambiar foto
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="w-full border-2 border-dashed border-slate-300 rounded-xl h-28 flex flex-col items-center justify-center gap-1.5 hover:border-amber-400 hover:bg-amber-50/40 transition-all"
                                        >
                                            <Camera className="w-6 h-6 text-slate-400" />
                                            <span className="text-xs font-bold text-slate-500">Tomar foto o seleccionar</span>
                                        </button>
                                    )}
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Firma de custodia</span>
                                        <div className="flex items-center gap-3">
                                            <span className={`text-[10px] font-bold uppercase ${hasDrawn ? 'text-emerald-600' : 'text-red-400'}`}>
                                                {hasDrawn ? '✓ Firmado' : 'Obligatoria'}
                                            </span>
                                            <button type="button" onClick={clearSignature}
                                                className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-red-500 transition-colors">
                                                <Trash2 className="w-3 h-3" />Limpiar
                                            </button>
                                        </div>
                                    </div>
                                    <div className={`rounded-xl border-2 overflow-hidden ${hasDrawn ? 'border-slate-300 bg-white' : 'border-dashed border-slate-300 bg-slate-50'}`}>
                                        <canvas ref={sigCanvasRef} className="w-full h-28 cursor-crosshair block touch-none" />
                                    </div>
                                    {!hasDrawn && (
                                        <p className="mt-1 text-[10px] text-slate-400 text-center flex items-center justify-center gap-1">
                                            <PenLine className="w-3 h-3" />Firma en el recuadro
                                        </p>
                                    )}
                                </div>
                            </div>

                            {accion === 'En_Transito_Devolucion' && (
                                <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5">
                                    <AlertTriangle className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                                    <p className="text-xs text-blue-700">
                                        <strong>Handshake requerido:</strong> quedarás como responsable del paquete hasta que
                                        el bodeguero confirme la recepción del lote completo.
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

                        {/* Footer */}
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
                                    puedeEnviar && !isPending ? 'bg-slate-900 hover:bg-slate-800 shadow-sm' : 'bg-slate-300 cursor-not-allowed'
                                }`}
                            >
                                {isPending
                                    ? <><Loader2 className="w-4 h-4 animate-spin" />{uploadStep ?? 'Procesando…'}</>
                                    : `Confirmar paquete${totalItems > 0 ? ` (${totalItems})` : ''}`}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function CheckBox({ checked, onClick }: { checked: boolean; onClick?: () => void }) {
    return (
        <span
            role="checkbox"
            aria-checked={checked}
            onClick={onClick}
            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                checked ? 'bg-amber-500 border-amber-500' : 'bg-white border-slate-300'
            } ${onClick ? 'cursor-pointer' : ''}`}
        >
            {checked && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
        </span>
    );
}
