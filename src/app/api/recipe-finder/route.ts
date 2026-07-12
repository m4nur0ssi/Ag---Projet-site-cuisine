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
const STOP = new Set(['une', 'un', 'des', 'les', 'pour', 'avec', 'dans', 'sur', 'que', 'qui', 'cherche', 'voudrais', 'veux', 'trouve', 'trouver', 'aimerais', 'restaurant', 'resto']);
function norm(s: string): string {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
// Classe les entrées par nombre de mots de la demande présents dans titre/cat/tags.
function scoreByQuery(query: string, recipes: CompactRecipe[]): { r: CompactRecipe; s: number }[] {
    const qWords = norm(query).split(/[^a-z0-9]+/).filter(w => w.length >= 3 && !STOP.has(w));
    const scored = recipes.map(r => {
        const hay = norm(`${r.t} ${r.cat || ''} ${(r.tags || []).join(' ')}`);
        let s = 0;
        for (const w of qWords) if (hay.includes(w)) s++;
        return { r, s };
    });
    scored.sort((a, b) => b.s - a.s);
    return scored;
}
function shortlistForLLM(query: string, recipes: CompactRecipe[]): CompactRecipe[] {
    return scoreByQuery(query, recipes).slice(0, MAX_TO_LLM).map(({ r }) => ({
        id: String(r.id), t: r.t, cat: r.cat, tags: (r.tags || []).slice(0, 3),
    }));
}
// Repli si l'IA ne renvoie rien : les entrées qui partagent le plus de mots avec la demande.
function keywordFallback(query: string, recipes: CompactRecipe[]): string[] {
    return scoreByQuery(query, recipes).filter(x => x.s > 0).slice(0, 5).map(x => String(x.r.id));
}

const SYSTEM = `Tu es l'assistant culinaire d'un site de recettes.
On te donne la demande d'un utilisateur (en langage naturel) et la LISTE des recettes disponibles sur le site (id, titre, catégorie, tags).
Ta mission : proposer les entrées EXISTANTES de la liste qui répondent le mieux à la demande.
La liste contient des RECETTES et aussi des RESTAURANTS (catégorie "restaurant" ; leurs tags incluent le type de cuisine — italien, brasserie, asiatique… —, la/les ville(s) et "terrasse" s'il y a une terrasse).
Règles STRICTES :
- Choisis UNIQUEMENT des id présents dans la liste fournie. N'invente JAMAIS d'entrée ni d'id.
- Renvoie de 1 à 5 entrées, la plus pertinente en premier.
- Si la demande porte sur un RESTAURANT / un lieu où sortir manger / par ville / type de cuisine / terrasse → propose des RESTAURANTS (catégorie "restaurant").
- Si la demande porte sur un plat à cuisiner → propose des RECETTES. Ne mélange pas recettes et restaurants dans une même réponse.
- IMPORTANT : la VILLE d'un restaurant est écrite dans ses tags (ex. tag "gonesse", "paris", "le blanc-mesnil"). Si l'utilisateur cite une ville, propose TOUS les restaurants dont les tags contiennent cette ville (compare en minuscules, ignore les accents). Un restaurant peut avoir plusieurs villes.
- Tiens compte de la catégorie, des ingrédients/protéines, du régime (healthy, végé…), du pays/ville, de la terrasse et du temps si mentionnés.
- Ne renvoie JAMAIS une liste "ids" vide s'il existe au moins une entrée qui correspond, même partiellement (bonne ville OU bon type OU terrasse). Prends alors la/les plus proche(s).
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
            // L'IA n'a rien renvoyé de valide → repli mots-clés (ville/type/tags…).
            const fb = keywordFallback(query, recipes);
            if (fb.length) return NextResponse.json({ ids: fb, message: 'Voici ce qui se rapproche le plus 👇' });
            return NextResponse.json({ error: 'Aucune recette trouvée' }, { status: 404 });
        }
        const message = typeof parsed?.message === 'string' ? parsed.message : '';
        return NextResponse.json({ ids, message });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'Erreur assistant IA' }, { status: 500 });
    }
}
