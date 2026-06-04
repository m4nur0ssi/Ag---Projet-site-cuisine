'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/mobile/lib/supabase';
import styles from './RecipeNote.module.css';

interface RecipeNoteProps {
    recipeId: string;
}

// Note perso par recette, synchronisée Supabase (table recipe_notes, par compte).
export default function RecipeNote({ recipeId }: RecipeNoteProps) {
    const [content, setContent] = useState('');
    const [user, setUser] = useState<{ id: string } | null>(null);
    const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const load = async (uid: string | null) => {
            if (!uid) { setContent(''); return; }
            const { data } = await supabase
                .from('recipe_notes')
                .select('content')
                .eq('user_id', uid)
                .eq('recipe_id', recipeId)
                .maybeSingle();
            setContent(data?.content ?? '');
        };
        supabase.auth.getSession().then(({ data: { session } }) => {
            const u = session?.user ?? null;
            setUser(u ? { id: u.id } : null);
            load(u?.id ?? null);
        });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
            const u = session?.user ?? null;
            setUser(u ? { id: u.id } : null);
            load(u?.id ?? null);
        });
        return () => subscription.unsubscribe();
    }, [recipeId]);

    const onChange = (v: string) => {
        setContent(v);
        if (!user) return;
        setStatus('saving');
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(async () => {
            await supabase.from('recipe_notes').upsert({
                user_id: user.id,
                recipe_id: recipeId,
                content: v,
                updated_at: new Date().toISOString(),
            });
            setStatus('saved');
            setTimeout(() => setStatus('idle'), 1500);
        }, 800);
    };

    return (
        <div className={styles.section}>
            <div className={styles.header}>
                <h3 className={styles.title}>📝 Ma note</h3>
                {status === 'saving' && <span className={styles.status}>Enregistrement…</span>}
                {status === 'saved' && <span className={styles.status}>✓ Enregistré</span>}
            </div>
            {user ? (
                <textarea
                    className={styles.textarea}
                    value={content}
                    onChange={e => onChange(e.target.value)}
                    placeholder="Ta note perso sur cette recette (variantes, quantités, astuces…)"
                    rows={4}
                />
            ) : (
                <div
                    className={styles.empty}
                    onClick={() => { if (typeof window !== 'undefined') window.dispatchEvent(new Event('magic-open-auth')); }}
                    style={{ cursor: 'pointer' }}
                >
                    Connecte-toi pour écrire une note perso.
                </div>
            )}
        </div>
    );
}
