'use client';
import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import styles from './PlannerTooltip.module.css';

interface PlannerTooltipProps {
    visible: boolean;
    midi?: any;
    soir?: any;
    anchorRef: React.RefObject<HTMLElement>;
}

function MealCard({ meal, label, side, visible, onClick }: {
    meal: any; label: string; side: 'left' | 'right'; visible: boolean; onClick: () => void;
}) {
    return (
        <div
            className={`${styles.card} ${visible ? styles.show : styles.hide} ${side === 'left' ? styles.slideLeft : styles.slideRight}`}
            onClick={onClick}
        >
            {/* Label bar en haut */}
            <div className={styles.labelBar}>
                <span>{label === 'Midi' ? '🍽' : '🌙'}</span>
                <span>{label}</span>
            </div>
            {/* Image */}
            <div className={styles.cardImg}>
                {meal.image
                    ? <img src={meal.image} alt={meal.title} />
                    : <div className={styles.cardImgFallback}>{label === 'Midi' ? '🍽' : '🌙'}</div>
                }
            </div>
            {/* Titre en overlay bas */}
            <div className={styles.cardOverlay}>
                <div className={styles.cardTitle}>{meal.title}</div>
            </div>
        </div>
    );
}

export default function PlannerTooltip({ visible, midi, soir, anchorRef }: PlannerTooltipProps) {
    const [mounted, setMounted] = useState(false);
    const [pillRect, setPillRect] = useState<DOMRect | null>(null);
    const router = useRouter();

    useEffect(() => {
        if (visible) {
            setMounted(true);
            if (anchorRef.current) setPillRect(anchorRef.current.getBoundingClientRect());
        } else {
            const t = setTimeout(() => setMounted(false), 400);
            return () => clearTimeout(t);
        }
    }, [visible]);

    if (!mounted || (!midi && !soir)) return null;

    const GAP = 8;
    const pillLeft = pillRect?.left ?? 0;
    const pillWidth = pillRect?.width ?? 400;
    const pillBottom = (pillRect?.bottom ?? 0) + 8;
    const cardW = (pillWidth - GAP) / 2;
    const cardH = Math.round(cardW * 1.38);

    const goToRecipe = (meal: any) => {
        window.dispatchEvent(new CustomEvent('closePlannerTooltip'));
        setTimeout(() => window.dispatchEvent(new CustomEvent('openRecipeFromPlanner', { detail: meal })), 50);
    };

    const keepOpen = () => { window.dispatchEvent(new CustomEvent('planner-tooltip-keep')); };
    const startClose = () => { window.dispatchEvent(new CustomEvent('planner-tooltip-leave')); };

    return createPortal(
        <>
            {midi && (
                <div
                    style={{ position: 'fixed', top: pillBottom, left: pillLeft, width: cardW, height: cardH, zIndex: 99999, cursor: 'pointer' }}
                    onMouseEnter={keepOpen}
                    onMouseLeave={startClose}
                >
                    <MealCard meal={midi} label="Midi" side="left" visible={visible} onClick={() => goToRecipe(midi)} />
                </div>
            )}
            {soir && (
                <div
                    style={{ position: 'fixed', top: pillBottom, left: pillLeft + cardW + GAP, width: cardW, height: cardH, zIndex: 99999, cursor: 'pointer' }}
                    onMouseEnter={keepOpen}
                    onMouseLeave={startClose}
                >
                    <MealCard meal={soir} label="Soir" side="right" visible={visible} onClick={() => goToRecipe(soir)} />
                </div>
            )}
        </>,
        document.body
    );
}
