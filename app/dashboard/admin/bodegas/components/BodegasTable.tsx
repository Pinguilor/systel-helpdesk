'use client';

import React, { useState, useMemo } from 'react';
import { Inventario, Bodega } from '@/types/database.types';
import { Search, Server, Box, ChevronDown, ChevronRight, PackageOpen } from 'lucide-react';
import { CustomSelect } from '@/app/dashboard/components/CustomSelect';

interface BodegasTableProps {
    inventario: (Inventario & { bodegas: Bodega })[];
    bodegasDisponibles: Bodega[];
}

export function BodegasTable({ inventario, bodegasDisponibles }: BodegasTableProps) {
    const [selectedBodegaId, setSelectedBodegaId] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

    const toggleRow = (id: string) => {
        setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
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

    // Grouping by modelo+familia
    const groupedInventario = useMemo(() => {
        const groups: Record<string, {
            id: string; // Composite key
            modelo: string;
            familia: string;
            es_serializado: boolean;
            totalItems: number;
            items: (Inventario & { bodegas: Bodega })[];
        }> = {};

        filteredInventario.forEach(item => {
            const catId = `${item.modelo}|${item.familia}`;
            if (!groups[catId]) {
                groups[catId] = {
                    id: catId,
                    modelo: item.modelo || 'Desconocido',
                    familia: item.familia || 'Sin Familia',
                    es_serializado: !!item.es_serializado,
                    totalItems: 0,
                    items: []
                };
            }
            groups[catId].items.push(item);
            if (item.estado?.toLowerCase() === 'disponible' || item.estado?.toLowerCase() === 'dañado') {
                groups[catId].totalItems += item.cantidad;
            }
        });

        return Object.values(groups);
    }, [filteredInventario]);

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-gray-200 flex flex-col md:flex-row gap-4 justify-between bg-gray-50/50 items-center">
                <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                        type="text"
                        placeholder="Buscar por modelo, familia o serie..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary outline-none transition-all"
                    />
                </div>

                <div className="flex items-center gap-3 w-full md:w-80">
                    <span className="text-sm font-bold text-slate-500 whitespace-nowrap">Filtrar Bodega:</span>
                    <CustomSelect
                        id="bodegaFilter"
                        value={selectedBodegaId}
                        onChange={setSelectedBodegaId}
                        options={[
                            { value: 'all', label: 'Ver Todas (Global)' },
                            ...bodegasDisponibles.map(b => ({
                                value: b.id,
                                label: `${b.tipo?.toUpperCase() === 'CENTRAL' ? '🏢 ' : b.tipo?.toUpperCase() === 'DAÑADOS' ? '🔌 ' : '📦 '} ${b.nombre}`
                            }))
                        ]}
                        placeholder="Filtrar Bodega..."
                    />
                </div>
            </div>

            <div className="overflow-x-auto">
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
                        {groupedInventario.length === 0 ? (
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
                            groupedInventario.map(group => {
                                const isExpanded = expandedRows[group.id];
                                const hasSeriales = group.es_serializado;

                                // Extract unique bodegas for this hardware
                                const bodegasPresentes = Array.from(new Map(group.items.map(i => [i.bodegas?.id, i.bodegas])).values()).filter(Boolean);

                                return (
                                    <React.Fragment key={group.id}>
                                        <tr 
                                            className={`hover:bg-slate-50 transition-colors ${hasSeriales ? 'cursor-pointer' : ''} ${isExpanded ? 'bg-indigo-50/30' : ''}`}
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
                                                {hasSeriales ? (
                                                    <span className="bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full text-xs border border-amber-200">Serializado</span>
                                                ) : (
                                                    <span className="bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full text-xs border border-emerald-200">Genérico</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex flex-col gap-1 items-center justify-center">
                                                    {bodegasPresentes.map((b: any) => {
                                                        const isCentral = b.tipo?.toUpperCase() === 'CENTRAL';
                                                        return (
                                                            <span 
                                                                key={b.id} 
                                                                className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest border border-dashed ${isCentral ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-rose-50 text-rose-600 border-rose-200'}`}
                                                            >
                                                                {isCentral ? '🏢 ' : '🔌 '} {b.nombre}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="text-xl font-black text-slate-800">{group.totalItems}</span>
                                                <span className="text-xs text-slate-400 font-medium ml-1">uds</span>
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
                                                                    <div className={`text-[10px] font-black uppercase flex items-center gap-1 mt-1 truncate ${item.bodegas?.tipo?.toUpperCase() === 'CENTRAL' ? 'text-indigo-500' : 'text-rose-500'}`}>
                                                                        {item.bodegas?.tipo?.toUpperCase() === 'CENTRAL' ? '🏢 ' : '🔌 '} 
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
        </div>
    );
}
