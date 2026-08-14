'use client';

/**
 * Visite guidée de l'app mobile « Apple TV+ ».
 *
 * SUR LE FOND — l'ancienne visite (src/components/Tutorial) décrivait le site
 * d'avant : grille 7 × 2 du planificateur, icône calendrier du header, bulle
 * d'extension Chrome, « Menu IA ». Plus rien de tout ça n'existe sur mobile
 * depuis l'accueil TV. Les étapes ci-dessous décrivent les écrans RÉELS :
 * héros, rangées, appui long, fiche, volet de filtres, recherche, /tv-planner
 * et /tv-courses.
 *
 * SUR LA FORME — deux tuiles côte à côte avec une démo jouable miniature n'ont
 * pas de sens sur un téléphone. Un écran = une idée, balayé horizontalement
 * comme le héros et le planificateur, en scroll natif + snap.
 *
 * La visite ne simule rien : elle nomme le geste, l'utilisateur le fait ensuite
 * sur le vrai écran. Rien à maquetter, donc rien qui puisse mentir.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { haptic } from './TVHome';
import styles from './TVTutorial.module.css';

interface Step {
    /** Petit titre de rubrique, au-dessus du titre. */
    kicker: string;
    title: string;
    text: string;
    /** Le geste exact, sur l'écran réel. */
    hint: string;
    /** Teinte du halo derrière le titre. */
    tint: string;
    /** Tracé SVG (trait fin, esprit SF Symbols). */
    icon: string;
}

const I = {
    home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
    rows: 'M3 5h7v14H3zM14 5h7v6h-7zM14 13h7v6h-7z',
    // Doigt posé : un point, et deux ondes autour — l'appui maintenu.
    press: 'M12 9.6a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8M7.8 7.8a6 6 0 0 0 0 8.4M16.2 16.2a6 6 0 0 0 0-8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 19.1a10 10 0 0 0 0-14.2',
    card: 'M4 4h16v16H4zM4 9h16M8 13h8M8 16.5h5',
    filter: 'M3 5h18M6 12h12M10 19h4',
    search: 'M21 21l-4.3-4.3M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0z',
    planner: 'M7 3v3m10-3v3M3.5 9h17M5 5h14a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 19 21H5a1.5 1.5 0 0 1-1.5-1.5v-13A1.5 1.5 0 0 1 5 5z',
    wand: 'M4 20 15 9m0 0 3-3-2-2-3 3m2 2-2-2M7 4l.7 2L10 6.7 7.7 7.4 7 9.7 6.3 7.4 4 6.7 6.3 6zM18 14l.5 1.5L20 16l-1.5.5L18 18l-.5-1.5L16 16l1.5-.5z',
    day: 'M12 7v5l3 1.8M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
    cart: 'M3 4h2l2.2 10.5a1.5 1.5 0 0 0 1.5 1.2h7.9a1.5 1.5 0 0 0 1.5-1.2L20 7H6M9 20h.01M17 20h.01',
    store: 'M4 9h16v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM4 9l1.4-4.3A1 1 0 0 1 6.3 4h11.4a1 1 0 0 1 .95.7L20 9M9 21v-6h6v6',
    dock: 'M4 15h16a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-1a2 2 0 0 1 2-2zM7 18h.01M12 18h.01M17 18h.01',
};

const STEPS: Step[] = [
    {
        kicker: 'Accueil',
        title: 'Le grand visuel',
        text: "L'accueil s'ouvre sur les six dernières recettes publiées, en plein écran. Balaye le visuel horizontalement pour passer à la suivante ; « Explorer » ouvre la fiche.",
        hint: 'Balaye la grande photo, puis touche « Explorer ».',
        tint: 'radial-gradient(60% 100% at 50% 0%, rgba(255,69,58,0.55), transparent 70%)',
        icon: I.home,
    },
    {
        kicker: 'Accueil',
        title: 'Les rangées',
        text: 'Sous le visuel : Top 10, Reprendre la cuisine, Nouveautés, puis les catégories et une rangée par thème — Pâtes, Express, La Dolce Vita, Airfryer… Chaque rangée se balaye du doigt.',
        hint: 'Touche le titre d’une rangée (le chevron ›) : elle s’ouvre en grille entière.',
        tint: 'radial-gradient(60% 100% at 50% 0%, rgba(255,159,10,0.5), transparent 70%)',
        icon: I.rows,
    },
    {
        kicker: 'Accueil',
        title: 'L’appui long',
        text: 'Garde le doigt une seconde sur une carte : un menu s’ouvre avec « Ajouter aux favoris », « À faire plus tard » et « Voir la recette ». « À faire plus tard » crée sa propre rangée sur l’accueil.',
        hint: 'Appui long sur n’importe quelle carte, sans la relâcher tout de suite.',
        tint: 'radial-gradient(60% 100% at 50% 0%, rgba(255,214,10,0.45), transparent 70%)',
        icon: I.press,
    },
    {
        kicker: 'Recette',
        title: 'La fiche',
        text: 'Ingrédients avec le nombre de personnes ajustable, étapes, minuteur, ta note, l’accord vin et l’ajout à la liste de courses. La fiche est la même partout dans l’app.',
        hint: 'Fiche ouverte : balaye vers la gauche pour passer à la recette voisine de la rangée.',
        tint: 'radial-gradient(60% 100% at 50% 0%, rgba(48,209,88,0.45), transparent 70%)',
        icon: I.card,
    },
    {
        kicker: 'Menu',
        title: 'Filtrer',
        text: 'Le volet de gauche liste toutes les catégories, tendances et pays, cochables. Les filtres se combinent : OU à l’intérieur d’un groupe, ET entre groupes — « un dessert espagnol express ».',
        hint: 'Coche Desserts + Espagne, puis touche « Voir N recettes » en bas du volet.',
        tint: 'radial-gradient(60% 100% at 50% 0%, rgba(10,132,255,0.5), transparent 70%)',
        icon: I.filter,
    },
    {
        kicker: 'Recherche',
        title: 'Trois façons',
        text: 'La loupe ouvre trois onglets : Recette (son nom), Ingrédients (ce qu’il te reste au frigo) et Assistant, qui comprend une demande en langage courant — à la voix aussi.',
        hint: 'Onglet Assistant, puis dis ou tape « une sauce pour une viande rouge ».',
        tint: 'radial-gradient(60% 100% at 50% 0%, rgba(94,92,230,0.55), transparent 70%)',
        icon: I.search,
    },
    {
        kicker: 'Planificateur',
        title: 'Ma semaine',
        text: 'Un jour par écran, ouvert sur aujourd’hui : Midi et Soir, uniquement des plats. « Choisir un plat » ouvre le sélecteur, « Surprends-moi » en tire un au hasard.',
        hint: 'Balaye horizontalement pour changer de jour, ou touche Lun… Dim en haut.',
        tint: 'radial-gradient(60% 100% at 50% 0%, rgba(191,90,242,0.5), transparent 70%)',
        icon: I.planner,
    },
    {
        kicker: 'Planificateur',
        title: 'L’accompagnement',
        text: 'Un plat servi nu — une viande ou un poisson sans féculent ni légume — ouvre une ligne « Accompagnement » sous lui. Un couscous, qui a déjà sa semoule et ses légumes, n’en demande pas.',
        hint: 'Mets une viande à midi : la ligne Accompagnement apparaît juste dessous.',
        tint: 'radial-gradient(60% 100% at 50% 0%, rgba(255,45,85,0.45), transparent 70%)',
        icon: I.wand,
    },
    {
        kicker: 'Planificateur',
        title: 'Composer',
        text: '« Composer » remplit toute la semaine sur une tendance choisie — Italie, Healthy, Barbecue… — sans jamais répéter un plat ni sortir du thème. « Effacer » vide la vue affichée.',
        hint: 'Touche Composer en bas, choisis une tendance, et regarde les 14 repas se remplir.',
        tint: 'radial-gradient(60% 100% at 50% 0%, rgba(100,210,255,0.45), transparent 70%)',
        icon: I.wand,
    },
    {
        kicker: 'Planificateur',
        title: 'Le Jour J',
        text: 'Un onglet à part pour un seul repas complet : apéritif, entrée, plat, accompagnement, dessert et pâtisserie. Idéal pour un dîner d’invités, sans toucher à la semaine.',
        hint: 'En haut de l’écran, bascule « Semaine » → « Jour J ».',
        tint: 'radial-gradient(60% 100% at 50% 0%, rgba(255,159,10,0.45), transparent 70%)',
        icon: I.day,
    },
    {
        kicker: 'Courses',
        title: 'Remplir la liste',
        text: '« Remplir ma liste de courses », en bas du planificateur, envoie tous les ingrédients du menu dans la liste, regroupés par rayon et sans doublon. « Ajouter » y met un article à la main.',
        hint: 'Une fois le menu prêt, touche le bouton blanc en bas du planificateur.',
        tint: 'radial-gradient(60% 100% at 50% 0%, rgba(48,209,88,0.45), transparent 70%)',
        icon: I.cart,
    },
    {
        kicker: 'Courses',
        title: 'Trois vues',
        text: '« La semaine » fusionne tout par rayon, « Jour par jour » sépare les repas, « Par recette » garde chaque plat de son côté. Cocher un article = à acheter ; toucher son texte le barre : tu l’as déjà.',
        hint: 'Coche deux ou trois articles : les boutons Partager et Magasin apparaissent.',
        tint: 'radial-gradient(60% 100% at 50% 0%, rgba(10,132,255,0.45), transparent 70%)',
        icon: I.store,
    },
    {
        kicker: 'Partout',
        title: 'La barre du bas',
        text: 'Favoris, Liste de courses, Accueil et Menu (le planificateur), plus la loupe à droite. Elle te suit sur tous les écrans et se réduit dès que tu fais défiler la page.',
        hint: 'Ajoute le site à ton écran d’accueil : il s’ouvre alors en plein écran, comme une app.',
        tint: 'radial-gradient(60% 100% at 50% 0%, rgba(142,142,147,0.45), transparent 70%)',
        icon: I.dock,
    },
];

export default function TVTutorial({ onClose }: { onClose: () => void }) {
    const [i, setI] = useState(0);
    const [mounted, setMounted] = useState(false);
    const pagerRef = useRef<HTMLDivElement>(null);

    useEffect(() => { setMounted(true); }, []);

    // Visite ouverte = page figée derrière (comportement d'une modale iOS).
    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, []);

    /** L'index vient du scroll : le geste reste natif, on ne fait que l'observer. */
    const onScroll = useCallback(() => {
        const el = pagerRef.current;
        if (!el) return;
        const next = Math.round(el.scrollLeft / el.clientWidth);
        setI((v) => (v === next ? v : Math.min(STEPS.length - 1, Math.max(0, next))));
    }, []);

    const goTo = (n: number) => {
        const el = pagerRef.current;
        if (!el) return;
        const left = n * el.clientWidth;
        const before = el.scrollLeft;
        setI(n); // points et barre de progression : jamais en retard sur le geste
        el.scrollTo({ left, behavior: 'smooth' });
        // Repli : « Réduire les animations » (iOS) fait ignorer le défilement
        // fluide — sans ça, le bouton « Suivant » ne bougeait plus rien.
        window.setTimeout(() => { if (el.scrollLeft === before) el.scrollLeft = left; }, 260);
    };

    const next = () => {
        haptic(8);
        if (i >= STEPS.length - 1) onClose();
        else goTo(i + 1);
    };

    // Clavier : pratique en test sur ordinateur, sans effet sur téléphone.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight' && i < STEPS.length - 1) goTo(i + 1);
            if (e.key === 'ArrowLeft' && i > 0) goTo(i - 1);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [i, onClose]);

    if (!mounted) return null;

    const step = STEPS[i];

    return createPortal(
        <div className={styles.root} role="dialog" aria-modal="true" aria-label="Visite guidée">
            <div className={styles.glow} style={{ background: step.tint }} />

            <header className={styles.head}>
                <div className={styles.bar}>
                    <div className={styles.barFill} style={{ width: `${((i + 1) / STEPS.length) * 100}%` }} />
                </div>
                <button className={styles.skip} onClick={onClose}>Passer</button>
            </header>

            <div className={styles.pager} ref={pagerRef} onScroll={onScroll}>
                {STEPS.map((s, n) => (
                    <section className={styles.slide} key={s.title}>
                        <svg className={styles.icon} viewBox="0 0 24 24" fill="none" aria-hidden>
                            <path d={s.icon} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <div className={styles.kicker}>{s.kicker} · {n + 1} / {STEPS.length}</div>
                        <h2 className={styles.title}>{s.title}</h2>
                        <p className={styles.text}>{s.text}</p>
                        <div className={styles.hint}>
                            <span className={styles.hintMark} aria-hidden>☞</span>
                            <span>{s.hint}</span>
                        </div>
                    </section>
                ))}
            </div>

            <footer className={styles.foot}>
                <div className={styles.dots}>
                    {STEPS.map((s, n) => (
                        <span key={s.title} className={`${styles.dot} ${n === i ? styles.dotOn : ''}`} />
                    ))}
                </div>
                <button className={styles.next} onClick={next}>
                    {i === STEPS.length - 1 ? 'Terminer' : 'Suivant'}
                </button>
            </footer>
        </div>,
        document.body
    );
}
