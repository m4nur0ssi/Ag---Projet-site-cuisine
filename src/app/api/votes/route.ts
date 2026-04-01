import { NextResponse } from 'next/server';

/**
 * LOGIQUE DE SYNCHRONISATION MONDIALE (FIREBASE / FIRESTORE)
 * On utilise l'API REST native de Google Firestore pour une synchronisation optimale.
 * Variables requises dans .env.local :
 * - FIREBASE_PROJECT_ID: L'ID de ton projet Firebase
 * - FIREBASE_API_KEY: (Optionnel pour REST public)
 */

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const DATABASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/votes`;

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const recipeId = searchParams.get('recipeId');

    if (!PROJECT_ID) {
        console.warn('⚠️ Firebase Project ID non configuré. Mode local uniquement.');
        return NextResponse.json({ votes: 0, warning: 'Firebase ID missing' });
    }

    try {
        if (recipeId) {
            const res = await fetch(`${DATABASE_URL}/${recipeId}`, {
                next: { revalidate: 0 }
            });
            
            if (!res.ok) return NextResponse.json({ votes: 0 }); // Document n'existe pas encore
            
            const data = await res.json();
            // Firestore format: fields.count.integerValue
            const votes = parseInt(data.fields?.count?.integerValue || "0");
            return NextResponse.json({ votes });
        }

        // Tout récupérer (List Documents)
        const res = await fetch(DATABASE_URL);
        const data = await res.json();
        const simplified = (data.documents || []).map((doc: any) => ({
            id: doc.name.split('/').pop(),
            votes: parseInt(doc.fields?.count?.integerValue || "0")
        }));
        return NextResponse.json(simplified);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    if (!PROJECT_ID) {
        return NextResponse.json({ error: 'Firebase non configuré' }, { status: 500 });
    }

    try {
        const { recipeId, action } = await request.json();
        if (!recipeId) return NextResponse.json({ error: 'ID manquant' }, { status: 400 });

        // 1. Récupérer le compte actuel pour faire un "Update"
        const getRes = await fetch(`${DATABASE_URL}/${recipeId}`);
        let currentCount = 0;
        
        if (getRes.ok) {
            const currentData = await getRes.json();
            currentCount = parseInt(currentData.fields?.count?.integerValue || "0");
        }

        // 2. Calculer le nouveau compte
        const newCount = action === 'remove' ? Math.max(0, currentCount - 1) : currentCount + 1;

        // 3. Update/Create (PATCH sur Firestore REST)
        // Note: L'API REST de Firestore utilise un système de masquage pour les mises à jour
        const updateRes = await fetch(`${DATABASE_URL}/${recipeId}?updateMask.fieldPaths=count`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fields: {
                    count: { integerValue: String(newCount) }
                }
            })
        });

        if (!updateRes.ok) {
            const err = await updateRes.text();
            throw new Error(`Erreur Firestore: ${err}`);
        }

        return NextResponse.json({ success: true, votes: newCount });
    } catch (e: any) {
        console.error('API Votes Firestore Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
