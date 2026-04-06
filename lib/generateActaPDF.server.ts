/**
 * Generación server-side del PDF "Acta de Cierre" usando @react-pdf/renderer.
 * Este archivo solo debe importarse desde Server Actions o Route Handlers.
 */
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import path from 'path';
import fs from 'fs';
import { ActaCierrePDF } from '@/app/dashboard/ticket/[id]/components/ActaCierrePDF';

export interface ActaPDFInput {
    ticket: any;
    materiales: any[];
    notas: string;
    firmaClienteUrl: string;
    firmaTecnicoUrl: string;
    agenteNombre: string;
    ayudantesNombres?: string[];
}

/**
 * Renderiza el Acta de Cierre a un Buffer PDF listo para adjuntar en email.
 * Usa `renderToBuffer()` de @react-pdf/renderer v4 (API correcta para Node.js).
 * El logo se resuelve como ruta absoluta del filesystem para evitar
 * problemas con rutas relativas en el contexto del servidor.
 */
export async function generateActaCierrePDF(input: ActaPDFInput): Promise<Buffer> {
    // Leer el logo y convertirlo a base64 para que @react-pdf/renderer v4
    // lo inyecte directamente sin depender de resolución de rutas en Node.js
    const logoPath = path.join(process.cwd(), 'public', 'systelcom.png');
    const logoBuffer = fs.readFileSync(logoPath);
    const logoUrl = `data:image/png;base64,${logoBuffer.toString('base64')}`;

    const element = React.createElement(ActaCierrePDF, {
        ...input,
        logoUrl,
    });

    const arrayBuffer = await renderToBuffer(element as React.ReactElement);
    return Buffer.from(arrayBuffer);
}
