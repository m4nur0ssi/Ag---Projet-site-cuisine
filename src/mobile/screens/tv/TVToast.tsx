'use client';

/**
 * Message fugitif des écrans TV+.
 *
 * Les écrans TV (accueil, planificateur, liste, cave) émettent depuis toujours
 * des `magic-toast-notify`, mais personne ne les affichait : seul le Header de
 * l'ancien site les rendait, et il n'est pas monté ici. « Composer » remplissait
 * quatorze repas sans un mot, « Effacer » les retirait de même.
 *
 * Capsule centrée en bas, au-dessus de la barre de navigation, qui s'efface
 * seule. Pas de bouton : rien à décider, juste à savoir.
 */
import { useEffect, useRef, useState } from 'react';
import styles from './tv.module.css';

/**
 * Un message peut porter un FILET : « Annuler », le temps que la capsule reste
 * à l'écran. C'est ce qui remplace la fenêtre de confirmation — on n'interrompt
 * plus avant, on rattrape après. Les émetteurs qui n'envoient qu'un texte
 * continuent de fonctionner tels quels.
 */
export interface ToastDetail {
    text: string;
    undoLabel?: string;
    onUndo?: () => void;
}

type Shown = { text: string; undoLabel: string; onUndo?: () => void };

export default function TVToast() {
    const [msg, setMsg] = useState<Shown | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const onToast = (e: Event) => {
            const detail = (e as CustomEvent).detail as string | ToastDetail;
            const next: Shown | null =
                typeof detail === 'string'
                    ? (detail.trim() ? { text: detail, undoLabel: '' } : null)
                    : (detail && typeof detail.text === 'string' && detail.text.trim()
                        ? { text: detail.text, undoLabel: detail.undoLabel || 'Annuler', onUndo: detail.onUndo }
                        : null);
            if (!next) return;
            setMsg(next);
            if (timer.current) clearTimeout(timer.current);
            // Un filet mérite plus de temps qu'une simple nouvelle : le geste de
            // rattrapage doit être possible sans courir.
            timer.current = setTimeout(() => setMsg(null), next.onUndo ? 7000 : 3600);
        };
        window.addEventListener('magic-toast-notify', onToast);
        return () => {
            window.removeEventListener('magic-toast-notify', onToast);
            if (timer.current) clearTimeout(timer.current);
        };
    }, []);

    if (!msg) return null;
    return (
        <div className={styles.tvToast} role="status" aria-live="polite">
            <span className={styles.tvToastText}>{msg.text}</span>
            {msg.onUndo && (
                <button
                    className={styles.tvToastUndo}
                    onClick={() => { msg.onUndo?.(); setMsg(null); }}
                >
                    {msg.undoLabel}
                </button>
            )}
        </div>
    );
}
