/**
 * Generación server-side del PDF de documentación de un Patch Panel o un Switch
 * (@react-pdf/renderer). Solo importar desde Route Handlers / Server Actions.
 */
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import path from 'path';
import fs from 'fs';
import {
    RackPDF,
    type RackPDFColumna,
    type RackPDFFila,
    type RackPDFProps,
} from '@/app/dashboard/proyectos/[id]/rack/components/RackPDF';
import type {
    RackSwitch, RackPuerto, RackPatchPanel, RackBoca, RackDispositivoPlantilla, RackRecetaItem,
} from '@/app/dashboard/proyectos/[id]/rack/actions';

export interface RackPDFData {
    switches: RackSwitch[];
    puertos: RackPuerto[];
    patchPanels: RackPatchPanel[];
    bocas: RackBoca[];
    dispositivos: RackDispositivoPlantilla[];
    receta: RackRecetaItem[];
}

export interface RackPDFInput {
    tipo: 'patch_panel' | 'switch';
    equipoId: string;
    proyectoNombre: string;
    cliente: string;
    ubicacion: string;
    data: RackPDFData;
}

const num = (n: number) => String(n);

/** Quita las columnas (salvo las indicadas) que quedarían con "—" en todas las filas. */
function sinColumnasVacias(columnas: RackPDFColumna[], filas: RackPDFFila[], siempre: string[]): RackPDFColumna[] {
    return columnas.filter(c => siempre.includes(c.key) || filas.some(f => !!f.cells[c.key]));
}

function modeloPatchPanel(panel: RackPatchPanel, d: RackPDFData): Pick<RackPDFProps, 'columnas' | 'filas' | 'resumen'> {
    const porNumero = new Map(d.bocas.filter(b => b.patch_panel_id === panel.id).map(b => [b.numero_boca, b]));
    const dispositivo = new Map(d.dispositivos.map(x => [x.id, x]));
    const switchNombre = new Map(d.switches.map(s => [s.id, s.nombre]));
    const cruzadaPorBoca = new Map(
        d.puertos.filter(p => p.cruzado_boca_id).map(p => [p.cruzado_boca_id as string, p]),
    );

    let cruzadas = 0;
    const filas: RackPDFFila[] = [];
    for (let n = 1; n <= panel.num_bocas; n++) {
        const b = porNumero.get(n);
        if (!b) {
            filas.push({ tono: 'libre', cells: { num: num(n), estado: 'Sin rematar' } });
            continue;
        }
        const puerto = cruzadaPorBoca.get(b.id);
        if (puerto) cruzadas++;
        const disp = b.dispositivo_plantilla_id ? dispositivo.get(b.dispositivo_plantilla_id) : undefined;
        // VLAN del puerto al que está cruzada; si no, la VLAN por defecto del dispositivo.
        const vlan = puerto?.vlan ?? disp?.vlan_default ?? null;
        filas.push({
            // Una boca rematada sin cruzar no es un trabajo incompleto: el patch panel puede
            // documentarse/certificarse solo (infraestructura pasiva).
            tono: puerto ? 'ok' : 'rematada',
            cells: {
                num: num(n),
                dispositivo: disp?.nombre ?? '',
                etiqueta: b.etiqueta_libre ?? '',
                estado: puerto ? 'Cruzada' : 'Rematada',
                conectado: puerto ? `${switchNombre.get(puerto.switch_id) ?? 'Switch'} · Puerto ${puerto.numero_puerto}` : '',
                vlan: vlan != null ? String(vlan) : '',
                notas: b.notas ?? '',
            },
        });
    }

    const rematadas = porNumero.size;
    const sinRematar = panel.num_bocas - rematadas;
    const resumen = [
        { label: 'Bocas totales', value: String(panel.num_bocas) },
        { label: 'Rematadas', value: String(rematadas) },
        ...(cruzadas > 0 ? [{ label: 'Cruzadas a switch', value: String(cruzadas) }] : []),
        ...(sinRematar > 0 ? [{ label: 'Sin rematar', value: String(sinRematar) }] : []),
    ];

    const todas: RackPDFColumna[] = [
        { key: 'num', label: 'Boca', flex: 0.6 },
        { key: 'dispositivo', label: 'Dispositivo final', flex: 2 },
        { key: 'etiqueta', label: 'Etiqueta / Ubicación', flex: 2 },
        { key: 'estado', label: 'Estado', flex: 1.2 },
        // Sin ninguna cruzada la columna no aporta: se oculta.
        ...(cruzadas > 0 ? [{ key: 'conectado', label: 'Conectado a (Switch · Puerto)', flex: 2.2 }] : []),
        { key: 'vlan', label: 'VLAN', flex: 0.7 },
        { key: 'notas', label: 'Notas', flex: 2 },
    ];

    return { resumen, columnas: sinColumnasVacias(todas, filas, ['num', 'estado']), filas };
}

function modeloSwitch(sw: RackSwitch, d: RackPDFData): Pick<RackPDFProps, 'columnas' | 'filas' | 'resumen'> {
    const porNumero = new Map(d.puertos.filter(p => p.switch_id === sw.id).map(p => [p.numero_puerto, p]));
    const bocaPorId = new Map(d.bocas.map(b => [b.id, b]));
    const panelNombre = new Map(d.patchPanels.map(p => [p.id, p.nombre]));
    const dispositivoNombre = new Map(d.dispositivos.map(x => [x.id, x.nombre]));
    const modeloReceta = new Map(d.receta.map(r => [r.id, r.modelo]));

    let enUso = 0, uplinks = 0, poe = 0, cruzados = 0;
    const filas: RackPDFFila[] = [];
    for (let n = 1; n <= sw.num_puertos; n++) {
        const p = porNumero.get(n);
        if (!p) {
            filas.push({ tono: 'libre', cells: { num: num(n), estado: 'Libre' } });
            continue;
        }
        const boca = p.cruzado_boca_id ? bocaPorId.get(p.cruzado_boca_id) : undefined;
        const ocupado = !!(p.proyecto_equipamiento_id || p.dispositivo_plantilla_id || p.inventario_id || p.cruzado_boca_id || p.etiqueta_libre);
        if (p.es_poe) poe++;
        if (p.rol === 'uplink') uplinks++;
        if (p.cruzado_boca_id) cruzados++;
        if (ocupado || p.rol === 'uplink') enUso++;

        const estado = p.rol === 'uplink' ? 'Uplink' : ocupado ? 'Ocupado' : 'Reservado';

        let origen = p.rol === 'uplink' ? 'Uplink' : 'Sin asignar';
        let dispositivo = '';
        if (boca) {
            origen = `Cruzada: ${panelNombre.get(boca.patch_panel_id) ?? 'Patch Panel'} · Boca ${boca.numero_boca}`;
            dispositivo = boca.dispositivo_plantilla_id ? dispositivoNombre.get(boca.dispositivo_plantilla_id) ?? '' : '';
        } else if (p.dispositivo_plantilla_id) {
            origen = 'Conexión directa';
            dispositivo = dispositivoNombre.get(p.dispositivo_plantilla_id) ?? 'Equipo asignado';
        } else if (p.proyecto_equipamiento_id) {
            origen = 'Conexión directa';
            dispositivo = modeloReceta.get(p.proyecto_equipamiento_id) ?? 'Equipo asignado';
        } else if (p.inventario_id) {
            origen = 'Conexión directa';
            dispositivo = 'Equipo asignado';
        }

        filas.push({
            tono: p.rol === 'uplink' || ocupado ? 'ok' : 'pendiente',
            cells: {
                num: num(n),
                rol: p.rol === 'uplink' ? 'Uplink' : 'Acceso',
                poe: p.es_poe ? 'Sí' : '',
                vlan: p.vlan != null ? String(p.vlan) : '',
                origen,
                dispositivo,
                etiqueta: p.etiqueta_libre || boca?.etiqueta_libre || '',
                estado,
                notas: [p.notas, boca?.notas && `Boca: ${boca.notas}`].filter(Boolean).join(' | '),
            },
        });
    }

    return {
        resumen: [
            { label: 'Puertos totales', value: String(sw.num_puertos) },
            { label: 'En uso', value: String(enUso) },
            { label: 'Libres', value: String(sw.num_puertos - porNumero.size) },
            { label: 'Uplink', value: String(uplinks) },
            { label: 'PoE', value: String(poe) },
            { label: 'Cruzados a patch panel', value: String(cruzados) },
        ],
        columnas: sinColumnasVacias([
            { key: 'num', label: 'Puerto', flex: 0.6 },
            { key: 'rol', label: 'Rol', flex: 0.7 },
            { key: 'poe', label: 'PoE', flex: 0.5 },
            { key: 'vlan', label: 'VLAN', flex: 0.6 },
            { key: 'origen', label: 'Origen / Conectado a', flex: 2.4 },
            { key: 'dispositivo', label: 'Dispositivo final', flex: 2 },
            { key: 'etiqueta', label: 'Etiqueta / Ubicación', flex: 1.8 },
            { key: 'estado', label: 'Estado', flex: 0.9 },
            { key: 'notas', label: 'Notas', flex: 1.6 },
        ], filas, ['num', 'rol', 'estado']),
        filas,
    };
}

/** Devuelve null si el equipo no existe en los datos entregados. */
export async function generateRackPDF(input: RackPDFInput): Promise<{ buffer: Buffer; nombreEquipo: string } | null> {
    const { tipo, equipoId, data } = input;

    let nombreEquipo: string;
    let modelo: Pick<RackPDFProps, 'columnas' | 'filas' | 'resumen'>;
    if (tipo === 'patch_panel') {
        const panel = data.patchPanels.find(p => p.id === equipoId);
        if (!panel) return null;
        nombreEquipo = panel.nombre;
        modelo = modeloPatchPanel(panel, data);
    } else {
        const sw = data.switches.find(s => s.id === equipoId);
        if (!sw) return null;
        nombreEquipo = sw.nombre;
        modelo = modeloSwitch(sw, data);
    }

    const logoPath = path.join(process.cwd(), 'public', 'systelcom.png');
    const logoUrl = `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`;

    const element = React.createElement(RackPDF, {
        tipoLabel: tipo === 'switch' ? 'SWITCH' : 'PATCH PANEL',
        equipoNombre: nombreEquipo,
        proyectoNombre: input.proyectoNombre,
        cliente: input.cliente,
        ubicacion: input.ubicacion,
        generadoEn: new Date(),
        logoUrl,
        ...modelo,
    } satisfies RackPDFProps);

    const arrayBuffer = await renderToBuffer(element as any);
    return { buffer: Buffer.from(arrayBuffer), nombreEquipo };
}
