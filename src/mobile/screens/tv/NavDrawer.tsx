'use client';

/**
 * Volet de navigation + filtres — accueil « Apple TV+ » (route /tv, test de design).
 * Barre latérale façon app Apple TV : raccourcis en haut, puis TOUTES les
 * catégories, tendances et pays, cochables. Les filtres se combinent :
 * OU à l'intérieur d'un groupe, ET entre groupes — « un dessert espagnol express ».
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/mobile/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { THEMES } from './themes';
import styles from './tv.module.css';

// ── Icônes (trait fin, esprit SF Symbols) ──────────────────────────────────

const Ic = ({ d }: { d: string }) => (
    <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d={d} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const ICONS = {
    home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
    planner: 'M7 3v3m10-3v3M3.5 9h17M5 5h14a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 19 21H5a1.5 1.5 0 0 1-1.5-1.5v-13A1.5 1.5 0 0 1 5 5z',
    cart: 'M3 4h2l2.2 10.5a1.5 1.5 0 0 0 1.5 1.2h7.9a1.5 1.5 0 0 0 1.5-1.2L20 7H6M9 20h.01M17 20h.01',
    heart: 'M20.8 6.6a4.6 4.6 0 0 0-6.5 0L12 8.9 9.7 6.6a4.6 4.6 0 1 0-6.5 6.5l1 1L12 21l7.8-6.9 1-1a4.6 4.6 0 0 0 0-6.5z',
    search: 'M21 21l-4.3-4.3M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0z',
    day: 'M12 7v5l3 1.8M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
    book: 'M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H5.5A1.5 1.5 0 0 1 4 15.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H14a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h4.5a1.5 1.5 0 0 0 1.5-1.5z',
};

/** Retour haptique (ignoré si non supporté). */
const haptic = (ms = 8) => { try { navigator.vibrate?.(ms); } catch { /* noop */ } };

const Check = () => (
    <svg className={styles.navCheck} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M4.5 12.5 9.5 17.5 19.5 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// ── Options de filtre ──────────────────────────────────────────────────────
// Jeton = « groupe:valeur ». c = catégorie, t = tendance, p = pays.

export const CATEGORY_OPTIONS: { token: string; label: string }[] = [
    { token: 'c:aperitifs', label: 'Apéritifs' },
    { token: 'c:entrees', label: 'Entrées' },
    { token: 'c:plats', label: 'Plats' },
    { token: 'c:accompagnements', label: 'Accompagnements' },
    { token: 'c:desserts', label: 'Desserts' },
    { token: 'c:patisserie', label: 'Pâtisseries' },
    { token: 'c:glaces', label: 'Glaces' },
    { token: 'c:boissons', label: 'Boissons' },
    { token: 'c:sauces', label: 'Sauces' },
    { token: 'c:restaurant', label: 'Comme au resto' },
];

/** Toutes les thématiques du feed, dans le même ordre alphabétique. */
export const TREND_OPTIONS = [...THEMES]
    .sort((a, b) => a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' }))
    .map((t) => ({ token: `t:${t.tag}`, label: t.title }));

export const COUNTRY_OPTIONS: { token: string; label: string }[] = [
    { token: 'p:france', label: 'France' },
    { token: 'p:italie', label: 'Italie' },
    { token: 'p:espagne', label: 'Espagne' },
    { token: 'p:grece', label: 'Grèce' },
    { token: 'p:orient', label: 'Orient' },
    { token: 'p:liban', label: 'Liban' },
    { token: 'p:asie', label: 'Asie' },
    { token: 'p:mexique', label: 'Mexique' },
    { token: 'p:usa', label: 'USA' },
    { token: 'p:afrique', label: 'Afrique' },
];

interface NavDrawerProps {
    open: boolean;
    onClose: () => void;
    selected: string[];
    onToggle: (token: string) => void;
    onClear: () => void;
    /** Ouvre la sélection courante dans la vue « tout afficher ». */
    onApply: () => void;
    /** Ouvre la recherche « façon Apple TV » (et non la page /search du site). */
    onSearch: () => void;
    /** Ouvre la visite guidée de l'app mobile (et non celle du site desktop). */
    onTutorial: () => void;
    resultCount: number;
    /** Recherche texte : se combine (ET) avec les filtres cochés. */
    query: string;
    onQuery: (v: string) => void;
}

export default function NavDrawer({ open, onClose, selected, onToggle, onClear, onApply, onSearch, onTutorial, resultCount, query, onQuery }: NavDrawerProps) {
    const router = useRouter();
    const active = selected.length > 0 || query.trim().length > 0;
    // Planificateur, courses et favoris n'ont de sens que connecté : hors session
    // ils restent grisés et le tap ouvre la connexion au lieu de naviguer.
    const [authed, setAuthed] = useState(false);

    // La session est relue À CHAQUE OUVERTURE du volet : au premier montage,
    // `getSession()` peut encore attendre le rafraîchissement du jeton (réseau du
    // téléphone) et répondre « pas de session ». Le volet restait alors grisé
    // jusqu'au prochain événement d'authentification — planificateur et liste
    // paraissaient morts alors que l'utilisateur était bien connecté.
    useEffect(() => {
        let alive = true;
        const check = () => supabase.auth.getSession().then(({ data }) => { if (alive) setAuthed(!!data.session); });
        check();
        const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setAuthed(!!session));
        return () => { alive = false; sub.subscription.unsubscribe(); };
    }, [open]);

    // Volet ouvert = page figée derrière (comportement d'une modale iOS).
    useEffect(() => {
        if (!open) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, [open]);

    const go = (path: string) => { onClose(); router.push(path); };

    /** Entrée réservée aux connectés. */
    const goAuthed = (path: string) => {
        if (!authed) {
            window.dispatchEvent(new CustomEvent('magic-toast-notify', { detail: 'Connecte-toi pour y accéder' }));
            window.dispatchEvent(new Event('magic-open-auth'));
            onClose();
            return;
        }
        go(path);
    };

    const Group = ({ title, options }: { title: string; options: { token: string; label: string }[] }) => (
        <>
            <div className={styles.navLabel}>{title}</div>
            <div className={styles.navGroup}>
                {options.map((o) => {
                    const on = selected.includes(o.token);
                    return (
                        <button
                            key={o.token}
                            className={`${styles.navRow} ${on ? styles.navRowOn : ''}`}
                            onClick={() => { haptic(8); onToggle(o.token); }}
                            aria-pressed={on}
                        >
                            <span className={styles.navRowText}>{o.label}</span>
                            {on && <Check />}
                        </button>
                    );
                })}
            </div>
        </>
    );

    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.div
                        className={styles.navScrim}
                        onClick={onClose}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25 }}
                    />
                    <motion.aside
                        className={styles.navPanel}
                        initial={{ x: '-100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '-100%' }}
                        transition={{ type: 'spring', damping: 32, stiffness: 320, mass: 0.7 }}
                        drag="x"
                        dragConstraints={{ left: 0, right: 0 }}
                        dragElastic={{ left: 0.6, right: 0 }}
                        onDragEnd={(_, info) => { if (info.offset.x < -60 || info.velocity.x < -400) onClose(); }}
                    >
                        <div className={styles.navGrip} />

                        <div className={styles.navHead}>
                            <div className={styles.navBrandKicker}>Les recettes</div>
                            <div className={styles.navBrandWord}>Magiques</div>
                        </div>

                        {/* Case de recherche : se combine avec les filtres cochés. */}
                        <div className={styles.navSearch}>
                            <svg className={styles.navSearchIcon} viewBox="0 0 24 24" fill="none" aria-hidden>
                                <path d={ICONS.search} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <input
                                className={styles.navSearchInput}
                                value={query}
                                onChange={(e) => onQuery(e.target.value)}
                                placeholder="Rechercher une recette"
                                type="search"
                                enterKeyHint="search"
                                autoComplete="off"
                                autoCorrect="off"
                                spellCheck={false}
                            />
                            {query && (
                                <button className={styles.navSearchClear} onClick={() => onQuery('')} aria-label="Effacer">
                                    <svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                                </button>
                            )}
                        </div>

                        <nav className={styles.navScroll}>
                            <div className={styles.navGroup}>
                                <button className={styles.navRow} onClick={onClose}>
                                    <Ic d={ICONS.home} /><span className={styles.navRowText}>Accueil</span>
                                </button>
                                {/* Planificateur : deux entrées, comme sur le site. */}
                                <button
                                    className={`${styles.navRow} ${authed ? '' : styles.navRowLocked}`}
                                    onClick={() => goAuthed('/tv-planner')}
                                >
                                    <Ic d={ICONS.planner} /><span className={styles.navRowText}>Planificateur · Semaine</span>
                                </button>
                                <button
                                    className={`${styles.navRow} ${authed ? '' : styles.navRowLocked}`}
                                    onClick={() => goAuthed('/tv-planner?mode=jourj')}
                                >
                                    <Ic d={ICONS.day} /><span className={styles.navRowText}>Planificateur · Jour J</span>
                                </button>
                                <button
                                    className={`${styles.navRow} ${authed ? '' : styles.navRowLocked}`}
                                    onClick={() => goAuthed('/tv-courses')}
                                >
                                    <Ic d={ICONS.cart} /><span className={styles.navRowText}>Liste de courses</span>
                                </button>
                                <button
                                    className={`${styles.navRow} ${authed ? '' : styles.navRowLocked}`}
                                    onClick={() => goAuthed('/favorites')}
                                >
                                    <Ic d={ICONS.heart} /><span className={styles.navRowText}>Favoris</span>
                                </button>
                                {/* La loupe TV (recette / ingrédients / assistant IA),
                                    surtout pas la page /search du site. */}
                                <button className={styles.navRow} onClick={() => { onClose(); onSearch(); }}>
                                    <Ic d={ICONS.search} /><span className={styles.navRowText}>Rechercher</span>
                                </button>
                                {/* Visite guidée DE L'APP MOBILE : celle du site desktop
                                    (components/Tutorial) décrivait des écrans qui
                                    n'existent plus ici. */}
                                <button className={styles.navRow} onClick={() => { onClose(); onTutorial(); }}>
                                    <Ic d={ICONS.book} /><span className={styles.navRowText}>Visite guidée</span>
                                </button>
                            </div>

                            <Group title="Catégories" options={CATEGORY_OPTIONS} />
                            <Group title="Tendances" options={TREND_OPTIONS} />
                            <Group title="Pays" options={COUNTRY_OPTIONS} />
                        </nav>

                        {/* Barre d'action : n'apparaît qu'une fois un filtre coché. */}
                        <AnimatePresence>
                            {active && (
                                <motion.div
                                    className={styles.navFooter}
                                    initial={{ y: 80, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    exit={{ y: 80, opacity: 0 }}
                                    transition={{ type: 'spring', damping: 30, stiffness: 340 }}
                                >
                                    <button className={styles.navClear} onClick={onClear}>Effacer</button>
                                    <button
                                        className={styles.navApply}
                                        onClick={() => { haptic(10); onApply(); }}
                                        disabled={resultCount === 0}
                                    >
                                        {resultCount === 0
                                            ? 'Aucune recette'
                                            : `Voir ${resultCount} recette${resultCount > 1 ? 's' : ''}`}
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.aside>
                </>
            )}
        </AnimatePresence>
    );
}
