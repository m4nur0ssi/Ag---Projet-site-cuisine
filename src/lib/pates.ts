/**
 * Qu'est-ce qu'une recette de PÂTES ?
 *
 * Le tag WordPress « pates » est posé à la louche : un gratin de pommes de terre
 * « à la sauce bolognaise » et des raviolis chinois au curry le portaient, et
 * ressortaient dès qu'on cherchait des pâtes. Le tag ne décide donc plus seul :
 * c'est le TITRE qui doit nommer une pâte (spaghetti, gnocchi, lasagnes…), ou,
 * pour un plat qui ne la nomme pas (« Ragoût à la bolognaise »), le tag ET un
 * ingrédient qui en est.
 *
 * « Pâte » au singulier, c'est la pâte brisée, feuilletée, à pizza : jamais ici.
 * Les raviolis ne comptent que d'un plat italien — « Raviolis au poulet,
 * curry et coco » est un plat asiatique.
 */

const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const PATES =
    /\b(pates|pasta|pastas|spaghettis?|tagliatelles?|linguine|penne|rigatoni|lasagnes?|sommerlasagne|cannellonis?|gnocchis?|fettuccine|fusilli|farfalle|paccheri|orecchiette|orzo|pastina|pastitsio|macaronis?|tortellini|tortelloni|vermicelles?|mafalde|conchiglie|bucatini|tagliolini|capellini|cavatelli|trofie|tonnarelli|maccheroni|pappardelle|carbonara)\b/;

const FARCIES = /\b(raviolis?|ravioles?)\b/;

interface Lisible {
    title?: string;
    tags?: string[];
    ingredients?: { name?: string }[];
}

export function estRecettePates(r: Lisible): boolean {
    const titre = norm(r.title || '');
    const tags = (r.tags || []).map(norm);
    if (PATES.test(titre)) return true;
    if (FARCIES.test(titre)) return tags.includes('italie') || tags.includes('italy');
    // Le tag seul ne suffit pas : il faut une pâte dans la liste des courses.
    if (!tags.some((t) => t === 'pates')) return false;
    return (r.ingredients || []).some((i) => PATES.test(norm(i?.name || '')));
}
