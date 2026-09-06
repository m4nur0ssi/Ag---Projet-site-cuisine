'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getCookEntries, addCookEntry, deleteCookEntry, updateCookEntry, type CookEntry } from '@/lib/cookingLog';
import { marquerCuisinee, oublierCuisinee } from '@/lib/dejaCuisine';
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
    const [editId, setEditId] = useState<string | null>(null);
    const [editNote, setEditNote] = useState('');
    const [editBusy, setEditBusy] = useState(false);

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
            // La vignette porte sa coche dans la seconde, sans attendre un
            // aller-retour avec le compte.
            marquerCuisinee(recipeId);
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
        setEntries(prev => {
            const restant = prev.filter(e => e.id !== id);
            // Dernière trace effacée : la recette redevient « jamais faite ».
            if (!restant.length) oublierCuisinee(recipeId);
            return restant;
        });
    };

    // Édition d'une note existante (l'auteur connecté ; RLS le garantit côté base).
    const startEdit = (e: CookEntry) => { setEditId(e.id); setEditNote(e.note || ''); };
    const saveEdit = async (id: string) => {
        setEditBusy(true);
        const updated = await updateCookEntry(id, editNote.trim());
        if (updated) setEntries(prev => prev.map(e => e.id === id ? { ...e, note: updated.note } : e));
        setEditBusy(false);
        setEditId(null);
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
                            {editId === e.id ? (
                                <div className={styles.form} style={{ width: '100%' }}>
                                    <textarea
                                        className={styles.note}
                                        value={editNote}
                                        onChange={ev => setEditNote(ev.target.value)}
                                        placeholder={L.placeholder}
                                        rows={2}
                                        autoFocus
                                    />
                                    <div className={styles.formRow}>
                                        <button className={styles.save} onClick={() => saveEdit(e.id)} disabled={editBusy}>{editBusy ? 'Enregistrement…' : 'Enregistrer'}</button>
                                        <button className={styles.cancel} onClick={() => setEditId(null)}>Annuler</button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className={styles.entryBody}>
                                        <span className={styles.entryDate}>{fmt(e.cooked_at)}</span>
                                        {e.note && <span className={styles.entryNote}>{e.note}</span>}
                                    </div>
                                    <div className={styles.entryActions}>
                                        <button className={styles.editBtn} onClick={() => startEdit(e)} title="Modifier" aria-label="Modifier">
                                            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
                                        </button>
                                        <button className={styles.del} onClick={() => remove(e.id)} title="Supprimer">✕</button>
                                    </div>
                                </>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
