'use client';

/**
 * « Ajouter au planificateur », depuis n'importe où.
 * =================================================
 *
 * Jusqu'ici la semaine ne se remplissait que dans un sens : on ouvrait le
 * planificateur, on tapait un créneau vide, on cherchait une recette. Le geste
 * inverse — je tiens une recette, je veux la caser — n'existait pas.
 *
 * Ce volet est ce geste. Il montre LA SEMAINE, telle qu'elle est déjà remplie,
 * et il suffit de toucher la case voulue. Pas d'écran intermédiaire, pas de
 * question posée : la case se remplit sous le doigt, on la retouche pour se
 * raviser. On part quand on veut, la semaine est déjà enregistrée.
 *
 * Les mêmes cases, les mêmes règles et le même stockage que `/tv-planner` :
 * tout passe par `screens/tv/plan.ts`.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Portal from '@/mobile/components/Portal';
import { FERMER_FICHE } from '@/lib/ficheEvents';
import { Recipe } from '@/mobile/types';
import { decodeHtml } from '@/mobile/lib/utils';
import { chargerVideos, completer, detailsPrets } from '@/mobile/data/videos-embed';
import { supabase } from '@/mobile/lib/supabase';
import {
    DAYS, DAY_FULL, MEALS, JOUR_J, COURSES,
    chargerPlan, enregistrerPlan, lirePlan, placesPour, poserRecette, prendreEnMain, todayIndex,
    type Plan,
} from '@/mobile/screens/tv/plan';
import styles from './PlanPicker.module.css';

const buzz = (ms: number) => { try { navigator.vibrate?.(ms); } catch { /* noop */ } };

const titre = (r: Recipe) => decodeHtml(r.title || '');

interface PlanPickerProps {
    recipe: Recipe;
    open: boolean;
    onClose: () => void;
    /**
     * Ce que fait « Ouvrir le planificateur ».
     *
     * Au téléphone c'est une page (`/tv-planner`) ; au bureau, un calque tenu
     * par l'en-tête, qu'on fait apparaître sans changer d'adresse.
     */
    ouvrirPlanificateur?: () => void;
}

export default function PlanPicker({ recipe: recette, open, onClose, ouvrirPlanificateur }: PlanPickerProps) {
    const router = useRouter();
    const [plan, setPlan] = useState<Plan>({});
    /*
     * La recette COMPLÈTE, ingrédients compris.
     *
     * Les cartes de l'accueil sont allégées : elles n'emportent ni étapes ni
     * ingrédients. Poser une telle recette dans la semaine donnait un repas
     * planifié dont la liste de courses était vide, et les règles de créneau
     * (« ce plat est-il cuisinable ? ») répondaient toujours non. On rend donc
     * ses pièces à la recette avant de la ranger.
     */
    const [details, setDetails] = useState(0);
    useEffect(() => {
        // Au bureau, le catalogue arrive complet : rien à recharger.
        if (!open || (recette.ingredients || []).length > 0 || detailsPrets()) return;
        let vivant = true;
        chargerVideos().then(() => { if (vivant) setDetails((n) => n + 1); });
        return () => { vivant = false; };
    }, [open, recette]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const recipe = useMemo(() => completer(recette), [recette, details]);
    // Ce qu'on vient de poser : la case s'allume un instant, pour que le geste
    // se voie même quand la vignette met du temps à arriver.
    const [flash, setFlash] = useState<string | null>(null);

    const id = String(recipe.id);
    /** Faux tant que les ingrédients n'ont pas rejoint la recette. */
    const pret = (recipe.ingredients || []).length > 0 || detailsPrets();
    const places = useMemo(() => placesPour(recipe), [recipe]);
    const aujourdhui = DAYS[todayIndex()];

    /*
     * Le planificateur est réservé aux membres connectés — c'est déjà vrai de
     * l'écran lui-même. Sans ce garde-fou, on pouvait remplir sa semaine ici
     * puis se heurter à un mur en allant la regarder.
     * `null` = on ne sait pas encore.
     */
    const [connecte, setConnecte] = useState<boolean | null>(null);
    useEffect(() => {
        if (!open) return;
        let vivant = true;
        supabase.auth.getSession().then(({ data }) => { if (vivant) setConnecte(!!data.session); });
        return () => { vivant = false; };
    }, [open]);

    // Le plan du compte à l'ouverture ; le cache local répond en attendant.
    useEffect(() => {
        if (!open) return;
        setPlan(lirePlan());
        let vivant = true;
        chargerPlan().then((p) => { if (vivant) setPlan(p); });
        return () => { vivant = false; };
    }, [open]);

    useEffect(() => {
        if (!flash) return;
        const t = setTimeout(() => setFlash(null), 900);
        return () => clearTimeout(t);
    }, [flash]);

    /*
     * Le geste « retour » est déclaré par l'ÉCRAN qui ouvre ce volet
     * (`useBackToClose` dans l'accueil TV et dans la fiche recette), pas ici.
     *
     * Ce composant arrive par un import à la demande : il monte une fraction de
     * seconde APRÈS le clic. Trop tard pour reprendre l'entrée d'historique que
     * le menu vient de libérer — elle était déjà rendue, et la pile gagnait un
     * aller-retour parasite à chaque ouverture.
     */

    /**
     * Toucher une case. Elle prend la recette ; la retoucher la libère.
     * Une case occupée par AUTRE CHOSE se remplace — c'est ce qu'on attend
     * d'un créneau qu'on désigne exprès.
     */
    const toggle = useCallback((jour: string, repas: string) => {
        // Le temps que la session revienne, la grille est déjà à l'écran : on ne
        // laisse pas remplir un planificateur qu'on n'aura pas le droit de lire.
        if (connecte === false) return;
        const occupe = plan[jour]?.[repas];
        const cestMoi = occupe && String(occupe.id) === id;
        const next = poserRecette(plan, jour, repas, cestMoi ? null : recipe);
        setPlan(next);
        void enregistrerPlan(next);
        buzz(cestMoi ? 8 : 14);
        if (!cestMoi) setFlash(`${jour}|${repas}`);
    }, [plan, id, recipe, connecte]);

    if (!open) return null;

    /** Une case : vide, prise par cette recette, ou prise par une autre. */
    const Case = ({ jour, repas, libelle }: { jour: string; repas: string; libelle?: string }) => {
        const occupe = plan[jour]?.[repas];
        const cestMoi = !!occupe && String(occupe.id) === id;
        const cle = `${jour}|${repas}`;
        return (
            <button
                type="button"
                className={`${styles.slot} ${cestMoi ? styles.slotMine : ''} ${occupe && !cestMoi ? styles.slotTaken : ''} ${flash === cle ? styles.slotFlash : ''}`}
                onClick={() => toggle(jour, repas)}
                aria-pressed={cestMoi}
                aria-label={
                    cestMoi
                        ? `Retirer de ${DAY_FULL[jour] || jour} ${(libelle || repas).toLowerCase()}`
                        : `Mettre à ${DAY_FULL[jour] || jour} ${(libelle || repas).toLowerCase()}`
                }
            >
                <span className={styles.slotLabel}>{libelle || repas}</span>
                {cestMoi ? (
                    <span className={styles.slotDone}>
                        <svg viewBox="0 0 24 24" fill="none" aria-hidden><path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        Ajouté
                    </span>
                ) : occupe ? (
                    <span className={styles.slotTakenText}>{titre(occupe)}</span>
                ) : (
                    <span className={styles.slotEmpty}>+</span>
                )}
            </button>
        );
    };

    const poses = DAYS.reduce(
        (n, d) => n + MEALS.filter((m) => String(plan[d]?.[m]?.id) === id).length,
        COURSES.filter((c) => String(plan[JOUR_J]?.[c.label]?.id) === id).length,
    );

    return (
        <Portal>
            <AnimatePresence>
                <motion.div
                    key="planpicker"
                    className={styles.backdrop}
                    onClick={onClose}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                >
                    <motion.div
                        className={styles.sheet}
                        onClick={(e) => e.stopPropagation()}
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 30, stiffness: 320 }}
                        role="dialog"
                        aria-label="Ajouter au planificateur"
                    >
                        <div className={styles.grip} />

                        <header className={styles.head}>
                            {recipe.image && <img className={styles.thumb} src={recipe.image} alt="" draggable={false} />}
                            <div className={styles.headText}>
                                <div className={styles.kicker}>Ajouter au planificateur</div>
                                <div className={styles.name}>{titre(recipe)}</div>
                            </div>
                        </header>

                        {connecte === false ? (
                            <div className={styles.gate}>
                                <p className={styles.gateTexte}>
                                    Le planificateur de la semaine est réservé aux membres
                                    connectés.
                                </p>
                                <button
                                    type="button"
                                    className={styles.footMain}
                                    onClick={() => {
                                        onClose();
                                        window.dispatchEvent(new Event('magic-open-auth'));
                                    }}
                                >
                                    Se connecter
                                </button>
                            </div>
                        ) : (
                        <>
                        <p className={styles.hint}>
                            {places.semaine || places.courses.length
                                ? 'Touchez le créneau voulu. Retouchez-le pour l’enlever.'
                                : pret
                                    ? 'Cette recette n’entre dans aucun créneau du planificateur.'
                                    /* Les ingrédients arrivent : sans eux, on ne sait pas
                                       encore à quels créneaux la recette a droit. */
                                    : 'Un instant…'}
                        </p>

                        <div className={styles.body}>
                            {places.semaine && (
                                <section className={styles.section}>
                                    <h3 className={styles.sectionTitle}>La semaine</h3>
                                    <div className={styles.week}>
                                        {DAYS.map((d) => (
                                            <div key={d} className={`${styles.dayRow} ${d === aujourdhui ? styles.dayToday : ''}`}>
                                                <div className={styles.dayName}>
                                                    {DAY_FULL[d]}
                                                    {d === aujourdhui && <span className={styles.todayTag}>Aujourd’hui</span>}
                                                </div>
                                                <div className={styles.daySlots}>
                                                    {MEALS.map((m) => <Case key={m} jour={d} repas={m} />)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {places.courses.length > 0 && (
                                <section className={styles.section}>
                                    <h3 className={styles.sectionTitle}>Le repas du Jour J</h3>
                                    <div className={styles.courses}>
                                        {places.courses.map((c) => (
                                            <Case key={c} jour={JOUR_J} repas={c} libelle={c} />
                                        ))}
                                    </div>
                                </section>
                            )}
                        </div>

                        </>
                        )}

                        {connecte !== false && (
                        <footer className={styles.foot}>
                            <button type="button" className={styles.footGhost} onClick={onClose}>
                                {poses > 0 ? 'Terminé' : 'Fermer'}
                            </button>
                            <button
                                type="button"
                                className={styles.footMain}
                                onClick={() => {
                                    /*
                                     * On NE FERME PAS le volet ici : c'est la navigation
                                     * qui l'emporte avec l'écran.
                                     *
                                     * L'accueil TV tient une pile d'historique commune à
                                     * ses calques ; celui qui se ferme par un bouton rend
                                     * son entrée d'un `history.back()` différé. Fermé
                                     * juste avant un `router.push`, ce retour tombait
                                     * pendant la navigation et la ramenait à l'accueil —
                                     * le bouton semblait ne rien faire.
                                     *
                                     * En revanche la fiche recette, elle, flotte au-dessus
                                     * de TOUTES les pages : elle nous suivrait jusque dans
                                     * le planificateur. On lui demande de s'écarter.
                                     */
                                    /* La recette part AVEC nous : le planificateur la
                                       trouvera en main et proposera de la poser
                                       directement, sans avoir à la rechercher. */
                                    prendreEnMain(recipe);
                                    window.dispatchEvent(new Event(FERMER_FICHE));
                                    if (ouvrirPlanificateur) { onClose(); ouvrirPlanificateur(); }
                                    else router.push('/tv-planner');
                                }}
                            >
                                {poses > 0 ? 'Voir le planificateur' : 'Choisir dans le planificateur'}
                            </button>
                        </footer>
                        )}
                    </motion.div>
                </motion.div>
            </AnimatePresence>
        </Portal>
    );
}
