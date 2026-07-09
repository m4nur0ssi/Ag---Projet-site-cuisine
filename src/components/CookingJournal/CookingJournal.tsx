'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getCookEntries, addCookEntry, deleteCookEntry, type CookEntry } from '@/lib/cookingLog';
import styles from './CookingJournal.module.css';

// #11 — Carnet de cuisine perso affiché dans la fiche recette.
// variant 'restaurant' → wording adapté (« j'ai testé ce restaurant »).
export default function CookingJournal({ recipeId, variant = 'recipe' }: { recipeId: string; variant?: 'recipe' | 'restaurant' }) {
    const isResto = variant === 'restaurant';
    const L = isResto
        ? { title: 'Mon avis', never: 'Jamais testé', verb: 'Testé', cta: "✓ J'ai testé ce restaurant", placeholder: 'Ton commentaire (ambiance, plat préféré, service…)' }
        : { title: 'Mon carnet', never: 'Jamais cuisiné', verb: 'Cuisiné', cta: "✓ J'ai cuisiné cette recette", placeholder: 'Ta note (ex. moins de sel, four à 180°…)' };
    const [authed, setAuthed] = useState(false);
    const [entries, setEntries] = useState<CookEntry[]>([]);
    const [open, setOpen] = useState(false);
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

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
        setErr(null);
        const { entry, error } = await addCookEntry(recipeId, note);
        if (entry) {
            setEntries(prev => [entry, ...prev]);
            setNote('');
            setOpen(false);
        } else if (error === 'auth') {
            // Session expirée : on propose la reconnexion (sinon l'insert reste bloqué en 401).
            setErr('Ta session a expiré. Reconnecte-toi pour enregistrer.');
            window.dispatchEvent(new CustomEvent('magic-open-auth'));
        } else {
            setErr("Échec de l'enregistrement. Réessaie.");
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
                <span className={styles.title}>{L.title}</span>
                <span className={styles.summary}>
                    {count === 0 ? L.never : `${L.verb} ${count}×${last ? ` · dernière le ${fmt(last)}` : ''}`}
                </span>
            </div>

            {!open ? (
                <button className={styles.cta} onClick={() => setOpen(true)}>{L.cta}</button>
            ) : (
                <div className={styles.form}>
                    <textarea
                        className={styles.note}
                        placeholder={L.placeholder}
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        rows={2}
                    />
                    <div className={styles.formRow}>
                        <button className={styles.save} onClick={submit} disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
                        <button className={styles.cancel} onClick={() => { setOpen(false); setNote(''); setErr(null); }}>Annuler</button>
                    </div>
                    {err && <div className={styles.err}>{err}</div>}
                </div>
            )}

            {entries.length > 0 && (
                <ul className={styles.list}>
                    {entries.map(e => (
                        <li key={e.id} className={styles.entry}>
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
