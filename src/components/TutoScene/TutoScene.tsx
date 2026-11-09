'use client';

/**
 * La scène d'une étape du tutoriel, avec les VRAIES cartes du site.
 * ================================================================
 *
 * Partagée par la visite guidée (TVTutorial) et par les bulles d'astuce (Tip) :
 * même étape, même image. Les cartes viennent du catalogue (`TUTO_CARTES`,
 * src/lib/tutoriel.ts) — photo et titre tels que l'accueil les affiche —, pas
 * d'un dessin ni d'une vidéo tournée un jour où l'accueil montrait autre chose.
 */

import { mockRecipes } from '@/data/mockData';
import { TUTO_CARTES, type Art } from '@/lib/tutoriel';
import TutoAnim, { estSceneAnimee } from './TutoAnim';
import styles from './TutoScene.module.css';

/** Les étapes qui ont une scène réelle (les autres gardent leur dessin). */
const ARTS = new Set<Art>(['hero', 'rows', 'press', 'clic', 'side', 'filtres', 'tags', 'search', 'planner', 'fill', 'cave', 'trophy', 'ext', 'card', 'cook', 'timers', 'filter', 'compose', 'jourj', 'demarrer', 'views', 'taste', 'cocktail', 'dock', 'install', 'sidebar', 'library']);
export const aSceneReelle = (art: Art) => ARTS.has(art);

const CATEGORIES: Record<string, string> = {
    aperitifs: 'Apéritifs', entrees: 'Entrées', plats: 'Plats', accompagnements: 'Accompagnements',
    desserts: 'Desserts', patisserie: 'Pâtisseries', rafraichissements: 'Cocktails',
};

type Carte = { id: string; title: string; image: string; category: string };
const carte = (id: string): Carte | null => {
    const r = mockRecipes.find((x) => String(x.id) === id);
    return r && r.image ? { id, title: r.title, image: r.image, category: (r.category || '').toLowerCase() } : null;
};
const cartes = (ids: readonly string[]) => ids.map(carte).filter(Boolean) as Carte[];

function Rangee({ titre, liste, classement, cible }: { titre: string; liste: Carte[]; classement?: boolean; cible?: boolean }) {
    return (
        <div className={styles.rangee}>
            <div className={styles.rangeeTitre}>{titre} <span aria-hidden>›</span></div>
            <div className={styles.cartes}>
                {liste.map((c, k) => (
                    <div key={c.id + k} className={`${styles.carte} ${cible && k === 0 ? styles.cible : ''}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={c.image} alt="" loading="lazy" draggable={false} />
                        {classement && <span className={styles.rang}>{k + 1}</span>}
                    </div>
                ))}
            </div>
        </div>
    );
}

function Heros({ grand }: { grand?: boolean }) {
    const h = carte(TUTO_CARTES.heros);
    if (!h) return null;
    return (
        <div className={`${styles.heros} ${grand ? styles.herosGrand : ''}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={h.image} alt="" draggable={false} />
            <div className={styles.herosTexte}>
                <span className={styles.herosKicker}>Les dernières recettes</span>
                <span className={styles.herosTitre}>{h.title}</span>
                {grand && <span className={styles.herosBouton}>▶ Voir la recette</span>}
            </div>
        </div>
    );
}

const MENU = (cat: string) => ['Voir la recette', 'Ajouter aux favoris', 'À faire plus tard', `Accéder à ${cat}`, 'Partager la recette'];

export default function TutoScene({ art, bureau = false }: { art: Art; bureau?: boolean }) {
    // Scènes animées (curseur + halo) : accompagnement/saison, filtres, hashtags, assistant.
    if (estSceneAnimee(art)) return <TutoAnim art={art} bureau={bureau} />;

    const top = cartes(TUTO_CARTES.top);

    if (art === 'hero') {
        return (
            <div className={styles.scene} aria-hidden>
                <Heros grand />
                {bureau && <><span className={`${styles.fleche} ${styles.flecheG}`}>‹</span><span className={`${styles.fleche} ${styles.flecheD}`}>›</span></>}
            </div>
        );
    }

    if (art === 'rows') {
        return (
            <div className={`${styles.scene} ${styles.sceneRangees}`} aria-hidden>
                <Rangee titre="Top 100 : les mieux notées" liste={top} classement />
                <Rangee titre="Nouveautés" liste={cartes(TUTO_CARTES.nouveautes)} />
            </div>
        );
    }

    // 'press' (téléphone, appui long) / 'clic' (bureau, clic droit)
    const cible = top[0];
    return (
        <div className={`${styles.scene} ${styles.sceneGeste}`} aria-hidden>
            <Heros />
            <Rangee titre="Top 100 : les mieux notées" liste={top} classement cible />
            {cible && (
                <div className={styles.menu}>
                    <div className={styles.menuTitre}>{cible.title}</div>
                    {MENU(CATEGORIES[cible.category] || 'la catégorie').map((m) => (
                        <div key={m} className={styles.menuLigne}>{m}</div>
                    ))}
                </div>
            )}
            {bureau
                ? <svg className={styles.curseur} viewBox="0 0 24 24" width="18" height="18"><path d="M5 3l0 16 4.5-4.5 3.2 6.5 3-1.5-3.2-6.3 6.5 0z" fill="#fff" stroke="#111" strokeWidth="1.4" strokeLinejoin="round" /></svg>
                : <span className={styles.doigt} />}
        </div>
    );
}
