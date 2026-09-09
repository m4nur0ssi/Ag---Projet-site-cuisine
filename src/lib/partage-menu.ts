/**
 * Partager un menu par un lien.
 * =============================
 *
 * « Voilà ce qu'on mange samedi » — on envoie une page, pas une capture
 * d'écran. Celui qui la reçoit n'a besoin de rien : ni compte, ni application.
 * Il voit les plats, et la liste de courses qui va avec.
 *
 * C'est un INSTANTANÉ. Le menu partagé ne suit pas les modifications qu'on fait
 * ensuite chez soi : on a promis un menu à quelqu'un, il ne doit pas changer
 * sous ses yeux parce qu'on a déplacé un repas.
 */

import { buildConsolidatedItems, type ConsolItem } from '@/lib/ingredients';
import { RAYONS, RAYON_ORDER, rayonOf, readRayonOverrides } from '@/lib/rayons';
import { estimateRecipeTiming } from '@/lib/recipe-timing';

/** Un plat du menu, réduit à ce qu'une page publique montre. */
export interface PlatPartage {
    creneau: string;
    id: string;
    titre: string;
    image?: string;
    minutes?: number;
}

export interface JourPartage {
    jour: string;
    plats: PlatPartage[];
}

export interface RayonPartage {
    rayon: string;
    lignes: string[];
}

export interface MenuPartage {
    mode: 'semaine' | 'jourj';
    titre: string;
    jours: JourPartage[];
    courses: RayonPartage[];
}

const NOMS_JOURS: Record<string, string> = {
    Lun: 'Lundi', Mar: 'Mardi', Mer: 'Mercredi', Jeu: 'Jeudi',
    Ven: 'Vendredi', Sam: 'Samedi', Dim: 'Dimanche', JourJ: 'Le grand jour',
};

/*
 * Le temps affiché est celui que le site calcule DEPUIS LES ÉTAPES, pas celui
 * qui traîne dans les données de WordPress : presque toutes les recettes y
 * portent « 15 + 30 », si bien qu'un menu entier annonçait « 45 min » partout.
 */
const minutesDe = (r: any): number | undefined => {
    const estime = estimateRecipeTiming(Array.isArray(r?.steps) ? r.steps : []);
    const t = (estime.prepTime || 0) + (estime.cookTime || 0)
        || (Number(r?.prepTime) || 0) + (Number(r?.cookTime) || 0);
    return t > 0 ? t : undefined;
};

/**
 * Prépare l'instantané depuis le plan tel qu'il vit dans l'appareil.
 *
 * La liste de courses est calculée ICI, avec le moteur du site : la page
 * publique n'a pas à connaître les règles de fusion des quantités, elle affiche
 * ce qu'on lui donne.
 */
export function preparerMenu(
    plan: Record<string, Record<string, any>>,
    options: { mode: 'semaine' | 'jourj'; titre?: string; liste?: Record<string, any> },
): MenuPartage {
    const { mode } = options;
    const retenu: Record<string, Record<string, any>> = {};
    for (const [jour, creneaux] of Object.entries(plan || {})) {
        const estJourJ = jour === 'JourJ';
        if (mode === 'jourj' ? !estJourJ : estJourJ) continue;
        if (creneaux && Object.keys(creneaux).length) retenu[jour] = creneaux;
    }

    const jours: JourPartage[] = Object.entries(retenu).map(([jour, creneaux]) => ({
        jour: NOMS_JOURS[jour] || jour,
        plats: Object.entries(creneaux)
            .filter(([, r]) => r && (r as any).title)
            .map(([creneau, r]: [string, any]) => ({
                creneau,
                id: String(r.id ?? ''),
                titre: String(r.title),
                image: typeof r.image === 'string' ? r.image : undefined,
                minutes: minutesDe(r),
            })),
    })).filter((j) => j.plats.length);

    // La liste : même moteur que l'écran « Courses », rangée par rayon.
    const items: ConsolItem[] = buildConsolidatedItems(
        retenu,
        new Set<string>(),
        options.liste || {},
        mode === 'jourj',
        mode === 'semaine',
    );
    const overrides = readRayonOverrides();
    const parRayon = new Map<string, string[]>();
    for (const it of items) {
        const rid = rayonOf(it.name, overrides);
        if (!parRayon.has(rid)) parRayon.set(rid, []);
        parRayon.get(rid)!.push(it.display);
    }
    const courses: RayonPartage[] = [...parRayon.entries()]
        .sort((a, b) => (RAYON_ORDER[a[0]] ?? 99) - (RAYON_ORDER[b[0]] ?? 99))
        .map(([rid, lignes]) => ({
            rayon: RAYONS.find((r) => r.id === rid)?.label || 'Divers',
            lignes: lignes.slice(0, 60),
        }));

    return {
        mode,
        titre: options.titre || (mode === 'jourj' ? 'Le menu du grand jour' : 'Le menu de la semaine'),
        jours,
        courses,
    };
}

/**
 * Envoie l'instantané et rend son adresse. Une session est nécessaire — c'est
 * une écriture, et le menu appartient à quelqu'un.
 */
export async function partagerMenu(
    menu: MenuPartage,
    jeton: string,
): Promise<{ url?: string; erreur?: string }> {
    try {
        const res = await fetch('/api/partager-menu', {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${jeton}` },
            body: JSON.stringify({ menu }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { erreur: data?.error || 'Le partage n’a pas abouti.' };
        return { url: data.url };
    } catch {
        return { erreur: 'Le réseau a coupé avant la fin.' };
    }
}
