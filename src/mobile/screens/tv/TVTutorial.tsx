'use client';

/**
 * Visite guidée « Apple TV+ » (mobile ET desktop — le desktop rend le même
 * composant en modale). Un écran = une idée, balayé horizontalement.
 *
 * Chaque étape porte désormais une VRAIE petite scène illustrée (SVG) qui
 * dépeint l'écran décrit — héros, rangées, appui long, fiche, filtres,
 * recherche, planificateur, liste… — au lieu d'une simple icône de trait.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { haptic } from './TVHome';
import styles from './TVTutorial.module.css';

type Art =
    | 'hero' | 'rows' | 'press' | 'card' | 'filter' | 'search'
    | 'planner' | 'side' | 'compose' | 'jourj' | 'fill' | 'views' | 'dock' | 'cocktail'
    | 'cave' | 'ext';

interface Step {
    kicker: string;
    title: string;
    text: string;
    hint: string;
    tint: string;
    accent: string;
    art: Art;
}

const STEPS: Step[] = [
    { kicker: 'Accueil', title: 'Le grand visuel', art: 'hero', accent: '#FF453A',
      text: "L'accueil s'ouvre sur les six dernières recettes, en grand. Balaye la photo (ou les flèches sur ordinateur) pour passer à la suivante ; « Voir la recette » ouvre la fiche.",
      hint: 'Balaye la grande photo, puis touche « Voir la recette ».',
      tint: 'radial-gradient(60% 100% at 50% 0%, rgba(255,69,58,0.55), transparent 70%)' },
    { kicker: 'Accueil', title: 'Les rangées', art: 'rows', accent: '#FF9F0A',
      text: 'Sous le visuel : Top 10, Reprendre la cuisine, Nouveautés, les catégories et une rangée par thème — Pâtes, Express, Cocktails, Airfryer… Chaque rangée se balaye.',
      hint: 'Touche le titre d’une rangée (le chevron ›) : elle s’ouvre en grille entière.',
      tint: 'radial-gradient(60% 100% at 50% 0%, rgba(255,159,10,0.5), transparent 70%)' },
    { kicker: 'Accueil', title: 'L’appui long', art: 'press', accent: '#FFD60A',
      text: 'Garde le doigt une seconde sur une carte : un menu s’ouvre — Favoris, À faire plus tard, Accéder à la catégorie, Partager, Voir la recette.',
      hint: 'Appui long sur n’importe quelle carte — clic droit sur ordinateur.',
      tint: 'radial-gradient(60% 100% at 50% 0%, rgba(255,214,10,0.45), transparent 70%)' },
    { kicker: 'Recette', title: 'La fiche', art: 'card', accent: '#30D158',
      text: 'Ingrédients (nombre de personnes ajustable), étapes, minuteur, ta note au dixième, l’accord vin et l’ajout à la liste. Coche un ingrédient : il file dans « Par recette ».',
      hint: 'Fiche ouverte : balaye vers la gauche pour la recette voisine ; « Lancer la préparation » lit les étapes à voix haute.',
      tint: 'radial-gradient(60% 100% at 50% 0%, rgba(48,209,88,0.45), transparent 70%)' },
    { kicker: 'Menu', title: 'Filtrer', art: 'filter', accent: '#0A84FF',
      text: 'Catégories, Tendances et Pays, cochables et repliables. Les filtres se combinent : OU dans un groupe, ET entre groupes — « un dessert espagnol express ».',
      hint: 'Coche Desserts + Espagne, puis touche « Voir N recettes ».',
      tint: 'radial-gradient(60% 100% at 50% 0%, rgba(10,132,255,0.5), transparent 70%)' },
    { kicker: 'Recherche', title: 'Trois façons', art: 'search', accent: '#5E5CE6',
      text: 'La loupe ouvre Recette (son nom), Ingrédients (ce qu’il te reste au frigo) et Assistant IA, qui comprend une demande en langage courant — à la voix aussi.',
      hint: 'Appui long sur la loupe : la dictée vocale démarre direct sur l’Assistant.',
      tint: 'radial-gradient(60% 100% at 50% 0%, rgba(94,92,230,0.55), transparent 70%)' },
    { kicker: 'Planificateur', title: 'Ma semaine', art: 'planner', accent: '#BF5AF2',
      text: 'Un jour par écran, ouvert sur aujourd’hui : Midi et Soir. « Choisir un plat » ouvre le sélecteur, « Surprends-moi » en tire un au hasard.',
      hint: 'Balaye pour changer de jour, ou touche Lun… Dim en haut.',
      tint: 'radial-gradient(60% 100% at 50% 0%, rgba(191,90,242,0.5), transparent 70%)' },
    { kicker: 'Planificateur', title: 'L’accompagnement', art: 'side', accent: '#FF2D55',
      text: 'Un plat servi nu — viande ou poisson sans féculent ni légume — ouvre une ligne « Accompagnement » sous lui. Un couscous, déjà complet, n’en demande pas.',
      hint: 'Mets une viande à midi : la ligne Accompagnement apparaît juste dessous.',
      tint: 'radial-gradient(60% 100% at 50% 0%, rgba(255,45,85,0.45), transparent 70%)' },
    { kicker: 'Planificateur', title: 'Composer', art: 'compose', accent: '#64D2FF',
      text: '« Composer » remplit toute la semaine sur une tendance — Italie, Healthy, Barbecue… — sans répéter un plat ni sortir du thème.',
      hint: 'Touche Composer, choisis une tendance, regarde les 14 repas se remplir.',
      tint: 'radial-gradient(60% 100% at 50% 0%, rgba(100,210,255,0.45), transparent 70%)' },
    { kicker: 'Planificateur', title: 'Le Jour J', art: 'jourj', accent: '#FF9F0A',
      text: 'Un onglet à part pour un repas complet : apéritif, entrée, plat, accompagnement, dessert et pâtisserie. Idéal pour un dîner d’invités.',
      hint: 'En haut, bascule « Semaine » → « Jour J ».',
      tint: 'radial-gradient(60% 100% at 50% 0%, rgba(255,159,10,0.45), transparent 70%)' },
    { kicker: 'Courses', title: 'Remplir la liste', art: 'fill', accent: '#30D158',
      text: '« Remplir ma liste de courses » envoie tous les ingrédients du menu dans la liste, regroupés par rayon et sans doublon.',
      hint: 'Menu prêt : touche le bouton blanc en bas du planificateur.',
      tint: 'radial-gradient(60% 100% at 50% 0%, rgba(48,209,88,0.45), transparent 70%)' },
    { kicker: 'Courses', title: 'Trois vues', art: 'views', accent: '#0A84FF',
      text: '« La semaine » fusionne tout par rayon (avec les toggles Semaine / Jour J), « Jour par jour » sépare les repas, « Par recette » garde les plats cochés en fiche.',
      hint: 'Coche des articles : les boutons Partager et Magasin apparaissent.',
      tint: 'radial-gradient(60% 100% at 50% 0%, rgba(10,132,255,0.45), transparent 70%)' },
    { kicker: 'Courses', title: 'L’extension Chrome', art: 'ext', accent: '#8B5CF6',
      text: 'Sur ordinateur, l’extension « Courses Magiques » pose ta liste par-dessus le site du magasin — Carrefour, Monoprix, Picard, Leclerc Drive — et passe au produit suivant toute seule. Plus besoin de changer d’onglet.',
      hint: 'Liste de courses : la bulle violette donne le .zip et les cinq étapes d’installation.',
      tint: 'radial-gradient(60% 100% at 50% 0%, rgba(139,92,246,0.5), transparent 70%)' },
    { kicker: 'Ma cave', title: 'Tes bouteilles', art: 'cave', accent: '#B23A48',
      text: 'Photographie l’étiquette : le nom, le cépage, l’année, la région et la vraie photo de la bouteille entrent seuls en cave. Rouges, blancs, rosés et liqueurs, la quantité, ta note et l’apogée — « prêt à boire », « encore un peu jeune ».',
      hint: 'Sur un vin, « Quelle recette ? » sort les plats du site qui vont avec.',
      tint: 'radial-gradient(60% 100% at 50% 0%, rgba(178,58,72,0.5), transparent 70%)' },
    { kicker: 'Apéritif', title: 'Les cocktails', art: 'cocktail', accent: '#FF6B4A',
      text: 'Deux nouvelles rangées : Cocktails et Cocktails sans alcool. Le tri se fait tout seul en lisant les ingrédients — un Mojito part avec l’alcool, sa version virgin sans.',
      hint: 'Cherche « cocktail » ou ouvre la rangée depuis l’accueil.',
      tint: 'radial-gradient(60% 100% at 50% 0%, rgba(255,107,74,0.5), transparent 70%)' },
    { kicker: 'Partout', title: 'La barre du bas', art: 'dock', accent: '#8E8E93',
      text: 'Favoris, Liste, Accueil et Menu, plus la loupe. Elle te suit partout et se réduit quand tu fais défiler. Ajoute le site à ton écran d’accueil : il s’ouvre en plein écran, comme une app.',
      hint: 'Partage → « Sur l’écran d’accueil » pour l’installer comme une app.',
      tint: 'radial-gradient(60% 100% at 50% 0%, rgba(142,142,147,0.45), transparent 70%)' },
];

/** Mini-scène illustrée d'une étape. Cadre commun + contenu spécifique. */
function Illus({ kind, accent }: { kind: Art; accent: string }) {
    const c = accent;
    const soft = 'rgba(255,255,255,0.10)';
    const soft2 = 'rgba(255,255,255,0.18)';
    const frame = (children: React.ReactNode) => (
        <svg className={styles.art} viewBox="0 0 220 150" fill="none" aria-hidden>
            <defs>
                <linearGradient id={`g-${kind}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor={c} stopOpacity="0.9" />
                    <stop offset="1" stopColor={c} stopOpacity="0.4" />
                </linearGradient>
            </defs>
            {children}
        </svg>
    );
    const r = (x: number, y: number, w: number, h: number, rad = 6, fill = soft, stroke?: string) => (
        <rect x={x} y={y} width={w} height={h} rx={rad} fill={fill} stroke={stroke} strokeWidth={stroke ? 1 : 0} />
    );

    switch (kind) {
        case 'hero': return frame(<>
            {r(30, 12, 160, 96, 14, `url(#g-${kind})`)}
            {r(46, 84, 60, 12, 6, 'rgba(0,0,0,0.35)')}
            <path d="M150 84h26a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4h-26z" fill="#fff" />
            <path d="M18 60l-8 0M10 60l4-4M10 60l4 4" stroke={soft2} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M202 60l8 0M210 60l-4-4M210 60l-4 4" stroke={soft2} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            {r(78, 118, 64, 10, 5)}
        </>);
        case 'rows': return frame(<>
            {r(16, 14, 90, 10, 5, soft2)}
            {[30, 68, 106].map((y, k) => (
                <g key={k}>
                    {[16, 58, 100, 142, 184].map((x) => r(x, y, 34, 26, 6, k === 1 ? `url(#g-${kind})` : soft))}
                </g>
            ))}
        </>);
        case 'press': return frame(<>
            {r(28, 22, 96, 106, 12, `url(#g-${kind})`)}
            <circle cx="76" cy="86" r="10" fill="#fff" />
            <circle cx="76" cy="86" r="20" stroke="#fff" strokeOpacity="0.6" strokeWidth="2" />
            <circle cx="76" cy="86" r="30" stroke="#fff" strokeOpacity="0.3" strokeWidth="2" />
            {r(132, 30, 74, 88, 12, 'rgba(30,30,34,0.95)', soft2)}
            {[42, 60, 78, 96].map((y) => r(142, y, 54, 8, 4, soft2))}
        </>);
        case 'card': return frame(<>
            {r(44, 10, 132, 44, 12, `url(#g-${kind})`)}
            {r(44, 62, 132, 78, 12, soft)}
            {[72, 92, 112].map((y) => (<g key={y}><circle cx="58" cy={y} r="5" stroke={c} strokeWidth="2" />{r(72, y - 4, 74, 8, 4, soft2)}</g>))}
            {r(150, 66, 22, 12, 6, c)}
        </>);
        case 'filter': return frame(<>
            {r(14, 12, 74, 126, 12, soft)}
            {r(24, 24, 40, 8, 4, soft2)}
            {[40, 56, 72, 88, 104].map((y, k) => (<g key={y}>{r(24, y, 54, 10, 5, k < 2 ? c : soft2)}{k < 2 && <path d="M70 72" />}</g>))}
            {r(100, 12, 106, 126, 12, soft)}
            {[24, 60, 96].map((y) => (<g key={y}>{r(110, y, 40, 28, 6, `url(#g-${kind})`)}{r(156, y, 40, 28, 6, soft2)}</g>))}
        </>);
        case 'search': return frame(<>
            {r(24, 16, 172, 22, 11, soft)}
            <circle cx="40" cy="27" r="6" stroke={c} strokeWidth="2.4" /><path d="M45 32l5 5" stroke={c} strokeWidth="2.4" strokeLinecap="round" />
            {r(24, 48, 172, 22, 8, soft)}
            {r(28, 51, 55, 16, 6, '#fff')}
            <text x="55" y="63" textAnchor="middle" fontSize="9" fontWeight="700" fill="#111">Recette</text>
            <text x="118" y="63" textAnchor="middle" fontSize="9" fill="#bbb">Frigo</text>
            <text x="170" y="63" textAnchor="middle" fontSize="9" fill="#bbb">Assistant</text>
            {[82, 102, 122].map((y) => r(24, y, 172, 12, 6, soft2))}
        </>);
        case 'planner': return frame(<>
            {r(20, 12, 180, 16, 8, soft)}
            {[26, 52, 78, 104, 130, 156, 182].map((x, k) => <circle key={x} cx={x} cy={20} r="7" fill={k === 2 ? c : soft2} />)}
            {r(20, 40, 180, 44, 10, `url(#g-${kind})`)}<text x="30" y="52" fontSize="8" fill="#fff" fillOpacity="0.85">MIDI</text>
            {r(20, 92, 180, 44, 10, soft)}<text x="30" y="104" fontSize="8" fill="#fff" fillOpacity="0.6">SOIR</text>
        </>);
        case 'side': return frame(<>
            {r(40, 14, 140, 56, 12, `url(#g-${kind})`)}
            <text x="52" y="46" fontSize="10" fill="#fff" fillOpacity="0.9">Plat servi nu</text>
            {r(60, 82, 120, 46, 12, soft, soft2)}
            <path d="M110 70v10" stroke={soft2} strokeWidth="2" />
            <text x="74" y="109" fontSize="9" fill={c}>+ Accompagnement</text>
        </>);
        case 'compose': return frame(<>
            {[16, 58, 100, 142, 184].map((x) => [22, 60, 98].map((y, k) => r(x, y, 34, 30, 6, (x + y) % 3 === 0 ? `url(#g-${kind})` : soft)))}
            <path d="M170 20l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#fff" />
        </>);
        case 'jourj': return frame(<>
            {r(20, 12, 180, 16, 8, soft)}{r(112, 14, 84, 12, 6, '#fff')}
            <text x="66" y="23" fontSize="8" fill="#bbb" textAnchor="middle">Semaine</text>
            <text x="154" y="23" fontSize="8" fill="#111" textAnchor="middle" fontWeight="700">Jour J</text>
            {['Apéritif', 'Entrée', 'Plat', 'Dessert'].map((t, k) => (<g key={t}>{r(20, 38 + k * 26, 180, 20, 6, k === 2 ? `url(#g-${kind})` : soft)}<text x="30" y={52 + k * 26} fontSize="8" fill="#fff" fillOpacity="0.8">{t}</text></g>))}
        </>);
        case 'fill': return frame(<>
            {r(14, 24, 74, 100, 10, soft)}{[36, 54, 72, 90].map((y) => r(24, y, 54, 8, 4, soft2))}
            <path d="M96 74h28M124 74l-6-5M124 74l-6 5" stroke={c} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            {r(132, 24, 74, 100, 10, `url(#g-${kind})`)}{[36, 54, 72, 90].map((y) => (<g key={y}><circle cx="144" cy={y + 4} r="4" stroke="#fff" strokeWidth="1.6" />{r(154, y, 44, 8, 4, 'rgba(0,0,0,0.25)')}</g>))}
        </>);
        case 'views': return frame(<>
            {r(20, 14, 180, 20, 9, soft)}
            {r(24, 17, 54, 14, 6, '#fff')}<text x="51" y="27" fontSize="8" fontWeight="700" fill="#111" textAnchor="middle">Semaine</text>
            <text x="112" y="27" fontSize="8" fill="#bbb" textAnchor="middle">Jour/jour</text>
            <text x="172" y="27" fontSize="8" fill="#bbb" textAnchor="middle">Recette</text>
            {r(20, 42, 90, 8, 4, c)}
            {[56, 74, 92, 110].map((y) => (<g key={y}><circle cx="30" cy={y + 4} r="4" stroke="#fff" strokeWidth="1.6" />{r(40, y, 160, 8, 4, soft2)}</g>))}
        </>);
        case 'cocktail': return frame(<>
            <path d="M70 44h80l-34 40v26h-12V84z" fill={`url(#g-${kind})`} stroke={soft2} strokeWidth="1.5" />
            {r(96, 118, 28, 8, 4, soft2)}
            <circle cx="150" cy="40" r="7" fill="#FFD24B" />
            <path d="M150 33v-8M150 25l-3 3M150 25l3 3" stroke="#FFD24B" strokeWidth="2" strokeLinecap="round" />
            <path d="M60 60l-8-4M62 74h-9" stroke={soft2} strokeWidth="2" strokeLinecap="round" />
        </>);
        case 'dock': return frame(<>
            {r(30, 92, 160, 34, 17, 'rgba(30,30,34,0.95)', soft2)}
            {[54, 88, 122, 156].map((x, k) => <circle key={x} cx={x} cy={109} r="8" fill={k === 2 ? soft2 : soft} />)}
            <circle cx="176" cy="109" r="12" fill={c} />
            <circle cx="176" cy="106" r="4" stroke="#fff" strokeWidth="2" /><path d="M179 109l3 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
            {r(60, 26, 100, 52, 10, `url(#g-${kind})`)}
        </>);
        case 'ext': return frame(<>
            {/* Fenêtre du magasin + panneau de la liste posé par-dessus. */}
            {r(14, 18, 192, 110, 10, 'rgba(255,255,255,0.06)', soft2)}
            {r(14, 18, 192, 16, 10, soft)}
            {[24, 34, 44].map((x) => <circle key={x} cx={x} cy={26} r="3" fill={soft2} />)}
            {r(26, 46, 74, 44, 8, soft)}
            {r(26, 98, 52, 8, 4, soft)}
            {r(122, 44, 70, 74, 10, `url(#g-${kind})`)}
            {[56, 72, 88, 104].map((y) => (
                <g key={y}>
                    <path d={`M132 ${y}l4 4 7-8`} stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    {r(148, y - 4, 34, 6, 3, 'rgba(255,255,255,0.55)')}
                </g>
            ))}
        </>);
        case 'cave': return frame(<>
            {/* Étagère de cave : trois bouteilles, celle du milieu mise en avant. */}
            {r(24, 116, 172, 8, 4, soft2)}
            {[54, 166].map((x) => (
                <g key={x}>
                    <path d={`M${x - 6} 116V70c0-6 2-8 2-14V44h8v12c0 6 2 8 2 14v46z`} fill={soft} />
                    {r(x - 6, 86, 12, 12, 2, soft2)}
                </g>
            ))}
            <path d="M104 116V64c0-7 3-9 3-16V32h6v16c0 7 3 9 3 16v52z" fill={`url(#g-${kind})`} />
            {r(104, 78, 12, 16, 2, 'rgba(255,255,255,0.75)')}
            {/* Verre servi, à droite. */}
            <path d="M176 24h20l-3 14a7 7 0 0 1-14 0z" fill={c} opacity="0.85" />
            <path d="M186 38v10M180 48h12" stroke={soft2} strokeWidth="2" strokeLinecap="round" />
        </>);
        default: return frame(null);
    }
}

/**
 * `embedded` : rendu DANS le shell desktop TV+ (panneau, menu à gauche) au lieu
 * du calque plein écran — même moule que Favoris et la Recherche.
 */
export default function TVTutorial({ onClose, embedded = false }: { onClose: () => void; embedded?: boolean }) {
    const [i, setI] = useState(0);
    const [mounted, setMounted] = useState(false);
    const pagerRef = useRef<HTMLDivElement>(null);

    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        // En panneau, la page derrière n'est pas recouverte : on ne fige rien.
        if (embedded) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, [embedded]);

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
        setI(n);
        el.scrollTo({ left, behavior: 'smooth' });
        window.setTimeout(() => { if (el.scrollLeft === before) el.scrollLeft = left; }, 260);
    };

    const next = () => {
        haptic(8);
        if (i >= STEPS.length - 1) onClose();
        else goTo(i + 1);
    };

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

    const body = (
        <>
            <div className={styles.glow} style={{ background: step.tint }} />

            {embedded && (
                <div className={styles.panelHead}>
                    <h1 className={styles.panelTitle}>Tutoriel</h1>
                    <p className={styles.panelSub}>La visite guidée du site, écran par écran.</p>
                </div>
            )}

            <header className={styles.head}>
                <div className={styles.bar}>
                    <div className={styles.barFill} style={{ width: `${((i + 1) / STEPS.length) * 100}%` }} />
                </div>
                {!embedded && <button className={styles.skip} onClick={onClose}>Passer</button>}
            </header>

            <div className={styles.pager} ref={pagerRef} onScroll={onScroll}>
                {STEPS.map((s, n) => (
                    <section className={styles.slide} key={s.title}>
                        <div className={styles.artStage} style={{ ['--tuto-accent' as any]: s.accent }}>
                            <Illus kind={s.art} accent={s.accent} />
                        </div>
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
        </>
    );

    if (embedded) return <div className={`${styles.root} ${styles.embedded}`}>{body}</div>;

    return createPortal(
        <div className={styles.root} role="dialog" aria-modal="true" aria-label="Visite guidée">
            {body}
        </div>,
        document.body
    );
}
