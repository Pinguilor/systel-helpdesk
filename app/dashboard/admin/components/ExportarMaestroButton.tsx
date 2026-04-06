'use client';

import { useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { AdvancedExportPanel } from './AdvancedExportPanel';

export function ExportarMaestroButton() {
    const [showPanel, setShowPanel] = useState(false);

    return (
        <>
            <button
                onClick={() => setShowPanel(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 transition-all shadow-sm whitespace-nowrap"
            >
                <FileSpreadsheet className="w-4 h-4" />
                Exportar Reporte
            </button>

            {showPanel && (
                <AdvancedExportPanel onClose={() => setShowPanel(false)} />
            )}
        </>
    );
}
