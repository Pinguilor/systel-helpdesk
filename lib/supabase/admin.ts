import { createClient } from '@supabase/supabase-js';

/**
 * Supabase admin client with service_role key.
 * Bypasses RLS — use ONLY in server-side admin actions.
 */
export function createAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
}
