import influencersData from '@/data/influencers.json';
import type { Recipe } from '@/types';

export interface Creator {
    handle: string;          // @pseudo sans le @
    name?: string;           // nom affiché (author_name TikTok)
    avatar?: string;         // URL avatar
    bio?: string;            // éditorial, rempli à la main
    style?: string;          // ce qu'il/elle fait (ex: "cuisine libanaise maison")
    since?: string;          // depuis quand (ex: "2021")
    tiktokUrl?: string;      // https://www.tiktok.com/@pseudo
    partner?: boolean;       // accord explicite obtenu → badge
    website?: string;        // site perso / blog (rempli à la main)
    cookbookTitle?: string;  // titre d'un livre de cuisine (rempli à la main)
    cookbookUrl?: string;    // lien d'achat du livre
}

const CREATORS: Record<string, Creator> =
    ((influencersData as any)?.creators as Record<string, Creator>) || {};

// videoId → @pseudo (rempli par le bot, découple la fiche du pipeline WordPress)
const VIDEO_MAP: Record<string, string> =
    ((influencersData as any)?.videoMap as Record<string, string>) || {};

/** Extrait l'ID vidéo TikTok depuis le videoHtml stocké. */
export function extractVideoId(videoHtml?: string): string | null {
    if (!videoHtml) return null;
    const m = videoHtml.match(/data-video-id="(\d+)"/) || videoHtml.match(/video\/(\d+)/) || videoHtml.match(/\/v\/(\d+)/);
    return m ? m[1] : null;
}

/** URL publique de la vidéo (fallback quand on n'a pas le vrai @pseudo). */
export function videoUrlFromId(videoId: string, handle?: string): string {
    if (handle) return `https://www.tiktok.com/@${handle}/video/${videoId}`;
    return `https://www.tiktok.com/v/${videoId}`;
}

/** Résout le @pseudo d'une recette : d'abord le champ explicite, sinon via l'ID vidéo. */
export function resolveHandle(recipe: Pick<Recipe, 'tiktokHandle' | 'videoHtml'>): string | null {
    const explicit = recipe.tiktokHandle?.replace(/^@/, '').toLowerCase();
    if (explicit) return explicit;
    const videoId = extractVideoId(recipe.videoHtml);
    if (videoId && VIDEO_MAP[videoId]) return VIDEO_MAP[videoId].replace(/^@/, '').toLowerCase();
    return null;
}

/** Récupère la fiche éditoriale d'un créateur par son @pseudo (sans @). */
export function getCreatorByHandle(handle?: string | null): Creator | null {
    if (!handle) return null;
    return CREATORS[handle.replace(/^@/, '').toLowerCase()] || null;
}

/** Récupère la fiche créateur d'une recette, si le pseudo est connu. */
export function getCreatorForRecipe(recipe: Pick<Recipe, 'tiktokHandle' | 'videoHtml'>): Creator | null {
    return getCreatorByHandle(resolveHandle(recipe));
}
