'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getCookEntries, addCookEntry, deleteCookEntry, type CookEntry } from '@/lib/cookingLog';
import styles from './CookingJournal.module.css';

// #11 — Carnet de cuisine perso affiché dans la fiche recette.
export default function CookingJournal({ recipeId }: { recipeId: string }) {
    const [authed, setAuthed] = useState(false);
    const [entries, setEntries] = useState<CookEntry[]>([]);
    const [open, setOpen] = useState(false);
    const [note, setNote] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [busy, setBusy] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        let alive = true;
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!alive) return;
            setAuthed(!!session);
            if (session) getCookEntries(recipeId).then(e => alive && setEntries(e));
        });
        return () => { alive = false; };
    }, [recipeId]);

    if (!authed) return null; // carnet réservé aux connectés

    const count = entries.length;
    const last = entries[0]?.cooked_at;
    const fmt = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

    const submit = async () => {
        setBusy(true);
        const created = await addCookEntry(recipeId, note, file);
        if (created) {
            setEntries(prev => [created, ...prev]);
            setNote(''); setFile(null); if (fileRef.current) fileRef.current.value = '';
            setOpen(false);
        }
        setBusy(false);
    };

    const remove = async (id: string) => {
        await deleteCookEntry(id);
        setEntries(prev => prev.filter(e => e.id !== id));
    };

    return (
        <div className={styles.wrap}>
            <div className={styles.head}>
                <span className={styles.title}>📔 Mon carnet</span>
                <span className={styles.summary}>
                    {count === 0 ? 'Jamais cuisiné' : `Cuisiné ${count}×${last ? ` · dernière le ${fmt(last)}` : ''}`}
                </span>
            </div>

            {!open ? (
                <button className={styles.cta} onClick={() => setOpen(true)}>{"✓ J'ai cuisiné cette recette"}</button>
            ) : (
                <div className={styles.form}>
                    <textarea
                        className={styles.note}
                        placeholder="Ta note (ex. moins de sel, four à 180°…)"
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        rows={2}
                    />
                    <div className={styles.formRow}>
                        <input ref={fileRef} type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)} className={styles.file} />
                        <button className={styles.save} onClick={submit} disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
                        <button className={styles.cancel} onClick={() => { setOpen(false); setNote(''); setFile(null); }}>Annuler</button>
                    </div>
                </div>
            )}

            {entries.length > 0 && (
                <ul className={styles.list}>
                    {entries.map(e => (
                        <li key={e.id} className={styles.entry}>
                            {e.photo_url && <img src={e.photo_url} alt="" className={styles.thumb} />}
                            <div className={styles.entryBody}>
                                <span className={styles.entryDate}>{fmt(e.cooked_at)}</span>
                                {e.note && <span className={styles.entryNote}>{e.note}</span>}
                            </div>
                            <button className={styles.del} onClick={() => remove(e.id)} title="Supprimer">✕</button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
