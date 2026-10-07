import { useEffect, useState } from 'react';
import { buildCookingTimeline, type TimelineInput } from './cooking-timeline';

/*
 * « Démarrer » le déroulé du Jour J.
 *
 * Le déroulé dit QUAND lancer chaque geste ; démarré, il suit l'heure qu'il est
 * pour de bon : à chaque étape il prévient, et l'utilisateur répond « OK » (c'est
 * fait), ou « dans 5 / 10 min » (j'ai du retard). Le retard se REPORTE sur tout ce
 * qui reste : les horaires suivants, et le service, glissent d'autant.
 *
 * L'état est écrit sur l'appareil (jamais envoyé) : fermer l'app en pleine cuisine
 * ne perd ni l'étape en cours ni le retard accumulé.
 */

const CLE = 'jourj-demarrage-v1';
export const DEMARRAGE_EVENT = 'magic-demarrage-change';

export interface EtatDemarrage {
    /** AAAA-MM-JJ : un déroulé d'hier ne se rejoue pas. */
    jour: string;
    /** Heure de service prévue, en minutes depuis minuit. */
    serve: number;
    /** Retard cumulé (minutes), appliqué à toutes les étapes non faites. */
    decalage: number;
    /** Identifiants des étapes déjà faites. */
    faits: string[];
}

export interface EtapeDeroule {
    id: string;
    /** Heure prévue SANS retard, en minutes depuis minuit. */
    t: number;
    kind: 'act' | 'pass' | 'serve';
    key: string | null;
    label: string;
    title: string;
    passive: number;
    passiveLabel: string;
}

const aujourdhui = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const minutesMaintenant = () => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
};

export function lireDemarrage(): EtatDemarrage | null {
    try {
        const e = JSON.parse(localStorage.getItem(CLE) || 'null') as EtatDemarrage | null;
        if (!e || e.jour !== aujourdhui() || typeof e.serve !== 'number') return null;
        return { ...e, decalage: Number(e.decalage) || 0, faits: Array.isArray(e.faits) ? e.faits : [] };
    } catch { return null; }
}

export function ecrireDemarrage(e: EtatDemarrage | null): void {
    try {
        if (e) localStorage.setItem(CLE, JSON.stringify(e));
        else localStorage.removeItem(CLE);
    } catch { /* stockage plein ou refusé : l'état reste en mémoire de la session */ }
    window.dispatchEvent(new Event(DEMARRAGE_EVENT));
}

/** Les étapes du déroulé, dans l'ordre : chaque geste actif, chaque mise en attente, le service. */
export function etapesDeroule(items: TimelineInput[], serve: number): EtapeDeroule[] {
    if (!items.length) return [];
    const { tasks } = buildCookingTimeline(items, serve);
    const out: EtapeDeroule[] = [];
    tasks.forEach((x) => {
        out.push({ id: `${x.key}:act`, t: x.activeStart, kind: 'act', key: x.key, label: x.label, title: x.title, passive: x.passive, passiveLabel: x.passiveLabel || 'Cuisson' });
        if (x.passive > 0) out.push({ id: `${x.key}:pass`, t: x.passiveStart, kind: 'pass', key: x.key, label: x.label, title: x.title, passive: x.passive, passiveLabel: x.passiveLabel || 'Cuisson' });
    });
    out.push({ id: 'serve', t: serve, kind: 'serve', key: null, label: 'Service', title: '', passive: 0, passiveLabel: '' });
    return out.sort((a, b) => a.t - b.t);
}

/** L'état courant, tenu à jour quand n'importe quel écran le change. */
export function useDemarrage(): EtatDemarrage | null {
    const [etat, setEtat] = useState<EtatDemarrage | null>(null);
    useEffect(() => {
        const lire = () => setEtat(lireDemarrage());
        lire();
        window.addEventListener(DEMARRAGE_EVENT, lire);
        window.addEventListener('storage', lire);
        return () => { window.removeEventListener(DEMARRAGE_EVENT, lire); window.removeEventListener('storage', lire); };
    }, []);
    return etat;
}

/**
 * Lance le déroulé. Si l'heure de départ est déjà passée, on décale tout de
 * suite : la première étape est « maintenant », pas hier soir.
 */
export function demarrer(items: TimelineInput[], serve: number): void {
    const { start } = buildCookingTimeline(items, serve);
    const retard = Math.max(0, minutesMaintenant() - start);
    ecrireDemarrage({ jour: aujourdhui(), serve, decalage: retard, faits: [] });
    // Autorisation demandée au geste « Démarrer » : iOS refuse de l'afficher ailleurs.
    try {
        if (typeof Notification !== 'undefined' && Notification.permission === 'default') void Notification.requestPermission();
    } catch { /* navigateur sans notifications : le bandeau reste */ }
}

export const arreter = () => ecrireDemarrage(null);

/** Affiche « 19:42 ». */
export const horloge = (min: number) => {
    const m = ((Math.round(min) % 1440) + 1440) % 1440;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

/** Notification système si on peut (iPhone : app ajoutée à l'écran d'accueil), sinon rien — le bandeau suffit. */
export async function notifier(titre: string, corps: string): Promise<void> {
    try {
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
        const reg = await navigator.serviceWorker?.getRegistration?.();
        if (reg?.showNotification) await reg.showNotification(titre, { body: corps, tag: 'jourj-etape', icon: '/icons/icon-192x192.png' });
        else new Notification(titre, { body: corps, tag: 'jourj-etape' });
    } catch { /* jamais bloquant */ }
}
