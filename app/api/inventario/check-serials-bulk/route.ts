import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ duplicados: [] }, { status: 401 });

    let body: { seriales?: unknown };
    try { body = await request.json(); } catch { return NextResponse.json({ duplicados: [] }); }

    const seriales: string[] = Array.isArray(body.seriales)
        ? (body.seriales as unknown[]).map(s => String(s ?? '').trim()).filter(Boolean)
        : [];

    if (seriales.length === 0) return NextResponse.json({ duplicados: [] });

    const db = createAdminClient();
    const { data } = await db
        .from('inventario')
        .select('numero_serie')
        .in('numero_serie', seriales);

    const duplicados = (data ?? []).map((r: any) => r.numero_serie as string);
    return NextResponse.json({ duplicados });
}
