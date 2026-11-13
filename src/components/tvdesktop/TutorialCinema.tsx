'use client';
/**
 * Le tutoriel du bureau — version « cinéma ».
 * ===========================================
 *
 * Chaque étape est une courte séquence animée, jouée toute seule (≈ 9 s) dans
 * une fenêtre qui reprend les vraies photos du site. Pas d'interaction à
 * deviner : on regarde, comme un film. Progression façon « stories » en haut,
 * ← → pour passer, espace pour pause, ↻ pour rejouer.
 *
 * Les scènes sont du CSS pur (animations à un coup, décalées par `--d`) : le
 * composant n'a donc ni minuterie ni état par scène. Rejouer = remonter la
 * scène (`key`). La fin de la barre de progression fait avancer l'étape.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type TouchEvent as ReactTouchEvent } from 'react';
import { mockRecipes } from '@/data/mockData';
import { etapesTuto, marquerAstuceVue, TUTO_CARTES, type Art } from '@/lib/tutoriel';
import styles from './TutorialCinema.module.css';

const DUREE = 9; // secondes par étape

/* ── Données : de vraies photos du site ───────────────────────────────────── */

type Photo = { id: string; title: string; image: string };
const IDS = [...TUTO_CARTES.top, ...TUTO_CARTES.nouveautes];

function usePhotos(): Photo[] {
    return useMemo(() => {
        const out: Photo[] = [];
        for (const id of IDS) {
            const r = mockRecipes.find((x) => String(x.id) === String(id));
            if (r && r.image) out.push({ id: String(id), title: r.title, image: r.image });
        }
        return out;
    }, []);
}

/* ── Petites briques ──────────────────────────────────────────────────────── */

const v = (o: Record<string, string | number>) => o as CSSProperties;
const d = (s: number, extra: Record<string, string | number> = {}) => v({ '--d': `${s}s`, ...extra });

function Img({ p, cls = '', style }: { p?: Photo; cls?: string; style?: CSSProperties }) {
    // eslint-disable-next-line @next/next/no-img-element
    return p ? <img className={`${styles.img} ${cls}`} style={style} src={p.image} alt="" draggable={false} /> : <div className={`${styles.img} ${cls}`} style={style} />;
}

/** Curseur qui voyage : trois points de passage (a → b → c), puis un clic optionnel. */
function Curseur({ a, b, c, delay = 0.4, clic }: { a: [number, number]; b: [number, number]; c?: [number, number]; delay?: number; clic?: number }) {
    const cc = c || b;
    return (
        <>
            <svg className={styles.cur} viewBox="0 0 24 24" aria-hidden style={v({
                '--xa': `${a[0]}cqw`, '--ya': `${a[1]}cqw`, '--xb': `${b[0]}cqw`, '--yb': `${b[1]}cqw`, '--xc': `${cc[0]}cqw`, '--yc': `${cc[1]}cqw`, '--d': `${delay}s`,
            })}>
                <path d="M5 3l0 16 4.5-4.5 3.2 6.5 3-1.5-3.2-6.3 6.5 0z" fill="#fff" stroke="#0b0b10" strokeWidth="1.3" strokeLinejoin="round" />
            </svg>
            {clic !== undefined && <i className={styles.ring} style={v({ left: `${b[0]}cqw`, top: `${b[1]}cqw`, '--d': `${clic}s` })} />}
        </>
    );
}

function Fenetre({ children, side, titre = 'Les Recettes Magiques' }: { children: ReactNode; side?: ReactNode; titre?: string }) {
    return (
        <div className={styles.win}>
            <div className={styles.winBar}>
                <i /><i /><i />
                <span>{titre}</span>
            </div>
            <div className={styles.winBody}>
                {side}
                <div className={styles.winMain}>{children}</div>
            </div>
        </div>
    );
}

const MENU = ['Planificateur', 'Liste de courses', 'Favoris', 'Palmarès', 'Ma cave', 'Tutoriel'];

/** Barre latérale de la maquette ; `hl` = index surligné, avec son retard. */
function Side({ hl, at = 0.8, all = false, shrink = false }: { hl?: number; at?: number; all?: boolean; shrink?: boolean }) {
    return (
        <div className={`${styles.side} ${shrink ? styles.sideShrink : ''}`} style={d(0)}>
            <b className={styles.sideLogo} />
            {MENU.map((m, k) => (
                <div key={m} className={`${styles.sideItem} ${all ? styles.sideAll : ''} ${hl === k ? styles.sideHl : ''}`} style={d(at + (all ? k * 0.45 : 0))}>
                    <i /><span>{m}</span>
                </div>
            ))}
            <div className={styles.sideSep} />
            {['Catégories', 'Tendances', 'Pays'].map((m, k) => (
                <div key={m} className={styles.sideItem}><i className={styles.sideDot} /><span>{m}</span><em>⌄</em></div>
            ))}
        </div>
    );
}

function Grille({ photos, n = 8, start = 0, cols = 4 }: { photos: Photo[]; n?: number; start?: number; cols?: number }) {
    return (
        <div className={styles.grille} style={v({ '--cols': cols })}>
            {Array.from({ length: n }).map((_, k) => (
                <div key={k} className={`${styles.carte} ${styles.in}`} style={d(0.1 + k * 0.06)}>
                    <Img p={photos[(start + k) % photos.length]} />
                </div>
            ))}
        </div>
    );
}

/* ── Les scènes ───────────────────────────────────────────────────────────── */

type Ctx = { photos: Photo[] };

const SCENES: Partial<Record<Art, (c: Ctx) => ReactNode>> = {
    sidebar: ({ photos }) => (
        <Fenetre side={<Side all shrink />}>
            <Grille photos={photos} n={8} />
            <div className={`${styles.grandTitre} ${styles.in}`} style={d(5.4)}>L’accueil reprend toute la largeur</div>
            <Curseur a={[40, 40]} b={[11.5, 4.6]} delay={4.4} clic={5.2} />
        </Fenetre>
    ),

    hero: ({ photos }) => (
        <Fenetre side={<Side />}>
            <div className={styles.hero}>
                {[0, 1, 2].map((k) => (
                    <div key={k} className={`${styles.heroSlide} ${k === 0 ? styles.heroFirst : styles.heroNext}`} style={v({ '--d': `${k === 1 ? 3.4 : k === 2 ? 6.4 : 0}s`, '--e': `${k === 0 ? 3.4 : k === 1 ? 6.4 : 99}s` })}>
                        <Img p={photos[k]} />
                        <div className={styles.heroVoile} />
                        <div className={styles.heroTxt}>
                            <small>Les dernières recettes</small>
                            <strong>{photos[k]?.title}</strong>
                            <span className={styles.btnBlanc}>▶ Voir la recette</span>
                        </div>
                    </div>
                ))}
                <span className={`${styles.fl} ${styles.flG}`}>‹</span>
                <span className={`${styles.fl} ${styles.flD} ${styles.flPulse}`}>›</span>
            </div>
            <Curseur a={[28, 34]} b={[53, 17]} c={[53, 17]} delay={1.2} clic={3.2} />
        </Fenetre>
    ),

    rows: ({ photos }) => (
        <Fenetre side={<Side />}>
            <div className={styles.rows}>
                {[['Top 100 : les mieux notées', 0], ['Nouveautés', 5], ['Desserts', 2]].map(([t, s], r) => (
                    <div key={String(t)} className={`${styles.rangee} ${styles.in} ${r === 1 ? styles.rangeeCible : ''}`} style={d(0.1 + r * 0.25)}>
                        <div className={styles.rangeeT}>{t} <span>›</span></div>
                        <div className={`${styles.rangeeCartes} ${r === 0 ? styles.defile : ''}`} style={d(2.2)}>
                            {Array.from({ length: 7 }).map((_, k) => (
                                <div key={k} className={styles.carteH}><Img p={photos[(Number(s) + k) % photos.length]} />{r === 0 && <b>{k + 1}</b>}</div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
            <div className={styles.ascenseur}>
                {Array.from({ length: 6 }).map((_, k) => <i key={k} className={k === 1 ? styles.ascOn : ''} style={d(4.6)} />)}
            </div>
            <div className={`${styles.etiquette} ${styles.in}`} style={d(4.2)}>molette = une rangée à la fois</div>
        </Fenetre>
    ),

    clic: ({ photos }) => (
        <Fenetre side={<Side />}>
            <div className={styles.rows}>
                <div className={styles.rangee}>
                    <div className={styles.rangeeT}>Top 100 : les mieux notées <span>›</span></div>
                    <div className={styles.rangeeCartes}>
                        {Array.from({ length: 5 }).map((_, k) => (
                            <div key={k} className={`${styles.carteH} ${k === 1 ? styles.carteCible : ''}`}><Img p={photos[k]} />{k === 1 && <i className={`${styles.coeur} ${styles.pop}`} style={d(5.6)}>♥</i>}</div>
                        ))}
                    </div>
                </div>
            </div>
            <div className={`${styles.menuCtx} ${styles.pop}`} style={d(2.4)}>
                <div className={styles.menuTitre}>{photos[1]?.title}</div>
                {['Voir la recette', 'Ajouter aux favoris', 'À faire plus tard', 'Accéder à la catégorie', 'Partager'].map((m, k) => (
                    <div key={m} className={`${styles.menuLigne} ${k === 1 ? styles.menuHl : ''}`} style={d(5)}>{m}</div>
                ))}
            </div>
            <Curseur a={[20, 40]} b={[21, 16]} c={[31, 25]} delay={0.6} clic={2.2} />
            <i className={styles.ring} style={v({ left: '31cqw', top: '25cqw', '--d': '5s' })} />
        </Fenetre>
    ),

    card: ({ photos }) => (
        <Fenetre side={<Side />}>
            <Grille photos={photos} n={8} />
            <div className={styles.fiche}>
                <Img p={photos[2]} cls={styles.ficheImg} />
                <div className={styles.ficheCorps}>
                    <strong>{photos[2]?.title}</strong>
                    <div className={styles.etoiles}>{[0, 1, 2, 3, 4].map((k) => <i key={k} className={styles.etoile} style={d(5.2 + k * 0.25)}>★</i>)}</div>
                    {['Farine', 'Œufs', 'Beurre', 'Sucre'].map((ing, k) => (
                        <div key={ing} className={styles.ing}><span className={styles.case} style={d(2.6 + k * 0.7)}><b>✓</b></span>{ing}<em>{[250, 3, 100, 80][k]} {['g', '', 'g', 'g'][k]}</em></div>
                    ))}
                    <span className={`${styles.pastille} ${styles.pop}`} style={d(6.6)}>↗ « En + » de la liste</span>
                </div>
            </div>
            <Curseur a={[20, 30]} b={[34, 15]} c={[34, 15]} delay={0.4} clic={1.2} />
        </Fenetre>
    ),

    flame: ({ photos }) => (
        <Fenetre side={<Side />}>
            <div className={styles.flammes}>
                {[[9, 'Correcte'], [41, 'Très bonne'], [248, 'Exceptionnelle']].map(([n, t], k) => (
                    <div key={String(t)} className={`${styles.carteF} ${k === 2 ? styles.carteTop : ''} ${styles.in}`} style={d(0.2 + k * 0.3)}>
                        <Img p={photos[k + 1]} />
                        <div className={`${styles.flamme} ${k === 1 ? styles.flammeClic : ''}`}>
                            <span aria-hidden>🔥</span>
                            {k === 1
                                ? <b><em className={styles.nF1}>41</em><em className={styles.nF2}>42</em></b>
                                : <b>{n}</b>}
                        </div>
                        <div className={`${styles.verdict} ${k === 2 ? `${styles.pop}` : ''}`} style={d(3.8)}>{k === 2 ? '★ ' : ''}{t}</div>
                    </div>
                ))}
            </div>
            <div className={`${styles.legende} ${styles.in}`} style={d(4.6)}>plus le chiffre est haut, plus la recette est exceptionnelle</div>
            <Curseur a={[30, 46]} b={[53.5, 12.5]} delay={1.2} clic={3.1} />
        </Fenetre>
    ),

    stars: () => (
        <Fenetre side={<Side />}>
            <div className={`${styles.bloc} ${styles.in}`} style={d(0.2)}>
                <div className={styles.blocLigne}><span>Prix moyen</span><b>4,5 – 10 €</b></div>
                <div className={styles.blocLigne}>
                    <span>Votre note : <em className={styles.note0}>—</em><em className={styles.note1}>4,3</em>/5 <small className={styles.vot}>(12)</small></span>
                    <div className={styles.etoilesG}>
                        <div className={styles.etoilesFond}>★★★★★</div>
                        <div className={styles.etoilesPlein} style={d(2)}>★★★★★</div>
                    </div>
                </div>
                <div className={styles.blocLigne}><span>Calories</span><b>760 kcal</b></div>
            </div>
            <div className={`${styles.legende} ${styles.in}`} style={d(5)}>moyenne et nombre de votants affichés sur la fiche</div>
            <Curseur a={[35, 40]} b={[60, 27]} c={[78, 27]} delay={1.2} clic={1.9} />
        </Fenetre>
    ),

    winepick: ({ photos }) => (
        <Fenetre side={<Side hl={4} at={9} />}>
            <div className={styles.winFiche}>
                <Img p={photos[2]} cls={styles.winImg} />
                <div className={styles.winTitre}>{photos[2]?.title}</div>
                <span className={`${styles.pilCave} ${styles.pillPress}`} style={d(1.6)}>🍷 Ma cave</span>
            </div>
            <div className={`${styles.winPanneau} ${styles.slideUp}`} style={d(2.2)}>
                <strong>Dans ta cave, avec ce plat</strong>
                {[['Chianti Classico', 'Rouge · 2019', '#7b1e2b', 3], ['Sancerre', 'Blanc · 2022', '#e6d27a', 2], ['Rosé de Provence', 'Rosé · 2023', '#e08a97', 1]].map(([n, m, col, q], k) => (
                    <div key={String(n)} className={`${styles.winLigne} ${k === 0 ? styles.winChoix : ''} ${styles.in}`} style={d(2.8 + k * 0.25)}>
                        <i style={{ background: String(col) }} /><span><b>{n}</b><small>{m}</small></span><em>× {q}</em>
                    </div>
                ))}
            </div>
            <div className={`${styles.confirmW} ${styles.pop}`} style={d(5.4)}>
                <b>Retirer de ma cave ?</b>
                <div><span>Non</span><span className={styles.ouiW}>Oui</span></div>
            </div>
            <div className={`${styles.toastW} ${styles.in}`} style={d(7.4)}>Bouteille ouverte · il en reste 2</div>
            <Curseur a={[35, 40]} b={[20, 6.4]} c={[68, 37]} delay={0.6} clic={1.6} />
            <i className={styles.ring} style={v({ left: '68cqw', top: '37cqw', '--d': '4.9s' })} />
            <i className={styles.ring} style={v({ left: '74cqw', top: '30cqw', '--d': '6.6s' })} />
        </Fenetre>
    ),

    cook: ({ photos }) => (
        <Fenetre side={<Side />}>
            <div className={styles.cuisine}>
                <div className={styles.cuisineTete}><Img p={photos[3]} cls={styles.mini} /><span>{photos[3]?.title}</span><b>Étape <em className={styles.cycle1} style={d(0)}>1</em><em className={styles.cycle2} style={d(0)}>2</em><em className={styles.cycle3} style={d(0)}>3</em> / 3</b></div>
                <div className={styles.cuisineEtape}>
                    <p className={`${styles.etape} ${styles.etape1}`}>Tamiser la farine et former un puits au centre.</p>
                    <p className={`${styles.etape} ${styles.etape2}`}>Verser le lait tiède, mélanger sans cesser de fouetter.</p>
                    <p className={`${styles.etape} ${styles.etape3}`}>Laisser lever 20 minutes, couvert.</p>
                </div>
                <div className={styles.minuteur}><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" /><circle className={styles.anneau} cx="20" cy="20" r="16" style={d(5.6)} /></svg><span>20:00</span></div>
            </div>
        </Fenetre>
    ),

    filter: ({ photos }) => (
        <Fenetre side={
            <div className={styles.side}>
                <b className={styles.sideLogo} />
                {[['Plats', 1.2], ['Desserts', -1], ['Italie', 2.6], ['Express', 4]].map(([t, at]) => (
                    <div key={String(t)} className={styles.filtre}><span className={Number(at) > 0 ? styles.case : styles.caseVide} style={d(Number(at))}><b>✓</b></span>{t}</div>
                ))}
            </div>
        }>
            <div className={styles.compteur}><span className={styles.cmpA}>848 recettes</span><span className={styles.cmpB}>Voir 12 recettes</span></div>
            <div className={styles.recompose}>
                <Grille photos={photos} n={8} start={0} />
                <div className={styles.grilleNouv}><Grille photos={photos} n={4} start={4} cols={4} /></div>
            </div>
        </Fenetre>
    ),

    library: ({ photos }) => (
        <Fenetre side={
            <div className={styles.side}>
                <b className={styles.sideLogo} />
                <div className={styles.biblio}>{[0, 1].map((k) => <span key={k} className={styles.epingle}>Italie</span>)}<span className={`${styles.epingle} ${styles.epingleNew} ${styles.pop}`} style={d(4)}>Express</span></div>
                <div className={styles.sideSep} />
                {['Catégories', 'Tendances', 'Pays'].map((m) => <div key={m} className={styles.sideItem}><i className={styles.sideDot} /><span>{m}</span></div>)}
                <div className={styles.puce} style={d(0.8)}>Express</div>
            </div>
        }>
            <Grille photos={photos} n={8} start={2} />
            <div className={`${styles.etiquette} ${styles.in}`} style={d(4.6)}>épinglé — il te suit jusque sur le téléphone</div>
        </Fenetre>
    ),

    search: ({ photos }) => (
        <Fenetre side={<Side />}>
            <div className={styles.recherche}>
                <div className={styles.onglets}>
                    <span className={styles.ongletOn}>Recette</span><span>Ingrédients</span><span>Assistant IA</span>
                    <i className={styles.ongletGlisse} style={d(4.4)} />
                </div>
                <div className={styles.champ}><span>⌕</span><em className={styles.tape} style={v({ '--d': '0.8s', '--t': '1.4s', '--n': 6, '--w': '9cqw' })}>poulet</em><i className={styles.caret} /></div>
                <div className={styles.resultats}>
                    {[0, 1, 2, 3].map((k) => <div key={k} className={`${styles.res} ${styles.in}`} style={d(2.6 + k * 0.18)}><Img p={photos[k + 3]} /><span>{photos[k + 3]?.title}</span></div>)}
                </div>
                <div className={`${styles.bulleIA} ${styles.pop}`} style={d(6)}>« une sauce pour une viande rouge »</div>
            </div>
        </Fenetre>
    ),

    planner: ({ photos }) => (
        <Fenetre side={<Side hl={0} at={0.3} />}>
            <Planning photos={photos} remplis={[[0, 0], [1, 1], [2, 0], [3, 1]]} at={2.2} pas={0.8} />
            <Curseur a={[30, 38]} b={[45, 7]} delay={0.5} clic={2} />
        </Fenetre>
    ),

    side: ({ photos }) => (
        <Fenetre side={<Side hl={0} at={0.3} />}>
            <div className={styles.jour}>
                <div className={styles.jourEnt}>Mardi</div>
                <div className={`${styles.repas} ${styles.in}`} style={d(0.6)}><small>Midi</small><Img p={photos[4]} /><span>Couscous royal</span><i className={`${styles.badgeOk} ${styles.pop}`} style={d(2.2)}>complet</i></div>
                <div className={`${styles.repas} ${styles.in}`} style={d(1.4)}><small>Soir</small><Img p={photos[1]} /><span>Entrecôte grillée</span></div>
                <div className={`${styles.accomp} ${styles.slideD}`} style={d(3.6)}><small>Accompagnement</small><Img p={photos[2]} /><span>Riz Jollof</span></div>
            </div>
        </Fenetre>
    ),

    compose: ({ photos }) => (
        <Fenetre side={<Side hl={0} at={0.3} />}>
            <Planning photos={photos} tous at={3} pas={0.22} />
            <div className={`${styles.compTop} ${styles.in}`} style={d(0.4)}>
                <span className={styles.btnBlanc}>✦ Composer</span>
                {['Italie', 'Healthy', 'Barbecue'].map((t, k) => <span key={t} className={`${styles.tend} ${k === 0 ? styles.tendOn : ''}`} style={d(2)}>{t}</span>)}
            </div>
            <Curseur a={[36, 42]} b={[22, 5]} c={[34, 5]} delay={0.6} clic={2} />
        </Fenetre>
    ),

    jourj: ({ photos }) => (
        <Fenetre side={<Side hl={0} at={0.3} />}>
            <div className={styles.bascule}><span className={styles.bOn}>Semaine</span><span>Jour J</span><i style={d(1.6)} /></div>
            <div className={styles.jourJ}>
                {['Apéritif', 'Entrée', 'Plat', 'Accompagnement', 'Dessert', 'Pâtisserie'].map((c, k) => (
                    <div key={c} className={`${styles.cat} ${styles.pop}`} style={d(2.4 + k * 0.45)}><Img p={photos[k + 1]} /><span>{c}</span></div>
                ))}
            </div>
            <Curseur a={[40, 36]} b={[27, 6]} delay={0.4} clic={1.6} />
        </Fenetre>
    ),

    fill: ({ photos }) => (
        <Fenetre side={<Side hl={1} at={3.4} />}>
            <div className={styles.fillGauche}>
                <Planning photos={photos} remplis={[[0, 0], [1, 1], [2, 0], [3, 1], [4, 0], [5, 1]]} at={0.2} pas={0.12} compact />
                <span className={`${styles.btnBlanc} ${styles.btnFill}`} style={d(1.6)}>Remplir ma liste de courses</span>
            </div>
            <div className={styles.liste}>
                <strong>Liste de courses</strong>
                {['Fruits & légumes', 'Boucherie', 'Épicerie', 'Crèmerie'].map((r, k) => (
                    <div key={r} className={`${styles.rayon} ${styles.in}`} style={d(4 + k * 0.5)}><b>{r}</b><span>{3 + k} articles</span></div>
                ))}
            </div>
            {[0, 1, 2, 3, 4].map((k) => <i key={k} className={styles.vole} style={v({ '--d': `${2.4 + k * 0.18}s`, '--fy': `${k * 2}cqw` })} />)}
            <Curseur a={[30, 40]} b={[22, 38.5]} delay={0.9} clic={2.2} />
        </Fenetre>
    ),

    views: () => (
        <Fenetre side={<Side hl={1} at={0.3} />}>
            <div className={styles.segment}>
                <span className={styles.sOn}>La semaine</span><span>Jour par jour</span><span>En +</span>
                <i className={styles.segGlisse} style={d(3)} />
            </div>
            <div className={styles.listes}>
                <div className={`${styles.listeVue} ${styles.vue1}`}>{['Tomates · 6', 'Poulet · 800 g', 'Farine · 500 g', 'Crème · 20 cl'].map((l) => <div key={l}><span className={styles.case}><b>✓</b></span>{l}</div>)}</div>
                <div className={`${styles.listeVue} ${styles.vue2}`}>{['Lundi — Couscous', 'Mardi — Entrecôte', 'Mercredi — Tarte', 'Jeudi — Risotto'].map((l) => <div key={l}><span className={styles.caseVide} />{l}</div>)}</div>
                <div className={`${styles.listeVue} ${styles.vue3}`}>{['Citron · ajout manuel', 'Basilic · fiche', 'Vanille · fiche'].map((l) => <div key={l}><span className={styles.caseVide} />{l}</div>)}</div>
            </div>
        </Fenetre>
    ),

    ext: () => (
        <Fenetre titre="Drive du magasin" side={<div className={styles.extBulle}><b>Courses Magiques</b><div className={styles.extBarre}><i style={d(1)} /></div><span>Article <em className={styles.n1}>3</em><em className={styles.n2}>7</em><em className={styles.n3}>12</em> / 12</span></div>}>
            <div className={styles.produits}>
                {['Tomates grappe', 'Poulet fermier', 'Farine T55', 'Crème épaisse', 'Basilic', 'Parmesan'].map((p, k) => (
                    <div key={p} className={styles.produit}><span className={styles.imgP} /><em>{p}</em><span className={`${styles.ajout} ${styles.pop}`} style={d(1.2 + k * 1.1)}>+ ajouté</span></div>
                ))}
            </div>
            <div className={styles.panier}>🛒 <b className={styles.pn1}>1</b><b className={styles.pn2}>3</b><b className={styles.pn3}>6</b></div>
        </Fenetre>
    ),

    cave: () => (
        <Fenetre side={<Side hl={4} at={0.3} />}>
            <div className={styles.etageres}>
                {['La cave', 'Goûté & approuvé'].map((t, e) => (
                    <div key={t} className={styles.etagere}><div className={styles.etagereT}>{t}</div>
                        <div className={styles.bouteilles}>{[0, 1, 2].map((k) => <span key={k} className={`${styles.bouteille} ${styles.in}`} style={d(0.3 + k * 0.25 + e * 0.8)}><i /></span>)}
                            {e === 0 && <span className={`${styles.bouteille} ${styles.bouteilleVole}`} style={d(3)}><i /></span>}
                            {e === 1 && <span className={`${styles.bouteille} ${styles.bouteilleArrive}`} style={d(3)}><i /></span>}
                        </div>
                    </div>
                ))}
            </div>
            <div className={`${styles.etiq} ${styles.pop}`} style={d(5.4)}>Quelle recette ? <b>→</b></div>
        </Fenetre>
    ),

    trophy: () => (
        <Fenetre side={<Side hl={3} at={0.3} />}>
            <div className={styles.trophees}>
                {['Première flamme', 'Apprenti', 'Chef de maison', 'Collectionneur', 'Tour du monde', 'Organisé'].map((t, k) => (
                    <div key={t} className={`${styles.trophee} ${styles.pop}`} style={d(0.6 + k * 0.9)}><span>{['🔥', '🍳', '👨‍🍳', '❤️', '🌍', '📅'][k]}</span><em>{t}</em></div>
                ))}
            </div>
        </Fenetre>
    ),

    taste: ({ photos }) => (
        <Fenetre side={<Side />}>
            <div className={styles.pile}>
                {[2, 1, 0].map((k) => (
                    <div key={k} className={`${styles.cartePile} ${k === 0 ? styles.pileA : k === 1 ? styles.pileB : styles.pileC}`}><Img p={photos[k + 3]} /><span>{photos[k + 3]?.title}</span></div>
                ))}
                <i className={`${styles.stamp} ${styles.stampOui}`}>J’AIME</i>
                <i className={`${styles.stamp} ${styles.stampNon}`}>JE PASSE</i>
            </div>
            <div className={styles.progTaste}><i style={d(0.2)} /></div>
        </Fenetre>
    ),

    /* ── Scènes propres au téléphone (appui long, #hashtags, chronos, plan, bar du bas, cocktails) ── */

    press: (c) => SCENES.clic?.(c) ?? null,

    tags: ({ photos }) => (
        <Fenetre>
            <div className={`${styles.chips} ${styles.in}`} style={d(0.2)}>
                {['#ITALIE', '#PÂTES', '#EXPRESS'].map((t, k) => (
                    <span key={t} className={`${styles.chip} ${k === 0 ? styles.chipOn : ''}`}>{t}</span>
                ))}
            </div>
            <div className={styles.tagsBox}>
                <Grille photos={photos} n={8} start={0} />
                <div className={styles.fondu} style={d(2.8)}><Grille photos={photos} n={8} start={3} /></div>
            </div>
            <Curseur a={[30, 40]} b={[14, 14]} delay={0.6} clic={2.2} />
        </Fenetre>
    ),

    timers: ({ photos }) => (
        <Fenetre>
            <div className={styles.rows}>
                {[['3:12', 0.2], ['14:05', 0.6]].map(([t, dl], k) => (
                    <div key={String(t)} className={`${styles.timerRow} ${styles.in}`} style={d(Number(dl))}>
                        <div className={styles.timerThumb}><Img p={photos[k + 1]} /></div>
                        <span>{photos[k + 1]?.title}</span>
                        <b>{t}</b>
                    </div>
                ))}
            </div>
            <div className={`${styles.etiquette} ${styles.in}`} style={d(4.4)}>la loupe affiche le chrono qui finit en premier</div>
            <Curseur a={[30, 40]} b={[84, 16]} delay={1} clic={3.2} />
        </Fenetre>
    ),

    demarrer: () => (
        <Fenetre>
            <div className={styles.planLignes}>
                {['19:05', '19:20', '19:40', '20:00'].map((t, k) => (
                    <div key={t} className={`${styles.lignePlan} ${styles.in}`} style={d(0.2 + k * 0.15)}>
                        <b>{t}</b><span>{['Apéritif', 'Entrée', 'Plat', 'Dessert'][k]}</span>
                    </div>
                ))}
            </div>
            <div className={`${styles.alerte} ${styles.pop}`} style={d(2.4)}>
                <b>19:05 · C’EST L’HEURE</b>
                <div><span className={styles.okA}>OK, c’est fait</span><span>Dans 10 min</span></div>
            </div>
            <Curseur a={[30, 40]} b={[70, 62]} delay={3.6} clic={4.4} />
        </Fenetre>
    ),

    cocktail: ({ photos }) => (
        <Fenetre>
            <div className={styles.rows}>
                {['Cocktails', 'Cocktails sans alcool'].map((t, r) => (
                    <div key={t} className={`${styles.rangee} ${styles.in}`} style={d(0.1 + r * 0.3)}>
                        <div className={styles.rangeeT}>{t} <span>›</span></div>
                        <div className={styles.rangeeCartes}>
                            {Array.from({ length: 5 }).map((_, k) => (
                                <div key={k} className={styles.carteH}><Img p={photos[(k + r * 3) % photos.length]} /></div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
            <Curseur a={[40, 60]} b={[22, 40]} delay={0.6} clic={2} />
        </Fenetre>
    ),

    dock: ({ photos }) => (
        <Fenetre>
            <Grille photos={photos} n={8} start={3} />
            <div className={`${styles.barreBas} ${styles.in}`} style={d(0.3)}>
                <span>♡ Favoris</span><span>☰ Liste</span><span>⌂ Accueil</span>
                <span className={styles.flPulse} style={d(2.8)}>≡ Menu</span>
            </div>
            <Curseur a={[40, 60]} b={[82, 52]} delay={0.6} clic={2.8} />
        </Fenetre>
    ),

    install: () => (
        <div className={styles.bureau}>
            <div className={`${styles.appFen} ${styles.grandit}`} style={d(2.6)}>
                <div className={styles.winBar}><i /><i /><i /><span>Les Recettes Magiques</span></div>
                <div className={styles.appVide}><b /><b /><b /></div>
            </div>
            <div className={styles.dock}><span /><span /><span /><span className={`${styles.dockApp} ${styles.rebond}`} style={d(1.6)} /></div>
            <Curseur a={[20, 36]} b={[50, 33]} delay={0.3} clic={1.5} />
        </div>
    ),
};

/** Planning : 7 jours × midi/soir, rempli au fil du temps. */
function Planning({ photos, remplis, tous, at, pas, compact }: { photos: Photo[]; remplis?: [number, number][]; tous?: boolean; at: number; pas: number; compact?: boolean }) {
    const jours = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    const liste = tous ? jours.flatMap((_, j) => [[j, 0], [j, 1]] as [number, number][]) : remplis || [];
    return (
        <div className={`${styles.planning} ${compact ? styles.planCompact : ''}`}>
            {jours.map((j, c) => (
                <div key={j} className={styles.col}>
                    <div className={styles.colEnt}>{j}</div>
                    {[0, 1].map((r) => {
                        const rang = liste.findIndex(([a, b]) => a === c && b === r);
                        return (
                            <div key={r} className={styles.slot}>
                                <small>{r ? 'Soir' : 'Midi'}</small>
                                {rang >= 0 && <div className={`${styles.slotPlein} ${styles.pop}`} style={d(at + rang * pas)}><Img p={photos[(c * 2 + r) % photos.length]} /></div>}
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}

/* ── Le lecteur ───────────────────────────────────────────────────────────── */

/**
 * `mobile` : même lecteur, sur téléphone — étapes du téléphone (`STEPS_MOBILE`),
 * barre latérale masquée, balayage gauche/droite pour changer d'étape.
 */
export default function TutorialCinema({ onClose, mobile = false }: { onClose: () => void; mobile?: boolean }) {
    const STEPS = useMemo(() => etapesTuto(!mobile), [mobile]);
    const photos = usePhotos();
    const [i, setI] = useState(0);
    const [boucle, setBoucle] = useState(0); // incrémenté pour rejouer
    const [pause, setPause] = useState(false);
    const [survol, setSurvol] = useState(false);
    const glisse = useRef<{ x: number; y: number } | null>(null);

    const step = STEPS[i];
    const aller = useCallback((n: number) => { setI(Math.max(0, Math.min(STEPS.length - 1, n))); setBoucle(0); setPause(false); }, [STEPS.length]);
    const suivant = useCallback(() => { if (i >= STEPS.length - 1) onClose(); else aller(i + 1); }, [i, STEPS.length, aller, onClose]);

    const toucherDebut = (e: ReactTouchEvent) => { const t = e.touches[0]; glisse.current = { x: t.clientX, y: t.clientY }; };
    const toucherFin = (e: ReactTouchEvent) => {
        const s = glisse.current;
        glisse.current = null;
        if (!s) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - s.x;
        const dy = t.clientY - s.y;
        if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) aller(dx < 0 ? i + 1 : i - 1);
    };

    useEffect(() => { if (step?.astuce) marquerAstuceVue(step.astuce); }, [step?.astuce]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') aller(i + 1);
            else if (e.key === 'ArrowLeft') aller(i - 1);
            else if (e.key === ' ') { e.preventDefault(); setPause((p) => !p); }
            else if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [i, aller, onClose]);

    if (!step) return null;
    const scene = SCENES[step.art];
    const arrete = pause || survol;

    return (
        <div className={styles.root} data-paused={arrete} data-mobile={mobile ? 'true' : undefined} style={v({ '--accent': step.accent, '--duree': `${DUREE}s` })}>
            <div className={styles.aurore} style={{ background: step.tint }} />
            <div className={styles.aurore2} style={v({ background: step.accent })} />
            <div className={styles.grain} />
            <div className={styles.vignette} />

            <div className={styles.segments}>
                {STEPS.map((s, n) => (
                    <button key={s.title + n} className={styles.seg} onClick={() => aller(n)} aria-label={`Étape ${n + 1} : ${s.title}`}>
                        <i className={n < i ? styles.segPleine : n === i ? styles.segCourante : ''} onAnimationEnd={n === i ? suivant : undefined} key={n === i ? `${i}-${boucle}` : n} />
                    </button>
                ))}
            </div>

            <div className={styles.corps}>
                <div className={styles.texte}>
                    <div className={styles.rec}><i /> <span>{step.kicker}</span><b>{String(i + 1).padStart(2, '0')} / {String(STEPS.length).padStart(2, '0')}</b></div>
                    <h2 key={`t${i}`} className={styles.titre}>{step.title}</h2>
                    <p key={`p${i}`} className={styles.paragraphe}>{step.text}</p>
                    <div key={`h${i}`} className={styles.sousTitre}><span aria-hidden>☞</span>{step.hint}</div>
                </div>

                <div className={styles.cine} onMouseEnter={() => setSurvol(true)} onMouseLeave={() => setSurvol(false)} onTouchStart={toucherDebut} onTouchEnd={toucherFin}>
                    <div className={styles.cadre} key={`${i}-${boucle}`}>
                        {scene ? scene({ photos }) : <div className={styles.vide}>{step.title}</div>}
                    </div>
                    <div className={styles.cineBas}>
                        <span>{arrete ? '❚❚ pause' : '● lecture'}</span>
                        <span>{mobile ? 'glisse ← →' : 'espace · ← →'}</span>
                    </div>
                </div>
            </div>

            <div className={styles.commandes}>
                <button onClick={() => aller(i - 1)} disabled={i === 0} aria-label="Étape précédente">‹</button>
                <button onClick={() => setPause((p) => !p)} aria-label={pause ? 'Lecture' : 'Pause'}>{pause ? '▶' : '❚❚'}</button>
                <button onClick={() => setBoucle((b) => b + 1)} aria-label="Rejouer la séquence">↻</button>
                <button onClick={suivant} aria-label="Étape suivante" className={styles.cmdNext}>{i === STEPS.length - 1 ? 'Terminer' : '›'}</button>
            </div>
        </div>
    );
}
