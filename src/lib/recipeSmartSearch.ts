// Recherche locale "intelligente" — secours de l'Assistant IA quand le LLM
// n'est pas dispo. Comprend le TYPE de plat (gâteau→dessert, apéritif→apéritif…),
// le PAYS et le RÉGIME, pénalise fortement la mauvaise catégorie, classe par
// pertinence. Les motifs matchent des RADICAUX (préfixes) pour tolérer les
// formes fléchies : "apéritif/apéritive/apéritifs", "italien/italienne"…
// Utilisé côté mobile ET desktop (import partagé).

export const normalizeFr = (s: string) =>
    (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const STOP = new Set([
    'recette', 'recettes', 'idee', 'idees', 'envie', 'truc',
    'de', 'du', 'des', 'le', 'la', 'les', 'un', 'une', 'avec', 'pour', 'et',
    'en', 'au', 'aux', 'ne', 'pas', 'sans', 'mon', 'ma', 'mes', 'qui', 'a', 'à',
    'je', 'veux', 'voudrais', 'cherche', 'chercher', 'donne', 'donner', 'moi',
    'the', 'me', 'fait', 'faire', 'quelque', 'chose', 'sur', 'dans', 'ou', 'est',
]);

// Type de plat → catégories cibles + tags cibles. Radicaux (préfixes).
const TYPE_LEX: { cats: string[]; tags: string[]; rx: RegExp }[] = [
    { cats: ['sauces'], tags: ['sauces'], rx: /\b(sauce|condiment|marinade|vinaigrette|pesto|mayonnaise|aioli|tapenade|chutney|coulis|\bdip\b|guacamole|houmous|hummus|tzatziki|bearnaise|hollandaise|bechamel|chimichurri)/ },
    { cats: ['glaces'], tags: ['glaces'], rx: /\b(glace|sorbet|gelato|granita)/ },
    { cats: ['rafraichissements'], tags: ['boissons'], rx: /\b(boisson|cocktail|smoothie|limonade|citronnade|milkshake|mojito|mocktail)|\bjus\b/ },
    { cats: ['aperitifs'], tags: [], rx: /\b(aperiti|apero|amuse|gougere|feuillet|dip|toast|verrine|tapas)/ },
    { cats: ['entrees'], tags: [], rx: /\b(entree)/ },
    { cats: ['desserts', 'patisserie'], tags: [], rx: /\b(gateau|cake\b|dessert|mousse|tiramisu|cheesecake|patisser|clafoutis|cookie|muffin|cupcake|brownie|entremet|macaron|eclair|banoffee|sundae|creme brulee|creme patissiere)/ },
    { cats: [], tags: ['salades'], rx: /\b(salade|bowl)/ },
    { cats: [], tags: ['soupes'], rx: /\b(soupe|veloute|potage|gaspacho|minestrone|bouillon)/ },
    { cats: [], tags: ['gratins'], rx: /\b(gratin|lasagne|tian|parmentier)/ },
    { cats: [], tags: ['pates'], rx: /\b(pates|pasta|spaghetti|tagliatelle|penne|risotto|nouille|raviol)/ },
    { cats: [], tags: ['sandwich'], rx: /\b(sandwich|burger|wrap|panini|croque|bagel|kebab|pita)/ },
    { cats: [], tags: ['poissons'], rx: /\b(poisson|saumon|thon|cabillaud|dorade|crevette|gambas|moule|crustace)/ },
    { cats: ['plats'], tags: [], rx: /\b(plat|poulet|boeuf|steak|viande|volaille|dinde|porc|agneau|curry|pizza|tajine|couscous|chili|risotto|oeuf|omelette|quiche|frittata)/ },
];

const COUNTRY_LEX: { tag: string; rx: RegExp }[] = [
    { tag: 'italie', rx: /\b(itali|pizza|pasta)/ },
    { tag: 'mexique', rx: /\b(mexic|tacos|burrito|guacamole|fajita)/ },
    { tag: 'espagne', rx: /\b(espagn|paella)/ },
    { tag: 'grece', rx: /\b(grec|tzatziki)/ },
    { tag: 'liban', rx: /\b(liban|houmous|falafel)/ },
    { tag: 'usa', rx: /\b(americ|newyork|texa)|\busa\b/ },
    { tag: 'france', rx: /\b(france|francais)/ },
    { tag: 'asie', rx: /\b(asiat|asie|chinois|japonais|thai|vietnam|coreen|wok|ramen|sushi)/ },
    { tag: 'afrique', rx: /\b(afric|marocain|tunisien|senegal|algerien)/ },
    { tag: 'orient', rx: /\b(orient)/ },
];

const DIET_LEX: { tag: string; rx: RegExp }[] = [
    { tag: 'minceur', rx: /\b(minceur|leger|legere|light|regime|maigrir|calorie)/ },
    { tag: 'healthy', rx: /\b(healthy|sain|saine|equilibr|diet)/ },
    { tag: 'vegetarien', rx: /\b(vege|vegetalien|vegan)/ },
    { tag: 'sans-gluten', rx: /\b(sans[\s-]?gluten)/ },
    { tag: 'sans-lactose', rx: /\b(sans[\s-]?lactose)/ },
    { tag: 'sans-sucre', rx: /\b(sans[\s-]?sucre)/ },
    { tag: 'sans-sel', rx: /\b(sans[\s-]?sel)/ },
    { tag: 'express', rx: /\b(rapide|express|vite|minute|facile|simple)/ },
    { tag: 'pas cher', rx: /\b(pas cher|economiq|budget|petit prix|abordable)/ },
    { tag: 'barbecue', rx: /\b(barbecue|bbq|grillade|grille)/ },
];

interface Matchable { id: string | number; title: string; category?: string; tags?: string[] }

export function smartLocalSearch<T extends Matchable>(recipes: T[], query: string, limit = 5): T[] {
    const nq = ' ' + normalizeFr(query) + ' ';
    const words = nq.split(/[^a-z0-9]+/).filter(w => w.length > 2 && !STOP.has(w));

    const wantedCats = new Set<string>();
    const wantedTags = new Set<string>();
    for (const t of TYPE_LEX) if (t.rx.test(nq)) { t.cats.forEach(c => wantedCats.add(c)); t.tags.forEach(g => wantedTags.add(g)); }
    const wantedCountries = COUNTRY_LEX.filter(c => c.rx.test(nq)).map(c => c.tag);
    const wantedDiets = DIET_LEX.filter(d => d.rx.test(nq)).map(d => d.tag);
    const hasType = wantedCats.size > 0 || wantedTags.size > 0;

    // Négation "sans X" → on EXCLUT les recettes contenant X (ex : "sans viande").
    const negWords = new Set<string>();
    const negRx = /\bsans\s+([a-z]+)/g;
    let nm: RegExpExecArray | null;
    while ((nm = negRx.exec(nq))) if (nm[1] && nm[1].length > 2) negWords.add(nm[1]);
    const noMeat = [...negWords].some(w => /viande|carne/.test(w));
    const MEAT_RX = /\b(viande|poulet|b(?:oeuf|ouf)|steak|bavette|paleron|entrecote|rumsteck|veau|agneau|mouton|gigot|porc|lardon|jambon|bacon|saucisse|chorizo|merguez|cotelette|escalope|magret|kefta|charcuterie|hachee|hache)\b/;
    // Les mots niés ne comptent PAS comme correspondance positive.
    const posWords = words.filter(w => !negWords.has(w));

    const rank = (penalizeWrongType: boolean) => recipes
        .filter(r => normalizeFr(r.category || '') !== 'restaurant')
        .map(r => {
            const cat = normalizeFr(r.category || '');
            const tags = (r.tags || []).map(normalizeFr);
            const title = normalizeFr(r.title || '');
            let score = 0;

            if (hasType) {
                const catHit = wantedCats.has(cat);
                const tagHit = [...wantedTags].some(g => tags.some(t => t.includes(g)) || cat.includes(g));
                if (catHit || tagHit) score += 7;
                else if (penalizeWrongType) score -= 8; // écarte les desserts quand on demande un apéritif
            }
            for (const c of wantedCountries) if (tags.some(t => t.includes(c)) || cat.includes(c)) score += 4;
            for (const d of wantedDiets) if (tags.some(t => t.includes(d)) || cat.includes(d)) score += 4;
            for (const w of posWords) {
                if (title.includes(w)) score += 2;
                else if (tags.some(t => t.includes(w))) score += 1;
            }

            // Négation : la recette contient un terme explicitement exclu → on l'écarte.
            for (const nw of negWords) if (title.includes(nw) || tags.some(t => t.includes(nw))) score -= 12;
            if (noMeat) {
                if (MEAT_RX.test(`${title} ${tags.join(' ')}`)) score -= 12;
                if (tags.some(t => t.includes('vege')) || cat.includes('vegetarien')) score += 3;
            }

            return { r, score };
        })
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score);

    let scored = rank(true);
    // Secours : si le type demandé ne matche AUCUNE recette, on retente sans pénalité.
    if (!scored.length && hasType) scored = rank(false);
    return scored.slice(0, limit).map(x => x.r);
}
