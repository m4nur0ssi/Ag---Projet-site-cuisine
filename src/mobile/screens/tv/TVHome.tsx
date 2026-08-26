'use client';

/**
 * Accueil mobile « façon Apple TV+ » — TEST DE DESIGN (route /tv, local uniquement).
 * - Héros plein écran = la dernière recette, pagination horizontale au doigt (snap natif).
 * - Le héros est sticky : la feuille de contenu remonte par-dessus au scroll (fondu + zoom).
 * - Sous le héros : plus de carte-titre, uniquement du texte + un chevron « tout afficher ».
 * - Cartes volontairement de tailles différentes (large / affiche / carré / classement).
 */

import { Fragment, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { Recipe } from '@/mobile/types';
import { homeRecipes as mockRecipes, type HomeRecipe } from '@/mobile/data/home-recipes';
import { chargerVideos, completer, detailsPrets } from '@/mobile/data/videos-embed';
import { decodeHtml } from '@/mobile/lib/utils';
import { startScrollReveal } from '@/lib/scrollReveal';
import { useRatingStats } from '@/mobile/lib/ratings';
import { supabase } from '@/mobile/lib/supabase';
import { THEMES, matchesTag, isSavoryMiscat, collectionTagOf } from './themes';
import { tiktokAllowed, tiktokPlayed, tiktokFailed, tiktokSignal } from '@/lib/tiktok-consent';
import { personalizedRecipes } from '@/lib/personalize';
const TasteOnboarding = dynamic(() => import('@/mobile/components/TasteOnboarding/TasteOnboarding'), { ssr: false });
const RecipeShareCard = dynamic(() => import('@/mobile/components/RecipeShareCard/RecipeShareCard'), { ssr: false });
import { timingOf, totalMinutes, formatMinutes } from './timing';
import { inProgressRecipes, clearProgress, PROGRESS_EVENT } from './progress';
import styles from './tv.module.css';

// ── Helpers ────────────────────────────────────────────────────────────────

const CATEGORY_LABEL: Record<string, string> = {
    aperitifs: 'Apéritif',
    entrees: 'Entrée',
    plats: 'Plat',
    accompagnements: 'Accompagnement',
    desserts: 'Dessert',
    patisserie: 'Pâtisserie',
    restaurant: 'Comme au resto',
    vegetarien: 'Végétarien',
    glaces: 'Glace',
    boissons: 'Boisson',
    sauces: 'Sauce',
};

const label = (r: Recipe) => decodeHtml(r.title || '');
const catLabel = (r: Recipe) => CATEGORY_LABEL[(r.category || '').toLowerCase()] || 'Recette';
/** Sans accents ni casse : « Grèce » matche « grece ». */
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
/**
 * Retour haptique. `navigator.vibrate` n'existe PAS sur iOS — c'est pourquoi
 * l'appui long n'a jamais vibré sur iPhone. Depuis iOS 17.4, basculer un
 * `<input type="checkbox" switch>` déclenche en revanche le retour haptique
 * système : on garde donc un commutateur invisible qu'on actionne au besoin.
 */
let hapticSwitch: HTMLLabelElement | null = null;
function iosHaptic() {
    if (typeof document === 'undefined') return;
    if (!hapticSwitch) {
        const hidden = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;opacity:0;pointer-events:none';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.setAttribute('switch', '');
        input.id = 'tv-haptic-switch';
        input.style.cssText = hidden;
        const label = document.createElement('label');
        label.htmlFor = 'tv-haptic-switch';
        label.style.cssText = hidden;
        document.body.append(input, label);
        hapticSwitch = label;
    }
    hapticSwitch.click();
}

export const haptic = (ms = 8) => {
    try {
        // Android / Chrome : API standard. Renvoie false si refusée.
        if (navigator.vibrate?.(ms)) return;
    } catch { /* noop */ }
    iosHaptic();
};
// Temps estimés depuis les étapes : les valeurs WordPress valent 45 min partout.
const timeLabel = (r: Recipe) => formatMinutes(totalMinutes(r));

const RecipeSheet = dynamic(() => import('@/mobile/components/RecipeSheet/RecipeSheet'), { ssr: false });
const FavoriteButton = dynamic(() => import('@/mobile/components/FavoriteButton/FavoriteButton'), { ssr: false });
// Porte le panneau de connexion : sans lui, le cœur d'un visiteur déconnecté
// émet `magic-open-auth` dans le vide (AuthButton ignore l'event s'il est masqué).
const AuthButton = dynamic(() => import('@/mobile/components/AuthButton/AuthButton'), { ssr: false });
const NavDrawer = dynamic(() => import('./NavDrawer'), { ssr: false });
const EdgeHandle = dynamic(() => import('./EdgeHandle'), { ssr: false });
import { CATEGORY_OPTIONS, TREND_OPTIONS, COUNTRY_OPTIONS } from './filters';
import Tip from '@/components/Tip/Tip';
import SiteFooter from '@/components/SiteFooter/SiteFooter';
// Loupe modernisée AppleTV+ (mêmes fonctions que SpotlightSearch prod, habillage TV).
const TVSpotlight = dynamic(() => import('./TVSpotlight'), { ssr: false });
// Visite guidée de l'app mobile (remplace celle du site, écrite pour le desktop).
const TVTutorial = dynamic(() => import('./TVTutorial'), { ssr: false });

/**
 * Nombre de fiches chargées dans le sheet autour de celle qu'on ouvre.
 * RecipeSheet affiche un point de pagination PAR recette, sans retour à la ligne :
 * au-delà d'environ 24, la rangée de points déborde de l'écran.
 */
const SHEET_WINDOW = 24;

/** Ouvre une fiche + ses voisines : dans le sheet, on swipe d'une recette à l'autre. */
type OpenSheet = (list: Recipe[], index: number) => void;

// ── Favoris & « À faire plus tard » ────────────────────────────────────────

/** Liste locale « à faire plus tard » (test de design : pas de table dédiée). */
const LATER_KEY = 'tv-later-v1';
/** Historique de consultation (conservé pour d'autres écrans). */
const SEEN_KEY = 'recently-viewed';

/** Enregistre une recette ouverte en tête de l'historique (12 max). */
function pushSeen(id: string) {
    let list: { id: string }[] = [];
    try { list = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); } catch { /* vide */ }
    const rest = list.filter((r) => String((r as any)?.id ?? r) !== id);
    localStorage.setItem(SEEN_KEY, JSON.stringify([{ id }, ...rest].slice(0, 12)));
    window.dispatchEvent(new Event('tv-seen-change'));
}

const readIds = (key: string): string[] => {
    try { return JSON.parse(localStorage.getItem(key) || '[]').map(String); } catch { return []; }
};

function toggleLater(id: string): boolean {
    const list = readIds(LATER_KEY);
    const has = list.includes(id);
    localStorage.setItem(LATER_KEY, JSON.stringify(has ? list.filter((x) => x !== id) : [id, ...list]));
    window.dispatchEvent(new Event('tv-later-change'));
    return !has;
}

/**
 * Bascule le favori — même chemin que FavoriteButton : cache localStorage +
 * table Supabase, pour que la recette apparaisse dans l'onglet Favoris.
 * Déconnecté : ouvre le panneau de connexion (porté par AuthButton dans le héros).
 */
async function toggleFavorite(id: string): Promise<'added' | 'removed' | 'auth'> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.dispatchEvent(new CustomEvent('magic-toast-notify', { detail: 'Connecte-toi pour enregistrer tes favoris ❤️' }));
        window.dispatchEvent(new Event('magic-open-auth'));
        return 'auth';
    }
    const favs = readIds('favorites');
    const has = favs.includes(id);
    localStorage.setItem('favorites', JSON.stringify(has ? favs.filter((f) => f !== id) : [...favs, id]));
    if (has) await supabase.from('favorites').delete().eq('user_id', session.user.id).eq('recipe_id', id);
    else await supabase.from('favorites').upsert({ user_id: session.user.id, recipe_id: id });
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('magic-favorite-change'));
    return has ? 'removed' : 'added';
}

/**
 * Appui long (≈ 0,5 s) → menu contextuel, façon « appui fort » iOS.
 * `consumed` empêche le clic de fin de geste d'ouvrir la fiche par-dessus le menu.
 */
function useLongPress(onLong: () => void) {
    const timer = useRef<ReturnType<typeof setTimeout>>();
    const consumed = useRef(false);

    const start = () => {
        clearTimeout(timer.current);
        timer.current = setTimeout(() => {
            consumed.current = true;
            navigator.vibrate?.(12);
            onLong();
        }, 480);
    };
    const cancel = () => clearTimeout(timer.current);

    useEffect(() => () => clearTimeout(timer.current), []);

    return {
        consumed,
        handlers: {
            onTouchStart: start,
            onTouchMove: cancel,
            onTouchEnd: cancel,
            onTouchCancel: cancel,
            onPointerDown: (e: React.PointerEvent) => { if (e.pointerType === 'mouse') start(); },
            onPointerUp: cancel,
            onPointerLeave: cancel,
            onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); consumed.current = true; onLong(); },
        },
    };
}

/**
 * Sur grand écran, la dernière carte d'une rangée se retrouvait coupée par le
 * bord de la fenêtre. On calcule ici, pour chaque format, une largeur telle
 * qu'un nombre ENTIER de cartes tienne dans la largeur disponible — la dernière
 * visible est donc toujours entière, quelle que soit la taille de l'écran.
 * Sous 760 px (téléphone), on ne touche à rien : l'aperçu partiel y est voulu.
 */
const CARD_TARGET: Record<string, number> = {
    small: 150, poster: 190, square: 200, medium: 230, wide: 320, hugeCard: 360, top10: 200,
};
const ROW_PAD = 40;
const ROW_GAP = 14;

function useFittedCards() {
    useEffect(() => {
        const root = document.documentElement;
        const apply = () => {
            const w = root.clientWidth;
            Object.entries(CARD_TARGET).forEach(([key, target]) => {
                if (w < 760) { root.style.removeProperty(`--card-${key}`); return; }
                // Marge gauche de la rangée (le Top 10 en a une plus large pour
                // loger le chiffre) et écart entre cartes (double pour le Top 10).
                const pad = key === 'top10' ? 46 : ROW_PAD;
                const gap = key === 'top10' ? 28 : ROW_GAP;

                // Chaque carte occupe (largeur + écart). On en fait tenir un
                // nombre entier dans la place disponible…
                // Note : dans le Top 10, le chiffre de la carte suivante déborde
                // 34 px à sa gauche et pointe donc encore un peu. Le corriger
                // rognerait la dernière carte — priorité à la carte entière.
                const avail = w - pad;
                const cols = Math.max(1, Math.round(avail / (target + gap)));
                // …puis on résout : la carte n+1 doit démarrer AU BORD de la
                // fenêtre (donc invisible), ce qui pose largeur = avail/n − écart.
                // Le +1 px absorbe les arrondis de rendu, qui laissaient sinon
                // repasser un filet de la carte suivante.
                const width = avail / cols - gap + 1;
                root.style.setProperty(`--card-${key}`, `${width.toFixed(2)}px`);
            });
        };
        apply();
        window.addEventListener('resize', apply);
        return () => window.removeEventListener('resize', apply);
    }, []);
}

/**
 * Le geste « retour » d'iOS (balayage depuis le bord) doit refermer le calque
 * ouvert — grille de catégorie, fiche, menu… — et non quitter la page. Chaque
 * calque ajoute donc une entrée d'historique à l'ouverture, retirée à la
 * fermeture par l'interface. Empilement naturel : le dernier ouvert se ferme
 * en premier.
 */
/**
 * Retour programmé en attente, PARTAGÉ par tous les calques.
 *
 * Un calque qui se ferme rend son entrée d'historique (`history.back()`), mais
 * `popstate` n'arrive qu'au tour suivant : quand un même geste ferme un calque
 * et en ouvre un autre (menu → « Rechercher », menu → « Visite guidée »), ce
 * retour tombait APRÈS le `pushState` du nouveau calque et le refermait
 * aussitôt — l'écran clignotait et rien ne s'ouvrait. On diffère donc le
 * retour d'un tour : si un calque s'ouvre entre-temps, il reprend simplement
 * l'entrée du précédent au lieu d'en empiler une seconde.
 */
let pendingBack: ReturnType<typeof setTimeout> | null = null;
/**
 * Un calque qui se referme rend l'entrée d'historique qu'il avait ajoutée. Le
 * `popstate` qui en découle était pris pour un geste « retour » par les calques
 * RESTÉS ouverts : fermer le menu d'appui long depuis une grille de catégorie
 * fermait la grille avec lui, et on se retrouvait à l'accueil. Ce drapeau dit
 * que le retour vient de nous, et qu'il ne concerne personne d'autre.
 */
let backEstDeNous = false;

function useBackToClose(isOpen: boolean, close: () => void) {
    const holds = useRef(false);
    const closeRef = useRef(close);
    closeRef.current = close;

    // Marqueur de démontage. DÉFINI AVANT l'effet principal : React exécute les
    // nettoyages dans l'ordre de déclaration, donc au démontage celui-ci passe
    // en premier et l'effet principal sait qu'il ne s'agit pas d'une simple
    // fermeture de calque.
    const alive = useRef(true);
    useEffect(() => {
        alive.current = true;
        return () => { alive.current = false; };
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        const from = window.location.pathname;
        if (pendingBack !== null) { clearTimeout(pendingBack); pendingBack = null; }
        else window.history.pushState({ tvOverlay: Date.now() }, '');
        holds.current = true;
        const onPop = () => {
            if (backEstDeNous) { backEstDeNous = false; return; }
            holds.current = false;
            closeRef.current();
        };
        window.addEventListener('popstate', onPop);
        return () => {
            window.removeEventListener('popstate', onPop);
            // Fermé par le geste « retour » : l'entrée est déjà partie, rien à rendre.
            if (!holds.current) return;
            holds.current = false;
            // Écran démonté = NAVIGATION en cours (menu → planificateur, menu →
            // liste). Rendre l'entrée annulerait la navigation et ramènerait à
            // l'accueil — c'est ce qui rendait le menu inopérant. On ne peut pas
            // se fier à l'URL : le routeur ne l'a pas encore changée à cet instant.
            if (!alive.current) return;
            // Fermé par un bouton : on rend l'entrée ajoutée, sinon il faudrait
            // deux retours pour quitter la page.
            pendingBack = setTimeout(() => {
                pendingBack = null;
                if (window.location.pathname !== from) return;
                backEstDeNous = true;
                window.history.back();
                // Filet : si aucun `popstate` ne vient (navigation entre-temps),
                // le drapeau ne doit pas rester levé et avaler un vrai retour.
                setTimeout(() => { backEstDeNous = false; }, 400);
            }, 0);
        };
    }, [isOpen]);
}

/** Chevron SF-Symbols-like (le caractère « › » rend mal selon la police). */
const Chevron = () => (
    <svg className={styles.rowChevron} viewBox="0 0 8 14" fill="none" aria-hidden>
        <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// ── Cartes ─────────────────────────────────────────────────────────────────

type CardVariant = 'small' | 'wide' | 'medium' | 'poster' | 'square' | 'hugeCard';

function Card({
    recipe,
    variant,
    overlayTitle = false,
    progress,
    subtitle,
    later,
    onToggleLater,
    onOpen,
    onLongPress,
    showcase = false,
    videoId = null,
    domId,
}: {
    recipe: Recipe;
    variant: CardVariant;
    overlayTitle?: boolean;
    progress?: number;
    subtitle?: string;
    /** Dans « À faire plus tard » (croix → coche). */
    later?: boolean;
    onToggleLater?: (r: Recipe) => void;
    onOpen: () => void;
    onLongPress: () => void;
    /**
     * Vitrine (rangée Desserts) : grande carte, titre incrusté qui NE BOUGE PAS
     * quand la vidéo démarre — il vit à côté du visuel, pas dedans, sinon Safari
     * fait remonter le calque de l'iframe par-dessus.
     */
    showcase?: boolean;
    /** Id TikTok à jouer dans le visuel (vitrine seulement). */
    videoId?: string | null;
    /** Identifiant posé sur le nœud : la rangée s'en sert pour repérer la carte centrée. */
    domId?: string;
}) {
    const lp = useLongPress(onLongPress);
    // Le lecteur ne se montre QUE s'il joue pour de bon : sans consentement
    // TikTok, il affiche son bandeau de cookies à la place de la vidéo, et la
    // photo de la recette se faisait remplacer par un pavé bleu. Il signale sa
    // lecture par postMessage — tant qu'on n'a rien reçu, la photo reste.
    const [vidReady, setVidReady] = useState(false);
    useEffect(() => {
        setVidReady(false);
        if (!videoId) return;
        const onMessage = (e: MessageEvent) => {
            const sig = tiktokSignal(e);
            if (sig === 'play') { setVidReady(true); tiktokPlayed(); }
            else if (sig === 'error') tiktokFailed();
        };
        window.addEventListener('message', onMessage);
        // Silence au bout de 6 s = bandeau de cookies ou lecture refusée.
        const giveUp = setTimeout(() => setVidReady((r) => { if (!r) tiktokFailed(); return r; }), 6000);
        return () => { window.removeEventListener('message', onMessage); clearTimeout(giveUp); };
    }, [videoId]);

    return (
        <div
            data-id={domId}
            className={`${styles.card} ${styles[variant]} ${showcase ? styles.showcaseCard : ''}`}
            {...lp.handlers}
            // Après un appui long, le clic de relâchement ne doit pas ouvrir la fiche.
            onClick={() => { if (lp.consumed.current) { lp.consumed.current = false; return; } haptic(8); onOpen(); }}
        >
            <div className={styles.thumb}>
                <img
                    src={recipe.image}
                    alt={label(recipe)}
                    className={styles.thumbImg}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                />
                {showcase && videoId && (
                    <iframe
                        className={`${styles.cardVideo} ${vidReady ? styles.cardVideoOn : ''}`}
                        // Lecteur nu : ni commandes, ni barre, ni logo, ni pseudo —
                        // le cadre est agrandi pour que l'habillage sorte du champ.
                        src={`https://www.tiktok.com/player/v1/${videoId}?autoplay=1&controls=0&progress_bar=0&play_button=0&volume_control=1&fullscreen_button=0&music_info=0&description=0&rel=0&native_context_menu=0&closed_caption=0`}
                        allow="autoplay; encrypted-media"
                        title={label(recipe)}
                    />
                )}
                {!showcase && (overlayTitle || progress !== undefined) && <div className={styles.thumbScrim} />}
                {!showcase && overlayTitle && <div className={styles.overlayLabel}>{label(recipe)}</div>}
                {progress !== undefined && (
                    <div className={styles.progressTrack}>
                        <div className={styles.progressFill} style={{ width: `${progress}%` }} />
                    </div>
                )}
                {/* Croix → coche : ajoute/retire de « À faire plus tard ». */}
                {onToggleLater && (
                    <button
                        className={`${styles.laterBtn} ${later ? styles.laterBtnOn : ''}`}
                        onClick={(e) => { e.stopPropagation(); haptic(12); onToggleLater(recipe); }}
                        aria-label={later ? 'Retirer de « À faire plus tard »' : 'Ajouter à « À faire plus tard »'}
                    >
                        {later ? (
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none"><path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        ) : (
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg>
                        )}
                    </button>
                )}
            </div>
            {/* Vitrine : le voile et le titre sont FRÈRES du visuel, jamais dedans —
                c'est la seule façon qu'ils restent devant la vidéo sur Safari. */}
            {showcase && (
                <>
                    <div className={styles.thumbScrim} aria-hidden />
                    <div className={styles.overlayLabel}>{label(recipe)}</div>
                </>
            )}
            {!overlayTitle && !showcase && <div className={styles.cardLabel}>{label(recipe)}</div>}
            {subtitle && !showcase && <div className={styles.cardSub}>{subtitle}</div>}
        </div>
    );
}

/*
 * Le son des vignettes : `volume_control=1`.
 *
 * Le lecteur est celui de TikTok, dans un cadre étranger. Safari n'accorde le
 * son qu'à un média démarré par un geste dans SA propre fenêtre : un bouton à
 * nous, posé par-dessus, ne peut pas l'obtenir — recharger en `muted=0` fait
 * repartir la vidéo de zéro, toujours muette, et `unMute` par postMessage ne
 * produit rien (les deux essayés sur iPhone). Le seul bouton qui tienne sa
 * promesse est celui de TikTok, DANS le cadre : le doigt tombe alors du bon
 * côté de la frontière. On garde donc l'interface masquée, sauf ce bouton-là.
 */

/**
 * Carte de la vue « tout afficher » (une catégorie, une tendance).
 *
 * Deux gestes, deux résultats : toucher le VISUEL lance la vidéo — avec son
 * bouton de son —, toucher le TITRE ouvre la fiche. Une seule cible pour les
 * deux obligeait à choisir entre voir et lire.
 */
function CollectionCard({ recipe, subtitle, onOpen, onLongPress, later, onToggleLater }: {
    recipe: Recipe;
    subtitle?: string;
    onOpen: () => void;
    onLongPress: () => void;
    later?: boolean;
    onToggleLater?: (r: Recipe) => void;
}) {
    const lp = useLongPress(onLongPress);
    const vid = tiktokId(recipe);
    const [playing, setPlaying] = useState(false);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        if (!playing) return;
        const onMessage = (e: MessageEvent) => {
            const sig = tiktokSignal(e);
            if (sig === 'play') { setReady(true); tiktokPlayed(); }
            else if (sig === 'error') { tiktokFailed(); setPlaying(false); }
        };
        window.addEventListener('message', onMessage);
        const giveUp = setTimeout(() => setReady((r) => { if (!r) tiktokFailed(); return r; }), 6000);
        return () => { window.removeEventListener('message', onMessage); clearTimeout(giveUp); };
    }, [playing]);

    return (
        <div className={`${styles.card} ${styles.wide}`} {...lp.handlers}>
            <div
                className={styles.thumb}
                onClick={() => {
                    if (lp.consumed.current) { lp.consumed.current = false; return; }
                    if (!vid || !tiktokAllowed()) { onOpen(); return; }   // pas de vidéo → la fiche
                    haptic(8);
                    setPlaying((p) => !p);
                }}
            >
                <img src={recipe.image} alt="" className={styles.thumbImg} loading="lazy" decoding="async" draggable={false} />
                {playing && vid && (
                    <iframe
                        className={`${styles.cardVideo} ${ready ? styles.cardVideoOn : ''}`}
                        src={`https://www.tiktok.com/player/v1/${vid}?autoplay=1&muted=1&controls=0&progress_bar=0&play_button=0&volume_control=1&fullscreen_button=0&music_info=0&description=0&rel=0&native_context_menu=0&closed_caption=0`}
                        allow="autoplay; encrypted-media"
                        title={label(recipe)}
                    />
                )}
                {onToggleLater && (
                    <button
                        className={`${styles.laterBtn} ${later ? styles.laterBtnOn : ''}`}
                        onClick={(e) => { e.stopPropagation(); haptic(12); onToggleLater(recipe); }}
                        aria-label={later ? 'Retirer de « À faire plus tard »' : 'Ajouter à « À faire plus tard »'}
                    >
                        {later ? (
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none"><path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        ) : (
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg>
                        )}
                    </button>
                )}
            </div>
            {/* Le titre ouvre la fiche — c'est lui qu'on vise pour « voir la recette ». */}
            <button
                className={styles.cardLabelBtn}
                onClick={(e) => {
                    e.stopPropagation();
                    if (lp.consumed.current) { lp.consumed.current = false; return; }
                    haptic(8);
                    onOpen();
                }}
            >
                {label(recipe)}
            </button>
            {subtitle && <div className={styles.cardSub}>{subtitle}</div>}
        </div>
    );
}

// ── Top 10 : une recette par écran + lecture auto de la vidéo ──────────────

/**
 * Vrai dès qu'un calque recouvre l'accueil (fiche, recherche, menu…).
 *
 * Au niveau du module : le héros et l'accueil sont deux composants distincts de
 * ce fichier, et un seul accueil vit à la fois.
 */
const calqueOuvert = { current: false };

/**
 * Id TikTok. Les recettes de l'accueil l'apportent déjà (extrait au build) ;
 * l'expression régulière ne sert plus qu'aux recettes venues d'ailleurs.
 */
const tiktokId = (recipe: Recipe) =>
    (recipe as HomeRecipe).tiktokId
    || recipe.videoHtml?.match(/data-video-id="(\d+)"/)?.[1]
    || null;

/** Délai d'affichage avant que la vidéo ne démarre. */
const AUTOPLAY_DELAY = 2000;

/**
 * Collection d'où l'on partage : la rangée ou la page « Voir tout » qui porte
 * la carte (thème, catégorie, pays) — pas la catégorie de la recette cliquée.
 */
type Coll = { label: string; tag: string; count: number };
const collOf = (title: string, count: number, tag?: string): Coll | undefined => {
    const t = collectionTagOf(tag || title);
    return t ? { label: title, tag: t, count } : undefined;
};

function TopTenRow({
    recipes,
    title,
    onSeeAll,
    onOpen,
    onLongPress,
    isLater,
    onToggleLater,
}: {
    recipes: Recipe[];
    title: string;
    onSeeAll: (title: string, recipes: Recipe[]) => void;
    onOpen: OpenSheet;
    onLongPress: (recipe: Recipe) => void;
    isLater?: (id: string) => boolean;
    onToggleLater?: (r: Recipe) => void;
}) {
    const [visibleId, setVisibleId] = useState<string | null>(null);
    const [playingId, setPlayingId] = useState<string | null>(null);
    // Grand écran : la lecture ne part plus toute seule, elle suit la souris.
    const [wide, setWide] = useState(false);
    const hoverTimer = useRef<ReturnType<typeof setTimeout>>();
    const [showControls, setShowControls] = useState(false);
    const [progress, setProgress] = useState({ current: 0, duration: 0 });
    const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const frameRef = useRef<HTMLIFrameElement | null>(null);
    const hideTimer = useRef<ReturnType<typeof setTimeout>>();
    // Appui long : un seul doigt à la fois, un timer partagé suffit (pas de hook
    // par carte, ce qui violerait les règles des hooks dans un map).
    const pressTimer = useRef<ReturnType<typeof setTimeout>>();
    const pressConsumed = useRef(false);
    const pressStart = (r: Recipe) => {
        clearTimeout(pressTimer.current);
        pressTimer.current = setTimeout(() => {
            pressConsumed.current = true;
            navigator.vibrate?.(12);
            onLongPress(r);
        }, 480);
    };
    const pressCancel = () => clearTimeout(pressTimer.current);

    /** Commande le lecteur TikTok (API postMessage du player v1). */
    const command = useCallback((type: string, value?: unknown) => {
        frameRef.current?.contentWindow?.postMessage(
            { type, value, 'x-tiktok-player': true },
            '*'
        );
    }, []);

    useEffect(() => {
        const mq = window.matchMedia('(min-width: 760px)');
        const sync = () => setWide(mq.matches);
        sync();
        mq.addEventListener('change', sync);
        return () => mq.removeEventListener('change', sync);
    }, []);

    /** Survol prolongé (1,5 s) → lecture. Quitter la carte l'arrête. */
    const hoverStart = (id: string) => {
        if (!wide) return;
        clearTimeout(hoverTimer.current);
        hoverTimer.current = setTimeout(() => setPlayingId(id), 1500);
    };
    const hoverEnd = (id: string) => {
        if (!wide) return;
        clearTimeout(hoverTimer.current);
        setPlayingId((prev) => (prev === id ? null : prev));
    };
    useEffect(() => () => clearTimeout(hoverTimer.current), []);

    // Quelle carte joue ? Les cartes sont désormais petites : plusieurs tiennent à
    // l'écran, un simple seuil de visibilité en aurait désigné deux à la fois.
    // On prend donc la plus proche du CENTRE de la rangée, et seulement si la
    // rangée elle-même est visible dans la page.
    const scrollerRef = useRef<HTMLDivElement>(null);
    const [rowVisible, setRowVisible] = useState(false);

    useEffect(() => {
        const el = scrollerRef.current;
        if (!el) return;
        const io = new IntersectionObserver(
            ([e]) => setRowVisible(e.isIntersecting && e.intersectionRatio >= 0.6),
            { threshold: [0, 0.6, 1] }
        );
        io.observe(el);
        return () => io.disconnect();
    }, []);

    useEffect(() => {
        const el = scrollerRef.current;
        if (!el) return;
        const pickCentered = () => {
            // Sur téléphone une seule carte tient à l'écran : le centre est le bon
            // repère. Sur grand écran, six cartes cohabitent et le centre tombait
            // sur la 3ᵉ ou la 4ᵉ — d'où une vidéo qui démarrait au milieu de la
            // rangée. On vise alors la première carte de la rangée.
            const wide = window.innerWidth >= 760;
            const mid = wide ? el.scrollLeft + 1 : el.scrollLeft + el.clientWidth / 2;
            let bestId: string | null = null;
            let bestDist = Infinity;
            Object.entries(cardRefs.current).forEach(([id, node]) => {
                if (!node) return;
                const center = node.offsetLeft + node.offsetWidth / 2;
                const dist = Math.abs(center - mid);
                if (dist < bestDist) { bestDist = dist; bestId = id; }
            });
            setVisibleId((prev) => (prev === bestId ? prev : bestId));
        };
        pickCentered();
        el.addEventListener('scroll', pickCentered, { passive: true });
        return () => el.removeEventListener('scroll', pickCentered);
    }, [recipes]);

    // 2 s d'affichage continu → on monte l'iframe. Un seul lecteur à la fois :
    // sortir la carte de l'écran démonte l'iframe (la lecture s'arrête).
    useEffect(() => {
        // Sur grand écran, c'est le survol qui commande : aucune lecture d'office.
        if (wide) { setPlayingId(null); return; }
        if (!visibleId || !rowVisible) {
            setPlayingId(null);
            return;
        }
        const t = setTimeout(() => setPlayingId(visibleId), AUTOPLAY_DELAY);
        return () => clearTimeout(t);
    }, [visibleId, rowVisible, wide]);

    // Nouvelle vidéo = état neuf (sans commandes, progression à zéro).
    useEffect(() => {
        setShowControls(false);
        setProgress({ current: 0, duration: 0 });
    }, [playingId]);

    // Le player diffuse sa position et sa durée : de quoi tracer NOTRE barre.
    useEffect(() => {
        const onMessage = (e: MessageEvent) => {
            // Pas de filtre sur e.source : la comparaison de fenêtres cross-origin
            // échouait et TOUS les messages du player étaient jetés (durée jamais
            // reçue → barre figée et seek impossible). Un seul lecteur à la fois,
            // la signature `x-tiktok-player` suffit à identifier la source.
            const d = e.data;
            if (!d || typeof d !== 'object' || !d['x-tiktok-player']) return;
            if (d.type === 'onCurrentTime' && d.value) {
                setProgress({ current: d.value.currentTime || 0, duration: d.value.duration || 0 });
            }
        };
        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
    }, []);

    // Le player n'émet `onCurrentTime` qu'aux changements d'état (pas de tic
    // régulier) : on avance la position nous-mêmes, resynchronisée à chaque
    // message reçu et à chaque seek.
    useEffect(() => {
        if (!playingId || !progress.duration) return;
        const id = setInterval(() => {
            setProgress((p) => (p.duration ? { ...p, current: (p.current + 0.25) % p.duration } : p));
        }, 250);
        return () => clearInterval(id);
    }, [playingId, progress.duration]);

    /** Affiche nos commandes puis les masque après 2 s sans interaction. */
    const revealControls = useCallback(() => {
        setShowControls(true);
        clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => setShowControls(false), 2000);
    }, []);

    useEffect(() => () => clearTimeout(hideTimer.current), []);

    // Seek au doigt : on suit le glissement en local puis on envoie la position
    // au lecteur au relâchement (et au clic, pour la souris).
    const barRef = useRef<HTMLDivElement | null>(null);

    const ratioFromX = (clientX: number) => {
        const rect = barRef.current?.getBoundingClientRect();
        if (!rect || !rect.width) return 0;
        return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    };

    const previewSeek = (clientX: number) => {
        if (!progress.duration) return;
        const ratio = ratioFromX(clientX);
        setProgress((p) => ({ ...p, current: ratio * p.duration }));
        revealControls();
    };

    const commitSeek = () => {
        if (!progress.duration) return;
        command('seekTo', progress.current);
        revealControls();
    };

    const clock = (s: number) => {
        const t = Math.max(0, Math.round(s));
        return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    };

    if (!recipes.length) return null;

    return (
        <section className={styles.row} data-reveal>
            <button className={styles.rowHead} onClick={() => { haptic(8); onSeeAll(title, recipes); }}>
                <h2 className={styles.rowTitle}>{title}</h2>
                <Chevron />
            </button>
            <div className={`${styles.rowScroll} ${styles.top10Scroll}`} ref={scrollerRef}>
                {recipes.map((r, i) => {
                    const id = String(r.id);
                    const vid = tiktokId(r);
                    const playing = playingId === id && !!vid;
                    return (
                        <div
                            key={id}
                            data-recipe-id={id}
                            ref={(el) => { cardRefs.current[id] = el; }}
                            className={styles.top10Card}
                        >
                            {/* Frère de la vignette, pas enfant : `overflow: hidden`
                                rognait la moitié qui doit déborder à gauche.
                                « 10 » est deux fois plus large → réduit pour que
                                sa moitié tienne dans le même écart. */}
                            <span
                                className={styles.top10Rank}
                                style={i + 1 >= 10 ? { fontSize: 58 } : undefined}
                            >
                                {i + 1}
                            </span>

                            <div
                                className={styles.top10Thumb}
                                onMouseEnter={() => hoverStart(id)}
                                onMouseLeave={() => hoverEnd(id)}
                                onTouchStart={() => pressStart(r)}
                                onTouchMove={pressCancel}
                                onTouchEnd={pressCancel}
                                onTouchCancel={pressCancel}
                                onContextMenu={(e) => { e.preventDefault(); onLongPress(r); }}
                                // Vidéo lancée : le tap sert à nos commandes, pas à ouvrir
                                // la fiche (le titre s'en charge).
                                onClick={playing ? undefined : () => {
                                    if (pressConsumed.current) { pressConsumed.current = false; return; }
                                    onOpen(recipes, i);
                                }}
                            >
                                <img src={r.image} alt={label(r)} className={styles.thumbImg} loading="lazy" decoding="async" draggable={false} />

                                {playing && (
                                    <iframe
                                        ref={frameRef}
                                        className={styles.top10Video}
                                        // Toute l'interface TikTok est coupée (controls=0) :
                                        // ni barre de progression, ni colonne like/commentaire.
                                        // On pilote le lecteur par postMessage à la place.
                                        src={`https://www.tiktok.com/player/v1/${vid}?autoplay=1&controls=0&progress_bar=0&play_button=0&volume_control=1&fullscreen_button=0&music_info=0&description=0&rel=0&native_context_menu=0&closed_caption=0`}
                                        allow="autoplay; encrypted-media"
                                        title={label(r)}
                                    />
                                )}

                                <div className={styles.top10Scrim} />

                                {onToggleLater && (
                                    <button
                                        className={`${styles.laterBtn} ${isLater?.(id) ? styles.laterBtnOn : ''}`}
                                        onClick={(e) => { e.stopPropagation(); haptic(12); onToggleLater(r); }}
                                        aria-label={isLater?.(id) ? 'Retirer de « À faire plus tard »' : 'Ajouter à « À faire plus tard »'}
                                    >
                                        {isLater?.(id) ? (
                                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none"><path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                        ) : (
                                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg>
                                        )}
                                    </button>
                                )}

                                {playing && (
                                    <>
                                        {/* L'iframe ne remonte pas les taps : cette zone le fait.
                                            Elle ne couvre QUE le bas du cadre — le haut doit rester
                                            libre, c'est là que le lecteur pose son bouton de son. */}
                                        <div className={styles.top10Tap} onClick={revealControls} />

                                        <div className={`${styles.top10Controls} ${showControls ? styles.top10ControlsOn : ''}`}>
                                            <div
                                                ref={barRef}
                                                className={styles.top10Bar}
                                                onTouchStart={(e) => { e.stopPropagation(); previewSeek(e.touches[0].clientX); }}
                                                onTouchMove={(e) => { e.stopPropagation(); previewSeek(e.touches[0].clientX); }}
                                                onTouchEnd={(e) => { e.stopPropagation(); commitSeek(); }}
                                                onClick={(e) => { e.stopPropagation(); previewSeek(e.clientX); commitSeek(); }}
                                            >
                                                <div className={styles.top10BarTrack}>
                                                    <div
                                                        className={styles.top10BarFill}
                                                        style={{ width: `${progress.duration ? (progress.current / progress.duration) * 100 : 0}%` }}
                                                    />
                                                </div>
                                            </div>
                                            <span className={styles.top10Time}>
                                                {clock(progress.current)} / {clock(progress.duration)}
                                            </span>
                                        </div>
                                    </>
                                )}

                                <div className={styles.top10Overlay}>
                                    <div
                                        className={styles.top10Text}
                                        role="button"
                                        tabIndex={0}
                                        onClick={(e) => { e.stopPropagation(); onOpen(recipes, i); }}
                                    >
                                        <div className={styles.top10Title}>{label(r)}</div>
                                        {/* Chevron sur la ligne d'infos : dans le titre
                                            (boîte clampée), il tombait tout seul à la ligne. */}
                                        <div className={styles.top10Sub}>
                                            {[catLabel(r), timeLabel(r)].filter(Boolean).join(' · ')}
                                            <Chevron />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            <RowArrow scroller={scrollerRef} />
        </section>
    );
}

/**
 * Flèche de défilement : n'apparaît que si la rangée déborde réellement, et
 * disparaît une fois arrivé au bout. Elle signale les cartes hors champ, que
 * plus aucun rognage ne laisse deviner.
 */
function RowArrow({ scroller }: { scroller: React.RefObject<HTMLDivElement> }) {
    const [show, setShow] = useState(false);

    useEffect(() => {
        const el = scroller.current;
        if (!el) return;
        const update = () => setShow(el.scrollWidth - el.clientWidth - el.scrollLeft > 8);
        update();
        el.addEventListener('scroll', update, { passive: true });
        window.addEventListener('resize', update);
        return () => {
            el.removeEventListener('scroll', update);
            window.removeEventListener('resize', update);
        };
    }, [scroller]);

    if (!show) return null;
    return (
        <button
            className={styles.rowArrow}
            aria-label="Voir la suite"
            onClick={() => scroller.current?.scrollBy({ left: scroller.current.clientWidth * 0.82, behavior: 'smooth' })}
        >
            <svg viewBox="0 0 8 14" fill="none" aria-hidden>
                <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        </button>
    );
}

// ── Rangée ─────────────────────────────────────────────────────────────────

function Row({
    title,
    recipes,
    variant = 'medium',
    overlayTitle = false,
    withProgress = false,
    progressMap,
    subtitleMode,
    shareTag,
    isLater,
    onToggleLater,
    onSeeAll,
    onOpen,
    onLongPress,
    showcase = false,
}: {
    title: string;
    recipes: Recipe[];
    variant?: CardVariant;
    overlayTitle?: boolean;
    withProgress?: boolean;
    /** Progression réelle par recette (id → %), pour « Reprendre la cuisine ». */
    progressMap?: Record<string, number>;
    subtitleMode?: 'time' | 'category';
    /** Thème partageable : ajoute le bouton « Partager » (lien /?tag=…). */
    shareTag?: string;
    isLater?: (id: string) => boolean;
    onToggleLater?: (r: Recipe) => void;
    onSeeAll: (title: string, recipes: Recipe[]) => void;
    onOpen: OpenSheet;
    onLongPress: (recipe: Recipe, coll?: Coll) => void;
    /**
     * Vitrine : grandes cartes à titre incrusté, et la carte arrêtée au CENTRE
     * de la rangée lance sa vidéo au bout d'une seconde et demie — l'équivalent
     * tactile du survol prolongé de la version de bureau.
     */
    showcase?: boolean;
}) {
    const scroller = useRef<HTMLDivElement>(null);
    // La rangée SAIT ce qu'elle est : son titre (ou son tag de thème) nomme la
    // collection que ses cartes partagent.
    const coll = collOf(title, recipes.length, shareTag);
    // Carte qui joue : la plus proche du centre, une fois le doigt reposé.
    const [playId, setPlayId] = useState<string | null>(null);
    const shown = recipes.slice(0, 14);

    useEffect(() => {
        if (!showcase) return;
        const el = scroller.current;
        if (!el) return;
        let timer: ReturnType<typeof setTimeout>;
        let raf = 0;
        let onScreen = false;

        const centred = () => {
            const mid = el.scrollLeft + el.clientWidth / 2;
            let best: string | null = null;
            let dist = Infinity;
            Array.from(el.children).forEach((c) => {
                const n = c as HTMLElement;
                const d = Math.abs(n.offsetLeft + n.offsetWidth / 2 - mid);
                if (d < dist) { dist = d; best = n.dataset.id ?? null; }
            });
            return best;
        };
        const schedule = () => {
            clearTimeout(timer);
            setPlayId(null);
            // Navigateur qui n'a jamais réussi à lire : on ne tente rien.
            if (!onScreen || !tiktokAllowed()) return;
            timer = setTimeout(() => setPlayId(centred()), 1500);
        };
        const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(schedule); };

        // On ne joue que si la rangée est vraiment à l'écran.
        const io = new IntersectionObserver(([e]) => {
            onScreen = e.isIntersecting && e.intersectionRatio >= 0.5;
            schedule();
        }, { threshold: [0, 0.5, 1] });
        io.observe(el);
        el.addEventListener('scroll', onScroll, { passive: true });
        return () => {
            io.disconnect();
            el.removeEventListener('scroll', onScroll);
            clearTimeout(timer);
            cancelAnimationFrame(raf);
        };
    }, [showcase, recipes]);

    if (!recipes.length) return null;

    const sub = (r: Recipe) =>
        subtitleMode === 'time' ? [catLabel(r), timeLabel(r)].filter(Boolean).join(' · ')
        : subtitleMode === 'category' ? catLabel(r)
        : undefined;

    // Partage d'un thème : lien /?tag=… qui rouvre la collection à l'arrivée.
    // Sur mobile, la feuille de partage native si elle existe, sinon copie.
    const share = async () => {
        if (!shareTag) return;
        haptic(12);
        const url = `${window.location.origin}/?tag=${encodeURIComponent(shareTag)}`;
        try {
            if (navigator.share) await navigator.share({ title: `Thème : ${title}`, url });
            else await navigator.clipboard.writeText(url);
        } catch { /* partage annulé : rien à signaler */ }
    };

    return (
        <section className={styles.row} data-reveal>
            <div className={styles.rowHeadWrap}>
                <button className={styles.rowHead} onClick={() => { haptic(8); onSeeAll(title, recipes); }}>
                    <h2 className={styles.rowTitle}>{title}</h2>
                    <Chevron />
                </button>
                {shareTag && (
                    <button className={styles.rowShare} onClick={share} aria-label={`Partager « ${title} »`}>
                        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                            <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
                        </svg>
                    </button>
                )}
            </div>
            <div className={`${styles.rowScroll} ${showcase ? styles.rowScrollShowcase : ''}`} ref={scroller}>
                {shown.map((r, i) => (
                    <Card
                        key={r.id}
                        domId={String(r.id)}
                        recipe={r}
                        variant={variant}
                        showcase={showcase}
                        videoId={showcase && playId === String(r.id) ? tiktokId(r) : null}
                        overlayTitle={overlayTitle}
                        subtitle={sub(r)}
                        progress={withProgress ? (progressMap?.[String(r.id)] ?? 0) : undefined}
                        later={isLater?.(String(r.id))}
                        onToggleLater={onToggleLater}
                        // La liste passée est CELLE DE LA RANGÉE entière (pas les 14
                        // affichées) : dans le sheet, on continue de swiper.
                        onOpen={() => onOpen(recipes, i)}
                        onLongPress={() => onLongPress(r, coll)}
                    />
                ))}
            </div>
            <RowArrow scroller={scroller} />
        </section>
    );
}

// ── Héros ──────────────────────────────────────────────────────────────────

function Hero({ recipes, onOpen, onMenu }: { recipes: Recipe[]; onOpen: OpenSheet; onMenu: () => void }) {
    const pagerRef = useRef<HTMLDivElement>(null);
    const [index, setIndex] = useState(0);
    // La vidéo ne part pas d'emblée : la photo s'installe deux secondes, comme
    // sur la rangée Top 10, puis la vidéo prend sa place dans le même cadre.
    const [playing, setPlaying] = useState(false);
    // ...et elle ne se montre QUE si elle joue pour de bon. Sans consentement
    // TikTok dans ce navigateur, le lecteur affiche son bandeau de cookies à la
    // place de la vidéo : la photo du héros se faisait remplacer par un pavé
    // bleu « Allow all ». Le lecteur signale sa lecture par postMessage — tant
    // qu'on n'a rien reçu, l'image reste.
    const [videoOn, setVideoOn] = useState(false);
    const playingRef = useRef(false);
    playingRef.current = playing && videoOn;
    const { scrollY } = useScroll();

    // Parallaxe : le héros s'éloigne (zoom + translation) et se fond au noir
    // pendant que la feuille de contenu remonte par-dessus.
    const heroScale = useTransform(scrollY, [0, 600], [1, 1.16]);
    const heroY = useTransform(scrollY, [0, 600], [0, 90]);
    const veil = useTransform(scrollY, [0, 480], [0, 0.9]);
    const contentY = useTransform(scrollY, [0, 400], [0, -70]);
    const contentOpacity = useTransform(scrollY, [0, 260], [1, 0]);
    // La signature s'efface plus tôt que le reste : elle appartient au haut de page.
    const brandOpacity = useTransform(scrollY, [0, 140], [1, 0]);
    const brandY = useTransform(scrollY, [0, 300], [0, -40]);

    // La bande d'affiches est répétée trois fois et c'est la copie du MILIEU qui
    // est active : il y a donc toujours des voisines des deux côtés, la bande
    // court d'un bord à l'autre — même mécanique que le héros de bureau.
    const loop = useMemo(() => [...recipes, ...recipes, ...recipes], [recipes]);
    const activeSlot = recipes.length + index;

    // Le doigt est-il en train de faire défiler ? Tant qu'il l'est, on ne
    // recentre pas sous ses doigts.
    const userScrolling = useRef(false);
    const settleTimer = useRef<ReturnType<typeof setTimeout>>();
    const lastSlot = useRef(0);
    const didInit = useRef(false);

    // Index courant : l'affiche la plus proche du CENTRE du cadre. Puis, une fois
    // le geste retombé, on RAMÈNE silencieusement la bande dans la copie du
    // milieu : c'est ce qui rend le carrousel sans fin. Sans ce rattrapage, on
    // finissait par buter sur le bout de la bande.
    useEffect(() => {
        const el = pagerRef.current;
        if (!el || !recipes.length) return;
        let raf = 0;
        const onScroll = () => {
            userScrolling.current = true;
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => {
                const mid = el.scrollLeft + el.clientWidth / 2;
                let best = 0;
                let dist = Infinity;
                Array.from(el.children).forEach((c, i) => {
                    const n = c as HTMLElement;
                    const d = Math.abs(n.offsetLeft + n.offsetWidth / 2 - mid);
                    if (d < dist) { dist = d; best = i; }
                });
                lastSlot.current = best;
                const real = best % recipes.length;
                setIndex((prev) => (prev === real ? prev : real));
            });

            clearTimeout(settleTimer.current);
            settleTimer.current = setTimeout(() => {
                userScrolling.current = false;
                // Sorti de la copie du milieu : on saute sur l'affiche JUMELLE,
                // une copie plus loin. Le décalage se mesure entre les deux
                // nœuds — `scrollWidth / 3` était faux (les écarts entre copies
                // comptent dedans) et l'accrochage rattrapait ensuite d'un cran,
                // ce qui faisait changer de recette toute seule.
                const slot = lastSlot.current;
                const twin = slot < recipes.length ? slot + recipes.length
                    : slot >= recipes.length * 2 ? slot - recipes.length
                    : -1;
                if (twin < 0) return;
                const from = el.children[slot] as HTMLElement | undefined;
                const to = el.children[twin] as HTMLElement | undefined;
                if (!from || !to) return;
                el.scrollLeft += to.offsetLeft - from.offsetLeft;
                lastSlot.current = twin;
            }, 170);
        };
        el.addEventListener('scroll', onScroll, { passive: true });
        return () => {
            el.removeEventListener('scroll', onScroll);
            cancelAnimationFrame(raf);
            clearTimeout(settleTimer.current);
        };
    }, [recipes.length]);

    // ...et l'affiche active revient au centre quand l'index change autrement
    // que par le doigt (chevrons, rotation, fin de vidéo).
    useEffect(() => {
        const el = pagerRef.current;
        const child = el?.children[activeSlot] as HTMLElement | undefined;
        if (!el || !child) return;
        const target = child.offsetLeft + child.offsetWidth / 2 - el.clientWidth / 2;
        // Premier rendu : on se pose sur la copie du milieu sans animation,
        // sinon la bande traverse l'écran au chargement.
        if (!didInit.current) {
            didInit.current = true;
            el.scrollLeft = target;
            return;
        }
        if (userScrolling.current) return;      // le doigt a la main
        if (Math.abs(el.scrollLeft - target) < 4) return;
        el.scrollTo({ left: target, behavior: 'smooth' });
    }, [activeSlot]);

    /*
     * Rotation auto toutes les 3 s. Le doigt reprend toujours la main : on met en
     * pause dès qu'on touche le héros, et on relance 6 s après le dernier geste.
     *
     * Elle s'arrête aussi quand une fiche ou un calque recouvre l'accueil. Le
     * garde-fou `scrollY > 240` n'y suffisait pas : à l'ouverture d'une fiche, le
     * corps est figé et le défilement retombe à zéro. Le héros continuait donc de
     * changer d'affiche derrière la fiche — relevé sur l'appareil, une vingtaine
     * d'animations d'opacité et de transformation pendant quelques balayages,
     * dont beaucoup interrompues en cours de route.
     */
    useEffect(() => {
        const el = pagerRef.current;
        if (!el || recipes.length < 2) return;
        let paused = false;
        let resume: ReturnType<typeof setTimeout>;
        const pause = () => {
            paused = true;
            clearTimeout(resume);
            resume = setTimeout(() => { paused = false; }, 6000);
        };
        el.addEventListener('pointerdown', pause, { passive: true });
        el.addEventListener('touchstart', pause, { passive: true });

        const id = setInterval(() => {
            // Ni quand l'onglet est en arrière-plan, ni quand le héros a quitté l'écran,
            // ni pendant la vidéo : on ne coupe pas une lecture en cours.
            if (paused || playingRef.current || document.hidden || window.scrollY > 240) return;
            if (calqueOuvert.current) return;
            setIndex((i) => (i + 1) % recipes.length);
        }, 3000);

        return () => {
            clearInterval(id);
            clearTimeout(resume);
            el.removeEventListener('pointerdown', pause);
            el.removeEventListener('touchstart', pause);
        };
    }, [recipes.length]);

    const current = recipes[Math.min(index, recipes.length - 1)];

    // 2 s d'image fixe, puis la vidéo. Changer de recette repart de l'image.
    const currentVid = current ? tiktokId(current) : null;
    useEffect(() => {
        setPlaying(false);
        setVideoOn(false);
        if (!currentVid || !tiktokAllowed()) return;
        // Héros sorti de l'écran ou onglet en arrière-plan : on ne démarre pas,
        // mais on réessaie — sinon une recette lue dans un onglet inactif ne
        // s'animerait plus jamais au retour.
        let t: ReturnType<typeof setTimeout>;
        const tryPlay = () => {
            if (!document.hidden && window.scrollY < 240) setPlaying(true);
            else t = setTimeout(tryPlay, 800);
        };
        t = setTimeout(tryPlay, AUTOPLAY_DELAY);
        return () => clearTimeout(t);
    }, [currentVid]);

    // Le lecteur TikTok parle : c'est qu'il joue (et non qu'il réclame un
    // consentement). On révèle la vidéo à ce moment-là, et seulement là.
    useEffect(() => {
        if (!playing) return;
        const onMessage = (e: MessageEvent) => {
            const sig = tiktokSignal(e);
            if (sig === 'play') { setVideoOn(true); tiktokPlayed(); }
            else if (sig === 'error') { tiktokFailed(); setPlaying(false); }
        };
        window.addEventListener('message', onMessage);
        // Silence au bout de 6 s = bandeau de cookies ou lecture refusée :
        // on retire le lecteur et la photo reprend la main, sans clignotement.
        const giveUp = setTimeout(() => setPlaying((p) => {
            if (!videoOn) tiktokFailed();
            return videoOn ? p : false;
        }), 6000);
        return () => { window.removeEventListener('message', onMessage); clearTimeout(giveUp); };
    }, [playing, videoOn]);

    // La vidéo va jusqu'au BOUT, et c'est sa fin qui fait tourner le héros.
    // Avant, la rotation de 3 s était simplement suspendue pendant la lecture et
    // plus rien ne la relançait : le héros restait bloqué sur la même recette.
    //
    // Le lecteur TikTok annonce sa position et sa durée (`onCurrentTime`) aux
    // changements d'état. On arme donc un minuteur sur le temps restant. Filet de
    // sécurité : s'il ne dit jamais sa durée, on passe quand même au bout de 25 s
    // — le carrousel ne doit JAMAIS se figer.
    useEffect(() => {
        if (!playing || !videoOn || recipes.length < 2) return;
        const nextCard = () => setIndex((i) => (i + 1) % recipes.length);
        let atEnd: ReturnType<typeof setTimeout>;
        let heardDuration = false;

        const onMessage = (e: MessageEvent) => {
            const d = e.data;
            if (!d || typeof d !== 'object' || !d['x-tiktok-player']) return;
            if (d.type !== 'onCurrentTime' || !d.value) return;
            const { currentTime = 0, duration = 0 } = d.value as { currentTime?: number; duration?: number };
            if (!duration) return;
            heardDuration = true;
            const left = Math.max(0.6, duration - currentTime);
            clearTimeout(atEnd);
            atEnd = setTimeout(nextCard, (left + 0.35) * 1000);
        };

        window.addEventListener('message', onMessage);
        const safety = setTimeout(() => { if (!heardDuration) nextCard(); }, 25000);
        return () => {
            window.removeEventListener('message', onMessage);
            clearTimeout(atEnd);
            clearTimeout(safety);
        };
    }, [playing, videoOn, recipes.length]);

    /** Chevrons du héros : une recette en avant ou en arrière, en boucle. */
    const step = (dir: 1 | -1) => {
        haptic(8);
        setIndex((i) => (i + dir + recipes.length) % recipes.length);
    };

    if (!current) return null;

    return (
        <div className={styles.heroSticky}>
            {/* Fond : la photo de l'affiche active, noyée de flou. Ce n'est plus
                elle qu'on balaye — c'est la galerie, en dessous. */}
            <motion.div className={styles.heroLayer} style={{ scale: heroScale, y: heroY }}>
                <img
                    key={current.id}
                    src={current.image}
                    alt=""
                    className={styles.heroBackdropImg}
                    decoding="async"
                    draggable={false}
                />
                <div className={styles.heroBackdropVeil} />
            </motion.div>

            <motion.div className={styles.heroVeil} style={{ opacity: veil }} />

            {/* Chevrons « Apple TV+ » : discrets, sur les côtés, pour passer aux
                autres recettes sans attendre la rotation ni balayer. */}
            {recipes.length > 1 && (
                <motion.div style={{ opacity: contentOpacity }}>
                    <button className={`${styles.heroNav} ${styles.heroNavPrev}`} aria-label="Recette précédente" onClick={() => step(-1)}>
                        <svg viewBox="0 0 8 14" fill="none" aria-hidden>
                            <path d="M7 1L1 7l6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                    <button className={`${styles.heroNav} ${styles.heroNavNext}`} aria-label="Recette suivante" onClick={() => step(1)}>
                        <svg viewBox="0 0 8 14" fill="none" aria-hidden>
                            <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                </motion.div>
            )}

            {/* Signature de marque : disparaît vite au scroll pour laisser la place au feed. */}
            <motion.div className={styles.brand} style={{ opacity: brandOpacity, y: brandY }}>
                <div className={styles.brandKicker}>Les recettes</div>
                <div className={styles.brandRow}>
                    <span className={styles.brandWord}>Magiques</span>
                    <span className={styles.brandCount}>{mockRecipes.length} recettes</span>
                </div>
                <div className={styles.brandRule} />
            </motion.div>

            {/* Volet de navigation : pendant du bouton compte, à gauche. */}
            <motion.button
                className={styles.heroMenuBtn}
                style={{ opacity: brandOpacity }}
                aria-label="Ouvrir le menu"
                onClick={onMenu}
            >
                <svg viewBox="0 0 24 24" fill="none">
                    <path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h11" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
                </svg>
            </motion.button>

            {/* Le compte visible a rejoint le menu (à droite du titre). On garde ici
                une instance INVISIBLE mais montée : c'est elle qui porte le panneau
                de connexion quand un cœur déconnecté émet `magic-open-auth` (le menu
                est fermé à ce moment-là, donc son AuthButton ne répondrait pas). */}
            <div className={styles.heroAuthGhost} aria-hidden>
                <AuthButton />
            </div>

            {/* Galerie d'affiches, comme sur ordinateur : celle du milieu est
                active — plus grande, nette, et c'est elle qui prend la vidéo au
                bout de deux secondes. Un doigt fait défiler la bande. */}
            <motion.div className={styles.heroContent} style={{ y: contentY, opacity: contentOpacity }}>
                <div className={styles.heroTrack} ref={pagerRef}>
                    {loop.map((r, i) => {
                        const real = i % recipes.length;
                        const on = i === activeSlot;
                        const ghost = i < recipes.length || i >= recipes.length * 2;
                        return (
                            <button
                                key={`${r.id}-${i}`}
                                className={`${styles.heroPoster} ${on ? styles.heroPosterOn : ''}`}
                                onClick={() => { haptic(8); if (on) onOpen(recipes, real); else setIndex(real); }}
                                aria-label={on ? `Voir ${label(r)}` : label(r)}
                                aria-current={on || undefined}
                                aria-hidden={ghost || undefined}
                                tabIndex={ghost ? -1 : 0}
                            >
                                <img
                                    src={r.image}
                                    alt=""
                                    className={styles.heroPosterImg}
                                    loading={real === 0 ? 'eager' : 'lazy'}
                                    decoding="async"
                                    draggable={false}
                                />
                                {on && playing && currentVid && (
                                    <iframe
                                        className={`${styles.heroShotVideo} ${videoOn ? styles.heroShotVideoOn : ''}`}
                                        // Interface TikTok coupée, SAUF le bouton du son : c'est
                                        // le seul qui puisse vraiment le rendre (voir la note plus
                                        // haut). Le cadre reste une image qui s'anime.
                                        src={`https://www.tiktok.com/player/v1/${currentVid}?autoplay=1&muted=1&controls=0&progress_bar=0&play_button=0&volume_control=1&fullscreen_button=0&music_info=0&description=0&rel=0&native_context_menu=0&closed_caption=0`}
                                        allow="autoplay; encrypted-media"
                                        title={label(r)}
                                    />
                                )}
                                <div className={styles.heroPosterVeil} aria-hidden />
                            </button>
                        );
                    })}
                </div>

                {/* Le texte désigne l'affiche active : il se substitue en fondu. */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={current.id}
                        className={styles.heroInfo}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
                    >
                        <span className={styles.heroKicker}>Nº {index + 1} des dernières recettes</span>

                        {/* Mot par mot : l'inclinaison porte sur chaque mot, jamais
                            sur le bloc — sinon les lignes s'escaladent vers la
                            droite et la première lettre sort de la colonne. */}
                        <h1 className={styles.heroTitleSplit}>
                            {label(current).split(/\s+/).filter(Boolean).map((w, n, all) => (
                                <Fragment key={`${w}-${n}`}>
                                    <span className={styles.heroTitleWord}>{w}</span>
                                    {n < all.length - 1 ? ' ' : ''}
                                </Fragment>
                            ))}
                        </h1>

                        <div className={styles.heroMetaSplit}>
                            <span>{catLabel(current)}</span>
                            {timeLabel(current) && (
                                <>
                                    <span className={styles.heroDot}>·</span>
                                    <span>{timeLabel(current)}</span>
                                </>
                            )}
                            <span className={styles.heroDot}>·</span>
                            <span>{(() => {
                                const d = timingOf(current).difficulty;
                                return d === 'facile' ? 'Facile' : d === 'moyen' ? 'Moyen' : 'Difficile';
                            })()}</span>
                            <span className={styles.heroBadge}>{current.servings || 4} pers.</span>
                        </div>

                        <div className={styles.heroActionsSplit}>
                            <button className={styles.heroPlaySplit} onClick={() => { haptic(10); onOpen(recipes, index); }}>
                                Voir la recette
                            </button>
                            <FavoriteButton
                                recipeId={String(current.id)}
                                imageUrl={current.image}
                                alwaysShow
                                className={styles.heroFavSplit}
                            />
                        </div>
                    </motion.div>
                </AnimatePresence>
            </motion.div>

        </div>
    );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function TVHome() {
    // Révélation des rangées au défilement (voir src/lib/scrollReveal.ts).
    useEffect(() => startScrollReveal(), []);

    const stats = useRatingStats();
    const [all, setAll] = useState<{ title: string; recipes: Recipe[] } | null>(null);
    const [sheet, setSheet] = useState<{ recipes: Recipe[]; index: number } | null>(null);
    const [menu, setMenu] = useState<{ recipe: Recipe; coll?: Coll } | null>(null);
    const [navOpen, setNavOpen] = useState(false);
    const [tasteOpen, setTasteOpen] = useState(false);
    const [shareCard, setShareCard] = useState<{ recipe: Recipe; category?: { label: string; tag: string; count: number } } | null>(null);
    // Proposition d'onboarding « goûts » UNE fois, et seulement en PWA installée
    // (vrai contexte « app ») — jamais forcé sur une visite web classique.
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone;
        if (standalone && !localStorage.getItem('taste-onboarded')) {
            const t = setTimeout(() => setTasteOpen(true), 1200);
            return () => clearTimeout(t);
        }
    }, []);
    // Ouverture du menu par glissement gauche→droite depuis une bande à gauche.
    // On laisse les ~22 premiers px au geste « retour » natif d'iOS.
    // Le volet SUIT le doigt pendant le geste (`navPeek`) : on voit ce qu'on tire.
    const [navPeek, setNavPeek] = useState(0);
    const navTouch = useRef<{ x: number; y: number } | null>(null);
    const navPulling = useRef(false);
    const panelW = () => Math.min(window.innerWidth * 0.84, 330);

    const onPageTouchStart = (e: React.TouchEvent) => {
        const t = e.touches[0];
        navTouch.current = { x: t.clientX, y: t.clientY };
        navPulling.current = false;
    };
    const onPageTouchMove = (e: React.TouchEvent) => {
        const s = navTouch.current;
        if (!s || navOpen) return;
        const t = e.touches[0];
        const dx = t.clientX - s.x, dy = t.clientY - s.y;
        // Le geste ne devient « ouverture du volet » que s'il part de la bande
        // de gauche ET s'il est franchement horizontal : sinon c'est un
        // défilement vertical, qu'on laisse tranquille.
        if (!navPulling.current) {
            if (s.x <= 22 || s.x >= 64) return;
            if (dx < 12 || Math.abs(dy) > Math.abs(dx)) return;
            navPulling.current = true;
        }
        setNavPeek(Math.max(0, Math.min(1, dx / panelW())));
    };
    const onPageTouchEnd = (e: React.TouchEvent) => {
        const s = navTouch.current; navTouch.current = null;
        const pulling = navPulling.current; navPulling.current = false;
        if (!s || navOpen) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - s.x, dy = t.clientY - s.y;
        setNavPeek(0);
        if (pulling ? dx > panelW() * 0.32 : (s.x > 22 && s.x < 64 && dx > 55 && Math.abs(dy) < 40)) {
            haptic(10); setNavOpen(true);
        }
    };
    useFittedCards();
    const [filters, setFilters] = useState<string[]>([]);
    const [navQuery, setNavQuery] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);
    const [tutoOpen, setTutoOpen] = useState(false);
    const [laterIds, setLaterIds] = useState<string[]>([]);
    const [favIds, setFavIds] = useState<string[]>([]);

    // « Reprendre la cuisine » : recettes réellement EN COURS (étapes entamées,
    // pas terminées). Recalculé quand une étape est cochée et au retour sur l'onglet.
    const [inProgress, setInProgress] = useState<{ recipe: Recipe; pct: number }[]>([]);
    useEffect(() => {
        const load = () => setInProgress(inProgressRecipes(mockRecipes));
        load();
        window.addEventListener(PROGRESS_EVENT, load);
        window.addEventListener('focus', load);
        return () => { window.removeEventListener(PROGRESS_EVENT, load); window.removeEventListener('focus', load); };
    }, []);

    // « Pour toi » : recommandations déduites en silence des favoris / vues / cuisinées.
    const [forYou, setForYou] = useState<Recipe[]>([]);
    useEffect(() => {
        const load = () => setForYou(personalizedRecipes(mockRecipes) as Recipe[]);
        load();
        const evts = ['tv-seen-change', 'magic-favorite-change', PROGRESS_EVENT, 'focus'];
        evts.forEach((e) => window.addEventListener(e, load));
        return () => evts.forEach((e) => window.removeEventListener(e, load));
    }, []);

    // Listes locales : « à faire plus tard » et cache des favoris, tenues à jour
    // par les events déjà émis par l'app (favoris) et par le nôtre.
    useEffect(() => {
        const sync = () => {
            setLaterIds(readIds(LATER_KEY));
            setFavIds(readIds('favorites'));
        };
        sync();
        window.addEventListener('tv-later-change', sync);
        window.addEventListener('magic-favorite-change', sync);
        window.addEventListener('storage', sync);
        return () => {
            window.removeEventListener('tv-later-change', sync);
            window.removeEventListener('magic-favorite-change', sync);
            window.removeEventListener('storage', sync);
        };
    }, []);

    // La loupe de la barre du bas ouvre désormais directement la recherche
    // « Apple TV+ » (TVSpotlight branché dans BottomNav) : plus besoin d'intercepter.

    // Un calque plein écran est ouvert (recherche, fiche recette, grille « tout
    // afficher », menu d'appui long) → on masque la barre du bas (BottomNav prod).
    // Sinon son dock (Accueil/loupe) reste tappable par-dessus ou à travers le
    // calque selon le contexte d'empilement, et ses boutons se comportent mal.
    const overlayOpen = searchOpen || tutoOpen || !!sheet || !!all || !!menu;
    // La rotation du héros doit s'arrêter quand un calque le recouvre ; elle
    // tourne dans un intervalle, qui ne verrait pas passer un état.
    calqueOuvert.current = overlayOpen;
    useEffect(() => {
        const bar = document.getElementById('bottom-nav');
        if (!bar) return;
        bar.style.display = overlayOpen ? 'none' : '';
        return () => { bar.style.display = ''; };
    }, [overlayOpen]);

    /*
     * Étapes, ingrédients et embeds vidéo ne servent qu'une fois une fiche
     * ouverte : on les récupère quand le navigateur n'a plus rien d'urgent à
     * faire, donc après l'affichage des rangées, et bien avant le premier appui.
     */
    useEffect(() => {
        const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
        if (w.requestIdleCallback) w.requestIdleCallback(() => { void chargerVideos(); });
        else setTimeout(() => { void chargerVideos(); }, 1200);
    }, []);

    const openMenu = useCallback((recipe: Recipe, coll?: Coll) => setMenu({ recipe, coll }), []);

    // Le balayage « retour » ferme le calque du dessus au lieu de quitter /tv.
    useBackToClose(!!all, () => setAll(null));
    useBackToClose(!!sheet, () => setSheet(null));
    useBackToClose(!!menu, () => setMenu(null));
    useBackToClose(navOpen, () => setNavOpen(false));
    useBackToClose(searchOpen, () => setSearchOpen(false));
    useBackToClose(tutoOpen, () => setTutoOpen(false));

    const toggleFilter = useCallback((token: string) => {
        setFilters((prev) => (prev.includes(token) ? prev.filter((t) => t !== token) : [...prev, token]));
    }, []);

    /**
     * Résultat des filtres cochés : OU à l'intérieur d'un groupe (Desserts OU
     * Glaces), ET entre groupes (dessert ET espagnol ET express).
     */
    const filterResults = useMemo(() => {
        const q = norm(navQuery.trim());
        if (!filters.length && !q) return [];
        const byGroup: Record<string, string[]> = {};
        filters.forEach((t) => {
            const [g, v] = [t.slice(0, 1), t.slice(2)];
            (byGroup[g] ||= []).push(v);
        });
        // Une catégorie cochée désactive les garde-fous de catégorie des thèmes.
        const hasCategory = !!byGroup['c']?.length;
        return mockRecipes.filter((r) => {
            if (!r.image) return false;
            // Recherche texte : titre, catégorie ou tag (combiné ET avec les filtres).
            if (q) {
                const hit = norm(label(r)).includes(q)
                    || norm(catLabel(r)).includes(q)
                    || (r.tags || []).some((t) => norm(t).includes(q));
                if (!hit) return false;
            }
            return Object.entries(byGroup).every(([g, values]) =>
                values.some((v) => {
                    if (g !== 'c') return matchesTag(r, v, { ignoreCategoryGuards: hasCategory });
                    // Catégorie : « accompagnements » n'existe que comme tag WordPress.
                    const tags = (r.tags || []).map((t) => t.toLowerCase());
                    if (v === 'accompagnements') return tags.includes('accompagnement') || tags.includes('accompagnements');
                    return (r.category || '').toLowerCase() === v;
                })
            );
        });
    }, [filters, navQuery]);

    /** Intitulé de la sélection : « Recherche · Desserts · Espagne ». */
    const filterTitle = useMemo(() => {
        const all = [...CATEGORY_OPTIONS, ...TREND_OPTIONS, ...COUNTRY_OPTIONS];
        const parts = filters.map((t) => all.find((o) => o.token === t)?.label).filter(Boolean) as string[];
        const q = navQuery.trim();
        if (q) parts.unshift(`« ${q} »`);
        return parts.join(' · ') || 'Résultats';
    }, [filters, navQuery]);

    const openAll = useCallback((title: string, recipes: Recipe[]) => {
        setAll({ title, recipes });
    }, []);

    // Lien de thème partagé (/?tag=…) : la grille du thème s'ouvre à l'arrivée,
    // puis l'URL est nettoyée. Les liens déjà envoyés utilisent tantôt le tag
    // interne (« dolce-vita »), tantôt le libellé WordPress (« Italie ») : on
    // accepte les deux, sinon un lien partagé depuis l'ordinateur tombait sur
    // l'accueil sans explication.
    useEffect(() => {
        let raw: string | null = null;
        try { raw = new URLSearchParams(window.location.search).get('tag'); } catch { return; }
        if (!raw) return;
        const low = raw.toLowerCase();
        const theme = THEMES.find((t) => t.tag.toLowerCase() === low)
            || THEMES.find((t) => t.title.toLowerCase() === low);
        const list = mockRecipes.filter((r) => r.image && matchesTag(r, theme?.tag || raw!));
        if (list.length) openAll(theme?.title || raw, list);
        try {
            const u = new URL(window.location.href);
            u.searchParams.delete('tag');
            window.history.replaceState({}, '', u.pathname + u.search + u.hash);
        } catch { /* noop */ }
    }, [openAll]);

    // Ouvre la fiche ET ses voisines de la même rangée : swipe horizontal dans le
    // sheet pour parcourir la catégorie sans revenir à l'accueil.
    const openSheet = useCallback<OpenSheet>((list, index) => {
        // Toute recette consultée alimente « Reprendre la cuisine ».
        const opened = list[index];
        if (opened) pushSeen(String(opened.id));
        const start = Math.max(0, Math.min(index - Math.floor(SHEET_WINDOW / 2), Math.max(0, list.length - SHEET_WINDOW)));
        /*
         * La fiche attend des étapes, des ingrédients et un embed vidéo. Ces
         * trois-là vivent dans des modules chargés à part — ils ne servent
         * qu'ici et pèsent les trois quarts du catalogue — et on les recolle au
         * moment d'ouvrir. S'ils ne sont pas encore arrivés (ouverture dans la
         * première seconde), la fiche s'affiche et se complète juste après.
         */
        setSheet({ recipes: list.slice(start, start + SHEET_WINDOW).map(completer), index: index - start });
        if (!detailsPrets()) {
            chargerVideos().then(() => {
                setSheet((ouvert) => (ouvert ? { ...ouvert, recipes: ouvert.recipes.map(completer) } : ouvert));
            });
        }
    }, []);

    const byCat = useMemo(() => {
        const g: Record<string, Recipe[]> = {};
        mockRecipes.forEach((r) => {
            // Recettes salées mal rangées en pâtisserie → exclues de la vue.
            if (isSavoryMiscat(r)) return;
            const tags = (r.tags || []).map((t) => t.toLowerCase());
            // Comme sur l'accueil actuel : « accompagnement » prime sur la catégorie
            // WordPress, où ces recettes sont rangées dans « plats ».
            const cat = tags.some((t) => t === 'accompagnement' || t === 'accompagnements')
                ? 'accompagnements'
                : (r.category || 'autres').toLowerCase();
            (g[cat] ||= []).push(r);
        });
        return g;
    }, []);

    // Le héros : les 6 dernières recettes PUBLIÉES. On trie explicitement par
    // identifiant décroissant — l'ordre de `mockData` suit la date de dernière
    // MODIFICATION, si bien qu'une vieille recette retouchée remontait en tête.
    const heroRecipes = useMemo(
        () => mockRecipes
            .filter((r) => r.category !== 'restaurant' && r.image)
            .slice()
            .sort((a, b) => parseInt(String(b.id), 10) - parseInt(String(a.id), 10))
            .slice(0, 6),
        []
    );

    const newest = useMemo(
        () => mockRecipes.filter((r) => r.category !== 'restaurant').slice(0, 14),
        []
    );

    // Top 10 : notes membres si dispo, sinon repli sur les votes puis l'ordre WP.
    const topTen = useMemo(() => {
        const rated = stats
            ? mockRecipes
                  .map((r) => ({ r, s: stats.get(String(r.id)) }))
                  .filter((x) => x.s && x.s.count > 0)
                  .sort((a, b) => b.s!.avg - a.s!.avg || b.s!.count - a.s!.count)
                  .slice(0, 10)
                  .map((x) => x.r)
            : [];
        if (rated.length >= 3) return rated;
        return [...mockRecipes].sort((a, b) => (b.votes || 0) - (a.votes || 0)).slice(0, 10);
    }, [stats]);

    // Rangée « Reprendre la cuisine » = recettes en cours (source réelle).
    const resume = useMemo(() => inProgress.map((x) => x.recipe), [inProgress]);
    const progressMap = useMemo(() => {
        const m: Record<string, number> = {};
        inProgress.forEach((x) => { m[String(x.recipe.id)] = x.pct; });
        return m;
    }, [inProgress]);

    const laterRecipes = useMemo(
        () => laterIds.map((id) => mockRecipes.find((r) => String(r.id) === id)).filter(Boolean) as Recipe[],
        [laterIds]
    );

    // Croix → coche sur les cartes : ajoute/retire de « À faire plus tard »,
    // avec un petit message central « Ajouté » / « Supprimé » (1,5 s).
    const isLater = useCallback((id: string) => laterIds.includes(id), [laterIds]);
    const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [toast, setToast] = useState<{ text: string } | null>(null);
    const flash = useCallback((text: string) => {
        setToast({ text });
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(null), 1500);
    }, []);
    const handleToggleLater = useCallback((r: Recipe) => {
        flash(toggleLater(String(r.id)) ? 'Ajouté' : 'Supprimé');
    }, [flash]);
    /*
     * « Marquer comme visionné » a quitté le menu des cartes.
     *
     * Le bouton n'affichait rien : il ajoutait seulement la recette à
     * l'historique, qui pèse pour 1 dans les recommandations « Pour toi »
     * (contre 3 pour un favori). Un intitulé qui promet un suivi visible et ne
     * montre rien vaut moins que pas de bouton. Le signal continue d'être
     * enregistré tout seul à l'ouverture d'une fiche : rien n'est perdu.
     */

    // Partage (feuille native ou copie).
    const shareLink = useCallback(async (url: string, title: string) => {
        try {
            if (navigator.share) await navigator.share({ title, url });
            else { await navigator.clipboard.writeText(url); flash('Lien copié'); }
        } catch { /* annulé */ }
    }, [flash]);

    // Thématiques : plus de tuiles illustrées — chaque thème devient une rangée de
    // vraies recettes. Un seul balayage de mockRecipes par thème, mémorisé.
    const themeRows = useMemo(() => {
        // Format par défaut : alternance, pour que le feed ne devienne pas monotone.
        const VARIANTS: CardVariant[] = ['poster', 'wide', 'square', 'medium'];
        // Réglages explicites, thème par thème.
        const FIXED: Record<string, CardVariant> = {
            astuces: 'small',   // fiches courtes : petites vignettes
            airfryer: 'wide',   // thème mis en avant
        };
        // Ordre alphabétique français (accents et casse ignorés) sur le libellé affiché.
        const sorted = [...THEMES].sort((a, b) => a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' }));
        return sorted.map((theme, i) => ({
            title: theme.title,
            tag: theme.tag,
            // Les restaurants ont leur propre rangée en bas : on les sort des thèmes.
            recipes: mockRecipes.filter((r) => r.category !== 'restaurant' && r.image && matchesTag(r, theme.tag)),
            // Alternance des formats : le feed ne doit jamais devenir monotone.
            variant: FIXED[theme.tag] ?? VARIANTS[i % VARIANTS.length],
        })).filter((row) => row.recipes.length >= (row.tag.startsWith('cocktail') ? 2 : 4));
    }, []);

    return (
        <div className={styles.page} onTouchStart={onPageTouchStart} onTouchMove={onPageTouchMove} onTouchEnd={onPageTouchEnd}>
            <Hero recipes={heroRecipes} onOpen={openSheet} onMenu={() => setNavOpen(true)} />

            <EdgeHandle
                hidden={navOpen}
                onOpen={() => setNavOpen(true)}
                onPeek={setNavPeek}
            />

            <NavDrawer
                open={navOpen}
                peek={navPeek}
                onClose={() => setNavOpen(false)}
                selected={filters}
                onToggle={toggleFilter}
                onClear={() => { setFilters([]); setNavQuery(''); }}
                onApply={() => {
                    // La sélection a servi : on ouvre les résultats (la liste est
                    // déjà figée dans `openAll`) PUIS on vide le menu. Sans ça, on
                    // rouvrait le volet plus tard sur des cases encore cochées,
                    // sans rapport avec ce qu'on voulait chercher ce jour-là.
                    setNavOpen(false);
                    openAll(filterTitle, filterResults);
                    setFilters([]);
                    setNavQuery('');
                }}
                onSearch={() => setSearchOpen(true)}
                onTutorial={() => setTutoOpen(true)}
                onTaste={() => setTasteOpen(true)}
                resultCount={filterResults.length}
                query={navQuery}
                onQuery={setNavQuery}
            />

            <div className={styles.sheet}>
                <div className={styles.grabber} />

                <TopTenRow title="Top 10 : les mieux notées" recipes={topTen} onSeeAll={openAll} onOpen={openSheet} onLongPress={openMenu} isLater={isLater} onToggleLater={handleToggleLater} />
                {resume.length > 0 && (
                    <Row
                        title="Reprendre la cuisine"
                        recipes={resume}
                        variant="wide"
                        withProgress
                        progressMap={progressMap}
                        subtitleMode="time"
                        onSeeAll={openAll}
                        onOpen={openSheet}
                        onLongPress={openMenu}
                        isLater={isLater}
                        onToggleLater={handleToggleLater}
                    />
                )}
                {laterRecipes.length > 0 && (
                    <Row
                        title="À faire plus tard"
                        recipes={laterRecipes}
                        variant="wide"
                        subtitleMode="time"
                        onSeeAll={openAll}
                        onOpen={openSheet}
                        onLongPress={openMenu}
                        isLater={isLater}
                        onToggleLater={handleToggleLater}
                    />
                )}
                {forYou.length >= 4 && (
                    <Row
                        title="Pour toi"
                        recipes={forYou}
                        variant="poster"
                        onSeeAll={openAll}
                        onOpen={openSheet}
                        onLongPress={openMenu}
                        isLater={isLater}
                        onToggleLater={handleToggleLater}
                    />
                )}
                <Row title="Nouveautés" recipes={newest} variant="medium" subtitleMode="time" onSeeAll={openAll} onOpen={openSheet} onLongPress={openMenu} isLater={isLater} onToggleLater={handleToggleLater} />
                <Row title="Apéritifs" recipes={byCat['aperitifs'] || []} variant="square" onSeeAll={openAll} onOpen={openSheet} onLongPress={openMenu} isLater={isLater} onToggleLater={handleToggleLater} />
                <Row title="Entrées" recipes={byCat['entrees'] || []} variant="poster" onSeeAll={openAll} onOpen={openSheet} onLongPress={openMenu} isLater={isLater} onToggleLater={handleToggleLater} />
                <Row title="Plats" recipes={byCat['plats'] || []} variant="wide" overlayTitle onSeeAll={openAll} onOpen={openSheet} onLongPress={openMenu} isLater={isLater} onToggleLater={handleToggleLater} />
                <Row title="Accompagnements" recipes={byCat['accompagnements'] || []} variant="square" onSeeAll={openAll} onOpen={openSheet} onLongPress={openMenu} isLater={isLater} onToggleLater={handleToggleLater} />
                <Row title="Desserts" recipes={byCat['desserts'] || []} variant="hugeCard" showcase onSeeAll={openAll} onOpen={openSheet} onLongPress={openMenu} isLater={isLater} onToggleLater={handleToggleLater} />
                <Row title="Pâtisseries" recipes={byCat['patisserie'] || []} variant="medium" subtitleMode="time" onSeeAll={openAll} onOpen={openSheet} onLongPress={openMenu} isLater={isLater} onToggleLater={handleToggleLater} />

                {/* Thématiques : même langage visuel que le reste, plus de tuiles à part. */}
                {themeRows.map((row) => (
                    <Row
                        key={row.title}
                        title={row.title}
                        recipes={row.recipes}
                        variant={row.variant}
                        shareTag={row.tag}
                        subtitleMode={row.variant === 'wide' || row.variant === 'medium' ? 'time' : undefined}
                        onSeeAll={openAll}
                        onOpen={openSheet}
                        onLongPress={openMenu}
                        isLater={isLater}
                        onToggleLater={handleToggleLater}
                    />
                ))}

                {/* Grandes pancartes : la rangée finale du feed. */}
                <Row
                    title="Comme au resto"
                    recipes={byCat['restaurant'] || []}
                    variant="hugeCard"
                    overlayTitle
                    onSeeAll={openAll}
                    onOpen={openSheet}
                    onLongPress={openMenu}
                />

                {/* Fin du feed : mentions légales, contact, statut des vidéos. */}
                <SiteFooter />
            </div>

            <AnimatePresence>
                {all && (
                    <motion.div
                        className={styles.allSheet}
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 40 }}
                        transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
                    >
                        <div className={styles.allHead}>
                            <button className={styles.allBack} onClick={() => setAll(null)}>‹</button>
                            <h2 className={styles.allTitle}>{all.title}</h2>
                            {/* Combien de recettes : la question vient toujours. */}
                            <span className={styles.allCount}>
                                {all.recipes.length} recette{all.recipes.length > 1 ? 's' : ''}
                            </span>
                        </div>
                        <div className={styles.allGrid}>
                            {all.recipes.map((r, i) => (
                                <CollectionCard
                                    key={r.id}
                                    recipe={r}
                                    subtitle={[catLabel(r), timeLabel(r)].filter(Boolean).join(' · ')}
                                    later={isLater(String(r.id))}
                                    onToggleLater={handleToggleLater}
                                    onOpen={() => openSheet(all.recipes, i)}
                                    onLongPress={() => openMenu(r, collOf(all.title, all.recipes.length))}
                                />
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Message central « Ajouté » / « Supprimé », façon Apple TV+ (1,5 s). */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        className={styles.toast}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.18 }}
                    >
                        <svg viewBox="0 0 24 24" width="46" height="46" fill="none"><path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        <span>{toast.text}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Appui long sur une carte → actions rapides (façon « appui fort » iOS). */}
            <AnimatePresence>
                {menu && (
                    <motion.div
                        className={styles.menuBackdrop}
                        onClick={() => setMenu(null)}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <motion.div
                            className={styles.menuCard}
                            onClick={(e) => e.stopPropagation()}
                            initial={{ scale: 0.88, opacity: 0, y: 10 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.92, opacity: 0 }}
                            transition={{ type: 'spring', damping: 26, stiffness: 360 }}
                        >
                            <img className={styles.menuPreview} src={menu.recipe.image} alt="" draggable={false} />
                            <div className={styles.menuTitle}>{label(menu.recipe)}</div>
                            <div className={styles.menuActions}>
                                {(() => {
                                    const r = menu.recipe;
                                    const cat = (r.category || '').toLowerCase();
                                    const catName = catLabel(r);
                                    // Sans contexte (rangée « Nouveautés », favoris…),
                                    // on retombe sur la catégorie de la recette.
                                    const coll: Coll = menu.coll || {
                                        label: catName,
                                        tag: cat,
                                        count: mockRecipes.filter((x) => (x.category || '').toLowerCase() === cat).length,
                                    };
                                    const origin = typeof window !== 'undefined' ? window.location.origin : '';
                                    const fav = favIds.includes(String(r.id));
                                    const lat = laterIds.includes(String(r.id));
                                    const MI = ({ d }: { d: string }) => (
                                        <svg className={styles.menuIcon} viewBox="0 0 24 24" fill="none" aria-hidden><path d={d} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                    );
                                    return (
                                        <>
                                            <button className={styles.menuAction} onClick={() => { haptic(8); setMenu(null); openSheet([r], 0); }}>
                                                <MI d="M8 5v14l11-7z" /><span>Voir la recette</span>
                                            </button>
                                            <button className={`${styles.menuAction} ${fav ? styles.menuDanger : ''}`} onClick={() => { haptic(12); setMenu(null); toggleFavorite(String(r.id)); }}>
                                                <MI d="M20.8 6.6a4.6 4.6 0 0 0-6.5 0L12 8.9 9.7 6.6a4.6 4.6 0 1 0-6.5 6.5l1 1L12 21l7.8-6.9 1-1a4.6 4.6 0 0 0 0-6.5z" /><span>{fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}</span>
                                            </button>
                                            <button className={styles.menuAction} onClick={() => { haptic(8); setMenu(null); openAll(catName, (byCat[cat] || []).length ? byCat[cat] : mockRecipes.filter((x) => (x.category || '').toLowerCase() === cat && x.image)); }}>
                                                <MI d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 8h.01M11 12h1v4h1" /><span>Accéder à {catName}</span>
                                            </button>
                                            <button className={styles.menuAction} onClick={() => { haptic(8); const rr = r; setMenu(null); setShareCard({ recipe: rr, category: coll }); }}>
                                                <MI d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13" /><span>Partager « {coll.label} »</span>
                                            </button>
                                            {/* Une seule entrée : la carte image porte déjà le lien,
                                                le titre et le QR code. */}
                                            <button className={styles.menuAction} onClick={() => { haptic(8); const rr = r; setMenu(null); setShareCard({ recipe: rr }); }}>
                                                <MI d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13" /><span>Partager la recette</span>
                                            </button>
                                            <button className={`${styles.menuAction} ${lat ? styles.menuDanger : ''}`} onClick={() => { haptic(12); setMenu(null); handleToggleLater(r); }}>
                                                {lat ? <MI d="M5 12h14" /> : <MI d="M12 5v14M5 12h14" />}<span>{lat ? 'Retirer de la liste' : 'À faire plus tard'}</span>
                                            </button>
                                            {resume.some((x) => String(x.id) === String(r.id)) && (
                                                <button className={`${styles.menuAction} ${styles.menuDanger}`} onClick={() => { haptic(8); setMenu(null); clearProgress(String(r.id)); }}>
                                                    <MI d="M5 12h14" /><span>Retirer de « Reprendre la cuisine »</span>
                                                </button>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Fiche recette : swipe horizontal d'une recette à l'autre dans la rangée. */}
            {sheet && (
                <RecipeSheet
                    recipe={sheet.recipes[sheet.index]}
                    isOpen={true}
                    allRecipes={sheet.recipes}
                    recipeIndex={sheet.index}
                    onClose={() => setSheet(null)}
                />
            )}

            <TVSpotlight
                open={searchOpen}
                onClose={() => setSearchOpen(false)}
                onRecipeSelect={(r) => openSheet([r], 0)}
            />

            <Tip id="accueil" />
            {tutoOpen && <TVTutorial onClose={() => setTutoOpen(false)} />}
            {tasteOpen && <TasteOnboarding onClose={() => setTasteOpen(false)} />}
            {shareCard && (
                <RecipeShareCard
                    recipe={shareCard.recipe}
                    category={shareCard.category}
                    onClose={() => setShareCard(null)}
                />
            )}
        </div>
    );
}
