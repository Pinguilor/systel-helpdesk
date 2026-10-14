import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getRackData } from '@/app/dashboard/proyectos/[id]/rack/actions';
import { generateRackPDF } from '@/lib/generateRackPDF.server';

export const runtime = 'nodejs';
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const slug = (t: string) =>
    t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'equipo';

/** GET /api/proyectos/rack-pdf?proyectoId=…&tipo=patch_panel|switch&id=… */
export async function GET(req: NextRequest) {
    try {
        const sp = req.nextUrl.searchParams;
        const proyectoId = sp.get('proyectoId') ?? '';
        const tipo = sp.get('tipo');
        const equipoId = sp.get('id') ?? '';

        if (!UUID.test(proyectoId) || !UUID.test(equipoId) || (tipo !== 'patch_panel' && tipo !== 'switch')) {
            return NextResponse.json({ error: 'Parámetros inválidos.' }, { status: 400 });
        }

        // ── Auth: admin/coordinador, o técnico participante activo del proyecto ──
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });

        const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).maybeSingle();
        const rol = profile?.rol?.toString().toLowerCase() ?? '';

        const db = createAdminClient();
        if (rol === 'tecnico') {
            const { data: part } = await db
                .from('proyecto_participantes').select('id')
                .eq('proyecto_id', proyectoId).eq('perfil_id', user.id).eq('activo', true).maybeSingle();
            if (!part) return NextResponse.json({ error: 'Sin acceso a este proyecto.' }, { status: 403 });
        } else if (rol !== 'admin' && rol !== 'coordinador') {
            return NextResponse.json({ error: 'Sin permisos.' }, { status: 403 });
        }

        // ── Datos ────────────────────────────────────────────────────────
        const [{ data: proyecto }, rack] = await Promise.all([
            db.from('proyectos')
                .select('nombre, cliente:restaurantes(razon_social, cliente, compania, nombre_restaurante, direccion)')
                .eq('id', proyectoId).maybeSingle(),
            getRackData(proyectoId),
        ]);
        if (!proyecto) return NextResponse.json({ error: 'Proyecto no encontrado.' }, { status: 404 });
        if (rack.error) return NextResponse.json({ error: rack.error }, { status: 500 });

        const p: any = proyecto;
        const resultado = await generateRackPDF({
            tipo,
            equipoId,
            proyectoNombre: p.nombre,
            cliente: p.cliente?.razon_social || p.cliente?.cliente || p.cliente?.compania || '',
            ubicacion: [p.cliente?.nombre_restaurante, p.cliente?.direccion].filter(Boolean).join(' – '),
            data: rack,
        });
        if (!resultado) return NextResponse.json({ error: 'Equipo no encontrado en este proyecto.' }, { status: 404 });

        const archivo = `${tipo === 'switch' ? 'Switch' : 'PatchPanel'}_${slug(resultado.nombreEquipo)}_${slug(p.nombre)}.pdf`;
        return new NextResponse(new Uint8Array(resultado.buffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${archivo}"`,
                'Cache-Control': 'private, no-store',
            },
        });
    } catch (e: any) {
        console.error('[rack-pdf]', e);
        return NextResponse.json({ error: e?.message || 'No se pudo generar el PDF.' }, { status: 500 });
    }
}
