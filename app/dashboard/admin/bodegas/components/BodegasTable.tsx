'use client';

import React, { useState, useMemo, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Inventario, Bodega } from '@/types/database.types';
import { Search, Server, Box, ChevronDown, ChevronUp, ChevronRight, PackageOpen, RefreshCw, AlertCircle, AlertTriangle, FileSpreadsheet, EyeOff, Eye, Loader2 } from 'lucide-react';
import { CustomSelect } from '@/app/dashboard/components/CustomSelect';
import { loadMoreInventarioAction } from '../actions';

interface BodegasTableProps {
    inventario: (Inventario & { bodegas: Bodega })[];
    bodegasDisponibles: Bodega[];
    totalCount: number;
    countCritico: number;
    countBajo: number;
    bodegaIds: string[];
}

export function BodegasTable({ inventario, bodegasDisponibles, totalCount, countCritico, countBajo, bodegaIds }: BodegasTableProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [allInventario, setAllInventario] = useState(inventario);
    const [nextPage, setNextPage]     = useState(1);
    const [loadingMore, setLoadingMore] = useState(false);
    const hasMore = allInventario.length < totalCount;
    const [selectedBodegaId, setSelectedBodegaId] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [stockFilter, setStockFilter] = useState<'all' | 'critical' | 'low'>('all');
    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [showAgotados, setShowAgotados] = useState(false);

    useEffect(() => {
        setLastUpdated(new Date());
    }, []);

    useEffect(() => {
        if (!isPending && lastUpdated !== null) {
            setLastUpdated(new Date());
        }
    }, [isPending]);

    const toggleRow = (id: string) => {
        setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleRefresh = () => {
        startTransition(() => {
            router.refresh();
        });
    };

    async function handleLoadMore() {
        setLoadingMore(true);
        const result = await loadMoreInventarioAction(nextPage, bodegaIds);
        if (!result.error && result.data.length > 0) {
            setAllInventario(prev => [...prev, ...result.data as any]);
            setNextPage(p => p + 1);
        }
        setLoadingMore(false);
    }

    // Derived states
    const filteredInventario = useMemo(() => {
        return allInventario.filter(item => {
            const matchesBodega = selectedBodegaId === 'all' || item.bodega_id === selectedBodegaId;
            const matchesSearch = item.modelo?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  item.familia?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                  (item.numero_serie && item.numero_serie.toLowerCase().includes(searchTerm.toLowerCase()));
            
            return matchesBodega && matchesSearch;
        });
    }, [allInventario, selectedBodegaId, searchTerm]);

    // Grouping by modelo + familia + bodega_id (one row per physical location)
    const groupedInventario = useMemo(() => {
        const groups: Record<string, {
            id: string;
            modelo: string;
            familia: string;
            es_serializado: boolean;
            totalItems: number;
            bodegaNombre: string;
            items: (Inventario & { bodegas: Bodega })[];
        }> = {};

        filteredInventario.forEach(item => {
            const key = `${item.modelo}|${item.familia}|${item.bodega_id}`;
            if (!groups[key]) {
                groups[key] = {
                    id: key,
                    modelo: item.modelo || 'Desconocido',
                    familia: item.familia || 'Sin Familia',
                    es_serializado: !!item.es_serializado,
                    totalItems: 0,
                    bodegaNombre: (item as any).bodegas?.nombre || 'Bodega Desconocida',
                    items: []
                };
            }
            groups[key].items.push(item);
            if (item.estado?.toLowerCase() === 'disponible' || item.estado?.toLowerCase() === 'dañado') {
                groups[key].totalItems += item.cantidad;
            }
        });

        return Object.values(groups);
    }, [filteredInventario]);

    const agotadosCount = useMemo(
        () => groupedInventario.filter(g => g.totalItems === 0).length,
        [groupedInventario]
    );

    const filteredGroups = useMemo(() => {
        let base = showAgotados ? groupedInventario : groupedInventario.filter(g => g.totalItems > 0);
        if (stockFilter === 'critical') return base.filter(g => g.totalItems <= 3);
        if (stockFilter === 'low') return base.filter(g => g.totalItems > 3 && g.totalItems <= 10);
        return base;
    }, [groupedInventario, stockFilter, showAgotados]);

    const handleExport = async () => {
        try {
            setIsExporting(true);
            const ExcelJS = (await import('exceljs')).default;
            
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('Inventario Global', {
                views: [{ state: 'frozen', ySplit: 4 }]
            });

            // 1. Document Header (Rows 1-2)
            sheet.mergeCells('A1:E1');
            const titleCell = sheet.getCell('A1');
            titleCell.value = 'Reporte de Inventario Global - Systel × Loop';
            titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF1E3A8A' } };
            titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
            sheet.getRow(1).height = 30;

            sheet.mergeCells('A2:E2');
            const dateCell = sheet.getCell('A2');
            dateCell.value = `Generado el: ${new Date().toLocaleString('es-CL')}`;
            dateCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF64748B' } };
            sheet.getRow(2).height = 20;

            // Row 3 empty
            sheet.getRow(3).height = 15;

            // 2. Table Headers (Row 4)
            const headersRow = sheet.getRow(4);
            headersRow.values = ['Hardware', 'Familia', 'Tipo', 'Bodega', 'Cantidad Total'];
            headersRow.height = 25;
            
            headersRow.eachCell((cell) => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF1E3A8A' } // Dark blue
                };
                cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    bottom: { style: 'medium', color: { argb: 'FF94A3B8' } },
                    left: { style: 'thin', color: { argb: 'FF1E3A8A' } },
                    right: { style: 'thin', color: { argb: 'FF1E3A8A' } }
                };
            });

            // 3 & 4. Data Formatting & Conditional Styling
            filteredGroups.forEach((group) => {
                const hasSeriales = group.es_serializado;
                const isAgotado = group.totalItems === 0;
                const tipo = isAgotado ? 'AGOTADO' : (hasSeriales ? 'Serializado' : 'Genérico');

                const row = sheet.addRow([
                    group.modelo,
                    group.familia,
                    tipo,
                    group.bodegaNombre,
                    group.totalItems
                ]);

                row.height = 20;

                let bgColor = 'FFFFFFFF'; // default white
                let fontColor = 'FF334155'; // default slate-700
                
                if (isAgotado) {
                    bgColor = 'FFFEE2E2'; // red-100
                    fontColor = 'FFDC2626'; // red-600
                } else if (group.totalItems > 0 && group.totalItems <= 3) {
                    bgColor = 'FFFEF3C7'; // amber-100
                    fontColor = 'FFD97706'; // amber-600
                }

                row.eachCell((cell, colNumber) => {
                    cell.alignment = { vertical: 'middle', horizontal: colNumber === 5 ? 'center' : 'left', wrapText: true };
                    cell.border = {
                        bottom: { style: 'thin', color: { argb: 'FFF1F5F9' } },
                        left: { style: 'thin', color: { argb: 'FFF1F5F9' } },
                        right: { style: 'thin', color: { argb: 'FFF1F5F9' } }
                    };
                    
                    if (bgColor !== 'FFFFFFFF') {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: bgColor }
                        };
                        
                        // Highlight Cantidad & Tipo implicitly
                        if (colNumber === 5 || (isAgotado && colNumber === 3)) {
                            cell.font = { bold: true, color: { argb: fontColor } };
                        }
                    }
                });
            });

            // Auto-width adjustment
            sheet.columns?.forEach((column, index) => {
                let maxLength = 0;
                (column as any)?.eachCell({ includeEmpty: false }, (cell: any) => {
                    const columnLength = cell.text ? cell.text.length : 10;
                    if (columnLength > maxLength) {
                        maxLength = columnLength;
                    }
                });
                if (column) {
                    const minWidth = index === 0 ? 30 : index === 3 ? 35 : 15;
                    column.width = Math.max(maxLength + 2, minWidth);
                }
            });

            // 5. Generate and Download
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer as any], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const fileName = `Inventario_Global_${new Date().toISOString().split('T')[0]}.xlsx`;
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error exporting to Excel:', error);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 select-none">
            {/* Stats Cards Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Critical Stock Card */}
                <div 
                    onClick={() => setStockFilter(stockFilter === 'critical' ? 'all' : 'critical')}
                    className={`relative overflow-hidden backdrop-blur-xl p-6 rounded-3xl border transition-all duration-300 ease-out cursor-pointer flex items-center justify-between group active:scale-[0.98] ${
                        stockFilter === 'critical' 
                            ? 'border-rose-500/30 bg-gradient-to-tr from-rose-500/[0.04] via-rose-500/[0.01] to-white/80 shadow-lg shadow-rose-500/5 translate-y-[-2px]' 
                            : 'border-slate-200/50 bg-white/60 hover:border-rose-300/80 hover:bg-white/80 hover:shadow-md hover:shadow-rose-500/[0.02] hover:-translate-y-0.5'
                    }`}
                >
                    {/* Background decorative glow */}
                    <div className="absolute -right-4 -bottom-4 w-28 h-28 bg-rose-500/5 rounded-full filter blur-xl group-hover:scale-125 transition-transform duration-700" />
                    
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                            stockFilter === 'critical' 
                                ? 'bg-gradient-to-tr from-rose-600 to-rose-500 text-white shadow-lg shadow-rose-500/20' 
                                : 'bg-rose-500/10 text-rose-600 group-hover:bg-rose-500/20'
                        }`}>
                            <AlertCircle className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                                </span>
                                <p className="text-xs font-black text-slate-800 tracking-tight uppercase">Equipos en Stock Crítico</p>
                            </div>
                            <p className="text-[11px] font-medium text-slate-400 mt-0.5">0 a 3 unidades disponibles</p>
                        </div>
                    </div>
                    <div className="flex items-baseline gap-0.5 shrink-0 z-10">
                        <span className={`text-4xl font-black tracking-tight transition-colors duration-300 ${
                            stockFilter === 'critical' ? 'text-rose-600' : 'text-slate-900 group-hover:text-rose-600'
                        }`}>{countCritico}</span>
                        <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest ml-1">uds</span>
                    </div>
                </div>

                {/* Low Stock Card */}
                <div 
                    onClick={() => setStockFilter(stockFilter === 'low' ? 'all' : 'low')}
                    className={`relative overflow-hidden backdrop-blur-xl p-6 rounded-3xl border transition-all duration-300 ease-out cursor-pointer flex items-center justify-between group active:scale-[0.98] ${
                        stockFilter === 'low' 
                            ? 'border-amber-500/30 bg-gradient-to-tr from-amber-500/[0.04] via-amber-500/[0.01] to-white/80 shadow-lg shadow-amber-500/5 translate-y-[-2px]' 
                            : 'border-slate-200/50 bg-white/60 hover:border-amber-300/80 hover:bg-white/80 hover:shadow-md hover:shadow-amber-500/[0.02] hover:-translate-y-0.5'
                    }`}
                >
                    {/* Background decorative glow */}
                    <div className="absolute -right-4 -bottom-4 w-28 h-28 bg-amber-500/5 rounded-full filter blur-xl group-hover:scale-125 transition-transform duration-700" />
                    
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                            stockFilter === 'low' 
                                ? 'bg-gradient-to-tr from-amber-600 to-amber-500 text-white shadow-lg shadow-amber-500/20' 
                                : 'bg-amber-500/10 text-amber-600 group-hover:bg-amber-500/20'
                        }`}>
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                </span>
                                <p className="text-xs font-black text-slate-800 tracking-tight uppercase">Equipos con Stock Bajo</p>
                            </div>
                            <p className="text-[11px] font-medium text-slate-400 mt-0.5">4 a 10 unidades disponibles</p>
                        </div>
                    </div>
                    <div className="flex items-baseline gap-0.5 shrink-0 z-10">
                        <span className={`text-4xl font-black tracking-tight transition-colors duration-300 ${
                            stockFilter === 'low' ? 'text-amber-600' : 'text-slate-900 group-hover:text-amber-600'
                        }`}>{countBajo}</span>
                        <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest ml-1">uds</span>
                    </div>
                </div>
            </div>

            {/* Table Container Wrapper */}
            <div className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-xl shadow-indigo-950/[0.02] border border-slate-200/40 overflow-visible flex flex-col gap-4">
                
                {/* Unified Toolbar */}
                <div className="p-6 border-b border-slate-100/60 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    
                    {/* Search & Refresh */}
                    <div className="flex items-center gap-3 flex-1 w-full">
                        <button
                            onClick={handleRefresh}
                            disabled={isPending}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200/80 hover:border-indigo-500/30 rounded-xl text-xs font-black text-slate-600 hover:text-indigo-600 hover:bg-indigo-50/30 transition-all duration-200 disabled:opacity-50 shrink-0 cursor-pointer shadow-sm hover:shadow active:scale-95"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} />
                            <span className="hidden sm:inline">Actualizar</span>
                        </button>
                        
                        <div className="relative flex-1 w-full max-w-lg">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar por modelo, familia o serie…"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50/50 hover:bg-slate-50 border border-slate-200/80 focus:bg-white focus:border-indigo-500 rounded-xl text-xs font-semibold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all duration-200"
                            />
                        </div>
                    </div>

                    {/* Actions & Filters */}
                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            onClick={handleExport}
                            disabled={isExporting}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200/80 hover:border-emerald-500/30 rounded-xl text-xs font-black text-slate-600 hover:text-emerald-600 hover:bg-emerald-50/30 transition-all duration-200 disabled:opacity-50 cursor-pointer shadow-sm hover:shadow active:scale-95"
                        >
                            <FileSpreadsheet className={`w-3.5 h-3.5 text-emerald-600 ${isExporting ? 'animate-pulse' : ''}`} />
                            <span>{isExporting ? 'Exportando…' : 'Exportar Excel'}</span>
                        </button>

                        <button
                            onClick={() => setShowAgotados(v => !v)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-black transition-all duration-200 cursor-pointer shadow-sm hover:shadow active:scale-95 ${
                                showAgotados
                                    ? 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700 hover:border-indigo-700 shadow-md shadow-indigo-600/10'
                                    : 'bg-white border-slate-200/80 text-slate-600 hover:border-indigo-500/30 hover:text-indigo-600 hover:bg-indigo-50/30'
                            }`}
                        >
                            {showAgotados ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                            <span>Ver sin stock{agotadosCount > 0 && ` (${agotadosCount})`}</span>
                        </button>

                        <div className="w-48">
                            <CustomSelect
                                id="bodegaFilter"
                                value={selectedBodegaId}
                                onChange={setSelectedBodegaId}
                                options={[
                                    { value: 'all', label: 'Ver Todas (Global)' },
                                    ...bodegasDisponibles.map(b => ({
                                        value: b.id,
                                        label: `${b.nombre?.toLowerCase().includes('dañado') ? '🔌' : '🏢'} ${b.nombre}`
                                    }))
                                ]}
                                placeholder="Filtrar Bodega…"
                                strategy="absolute"
                            />
                        </div>
                    </div>
                </div>

                {/* Desktop Table View */}
                <div className="overflow-x-auto hidden md:block">
                    <table className="w-full text-slate-600 border-collapse">
                        <thead className="text-[10px] text-slate-400 uppercase tracking-widest bg-slate-50/20 border-b border-slate-100 font-black">
                            <tr>
                                <th className="px-6 py-4 text-left">Hardware</th>
                                <th className="px-6 py-4 text-left">Familia</th>
                                <th className="px-6 py-4 text-center">Tipo</th>
                                <th className="px-6 py-4 text-center">Bodega</th>
                                <th className="px-6 py-4 text-right">Cantidad Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-transparent">
                            {filteredGroups.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-16 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center gap-3 p-8 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200 mx-auto max-w-sm">
                                            <PackageOpen className="w-12 h-12 text-slate-300" strokeWidth={1.5} />
                                            <div className="font-bold text-slate-700 text-sm">Sin inventario</div>
                                            <p className="text-xs text-slate-400 leading-relaxed">No se encontraron equipos bajo los filtros seleccionados.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredGroups.map(group => {
                                    const isExpanded = expandedRows[group.id];
                                    const hasSeriales = group.es_serializado;
                                    const isAgotado = group.totalItems === 0;

                                    return (
                                        <React.Fragment key={group.id}>
                                            <tr
                                                className={`transition-all duration-200 border-b border-slate-50 last:border-b-0 ${hasSeriales ? 'cursor-pointer' : ''} ${isExpanded ? 'bg-indigo-50/[0.1] shadow-[inset_3px_0_0_0_#6366f1]' : 'hover:bg-indigo-50/[0.06] hover:shadow-[inset_3px_0_0_0_#e0e7ff]'} ${isAgotado ? 'opacity-60' : ''}`}
                                                onClick={() => hasSeriales && toggleRow(group.id)}
                                            >
                                                <td className="px-6 py-4 font-bold text-slate-900 flex items-center gap-3">
                                                    {hasSeriales && (
                                                        <div className={`p-1 rounded-lg transition-colors ${isExpanded ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-slate-150 text-slate-400'}`}>
                                                            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                                        </div>
                                                    )}
                                                    {!hasSeriales && <div className="w-6" />}
                                                    <div className="flex items-center gap-2">
                                                        <Server className="w-4 h-4 text-indigo-500" strokeWidth={2} />
                                                        <span className="font-bold tracking-tight text-slate-800">{group.modelo}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-50 text-slate-600 border border-slate-200/50">
                                                        {group.familia}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {isAgotado ? (
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black bg-rose-500/10 text-rose-700 border border-rose-500/20 uppercase tracking-wide">AGOTADO</span>
                                                    ) : hasSeriales ? (
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black bg-amber-500/10 text-amber-700 border border-amber-500/20 uppercase tracking-wide">Serializado</span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 uppercase tracking-wide">Genérico</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border border-indigo-100/50 bg-indigo-50/50 text-indigo-600">
                                                        🏢 {group.bodegaNombre}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    {group.totalItems === 0 ? (
                                                        <span className="inline-flex items-center gap-1.5 text-xs font-black text-rose-700 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-lg shadow-sm">
                                                            🔴 0 uds
                                                        </span>
                                                    ) : group.totalItems <= 3 ? (
                                                        <span className="inline-flex items-center gap-1.5 text-xs font-black text-rose-700 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-lg shadow-sm">
                                                            🔴 {group.totalItems} uds
                                                        </span>
                                                    ) : group.totalItems <= 10 ? (
                                                        <span className="inline-flex items-center gap-1.5 text-xs font-black text-amber-700 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg shadow-sm">
                                                            🟡 {group.totalItems} uds
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-700 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg shadow-sm">
                                                            🟢 {group.totalItems} uds
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                            {isExpanded && hasSeriales && (
                                                <tr className="bg-slate-50/[0.15] border-b border-indigo-100/10">
                                                    <td colSpan={5} className="px-8 py-5">
                                                        <div className="bg-slate-50/50 rounded-2xl border border-slate-200/40 p-5 relative overflow-hidden flex flex-col gap-4">
                                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 to-violet-500"></div>
                                                            <div className="flex items-center gap-2">
                                                                <Box className="w-4 h-4 text-slate-400" />
                                                                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                                                    Series en Stock ({group.totalItems})
                                                                 </h4>
                                                            </div>
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                                                {group.items.map(item => (
                                                                    <div key={item.id} className="flex flex-col gap-1.5 p-3.5 rounded-xl border border-slate-100 bg-white shadow-[0_2px_4px_rgba(0,0,0,0.01)] hover:border-indigo-200/60 hover:shadow-md hover:shadow-indigo-500/[0.03] transition-all duration-200 group active:scale-[0.99]">
                                                                        <div className="flex justify-between items-center">
                                                                            <span className="font-mono text-xs font-bold text-slate-700 group-hover:text-indigo-600 transition-colors">
                                                                                {item.numero_serie}
                                                                            </span>
                                                                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black uppercase border ${
                                                                                item.estado === 'Disponible' 
                                                                                    ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/25' 
                                                                                    : item.estado === 'Dañado' 
                                                                                    ? 'bg-rose-500/10 text-rose-700 border-rose-500/25' 
                                                                                    : 'bg-amber-500/10 text-amber-700 border-amber-500/25'
                                                                            }`}>
                                                                                {item.estado}
                                                                            </span>
                                                                        </div>
                                                                        <div className={`text-[9px] font-black uppercase flex items-center gap-1.5 truncate mt-0.5 ${
                                                                            item.bodegas?.nombre?.toLowerCase().includes('dañado') 
                                                                                ? 'text-rose-500' 
                                                                                : 'text-indigo-500'
                                                                        }`}>
                                                                            {item.bodegas?.nombre?.toLowerCase().includes('dañado') ? '🔌' : '🏢'}
                                                                            <span className="truncate">{item.bodegas?.nombre}</span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Load More Desktop Trigger */}
                {hasMore && (
                    <div className="hidden md:flex justify-center py-6 border-t border-slate-100/60">
                        <button
                            onClick={handleLoadMore}
                            disabled={loadingMore || isPending}
                            className="inline-flex items-center gap-2 px-6 py-3 border border-slate-200/80 hover:border-indigo-500/30 rounded-xl text-xs font-black text-slate-600 hover:text-indigo-600 hover:bg-indigo-50/30 disabled:opacity-50 transition-all duration-200 cursor-pointer shadow-sm hover:shadow active:scale-95"
                        >
                            {loadingMore
                                ? <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                                : <RefreshCw className="w-3.5 h-3.5" />
                            }
                            <span>{loadingMore ? 'Cargando más equipos…' : `Cargar más (${totalCount - allInventario.length} restantes)`}</span>
                        </button>
                    </div>
                )}

                {/* Mobile View: Collapsible Cards */}
                <div className="block md:hidden p-4 space-y-3 bg-slate-50/30 rounded-b-3xl">
                    {filteredGroups.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-3 p-8 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 mx-auto max-w-sm">
                            <PackageOpen className="w-12 h-12 text-slate-300" strokeWidth={1.5} />
                            <div className="font-bold text-slate-700 text-sm">Sin inventario</div>
                            <p className="text-xs text-slate-400 leading-relaxed text-center">No se encontraron equipos bajo los filtros seleccionados.</p>
                        </div>
                    ) : (
                        filteredGroups.map(group => {
                            const isExpanded = expandedRows[group.id];
                            const hasSeriales = group.es_serializado;
                            const isAgotado = group.totalItems === 0;
                            const isCritical = group.totalItems > 0 && group.totalItems <= 3;
                            const isLowStock = group.totalItems >= 4 && group.totalItems <= 10;

                            const bgStyle = isAgotado 
                                ? 'bg-gradient-to-tr from-rose-500/[0.02] to-white/90' 
                                : isCritical
                                ? 'bg-gradient-to-tr from-rose-500/[0.01] to-white/95'
                                : isLowStock
                                ? 'bg-gradient-to-tr from-amber-500/[0.01] to-white/95'
                                : 'bg-white';

                            const borderStyle = isAgotado 
                                ? 'border-rose-200/60' 
                                : isCritical 
                                ? 'border-rose-200/50 shadow-sm shadow-rose-500/[0.01]' 
                                : isLowStock 
                                ? 'border-amber-200/50 shadow-sm shadow-amber-500/[0.01]' 
                                : 'border-slate-200/50 shadow-sm shadow-indigo-950/[0.01]';

                            return (
                                <div key={group.id} className={`rounded-2xl border ${bgStyle} ${borderStyle} transition-all duration-300 overflow-hidden`}>
                                    <button 
                                        onClick={() => toggleRow(group.id)}
                                        className="w-full p-4 flex items-center justify-between text-left focus:outline-none active:bg-slate-50/50 relative"
                                    >
                                        <div className="flex flex-col gap-1.5 pr-4">
                                            <span className="font-black text-slate-800 break-words leading-tight tracking-tight text-sm">{group.modelo}</span>
                                            {isAgotado && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black bg-rose-500/10 text-rose-700 max-w-fit border border-rose-500/20 uppercase tracking-wider">
                                                    Agotado
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-col items-end gap-2 shrink-0">
                                            <div className="flex items-center">
                                                {isAgotado ? (
                                                    <span className="text-[11px] font-black text-rose-700 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-sm">
                                                        🔴 0 uds
                                                    </span>
                                                ) : isCritical ? (
                                                    <span className="text-[11px] font-black text-rose-700 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-sm">
                                                        🔴 {group.totalItems} uds
                                                    </span>
                                                ) : isLowStock ? (
                                                    <span className="text-[11px] font-black text-amber-700 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-sm">
                                                        🟡 {group.totalItems} uds
                                                    </span>
                                                ) : (
                                                    <span className="text-[11px] font-black text-emerald-700 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-sm">
                                                        🟢 {group.totalItems} uds
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex justify-end pr-1 text-slate-350">
                                                {isExpanded ? (
                                                    <ChevronUp className="w-4 h-4 text-indigo-500 transition-transform" />
                                                ) : (
                                                    <ChevronDown className="w-4 h-4 transition-transform" />
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                    
                                    {isExpanded && (
                                        <div className="px-4 pb-4 border-t border-slate-100/60 bg-slate-50/30 pt-3.5 space-y-3.5">
                                            <div className="flex flex-col gap-3">
                                                {/* Bodega */}
                                                <div className="flex items-start gap-2.5">
                                                    <span className="text-xs shrink-0 mt-0.5">🏭</span>
                                                    <div className="flex flex-col">
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Bodega</span>
                                                        <div className="flex flex-wrap gap-1 mt-0.5">
                                                            <span className="inline-flex px-2 py-0.5 rounded-lg text-[9px] font-black border border-indigo-100/30 bg-indigo-50/50 text-indigo-700">
                                                                🏢 {group.bodegaNombre}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                {/* Familia */}
                                                <div className="flex items-start gap-2.5">
                                                    <span className="text-xs shrink-0 mt-0.5">🏷️</span>
                                                    <div className="flex flex-col">
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Familia</span>
                                                        <span className="inline-flex mt-0.5 px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-50 text-slate-600 border border-slate-200/50 max-w-fit">
                                                            {group.familia}
                                                        </span>
                                                    </div>
                                                </div>
                                                
                                                {/* Tipo */}
                                                <div className="flex items-start gap-2.5">
                                                    <span className="text-xs shrink-0 mt-0.5">📄</span>
                                                    <div className="flex flex-col">
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tipo</span>
                                                        <div className="mt-0.5 flex">
                                                        {isAgotado ? (
                                                            <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-500/10 text-rose-700 border border-rose-500/20 uppercase tracking-wide">AGOTADO</span>
                                                        ) : hasSeriales ? (
                                                            <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-500/10 text-amber-700 border border-amber-500/20 uppercase tracking-wide">Serializado</span>
                                                        ) : (
                                                            <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 uppercase tracking-wide">Genérico</span>
                                                        )}
                                                        </div>
                                                    </div>
                                                </div>
 
                                                {/* Seriales Extra Info */}
                                                {hasSeriales && group.items.length > 0 && !isAgotado && (
                                                    <div className="mt-2 pt-3.5 border-t border-slate-200/50">
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                                            <Box className="w-3.5 h-3.5 text-slate-400" />
                                                            Series en Stock ({group.totalItems})
                                                        </p>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            {group.items.filter(i => i.estado === 'Disponible' || i.estado === 'Dañado').map(item => (
                                                                <div key={item.id} className="flex flex-col gap-1 p-2 bg-white rounded-xl border border-slate-100 shadow-[0_2px_4px_rgba(0,0,0,0.01)]">
                                                                    <span className="text-xs font-mono font-bold text-slate-700 truncate">{item.numero_serie}</span>
                                                                    <span className={`text-[8px] font-black uppercase tracking-wider ${item.bodegas?.nombre?.toLowerCase().includes('dañado') ? 'text-rose-500' : 'text-indigo-500'}`}>{item.bodegas?.nombre}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Load More Mobile Trigger */}
                {hasMore && (
                    <div className="md:hidden p-4 border-t border-slate-100/60 flex justify-center">
                        <button
                            onClick={handleLoadMore}
                            disabled={loadingMore || isPending}
                            className="inline-flex items-center gap-2 px-5 py-3 border border-slate-200/85 hover:border-indigo-500/30 rounded-xl text-xs font-black text-slate-600 hover:text-indigo-600 hover:bg-indigo-50/30 disabled:opacity-50 transition-all duration-200 cursor-pointer shadow-sm hover:shadow active:scale-95"
                        >
                            {loadingMore
                                ? <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                                : <RefreshCw className="w-3.5 h-3.5" />
                            }
                            <span>{loadingMore ? 'Cargando…' : `Cargar más (${totalCount - allInventario.length} restantes)`}</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
