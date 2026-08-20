'use client';

import { useState, useTransition, useMemo, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
    Loader2, Plus, Trash2, PackagePlus, CheckCircle2,
    AlertTriangle, Search, Upload, FileText, X, Barcode, LogOut,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { procesarGuiaIngresoAction, type GuiaIngresoItem, type Proveedor } from '../actions';
import { SerialesInputModal }  from './SerialesInputModal';
import { ProveedorCombobox }   from './ProveedorCombobox';
import { BodegaCombobox }      from './BodegaCombobox';

interface CatalogoEntry {
    modelo: string;
    familia: string;
    es_serializado: boolean;
    bodega_id: string;
}

interface Props {
    bodegas:     { id: string; nombre: string }[];
    catalogo:    CatalogoEntry[];
    proveedores: Proveedor[];
    onSuccess:   () => void;
}

type ItemLocal = GuiaIngresoItem;

function newEmptyItem(): ItemLocal {
    return { familia: '', modelo: '', es_serializado: false, seriales: [], cantidad: 1 };
}

export function NuevaGuiaForm({ bodegas, catalogo, proveedores, onSuccess }: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    // ── Cabecera ─────────────────────────────────────────────────
    const [tipoDoc,         setTipoDoc]         = useState<'GD' | 'FC'>('GD');
    const [numeroGuia,      setNumeroGuia]      = useState('');
    const [proveedorId,     setProveedorId]     = useState<string | null>(null);
    const [proveedorNombre, setProveedorNombre] = useState('');
    const [bodegaDestinoId,     setBodegaDestinoId]     = useState('');
    const [bodegaDestinoNombre, setBodegaDestinoNombre] = useState('');
    const [fechaGuia,       setFechaGuia]       = useState(new Date().toISOString().slice(0, 10));
    const [observaciones,   setObservaciones]   = useState('');

    // ── Documento adjunto ────────────────────────────────────────
    const [docFile,       setDocFile]       = useState<File | null>(null);
    const [docPreviewUrl, setDocPreviewUrl] = useState<string | null>(null);
    const [uploadingDoc,  setUploadingDoc]  = useState(false);
    const fileInputRef  = useRef<HTMLInputElement>(null);
    const previewUrlRef = useRef<string | null>(null);

    useEffect(() => {
        return () => {
            if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        };
    }, []);

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        const url = URL.createObjectURL(file);
        previewUrlRef.current = url;
        setDocFile(file);
        setDocPreviewUrl(url);
    }

    function removeDoc() {
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
        setDocFile(null);
        setDocPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }

    // ── Ítems ────────────────────────────────────────────────────
    const [items, setItems] = useState<ItemLocal[]>([newEmptyItem()]);

    // ── Combobox search per item ─────────────────────────────────
    const [searchQueries, setSearchQueries] = useState<Record<number, string>>({});

    // Catálogo dropdown: índice abierto + coords fixed (escapa cualquier overflow)
    const [openCatalogIdx,  setOpenCatalogIdx]  = useState<number | null>(null);
    const [catalogDropStyle, setCatalogDropStyle] = useState<React.CSSProperties>({});
    const catalogDropRef = useRef<HTMLDivElement>(null);

    // Cerrar dropdown de catálogo al hacer clic fuera
    useEffect(() => {
        if (openCatalogIdx === null) return;
        function handler(e: MouseEvent) {
            if (catalogDropRef.current && catalogDropRef.current.contains(e.target as Node)) return;
            setOpenCatalogIdx(null);
        }
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [openCatalogIdx]);

    // ── Modal de seriales ────────────────────────────────────────
    const [serialModalIdx, setSerialModalIdx] = useState<number | null>(null);

    // ── Estado UI ────────────────────────────────────────────────
    const [errorMsg,       setErrorMsg]       = useState<string | null>(null);
    const [exito,          setExito]          = useState(false);
    const [showLeaveModal, setShowLeaveModal] = useState(false);

    // ── Navigation guard refs ────────────────────────────────────
    const pendingNavRef   = useRef<(() => void) | null>(null);
    const originalPushRef = useRef<typeof history.pushState | null>(null);
    const formUrlRef      = useRef('');

    // Capturar URL del formulario al montar
    useEffect(() => { formUrlRef.current = window.location.href; }, []);

    // ── Condición de cambios sin guardar ─────────────────────────
    const hasChanges = !exito && (
        !!numeroGuia.trim()
        || !!proveedorId
        || items.some(i => !!i.modelo)
    );

    // Restaurar pushState original (llamar antes de navegar o al desmontar)
    const restoreGuard = useCallback(() => {
        if (originalPushRef.current) {
            history.pushState = originalPushRef.current;
            originalPushRef.current = null;
        }
    }, []);

    // ── Guard 1: F5 / cierre de pestaña (silencioso) ─────────────
    useEffect(() => {
        if (!hasChanges) return;
        const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [hasChanges]);

    // ── Guard 2: Navegación interna (modal custom) ────────────────
    useEffect(() => {
        if (!hasChanges) return;

        // Guardar referencia al pushState original
        originalPushRef.current = history.pushState.bind(history);

        // Interceptar pushState (cubre <Link> y router.push)
        history.pushState = function (state, title, url) {
            const target = url
                ? new URL(url.toString(), window.location.href).href
                : window.location.href;

            // Dejar pasar si es la misma URL (scroll restore de Next.js, etc.)
            if (target === window.location.href) {
                return originalPushRef.current!(state, title, url);
            }

            // Guardar la navegación pendiente y mostrar modal
            pendingNavRef.current = () => originalPushRef.current!(state, title, url);
            setShowLeaveModal(true);
        };

        // Interceptar botón Atrás / Adelante del navegador
        const handlePopState = () => {
            const destination = window.location.href;
            // Volver visualmente a la URL del formulario
            originalPushRef.current!(null, '', formUrlRef.current);
            pendingNavRef.current = () => {
                restoreGuard();
                router.push(destination);
            };
            setShowLeaveModal(true);
        };

        window.addEventListener('popstate', handlePopState);

        return () => {
            restoreGuard();
            window.removeEventListener('popstate', handlePopState);
        };
    }, [hasChanges, restoreGuard, router]);

    // ── Handlers del modal de salida ─────────────────────────────
    function handleLeaveConfirm() {
        setShowLeaveModal(false);
        restoreGuard();
        pendingNavRef.current?.();
        pendingNavRef.current = null;
    }

    function handleLeaveCancel() {
        setShowLeaveModal(false);
        pendingNavRef.current = null;
    }

    // ── Resto de handlers ─────────────────────────────────────────

    const catalogoFiltrado = useMemo(() => {
        if (!bodegaDestinoId) return catalogo;
        return catalogo.filter(c => c.bodega_id === bodegaDestinoId || !c.bodega_id);
    }, [catalogo, bodegaDestinoId]);

    function getSearchResults(idx: number) {
        const q = (searchQueries[idx] ?? '').toLowerCase().trim();
        if (!q) return catalogoFiltrado.slice(0, 20);
        return catalogoFiltrado
            .filter(c => c.modelo.toLowerCase().includes(q) || c.familia.toLowerCase().includes(q))
            .slice(0, 20);
    }

    function updateItem(idx: number, patch: Partial<ItemLocal>) {
        setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
    }

    function removeItem(idx: number) {
        setItems(prev => prev.filter((_, i) => i !== idx));
        const newQ = { ...searchQueries };
        delete newQ[idx];
        setSearchQueries(newQ);
    }

    function selectFromCatalogo(idx: number, entry: CatalogoEntry) {
        updateItem(idx, {
            familia:        entry.familia,
            modelo:         entry.modelo,
            es_serializado: entry.es_serializado,
            cantidad:       1,
            seriales:       [],
        });
        setSearchQueries(prev => ({ ...prev, [idx]: '' }));
        setOpenCatalogIdx(null);
    }

    function openCatalog(idx: number, trigger: HTMLButtonElement) {
        const rect = trigger.getBoundingClientRect();
        setCatalogDropStyle({
            position: 'fixed',
            top:      rect.bottom + 4,
            left:     rect.left,
            width:    rect.width,
            zIndex:   99999,
        });
        setOpenCatalogIdx(prev => (prev === idx ? null : idx));
        setSearchQueries(prev => ({ ...prev, [idx]: '' }));
    }

    const totalUnidades = items.reduce((s, i) => s + i.cantidad, 0);

    const puedeEnviar = !isPending
        && !!numeroGuia.trim()
        && !!proveedorId
        && !!bodegaDestinoId
        && items.length > 0
        && items.every(i =>
            !!i.familia.trim()
            && !!i.modelo.trim()
            && i.cantidad >= 1
            && (!i.es_serializado || i.seriales.length === i.cantidad)
        );

    async function handleSubmit() {
        if (!puedeEnviar) return;
        setErrorMsg(null);

        let documentoUrl: string | null = null;

        if (docFile) {
            setUploadingDoc(true);
            try {
                const supabase = createClient();
                const ext  = docFile.name.split('.').pop()?.toLowerCase() ?? 'pdf';
                const path = `guias/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
                const { error: upErr } = await supabase.storage.from('guias_despacho').upload(path, docFile, { upsert: true });
                if (upErr) {
                    setUploadingDoc(false);
                    setErrorMsg(`Error al subir documento: ${upErr.message}`);
                    return;
                }
                const { data: { publicUrl } } = supabase.storage.from('guias_despacho').getPublicUrl(path);
                documentoUrl = publicUrl;
            } catch {
                setUploadingDoc(false);
                setErrorMsg('Error inesperado al subir el documento.');
                return;
            }
            setUploadingDoc(false);
        }

        startTransition(async () => {
            const result = await procesarGuiaIngresoAction({
                numero_guia:       numeroGuia,
                tipo_documento:    tipoDoc,
                proveedor_id:      proveedorId!,
                bodega_destino_id: bodegaDestinoId,
                fecha_guia:        fechaGuia,
                observaciones,
                documento_url:     documentoUrl,
                items,
            });
            if (result.error) {
                setErrorMsg(result.error);
                return;
            }
            setExito(true);
            router.refresh();
            setTimeout(() => {
                setExito(false);
                setTipoDoc('GD');
                setNumeroGuia('');
                setProveedorId(null);
                setProveedorNombre('');
                setBodegaDestinoId('');
                setBodegaDestinoNombre('');
                setObservaciones('');
                removeDoc();
                setItems([newEmptyItem()]);
                onSuccess();
            }, 1800);
        });
    }

    // ── Render ────────────────────────────────────────────────────

    if (exito) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 flex flex-col items-center text-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>
                <p className="text-lg font-black text-slate-900">Guía procesada con éxito</p>
                <p className="text-sm text-slate-500">
                    El stock fue ingresado y los movimientos quedaron registrados.
                </p>
            </div>
        );
    }

    return (
        <>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 to-teal-500" />

            <div className="p-6 space-y-6">
                {/* ── Cabecera ────────────────────────────────────── */}
                <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                        Datos de la guía
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* ── Tipo de Documento + N° ────────────────────── */}
                        <div className="space-y-2">
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                                    Tipo de Documento <span className="text-red-400">*</span>
                                </label>
                                {/* Selector segmentado — no native select */}
                                <div className="flex bg-slate-100 p-0.5 rounded-xl gap-0.5">
                                    {(['GD', 'FC'] as const).map(tipo => (
                                        <button
                                            key={tipo}
                                            type="button"
                                            onClick={() => setTipoDoc(tipo)}
                                            className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${
                                                tipoDoc === tipo
                                                    ? tipo === 'GD'
                                                        ? 'bg-white text-blue-700 shadow-sm'
                                                        : 'bg-white text-emerald-700 shadow-sm'
                                                    : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                        >
                                            {tipo === 'GD' ? 'Guía (GD)' : 'Factura (FC)'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                                    N° Documento <span className="text-red-400">*</span>
                                </label>
                                <div className={`flex items-center border rounded-xl overflow-hidden focus-within:ring-2 transition-colors ${
                                    tipoDoc === 'GD'
                                        ? 'border-blue-200 focus-within:ring-blue-200 focus-within:border-blue-400'
                                        : 'border-emerald-200 focus-within:ring-emerald-200 focus-within:border-emerald-400'
                                }`}>
                                    <span className={`px-3 py-2.5 text-sm font-black border-r select-none ${
                                        tipoDoc === 'GD'
                                            ? 'text-blue-700 bg-blue-50 border-blue-200'
                                            : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                                    }`}>
                                        {tipoDoc}-
                                    </span>
                                    <input
                                        type="text"
                                        value={numeroGuia}
                                        onChange={e => setNumeroGuia(e.target.value)}
                                        placeholder="102030"
                                        className="flex-1 px-3 py-2.5 text-sm focus:outline-none bg-white"
                                    />
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                                Proveedor <span className="text-red-400">*</span>
                            </label>
                            <ProveedorCombobox
                                proveedores={proveedores}
                                value={proveedorId}
                                displayValue={proveedorNombre}
                                onChange={(id, nombre) => {
                                    setProveedorId(id);
                                    setProveedorNombre(nombre);
                                }}
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                                Bodega destino <span className="text-red-400">*</span>
                            </label>
                            <BodegaCombobox
                                bodegas={bodegas}
                                value={bodegaDestinoId || null}
                                displayValue={bodegaDestinoNombre}
                                onChange={(id, nombre) => {
                                    setBodegaDestinoId(id);
                                    setBodegaDestinoNombre(nombre);
                                }}
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                                Fecha guía
                            </label>
                            <input
                                type="date"
                                value={fechaGuia}
                                onChange={e => setFechaGuia(e.target.value)}
                                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 transition-colors"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                                Observaciones
                            </label>
                            <textarea
                                value={observaciones}
                                onChange={e => setObservaciones(e.target.value)}
                                placeholder="Notas adicionales (opcional)"
                                rows={2}
                                maxLength={500}
                                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 transition-colors resize-none"
                            />
                        </div>

                        {/* Dropzone documento */}
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                                Documento de respaldo
                            </label>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            {docFile ? (
                                <div className="flex items-center gap-3 border border-emerald-200 bg-emerald-50 rounded-xl px-3 py-2.5">
                                    <FileText className="w-5 h-5 text-emerald-600 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-slate-800 truncate">{docFile.name}</p>
                                        <p className="text-[10px] text-slate-500">
                                            {(docFile.size / 1024).toFixed(0)} KB
                                        </p>
                                    </div>
                                    <button type="button" onClick={removeDoc} className="text-slate-400 hover:text-red-500 transition-colors">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full border-2 border-dashed border-slate-200 rounded-xl px-3 py-4 flex flex-col items-center gap-1.5 hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors"
                                >
                                    <Upload className="w-5 h-5 text-slate-400" />
                                    <span className="text-xs font-bold text-slate-500">PDF, JPG o PNG</span>
                                    <span className="text-[10px] text-slate-400">Haz clic para adjuntar</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Separador */}
                <div className="h-px bg-gradient-to-r from-slate-200 via-emerald-100 to-transparent" />

                {/* ── Ítems ───────────────────────────────────────── */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Ítems de la guía ({items.length} ítem{items.length !== 1 ? 's' : ''} · {totalUnidades} ud.)
                        </p>
                        <button
                            type="button"
                            onClick={() => setItems(prev => [...prev, newEmptyItem()])}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-800 transition-colors"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Agregar ítem
                        </button>
                    </div>

                    <div className="space-y-3 min-h-[420px]">
                        {items.map((item, idx) => {
                            const results = getSearchResults(idx);
                            const serialesOk = !item.es_serializado || item.seriales.length === item.cantidad;

                            return (
                                <div
                                    key={idx}
                                    className="relative bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                            Ítem #{idx + 1}
                                        </span>
                                        {items.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeItem(idx)}
                                                className="text-slate-400 hover:text-red-500 transition-colors"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>

                                    {/* Combobox catálogo */}
                                    <div className="relative">
                                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                                            Equipo del catálogo <span className="text-red-400">*</span>
                                        </label>
                                        <button
                                            type="button"
                                            onClick={e => openCatalog(idx, e.currentTarget)}
                                            className={`w-full flex items-center justify-between border rounded-xl px-3 py-2.5 text-sm text-left transition-colors ${
                                                item.modelo
                                                    ? 'border-emerald-300 bg-emerald-50/50'
                                                    : openCatalogIdx === idx
                                                    ? 'border-indigo-400 ring-2 ring-indigo-200'
                                                    : 'border-slate-200 hover:border-indigo-300'
                                            }`}
                                        >
                                            {item.modelo ? (
                                                <span className="flex items-center gap-2">
                                                    <span className="font-bold text-slate-900">{item.modelo}</span>
                                                    <span className="text-[10px] text-slate-400">{item.familia}</span>
                                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                                                        item.es_serializado
                                                            ? 'bg-violet-100 text-violet-600'
                                                            : 'bg-teal-100 text-teal-600'
                                                    }`}>
                                                        {item.es_serializado ? 'Serial' : 'Genérico'}
                                                    </span>
                                                </span>
                                            ) : (
                                                <span className="text-slate-400">Buscar en catálogo…</span>
                                            )}
                                            <Search className="w-4 h-4 text-slate-400 shrink-0" />
                                        </button>

                                        {openCatalogIdx === idx && (
                                            <div
                                                ref={catalogDropRef}
                                                style={catalogDropStyle}
                                                className="border border-indigo-200 rounded-xl bg-white shadow-2xl overflow-hidden"
                                            >
                                                <div className="p-2">
                                                    <input
                                                        autoFocus
                                                        type="text"
                                                        value={searchQueries[idx] ?? ''}
                                                        onChange={e => setSearchQueries(prev => ({ ...prev, [idx]: e.target.value }))}
                                                        placeholder="Buscar modelo o familia…"
                                                        className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                                        onKeyDown={e => {
                                                            if (e.key === 'Escape') setOpenCatalogIdx(null);
                                                        }}
                                                    />
                                                </div>
                                                <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                                                    {results.length === 0 ? (
                                                        <p className="text-xs text-slate-400 text-center py-4">
                                                            Sin resultados en el catálogo
                                                        </p>
                                                    ) : (
                                                        results.map((c, ci) => (
                                                            <button
                                                                key={ci}
                                                                type="button"
                                                                onClick={() => selectFromCatalogo(idx, c)}
                                                                className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-indigo-50 transition-colors text-left"
                                                            >
                                                                <div>
                                                                    <p className="text-xs font-bold text-slate-800">{c.modelo}</p>
                                                                    <p className="text-[10px] text-slate-400">{c.familia}</p>
                                                                </div>
                                                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                                                                    c.es_serializado
                                                                        ? 'bg-violet-100 text-violet-600'
                                                                        : 'bg-teal-100 text-teal-600'
                                                                }`}>
                                                                    {c.es_serializado ? 'Serial' : 'Genérico'}
                                                                </span>
                                                            </button>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Campos dinámicos según tipo */}
                                    {item.modelo && (
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Cantidad *</label>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    value={item.cantidad}
                                                    onChange={e => {
                                                        const val = Math.max(1, parseInt(e.target.value) || 1);
                                                        updateItem(idx, {
                                                            cantidad: val,
                                                            seriales: item.es_serializado
                                                                ? item.seriales.slice(0, val)
                                                                : [],
                                                        });
                                                    }}
                                                    className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-200"
                                                />
                                            </div>

                                            {item.es_serializado && (
                                                <div className="flex items-end">
                                                    <button
                                                        type="button"
                                                        onClick={() => setSerialModalIdx(idx)}
                                                        className={`w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                                                            serialesOk
                                                                ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                                                : 'bg-violet-100 text-violet-700 border border-violet-200 hover:bg-violet-200'
                                                        }`}
                                                    >
                                                        <Barcode className="w-3.5 h-3.5" />
                                                        {serialesOk
                                                            ? `✓ ${item.seriales.length}/${item.cantidad} seriales`
                                                            : `Configurar seriales (${item.seriales.length}/${item.cantidad})`
                                                        }
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Error */}
                {errorMsg && (
                    <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        {errorMsg}
                    </div>
                )}

                <div className="h-px bg-gradient-to-r from-slate-200 via-emerald-100 to-transparent" />

                {/* Botón enviar */}
                <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-400">
                        {items.length} ítem{items.length !== 1 ? 's' : ''} · {totalUnidades} unidad{totalUnidades !== 1 ? 'es' : ''}
                    </p>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!puedeEnviar || uploadingDoc}
                        className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black text-white transition-all ${
                            puedeEnviar && !uploadingDoc
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-lg shadow-emerald-600/20 hover:scale-[1.02] active:scale-[0.98]'
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                    >
                        {isPending || uploadingDoc ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> {uploadingDoc ? 'Subiendo…' : 'Procesando…'}</>
                        ) : (
                            <><PackagePlus className="w-4 h-4" /> Procesar Guía</>
                        )}
                    </button>
                </div>
            </div>
        </div>

        {/* ── Modal de seriales ────────────────────────────────────── */}
        {serialModalIdx !== null && items[serialModalIdx] && (
            <SerialesInputModal
                modelo={items[serialModalIdx].modelo}
                familia={items[serialModalIdx].familia}
                cantidad={items[serialModalIdx].cantidad}
                initialSeriales={items[serialModalIdx].seriales}
                onConfirm={(seriales) => {
                    updateItem(serialModalIdx, { seriales });
                    setSerialModalIdx(null);
                }}
                onClose={() => setSerialModalIdx(null)}
            />
        )}

        {/* ── Modal: confirmación de salida ────────────────────────── */}
        {showLeaveModal && (
            <div
                className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                onClick={(e) => { if (e.target === e.currentTarget) handleLeaveCancel(); }}
            >
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-100">
                    <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 to-orange-500" />

                    <div className="p-6">
                        {/* Ícono */}
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                                <LogOut className="w-5 h-5 text-amber-600" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
                                    Cambios sin guardar
                                </p>
                                <h3 className="text-base font-black text-slate-900 leading-tight">
                                    ¿Salir del formulario?
                                </h3>
                            </div>
                        </div>

                        <p className="text-sm text-slate-600 leading-relaxed mb-6">
                            Los datos de esta guía se perderán si abandonas la página sin procesar.
                        </p>

                        {/* Acciones */}
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={handleLeaveCancel}
                                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                            >
                                Quedarme aquí
                            </button>
                            <button
                                type="button"
                                onClick={handleLeaveConfirm}
                                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-black text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 transition-all shadow-sm"
                            >
                                Sí, salir
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
        </>
    );
}
