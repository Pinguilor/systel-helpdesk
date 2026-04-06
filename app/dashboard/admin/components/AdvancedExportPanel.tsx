'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    X, FileSpreadsheet, Loader2, Filter,
    Columns, ChevronDown, Check,
} from 'lucide-react';
import {
    exportTicketsMaestroAction,
    fetchExportMetadataAction,
    type ExportFiltros,
    type ColumnasVisibles,
    type TicketMaestroRow,
} from '../exportActions';

const COLUMNAS_DEFAULT: ColumnasVisibles = {
    idTicket: true,
    fecha: true,
    estado: true,
    prioridad: true,
    cliente: true,
    restaurante: true,
    tipoServicio: true,
    categoria: true,
    falla: true,
    descripcion: true,
    comentarios: true,
    materiales: true,
    viaticos: true,
};

// ─────────────────────────────────────────────────────────────────────────────
// Colores Excel (mismos que ExportarMaestroButton)
// ─────────────────────────────────────────────────────────────────────────────
const ESTADO_COLORS: Record<string, { bg: string; font: string }> = {
    abierto:          { bg: 'FFE0F2FE', font: 'FF0369A1' },
    en_progreso:      { bg: 'FFE0E7FF', font: 'FF4338CA' },
    pendiente:        { bg: 'FFFFF7ED', font: 'FFC2410C' },
    programado:       { bg: 'FFF3E8FF', font: 'FF7C3AED' },
    esperando_agente: { bg: 'FFF1F5F9', font: 'FF475569' },
    resuelto:         { bg: 'FFD1FAE5', font: 'FF065F46' },
    cerrado:          { bg: 'FFF1F5F9', font: 'FF374151' },
    anulado:          { bg: 'FFFEE2E2', font: 'FFB91C1C' },
};
const PRIORIDAD_COLORS: Record<string, { bg: string; font: string }> = {
    crítica: { bg: 'FFF3E8FF', font: 'FF7C3AED' },
    alta:    { bg: 'FFFEE2E2', font: 'FFB91C1C' },
    media:   { bg: 'FFFEF3C7', font: 'FFD97706' },
    baja:    { bg: 'FFE0F2FE', font: 'FF0369A1' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Configuración de columnas: clave UI → campos reales del row
// ─────────────────────────────────────────────────────────────────────────────
const COLUMNAS_CONFIG: {
    key: keyof ColumnasVisibles;
    label: string;
    fields: (keyof TicketMaestroRow)[];
}[] = [
    { key: 'idTicket',     label: 'ID Ticket',         fields: ['N° Ticket', 'Título'] },
    { key: 'fecha',        label: 'Fechas',             fields: ['Fecha Creación', 'Fecha Resolución'] },
    { key: 'estado',       label: 'Estado',             fields: ['Estado'] },
    { key: 'prioridad',    label: 'Prioridad',          fields: ['Prioridad'] },
    { key: 'cliente',      label: 'Cliente / Agente',   fields: ['Cliente', 'Creado Por', 'Técnico Asignado'] },
    { key: 'restaurante',  label: 'Restaurante',        fields: ['Restaurante'] },
    { key: 'tipoServicio', label: 'Tipo de Servicio',   fields: ['Categoría'] },
    { key: 'categoria',    label: 'Categoría / Equipo', fields: ['Subcategoría', 'Elemento'] },
    { key: 'falla',        label: 'Acción / Falla',     fields: ['Acción'] },
    { key: 'descripcion',  label: 'Descripción',        fields: ['Descripción'] },
    { key: 'comentarios',  label: 'Comentarios',        fields: ['Último Comentario'] },
    { key: 'materiales',   label: 'Materiales',         fields: ['Materiales Usados'] },
    { key: 'viaticos',     label: 'Viáticos',           fields: ['Viáticos Total', 'Detalle Viáticos'] },
];

// Anchos de columna para Excel
const COL_WIDTHS: Record<string, number> = {
    'N° Ticket':         10,
    'Título':            30,
    'Estado':            14,
    'Prioridad':         11,
    'Cliente':           20,
    'Creado Por':        20,
    'Técnico Asignado':  20,
    'Restaurante':       22,
    'Categoría':         18,
    'Subcategoría':      20,
    'Elemento':          18,
    'Acción':            18,
    'Fecha Creación':    14,
    'Fecha Resolución':  14,
    'Descripción':       40,
    'Materiales Usados': 28,
    'Viáticos Total':    13,
    'Detalle Viáticos':  30,
    'Último Comentario': 40,
};

// Campos que tienen texto largo y deben wrap en Excel
const WRAP_FIELDS = new Set<keyof TicketMaestroRow>([
    'Descripción', 'Materiales Usados', 'Detalle Viáticos', 'Último Comentario',
]);

/** Convierte índice de columna (1-based) a letra(s) Excel: 1→A, 28→AB */
function colLetter(n: number): string {
    let result = '';
    while (n > 0) {
        n--;
        result = String.fromCharCode(65 + (n % 26)) + result;
        n = Math.floor(n / 26);
    }
    return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente CustomSelect (dropdown corporativo, portal para evitar clipping)
// ─────────────────────────────────────────────────────────────────────────────
interface SelectOption { value: string; label: string }

function CustomSelect({
    value, onChange, options, placeholder, disabled = false,
}: {
    value: string;
    onChange: (v: string) => void;
    options: SelectOption[];
    placeholder: string;
    disabled?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const [dropRect, setDropRect] = useState<{ top: number; left: number; width: number } | null>(null);

    const selectedLabel = options.find(o => o.value === value)?.label;

    const handleOpen = () => {
        if (disabled) return;
        if (triggerRef.current) {
            const r = triggerRef.current.getBoundingClientRect();
            setDropRect({ top: r.bottom + 4, left: r.left, width: r.width });
        }
        setOpen(true);
    };

    const pick = (v: string) => { onChange(v); setOpen(false); };

    return (
        <div className="relative">
            <button
                ref={triggerRef}
                type="button"
                onClick={handleOpen}
                disabled={disabled}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-sm font-medium transition-all
                    ${disabled ? 'opacity-60 cursor-not-allowed bg-slate-50 border-slate-200 text-slate-400'
                               : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-400 hover:bg-indigo-50/30 focus:outline-none focus:ring-2 focus:ring-indigo-500'}`}
            >
                <span className={`truncate ${!selectedLabel ? 'text-slate-400' : ''}`}>
                    {selectedLabel ?? placeholder}
                </span>
                <ChevronDown className={`w-4 h-4 shrink-0 ml-2 transition-transform duration-150 ${open ? 'rotate-180 text-indigo-500' : 'text-slate-400'}`} />
            </button>

            {open && dropRect && createPortal(
                <>
                    {/* Backdrop */}
                    <div className="fixed inset-0 z-[200]" onClick={() => setOpen(false)} />
                    {/* Dropdown */}
                    <div
                        className="fixed z-[201] bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 overflow-y-auto max-h-60"
                        style={{ top: dropRect.top, left: dropRect.left, width: dropRect.width }}
                    >
                        {/* Opción vacía / placeholder */}
                        <button
                            type="button"
                            onClick={() => pick('')}
                            className={`w-full text-left px-3 py-2 text-sm transition-colors rounded-lg mx-1 pr-4
                                ${!value ? 'text-indigo-600 font-semibold bg-indigo-50' : 'text-slate-400 font-medium hover:bg-slate-50'}`}
                            style={{ width: 'calc(100% - 8px)' }}
                        >
                            {placeholder}
                        </button>
                        {options.map(opt => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => pick(opt.value)}
                                className={`w-full text-left px-3 py-2 text-sm transition-colors rounded-lg mx-1
                                    ${value === opt.value ? 'text-indigo-700 font-semibold bg-indigo-50' : 'text-slate-700 font-medium hover:bg-slate-50'}`}
                                style={{ width: 'calc(100% - 8px)' }}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </>,
                document.body
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente Toggle Switch
// ─────────────────────────────────────────────────────────────────────────────
function ToggleSwitch({
    checked, onChange, label,
}: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
    return (
        <button
            type="button"
            onClick={() => onChange(!checked)}
            className="flex items-center gap-3 w-full group"
        >
            <div
                className={`relative w-9 h-5 rounded-full transition-colors duration-200 shrink-0 ${
                    checked ? 'bg-indigo-600' : 'bg-slate-300'
                }`}
            >
                <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                        checked ? 'translate-x-4' : 'translate-x-0'
                    }`}
                />
            </div>
            <span className={`text-sm font-medium select-none min-w-0 truncate ${checked ? 'text-slate-800' : 'text-slate-400'}`}>
                {label}
            </span>
        </button>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel principal
// ─────────────────────────────────────────────────────────────────────────────
interface Props {
    onClose: () => void;
}

export function AdvancedExportPanel({ onClose }: Props) {
    // ── Metadata para selectores ─────────────────────────────────────────────
    const [clientes, setClientes] = useState<{ id: string; nombre_fantasia: string }[]>([]);
    const [allProfiles, setAllProfiles] = useState<{ id: string; full_name: string; cliente_id: string | null }[]>([]);
    const [loadingMeta, setLoadingMeta] = useState(true);

    // ── Filtros (Bloque A) ────────────────────────────────────────────────────
    const [filtros, setFiltros] = useState<ExportFiltros>({
        fechaDesde: '', fechaHasta: '', clienteId: '',
        usuarioId: '', estado: '', prioridad: '',
    });

    // ── Columnas (Bloque B) ───────────────────────────────────────────────────
    const [columnas, setColumnas] = useState<ColumnasVisibles>({ ...COLUMNAS_DEFAULT });

    // ── Estado de generación ──────────────────────────────────────────────────
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        fetchExportMetadataAction().then(res => {
            if ('error' in res) return;
            setClientes(res.clientes);
            setAllProfiles(res.profiles);
        }).finally(() => setLoadingMeta(false));
    }, []);

    // Filtra perfiles por cliente seleccionado; resetea usuarioId si ya no aplica
    const filteredProfiles = filtros.clienteId
        ? allProfiles.filter(p => p.cliente_id === filtros.clienteId)
        : allProfiles;

    const setFiltro = <K extends keyof ExportFiltros>(key: K, value: ExportFiltros[K]) =>
        setFiltros(prev => ({
            ...prev,
            [key]: value,
            // al cambiar cliente, resetear usuario para evitar selección inválida
            ...(key === 'clienteId' ? { usuarioId: '' } : {}),
        }));

    const setColumna = (key: keyof ColumnasVisibles, value: boolean) =>
        setColumnas(prev => ({ ...prev, [key]: value }));

    const toggleAll = (value: boolean) =>
        setColumnas(Object.fromEntries(
            Object.keys(COLUMNAS_DEFAULT).map(k => [k, value])
        ) as ColumnasVisibles);

    const allOn  = Object.values(columnas).every(Boolean);
    const allOff = Object.values(columnas).every(v => !v);

    // ── Generación y descarga del Excel ───────────────────────────────────────
    const handleGenerate = async () => {
        setGenerating(true);
        setError(null);
        setSuccess(false);

        try {
            const result = await exportTicketsMaestroAction(filtros);

            if ('error' in result) {
                setError(result.error);
                return;
            }

            const allRows: TicketMaestroRow[] = result.data;

            // Calcular qué campos reales mostrar según los toggles activos
            const visibleFields: (keyof TicketMaestroRow)[] = COLUMNAS_CONFIG
                .filter(cfg => columnas[cfg.key])
                .flatMap(cfg => cfg.fields);

            if (visibleFields.length === 0) {
                setError('Selecciona al menos una columna para exportar.');
                return;
            }

            // Filtrar cada fila para incluir solo los campos visibles
            const rows = allRows.map(row =>
                Object.fromEntries(visibleFields.map(f => [f, row[f]])) as Partial<TicketMaestroRow>
            );

            // ── ExcelJS ───────────────────────────────────────────────────────
            const ExcelJS = (await import('exceljs')).default;
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'Systel × Loop';
            workbook.created = new Date();

            const sheet = workbook.addWorksheet('Tickets Maestro', {
                views: [{ state: 'frozen', ySplit: 4 }],
                pageSetup: {
                    paperSize: 9,
                    orientation: 'landscape',
                    fitToPage: true,
                    fitToWidth: 1,
                },
            });

            const headers = visibleFields;
            const TOTAL_COLS = headers.length;
            const lastCol = colLetter(TOTAL_COLS + 1); // +1 por col A auxiliar

            // Fila 1 — título principal
            sheet.mergeCells(`A1:${lastCol}1`);
            const titleCell = sheet.getCell('A1');
            titleCell.value = 'Reporte Maestro de Tickets — Systel × Loop';
            titleCell.font  = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF1E3A8A' } };
            titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
            titleCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4FF' } };
            sheet.getRow(1).height = 32;

            // Fila 2 — metadatos de generación
            sheet.mergeCells(`A2:${lastCol}2`);
            const subCell = sheet.getCell('A2');

            const filtroDesc: string[] = [];
            if (filtros.fechaDesde || filtros.fechaHasta)
                filtroDesc.push(`Período: ${filtros.fechaDesde || '∞'} → ${filtros.fechaHasta || '∞'}`);
            if (filtros.estado)    filtroDesc.push(`Estado: ${filtros.estado}`);
            if (filtros.prioridad) filtroDesc.push(`Prioridad: ${filtros.prioridad}`);

            subCell.value = [
                `Generado el ${new Date().toLocaleString('es-CL')}`,
                `${allRows.length} ticket(s)`,
                ...filtroDesc,
            ].join('   ·   ');
            subCell.font  = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF64748B' } };
            subCell.alignment = { vertical: 'middle', horizontal: 'left' };
            subCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4FF' } };
            sheet.getRow(2).height = 20;

            // Fila 3 — espaciador
            sheet.getRow(3).height = 8;

            // Fila 4 — encabezados
            const headerRow = sheet.getRow(4);
            headerRow.values = ['', ...headers];
            headerRow.height = 28;

            headers.forEach((_, idx) => {
                const cell = headerRow.getCell(idx + 2);
                cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
                cell.font  = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
                cell.border = {
                    bottom: { style: 'medium', color: { argb: 'FF3B5FC0' } },
                    right:  { style: 'thin',   color: { argb: 'FF3B5FC0' } },
                };
            });

            // Filas de datos (desde fila 5)
            rows.forEach((row, rowIdx) => {
                const sheetRow = sheet.addRow(['', ...headers.map(h => row[h] ?? '—')]);
                sheetRow.height = 18;

                const isEven    = rowIdx % 2 === 0;
                const estadoRaw = (row['Estado'] ?? '').toLowerCase();
                const prioRaw   = (row['Prioridad'] ?? '').toLowerCase();

                headers.forEach((header, colIdx) => {
                    const cell      = sheetRow.getCell(colIdx + 2);
                    const isWrap    = WRAP_FIELDS.has(header);
                    const baseBg    = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

                    cell.alignment = {
                        vertical: 'middle',
                        horizontal: isWrap ? 'left' : 'left',
                        wrapText: isWrap,
                    };
                    cell.font   = { name: 'Arial', size: 9 };
                    cell.border = {
                        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                        right:  { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    };

                    if (header === 'Estado') {
                        const c = ESTADO_COLORS[estadoRaw];
                        if (c) {
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c.bg } };
                            cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: c.font } };
                        } else {
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: baseBg } };
                        }
                    } else if (header === 'Prioridad') {
                        const c = PRIORIDAD_COLORS[prioRaw];
                        if (c) {
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c.bg } };
                            cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: c.font } };
                        } else {
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: baseBg } };
                        }
                    } else if (header === 'N° Ticket') {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
                        cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    } else if (header === 'Viáticos Total' && row['Viáticos Total'] !== '$0') {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } };
                        cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFB45309' } };
                    } else {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: baseBg } };
                    }
                });

                // Ajustar altura para texto largo
                const comentario   = (row['Último Comentario'] ?? row['Descripción'] ?? '') as string;
                if (comentario.length > 80)  sheetRow.height = 36;
                if (comentario.length > 160) sheetRow.height = 54;
            });

            // Anchos de columna
            sheet.getColumn(1).width = 0.5;
            headers.forEach((header, idx) => {
                sheet.getColumn(idx + 2).width = COL_WIDTHS[header] ?? 15;
            });

            // ── Descarga ──────────────────────────────────────────────────────
            const buffer   = await workbook.xlsx.writeBuffer();
            const blob     = new Blob([buffer as ArrayBuffer], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            });
            const fecha    = new Date().toISOString().split('T')[0];
            const fileName = `Reporte_Tickets_Loop_${fecha}.xlsx`;
            const url      = URL.createObjectURL(blob);
            const a        = document.createElement('a');
            a.href     = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            setSuccess(true);
        } catch (err: any) {
            console.error('Error exportando maestro:', err);
            setError('Error inesperado al generar el reporte.');
        } finally {
            setGenerating(false);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Panel lateral */}
            <div className="fixed top-0 right-0 z-50 h-full w-full max-w-[520px] bg-white shadow-2xl flex flex-col">

                {/* ── Header ── */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="bg-emerald-100 p-1.5 rounded-lg">
                            <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-800 leading-tight">
                                Filtro Avanzado de Exportación
                            </h2>
                            <p className="text-[11px] text-slate-400 font-medium">Configura tu reporte antes de descargar</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* ── Cuerpo scrolleable ── */}
                <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5 space-y-6">

                    {/* ═══ BLOQUE A — Filtros de Data ═══════════════════════ */}
                    <section>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="bg-indigo-100 p-1 rounded-md">
                                <Filter className="w-3.5 h-3.5 text-indigo-700" />
                            </div>
                            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest">
                                Bloque A — Filtros de Data
                            </h3>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">

                            {/* Rango de fechas */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                                    Rango de Fechas
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs text-slate-500 mb-1">Desde</label>
                                        <input
                                            type="date"
                                            value={filtros.fechaDesde}
                                            onChange={e => setFiltro('fechaDesde', e.target.value)}
                                            className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-700 font-medium transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 mb-1">Hasta</label>
                                        <input
                                            type="date"
                                            value={filtros.fechaHasta}
                                            min={filtros.fechaDesde || undefined}
                                            onChange={e => setFiltro('fechaHasta', e.target.value)}
                                            className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-700 font-medium transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Cliente */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                    Cliente
                                </label>
                                <CustomSelect
                                    value={filtros.clienteId}
                                    onChange={v => setFiltro('clienteId', v)}
                                    disabled={loadingMeta}
                                    placeholder="Todos los clientes"
                                    options={clientes.map(c => ({ value: c.id, label: c.nombre_fantasia }))}
                                />
                            </div>

                            {/* Usuario */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                    Usuario (Creador)
                                </label>
                                <CustomSelect
                                    value={filtros.usuarioId}
                                    onChange={v => setFiltro('usuarioId', v)}
                                    disabled={loadingMeta}
                                    placeholder={filtros.clienteId ? 'Todos los usuarios del cliente' : 'Todos los usuarios'}
                                    options={filteredProfiles.map(p => ({ value: p.id, label: p.full_name }))}
                                />
                            </div>

                            {/* Estado y Prioridad en fila */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                        Estado
                                    </label>
                                    <CustomSelect
                                        value={filtros.estado}
                                        onChange={v => setFiltro('estado', v)}
                                        placeholder="Todos"
                                        options={[
                                            { value: 'abierto',          label: 'Abierto' },
                                            { value: 'en_progreso',      label: 'En Progreso' },
                                            { value: 'pendiente',        label: 'Pendiente' },
                                            { value: 'programado',       label: 'Programado' },
                                            { value: 'esperando_agente', label: 'Esp. Agente' },
                                            { value: 'resuelto',         label: 'Resuelto' },
                                            { value: 'cerrado',          label: 'Cerrado' },
                                            { value: 'anulado',          label: 'Anulado' },
                                        ]}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                        Prioridad
                                    </label>
                                    <CustomSelect
                                        value={filtros.prioridad}
                                        onChange={v => setFiltro('prioridad', v)}
                                        placeholder="Todas"
                                        options={[
                                            { value: 'baja',    label: 'Baja' },
                                            { value: 'media',   label: 'Media' },
                                            { value: 'alta',    label: 'Alta' },
                                            { value: 'crítica', label: 'Crítica' },
                                        ]}
                                    />
                                </div>
                            </div>

                            {/* Botón limpiar filtros */}
                            {(filtros.fechaDesde || filtros.fechaHasta || filtros.clienteId ||
                              filtros.usuarioId || filtros.estado || filtros.prioridad) && (
                                <button
                                    type="button"
                                    onClick={() => setFiltros({ fechaDesde: '', fechaHasta: '', clienteId: '', usuarioId: '', estado: '', prioridad: '' })}
                                    className="text-xs font-semibold text-slate-400 hover:text-red-500 transition-colors"
                                >
                                    Limpiar filtros
                                </button>
                            )}
                        </div>
                    </section>

                    {/* ═══ BLOQUE B — Visibilidad de Columnas ══════════════ */}
                    <section>
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                                <div className="bg-violet-100 p-1 rounded-md">
                                    <Columns className="w-3.5 h-3.5 text-violet-700" />
                                </div>
                                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest">
                                    Bloque B — Columnas del Excel
                                </h3>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => toggleAll(true)}
                                    disabled={allOn}
                                    className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 disabled:text-slate-300 disabled:cursor-default transition-colors"
                                >
                                    Todas
                                </button>
                                <span className="text-slate-300 text-xs">|</span>
                                <button
                                    type="button"
                                    onClick={() => toggleAll(false)}
                                    disabled={allOff}
                                    className="text-[11px] font-semibold text-slate-500 hover:text-red-500 disabled:text-slate-300 disabled:cursor-default transition-colors"
                                >
                                    Ninguna
                                </button>
                            </div>
                        </div>

                        <p className="text-[11px] text-slate-400 font-medium mb-3">
                            Activa o desactiva los datos que deseas incluir en tu reporte de Excel.
                            Los grupos en <span className="text-indigo-600 font-semibold">azul</span> estarán presentes; los apagados se omitirán.
                        </p>

                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                            <div className="grid grid-cols-2 gap-x-6 gap-y-3.5">
                                {COLUMNAS_CONFIG.map(cfg => (
                                    <ToggleSwitch
                                        key={cfg.key}
                                        checked={columnas[cfg.key]}
                                        onChange={v => setColumna(cfg.key, v)}
                                        label={cfg.label}
                                    />
                                ))}
                            </div>

                            {/* Contador de columnas activas */}
                            <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
                                <span className="text-[11px] text-slate-400 font-medium">
                                    {Object.values(columnas).filter(Boolean).length} de {COLUMNAS_CONFIG.length} grupos activos
                                </span>
                                <span className="text-[11px] text-slate-400 font-medium">
                                    {COLUMNAS_CONFIG
                                        .filter(c => columnas[c.key])
                                        .reduce((acc, c) => acc + c.fields.length, 0)} columnas en Excel
                                </span>
                            </div>
                        </div>
                    </section>

                    {/* Feedback */}
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm font-medium rounded-xl flex items-start gap-2">
                            <span className="shrink-0 mt-0.5">✗</span>
                            <span>{error}</span>
                        </div>
                    )}
                    {success && (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium rounded-xl flex items-center gap-2">
                            <Check className="w-4 h-4 shrink-0" />
                            Reporte descargado correctamente. Puedes cerrar este panel.
                        </div>
                    )}
                </div>

                {/* ── Footer fijo ── */}
                <div className="shrink-0 px-6 py-4 border-t border-slate-200 bg-white flex items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={generating}
                        className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all disabled:opacity-60"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleGenerate}
                        disabled={generating || allOff}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-sm"
                    >
                        {generating ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Generando reporte...
                            </>
                        ) : (
                            <>
                                <FileSpreadsheet className="w-4 h-4" />
                                Generar y Descargar
                            </>
                        )}
                    </button>
                </div>
            </div>
        </>
    );
}
