/**
 * Informe para el cliente de un Rollout: PDF consolidado, Excel y paquete (ZIP) de actas firmadas.
 * Solo importar desde Route Handlers / Server Actions. No incluye datos internos (stock, alertas, pendientes).
 */
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import path from 'path';
import fs from 'fs';
import { createAdminClient } from '@/lib/supabase/admin';
import { PROYECTO_ESTADO_CONFIG, type ProyectoEstado } from '@/types/proyectos.types';
import { InformeMasivoPDF, type InformeLocalFila } from '@/app/dashboard/proyectos/masivos/components/InformeMasivoPDF';
import type { PanelMasivo } from '@/app/dashboard/proyectos/masivos/gestion-actions';

const TZ = 'America/Santiago';

export const slug = (t: string) =>
    t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'proyecto';

const pct = (parte: number, total: number) => (total > 0 ? Math.round((parte / total) * 100) : 0);

const fechaCorta = (d: string | null) =>
    d ? new Date(d + 'T00:00:00').toLocaleDateString('es-CL', { timeZone: TZ }) : null;

interface DatosInforme {
    nombre: string;
    cliente: string;
    coordinador: string;
    periodo: string;
    resumen: { label: string; value: string }[];
    filas: InformeLocalFila[];
    materiales: { equipo: string; requerido: number; entregado: number; instalado: number }[];
}

async function armarDatos(panel: PanelMasivo): Promise<DatosInforme> {
    const { padre, locales, materiales } = panel;

    // Cliente: razón social de los locales del proyecto (si hay una sola, esa; si no, "Varios")
    const { data: clientes } = await createAdminClient()
        .from('proyectos')
        .select('cliente:restaurantes(razon_social, cliente, compania)')
        .eq('proyecto_padre_id', padre.id)
        .eq('oculto', false);
    const nombres = new Set(
        (clientes ?? []).map((c: any) => c.cliente?.razon_social || c.cliente?.cliente || c.cliente?.compania).filter(Boolean),
    );
    const cliente = nombres.size === 1 ? [...nombres][0] : nombres.size > 1 ? 'Varios' : '';

    const tareas = locales.reduce((s, l) => s + l.tareas_total, 0);
    const tareasOk = locales.reduce((s, l) => s + l.tareas_completadas, 0);
    const req = locales.reduce((s, l) => s + l.mat_requerido, 0);
    const ent = locales.reduce((s, l) => s + l.mat_entregado, 0);
    const inst = locales.reduce((s, l) => s + l.mat_instalado, 0);
    const completados = locales.filter(l => l.estado === 'completado').length;
    const actas = locales.filter(l => l.acta_firmada).length;

    const ini = fechaCorta(padre.fecha_inicio);
    const fin = fechaCorta(padre.fecha_fin_estimada);

    return {
        nombre: padre.nombre,
        cliente,
        coordinador: padre.coordinador ?? '',
        periodo: ini && fin ? `${ini} al ${fin}` : ini ? `Desde ${ini}` : fin ? `Hasta ${fin}` : 'No definido',
        resumen: [
            { label: 'Locales', value: String(locales.length) },
            { label: 'Locales completados', value: `${completados} (${pct(completados, locales.length)}%)` },
            { label: 'Checklist', value: `${pct(tareasOk, tareas)}%` },
            { label: 'Materiales entregados', value: `${ent} de ${req} (${pct(ent, req)}%)` },
            { label: 'Materiales instalados', value: `${inst} de ${req} (${pct(inst, req)}%)` },
            { label: 'Actas firmadas', value: `${actas} de ${locales.length}` },
        ],
        filas: locales.map(l => ({
            sigla: l.sigla ?? '',
            local: l.local_nombre ?? l.nombre,
            estado: PROYECTO_ESTADO_CONFIG[l.estado as ProyectoEstado]?.label ?? l.estado,
            checklist: l.tareas_total > 0 ? `${l.tareas_completadas}/${l.tareas_total} (${pct(l.tareas_completadas, l.tareas_total)}%)` : '',
            materiales: l.mat_requerido > 0 ? `${l.mat_entregado}/${l.mat_requerido}` : '',
            instalados: l.mat_requerido > 0 ? `${l.mat_instalado}/${l.mat_requerido}` : '',
            acta: l.acta_firmada,
        })),
        materiales: materiales.map(m => ({
            equipo: m.familia && m.familia !== 'Manual' ? `${m.modelo} (${m.familia})` : m.modelo,
            requerido: m.requerido,
            entregado: m.entregado,
            instalado: m.instalado,
        })),
    };
}

export async function generarInformePDF(panel: PanelMasivo): Promise<{ buffer: Buffer; archivo: string }> {
    const d = await armarDatos(panel);
    const logoPath = path.join(process.cwd(), 'public', 'systelcom.png');
    const logoUrl = `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`;

    const element = React.createElement(InformeMasivoPDF, {
        proyectoNombre: d.nombre,
        cliente: d.cliente,
        coordinador: d.coordinador,
        periodo: d.periodo,
        generadoEn: new Date(),
        resumen: d.resumen,
        filas: d.filas,
        materiales: d.materiales,
        logoUrl,
    });
    const arrayBuffer = await renderToBuffer(element as any);
    return { buffer: Buffer.from(arrayBuffer), archivo: `Informe_${slug(d.nombre)}.pdf` };
}

export async function generarInformeXlsx(panel: PanelMasivo): Promise<{ buffer: Buffer; archivo: string }> {
    const d = await armarDatos(panel);
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Systel';
    wb.created = new Date();

    const estiloHeader = (ws: ExcelJS.Worksheet) => {
        const fila = ws.getRow(1);
        fila.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        fila.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0E3187' } };
        ws.views = [{ state: 'frozen', ySplit: 1 }];
    };

    // Resumen
    const res = wb.addWorksheet('Resumen');
    res.columns = [{ header: 'Concepto', key: 'k', width: 28 }, { header: 'Valor', key: 'v', width: 44 }];
    res.addRows([
        { k: 'Proyecto', v: d.nombre },
        { k: 'Cliente', v: d.cliente || 'No definido' },
        { k: 'Coordinador', v: d.coordinador || 'No asignado' },
        { k: 'Período', v: d.periodo },
        { k: 'Generado', v: new Date().toLocaleString('es-CL', { timeZone: TZ }) },
        ...d.resumen.map(r => ({ k: r.label, v: r.value })),
    ]);
    estiloHeader(res);

    // Avance por local
    const av = wb.addWorksheet('Avance por local');
    av.columns = [
        { header: 'Sigla', key: 'sigla', width: 10 },
        { header: 'Local', key: 'local', width: 38 },
        { header: 'Estado', key: 'estado', width: 16 },
        { header: 'Tareas completadas', key: 'tc', width: 18 },
        { header: 'Tareas totales', key: 'tt', width: 15 },
        { header: '% Checklist', key: 'pc', width: 12 },
        { header: 'Materiales requeridos', key: 'mr', width: 20 },
        { header: 'Materiales entregados', key: 'me', width: 21 },
        { header: 'Materiales instalados', key: 'mi', width: 21 },
        { header: 'Acta firmada', key: 'acta', width: 13 },
    ];
    for (const l of panel.locales) {
        av.addRow({
            sigla: l.sigla ?? '',
            local: l.local_nombre ?? l.nombre,
            estado: PROYECTO_ESTADO_CONFIG[l.estado as ProyectoEstado]?.label ?? l.estado,
            tc: l.tareas_completadas,
            tt: l.tareas_total,
            pc: l.tareas_total > 0 ? l.tareas_completadas / l.tareas_total : null,
            mr: l.mat_requerido,
            me: l.mat_entregado,
            mi: l.mat_instalado,
            acta: l.acta_firmada ? 'Sí' : 'No',
        });
    }
    av.getColumn('pc').numFmt = '0%';
    estiloHeader(av);
    av.autoFilter = { from: 'A1', to: 'J1' };

    // Materiales (sin stock ni faltantes: son datos internos)
    const mat = wb.addWorksheet('Materiales');
    mat.columns = [
        { header: 'Equipo', key: 'equipo', width: 48 },
        { header: 'Requerido', key: 'req', width: 13 },
        { header: 'Entregado', key: 'ent', width: 13 },
        { header: 'Instalado', key: 'inst', width: 13 },
    ];
    d.materiales.forEach(m => mat.addRow({ equipo: m.equipo, req: m.requerido, ent: m.entregado, inst: m.instalado }));
    estiloHeader(mat);

    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    return { buffer, archivo: `Informe_${slug(d.nombre)}.xlsx` };
}

/** ZIP con el acta firmada (PDF) más reciente de cada local. Devuelve null si ninguno tiene acta. */
export async function generarPaqueteActas(
    panel: PanelMasivo
): Promise<{ buffer: Buffer; archivo: string; incluidas: number; sinArchivo: string[] } | null> {
    const db = createAdminClient();
    const ids = panel.locales.map(l => l.proyecto_id);
    if (ids.length === 0) return null;

    const { data, error } = await db
        .from('bitacora_firmas')
        .select('proyecto_id, pdf_path, signed_at')
        .in('proyecto_id', ids)
        .not('pdf_path', 'is', null)
        .order('signed_at', { ascending: false });
    if (error) throw error;

    // La firma más reciente de cada proyecto
    const ultima = new Map<string, string>();
    for (const f of data ?? []) if (!ultima.has(f.proyecto_id)) ultima.set(f.proyecto_id, f.pdf_path as string);
    if (ultima.size === 0) return null;

    const zip = new JSZip();
    const usados = new Set<string>();
    const sinArchivo: string[] = [];
    let incluidas = 0;

    for (const l of panel.locales) {
        const pdfPath = ultima.get(l.proyecto_id);
        if (!pdfPath) continue;
        const etiqueta = `${l.sigla ?? 'local'}`;
        const { data: blob, error: dlError } = await db.storage.from('proyectos-assets').download(pdfPath);
        if (dlError || !blob) { sinArchivo.push(etiqueta); continue; }

        let nombre = `${slug(l.sigla ?? 'local')}_${slug(l.local_nombre ?? l.nombre)}_Acta.pdf`;
        for (let n = 2; usados.has(nombre); n++) nombre = nombre.replace(/(_Acta)(_\d+)?\.pdf$/, `$1_${n}.pdf`);
        usados.add(nombre);
        zip.file(nombre, Buffer.from(await blob.arrayBuffer()));
        incluidas++;
    }
    if (incluidas === 0) return null;

    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    return { buffer, archivo: `Actas_${slug(panel.padre.nombre)}.zip`, incluidas, sinArchivo };
}
