'use client';
/**
 * « Ma cave » — maquette Apple TV+ (mobile + desktop).
 * - Scanner l'étiquette (caméra mobile) → /api/wine-lookup lit l'étiquette puis
 *   retrouve la bouteille chez le marchand : sa PHOTO OFFICIELLE, le nom, le
 *   cépage, l'année, la région et la note entrent directement dans la cave.
 *   Saisie manuelle toujours possible.
 * - Chaque vin est présenté dans une SCÈNE de cave (tonneau de chêne) rendue en
 *   CSS : seule la bouteille change.
 * - Onglets Rouges / Blancs / Liqueurs. Sur un vin → « Quelle recette ? » propose
 *   une dizaine de recettes du site adaptées ; clic → ouvre la fiche.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { mockRecipes } from '@/mobile/data/mockData';
import { decodeHtml } from '@/mobile/lib/utils';
import {
    readCave, addWine, removeWine, seedCaveIfEmpty, recipesForWine, wineProfile,
    openBottle, setQty, drinkWindow, drinkRange, updateWine, findKnownWine,
    moveToTasted, moveToCave, shelfOf, wineMatches, CavePleine,
    CAVE_EVENT, type CaveWine, type WineColor, type WineShelf, type DrinkStatus,
} from '@/lib/cave';
import { whenCaveReady } from '@/mobile/lib/caveSync';
// Détourage + mise à taille fixe des bouteilles. Voir `bouteille.ts` : c'est
// lui qui garantit que toutes les silhouettes d'une étagère se ressemblent.
import { normaliserBouteille, normaliserDepuisUrl, estNormalisee, CADRE_H } from '@/lib/bouteille';
// L'étiquette réelle, reportée sur un verre dessiné : c'est ce qui donne à
// l'étagère une silhouette unique. Voir `etiquette.ts`.
import { composerSurBouteilleType } from '@/lib/etiquette';
import styles from './MaCave.module.css';
// Le menu d'appui long réutilise TEL QUEL l'habillage de celui de l'accueil :
// même taille, même grain, mêmes séparateurs. Deux menus dessinés séparément
// finissent toujours par diverger.
import tv from './tv.module.css';
import Tip from '@/components/Tip/Tip';
import TVToast from './TVToast';

/**
 * Nom débarrassé du millésime qu'il traîne parfois : il est affiché à part, en
 * gris, toujours à la même place. Sans ça on lisait « … 'Charmes' 2010 · 2010 ».
 */
/**
 * Version du traitement d'image appliqué aux bouteilles.
 *
 * Toute fiche dont le `visuelV` est inférieur repasse par le rattrapage, une
 * par une, à l'ouverture de « Ma cave ». Incrémenter ce nombre est donc le
 * geste qui déclenche la remise à jour de toute la cave — c'est volontaire, et
 * c'est le seul endroit à toucher.
 *
 *   1 — photo du marchand telle quelle
 *   2 — détourage + hauteur et ligne de pose fixes
 *   3 — étiquette réelle reportée sur une bouteille type
 */
const VISUEL_VERSION = 3;

const stripYear = (name: string) => name.replace(/\s*[·,-]?\s*\b(19|20)\d{2}\b\s*$/, '').trim() || name;

/**
 * Chez qui la bouteille a été retrouvée — lu sur l'adresse de sa fiche.
 * Deux marchands sont interrogés (Vivino pour la note, Viniou pour les domaines
 * français) : annoncer « sur Vivino » sous une fiche Viniou serait faux.
 */
const marchandDe = (url?: string) =>
    !url ? '' : /viniou/i.test(url) ? 'Viniou' : /vivino/i.test(url) ? 'Vivino' : '';

/** Bandeau d'information de l'app (même canal que le reste du site). */
const toast = (msg: string) => window.dispatchEvent(new CustomEvent('magic-toast-notify', { detail: msg }));

const COLOR_LABEL: Record<WineColor, string> = {
    rouge: 'Rouge', blanc: 'Blanc', rose: 'Rosé', liqueur: 'Liqueur',
    champagne: 'Champagne', cidre: 'Cidre', 'cidre-rose': 'Cidre rosé',
};
const COLOR_GLASS: Record<WineColor, string> = {
    rouge: '#7b1e2b', blanc: '#e6d27a', rose: '#e08a97', liqueur: '#c98a2b',
    champagne: '#e8cf82', cidre: '#d79a3f', 'cidre-rose': '#e2a48f',
};

/** Bouteille dessinée (repli quand pas de photo) — teintée selon la couleur. */
function BottleSVG({ color }: { color: WineColor }) {
    const c = COLOR_GLASS[color];
    return (
        <svg viewBox="0 0 60 180" className={styles.bottleSvg} aria-hidden>
            <defs>
                <linearGradient id={`b-${color}`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0" stopColor={c} stopOpacity="0.65" />
                    <stop offset="0.5" stopColor={c} />
                    <stop offset="1" stopColor="#000" stopOpacity="0.55" />
                </linearGradient>
            </defs>
            <path d="M24 6h12v34c0 6 9 12 9 26v76a6 6 0 0 1-6 6H21a6 6 0 0 1-6-6V72c0-14 9-20 9-26z" fill={`url(#b-${color})`} stroke="rgba(0,0,0,.5)" strokeWidth="1.5" />
            <rect x="22" y="4" width="16" height="8" rx="2" fill="#2a1a12" />
            <rect x="16" y="96" width="28" height="42" rx="3" fill="#f3ecd9" opacity="0.95" />
            <rect x="20" y="104" width="20" height="3" rx="1.5" fill="#8a1526" />
            <rect x="20" y="120" width="20" height="2.4" rx="1.2" fill="rgba(0,0,0,.35)" />
        </svg>
    );
}

export default function MaCave({ embedded = false }: { embedded?: boolean }) {
    const router = useRouter();
    const [wines, setWines] = useState<CaveWine[]>([]);
    const [filter, setFilter] = useState<'tous' | WineColor>('tous');
    // Destination du formulaire : la cave, ou l'étagère « Goûté & approuvé »
    // (bouteille bue chez un ami, au restaurant… qu'on ne possède pas).
    const [adding, setAdding] = useState<WineShelf | null>(null);
    const [dropOn, setDropOn] = useState<WineShelf | null>(null);
    /** Ouverture venue de la barre du bas : on va droit au viseur. */
    const [scanNow, setScanNow] = useState(false);
    const [pairing, setPairing] = useState<CaveWine | null>(null);
    /**
     * La bouteille ouverte en grand, suivie par son ID et non par sa copie : le
     * stock et la note se modifient DEPUIS la fiche, et une copie figée aurait
     * affiché l'ancienne valeur jusqu'à la fermeture.
     */
    const [detailId, setDetailId] = useState<string | null>(null);
    const [zoom, setZoom] = useState<string | null>(null);
    const [editing, setEditing] = useState<CaveWine | null>(null);
    const [menu, setMenu] = useState<{ wine: CaveWine; x: number; y: number } | null>(null);
    // Filtre de MATURITÉ : « à boire ce soir » n'est pas la même question que
    // « de quelle couleur ». Les deux se combinent.
    const [ripe, setRipe] = useState<'tous' | DrinkStatus>('tous');
    const [q, setQ] = useState('');
    const [sort, setSort] = useState<'recent' | 'annee' | 'region'>('recent');

    // La barre du bas, dans « Ma cave », propose « Ajouter un vin » : elle nous
    // le demande par cet événement, et on ouvre le viseur directement.
    useEffect(() => {
        const scan = () => { setScanNow(true); setAdding('cave'); };
        window.addEventListener('macave-scan', scan);
        return () => window.removeEventListener('macave-scan', scan);
    }, []);

    /**
     * Les deux boutons d'étagère de la barre du bas amènent directement au rayon
     * voulu, sans remonter la page. Le filtre courant est annulé au passage :
     * viser « déjà dégusté » alors qu'on filtre les rouges menait à une étagère
     * vide, et donc à un défilement vers rien.
     */
    // La loupe de la barre du bas cherche des BOUTEILLES — vins comme liqueurs.
    const [searching, setSearching] = useState(false);
    useEffect(() => {
        const open = () => setSearching(true);
        window.addEventListener('macave-search', open);
        return () => window.removeEventListener('macave-search', open);
    }, []);

    /** Amène une bouteille sous les yeux et la fait clignoter une fois. */
    const revealWine = (id: string) => {
        setSearching(false);
        // Le filtre courant peut la cacher : on l'annule, sinon on ferait
        // défiler vers une carte absente du DOM.
        setFilter('tous');
        setRipe('tous');
        setQ('');
        setTimeout(() => {
            const el = document.querySelector(`[data-wine="${id}"]`) as HTMLElement | null;
            if (!el) return;
            // Même remarque que pour les étagères : c'est la racine qui défile.
            const racine = (document.scrollingElement || document.documentElement) as HTMLElement;
            const y = el.getBoundingClientRect().top + racine.scrollTop - (window.innerHeight - el.offsetHeight) / 2;
            try { racine.scrollTo({ top: Math.max(0, y), behavior: 'smooth' }); } catch { /* noop */ }
            setTimeout(() => { if (Math.abs(racine.scrollTop - y) > 8) racine.scrollTop = Math.max(0, y); }, 340);
            el.classList.add(styles.cardFound);
            setTimeout(() => el.classList.remove(styles.cardFound), 1600);
        }, 60);
    };

    useEffect(() => {
        /**
         * Fait défiler la page — et VÉRIFIE que ça a bougé.
         *
         * Sur cet écran, ni `scrollIntoView` ni `window.scrollTo` ne déplacent
         * quoi que ce soit : la page ne défile pas dans la fenêtre mais dans
         * l'élément racine, qui porte `overflow-y: auto` et une hauteur fixée.
         * Le défilement en douceur y est ignoré, alors qu'une affectation
         * directe de `scrollTop` fonctionne. On tente donc le doux, puis on
         * impose la position si rien n'a bougé.
         */
        const defileVers = (y: number) => {
            const racine = (document.scrollingElement || document.documentElement) as HTMLElement;
            try { racine.scrollTo({ top: y, behavior: 'smooth' }); } catch { /* pas de scrollTo ici */ }
            try { window.scrollTo({ top: y, behavior: 'smooth' }); } catch { /* noop */ }
            setTimeout(() => {
                if (Math.abs(racine.scrollTop - y) > 8) racine.scrollTop = y;
            }, 340);
        };

        const versEtagere = (quelle: WineShelf) => {
            setFilter('tous');
            setRipe('tous');
            setQ('');
            // Pas de `requestAnimationFrame` ici : il ne se déclenche pas quand
            // l'onglet n'est pas peint (arrière-plan, fenêtre masquée), et le
            // défilement ne partait alors jamais. Un simple délai suffit à
            // laisser le rendu des filtres se poser.
            setTimeout(() => {
                // « Ma cave » ramène en HAUT : c'est là que vivent le titre, la
                // recherche et les filtres — et l'étagère commence juste après.
                if (quelle === 'cave') { defileVers(0); return; }
                const el = document.querySelector(`[data-shelf="${quelle}"]`) as HTMLElement | null;
                if (!el) return;
                const racine = (document.scrollingElement || document.documentElement) as HTMLElement;
                defileVers(Math.max(0, el.getBoundingClientRect().top + racine.scrollTop - 12));
            }, 80);
        };
        const cave = () => versEtagere('cave');
        const tasted = () => versEtagere('tasted');
        window.addEventListener('macave-shelf-cave', cave);
        window.addEventListener('macave-shelf-tasted', tasted);
        return () => {
            window.removeEventListener('macave-shelf-cave', cave);
            window.removeEventListener('macave-shelf-tasted', tasted);
        };
    }, []);


    useEffect(() => {
        const load = () => setWines(readCave());
        load();                                   // affichage immédiat de ce qu'on a
        // Les bouteilles d'exemple n'arrivent QU'APRÈS la lecture du nuage :
        // sinon, sur un appareil neuf, elles se seraient écrites par-dessus la
        // vraie cave le temps que la synchro descende.
        whenCaveReady().then(() => { seedCaveIfEmpty(); load(); });
        window.addEventListener(CAVE_EVENT, load);
        window.addEventListener('storage', load);
        return () => { window.removeEventListener(CAVE_EVENT, load); window.removeEventListener('storage', load); };
    }, []);

    /**
     * Rattrapage : remet toute la cave au traitement d'image COURANT.
     *
     * Trois générations de fiches cohabitent, et il faut les reprendre toutes :
     *
     *   • les liens `http` jamais mis en scène ;
     *   • les photos de l'ancien `toStudio`, décor cuit dans un JPEG opaque ;
     *   • celles qui ont été détourées mais pas encore composées sur une
     *     bouteille type.
     *
     * Le repère est `visuelV`, comparé à `VISUEL_VERSION` : incrémenter cette
     * constante suffit à faire repasser toute la cave. Reconnaître l'état d'une
     * fiche à son seul format d'image ne marchait plus — détourée et composée
     * sont toutes deux du webp transparent.
     *
     * Une fiche SANS PHOTO est réparée, pas ignorée : on redemande la bouteille
     * au marchand à partir de son nom. C'est ce qui rattrape les caves abîmées
     * par une version intermédiaire, et en production la bouteille dont l'image
     * n'a jamais pu être écrite faute de place.
     *
     * Une par une, et pas toutes d'un coup : chaque photo pèse une quarantaine
     * de kilo-octets et la cave vit dans le stockage local, qui est étroit. Si
     * l'écriture échoue — quota atteint — on s'arrête et on le dit, au lieu de
     * boucler sur une erreur.
     */
    useEffect(() => {
        let vivant = true;

        /** Redemande un visuel au marchand quand la fiche n'en a plus. */
        const photoDuMarchand = async (nom: string): Promise<string> => {
            try {
                const res = await fetch('/api/wine-lookup', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ label: nom }),
                });
                if (!res.ok) return '';
                const data = await res.json();
                return String(data?.wine?.photo || '');
            } catch { return ''; }
        };

        const rattraper = async () => {
            await whenCaveReady();
            if (!vivant || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
            const aFaire = readCave().filter((w) => (w.visuelV ?? 0) < VISUEL_VERSION);
            if (!aFaire.length) return;
            // Des fiches qui changent d'aspect sans un mot, ça inquiète.
            toast(`Mise à jour de ${aFaire.length} bouteille${aFaire.length > 1 ? 's' : ''}…`);
            let faites = 0;
            for (const w of aFaire) {
                if (!vivant) return;
                let source = w.photo || '';
                if (!source) source = await photoDuMarchand(w.name);
                if (!vivant) return;

                // `visuelBouteille` fait tout : détourage, redressement, report
                // de l'étiquette sur la bouteille type de cette couleur.
                const visuel = source
                    ? await visuelBouteille(source.startsWith('data:') ? source : '', source.startsWith('data:') ? undefined : source, w.color)
                    : '';
                if (!vivant) return;

                /*
                 * On ne marque « à jour » qu'une fiche qui A une image.
                 *
                 * Sans image et marquée, la bouteille n'est plus jamais reprise :
                 * elle reste sur la silhouette de secours pour toujours. Or
                 * l'échec est souvent passager — réseau coupé, marchand lent — ou
                 * réparable en corrigeant le nom, trop générique pour être
                 * retrouvé. On la laisse donc repasser à la prochaine ouverture ;
                 * cela coûte une requête, et rend la cave capable de se réparer
                 * toute seule le jour où la recherche aboutit.
                 */
                const aUneImage = !!(visuel || w.photo);
                const maj = visuel && visuel !== w.photo
                    ? { photo: visuel, visuelV: VISUEL_VERSION }
                    : aUneImage ? { visuelV: VISUEL_VERSION } : {};
                if (Object.keys(maj).length === 0) continue;
                if (!updateWine(w.id, maj)) {
                    toast('Cave pleine côté navigateur — les bouteilles restantes gardent leur image.');
                    return;
                }
                if (visuel && visuel !== w.photo) faites++;
                await new Promise((r) => setTimeout(r, 400));
            }
            if (vivant && faites) toast(`${faites} bouteille${faites > 1 ? 's' : ''} remise${faites > 1 ? 's' : ''} en scène`);
        };
        rattraper();
        return () => { vivant = false; };
    }, []);

    const shown = useMemo(() => {
        let list = filter === 'tous' ? wines : wines.filter((w) => w.color === filter);
        if (ripe !== 'tous') list = list.filter((w) => drinkWindow(w)?.status === ripe);
        // Même moteur que la loupe de la barre du bas (`wineMatches`) : les deux
        // recherches donnaient des résultats différents pour la même frappe.
        if (q.trim()) list = list.filter((w) => wineMatches(w, q));
        const s = [...list];
        if (sort === 'annee') s.sort((a, b) => (parseInt(b.year, 10) || 0) - (parseInt(a.year, 10) || 0));
        else if (sort === 'region') s.sort((a, b) => (a.region || '').localeCompare(b.region || '', 'fr'));
        else s.sort((a, b) => b.addedAt - a.addedAt);
        return s;
    }, [wines, filter, ripe, q, sort]);
    const detail = useMemo(() => wines.find((w) => w.id === detailId) || null, [wines, detailId]);
    /**
     * Les bouteilles entre lesquelles on navigue d'un glissé, dans la fiche :
     * la même étagère et la même couleur que celle qu'on regarde. C'est la
     * « catégorie » au sens des onglets de la page — passer d'un bordeaux à un
     * sauternes parce qu'ils se suivent dans la grille n'aurait aucun sens.
     * L'ordre est celui de la page, pour que le geste suive ce qu'on voyait.
     */
    const voisines = useMemo(() => {
        if (!detail) return [];
        const meme = wines.filter((w) => shelfOf(w) === shelfOf(detail) && w.color === detail.color);
        return meme.sort((a, b) => b.addedAt - a.addedAt);
    }, [wines, detail]);

    // Les deux étagères, filtres et recherche déjà appliqués.
    const inCave = useMemo(() => shown.filter((w) => shelfOf(w) === 'cave'), [shown]);
    const tastedList = useMemo(() => shown.filter((w) => shelfOf(w) === 'tasted'), [shown]);

    /** Glisser-déposer d'une carte d'une étagère à l'autre. */
    const dropHandlers = (target: WineShelf) => ({
        onDragOver: (e: React.DragEvent) => { e.preventDefault(); setDropOn(target); },
        onDragLeave: () => setDropOn((d) => (d === target ? null : d)),
        onDrop: (e: React.DragEvent) => {
            e.preventDefault();
            setDropOn(null);
            const id = e.dataTransfer.getData('text/plain');
            if (!id) return;
            if (target === 'tasted') moveToTasted(id); else moveToCave(id);
        },
    });

    // Un onglet de couleur n'a de sens que s'il y a quelque chose dedans :
    // « Liqueurs 0 » n'apprend rien et encombre la barre.
    const tabs = useMemo(() => {
        // L'ordre des onglets, du plus courant au plus rare. Un onglet vide ne
        // s'affiche pas (voir le filtre plus bas), donc la liste peut être longue
        // sans encombrer une cave qui ne contient que des rouges.
        const order: WineColor[] = ['rouge', 'blanc', 'rose', 'champagne', 'liqueur', 'cidre', 'cidre-rose'];
        const plural: Record<WineColor, string> = {
            rouge: 'Rouges', blanc: 'Blancs', rose: 'Rosés', liqueur: 'Liqueurs',
            champagne: 'Champagnes', cidre: 'Cidres', 'cidre-rose': 'Cidres rosés',
        };
        const present = order
            .map((c) => ({ key: c, label: plural[c], n: wines.filter((w) => w.color === c).length }))
            .filter((t) => t.n > 0);
        return [{ key: 'tous' as const, label: 'Tous', n: wines.length }, ...present];
    }, [wines]);

    /** Pastilles de maturité — seules celles qui ont des bouteilles s'affichent. */
    const ripeTabs = useMemo(() => {
        const order: { key: DrinkStatus; label: string }[] = [
            { key: 'pret', label: 'À boire' },
            { key: 'apogee', label: 'À son apogée' },
            { key: 'jeune', label: 'Trop jeune' },
            { key: 'tard', label: 'Sans tarder' },
        ];
        const pool = filter === 'tous' ? wines : wines.filter((w) => w.color === filter);
        return order
            .map((t) => ({ ...t, n: pool.filter((w) => drinkWindow(w)?.status === t.key).length }))
            .filter((t) => t.n > 0);
    }, [wines, filter]);

    // Un filtre de maturité qui se vide (changement de couleur) revient à « Tous ».
    useEffect(() => {
        if (ripe !== 'tous' && !ripeTabs.some((t) => t.key === ripe)) setRipe('tous');
    }, [ripeTabs, ripe]);

    // Si l'onglet courant se vide (dernière bouteille retirée), on revient à « Tous ».
    useEffect(() => {
        if (filter !== 'tous' && !tabs.some((t) => t.key === filter)) setFilter('tous');
    }, [tabs, filter]);

    return (
        <div className={`${styles.page} ${embedded ? styles.emb : ''}`}>
            <header className={styles.head}>
                {!embedded && (
                    <button className={styles.back} onClick={() => router.push('/')} aria-label="Retour">
                        <svg viewBox="0 0 8 14" width="13" height="13" fill="none"><path d="M7 1L1 7l6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                )}
                <h1 className={styles.title}>Ma cave</h1>
                {/* Sur un ordinateur, l'action principale se tient dans l'en-tête :
                    la tuile en bout de grille reste, mais elle descend avec les
                    bouteilles et n'est plus sous les yeux passé la première rangée.
                    Au doigt, la barre du bas joue déjà ce rôle. */}
                {embedded && wines.length > 0 && (
                    <button className={styles.addTop} onClick={() => setAdding('cave')}>
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                        Ajouter un vin
                    </button>
                )}
            </header>

            {/*
             * Une seule barre de commandes sur ordinateur.
             *
             * Couleurs, maturités, recherche et tri occupaient QUATRE rangées
             * empilées : cent trente pixels de chrome avant la première
             * bouteille, sur un écran qui en montre six par rangée. Le même
             * balisage, posé sur une grille à deux zones, tient sur une ligne —
             * les filtres à gauche, la recherche et le tri à droite — et se
             * replie de lui-même quand la fenêtre rétrécit.
             */}
            <div className={embedded ? styles.bar : ''}>
            <div className={styles.tabs}>
                {tabs.map((t) => (
                    <button key={t.key} className={`${styles.tab} ${filter === t.key ? styles.tabOn : ''}`} onClick={() => setFilter(t.key as any)}>
                        {t.label} {t.n}
                    </button>
                ))}
            </div>

            {ripeTabs.length > 0 && (
                <div className={`${styles.tabs} ${styles.tabsRipe}`}>
                    <button className={`${styles.tab} ${styles.tabRipe} ${ripe === 'tous' ? styles.tabOn : ''}`} onClick={() => setRipe('tous')}>
                        Toutes maturités
                    </button>
                    {ripeTabs.map((t) => (
                        <button
                            key={t.key}
                            className={`${styles.tab} ${styles.tabRipe} ${styles['ripe_' + t.key]} ${ripe === t.key ? styles.tabOn : ''}`}
                            onClick={() => setRipe(t.key)}
                        >
                            <span className={styles.ripeDot} />{t.label} {t.n}
                        </button>
                    ))}
                </div>
            )}

            <div className={styles.toolbar}>
                <div className={styles.searchWrap}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>
                    <input className={styles.search} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher (nom, région, cépage…)" />
                </div>
                <div className={styles.sortWrap}>
                    {([['recent', 'Récent'], ['annee', 'Année'], ['region', 'Région']] as const).map(([k, lbl]) => (
                        <button key={k} className={`${styles.sortBtn} ${sort === k ? styles.sortOn : ''}`} onClick={() => setSort(k)}>{lbl}</button>
                    ))}
                </div>
            </div>
            </div>

            {/* ── Étagère 1 : ce qu'on a chez soi ── */}
            <section
                data-shelf="cave"
                className={`${styles.shelf} ${dropOn === 'cave' ? styles.shelfDrop : ''}`}
                {...dropHandlers('cave')}
            >
                {inCave.length === 0 ? (
                    <div className={styles.empty}>
                        <div className={styles.emptyIc}>
                            <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 22h8M12 15v7M5 3h14l-1 6a6 6 0 0 1-12 0z" /></svg>
                        </div>
                        <h2>Ta cave est vide</h2>
                        <p>Scanne l’étiquette d’une bouteille pour l’ajouter.</p>
                        <button className={styles.cta} onClick={() => setAdding('cave')}>Ajouter un vin</button>
                    </div>
                ) : (
                    <div className={styles.grid}>
                        {inCave.map((w) => (
                            <WineCard key={w.id} bureau={embedded} wine={w} onPair={() => setPairing(w)} onRemove={() => removeWine(w.id)} onOpen={() => setDetailId(w.id)} onZoom={() => w.photo && setZoom(w.photo)} onMenu={(x, y) => setMenu({ wine: w, x, y })} />
                        ))}
                        <AddTile onClick={() => setAdding('cave')} label="Ajouter un vin" />
                    </div>
                )}
            </section>

            {/* ── Étagère 2 : bues, notées, gardées en mémoire ── */}
            <section
                data-shelf="tasted"
                className={`${styles.shelf} ${styles.shelfTasted} ${dropOn === 'tasted' ? styles.shelfDrop : ''}`}
                {...dropHandlers('tasted')}
            >
                <div className={styles.shelfHead}>
                    <div>
                        <h2 className={styles.shelfTitle}>Goûté &amp; approuvé</h2>
                        <p className={styles.shelfSub}>
                            Les bouteilles que tu as bues — ailleurs, ou jusqu’à la dernière.
                            Glisse une carte de ta cave ici, ou descends son stock à zéro.
                        </p>
                    </div>
                </div>

                {tastedList.length === 0 ? (
                    <div className={styles.grid}>
                        <AddTile onClick={() => setAdding('tasted')} label="Une bouteille goûtée" />
                    </div>
                ) : (
                    <div className={styles.grid}>
                        {tastedList.map((w) => (
                            <WineCard key={w.id} bureau={embedded} wine={w} onPair={() => setPairing(w)} onRemove={() => removeWine(w.id)} onOpen={() => setDetailId(w.id)} onZoom={() => w.photo && setZoom(w.photo)} onMenu={(x, y) => setMenu({ wine: w, x, y })} />
                        ))}
                        <AddTile onClick={() => setAdding('tasted')} label="Une bouteille goûtée" />
                    </div>
                )}
            </section>

            {adding && (
                <AddWine
                    shelf={adding}
                    straightToCamera={scanNow}
                    onClose={() => { setAdding(null); setScanNow(false); }}
                />
            )}
            {detail && (
                <WineSheet
                    bureau={embedded}
                    wine={detail}
                    voisines={voisines}
                    onNavigate={setDetailId}
                    onClose={() => setDetailId(null)}
                    onPair={() => setPairing(detail)}
                    onEdit={() => setEditing(detail)}
                    onZoom={() => detail.photo && setZoom(detail.photo)}
                    onRemove={() => { setDetailId(null); removeWine(detail.id); }}
                />
            )}
            {pairing && <PairSheet wine={pairing} onClose={() => setPairing(null)} embedded={embedded} />}
            {editing && <EditWine wine={editing} onClose={() => setEditing(null)} />}
            {menu && (
                <CardMenu
                    wine={menu.wine}
                    onClose={() => setMenu(null)}
                    onPair={() => setPairing(menu.wine)}
                    onEdit={() => setEditing(menu.wine)}
                    onRemove={() => removeWine(menu.wine.id)}
                />
            )}
            {searching && <WineSearch wines={wines} onPick={revealWine} onClose={() => setSearching(false)} />}
            <Tip id="cave" />
            <TVToast />
            {zoom && <ZoomView src={zoom} onClose={() => setZoom(null)} />}
        </div>
    );
}


/**
 * Recherche dans SA cave — vins et liqueurs.
 *
 * La loupe de la barre du bas ouvre ceci, et non la recherche de recettes :
 * dans « Ma cave », ce qu'on cherche est une bouteille. Le champ regarde le nom,
 * la région, le cépage, l'année et la couleur, si bien que « liqueur » ou
 * « rouge » suffisent à trier.
 */
function WineSearch({ wines, onPick, onClose }: { wines: CaveWine[]; onPick: (id: string) => void; onClose: () => void }) {
    const [q, setQ] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    useEffect(() => { inputRef.current?.focus(); }, []);

    const liste = useMemo(() => {
        const all = [...wines].sort((a, b) => b.addedAt - a.addedAt);
        return q.trim() ? all.filter((w) => wineMatches(w, q)) : all;
    }, [wines, q]);

    return createPortal(
        <div className={styles.pickBackdrop} onClick={onClose}>
            <div className={styles.pickSheet} onClick={(e) => e.stopPropagation()}>
                <div className={styles.pickHead}>
                    <div className={styles.pickTitle}>Chercher une bouteille</div>
                    <button className={styles.pickClose} onClick={onClose} aria-label="Fermer">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                    </button>
                </div>
                <input
                    ref={inputRef}
                    className={styles.pickSearch}
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Nom, région, cépage, couleur… (« liqueur », « rouge »)"
                />
                <div className={styles.pickList}>
                    {liste.map((w) => (
                        <button key={w.id} className={styles.pickRow} onClick={() => onPick(w.id)}>
                            {w.photo
                                ? <img src={w.photo} alt="" className={styles.pickThumb} draggable={false} />
                                : <span className={styles.pickDot} style={{ background: COLOR_GLASS[w.color] }} />}
                            <span className={styles.pickInfo}>
                                <span className={styles.pickName}>{stripYear(w.name)}</span>
                                <span className={styles.pickMeta}>
                                    {[COLOR_LABEL[w.color], w.year, w.region, w.grape].filter(Boolean).join(' · ')}
                                </span>
                            </span>
                            {shelfOf(w) === 'tasted' && <span className={styles.pickTag}>Dégusté</span>}
                        </button>
                    ))}
                    {!liste.length && <div className={styles.pickEmpty}>Aucune bouteille à ce nom.</div>}
                </div>
            </div>
        </div>,
        document.body,
    );
}


/**
 * Viseur d'étiquette — on POINTE, ça se déclenche tout seul.
 *
 * Le flux passe dans un <canvas> réduit à 64 px de large. Deux mesures y sont
 * prises à chaque image :
 *   • la NETTETÉ : somme des écarts entre pixels voisins. Une photo floue a des
 *     transitions douces, donc une somme basse — une étiquette lisible tranche.
 *   • la STABILITÉ : écart moyen avec l'image précédente. Un téléphone qu'on
 *     promène change beaucoup ; un téléphone tenu devant une bouteille, presque
 *     pas.
 * Quand les deux sont bonnes pendant 700 ms d'affilée, on prend la photo en
 * pleine résolution et on enchaîne sur la lecture d'étiquette. Le déclencheur
 * manuel reste là pour les cas où la lumière ne veut rien savoir.
 */
function LabelScanner({ onShot, onClose, busy, message }: {
    onShot: (shot: { ocr: string; wide: string }) => void;
    onClose: () => void;
    busy: boolean;
    message: string;
}) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const prev = useRef<Uint8ClampedArray | null>(null);
    const steady = useRef(0);
    const fired = useRef(false);
    const [err, setErr] = useState('');
    const [hint, setHint] = useState('Cadre l’étiquette');
    const [aim, setAim] = useState(0);        // 0 → 1 : à quel point on y est

    const frameRef = useRef<HTMLDivElement>(null);

    /**
     * Photo de ce qui est DANS LE CADRE, pas de toute la pièce.
     *
     * La vidéo est affichée en `object-fit: cover` : l'image source est agrandie
     * puis rognée pour remplir l'écran. On refait donc le calcul à l'envers pour
     * retrouver, en pixels de la caméra, le rectangle que l'utilisateur voit
     * entre les quatre coins — et on ne garde que celui-là. Le plan de travail,
     * le mur de la cuisine et le reste du salon disparaissent d'eux-mêmes.
     */
    /**
     * `expand = 1` → exactement le cadre de visée : l'étiquette pleine largeur,
     * ce qu'il faut au modèle pour LIRE.
     * `expand > 1` → le même centre, en plus large : de quoi garder la bouteille
     * entière pour la PHOTO gardée en cave.
     *
     * Les deux sortent du même instant : on lit sur l'une, on affiche l'autre.
     * Sans ça, viser l'étiquette de près donnait une fiche… avec une étiquette
     * pour toute image.
     */
    const grab = (expand = 1) => {
        const v = videoRef.current;
        const f = frameRef.current;
        if (!v || !v.videoWidth) return null;

        const cv = document.createElement('canvas');
        const ctx = cv.getContext('2d');
        if (!ctx) return null;

        if (f) {
            const vr = v.getBoundingClientRect();
            const fr = f.getBoundingClientRect();
            const scale = Math.max(vr.width / v.videoWidth, vr.height / v.videoHeight);
            // Coin haut-gauche de l'image source tel qu'il est posé à l'écran.
            const offX = vr.left + (vr.width - v.videoWidth * scale) / 2;
            const offY = vr.top + (vr.height - v.videoHeight * scale) / 2;
            const cx = (fr.left + fr.width / 2 - offX) / scale;
            const cy = (fr.top + fr.height / 2 - offY) / scale;
            let w = (fr.width / scale) * expand;
            let h = (fr.height / scale) * expand;
            // On reste dans l'image : élargir ne doit pas décentrer la bouteille.
            w = Math.min(w, v.videoWidth);
            h = Math.min(h, v.videoHeight);
            const sx = Math.min(Math.max(0, cx - w / 2), v.videoWidth - w);
            const sy = Math.min(Math.max(0, cy - h / 2), v.videoHeight - h);
            if (w > 40 && h > 40) {
                cv.width = Math.round(w); cv.height = Math.round(h);
                ctx.drawImage(v, sx, sy, w, h, 0, 0, cv.width, cv.height);
                return cv.toDataURL('image/jpeg', 0.9);
            }
        }
        cv.width = v.videoWidth; cv.height = v.videoHeight;
        ctx.drawImage(v, 0, 0);
        return cv.toDataURL('image/jpeg', 0.9);
    };

    const shoot = () => {
        if (fired.current || busy) return;
        const ocr = grab(1);            // serré : pour lire l'étiquette
        if (!ocr) return;
        const wide = grab(1.9) || ocr;  // large : pour garder la bouteille
        fired.current = true;
        navigator.vibrate?.(14);
        onShot({ ocr, wide });
    };

    // Une lecture ratée relance la surveillance : on ne fige pas le viseur.
    useEffect(() => { if (!busy) { fired.current = false; steady.current = 0; } }, [busy]);

    useEffect(() => {
        let raf = 0;
        let stop = false;

        const start = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
                    audio: false,
                });
                if (stop) { stream.getTracks().forEach((t) => t.stop()); return; }
                streamRef.current = stream;
                const v = videoRef.current;
                if (v) { v.srcObject = stream; await v.play().catch(() => {}); }
                loop();
            } catch (e: any) {
                setErr(e?.name === 'NotAllowedError'
                    ? 'Accès à l’appareil photo refusé. Autorise-le, ou prends la photo depuis la pellicule.'
                    : 'Pas d’appareil photo utilisable ici — prends la photo depuis la pellicule.');
            }
        };

        const loop = () => {
            if (stop) return;
            raf = requestAnimationFrame(loop);
            const v = videoRef.current;
            if (!v || !v.videoWidth || busy || fired.current) return;

            if (!canvasRef.current) canvasRef.current = document.createElement('canvas');
            const cv = canvasRef.current;
            cv.width = 64; cv.height = 48;
            const ctx = cv.getContext('2d', { willReadFrequently: true });
            if (!ctx) return;
            ctx.drawImage(v, 0, 0, 64, 48);
            const img = ctx.getImageData(0, 0, 64, 48).data;

            // Niveaux de gris, puis netteté (contraste local) et mouvement.
            const gray = new Uint8ClampedArray(64 * 48);
            for (let i = 0, p = 0; i < img.length; i += 4, p++) {
                gray[p] = (img[i] * 0.299 + img[i + 1] * 0.587 + img[i + 2] * 0.114) | 0;
            }
            let sharp = 0;
            for (let y = 1; y < 47; y++) {
                for (let x = 1; x < 63; x++) {
                    const p = y * 64 + x;
                    sharp += Math.abs(gray[p] * 2 - gray[p - 1] - gray[p + 1]);
                }
            }
            sharp /= 62 * 46;

            let move = 999;
            if (prev.current) {
                let d = 0;
                for (let i = 0; i < gray.length; i++) d += Math.abs(gray[i] - prev.current[i]);
                move = d / gray.length;
            }
            prev.current = gray;

            const ok = sharp > 6 && move < 4;
            steady.current = ok ? steady.current + 16 : 0;
            setAim(Math.min(1, steady.current / 700));
            setHint(!ok && move >= 4 ? 'Ne bouge plus…'
                : !ok ? 'Approche l’étiquette, cherche la lumière'
                : 'C’est net, on y est');
            if (steady.current >= 700) shoot();
        };

        start();
        return () => {
            stop = true;
            cancelAnimationFrame(raf);
            streamRef.current?.getTracks().forEach((t) => t.stop());
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [busy]);

    return (
        <div className={styles.scanBack}>
            <video ref={videoRef} className={styles.scanVideo} playsInline muted autoPlay />
            <div className={styles.scanVeil} aria-hidden />

            <div className={styles.scanFrame} ref={frameRef}>
                <span className={styles.scanCorner} data-c="tl" />
                <span className={styles.scanCorner} data-c="tr" />
                <span className={styles.scanCorner} data-c="bl" />
                <span className={styles.scanCorner} data-c="br" />
                <div className={styles.scanAim} style={{ transform: `scaleX(${aim})` }} />
            </div>

            <div className={styles.scanTop}>
                <button className={styles.scanClose} onClick={onClose} aria-label="Fermer">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
            </div>

            <div className={styles.scanBottom}>
                <div className={styles.scanHintBig}>
                    {err || (busy ? (message || 'Lecture de l’étiquette…') : hint)}
                </div>
                {!err && !busy && (
                    <p className={styles.scanSub}>Mets l’étiquette dans le cadre — la photo part toute seule, et la bouteille entière est gardée.</p>
                )}
                {/* Sans caméra, le déclencheur n'a rien à déclencher : on renvoie
                    directement vers la pellicule. */}
                {!busy && !err && (
                    <button className={styles.scanShutter} onClick={shoot} aria-label="Prendre la photo">
                        <span />
                    </button>
                )}
                {err && (
                    <button className={styles.scanPick} onClick={onClose}>Choisir une photo</button>
                )}
                {busy && <span className={styles.scanSpin} />}
            </div>
        </div>
    );
}

/**
 * Champ à étiquette flottante : l'étiquette vit DANS le champ et remonte dès
 * qu'on écrit. On garde ainsi le nom de la donnée sous les yeux pendant la
 * saisie — un simple `placeholder` disparaît à la première lettre et on ne sait
 * plus ce qu'on remplit.
 */
function Field({ label, value, onChange, hint, inputMode, autoFocus }: {
    label: string; value: string; onChange: (v: string) => void;
    hint?: string; inputMode?: 'numeric' | 'text'; autoFocus?: boolean;
}) {
    return (
        <label className={`${styles.field} ${value ? styles.fieldFilled : ''}`}>
            <input
                className={styles.fieldInp}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                inputMode={inputMode}
                autoFocus={autoFocus}
                placeholder=" "
            />
            <span className={styles.fieldLbl}>{label}{hint ? <em> · {hint}</em> : null}</span>
        </label>
    );
}

/** Tuile « Ajouter » : elle occupe une case de la grille, juste après la
 *  dernière bouteille, et se décale d'elle-même quand une nouvelle entre. */
function AddTile({ onClick, label }: { onClick: () => void; label: string }) {
    return (
        <button className={styles.addTile} onClick={onClick}>
            <span className={styles.addTileIc}>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            </span>
            <span className={styles.addTileLbl}>{label}</span>
        </button>
    );
}

/* ── Zoom plein écran de la bouteille (molette / pincement + glisser) ──────── */
function ZoomView({ src, onClose }: { src: string; onClose: () => void }) {
    const [scale, setScale] = useState(1);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const drag = useRef<{ x: number; y: number } | null>(null);
    /**
     * Glissé vers le BAS = fermeture, comme partout ailleurs sur un téléphone.
     * On ne l'écoute qu'à l'échelle 1 : une fois zoomé, le même geste sert à
     * déplacer l'image, et fermer sous le doigt serait insupportable.
     */
    const bas = useRef<{ y: number; t: number } | null>(null);
    return (
        <div
            className={styles.zoomBack}
            onClick={onClose}
            onWheel={(e) => { setScale((s) => Math.min(5, Math.max(1, s - e.deltaY * 0.002))); }}
            onPointerDown={(e) => { bas.current = { y: e.clientY, t: Date.now() }; }}
            onPointerUp={(e) => {
                const d = bas.current;
                bas.current = null;
                if (!d || scale > 1) return;
                const parcouru = e.clientY - d.y;
                const rapide = Date.now() - d.t < 700;
                if (parcouru > 90 && rapide) onClose();
            }}
        >
            <button className={styles.zoomClose} onClick={onClose}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
            <img
                src={src} alt="" className={styles.zoomImg} draggable={false}
                style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})` }}
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={() => { setScale((s) => (s > 1 ? 1 : 2.5)); setPos({ x: 0, y: 0 }); }}
                onPointerDown={(e) => { drag.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }; }}
                onPointerMove={(e) => { if (drag.current && scale > 1) setPos({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y }); }}
                onPointerUp={() => { drag.current = null; }}
            />
            <div className={styles.zoomHint}>Molette / double-clic pour zoomer · glisser pour déplacer</div>
        </div>
    );
}

/* ── Carte vin : scène de cave (tonneau) + bouteille ──────────────────────── */
function WineCard({ wine, onPair, onRemove, onOpen, onZoom, onMenu, bureau = false }: { wine: CaveWine; onPair: () => void; onRemove: () => void; onOpen: () => void; onZoom: () => void; onMenu: (x: number, y: number) => void; bureau?: boolean }) {
    const shelf = shelfOf(wine);
    const cardRef = useRef<HTMLDivElement>(null);
    const press = useRef<ReturnType<typeof setTimeout> | null>(null);
    const from = useRef<{ x: number; y: number } | null>(null);
    const touch = useRef(false);
    const pointer = useRef<number | null>(null);
    const [dragging, setDragging] = useState(false);
    const hovered = useRef<HTMLElement | null>(null);
    /** Instant du dernier glissé : un rangement ne doit pas ouvrir la fiche. */
    const glisseA = useRef(0);

    /** Étagère survolée par le doigt, d'après ce qu'il y a sous le point. */
    const shelfUnder = (x: number, y: number) => {
        const el = document.elementFromPoint(x, y) as HTMLElement | null;
        return (el?.closest('[data-shelf]') as HTMLElement | null) || null;
    };
    const highlight = (el: HTMLElement | null) => {
        if (hovered.current === el) return;
        hovered.current?.classList.remove(styles.shelfDrop);
        if (el && el.dataset.shelf !== shelf) el.classList.add(styles.shelfDrop);
        hovered.current = el;
    };
    /** La carte décolle : elle suit le pointeur et cesse d'intercepter les clics
     *  (sinon le point sous le curseur désigne la carte, pas l'étagère visée). */
    const startDrag = (pointerId: number) => {
        if (press.current) { clearTimeout(press.current); press.current = null; }
        navigator.vibrate?.(12);
        setDragging(true);
        const card = cardRef.current;
        if (card) {
            card.style.pointerEvents = 'none';
            card.style.userSelect = 'none';
            try { card.setPointerCapture?.(pointerId); } catch { /* capture refusée */ }
        }
    };

    const endDrag = (x?: number, y?: number) => {
        if (press.current) { clearTimeout(press.current); press.current = null; }
        const card = cardRef.current;
        if (card) { card.style.transform = ''; card.style.zIndex = ''; card.style.pointerEvents = ''; card.style.userSelect = ''; }
        const target = x != null && y != null ? shelfUnder(x, y) : null;
        highlight(null);
        if (dragging) glisseA.current = Date.now();
        setDragging(false);
        from.current = null;
        if (target && target.dataset.shelf && target.dataset.shelf !== shelf) {
            navigator.vibrate?.(14);
            if (target.dataset.shelf === 'tasted') moveToTasted(wine.id); else moveToCave(wine.id);
        }
    };

    return (
        <div
            ref={cardRef}
            data-wine={wine.id}
            className={`${styles.card} ${bureau ? styles.cardBureau : ''} ${shelf === 'tasted' ? styles.cardTasted : ''} ${dragging ? styles.cardDragging : ''}`}
            /* Maintenir la carte la DÉCOLLE et la fait suivre le doigt : c'est le
               geste attendu pour la ranger d'une étagère à l'autre. Le menu, lui,
               reste au clic droit (et sur le « ⋯ » de la carte, seule voie au
               doigt puisque le clic droit n'existe pas sur un téléphone). */
            onContextMenu={(e) => { e.preventDefault(); onMenu(e.clientX, e.clientY); }}
            onPointerDown={(e) => {
                if (e.button === 2) return;                    // clic droit : au menu
                const { clientX, clientY, pointerId } = e;
                from.current = { x: clientX, y: clientY };
                touch.current = e.pointerType !== 'mouse';
                pointer.current = pointerId;
                // Au DOIGT, l'appui immobile ouvre le menu (il n'y a pas de clic
                // droit sur un téléphone). Le glissé, lui, part au premier
                // mouvement LATÉRAL — les deux gestes ne se marchent donc pas
                // dessus, et un mouvement vertical reste un défilement de page.
                if (touch.current) {
                    press.current = setTimeout(() => {
                        press.current = null;
                        from.current = null;
                        navigator.vibrate?.(12);
                        onMenu(clientX, clientY);
                    }, 480);
                }
            }}
            onPointerMove={(e) => {
                if (!from.current) return;
                const dx = e.clientX - from.current.x;
                const dy = e.clientY - from.current.y;
                if (!dragging) {
                    if (!touch.current) {
                        // Souris : trois pixels suffisent à dire qu'on tire.
                        if (Math.hypot(dx, dy) > 3) startDrag(pointer.current ?? e.pointerId);
                        return;
                    }
                    // Doigt : de côté on range, vers le haut ou le bas on défile.
                    if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
                        startDrag(pointer.current ?? e.pointerId);
                    } else if (Math.abs(dy) > 12) {
                        if (press.current) { clearTimeout(press.current); press.current = null; }
                        from.current = null;
                    }
                    return;
                }
                const card = cardRef.current;
                if (card) { card.style.transform = `translate(${dx}px, ${dy}px) scale(1.04)`; card.style.zIndex = '50'; }
                highlight(shelfUnder(e.clientX, e.clientY));
            }}
            onPointerUp={(e) => endDrag(e.clientX, e.clientY)}
            onPointerCancel={() => endDrag()}
        >
            <div className={styles.scene}>
                <div className={styles.spot} />
                {/* L'étagère de bois reste au doigt. Sur un écran d'ordinateur,
                    six rangées de planches dessinées font décor de brasserie :
                    la bouteille s'y pose sur une ombre de contact et rien de
                    plus (voir `.cardBureau .scene`). */}
                {!bureau && <div className={styles.barrel} />}
                {bureau && <div className={styles.pose} aria-hidden />}
                {/* La bouteille ouvre SA FICHE — pas un simple agrandissement :
                    millésime, cépage, origine, stock et notes y tiennent
                    ensemble, comme sur une fiche de recette. La loupe, elle,
                    reste l'agrandissement pur. */}
                <div
                    className={styles.bottle}
                    onClick={(e) => {
                        e.stopPropagation();
                        // Le relâchement d'un glissé produit aussi un clic : on
                        // ouvrirait la fiche juste après avoir rangé la carte.
                        if (Date.now() - glisseA.current < 320) return;
                        onOpen();
                    }}
                >
                    {wine.photo
                        ? <img src={wine.photo} alt="" className={styles.bottlePhoto} draggable={false} />
                        : <BottleSVG color={wine.color} />}
                </div>
                {wine.photo && (
                    <button className={styles.zoomBtn} onClick={(e) => { e.stopPropagation(); onZoom(); }} aria-label="Agrandir">
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4M11 8v6M8 11h6" /></svg>
                    </button>
                )}
                <span className={`${styles.colorTag} ${styles['tag_' + wine.color]}`}>{COLOR_LABEL[wine.color]}</span>
                {/* Le stock se lit SUR l'affiche : c'est ce qu'on cherche en
                    balayant l'étagère (« qu'est-ce qu'il me reste ? »). Les
                    boutons + et −, eux, n'ont pas à occuper une ligne sous
                    chaque bouteille : ils viennent au survol. */}
                {bureau && shelf === 'cave' && (wine.qty ?? 1) !== 1 && (
                    <span className={styles.qtyBadge} aria-label={`${wine.qty ?? 1} bouteilles`}>{wine.qty ?? 1}</span>
                )}
                <button className={styles.del} onClick={(e) => { e.stopPropagation(); onRemove(); }} aria-label="Retirer">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>

                {/* Commandes au survol. Elles restent DANS le document (lisibles
                    au clavier, annoncées aux lecteurs d'écran) : seule leur
                    opacité change. */}
                {bureau && (
                    <div className={styles.survol}>
                        {shelf === 'cave' ? (
                            <div className={styles.stepper}>
                                <button onClick={(e) => { e.stopPropagation(); setQty(wine.id, (wine.qty ?? 1) - 1); }} aria-label="Une bouteille de moins">−</button>
                                <span>{wine.qty ?? 1}</span>
                                <button onClick={(e) => { e.stopPropagation(); setQty(wine.id, (wine.qty ?? 1) + 1); }} aria-label="Une bouteille de plus">+</button>
                            </div>
                        ) : (
                            <button className={styles.openBtn} onClick={(e) => { e.stopPropagation(); moveToCave(wine.id); }}>Remettre en cave</button>
                        )}
                        <button className={styles.pairBtn} onClick={(e) => { e.stopPropagation(); onPair(); }}>
                            Quelle recette
                            <svg viewBox="0 0 8 14" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1l6 6-6 6" /></svg>
                        </button>
                    </div>
                )}
            </div>
            <div className={styles.info}>
                <div className={styles.wName}>
                    {stripYear(wine.name)}
                    {wine.year ? <span className={styles.wYear}> · {wine.year}</span> : null}
                </div>
                <div className={styles.wMeta}>{[wine.grape, wine.region].filter(Boolean).join(' · ')}</div>
                {/*
                 * Sur ordinateur, les trois blocs qui suivaient (tes étoiles, la
                 * note publique, l'état de maturité) tiennent sur UNE ligne.
                 * Empilés, ils faisaient descendre l'affiche suivante de cent
                 * pixels et donnaient à la grille son air de formulaire.
                 */}
                {bureau ? (
                    <div className={styles.ligneNotes}>
                        <MyStars value={wine.myRating ?? 0} onSet={(n) => updateWine(wine.id, { myRating: n })} />
                        {wine.rating ? (
                            <span className={styles.rating} title="Note des dégustateurs">★ {wine.rating.toFixed(1).replace('.', ',')}</span>
                        ) : null}
                        {(() => {
                            const w = drinkWindow(wine);
                            if (!w) return null;
                            const cls = w.status === 'tard' ? styles.apoLate
                                : w.status === 'jeune' ? styles.apoWait
                                : w.status === 'apogee' ? styles.apoPeak
                                : styles.apoNow;
                            return <span className={`${styles.apogee} ${cls}`} title={w.label}><span className={styles.apoTexte}>{w.label}</span></span>;
                        })()}
                    </div>
                ) : (<></>)}
                {/* Au doigt, les trois blocs restent empilés : il n'y a pas de
                    survol pour aller les chercher, et la colonne est étroite. */}
                {!bureau && (<>
                {/* Ta note à gauche (cliquable), celle des dégustateurs à droite —
                    elles ne disent pas la même chose et ne doivent pas se
                    confondre. La rangée ne se rogne plus : la note publique
                    disparaissait derrière une hauteur fixe. */}
                <div className={styles.ratings}>
                    <MyStars
                        value={wine.myRating ?? 0}
                        onSet={(n) => updateWine(wine.id, { myRating: n })}
                    />
                    {wine.rating ? (
                        <span className={styles.rating} title="Note des dégustateurs">
                            ★ {wine.rating.toFixed(1)}<small>/5</small>
                        </span>
                    ) : null}
                </div>
                <div className={styles.apoSlot}>
                    {(() => {
                        const w = drinkWindow(wine);
                        if (!w) return null;
                        const cls = w.status === 'tard' ? styles.apoLate
                            : w.status === 'jeune' ? styles.apoWait
                            : w.status === 'apogee' ? styles.apoPeak
                            : styles.apoNow;
                        return <span className={`${styles.apogee} ${cls}`}>{w.label}</span>;
                    })()}
                </div>
                {/* Une seule ligne d'actions, en texte : le stock à gauche (ou le
                    retour en cave), l'accord à droite. Un filet les sépare du
                    reste — plus de pile de dalles sous chaque bouteille. */}
                <div className={styles.stockRow}>
                    {shelf === 'cave' ? (
                        <div className={styles.stepper}>
                            <button onClick={(e) => { e.stopPropagation(); setQty(wine.id, (wine.qty ?? 1) - 1); }} aria-label="Moins">−</button>
                            <span>{wine.qty ?? 1}</span>
                            <button onClick={(e) => { e.stopPropagation(); setQty(wine.id, (wine.qty ?? 1) + 1); }} aria-label="Plus">+</button>
                        </div>
                    ) : (
                        <button className={styles.openBtn} onClick={(e) => { e.stopPropagation(); moveToCave(wine.id); }}>+ Ma cave</button>
                    )}
                    <button className={styles.pairBtn} onClick={onPair}>
                        Quelle recette
                        <svg viewBox="0 0 8 14" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1l6 6-6 6" /></svg>
                    </button>
                </div>
                </>)}
            </div>
        </div>
    );
}

/**
 * Note personnelle : cinq étoiles cliquables, distinctes de la note globale.
 * Retoucher l'étoile déjà active efface la note (on s'est trompé de doigt).
 */
function MyStars({ value, onSet, big = false }: { value: number; onSet: (n: number) => void; big?: boolean }) {
    return (
        <span className={`${styles.myStars} ${big ? styles.myStarsBig : ''}`} title="Ta note">
            {[1, 2, 3, 4, 5].map((n) => (
                <button
                    key={n}
                    className={`${styles.myStar} ${n <= value ? styles.myStarOn : ''}`}
                    aria-label={`Mettre ${n} sur 5`}
                    onClick={(e) => { e.stopPropagation(); onSet(n === value ? 0 : n); }}
                >
                    ★
                </button>
            ))}
        </span>
    );
}

/**
 * Menu d'une bouteille — clic droit sur desktop, appui long sur iPhone où le
 * clic droit n'existe pas. Il réunit les deux gestes utiles sur une carte :
 * l'accord avec une recette et la correction de la fiche.
 */
function CardMenu({ wine, onClose, onPair, onEdit, onRemove }: {
    wine: CaveWine;
    onClose: () => void; onPair: () => void; onEdit: () => void; onRemove: () => void;
}) {
    const Item = ({ d, label, danger, onClick }: { d: string; label: string; danger?: boolean; onClick: () => void }) => (
        <button
            className={`${tv.menuAction} ${danger ? tv.menuDanger : ''}`}
            onClick={() => { navigator.vibrate?.(8); onClick(); onClose(); }}
        >
            <svg className={tv.menuIcon} viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d={d} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{label}</span>
        </button>
    );
    return (
        <div className={tv.menuBackdrop} onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }}>
            <div className={tv.menuCard} onClick={(e) => e.stopPropagation()}>
                {wine.photo && <img className={tv.menuPreview} src={wine.photo} alt="" draggable={false} />}
                <div className={tv.menuTitle}>{stripYear(wine.name)}</div>
                <div className={tv.menuActions}>
                    <Item d="M4 4h16M7 4v6a5 5 0 0 0 10 0V4M12 15v5M9 20h6" label="Quelle recette ?" onClick={onPair} />
                    <Item d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" label="Corriger la fiche" onClick={onEdit} />
                    {shelfOf(wine) === 'cave' ? (
                        <Item d="M5 12l5 5L20 7" label="Ranger dans « Goûté & approuvé »" onClick={() => moveToTasted(wine.id)} />
                    ) : (
                        <Item d="M8 22h8M12 15v7M5 3h14l-1 6a6 6 0 0 1-12 0z" label="Remettre dans ma cave" onClick={() => moveToCave(wine.id)} />
                    )}
                    <Item d="M6 6l12 12M18 6L6 18" label="Retirer de la cave" danger onClick={onRemove} />
                </div>
            </div>
        </div>
    );
}

/**
 * Modifier une bouteille — depuis le menu de sa carte.
 * L'IA se trompe (une couleur, un millésime, un cépage) : cette fiche permet de
 * rectifier sans repasser par un scan, dans le même langage visuel que le reste
 * de la cave plutôt que dans le vieux formulaire.
 */
function EditWine({ wine, onClose }: { wine: CaveWine; onClose: () => void }) {
    const [f, setF] = useState({
        name: wine.name, grape: wine.grape, year: wine.year,
        color: wine.color, region: wine.region, note: wine.note || '',
        photo: wine.photo || '', qty: wine.qty ?? 1, myRating: wine.myRating ?? 0,
    });
    const [busyPhoto, setBusyPhoto] = useState(false);
    const save = async () => {
        const name = f.name.trim();
        if (!name) return;
        // Une adresse collée ici passe par la scène de cave, exactement comme au
        // scan : c'est le geste par lequel arrivent les photos sur fond blanc.
        const lien = f.photo.trim();
        let photo = lien || undefined;
        if (lien && !lien.startsWith('data:') && lien !== wine.photo) {
            setBusyPhoto(true);
            photo = (await studioFromUrl(lien)) || lien;
            setBusyPhoto(false);
        }
        updateWine(wine.id, { ...f, name, photo });
        onClose();
    };
    return createPortal(
        <div className={`${styles.backdrop} ${styles.backdropTop}`} onClick={onClose}>
            <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
                <div className={styles.sheetHead}>
                    <div>
                        <div className={styles.sheetKick}>Corriger la fiche</div>
                        <div className={styles.sheetTitle}>{wine.name}</div>
                    </div>
                    <button className={styles.sheetClose} onClick={onClose} aria-label="Fermer">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                    </button>
                </div>

                <div className={styles.addBody}>
                    {/* La bouteille reste sous les yeux pendant qu'on corrige :
                        c'est elle qu'on décrit, elle doit tenir la vedette. */}
                    <div className={styles.editHero}>
                        <div className={styles.editHeroGlow} aria-hidden />
                        {(f.photo || wine.photo)
                            ? <img className={styles.editHeroImg} src={f.photo || wine.photo} alt="" />
                            : <span className={styles.editHeroFallback}><BottleSVG color={f.color} /></span>}
                    </div>

                    <div className={styles.fields}>
                        <Field label="Nom du vin" value={f.name} onChange={(v) => setF({ ...f, name: v })} autoFocus />
                        <div className={styles.two}>
                            <Field label="Cépage" value={f.grape} onChange={(v) => setF({ ...f, grape: v })} />
                            <Field label="Année" value={f.year} onChange={(v) => setF({ ...f, year: v })} inputMode="numeric" />
                        </div>
                        <Field label="Région / appellation" value={f.region} onChange={(v) => setF({ ...f, region: v })} />
                        <Field label="Note de dégustation" value={f.note} onChange={(v) => setF({ ...f, note: v })} />
                        <Field label="Lien de la photo" value={f.photo} onChange={(v) => setF({ ...f, photo: v })} hint="facultatif" />

                        <div className={styles.editLabel}>Couleur</div>
                        <div className={styles.colorPick}>
                            {(['rouge', 'blanc', 'rose', 'liqueur'] as WineColor[]).map((c) => (
                                <button key={c} className={`${styles.colorOpt} ${f.color === c ? styles.colorOptOn : ''}`} onClick={() => setF({ ...f, color: c })}>
                                    <span className={styles.colorDot} style={{ background: COLOR_GLASS[c] }} />{COLOR_LABEL[c]}
                                </button>
                            ))}
                        </div>

                        <div className={styles.editRow}>
                            <div>
                                <div className={styles.editLabel}>Bouteilles</div>
                                <div className={styles.stepper}>
                                    <button onClick={() => setF({ ...f, qty: Math.max(0, f.qty - 1) })} aria-label="Moins">−</button>
                                    <span>{f.qty}</span>
                                    <button onClick={() => setF({ ...f, qty: f.qty + 1 })} aria-label="Plus">+</button>
                                </div>
                            </div>
                            <div>
                                <div className={styles.editLabel}>Ta note</div>
                                <MyStars big value={f.myRating} onSet={(n) => setF({ ...f, myRating: n })} />
                            </div>
                        </div>
                    </div>

                    <button className={styles.saveBtn} onClick={save} disabled={!f.name.trim() || busyPhoto}>
                        {busyPhoto ? 'Mise en scène de la photo…' : 'Enregistrer'}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}

/**
 * LA FICHE D'UNE BOUTEILLE — l'écran qu'on ouvre en touchant une bouteille.
 * =========================================================================
 *
 * Toucher une bouteille ne faisait que l'agrandir : une photo, et rien d'autre.
 * On ouvre maintenant une vraie fiche, bâtie comme celle d'une recette : la
 * photo flotte en grand sur fond sombre, et TOUT ce qu'on veut savoir se lit
 * dessous — millésime, cépage, origine, ce qu'il en reste en cave, la note des
 * dégustateurs et la sienne.
 *
 * Deux boutons mènent l'écran :
 *   • « Quelle recette ? » — les plats du site qui vont avec celle-ci ;
 *   • « Est-elle à maturité ? » — la réponse d'œnologue, avec la fenêtre de
 *     dégustation en clair, dépliée sur place plutôt que cachée ailleurs.
 */
function WineSheet({ wine, voisines, onNavigate, onClose, onPair, onEdit, onZoom, onRemove, bureau = false }: {
    /** Panneau de bureau : la fiche s'ouvre sur deux colonnes au lieu d'une. */
    bureau?: boolean;
    wine: CaveWine;
    /** Les bouteilles de la même catégorie, dans l'ordre de la page. */
    voisines: CaveWine[];
    onNavigate: (id: string) => void;
    onClose: () => void;
    onPair: () => void;
    onEdit: () => void;
    onZoom: () => void;
    onRemove: () => void;
}) {
    const shelf = shelfOf(wine);
    const maturite = useMemo(() => drinkRange(wine), [wine]);
    const profil = useMemo(() => wineProfile(wine), [wine]);
    const [ouvertMaturite, setOuvertMaturite] = useState(false);

    const rang = Math.max(0, voisines.findIndex((w) => w.id === wine.id));
    const precedente = rang > 0 ? voisines[rang - 1] : null;
    const suivante = rang < voisines.length - 1 ? voisines[rang + 1] : null;

    const feuille = useRef<HTMLDivElement | null>(null);
    const fond = useRef<HTMLDivElement | null>(null);
    const corps = useRef<HTMLDivElement | null>(null);
    /**
     * Sens de l'arrivée : la nouvelle fiche entre par où l'ancienne est sortie.
     *
     * C'est une RÉFÉRENCE et non un état : en état, le rendu déclenché par sa
     * remise à zéro nettoyait l'effet, qui annulait l'image programmée — la
     * fiche restait figée hors de l'écran, à 385 px sur le côté.
     */
    const sensEntree = useRef<'gauche' | 'droite' | null>(null);

    /**
     * Déplacer la feuille SANS repasser par React.
     *
     * Un glissé piloté par un `useState` rend à chaque image : le doigt prend de
     * l'avance sur l'écran, et c'est exactement ce qui fait « cheap ». On écrit
     * donc directement dans le style, comme les fiches de recettes.
     */
    const poser = (x: number, y: number, opacite?: number) => {
        const el = feuille.current;
        if (el) el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        if (fond.current && opacite !== undefined) fond.current.style.opacity = String(opacite);
    };
    const avecTransition = (ms = 260) => {
        const el = feuille.current;
        if (el) el.style.transition = `transform ${ms}ms cubic-bezier(.32,.72,0,1)`;
        if (fond.current) fond.current.style.transition = `opacity ${ms}ms linear`;
    };
    const sansTransition = () => {
        if (feuille.current) feuille.current.style.transition = 'none';
        if (fond.current) fond.current.style.transition = 'none';
    };

    /** Referme en poursuivant le geste vers le bas, au lieu de disparaître net. */
    const fermerEnGlissant = () => {
        avecTransition(240);
        poser(0, window.innerHeight, 0);
        setTimeout(onClose, 200);
    };

    /** Change de bouteille : la fiche sort d'un côté, la suivante entre de l'autre. */
    const aller = (vers: 'precedente' | 'suivante') => {
        const cible = vers === 'precedente' ? precedente : suivante;
        if (!cible) { avecTransition(); poser(0, 0, 1); return; }
        const large = feuille.current?.offsetWidth || window.innerWidth;
        avecTransition(180);
        poser(vers === 'precedente' ? large : -large, 0, 1);
        setTimeout(() => {
            sensEntree.current = vers === 'precedente' ? 'gauche' : 'droite';
            onNavigate(cible.id);
        }, 170);
    };

    // La fiche qui arrive se pose depuis le côté d'où vient le geste.
    useEffect(() => {
        const sens = sensEntree.current;
        sensEntree.current = null;
        const large = feuille.current?.offsetWidth || window.innerWidth;
        if (!sens) { sansTransition(); poser(0, 0, 1); return; }
        sansTransition();
        poser(sens === 'gauche' ? -large : large, 0, 1);
        // DEUX images : la première peint la position de départ, la seconde
        // lance le glissement. Avec une seule, le navigateur regroupe les deux
        // écritures et la transition n'a rien à animer.
        let vivant = true;
        requestAnimationFrame(() => requestAnimationFrame(() => {
            if (!vivant) return;
            avecTransition(220);
            poser(0, 0, 1);
        }));
        return () => { vivant = false; };
    }, [wine.id]);

    // Changer de bouteille referme le volet de maturité : il parlait de l'autre.
    useEffect(() => { setOuvertMaturite(false); }, [wine.id]);

    /**
     * Les gestes, branchés à la main en `passive: false`.
     *
     * React pose ses écouteurs `touchmove` en mode passif : le `preventDefault`
     * n'y a aucun effet, et Safari garde son propre rebond élastique par-dessus
     * notre déplacement. Même remède que dans les fiches de recettes.
     */
    useEffect(() => {
        const el = feuille.current;
        if (!el) return;
        let x0 = 0, y0 = 0, dernierY = 0, dernierT = 0, vitesse = 0;
        let sens: 'aucun' | 'vertical' | 'horizontal' = 'aucun';
        let actif = false;

        const debut = (e: TouchEvent) => {
            const t = e.touches[0];
            x0 = t.clientX; y0 = t.clientY; dernierY = t.clientY;
            dernierT = performance.now(); vitesse = 0; sens = 'aucun'; actif = true;
            sansTransition();
        };
        const bouge = (e: TouchEvent) => {
            if (!actif) return;
            const t = e.touches[0];
            const dx = t.clientX - x0, dy = t.clientY - y0;
            const maintenant = performance.now();
            const dt = maintenant - dernierT;
            if (dt > 0) vitesse = (t.clientY - dernierY) / dt;
            dernierY = t.clientY; dernierT = maintenant;

            if (sens === 'aucun') {
                if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 7) sens = 'horizontal';
                else if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 7) sens = 'vertical';
            }
            // Vers le bas seulement, et seulement si le contenu est en haut :
            // sinon on empêcherait de lire la fiche jusqu'au bout.
            const enHaut = (corps.current?.scrollTop ?? 0) <= 0;
            if (sens === 'vertical' && dy > 0 && enHaut) {
                e.preventDefault();
                // Résistance : la feuille suit le doigt à moitié, ce qui donne
                // le poids qu'on attend d'un objet qu'on repousse.
                poser(0, dy * 0.5, Math.max(0.15, 1 - dy / 520));
            } else if (sens === 'horizontal') {
                e.preventDefault();
                const bout = (dx > 0 && !precedente) || (dx < 0 && !suivante);
                poser(dx * (bout ? 0.22 : 1), 0, 1);
            }
        };
        const fin = () => {
            if (!actif) return;
            actif = false;
            const m = (feuille.current?.style.transform || '').match(/translate3d\(([-\d.]+)px, ([-\d.]+)px/);
            const dx = m ? parseFloat(m[1]) : 0;
            const dy = m ? parseFloat(m[2]) : 0;
            const large = feuille.current?.offsetWidth || window.innerWidth;
            if (sens === 'vertical') {
                // Un geste vif ferme sans avoir à parcourir toute la distance.
                if (dy > 110 || (vitesse * 1000 > 700 && dy > 20)) fermerEnGlissant();
                else { avecTransition(); poser(0, 0, 1); }
            } else if (sens === 'horizontal') {
                if (dx < -large * 0.25) aller('suivante');
                else if (dx > large * 0.25) aller('precedente');
                else { avecTransition(); poser(0, 0, 1); }
            }
            sens = 'aucun';
        };

        const opts = { passive: false } as AddEventListenerOptions;
        el.addEventListener('touchstart', debut, opts);
        el.addEventListener('touchmove', bouge, opts);
        el.addEventListener('touchend', fin, opts);
        el.addEventListener('touchcancel', fin, opts);
        return () => {
            el.removeEventListener('touchstart', debut);
            el.removeEventListener('touchmove', bouge);
            el.removeEventListener('touchend', fin);
            el.removeEventListener('touchcancel', fin);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [wine.id, precedente?.id, suivante?.id]);

    // Échap ferme, flèches pour changer de bouteille — au clavier comme au doigt.
    useEffect(() => {
        const touche = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            else if (e.key === 'ArrowRight' && suivante) aller('suivante');
            else if (e.key === 'ArrowLeft' && precedente) aller('precedente');
        };
        window.addEventListener('keydown', touche);
        return () => window.removeEventListener('keydown', touche);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onClose, suivante?.id, precedente?.id]);

    const classeMaturite = maturite?.status === 'tard' ? styles.apoLate
        : maturite?.status === 'jeune' ? styles.apoWait
        : maturite?.status === 'apogee' ? styles.apoPeak
        : styles.apoNow;

    /** Une ligne de la fiche : l'intitulé à gauche, la valeur à droite. */
    const Ligne = ({ label, children }: { label: string; children: React.ReactNode }) => (
        <div className={styles.fRow}>
            <span className={styles.fLabel}>{label}</span>
            <span className={styles.fValue}>{children}</span>
        </div>
    );

    return createPortal(
        <div className={styles.fBack} onClick={onClose}>
            {/* Le voile s'efface à mesure qu'on repousse la fiche : c'est lui qui
                fait sentir qu'on la renvoie vers la cave, et non qu'elle s'éteint. */}
            <div className={styles.fVoile} ref={fond} aria-hidden />

            {/* Aux flèches, sur un ordinateur : le glissé n'existe qu'au doigt. */}
            {precedente && (
                <button className={`${styles.fNav} ${styles.fNavPrev}`} onClick={(e) => { e.stopPropagation(); aller('precedente'); }} aria-label={`Bouteille précédente : ${stripYear(precedente.name)}`}>
                    <svg viewBox="0 0 8 14" width="14" height="14" fill="none"><path d="M7 1L1 7l6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
            )}
            {suivante && (
                <button className={`${styles.fNav} ${styles.fNavNext}`} onClick={(e) => { e.stopPropagation(); aller('suivante'); }} aria-label={`Bouteille suivante : ${stripYear(suivante.name)}`}>
                    <svg viewBox="0 0 8 14" width="14" height="14" fill="none"><path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
            )}

            <div
                className={`${styles.fSheet} ${bureau ? styles.fSheetBureau : ''}`}
                ref={(el) => { feuille.current = el; corps.current = el; }}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-label={wine.name}
            >
                {/* Poignée : elle annonce que la fiche se repousse vers le bas. */}
                <div className={styles.fPoignee} aria-hidden />
                <button className={styles.fClose} onClick={onClose} aria-label="Fermer">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>

                {/* La bouteille flotte : halo sous elle, fond de cave derrière. */}
                <div className={styles.fHero} onClick={() => wine.photo && onZoom()}>
                    <div className={styles.fHalo} aria-hidden />
                    {wine.photo
                        ? <img src={wine.photo} alt="" className={styles.fPhoto} draggable={false} />
                        : <span className={styles.fPhotoVide}><BottleSVG color={wine.color} /></span>}
                    <span className={`${styles.colorTag} ${styles['tag_' + wine.color]} ${styles.fTag}`}>{COLOR_LABEL[wine.color]}</span>
                </div>

                <div className={styles.fTitre}>{stripYear(wine.name)}</div>
                <div className={styles.fSous}>
                    {[wine.year, wine.region].filter(Boolean).join(' · ') || profil.style}
                </div>

                {/* Où l'on se trouve dans la catégorie — sans ça, le glissé
                    donne l'impression de tourner en rond. */}
                {voisines.length > 1 && (
                    <div className={styles.fRang}>
                        {voisines.map((v, i) => (
                            <span key={v.id} className={`${styles.fPuce} ${i === rang ? styles.fPuceOn : ''}`} />
                        ))}
                        <span className={styles.fRangTexte}>{COLOR_LABEL[wine.color].toLowerCase()}s · {rang + 1}/{voisines.length}</span>
                    </div>
                )}

                {/* Les deux gestes de l'écran, côte à côte. */}
                <div className={styles.fActions}>
                    <button className={styles.fPrim} onClick={onPair}>
                        Quelle recette ?
                    </button>
                    <button
                        className={`${styles.fSec} ${ouvertMaturite ? styles.fSecOn : ''}`}
                        onClick={() => setOuvertMaturite((v) => !v)}
                        disabled={!maturite}
                        title={maturite ? '' : 'Sans millésime, impossible de le dire'}
                    >
                        {maturite ? 'Est-elle à maturité ?' : 'Millésime inconnu'}
                    </button>
                </div>

                {ouvertMaturite && maturite && (
                    <div className={styles.fMaturite}>
                        <span className={`${styles.apogee} ${classeMaturite}`}>{maturite.label}</span>
                        <p className={styles.fMaturiteTexte}>{maturite.phrase}</p>
                    </div>
                )}

                <div className={styles.fRows}>
                    <Ligne label="Année">{wine.year || '—'}</Ligne>
                    <Ligne label="Cépage">{wine.grape || '—'}</Ligne>
                    <Ligne label="Origine">{wine.region || '—'}</Ligne>
                    <Ligne label={shelf === 'cave' ? 'Dans ma cave' : 'Étagère'}>
                        {shelf === 'cave' ? (
                            <span className={styles.stepper}>
                                <button onClick={() => setQty(wine.id, (wine.qty ?? 1) - 1)} aria-label="Moins">−</button>
                                <span>{wine.qty ?? 1}</span>
                                <button onClick={() => setQty(wine.id, (wine.qty ?? 1) + 1)} aria-label="Plus">+</button>
                            </span>
                        ) : (
                            <button className={styles.openBtn} onClick={() => moveToCave(wine.id)}>Goûté — remettre en cave</button>
                        )}
                    </Ligne>
                    <Ligne label="Note Google">
                        {wine.rating
                            ? <a
                                className={styles.fNoteLien}
                                href={wine.vivinoUrl || `https://www.google.com/search?q=${encodeURIComponent(`${wine.name} ${wine.year || ''} vin avis`.trim())}`}
                                target="_blank" rel="noopener noreferrer"
                              >★ {wine.rating.toFixed(1).replace('.', ',')}<small>/5</small></a>
                            : <a
                                className={styles.fNoteLien}
                                href={`https://www.google.com/search?q=${encodeURIComponent(`${wine.name} ${wine.year || ''} vin avis`.trim())}`}
                                target="_blank" rel="noopener noreferrer"
                              >Chercher les avis</a>}
                    </Ligne>
                    <Ligne label="Ma note">
                        <MyStars value={wine.myRating ?? 0} onSet={(n) => updateWine(wine.id, { myRating: n })} />
                    </Ligne>
                </div>

                {wine.note && <p className={styles.fNote}>{wine.note}</p>}

                <div className={styles.fPied}>
                    <button className={styles.fLien} onClick={onEdit}>Corriger la fiche</button>
                    {shelf === 'cave'
                        ? <button className={styles.fLien} onClick={() => { moveToTasted(wine.id); onClose(); }}>Ranger dans « Goûté &amp; approuvé »</button>
                        : null}
                    <button className={`${styles.fLien} ${styles.fLienDanger}`} onClick={onRemove}>Retirer</button>
                </div>
            </div>
        </div>,
        document.body,
    );
}

/* ── Accord : recettes du site pour ce vin ────────────────────────────────── */
function PairSheet({ wine, onClose, embedded }: { wine: CaveWine; onClose: () => void; embedded?: boolean }) {
    const accords = useMemo(() => recipesForWine(wine, mockRecipes as any, 12), [wine]);
    const profil = useMemo(() => wineProfile(wine), [wine]);
    /**
     * Encastrée dans le shell desktop, la cave ouvre la fiche FLOTTANTE
     * (`openRecipeFromPlanner`) : la barre latérale et le titre « Ma cave »
     * restent en place. L'event `openRecipe` déclencherait la fiche plein
     * écran, qui recouvre le menu et fait perdre le fil.
     */
    const open = (r: any) => {
        // Même règle que les favoris : c'est l'hôte global qui ouvre une fiche
        // depuis un écran, dans les deux cas. `openRecipe` n'empile que DANS une
        // fiche déjà ouverte — hors du shell, personne ne l'écoutait.
        window.dispatchEvent(new CustomEvent('openRecipeFromPlanner', { detail: r }));
        onClose();
    };
    // Portail et z-index haut : cette feuille s'ouvre DEPUIS la fiche de la
    // bouteille, elle doit donc passer par-dessus elle. Rendue sur place, elle
    // se retrouvait derrière, et le clic sur « Quelle recette ? » semblait sans
    // effet.
    return createPortal(
        <div className={`${styles.backdrop} ${styles.backdropTop}`} onClick={onClose}>
            <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
                <div className={styles.sheetHead}>
                    <div>
                        <div className={styles.sheetKick}>Avec {wine.name}</div>
                        {/* Le style du vin, pas seulement sa couleur : c'est lui qui
                            explique pourquoi ces plats-là et pas d'autres. */}
                        <div className={styles.sheetTitle}>Ce que demande {profil.style}</div>
                    </div>
                    <button className={styles.sheetClose} onClick={onClose}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
                </div>
                <div className={styles.pairGrid}>
                    {accords.map(({ recipe: r, why }: any) => (
                        <button key={r.id} className={styles.pairCard} onClick={() => open(r)}>
                            <img src={r.image} alt="" />
                            <span>{decodeHtml(r.title)}</span>
                            {/* La RAISON de l'accord : sans elle, une grille de photos
                                ne vaut pas mieux qu'une liste au hasard. */}
                            <em className={styles.pairWhy}>{why}</em>
                        </button>
                    ))}
                    {!accords.length && (
                        <div className={styles.pairEmpty}>Aucun plat du site ne s’impose pour cette bouteille.</div>
                    )}
                </div>
            </div>
        </div>,
        document.body,
    );
}

/* ── Ajout d'un vin : scan étiquette → ajout automatique ──────────────────── */
type Official = { photo?: string; rating?: number; vivinoUrl?: string };

/** Ce que `/api/wine-lookup` renvoie : la lecture de l'étiquette, enrichie. */
type VinLu = {
    name: string; grape?: string; year?: string; color?: string;
    region?: string; note?: string;
} & Official;

/**
 * Mise à l'échelle d'une bouteille — désormais déléguée à `bouteille.ts`.
 *
 * L'ancienne version peignait ICI le fond de cave et la vignette, puis la carte
 * repeignait par-dessus son propre décor en CSS : deux décors superposés, et le
 * rectangle de la photo qui se voyait. Elle mettait par ailleurs à l'échelle le
 * FICHIER et non la bouteille, d'où des silhouettes de tailles très différentes
 * d'une fiche à l'autre.
 *
 * On ne garde donc que les noms — appelés depuis sept endroits — et le résultat
 * sort maintenant DÉTOURÉ, sur fond transparent, à hauteur et ligne de pose
 * fixes. Le décor appartient à la carte.
 */
const toStudio = async (dataUrl: string, _l?: number, h?: number, opts: { qualite?: number } = {}): Promise<string> => {
    const r = await normaliserBouteille(dataUrl, { qualite: opts.qualite, hauteur: h || CADRE_H });
    return r?.dataUrl || dataUrl;
};

/**
 * Même chose à partir d'une ADRESSE collée (visuel de marchand, image trouvée
 * sur le web). Renvoie '' si l'image est injoignable : l'appelant garde alors
 * le lien brut plutôt que de perdre la photo.
 */
async function studioFromUrl(url: string, _l?: number, h?: number, qualite = 0.86): Promise<string> {
    const r = await normaliserDepuisUrl(url, { qualite, hauteur: h || CADRE_H });
    return r?.dataUrl || '';
}

/**
 * En dessous de quoi on ne considère pas la bouteille comme détourée.
 *
 * 0,8 est ce que renvoie le modèle de segmentation, 0,9 et plus le détourage
 * d'un fond uni réussi. En dessous, il reste du décor autour de la bouteille :
 * la poser à hauteur fixe mettrait ce décor à l'échelle, pas le vin.
 */
const DETOURAGE_SUFFISANT = 0.75;

/**
 * L'image d'une fiche : TA photo d'abord, celle du marchand en secours.
 *
 * L'ordre inverse a longtemps prévalu — le packshot du marchand est propre,
 * droit, également éclairé, donc « plus beau ». Mais ce n'est pas TA bouteille :
 * le marchand renvoie le millésime qu'il a en stock, parfois une autre cuvée du
 * même domaine, et l'étiquette affichée n'est alors pas celle qui est dans la
 * cave. Une cave sert à reconnaître ses propres bouteilles.
 *
 * On garde donc la photo prise au scan, et c'est `bouteille.ts` qui se charge
 * de lui donner l'allure d'un packshot : détourage, redressement, égalisation
 * de la lumière, hauteur et ligne de pose fixes.
 *
 * Le marchand reprend la main dans le seul cas où ce travail échoue — étiquette
 * photographiée de trop près, bouteille impossible à isoler du décor. Mieux
 * vaut alors sa photo qu'un rectangle de plan de travail.
 */
async function visuelBouteille(scan: string, photoMarchand?: string, couleur?: WineColor): Promise<string> {
    /*
     * Une fois la bouteille détourée, on lui prend son ÉTIQUETTE et on la pose
     * sur un verre dessiné, le même pour toutes les bouteilles d'une couleur
     * (voir `etiquette.ts`). C'est ce qui rend l'étagère vraiment régulière :
     * la normalisation seule aligne les tailles, pas les silhouettes.
     *
     * La composition n'écrase rien : si l'étiquette n'est pas trouvée, on garde
     * la bouteille normalisée, qui reste juste.
     */
    const composer = async (n: { dataUrl: string } | null) => {
        if (!n) return '';
        if (!couleur) return n.dataUrl;
        const type = await composerSurBouteilleType(n.dataUrl, couleur);
        return type || n.dataUrl;
    };

    const mienne = scan ? await normaliserBouteille(scan, { qualite: 0.82 }) : null;
    if (mienne && mienne.confiance >= DETOURAGE_SUFFISANT) return composer(mienne);

    let sienne: Awaited<ReturnType<typeof normaliserDepuisUrl>> = null;
    if (photoMarchand) {
        sienne = await normaliserDepuisUrl(photoMarchand, { qualite: 0.86 });
        if (sienne && sienne.confiance >= DETOURAGE_SUFFISANT) return composer(sienne);
    }

    /*
     * Aucune des deux n'a pu être détourée — typiquement un visuel marchand qui
     * n'est pas un packshot mais un gros plan d'étiquette. On renvoie quand même
     * la version MISE AU FORMAT plutôt que l'image d'origine : elle garde la
     * taille de cadre et la ligne de pose communes, et la rangée reste alignée.
     * Rendre le lien brut faisait ressortir une vignette hors de toute échelle,
     * seule fiche bancale au milieu des autres.
     */
    return mienne?.dataUrl || sienne?.dataUrl || photoMarchand || '';
}

function AddWine({ onClose, shelf: initialShelf = 'cave', straightToCamera = false }: { onClose: () => void; shelf?: WineShelf; straightToCamera?: boolean }) {
    // Où ranger la bouteille : en cave (on l'a) ou dans « Goûté & approuvé »
    // (bue chez un ami, au restaurant — on ne la possède pas).
    const [shelf, setShelf] = useState<WineShelf>(initialShelf);
    const [photo, setPhoto] = useState<string>('');       // aperçu (pleine taille)
    const [photoSmall, setPhotoSmall] = useState<string>(''); // version stockable
    const [photoUrl, setPhotoUrl] = useState('');
    const [busy, setBusy] = useState(false);
    const [form, setForm] = useState<{ name: string; grape: string; year: string; color: WineColor; region: string; note: string }>(
        { name: '', grape: '', year: '', color: 'rouge', region: '', note: '' });
    // Photo officielle + note du marchand quand la bouteille a été retrouvée.
    const [official, setOfficial] = useState<Official>({});
    /**
     * La bouteille lue, PROPOSÉE mais pas encore rangée.
     *
     * Le scan ajoutait directement en cave. On voyait donc le résultat une fois
     * qu'il était trop tard : mauvais millésime, homonyme du bon domaine, ou
     * simplement l'envie de savoir ce que le vin vaut avant de le garder. La
     * fiche s'affiche maintenant d'abord — note des dégustateurs comprise — et
     * c'est le doigt qui tranche.
     */
    const [candidat, setCandidat] = useState<{ vin: VinLu; source: string; scan: string } | null>(null);
    /**
     * La photo de la bouteille, DÉJÀ mise en scène (fond de cave, bords fondus).
     *
     * Elle se prépare pendant qu'on regarde la fiche proposée : l'aperçu montre
     * alors la bouteille sur le même fond sombre que le reste de la cave, et
     * l'ajout n'a plus une seconde de fabrication à faire au moment du clic.
     */
    const [scenePrete, setScenePrete] = useState('');
    const [scanMsg, setScanMsg] = useState('');
    // Viseur en direct : c'est la voie normale du scan. La pellicule reste en
    // secours (ordinateur sans caméra, autorisation refusée).
    const [viewfinder, setViewfinder] = useState(straightToCamera);
    const fileRef = useRef<HTMLInputElement>(null);

    /**
     * Dès qu'une bouteille est proposée, on prépare sa mise en scène — sans
     * bloquer l'affichage. L'aperçu se met à jour tout seul quand elle est
     * prête, et la validation n'a plus qu'à la ranger.
     */
    useEffect(() => {
        if (!candidat) { setScenePrete(''); return; }
        let vivant = true;
        (async () => {
            const scene = await visuelBouteille(candidat.scan, candidat.vin.photo, (candidat.vin.color || 'rouge') as WineColor);
            if (vivant && scene) setScenePrete(scene);
        })();
        return () => { vivant = false; };
    }, [candidat]);

    /**
     * Réduit la photo. Indispensable deux fois : 640 px suffit à lire une
     * étiquette et divise par deux les jetons envoyés au modèle vision (quota
     * Groq gratuit : 8000 jetons/minute) ; surtout, une photo d'iPhone brute
     * pèse 3 Mo en base64 et fait EXPLOSER le quota localStorage de Safari
     * (~5 Mo) dès la première bouteille gardée avec sa propre photo.
     */
    const compress = (dataUrl: string, max = 640): Promise<string> => new Promise((res) => {
        const img = new Image();
        img.onload = () => {
            const r = Math.min(1, max / Math.max(img.width, img.height));
            const cv = document.createElement('canvas'); cv.width = img.width * r; cv.height = img.height * r;
            const ctx = cv.getContext('2d'); if (!ctx) return res(dataUrl);
            ctx.drawImage(img, 0, 0, cv.width, cv.height);
            res(cv.toDataURL('image/jpeg', 0.82));
        };
        img.onerror = () => res(dataUrl);
        img.src = dataUrl;
    });

    /**
     * Scan → ajout direct. La photo part à /api/wine-lookup, qui lit l'étiquette
     * puis retrouve la bouteille chez le marchand : on récupère la photo
     * officielle + nom/cépage/année/région, et le vin entre dans la cave sans
     * autre manipulation. Si la bouteille n'est pas reconnue, on retombe sur le
     * formulaire pré-rempli plutôt que d'ajouter n'importe quoi.
     */
    /**
     * Met la photo prise chez soi en SCÈNE DE CAVE : format portrait, fond noir,
     * et les bords fondus dans le noir. Ce n'est pas un détourage — il faudrait
     * un modèle de segmentation pour découper vraiment la bouteille — mais le
     * plan de travail et le mur s'effacent, et la bouteille se pose sur le même
     * noir que les photos du marchand. On ne s'en sert QUE quand le marchand n'a
     * pas retrouvé la bouteille : sa photo à lui est déjà un détourage studio.
     */

    /**
     * `read` sert à LIRE l'étiquette (cadrage serré), `keep` à garder la photo
     * (cadrage large). Sans distinction, viser l'étiquette de près laissait une
     * fiche dont l'image n'était… qu'une étiquette.
     */
    const scanAndAdd = async (read: string, keep = read) => {
        const dataUrl = read;
        setBusy(true); setScanMsg('Lecture de l’étiquette…');
        const step2 = setTimeout(() => setScanMsg('Recherche de la bouteille…'), 1400);
        /*
         * La photo est GARDÉE AVANT la requête, et hors du `try`.
         *
         * Elle l'était après, et seulement dans le chemin nominal : quand la
         * reconnaissance échouait pour de bon — réseau coupé, serveur en
         * erreur, quota — on partait dans le `catch` et `setPhotoSmall`
         * n'était jamais atteint. Le message invitait à taper le nom, on le
         * tapait, et la bouteille entrait en cave SANS IMAGE. La branche
         * voisine, elle, promettait « la photo est déjà gardée » : les deux ne
         * disaient pas la même chose.
         *
         * C'est d'autant moins acceptable que la photo prise ici est devenue la
         * source de l'étiquette (voir `visuelBouteille`) : la perdre, c'est
         * perdre la seule image propre à cette bouteille.
         */
        const small = await compress(dataUrl);              // serré : pour la lecture
        const gardee = keep === dataUrl ? small : await compress(keep);
        setPhotoSmall(gardee);

        try {
            const res = await fetch('/api/wine-lookup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ image: small }) });
            const data = await res.json();
            const w = data?.wine;
            if (w?.name) {
                /*
                 * On PROPOSE. La mise en scène des photos — téléchargement chez
                 * le marchand, fond de cave, dégradé — attend la validation :
                 * elle prenait une à deux secondes de plus AVANT que quoi que ce
                 * soit ne s'affiche, alors qu'elle ne sert qu'une fois le vin
                 * gardé.
                 */
                clearTimeout(step2);
                setBusy(false); setScanMsg('');
                setViewfinder(false);
                setCandidat({ vin: w, source: String(data?.source || ''), scan: gardee });
                return;
            }
            // Étiquette non reconnue : on REND LA MAIN au lieu de laisser le
            // viseur ouvert sur un message. La photo prise est déjà gardée, il
            // ne manque que le nom — deux mots à taper, puis « Ajouter ».
            setViewfinder(false);
            if (data?.quota) setScanMsg('Trop de scans d’affilée (quota IA) — réessaie dans une minute, ou tape le nom ci-dessous.');
            else setScanMsg('Étiquette illisible — tape le nom du vin ci-dessous, la photo est déjà gardée.');
        } catch {
            setViewfinder(false);
            setScanMsg('Reconnaissance impossible — tape le nom du vin ci-dessous, la photo est déjà gardée.');
        }
        clearTimeout(step2);
        setBusy(false);
    };

    /**
     * La bouteille proposée entre en cave.
     *
     * C'est ici, et pas au scan, que les photos passent par la scène de cave :
     * on télécharge celle du marchand, on la détoure, on la pose sur le fond
     * sombre. Une à deux secondes, mais après le geste de validation — plus
     * avant l'affichage du résultat.
     */
    const ajouterCandidat = async () => {
        if (!candidat) return;
        const w = candidat.vin;
        setBusy(true); setScanMsg('Ajout à la cave…');
        const known = findKnownWine(w.name);

        // Ta photo, mise en packshot — voir `visuelBouteille` pour l'ordre des
        // préférences. Le plus souvent elle est déjà prête (`scenePrete`) :
        // elle s'est fabriquée pendant que la fiche proposée était à l'écran.
        const photoFinale = scenePrete || (await visuelBouteille(candidat.scan, w.photo, (w.color || 'rouge') as WineColor));

        const ranger = (photo?: string) => addWine({
            name: w.name, grape: w.grape || '', year: w.year || '',
            color: (w.color || 'rouge') as WineColor, region: w.region || '', note: w.note || '',
            photo, rating: w.rating, vivinoUrl: w.vivinoUrl,
            shelf, tasted: shelf === 'tasted' || undefined, qty: shelf === 'tasted' ? 0 : 1,
            // Déjà passée par le traitement courant : le rattrapage la laissera.
            visuelV: VISUEL_VERSION,
        });

        /*
         * Le stockage du navigateur est étroit (~5 Mo sur Safari) et la cave y
         * range des photos. Quand il déborde, on ne perd PAS la bouteille : on
         * réessaie avec une vignette, puis sans photo du tout. Une fiche sans
         * image vaut infiniment mieux qu'un vin qui n'entre nulle part — c'était
         * le bug : l'ajout échouait sans un mot et la feuille se refermait.
         */
        try {
            ranger(photoFinale || undefined);
        } catch (plein) {
            if (!(plein instanceof CavePleine)) { setBusy(false); setScanMsg('Ajout impossible — réessaie.'); return; }
            try {
                setScanMsg('Stockage serré — photo allégée…');
                const vignette = photoFinale.startsWith('data:')
                    ? await toStudio(photoFinale, 260, 347, { qualite: 0.7 })
                    : photoFinale;
                ranger(vignette || undefined);
                toast('Stockage presque plein : la photo a été allégée.');
            } catch {
                try {
                    ranger(undefined);
                    toast('Cave pleine côté navigateur : la bouteille est gardée, sans sa photo.');
                } catch {
                    setBusy(false);
                    setScanMsg('Cave pleine côté navigateur — retire un vin puis réessaie.');
                    return;
                }
            }
        }

        if (known) {
            toast(known.year && w.year && known.year !== w.year
                ? `Déjà dégusté — tu avais le ${known.year}`
                : 'Déjà dégusté — ce vin est déjà passé par ta cave');
        } else {
            toast(shelf === 'tasted' ? `${stripYear(w.name)} rejoint tes dégustations` : `${stripYear(w.name)} est entré dans ta cave`);
        }
        onClose();
    };

    const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0]; if (!f) return;
        const rd = new FileReader();
        rd.onload = () => { const url = String(rd.result || ''); setPhoto(url); scanAndAdd(url); };
        rd.readAsDataURL(f);
    };

    // Recherche depuis le NOM tapé (si pas de photo) : même moteur, sans ajout
    // automatique puisque l'utilisateur est déjà en train de saisir.
    const recognize = async () => {
        const q = form.name.trim();
        if (!q) return;
        setBusy(true); setScanMsg('Recherche de la bouteille…');
        try {
            const res = await fetch('/api/wine-lookup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ label: q }) });
            const data = await res.json();
            const w = data?.wine;
            if (w) {
                setForm((f) => ({ ...f, name: w.name, grape: w.grape, year: w.year, color: w.color, region: w.region, note: w.note || f.note }));
                // Les deux marchands valent : ce qui compte est qu'une FICHE ait
                // été reconnue, pas laquelle.
                const reconnue = data.source === 'vivino' || data.source === 'viniou';
                setOfficial(reconnue ? { photo: w.photo, rating: w.rating, vivinoUrl: w.vivinoUrl } : {});
                setScanMsg(reconnue ? `Bouteille trouvée sur ${marchandDe(w.vivinoUrl) || 'le web'} ✓` : 'Fiche estimée — pas de photo officielle.');
            }
        } catch { setScanMsg('Recherche impossible — saisie manuelle.'); }
        setBusy(false);
    };

    const save = async () => {
        const name = form.name.trim();
        if (!name) return;
        // Même règle qu'au scan : notre photo passe par la scène de cave, celle
        // du marchand (déjà détourée) est prise telle quelle.
        /*
         * Priorité : lien COLLÉ > ta photo > photo du marchand.
         *
         * Le lien collé passe devant tout : c'est un geste explicite, on a
         * choisi cette image-là. Vient ensuite la photo prise ici même, et le
         * marchand ne sert que si elle manque ou n'a pas pu être détourée —
         * même règle qu'au scan, voir `visuelBouteille`.
         */
        const colle = photoUrl.trim();
        const scene = colle
            ? (await studioFromUrl(colle)) || colle
            : await visuelBouteille(photoSmall, official.photo, form.color);
        const known = findKnownWine(name);
        const ranger = (photo?: string) => addWine({
            ...form, name,
            photo,
            rating: official.rating, vivinoUrl: official.vivinoUrl,
            shelf, tasted: shelf === 'tasted' || undefined, qty: shelf === 'tasted' ? 0 : 1,
            // Déjà passée par le traitement courant : le rattrapage la laissera.
            visuelV: VISUEL_VERSION,
        });
        try {
            ranger(scene || undefined);
        } catch (plein) {
            // Stockage plein : la bouteille passe quand même, sans son image.
            if (!(plein instanceof CavePleine)) { setScanMsg('Ajout impossible — réessaie.'); return; }
            try {
                ranger(undefined);
                toast('Cave pleine côté navigateur : la bouteille est gardée, sans sa photo.');
            } catch {
                setScanMsg('Cave pleine côté navigateur — retire un vin puis réessaie.');
                return;
            }
        }
        if (known) toast('Déjà dégusté — ce vin est déjà passé par ta cave');
        else toast(shelf === 'tasted' ? `${stripYear(name)} rejoint tes dégustations` : `${stripYear(name)} est entré dans ta cave`);
        onClose();
    };

    return (
        <div className={styles.backdrop} onClick={onClose}>
            <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
                <div className={styles.sheetHead}>
                    <div className={styles.sheetTitle}>{shelf === 'tasted' ? 'Ajouter une bouteille goûtée' : 'Ajouter un vin'}</div>
                    <button className={styles.sheetClose} onClick={onClose}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
                </div>

                {viewfinder && (
                    <LabelScanner
                        busy={busy}
                        message={scanMsg}
                        onClose={() => setViewfinder(false)}
                        onShot={({ ocr, wide }) => { setPhoto(wide); scanAndAdd(ocr, wide); }}
                    />
                )}

                {/*
                  * La bouteille lue, avant qu'elle n'entre en cave.
                  *
                  * Elle prend toute la feuille : c'est le moment où l'on décide,
                  * le formulaire n'a rien à dire ici.
                  */}
                {candidat && (
                    <VinPropose
                        vin={candidat.vin}
                        scan={candidat.scan}
                        scene={scenePrete}
                        etagere={shelf}
                        occupe={busy}
                        message={scanMsg}
                        onAnnuler={() => { setCandidat(null); setScanMsg(''); }}
                        onValider={ajouterCandidat}
                    />
                )}

                <div className={styles.addBody} hidden={!!candidat}>
                    {/* Où va la bouteille : on le demande AVANT le scan, parce que
                        la réponse change le sens du geste — au restaurant on ne
                        remplit pas sa cave, on garde une trace. */}
                    <div className={styles.destRow}>
                        {([['cave', 'Dans ma cave', 'Je l’ai chez moi'],
                           ['tasted', 'Goûté & approuvé', 'Bue ailleurs, je la note']] as const).map(([k, lbl, sub]) => (
                            <button
                                key={k}
                                className={`${styles.destBtn} ${shelf === k ? styles.destOn : ''}`}
                                onClick={() => setShelf(k)}
                            >
                                <span className={styles.destLbl}>{lbl}</span>
                                <span className={styles.destSub}>{sub}</span>
                            </button>
                        ))}
                    </div>

                    <div className={styles.scanRow}>
                        <button className={styles.scanBtn} onClick={() => setViewfinder(true)} disabled={busy}>
                            {official.photo || photo ? <img src={official.photo || photo} alt="" className={styles.scanThumb} /> : (
                                <span className={styles.scanIc}>
                                    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9V7a2 2 0 0 1 2-2h2M17 5h2a2 2 0 0 1 2 2v2M21 15v2a2 2 0 0 1-2 2h-2M7 19H5a2 2 0 0 1-2-2v-2M7 12h10" /></svg>
                                    Viser l’étiquette
                                </span>
                            )}
                            {busy && <span className={styles.scanBusy}><span className={styles.spin} />{scanMsg || 'Lecture de l’étiquette…'}</span>}
                        </button>
                        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onFile} hidden />
                        <button className={styles.scanFallback} onClick={() => fileRef.current?.click()} disabled={busy}>
                            ou choisir une photo
                        </button>
                        <div className={styles.scanHint}>{(!busy && scanMsg) || (shelf === 'tasted' ? 'Prends la bouteille en photo : l’étiquette est lue, la bouteille est retrouvée chez le marchand, et elle rejoint tes dégustations avec sa vraie photo — même si tu ne l’as pas chez toi.' : 'Prends la bouteille en photo : l’étiquette est lue, la bouteille est retrouvée chez le marchand et entre dans ta cave avec sa vraie photo.')}</div>
                    </div>

                    <div className={styles.fields}>
                        <div className={styles.recRow}>
                            <input className={styles.inp} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nom du vin" />
                            <button className={styles.recBtn} onClick={recognize} disabled={busy || !form.name.trim()} title="Compléter par le nom">{busy ? '…' : 'IA'}</button>
                        </div>
                        <div className={styles.two}>
                            <input className={styles.inp} value={form.grape} onChange={(e) => setForm({ ...form, grape: e.target.value })} placeholder="Cépage" />
                            <input className={styles.inp} value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} placeholder="Année" inputMode="numeric" />
                        </div>
                        <input className={styles.inp} value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="Région / appellation" />
                        <input className={styles.inp} value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="Lien de la photo officielle (optionnel, colle depuis le marchand)" />
                        <div className={styles.colorPick}>
                            {(['rouge', 'blanc', 'liqueur'] as WineColor[]).map((c) => (
                                <button key={c} className={`${styles.colorOpt} ${form.color === c ? styles.colorOptOn : ''}`} onClick={() => setForm({ ...form, color: c })}>
                                    <span className={styles.colorDot} style={{ background: COLOR_GLASS[c] }} />{COLOR_LABEL[c]}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button className={styles.saveBtn} onClick={save} disabled={!form.name.trim()}>{shelf === 'tasted' ? 'Ajouter à « Goûté & approuvé »' : 'Ajouter à ma cave'}</button>
                </div>
            </div>
        </div>
    );
}

/**
 * La bouteille lue, proposée avant d'entrer en cave.
 * ================================================
 *
 * Ce qu'on veut savoir avant de garder un vin : est-ce bien LUI (bon domaine,
 * bon millésime), et est-ce qu'il est bon. La première question se règle d'un
 * coup d'œil à la photo et au nom ; la seconde par la note des dégustateurs,
 * et par les avis, qu'on ouvre chez ceux dont c'est le métier — Vivino d'abord,
 * une recherche Google pour le reste. On ne recopie pas leurs avis : ils ne
 * nous appartiennent pas, et un lien reste à jour.
 */
function VinPropose({ vin, scan, scene, etagere, occupe, message, onAnnuler, onValider }: {
    vin: VinLu;
    scan: string;
    /** La photo déjà posée sur le fond de cave, quand elle est prête. */
    scene: string;
    etagere: WineShelf;
    occupe: boolean;
    message: string;
    onAnnuler: () => void;
    onValider: () => void;
}) {
    // La mise en scène dès qu'elle est prête — c'est l'image qui entrera en
    // cave, sur le même fond sombre que toutes les autres. En attendant, la
    // photo du marchand, puis la nôtre.
    const photo = scene || vin.photo || scan;
    const note = typeof vin.rating === 'number' && vin.rating > 0 ? vin.rating : null;
    const ligne = [vin.year, vin.region, vin.grape].filter(Boolean).join(' · ');
    const requete = encodeURIComponent(`${vin.name} ${vin.year || ''} vin avis`.trim());

    return (
        <div className={styles.proposeWrap}>
            <div className={styles.proposeVisuel}>
                {photo ? <img src={photo} alt="" className={styles.proposeImg} /> : <div className={styles.proposeVide} />}
            </div>

            {/*
              * La note vit SOUS la bouteille, pas dessus.
              *
              * Posée sur la photo, elle en cachait l'étiquette — celle qu'on
              * vient justement de vérifier — et restait petite pour ne pas trop
              * en manger. Ici elle a la place d'être lue de loin.
              */}
            {note !== null && (
                <div className={styles.proposeNote}>
                    <div className={styles.proposeEtoiles} aria-hidden>
                        {[0, 1, 2, 3, 4].map((i) => (
                            <span key={i} className={styles.proposeEtoile}>
                                <span className={styles.proposeEtoileFond}>★</span>
                                <span
                                    className={styles.proposeEtoilePlein}
                                    style={{ width: `${Math.min(1, Math.max(0, note - i)) * 100}%` }}
                                >★</span>
                            </span>
                        ))}
                    </div>
                    <div className={styles.proposeNoteLigne}>
                        <span className={styles.proposeNoteVal}>{note.toFixed(1).replace('.', ',')}</span>
                        <span className={styles.proposeNoteSur}>/5</span>
                        <span className={styles.proposeNoteSource}>{marchandDe(vin.vivinoUrl) ? `sur ${marchandDe(vin.vivinoUrl)}` : 'note moyenne'}</span>
                    </div>
                </div>
            )}

            <div className={styles.proposeNom}>{vin.name}</div>
            {ligne && <div className={styles.proposeMeta}>{ligne}</div>}
            {vin.note && <p className={styles.proposeTexte}>{vin.note}</p>}

            {/* Les avis vivent chez eux : on y emmène, on ne les recopie pas. */}
            <div className={styles.proposeAvis}>
                {vin.vivinoUrl && (
                    <a className={styles.proposeLien} href={vin.vivinoUrl} target="_blank" rel="noopener noreferrer">
                        Fiche {marchandDe(vin.vivinoUrl) || 'marchand'}
                    </a>
                )}
                <a
                    className={styles.proposeLien}
                    href={`https://www.google.com/search?q=${requete}`}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    Avis Google
                </a>
            </div>

            {message && <div className={styles.proposeMsg}>{message}</div>}

            <div className={styles.proposeActions}>
                <button className={styles.proposeAnnuler} onClick={onAnnuler} disabled={occupe}>Annuler</button>
                <button className={styles.proposeValider} onClick={onValider} disabled={occupe}>
                    {occupe ? 'Ajout…' : etagere === 'tasted' ? 'Ajouter aux dégustés' : 'Ajouter à ma cave'}
                </button>
            </div>
        </div>
    );
}
