'use client';
/**
 * Le bandeau du déroulé démarré : il dit quelle est la prochaine étape, sonne
 * quand son heure arrive, et attend la réponse — « OK » (c'est fait) ou
 * « dans 5 / 10 min » (un peu de retard). Le retard glisse sur tout le reste.
 *
 * Monté par le planificateur (il vit tant qu'on y reste ; l'état, lui, survit
 * dans le stockage de l'appareil et reprend où l'on en était).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TimelineInput } from '@/lib/cooking-timeline';
import {
    useDemarrage, ecrireDemarrage, etapesDeroule, minutesMaintenant, horloge, arreter, notifier,
} from '@/lib/demarrage';
import styles from './DemarrageBandeau.module.css';

const consigne = (e: { kind: string; label: string; title: string; passive: number; passiveLabel: string }) =>
    e.kind === 'act' ? `Prépare ${e.label.toLowerCase()} — ${e.title}`
    : e.kind === 'pass' ? `Lance ${(e.passiveLabel || 'la cuisson').toLowerCase()} de ${e.title} — ${e.passive} min sans toi`
    : 'Service — tout est prêt';

export default function DemarrageBandeau({ items }: { items: TimelineInput[] }) {
    const etat = useDemarrage();
    const [now, setNow] = useState(() => minutesMaintenant());
    const [monte, setMonte] = useState(false);
    const dejaAnnonce = useRef<string | null>(null);

    useEffect(() => { setMonte(true); }, []);

    // L'horloge bat toutes les 10 s tant que le déroulé est lancé, et se recale
    // au retour dans l'app (un téléphone en veille fige les minuteurs).
    useEffect(() => {
        if (!etat) return;
        const tick = () => setNow(minutesMaintenant());
        tick();
        const id = setInterval(tick, 10_000);
        document.addEventListener('visibilitychange', tick);
        return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick); };
    }, [!!etat]); // eslint-disable-line react-hooks/exhaustive-deps

    // L'écran reste allumé : on cuisine les mains pleines, pas question de le déverrouiller.
    useEffect(() => {
        if (!etat) return;
        let verrou: { release: () => Promise<void> } | null = null;
        const prendre = async () => {
            try { verrou = await (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request('screen') || null; } catch { /* refusé */ }
        };
        void prendre();
        const retour = () => { if (document.visibilityState === 'visible') void prendre(); };
        document.addEventListener('visibilitychange', retour);
        return () => { document.removeEventListener('visibilitychange', retour); void verrou?.release(); };
    }, [!!etat]); // eslint-disable-line react-hooks/exhaustive-deps

    const etapes = useMemo(() => (etat ? etapesDeroule(items, etat.serve) : []), [items, etat?.serve]); // eslint-disable-line react-hooks/exhaustive-deps
    const prochaine = etat ? etapes.find((e) => !etat.faits.includes(e.id)) : undefined;
    const prevue = prochaine && etat ? prochaine.t + etat.decalage : 0;
    const arrive = !!prochaine && now >= prevue;

    // Une seule annonce par étape, au moment où son heure arrive.
    useEffect(() => {
        if (!prochaine || !arrive || dejaAnnonce.current === prochaine.id) return;
        dejaAnnonce.current = prochaine.id;
        void notifier(`Jour J · ${horloge(prevue)}`, consigne(prochaine));
    }, [prochaine?.id, arrive]); // eslint-disable-line react-hooks/exhaustive-deps

    // Plus d'étape : tout est fait, on range.
    useEffect(() => { if (etat && etapes.length && !prochaine) arreter(); }, [etat, etapes.length, prochaine]);

    if (!monte || !etat) return null;

    if (!prochaine) return null;

    const ok = () => {
        // Le retard réel (OK donné après l'heure prévue) décale tout ce qui reste.
        const retard = Math.max(0, now - prevue);
        const decalage = retard >= 1 ? etat.decalage + retard : etat.decalage;
        ecrireDemarrage({ ...etat, decalage, faits: [...etat.faits, prochaine.id] });
        if (prochaine.kind === 'serve') {
            window.dispatchEvent(new CustomEvent('magic-toast-notify', { detail: 'Bon appétit ! 🍽️' }));
        }
    };
    const dans = (m: number) => {
        // L'étape glisse pour tomber dans m minutes ; tout ce qui suit la suit.
        ecrireDemarrage({ ...etat, decalage: Math.max(etat.decalage, now + m - prochaine.t) });
        dejaAnnonce.current = null;   // elle sonnera de nouveau le moment venu
    };

    const attente = Math.max(0, Math.ceil(prevue - now));
    const restantes = etapes.filter((e) => !etat.faits.includes(e.id)).length;

    return createPortal(
        <div className={`${styles.bandeau} ${arrive ? styles.arrive : ''}`} role="status" aria-live="polite">
            <div className={styles.tete}>
                <span className={styles.heure}>{horloge(prevue)}</span>
                <span className={styles.statut}>
                    {arrive ? 'C’est l’heure' : `Prochaine étape · dans ${attente} min`}
                </span>
                <span className={styles.reste}>{restantes} étape{restantes > 1 ? 's' : ''}</span>
                <button className={styles.stop} onClick={arreter} aria-label="Arrêter le déroulé">✕</button>
            </div>
            <div className={styles.texte}>{consigne(prochaine)}</div>
            <div className={styles.actions}>
                <button className={styles.ok} onClick={ok}>OK, c’est fait</button>
                <button className={styles.plus} onClick={() => dans(5)}>Dans 5 min</button>
                <button className={styles.plus} onClick={() => dans(10)}>Dans 10 min</button>
            </div>
        </div>,
        document.body,
    );
}
