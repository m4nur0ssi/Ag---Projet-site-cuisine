import { NextResponse } from 'next/server';

/**
 * « Ma cave » — reconnaissance d'un vin depuis le TEXTE de son étiquette (nom lu
 * sur la photo, ou saisi). L'IA renvoie ses caractéristiques structurées.
 * Provider : Groq (gratuit) → Gemini → Anthropic. Repli : renvoie juste le nom.
 */
const GROQ_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.WINE_GROQ_MODEL || 'llama-3.3-70b-versatile';

const SYSTEM = `Tu es un sommelier. On te donne le NOM (ou le texte d'étiquette) d'un vin.
Renvoie ses caractéristiques les plus probables, STRICTEMENT en JSON :
{"name":"...","grape":"cépage principal","year":"millésime si connu sinon \\"\\"","color":"rouge|blanc|liqueur","region":"appellation, région, pays","note":"une phrase courte (arômes, style)"}
- "color" : "rouge", "blanc", ou "liqueur" (pour un vin liquoreux/doux/porto/muscat). Rosé → "blanc".
- Si tu ne connais pas exactement le vin, donne l'estimation la plus plausible d'après le nom/appellation. Ne laisse aucun champ vide sauf éventuellement l'année.
Réponds UNIQUEMENT le JSON, sans texte autour.`;

async function callGroq(userMsg: string) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${GROQ_KEY}` },
        body: JSON.stringify({
            model: GROQ_MODEL,
            temperature: 0.3,
            max_tokens: 300,
            response_format: { type: 'json_object' },
            messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: userMsg }],
        }),
    });
    if (!res.ok) throw new Error('Groq ' + res.status);
    const data = await res.json();
    return data?.choices?.[0]?.message?.content || '';
}

export async function POST(request: Request) {
    let label = '';
    try { const b = await request.json(); label = String(b?.label || '').trim(); } catch { /* noop */ }
    if (!label) return NextResponse.json({ error: 'label requis' }, { status: 400 });

    if (!GROQ_KEY) {
        return NextResponse.json({ wine: { name: label, grape: '', year: '', color: 'rouge', region: '', note: '' } });
    }
    try {
        const raw = await callGroq(label);
        const parsed = JSON.parse(raw);
        const color = ['rouge', 'blanc', 'liqueur'].includes(parsed.color) ? parsed.color : 'rouge';
        return NextResponse.json({
            wine: {
                name: parsed.name || label,
                grape: parsed.grape || '',
                year: String(parsed.year || ''),
                color,
                region: parsed.region || '',
                note: parsed.note || '',
            },
        });
    } catch {
        // Repli : au moins le nom, l'utilisateur complète à la main.
        return NextResponse.json({ wine: { name: label, grape: '', year: '', color: 'rouge', region: '', note: '' } });
    }
}
