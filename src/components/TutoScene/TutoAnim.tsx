'use client';

/**
 * Scènes ANIMÉES du tutoriel : le site en miniature, rejoué en boucle.
 * ====================================================================
 *
 * Un curseur (bureau) ou un doigt (téléphone) se déplace, un halo de lumière
 * pulse au moment du toucher, et l'écran réagit — comme le vrai. C'est du CSS
 * pur : aucune vidéo, aucun script, donc rien qui vieillisse quand l'accueil
 * change. Les cartes viennent du catalogue (`TUTO_CARTES`, src/lib/tutoriel.ts).
 *
 * Quatre scènes : l'accompagnement « 100 % légumes de saison », les filtres de
 * la recherche, les #hashtags d'une fiche, l'assistant.
 *
 * Sans animation (prefers-reduced-motion) : l'écran final, immobile.
 */

import { mockRecipes } from '@/data/mockData';
import { TUTO_CARTES } from '@/lib/tutoriel';
import styles from './TutoAnim.module.css';

export type ArtAnime = 'side' | 'filtres' | 'tags' | 'search' | 'planner' | 'fill' | 'cave' | 'trophy' | 'ext' | 'card' | 'cook' | 'timers' | 'filter' | 'compose' | 'jourj' | 'demarrer' | 'views' | 'taste' | 'cocktail' | 'dock' | 'install' | 'sidebar' | 'library';
const ARTS_ANIMES = new Set<string>(['side', 'filtres', 'tags', 'search', 'planner', 'fill', 'cave', 'trophy', 'ext', 'card', 'cook', 'timers', 'filter', 'compose', 'jourj', 'demarrer', 'views', 'taste', 'cocktail', 'dock', 'install', 'sidebar', 'library']);
export const estSceneAnimee = (art: string): art is ArtAnime => ARTS_ANIMES.has(art);

type Carte = { id: string; title: string; image: string; category: string };
const carte = (id: string): Carte | null => {
    const r = mockRecipes.find((x) => String(x.id) === id);
    return r && r.image ? { id, title: r.title, image: r.image, category: (r.category || '') } : null;
};
const cartes = (ids: readonly string[]) => ids.map(carte).filter(Boolean) as Carte[];
const CAT: Record<string, string> = { plats: 'Plat', entrees: 'Entrée', desserts: 'Dessert', patisserie: 'Pâtisserie' };

/* eslint-disable @next/next/no-img-element */
const Vignette = ({ c }: { c: Carte }) => <img src={c.image} alt="" loading="lazy" draggable={false} />;

/** Curseur + halo. `bureau` : flèche ; sinon seul le halo (un doigt). */
function Pointeur({ chemin, bureau }: { chemin: string; bureau: boolean }) {
    return (
        <span className={`${styles.pointeur} ${styles[chemin]}`} aria-hidden>
            <span className={`${styles.halo} ${styles[`halo_${chemin}`]}`} />
            <span className={styles.point} />
            {bureau && (
                <svg className={styles.fleche} viewBox="0 0 24 24" width="100%" height="100%">
                    <path d="M5 3l0 16 4.5-4.5 3.2 6.5 3-1.5-3.2-6.3 6.5 0z" fill="#fff" stroke="#111" strokeWidth="1.4" strokeLinejoin="round" />
                </svg>
            )}
        </span>
    );
}

function Ligne({ c, kicker, classe = '' }: { c: Carte; kicker?: string; classe?: string }) {
    return (
        <div className={`${styles.ligne} ${classe}`}>
            <div className={styles.vignette}><Vignette c={c} /></div>
            <div className={styles.texte}>
                {kicker && <span className={styles.kicker}>{kicker}</span>}
                <span className={styles.titre}>{c.title}</span>
                <span className={styles.meta}>{CAT[c.category.toLowerCase()] || 'Recette'}</span>
            </div>
        </div>
    );
}

function Side({ bureau }: { bureau: boolean }) {
    const bav = carte(TUTO_CARTES.bavette);
    const [premier, ...autres] = cartes(TUTO_CARTES.saison);
    if (!bav || !premier) return null;
    return (
        <>
            <div className={styles.legende}>Planificateur · mardi soir</div>
            <Ligne c={bav} kicker="Plat" classe={styles.plat} />

            <div className={`${styles.groupe} ${styles.sideVide}`}>
                <div className={styles.caseVide} />
                <span className={styles.ajout}>+ Ajouter un accompagnement</span>
                <span className={styles.pourquoi}>ce plat est servi nu</span>
                <span className={styles.pilule}>100 % légumes de saison</span>
            </div>

            <div className={`${styles.groupe} ${styles.sideRempli}`}>
                <Ligne c={premier} kicker="Accompagnement" classe={styles.accomp} />
            </div>

            <div className={styles.liste}>
                <span className={styles.puce}>100 % de saison</span>
                <Ligne c={premier} classe={`${styles.rangeeListe} ${styles.rangeeUne}`} />
                {autres.map((c) => <Ligne key={c.id} c={c} classe={styles.rangeeListe} />)}
            </div>

            <Pointeur chemin="cSide" bureau={bureau} />
        </>
    );
}

function Filtres({ bureau }: { bureau: boolean }) {
    const avant = cartes(TUTO_CARTES.top).slice(0, 3);
    const apres = cartes(TUTO_CARTES.saison);
    return (
        <>
            <div className={styles.segment}>
                <span className={styles.segOn}>Recette</span><span>Ingrédients</span><span>Assistant</span>
            </div>
            <div className={styles.champ}>⌕&nbsp; Rechercher une recette</div>

            <div className={styles.compte}>
                <span className={styles.compteAvant}><b>798</b> recettes</span>
                <span className={styles.compteApres}>Ta sélection</span>
            </div>

            <div className={`${styles.chip} ${styles.chipCat}`}>Catégorie<i className={styles.badge1}>1</i></div>
            <div className={`${styles.chip} ${styles.chipPays}`}>Pays</div>
            <div className={`${styles.chip} ${styles.chipTend}`}>Tendances<i className={styles.badge2}>1</i></div>

            <div className={styles.actifs}>Plats · 100 % de saison</div>

            <div className={`${styles.trois} ${styles.avant}`}>
                {avant.map((c) => <div key={c.id} className={styles.mini}><Vignette c={c} /></div>)}
            </div>
            <div className={`${styles.trois} ${styles.apres}`}>
                {apres.map((c) => <div key={c.id} className={styles.mini}><Vignette c={c} /></div>)}
            </div>

            <Pointeur chemin="cFiltre" bureau={bureau} />
        </>
    );
}

function Tags({ bureau }: { bureau: boolean }) {
    const [fiche, ...voisines] = cartes(TUTO_CARTES.france);
    if (!fiche) return null;
    return (
        <>
            <div className={styles.fichePhoto}><Vignette c={fiche} /></div>
            <div className={styles.ficheTitre}>{fiche.title}</div>
            <span className={`${styles.hashtag} ${styles.hashFrance}`}>#FRANCE</span>
            <span className={`${styles.hashtag} ${styles.hashVege}`}>#VÉGÉ</span>

            <div className={styles.grille}>
                <span className={styles.grilleTitre}>France</span>
                <div className={styles.grilleCartes}>
                    {[fiche, ...voisines].map((c) => <div key={c.id} className={styles.mini}><Vignette c={c} /></div>)}
                </div>
            </div>

            <Pointeur chemin="cTags" bureau={bureau} />
        </>
    );
}

function Assistant({ bureau }: { bureau: boolean }) {
    const rep = cartes(TUTO_CARTES.poulet);
    return (
        <>
            <div className={styles.segment}>
                <span className={`${styles.segRecette}`}>Recette</span>
                <span>Ingrédients</span>
                <span className={styles.segAssistant}>Assistant</span>
                <i className={styles.segPastille} />
            </div>
            <div className={styles.champ}>
                <span className={styles.frappe}>un plat rapide au poulet</span>
            </div>
            <div className={styles.reponses}>
                {rep.map((c) => <Ligne key={c.id} c={c} />)}
            </div>
            <Pointeur chemin="cAssistant" bureau={bureau} />
        </>
    );
}

export default function TutoAnim({ art, bureau = false }: { art: ArtAnime; bureau?: boolean }) {
    return (
        <div className={styles.scene} aria-hidden>
            <div className={styles.stage}>
                {art === 'side' && <Side bureau={bureau} />}
                {art === 'filtres' && <Filtres bureau={bureau} />}
                {art === 'tags' && <Tags bureau={bureau} />}
                {art === 'search' && <Assistant bureau={bureau} />}
                {art === 'planner' && <Semaine bureau={bureau} />}
                {art === 'fill' && <Courses bureau={bureau} />}
                {art === 'cave' && <Cave bureau={bureau} />}
                {art === 'trophy' && <Trophees bureau={bureau} />}
                {art === 'ext' && <Extension bureau={bureau} />}
                {art === 'card' && <Fiche bureau={bureau} />}
                {art === 'cook' && <Cuisine bureau={bureau} />}
                {art === 'timers' && <Chronos bureau={bureau} />}
                {art === 'filter' && <FiltresTiroir bureau={bureau} />}
                {art === 'compose' && <Composer bureau={bureau} />}
                {art === 'jourj' && <JourJ bureau={bureau} />}
                {art === 'demarrer' && <Demarrer bureau={bureau} />}
                {art === 'views' && <Vues bureau={bureau} />}
                {art === 'taste' && <Gouts bureau={bureau} />}
                {art === 'cocktail' && <Cocktails bureau={bureau} />}
                {art === 'dock' && <Dock bureau={bureau} />}
                {art === 'install' && <Installer bureau={bureau} />}
                {art === 'sidebar' && <MenuGauche bureau={bureau} />}
                {art === 'library' && <Bibliotheque bureau={bureau} />}
            </div>
        </div>
    );
}

/* ═══ Scène 5 — « Ma semaine » : une recette se pose dans un créneau ═══ */
function Semaine({ bureau }: { bureau: boolean }) {
    const [plat, ...autres] = cartes(TUTO_CARTES.france);
    if (!plat) return null;
    const jours = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    return (
        <>
            <div className={styles.semaineJours}>
                {jours.map((j, k) => <span key={j} className={`${styles.jour} ${k === 1 ? styles.jourOn : ''}`}>{j}</span>)}
            </div>
            <div className={`${styles.creneau} ${styles.creneauMidi}`}>
                <span className={styles.creneauNom}>Midi</span>
                <span className={styles.creneauVide}>+ Choisir une recette</span>
                <span className={styles.creneauRempli}>
                    <Vignette c={plat} />
                </span>
            </div>
            <div className={`${styles.creneau} ${styles.creneauSoir}`}>
                <span className={styles.creneauNom}>Soir</span>
                <span className={styles.creneauVide}>+ Choisir une recette</span>
                <span className={styles.creneauRempli}>
                    {autres[0] && <Vignette c={autres[0]} />}
                </span>
            </div>
            <Pointeur chemin="cSemaine" bureau={bureau} />
        </>
    );
}

/* ═══ Scène 6 — « Remplir la liste » : les ingrédients du menu, par rayon ═══ */
const LIGNES_COURSES: [string, string][] = [
    ['Fruits & légumes', 'Courgettes · 2'],
    ['Viande & poisson', 'Bavette · 400 g'],
    ['Crémerie', 'Crème fraîche · 20 cl'],
    ['Épicerie', 'Riz basmati · 250 g'],
];
function Courses({ bureau }: { bureau: boolean }) {
    return (
        <>
            <div className={styles.courseBtn}>Remplir ma liste de courses</div>
            <div className={styles.courseListe}>
                {LIGNES_COURSES.map(([rayon, article], k) => (
                    <div key={rayon} className={`${styles.courseLigne} ${styles[`courseL${k}`]}`}>
                        <span className={styles.courseCoche} />
                        <span className={styles.courseTexte}>
                            <span className={styles.courseRayon}>{rayon}</span>
                            <span>{article}</span>
                        </span>
                    </div>
                ))}
            </div>
            <Pointeur chemin="cCourses" bureau={bureau} />
        </>
    );
}

/* ═══ Scène 7 — « Ma cave » : une bouteille glisse vers « Goûté & approuvé » ═══ */
function Cave({ bureau }: { bureau: boolean }) {
    return (
        <>
            <div className={styles.etagere} style={{ top: '18%' }}>
                <span className={styles.etagereNom}>La cave</span>
                <span className={`${styles.bouteille} ${styles.bouteilleA}`} />
                <span className={`${styles.bouteille} ${styles.bouteilleB}`} />
            </div>
            <div className={styles.etagere} style={{ top: '56%' }}>
                <span className={styles.etagereNom}>Goûté &amp; approuvé</span>
            </div>
            {/* Hors des étagères : elle descend de la cave vers « Goûté & approuvé ». */}
            <span className={`${styles.bouteille} ${styles.bouteilleGlisse}`} />
            <Pointeur chemin="cCave" bureau={bureau} />
        </>
    );
}

/* ═══ Scène 8 — « Tes trophées » : six badges, un à un ═══ */
const BADGES = ['Première flamme', 'Apprenti', 'Chef de maison', 'Collectionneur', 'Tour du monde', 'Organisé'];
function Trophees({ bureau }: { bureau: boolean }) {
    return (
        <>
            <div className={styles.badges}>
                {BADGES.map((b, k) => (
                    <div key={b} className={`${styles.badge} ${styles[`badge${k}`]}`}>
                        <span className={styles.badgeRond}>★</span>
                        <span className={styles.badgeNom}>{b}</span>
                    </div>
                ))}
            </div>
            <Pointeur chemin="cTrophee" bureau={bureau} />
        </>
    );
}

/* ═══ Scène 9 — « L'extension Chrome » : la liste par-dessus le magasin ═══ */
function Extension({ bureau }: { bureau: boolean }) {
    return (
        <>
            <div className={styles.magasin}>
                <span className={styles.magasinNom}>Carrefour</span>
                <span className={styles.magasinProduit}>Courgettes · 2</span>
                <span className={styles.magasinBtn}>Ajouter au panier</span>
            </div>
            <div className={styles.panneauExt}>
                <span className={styles.panneauTitre}>Courses Magiques</span>
                <span className={styles.panneauProg}>Produit 2 / 8</span>
                <span className={styles.panneauSuiv}>Produit suivant</span>
            </div>
            <Pointeur chemin="cExt" bureau={bureau} />
        </>
    );
}

/* ═══ Scènes restantes : même logique (curseur, halo, boucle de 10 s) ═══ */
const PHOTOS = ['8116', '8113', '8068', '8029', '8024', '8013', '8049', '8118'];
const photo = (k: number): Carte | null => carte(PHOTOS[k % PHOTOS.length]);

/** La fiche : photo, titre, ingrédients qui apparaissent, étoiles. */
function Fiche({ bureau }: { bureau: boolean }) {
    const c = photo(0);
    if (!c) return null;
    return (
        <>
            <div className={styles.ficheHaut}><Vignette c={c} /></div>
            <div className={styles.ficheTitre2}>{c.title}</div>
            <div className={styles.ficheIngs}>
                {['Pommes de terre · 600 g', 'Beurre · 50 g', 'Lait · 20 cl'].map((t, k) => (
                    <span key={t} className={`${styles.ficheIng} ${styles[`ing${k}`]}`}>{t}</span>
                ))}
            </div>
            <span className={styles.etoiles}>★ ★ ★ ★ ☆</span>
            <Pointeur chemin="cFiche" bureau={bureau} />
        </>
    );
}

/** Cuisiner pas à pas : une étape à la fois, minuteur qui démarre. */
function Cuisine({ bureau }: { bureau: boolean }) {
    return (
        <>
            <div className={styles.cuisineBarre}><span className={styles.cuisineFait} /></div>
            <div className={styles.cuisineEtape}>Étape 2 / 6</div>
            <div className={styles.cuisineTexte}>Fais revenir l&rsquo;oignon 5 minutes à feu doux.</div>
            <div className={styles.cuisineBtn}>Étape suivante</div>
            <span className={styles.minuteur}>05:00</span>
            <Pointeur chemin="cCuisine" bureau={bureau} />
        </>
    );
}

/** Plusieurs chronos : deux minuteurs qui tournent en même temps. */
function Chronos({ bureau }: { bureau: boolean }) {
    return (
        <>
            <div className={`${styles.chrono} ${styles.chrono1}`}><span className={styles.chronoT}>12:00</span><span className={styles.chronoNom}>Riz</span></div>
            <div className={`${styles.chrono} ${styles.chrono2}`}><span className={styles.chronoT}>04:30</span><span className={styles.chronoNom}>Sauce</span></div>
            <Pointeur chemin="cChrono" bureau={bureau} />
        </>
    );
}

/** Filtrer : des cases qui se cochent dans un tiroir. */
function FiltresTiroir({ bureau }: { bureau: boolean }) {
    return (
        <>
            <div className={styles.tiroir}>
                <span className={styles.tiroirTitre}>Catégories</span>
                {['Desserts', 'Apéritifs', 'Plats'].map((t, k) => (
                    <span key={t} className={`${styles.coche} ${styles[`coche${k}`]}`}>{t}</span>
                ))}
                <span className={styles.tiroirBtn}>Voir 12 recettes</span>
            </div>
            <Pointeur chemin="cTiroir" bureau={bureau} />
        </>
    );
}

/** Composer : des tendances à cocher, puis « Composer au hasard ». */
function Composer({ bureau }: { bureau: boolean }) {
    return (
        <>
            <div className={styles.tags3}>
                {['Pâtes', 'Express', 'Végé', 'Barbecue', 'Famille'].map((t, k) => (
                    <span key={t} className={`${styles.tag} ${styles[`tag${k}`]}`}>{t}</span>
                ))}
            </div>
            <div className={styles.composerBtn}>Composer au hasard</div>
            <Pointeur chemin="cComposer" bureau={bureau} />
        </>
    );
}

/** Le Jour J : quatre cartes du repas qui se remplissent. */
function JourJ({ bureau }: { bureau: boolean }) {
    const ids = [0, 1, 2, 3];
    return (
        <>
            <div className={styles.jourJ}>
                {ids.map((k) => {
                    const c = photo(k + 2);
                    return (
                        <div key={k} className={`${styles.jourJCase} ${styles[`jj${k}`]}`}>
                            <span className={styles.jourJNom}>{['Apéritif', 'Entrée', 'Plat', 'Dessert'][k]}</span>
                            {c && <Vignette c={c} />}
                        </div>
                    );
                })}
            </div>
            <Pointeur chemin="cJourJ" bureau={bureau} />
        </>
    );
}

/** Démarrer la soirée : une frise d'horaires qui avance. */
function Demarrer({ bureau }: { bureau: boolean }) {
    return (
        <>
            <div className={styles.frise}>
                {['19:00', '19:30', '20:00', '20:30'].map((h, k) => (
                    <span key={h} className={`${styles.friseH} ${styles[`fh${k}`]}`}>{h}</span>
                ))}
            </div>
            <div className={styles.demarrerBtn}>Démarrer la soirée</div>
            <Pointeur chemin="cDemarrer" bureau={bureau} />
        </>
    );
}

/** Trois vues : le sélecteur change la liste affichée. */
function Vues({ bureau }: { bureau: boolean }) {
    return (
        <>
            <div className={styles.vuesSeg}>
                <span className={styles.vueA}>La semaine</span>
                <span className={styles.vueB}>Jour par jour</span>
                <span className={styles.vueC}>En +</span>
            </div>
            <div className={styles.vuesListe}>
                <span className={styles.vueLigne}>Courgettes · 2</span>
                <span className={styles.vueLigne}>Riz basmati · 250 g</span>
                <span className={styles.vueLigne}>Bavette · 400 g</span>
            </div>
            <Pointeur chemin="cVues" bureau={bureau} />
        </>
    );
}

/** Affine mes goûts : des pastilles qui s'allument. */
function Gouts({ bureau }: { bureau: boolean }) {
    return (
        <>
            <div className={styles.gouts}>
                {['Épicé', 'Sans gluten', 'Healthy', 'Végé', 'Express', 'Famille'].map((t, k) => (
                    <span key={t} className={`${styles.gout} ${styles[`gout${k}`]}`}>{t}</span>
                ))}
            </div>
            <span className={styles.goutsMsg}>Tes goûts affinent les suggestions</span>
            <Pointeur chemin="cGouts" bureau={bureau} />
        </>
    );
}

/** Cocktails : une liste de verres, un ajouté au panier. */
function Cocktails({ bureau }: { bureau: boolean }) {
    return (
        <>
            <div className={styles.cocktails}>
                {['Spritz Apérol', 'Mojito', 'Espresso martini'].map((t, k) => (
                    <div key={t} className={`${styles.cocktail} ${styles[`ck${k}`]}`}>
                        <span className={styles.ckRond} />
                        <span className={styles.ckNom}>{t}</span>
                    </div>
                ))}
            </div>
            <Pointeur chemin="cCocktail" bureau={bureau} />
        </>
    );
}

/** La barre du bas : quatre icônes, une s'allume sous le curseur. */
function Dock({ bureau }: { bureau: boolean }) {
    return (
        <>
            <div className={styles.dock}>
                {['♥', '🛒', '⌂', '▦'].map((i, k) => (
                    <span key={k} className={`${styles.dockI} ${styles[`di${k}`]}`}>{i}</span>
                ))}
            </div>
            <Pointeur chemin="cDock" bureau={bureau} />
        </>
    );
}

/** Comme une app : l'icône glisse sur l'écran d'accueil. */
function Installer({ bureau }: { bureau: boolean }) {
    return (
        <>
            <div className={styles.telephone}>
                <span className={styles.appIcone}>🍽</span>
                <span className={styles.appNom}>Recettes Magiques</span>
            </div>
            <span className={styles.installMsg}>Installée</span>
            <Pointeur chemin="cInstall" bureau={bureau} />
        </>
    );
}

/** Le menu de gauche : une barre latérale, une rubrique s'éclaire. */
function MenuGauche({ bureau }: { bureau: boolean }) {
    return (
        <>
            <div className={styles.menuLat}>
                {['Accueil', 'Planificateur', 'Courses', 'Favoris', 'Palmarès', 'Ma cave', 'Tutoriel'].map((t, k) => (
                    <span key={t} className={`${styles.menuItem} ${styles[`mi${k}`]}`}>{t}</span>
                ))}
            </div>
            <div className={styles.menuZone} />
            <Pointeur chemin="cMenu" bureau={bureau} />
        </>
    );
}

/** La bibliothèque : une catégorie glissée dans la zone. */
function Bibliotheque({ bureau }: { bureau: boolean }) {
    return (
        <>
            <div className={styles.biblio}>
                <span className={styles.biblioTitre}>Bibliothèque</span>
                <span className={styles.biblioZone}>Glisse ici une catégorie</span>
                <span className={styles.biblioChip}>Desserts</span>
            </div>
            <Pointeur chemin="cBiblio" bureau={bureau} />
        </>
    );
}
