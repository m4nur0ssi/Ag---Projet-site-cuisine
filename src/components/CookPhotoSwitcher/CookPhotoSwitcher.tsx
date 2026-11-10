'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import styles from './CookPhotoSwitcher.module.css';

// Photo principale de la fiche + petites tuiles rondes (photos « J'ai cuisiné »)
// centrées en bas de l'image. Clic sur une tuile : la grande photo se réduit dans
// la tuile, la tuile s'agrandit à sa place (animation FLIP). Fermer la fiche
// remet la photo d'origine : le composant est recréé à chaque ouverture.

interface Props { original: string; alt: string; photos: string[] }

type Pending = { k: number; grandAvant: DOMRect; tuileAvant: DOMRect };

function animer(el: HTMLElement | null, depuis: DOMRect, vers: DOMRect) {
    if (!el) return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const dx = depuis.left - vers.left;
    const dy = depuis.top - vers.top;
    const s = depuis.width / vers.width;
    el.animate(
        [{ transform: `translate(${dx}px, ${dy}px) scale(${s})` }, { transform: 'none' }],
        { duration: 520, easing: 'cubic-bezier(.2,.8,.2,1)' },
    );
}

export default function CookPhotoSwitcher({ original, alt, photos }: Props) {
    // ordre[0] = photo affichée en grand ; ordre[1..] = tuiles.
    const [ordre, setOrdre] = useState<string[]>([original, ...photos]);
    const grand = useRef<HTMLImageElement>(null);
    const tuiles = useRef<(HTMLImageElement | null)[]>([]);
    const attente = useRef<Pending | null>(null);

    const choisir = (k: number) => {
        const g = grand.current;
        const t = tuiles.current[k];
        if (!g || !t) return;
        attente.current = { k, grandAvant: g.getBoundingClientRect(), tuileAvant: t.getBoundingClientRect() };
        setOrdre(prev => { const n = [...prev]; [n[0], n[k]] = [n[k], n[0]]; return n; });
    };

    // Après le rendu : chaque image part de l'ancienne place de l'autre.
    useLayoutEffect(() => {
        const p = attente.current;
        if (!p) return;
        attente.current = null;
        animer(grand.current, p.tuileAvant, grand.current!.getBoundingClientRect());
        animer(tuiles.current[p.k], p.grandAvant, tuiles.current[p.k]!.getBoundingClientRect());
    }, [ordre]);

    const tuilesAffichees = ordre.slice(1);

    return (
        <div className={styles.cadre}>
            <img ref={grand} src={ordre[0]} alt={alt} className={styles.grand} draggable={false} />
            {tuilesAffichees.length > 0 && (
                <div className={styles.bande}>
                    {tuilesAffichees.map((url, i) => (
                        <button
                            key={i}
                            type="button"
                            className={styles.tuile}
                            onClick={() => choisir(i + 1)}
                            aria-label="Voir cette photo en grand"
                        >
                            <img ref={el => { tuiles.current[i + 1] = el; }} src={url} alt="" draggable={false} />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
