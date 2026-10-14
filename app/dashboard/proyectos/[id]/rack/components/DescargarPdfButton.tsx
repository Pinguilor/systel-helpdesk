'use client';

import { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';

export function DescargarPdfButton({
    proyectoId,
    tipo,
    equipoId,
}: {
    proyectoId: string;
    tipo: 'patch_panel' | 'switch';
    equipoId: string;
}) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const descargar = async () => {
        setLoading(true);
        setError('');
        try {
            const qs = new URLSearchParams({ proyectoId, tipo, id: equipoId });
            const res = await fetch(`/api/proyectos/rack-pdf?${qs}`);
            if (!res.ok) {
                const j = await res.json().catch(() => null);
                throw new Error(j?.error || 'No se pudo generar el PDF.');
            }
            const blob = await res.blob();
            const nombre = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'rack.pdf';
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = nombre;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (e: any) {
            setError(e?.message || 'No se pudo generar el PDF.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-end gap-1">
            <button
                onClick={descargar}
                disabled={loading}
                title="Descargar documentación en PDF"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors disabled:opacity-60"
            >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
                {loading ? 'Generando…' : 'Descargar PDF'}
            </button>
            {error && <span className="text-[10px] font-bold text-red-600 max-w-[200px] text-right">{error}</span>}
        </div>
    );
}
