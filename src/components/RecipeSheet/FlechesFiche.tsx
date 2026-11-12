'use client';
import { useEffect, useState, type RefObject } from 'react';
import styles from './FlechesFiche.module.css';

interface Pos { top: number; left: number; right: number }

/**
 * Position des flèches ‹ › : de part et d'autre de la PHOTO de la recette,
 * à mi-hauteur, mesurée sur la fiche ouverte. Bureau seulement (la photo y
 * est à droite du titre) ; sur téléphone on renvoie `null` et la fiche garde
 * ses flèches d'origine.
 */
export function useFlechesPos(sheet: RefObject<HTMLElement | null>, actif: boolean): Pos | null {
    const [pos, setPos] = useState<Pos | null>(null);
    useEffect(() => {
        if (!actif) { setPos(null); return; }
        const TAILLE = 56;
        const mesurer = () => {
            // La fiche monte après ce hook (portail, animation) : on la cherche à chaque mesure.
            const el = sheet.current;
            if (!el) return;
            if (window.innerWidth < 900) { setPos((p) => (p ? null : p)); return; }
            const f = el.getBoundingClientRect();
            let meilleur: DOMRect | null = null; let rec = 0;
            el.querySelectorAll('[class*="imageCardContainer"]').forEach((n) => {
                const r = n.getBoundingClientRect();
                const recouvre = Math.min(r.right, f.right) - Math.max(r.left, f.left);
                if (recouvre > rec) { rec = recouvre; meilleur = r; }
            });
            const r = meilleur as DOMRect | null;
            // Photo absente, hors de la fiche (défilée) ou coupée : pas de flèches.
            if (!r || rec < r.width * 0.9) { setPos((p) => (p ? null : p)); return; }
            const milieu = (r.top + r.bottom) / 2;
            if (milieu < f.top + 60 || milieu > f.bottom - 60) { setPos((p) => (p ? null : p)); return; }
            const next = {
                top: Math.round(milieu - f.top - TAILLE / 2),
                left: Math.round(r.left - f.left + 14),
                right: Math.round(f.right - r.right + 14),
            };
            setPos((p) => (p && p.top === next.top && p.left === next.left && p.right === next.right ? p : next));
        };
        mesurer();
        const t = setInterval(mesurer, 120);
        document.addEventListener('scroll', mesurer, true);
        window.addEventListener('resize', mesurer);
        return () => { clearInterval(t); document.removeEventListener('scroll', mesurer, true); window.removeEventListener('resize', mesurer); };
    }, [sheet, actif]);
    return pos;
}

const Chevron = ({ sens }: { sens: 'g' | 'd' }) => (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={sens === 'g' ? 'M14.5 5.5 8 12l6.5 6.5' : 'M9.5 5.5 16 12l-6.5 6.5'} />
    </svg>
);

export function FlechesImage({ pos, precedent, suivant }: { pos: Pos; precedent?: () => void; suivant?: () => void }) {
    return (
        <>
            <button type="button" className={styles.fleche} style={{ top: pos.top, left: pos.left }} onClick={precedent} disabled={!precedent} aria-label="Recette précédente"><Chevron sens="g" /></button>
            <button type="button" className={styles.fleche} style={{ top: pos.top, right: pos.right }} onClick={suivant} disabled={!suivant} aria-label="Recette suivante"><Chevron sens="d" /></button>
        </>
    );
}
