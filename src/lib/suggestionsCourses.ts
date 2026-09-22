/**
 * Suggestions à la saisie de la liste de courses.
 * ===============================================
 *
 * Deux ou trois lettres suffisent : « cr » → crème fraîche, crème liquide,
 * crevettes… Sources, dans l'ordre de priorité :
 *   1. ce que l'utilisateur a déjà ajouté à la main (ses habitudes) ;
 *   2. les ingrédients du catalogue, du plus courant au plus rare (généré) ;
 *   3. le reste d'un caddie ordinaire, que les recettes ne citent jamais :
 *      pain, café, papier toilette, lessive…
 *
 * La recherche ignore accents et majuscules, et reconnaît un début de mot
 * n'importe où : « fra » trouve « crème fraîche » comme « fraises ».
 */
import { INGREDIENTS_CATALOGUE } from './ingredient-suggestions';

const CADDIE_ORDINAIRE = [
    'crème fraîche', 'crème fraîche épaisse', 'crème liquide', 'lait demi-écrémé', 'beurre doux', 'beurre demi-sel',
    'yaourts nature', 'yaourts aux fruits', 'fromage râpé', 'emmental râpé', 'comté', 'camembert', 'jambon blanc',
    'lardons', 'saucisses', 'steaks hachés', 'poulet', 'saumon', 'thon en boîte', 'œufs',
    'pain', 'baguette', 'pain de mie', 'brioche', 'céréales', 'biscuits', 'confiture', 'pâte à tartiner', 'chocolat',
    'café', 'thé', 'jus d\'orange', 'eau minérale', 'eau gazeuse', 'soda', 'bière', 'vin rouge', 'vin blanc',
    'riz', 'pâtes', 'semoule', 'lentilles', 'pois chiches', 'farine', 'sucre', 'huile de tournesol', 'huile d\'olive',
    'vinaigre', 'moutarde', 'ketchup', 'mayonnaise', 'sauce tomate', 'tomates pelées', 'bouillon cube',
    'pommes', 'bananes', 'oranges', 'citrons', 'clémentines', 'raisin', 'fraises', 'salade', 'tomates', 'carottes',
    'pommes de terre', 'oignons', 'courgettes', 'concombre', 'avocats', 'champignons', 'poivrons', 'brocolis',
    'surgelés', 'frites surgelées', 'glace', 'pizza surgelée', 'légumes surgelés',
    'papier toilette', 'essuie-tout', 'mouchoirs', 'liquide vaisselle', 'pastilles lave-vaisselle', 'éponges',
    'lessive', 'adoucissant', 'sacs poubelle', 'nettoyant multi-usage', 'javel', 'papier aluminium', 'film alimentaire',
    'dentifrice', 'brosse à dents', 'shampoing', 'gel douche', 'savon', 'déodorant', 'coton', 'rasoirs',
    'couches', 'lingettes', 'croquettes', 'litière',
];

/** Minuscules sans accents, apostrophes unifiées. */
const plat = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/[’`]/g, "'").trim();

const DEJA_AJOUTES_KEY = 'courses-ajouts-historique';

/** Ce que l'utilisateur a déjà tapé à la main, le plus récent d'abord. */
export function lireHistorique(): string[] {
    try { return JSON.parse(localStorage.getItem(DEJA_AJOUTES_KEY) || '[]'); } catch { return []; }
}

/** Mémorise un ajout manuel pour le proposer en premier la fois suivante. */
export function memoriserAjout(nom: string): void {
    const n = nom.trim().toLowerCase();
    if (n.length < 2) return;
    try {
        const h = [n, ...lireHistorique().filter((x) => x !== n)].slice(0, 60);
        localStorage.setItem(DEJA_AJOUTES_KEY, JSON.stringify(h));
    } catch { /* stockage refusé : on s'en passe */ }
}

/**
 * Propositions pour `saisie`. Rien avant 2 lettres. Classement :
 * le nom COMMENCE par la saisie > un mot du nom commence par la saisie ;
 * à égalité, l'ordre des sources (historique, catalogue, caddie).
 */
export function suggerer(saisie: string, limite = 6): string[] {
    const q = plat(saisie);
    if (q.length < 2) return [];
    const vus = new Set<string>();
    const debut: string[] = [];
    const milieu: string[] = [];
    for (const nom of [...lireHistorique(), ...INGREDIENTS_CATALOGUE, ...CADDIE_ORDINAIRE]) {
        const p = plat(nom);
        if (vus.has(p) || p === q) { vus.add(p); continue; }
        vus.add(p);
        if (p.startsWith(q)) debut.push(nom);
        else if (p.split(/[\s'\-]+/).some((mot) => mot.startsWith(q))) milieu.push(nom);
        if (debut.length >= limite) break;
    }
    // Ordre de fréquence conservé, sauf qu'un nom passe toujours avant ses
    // variantes : « crème fraîche » avant « crème fraîche épaisse ».
    const liste = [...debut, ...milieu].slice(0, limite);
    for (let i = 0; i < liste.length; i++) {
        const j = liste.findIndex((x, k) => k < i && plat(x).startsWith(plat(liste[i]) + ' '));
        if (j >= 0) liste.splice(j, 0, liste.splice(i, 1)[0]);
    }
    return liste;
}
