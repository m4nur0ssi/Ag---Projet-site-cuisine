import { NextResponse } from 'next/server';

/**
 * « Ma cave » — reconnaissance d'un vin.
 * - Si une IMAGE est fournie (photo de l'étiquette) → modèle VISION Groq qui LIT
 *   l'étiquette et renvoie les caractéristiques. C'est le vrai « scan Vivino ».
 * - Sinon, à partir du NOM/texte.
 * Repli : renvoie au moins le nom.
 */
export const runtime = 'nodejs';
const GROQ_KEY = process.env.GROQ_API_KEY;
const GROQ_TEXT_MODEL = process.env.WINE_GROQ_MODEL || 'llama-3.3-70b-versatile';
// Modèle vision Groq (multimodal). Surchargable via env si Groq change de nom.
const GROQ_VISION_MODEL = process.env.WINE_GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';

const SYSTEM = `Tu es un sommelier. Renvoie les caractéristiques d'un vin STRICTEMENT en JSON :
{"name":"nom du domaine/cuvée","grape":"cépage principal","year":"millésime si visible sinon \\"\\"","color":"rouge|blanc|liqueur","region":"appellation, région, pays","note":"une phrase courte: arômes/style"}
- "color": "rouge", "blanc" ou "liqueur" (liquoreux/doux/porto/muscat). Rosé → "blanc".
- Ne laisse aucun champ vide sauf éventuellement l'année. Estime au plus plausible d'après l'appellation.
Réponds UNIQUEMENT le JSON.`;

async function callGroqText(userMsg: string) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${GROQ_KEY}` },
        body: JSON.stringify({
            model: GROQ_TEXT_MODEL, temperature: 0.3, max_tokens: 300,
            response_format: { type: 'json_object' },
            messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: userMsg }],
        }),
    });
    if (!res.ok) throw new Error('Groq ' + res.status + ' ' + (await res.text()).slice(0, 160));
    const data = await res.json();
    return data?.choices?.[0]?.message?.content || '';
}

async function callGroqVision(imageDataUrl: string) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${GROQ_KEY}` },
        body: JSON.stringify({
            model: GROQ_VISION_MODEL, temperature: 0.2, max_tokens: 350,
            messages: [{
                role: 'user',
                content: [
                    { type: 'text', text: `${SYSTEM}\n\nLis l'étiquette de ce vin et remplis le JSON.` },
                    { type: 'image_url', image_url: { url: imageDataUrl } },
                ],
            }],
        }),
    });
    if (!res.ok) throw new Error('GroqVision ' + res.status + ' ' + (await res.text()).slice(0, 200));
    const data = await res.json();
    return data?.choices?.[0]?.message?.content || '';
}

function toWine(raw: string, fallbackName: string) {
    // Le modèle vision peut entourer le JSON de texte → on extrait le 1er objet.
    const m = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(m ? m[0] : raw);
    const color = ['rouge', 'blanc', 'liqueur'].includes(parsed.color) ? parsed.color : 'rouge';
    return {
        name: parsed.name || fallbackName || 'Vin',
        grape: parsed.grape || '',
        year: String(parsed.year || ''),
        color,
        region: parsed.region || '',
        note: parsed.note || '',
    };
}

export async function POST(request: Request) {
    let label = ''; let image = '';
    try { const b = await request.json(); label = String(b?.label || '').trim(); image = String(b?.image || ''); } catch { /* noop */ }
    if (!label && !image) return NextResponse.json({ error: 'label ou image requis' }, { status: 400 });

    if (!GROQ_KEY) {
        return NextResponse.json({ wine: { name: label || 'Vin', grape: '', year: '', color: 'rouge', region: '', note: '' } });
    }

    // 1) Vision si photo fournie.
    if (image.startsWith('data:image')) {
        try { return NextResponse.json({ wine: toWine(await callGroqVision(image), label), source: 'vision' }); }
        catch (e) { /* on retombe sur le texte si un label est là */ }
    }
    // 2) Texte (nom saisi/lu).
    if (label) {
        try { return NextResponse.json({ wine: toWine(await callGroqText(label), label), source: 'text' }); }
        catch { /* repli */ }
    }
    return NextResponse.json({ wine: { name: label || 'Vin', grape: '', year: '', color: 'rouge', region: '', note: '' }, source: 'fallback' });
}
