import { NextResponse } from 'next/server';

/**
 * Assistant IA de recettes (#3).
 * L'utilisateur décrit ce qu'il veut (texte ou voix) en langage naturel ;
 * on donne au LLM le catalogue compact (id, titre, catégorie, tags) et il
 * renvoie les MEILLEURES recettes EXISTANTES qui correspondent + une phrase.
 * Il NE crée JAMAIS de recette : il choisit uniquement dans la liste fournie.
 * Dégradation douce : si pas de clé / erreur, le front retombe sur une
 * recherche texte locale.
 */
const GROQ_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.MENU_GROQ_MODEL || 'llama-3.3-70b-versatile';

interface CompactRecipe { id: string; t: string; cat?: string; tags?: string[] }

// Le catalogue complet (~500 recettes) dépasse la limite de tokens de Groq (erreur 413).
// On pré-filtre par pertinence vs la demande (les recettes qui partagent des mots
// remontent — ex. "sauce" fait remonter la catégorie sauces) puis on plafonne, en
// réduisant aussi les tags. Groq n'a plus qu'à CLASSER une liste courte et ciblée.
const MAX_TO_LLM = 200;
function norm(s: string): string {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
function shortlistForLLM(query: string, recipes: CompactRecipe[]): CompactRecipe[] {
    const qWords = norm(query).split(/[^a-z0-9]+/).filter(w => w.length >= 3);
    const scored = recipes.map(r => {
        const hay = norm(`${r.t} ${r.cat || ''} ${(r.tags || []).join(' ')}`);
        let s = 0;
        for (const w of qWords) if (hay.includes(w)) s++;
        return { r, s };
    });
    // Tri stable par score décroissant : les recettes pertinentes d'abord, puis le reste.
    scored.sort((a, b) => b.s - a.s);
    return scored.slice(0, MAX_TO_LLM).map(({ r }) => ({
        id: String(r.id), t: r.t, cat: r.cat, tags: (r.tags || []).slice(0, 3),
    }));
}

const SYSTEM = `Tu es l'assistant culinaire d'un site de recettes.
On te donne la demande d'un utilisateur (en langage naturel) et la LISTE des recettes disponibles sur le site (id, titre, catégorie, tags).
Ta mission : proposer les recettes EXISTANTES de la liste qui répondent le mieux à la demande.
Règles STRICTES :
- Choisis UNIQUEMENT des id présents dans la liste fournie. N'invente JAMAIS de recette ni d'id.
- Renvoie de 1 à 5 recettes, la plus pertinente en premier.
- Tiens compte de la catégorie, des ingrédients/protéines évoqués, du régime (healthy, végé…), du pays et du temps si mentionnés.
- Si rien ne correspond vraiment, renvoie les plus proches et dis-le dans "message".
- "message" : une phrase courte et chaleureuse en français qui présente la sélection.
Réponds STRICTEMENT en JSON : {"ids":["12","7"],"message":"..."} sans texte autour.`;

async function callGroq(userMsg: string) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${GROQ_KEY}` },
        body: JSON.stringify({
            model: GROQ_MODEL,
            temperature: 0.5,
            max_tokens: 500,
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
        const query: string = typeof body?.query === 'string' ? body.query.trim() : '';
        const recipes: CompactRecipe[] = Array.isArray(body?.recipes) ? body.recipes : [];
        if (!query || !recipes.length) {
            return NextResponse.json({ error: 'query et recipes requis' }, { status: 400 });
        }

        const userMsg = JSON.stringify({ demande: query, recettes: shortlistForLLM(query, recipes) });

        const raw = await callGroq(userMsg);
        let parsed: any;
        try { parsed = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Réponse IA illisible' }, { status: 502 }); }

        const validIds = new Set(recipes.map(r => String(r.id)));
        const ids = (Array.isArray(parsed?.ids) ? parsed.ids : [])
            .map((id: any) => String(id))
            .filter((id: string) => validIds.has(id))
            .slice(0, 5);

        if (!ids.length) {
            return NextResponse.json({ error: 'Aucune recette trouvée' }, { status: 404 });
        }
        const message = typeof parsed?.message === 'string' ? parsed.message : '';
        return NextResponse.json({ ids, message });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'Erreur assistant IA' }, { status: 500 });
    }
}
