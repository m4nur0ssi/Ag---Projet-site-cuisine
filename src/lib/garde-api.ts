/**
 * Les gardes des routes du serveur.
 * =================================
 *
 * Une API n'est pas protégée parce que seul le site l'utilise : le navigateur
 * respecte les règles d'origine, `curl` ne les connaît pas. Les routes qui font
 * travailler un modèle (recherche IA, accord vin, composition de menu) ou qui
 * écrivent en base étaient donc ouvertes à tout venant — et le quota Groq est
 * journalier ET partagé : quand un tiers le vide, ce ne sont pas ses visiteurs
 * qui reçoivent le refus, ce sont les nôtres.
 *
 * Trois gardes, du moins cher au plus utile :
 *
 *   • `memeOrigine` — l'appel vient-il d'une page du site ? Un `curl` peut
 *     mentir, mais ça écarte les robots paresseux et les sites tiers qui
 *     voudraient se brancher sur notre IA gratuitement ;
 *   • `tropGros` — plafonne ce qu'une seule requête peut coûter. C'est
 *     l'appelant qui fournit le catalogue envoyé au modèle : sans plafond, il
 *     décide de la facture ;
 *   • `trop` — un compteur glissant par adresse.
 *
 * Honnêteté sur la portée du compteur : il vit dans la MÉMOIRE de l'instance.
 * Sans serveur, plusieurs instances peuvent tourner en parallèle, donc la
 * limite réelle est un multiple de celle qu'on écrit ici. C'est une digue, pas
 * un coffre-fort — la vraie limite par personne demanderait un stockage
 * partagé (Vercel KV). Elle suffit à empêcher qu'une boucle vide la journée.
 */

/** Hôtes d'où les pages du site sont servies. */
const MAISON = [
    'lesrecettesmagiques.fr',
    'www.lesrecettesmagiques.fr',
];

/** L'appel vient-il d'une page à nous ? */
export function memeOrigine(request: Request): boolean {
    const brut = request.headers.get('origin') || request.headers.get('referer') || '';
    if (!brut) return false;
    let hote: string;
    try { hote = new URL(brut).hostname; } catch { return false; }
    if (MAISON.includes(hote)) return true;
    // Les préversions Vercel et le développement local sont chez nous aussi.
    return hote.endsWith('.vercel.app') || hote === 'localhost' || hote === '127.0.0.1'
        || /^192\.168\./.test(hote) || /^10\./.test(hote);
}

/** L'adresse de l'appelant, telle que Vercel la transmet. */
export function ipDe(request: Request): string {
    const suite = request.headers.get('x-forwarded-for') || '';
    return suite.split(',')[0].trim() || request.headers.get('x-real-ip') || 'inconnue';
}

const compteurs = new Map<string, number[]>();

/**
 * Vrai quand `cle` a déjà dépassé `max` appels dans la fenêtre donnée.
 * Le passage est compté au moment de la question.
 */
export function trop(cle: string, max: number, fenetreMs: number): boolean {
    const maintenant = Date.now();
    const passages = (compteurs.get(cle) || []).filter((t) => maintenant - t < fenetreMs);
    passages.push(maintenant);
    compteurs.set(cle, passages);
    // Ménage : sans ça, la mémoire de l'instance garde toutes les adresses
    // croisées depuis son démarrage.
    if (compteurs.size > 5000) {
        for (const [k, v] of compteurs) {
            if (!v.length || maintenant - v[v.length - 1] > fenetreMs) compteurs.delete(k);
        }
    }
    return passages.length > max;
}

/**
 * Lit le corps de la requête en refusant ce qui est trop gros pour être
 * honnête. Rend `null` quand le corps dépasse la taille annoncée — le
 * catalogue compact du site pèse une centaine de kilo-octets, on laisse
 * largement de quoi grandir.
 */
export async function corpsJson<T>(request: Request, maxOctets = 600_000): Promise<T | null> {
    const annonce = Number(request.headers.get('content-length') || 0);
    if (annonce > maxOctets) return null;
    const texte = await request.text();
    if (texte.length > maxOctets) return null;
    try { return JSON.parse(texte) as T; } catch { return null; }
}
