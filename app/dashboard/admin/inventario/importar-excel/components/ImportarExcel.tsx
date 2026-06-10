'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import {
    FileSpreadsheet, Upload, CheckCircle2, AlertCircle,
    Download, PackageCheck, Loader2, RotateCcw, X,
    ArrowLeft, FileText,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { SearchableSelect } from '@/app/dashboard/components/SearchableSelect';
import { CustomSelect } from '@/app/dashboard/components/CustomSelect';
import { ingresoLoteAction } from '../../ingreso/actions';

type Bodega        = { id: string; nombre: string };
type CatalogoItem  = { id: string; familia: string; modelo: string; es_serializado: boolean; bodega_id: string };
type FilaEstado    = 'valido' | 'dup_archivo' | 'dup_bd';
type Fase          = 'config' | 'upload' | 'validando' | 'preview' | 'exito';

interface FilaPreview { serie: string; estado: FilaEstado }

interface Props {
    bodegas:  Bodega[];
    catalogo: CatalogoItem[];
}

const ESTADO_STYLE: Record<FilaEstado, { label: string; cls: string }> = {
    valido:      { label: 'Válido',          cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
    dup_archivo: { label: 'Dup. en archivo', cls: 'bg-amber-50  text-amber-700   border border-amber-200'   },
    dup_bd:      { label: 'Dup. en sistema', cls: 'bg-red-50    text-red-600     border border-red-200'      },
};

export function ImportarExcel({ bodegas, catalogo }: Props) {
    const [fase,          setFase]          = useState<Fase>('config');
    const [bodegaId,      setBodegaId]      = useState('');
    const [catalogoId,    setCatalogoId]    = useState('');
    const [isDragging,    setIsDragging]    = useState(false);
    const [fileName,      setFileName]      = useState('');
    const [filas,         setFilas]         = useState<FilaPreview[]>([]);
    const [submitError,   setSubmitError]   = useState<string | null>(null);
    const [parseError,    setParseError]    = useState<string | null>(null);
    const [insertedCount, setInsertedCount] = useState(0);
    const [isPending,     startTransition]  = useTransition();

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { setCatalogoId(''); }, [bodegaId]);

    const catalogoSerie    = bodegaId ? catalogo.filter(c => c.es_serializado && c.bodega_id === bodegaId) : [];
    const selectedBodega   = bodegas.find(b => b.id === bodegaId);
    const selectedCatalogo = catalogoSerie.find(c => c.id === catalogoId);

    const bodegaOptions   = bodegas.map(b => ({ value: b.id, label: b.nombre }));
    const catalogoOptions = catalogoSerie.map(c => ({ value: c.id, label: c.modelo, sublabel: c.familia }));

    const validos    = filas.filter(f => f.estado === 'valido').length;
    const dupArchivo = filas.filter(f => f.estado === 'dup_archivo').length;
    const dupBD      = filas.filter(f => f.estado === 'dup_bd').length;

    // ── Template download ──────────────────────────────────────────────────────

    function downloadTemplate() {
        const ws = XLSX.utils.aoa_to_sheet([
            ['numero_serie'],
            ['SN000001'],
            ['SN000002'],
            ['SN000003'],
        ]);
        ws['!cols'] = [{ wch: 24 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Seriales');
        const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
        const blob = new Blob([buf], { type: 'application/octet-stream' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = 'plantilla_ingreso_seriales.xlsx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ── File parsing + validation ──────────────────────────────────────────────

    async function parseAndValidate(file: File) {
        setFileName(file.name);
        setParseError(null);
        setFase('validando');

        try {
            const buffer = await file.arrayBuffer();
            const wb     = XLSX.read(buffer, { type: 'array' });
            const ws     = wb.Sheets[wb.SheetNames[0]];
            const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

            if (!rows || rows.length < 2) {
                setFase('upload');
                setParseError('El archivo está vacío o no tiene datos de seriales.');
                return;
            }

            // Find serial column by header keyword
            const header = (rows[0] ?? []) as any[];
            let colIdx = 0;
            const idx = header.findIndex(h =>
                typeof h === 'string' && h.toLowerCase().includes('serie'),
            );
            if (idx >= 0) colIdx = idx;

            const rawSeriales = (rows.slice(1) as any[][])
                .map(row => String(row[colIdx] ?? '').trim())
                .filter(Boolean);

            if (rawSeriales.length === 0) {
                setFase('upload');
                setParseError('No se encontraron seriales en el archivo. Verifica que la columna tenga el encabezado "numero_serie".');
                return;
            }

            // Detect in-file duplicates (keep first occurrence as valid, rest as dup_archivo)
            const seen       = new Set<string>();
            const dupArchivo = new Set<string>();
            for (const s of rawSeriales) {
                if (seen.has(s)) dupArchivo.add(s);
                else seen.add(s);
            }

            // Bulk DB check
            const unicos = Array.from(seen);
            const res  = await fetch('/api/inventario/check-serials-bulk', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ seriales: unicos }),
            });
            const { duplicados: dupBDArr } = await res.json() as { duplicados: string[] };
            const dupBDSet = new Set(dupBDArr);

            const filasResult: FilaPreview[] = rawSeriales.map(serie => ({
                serie,
                estado: dupArchivo.has(serie) ? 'dup_archivo'
                      : dupBDSet.has(serie)   ? 'dup_bd'
                      : 'valido',
            }));

            setFilas(filasResult);
            setFase('preview');
        } catch {
            setFase('upload');
            setParseError('Error al procesar el archivo. Verifica que sea un .xlsx, .xls o .csv válido.');
        }
    }

    function handleFileSelect(files: FileList | null) {
        if (!files || files.length === 0) return;
        const file = files[0];
        const name = file.name.toLowerCase();
        if (!name.endsWith('.xlsx') && !name.endsWith('.xls') && !name.endsWith('.csv')) {
            setParseError('Solo se aceptan archivos .xlsx, .xls o .csv');
            return;
        }
        setParseError(null);
        parseAndValidate(file);
    }

    function onDragOver(e: React.DragEvent)  { e.preventDefault(); setIsDragging(true); }
    function onDragLeave()                    { setIsDragging(false); }
    function onDrop(e: React.DragEvent) {
        e.preventDefault();
        setIsDragging(false);
        handleFileSelect(e.dataTransfer.files);
    }

    // ── Submit ─────────────────────────────────────────────────────────────────

    function handleSubmit() {
        if (!selectedCatalogo) return;
        const serialesValidos = filas.filter(f => f.estado === 'valido').map(f => f.serie);
        if (!serialesValidos.length) return;
        setSubmitError(null);
        startTransition(async () => {
            const result = await ingresoLoteAction({
                bodegaId,
                modelo:   selectedCatalogo.modelo,
                familia:  selectedCatalogo.familia,
                seriales: serialesValidos,
            });
            if (result.error) {
                setSubmitError(result.error);
            } else {
                setInsertedCount(result.inserted);
                setFase('exito');
            }
        });
    }

    function resetToUpload() {
        setFilas([]);
        setFileName('');
        setParseError(null);
        setSubmitError(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setFase('upload');
    }

    function resetAll() {
        setBodegaId('');
        setCatalogoId('');
        setFilas([]);
        setFileName('');
        setParseError(null);
        setSubmitError(null);
        setInsertedCount(0);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setFase('config');
    }

    // ── RENDER ─────────────────────────────────────────────────────────────────

    return (
        <div className="flex flex-col gap-6">

            {/* ══ FASE CONFIG ══════════════════════════════════════════════════ */}
            {fase === 'config' && (
                <div className="flex-1 flex items-center justify-center py-4">
                    <div className="w-full max-w-xl bg-white/80 backdrop-blur-xl rounded-3xl border border-slate-200/80 shadow-2xl p-8 flex flex-col gap-6 transition-all duration-300">
                        {/* Header: Centered & Modern */}
                        <div className="flex flex-col items-center text-center gap-3">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-emerald-550 flex items-center justify-center shadow-lg shadow-emerald-600/10">
                                <FileSpreadsheet className="w-6 h-6 text-white" strokeWidth={1.5} />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-800 tracking-tight">Importar desde Excel</h2>
                                <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-widest">
                                    Carga Masiva · Equipos Serializados
                                </p>
                            </div>
                        </div>

                        <div className="h-px bg-slate-100 w-full" />

                        <div className="space-y-6">
                            {/* Bodega destino */}
                            <div className="space-y-2">
                                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                    Bodega Destino
                                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                </label>
                                <CustomSelect
                                    id="bodega"
                                    value={bodegaId}
                                    onChange={setBodegaId}
                                    options={bodegaOptions}
                                    placeholder="Selecciona una bodega destino…"
                                    strategy="absolute"
                                />
                            </div>

                            {/* Modelo */}
                            <div className="space-y-2">
                                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                    Modelo / Equipo
                                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                </label>
                                {!bodegaId ? (
                                    <div className="h-[48px] rounded-xl border border-slate-200 bg-slate-50/50 flex items-center px-4 text-sm font-semibold text-slate-400">
                                        Primero selecciona una bodega
                                    </div>
                                ) : catalogoSerie.length === 0 ? (
                                    <div className="h-[48px] rounded-xl border border-amber-200/60 bg-amber-50/50 flex items-center px-4 text-sm font-semibold text-amber-600">
                                        Sin modelos serializados en esta bodega
                                    </div>
                                ) : (
                                    <SearchableSelect
                                        value={catalogoId}
                                        onChange={setCatalogoId}
                                        options={catalogoOptions}
                                        placeholder="Buscar modelo…"
                                        strategy="absolute"
                                    />
                                )}
                            </div>

                            {/* Template download hint */}
                            <div className="flex items-center justify-between p-4 bg-slate-50/80 rounded-2xl border border-slate-200/60">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                                        <FileText className="w-5 h-5 text-emerald-600" strokeWidth={1.75} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-700">¿Primera vez?</p>
                                        <p className="text-xs text-slate-400">Descarga la plantilla oficial</p>
                                    </div>
                                </div>
                                <button
                                    onClick={downloadTemplate}
                                    className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-emerald-700 hover:text-emerald-800 transition-colors px-3 py-2 bg-emerald-50 rounded-xl border border-emerald-100 hover:bg-emerald-100 cursor-pointer"
                                >
                                    <Download className="w-3.5 h-3.5" strokeWidth={2.5} />
                                    Plantilla
                                </button>
                            </div>

                            <button
                                onClick={() => setFase('upload')}
                                disabled={!bodegaId || !catalogoId}
                                className="w-full py-4 rounded-2xl font-black text-sm bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-600/5 hover:scale-[1.01] hover:shadow-lg duration-300"
                            >
                                Continuar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══ FASE UPLOAD ══════════════════════════════════════════════════ */}
            {fase === 'upload' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-black text-slate-800">Subir archivo</h2>
                            <p className="mt-0.5 text-sm text-slate-500">
                                <span className="font-bold text-slate-700">{selectedBodega?.nombre}</span>
                                {' · '}
                                <span className="font-bold text-slate-700">{selectedCatalogo?.modelo}</span>
                            </p>
                        </div>
                        <button
                            onClick={() => setFase('config')}
                            className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Cambiar config
                        </button>
                    </div>

                    {/* Drag-drop zone */}
                    <div
                        onDragOver={onDragOver}
                        onDragLeave={onDragLeave}
                        onDrop={onDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`relative flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-2xl p-10 cursor-pointer transition-all
                            ${isDragging
                                ? 'border-indigo-400 bg-indigo-50'
                                : 'border-slate-300 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/40'
                            }`}
                    >
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${isDragging ? 'bg-indigo-100' : 'bg-white border border-slate-200'}`}>
                            <Upload className={`w-6 h-6 ${isDragging ? 'text-indigo-500' : 'text-slate-400'}`} strokeWidth={1.5} />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-bold text-slate-700">
                                {isDragging ? 'Suelta el archivo aquí' : 'Arrastra tu archivo o haz clic para seleccionar'}
                            </p>
                            <p className="text-xs text-slate-400 mt-1">Soporta .xlsx, .xls y .csv</p>
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            className="hidden"
                            onChange={e => handleFileSelect(e.target.files)}
                        />
                    </div>

                    {parseError && (
                        <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-xl">
                            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" strokeWidth={2} />
                            <p className="text-sm text-red-600">{parseError}</p>
                        </div>
                    )}

                    {/* Format hint */}
                    <div className="text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-100 px-4 py-3 space-y-1">
                        <p className="font-bold text-slate-500 uppercase tracking-widest text-[10px]">Formato esperado</p>
                        <p>Primera fila: encabezado con <code className="font-mono bg-slate-200 px-1 rounded">numero_serie</code></p>
                        <p>Filas siguientes: un número de serie por fila</p>
                        <button onClick={downloadTemplate} className="mt-1 inline-flex items-center gap-1 font-bold text-indigo-600 hover:text-indigo-700">
                            <Download className="w-3 h-3" /> Descargar plantilla
                        </button>
                    </div>
                </div>
            )}

            {/* ══ FASE VALIDANDO ═══════════════════════════════════════════════ */}
            {fase === 'validando' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" strokeWidth={1.5} />
                    </div>
                    <div className="text-center">
                        <p className="font-black text-slate-800">Procesando archivo</p>
                        <p className="text-sm text-slate-400 mt-1">
                            Leyendo <span className="font-bold text-slate-600">{fileName}</span> y verificando duplicados…
                        </p>
                    </div>
                </div>
            )}

            {/* ══ FASE PREVIEW ═════════════════════════════════════════════════ */}
            {fase === 'preview' && (
                <div className="flex flex-col gap-4">

                    {/* Summary cards */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
                            <p className="text-2xl font-black text-emerald-700">{validos}</p>
                            <p className="text-xs font-bold text-emerald-600 mt-0.5">Válidos</p>
                        </div>
                        <div className={`border rounded-2xl p-4 text-center ${dupArchivo > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                            <p className={`text-2xl font-black ${dupArchivo > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{dupArchivo}</p>
                            <p className={`text-xs font-bold mt-0.5 ${dupArchivo > 0 ? 'text-amber-500' : 'text-slate-400'}`}>Dup. en archivo</p>
                        </div>
                        <div className={`border rounded-2xl p-4 text-center ${dupBD > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                            <p className={`text-2xl font-black ${dupBD > 0 ? 'text-red-600' : 'text-slate-400'}`}>{dupBD}</p>
                            <p className={`text-xs font-bold mt-0.5 ${dupBD > 0 ? 'text-red-500' : 'text-slate-400'}`}>Dup. en sistema</p>
                        </div>
                    </div>

                    {/* Context line */}
                    <div className="flex items-center justify-between px-1">
                        <p className="text-sm text-slate-500">
                            <span className="font-bold text-slate-700">{selectedBodega?.nombre}</span>
                            {' · '}
                            <span className="font-bold text-slate-700">{selectedCatalogo?.modelo}</span>
                            {' · '}
                            <span className="font-mono text-xs">{fileName}</span>
                        </p>
                        <button
                            onClick={resetToUpload}
                            className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Cambiar archivo
                        </button>
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-12">#</th>
                                        <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">N° Serie</th>
                                        <th className="text-right px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filas.map((fila, i) => {
                                        const est = ESTADO_STYLE[fila.estado];
                                        return (
                                            <tr key={i} className={fila.estado !== 'valido' ? 'bg-slate-50/60' : ''}>
                                                <td className="px-4 py-2.5 text-xs text-slate-400 font-mono">{i + 1}</td>
                                                <td className="px-4 py-2.5 font-mono font-bold text-slate-800">{fila.serie}</td>
                                                <td className="px-4 py-2.5 text-right">
                                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${est.cls}`}>
                                                        {fila.estado === 'valido'
                                                            ? <CheckCircle2 className="w-3 h-3" strokeWidth={2.5} />
                                                            : <AlertCircle  className="w-3 h-3" strokeWidth={2.5} />
                                                        }
                                                        {est.label}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {submitError && (
                        <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-xl">
                            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" strokeWidth={2} />
                            <p className="text-sm text-red-600">{submitError}</p>
                        </div>
                    )}

                    {validos === 0 ? (
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-center">
                            <p className="text-sm font-bold text-amber-700">No hay seriales válidos para ingresar</p>
                            <p className="text-xs text-amber-500 mt-0.5">Todos los seriales del archivo ya existen o están duplicados.</p>
                        </div>
                    ) : (
                        <button
                            onClick={handleSubmit}
                            disabled={isPending}
                            className="w-full py-3.5 rounded-xl font-black text-sm bg-indigo-600 hover:bg-indigo-700 text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isPending
                                ? <><Loader2 className="w-4 h-4 animate-spin" /> Registrando…</>
                                : <>
                                    <PackageCheck className="w-4 h-4" />
                                    Confirmar ingreso de {validos} {validos === 1 ? 'equipo' : 'equipos'}
                                    {(dupArchivo + dupBD) > 0 && (
                                        <span className="text-indigo-200 font-normal text-xs ml-1">
                                            ({dupArchivo + dupBD} omitidos)
                                        </span>
                                    )}
                                  </>
                            }
                        </button>
                    )}
                </div>
            )}

            {/* ══ FASE ÉXITO ═══════════════════════════════════════════════════ */}
            {fase === 'exito' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 flex flex-col items-center gap-5 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center">
                        <PackageCheck className="w-8 h-8 text-emerald-600" strokeWidth={1.5} />
                    </div>
                    <div>
                        <p className="text-xl font-black text-slate-800">
                            {insertedCount} {insertedCount === 1 ? 'equipo ingresado' : 'equipos ingresados'}
                        </p>
                        <p className="mt-1.5 text-sm text-slate-500">
                            <span className="font-bold text-slate-700">{selectedCatalogo?.modelo}</span>
                            {' registrado en '}
                            <span className="font-bold text-slate-700">{selectedBodega?.nombre}</span>
                        </p>
                        {(dupArchivo + dupBD) > 0 && (
                            <p className="mt-1 text-xs text-slate-400">
                                {dupArchivo + dupBD} {dupArchivo + dupBD === 1 ? 'serial omitido' : 'seriales omitidos'} por duplicados
                            </p>
                        )}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
                        <button
                            onClick={resetAll}
                            className="flex-1 py-2.5 rounded-xl font-bold text-sm border border-slate-300 hover:bg-slate-50 text-slate-700 transition-colors flex items-center justify-center gap-2"
                        >
                            <RotateCcw className="w-4 h-4" />
                            Nuevo ingreso
                        </button>
                        <a
                            href="/dashboard/admin/bodegas"
                            className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-indigo-600 hover:bg-indigo-700 text-white transition-colors flex items-center justify-center gap-2"
                        >
                            <FileSpreadsheet className="w-4 h-4" />
                            Ver inventario
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
}
