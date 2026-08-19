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

/** Durée du verdict (doit coller à l'animation CSS `.verdict`). */
const VERDICT_MS = 420;

/**
 * `embedded` : rendu DANS le shell desktop TV+ (panneau, menu à gauche) plutôt
 * qu'en calque plein écran — même moule que Favoris, Recherche et Tutoriel.
 */
export default function TasteOnboarding({ onClose, embedded = false }: { onClose: () => void; embedded?: boolean }) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
        if (embedded) return;              // en panneau, la page derrière reste vivante
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, [embedded]);

    const deck = useMemo(() => {
        const pool = mockRecipes.filter((r: any) => r.category !== 'restaurant' && r.image && (r.steps?.length || 0) > 1);
        // Échantillon varié : on prend une entrée sur trois pour balayer le catalogue.
        return pool.filter((_, i) => i % 3 === 0).slice(0, 10);
    }, []);
    const [i, setI] = useState(0);
    const [liked, setLiked] = useState<string[]>([]);
    const [drag, setDrag] = useState(0);
    const dragX = useRef<number | null>(null);
    // Verdict : la carte s'envole et un signe s'imprime par-dessus — cœur rouge
    // pour un oui, croix grise pour un non. Même geste au clic qu'au glissé.
    const [verdict, setVerdict] = useState<'like' | 'pass' | null>(null);
    const deciding = useRef(false);
    /** Rappel du geste sur la toute première carte : elle amorce le mouvement. */
    const [nudge, setNudge] = useState(true);
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
        if (deciding.current || done) return;
        deciding.current = true;
        try { navigator.vibrate?.(love ? [10, 40, 14] : 12); } catch { /* noop */ }
        setVerdict(love ? 'like' : 'pass');
        // La carte part dans le sens du choix pendant que le signe s'imprime.
        setDrag(love ? 900 : -900);
        window.setTimeout(() => {
            const next = love ? [...liked, String(deck[i].id)] : liked;
            setLiked(next);
            setDrag(0);
            setVerdict(null);
            const ni = i + 1;
            setI(ni);
            if (ni >= deck.length) finish(next);
            deciding.current = false;
        }, VERDICT_MS);
    };

    // Glisser la carte : droite = j'aime, gauche = je passe.
    const onDown = (e: React.PointerEvent) => {
        setNudge(false);                       // le doigt a compris, le rappel s'arrête
        dragX.current = e.clientX;
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    };
    const onMove = (e: React.PointerEvent) => { if (dragX.current != null) setDrag(e.clientX - dragX.current); };
    const onUp = () => {
        if (dragX.current == null) return;
        dragX.current = null;
        if (Math.abs(drag) > 90) swipe(drag > 0);
        else setDrag(0);
    };

    if (!mounted) return null;

    const body = (
        <>
            <header className={styles.head}>
                {embedded ? (
                    <div>
                        <h1 className={styles.panelTitle}>Affine mes goûts</h1>
                        <p className={styles.panelSub}>Un cœur ou une croix sur dix recettes, et la rangée « Pour toi » se règle sur toi.</p>
                    </div>
                ) : (
                    <>
                        <div className={styles.kick}>Affine tes goûts</div>
                        <button className={styles.skip} onClick={onClose}>Passer</button>
                    </>
                )}
            </header>

            {!done ? (
                <>
                    <div className={styles.stage}>
                        {deck.slice(i, i + 3).reverse().map((r, k, arr) => {
                            const depth = arr.length - 1 - k;
                            const front = depth === 0;
                            const style = front
                                ? {
                                    transform: `translateX(${drag}px) rotate(${drag / 22}deg)`,
                                    zIndex: k,
                                    opacity: verdict ? 0 : 1,
                                    transition: dragX.current != null ? 'none' : undefined,
                                }
                                : { transform: `translateY(${depth * 12}px) scale(${1 - depth * 0.05})`, zIndex: k, opacity: 0.55 };
                            return (
                                <div key={r.id}
                                    className={`${styles.card} ${front && nudge && i === 0 ? styles.cardNudge : ''}`}
                                    style={style as any}
                                    onPointerDown={front ? onDown : undefined}
                                    onPointerMove={front ? onMove : undefined}
                                    onPointerUp={front ? onUp : undefined}
                                    onPointerCancel={front ? onUp : undefined}
                                >
                                    <img src={r.image} alt="" draggable={false} />
                                    {/* Tampons : ils apparaissent avec le geste et
                                        grossissent à mesure qu'on approche du seuil. */}
                                    {front && drag > 12 && (
                                        <div
                                            className={styles.badgeLike}
                                            style={{
                                                opacity: Math.min(1, (drag - 12) / 70),
                                                transform: `rotate(8deg) scale(${0.8 + Math.min(1, drag / 110) * 0.3})`,
                                            }}
                                        >J&apos;aime</div>
                                    )}
                                    {front && drag < -12 && (
                                        <div
                                            className={styles.badgeNope}
                                            style={{
                                                opacity: Math.min(1, (-drag - 12) / 70),
                                                transform: `rotate(-8deg) scale(${0.8 + Math.min(1, -drag / 110) * 0.3})`,
                                            }}
                                        >Passer</div>
                                    )}
                                    <div className={styles.scrim} />
                                    <div className={styles.meta}>
                                        <span className={styles.cat}>{r.category}</span>
                                        <div className={styles.ttl}>{decode(r.title)}</div>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Le verdict : lavis coloré + signe, 420 ms, puis plus rien.
                            Rouge et cœur pour un oui, gris et croix pour un non —
                            strictement symétriques, sans rebond ni fanfare. */}
                        {verdict && (
                            <div
                                className={`${styles.verdict} ${verdict === 'like' ? styles.verdictLike : styles.verdictPass}`}
                                aria-hidden
                            >
                                {verdict === 'like' ? (
                                    <svg className={styles.verdictMark} viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12 20s-7-4.3-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.7-7 9-7 9z" />
                                    </svg>
                                ) : (
                                    <svg className={styles.verdictMark} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                                        <path d="M6 6l12 12M18 6L6 18" />
                                    </svg>
                                )}
                            </div>
                        )}
                    </div>
                    {/* Sur téléphone, tout se joue au doigt : pas de boutons, mais
                        une consigne claire et le compteur d'avancement. */}
                    {!embedded ? (
                        <div className={styles.guide}>
                            <div className={styles.guideRow}>
                                <span className={styles.guideNo}>
                                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
                                    Glisse à gauche
                                </span>
                                <span className={styles.guideCount}>{i + 1} / {deck.length}</span>
                                <span className={styles.guideYes}>
                                    Glisse à droite
                                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
                                </span>
                            </div>
                            <p className={styles.guideText}>
                                À gauche pour passer, à droite si la recette te tente.
                                Dix photos, et l&apos;accueil se règle sur toi.
                            </p>
                        </div>
                    ) : (
                    <div className={styles.ctrls}>
                        <button className={styles.no} onClick={() => swipe(false)} aria-label="Passer">
                            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                        </button>
                        <div className={styles.count}>{i + 1} / {deck.length}</div>
                        <button className={styles.yes} onClick={() => swipe(true)} aria-label="J'aime">
                            <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M12 20s-7-4.3-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.7-7 9-7 9z" /></svg>
                        </button>
                    </div>
                    )}
                </>
            ) : (
                <div className={styles.doneWrap}>
                    <div className={styles.doneTitle}>{liked.length} coup{liked.length > 1 ? 's' : ''} de cœur</div>
                    <p className={styles.doneP}>Ton accueil affiche maintenant une rangée « Pour toi » à ta main.</p>
                    <button className={styles.cta} onClick={onClose}>Voir mon accueil</button>
                </div>
            )}

            <div className={styles.bg} aria-hidden />
        </>
    );

    if (embedded) return <div className={`${styles.root} ${styles.embedded}`}>{body}</div>;

    return createPortal(
        <div className={styles.root} role="dialog" aria-modal="true">{body}</div>,
        document.body
    );
}

function decode(s: string) { return decodeHtml(s || ''); }
