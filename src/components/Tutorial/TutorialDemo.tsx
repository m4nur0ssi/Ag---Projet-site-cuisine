'use client';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { mockRecipes } from '@/data/mockData';
import RecipeCardiOS26 from '@/components/RecipeCard/RecipeCardiOS26';
import WeekPlanner from '@/components/WeekPlanner/WeekPlanner';
import SpotlightSearch from '@/components/SpotlightSearch/SpotlightSearch';
import { ExtensionBubble } from '@/app/shopping-list/DesktopPage';
import { setPortalHost } from '@/components/Portal';
import { buildSideDemoPlan } from '@/lib/tutorialDemo';
import styles from './TutorialDemo.module.css';

/**
 * Tuile de démonstration : un morceau du site RÉEL, jouable, enfermé dans la tuile.
 *
 * Deux règles :
 *  - on monte les VRAIS composants (carte, recherche, planificateur), jamais des
 *    maquettes — la démo ne peut donc pas diverger du produit ;
 *  - tout ce qu'ils ouvrent reste DANS la tuile : la tuile est l'hôte de portail
 *    (fiche recette) et un bloc conteneur (les overlays `position: fixed` s'y calent).
 * Le planificateur y tourne en bac à sable (`demo`) : menus d'exemple, aucune écriture.
 */

export type DemoSpec =
    /** Vraie carte recette : le clic ouvre la fiche, ▶ lance la vidéo — dans la tuile. */
    | { kind: 'card' }
    /** Vraie recherche : on tape, les résultats tombent dans la tuile. */
    | { kind: 'search' }
    /** Vrai planificateur, recadré sur la commande expliquée. */
    | { kind: 'planner'; focus: string; plan?: 'empty' | 'sides' | 'week'; scale?: number }
    /** La vraie bulle « Courses Magiques » de la page Liste de courses. */
    | { kind: 'extension' }
    /** Copie agrandie d'un élément réel de la page (icônes du header). */
    | { kind: 'clone'; selector: string; zoom?: number };

const useIso = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/** Recette vitrine : une image appétissante ET une vidéo (l'étape ▶ en dépend). */
const SAMPLE = mockRecipes.find(r => r.id === '6922')
    || mockRecipes.find(r => r.videoHtml && r.image && r.category !== 'restaurant')
    || mockRecipes[0];

/** Semaine d'exemple pour les étapes qui ont besoin de créneaux déjà remplis. */
function weekDemoPlan(): Record<string, Record<string, any>> {
    const demo = buildSideDemoPlan();
    return demo ? { Lun: { Midi: demo.included, Soir: demo.paired } } : {};
}

/**
 * Halo qui désigne la commande expliquée à l'intérieur de la tuile. On suit la cible
 * image par image : le panneau bouge quand les menus se remplissent.
 */
function useRing(boxRef: React.RefObject<HTMLDivElement | null>, selector: string | undefined, deps: any[]) {
    const [ring, setRing] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
    useEffect(() => {
        if (!selector) { setRing(null); return; }
        let raf = 0;
        const tick = () => {
            const box = boxRef.current;
            const el = box?.querySelector(selector) as HTMLElement | null;
            if (box && el) {
                const b = box.getBoundingClientRect();
                const r = el.getBoundingClientRect();
                // Cible plus grande que la fenêtre → le halo ne veut plus rien dire.
                if (r.height > b.height || r.width > b.width) setRing(null);
                else setRing({ top: r.top - b.top - 5, left: r.left - b.left - 5, width: r.width + 10, height: r.height + 10 });
            } else setRing(null);
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);
    return ring;
}

export default function TutorialDemo({ spec }: { spec: DemoSpec }) {
    if (spec.kind === 'card') return <CardDemo />;
    if (spec.kind === 'search') return <SearchDemo />;
    if (spec.kind === 'extension') return <ExtensionDemo />;
    if (spec.kind === 'planner') return <PlannerDemo spec={spec} />;
    return <CloneDemo selector={spec.selector} zoom={spec.zoom} />;
}

/**
 * Carte recette réelle : cliquable, elle ouvre la vraie fiche — dans la tuile.
 * Pas de halo : le ▶ se voit déjà tout seul au centre de la photo.
 */
function CardDemo() {
    return (
        <div className={styles.cardBox}>
            <RecipeCardiOS26 recipe={SAMPLE as any} />
        </div>
    );
}

/**
 * Vraie recherche du site, ouverte en permanence dans la tuile : on tape, les résultats
 * s'affichent, on peut ouvrir une recette. `onClose` ne fait rien — la refermer laisserait
 * une tuile vide, alors que c'est justement ce que l'étape doit montrer.
 */
function SearchDemo() {
    return (
        <div className={styles.searchBox}>
            <SpotlightSearch isOpen onClose={() => {}} />
        </div>
    );
}

/**
 * Planificateur réel, recadré : plutôt que de faire tenir les 7 jours dans la tuile
 * (noms de plats illisibles), on garde sa taille normale et on le fait coulisser
 * derrière une fenêtre pour amener la commande expliquée au centre.
 */
function PlannerDemo({ spec }: { spec: Extract<DemoSpec, { kind: 'planner' }> }) {
    const boxRef = useRef<HTMLDivElement>(null);
    const innerRef = useRef<HTMLDivElement>(null);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    // Une journée entière (midi + soir + accompagnements) dépasse la hauteur de la tuile :
    // les étapes qui doivent la montrer en entier la réduisent un peu. Ailleurs, taille réelle.
    const scale = spec.scale ?? 1;
    const selector = `[data-tour="${spec.focus}"]`;
    // STABLE : une nouvelle référence à chaque rendu relancerait le chargement du bac à
    // sable, qui écraserait aussitôt ce que l'utilisateur vient de composer (Menu IA…).
    const plan = useMemo(() => (spec.plan === 'sides' || spec.plan === 'week' ? weekDemoPlan() : {}), [spec.plan]);

    useIso(() => {
        let raf = 0;
        const tick = () => {
            const box = boxRef.current, inner = innerRef.current;
            const el = inner?.querySelector(selector) as HTMLElement | null;
            if (box && inner && el) {
                const b = box.getBoundingClientRect();
                const ir = inner.getBoundingClientRect();
                // Position de la cible DANS le panneau : mesurée par rapport au panneau
                // lui-même, elle ne dépend pas du décalage courant. La lire à l'écran
                // pendant que la transition joue renvoyait une valeur en cours de route,
                // que l'on corrigeait à la frame suivante → le panneau oscillait.
                const r = el.getBoundingClientRect();
                const cx = r.left + r.width / 2 - ir.left;
                const cy = r.top + r.height / 2 - ir.top;
                const w = ir.width, h = ir.height;
                // Panneau plus petit que la fenêtre (vue d'ensemble réduite) → on le
                // CENTRE, au lieu de le coller en haut à gauche.
                const x = w <= b.width ? (b.width - w) / 2 : Math.min(0, Math.max(b.width - w, b.width / 2 - cx));
                const y = h <= b.height ? (b.height - h) / 2 : Math.min(0, Math.max(b.height - h, b.height / 2 - cy));
                setOffset(prev => (Math.abs(x - prev.x) < 0.5 && Math.abs(y - prev.y) < 0.5 ? prev : { x, y }));
            }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [selector, scale]);

    const ring = useRing(boxRef, selector, [selector]);

    // Le recadrage se fait par `left/top`, PAS par `transform` : un transform ferait du
    // panneau le bloc conteneur, et les overlays du planificateur (sélecteur de recettes)
    // se calaient sur lui — donc à cheval hors de la fenêtre. Sans transform, ils se
    // calent sur la tuile et s'affichent en entier. Le transform ne sert qu'à l'échelle,
    // réservée aux étapes de vue d'ensemble, qui n'ouvrent pas d'overlay.
    const crop: React.CSSProperties = scale === 1
        ? { left: offset.x, top: offset.y }
        : { transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` };

    return (
        <div ref={boxRef} className={styles.plannerBox}>
            <div ref={innerRef} className={styles.plannerInner} style={crop}>
                <WeekPlanner isOpen demo demoPlan={plan} onClose={() => {}} />
            </div>
            {ring && <div className={styles.ring} style={{ ...ring, borderRadius: 12 }} />}
        </div>
    );
}

/**
 * La vraie bulle d'installation de l'extension, telle qu'elle apparaît sur la page
 * Liste de courses — bouton « Comment l'installer ? » compris. `demo` la montre même
 * si l'utilisateur l'a déjà masquée, et neutralise son ✕ (qui viderait la tuile).
 */
function ExtensionDemo() {
    return (
        <div className={styles.extensionBox}>
            <ExtensionBubble demo />
        </div>
    );
}

/**
 * Copie agrandie d'un élément réel (icône du header). Ces commandes mènent à d'autres
 * PAGES (liste de courses, favoris) : on ne peut pas les jouer dans la tuile sans y
 * embarquer le site entier. On montre donc où elles se trouvent, en grand.
 */
function CloneDemo({ selector, zoom = 2.4 }: { selector: string; zoom?: number }) {
    const boxRef = useRef<HTMLDivElement>(null);
    useIso(() => {
        const box = boxRef.current;
        if (!box) return;
        box.innerHTML = '';
        const all = Array.from(document.querySelectorAll(selector)) as HTMLElement[];
        const el = all.find(n => { const r = n.getBoundingClientRect(); return r.width > 0 && n.offsetParent !== null; }) || all[0];
        if (!el) return;
        const r = el.getBoundingClientRect();
        const inner = document.createElement('div');
        inner.style.cssText = `width:${r.width}px;height:${r.height}px;transform:scale(${zoom});transform-origin:center;`;
        const clone = el.cloneNode(true) as HTMLElement;
        clone.removeAttribute('id');
        clone.style.cssText += `;margin:0;transform:none;width:${r.width}px;height:${r.height}px;`;
        // États d'animation figés par le clone (framer-motion écrit `opacity` en inline).
        [clone, ...Array.from(clone.querySelectorAll<HTMLElement>('*'))].forEach(n => {
            if (n.style.opacity && parseFloat(n.style.opacity) < 1) n.style.opacity = '1';
        });
        // Les <img> clonées sont des éléments neufs : on les fige sur la source déjà
        // chargée, sinon `loading="lazy"` + `srcset` les laissent vides.
        const src = Array.from(el.querySelectorAll('img'));
        Array.from(clone.querySelectorAll('img')).forEach((im, k) => {
            const from = src[k];
            im.loading = 'eager';
            if (from?.currentSrc) { im.srcset = ''; im.sizes = ''; im.src = from.currentSrc; }
        });
        inner.appendChild(clone);
        box.appendChild(inner);
    }, [selector, zoom]);

    return (
        <div className={styles.cloneBox}>
            <div ref={boxRef} className={styles.cloneStage} />
            <div className={styles.ring} style={{ inset: '50% auto auto 50%', width: 92, height: 92, transform: 'translate(-50%, -50%)', borderRadius: 999 }} />
        </div>
    );
}

/**
 * Scène de la tuile : bloc conteneur + hôte de portail. Tout ce que la démo ouvre
 * (fiche recette, sélecteur de recettes) atterrit donc ici, et non par-dessus l'écran.
 */
export function DemoStage({ children, className }: { children: React.ReactNode; className?: string }) {
    const ref = useRef<HTMLDivElement>(null);
    useIso(() => {
        setPortalHost(ref.current);
        return () => setPortalHost(null);
    }, []);
    return <div ref={ref} className={className}>{children}</div>;
}
