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
import { mockRecipes } from '@/mobile/data/mockData';
import { decodeHtml } from '@/mobile/lib/utils';
import { useRatingStats } from '@/mobile/lib/ratings';
import { supabase } from '@/mobile/lib/supabase';
import { THEMES, matchesTag } from './themes';
import { timingOf, totalMinutes, formatMinutes } from './timing';
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
import { CATEGORY_OPTIONS, TREND_OPTIONS, COUNTRY_OPTIONS } from './NavDrawer';
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
/** Historique de consultation — alimente la rangée « Reprendre la cuisine ». */
const SEEN_KEY = 'recently-viewed';

/** Enregistre une recette ouverte en tête de l'historique (12 max). */
function pushSeen(id: string) {
    let list: { id: string }[] = [];
    try { list = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); } catch { /* vide */ }
    const rest = list.filter((r) => String((r as any)?.id ?? r) !== id);
    localStorage.setItem(SEEN_KEY, JSON.stringify([{ id }, ...rest].slice(0, 12)));
    window.dispatchEvent(new Event('tv-seen-change'));
}

/** Retire une recette de « Reprendre la cuisine ». */
function removeSeen(id: string) {
    let list: { id: string }[] = [];
    try { list = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); } catch { /* vide */ }
    localStorage.setItem(SEEN_KEY, JSON.stringify(list.filter((r) => String((r as any)?.id ?? r) !== id)));
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
        const onPop = () => { holds.current = false; closeRef.current(); };
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
                window.history.back();
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
    onOpen,
    onLongPress,
}: {
    recipe: Recipe;
    variant: CardVariant;
    overlayTitle?: boolean;
    progress?: number;
    subtitle?: string;
    onOpen: () => void;
    onLongPress: () => void;
}) {
    const lp = useLongPress(onLongPress);
    return (
        <div
            className={`${styles.card} ${styles[variant]}`}
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
                {(overlayTitle || progress !== undefined) && <div className={styles.thumbScrim} />}
                {overlayTitle && <div className={styles.overlayLabel}>{label(recipe)}</div>}
                {progress !== undefined && (
                    <div className={styles.progressTrack}>
                        <div className={styles.progressFill} style={{ width: `${progress}%` }} />
                    </div>
                )}
            </div>
            {!overlayTitle && <div className={styles.cardLabel}>{label(recipe)}</div>}
            {subtitle && <div className={styles.cardSub}>{subtitle}</div>}
        </div>
    );
}

// ── Top 10 : une recette par écran + lecture auto de la vidéo ──────────────

/** Id TikTok extrait de l'embed WordPress (`data-video-id="..."`). */
const tiktokId = (recipe: Recipe) => recipe.videoHtml?.match(/data-video-id="(\d+)"/)?.[1] || null;

/** Délai d'affichage avant que la vidéo ne démarre. */
const AUTOPLAY_DELAY = 2000;

function TopTenRow({
    recipes,
    title,
    onSeeAll,
    onOpen,
    onLongPress,
}: {
    recipes: Recipe[];
    title: string;
    onSeeAll: (title: string, recipes: Recipe[]) => void;
    onOpen: OpenSheet;
    onLongPress: (recipe: Recipe) => void;
}) {
    const [visibleId, setVisibleId] = useState<string | null>(null);
    const [playingId, setPlayingId] = useState<string | null>(null);
    // Grand écran : la lecture ne part plus toute seule, elle suit la souris.
    const [wide, setWide] = useState(false);
    const hoverTimer = useRef<ReturnType<typeof setTimeout>>();
    const [muted, setMuted] = useState(true);
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

    // Nouvelle vidéo = état neuf (muette, sans commandes, progression à zéro).
    useEffect(() => {
        setMuted(true);
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

    const toggleSound = () => {
        if (muted) {
            command('unMute');
            // Le volume du player est sur 0–100 : envoyer 1 revient à couper le son.
            command('setVolume', 100);
        } else {
            command('mute');
        }
        setMuted((m) => !m);
        revealControls();
    };

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
        <section className={styles.row}>
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
                                        src={`https://www.tiktok.com/player/v1/${vid}?autoplay=1&controls=0&progress_bar=0&play_button=0&volume_control=0&fullscreen_button=0&music_info=0&description=0&rel=0&native_context_menu=0&closed_caption=0`}
                                        allow="autoplay; encrypted-media"
                                        title={label(r)}
                                    />
                                )}

                                <div className={styles.top10Scrim} />

                                {playing && (
                                    <>
                                        {/* L'iframe ne remonte pas les taps : cette zone le fait. */}
                                        <div className={styles.top10Tap} onClick={revealControls} />

                                        <button
                                            className={styles.top10Sound}
                                            aria-label={muted ? 'Activer le son' : 'Couper le son'}
                                            onClick={(e) => { e.stopPropagation(); toggleSound(); }}
                                        >
                                            {muted ? '🔇' : '🔊'}
                                        </button>

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
    subtitleMode,
    onSeeAll,
    onOpen,
    onLongPress,
}: {
    title: string;
    recipes: Recipe[];
    variant?: CardVariant;
    overlayTitle?: boolean;
    withProgress?: boolean;
    subtitleMode?: 'time' | 'category';
    onSeeAll: (title: string, recipes: Recipe[]) => void;
    onOpen: OpenSheet;
    onLongPress: (recipe: Recipe) => void;
}) {
    const scroller = useRef<HTMLDivElement>(null);

    if (!recipes.length) return null;

    const sub = (r: Recipe) =>
        subtitleMode === 'time' ? [catLabel(r), timeLabel(r)].filter(Boolean).join(' · ')
        : subtitleMode === 'category' ? catLabel(r)
        : undefined;

    return (
        <section className={styles.row}>
            <button className={styles.rowHead} onClick={() => { haptic(8); onSeeAll(title, recipes); }}>
                <h2 className={styles.rowTitle}>{title}</h2>
                <Chevron />
            </button>
            <div className={styles.rowScroll} ref={scroller}>
                {recipes.slice(0, 14).map((r, i) => (
                    <Card
                        key={r.id}
                        recipe={r}
                        variant={variant}
                        overlayTitle={overlayTitle}
                        subtitle={sub(r)}
                        progress={withProgress ? 18 + ((i * 27) % 62) : undefined}
                        // La liste passée est CELLE DE LA RANGÉE entière (pas les 14
                        // affichées) : dans le sheet, on continue de swiper.
                        onOpen={() => onOpen(recipes, i)}
                        onLongPress={() => onLongPress(r)}
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
    const playingRef = useRef(false);
    playingRef.current = playing;
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

    // Index courant : lu sur le scroll natif (rAF, pas de re-render par frame).
    useEffect(() => {
        const el = pagerRef.current;
        if (!el) return;
        const onScroll = () => {
            const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
            setIndex((prev) => (prev === i ? prev : i)); // setState no-op si identique
        };
        el.addEventListener('scroll', onScroll, { passive: true });
        return () => el.removeEventListener('scroll', onScroll);
    }, []);

    // Rotation auto toutes les 3 s. Le doigt reprend toujours la main : on met en
    // pause dès qu'on touche le héros, et on relance 6 s après le dernier geste.
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
            const next = (Math.round(el.scrollLeft / Math.max(1, el.clientWidth)) + 1) % recipes.length;
            el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
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
        if (!currentVid) return;
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

    /** Chevrons du héros : une recette en avant ou en arrière, en boucle. */
    const step = (dir: 1 | -1) => {
        const el = pagerRef.current;
        if (!el) return;
        haptic(8);
        const n = (index + dir + recipes.length) % recipes.length;
        el.scrollTo({ left: n * el.clientWidth, behavior: 'smooth' });
    };

    if (!current) return null;

    // Palier typographique : les titres WP vont de « Tiramisu » à 60 caractères.
    const len = label(current).length;
    const titleClass = len > 34 ? styles.heroTitleS : len > 18 ? styles.heroTitleM : '';

    return (
        <div className={styles.heroSticky}>
            <motion.div className={styles.heroLayer} style={{ scale: heroScale, y: heroY }}>
                <div className={styles.heroPager} ref={pagerRef}>
                    {recipes.map((r, i) => (
                        <div className={styles.heroSlide} key={r.id}>
                            <img
                                src={r.image}
                                alt={label(r)}
                                className={styles.heroImg}
                                loading={i === 0 ? 'eager' : 'lazy'}
                                decoding="async"
                            />
                            <div className={styles.heroScrim} />
                        </div>
                    ))}
                </div>
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

            {/* Compte : ouvre aussi le panneau de connexion demandé par le cœur. */}
            <motion.div className={styles.heroAuth} style={{ opacity: brandOpacity }}>
                <AuthButton />
            </motion.div>

            {/* Le texte est hors du pager : il se substitue en fondu, il ne glisse pas. */}
            <motion.div className={styles.heroContent} style={{ y: contentY, opacity: contentOpacity }}>
                <AnimatePresence mode="wait">
                    <motion.div
                        key={current.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12, width: '100%' }}
                    >
                        <span className={styles.heroKicker}>Nº {index + 1} des dernières recettes</span>

                        {/* Photo à gauche, informations à droite : la photo n'est plus
                            étirée plein écran, une source légère suffit désormais. */}
                        <div className={styles.heroSplit}>
                            <div className={styles.heroShot}>
                                <img
                                    src={current.image}
                                    alt={label(current)}
                                    className={styles.heroShotImg}
                                    decoding="async"
                                    draggable={false}
                                />
                                {playing && currentVid && (
                                    <iframe
                                        className={styles.heroShotVideo}
                                        // Interface TikTok coupée : le cadre reste une image
                                        // qui s'anime, pas un lecteur incrusté.
                                        src={`https://www.tiktok.com/player/v1/${currentVid}?autoplay=1&controls=0&progress_bar=0&play_button=0&volume_control=0&fullscreen_button=0&music_info=0&description=0&rel=0&native_context_menu=0&closed_caption=0`}
                                        allow="autoplay; encrypted-media"
                                        title={label(current)}
                                    />
                                )}
                            </div>

                            <div className={styles.heroInfo}>
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
                            </div>
                        </div>

                    </motion.div>
                </AnimatePresence>
            </motion.div>

            <motion.div className={styles.dots} style={{ opacity: contentOpacity }}>
                {recipes.map((_, i) => (
                    <span key={i} className={`${styles.dot} ${i === index ? styles.dotActive : ''}`} />
                ))}
            </motion.div>
        </div>
    );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function TVHome() {
    const stats = useRatingStats();
    const [all, setAll] = useState<{ title: string; recipes: Recipe[] } | null>(null);
    const [sheet, setSheet] = useState<{ recipes: Recipe[]; index: number } | null>(null);
    const [menu, setMenu] = useState<Recipe | null>(null);
    const [navOpen, setNavOpen] = useState(false);
    useFittedCards();
    const [filters, setFilters] = useState<string[]>([]);
    const [navQuery, setNavQuery] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);
    const [tutoOpen, setTutoOpen] = useState(false);
    const [laterIds, setLaterIds] = useState<string[]>([]);
    const [favIds, setFavIds] = useState<string[]>([]);
    const [recentlyViewed, setRecentlyViewed] = useState<Recipe[]>([]);

    useEffect(() => {
        const load = () => {
            try {
                const ids: string[] = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')
                    .map((r: any) => r.id || r);
                setRecentlyViewed(
                    ids.map((id) => mockRecipes.find((r) => String(r.id) === String(id))).filter(Boolean) as Recipe[]
                );
            } catch { /* stockage indisponible */ }
        };
        load();
        window.addEventListener('tv-seen-change', load);
        return () => window.removeEventListener('tv-seen-change', load);
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

    // Sur /tv, la loupe de la barre du bas (BottomNav prod, data-tour="search")
    // ouvre NOTRE recherche modernisée au lieu de SpotlightSearch.
    // On intercepte en phase capture, et pas seulement le clic : sur iPhone, un
    // appui déclenche pointerdown → touchend → click, et framer-motion peut agir
    // dès le pointeur. Ne bloquer que le clic laissait donc passer, par moments,
    // la recherche du site. On coupe la chaîne au premier maillon.
    useEffect(() => {
        let handled = 0;
        const intercept = (e: Event) => {
            const t = e.target as HTMLElement | null;
            if (!t?.closest?.('[data-tour="search"]')) return;
            e.preventDefault();
            e.stopImmediatePropagation();
            // Un seul geste = une seule ouverture (pointerdown + touchend + click).
            const now = Date.now();
            if (now - handled < 600) return;
            handled = now;
            setSearchOpen(true);
        };
        const events: (keyof DocumentEventMap)[] = ['pointerdown', 'touchstart', 'touchend', 'click'];
        events.forEach((ev) => document.addEventListener(ev, intercept, true));
        return () => events.forEach((ev) => document.removeEventListener(ev, intercept, true));
    }, []);

    // Un calque plein écran est ouvert (recherche, fiche recette, grille « tout
    // afficher », menu d'appui long) → on masque la barre du bas (BottomNav prod).
    // Sinon son dock (Accueil/loupe) reste tappable par-dessus ou à travers le
    // calque selon le contexte d'empilement, et ses boutons se comportent mal.
    const overlayOpen = searchOpen || tutoOpen || !!sheet || !!all || !!menu;
    useEffect(() => {
        const bar = document.getElementById('bottom-nav');
        if (!bar) return;
        bar.style.display = overlayOpen ? 'none' : '';
        return () => { bar.style.display = ''; };
    }, [overlayOpen]);

    const openMenu = useCallback((recipe: Recipe) => setMenu(recipe), []);

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
        setSheet({ recipes: list.slice(start, start + SHEET_WINDOW), index: index - start });
    }, []);

    const byCat = useMemo(() => {
        const g: Record<string, Recipe[]> = {};
        mockRecipes.forEach((r) => {
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

    // Le héros : les 6 dernières recettes (mockData est trié par date de modif WP).
    const heroRecipes = useMemo(
        () => mockRecipes.filter((r) => r.category !== 'restaurant' && r.image).slice(0, 6),
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

    const resume = recentlyViewed.length ? recentlyViewed : newest.slice(0, 8);

    const laterRecipes = useMemo(
        () => laterIds.map((id) => mockRecipes.find((r) => String(r.id) === id)).filter(Boolean) as Recipe[],
        [laterIds]
    );

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
            // Les restaurants ont leur propre rangée en bas : on les sort des thèmes.
            recipes: mockRecipes.filter((r) => r.category !== 'restaurant' && r.image && matchesTag(r, theme.tag)),
            // Alternance des formats : le feed ne doit jamais devenir monotone.
            variant: FIXED[theme.tag] ?? VARIANTS[i % VARIANTS.length],
        })).filter((row) => row.recipes.length >= 4);
    }, []);

    return (
        <div className={styles.page}>
            <Hero recipes={heroRecipes} onOpen={openSheet} onMenu={() => setNavOpen(true)} />

            <NavDrawer
                open={navOpen}
                onClose={() => setNavOpen(false)}
                selected={filters}
                onToggle={toggleFilter}
                onClear={() => { setFilters([]); setNavQuery(''); }}
                onApply={() => { setNavOpen(false); openAll(filterTitle, filterResults); }}
                onSearch={() => setSearchOpen(true)}
                onTutorial={() => setTutoOpen(true)}
                resultCount={filterResults.length}
                query={navQuery}
                onQuery={setNavQuery}
            />

            <div className={styles.sheet}>
                <div className={styles.grabber} />

                <TopTenRow title="Top 10 : les mieux notées" recipes={topTen} onSeeAll={openAll} onOpen={openSheet} onLongPress={openMenu} />
                <Row
                    title="Reprendre la cuisine"
                    recipes={resume}
                    variant="wide"
                    withProgress
                    subtitleMode="time"
                    onSeeAll={openAll}
                    onOpen={openSheet}
                    onLongPress={openMenu}
                />
                {laterRecipes.length > 0 && (
                    <Row
                        title="À faire plus tard"
                        recipes={laterRecipes}
                        variant="wide"
                        subtitleMode="time"
                        onSeeAll={openAll}
                        onOpen={openSheet}
                        onLongPress={openMenu}
                    />
                )}
                <Row title="Nouveautés" recipes={newest} variant="medium" subtitleMode="time" onSeeAll={openAll} onOpen={openSheet} onLongPress={openMenu} />
                <Row title="Apéritifs" recipes={byCat['aperitifs'] || []} variant="square" onSeeAll={openAll} onOpen={openSheet} onLongPress={openMenu} />
                <Row title="Entrées" recipes={byCat['entrees'] || []} variant="poster" onSeeAll={openAll} onOpen={openSheet} onLongPress={openMenu} />
                <Row title="Plats" recipes={byCat['plats'] || []} variant="wide" overlayTitle onSeeAll={openAll} onOpen={openSheet} onLongPress={openMenu} />
                <Row title="Accompagnements" recipes={byCat['accompagnements'] || []} variant="square" onSeeAll={openAll} onOpen={openSheet} onLongPress={openMenu} />
                <Row title="Desserts" recipes={byCat['desserts'] || []} variant="poster" onSeeAll={openAll} onOpen={openSheet} onLongPress={openMenu} />
                <Row title="Pâtisseries" recipes={byCat['patisserie'] || []} variant="medium" subtitleMode="time" onSeeAll={openAll} onOpen={openSheet} onLongPress={openMenu} />

                {/* Thématiques : même langage visuel que le reste, plus de tuiles à part. */}
                {themeRows.map((row) => (
                    <Row
                        key={row.title}
                        title={row.title}
                        recipes={row.recipes}
                        variant={row.variant}
                        subtitleMode={row.variant === 'wide' || row.variant === 'medium' ? 'time' : undefined}
                        onSeeAll={openAll}
                        onOpen={openSheet}
                        onLongPress={openMenu}
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
                        </div>
                        <div className={styles.allGrid}>
                            {all.recipes.map((r, i) => (
                                <Card
                                    key={r.id}
                                    recipe={r}
                                    variant="wide"
                                    subtitle={[catLabel(r), timeLabel(r)].filter(Boolean).join(' · ')}
                                    onOpen={() => openSheet(all.recipes, i)}
                                    onLongPress={() => openMenu(r)}
                                />
                            ))}
                        </div>
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
                            <img className={styles.menuPreview} src={menu.image} alt="" draggable={false} />
                            <div className={styles.menuTitle}>{label(menu)}</div>
                            <div className={styles.menuActions}>
                                <button
                                    className={`${styles.menuAction} ${favIds.includes(String(menu.id)) ? styles.menuDanger : ''}`}
                                    onClick={() => { haptic(12); const r = menu; setMenu(null); toggleFavorite(String(r.id)); }}
                                >
                                    {favIds.includes(String(menu.id)) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                                </button>
                                <button
                                    className={`${styles.menuAction} ${laterIds.includes(String(menu.id)) ? styles.menuDanger : ''}`}
                                    onClick={() => { haptic(12); const r = menu; setMenu(null); toggleLater(String(r.id)); }}
                                >
                                    {laterIds.includes(String(menu.id)) ? 'Retirer de la liste' : 'À faire plus tard'}
                                </button>
                                <button
                                    className={styles.menuAction}
                                    onClick={() => { haptic(8); const r = menu; setMenu(null); openSheet([r], 0); }}
                                >
                                    Voir la recette
                                </button>
                                {/* 4ᵉ action, seulement pour les recettes déjà consultées. */}
                                {recentlyViewed.some((r) => String(r.id) === String(menu.id)) && (
                                    <button
                                        className={`${styles.menuAction} ${styles.menuDanger}`}
                                        onClick={() => { haptic(8); const r = menu; setMenu(null); removeSeen(String(r.id)); }}
                                    >
                                        Retirer de « Reprendre la cuisine »
                                    </button>
                                )}
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

            {tutoOpen && <TVTutorial onClose={() => setTutoOpen(false)} />}
        </div>
    );
}
