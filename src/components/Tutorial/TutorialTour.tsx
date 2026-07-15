'use client';
import { useEffect, useLayoutEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './TutorialTour.module.css';

export interface TourStep {
    /** Cible à éclairer : sélecteur CSS (data-tour=…). Absente → étape centrée sans projecteur. */
    selector?: string;
    title: string;
    text: string;
    /** Rayon du halo (px) — suit la forme de la cible (rond pour une icône, arrondi pour une carte). */
    radius?: number;
    /** Étape sans objet sur mobile (ex. extension Chrome) → masquée sur petit écran. */
    desktopOnly?: boolean;
    /** Action jouée AVANT l'étape (ex. ouvrir le planificateur pour éclairer ses boutons). */
    before?: () => void;
    /** Étape gardée même si sa cible est absente au lancement (elle n'existe qu'après `before`). */
    lazyTarget?: boolean;
    /** Étape conservée seulement si CE sélecteur existe (ex. planificateur = connectés). */
    requires?: string;
    /** Cible de repli si `selector` est absent (ex. l'accompagnement n'existe que si le
     *  créneau contient déjà un plat → on éclaire le créneau). */
    fallback?: string;
}

interface Rect { top: number; left: number; width: number; height: number }

const PAD = 10;          // marge du projecteur autour de la cible
const useIso = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * Première correspondance VISIBLE. Le header rend deux variantes (normale / scrollée)
 * simultanément dans le DOM : un simple querySelector viserait la version masquée.
 */
export function findTarget(selector?: string): HTMLElement | null {
    if (!selector) return null;
    const all = Array.from(document.querySelectorAll(selector)) as HTMLElement[];
    return all.find(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && el.offsetParent !== null;
    }) || null;
}

export default function TutorialTour({ steps, onClose }: { steps: TourStep[]; onClose: () => void }) {
    const [i, setI] = useState(0);
    const [rect, setRect] = useState<Rect | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    const step = steps[i];
    // Cible résolue UNE SEULE FOIS par étape. Si on re-interrogeait le DOM à chaque
    // mesure, un scroll ferait passer une autre carte en « première visible » : le halo
    // sauterait de cible en cible et le scroll la poursuivrait en boucle.
    const elRef = useRef<HTMLElement | null>(null);

    // Hauteur réelle de la bulle (dépend de la longueur du texte) pour la placer sans déborder.
    const bubRef = useRef<HTMLDivElement>(null);
    const [bubH, setBubH] = useState(0);
    const lastRef = useRef<Rect | null>(null);
    const measure = useCallback(() => {
        const el = elRef.current;
        if (!el) { if (lastRef.current) { lastRef.current = null; setRect(null); } return; }
        const r = el.getBoundingClientRect();
        const next = { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 };
        const p = lastRef.current;
        // Appelé à chaque frame : on ne re-rend que si la cible a bougé (>0.5px).
        if (p && Math.abs(p.top - next.top) < 0.5 && Math.abs(p.left - next.left) < 0.5
            && Math.abs(p.width - next.width) < 0.5 && Math.abs(p.height - next.height) < 0.5) return;
        lastRef.current = next;
        setRect(next);
    }, []);

    useIso(() => {
        let cancelled = false;
        let timer: any;

        // La cible de l'étape précédente ne doit plus être éclairée pendant qu'on attend
        // la nouvelle (sinon le halo reste une étape en arrière).
        elRef.current = null;
        lastRef.current = null;
        setRect(null);

        step?.before?.(); // ex. ouvrir le planificateur : sa cible n'existe qu'après

        // La cible peut n'apparaître qu'après `before` (panneau qui s'ouvre) → on
        // patiente le temps qu'elle arrive, sans bloquer si elle ne vient jamais.
        const lockOn = (el: HTMLElement) => {
            elRef.current = el;
            const r = el.getBoundingClientRect();
            if (r.top < 90 || r.bottom > window.innerHeight - 90) {
                // Scroll INSTANTANÉ puis mesure : un scroll fluide fait mesurer en plein vol.
                el.scrollIntoView({ block: 'center', behavior: 'auto' });
            }
            measure();
        };

        const TRIES = 20;              // ~2 s max pour une cible qui s'ouvre (planificateur)
        const FALLBACK_AFTER = 6;      // ~600 ms : au-delà, on n'attend plus si un repli existe
        const attempt = (left: number) => {
            if (cancelled) return;
            const el = findTarget(step?.selector);
            if (el) { lockOn(el); return; }
            const waited = TRIES - left;
            // Repli dès que la cible principale tarde : inutile d'attendre 2 s dans le vide
            // (ex. accompagnement absent tant que le créneau n'a pas de plat).
            if (waited >= FALLBACK_AFTER || left <= 0) {
                const fb = findTarget(step?.fallback);
                if (fb) { lockOn(fb); return; }
            }
            if (left <= 0) { elRef.current = null; setRect(null); return; }
            timer = setTimeout(() => attempt(left - 1), 100);
        };
        attempt(step?.selector ? TRIES : 0);

        return () => { cancelled = true; clearTimeout(timer); };
    }, [i, measure, step]);

    // Suivi image par image : la home anime des carrousels (transform) et scrolle en
    // douceur. Un listener scroll/resize rate ces mouvements → le halo se décroche.
    // Un rAF colle à la cible quoi qu'il arrive, pour un coût négligeable.
    useEffect(() => {
        let raf = 0;
        const tick = () => { measure(); raf = requestAnimationFrame(tick); };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [measure]);

    // Mesure la bulle après rendu du texte de l'étape (sa hauteur change d'une étape à l'autre).
    useIso(() => { if (bubRef.current) setBubH(bubRef.current.offsetHeight); }, [i, mounted]);

    const next = useCallback(() => { if (i < steps.length - 1) setI(i + 1); else onClose(); }, [i, steps.length, onClose]);
    const prev = useCallback(() => setI(v => Math.max(0, v - 1)), []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight' || e.key === 'Enter') next();
            if (e.key === 'ArrowLeft') prev();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [next, prev, onClose]);

    if (!mounted || !step) return null;

    // Bulle : sous la cible si la place le permet, sinon au-dessus, et TOUJOURS ramenée
    // dans l'écran (sa hauteur dépend du texte — une estimation en dur la faisait sortir).
    const bubble: React.CSSProperties = (() => {
        if (!rect) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
        const bh = bubH || 240;
        const below = rect.top + rect.height + 16;
        let top = below + bh + 16 <= window.innerHeight ? below : rect.top - bh - 16;
        top = Math.min(Math.max(16, top), Math.max(16, window.innerHeight - bh - 16));
        const left = Math.min(Math.max(16, rect.left + rect.width / 2 - 190), Math.max(16, window.innerWidth - 396));
        return { top, left };
    })();

    return createPortal(
        <div className={styles.root} role="dialog" aria-modal="true" aria-label="Tutoriel">
            {/* Projecteur : le trou est fait par une ombre géante autour de la cible */}
            {rect ? (
                <div
                    className={styles.spot}
                    style={{
                        top: rect.top, left: rect.left, width: rect.width, height: rect.height,
                        borderRadius: step.radius ?? 16,
                    }}
                />
            ) : (
                <div className={styles.dimAll} />
            )}

            <div ref={bubRef} className={styles.bubble} style={bubble}>
                <div className={styles.count}>Étape {i + 1} / {steps.length}</div>
                <h3 className={styles.title}>{step.title}</h3>
                <p className={styles.text}>{step.text}</p>
                <div className={styles.actions}>
                    <button className={styles.skip} onClick={onClose}>Passer</button>
                    <div className={styles.right}>
                        {i > 0 && <button className={styles.prev} onClick={prev}>Précédent</button>}
                        <button className={styles.next} onClick={next}>
                            {i === steps.length - 1 ? 'Terminer' : 'Suivant'}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
