import { MessageSquare } from 'lucide-react';

// Piezas de UI del buscador de tickets compartidas entre Admin y Usuario, para que
// ambos perfiles muestren exactamente el mismo feedback al buscar.

/** Spinner dentro del input mientras se espera la respuesta del servidor. */
export function SearchInputSpinner({ active }: { active: boolean }) {
    if (!active) return null;
    return (
        <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
            <span className="w-4 h-4 border-2 border-[#0e3187]/20 border-t-[#0e3187] rounded-full animate-spin" />
        </div>
    );
}

/** Contenido central del listado cuando está buscando o no hay resultados. */
export function TicketListEmptyState({ searching }: { searching: boolean }) {
    return (
        <div className="flex flex-col items-center justify-center py-6">
            {searching ? (
                <>
                    <span className="w-8 h-8 border-[3px] border-[#0e3187]/20 border-t-[#0e3187] rounded-full animate-spin mb-3" />
                    <p className="text-slate-500 font-bold text-sm">Buscando tickets…</p>
                </>
            ) : (
                <>
                    <MessageSquare className="w-12 h-12 text-slate-400 mb-3" strokeWidth={1.5} />
                    <p className="text-slate-500 font-bold text-sm">No hay tickets en esta vista.</p>
                </>
            )}
        </div>
    );
}
