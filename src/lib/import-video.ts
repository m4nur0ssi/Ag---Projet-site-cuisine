/**
 * Lire une vidéo, en tirer une recette.
 * =====================================
 *
 * Le bot de la maison sait déjà faire ça depuis des mois
 * (`tiktok-bot/recipe-processor.js`) : on en reprend ici la mécanique qui a
 * fait ses preuves, réduite à ce dont le site a besoin — pas de WordPress, pas
 * de file d'attente, pas de publication. On lit la page, on écoute la voix, on
 * demande au modèle de mettre tout ça en forme, et c'est fini.
 *
 * Deux choses valent d'être sues avant de toucher à ce fichier :
 *
 *   • TikTok publie SA PROPRE transcription de la voix dans la page
 *     (`subtitleInfos`, piste « ASR »). C'est elle qui donne les vraies étapes
 *     — la légende, elle, ne contient presque jamais la recette ;
 *   • aucun cookie n'est nécessaire (mesuré : page de 420 ko, transcription
 *     comprise, sans session). On accepte quand même TIKTOK_SESSION_ID s'il
 *     traîne dans l'environnement, mais on ne compte pas dessus.
 */

const NAVIGATEUR = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

export interface VideoLue {
    videoId: string;
    url: string;
    /** La légende, telle que l'auteur l'a écrite. */
    description: string;
    auteur: string;
    vignette?: string;
    /** La voix de la vidéo, transcrite par TikTok. C'est la matière première. */
    transcription?: string;
}

export interface RecetteImportee {
    title: string;
    description: string;
    category: string;
    difficulty: string;
    prepTime: number;
    cookTime: number;
    servings: number;
    ingredients: { quantity: string; name: string }[];
    steps: string[];
    tags: string[];
}

/** Le tableau JSON qui suit `"<clé>":[` dans la page, crochets comptés à la main. */
function tableauJson(page: string, cle: string): any[] | null {
    const i = page.indexOf(`"${cle}":[`);
    if (i < 0) return null;
    const debut = page.indexOf('[', i);
    let profondeur = 0;
    let echappe = false;
    let chaine = false;
    for (let j = debut; j < page.length; j++) {
        const c = page[j];
        if (echappe) { echappe = false; continue; }
        if (c === '\\') { echappe = true; continue; }
        if (c === '"') { chaine = !chaine; continue; }
        if (chaine) continue;
        if (c === '[') profondeur++;
        else if (c === ']' && --profondeur === 0) {
            try { return JSON.parse(page.slice(debut, j + 1)); } catch { return null; }
        }
    }
    return null;
}

/** Le WebVTT débarrassé de ses horodatages : un texte suivi. */
function vttEnTexte(vtt: string): string {
    return vtt.split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && l !== 'WEBVTT' && !l.includes('-->') && !/^\d+$/.test(l))
        .join(' ');
}

/** La transcription de la vidéo, la voix française d'abord. */
async function transcriptionDepuisPage(html: string): Promise<string | undefined> {
    const pistes = tableauJson(html, 'subtitleInfos') || [];
    const rang = (p: any) => {
        const fr = String(p.LanguageCodeName || '').startsWith('fr');
        const voix = p.Source === 'ASR';
        return fr && voix ? 0 : fr ? 1 : voix ? 2 : 3;
    };
    for (const piste of pistes.slice().sort((a, b) => rang(a) - rang(b))) {
        if (!piste?.Url) continue;
        try {
            const r = await fetch(piste.Url, {
                headers: { 'User-Agent': NAVIGATEUR, Referer: 'https://www.tiktok.com/' },
            });
            if (!r.ok) continue;
            const texte = vttEnTexte(await r.text());
            if (texte.length > 40) return texte;
        } catch { /* piste suivante */ }
    }
    return undefined;
}

/** Les liens partagés depuis l'application sont courts : on les déplie. */
async function deplierLien(lien: string): Promise<string> {
    if (!/vm\.tiktok\.com|vt\.tiktok\.com/.test(lien)) return lien;
    try {
        const res = await fetch(lien, { redirect: 'follow', headers: { 'User-Agent': NAVIGATEUR } });
        return res.url || lien;
    } catch {
        return lien;
    }
}

/**
 * Un lien tel qu'on le colle. Sans « https:// » le plus souvent : c'est ce que
 * rend un copier-coller depuis la barre d'adresse d'un téléphone, et refuser
 * ça pour un motif de protocole n'aiderait personne.
 */
export function normaliserLien(lien: string): string {
    const propre = lien.trim().replace(/^[«"'\s]+|[»"'\s]+$/g, '');
    return /^https?:\/\//i.test(propre) ? propre : `https://${propre}`;
}

/** Le lien collé est-il exploitable ? Rend l'identifiant de la vidéo. */
export function identifiantVideo(url: string): string | null {
    return url.match(/\/video\/(\d+)/)?.[1] || url.match(/\/v\/(\d+)/)?.[1] || null;
}

export function estLienTikTok(lien: string): boolean {
    try {
        const h = new URL(normaliserLien(lien)).hostname.replace(/^www\./, '');
        return h === 'tiktok.com' || h.endsWith('.tiktok.com');
    } catch {
        return false;
    }
}

/**
 * Lit la page de la vidéo. Deux chemins, du plus riche au plus maigre :
 * les données de réhydratation (légende + auteur exacts), puis l'oEmbed
 * public — qui, lui, répond toujours, même depuis un centre de données.
 */
export async function lireVideo(lien: string): Promise<VideoLue> {
    const url = await deplierLien(normaliserLien(lien));
    const cookie = [
        process.env.TIKTOK_SESSION_ID ? `sessionid=${process.env.TIKTOK_SESSION_ID}` : '',
        process.env.TIKTOK_WEBID ? `ttwid=${process.env.TIKTOK_WEBID}` : '',
    ].filter(Boolean).join('; ');

    let html = '';
    let finale = url;
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': NAVIGATEUR,
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'fr-FR,fr;q=0.9',
                ...(cookie ? { Cookie: cookie } : {}),
            },
            redirect: 'follow',
        });
        html = await res.text();
        finale = res.url || url;
    } catch { /* la page nous est refusée : l'oEmbed prendra le relais */ }

    const videoId = identifiantVideo(finale) || identifiantVideo(url);
    if (!videoId) throw new Error("Ce lien ne mène pas à une vidéo TikTok que je sache lire.");

    const transcription = html ? await transcriptionDepuisPage(html) : undefined;

    const brut = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application\/json">([\s\S]*?)<\/script>/);
    if (brut) {
        try {
            const scope = JSON.parse(brut[1])?.__DEFAULT_SCOPE__ || {};
            const item = scope['webapp.video-detail']?.itemInfo?.itemStruct
                || scope['webapp.reflow.video.detail']?.itemInfo?.itemStruct;
            if (item?.desc) {
                const pseudo = item.author?.uniqueId;
                return {
                    videoId,
                    // L'adresse canonique, avec le vrai pseudo : le lien collé
                    // porte souvent « @a » (l'astuce de l'oEmbed) ou un lien
                    // court, et c'est ce lien-là qu'on montrera sous la fiche.
                    url: pseudo ? `https://www.tiktok.com/@${pseudo}/video/${videoId}` : finale,
                    description: item.desc,
                    auteur: item.author?.uniqueId || item.author?.nickname || '',
                    vignette: item.video?.cover || item.video?.dynamicCover,
                    transcription,
                };
            }
        } catch { /* on tente l'oEmbed */ }
    }

    // Repli : l'oEmbed public. Il ne donne ni la voix ni les étapes, mais il
    // donne toujours le titre et l'auteur — de quoi ne pas rentrer bredouille.
    const o = await fetch(`https://www.tiktok.com/oembed?url=https://www.tiktok.com/@a/video/${videoId}`);
    if (!o.ok) throw new Error("TikTok n'a pas voulu me montrer cette vidéo.");
    const info = await o.json();
    return {
        videoId,
        url: info?.author_url ? `${info.author_url}/video/${videoId}` : finale,
        description: info?.title || '',
        auteur: info?.author_name || '',
        vignette: info?.thumbnail_url,
        transcription,
    };
}

// ── Mise en forme par le modèle ────────────────────────────────────────────

const CONSIGNE = `Tu transformes une vidéo de cuisine en fiche recette pour un site français.

On te donne la légende de la vidéo et, quand elle existe, la TRANSCRIPTION DE LA VOIX. La voix est la source la plus fiable : les quantités et les gestes s'y trouvent. La légende sert surtout au titre et à l'ambiance.

Règles :
- Écris en français, sans emoji, sans hashtag, sans « dans cette vidéo » ni mention de TikTok.
- La vidéo peut être dans une autre langue : TRADUIS tout en français, le titre compris ("Crunchy Gnocchi Salat" devient "Salade de gnocchis croustillants"). Garde tel quel le nom propre d'un plat quand il n'a pas d'équivalent (tiramisu, tacos, parmigiana).
- Un titre court et appétissant (moins de 60 caractères), sans point final.
- "quantity" ne contient QUE la quantité : un nombre et son unité ("2", "200 g", "1 c. à s."). Jamais le nom de l'ingrédient, jamais un adjectif. Si la vidéo ne la donne pas, laisse la chaîne vide — n'invente rien.
- "name" ne contient QUE l'ingrédient, au singulier quand c'est naturel ("filet de poulet", "moutarde à l'ancienne").
- Les étapes sont des phrases d'action, à l'impératif, une par geste réel. Entre 3 et 12.
- category : exactement l'une de "aperitifs","entrees","plats","accompagnements","desserts","patisserie","glaces".
- difficulty : "facile", "moyen" ou "difficile". prepTime et cookTime en MINUTES, servings en nombre de personnes.
- tags : 2 à 5 mots simples (pays, régime, moment), sans dièse.
- Si ce n'est manifestement PAS une recette de cuisine, réponds {"recette":null}.

Schéma JSON exact :
{"recette":{"title":string,"description":string,"category":string,"difficulty":string,"prepTime":number,"cookTime":number,"servings":number,"ingredients":[{"quantity":string,"name":string}],"steps":[string],"tags":[string]}}`;

async function viaGroq(message: string): Promise<string> {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.GROQ_API_KEY}` },
        body: JSON.stringify({
            model: process.env.IMPORT_GROQ_MODEL || 'openai/gpt-oss-20b',
            temperature: 0.4,
            max_tokens: 2000,
            // Sans cette consigne, gpt-oss « réfléchit » dans le vide et rend une
            // réponse vide en ayant consommé tout le budget de sortie.
            reasoning_effort: 'low',
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: CONSIGNE },
                { role: 'user', content: message },
            ],
        }),
    });
    if (!res.ok) throw new Error(`Groq ${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}`);
    return (await res.json())?.choices?.[0]?.message?.content || '';
}

async function viaGemini(message: string): Promise<string> {
    const modele = process.env.IMPORT_GEMINI_MODEL || 'gemini-2.5-flash';
    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modele}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: CONSIGNE }] },
                contents: [{ role: 'user', parts: [{ text: message }] }],
                generationConfig: { responseMimeType: 'application/json', temperature: 0.4, maxOutputTokens: 2000 },
            }),
        },
    );
    if (!res.ok) throw new Error(`Gemini ${res.status}`);
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).join('') || '';
}

/** Le JSON du modèle, même emballé dans du texte ou une clôture markdown. */
function lireJson(brut: string): any {
    if (!brut) return null;
    try { return JSON.parse(brut); } catch { /* il a bavardé autour */ }
    const debut = brut.indexOf('{');
    const fin = brut.lastIndexOf('}');
    if (debut < 0 || fin <= debut) return null;
    try { return JSON.parse(brut.slice(debut, fin + 1)); } catch { return null; }
}

const CATEGORIES = ['aperitifs', 'entrees', 'plats', 'accompagnements', 'desserts', 'patisserie', 'glaces'];

/** Ce que le modèle rend n'est pas une recette tant qu'on ne l'a pas vérifié. */
function nettoyer(brut: any): RecetteImportee | null {
    const r = brut?.recette;
    if (!r || typeof r !== 'object') return null;
    const titre = String(r.title || '').trim();
    const etapes = Array.isArray(r.steps) ? r.steps.map((s: any) => String(s || '').trim()).filter(Boolean) : [];
    const ingredients = Array.isArray(r.ingredients)
        ? r.ingredients
            .map((i: any) => ({ quantity: String(i?.quantity ?? '').trim(), name: String(i?.name ?? '').trim() }))
            .filter((i: { name: string }) => i.name)
        : [];
    // Une fiche sans titre, sans gestes ou sans ingrédients n'est pas une recette :
    // mieux vaut le dire que de ranger une coquille vide dans la bibliothèque.
    if (!titre || etapes.length < 2 || ingredients.length < 2) return null;

    const entier = (v: any, defaut: number, max: number) => {
        const n = Math.round(Number(v));
        return Number.isFinite(n) && n > 0 && n <= max ? n : defaut;
    };
    return {
        title: titre.slice(0, 120),
        description: String(r.description || '').trim().slice(0, 600),
        category: CATEGORIES.includes(String(r.category)) ? String(r.category) : 'plats',
        difficulty: ['facile', 'moyen', 'difficile'].includes(String(r.difficulty)) ? String(r.difficulty) : 'moyen',
        prepTime: entier(r.prepTime, 15, 600),
        cookTime: entier(r.cookTime, 0, 600),
        servings: entier(r.servings, 4, 20),
        ingredients: ingredients.slice(0, 40),
        steps: etapes.slice(0, 20),
        tags: (Array.isArray(r.tags) ? r.tags : []).map((t: any) => String(t).replace(/^#/, '').trim()).filter(Boolean).slice(0, 5),
    };
}

/**
 * De la vidéo lue à la fiche. Groq d'abord (gratuit), Gemini en repli — un
 * quota épuisé ne doit pas être le mot de la fin pour celui qui attend.
 */
export async function structurerRecette(video: VideoLue): Promise<RecetteImportee | null> {
    const message = JSON.stringify({
        legende: video.description || '(vide)',
        voix: video.transcription || '(pas de transcription disponible)',
        auteur: video.auteur || '(inconnu)',
    });

    const erreurs: string[] = [];
    for (const fournisseur of [
        { nom: 'Groq', actif: !!process.env.GROQ_API_KEY, appel: viaGroq },
        { nom: 'Gemini', actif: !!process.env.GEMINI_API_KEY, appel: viaGemini },
    ]) {
        if (!fournisseur.actif) continue;
        try {
            const recette = nettoyer(lireJson(await fournisseur.appel(message)));
            if (recette) return recette;
            erreurs.push(`${fournisseur.nom} : réponse inexploitable`);
        } catch (e: any) {
            erreurs.push(`${fournisseur.nom} : ${e.message}`);
        }
    }
    if (erreurs.length) console.error('[import-video]', erreurs.join(' | '));
    return null;
}
