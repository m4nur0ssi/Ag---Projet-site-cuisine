import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Fournisseur, par ordre de préférence : Groq (gratuit) → Gemini (gratuit) → Anthropic (payant).
const GROQ_KEY = process.env.GROQ_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const GROQ_MODEL = process.env.WINE_GROQ_MODEL || 'llama-3.3-70b-versatile';
const GEMINI_MODEL = process.env.WINE_GEMINI_MODEL || 'gemini-2.5-flash';
const ANTHROPIC_MODEL = process.env.WINE_MODEL || 'claude-3-5-haiku-latest';

const SYSTEM = `Tu es un sommelier expert. On te donne une recette (titre, catégorie, ingrédients).
Tu proposes des accords mets-vins.

Règles STRICTES :
- Réponds UNIQUEMENT avec du JSON valide, aucun texte avant/après.
- Exactement 3 vins, par gammes de prix croissantes :
  1) un vin abordable (prix entre 7 et 15 €)
  2) un vin plaisir (prix entre 15 et 30 €)
  3) un vin découverte/monde (prix entre 25 et 50 €), d'un pays autre que la France si pertinent
- Varie les pays (France, Italie, et un vin du monde : Espagne, Portugal, Argentine, Chili, Afrique du Sud, etc.) et les cépages.
- Aucune bouteille au-dessus de 50 €.
- La couleur (rouge/blanc/rosé/effervescent) doit coller au plat.
- En français. Le champ "why" : 1 phrase courte, concrète, sur l'accord.

Schéma JSON exact :
{"wines":[{"name":string,"color":"rouge"|"blanc"|"rosé"|"effervescent","country":string,"flag":string(emoji drapeau),"region":string,"grape":string,"priceMin":number,"priceMax":number,"tier":"abordable"|"plaisir"|"découverte","why":string}]}`;

interface Body {
    title?: string;
    category?: string;
    ingredients?: string[];
}

// --- Appels fournisseurs : renvoient le texte brut du modèle ---
async function callGroq(userMsg: string): Promise<{ text?: string; error?: string; status?: number }> {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${GROQ_KEY}` },
        body: JSON.stringify({
            model: GROQ_MODEL,
            temperature: 0.8,
            max_tokens: 1024,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: SYSTEM },
                { role: 'user', content: userMsg },
            ],
        }),
    });
    if (!res.ok) return { error: 'Groq ' + res.status, status: res.status };
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || '';
    return { text };
}

async function callGemini(userMsg: string): Promise<{ text?: string; error?: string; status?: number }> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM }] },
            contents: [{ role: 'user', parts: [{ text: userMsg }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.8, maxOutputTokens: 1024 },
        }),
    });
    if (!res.ok) return { error: 'Gemini ' + res.status, status: res.status };
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '';
    return { text };
}

async function callAnthropic(userMsg: string): Promise<{ text?: string; error?: string; status?: number }> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-api-key': ANTHROPIC_KEY as string,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model: ANTHROPIC_MODEL,
            max_tokens: 1024,
            system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
            messages: [{ role: 'user', content: userMsg }],
        }),
    });
    if (!res.ok) return { error: 'Anthropic ' + res.status, status: res.status };
    const data = await res.json();
    const text = data?.content?.[0]?.text || '';
    return { text };
}

export async function POST(req: NextRequest) {
    if (!GROQ_KEY && !GEMINI_KEY && !ANTHROPIC_KEY) {
        return NextResponse.json({ error: 'Aucune clé IA configurée (GROQ_API_KEY, GEMINI_API_KEY ou ANTHROPIC_API_KEY)' }, { status: 500 });
    }

    let body: Body;
    try { body = await req.json(); } catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }); }

    const title = (body.title || '').slice(0, 200);
    const category = (body.category || '').slice(0, 60);
    const ingredients = (body.ingredients || []).slice(0, 40).map(s => String(s).slice(0, 120));
    if (!ingredients.length && !title) {
        return NextResponse.json({ error: 'Recette vide' }, { status: 400 });
    }

    const userMsg = `Recette : ${title}\nCatégorie : ${category}\nIngrédients :\n- ${ingredients.join('\n- ')}`;

    try {
        const out = GROQ_KEY ? await callGroq(userMsg)
            : GEMINI_KEY ? await callGemini(userMsg)
            : await callAnthropic(userMsg);
        if (out.error || !out.text) {
            return NextResponse.json({ error: out.error || 'Réponse vide' }, { status: 502 });
        }
        const match = out.text.match(/\{[\s\S]*\}/);
        if (!match) return NextResponse.json({ error: 'Réponse non parsable' }, { status: 502 });

        const parsed = JSON.parse(match[0]);
        const wines = Array.isArray(parsed?.wines) ? parsed.wines.slice(0, 3) : [];
        if (!wines.length) return NextResponse.json({ error: 'Aucun vin' }, { status: 502 });

        return NextResponse.json({ wines });
    } catch (e: any) {
        return NextResponse.json({ error: 'Erreur serveur', detail: String(e?.message || e).slice(0, 200) }, { status: 500 });
    }
}
