/**
 * Generación server-side del PDF "Acta de Avance de Proyecto" con @react-pdf/renderer.
 * Solo importar desde Server Actions o Route Handlers.
 */
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import path from 'path';
import fs from 'fs';
import { ActaProyectoPDF, type ActaProyectoProps } from '@/app/dashboard/proyectos/[id]/bitacora/components/ActaProyectoPDF';

export type ActaProyectoInput = Omit<ActaProyectoProps, 'logoUrl'>;

export async function generateActaProyectoPDF(input: ActaProyectoInput): Promise<Buffer> {
    const logoPath = path.join(process.cwd(), 'public', 'systelcom.png');
    const logoUrl = `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`;

    const element = React.createElement(ActaProyectoPDF, { ...input, logoUrl });
    const arrayBuffer = await renderToBuffer(element as any);
    return Buffer.from(arrayBuffer);
}
