'use client';
import { useState, useEffect } from 'react';
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
    const [hover, setHover] = useState(0);
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

    const pct = avg > 0 ? (avg / 5) * 100 : 0;

    return (
        <div className={`${styles.wrap} ${styles[size]}`}>
            <div className={styles.avgRow}>
                <div className={styles.starsStatic} aria-label={`Note moyenne ${avg.toFixed(1)} sur 5`}>
                    <span className={styles.starsBase}>★★★★★</span>
                    <span className={styles.starsFill} style={{ width: `${pct}%` }}>★★★★★</span>
                </div>
                <span className={styles.num}>{count > 0 ? avg.toFixed(1) : '–'}</span>
                <span className={styles.denom}>/5</span>
                {count > 0 && <span className={styles.count}>({count})</span>}
            </div>

            {user && (
                <div className={styles.voteRow}>
                    <span className={styles.voteLabel}>Votre note</span>
                    <div className={styles.stars}>
                        {[1, 2, 3, 4, 5].map(val => (
                            <button
                                key={val}
                                className={`${styles.star} ${(hover || mine) >= val ? styles.active : ''}`}
                                onClick={() => vote(val)}
                                onMouseEnter={() => setHover(val)}
                                onMouseLeave={() => setHover(0)}
                                aria-label={`${val} étoile${val > 1 ? 's' : ''}`}
                            >
                                ★
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
