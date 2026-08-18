import { NextResponse } from 'next/server';
import { findOnVivino, type VivinoWine } from '@/lib/vivino';

/**
 * « Ma cave » — reconnaissance d'un vin, en deux temps.
 *
 *  1. LIRE L'ÉTIQUETTE : la photo part dans un modèle VISION (Groq multimodal)
 *     qui en extrait le nom du vin et le millésime.
 *  2. RETROUVER LA BOUTEILLE : ce nom est cherché dans la base VIVINO, qui rend
 *     la PHOTO OFFICIELLE de la bouteille (bonne étiquette, fond détouré) plus
 *     le cépage, l'appellation, la couleur et la note des dégustateurs.
 *
 * Replis en cascade : pas de Vivino (spiritueux, réseau) → on garde la lecture
 * de l'IA ; pas de clé Groq → on garde le texte saisi. On ne renvoie jamais
 * d'erreur bloquante, toujours un vin exploitable.
 */
export const runtime = 'nodejs';
const GROQ_KEY = process.env.GROQ_API_KEY;
// Groq retire régulièrement ses modèles : ces deux-là sont surchargeables par
// env. `qwen3.6-27b` est le multimodal disponible côté gratuit ; on coupe son
// mode « réflexion » (reasoning_effort: none) pour n'obtenir que le JSON.
const GROQ_TEXT_MODEL = process.env.WINE_GROQ_MODEL || 'qwen/qwen3.6-27b';
const GROQ_VISION_MODEL = process.env.WINE_GROQ_VISION_MODEL || 'qwen/qwen3.6-27b';

type Wine = {
    name: string; grape: string; year: string;
    color: 'rouge' | 'blanc' | 'liqueur';
    region: string; note: string;
    photo?: string; rating?: number; vivinoUrl?: string;
};

const SYSTEM = `Tu es un sommelier. Renvoie les caractéristiques d'un vin STRICTEMENT en JSON :
{"readable":true,"name":"nom du domaine/cuvée","grape":"cépage principal","year":"millésime si visible sinon \\"\\"","color":"rouge|blanc|liqueur","region":"appellation, région, pays","note":"une phrase courte: arômes/style"}
- "readable" : false si tu ne LIS pas réellement un nom sur une étiquette de vin (photo floue, sujet quelconque, texte illisible). Dans ce cas ne devine RIEN, mets false et laisse les autres champs vides. N'invente jamais un domaine plausible.
- "color": "rouge", "blanc" ou "liqueur" (liquoreux/doux/porto/muscat). Rosé → "blanc".
- "name" : recopie le nom tel qu'il figure sur l'étiquette (domaine + cuvée), sans le mot "millésime" ni la contenance. C'est ce nom qui servira à retrouver la bouteille chez un marchand.
- Ne laisse aucun champ vide sauf éventuellement l'année. Estime au plus plausible d'après l'appellation.
Réponds UNIQUEMENT le JSON.`;

/** Quota Groq gratuit dépassé (8000 tokens/min) : à distinguer d'une vraie panne. */
class RateLimited extends Error {}

async function callGroq(body: Record<string, unknown>) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${GROQ_KEY}` },
        body: JSON.stringify({ temperature: 0.2, reasoning_effort: 'none', response_format: { type: 'json_object' }, ...body }),
    });
    if (res.status === 429) throw new RateLimited('Groq 429');
    if (!res.ok) throw new Error('Groq ' + res.status + ' ' + (await res.text()).slice(0, 200));
    const data = await res.json();
    return data?.choices?.[0]?.message?.content || '';
}

const callGroqText = (userMsg: string) => callGroq({
    model: GROQ_TEXT_MODEL, temperature: 0.3, max_tokens: 400,
    messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: userMsg }],
});

const callGroqVision = (imageDataUrl: string) => callGroq({
    model: GROQ_VISION_MODEL, max_tokens: 400,
    messages: [{
        role: 'user',
        content: [
            { type: 'text', text: `${SYSTEM}\n\nLis l'étiquette de ce vin et remplis le JSON.` },
            { type: 'image_url', image_url: { url: imageDataUrl } },
        ],
    }],
});

/** Isole l'objet JSON même si le modèle l'entoure de texte ou d'un bloc ```json. */
function extractJson(raw: string) {
    const clean = raw.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/```(?:json)?/g, '').trim();
    try { return JSON.parse(clean); } catch { /* on cherche le dernier objet */ }
    for (let start = clean.indexOf('{'); start !== -1; start = clean.indexOf('{', start + 1)) {
        for (let end = clean.lastIndexOf('}'); end > start; end = clean.lastIndexOf('}', end - 1)) {
            try { return JSON.parse(clean.slice(start, end + 1)); } catch { /* fenêtre suivante */ }
        }
    }
    throw new Error('JSON illisible');
}

/**
 * Face à une photo floue ou hors sujet, le modèle vision ne dit pas « je ne
 * sais pas » : il répond « Vin », « Wine », « Inconnu ». Ces noms-là ne sont
 * pas des bouteilles et ne doivent pas atterrir dans la cave.
 */
const VAGUE = /^(vin|vins|wine|vino|bouteille|bottle|inconnu|unknown|n\/?a|sans nom|-{0,3})$/i;

function toWine(raw: string, fallbackName: string): Wine {
    const parsed = extractJson(raw);
    if (parsed.readable === false && !fallbackName) throw new Error('pas une étiquette de vin');
    const name = String(parsed.name || fallbackName || '').trim();
    if (!name || VAGUE.test(name)) throw new Error('étiquette illisible');
    const color = ['rouge', 'blanc', 'liqueur'].includes(parsed.color) ? parsed.color : 'rouge';
    return {
        name,
        grape: parsed.grape || '',
        year: String(parsed.year || ''),
        color,
        region: parsed.region || '',
        note: parsed.note || '',
    };
}

/**
 * Fusion lecture d'étiquette + fiche Vivino. Vivino fait foi sur tout ce qui est
 * vérifiable (photo, cépage, appellation, couleur, millésime) ; la phrase de
 * dégustation de l'IA est gardée si Vivino n'en fournit pas.
 */
function merge(read: Wine | null, v: VivinoWine): Wine {
    return {
        name: v.name,
        grape: v.grape || read?.grape || '',
        year: v.year || read?.year || '',
        color: v.color,
        region: v.region || read?.region || '',
        note: read?.note || v.note || '',
        photo: v.photo,
        rating: v.rating || undefined,
        vivinoUrl: v.url,
    };
}

/** Requête marchand : nom lu sur l'étiquette + millésime s'il n'y figure pas déjà. */
function query(w: Wine) {
    const name = w.name.trim();
    return w.year && !name.includes(w.year) ? `${name} ${w.year}` : name;
}

/**
 * Cherche la bouteille, et retente avec l'appellation si la première passe ne
 * tombe pas sur le bon domaine : « Bocas Lágrima » seul ne suffit pas, « Bocas
 * Lágrima Porto Portugal » retrouve le producteur.
 */
async function locate(read: Wine) {
    const first = await findOnVivino(query(read), read.year);
    if (first?.confident || !read.region) return first;
    const second = await findOnVivino(`${read.name} ${read.region}`.trim(), read.year);
    return second?.confident ? second : first;
}

export async function POST(request: Request) {
    let label = ''; let image = '';
    try { const b = await request.json(); label = String(b?.label || '').trim(); image = String(b?.image || ''); } catch { /* noop */ }
    if (!label && !image) return NextResponse.json({ error: 'label ou image requis' }, { status: 400 });

    // ── 1. Lire l'étiquette (photo → vision, sinon le texte saisi). ──────────
    let read: Wine | null = null;
    let quota = false;
    if (GROQ_KEY && image.startsWith('data:image')) {
        try { read = toWine(await callGroqVision(image), label); }
        catch (e) { quota = e instanceof RateLimited; }
    }
    if (!read && GROQ_KEY && label) {
        try { read = toWine(await callGroqText(label), label); }
        catch (e) { quota = quota || e instanceof RateLimited; }
    }
    if (!read && label) {
        read = { name: label, grape: '', year: '', color: 'rouge', region: '', note: '' };
    }

    // ── 2. Retrouver la bouteille chez Vivino (photo officielle + fiche). ────
    // On ne se sert de la fiche que si le DOMAINE correspond : un résultat de la
    // bonne appellation mais du mauvais producteur collerait une étiquette qui
    // n'est pas la sienne. Dans le doute, la photo prise par l'utilisateur gagne.
    if (read) {
        const found = await locate(read);
        if (found?.confident) return NextResponse.json({ wine: merge(read, found), source: 'vivino' });
        return NextResponse.json({ wine: read, source: image ? 'vision' : 'text', quota });
    }

    // Rien n'a pu être lu : on renvoie un nom VIDE, sinon le client ajouterait
    // en cave une bouteille fantôme appelée « Vin ».
    return NextResponse.json({
        wine: { name: '', grape: '', year: '', color: 'rouge', region: '', note: '' },
        source: 'fallback',
        quota,
    });
}
