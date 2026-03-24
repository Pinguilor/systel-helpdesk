'use client';

import { useState } from 'react';
import { Settings, X, Layers, Users, Warehouse, ChevronRight, Activity, AlertTriangle, Package } from 'lucide-react';
import { CatalogCrudTable } from './CatalogCrudTable';
import { MochilasManager } from './MochilasManager';
import { HardwareFamiliesCRUD } from './HardwareFamiliesCRUD';

interface CatalogConfigModalProps {
    onClose: () => void;
}

export function CatalogConfigModal({ onClose }: CatalogConfigModalProps) {
    const [activeTab, setActiveTab] = useState<'catalogo' | 'personal' | 'mochilas' | 'bodega'>('catalogo');
    
    // Drill-down State for Catalogo (4 Niveles)
    const [selectedTipoServicio, setSelectedTipoServicio] = useState<any | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<any | null>(null);
    const [selectedSubcategory, setSelectedSubcategory] = useState<any | null>(null);

    const tabs = [
        { id: 'catalogo', label: 'Catálogo de Servicios', icon: Layers },
        { id: 'personal', label: 'Personal (Usuarios)', icon: Users },
        { id: 'bodega', label: 'Bodega', icon: Warehouse },
        { id: 'mochilas', label: 'Mochilas Virtuales', icon: Package },
    ];

    const handleDrillDownTipo = (tipo: any) => {
        setSelectedTipoServicio(tipo);
        setSelectedCategory(null);
        setSelectedSubcategory(null);
    };

    const handleDrillDownCategory = (category: any) => {
        setSelectedCategory(category);
        setSelectedSubcategory(null);
    };

    const handleDrillDownSubcategory = (subcategory: any) => {
        setSelectedSubcategory(subcategory);
    };

    const handleBackToTipos = () => {
        setSelectedTipoServicio(null);
        setSelectedCategory(null);
        setSelectedSubcategory(null);
    };

    const handleBackToCategories = () => {
        setSelectedCategory(null);
        setSelectedSubcategory(null);
    };

    const handleBackToSubcategories = () => {
        setSelectedSubcategory(null);
    };

    return (
        <div className="fixed inset-0 z-[100] overflow-y-auto w-screen h-screen">
            <div className="flex min-h-screen items-center justify-center p-4 sm:p-6 text-center">
                
                {/* Overlay Oscuro */}
                <div 
                    className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 transition-opacity" 
                    onClick={onClose} 
                />
                
                {/* Modal Container */}
                <div className="relative z-[60] w-full h-full sm:h-[85vh] transform flex flex-col overflow-hidden bg-white text-left shadow-2xl transition-all rounded-2xl max-w-6xl border border-slate-200">
                    
                    {/* Header Principal */}
                    <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 bg-white shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="bg-slate-900 p-2.5 rounded-xl text-white shadow-inner">
                                <Settings className="w-6 h-6" />
                            </div>
                            <div>
                                <h1 className="text-xl font-black text-slate-800 tracking-tight">Configuración Global</h1>
                                <p className="text-[13px] font-bold text-slate-500 mt-0.5">Administración unificada del personal y catálogos estandarizados.</p>
                            </div>
                        </div>
                        <button 
                            onClick={onClose} 
                            className="rounded-full bg-slate-50 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors shadow-sm border border-slate-200/60"
                            title="Cerrar configuración"
                        >
                            <X className="h-6 w-6" />
                        </button>
                    </div>

                    <div className="flex flex-col md:flex-row flex-1 overflow-hidden bg-slate-50/50">
                        
                        {/* Sidebar Navegación Lateral */}
                        <div className="w-full md:w-72 bg-white border-r border-slate-200 p-5 flex-shrink-0 flex flex-col gap-1 overflow-y-auto shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-10">
                            <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest pl-2 mb-3">Módulos</div>
                            {tabs.map(tab => {
                                const Icon = tab.icon;
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => { 
                                            setActiveTab(tab.id as any); 
                                            setSelectedTipoServicio(null);
                                            setSelectedCategory(null); 
                                            setSelectedSubcategory(null); 
                                        }}
                                        className={`flex items-center gap-3.5 px-4 py-3.5 rounded-xl transition-all font-bold text-[14px] text-left shrink-0 ${
                                            isActive 
                                                ? 'bg-brand-primary text-white shadow-md shadow-brand-primary/20 scale-[1.02]' 
                                                : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 border border-transparent'
                                        }`}
                                    >
                                        <Icon className={`w-5 h-5 ${isActive ? 'text-white/90' : 'text-slate-400'}`} />
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Área de Contenido Principal */}
                        <div className="flex-1 bg-slate-50/50 overflow-hidden relative p-4 sm:p-6 flex flex-col">
                            <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200/60 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
                                
                                {/* 1. CATÁLOGO DE SERVICIOS (Lógica Flatter List 4 Niveles) */}
                                {activeTab === 'catalogo' && (
                                    <div className="flex-1 flex flex-col overflow-hidden p-4 sm:p-6">
                                        
                                        {/* BREADCRUMB HEADER (MIGAS DE PAN) */}
                                        <div className="flex items-center flex-wrap gap-2 text-[12px] font-black uppercase text-slate-400 tracking-widest bg-slate-50 px-5 py-3 rounded-xl border border-slate-200 mb-6 shrink-0 shadow-sm">
                                            <button onClick={handleBackToTipos} className="hover:text-indigo-600 transition-colors uppercase tracking-widest">RAÍZ</button>
                                            
                                            {selectedTipoServicio && (
                                                <>
                                                    <ChevronRight className="w-4 h-4 text-slate-300" />
                                                    <button onClick={handleBackToCategories} className="hover:text-indigo-600 transition-colors uppercase tracking-widest text-left" title="Volver a Categorías">
                                                        <span className="truncate inline-block max-w-[150px] align-bottom">{selectedTipoServicio.nombre}</span>
                                                    </button>
                                                </>
                                            )}
                                            
                                            {selectedCategory && (
                                                <>
                                                    <ChevronRight className="w-4 h-4 text-slate-300" />
                                                    <button onClick={handleBackToSubcategories} className="hover:text-indigo-600 transition-colors uppercase tracking-widest text-left" title="Volver a Subcategorías">
                                                        <span className="truncate inline-block max-w-[150px] align-bottom">{selectedCategory.nombre}</span>
                                                    </button>
                                                </>
                                            )}
                                            
                                            {selectedSubcategory && (
                                                <>
                                                    <ChevronRight className="w-4 h-4 text-slate-300" />
                                                    <span className="text-indigo-600 truncate inline-block max-w-[150px] align-bottom" title={selectedSubcategory.nombre}>
                                                        {selectedSubcategory.nombre}
                                                    </span>
                                                </>
                                            )}
                                        </div>

                                        <div className="flex-1 overflow-hidden flex flex-col animate-in slide-in-from-right-4 duration-300 fill-mode-both">
                                            {!selectedTipoServicio ? (
                                                <CatalogCrudTable 
                                                    tableName="ticket_tipos_servicio" 
                                                    labelName="Tipos de Servicio (Raíz)" 
                                                    onDrillDown={handleDrillDownTipo}
                                                />
                                            ) : !selectedCategory ? (
                                                <CatalogCrudTable 
                                                    tableName="ticket_categorias" 
                                                    labelName={`Categorías de "${selectedTipoServicio.nombre}"`} 
                                                    baseFilter={{ column: 'tipo_servicio_id', value: selectedTipoServicio.id }}
                                                    onDrillDown={handleDrillDownCategory}
                                                    allowDelete={true}
                                                />
                                            ) : !selectedSubcategory ? (
                                                <CatalogCrudTable 
                                                    tableName="ticket_subcategorias" 
                                                    labelName={`Subcategorías de "${selectedCategory.nombre}"`} 
                                                    baseFilter={{ column: 'categoria_id', value: selectedCategory.id }}
                                                    onDrillDown={handleDrillDownSubcategory}
                                                    allowDelete={true}
                                                />
                                            ) : (
                                                <CatalogCrudTable 
                                                    tableName="ticket_acciones" 
                                                    labelName={`Acciones de "${selectedSubcategory.nombre}"`} 
                                                    baseFilter={{ column: 'subcategoria_id', value: selectedSubcategory.id }}
                                                    allowDelete={true}
                                                />
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* 2. PERSONAL (Usuarios) */}
                                {activeTab === 'personal' && (
                                    <div className="flex-1 overflow-hidden flex flex-col p-4 sm:p-6">
                                        <CatalogCrudTable 
                                            tableName="profiles" 
                                            labelName="Personal del Sistema" 
                                            readOnlySettings={true} 
                                        />
                                    </div>
                                )}

                                {/* 3. MOCHILAS VIRTUALES */}
                                {activeTab === 'mochilas' && (
                                    <MochilasManager />
                                )}

                                {/* 4. BODEGA (Familias de Hardware) */}
                                {activeTab === 'bodega' && (
                                    <HardwareFamiliesCRUD />
                                )}

                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
