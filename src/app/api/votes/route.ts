import { NextResponse } from 'next/server';

/**
 * LOGIQUE DE SYNCHRONISATION MONDIALE (SUPABASE)
 * On utilise l'API REST native de Supabase pour éviter d'installer des dépendances lourdes.
 * Les variables d'environnement suivantes sont requises :
 * - NEXT_PUBLIC_SUPABASE_URL: L'URL de ton projet Supabase
 * - SUPABASE_SERVICE_ROLE_KEY: Ta clé de service secrète (Table Editor > API settings)
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// URL de la table 'votes' (PostgREST API)
const TABLE_URL = `${SUPABASE_URL}/rest/v1/votes`;

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const recipeId = searchParams.get('recipeId');

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.warn('⚠️ Supabase non configuré. Mode dégradé (0 votes).');
        return NextResponse.json({ votes: 0, warning: 'Supabase configuration missing' });
    }

    try {
        if (recipeId) {
            // Récupérer le score pour une recette spécifique
            const res = await fetch(`${TABLE_URL}?recipe_id=eq.${recipeId}&select=count`, {
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`
                },
                next: { revalidate: 0 } // Bypass Next.js cache
            });
            const data = await res.json();
            return NextResponse.json({ votes: data[0]?.count || 0 });
        }

        // Tout récupérer
        const res = await fetch(`${TABLE_URL}?select=*`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        const allVotes = await res.json();
        return NextResponse.json(allVotes);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 });
    }

    try {
        const { recipeId, action } = await request.json();
        if (!recipeId) return NextResponse.json({ error: 'ID manquant' }, { status: 400 });

        // 1. Récupérer le compte actuel
        const getRes = await fetch(`${TABLE_URL}?recipe_id=eq.${recipeId}&select=count`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        const currentData = await getRes.json();
        const currentCount = currentData[0]?.count || 0;
        
        // 2. Calculer le nouveau compte
        const newCount = action === 'remove' ? Math.max(0, currentCount - 1) : currentCount + 1;

        // 3. Upsert (Mise à jour ou insertion si inexistant)
        const upsertRes = await fetch(`${TABLE_URL}`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify({
                recipe_id: recipeId,
                count: newCount
            })
        });

        if (!upsertRes.ok) {
            const err = await upsertRes.text();
            throw new Error(`Erreur Supabase: ${err}`);
        }

        return NextResponse.json({ success: true, votes: newCount });
    } catch (e: any) {
        console.error('API Votes Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
