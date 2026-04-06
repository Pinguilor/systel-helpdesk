'use client';

import React, { useState, useMemo, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Inventario, Bodega } from '@/types/database.types';
import { Search, Server, Box, ChevronDown, ChevronUp, ChevronRight, PackageOpen, RefreshCw, AlertCircle, AlertTriangle, FileSpreadsheet, EyeOff, Eye } from 'lucide-react';
import { CustomSelect } from '@/app/dashboard/components/CustomSelect';

interface BodegasTableProps {
    inventario: (Inventario & { bodegas: Bodega })[];
    bodegasDisponibles: Bodega[];
}

export function BodegasTable({ inventario, bodegasDisponibles }: BodegasTableProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
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

    // Derived states
    const filteredInventario = useMemo(() => {
        return inventario.filter(item => {
            const matchesBodega = selectedBodegaId === 'all' || item.bodega_id === selectedBodegaId;
            const matchesSearch = item.modelo?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  item.familia?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                  (item.numero_serie && item.numero_serie.toLowerCase().includes(searchTerm.toLowerCase()));
            
            return matchesBodega && matchesSearch;
        });
    }, [inventario, selectedBodegaId, searchTerm]);

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

    const itemsCriticos = groupedInventario.filter(g => g.totalItems <= 3).length;
    const itemsBajos = groupedInventario.filter(g => g.totalItems > 3 && g.totalItems <= 10).length;

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
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 bg-slate-50/50 border-b border-gray-200">
                <div 
                    onClick={() => setStockFilter(stockFilter === 'critical' ? 'all' : 'critical')}
                    className={`bg-white border rounded-xl p-4 flex items-center justify-between shadow-sm cursor-pointer transition-all ${stockFilter === 'critical' ? 'ring-2 ring-red-500 border-red-500 shadow-red-100' : 'border-red-100 hover:border-red-300 hover:shadow-md'}`}
                >
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${stockFilter === 'critical' ? 'bg-red-500 text-white' : 'bg-red-50 text-red-500'}`}>
                            <AlertCircle className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-600">Equipos en Stock Crítico</p>
                            <p className="text-xs text-slate-400">Entre 0 y 3 unidades</p>
                        </div>
                    </div>
                    <span className="text-2xl font-black text-red-600">{itemsCriticos}</span>
                </div>
                <div 
                    onClick={() => setStockFilter(stockFilter === 'low' ? 'all' : 'low')}
                    className={`bg-white border rounded-xl p-4 flex items-center justify-between shadow-sm cursor-pointer transition-all ${stockFilter === 'low' ? 'ring-2 ring-amber-500 border-amber-500 shadow-amber-100' : 'border-amber-100 hover:border-amber-300 hover:shadow-md'}`}
                >
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${stockFilter === 'low' ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-500'}`}>
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-600">Equipos con Stock Bajo</p>
                            <p className="text-xs text-slate-400">Entre 4 y 10 unidades</p>
                        </div>
                    </div>
                    <span className="text-2xl font-black text-amber-600">{itemsBajos}</span>
                </div>
            </div>

            {/* ── Toolbar: two-row layout ─────────────────────────────── */}
            <div className="p-5 border-b border-gray-200 bg-white flex flex-col gap-3">

                {/* Row 1 — Refresh + Search */}
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={handleRefresh}
                        disabled={isPending}
                        className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 shrink-0"
                    >
                        <RefreshCw className={`w-4 h-4 ${isPending ? 'animate-spin' : ''}`} />
                        <span className="whitespace-nowrap">Actualizar</span>
                    </button>
                    {lastUpdated && (
                        <span className="text-xs font-medium text-zinc-400 whitespace-nowrap hidden sm:inline-block shrink-0">
                            {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    )}
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por modelo, familia o serie..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary outline-none transition-all"
                        />
                    </div>
                </div>

                {/* Row 2 — Actions + Filters */}
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={handleExport}
                        disabled={isExporting}
                        className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 shrink-0"
                    >
                        <FileSpreadsheet className={`w-4 h-4 text-emerald-600 ${isExporting ? 'animate-pulse' : ''}`} />
                        <span className="whitespace-nowrap">{isExporting ? 'Exportando...' : 'Exportar Inventario'}</span>
                    </button>
                    <button
                        onClick={() => setShowAgotados(v => !v)}
                        title={showAgotados ? 'Ocultar ítems sin stock' : 'Mostrar ítems sin stock'}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-bold transition-colors whitespace-nowrap shrink-0 ${
                            showAgotados
                                ? 'bg-slate-700 border-slate-700 text-white'
                                : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        {showAgotados ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        {showAgotados ? 'Ocultar sin stock' : `Ver sin stock${agotadosCount > 0 ? ` (${agotadosCount})` : ''}`}
                    </button>
                    <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                        <span className="text-sm font-bold text-slate-500 whitespace-nowrap hidden lg:inline shrink-0">Filtrar Bodega:</span>
                        <div className="flex-1 w-full">
                            <CustomSelect
                                id="bodegaFilter"
                                value={selectedBodegaId}
                                onChange={setSelectedBodegaId}
                                options={[
                                    { value: 'all', label: 'Ver Todas (Global)' },
                                    ...bodegasDisponibles.map(b => ({
                                        value: b.id,
                                        label: `${b.nombre?.toLowerCase().includes('dañado') ? '🔌 ' : '🏢 '} ${b.nombre}`
                                    }))
                                ]}
                                placeholder="Filtrar Bodega..."
                            />
                        </div>
                    </div>
                </div>
            </div>
            {/* ── End Toolbar ──────────────────────────────────────── */}

            {/* Desktop View */}
            <div className="overflow-x-auto hidden md:block">
                <table className="w-full text-sm text-left text-slate-600">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200 font-bold">
                        <tr>
                            <th className="px-6 py-4 rounded-tl-lg">Hardware</th>
                            <th className="px-6 py-4">Familia</th>
                            <th className="px-6 py-4 text-center">Tipo</th>
                            <th className="px-6 py-4 text-center">Bodega</th>
                            <th className="px-6 py-4 text-right">Cantidad Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredGroups.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                    <div className="flex flex-col items-center justify-center gap-3 p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-300 mx-auto max-w-md">
                                        <PackageOpen className="w-12 h-12 text-slate-300" />
                                        <div className="font-bold text-slate-700">No hay inventario</div>
                                        <p className="text-xs text-slate-500">No se encontraron equipos bajo los filtros seleccionados en la red central.</p>
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
                                            className={`hover:bg-slate-50 transition-colors ${hasSeriales ? 'cursor-pointer' : ''} ${isExpanded ? 'bg-indigo-50/30' : ''} ${isAgotado ? 'opacity-50' : ''}`}
                                            onClick={() => hasSeriales && toggleRow(group.id)}
                                        >
                                            <td className="px-6 py-4 font-bold text-slate-900 flex items-center gap-3">
                                                {hasSeriales && (
                                                    <div className="p-1 rounded-md hover:bg-slate-200 text-slate-400 transition-colors">
                                                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                    </div>
                                                )}
                                                {!hasSeriales && <div className="w-6" />}
                                                <div className="flex items-center gap-2">
                                                    <Server className="w-4 h-4 text-indigo-500" />
                                                    {group.modelo}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-medium">
                                                <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-md text-xs font-bold border border-slate-200">
                                                    {group.familia}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {isAgotado ? (
                                                    <span className="bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full text-xs border border-red-200">AGOTADO</span>
                                                ) : hasSeriales ? (
                                                    <span className="bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full text-xs border border-amber-200">Serializado</span>
                                                ) : (
                                                    <span className="bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full text-xs border border-emerald-200">Genérico</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest border border-dashed bg-indigo-50 text-indigo-600 border-indigo-200">
                                                    🏢 {group.bodegaNombre}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {group.totalItems <= 3 ? (
                                                    <span className="text-[14px] font-black text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded-lg">
                                                        🔴 {group.totalItems} <span className="text-[10px] text-red-400 font-medium tracking-wide">uds</span>
                                                    </span>
                                                ) : group.totalItems <= 10 ? (
                                                    <span className="text-[14px] font-black text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">
                                                        🟡 {group.totalItems} <span className="text-[10px] text-amber-500 font-medium tracking-wide">uds</span>
                                                    </span>
                                                ) : (
                                                    <>
                                                        <span className="text-xl font-black text-slate-800">{group.totalItems}</span>
                                                        <span className="text-xs text-slate-400 font-medium ml-1">uds</span>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                        {isExpanded && hasSeriales && (
                                            <tr className="bg-slate-50/80 border-b border-indigo-100/50">
                                                <td colSpan={5} className="px-10 py-5">
                                                    <div className="bg-white rounded-xl shadow-inner border border-slate-200 p-4 relative overflow-hidden">
                                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500"></div>
                                                        <h4 className="text-xs font-black uppercase text-slate-500 mb-3 tracking-widest flex items-center gap-2">
                                                            <Box className="w-3.5 h-3.5" /> Números de Serie Disponibles
                                                        </h4>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                                            {group.items.map(item => (
                                                                <div key={item.id} className="flex flex-col gap-1 p-3 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-sm transition-all hover:border-indigo-200 group">
                                                                    <div className="flex justify-between items-start">
                                                                        <span className="font-mono text-sm font-bold text-slate-700 group-hover:text-indigo-700 transition-colors">
                                                                            {item.numero_serie}
                                                                        </span>
                                                                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-sm ${item.estado === 'Disponible' ? 'bg-emerald-100 text-emerald-700' : item.estado === 'Dañado' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                                                            {item.estado}
                                                                        </span>
                                                                    </div>
                                                                    <div className={`text-[10px] font-black uppercase flex items-center gap-1 mt-1 truncate ${item.bodegas?.nombre?.toLowerCase().includes('dañado') ? 'text-rose-500' : 'text-indigo-500'}`}>
                                                                        {item.bodegas?.nombre?.toLowerCase().includes('dañado') ? '🔌 ' : '🏢 '}
                                                                        {item.bodegas?.nombre || 'Bodega Desconocida'}
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

            {/* Mobile View: Collapsible Cards */}
            <div className="block md:hidden p-4 space-y-3 bg-slate-50/50">
                {filteredGroups.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-300 mx-auto max-w-md">
                        <PackageOpen className="w-12 h-12 text-slate-300" />
                        <div className="font-bold text-slate-700">No hay inventario</div>
                        <p className="text-xs text-slate-500 text-center">No se encontraron equipos bajo los filtros seleccionados.</p>
                    </div>
                ) : (
                    filteredGroups.map(group => {
                        const isExpanded = expandedRows[group.id];
                        const hasSeriales = group.es_serializado;
                        const isAgotado = group.totalItems === 0;
                        const isCritical = group.totalItems > 0 && group.totalItems <= 3;
                        const isLowStock = group.totalItems >= 4 && group.totalItems <= 10;

                        const bgStyle = isAgotado ? 'bg-red-50/30' : 'bg-white';
                        const opacityStyle = isAgotado ? 'opacity-60 grayscale-[0.3]' : '';
                        const borderStyle = isAgotado ? 'border-red-200' : isCritical ? 'border-red-200 shadow-sm' : isLowStock ? 'border-amber-200' : 'border-slate-200 shadow-sm';

                        return (
                            <div key={group.id} className={`rounded-xl border ${bgStyle} ${opacityStyle} ${borderStyle} transition-all overflow-hidden`}>
                                <button 
                                    onClick={() => toggleRow(group.id)}
                                    className="w-full p-4 flex items-center justify-between text-left focus:outline-none active:bg-slate-50 relative"
                                >
                                    <div className="flex flex-col gap-1 pr-4">
                                        <span className="font-bold text-slate-800 break-words leading-tight">{group.modelo}</span>
                                        {isAgotado && (
                                            <span className="inline-flex items-center px-1.5 py-0 rounded text-[10px] font-bold bg-red-100/80 text-red-700 max-w-fit border border-red-200/50 uppercase tracking-wider">
                                                Agotado
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                                        <div className="flex items-center">
                                            {isAgotado ? (
                                                <span className="text-[13px] font-black text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                                    🔴 0 <span className="text-[9px] text-red-400">uds</span>
                                                </span>
                                            ) : isCritical ? (
                                                <span className="text-[13px] font-black text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                                    🔴 {group.totalItems} <span className="text-[9px] text-red-400">uds</span>
                                                </span>
                                            ) : isLowStock ? (
                                                <span className="text-[13px] font-black text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                                    🟡 {group.totalItems} <span className="text-[9px] text-amber-500">uds</span>
                                                </span>
                                            ) : (
                                                <span className="text-[14px] font-black text-slate-800 flex items-center gap-1">
                                                    ⚪ {group.totalItems} <span className="text-[10px] text-slate-400">uds</span>
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex justify-end pr-1 text-slate-300">
                                            {isExpanded ? (
                                                <ChevronUp className="w-5 h-5 transition-transform" />
                                            ) : (
                                                <ChevronDown className="w-5 h-5 transition-transform" />
                                            )}
                                        </div>
                                    </div>
                                </button>
                                
                                {isExpanded && (
                                    <div className="px-4 pb-4 border-t border-slate-100 bg-slate-50 pt-3">
                                        <div className="flex flex-col gap-3">
                                            {/* Bodega */}
                                            <div className="flex items-start gap-2">
                                                <span className="text-sm shrink-0 mt-0.5">🏭</span>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bodega</span>
                                                    <div className="flex flex-wrap gap-1 mt-0.5">
                                                        <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold border border-dashed bg-indigo-50 text-indigo-700 border-indigo-200">
                                                            🏢 {group.bodegaNombre}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {/* Familia */}
                                            <div className="flex items-start gap-2">
                                                <span className="text-sm shrink-0 mt-0.5">🏷️</span>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Familia</span>
                                                    <span className="inline-flex mt-0.5 px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200 max-w-fit">
                                                        {group.familia}
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            {/* Tipo */}
                                            <div className="flex items-start gap-2">
                                                <span className="text-sm shrink-0 mt-0.5">📄</span>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tipo</span>
                                                    <div className="mt-0.5 flex">
                                                    {isAgotado ? (
                                                        <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-700 border border-red-200">AGOTADO</span>
                                                    ) : hasSeriales ? (
                                                        <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-700 border border-amber-200">Serializado</span>
                                                    ) : (
                                                        <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">Genérico</span>
                                                    )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Seriales Extra Info */}
                                            {hasSeriales && group.items.length > 0 && !isAgotado && (
                                                <div className="mt-2 pt-3 border-t border-slate-200/50">
                                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                                                        <Box className="w-3 h-3" />
                                                        Series en Stock ({group.totalItems})
                                                    </p>
                                                    <div className="grid grid-cols-2 gap-1.5">
                                                        {group.items.filter(i => i.estado === 'Disponible' || i.estado === 'Dañado').map(item => (
                                                            <div key={item.id} className="flex flex-col p-1.5 bg-white rounded border border-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                                                                <span className="text-[10px] font-mono font-bold text-slate-700 truncate">{item.numero_serie}</span>
                                                                <span className={`text-[8px] font-black uppercase mt-0.5 truncate ${item.bodegas?.nombre?.toLowerCase().includes('dañado') ? 'text-rose-500' : 'text-indigo-500'}`}>{item.bodegas?.nombre}</span>
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
        </div>
    );
}
