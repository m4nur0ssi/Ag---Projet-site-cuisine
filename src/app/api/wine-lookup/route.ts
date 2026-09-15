import { NextResponse } from 'next/server';
import { findOnVivino } from '@/lib/vivino';
import { findOnViniou } from '@/lib/viniou';
import type { BouteilleTrouvee } from '@/lib/texte-vin';

/**
 * « Ma cave » — reconnaissance d'un vin, en deux temps.
 *
 *  1. LIRE L'ÉTIQUETTE : la photo part dans un modèle VISION (Groq multimodal)
 *     qui en extrait le nom du vin et le millésime.
 *  2. RETROUVER LA BOUTEILLE : ce nom est cherché chez DEUX marchands, en
 *     parallèle, parce qu'aucun des deux ne suffit :
 *       • VIVINO connaît le vin qui s'exporte et donne la note des
 *         dégustateurs — mais ignore le petit domaine français ;
 *       • VINIOU tient le catalogue français au détail (appellation par
 *         appellation, une fiche par millésime) et rend la photo de la
 *         bouteille là où Vivino ne répond rien.
 *     On garde celle des deux qui reconnaît vraiment l'étiquette ; à égalité,
 *     Vivino passe devant puisqu'il apporte en plus la note.
 *
 * Replis en cascade : aucun marchand ne reconnaît (spiritueux, réseau) → on
 * garde la lecture de l'IA ; pas de clé Groq → on garde le texte saisi. On ne
 * renvoie jamais d'erreur bloquante, toujours un vin exploitable.
 */
export const runtime = 'nodejs';
const GROQ_KEY = process.env.GROQ_API_KEY;
/**
 * Groq RETIRE ses modèles sans préavis, et la cave en meurt en silence :
 * `qwen/qwen3.6-27b` a disparu du catalogue, l'appel répondait 404
 * « model_not_found », la lecture d'étiquette échouait, et l'écran annonçait
 * « étiquette illisible » pour TOUTES les bouteilles — y compris les plus
 * lisibles du monde.
 *
 * On ne mise donc plus sur un seul nom : on essaie une LISTE, du meilleur au
 * plus vieux, et on s'arrête au premier qui répond. Le jour où le premier
 * disparaît à son tour, le suivant prend le relais sans qu'on touche à rien.
 * La variable d'environnement, quand elle est posée, passe devant tout.
 */
const modeles = (env: string | undefined, defauts: string[]) =>
    [...(env ? [env] : []), ...defauts].filter((m, i, a) => a.indexOf(m) === i);

const GROQ_TEXT_MODELS = modeles(process.env.WINE_GROQ_MODEL, [
    'qwen/qwen3.8-27b', 'openai/gpt-oss-20b', 'openai/gpt-oss-120b',
]);
/** Seuls les modèles MULTIMODAUX lisent une photo — les autres refusent en 400. */
const GROQ_VISION_MODELS = modeles(process.env.WINE_GROQ_VISION_MODEL, [
    'qwen/qwen3.8-27b', 'qwen/qwen3.6-27b', 'meta-llama/llama-4-scout-17b-16e-instruct',
]);

type Wine = {
    name: string; grape: string; year: string;
    color: 'rouge' | 'blanc' | 'rose' | 'liqueur';
    region: string; note: string;
    photo?: string; rating?: number; vivinoUrl?: string;
};

const SYSTEM = `Tu es un sommelier. Renvoie les caractéristiques d'un vin STRICTEMENT en JSON :
{"readable":true,"name":"nom du domaine/cuvée","grape":"cépage principal","year":"millésime si visible sinon \\"\\"","color":"rouge|blanc|rose|liqueur","region":"appellation, région, pays","note":"une phrase courte: arômes/style"}
- "readable" : false si tu ne LIS pas réellement un nom sur une étiquette de vin (photo floue, sujet quelconque, texte illisible). Dans ce cas ne devine RIEN, mets false et laisse les autres champs vides. N'invente jamais un domaine plausible.
- "color": "rouge", "blanc", "rose" ou "liqueur" (liquoreux/doux/porto/muscat).
- "year" : recopie le millésime IMPRIMÉ sur cette étiquette-ci, jamais celui d'une autre bouteille du même domaine. Vide si aucun chiffre d'année n'est lisible.
- "name" : recopie le nom tel qu'il figure sur l'étiquette (domaine + cuvée), sans le mot "millésime" ni la contenance. C'est ce nom qui servira à retrouver la bouteille chez un marchand.
- Ne laisse aucun champ vide sauf éventuellement l'année. Estime au plus plausible d'après l'appellation.
Réponds UNIQUEMENT le JSON.`;

/** Quota Groq gratuit dépassé (8000 tokens/min) : à distinguer d'une vraie panne. */
class RateLimited extends Error {}
/** Ce modèle-là n'existe plus (ou ne sait pas lire une image) : essayer le suivant. */
class ModeleAbsent extends Error {}

async function callGroq(body: Record<string, unknown>) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${GROQ_KEY}` },
        body: JSON.stringify({ temperature: 0.2, reasoning_effort: 'none', response_format: { type: 'json_object' }, ...body }),
    });
    if (res.status === 429) throw new RateLimited('Groq 429');
    if (!res.ok) {
        const detail = (await res.text()).slice(0, 300);
        // 404 = modèle retiré ; 400 « must be a string » = modèle non multimodal.
        if (res.status === 404 || /model_not_found|decommissioned|must be a string/i.test(detail)) {
            throw new ModeleAbsent(detail);
        }
        throw new Error('Groq ' + res.status + ' ' + detail);
    }
    const data = await res.json();
    return data?.choices?.[0]?.message?.content || '';
}

/** Essaie chaque modèle jusqu'à ce que l'un réponde. */
async function callGroqAvecReplis(noms: string[], corps: (model: string) => Record<string, unknown>) {
    let derniere: unknown = new Error('aucun modèle');
    for (const model of noms) {
        try { return await callGroq(corps(model)); }
        catch (e) {
            // Un quota atteint n'est pas un modèle mort : inutile de brûler les
            // suivants, ils partagent le même compteur.
            if (e instanceof RateLimited) throw e;
            derniere = e;
            if (!(e instanceof ModeleAbsent)) throw e;
        }
    }
    throw derniere;
}

const callGroqText = (userMsg: string) => callGroqAvecReplis(GROQ_TEXT_MODELS, (model) => ({
    model, temperature: 0.3, max_tokens: 400,
    messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: userMsg }],
}));

const callGroqVision = (imageDataUrl: string) => callGroqAvecReplis(GROQ_VISION_MODELS, (model) => ({
    model, max_tokens: 400,
    messages: [{
        role: 'user',
        content: [
            { type: 'text', text: `${SYSTEM}\n\nLis l'étiquette de ce vin et remplis le JSON.` },
            { type: 'image_url', image_url: { url: imageDataUrl } },
        ],
    }],
}));

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
    const color = ['rouge', 'blanc', 'rose', 'liqueur'].includes(parsed.color) ? parsed.color : 'rouge';
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
function merge(read: Wine | null, v: BouteilleTrouvee): Wine {
    // Le millésime vient de L'ÉTIQUETTE, pas de la fiche : le marchand liste le
    // même vin en vingt années et prévient lui-même que « le millésime sur la
    // photo peut ne pas correspondre ». La bouteille en main fait foi.
    const year = read?.year || v.year || '';
    // Du coup le nom ne doit pas traîner l'année d'une AUTRE fiche, sinon on
    // affiche « … 'Charmes' 2010 · 2022 ».
    const name = v.name.replace(/\s*\b(19|20)\d{2}\b\s*$/, '').trim() || v.name;
    return {
        name,
        grape: v.grape || read?.grape || '',
        year,
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
 * Cherche la bouteille par le nom, et aussi avec l'appellation : « Bocas
 * Lágrima » seul ne suffit pas, « Bocas Lágrima Porto Portugal » retrouve le
 * producteur. Chez Vivino ET chez Viniou.
 *
 * Toutes les requêtes partent ENSEMBLE. En série, chacune n'était lancée
 * qu'après l'échec de la précédente : le scan durait plusieurs allers-retours
 * dès que le nom seul ne suffisait pas, et c'est justement le cas fréquent. Une
 * requête de plus chez un marchand coûte moins cher que deux secondes d'attente
 * devant une bouteille à la main.
 *
 * L'ordre du résultat dit la préférence : d'abord ce qui est SÛR, et à égalité
 * Vivino d'abord (il apporte la note des dégustateurs), Viniou ensuite (il
 * apporte la bouteille que Vivino n'a pas).
 */
async function locate(read: Wine): Promise<BouteilleTrouvee | null> {
    const avecRegion = `${read.name} ${read.region}`.trim();
    const pistes = await Promise.all([
        findOnVivino(query(read), read.year),
        read.region ? findOnVivino(avecRegion, read.year) : Promise.resolve(null),
        // Viniou se parcourt par arborescence : il lui faut l'appellation lue
        // pour savoir par quelle région entrer.
        findOnViniou(read.name, read.year, read.region),
    ]);
    const trouvees = pistes.filter(Boolean) as BouteilleTrouvee[];
    if (!trouvees.length) return null;
    const rang = (b: BouteilleTrouvee) =>
        (b.confident ? 0 : 10) + (b.source === 'vivino' ? 0 : 1) + (b.photo ? 0 : 4);
    return trouvees.sort((a, b) => rang(a) - rang(b))[0];
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
        if (found?.confident) return NextResponse.json({ wine: merge(read, found), source: found.source });
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
