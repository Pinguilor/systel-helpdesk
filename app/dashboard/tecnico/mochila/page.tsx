import { getTechnicianMochilaAction } from '../actions';
import { PackageOpen, Hash, Layers } from 'lucide-react';
import { Inventario } from '@/types/database.types';

export default async function TecnicoMochilaPage() {
    const response = await getTechnicianMochilaAction();

    if ('error' in response && response.error) {
        return (
            <div className="p-6 max-w-4xl mx-auto">
                <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 shadow-sm">
                    {response.error}
                </div>
            </div>
        );
    }

    const inventory: Inventario[] = response.data || [];
    const mochilaNombre = response.mochilaNombre;

    // Agrupar genéricos si por alguna razón vinieran separados (aunque la BD debería tenerlos únicos)
    const groupedInventory: { [key: string]: Inventario } = {};
    const serializedItems: Inventario[] = [];

    inventory.forEach(item => {
        if (item.es_serializado) {
            serializedItems.push(item);
        } else {
            const key = `${item.familia}-${item.modelo}`;
            if (groupedInventory[key]) {
                groupedInventory[key].cantidad += item.cantidad;
            } else {
                groupedInventory[key] = { ...item };
            }
        }
    });

    const genericItems = Object.values(groupedInventory);

    if (!mochilaNombre) {
        return (
            <div className="p-6 max-w-4xl mx-auto">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <PackageOpen className="w-8 h-8 text-slate-400" />
                    </div>
                    <h2 className="text-xl font-black text-slate-800 mb-2 tracking-tight">Mochila No Asignada</h2>
                    <p className="text-slate-500 font-medium">Aún no tienes una mochila virtual asignada para tu perfil de técnico. Contacta a un administrador.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl">
                            <PackageOpen className="w-6 h-6" />
                        </div>
                        {mochilaNombre}
                    </h1>
                    <p className="text-sm font-medium text-slate-500 mt-1">Este es tu inventario actual. Módulo de solo lectura.</p>
                </div>
            </div>

            {inventory.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
                    <p className="text-slate-500 font-medium text-lg">Tu mochila virtual está vacía en este momento.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                    
                    {/* SECCIÓN: REPUESTOS GENÉRICOS */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="bg-slate-50/80 px-5 py-4 border-b border-slate-200 flex items-center gap-3">
                            <div className="p-1.5 bg-amber-100 text-amber-600 rounded-lg">
                                <Layers className="w-4 h-4" />
                            </div>
                            <h2 className="text-base font-bold text-slate-800 tracking-tight">Repuestos y Consumibles</h2>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {genericItems.length === 0 ? (
                                <div className="p-6 text-center text-sm text-slate-400 font-medium">No hay ítems genéricos en tu mochila.</div>
                            ) : (
                                genericItems.map((item, idx) => (
                                    <div key={`gen-${idx}`} className="p-4 sm:p-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                                        <div className="flex flex-col">
                                            <span className="text-base font-bold text-slate-700">{item.modelo}</span>
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{item.familia}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg font-black text-slate-800">{item.cantidad}</span>
                                            <span className="text-xs font-bold text-slate-500">Unidades</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* SECCIÓN: EQUIPOS SERIALIZADOS */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="bg-slate-50/80 px-5 py-4 border-b border-slate-200 flex items-center gap-3">
                            <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg">
                                <Hash className="w-4 h-4" />
                            </div>
                            <h2 className="text-base font-bold text-slate-800 tracking-tight">Equipos Serializados</h2>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {serializedItems.length === 0 ? (
                                <div className="p-6 text-center text-sm text-slate-400 font-medium">No hay equipos serializados en tu mochila.</div>
                            ) : (
                                serializedItems.map((item) => (
                                    <div key={item.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors">
                                        <div className="flex flex-col">
                                            <span className="text-base font-bold text-slate-700">{item.modelo}</span>
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{item.familia}</span>
                                        </div>
                                        <div className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 font-mono text-sm px-3 py-1.5 rounded-lg border border-slate-200 shrink-0">
                                            <Hash className="w-3.5 h-3.5 text-slate-400" />
                                            {item.numero_serie || 'Sin SN'}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
}
