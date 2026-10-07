'use client';
import { ecrireStock } from '@/lib/stockage';
// Pont magasin → liste de courses.
//
// L'onglet magasin est ouvert par nos soins (window.open nommé 'storeCart'), donc
// l'extension « Courses Magiques » y dispose de `window.opener` = notre onglet.
// Quand un article est mis au panier, elle nous renvoie son index dans la file ;
// on raye l'ingrédient correspondant sans que l'utilisateur revienne.
//
// Sans extension installée, aucun message n'arrive : c'est pour ça que
// `isStoreExtensionActive()` existe — tant qu'on n'a jamais entendu l'extension,
// on garde l'ancien comportement (rayer dès l'ouverture de la recherche).

const FLAG = 'magic-store-ext-active';

const STORE_HOSTS = ['carrefour.fr', 'picard.fr', 'monoprix.fr', 'leclercdrive.fr'];

function fromStore(origin: string): boolean {
    try {
        const host = new URL(origin).hostname;
        return STORE_HOSTS.some(h => host === h || host.endsWith(`.${h}`));
    } catch {
        return false;
    }
}

export function isStoreExtensionActive(): boolean {
    // Depuis la 1.4.0, l'extension plante un drapeau sur la page elle-même :
    // on sait qu'elle est là AVANT d'envoyer qui que ce soit au magasin.
    try {
        if (typeof document !== 'undefined'
            && document.documentElement.hasAttribute('data-courses-magiques')) return true;
    } catch { /* rendu serveur */ }
    try { return localStorage.getItem(FLAG) === '1'; } catch { return false; }
}

/**
 * L'assistant magasin ne vit que dans Chrome (et ses cousins) : c'est une
 * extension Chrome. Aucune page web ne peut FORCER l'ouverture d'un autre
 * navigateur — tout ce qu'on peut faire, c'est le dire avant d'y aller plutôt
 * que de laisser quelqu'un chercher un assistant qui ne viendra pas.
 */
export function navigateurCompatible(): boolean {
    if (typeof navigator === 'undefined') return true;
    const ua = navigator.userAgent;
    const chromiumEtCousins = /Chrome\/|Chromium\/|Edg\//.test(ua);
    // Safari se présente parfois comme « Version/… Safari/… » sans « Chrome/ ».
    return chromiumEtCousins;
}

/** Ce qui manque pour que l'assistant fonctionne, en une phrase — ou rien. */
export function obstacleAssistant(): string {
    if (!navigateurCompatible()) {
        return 'L’assistant magasin est une extension Chrome : ouvre le site dans Chrome pour qu’il t’accompagne dans les rayons.';
    }
    if (!isStoreExtensionActive()) {
        return 'L’assistant magasin n’est pas détecté. Installe l’extension Chrome (menu → Extension Chrome) pour cocher ta liste dans les rayons.';
    }
    return '';
}

export interface StoreDoneMessage { index: number; term: string }

// Renvoie la fonction de désabonnement (à appeler dans le cleanup du useEffect).
export function onStoreItemDone(cb: (msg: StoreDoneMessage) => void): () => void {
    const handler = (e: MessageEvent) => {
        if (!fromStore(e.origin)) return; // seul un site magasin peut nous parler
        const d = e.data as any;
        if (!d || d.source !== 'courses-magiques' || d.type !== 'item-done') return;
        if (typeof d.index !== 'number') return;
        try { ecrireStock(FLAG, '1'); } catch { /* mode privé */ }
        cb({ index: d.index, term: typeof d.term === 'string' ? d.term : '' });
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
}
