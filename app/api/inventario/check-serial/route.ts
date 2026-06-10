import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ exists: false }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const serial = searchParams.get('serial')?.trim();
    if (!serial) return NextResponse.json({ exists: false });

    const db = createAdminClient();
    const { data } = await db
        .from('inventario')
        .select('id')
        .eq('numero_serie', serial)
        .maybeSingle();

    return NextResponse.json({ exists: !!data });
}
