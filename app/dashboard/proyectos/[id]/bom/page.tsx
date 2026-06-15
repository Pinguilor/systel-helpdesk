import { getBomConItems, getCatalogoEquipos } from './actions';
import { BomResumen } from './components/BomResumen';
import { BomTable } from './components/BomTable';
import { AgregarItemModal } from './components/AgregarItemModal';
import { Package } from 'lucide-react';

export default async function BomPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const [bom, catalogo] = await Promise.all([
        getBomConItems(id),
        getCatalogoEquipos(),
    ]);

    const items = (bom?.items ?? []) as any[];

    const totalEquipos = items.reduce((acc, item) => acc + (item.cantidad_total || 0), 0);
    const totalEntregados = items.reduce((acc, item) => acc + (item.cantidad_entregada || 0), 0);

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center shrink-0">
                        <Package className="w-4.5 h-4.5 text-white" strokeWidth={1.75} />
                    </div>
                    <div>
                        <h2 className="text-base font-black text-slate-900">Hardware y Logística</h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                            {totalEquipos === 0
                                ? 'Sin ítems en la Receta Maestra'
                                : `${totalEntregados} de ${totalEquipos} equipos entregados`
                            }
                        </p>
                    </div>
                </div>

                <AgregarItemModal proyectoId={id} catalogo={catalogo} />
            </div>

            {/* Tabla con motor de transiciones */}
            <BomTable items={items} proyectoId={id} />
        </div>
    );
}
