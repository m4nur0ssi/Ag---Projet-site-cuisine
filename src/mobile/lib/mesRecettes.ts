/**
 * « Mes recettes » : celles qu'on s'est faites soi-même, depuis une vidéo.
 * =======================================================================
 *
 * Elles ne vivent PAS dans le catalogue du site — celui-ci est compilé au
 * moment de la construction, une recette ajoutée n'y apparaîtrait qu'au
 * déploiement suivant. Elles vivent dans Supabase (`user_recipes`), lues à
 * l'exécution, visibles tout de suite, et seulement par leur auteur (RLS).
 */

import { supabase } from '@/mobile/lib/supabase';

export interface MaRecette {
    id: string;
    statut: 'en_cours' | 'prete' | 'echec';
    raison?: string | null;
    source_url: string;
    video_id?: string | null;
    created_at: string;
    recipe?: {
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
        auteur?: string;
        sourceUrl?: string;
        image?: string;
        videoHtml?: string;
    } | null;
}

/** Les miennes, les plus récentes d'abord. Hors session : rien à montrer. */
export async function listerMesRecettes(): Promise<MaRecette[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];
    const { data, error } = await supabase
        .from('user_recipes')
        .select('id, statut, raison, source_url, video_id, created_at, recipe')
        .order('created_at', { ascending: false })
        .limit(60);
    if (error) return [];
    return (data || []) as MaRecette[];
}

export interface Resultat {
    ok: boolean;
    recette?: MaRecette;
    /** Le mot à afficher quand ça n'a pas marché — déjà écrit en français. */
    raison?: string;
}

/**
 * Envoie le lien au serveur, qui écoute la vidéo et écrit la fiche.
 *
 * L'appel porte le jeton de la session : la route refuse tout le reste, et
 * c'est voulu — une route qui fait travailler un modèle ne doit pas être
 * ouverte à la cantonade.
 */
export async function importerVideo(lien: string): Promise<Resultat> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { ok: false, raison: 'Connecte-toi pour garder tes recettes.' };

    try {
        const res = await fetch('/api/importer-recette', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ url: lien }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false, raison: data?.error || data?.raison || "Je n'ai pas pu lire cette vidéo." };
        if (data?.statut === 'echec') return { ok: false, raison: data?.raison };
        return { ok: true, recette: data?.recette as MaRecette };
    } catch {
        return { ok: false, raison: 'Le réseau a coupé avant la fin.' };
    }
}

export async function oublierRecette(id: string): Promise<void> {
    await supabase.from('user_recipes').delete().eq('id', id);
}

/**
 * La forme que la fiche flottante attend.
 *
 * L'hôte de la fiche complète l'objet depuis le catalogue quand l'identifiant
 * s'y trouve ; le nôtre n'y est pas, donc tout doit être là — d'où les
 * tableaux garantis plutôt que « probablement présents ».
 */
export function versFiche(m: MaRecette): Record<string, unknown> | null {
    const r = m.recipe;
    if (!r) return null;
    return {
        id: m.id,
        title: r.title,
        description: r.description || '',
        image: r.image || '',
        category: r.category || 'plats',
        difficulty: r.difficulty || 'moyen',
        prepTime: r.prepTime ?? 0,
        cookTime: r.cookTime ?? 0,
        servings: r.servings ?? 4,
        ingredients: r.ingredients || [],
        steps: r.steps || [],
        tags: r.tags || [],
        // L'onglet « Vidéo » de la fiche s'ouvre sur cet embed.
        videoHtml: r.videoHtml || '',
        // De quoi créditer l'auteur de la vidéo dans la fiche.
        auteurVideo: r.auteur || '',
        sourceUrl: r.sourceUrl || m.source_url,
        perso: true,
    };
}
