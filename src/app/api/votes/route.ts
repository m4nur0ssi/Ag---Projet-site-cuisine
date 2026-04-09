import { NextResponse } from 'next/server';

/**
 * API Votes — Supabase (REST natif, zéro SDK)
 * Variables Vercel requises :
 *   NEXT_PUBLIC_SUPABASE_URL  = https://wtlyosjvmutrkinyvrqu.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY = sb_secret_...
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function supabaseHeaders() {
    return {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY!,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=representation'
    };
}

// ── GET /api/votes?recipeId=xxx ──────────────────────────────────────────────
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const recipeId = searchParams.get('recipeId');

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.warn('⚠️ Supabase non configuré — votes locaux uniquement.');
        return NextResponse.json({ votes: 0, warning: 'Supabase not configured' });
    }

    try {
        if (recipeId) {
            const res = await fetch(
                `${SUPABASE_URL}/rest/v1/votes?recipe_id=eq.${encodeURIComponent(recipeId)}&select=count`,
                { headers: supabaseHeaders(), next: { revalidate: 0 } }
            );

            if (!res.ok) {
                const err = await res.text();
                console.error('Supabase GET error:', err);
                return NextResponse.json({ votes: 0 });
            }

            const rows = await res.json();
            const votes = rows.length > 0 ? (rows[0].count ?? 0) : 0;
            return NextResponse.json({ votes });
        }

        // Tous les votes (pour usage futur)
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/votes?select=recipe_id,count`,
            { headers: supabaseHeaders() }
        );
        const rows = await res.json();
        return NextResponse.json(rows);

    } catch (e: any) {
        console.error('API Votes GET error:', e.message);
        return NextResponse.json({ votes: 0, error: e.message });
    }
}

// ── POST /api/votes  { recipeId, action: 'add'|'remove' } ───────────────────
export async function POST(request: Request) {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 });
    }

    try {
        const { recipeId, action } = await request.json();
        if (!recipeId) return NextResponse.json({ error: 'recipeId manquant' }, { status: 400 });

        const fnName = action === 'remove' ? 'decrement_vote' : 'increment_vote';

        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
            method: 'POST',
            headers: supabaseHeaders(),
            body: JSON.stringify({ rid: recipeId })
        });

        if (!res.ok) {
            const err = await res.text();
            console.error(`Supabase RPC ${fnName} error:`, err);
            throw new Error(`Supabase error: ${err}`);
        }

        const newCount = await res.json();
        return NextResponse.json({ success: true, votes: newCount ?? 0 });

    } catch (e: any) {
        console.error('API Votes POST error:', e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
