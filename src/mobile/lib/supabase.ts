import { createClient } from '@supabase/supabase-js';

// Fallbacks placeholder : évitent que createClient throw ("supabaseKey is required")
// au moment du prerender de build si l'env n'est pas inlinée. En prod runtime les vraies
// valeurs NEXT_PUBLIC_* sont injectées.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'public-anon-placeholder';

export const supabase = createClient(url, key, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'implicit',
    },
});

export type SupabaseUser = Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user'];
