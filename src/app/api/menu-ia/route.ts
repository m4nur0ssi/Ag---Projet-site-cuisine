import { NextResponse } from 'next/server';

/**
 * Menu de la semaine intelligent (#2).
 * Reçoit un pool de recettes compactes + les créneaux à remplir + des contraintes,
 * demande à Groq de composer un menu équilibré/varié (sans répétition, alternance
 * des protéines) et renvoie les affectations { day, meal, id }.
 * Le front fait le mapping id → recette. Dégradation douce : si pas de clé / erreur,
 * le caller retombe sur le remplissage aléatoire.
 */
const GROQ_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.MENU_GROQ_MODEL || 'llama-3.3-70b-versatile';

interface CompactRecipe { id: string; t: string; cat?: string; tags?: string[]; min?: number }

const SYSTEM = `Tu es un chef-nutritionniste qui compose un MENU DE SEMAINE équilibré et varié.
On te donne une liste de recettes disponibles (id, titre, catégorie, tags, temps) et des créneaux à remplir (jour + repas).
Règles :
- Utilise UNIQUEMENT des id présents dans la liste fournie.
- Remplis TOUS les créneaux demandés, exactement un id par créneau.
- Variété maximale : ne répète pas deux fois la même recette dans la semaine.
- Alterne les protéines d'un repas à l'autre (viande rouge / volaille / poisson / végétarien). Évite la même protéique deux repas de suite.
- Évite deux recettes très longues le même jour (privilégie rapide le midi en semaine).
- Respecte les contraintes utilisateur si fournies (budget, healthy, temps, thème, sans X).
Réponds STRICTEMENT en JSON : {"assignments":[{"day":"Lun","meal":"Midi","id":"123"}, ...]} sans texte autour.`;

async function callGroq(userMsg: string) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${GROQ_KEY}` },
        body: JSON.stringify({
            model: GROQ_MODEL,
            temperature: 0.7,
            max_tokens: 1500,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: SYSTEM },
                { role: 'user', content: userMsg },
            ],
        }),
    });
    if (!res.ok) throw new Error('Groq ' + res.status + ' ' + (await res.text()).slice(0, 160));
    const data = await res.json();
    return data?.choices?.[0]?.message?.content || '';
}

export async function POST(request: Request) {
    if (!GROQ_KEY) {
        return NextResponse.json({ error: 'GROQ_API_KEY non configuré' }, { status: 500 });
    }
    try {
        const body = await request.json();
        const recipes: CompactRecipe[] = Array.isArray(body?.recipes) ? body.recipes : [];
        const slots: { day: string; meal: string }[] = Array.isArray(body?.slots) ? body.slots : [];
        const constraints: string = typeof body?.constraints === 'string' ? body.constraints : '';
        if (!recipes.length || !slots.length) {
            return NextResponse.json({ error: 'recipes et slots requis' }, { status: 400 });
        }

        const userMsg = JSON.stringify({
            creneaux: slots,
            contraintes: constraints || 'aucune (menu équilibré et varié par défaut)',
            recettes: recipes,
        });

        const raw = await callGroq(userMsg);
        let parsed: any;
        try { parsed = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Réponse IA illisible' }, { status: 502 }); }

        const validIds = new Set(recipes.map(r => String(r.id)));
        const assignments = (parsed?.assignments || [])
            .filter((a: any) => a && a.day && a.meal && validIds.has(String(a.id)))
            .map((a: any) => ({ day: String(a.day), meal: String(a.meal), id: String(a.id) }));

        if (!assignments.length) {
            return NextResponse.json({ error: 'Aucune affectation valide' }, { status: 502 });
        }
        return NextResponse.json({ assignments });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'Erreur menu IA' }, { status: 500 });
    }
}
