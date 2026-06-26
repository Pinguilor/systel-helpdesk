'use client';

import type { CSSProperties } from 'react';
import type { RackPuerto } from '../actions';

// Estado visual DERIVADO (no almacenado): PoE/uplink/ocupado son ortogonales.
function colorClasses(p?: RackPuerto): string {
    if (!p) return 'bg-slate-100 text-slate-400 border-slate-200';          // libre
    if (p.rol === 'uplink') return 'bg-blue-500 text-white border-blue-600'; // uplink
    if (p.proyecto_equipamiento_id || p.inventario_id || p.etiqueta_libre)
        return 'bg-emerald-500 text-white border-emerald-600';               // ocupado
    return 'bg-indigo-200 text-indigo-800 border-indigo-300';                // reservado (fila sin equipo)
}

function tooltip(numero: number, p?: RackPuerto, equipNombre?: string): string {
    if (!p) return `Puerto ${numero} · Libre`;
    const partes = [`Puerto ${numero}`];
    partes.push(p.rol === 'uplink' ? 'Uplink' : 'Acceso');
    if (p.es_poe) partes.push('PoE');
    if (p.vlan != null) partes.push(`VLAN ${p.vlan}`);
    if (p.etiqueta_libre) partes.push(p.etiqueta_libre);
    else if (equipNombre) partes.push(equipNombre);
    else if (p.proyecto_equipamiento_id || p.inventario_id) partes.push('Equipo asignado');
    return partes.join(' · ');
}

// Color determinístico por VLAN (misma VLAN → mismo color, para escaneo visual).
function vlanStyle(vlan: number): CSSProperties {
    const h = (vlan * 47) % 360;
    return { backgroundColor: `hsl(${h}, 70%, 92%)`, color: `hsl(${h}, 65%, 32%)` };
}

export function PortCell({
    numero,
    puerto,
    equipNombre,
    onClick,
}: {
    numero: number;
    puerto?: RackPuerto;
    equipNombre?: string;
    onClick?: () => void;
}) {
    return (
        <div className="flex flex-col items-center gap-0.5">
            <button
                type="button"
                onClick={onClick}
                disabled={!onClick}
                title={tooltip(numero, puerto, equipNombre)}
                className={`relative w-7 h-7 rounded-md border flex items-center justify-center text-[9px] font-black select-none ${colorClasses(puerto)} ${onClick ? 'cursor-pointer hover:ring-2 hover:ring-indigo-400 hover:ring-offset-1 transition-all' : 'cursor-default'}`}
            >
                {numero}
                {/* Indicador PoE: punto ámbar en la esquina */}
                {puerto?.es_poe && (
                    <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 ring-1 ring-white" />
                )}
            </button>
            {/* Badge de VLAN (línea reservada para mantener la grilla alineada) */}
            <span className="h-3 flex items-center justify-center">
                {puerto?.vlan != null && (
                    <span
                        title={`VLAN ${puerto.vlan}`}
                        style={vlanStyle(puerto.vlan)}
                        className="px-1 rounded text-[7px] font-black leading-none py-0.5"
                    >
                        {puerto.vlan}
                    </span>
                )}
            </span>
        </div>
    );
}
