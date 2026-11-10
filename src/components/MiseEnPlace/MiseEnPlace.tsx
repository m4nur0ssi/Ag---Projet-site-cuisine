'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import QuestionCuisine from '@/components/QuestionCuisine/QuestionCuisine';
import styles from './MiseEnPlace.module.css';

/** Un ingrédient à sortir : son nom brut et sa quantité déjà ajustée aux portions. */
export interface ItemMiseEnPlace { key: string; nom: string; /** Précision entre parenthèses (« fraîche ou congelée »), en plus petit. */ precision?: string; quantite?: string; /** Photo de l'ingrédient, si on en a une. */ image?: string | null }

/**
 * Nom et quantité d'un ingrédient TELS QUE la liste de la fiche les affiche (mêmes
 * règles : émojis de tête retirés, quantité recopiée depuis le nom si elle manque,
 * « de/du/des » de tête retirés), pour que la tuile dise la même chose que la liste.
 * `traduire` : la traduction des noms (fiche mobile) ; `ajuster` : mise à l'échelle des portions.
 */
export function libelleIngredient(
    name: string,
    quantity: string | undefined,
    ajuster: (q: string) => string,
    traduire: (t: string) => string = (t) => t,
): { nom: string; precision: string; quantite: string } {
    let qte = quantity || '';
    let nom = (name || '').replace(/^[\uD83C-\uDBFF\uDC00-\uDFFF\u2600-\u27BF\s]+/, '').trim();
    if (!qte) {
        const m = nom.match(/^(\d+(?:[.,]\d+)?\s*(?:g|kg|ml|cl|l|cas|cac|c\.à\.s|c\.à\.c|c\.\s*à\s*(?:soupe|café)|verre|pincée|grammes?|millilitres?|centilitres?|boîtes?|boite|sachets?|pots?|bottes?|tasses?|filets?|tranches?|gousses?|morceaux?|cuillères?|pincées?)?)(?:\s+(.*))?$/i);
        if (m) { qte = m[1].trim(); nom = (m[2] || '').trim(); }
    }
    if (!qte && nom) {
        const m = nom.match(/^(un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\s+(.*)/i);
        if (m) { qte = m[1]; nom = m[2]; }
    }
    nom = traduire(nom.replace(/^(?:de\s+|d'|du\s+|des\s+)/i, '').trim());
    // Les parenthèses passent en précision : même texte que la liste, moins de bruit sur la tuile.
    const precisions: string[] = [];
    nom = nom.replace(/\s*\(([^)]*)\)/g, (_m, p1: string) => { if (p1.trim()) precisions.push(p1.trim()); return ''; }).trim();
    return {
        nom: nom.charAt(0).toUpperCase() + nom.slice(1),
        precision: precisions.join(' · '),
        quantite: qte ? traduire(ajuster(qte)) : '',
    };
}

/** Pastille de repli quand l'ingrédient n'a pas de photo (mêmes familles que la liste de la fiche). */
export function emojiIngredient(nom: string): string {
    const n = nom.toLowerCase();
    const t: [string[], string][] = [
        [['miel', 'honey'], '🍯'], [['poivron'], '🫑'], [['herbe', 'aneth', 'basilic', 'persil', 'ciboulette', 'menthe', 'coriandre'], '🌿'],
        [['fromage', 'mascarpone', 'feta', 'comté', 'parmesan'], '🧀'], [['viande', 'boeuf', 'bœuf', 'bavette'], '🥩'], [['poulet'], '🍗'],
        [['poisson', 'saumon', 'thon', 'crevette'], '🐟'], [['fraise'], '🍓'], [['myrtille'], '🫐'], [['citron'], '🍋'], [['chocolat'], '🍫'],
        [['oeuf', 'œuf', 'jaune'], '🥚'], [['lait'], '🥛'], [['sucre', 'cassonade'], '🍬'], [['beurre'], '🧈'], [['huile'], '🫒'],
        [['vanille'], '🌼'], [['farine', 'levure'], '🌾'], [['crème', 'creme'], '🍦'], [['noix', 'amande', 'pistache'], '🥜'],
        [['tomate'], '🍅'], [['carotte'], '🥕'], [['ail'], '🧄'], [['oignon'], '🧅'], [['piment', 'chili'], '🌶️'], [['riz'], '🍚'],
        [['pâte', 'pasta'], '🍝'], [['pain'], '🍞'], [['pomme', 'fruit', 'mangue'], '🍎'],
    ];
    return t.find(([mots]) => mots.some((m) => n.includes(m)))?.[1] ?? '🥗';
}

/** La photo ; si elle ne charge pas (fichier absent, hors ligne), l'initiale du nom. */
function PhotoIngredient({ src, nom }: { src?: string | null; nom: string }) {
    const [erreur, setErreur] = useState(false);
    if (!src || erreur) return <span className={styles.photoVide} aria-hidden>{emojiIngredient(nom)}</span>;
    return <img src={src} alt="" className={styles.photoImg} draggable={false} loading="lazy" onError={() => setErreur(true)} />;
}

interface MiseEnPlaceProps {
    titre: string;
    image?: string;
    items: ItemMiseEnPlace[];
    servings: number;
    onServings: (n: number) => void;
    /** Lance la recette (appelé dans le geste du clic : la voix et le micro en dépendent). */
    onCommencer: () => void;
    /** Ferme l'écran sans lancer la recette. */
    onFermer: () => void;
}

/**
 * Mise en place : avant la recette, une tuile par ingrédient. On touche une tuile
 * quand l'ingrédient est sorti et pesé ; elle se retourne (« ✓ Prêt ») et passe
 * en fin de grille. Les quantités suivent les portions, modifiables ici.
 * Les coches sont volontairement jetées à chaque ouverture : c'est une étape
 * de préparation, pas une liste de courses.
 */
export default function MiseEnPlace({ titre, image, items, servings, onServings, onCommencer, onFermer }: MiseEnPlaceProps) {
    const [prets, setPrets] = useState<Record<string, boolean>>({});
    const nbPrets = items.filter((i) => prets[i.key]).length;
    const toutPret = items.length > 0 && nbPrets === items.length;
    const ordre = [...items.filter((i) => !prets[i.key]), ...items.filter((i) => prets[i.key])];
    const basculer = (k: string) => setPrets((p) => ({ ...p, [k]: !p[k] }));

    return (
        <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Mise en place">
            <div className={styles.entete}>
                {image && <img src={image} alt="" className={styles.miniature} draggable={false} />}
                <div className={styles.titre}>{titre}</div>
                <QuestionCuisine titre={titre} ingredients={items.map((i) => `${i.quantite || ''} ${i.nom}`.trim())} />
                <button type="button" className={styles.fermer} onClick={onFermer} aria-label="Fermer la mise en place">✕</button>
            </div>

            <div className={styles.corps}>
                <div className={styles.kicker}>Mise en place</div>
                <p className={styles.intro}>Sors et pèse chaque ingrédient, puis touche sa tuile.</p>

                <div className={styles.ligneHaut}>
                    <div className={styles.portions} role="group" aria-label="Nombre de personnes">
                        <button type="button" onClick={() => onServings(Math.max(1, servings - 1))} aria-label="Une personne de moins">−</button>
                        <span>{servings} pers.</span>
                        <button type="button" onClick={() => onServings(Math.min(30, servings + 1))} aria-label="Une personne de plus">+</button>
                    </div>
                    <div className={styles.compte}>{nbPrets} / {items.length} prêts</div>
                </div>
                <div className={styles.barre}>
                    <div className={`${styles.barreFill} ${toutPret ? styles.barrePleine : ''}`} style={{ width: `${items.length ? (nbPrets / items.length) * 100 : 0}%` }} />
                </div>

                <motion.ul className={styles.grille} layout>
                    {ordre.map((it, rang) => {
                        const pret = !!prets[it.key];
                        const nom = it.nom;
                        return (
                            <motion.li
                                key={it.key}
                                layout
                                initial={{ opacity: 0, y: 18, scale: 0.94 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                transition={{
                                    layout: { type: 'spring', stiffness: 380, damping: 34 },
                                    default: { duration: 0.45, delay: Math.min(rang, 12) * 0.035, ease: [0.16, 1, 0.3, 1] },
                                }}
                                className={styles.cellule}
                            >
                                <motion.button
                                    type="button"
                                    onClick={() => basculer(it.key)}
                                    aria-pressed={pret}
                                    whileTap={{ scale: 0.95 }}
                                    className={`${styles.tuile} ${pret ? styles.tuilePrete : ''}`}
                                >
                                    <motion.div
                                        className={styles.interieur}
                                        animate={{ rotateY: pret ? 180 : 0 }}
                                        transition={{ type: 'spring', stiffness: 170, damping: 17, mass: 0.9 }}
                                    >
                                        {/* Face avant : la photo, puis le nom et la quantité */}
                                        <span className={`${styles.face} ${styles.avant}`}>
                                            <span className={styles.photo}>
                                                <PhotoIngredient src={it.image} nom={nom} />
                                            </span>
                                            <span className={styles.legende}>
                                                <span className={styles.nom}>{nom}</span>
                                                {it.precision && <span className={styles.precision}>{it.precision}</span>}
                                                {it.quantite && <span className={styles.qte}>{it.quantite}</span>}
                                            </span>
                                        </span>
                                        {/* Face arrière : verte, coche dessinée */}
                                        <span className={`${styles.face} ${styles.arriere}`}>
                                            <svg className={styles.coche} width="46" height="46" viewBox="0 0 24 24" fill="none" aria-hidden>
                                                <circle cx="12" cy="12" r="10.5" stroke="currentColor" strokeWidth="1.6" opacity="0.35" />
                                                <motion.path
                                                    d="M6.5 12.5 10.5 16.5 17.5 8"
                                                    stroke="currentColor"
                                                    strokeWidth="2.6"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    initial={false}
                                                    animate={{ pathLength: pret ? 1 : 0 }}
                                                    transition={{ duration: 0.4, delay: pret ? 0.25 : 0, ease: 'easeOut' }}
                                                />
                                            </svg>
                                            <span className={styles.pretTexte}>Prêt</span>
                                            <span className={styles.pretNom}>{nom}</span>
                                        </span>
                                    </motion.div>
                                </motion.button>
                            </motion.li>
                        );
                    })}
                </motion.ul>
            </div>

            <div className={styles.pied}>
                <button type="button" className={`${styles.commencer} ${toutPret ? styles.commencerPret : ''}`} onClick={onCommencer}>
                    {toutPret ? 'Tout est prêt, on commence' : 'Commencer la cuisine'}
                </button>
            </div>
        </div>
    );
}
