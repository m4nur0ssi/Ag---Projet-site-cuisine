'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getCookEntries, addCookEntry, deleteCookEntry, updateCookEntry, type CookEntry } from '@/lib/cookingLog';
import { marquerCuisinee, oublierCuisinee } from '@/lib/dejaCuisine';
import styles from './CookingJournal.module.css';

// #11 — Carnet de cuisine perso affiché dans la fiche recette.
// variant 'restaurant' → wording adapté (« j'ai testé ce restaurant »).
export default function CookingJournal({ recipeId, variant = 'recipe', image, recipe, onPartager }: { recipeId: string; variant?: 'recipe' | 'restaurant'; /** Photo de la fiche : la référence de « avant / après ». */ image?: string; recipe?: unknown; onPartager?: (recipe: unknown) => void }) {
    const isResto = variant === 'restaurant';
    const L = isResto
        ? { title: 'Mon avis', never: 'Jamais testé', verb: 'Testé', cta: "✓ J'ai testé ce restaurant", placeholder: 'Ton commentaire (ambiance, plat préféré, service…)' }
        : { title: 'Mon carnet', never: 'Jamais cuisiné', verb: 'Cuisiné', cta: "✓ J'ai cuisiné cette recette", placeholder: 'Ta note (ex. moins de sel, four à 180°…)' };
    const [authed, setAuthed] = useState(false);
    const [entries, setEntries] = useState<CookEntry[]>([]);
    const [open, setOpen] = useState(false);
    // « Ma version » : la photo du plat cuisiné, optionnelle.
    const [note, setNote] = useState('');
    const [fichier, setFichier] = useState<File | null>(null);
    const [apercu, setApercu] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [editId, setEditId] = useState<string | null>(null);
    const [editNote, setEditNote] = useState('');
    const [editBusy, setEditBusy] = useState(false);
    const [editFichier, setEditFichier] = useState<File | null>(null);
    const [editApercu, setEditApercu] = useState<string | null>(null);
    const [photoBusyId, setPhotoBusyId] = useState<string | null>(null);

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
        const { entry, error } = await addCookEntry(recipeId, note, fichier);
        if (entry) {
            setEntries(prev => [entry, ...prev]);
            // La vignette porte sa coche dans la seconde, sans attendre un
            // aller-retour avec le compte.
            marquerCuisinee(recipeId);
            setNote('');
            setFichier(null);
            if (apercu) URL.revokeObjectURL(apercu);
            setApercu(null);
            setOpen(false);
            notifier();
        } else if (error === 'auth') {
            // Session expirée : on propose la reconnexion (sinon l'insert reste bloqué en 401).
            setErr('Ta session a expiré. Reconnecte-toi pour enregistrer.');
            window.dispatchEvent(new CustomEvent('magic-open-auth'));
        } else {
            setErr(error && error.startsWith('Photo') ? error : "Échec de l'enregistrement. Réessaie.");
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
    // Prévient la fiche : ses photos cuisinées (image principale) se recalculent.
    const notifier = () => window.dispatchEvent(new CustomEvent('magic-cook-changed', { detail: recipeId }));

    const fermerEdit = () => {
        if (editApercu) URL.revokeObjectURL(editApercu);
        setEditId(null); setEditFichier(null); setEditApercu(null);
    };
    const startEdit = (e: CookEntry) => { fermerEdit(); setEditId(e.id); setEditNote(e.note || ''); };
    const saveEdit = async (id: string) => {
        setEditBusy(true);
        const updated = await updateCookEntry(id, editNote.trim(), editFichier, recipeId);
        if (updated) setEntries(prev => prev.map(e => e.id === id ? { ...e, note: updated.note, photo_url: updated.photo_url } : e));
        else if (editFichier) { setErr('Photo non envoyée. Réessaie (ou choisis une autre photo).'); setEditBusy(false); return; }
        setEditBusy(false);
        fermerEdit();
        notifier();
    };
    // Photo ajoutée directement depuis la tuile : même entrée, pas de nouveau commentaire.
    const addPhoto = async (id: string, f: File | null) => {
        if (!f) return;
        setPhotoBusyId(id);
        const updated = await updateCookEntry(id, undefined, f, recipeId);
        if (updated) setEntries(prev => prev.map(e => e.id === id ? { ...e, photo_url: updated.photo_url } : e));
        else setErr('Photo non envoyée. Réessaie (ou choisis une autre photo).');
        setPhotoBusyId(null);
        notifier();
    };

    return (
        <div className={styles.wrap}>
            <div className={styles.head}>
                <span className={styles.title}>{L.title}</span>
                <span className={styles.summary}>
                    {count === 0 ? L.never : (last ? `le ${fmt(last)}` : '')}
                </span>
            </div>

            {!open && err && <div className={styles.err}>{err}</div>}
            {!open ? (
                <button className={styles.cta} onClick={() => setOpen(true)}>{L.cta}</button>
            ) : (
                <div className={styles.form}>
                    <div className={styles.noteLigne}>
                        <textarea
                            className={styles.note}
                            placeholder={L.placeholder}
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            rows={2}
                        />
                        <label className={styles.photoChoix}>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={e => {
                                    const f = e.target.files?.[0] || null;
                                    setFichier(f);
                                    if (apercu) URL.revokeObjectURL(apercu);
                                    setApercu(f ? URL.createObjectURL(f) : null);
                                }}
                            />
                            {apercu ? <img src={apercu} alt="Aperçu de ma version" className={styles.photoApercu} /> : <span>+ Photo</span>}
                        </label>
                    </div>
                    <div className={styles.formRow}>
                        <button className={styles.save} onClick={submit} disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
                        <button className={styles.cancel} onClick={() => { setOpen(false); setNote(''); setFichier(null); setApercu(null); setErr(null); }}>Annuler</button>
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
                                    <label className={styles.photoChoix}>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={ev => {
                                                const f = ev.target.files?.[0] || null;
                                                setEditFichier(f);
                                                if (editApercu) URL.revokeObjectURL(editApercu);
                                                setEditApercu(f ? URL.createObjectURL(f) : null);
                                            }}
                                        />
                                        {editApercu || e.photo_url
                                            ? <img src={editApercu || (e.photo_url as string)} alt="Ma photo" className={styles.photoApercu} />
                                            : <span>+ Ajouter ma photo</span>}
                                    </label>
                                    <div className={styles.formRow}>
                                        <button className={styles.save} onClick={() => saveEdit(e.id)} disabled={editBusy}>{editBusy ? 'Enregistrement…' : 'Enregistrer'}</button>
                                        <button className={styles.cancel} onClick={fermerEdit}>Annuler</button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className={styles.entryBody}>
                                        <span className={styles.entryDate}>{fmt(e.cooked_at)}</span>
                                        {e.note && <span className={styles.entryNote}>{e.note}</span>}
                                    </div>
                                    {e.photo_url && (
                                        <a href={e.photo_url} target="_blank" rel="noreferrer" className={styles.entryPhoto} title="Voir la photo">
                                            <img src={e.photo_url} alt="Ma photo" loading="lazy" />
                                        </a>
                                    )}
                                    <div className={styles.entryActions}>
                                        {!e.photo_url && (
                                            <label className={styles.editBtn} title="Ajouter une photo" aria-label="Ajouter une photo" style={{ opacity: photoBusyId === e.id ? 0.4 : 1 }}>
                                                <input type="file" accept="image/*" className={styles.fileHidden} disabled={photoBusyId === e.id}
                                                    onChange={ev => { addPhoto(e.id, ev.target.files?.[0] || null); ev.target.value = ''; }} />
                                                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                                            </label>
                                        )}
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
