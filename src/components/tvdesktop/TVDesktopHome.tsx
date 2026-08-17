'use client';

/**
 * Accueil DESKTOP « façon Apple TV+ » (app Mac) — TEST DE DESIGN (route /tv-desktop).
 * Logique de la maquette Mac : barre latérale fixe à gauche, contenu à droite.
 *  - Sidebar : recherche, navigation, bibliothèque, catégories, compte en bas.
 *  - Contenu : héros carrousel large + rangées de cartes (flèches au survol).
 * Cohérent avec la version mobile /tv : même identité, gestes traduits en desktop
 * (survol au lieu de l'appui long, clic droit pour le menu contextuel).
 * Ouvre les fiches via l'event global `openRecipeFromPlanner` (GlobalRecipeSheet
 * du desktop de prod) — aucune modification de la prod.
 */

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { Recipe } from '@/mobile/types';
import { mockRecipes } from '@/mobile/data/mockData';
import { decodeHtml } from '@/mobile/lib/utils';
import { useRatingStats } from '@/mobile/lib/ratings';
import { useAuth } from '@/hooks/useAuth';
import { THEMES, matchesTag, isSavoryMiscat } from '@/mobile/screens/tv/themes';
import { personalizedRecipes } from '@/lib/personalize';
import { inProgressRecipes, clearProgress, PROGRESS_EVENT } from '@/mobile/screens/tv/progress';
import styles from './tvd.module.css';

const TVAuthGate = dynamic(() => import('./TVAuthGate'), { ssr: false });
const TVSpotlight = dynamic(() => import('@/mobile/screens/tv/TVSpotlight'), { ssr: false });
const AuthButton = dynamic(() => import('@/components/AuthButton/AuthButton'), { ssr: false });
// Visite guidée du site (version desktop) : composant autonome, habillé en ligne de menu.
const TVTutorial = dynamic(() => import('@/mobile/screens/tv/TVTutorial'), { ssr: false });
// Partage d'un thème : même bouton que sur l'accueil actuel, même lien /?tag=…
const ShareButton = dynamic(() => import('@/components/ShareButton/ShareButton'), { ssr: false });
// Planificateur / Liste de courses : rendus DANS le contenu (la sidebar reste à gauche),
// au lieu de naviguer vers une page pleine (mode `embedded`).
const TVPlanner = dynamic(() => import('@/mobile/screens/tv/TVPlanner'), { ssr: false });
const TVCourses = dynamic(() => import('@/mobile/screens/tv/TVCourses'), { ssr: false });

// ── Helpers ────────────────────────────────────────────────────────────────

const CATEGORY_LABEL: Record<string, string> = {
    aperitifs: 'Apéritif', entrees: 'Entrée', plats: 'Plat', accompagnements: 'Accompagnement',
    desserts: 'Dessert', patisserie: 'Pâtisserie', restaurant: 'Comme au resto',
    glaces: 'Glace', boissons: 'Boisson', sauces: 'Sauce',
};
const label = (r: Recipe) => decodeHtml(r.title || '');
const catLabel = (r: Recipe) => CATEGORY_LABEL[(r.category || '').toLowerCase()] || 'Recette';
const timeLabel = (r: Recipe) => {
    const t = (r.prepTime || 0) + (r.cookTime || 0);
    if (!t) return '';
    return t >= 60 ? `${Math.floor(t / 60)} h${t % 60 ? ` ${t % 60}` : ''}` : `${t} min`;
};
const diffLabel = (r: Recipe) => r.difficulty === 'facile' ? 'Facile' : r.difficulty === 'moyen' ? 'Moyen' : 'Difficile';

const LATER_KEY = 'tv-later-v1';
const readIds = (key: string): string[] => { try { return JSON.parse(localStorage.getItem(key) || '[]').map(String); } catch { return []; } };

// « Bibliothèque » personnalisée : raccourcis épinglés par glisser-déposer.
// Chaque entrée est un token au format du volet mobile (`c:`/`t:`/`p:`) + libellé,
// pour que la liste soit RELUE telle quelle sur mobile (même clé de stockage).
const LIBRARY_KEY = 'tv-library-v1';
const LIBRARY_EVENT = 'tv-library-change';
interface LibraryItem { token: string; label: string }
function readLibrary(): LibraryItem[] {
    try {
        const raw = JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]');
        return Array.isArray(raw) ? raw.filter((x) => x && typeof x.token === 'string') : [];
    } catch { return []; }
}
function writeLibrary(items: LibraryItem[]) {
    try { localStorage.setItem(LIBRARY_KEY, JSON.stringify(items)); } catch { /* noop */ }
    window.dispatchEvent(new Event(LIBRARY_EVENT));
}

// Identifiant de la vidéo TikTok d'une recette (même règle que le mobile).
const tiktokId = (recipe: Recipe) => recipe.videoHtml?.match(/data-video-id="(\d+)"/)?.[1] || null;
// Deux secondes de photo fixe avant que la vidéo prenne le relais.
const AUTOPLAY_DELAY = 2000;

/** Ouvre la fiche recette flottante du desktop (RecipeSheet via GlobalRecipeSheet). */
const openRecipe = (r: Recipe) => window.dispatchEvent(new CustomEvent('openRecipeFromPlanner', { detail: r }));

// ── Icônes (trait fin, esprit SF Symbols) ──────────────────────────────────

const Ic = ({ d }: { d: string }) => (
    <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d={d} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);
const ICONS = {
    search: 'M21 21l-4.3-4.3M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0z',
    home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
    planner: 'M7 3v3m10-3v3M3.5 9h17M5 5h14a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 19 21H5a1.5 1.5 0 0 1-1.5-1.5v-13A1.5 1.5 0 0 1 5 5z',
    cart: 'M3 4h2l2.2 10.5a1.5 1.5 0 0 0 1.5 1.2h7.9a1.5 1.5 0 0 0 1.5-1.2L20 7H6M9 20h.01M17 20h.01',
    heart: 'M20.8 6.6a4.6 4.6 0 0 0-6.5 0L12 8.9 9.7 6.6a4.6 4.6 0 1 0-6.5 6.5l1 1L12 21l7.8-6.9 1-1a4.6 4.6 0 0 0 0-6.5z',
    clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
    star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z',
    resto: 'M4 3v7a3 3 0 0 0 6 0V3M7 10v11M17 3c-1.7 0-3 2-3 5s1.3 4 3 4m0 0v9m0-9c1.7 0 3-1 3-4s-1.3-5-3-5z',
    book: 'M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H5.5A1.5 1.5 0 0 1 4 15.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H14a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h4.5a1.5 1.5 0 0 0 1.5-1.5z',
};

/** Coche d'un filtre actif (façon liste à choix multiple). */
const Check = () => (
    <svg className={styles.navCheck} viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden>
        <path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// ── Carte ──────────────────────────────────────────────────────────────────

// Formats de carte, comme sur mobile : le feed ne doit jamais être monotone.
// `posterXL` = grande verticale mise en avant ; `wideXL` = large et plus haute.
type CardShape = 'wide' | 'poster' | 'square' | 'posterXL' | 'wideXL';

// Motif de la mosaïque « catégorie » : chaque nom pointe une classe CSS qui
// donne à la cellule sa taille (colonnes × rangées). Le motif se répète, si bien
// que la grille alterne grandes verticales, larges, standards et petites — jamais
// une grille uniforme. 12 cases avant de boucler : l'œil ne repère pas la répétition.
const MOSAIC = [
    'mTall', 'mStd', 'mWide', 'mStd',
    'mStd', 'mWide', 'mSmall', 'mTall',
    'mWide', 'mStd', 'mStd', 'mSmall',
] as const;

function Card({ recipe, shape, onMenu, later, onToggleLater, rank }: {
    recipe: Recipe; shape: CardShape;
    onMenu: (r: Recipe, x: number, y: number) => void;
    /** Recette déjà dans « À faire plus tard » (croix → coche). */
    later?: boolean;
    onToggleLater?: (r: Recipe) => void;
    /** Rang 1..10 affiché en grand sur le visuel (rangée Top 10). */
    rank?: number;
}) {
    const vid = tiktokId(recipe);
    // Survol prolongé (1,5 s) → la vidéo se lance dans le visuel. Elle porte SES
    // contrôles (son + barre de progression) : la souris avance et recule dedans.
    const [playing, setPlaying] = useState(false);
    const [ready, setReady] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const enter = () => {
        if (!vid) return;
        timer.current = setTimeout(() => setPlaying(true), 1500);
    };
    const leave = () => {
        if (timer.current) clearTimeout(timer.current);
        setPlaying(false);
        setReady(false);
    };
    useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

    // Le lecteur ne se montre qu'une fois qu'il joue vraiment (postMessage) — sinon
    // il afficherait son bandeau de cookies à la place de la recette.
    useEffect(() => {
        if (!playing) return;
        const onMessage = (e: MessageEvent) => {
            const d = e.data;
            if (d && typeof d === 'object' && d['x-tiktok-player']) setReady(true);
        };
        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
    }, [playing]);

    return (
        <div
            className={`${styles.card} ${styles[shape]} ${rank ? styles.cardRanked : ''}`}
            onContextMenu={(e) => { e.preventDefault(); onMenu(recipe, e.clientX, e.clientY); }}
            onMouseEnter={enter}
            onMouseLeave={leave}
        >
            {rank && <span className={styles.cardRank}>{rank}</span>}
            <div className={styles.thumb}>
                <img src={recipe.image} alt={label(recipe)} className={styles.thumbImg} loading="lazy" decoding="async" draggable={false} />
                {playing && vid && (
                    <iframe
                        className={`${styles.thumbVideo} ${ready ? styles.thumbVideoOn : ''}`}
                        // Contrôles TikTok gardés : son, barre de progression, avance/recul.
                        src={`https://www.tiktok.com/player/v1/${vid}?autoplay=1&controls=1&progress_bar=1&play_button=1&volume_control=1&music_info=0&description=0&rel=0&native_context_menu=0&closed_caption=0`}
                        allow="autoplay; encrypted-media"
                        title={label(recipe)}
                    />
                )}
            </div>
            {/* Titre + bouton « À faire plus tard » (croix → coche). Le titre ouvre
                la fiche ; cliquer la vidéo ne fait que la piloter. */}
            <div className={styles.cardLabelRow}>
                <div
                    className={styles.cardLabel}
                    role="button"
                    tabIndex={0}
                    onClick={() => openRecipe(recipe)}
                    onKeyDown={(e) => { if (e.key === 'Enter') openRecipe(recipe); }}
                >{label(recipe)}</div>
                {onToggleLater && (
                    <button
                        className={`${styles.laterBtn} ${later ? styles.laterBtnOn : ''}`}
                        onClick={(e) => { e.stopPropagation(); onToggleLater(recipe); }}
                        aria-label={later ? 'Retirer de « À faire plus tard »' : 'Ajouter à « À faire plus tard »'}
                        title={later ? 'À faire plus tard : ajouté' : 'À faire plus tard'}
                    >
                        {later ? (
                            <svg viewBox="0 0 24 24" width="15" height="15" fill="none"><path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        ) : (
                            <svg viewBox="0 0 24 24" width="15" height="15" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
                        )}
                    </button>
                )}
            </div>
            <div className={styles.cardSub}>{[catLabel(recipe), timeLabel(recipe)].filter(Boolean).join(' · ')}</div>
        </div>
    );
}

// ── Rangée horizontale (flèches au survol) ─────────────────────────────────

function Row({ title, recipes, shape, shareTag, onSeeAll, onMenu, isLater, onToggleLater, ranked }: {
    title: string; recipes: Recipe[]; shape: CardShape;
    /** Thème partageable : ajoute le bouton « Partager » (lien /?tag=…). */
    shareTag?: string;
    onSeeAll: (title: string, recipes: Recipe[]) => void;
    onMenu: (r: Recipe, x: number, y: number) => void;
    isLater?: (id: string) => boolean;
    onToggleLater?: (r: Recipe) => void;
    /** Rangée Top 10 : numérote les cartes de 1 à 10. */
    ranked?: boolean;
}) {
    const scroller = useRef<HTMLDivElement>(null);
    if (!recipes.length) return null;
    const nudge = (dir: number) => {
        const el = scroller.current;
        if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
    };
    return (
        <section className={styles.row}>
            <div className={styles.rowHeadWrap}>
                <button className={styles.rowHead} onClick={() => onSeeAll(title, recipes)}>
                    <h2 className={styles.rowTitle}>{title}</h2>
                    <svg className={styles.rowChevron} viewBox="0 0 8 14" fill="none"><path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                {shareTag && (
                    <span className={styles.rowShare}>
                        <ShareButton
                            url={typeof window !== 'undefined' ? `${window.location.origin}/?tag=${encodeURIComponent(shareTag)}` : undefined}
                            title={`Thème : ${title}`}
                        />
                    </span>
                )}
            </div>
            <div className={styles.rowWrap}>
                <button className={`${styles.rowArrow} ${styles.rowArrowL}`} onClick={() => nudge(-1)} aria-label="Précédent">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                <div className={`${styles.rowScroll} ${ranked ? styles.rowScrollRanked : ''}`} ref={scroller}>
                    {recipes.map((r, i) => (
                        <Card
                            key={r.id}
                            recipe={r}
                            shape={shape}
                            onMenu={onMenu}
                            later={isLater?.(String(r.id))}
                            onToggleLater={onToggleLater}
                            rank={ranked ? i + 1 : undefined}
                        />
                    ))}
                </div>
                <button className={`${styles.rowArrow} ${styles.rowArrowR}`} onClick={() => nudge(1)} aria-label="Suivant">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none"><path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
            </div>
        </section>
    );
}

// ── Héros carrousel ─────────────────────────────────────────────────────────

function Hero({ recipes, total, onMenu }: { recipes: Recipe[]; total: number; onMenu: (r: Recipe, x: number, y: number) => void }) {
    const [index, setIndex] = useState(0);
    const [paused, setPaused] = useState(false);
    // La vidéo ne part pas d'emblée : deux secondes de photo, puis elle prend la
    // place du visuel dans le même cadre — et seulement si elle joue vraiment
    // (sinon le lecteur TikTok afficherait son bandeau de cookies à la place).
    const [playing, setPlaying] = useState(false);
    const [videoOn, setVideoOn] = useState(false);

    const current = recipes[Math.min(index, recipes.length - 1)];
    const currentVid = current ? tiktokId(current) : null;

    // Rotation auto : suspendue au survol du héros, et pendant une lecture vidéo.
    useEffect(() => {
        if (recipes.length < 2 || paused || (playing && videoOn)) return;
        const id = setInterval(() => setIndex((i) => (i + 1) % recipes.length), 5000);
        return () => clearInterval(id);
    }, [recipes.length, paused, playing, videoOn]);

    // 2 s d'image fixe, puis on tente la vidéo. Changer de recette repart de zéro.
    useEffect(() => {
        setPlaying(false);
        setVideoOn(false);
        if (!currentVid) return;
        const t = setTimeout(() => { if (!document.hidden) setPlaying(true); }, AUTOPLAY_DELAY);
        return () => clearTimeout(t);
    }, [currentVid]);

    // Le lecteur TikTok parle (postMessage) = il joue pour de bon : on révèle la
    // vidéo à ce moment-là. Silence après 6 s = cookies/refus, la photo reprend.
    useEffect(() => {
        if (!playing) return;
        const onMessage = (e: MessageEvent) => {
            const d = e.data;
            if (d && typeof d === 'object' && d['x-tiktok-player']) setVideoOn(true);
        };
        window.addEventListener('message', onMessage);
        const giveUp = setTimeout(() => setPlaying((p) => (videoOn ? p : false)), 6000);
        return () => { window.removeEventListener('message', onMessage); clearTimeout(giveUp); };
    }, [playing, videoOn]);

    if (!current) return null;
    const go = (d: number) => setIndex((i) => (i + d + recipes.length) % recipes.length);

    return (
        <div className={styles.hero} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
            {/* Fond cinéma : la photo courante, très floutée et assombrie, remplit
               tout le cadre — fini le pavé noir, on baigne dans la recette. */}
            <div className={styles.heroBackdrop} aria-hidden>
                <AnimatePresence>
                    <motion.img
                        key={current.id}
                        className={styles.heroBackdropImg}
                        src={current.image}
                        alt=""
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1.1, ease: [0.32, 0.72, 0, 1] }}
                        draggable={false}
                    />
                </AnimatePresence>
                <div className={styles.heroBackdropVeil} />
            </div>

            {/* Bandeau haut : la signature et le compteur de recettes. */}
            <div className={styles.heroTopBar}>
                <div className={styles.heroBrandKicker}>Les recettes</div>
                <div className={styles.heroBrandRow}>
                    <span className={styles.heroBrandWord}>Magiques</span>
                    <span className={styles.heroBrandCount}>{total} recettes</span>
                </div>
            </div>

            {/* Carte verticale : la photo, puis la vidéo au bout de 2 s. */}
            <div className={styles.heroLeft} onClick={() => openRecipe(current)}>
                <AnimatePresence>
                    <motion.img
                        key={current.id}
                        className={styles.heroImg}
                        src={current.image}
                        alt=""
                        initial={{ opacity: 0, scale: 1.05 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.9, ease: [0.32, 0.72, 0, 1] }}
                        draggable={false}
                    />
                </AnimatePresence>
                {playing && currentVid && (
                    <iframe
                        className={`${styles.heroShotVideo} ${videoOn ? styles.heroShotVideoOn : ''}`}
                        src={`https://www.tiktok.com/player/v1/${currentVid}?autoplay=1&controls=0&progress_bar=0&play_button=0&volume_control=0&fullscreen_button=0&music_info=0&description=0&rel=0&native_context_menu=0&closed_caption=0`}
                        allow="autoplay; encrypted-media"
                        title={label(current)}
                    />
                )}
                <button className={`${styles.heroNav} ${styles.heroNavL}`} onClick={(e) => { e.stopPropagation(); go(-1); }} aria-label="Précédent">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                <button className={`${styles.heroNav} ${styles.heroNavR}`} onClick={(e) => { e.stopPropagation(); go(1); }} aria-label="Suivant">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none"><path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
            </div>

            {/* Détails à droite (titre, méta, actions). */}
            <div className={styles.heroRight}>
                <motion.div
                    key={current.id}
                    className={styles.heroBody}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
                >
                    <div className={styles.heroKicker}>Nº {index + 1} des dernières recettes</div>
                    <h1 className={styles.heroTitle}>{label(current)}</h1>
                    <div className={styles.heroMeta}>
                        <span>{catLabel(current)}</span>
                        {timeLabel(current) && (<><i className={styles.dot} />{timeLabel(current)}</>)}
                        <i className={styles.dot} />{diffLabel(current)}
                        <span className={styles.heroBadge}>{current.servings || 4} pers.</span>
                    </div>
                    <div className={styles.heroActions}>
                        <button className={styles.heroPlay} onClick={() => openRecipe(current)}>
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                            Voir la recette
                        </button>
                        <button className={styles.heroPlus} onClick={(e) => onMenu(current, e.clientX, e.clientY)} aria-label="Plus">
                            <svg viewBox="0 0 24 24" width="22" height="22" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                        </button>
                    </div>
                    <div className={styles.heroDots}>
                        {recipes.map((_, i) => (
                            <button key={i} className={`${styles.heroDot} ${i === index ? styles.heroDotOn : ''}`} onClick={() => setIndex(i)} aria-label={`Recette ${i + 1}`} />
                        ))}
                    </div>
                </motion.div>
            </div>
        </div>
    );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function TVDesktopHome() {
    const router = useRouter();
    const stats = useRatingStats();
    const { user } = useAuth();
    const [searchOpen, setSearchOpen] = useState(false);
    const [collection, setCollection] = useState<{ title: string; recipes: Recipe[] } | null>(null);
    const [inProgress, setInProgress] = useState<{ recipe: Recipe; pct: number }[]>([]);
    const [laterIds, setLaterIds] = useState<string[]>([]);
    const [menu, setMenu] = useState<{ recipe: Recipe; x: number; y: number } | null>(null);
    const [nav, setNav] = useState<'accueil' | string>('accueil');
    // Barre latérale repliable : on agrandit la page d'un clic.
    const [sidebarOpen, setSidebarOpen] = useState(true);
    // Groupes de filtres repliables (comme mobile) : Catégories déployé par défaut,
    // Tendances / Pays repliés → on ne montre que les filtres cochés tant que fermé.
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ 'Catégories': true });
    // Visite guidée « Apple TV+ » (même composant que le mobile), en modale.
    const [tuto, setTuto] = useState(false);
    // Raccourcis épinglés dans « Bibliothèque » (glisser-déposer), + survol du drop.
    const [library, setLibrary] = useState<LibraryItem[]>([]);
    const [dragOver, setDragOver] = useState(false);
    // Multi-filtre : sélection cumulative de catégories / tendances / pays (tokens
    // c:/t:/p:). ET entre groupes, OU dans un groupe — même logique que le mobile.
    const [filters, setFilters] = useState<string[]>([]);
    // Panneau ouvert dans le contenu (sidebar conservée) : planificateur ou courses.
    const [panel, setPanel] = useState<'none' | 'planner' | 'courses'>('none');

    // « Pour toi » : recommandations déduites en silence des favoris / vues / cuisinées.
    const [forYou, setForYou] = useState<Recipe[]>([]);
    useEffect(() => {
        const load = () => setForYou(personalizedRecipes(mockRecipes) as Recipe[]);
        load();
        const evts = ['tv-seen-change', 'magic-favorite-change', PROGRESS_EVENT, 'focus', 'storage'];
        evts.forEach((e) => window.addEventListener(e, load));
        return () => evts.forEach((e) => window.removeEventListener(e, load));
    }, []);

    useEffect(() => {
        const sync = () => setLaterIds(readIds(LATER_KEY));
        // « Reprendre la cuisine » = recettes en cours (étapes entamées, pas finies).
        const loadProgress = () => setInProgress(inProgressRecipes(mockRecipes));
        const loadLibrary = () => setLibrary(readLibrary());
        sync();
        loadProgress();
        loadLibrary();
        window.addEventListener('tv-later-change', sync);
        window.addEventListener('storage', sync);
        window.addEventListener('storage', loadLibrary);
        window.addEventListener(LIBRARY_EVENT, loadLibrary);
        window.addEventListener(PROGRESS_EVENT, loadProgress);
        window.addEventListener('focus', loadProgress);
        return () => {
            window.removeEventListener('tv-later-change', sync);
            window.removeEventListener('storage', sync);
            window.removeEventListener('storage', loadLibrary);
            window.removeEventListener(LIBRARY_EVENT, loadLibrary);
            window.removeEventListener(PROGRESS_EVENT, loadProgress);
            window.removeEventListener('focus', loadProgress);
        };
    }, []);

    // Le badge panier d'une fiche recette ouvre la liste de courses DANS le shell.
    useEffect(() => {
        const open = () => { setCollection(null); setFilters([]); setPanel('courses'); };
        window.addEventListener('magic-open-courses', open);
        return () => window.removeEventListener('magic-open-courses', open);
    }, []);

    // Ferme le menu contextuel sur clic ailleurs / Échap.
    useEffect(() => {
        if (!menu) return;
        const close = () => setMenu(null);
        const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null); };
        window.addEventListener('click', close);
        window.addEventListener('scroll', close, true);
        window.addEventListener('keydown', esc);
        return () => { window.removeEventListener('click', close); window.removeEventListener('scroll', close, true); window.removeEventListener('keydown', esc); };
    }, [menu]);

    const openCollection = useCallback((title: string, recipes: Recipe[]) => {
        // Ouvrir une collection reprend la main : on quitte le planificateur/courses
        // et les filtres (un seul lien du menu actif à la fois).
        setPanel('none');
        setFilters([]);
        setCollection({ title, recipes });
        // Remonter tout en haut (le titre de la catégorie) APRÈS le rendu de la
        // collection — un scroll synchrone se ferait avant et resterait sans effet.
        requestAnimationFrame(() => {
            const el = document.querySelector(`.${styles.content}`);
            if (el) el.scrollTo({ top: 0, behavior: 'auto' });
        });
    }, []);

    const onMenu = useCallback((recipe: Recipe, x: number, y: number) => setMenu({ recipe, x, y }), []);

    const toggleLater = (id: string): boolean => {
        const list = readIds(LATER_KEY);
        const has = list.includes(id);
        const next = has ? list.filter((x) => x !== id) : [...list, id];
        localStorage.setItem(LATER_KEY, JSON.stringify(next));
        window.dispatchEvent(new Event('tv-later-change'));
        return !has; // true = vient d'être ajoutée
    };

    // Petit message central façon Apple TV+, 1,5 s.
    const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [toast, setToast] = useState<{ text: string; corner?: boolean } | null>(null);
    const flash = useCallback((text: string, corner = false) => {
        setToast({ text, corner });
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(null), 1500);
    }, []);
    const handleToggleLater = useCallback((r: Recipe) => {
        flash(toggleLater(String(r.id)) ? 'Ajouté' : 'Supprimé');
    }, [flash]);
    const isLater = useCallback((id: string) => laterIds.includes(id), [laterIds]);

    // Partage d'un lien (feuille native ou copie). Catégorie ou recette.
    const shareLink = async (url: string, title: string) => {
        try {
            if (navigator.share) await navigator.share({ title, url });
            else { await navigator.clipboard.writeText(url); flash('Lien copié'); }
        } catch { /* annulé */ }
    };
    // « Marquer comme visionné » : ajoute à l'historique + toast.
    const markSeen = (r: Recipe) => {
        try {
            const raw = JSON.parse(localStorage.getItem('recently-viewed') || '[]');
            const rest = (Array.isArray(raw) ? raw : []).filter((x: any) => String(x?.id ?? x) !== String(r.id));
            localStorage.setItem('recently-viewed', JSON.stringify([{ id: r.id }, ...rest].slice(0, 12)));
            window.dispatchEvent(new Event('tv-seen-change'));
        } catch { /* noop */ }
        flash('Marqué comme visionné', true);
    };

    // ── Données des rangées ──
    const heroRecipes = useMemo(() => mockRecipes.filter((r) => r.category !== 'restaurant' && r.image).slice(0, 6), []);
    const newest = useMemo(() => mockRecipes.filter((r) => r.category !== 'restaurant' && r.image).slice(0, 18), []);
    const resume = useMemo(() => inProgress.map((x) => x.recipe), [inProgress]);
    const topTen = useMemo(() => {
        const rated = stats
            ? mockRecipes.map((r) => ({ r, s: stats.get(String(r.id)) })).filter((x) => x.s && x.s.count > 0)
                .sort((a, b) => b.s!.avg - a.s!.avg || b.s!.count - a.s!.count).slice(0, 10).map((x) => x.r)
            : [];
        if (rated.length >= 3) return rated;
        return [...mockRecipes].sort((a, b) => (b.votes || 0) - (a.votes || 0)).slice(0, 10);
    }, [stats]);
    const laterRecipes = useMemo(() => laterIds.map((id) => mockRecipes.find((r) => String(r.id) === id)).filter(Boolean) as Recipe[], [laterIds]);
    const byCat = useMemo(() => {
        const g: Record<string, Recipe[]> = {};
        mockRecipes.forEach((r) => {
            if (!r.image) return;
            if (isSavoryMiscat(r)) return; // salées mal rangées en pâtisserie
            const tags = (r.tags || []).map((t) => t.toLowerCase());
            const cat = tags.some((t) => t === 'accompagnement' || t === 'accompagnements') ? 'accompagnements' : (r.category || 'autres').toLowerCase();
            (g[cat] ||= []).push(r);
        });
        return g;
    }, []);
    const themeRows = useMemo(() => {
        const SHAPES: CardShape[] = ['poster', 'wideXL', 'square', 'posterXL', 'wide'];
        const sorted = [...THEMES].sort((a, b) => a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' }));
        return sorted.map((theme, i) => ({
            title: theme.title,
            tag: theme.tag,
            recipes: mockRecipes.filter((r) => r.category !== 'restaurant' && r.image && matchesTag(r, theme.tag)),
            shape: SHAPES[i % SHAPES.length],
        })).filter((row) => row.recipes.length >= 4);
    }, []);

    // Lien de thème partagé (/?tag=…) : on ouvre la collection correspondante,
    // puis on nettoie l'URL — un rafraîchissement ne doit pas la rouvrir. Les
    // liens déjà envoyés (tag interne « dolce-vita » ou libellé WordPress
    // « Italie ») doivent continuer de fonctionner : on essaie les deux.
    useEffect(() => {
        let raw: string | null = null;
        try { raw = new URLSearchParams(window.location.search).get('tag'); } catch { return; }
        if (!raw) return;
        const low = raw.toLowerCase();
        const theme = THEMES.find((t) => t.tag.toLowerCase() === low)
            || THEMES.find((t) => t.title.toLowerCase() === low);
        const list = mockRecipes.filter((r) => r.image && matchesTag(r, theme?.tag || raw!));
        if (list.length) openCollection(theme?.title || raw, list);
        try {
            const u = new URL(window.location.href);
            u.searchParams.delete('tag');
            window.history.replaceState({}, '', u.pathname + u.search + u.hash);
        } catch { /* noop */ }
    }, [openCollection]);

    const CATS: { key: string; label: string }[] = [
        { key: 'aperitifs', label: 'Apéritifs' }, { key: 'entrees', label: 'Entrées' },
        { key: 'plats', label: 'Plats' }, { key: 'accompagnements', label: 'Accompagnements' },
        { key: 'desserts', label: 'Desserts' }, { key: 'patisserie', label: 'Pâtisseries' },
        { key: 'restaurant', label: 'Comme au resto' },
    ];

    // Tendances (thèmes du feed) et Pays — mêmes listes que le volet mobile, pour
    // que la barre latérale desktop propose exactement la même navigation.
    const TRENDS = useMemo(
        () => [...THEMES].sort((a, b) => a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' })),
        []
    );
    // Ordre alphabétique français (accents/casse ignorés), comme les catégories.
    const COUNTRIES: { tag: string; label: string }[] = [
        { tag: 'afrique', label: 'Afrique' }, { tag: 'asie', label: 'Asie' },
        { tag: 'espagne', label: 'Espagne' }, { tag: 'france', label: 'France' },
        { tag: 'grece', label: 'Grèce' }, { tag: 'italie', label: 'Italie' },
        { tag: 'liban', label: 'Liban' }, { tag: 'mexique', label: 'Mexique' },
        { tag: 'orient', label: 'Orient' }, { tag: 'usa', label: 'USA' },
    ];

    const goCategory = (key: string, lbl: string) => {
        setNav(key);
        openCollection(lbl, byCat[key] || []);
    };
    // Tendance ou pays : on ouvre la collection des recettes correspondantes,
    // via les mêmes règles de correspondance que le reste du site.
    const goTag = (tag: string, lbl: string) => {
        setNav(`tag:${tag}`);
        openCollection(lbl, mockRecipes.filter((r) => r.image && r.category !== 'restaurant' && matchesTag(r, tag)));
    };
    const goHome = () => { setNav('accueil'); setCollection(null); setFilters([]); setPanel('none'); };

    // ── Multi-filtre ────────────────────────────────────────────────────────
    const toggleFilter = (token: string) => {
        setPanel('none');
        setCollection(null); // les résultats combinés priment sur une collection simple
        setFilters((prev) => prev.includes(token) ? prev.filter((t) => t !== token) : [...prev, token]);
    };
    const ALL_OPTIONS = useMemo(
        () => [
            ...CATS.filter((c) => c.key !== 'restaurant').map((c) => ({ token: `c:${c.key}`, label: c.label })),
            ...TRENDS.map((t) => ({ token: `t:${t.tag}`, label: t.title })),
            ...COUNTRIES.map((c) => ({ token: `p:${c.tag}`, label: c.label })),
        ],
        [TRENDS] // CATS/COUNTRIES sont des constantes locales stables
    );
    const labelOf = (token: string) => ALL_OPTIONS.find((o) => o.token === token)?.label || token.slice(2);
    // Recettes correspondant à TOUS les groupes cochés (ET), OU dans un groupe.
    const filtered = useMemo(() => {
        if (!filters.length) return [] as Recipe[];
        const byGroup: Record<string, string[]> = {};
        filters.forEach((t) => { (byGroup[t.slice(0, 1)] ||= []).push(t.slice(2)); });
        const hasCategory = !!byGroup['c']?.length;
        return mockRecipes.filter((r) => {
            if (!r.image) return false;
            return Object.entries(byGroup).every(([g, values]) =>
                values.some((v) => {
                    if (g !== 'c') return matchesTag(r, v, { ignoreCategoryGuards: hasCategory });
                    const tags = (r.tags || []).map((t) => t.toLowerCase());
                    if (v === 'accompagnements') return tags.includes('accompagnement') || tags.includes('accompagnements');
                    return (r.category || '').toLowerCase() === v;
                })
            );
        });
    }, [filters]);

    // Ouvre un raccourci épinglé selon son préfixe de token (c: / t: / p:).
    const openToken = (token: string, label: string) => {
        const kind = token.slice(0, 1);
        const id = token.slice(2);
        if (kind === 'c') goCategory(id, label);
        else goTag(id, label); // t: (tendance) ou p: (pays) — même résolution
    };
    // Dépose un élément glissé dans la bibliothèque (sans doublon).
    const dropToLibrary = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        let data: LibraryItem | null = null;
        try { data = JSON.parse(e.dataTransfer.getData('application/x-tv-item') || e.dataTransfer.getData('text/plain')); } catch { return; }
        if (!data || !data.token) return;
        setLibrary((prev) => {
            if (prev.some((x) => x.token === data!.token)) return prev;
            const next = [...prev, data!];
            writeLibrary(next);
            return next;
        });
    };
    const removeFromLibrary = (token: string) => {
        setLibrary((prev) => { const next = prev.filter((x) => x.token !== token); writeLibrary(next); return next; });
    };
    // Rend un bouton de liste (catégorie/tendance/pays) déplaçable vers la bibliothèque.
    const dragProps = (token: string, label: string) => ({
        draggable: true,
        onDragStart: (e: React.DragEvent) => {
            const payload = JSON.stringify({ token, label });
            e.dataTransfer.setData('application/x-tv-item', payload);
            e.dataTransfer.setData('text/plain', payload);
            e.dataTransfer.effectAllowed = 'copy';
        },
    });

    // `tour` : repère utilisé par la visite guidée, qui montre ces entrées en
    // exemple (elle cherche `[data-tour="planner"]` et `[data-tour="shopping"]`).
    const NavItem = ({ icon, children, active, tour, onClick }: { icon: string; children: React.ReactNode; active?: boolean; tour?: string; onClick: () => void }) => (
        <button className={`${styles.navRow} ${active ? styles.navRowOn : ''}`} data-tour={tour} onClick={onClick}>
            <Ic d={icon} /><span>{children}</span>
        </button>
    );

    // Groupe de filtres repliable (Catégories / Tendances / Pays) — même logique
    // que le volet mobile : replié, on ne montre que les filtres cochés.
    const NavGroup = ({ title, items }: { title: string; items: { token: string; label: string }[] }) => {
        const selCount = items.filter((it) => filters.includes(it.token)).length;
        const expanded = !!openGroups[title];
        const visible = expanded ? items : items.filter((it) => filters.includes(it.token));
        return (
            <>
                <button
                    className={styles.navGroupHead}
                    onClick={() => setOpenGroups((g) => ({ ...g, [title]: !g[title] }))}
                    aria-expanded={expanded}
                >
                    <span className={styles.navLabel}>{title}</span>
                    {selCount > 0 && <span className={styles.navGroupCount}>{selCount}</span>}
                    <span className={`${styles.navChevron} ${expanded ? styles.navChevronOpen : ''}`}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                    </span>
                </button>
                {visible.length > 0 && (
                    <nav className={styles.navGroup}>
                        {visible.map((it) => (
                            <button
                                key={it.token}
                                {...dragProps(it.token, it.label)}
                                className={`${styles.navRow} ${styles.navRowSmall} ${styles.navDraggable} ${filters.includes(it.token) ? styles.navRowOn : ''}`}
                                onClick={() => toggleFilter(it.token)}
                            >
                                <span className={styles.navBullet} /><span>{it.label}</span>
                                {filters.includes(it.token) && <Check />}
                            </button>
                        ))}
                    </nav>
                )}
            </>
        );
    };

    return (
        <div className={`${styles.shell} ${sidebarOpen ? '' : styles.shellClosed}`}>
            {/* Rouvrir la barre latérale quand elle est repliée. */}
            {!sidebarOpen && (
                <button className={styles.sidebarOpenBtn} onClick={() => setSidebarOpen(true)} aria-label="Ouvrir le menu">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none"><path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h11" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /></svg>
                </button>
            )}

            {/* Connexion : tout en haut à droite, à côté du titre. */}
            <div className={styles.topAuth}>
                <AuthButton />
            </div>

            {/* ── Barre latérale ── */}
            <aside className={styles.sidebar}>
                <div className={styles.brandBar}>
                    {/* Le titre ramène à l'accueil, comme sur mobile. */}
                    <button className={styles.brand} onClick={goHome} aria-label="Retour à l'accueil">
                        <div className={styles.brandKicker}>Les recettes</div>
                        <div className={styles.brandWord}>Magiques</div>
                    </button>
                    <button className={styles.sidebarToggle} onClick={() => setSidebarOpen(false)} aria-label="Replier le menu">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M15 5l-7 7 7 7M20 5l-7 7 7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                </div>

                <button className={styles.searchBtn} onClick={() => setSearchOpen(true)}>
                    <Ic d={ICONS.search} /><span>Rechercher</span>
                </button>

                <nav className={styles.navGroup}>
                    <NavItem icon={ICONS.home} active={nav === 'accueil'} onClick={goHome}>Accueil</NavItem>
                    <NavItem icon={ICONS.planner} tour="planner" active={panel === 'planner'} onClick={() => { setCollection(null); setFilters([]); setPanel('planner'); }}>Planificateur</NavItem>
                    <NavItem icon={ICONS.cart} tour="shopping" active={panel === 'courses'} onClick={() => { setCollection(null); setFilters([]); setPanel('courses'); }}>Liste de courses</NavItem>
                    <NavItem icon={ICONS.heart} tour="favorites" onClick={() => router.push('/favorites')}>Favoris</NavItem>
                    <NavItem icon="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3m10-4h3v1a3 3 0 0 1-3 3" onClick={() => router.push('/tv-profil')}>Palmarès</NavItem>
                    {/* Visite guidée : le bouton porte son propre libellé, on ne
                        fournit que l'icône et la ligne de menu. */}
                    <button className={`${styles.navRow}`} onClick={() => setTuto(true)}>
                        <Ic d={ICONS.book} /><span>Tutoriel</span>
                    </button>
                </nav>

                {/* Bibliothèque : zone de dépôt. On y glisse une catégorie / tendance /
                    pays depuis les listes ci-dessous ; ça s'enregistre tout seul. */}
                <div className={styles.navLabel}>Bibliothèque</div>
                <nav
                    className={`${styles.navGroup} ${styles.libraryDrop} ${dragOver ? styles.libraryDropOver : ''}`}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; if (!dragOver) setDragOver(true); }}
                    onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(false); }}
                    onDrop={dropToLibrary}
                >
                    <NavItem icon={ICONS.clock} onClick={() => openCollection('Nouveautés', newest)}>Ajouts récents</NavItem>
                    <NavItem icon={ICONS.star} onClick={() => openCollection('Top 10 : les mieux notées', topTen)}>Top 10</NavItem>
                    <NavItem icon={ICONS.resto} onClick={() => goCategory('restaurant', 'Comme au resto')}>Comme au resto</NavItem>
                    {library.map((it) => (
                        <div key={it.token} className={`${styles.navRow} ${styles.libraryItem} ${nav === `tag:${it.token.slice(2)}` || nav === it.token.slice(2) ? styles.navRowOn : ''}`}>
                            <button className={styles.libraryItemBtn} onClick={() => openToken(it.token, it.label)}>
                                <span className={styles.navBullet} /><span>{it.label}</span>
                            </button>
                            <button className={styles.libraryRemove} onClick={(e) => { e.stopPropagation(); removeFromLibrary(it.token); }} aria-label={`Retirer ${it.label}`}>
                                <svg viewBox="0 0 24 24" width="13" height="13" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
                            </button>
                        </div>
                    ))}
                    {library.length === 0 && (
                        <div className={styles.libraryHint}>Glisse une catégorie, une tendance ou un pays ici.</div>
                    )}
                </nav>

                {/* Catégories / Tendances / Pays : un clic COCHE le filtre (cumulatif),
                    et l'élément reste déplaçable vers la Bibliothèque. */}
                <NavGroup title="Catégories" items={CATS.filter((c) => c.key !== 'restaurant').map((c) => ({ token: `c:${c.key}`, label: c.label }))} />
                <NavGroup title="Tendances" items={TRENDS.map((t) => ({ token: `t:${t.tag}`, label: t.title }))} />
                <NavGroup title="Pays" items={COUNTRIES.map((c) => ({ token: `p:${c.tag}`, label: c.label }))} />

            </aside>

            {/* ── Contenu ── */}
            <main className={styles.content}>
                {panel !== 'none' ? (
                    <div className={styles.panelHost}>
                        {!user ? (
                            <TVAuthGate
                                subtitle={panel === 'planner'
                                    ? 'Le planificateur de la semaine est réservé aux membres connectés.'
                                    : 'Ta liste de courses est réservée aux membres connectés.'}
                            />
                        ) : panel === 'planner' ? <TVPlanner embedded /> : <TVCourses embedded />}
                    </div>
                ) : filters.length > 0 ? (
                    <div className={styles.collection}>
                        <div className={styles.collHead}>
                            <button className={styles.collBack} onClick={goHome}>
                                <svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                Accueil
                            </button>
                            <h1 className={styles.collTitle}>Filtres</h1>
                            <span className={styles.collCount}>{filtered.length} recette{filtered.length > 1 ? 's' : ''}</span>
                        </div>
                        {/* Barre des filtres actifs : chaque puce se retire d'un clic. */}
                        <div className={styles.filterBar}>
                            {filters.map((t) => (
                                <button key={t} className={styles.filterChip} onClick={() => toggleFilter(t)}>
                                    <span>{labelOf(t)}</span>
                                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
                                </button>
                            ))}
                            <button className={styles.filterClear} onClick={() => setFilters([])}>Tout effacer</button>
                        </div>
                        {filtered.length > 0 ? (
                            <div className={styles.mosaic}>
                                {filtered.map((r, i) => (
                                    <div key={r.id} className={`${styles.mosaicCell} ${styles[MOSAIC[i % MOSAIC.length]]}`}>
                                        <Card recipe={r} shape="wide" onMenu={onMenu} later={isLater(String(r.id))} onToggleLater={handleToggleLater} />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className={styles.filterEmpty}>Aucune recette ne coche tous ces filtres à la fois.</div>
                        )}
                    </div>
                ) : collection ? (
                    <div className={styles.collection}>
                        <div className={styles.collHead}>
                            <button className={styles.collBack} onClick={goHome}>
                                <svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                Accueil
                            </button>
                            <h1 className={styles.collTitle}>{collection.title}</h1>
                            <span className={styles.collCount}>{collection.recipes.length} recette{collection.recipes.length > 1 ? 's' : ''}</span>
                        </div>
                        {/* Mosaïque : les cartes ne sont pas toutes de la même
                            taille — grande verticale, large, standard, petite —
                            selon un motif qui se répète, comme sur mobile. */}
                        <div className={styles.mosaic}>
                            {collection.recipes.map((r, i) => (
                                <div key={r.id} className={`${styles.mosaicCell} ${styles[MOSAIC[i % MOSAIC.length]]}`}>
                                    <Card recipe={r} shape="wide" onMenu={onMenu} />
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <>
                        <Hero recipes={heroRecipes} total={mockRecipes.length} onMenu={onMenu} />
                        <div className={styles.rows}>
                            <Row title="Top 10 : les mieux notées" recipes={topTen} shape="poster" ranked onSeeAll={openCollection} onMenu={onMenu} isLater={isLater} onToggleLater={handleToggleLater} />
                            {resume.length > 0 && <Row title="Reprendre la cuisine" recipes={resume} shape="wide" onSeeAll={openCollection} onMenu={onMenu} isLater={isLater} onToggleLater={handleToggleLater} />}
                            {laterRecipes.length > 0 && <Row title="À faire plus tard" recipes={laterRecipes} shape="wide" onSeeAll={openCollection} onMenu={onMenu} isLater={isLater} onToggleLater={handleToggleLater} />}
                            {forYou.length >= 4 && <Row title="Pour toi" recipes={forYou} shape="poster" onSeeAll={openCollection} onMenu={onMenu} isLater={isLater} onToggleLater={handleToggleLater} />}
                            <Row title="Nouveautés" recipes={newest} shape="wide" onSeeAll={openCollection} onMenu={onMenu} isLater={isLater} onToggleLater={handleToggleLater} />
                            <Row title="Apéritifs" recipes={byCat['aperitifs'] || []} shape="square" onSeeAll={openCollection} onMenu={onMenu} isLater={isLater} onToggleLater={handleToggleLater} />
                            <Row title="Entrées" recipes={byCat['entrees'] || []} shape="poster" onSeeAll={openCollection} onMenu={onMenu} isLater={isLater} onToggleLater={handleToggleLater} />
                            <Row title="Plats" recipes={byCat['plats'] || []} shape="wideXL" onSeeAll={openCollection} onMenu={onMenu} isLater={isLater} onToggleLater={handleToggleLater} />
                            <Row title="Accompagnements" recipes={byCat['accompagnements'] || []} shape="square" onSeeAll={openCollection} onMenu={onMenu} isLater={isLater} onToggleLater={handleToggleLater} />
                            <Row title="Desserts" recipes={byCat['desserts'] || []} shape="posterXL" onSeeAll={openCollection} onMenu={onMenu} isLater={isLater} onToggleLater={handleToggleLater} />
                            <Row title="Pâtisseries" recipes={byCat['patisserie'] || []} shape="wide" onSeeAll={openCollection} onMenu={onMenu} isLater={isLater} onToggleLater={handleToggleLater} />
                            {themeRows.map((row) => (
                                <Row key={row.title} title={row.title} recipes={row.recipes} shape={row.shape} shareTag={row.tag} onSeeAll={openCollection} onMenu={onMenu} isLater={isLater} onToggleLater={handleToggleLater} />
                            ))}
                            <Row title="Comme au resto" recipes={byCat['restaurant'] || []} shape="poster" onSeeAll={openCollection} onMenu={onMenu} isLater={isLater} onToggleLater={handleToggleLater} />
                        </div>
                    </>
                )}
            </main>

            {/* ── Menu contextuel (clic droit / bouton +) ── */}
            <AnimatePresence>
                {menu && (
                    <motion.div
                        className={styles.ctx}
                        style={{ left: Math.min(menu.x, (typeof window !== 'undefined' ? window.innerWidth : 9999) - 282), top: menu.y }}
                        initial={{ opacity: 0, scale: 0.94, y: -6 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{ duration: 0.16 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className={styles.ctxTitle}>{label(menu.recipe)}</div>
                        {(() => {
                            const r = menu.recipe;
                            const cat = (r.category || '').toLowerCase();
                            const catName = catLabel(r);
                            const origin = typeof window !== 'undefined' ? window.location.origin : '';
                            const inLater = laterIds.includes(String(r.id));
                            const CtxIc = ({ d }: { d: string }) => (
                                <svg className={styles.ctxIcon} viewBox="0 0 24 24" fill="none" aria-hidden>
                                    <path d={d} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            );
                            return (
                                <>
                                    <button className={styles.ctxAction} onClick={() => { setMenu(null); openRecipe(r); }}>
                                        <CtxIc d="M8 5v14l11-7z" /><span>Voir la recette</span>
                                    </button>
                                    <button className={styles.ctxAction} onClick={() => { setMenu(null); goCategory(cat, catName); }}>
                                        <CtxIc d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 8h.01M11 12h1v4h1" /><span>Accéder à {catName}</span>
                                    </button>
                                    <button className={styles.ctxAction} onClick={() => { setMenu(null); shareLink(`${origin}/?tag=${encodeURIComponent(cat)}`, catName); }}>
                                        <CtxIc d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13" /><span>Partager la catégorie</span>
                                    </button>
                                    <button className={styles.ctxAction} onClick={() => { setMenu(null); shareLink(`${origin}/?fiche=${r.id}`, label(r)); }}>
                                        <CtxIc d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13" /><span>Partager la recette</span>
                                    </button>
                                    <button className={styles.ctxAction} onClick={() => { setMenu(null); handleToggleLater(r); }}>
                                        {inLater
                                            ? <CtxIc d="M5 12h14" />
                                            : <CtxIc d="M12 5v14M5 12h14" />}
                                        <span>{inLater ? 'Retirer de la liste' : 'À faire plus tard'}</span>
                                    </button>
                                    <button className={styles.ctxAction} onClick={() => { setMenu(null); markSeen(r); }}>
                                        <CtxIc d="M3.5 7.5h13a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1zM6.5 13l2.5 2.5L14 10M17.5 4.5h3a1 1 0 0 1 1 1v3" />
                                        <span>Marquer comme visionné</span>
                                    </button>
                                    {resume.some((x) => String(x.id) === String(r.id)) && (
                                        <button className={styles.ctxAction} onClick={() => { setMenu(null); clearProgress(String(r.id)); }}>
                                            <CtxIc d="M5 12h14" /><span>Retirer de « Reprendre la cuisine »</span>
                                        </button>
                                    )}
                                </>
                            );
                        })()}
                    </motion.div>
                )}
            </AnimatePresence>

            <TVSpotlight open={searchOpen} onClose={() => setSearchOpen(false)} onRecipeSelect={(r) => openRecipe(r)} />

            {/* Message central « Ajouté » / « Supprimé », façon Apple TV+ (1,5 s). */}
            <AnimatePresence>
                {toast && (toast.corner ? (
                    <motion.div
                        className={styles.toastCorner}
                        initial={{ opacity: 0, y: -12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2 }}
                    >
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        <span>{toast.text}</span>
                    </motion.div>
                ) : (
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
                ))}
            </AnimatePresence>

            {tuto && <TVTutorial onClose={() => setTuto(false)} />}
        </div>
    );
}
