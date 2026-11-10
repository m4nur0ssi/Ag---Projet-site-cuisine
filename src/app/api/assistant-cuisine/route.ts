import { NextResponse } from 'next/server';
import { corpsJson, ipDe, memeOrigine, trop } from '@/lib/garde-api';

/**
 * Assistant de cuisine à voix haute (#4) : une question dite pendant la préparation
 * (« par quoi remplacer la crème ? », « je n'ai que 3 œufs ») reçoit une réponse
 * courte, lue ensuite à la voix naturelle.
 *
 * Garde-fous : même origine que le site, 10 questions par minute et par adresse,
 * question limitée à 300 caractères. Sans clé ou en cas d'erreur : 503, et l'appli
 * dit qu'elle ne peut pas répondre pour l'instant.
 */
const GROQ_KEY = process.env.GROQ_API_KEY;
const MODELE = process.env.ASSISTANT_GROQ_MODEL || process.env.MENU_GROQ_MODEL || 'openai/gpt-oss-20b';

interface Requete { question?: string; titre?: string; etape?: string; ingredients?: string[] }

const SYSTEM = `Tu es l'assistant vocal d'une cuisinière en pleine préparation.
Elle a les mains occupées : tu réponds à voix haute, donc :
- en français, en deux phrases au plus, sans liste, sans markdown, sans symbole ;
- écris les quantités et températures en toutes lettres (« cent quatre-vingts degrés ») ;
- si on te demande un remplacement, donne UNE solution simple avec la quantité ;
- si l'ingrédient demandé ne correspond pas à la recette, dis-le franchement.`;

export async function POST(request: Request) {
    if (!GROQ_KEY) return NextResponse.json({ error: 'assistant indisponible' }, { status: 503 });
    if (!memeOrigine(request)) return NextResponse.json({ error: 'Appel refusé' }, { status: 403 });
    if (trop(`assistant:${ipDe(request)}`, 10, 60_000)) {
        return NextResponse.json({ error: 'Trop de questions, patientez un instant.' }, { status: 429 });
    }
    const corps = await corpsJson<Requete>(request, 20_000);
    const question = (corps?.question || '').trim().slice(0, 300);
    if (!question) return NextResponse.json({ error: 'Question vide' }, { status: 400 });

    const contexte = [
        corps?.titre ? `Recette : ${corps.titre}.` : '',
        corps?.etape ? `Étape en cours : ${corps.etape.slice(0, 600)}` : '',
        corps?.ingredients?.length ? `Ingrédients : ${corps.ingredients.slice(0, 40).join(', ')}.` : '',
    ].filter(Boolean).join('\n');

    try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${GROQ_KEY}` },
            body: JSON.stringify({
                model: MODELE,
                temperature: 0.4,
                // gpt-oss raisonne avant de répondre : à 220 jetons, la réponse ne sortait jamais.
                max_tokens: 1500,
                messages: [
                    { role: 'system', content: SYSTEM },
                    { role: 'user', content: `${contexte}\n\nQuestion : ${question}` },
                ],
            }),
        });
        if (!res.ok) return NextResponse.json({ error: 'assistant indisponible' }, { status: 503 });
        const data = await res.json();
        const reponse = String(data?.choices?.[0]?.message?.content || '').replace(/[*#`_>-]+/g, ' ').replace(/\s+/g, ' ').trim();
        if (!reponse) return NextResponse.json({ error: 'assistant indisponible' }, { status: 503 });
        return NextResponse.json({ reponse: reponse.slice(0, 600) });
    } catch {
        return NextResponse.json({ error: 'assistant indisponible' }, { status: 503 });
    }
}
