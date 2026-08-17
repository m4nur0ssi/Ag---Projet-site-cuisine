'use client';
/**
 * « Affine mes goûts » — onboarding par swipe, OPTIONNEL (jamais forcé au premier
 * écran). J'aime / je passe sur ~10 recettes → on mémorise les préférées dans
 * `taste-liked-v1`, qui alimente la rangée « Pour toi ». Peut être ouvert depuis
 * le menu, ou proposé une fois en PWA installée.
 */
import { useMemo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { mockRecipes } from '@/mobile/data/mockData';
import { decodeHtml } from '@/mobile/lib/utils';
import styles from './TasteOnboarding.module.css';

export const TASTE_KEY = 'taste-liked-v1';
export const TASTE_DONE_KEY = 'taste-onboarded';

export default function TasteOnboarding({ onClose }: { onClose: () => void }) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = ''; }; }, []);

    const deck = useMemo(() => {
        const pool = mockRecipes.filter((r: any) => r.category !== 'restaurant' && r.image && (r.steps?.length || 0) > 1);
        // Échantillon varié : on prend une entrée sur trois pour balayer le catalogue.
        return pool.filter((_, i) => i % 3 === 0).slice(0, 10);
    }, []);
    const [i, setI] = useState(0);
    const [liked, setLiked] = useState<string[]>([]);
    const [drag, setDrag] = useState(0);
    const dragX = useRef<number | null>(null);
    const done = i >= deck.length;

    const finish = (likedIds: string[]) => {
        try {
            const prev = JSON.parse(localStorage.getItem(TASTE_KEY) || '[]');
            const merged = [...new Set([...(Array.isArray(prev) ? prev : []), ...likedIds])];
            localStorage.setItem(TASTE_KEY, JSON.stringify(merged));
            localStorage.setItem(TASTE_DONE_KEY, '1');
            window.dispatchEvent(new Event('tv-seen-change')); // « Pour toi » se recalcule
        } catch { /* noop */ }
    };

    const swipe = (love: boolean) => {
        const next = love ? [...liked, String(deck[i].id)] : liked;
        setLiked(next);
        setDrag(0);
        const ni = i + 1;
        setI(ni);
        if (ni >= deck.length) finish(next);
    };

    // Glisser la carte : droite = j'aime, gauche = je passe.
    const onDown = (e: React.PointerEvent) => { dragX.current = e.clientX; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); };
    const onMove = (e: React.PointerEvent) => { if (dragX.current != null) setDrag(e.clientX - dragX.current); };
    const onUp = () => {
        if (dragX.current == null) return;
        dragX.current = null;
        if (Math.abs(drag) > 90) swipe(drag > 0);
        else setDrag(0);
    };

    if (!mounted) return null;
    return createPortal(
        <div className={styles.root} role="dialog" aria-modal="true">
            <header className={styles.head}>
                <div className={styles.kick}>Affine tes goûts</div>
                <button className={styles.skip} onClick={onClose}>Passer</button>
            </header>

            {!done ? (
                <>
                    <div className={styles.stage}>
                        {deck.slice(i, i + 3).reverse().map((r, k, arr) => {
                            const depth = arr.length - 1 - k;
                            const front = depth === 0;
                            const style = front
                                ? { transform: `translateX(${drag}px) rotate(${drag / 22}deg)`, zIndex: k, opacity: 1, transition: dragX.current != null ? 'none' : undefined }
                                : { transform: `translateY(${depth * 12}px) scale(${1 - depth * 0.05})`, zIndex: k, opacity: 0.55 };
                            return (
                                <div key={r.id} className={styles.card}
                                    style={style as any}
                                    onPointerDown={front ? onDown : undefined}
                                    onPointerMove={front ? onMove : undefined}
                                    onPointerUp={front ? onUp : undefined}
                                    onPointerCancel={front ? onUp : undefined}
                                >
                                    <img src={r.image} alt="" draggable={false} />
                                    {front && drag > 40 && <div className={styles.badgeLike}>J&apos;aime</div>}
                                    {front && drag < -40 && <div className={styles.badgeNope}>Passer</div>}
                                    <div className={styles.scrim} />
                                    <div className={styles.meta}>
                                        <span className={styles.cat}>{r.category}</span>
                                        <div className={styles.ttl}>{decode(r.title)}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className={styles.ctrls}>
                        <button className={styles.no} onClick={() => swipe(false)} aria-label="Passer">
                            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                        </button>
                        <div className={styles.count}>{i + 1} / {deck.length}</div>
                        <button className={styles.yes} onClick={() => swipe(true)} aria-label="J'aime">
                            <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M12 20s-7-4.3-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.7-7 9-7 9z" /></svg>
                        </button>
                    </div>
                </>
            ) : (
                <div className={styles.doneWrap}>
                    <div className={styles.doneTitle}>{liked.length} coup{liked.length > 1 ? 's' : ''} de cœur</div>
                    <p className={styles.doneP}>Ton accueil affiche maintenant une rangée « Pour toi » à ta main.</p>
                    <button className={styles.cta} onClick={onClose}>Voir mon accueil</button>
                </div>
            )}

            <div className={styles.bg} aria-hidden />
        </div>,
        document.body
    );
}

function decode(s: string) { return decodeHtml(s || ''); }
