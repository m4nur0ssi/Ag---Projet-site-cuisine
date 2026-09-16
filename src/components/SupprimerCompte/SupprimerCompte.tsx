'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import styles from './SupprimerCompte.module.css';

type Etape = 'repos' | 'confirmer' | 'enCours' | 'erreur';

/**
 * « Supprimer mon compte », dans le menu du compte (RGPD, art. 17).
 *
 * Volontairement discret — un lien, pas un bouton — et en DEUX temps : un
 * geste aussi définitif ne doit pas pouvoir partir d'un doigt qui glisse. La
 * confirmation dit précisément ce qui va disparaître.
 *
 * Monté par les deux AuthButton (ordinateur et mobile), qui partagent le même
 * panneau : un seul endroit à tenir.
 */
export default function SupprimerCompte() {
    const [etape, setEtape] = useState<Etape>('repos');
    const [message, setMessage] = useState('');

    async function supprimer() {
        setEtape('enCours');
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            setMessage('Session expirée : reconnecte-toi, puis recommence.');
            setEtape('erreur');
            return;
        }
        try {
            const res = await fetch('/api/supprimer-compte', {
                method: 'POST',
                headers: { authorization: `Bearer ${session.access_token}` },
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setMessage(data?.error || 'La suppression n’a pas abouti.');
                setEtape('erreur');
                return;
            }
        } catch {
            setMessage('Le réseau a coupé avant la fin. Rien n’est perdu : réessaie.');
            setEtape('erreur');
            return;
        }
        // Le compte n'existe plus côté serveur : on ferme la session locale et
        // on repart de l'accueil, sans rien garder en mémoire de l'ancien état.
        await supabase.auth.signOut().catch(() => {});
        window.location.assign('/');
    }

    if (etape === 'repos') {
        return (
            <button type="button" className={styles.lien} onClick={() => setEtape('confirmer')}>
                Supprimer mon compte
            </button>
        );
    }

    return (
        <div className={styles.confirmation} role="alertdialog" aria-label="Supprimer mon compte">
            {etape === 'erreur' ? (
                <p className={styles.texte}>{message}</p>
            ) : (
                <p className={styles.texte}>
                    Favoris, notes, commentaires, menus, liste de courses et cave seront
                    effacés. <strong>C’est définitif.</strong>
                </p>
            )}
            <div className={styles.actions}>
                <button
                    type="button"
                    className={styles.annuler}
                    onClick={() => setEtape('repos')}
                    disabled={etape === 'enCours'}
                >
                    Annuler
                </button>
                <button
                    type="button"
                    className={styles.supprimer}
                    onClick={supprimer}
                    disabled={etape === 'enCours'}
                >
                    {etape === 'enCours' ? 'Suppression…' : etape === 'erreur' ? 'Réessayer' : 'Supprimer'}
                </button>
            </div>
        </div>
    );
}
