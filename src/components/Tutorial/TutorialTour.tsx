'use client';
import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import TutorialDemo, { DemoStage, type DemoSpec } from './TutorialDemo';
import styles from './TutorialTour.module.css';

export interface TourStep {
    title: string;
    text: string;
    /** Consigne affichée sous la démo (« Clique sur ▶ »). */
    hint?: string;
    /** L'exemple jouable montré à droite de l'explication. */
    demo: DemoSpec;
    /** Étape sans objet sur mobile (ex. extension Chrome) → masquée sur petit écran. */
    desktopOnly?: boolean;
    /** Étape conservée seulement si ce sélecteur existe (ex. planificateur = connectés). */
    requires?: string;
}

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

/**
 * Visite guidée en DEUX TUILES : l'explication à gauche, l'exemple jouable à droite.
 *
 * Le projecteur sur la page réelle a été abandonné : il obligeait à assombrir tout le
 * site pour désigner une cible, et on ne voyait plus ce dont l'étape parlait. Ici la
 * démonstration est autoportante — la page derrière n'est qu'un décor, à peine voilé.
 */
export default function TutorialTour({ steps, onClose }: { steps: TourStep[]; onClose: () => void }) {
    const [i, setI] = useState(0);
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    const step = steps[i];
    const next = useCallback(() => { if (i < steps.length - 1) setI(i + 1); else onClose(); }, [i, steps.length, onClose]);
    const prev = useCallback(() => setI(v => Math.max(0, v - 1)), []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight') next();
            if (e.key === 'ArrowLeft') prev();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [next, prev, onClose]);

    if (!mounted || !step) return null;

    return createPortal(
        <div className={styles.root} role="dialog" aria-modal="true" aria-label="Tutoriel">
            {/* Voile léger : la page reste lisible, l'attention vient des tuiles. */}
            <div className={styles.dim} onClick={onClose} />

            <div className={styles.stage}>
                <div className={styles.stepTile}>
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

                <div className={styles.demoTile}>
                    {/* `key` : chaque étape remonte sa démo à neuf (planificateur réinitialisé) */}
                    <DemoStage className={styles.demoStage}>
                        <TutorialDemo key={i} spec={step.demo} />
                    </DemoStage>
                    {step.hint && <div className={styles.hint}>{step.hint}</div>}
                </div>
            </div>
        </div>,
        document.body
    );
}
