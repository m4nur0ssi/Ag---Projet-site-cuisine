'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/mobile/lib/supabase';
import { submitRating } from '@/mobile/lib/ratings';
import styles from './StarRating.module.css';

interface StarRatingProps {
    recipeId: string;
    readonly?: boolean;
    size?: 'small' | 'large';
}

export default function StarRating({ recipeId, size = 'large' }: StarRatingProps) {
    const [avg, setAvg] = useState(0);
    const [count, setCount] = useState(0);
    const [mine, setMine] = useState(0);
    const [user, setUser] = useState<any>(null);

    const loadAvg = async () => {
        const { data } = await supabase.from('ratings').select('stars').eq('recipe_id', recipeId);
        const rows = data || [];
        setCount(rows.length);
        setAvg(rows.length ? rows.reduce((s: number, r: any) => s + (Number(r.stars) || 0), 0) / rows.length : 0);
    };

    useEffect(() => {
        loadAvg();
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            if (session) {
                supabase.from('ratings').select('stars')
                    .eq('user_id', session.user.id).eq('recipe_id', recipeId).maybeSingle()
                    .then(({ data }) => setMine(data?.stars ?? 0));
            }
        });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
            setUser(session?.user ?? null);
        });
        return () => subscription.unsubscribe();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [recipeId]);

    const vote = async (val: number) => {
        if (!user) return;
        const nv = mine === val ? 0 : val;
        setMine(nv);
        await submitRating(recipeId, nv);
        await loadAvg();
        window.dispatchEvent(new CustomEvent('recipeRated', { detail: { recipeId, rating: nv } }));
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
    };

    return (
        <div className={`${styles.wrap} ${styles[size]}`}>
            {/* Note moyenne — chiffre lisible (visible par tous) */}
            <div className={styles.avgRow} aria-label={`Note moyenne ${avg.toFixed(1)} sur 5`}>
                <span className={styles.avgStar}>★</span>
                <span className={styles.num}>{count > 0 ? avg.toFixed(1) : '–'}</span>
                <span className={styles.denom}>/5</span>
                {count > 0 && <span className={styles.count}>({count})</span>}
            </div>

            {/* Vote personnel — glissière d'étoiles au dixième (connectés). */}
            {user && (
                <div className={styles.voteRow}>
                    <span className={styles.voteLabel}>Votre note{mine > 0 ? ` : ${mine.toFixed(1).replace('.', ',')}` : ''}</span>
                    <StarSlider value={mine} onChange={vote} />
                </div>
            )}
        </div>
    );
}

/* Barre de 5 étoiles réglable au dixième : glisser/toucher la remplit en continu. */
function StarSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    const barRef = useRef<HTMLDivElement>(null);
    const [preview, setPreview] = useState<number | null>(null);
    const shown = preview ?? value;

    const valueAt = (clientX: number): number => {
        const el = barRef.current;
        if (!el) return 0;
        const r = el.getBoundingClientRect();
        const ratio = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
        return Math.max(0.1, Math.round(ratio * 50) / 10); // 0,1 → 5,0 au dixième
    };

    const commit = (clientX: number) => onChange(valueAt(clientX));

    return (
        <div
            ref={barRef}
            className={styles.starSlider}
            role="slider"
            aria-valuemin={0}
            aria-valuemax={5}
            aria-valuenow={value}
            tabIndex={0}
            onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); setPreview(valueAt(e.clientX)); }}
            onPointerMove={(e) => { if (preview !== null) setPreview(valueAt(e.clientX)); }}
            onPointerUp={(e) => { commit(e.clientX); setPreview(null); }}
            onPointerCancel={() => setPreview(null)}
            onKeyDown={(e) => {
                if (e.key === 'ArrowLeft') { e.preventDefault(); onChange(Math.max(0.1, Math.round((value - 0.1) * 10) / 10)); }
                if (e.key === 'ArrowRight') { e.preventDefault(); onChange(Math.min(5, Math.round((value + 0.1) * 10) / 10)); }
            }}
        >
            {[0, 1, 2, 3, 4].map((i) => {
                const fill = Math.min(1, Math.max(0, shown - i)) * 100;
                return (
                    <span key={i} className={styles.slStar}>
                        <span className={styles.slStarBase}>★</span>
                        <span className={styles.slStarFill} style={{ width: `${fill}%` }}>★</span>
                    </span>
                );
            })}
        </div>
    );
}
