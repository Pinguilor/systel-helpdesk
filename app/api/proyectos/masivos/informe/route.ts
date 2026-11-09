import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPanelMasivo } from '@/app/dashboard/proyectos/masivos/gestion-actions';
import { generarInformePDF, generarInformeXlsx, generarPaqueteActas } from '@/lib/generateInformeMasivo.server';

export const runtime = 'nodejs';
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** GET /api/proyectos/masivos/informe?id=…&formato=pdf|xlsx|actas */
export async function GET(req: NextRequest) {
    try {
        const sp = req.nextUrl.searchParams;
        const id = sp.get('id') ?? '';
        const formato = sp.get('formato');
        if (!UUID.test(id) || (formato !== 'pdf' && formato !== 'xlsx' && formato !== 'actas')) {
            return NextResponse.json({ error: 'Parámetros inválidos.' }, { status: 400 });
        }

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
        const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).maybeSingle();
        const rol = profile?.rol?.toString().toLowerCase();
        if (rol !== 'admin' && rol !== 'coordinador') {
            return NextResponse.json({ error: 'Sin permisos.' }, { status: 403 });
        }

        const panel = await getPanelMasivo(id);
        if (!panel) return NextResponse.json({ error: 'Rollout no encontrado.' }, { status: 404 });

        let resultado: { buffer: Buffer; archivo: string };
        let tipo: string;
        const extra: Record<string, string> = {};

        if (formato === 'pdf') {
            resultado = await generarInformePDF(panel);
            tipo = 'application/pdf';
        } else if (formato === 'xlsx') {
            resultado = await generarInformeXlsx(panel);
            tipo = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        } else {
            const paquete = await generarPaqueteActas(panel);
            if (!paquete) {
                return NextResponse.json({ error: 'Aún no hay actas firmadas en este Rollout.' }, { status: 404 });
            }
            resultado = paquete;
            tipo = 'application/zip';
            extra['X-Actas-Incluidas'] = String(paquete.incluidas);
            extra['X-Actas-Sin-Archivo'] = String(paquete.sinArchivo.length);
        }

        return new NextResponse(new Uint8Array(resultado.buffer), {
            status: 200,
            headers: {
                'Content-Type': tipo,
                'Content-Disposition': `attachment; filename="${resultado.archivo}"`,
                'Cache-Control': 'private, no-store',
                ...extra,
            },
        });
    } catch (e: any) {
        console.error('[informe-masivo]', e);
        return NextResponse.json({ error: e?.message || 'No se pudo generar el informe.' }, { status: 500 });
    }
}
