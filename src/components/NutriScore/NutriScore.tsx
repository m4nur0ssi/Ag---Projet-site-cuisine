'use client';
/**
 * Le Nutri-Score d'une recette, à l'écran.
 *
 * Un bandeau replié : l'échelle A–E avec la lettre du plat mise en avant, et
 * une phrase qui dit ce qu'elle vaut. On le déplie pour voir sur quoi elle
 * repose — les quatre composantes qui pénalisent, les trois qui rachètent, et
 * le nombre d'ingrédients réellement pesés.
 *
 * Le dépliage sert d'abord l'honnêteté : une lettre seule se lit comme un
 * verdict, alors qu'elle sort d'une estimation. Les valeurs pour 100 g et le
 * compte des lignes pesées permettent de juger si on peut lui faire confiance.
 */
import { useState, useId, useRef, useLayoutEffect } from 'react';
import { motion } from 'framer-motion';
import {
    COULEURS_NUTRISCORE,
    LEGENDES_NUTRISCORE,
    type Lettre,
    type ResultatNutriscore,
} from '@/lib/nutriscore';
import styles from './NutriScore.module.css';

const LETTRES: Lettre[] = ['A', 'B', 'C', 'D', 'E'];

/** Une composante du score : sa valeur, et où elle se situe sur son échelle. */
function Composante({ nom, valeur, unite, part, favorable, decimales = 1, visible }: {
    nom: string;
    valeur: number;
    unite: string;
    /** 0 → rien, 1 → au maximum du barème. Ne sert qu'à dessiner la jauge. */
    part: number;
    favorable?: boolean;
    decimales?: number;
    /** Les jauges se remplissent à l'ouverture, pas dans un panneau replié. */
    visible: boolean;
}) {
    const pleine = Math.max(0, Math.min(1, part));
    return (
        <div className={styles.composante}>
            <span className={styles.composanteNom}>{nom}</span>
            <span className={styles.jauge} aria-hidden="true">
                <motion.span
                    className={favorable ? styles.jaugeBonne : styles.jaugeMauvaise}
                    initial={false}
                    animate={{ scaleX: visible ? pleine : 0 }}
                    transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: visible ? 0.1 : 0 }}
                />
            </span>
            <span className={styles.composanteValeur}>
                {valeur.toLocaleString('fr-FR', {
                    minimumFractionDigits: decimales,
                    maximumFractionDigits: decimales,
                })}
                <span className={styles.composanteUnite}> {unite}</span>
            </span>
        </div>
    );
}

export default function NutriScore({ resultat }: { resultat: ResultatNutriscore }) {
    const [ouvert, setOuvert] = useState(false);
    const idPanneau = useId();

    /*
     * La hauteur du panneau est MESURÉE, puis animée en pixels.
     *
     * On ne peut pas faire glisser une hauteur vers `auto` en CSS : il faut un
     * nombre. Plutôt que de le confier à la bibliothèque de mouvement, on mesure
     * le contenu une fois et on anime vers cette valeur — le dépliage ne dépend
     * alors que de la feuille de style, et le bandeau se comporte pareil partout
     * où on le pose. L'observateur suit les reflux (rotation de l'écran,
     * changement de corps de texte) pour que la mesure reste juste ensuite.
     */
    const interieurRef = useRef<HTMLDivElement>(null);
    const [hauteur, setHauteur] = useState(0);
    useLayoutEffect(() => {
        const el = interieurRef.current;
        if (!el) return;
        const mesurer = () => setHauteur(el.getBoundingClientRect().height);
        mesurer();
        if (typeof ResizeObserver === 'undefined') return;
        const observateur = new ResizeObserver(mesurer);
        observateur.observe(el);
        return () => observateur.disconnect();
    }, []);
    const { lettre, pour100g: v } = resultat;
    const couleur = COULEURS_NUTRISCORE[lettre];

    return (
        <section
            className={styles.bloc}
            style={{ ['--nutri' as string]: couleur }}
        >
            <button
                type="button"
                className={styles.entete}
                onClick={() => setOuvert((o) => !o)}
                aria-expanded={ouvert}
                aria-controls={idPanneau}
            >
                <span className={styles.intitule}>
                    <span className={styles.titre}>NUTRI-SCORE</span>
                    <span className={styles.legende}>{LEGENDES_NUTRISCORE[lettre]}</span>
                </span>

                <span className={styles.echelle} role="img" aria-label={`Nutri-Score ${lettre} sur une échelle de A à E`}>
                    {LETTRES.map((l) => {
                        const actif = l === lettre;
                        return (
                <motion.span
                    key={l}
                    className={actif ? styles.lettreActive : styles.lettre}
                    style={actif ? { background: COULEURS_NUTRISCORE[l] } : undefined}
                    initial={false}
                    animate={{ scale: actif ? 1 : 0.82 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                >
                    {l}
                </motion.span>
                        );
                    })}
                </span>

                <motion.span
                    className={styles.chevron}
                    animate={{ rotate: ouvert ? 180 : 0 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    aria-hidden="true"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9" />
                    </svg>
                </motion.span>
            </button>

            {/*
              * Le panneau reste MONTÉ, replié à zéro.
              *
              * Le monter et le démonter à chaque bascule obligerait à remesurer
              * son contenu à chaque ouverture, et ferait de l'ouverture rapide
              * suivie d'une fermeture une course entre l'animation de sortie et
              * le remontage. Il ne pèse que du texte : le laisser en place coûte
              * moins cher que de l'orchestrer.
              */}
            <div
                id={idPanneau}
                className={styles.panneau}
                style={{ height: ouvert ? hauteur : 0, opacity: ouvert ? 1 : 0 }}
                aria-hidden={!ouvert}
            >
                <div className={styles.panneauInterieur} ref={interieurRef}>
                    <p className={styles.pour100}>Pour 100 g de plat préparé</p>

                    <Composante nom="Énergie" valeur={Math.round(v.kcal)} unite="kcal" decimales={0} part={v.kJ / 3350} visible={ouvert} />
                    <Composante nom="Sucres" valeur={v.sucres} unite="g" part={v.sucres / 51} visible={ouvert} />
                    <Composante nom="Acides gras saturés" valeur={v.satures} unite="g" part={v.satures / 10} visible={ouvert} />
                    <Composante nom="Sel" valeur={v.sel} unite="g" decimales={2} part={v.sel / 4} visible={ouvert} />

                    <div className={styles.separateur} />

                    <Composante nom="Protéines" valeur={v.proteines} unite="g" part={v.proteines / 17} favorable visible={ouvert} />
                    <Composante nom="Fibres" valeur={v.fibres} unite="g" part={v.fibres / 7.4} favorable visible={ouvert} />
                    <Composante nom="Fruits et légumes" valeur={v.fln} unite="%" decimales={0} part={v.fln / 100} favorable visible={ouvert} />

                    {/*
                      * Pas de calories ici : la fiche en donne déjà, deux cases plus
                      * haut, et elles viennent d'un autre calcul. Les deux chiffres
                      * ne tombaient pas juste ensemble — 447 contre 569 pour le même
                      * plat — et rien à l'écran ne disait lequel croire. Le bandeau
                      * s'en tient donc au poids et aux macros, que lui seul avance.
                      */}
                    <p className={styles.portion}>
                        Une portion ≈ <strong>{resultat.parPortion.poids} g</strong> —{' '}
                        {resultat.parPortion.proteines} g de protéines,{' '}
                        {resultat.parPortion.glucides} g de glucides,{' '}
                        {resultat.parPortion.lipides} g de lipides.
                    </p>

                    <p className={styles.reserve}>
                        Estimation : les quantités sont lues dans la liste d&rsquo;ingrédients
                        ({resultat.reconnues} sur {resultat.lignes} reconnus, {resultat.poidsTotal} g au total)
                        et rapportées au poids cru du plat. La cuisson n&rsquo;est pas prise en compte.
                    </p>
                </div>
            </div>
        </section>
    );
}
