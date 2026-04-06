'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
    Package2, RefreshCw, Download, Search, Filter, X,
    TrendingUp, Hash, BarChart2, Layers, ChevronDown, Eye,
    ChevronLeft, ChevronRight,
} from 'lucide-react';
import type { ConsumoRow } from './types';
import { CustomSelect } from '@/app/dashboard/components/CustomSelect';

// ─── Corporate bar colors (indigo gradient top→bottom) ───────────────────────
const BAR_COLORS = [
    '#3730a3', '#4338ca', '#4f46e5', '#6366f1', '#818cf8',
    '#a5b4fc', '#c7d2fe', '#c7d2fe', '#c7d2fe', '#c7d2fe',
];

// ─── Status badge configs ─────────────────────────────────────────────────────
const ESTADO_TICKET: Record<string, { label: string; bg: string; border: string; dot: string; text: string }> = {
    abierto:          { label: 'Abierto',      bg: 'bg-blue-50',    border: 'border-blue-200',    dot: 'bg-blue-400',    text: 'text-blue-700' },
    en_progreso:      { label: 'En Progreso',  bg: 'bg-violet-50',  border: 'border-violet-200',  dot: 'bg-violet-500',  text: 'text-violet-700' },
    pendiente:        { label: 'Pendiente',    bg: 'bg-amber-50',   border: 'border-amber-200',   dot: 'bg-amber-400',   text: 'text-amber-700' },
    programado:       { label: 'Programado',   bg: 'bg-purple-50',  border: 'border-purple-200',  dot: 'bg-purple-400',  text: 'text-purple-700' },
    esperando_agente: { label: 'Sin Asignar',  bg: 'bg-slate-50',   border: 'border-slate-200',   dot: 'bg-slate-400',   text: 'text-slate-600' },
    resuelto:         { label: 'Resuelto',     bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500', text: 'text-emerald-700' },
    cerrado:          { label: 'Cerrado',      bg: 'bg-slate-100',  border: 'border-slate-300',   dot: 'bg-slate-600',   text: 'text-slate-700' },
    terminada:        { label: 'Terminada',    bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500', text: 'text-emerald-700' },
    terminado:        { label: 'Terminado',    bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500', text: 'text-emerald-700' },
    anulado:          { label: 'Anulado',      bg: 'bg-red-50',     border: 'border-red-200',     dot: 'bg-red-400',     text: 'text-red-700' },
};

function StatusBadge({ estado }: { estado: string }) {
    const cfg = ESTADO_TICKET[estado?.toLowerCase()] ?? {
        label: estado ?? '—',
        bg: 'bg-slate-50', border: 'border-slate-200', dot: 'bg-slate-400', text: 'text-slate-600',
    };
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold ${cfg.bg} ${cfg.border} ${cfg.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
        </span>
    );
}

// ─── Custom chart tooltip ─────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-slate-900 text-white rounded-xl px-4 py-3 shadow-2xl border border-slate-700 max-w-[220px]">
            <p className="text-slate-300 font-semibold text-xs mb-1 leading-snug">{label}</p>
            <p className="font-black text-white text-sm">{payload[0].value} <span className="font-medium text-slate-300">unidades</span></p>
        </div>
    );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, color }: {
    icon: React.ReactNode; label: string; value: string | number; sub?: string; color: string;
}) {
    return (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 flex items-start gap-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
                {icon}
            </div>
            <div className="min-w-0">
                <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-0.5">{label}</p>
                <p className="text-2xl font-black text-slate-900 leading-tight truncate">{value}</p>
                {sub && <p className="text-[11px] text-slate-400 font-medium mt-0.5 truncate">{sub}</p>}
            </div>
        </div>
    );
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
    rows: ConsumoRow[];
    tecnicos: string[];
    locales: string[];
    esCliente?: boolean;
}

const PAGE_SIZE = 25;

export function ConsumoMaterialesClient({ rows, tecnicos, locales, esCliente = false }: Props) {
    const router = useRouter();
    const [isRefreshing, setIsRefreshing] = useState(false);

    // ── Filters ──
    const [search, setSearch] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [filterTecnico, setFilterTecnico] = useState('');
    const [filterLocal, setFilterLocal] = useState('');
    const [filterEstado, setFilterEstado] = useState('');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const advancedRef = useRef<HTMLDivElement>(null);

    // ── Pagination ──
    const [page, setPage] = useState(1);

    useEffect(() => {
        function handler(e: MouseEvent) {
            if (advancedRef.current && !advancedRef.current.contains(e.target as Node)) {
                setShowAdvanced(false);
            }
        }
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Para clientes, el filtro de técnico no aplica
    const activeAdvancedCount = (esCliente
        ? [filterLocal, filterEstado]
        : [filterTecnico, filterLocal, filterEstado]
    ).filter(Boolean).length;

    // ── Filter options for CustomSelect ─────────────────────────────────────
    const tecnicoOptions = useMemo(() => [
        { value: '', label: 'Todos los técnicos' },
        ...tecnicos.map(t => ({ value: t, label: t })),
    ], [tecnicos]);

    const localOptions = useMemo(() => [
        { value: '', label: 'Todos los locales' },
        ...locales.map(l => ({ value: l, label: l })),
    ], [locales]);

    const estadoOptions = useMemo(() => [
        { value: '', label: 'Todos los estados' },
        ...Object.entries(ESTADO_TICKET).map(([val, cfg]) => ({ value: val, label: cfg.label })),
    ], []);

    // ── Filtered rows ────────────────────────────────────────────────────────
    const filteredRows = useMemo(() => {
        const q = search.toLowerCase();
        return rows.filter(r => {
            if (q && !r.nc.toLowerCase().includes(q) && !r.modelo.toLowerCase().includes(q) && !r.local.toLowerCase().includes(q)) return false;
            if (dateFrom && r.fecha < dateFrom) return false;
            if (dateTo && r.fecha > dateTo + 'T23:59:59') return false;
            if (filterTecnico && r.tecnico !== filterTecnico) return false;
            if (filterLocal && r.local !== filterLocal) return false;
            if (filterEstado && r.estadoTicket?.toLowerCase() !== filterEstado) return false;
            return true;
        });
    }, [rows, search, dateFrom, dateTo, filterTecnico, filterLocal, filterEstado]);

    // ── KPIs ─────────────────────────────────────────────────────────────────
    // totalMateriales: sólo mes actual (siempre sobre rows sin filtros)
    // topNC / topProd: sobre filteredRows para que coincidan con el gráfico
    const kpis = useMemo(() => {
        const now = new Date();
        const thisMonth = rows.filter(r => {
            const d = new Date(r.fecha);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });
        const totalMateriales = thisMonth.reduce((acc, r) => acc + Number(r.cantidad), 0);

        const ncMap = new Map<string, number>();
        for (const r of filteredRows) {
            if (r.nc !== '—') ncMap.set(r.nc, (ncMap.get(r.nc) ?? 0) + Number(r.cantidad));
        }
        const topNC = [...ncMap.entries()].sort((a, b) => b[1] - a[1])[0];

        const prodMap = new Map<string, number>();
        for (const r of filteredRows) {
            if (r.modelo !== '—') prodMap.set(r.modelo, (prodMap.get(r.modelo) ?? 0) + Number(r.cantidad));
        }
        const topProd = [...prodMap.entries()].sort((a, b) => b[1] - a[1])[0];

        return { totalMateriales, topNC, topProd };
    }, [rows, filteredRows]);

    // ── NC group parity (stable across pages) ───────────────────────────────
    // Assigns alternating 0/1 to each unique NC so rows belonging to the same
    // NC share a background, and adjacent NCs alternate color.
    const ncGroupParity = useMemo(() => {
        const map = new Map<string, number>();
        let parity = 0;
        let prev = '';
        for (const row of filteredRows) {
            if (row.nc !== prev) {
                if (prev !== '') parity = parity === 0 ? 1 : 0;
                prev = row.nc;
            }
            if (!map.has(row.nc)) map.set(row.nc, parity);
        }
        return map;
    }, [filteredRows]);

    // ── Chart data (top 10 from filtered rows) ───────────────────────────────
    const chartData = useMemo(() => {
        const prodMap = new Map<string, number>();
        for (const r of filteredRows) {
            if (r.modelo !== '—') prodMap.set(r.modelo, (prodMap.get(r.modelo) ?? 0) + r.cantidad);
        }
        return [...prodMap.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([name, value]) => ({ name, value }))
            .reverse();
    }, [filteredRows]);

    // ── Paginated rows ───────────────────────────────────────────────────────
    const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
    const pagedRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const prevSearch = useRef(search);
    useEffect(() => { if (prevSearch.current !== search) { setPage(1); prevSearch.current = search; } }, [search]);

    function handleRefresh() {
        setIsRefreshing(true);
        router.refresh();
        setTimeout(() => setIsRefreshing(false), 1200);
    }

    // ── Excel export — estándar Reporte Maestro (exceljs) ───────────────────
    async function handleExportExcel() {
        const ExcelJS = (await import('exceljs')).default;
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Systel × Loop';
        workbook.created = new Date();

        const sheet = workbook.addWorksheet('Consumo Materiales', {
            views: [{ state: 'frozen', ySplit: 4 }],
            pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
        });

        const HEADERS = ['N° NC', 'Local', 'Título del Ticket', 'Fecha', 'Técnico', 'Producto', 'Cantidad', 'Estado'];
        const TOTAL_COLS = HEADERS.length;
        const lastColLetter = String.fromCharCode(65 + TOTAL_COLS); // A=65, +8 cols = I

        // ── Fila 1: título principal ──────────────────────────────────────────
        sheet.mergeCells(`A1:${lastColLetter}1`);
        const titleCell = sheet.getCell('A1');
        titleCell.value     = 'Reporte de Consumo de Materiales — Systel × Loop';
        titleCell.font      = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF1E3A8A' } };
        titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
        titleCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4FF' } };
        sheet.getRow(1).height = 32;

        // ── Fila 2: metadatos ─────────────────────────────────────────────────
        sheet.mergeCells(`A2:${lastColLetter}2`);
        const subCell = sheet.getCell('A2');
        subCell.value     = `Generado el ${new Date().toLocaleString('es-CL')}   ·   ${filteredRows.length} registro(s)`;
        subCell.font      = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF64748B' } };
        subCell.alignment = { vertical: 'middle', horizontal: 'left' };
        subCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4FF' } };
        sheet.getRow(2).height = 20;

        // ── Fila 3: espaciador ────────────────────────────────────────────────
        sheet.getRow(3).height = 8;

        // ── Fila 4: encabezados ───────────────────────────────────────────────
        const headerRow = sheet.getRow(4);
        headerRow.values = ['', ...HEADERS];
        headerRow.height = 28;
        HEADERS.forEach((_, idx) => {
            const cell = headerRow.getCell(idx + 2);
            cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
            cell.font      = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
            cell.border    = {
                bottom: { style: 'medium', color: { argb: 'FF3B5FC0' } },
                right:  { style: 'thin',   color: { argb: 'FF3B5FC0' } },
            };
        });

        // ── Estado → color ARGB ───────────────────────────────────────────────
        const ESTADO_COLORS: Record<string, { bg: string; font: string }> = {
            abierto:          { bg: 'FFDBEAFE', font: 'FF1D4ED8' },
            en_progreso:      { bg: 'FFEDE9FE', font: 'FF6D28D9' },
            pendiente:        { bg: 'FFFEF3C7', font: 'FFB45309' },
            programado:       { bg: 'FFF5F3FF', font: 'FF7C3AED' },
            esperando_agente: { bg: 'FFF1F5F9', font: 'FF64748B' },
            resuelto:         { bg: 'FFD1FAE5', font: 'FF065F46' },
            cerrado:          { bg: 'FFF1F5F9', font: 'FF334155' },
            terminada:        { bg: 'FFD1FAE5', font: 'FF065F46' },
            terminado:        { bg: 'FFD1FAE5', font: 'FF065F46' },
            anulado:          { bg: 'FFFEE2E2', font: 'FFB91C1C' },
        };

        // ── Filas de datos ────────────────────────────────────────────────────
        filteredRows.forEach((r, rowIdx) => {
            const isEven   = rowIdx % 2 === 0;
            const baseBg   = isEven ? 'FFFFFFFF' : 'FFF8FAFC';
            const estadoKey = r.estadoTicket?.toLowerCase() ?? '';

            const sheetRow = sheet.addRow(['',
                `NC-${r.nc}`,
                r.localSigla !== '—' ? r.localSigla : '',
                r.localTitulo !== '—' ? r.localTitulo : '',
                r.fecha ? new Date(r.fecha).toLocaleDateString('es-CL') : '—',
                r.tecnico,
                r.modelo,
                r.cantidad,
                r.estadoTicket,
            ]);
            sheetRow.height = 18;

            HEADERS.forEach((header, colIdx) => {
                const cell = sheetRow.getCell(colIdx + 2);
                cell.font      = { name: 'Arial', size: 9 };
                cell.alignment = { vertical: 'middle', horizontal: 'left' };
                cell.border    = {
                    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    right:  { style: 'thin', color: { argb: 'FFE2E8F0' } },
                };

                if (header === 'N° NC') {
                    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
                    cell.font      = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                } else if (header === 'Estado') {
                    const c = ESTADO_COLORS[estadoKey];
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c ? c.bg : baseBg } };
                    if (c) cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: c.font } };
                } else {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: baseBg } };
                }
            });
        });

        // ── Anchos de columna ─────────────────────────────────────────────────
        sheet.getColumn(1).width = 0.5;   // col auxiliar A
        const COL_WIDTHS: Record<string, number> = {
            'N° NC': 12, 'Local': 12, 'Título del Ticket': 42,
            'Fecha': 14, 'Técnico': 26, 'Producto': 38, 'Cantidad': 10, 'Estado': 16,
        };
        HEADERS.forEach((h, idx) => { sheet.getColumn(idx + 2).width = COL_WIDTHS[h] ?? 15; });

        // ── Descarga ──────────────────────────────────────────────────────────
        const buffer = await workbook.xlsx.writeBuffer();
        const blob   = new Blob([buffer as ArrayBuffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const url  = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href  = url;
        link.download = `consumo_materiales_${new Date().toISOString().split('T')[0]}.xlsx`;
        link.click();
        URL.revokeObjectURL(url);
    }

    function clearFilters() {
        setSearch(''); setDateFrom(''); setDateTo('');
        setFilterTecnico(''); setFilterLocal(''); setFilterEstado('');
        setPage(1);
    }

    const hasAnyFilter = search || dateFrom || dateTo || filterTecnico || filterLocal || filterEstado;

    const CustomYTick = ({ x, y, payload }: any) => {
        const maxLen = 28;
        const label = payload.value?.length > maxLen ? payload.value.slice(0, maxLen) + '…' : payload.value;
        return (
            <text x={x} y={y} dy={4} textAnchor="end" fontSize={11} fill="#64748b" fontWeight={600}>
                {label}
            </text>
        );
    };

    return (
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">

            {/* ── Breadcrumb ──────────────────────────────────────────────── */}
            <nav className="flex items-center gap-2 text-sm">
                <Link
                    href={esCliente ? '/dashboard/usuario' : '/dashboard/admin'}
                    className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-600 transition-colors font-medium"
                >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Inicio
                </Link>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                <span className="font-black text-slate-700">Consumo de Materiales</span>
            </nav>

            {/* ── Header ──────────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-100 rounded-2xl">
                        <Layers className="w-7 h-7 text-indigo-600" />
                    </div>
                    <div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Trazabilidad</p>
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                            Consumo de Materiales
                        </h1>
                        <p className="text-sm text-slate-500 mt-0.5">
                            Equipos y consumibles entregados por NC.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={handleExportExcel}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-bold hover:bg-slate-50 transition-colors shadow-sm"
                    >
                        <Download className="w-4 h-4" />
                        Exportar Excel
                    </button>
                    <button
                        onClick={handleRefresh}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors shadow-sm"
                    >
                        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        Actualizar Datos
                    </button>
                </div>
            </div>

            {/* ── KPI Cards ───────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <KpiCard
                    icon={<Package2 className="w-5 h-5 text-indigo-600" />}
                    label="Total Materiales (Mes)"
                    value={kpis.totalMateriales.toLocaleString('es-CL')}
                    sub="Unidades despachadas este mes"
                    color="bg-indigo-50"
                />
                <KpiCard
                    icon={<Hash className="w-5 h-5 text-violet-600" />}
                    label="NC con Mayor Consumo"
                    value={kpis.topNC ? `NC-${kpis.topNC[0]}` : '—'}
                    sub={kpis.topNC ? `${kpis.topNC[1]} unidades este mes` : 'Sin datos este mes'}
                    color="bg-violet-50"
                />
                <KpiCard
                    icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}
                    label="Producto Más Utilizado"
                    value={kpis.topProd ? kpis.topProd[0] : '—'}
                    sub={kpis.topProd ? `${kpis.topProd[1]} unidades este mes` : 'Sin datos este mes'}
                    color="bg-emerald-50"
                />
            </div>

            {/* ── Bar Chart ───────────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-indigo-50 rounded-xl">
                        <BarChart2 className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                            Top 10 Productos Más Usados
                        </h2>
                        <p className="text-xs text-slate-400 font-medium">Basado en los filtros activos</p>
                    </div>
                </div>

                {chartData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                        <BarChart2 className="w-10 h-10 mb-2 opacity-30" />
                        <p className="text-sm font-semibold">Sin datos para mostrar</p>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={Math.max(chartData.length * 44 + 24, 200)}>
                        <BarChart layout="vertical" data={chartData} margin={{ top: 0, right: 24, left: 8, bottom: 0 }}>
                            <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} allowDecimals={false} />
                            <YAxis type="category" dataKey="name" width={210} tick={<CustomYTick />} axisLine={false} tickLine={false} />
                            <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f1f5f9' }} />
                            <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={32}>
                                {chartData.map((_, idx) => (
                                    <Cell key={idx} fill={BAR_COLORS[chartData.length - 1 - idx] ?? '#6366f1'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* ── Filter Toolbar ──────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
                <div className="flex flex-wrap gap-3 items-center">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[220px]">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1); }}
                            placeholder="Buscar por NC o Producto…"
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                        />
                    </div>

                    {/* Date range */}
                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                            className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                        />
                        <span className="text-slate-400 text-xs font-semibold">—</span>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={e => { setDateTo(e.target.value); setPage(1); }}
                            className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                        />
                    </div>

                    {/* Advanced Filters button */}
                    <div className="relative" ref={advancedRef}>
                        <button
                            onClick={() => setShowAdvanced(v => !v)}
                            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-bold transition-colors ${
                                showAdvanced || activeAdvancedCount > 0
                                    ? 'bg-indigo-600 border-indigo-600 text-white'
                                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                        >
                            <Filter className="w-4 h-4" />
                            Filtros Avanzados
                            {activeAdvancedCount > 0 && (
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white text-indigo-700 text-[10px] font-black">
                                    {activeAdvancedCount}
                                </span>
                            )}
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                        </button>

                        {showAdvanced && (
                            <div className="absolute right-0 top-full mt-2 z-30 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 space-y-4">
                                <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Filtros Avanzados</p>

                                {!esCliente && (
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 mb-1.5">Técnico</label>
                                        <CustomSelect
                                            id="filter-tecnico"
                                            value={filterTecnico}
                                            onChange={v => { setFilterTecnico(v); setPage(1); }}
                                            options={tecnicoOptions}
                                            placeholder="Todos los técnicos"
                                        />
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1.5">Local / Sucursal</label>
                                    <CustomSelect
                                        id="filter-local"
                                        value={filterLocal}
                                        onChange={v => { setFilterLocal(v); setPage(1); }}
                                        options={localOptions}
                                        placeholder="Todos los locales"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1.5">Estado del Ticket</label>
                                    <CustomSelect
                                        id="filter-estado"
                                        value={filterEstado}
                                        onChange={v => { setFilterEstado(v); setPage(1); }}
                                        options={estadoOptions}
                                        placeholder="Todos los estados"
                                    />
                                </div>

                                {activeAdvancedCount > 0 && (
                                    <button
                                        onClick={() => {
                                            if (!esCliente) setFilterTecnico('');
                                            setFilterLocal('');
                                            setFilterEstado('');
                                            setPage(1);
                                        }}
                                        className="w-full py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl border border-red-100 transition-colors"
                                    >
                                        Limpiar filtros avanzados
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Clear all */}
                    {hasAnyFilter && (
                        <button
                            onClick={clearFilters}
                            className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                        >
                            <X className="w-3.5 h-3.5" />
                            Limpiar
                        </button>
                    )}
                </div>

                {/* Results count */}
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium px-0.5">
                    <span>
                        {filteredRows.length.toLocaleString('es-CL')} registro{filteredRows.length !== 1 ? 's' : ''}
                        {hasAnyFilter && <span className="text-indigo-600 font-bold ml-1">(filtrado)</span>}
                    </span>
                    {totalPages > 1 && <span>Página {page} de {totalPages}</span>}
                </div>
            </div>

            {/* ── Table ───────────────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                {pagedRows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <Package2 className="w-12 h-12 mb-3 opacity-20" />
                        <p className="font-semibold text-sm">No hay registros que coincidan con los filtros</p>
                        {hasAnyFilter && (
                            <button onClick={clearFilters} className="mt-3 text-xs text-indigo-600 font-bold hover:underline">
                                Limpiar filtros
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-100 bg-slate-50/60">
                                        <th className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-widest">N° NC</th>
                                        <th className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-widest">Local / Sucursal</th>
                                        <th className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-widest">Fecha</th>
                                        {!esCliente && (
                                            <th className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-widest">Técnico</th>
                                        )}
                                        <th className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-widest">Producto (Modelo)</th>
                                        <th className="px-4 py-3 text-center text-xs font-black text-slate-500 uppercase tracking-widest">Cant.</th>
                                        <th className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-widest">Estado</th>
                                        <th className="px-4 py-3 text-center text-xs font-black text-slate-500 uppercase tracking-widest">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedRows.map((row, idx) => {
                                        // Alternating NC group background
                                        const isAltGroup = (ncGroupParity.get(row.nc) ?? 0) === 1;
                                        const rowBg = isAltGroup ? 'bg-sky-100/60' : 'bg-white';

                                        return (
                                            <tr
                                                key={`${row.solicitudId}-${idx}`}
                                                className={`border-b border-slate-50 last:border-0 hover:bg-indigo-50/40 transition-colors ${rowBg}`}
                                            >
                                                {/* N° NC */}
                                                <td className="px-4 py-3">
                                                    {row.ticketId ? (
                                                        <Link
                                                            href={`/dashboard/ticket/${row.ticketId}`}
                                                            className="text-blue-600 hover:underline font-medium text-sm"
                                                        >
                                                            NC-{row.nc}
                                                        </Link>
                                                    ) : (
                                                        <span className="text-slate-400 text-sm">NC-{row.nc}</span>
                                                    )}
                                                </td>

                                                {/* Local / Cliente */}
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        {row.localSigla !== '—' && (
                                                            <>
                                                                <span className="font-semibold text-slate-800 text-sm shrink-0">{row.localSigla}</span>
                                                                <span className="text-slate-300 text-sm shrink-0">•</span>
                                                            </>
                                                        )}
                                                        <span className="text-sm text-slate-500 font-normal truncate max-w-[250px]" title={row.localTitulo}>
                                                            {row.localTitulo}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Fecha */}
                                                <td className="px-4 py-3 text-slate-500 text-sm whitespace-nowrap">
                                                    {row.fecha
                                                        ? new Date(row.fecha).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
                                                        : '—'}
                                                </td>

                                                {/* Técnico — oculto para clientes */}
                                                {!esCliente && (
                                                    <td className="px-4 py-3">
                                                        <span className="text-slate-700 text-sm font-medium">{row.tecnico}</span>
                                                    </td>
                                                )}

                                                {/* Producto */}
                                                <td className="px-4 py-3">
                                                    <p className="text-slate-800 font-bold text-sm">{row.modelo}</p>
                                                    {row.familia && row.familia !== '—' && (
                                                        <p className="text-xs text-slate-400 font-medium">{row.familia}</p>
                                                    )}
                                                </td>

                                                {/* Cantidad */}
                                                <td className="px-4 py-3 text-center">
                                                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 font-black text-sm">
                                                        {row.cantidad}
                                                    </span>
                                                </td>

                                                {/* Estado */}
                                                <td className="px-4 py-3">
                                                    <StatusBadge estado={row.estadoTicket} />
                                                </td>

                                                {/* Acciones */}
                                                <td className="px-4 py-3 text-center">
                                                    {row.ticketId && (
                                                        <Link
                                                            href={`/dashboard/ticket/${row.ticketId}`}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-indigo-100 text-slate-600 hover:text-indigo-700 text-xs font-bold transition-colors"
                                                            title="Ver ticket"
                                                        >
                                                            <Eye className="w-3.5 h-3.5" />
                                                            Ver
                                                        </Link>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/40">
                                <span className="text-xs text-slate-500 font-medium">
                                    Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredRows.length)} de {filteredRows.length.toLocaleString('es-CL')}
                                </span>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Anterior
                                    </button>
                                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                                        const p = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= totalPages - 3 ? totalPages - 6 + i : page - 3 + i;
                                        return (
                                            <button
                                                key={p}
                                                onClick={() => setPage(p)}
                                                className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                                                    page === p ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-200'
                                                }`}
                                            >
                                                {p}
                                            </button>
                                        );
                                    })}
                                    <button
                                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                        disabled={page === totalPages}
                                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Siguiente
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
