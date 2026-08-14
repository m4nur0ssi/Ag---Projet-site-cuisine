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
import { THEMES, matchesTag } from '@/mobile/screens/tv/themes';
import styles from './tvd.module.css';

const TVSpotlight = dynamic(() => import('@/mobile/screens/tv/TVSpotlight'), { ssr: false });
const AuthButton = dynamic(() => import('@/components/AuthButton/AuthButton'), { ssr: false });

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
};

// ── Carte ──────────────────────────────────────────────────────────────────

type CardShape = 'wide' | 'poster' | 'square';

function Card({ recipe, shape, onMenu }: { recipe: Recipe; shape: CardShape; onMenu: (r: Recipe, x: number, y: number) => void }) {
    return (
        <div
            className={`${styles.card} ${styles[shape]}`}
            onClick={() => openRecipe(recipe)}
            onContextMenu={(e) => { e.preventDefault(); onMenu(recipe, e.clientX, e.clientY); }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') openRecipe(recipe); }}
        >
            <div className={styles.thumb}>
                <img src={recipe.image} alt={label(recipe)} className={styles.thumbImg} loading="lazy" decoding="async" draggable={false} />
                <div className={styles.thumbHover}>
                    <span className={styles.playDot}>
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                    </span>
                </div>
            </div>
            <div className={styles.cardLabel}>{label(recipe)}</div>
            <div className={styles.cardSub}>{[catLabel(recipe), timeLabel(recipe)].filter(Boolean).join(' · ')}</div>
        </div>
    );
}

// ── Rangée horizontale (flèches au survol) ─────────────────────────────────

function Row({ title, recipes, shape, onSeeAll, onMenu }: {
    title: string; recipes: Recipe[]; shape: CardShape;
    onSeeAll: (title: string, recipes: Recipe[]) => void;
    onMenu: (r: Recipe, x: number, y: number) => void;
}) {
    const scroller = useRef<HTMLDivElement>(null);
    if (!recipes.length) return null;
    const nudge = (dir: number) => {
        const el = scroller.current;
        if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
    };
    return (
        <section className={styles.row}>
            <button className={styles.rowHead} onClick={() => onSeeAll(title, recipes)}>
                <h2 className={styles.rowTitle}>{title}</h2>
                <svg className={styles.rowChevron} viewBox="0 0 8 14" fill="none"><path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <div className={styles.rowWrap}>
                <button className={`${styles.rowArrow} ${styles.rowArrowL}`} onClick={() => nudge(-1)} aria-label="Précédent">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                <div className={styles.rowScroll} ref={scroller}>
                    {recipes.map((r) => <Card key={r.id} recipe={r} shape={shape} onMenu={onMenu} />)}
                </div>
                <button className={`${styles.rowArrow} ${styles.rowArrowR}`} onClick={() => nudge(1)} aria-label="Suivant">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none"><path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
            </div>
        </section>
    );
}

// ── Héros carrousel ─────────────────────────────────────────────────────────

function Hero({ recipes, onMenu }: { recipes: Recipe[]; onMenu: (r: Recipe, x: number, y: number) => void }) {
    const [index, setIndex] = useState(0);
    const [paused, setPaused] = useState(false);

    useEffect(() => {
        if (recipes.length < 2 || paused) return;
        const id = setInterval(() => setIndex((i) => (i + 1) % recipes.length), 5000);
        return () => clearInterval(id);
    }, [recipes.length, paused]);

    const current = recipes[Math.min(index, recipes.length - 1)];
    if (!current) return null;
    const go = (d: number) => setIndex((i) => (i + d + recipes.length) % recipes.length);

    return (
        <div className={styles.hero} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
            {/* Image à gauche (moitié), fondu vers le noir à droite — évite d'étirer
               les photos larges à basse résolution sur toute la largeur. */}
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
                <div className={styles.heroFade} />
                <button className={`${styles.heroNav} ${styles.heroNavL}`} onClick={(e) => { e.stopPropagation(); go(-1); }} aria-label="Précédent">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
            </div>

            {/* Détails à droite (titre, méta, actions) sur fond noir. */}
            <div className={styles.heroRight}>
                <button className={`${styles.heroNav} ${styles.heroNavR}`} onClick={() => go(1)} aria-label="Suivant">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none"><path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
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
    const [searchOpen, setSearchOpen] = useState(false);
    const [collection, setCollection] = useState<{ title: string; recipes: Recipe[] } | null>(null);
    const [recentlyViewed, setRecentlyViewed] = useState<Recipe[]>([]);
    const [laterIds, setLaterIds] = useState<string[]>([]);
    const [menu, setMenu] = useState<{ recipe: Recipe; x: number; y: number } | null>(null);
    const [nav, setNav] = useState<'accueil' | string>('accueil');

    useEffect(() => {
        try {
            const ids: string[] = JSON.parse(localStorage.getItem('recently-viewed') || '[]').map((r: any) => r.id || r);
            setRecentlyViewed(ids.map((id) => mockRecipes.find((r) => String(r.id) === String(id))).filter(Boolean) as Recipe[]);
        } catch { /* noop */ }
        const sync = () => setLaterIds(readIds(LATER_KEY));
        sync();
        window.addEventListener('tv-later-change', sync);
        window.addEventListener('storage', sync);
        return () => { window.removeEventListener('tv-later-change', sync); window.removeEventListener('storage', sync); };
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
        setCollection({ title, recipes });
        document.querySelector(`.${styles.content}`)?.scrollTo({ top: 0, behavior: 'smooth' });
    }, []);

    const onMenu = useCallback((recipe: Recipe, x: number, y: number) => setMenu({ recipe, x, y }), []);

    const toggleLater = (id: string) => {
        const list = readIds(LATER_KEY);
        const has = list.includes(id);
        const next = has ? list.filter((x) => x !== id) : [...list, id];
        localStorage.setItem(LATER_KEY, JSON.stringify(next));
        window.dispatchEvent(new Event('tv-later-change'));
    };

    // ── Données des rangées ──
    const heroRecipes = useMemo(() => mockRecipes.filter((r) => r.category !== 'restaurant' && r.image).slice(0, 6), []);
    const newest = useMemo(() => mockRecipes.filter((r) => r.category !== 'restaurant' && r.image).slice(0, 18), []);
    const resume = recentlyViewed.length ? recentlyViewed : newest.slice(0, 10);
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
            const tags = (r.tags || []).map((t) => t.toLowerCase());
            const cat = tags.some((t) => t === 'accompagnement' || t === 'accompagnements') ? 'accompagnements' : (r.category || 'autres').toLowerCase();
            (g[cat] ||= []).push(r);
        });
        return g;
    }, []);
    const themeRows = useMemo(() => {
        const SHAPES: CardShape[] = ['poster', 'wide', 'square'];
        const sorted = [...THEMES].sort((a, b) => a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' }));
        return sorted.map((theme, i) => ({
            title: theme.title,
            recipes: mockRecipes.filter((r) => r.category !== 'restaurant' && r.image && matchesTag(r, theme.tag)),
            shape: SHAPES[i % SHAPES.length],
        })).filter((row) => row.recipes.length >= 4);
    }, []);

    const CATS: { key: string; label: string }[] = [
        { key: 'aperitifs', label: 'Apéritifs' }, { key: 'entrees', label: 'Entrées' },
        { key: 'plats', label: 'Plats' }, { key: 'accompagnements', label: 'Accompagnements' },
        { key: 'desserts', label: 'Desserts' }, { key: 'patisserie', label: 'Pâtisseries' },
        { key: 'restaurant', label: 'Comme au resto' },
    ];

    const goCategory = (key: string, lbl: string) => {
        setNav(key);
        openCollection(lbl, byCat[key] || []);
    };
    const goHome = () => { setNav('accueil'); setCollection(null); };

    const NavItem = ({ icon, children, active, onClick }: { icon: string; children: React.ReactNode; active?: boolean; onClick: () => void }) => (
        <button className={`${styles.navRow} ${active ? styles.navRowOn : ''}`} onClick={onClick}>
            <Ic d={icon} /><span>{children}</span>
        </button>
    );

    return (
        <div className={styles.shell}>
            {/* ── Barre latérale ── */}
            <aside className={styles.sidebar}>
                <div className={styles.brand}>
                    <div className={styles.brandKicker}>Les recettes</div>
                    <div className={styles.brandWord}>Magiques</div>
                </div>

                <button className={styles.searchBtn} onClick={() => setSearchOpen(true)}>
                    <Ic d={ICONS.search} /><span>Rechercher</span>
                </button>

                <nav className={styles.navGroup}>
                    <NavItem icon={ICONS.home} active={nav === 'accueil'} onClick={goHome}>Accueil</NavItem>
                    <NavItem icon={ICONS.planner} onClick={() => router.push('/meal-planner')}>Planificateur</NavItem>
                    <NavItem icon={ICONS.cart} onClick={() => router.push('/shopping-list')}>Liste de courses</NavItem>
                    <NavItem icon={ICONS.heart} onClick={() => router.push('/favorites')}>Favoris</NavItem>
                </nav>

                <div className={styles.navLabel}>Bibliothèque</div>
                <nav className={styles.navGroup}>
                    <NavItem icon={ICONS.clock} onClick={() => openCollection('Nouveautés', newest)}>Ajouts récents</NavItem>
                    <NavItem icon={ICONS.star} onClick={() => openCollection('Top 10 : les mieux notées', topTen)}>Top 10</NavItem>
                    <NavItem icon={ICONS.resto} onClick={() => goCategory('restaurant', 'Comme au resto')}>Comme au resto</NavItem>
                </nav>

                <div className={styles.navLabel}>Catégories</div>
                <nav className={styles.navGroup}>
                    {CATS.filter((c) => c.key !== 'restaurant').map((c) => (
                        <button key={c.key} className={`${styles.navRow} ${styles.navRowSmall} ${nav === c.key ? styles.navRowOn : ''}`} onClick={() => goCategory(c.key, c.label)}>
                            <span className={styles.navBullet} /><span>{c.label}</span>
                        </button>
                    ))}
                </nav>

                <div className={styles.sidebarFoot}>
                    <AuthButton />
                </div>
            </aside>

            {/* ── Contenu ── */}
            <main className={styles.content}>
                {collection ? (
                    <div className={styles.collection}>
                        <div className={styles.collHead}>
                            <button className={styles.collBack} onClick={goHome}>
                                <svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                Accueil
                            </button>
                            <h1 className={styles.collTitle}>{collection.title}</h1>
                            <span className={styles.collCount}>{collection.recipes.length} recette{collection.recipes.length > 1 ? 's' : ''}</span>
                        </div>
                        <div className={styles.grid}>
                            {collection.recipes.map((r) => <Card key={r.id} recipe={r} shape="wide" onMenu={onMenu} />)}
                        </div>
                    </div>
                ) : (
                    <>
                        <Hero recipes={heroRecipes} onMenu={onMenu} />
                        <div className={styles.rows}>
                            <Row title="Top 10 : les mieux notées" recipes={topTen} shape="poster" onSeeAll={openCollection} onMenu={onMenu} />
                            <Row title="Reprendre la cuisine" recipes={resume} shape="wide" onSeeAll={openCollection} onMenu={onMenu} />
                            {laterRecipes.length > 0 && <Row title="À faire plus tard" recipes={laterRecipes} shape="wide" onSeeAll={openCollection} onMenu={onMenu} />}
                            <Row title="Nouveautés" recipes={newest} shape="wide" onSeeAll={openCollection} onMenu={onMenu} />
                            <Row title="Apéritifs" recipes={byCat['aperitifs'] || []} shape="square" onSeeAll={openCollection} onMenu={onMenu} />
                            <Row title="Entrées" recipes={byCat['entrees'] || []} shape="poster" onSeeAll={openCollection} onMenu={onMenu} />
                            <Row title="Plats" recipes={byCat['plats'] || []} shape="wide" onSeeAll={openCollection} onMenu={onMenu} />
                            <Row title="Accompagnements" recipes={byCat['accompagnements'] || []} shape="square" onSeeAll={openCollection} onMenu={onMenu} />
                            <Row title="Desserts" recipes={byCat['desserts'] || []} shape="poster" onSeeAll={openCollection} onMenu={onMenu} />
                            <Row title="Pâtisseries" recipes={byCat['patisserie'] || []} shape="wide" onSeeAll={openCollection} onMenu={onMenu} />
                            {themeRows.map((row) => (
                                <Row key={row.title} title={row.title} recipes={row.recipes} shape={row.shape} onSeeAll={openCollection} onMenu={onMenu} />
                            ))}
                            <Row title="Comme au resto" recipes={byCat['restaurant'] || []} shape="poster" onSeeAll={openCollection} onMenu={onMenu} />
                        </div>
                    </>
                )}
            </main>

            {/* ── Menu contextuel (clic droit / bouton +) ── */}
            <AnimatePresence>
                {menu && (
                    <motion.div
                        className={styles.ctx}
                        style={{ left: Math.min(menu.x, (typeof window !== 'undefined' ? window.innerWidth : 9999) - 240), top: menu.y }}
                        initial={{ opacity: 0, scale: 0.94, y: -6 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{ duration: 0.16 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className={styles.ctxTitle}>{label(menu.recipe)}</div>
                        <button className={styles.ctxAction} onClick={() => { const r = menu.recipe; setMenu(null); openRecipe(r); }}>Voir la recette</button>
                        <button className={styles.ctxAction} onClick={() => { const r = menu.recipe; setMenu(null); toggleLater(String(r.id)); }}>
                            {laterIds.includes(String(menu.recipe.id)) ? 'Retirer de la liste' : 'À faire plus tard'}
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            <TVSpotlight open={searchOpen} onClose={() => setSearchOpen(false)} onRecipeSelect={(r) => openRecipe(r)} />
        </div>
    );
}
