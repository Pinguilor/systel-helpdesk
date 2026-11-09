'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, FileArchive, FileSpreadsheet, FileText, Loader2, Share2, X } from 'lucide-react';

type Formato = 'pdf' | 'xlsx' | 'actas';

const OPCIONES: { id: Formato; titulo: string; detalle: string; icono: typeof FileText }[] = [
    { id: 'pdf',   titulo: 'Informe de avance (PDF)', detalle: 'Resumen y avance por local', icono: FileText },
    { id: 'xlsx',  titulo: 'Detalle en Excel',        detalle: 'Avance por local y materiales', icono: FileSpreadsheet },
    { id: 'actas', titulo: 'Actas firmadas (ZIP)',    detalle: 'Un PDF por local firmado', icono: FileArchive },
];

/** Menú "Reporte para cliente": descarga el informe consolidado en PDF, Excel o el paquete de actas. */
export function InformeMenu({ padreId }: { padreId: string }) {
    const [abierto, setAbierto] = useState(false);
    const [descargando, setDescargando] = useState<Formato | null>(null);
    const [aviso, setAviso] = useState<{ tipo: 'error' | 'info'; texto: string } | null>(null);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    async function descargar(formato: Formato) {
        if (descargando) return;
        setDescargando(formato);
        setAviso(null);
        try {
            const res = await fetch(`/api/proyectos/masivos/informe?id=${padreId}&formato=${formato}`);
            if (!res.ok) {
                const j = await res.json().catch(() => null);
                setAviso({ tipo: 'error', texto: j?.error ?? 'No se pudo generar el informe.' });
                setAbierto(false);
                return;
            }
            const archivo = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1]
                ?? `informe.${formato === 'actas' ? 'zip' : formato}`;
            const url = URL.createObjectURL(await res.blob());
            const a = document.createElement('a');
            a.href = url;
            a.download = archivo;
            a.click();
            URL.revokeObjectURL(url);

            const sinArchivo = Number(res.headers.get('X-Actas-Sin-Archivo') ?? 0);
            if (formato === 'actas' && sinArchivo > 0) {
                setAviso({
                    tipo: 'info',
                    texto: `${sinArchivo} acta${sinArchivo === 1 ? '' : 's'} no se pudo leer del almacenamiento y no quedó en el ZIP.`,
                });
            }
            setAbierto(false);
        } catch {
            setAviso({ tipo: 'error', texto: 'No se pudo completar la descarga. Revisa tu conexión e inténtalo de nuevo.' });
            setAbierto(false);
        } finally {
            setDescargando(null);
        }
    }

    return (
        <div className="relative" ref={ref}>
            <button type="button" onClick={() => setAbierto(v => !v)} disabled={!!descargando}
                className="flex items-center gap-2 px-4 py-2 bg-white text-slate-800 text-sm font-bold rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-70 transition-colors shadow-sm cursor-pointer">
                {descargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" strokeWidth={1.75} />}
                {descargando ? 'Generando...' : 'Reporte para cliente'}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${abierto ? 'rotate-180' : ''}`} />
            </button>

            {abierto && (
                <div className="absolute right-0 top-full mt-1 w-72 bg-white border border-slate-200 rounded-xl shadow-lg z-30 py-1">
                    {OPCIONES.map(o => (
                        <button key={o.id} type="button" onClick={() => descargar(o.id)} disabled={!!descargando}
                            className="w-full text-left px-3.5 py-2.5 flex items-center gap-3 hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer">
                            <span className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                                <o.icono className="w-4 h-4 text-slate-500" />
                            </span>
                            <span className="min-w-0">
                                <span className="block text-xs font-black text-slate-800">{o.titulo}</span>
                                <span className="block text-[11px] font-medium text-slate-400">{o.detalle}</span>
                            </span>
                        </button>
                    ))}
                </div>
            )}

            {aviso && !abierto && (
                <div className={`absolute right-0 top-full mt-1 w-80 z-20 flex items-start gap-2 text-xs font-semibold rounded-xl px-3 py-2 border shadow-sm ${
                    aviso.tipo === 'error' ? 'text-red-700 bg-red-50 border-red-200' : 'text-amber-800 bg-amber-50 border-amber-200'
                }`}>
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
                    <span className="flex-1">{aviso.texto}</span>
                    <button type="button" onClick={() => setAviso(null)} aria-label="Cerrar" className="opacity-60 hover:opacity-100 cursor-pointer">
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}
        </div>
    );
}
